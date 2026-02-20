import { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { useAuth } from '@/auth';
import { nowISO, formatDateTime } from '@/utils/date';
import { Button, Card, Badge } from '@/components';
import type { DiscrepancyCase } from '@/db/types';

export default function DiscrepanciesPage() {
  const { currentUser, currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const userId = currentUser?.id ?? 0;

  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolution, setResolution] = useState('');
  const [processing, setProcessing] = useState(false);

  const cases = useLiveQuery(
    () => db.discrepancyCases.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const items = useLiveQuery(
    () => db.inventoryItems.where('serviceId').equals(serviceId).filter(i => i.isActive).toArray(),
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

  const itemCatalogId = useMemo(() => {
    const m = new Map<number, number>();
    (items ?? []).forEach(i => m.set(i.id!, i.catalogId));
    return m;
  }, [items]);

  const openCases = useMemo(
    () => (cases ?? []).filter(c => c.status !== 'Resolved'),
    [cases],
  );

  const resolvedCases = useMemo(
    () => (cases ?? []).filter(c => c.status === 'Resolved'),
    [cases],
  );

  const handleCreate = async () => {
    if (!selectedItemId || !description.trim()) return;
    setProcessing(true);
    try {
      const now = nowISO();
      const id = await db.discrepancyCases.add({
        serviceId,
        itemId: Number(selectedItemId),
        status: 'Open',
        description: description.trim(),
        resolution: '',
        openedBy: userId,
        openedAt: now,
      });

      await writeAuditEvent(
        serviceId, userId, 'DISCREPANCY_OPENED', 'DiscrepancyCase', id,
        `Discrepancy opened for ${catalogMap.get(itemCatalogId.get(Number(selectedItemId)) ?? 0) ?? 'item'}: ${description.trim()}`,
      );

      setShowNewForm(false);
      setSelectedItemId('');
      setDescription('');
    } finally {
      setProcessing(false);
    }
  };

  const handleResolve = async (c: DiscrepancyCase) => {
    if (!resolution.trim()) return;
    setProcessing(true);
    try {
      const now = nowISO();
      await db.discrepancyCases.update(c.id!, {
        status: 'Resolved',
        resolution: resolution.trim(),
        resolvedBy: userId,
        resolvedAt: now,
      });

      await writeAuditEvent(
        serviceId, userId, 'DISCREPANCY_RESOLVED', 'DiscrepancyCase', c.id!,
        `Discrepancy resolved: ${resolution.trim()}`,
      );

      setResolvingId(null);
      setResolution('');
    } finally {
      setProcessing(false);
    }
  };

  const statusVariant = (s: string) => s === 'Open' ? 'danger' : s === 'Investigating' ? 'warning' : 'ok';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle size={24} /> Discrepancies
        </h1>
        <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowNewForm(!showNewForm)}>New</Button>
      </div>

      {showNewForm && (
        <Card className="border-blue-300 bg-blue-50">
          <h2 className="font-semibold text-slate-900 mb-3">Report Discrepancy</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
              <select
                value={selectedItemId}
                onChange={e => setSelectedItemId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an item…</option>
                {(items ?? []).map(item => (
                  <option key={item.id} value={item.id}>
                    {catalogMap.get(item.catalogId) ?? 'Unknown'} — {item.qrCode6}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the discrepancy…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button onClick={handleCreate} disabled={processing || !selectedItemId || !description.trim()}>
              {processing ? 'Saving…' : 'Submit Discrepancy'}
            </Button>
          </div>
        </Card>
      )}

      {/* Open cases */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Open Cases ({openCases.length})</h2>
        {openCases.length === 0 && <p className="text-slate-500 text-sm">No open discrepancies.</p>}
        <div className="space-y-3">
          {openCases.map(c => (
            <Card key={c.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-900">{catalogMap.get(itemCatalogId.get(c.itemId) ?? 0) ?? `Item #${c.itemId}`}</p>
                  <p className="text-sm text-slate-600 mt-1">{c.description}</p>
                  <p className="text-xs text-slate-400 mt-1">Opened {formatDateTime(c.openedAt)}</p>
                </div>
                <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
              </div>
              {resolvingId === c.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={resolution}
                    onChange={e => setResolution(e.target.value)}
                    rows={2}
                    placeholder="Resolution notes…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="success" onClick={() => handleResolve(c)} disabled={processing || !resolution.trim()}>
                      {processing ? 'Saving…' : 'Resolve'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setResolvingId(null); setResolution(''); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <Button size="sm" variant="secondary" icon={<CheckCircle size={14} />} onClick={() => setResolvingId(c.id!)}>
                    Resolve
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Resolved cases */}
      {resolvedCases.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Resolved ({resolvedCases.length})</h2>
          <div className="space-y-3">
            {resolvedCases.map(c => (
              <Card key={c.id} className="opacity-75">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{catalogMap.get(itemCatalogId.get(c.itemId) ?? 0) ?? `Item #${c.itemId}`}</p>
                    <p className="text-sm text-slate-600 mt-1">{c.description}</p>
                    <p className="text-sm text-green-700 mt-1">Resolution: {c.resolution}</p>
                    <p className="text-xs text-slate-400 mt-1">Resolved {c.resolvedAt ? formatDateTime(c.resolvedAt) : '—'}</p>
                  </div>
                  <Badge variant="ok">Resolved</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
