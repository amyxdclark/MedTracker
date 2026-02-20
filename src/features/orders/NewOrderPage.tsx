import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { useAuth } from '@/auth';
import { nowISO } from '@/utils/date';
import { Stepper, Button, Card, Badge } from '@/components';

interface DraftLine {
  catalogId: number;
  quantity: number;
}

interface ReceivedLine {
  catalogId: number;
  quantityOrdered: number;
  quantityReceived: number;
  locationId: number;
  // controlled substance fields
  lotNumber: string;
  serialNumber: string;
  expirationDate: string;
}

const STEPS = ['Create Order', 'Receive Items', 'Create Inventory', 'Review', 'Done'];

function generateQrCode6(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const { currentUser, currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const userId = currentUser?.id ?? 0;

  const [step, setStep] = useState(0);
  const [vendorId, setVendorId] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([{ catalogId: 0, quantity: 1 }]);
  const [orderId, setOrderId] = useState<number>(0);
  const [receivedLines, setReceivedLines] = useState<ReceivedLine[]>([]);
  const [createdItemCount, setCreatedItemCount] = useState(0);
  const [processing, setProcessing] = useState(false);

  const vendors = useLiveQuery(
    () => db.vendors.where('serviceId').equals(serviceId).filter(v => v.isActive).toArray(),
    [serviceId],
  );

  const catalogs = useLiveQuery(
    () => db.itemCatalogs.where('serviceId').equals(serviceId).filter(c => c.isActive).toArray(),
    [serviceId],
  );

  const locations = useLiveQuery(
    () => db.locations.where('serviceId').equals(serviceId).filter(l => l.isActive).toArray(),
    [serviceId],
  );

  const catalogMap = useMemo(() => {
    const m = new Map<number, (typeof catalogs extends (infer T)[] | undefined ? NonNullable<T> : never)>();
    catalogs?.forEach(c => m.set(c.id!, c));
    return m;
  }, [catalogs]);

  const addLine = () => setDraftLines(prev => [...prev, { catalogId: 0, quantity: 1 }]);
  const removeLine = (i: number) => setDraftLines(prev => prev.filter((_, idx) => idx !== i));

  const updateDraftLine = (i: number, field: keyof DraftLine, value: number) => {
    setDraftLines(prev => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  };

  const canCreateOrder = vendorId > 0 && draftLines.every(l => l.catalogId > 0 && l.quantity > 0);

  const handleCreateOrder = useCallback(async () => {
    setProcessing(true);
    try {
      const now = nowISO();
      const id = await db.orders.add({
        serviceId,
        vendorId,
        status: 'Submitted',
        orderDate: now,
        notes,
        createdBy: userId,
        createdAt: now,
      });
      setOrderId(id);

      for (const line of draftLines) {
        await db.orderLines.add({
          orderId: id,
          catalogId: line.catalogId,
          quantityOrdered: line.quantity,
          quantityReceived: 0,
        });
      }

      await writeAuditEvent(serviceId, userId, 'ORDER_CREATED', 'Order', id, `Order created with ${draftLines.length} line(s)`);

      const defaultLoc = locations?.find(l => l.type === 'StockRoom')?.id ?? locations?.[0]?.id ?? 0;
      setReceivedLines(
        draftLines.map(l => ({
          catalogId: l.catalogId,
          quantityOrdered: l.quantity,
          quantityReceived: l.quantity,
          locationId: defaultLoc,
          lotNumber: '',
          serialNumber: '',
          expirationDate: '',
        })),
      );
      setStep(1);
    } finally {
      setProcessing(false);
    }
  }, [serviceId, vendorId, notes, userId, draftLines, locations]);

  const updateReceivedLine = (i: number, field: string, value: string | number) => {
    setReceivedLines(prev =>
      prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)),
    );
  };

  const handleReceiveComplete = () => setStep(2);

  const handleCreateInventory = useCallback(async () => {
    setProcessing(true);
    try {
      const now = nowISO();
      let count = 0;

      for (const line of receivedLines) {
        if (line.quantityReceived <= 0) continue;
        const cat = catalogMap.get(line.catalogId);

        // Update order line
        const orderLine = await db.orderLines
          .where('orderId')
          .equals(orderId)
          .filter(ol => ol.catalogId === line.catalogId)
          .first();
        if (orderLine) {
          await db.orderLines.update(orderLine.id!, { quantityReceived: line.quantityReceived });
        }

        for (let i = 0; i < line.quantityReceived; i++) {
          const qrCode6 = generateQrCode6();

          let lotId: number | undefined;
          if (cat?.isControlled && line.lotNumber) {
            lotId = await db.medicationLots.add({
              serviceId,
              catalogId: line.catalogId,
              lotNumber: line.lotNumber,
              serialNumber: line.serialNumber || `SN-${qrCode6}`,
              expirationDate: line.expirationDate || '',
              qrCode6,
              createdAt: now,
            });
          }

          const itemId = await db.inventoryItems.add({
            serviceId,
            catalogId: line.catalogId,
            lotId,
            locationId: line.locationId,
            status: 'InStock',
            quantity: 1,
            qrCode6,
            notes: '',
            isActive: true,
            lastCheckedAt: now,
            createdAt: now,
          });

          await writeAuditEvent(
            serviceId, userId, 'ITEM_CREATED', 'InventoryItem', itemId,
            `Item created from order #${orderId}: ${cat?.name ?? 'Unknown'} (${qrCode6})`,
          );
          count++;
        }
      }

      // Determine order status
      const hasDiscrepancy = receivedLines.some(l => l.quantityReceived !== l.quantityOrdered);
      const newStatus = hasDiscrepancy ? 'PartiallyReceived' : 'Received';
      await db.orders.update(orderId, { status: newStatus });
      await writeAuditEvent(serviceId, userId, 'ORDER_RECEIVED', 'Order', orderId, `Order marked ${newStatus}. ${count} item(s) created.`);

      setCreatedItemCount(count);
      setStep(3);
    } finally {
      setProcessing(false);
    }
  }, [receivedLines, orderId, serviceId, userId, catalogMap]);

  // Step 0: Create Order
  const renderCreateOrder = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
        <select
          value={vendorId}
          onChange={e => setVendorId(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>Select a vendor…</option>
          {vendors?.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Order Lines</label>
        <div className="space-y-2">
          {draftLines.map((line, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={line.catalogId}
                onChange={e => updateDraftLine(i, 'catalogId', Number(e.target.value))}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Select item…</option>
                {catalogs?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={e => updateDraftLine(i, 'quantity', Math.max(1, Number(e.target.value)))}
                className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {draftLines.length > 1 && (
                <button onClick={() => removeLine(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addLine} className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <Plus size={14} /> Add another line
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Button onClick={handleCreateOrder} disabled={!canCreateOrder || processing}>
        {processing ? 'Creating…' : 'Create Order'}
      </Button>
    </div>
  );

  // Step 1: Receive Items
  const renderReceive = () => (
    <div className="space-y-4">
      {receivedLines.map((line, i) => {
        const cat = catalogMap.get(line.catalogId);
        return (
          <Card key={i}>
            <p className="font-semibold text-slate-900 mb-2">{cat?.name ?? `Item #${line.catalogId}`}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-slate-500 mb-1">Qty Ordered</label>
                <p className="font-medium">{line.quantityOrdered}</p>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Qty Received</label>
                <input
                  type="number"
                  min={0}
                  value={line.quantityReceived}
                  onChange={e => updateReceivedLine(i, 'quantityReceived', Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-500 mb-1">Destination Location</label>
                <select
                  value={line.locationId}
                  onChange={e => updateReceivedLine(i, 'locationId', Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {locations?.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              {cat?.isControlled && (
                <>
                  <div>
                    <label className="block text-slate-500 mb-1">Lot Number</label>
                    <input
                      type="text"
                      value={line.lotNumber}
                      onChange={e => updateReceivedLine(i, 'lotNumber', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. LOT-2025-001"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Serial Number</label>
                    <input
                      type="text"
                      value={line.serialNumber}
                      onChange={e => updateReceivedLine(i, 'serialNumber', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. SN-001"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-slate-500 mb-1">Expiration Date</label>
                    <input
                      type="date"
                      value={line.expirationDate}
                      onChange={e => updateReceivedLine(i, 'expirationDate', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
              {line.quantityReceived !== line.quantityOrdered && (
                <div className="col-span-2">
                  <Badge variant="warning">
                    Discrepancy: ordered {line.quantityOrdered}, received {line.quantityReceived}
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        );
      })}
      <Button onClick={handleReceiveComplete}>Continue</Button>
    </div>
  );

  // Step 2: Create Inventory (confirmation)
  const renderCreateInventory = () => {
    const totalToCreate = receivedLines.reduce((sum, l) => sum + l.quantityReceived, 0);
    return (
      <div className="space-y-4">
        <Card>
          <p className="text-slate-700">
            <span className="font-semibold">{totalToCreate}</span> inventory item(s) will be created from{' '}
            <span className="font-semibold">{receivedLines.length}</span> line(s).
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {receivedLines.map((l, i) => (
              <li key={i} className="text-slate-600">
                {catalogMap.get(l.catalogId)?.name ?? `Item #${l.catalogId}`}: {l.quantityReceived} item(s)
                → {locations?.find(loc => loc.id === l.locationId)?.name ?? 'Unknown'}
              </li>
            ))}
          </ul>
        </Card>
        <Button onClick={handleCreateInventory} disabled={processing}>
          {processing ? 'Creating Items…' : 'Create Inventory Items'}
        </Button>
      </div>
    );
  };

  // Step 3: Review
  const renderReview = () => {
    const discrepancies = receivedLines.filter(l => l.quantityReceived !== l.quantityOrdered);
    return (
      <div className="space-y-4">
        <Card>
          <p className="font-semibold text-green-700 mb-2">
            ✓ {createdItemCount} inventory item(s) created successfully.
          </p>
          {discrepancies.length > 0 && (
            <div className="mt-3">
              <p className="font-medium text-amber-700 mb-1">Discrepancies:</p>
              <ul className="text-sm space-y-1">
                {discrepancies.map((d, i) => (
                  <li key={i} className="text-amber-600">
                    {catalogMap.get(d.catalogId)?.name}: ordered {d.quantityOrdered}, received {d.quantityReceived}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Button onClick={() => setStep(4)}>Continue</Button>
      </div>
    );
  };

  // Step 4: Done
  const renderDone = () => (
    <div className="text-center space-y-4 py-8">
      <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
      <h2 className="text-xl font-bold text-slate-900">Order Received Successfully!</h2>
      <p className="text-slate-500">Order #{orderId} has been processed and inventory items have been created.</p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => navigate(`/orders/${orderId}`)}>View Order</Button>
        <Button variant="secondary" onClick={() => navigate('/orders')}>All Orders</Button>
      </div>
    </div>
  );

  const stepRenderers = [renderCreateOrder, renderReceive, renderCreateInventory, renderReview, renderDone];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Receive Order</h1>
      <Stepper steps={STEPS} currentStep={step} />
      {stepRenderers[step]()}
    </div>
  );
}
