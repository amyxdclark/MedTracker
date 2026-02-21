import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { useAuth } from '@/auth';
import { nowISO, formatDateTime } from '@/utils/date';
import { Badge, Card, Button } from '@/components';
import type { IncidentStatus } from '@/db/types';

const statusVariant = (s: IncidentStatus) => {
  if (s === 'Open') return 'warning' as const;
  return 'ok' as const;
};

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const userId = currentUser?.id ?? 0;
  const incidentId = Number(id);

  const [closing, setClosing] = useState(false);

  const incident = useLiveQuery(() => db.incidents.get(incidentId), [incidentId]);

  const incidentItems = useLiveQuery(
    () => db.incidentItems.where('incidentId').equals(incidentId).toArray(),
    [incidentId],
  );

  const inventoryItems = useLiveQuery(
    () =>
      incidentItems && incidentItems.length > 0
        ? db.inventoryItems.where('id').anyOf(incidentItems.map(ii => ii.itemId)).toArray()
        : Promise.resolve([] as import('@/db/types').InventoryItem[]),
    [incidentItems],
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

  const inventoryMap = useMemo(() => {
    const m = new Map<number, { name: string; qrCode6: string; unit: string }>();
    (inventoryItems ?? []).forEach(item => {
      const catName = catalogMap.get(item.catalogId) ?? `Item #${item.catalogId}`;
      // unit from catalog
      const cat = (catalogs ?? []).find(c => c.id === item.catalogId);
      m.set(item.id!, { name: catName, qrCode6: item.qrCode6, unit: cat?.unit ?? '' });
    });
    return m;
  }, [inventoryItems, catalogMap, catalogs]);

  const handleClose = async () => {
    if (!incident) return;
    setClosing(true);
    try {
      const now = nowISO();
      await db.incidents.update(incidentId, { status: 'Closed', closedAt: now });
      await writeAuditEvent(
        serviceId,
        userId,
        'INCIDENT_CLOSED',
        'Incident',
        incidentId,
        `Incident closed: ${incident.title}`,
      );
    } finally {
      setClosing(false);
    }
  };

  if (incident === undefined) {
    return <p className="text-slate-400 p-4">Loading…</p>;
  }
  if (incident === null) {
    return <p className="text-red-400 p-4">Incident not found.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="secondary" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(-1)}>
        Back
      </Button>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {incident.status === 'Open' ? (
              <AlertCircle size={22} className="text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={22} className="text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{incident.title}</h1>
              <p className="text-sm text-slate-400 mt-1">{formatDateTime(incident.incidentDate)}</p>
            </div>
          </div>
          <Badge variant={statusVariant(incident.status)}>{incident.status}</Badge>
        </div>

        {incident.description && (
          <div className="text-sm">
            <span className="text-slate-400">Description</span>
            <p className="text-white mt-1">{incident.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Created</span>
            <p className="font-medium text-white">{formatDateTime(incident.createdAt)}</p>
          </div>
          {incident.closedAt && (
            <div>
              <span className="text-slate-400">Closed</span>
              <p className="font-medium text-white">{formatDateTime(incident.closedAt)}</p>
            </div>
          )}
        </div>

        {incident.status === 'Open' && (
          <div>
            <Button
              variant="secondary"
              size="sm"
              icon={<CheckCircle2 size={16} />}
              onClick={handleClose}
              disabled={closing}
            >
              {closing ? 'Closing…' : 'Close Incident'}
            </Button>
          </div>
        )}
      </Card>

      {/* Items used */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Supplies &amp; Medications Used</h2>
        {!incidentItems || incidentItems.length === 0 ? (
          <p className="text-slate-400 text-sm">No supplies or medications linked to this incident.</p>
        ) : (
          <div className="space-y-2">
            {incidentItems.map(ii => {
              const info = inventoryMap.get(ii.itemId);
              return (
                <Card key={ii.id} className="text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{info?.name ?? `Item #${ii.itemId}`}</p>
                      <p className="text-slate-400">QR: {info?.qrCode6 ?? '—'}</p>
                      {ii.notes && <p className="text-slate-400 mt-0.5">{ii.notes}</p>}
                    </div>
                    <Badge variant="neutral">
                      {ii.quantityUsed} {info?.unit ?? ''}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
