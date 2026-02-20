import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { useAuth } from '@/auth';
import { nowISO, formatDate } from '@/utils/date';
import { Stepper, Button, Card, Badge } from '@/components';

const STEPS = ['Select Item', 'Exchange', 'Complete'];

export default function ExpiredExchangePage() {
  const navigate = useNavigate();
  const { currentUser, currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const userId = currentUser?.id ?? 0;

  const [step, setStep] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [replacementNotes, setReplacementNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const items = useLiveQuery(
    () => db.inventoryItems.where('serviceId').equals(serviceId).filter(i => i.isActive && i.status === 'InStock').toArray(),
    [serviceId],
  );

  const lots = useLiveQuery(
    () => db.medicationLots.where('serviceId').equals(serviceId).toArray(),
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

  const lotMap = useMemo(() => {
    const m = new Map<number, { lotNumber: string; expirationDate: string }>();
    (lots ?? []).forEach(l => m.set(l.id!, { lotNumber: l.lotNumber, expirationDate: l.expirationDate }));
    return m;
  }, [lots]);

  // Items that are expiring within 30 days or already expired
  const expiringItems = useMemo(() => {
    const now = new Date();
    const threshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return (items ?? []).filter(item => {
      if (!item.lotId) return false;
      const lot = lotMap.get(item.lotId);
      if (!lot) return false;
      return lot.expirationDate <= threshold;
    });
  }, [items, lotMap]);

  const selectedItem = useMemo(
    () => expiringItems.find(i => i.id === selectedItemId) ?? null,
    [expiringItems, selectedItemId],
  );

  const isExpired = (expirationDate: string) => expirationDate <= new Date().toISOString();

  const handleExchange = async () => {
    if (!selectedItem) return;
    setProcessing(true);
    try {
      await db.inventoryItems.update(selectedItem.id!, { status: 'Expired' });

      await writeAuditEvent(
        serviceId, userId, 'ITEM_EXPIRED_EXCHANGE', 'InventoryItem', selectedItem.id!,
        `Expired exchange for ${catalogMap.get(selectedItem.catalogId) ?? 'item'}.${replacementNotes ? ` Replacement: ${replacementNotes}` : ''}`,
      );

      setStep(2);
    } finally {
      setProcessing(false);
    }
  };

  const renderSelectItem = () => (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Items expiring within 30 days or already expired.</p>
      {expiringItems.length === 0 && <p className="text-slate-500 text-sm">No expiring or expired items found.</p>}
      {expiringItems.map(item => {
        const lot = item.lotId ? lotMap.get(item.lotId) : null;
        const expired = lot ? isExpired(lot.expirationDate) : false;
        return (
          <Card
            key={item.id}
            className={selectedItemId === item.id ? 'ring-2 ring-blue-500' : ''}
            onClick={() => setSelectedItemId(item.id!)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{catalogMap.get(item.catalogId) ?? 'Unknown'}</p>
                <p className="text-sm text-slate-500">
                  Lot: {lot?.lotNumber ?? '—'} · Expires: {lot ? formatDate(lot.expirationDate) : '—'}
                </p>
              </div>
              <Badge variant={expired ? 'danger' : 'warning'}>{expired ? 'Expired' : 'Expiring Soon'}</Badge>
            </div>
          </Card>
        );
      })}
      <Button onClick={() => setStep(1)} disabled={!selectedItemId}>Continue</Button>
    </div>
  );

  const renderExchange = () => {
    const lot = selectedItem?.lotId ? lotMap.get(selectedItem.lotId) : null;
    return (
      <div className="space-y-4">
        <Card className="border-amber-300 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Mark as Expired</p>
              <p className="text-sm text-slate-600 mt-1">
                {catalogMap.get(selectedItem?.catalogId ?? 0)} (Lot: {lot?.lotNumber ?? '—'}) will be marked as Expired.
              </p>
            </div>
          </div>
        </Card>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Replacement Notes (optional)</label>
          <textarea
            value={replacementNotes}
            onChange={e => setReplacementNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Replacement item received from vendor, new lot #12345"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button onClick={handleExchange} disabled={processing} variant="danger">
          {processing ? 'Processing…' : 'Confirm Expired Exchange'}
        </Button>
      </div>
    );
  };

  const renderComplete = () => (
    <div className="text-center space-y-4 py-8">
      <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
      <h2 className="text-xl font-bold text-slate-900">Exchange Recorded</h2>
      <p className="text-slate-500">
        {catalogMap.get(selectedItem?.catalogId ?? 0)} has been marked as expired.
      </p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => navigate('/home')}>Home</Button>
        <Button variant="secondary" onClick={() => navigate('/inventory')}>Inventory</Button>
      </div>
    </div>
  );

  const stepRenderers = [renderSelectItem, renderExchange, renderComplete];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Expired Exchange</h1>
      <Stepper steps={STEPS} currentStep={step} />
      {stepRenderers[step]()}
    </div>
  );
}
