import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle, ArrowRightLeft } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { useAuth } from '@/auth';
import { nowISO } from '@/utils/date';
import { Stepper, Button, Card } from '@/components';

const STEPS = ['Select Item', 'Destination', 'Confirm', 'Complete'];

export default function NewTransferPage() {
  const navigate = useNavigate();
  const { currentUser, currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const userId = currentUser?.id ?? 0;

  const [step, setStep] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [toLocationId, setToLocationId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const items = useLiveQuery(
    () => db.inventoryItems.where('serviceId').equals(serviceId).filter(i => i.isActive && i.status === 'InStock').toArray(),
    [serviceId],
  );

  const locations = useLiveQuery(
    () => db.locations.where('serviceId').equals(serviceId).filter(l => l.isActive).toArray(),
    [serviceId],
  );

  const catalogs = useLiveQuery(
    () => db.itemCatalogs.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const catalogMap = useMemo(() => {
    const m = new Map<number, string>();
    (catalogs ?? []).forEach(c => m.set(c.id!, c.name));
    return m;
  }, [catalogs]);

  const locationMap = useMemo(() => {
    const m = new Map<number, string>();
    (locations ?? []).forEach(l => m.set(l.id!, l.name));
    return m;
  }, [locations]);

  const selectedItem = useMemo(
    () => (items ?? []).find(i => i.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const handleConfirm = async () => {
    if (!selectedItem || !toLocationId) return;
    setProcessing(true);
    try {
      const now = nowISO();
      const transferId = await db.transfers.add({
        serviceId,
        itemId: selectedItem.id!,
        fromLocationId: selectedItem.locationId,
        toLocationId,
        transferredBy: userId,
        transferredAt: now,
        notes,
      });

      await db.inventoryItems.update(selectedItem.id!, { locationId: toLocationId });

      await writeAuditEvent(
        serviceId, userId, 'ITEM_TRANSFERRED', 'Transfer', transferId,
        `Transferred ${catalogMap.get(selectedItem.catalogId) ?? 'item'} from ${locationMap.get(selectedItem.locationId) ?? '?'} to ${locationMap.get(toLocationId) ?? '?'}`,
      );

      setStep(3);
    } finally {
      setProcessing(false);
    }
  };

  const renderSelectItem = () => (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Select an item to transfer.</p>
      {(items ?? []).length === 0 && <p className="text-slate-400 text-sm">No in-stock items found.</p>}
      {(items ?? []).map(item => (
        <Card
          key={item.id}
          className={selectedItemId === item.id ? 'ring-2 ring-blue-500' : ''}
          onClick={() => setSelectedItemId(item.id!)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">{catalogMap.get(item.catalogId) ?? 'Unknown'}</p>
              <p className="text-sm text-slate-400">QR: {item.qrCode6} · Location: {locationMap.get(item.locationId) ?? '—'}</p>
            </div>
            <ArrowRightLeft size={18} className="text-slate-400" />
          </div>
        </Card>
      ))}
      <Button onClick={() => setStep(1)} disabled={!selectedItemId}>Continue</Button>
    </div>
  );

  const renderDestination = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Destination Location</label>
        <select
          value={toLocationId ?? ''}
          onChange={e => setToLocationId(Number(e.target.value) || null)}
          className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a location…</option>
          {(locations ?? []).filter(l => l.id !== selectedItem?.locationId).map(l => (
            <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <Button onClick={() => setStep(2)} disabled={!toLocationId}>Continue to Review</Button>
    </div>
  );

  const renderConfirm = () => (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-white mb-3">Transfer Summary</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-slate-400">Item</p><p className="font-medium text-white">{catalogMap.get(selectedItem?.catalogId ?? 0) ?? '—'}</p></div>
          <div><p className="text-slate-400">QR Code</p><p className="font-medium text-white">{selectedItem?.qrCode6}</p></div>
          <div><p className="text-slate-400">From</p><p className="font-medium text-white">{locationMap.get(selectedItem?.locationId ?? 0) ?? '—'}</p></div>
          <div><p className="text-slate-400">To</p><p className="font-medium text-white">{locationMap.get(toLocationId ?? 0) ?? '—'}</p></div>
          {notes && <div className="col-span-2"><p className="text-slate-400">Notes</p><p className="font-medium text-white">{notes}</p></div>}
        </div>
      </Card>
      <Button onClick={handleConfirm} disabled={processing} variant="success">
        {processing ? 'Processing…' : 'Confirm Transfer'}
      </Button>
    </div>
  );

  const renderComplete = () => (
    <div className="text-center space-y-4 py-8">
      <CheckCircle className="mx-auto h-16 w-16 text-emerald-400" />
      <h2 className="text-xl font-bold text-white">Transfer Complete</h2>
      <p className="text-slate-400">
        {catalogMap.get(selectedItem?.catalogId ?? 0)} has been moved to {locationMap.get(toLocationId ?? 0)}.
      </p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => navigate('/home')}>Home</Button>
        <Button variant="secondary" onClick={() => navigate('/inventory')}>Inventory</Button>
      </div>
    </div>
  );

  const stepRenderers = [renderSelectItem, renderDestination, renderConfirm, renderComplete];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Transfer Items</h1>
      <Stepper steps={STEPS} currentStep={step} />
      {stepRenderers[step]()}
    </div>
  );
}
