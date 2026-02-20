import { useParams, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/db/database';
import { getExpirationStatus, getComplianceStatus, complianceBadgeVariant } from '@/utils/compliance';
import { Badge, Card, Button } from '@/components';
import type { ItemStatus } from '@/db/types';

const statusVariant = (s: ItemStatus) => {
  if (s === 'InStock') return 'ok' as const;
  if (s === 'Expired' || s === 'Lost' || s === 'Damaged') return 'danger' as const;
  if (s === 'Transferred') return 'info' as const;
  return 'neutral' as const;
};

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const itemId = Number(id);

  const item = useLiveQuery(() => db.inventoryItems.get(itemId), [itemId]);
  const catalog = useLiveQuery(() => item ? db.itemCatalogs.get(item.catalogId) : undefined, [item]);
  const location = useLiveQuery(() => item ? db.locations.get(item.locationId) : undefined, [item]);
  const lot = useLiveQuery(() => item?.lotId ? db.medicationLots.get(item.lotId) : undefined, [item]);

  const auditTrail = useLiveQuery(
    () =>
      db.auditEvents
        .where('[entityType+entityId]')
        .equals(['InventoryItem', itemId])
        .toArray()
        .catch(() =>
          db.auditEvents.filter(e => e.entityType === 'InventoryItem' && e.entityId === itemId).toArray()
        ),
    [itemId],
  );

  if (item === undefined) {
    return <p className="text-slate-500 p-4">Loading…</p>;
  }
  if (item === null) {
    return <p className="text-red-600 p-4">Item not found.</p>;
  }

  const expStatus = lot ? getExpirationStatus(lot.expirationDate) : undefined;
  const checkStatus = location?.checkFrequencyHours
    ? getComplianceStatus(item.lastCheckedAt, location.checkFrequencyHours)
    : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="secondary" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(-1)}>
        Back
      </Button>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {catalog?.name ?? `Item #${item.catalogId}`}
            </h1>
            <p className="text-sm text-slate-500 mt-1">QR Code: {item.qrCode6 || '—'}</p>
          </div>
          <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Location</span>
            <p className="font-medium text-slate-900">{location?.name ?? '—'}</p>
          </div>
          <div>
            <span className="text-slate-500">Quantity</span>
            <p className="font-medium text-slate-900">{item.quantity} {catalog?.unit ?? ''}</p>
          </div>
          <div>
            <span className="text-slate-500">Category</span>
            <p className="font-medium text-slate-900">{catalog?.category ?? '—'}</p>
          </div>
          <div>
            <span className="text-slate-500">Controlled</span>
            <p className="font-medium text-slate-900">{catalog?.isControlled ? 'Yes' : 'No'}</p>
          </div>
          {lot && (
            <>
              <div>
                <span className="text-slate-500">Lot Number</span>
                <p className="font-medium text-slate-900">{lot.lotNumber}</p>
              </div>
              <div>
                <span className="text-slate-500">Expiration Date</span>
                <p className="font-medium text-slate-900">{new Date(lot.expirationDate).toLocaleDateString()}</p>
              </div>
            </>
          )}
          <div>
            <span className="text-slate-500">Last Checked</span>
            <p className="font-medium text-slate-900">{new Date(item.lastCheckedAt).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-slate-500">Created</span>
            <p className="font-medium text-slate-900">{new Date(item.createdAt).toLocaleString()}</p>
          </div>
        </div>

        {item.notes && (
          <div className="text-sm">
            <span className="text-slate-500">Notes</span>
            <p className="text-slate-900">{item.notes}</p>
          </div>
        )}

        {/* Compliance badges */}
        <div className="flex gap-2 flex-wrap">
          {expStatus && (
            <Badge variant={complianceBadgeVariant(expStatus)}>
              Expiration: {expStatus}
            </Badge>
          )}
          {checkStatus && (
            <Badge variant={complianceBadgeVariant(checkStatus)}>
              Check: {checkStatus}
            </Badge>
          )}
        </div>
      </Card>

      {/* Audit trail */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Audit Trail</h2>
        {!auditTrail || auditTrail.length === 0 ? (
          <p className="text-slate-500 text-sm">No audit events recorded for this item.</p>
        ) : (
          <div className="space-y-2">
            {auditTrail.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(event => (
              <Card key={event.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="info">{event.eventType}</Badge>
                  <span className="text-xs text-slate-400">{new Date(event.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-slate-600 mt-1">{event.details}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
