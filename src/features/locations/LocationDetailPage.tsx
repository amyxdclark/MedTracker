import { useParams, Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Lock, MapPin, ClipboardCheck } from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { Badge, Card, Button } from '@/components';
import { getComplianceStatus, complianceBadgeVariant } from '@/utils/compliance';
import { formatDateTime } from '@/utils/date';
import type { ItemCatalog } from '@/db/types';

export default function LocationDetailPage() {
  const { id } = useParams();
  const locationId = Number(id);
  const { currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;

  const location = useLiveQuery(() => db.locations.get(locationId), [locationId]);
  const parentLocation = useLiveQuery(
    () => (location?.parentId ? db.locations.get(location.parentId) : undefined),
    [location?.parentId]
  );

  const items = useLiveQuery(
    () =>
      db.inventoryItems
        .where('locationId')
        .equals(locationId)
        .filter((i) => i.isActive)
        .toArray(),
    [locationId]
  );

  const catalogIds = items?.map((i) => i.catalogId) ?? [];
  const catalogs = useLiveQuery(
    () => (catalogIds.length > 0 ? db.itemCatalogs.where('id').anyOf(catalogIds).toArray() : Promise.resolve([] as ItemCatalog[])),
    [catalogIds.join(',')]
  );

  const expectedContents = useLiveQuery(
    () => db.locationExpectedContents.where('locationId').equals(locationId).toArray(),
    [locationId]
  );

  const expectedCatalogIds = expectedContents?.map((e) => e.catalogId) ?? [];
  const expectedCatalogs = useLiveQuery(
    () =>
      expectedCatalogIds.length > 0
        ? db.itemCatalogs.where('id').anyOf(expectedCatalogIds).toArray()
        : Promise.resolve([] as ItemCatalog[]),
    [expectedCatalogIds.join(',')]
  );

  const checkSessions = useLiveQuery(
    () =>
      db.checkSessions
        .where('locationId')
        .equals(locationId)
        .reverse()
        .limit(10)
        .toArray(),
    [locationId]
  );

  if (!location) {
    return <p className="text-slate-400 p-4">Loading...</p>;
  }

  const catalogMap = new Map((catalogs ?? []).map((c) => [c.id!, c]));
  const expectedCatalogMap = new Map((expectedCatalogs ?? []).map((c) => [c.id!, c]));

  const compliance = (() => {
    if (!items || items.length === 0) return 'OK' as const;
    const statuses = items.map((i) => getComplianceStatus(i.lastCheckedAt, location.checkFrequencyHours));
    if (statuses.includes('Overdue')) return 'Overdue' as const;
    if (statuses.includes('DueSoon')) return 'DueSoon' as const;
    return 'OK' as const;
  })();

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/locations" className="inline-flex items-center gap-1 text-blue-400 hover:underline mb-4 text-sm">
        <ArrowLeft size={14} /> Back to Locations
      </Link>

      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <MapPin size={20} className="text-slate-400" />
          <h1 className="text-2xl font-bold text-white">{location.name}</h1>
          <Badge variant="neutral">{location.type}</Badge>
          <Badge variant={complianceBadgeVariant(compliance)}>{compliance}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm text-slate-400">
          <div>
            <span className="font-medium">Parent:</span>{' '}
            {parentLocation ? (
              <Link to={`/locations/${parentLocation.id}`} className="text-blue-400 hover:underline">
                {parentLocation.name}
              </Link>
            ) : (
              'None (root)'
            )}
          </div>
          <div>
            <span className="font-medium">Check Frequency:</span> Every {location.checkFrequencyHours}h
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Sealed:</span>
            {location.sealed ? (
              <>
                <Badge variant="info">
                  <Lock size={10} className="mr-1 inline" />
                  Sealed
                </Badge>
                <span className="text-xs text-slate-400">Seal ID: {location.sealId}</span>
              </>
            ) : (
              'No'
            )}
          </div>
        </div>
      </Card>

      {/* Expected vs Actual Contents */}
      {expectedContents && expectedContents.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">Expected Contents</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="text-left p-2 border-b border-slate-700 font-medium text-slate-300">Item</th>
                  <th className="text-left p-2 border-b border-slate-700 font-medium text-slate-300">Expected</th>
                  <th className="text-left p-2 border-b border-slate-700 font-medium text-slate-300">Actual</th>
                  <th className="text-left p-2 border-b border-slate-700 font-medium text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {expectedContents.map((ec) => {
                  const catalog = expectedCatalogMap.get(ec.catalogId);
                  const actualQty = (items ?? [])
                    .filter((i) => i.catalogId === ec.catalogId && i.status === 'InStock')
                    .reduce((sum, i) => sum + i.quantity, 0);
                  const match = actualQty >= ec.expectedQuantity;
                  return (
                    <tr key={ec.id} className="border-b border-slate-700">
                      <td className="p-2 text-slate-300">{catalog?.name ?? `Catalog #${ec.catalogId}`}</td>
                      <td className="p-2 text-slate-300">{ec.expectedQuantity}</td>
                      <td className="p-2 text-slate-300">{actualQty}</td>
                      <td className="p-2">
                        <Badge variant={match ? 'ok' : 'danger'}>{match ? 'OK' : 'Short'}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Items at this location */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">
          Items ({items?.length ?? 0})
        </h2>
        {!items || items.length === 0 ? (
          <p className="text-slate-400 text-sm">No items at this location.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const catalog = catalogMap.get(item.catalogId);
              const itemCompliance = getComplianceStatus(item.lastCheckedAt, location.checkFrequencyHours);
              return (
                <Card key={item.id} className="!p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{catalog?.name ?? `Item #${item.id}`}</span>
                      <span className="text-xs text-slate-400 ml-2">QR: {item.qrCode6}</span>
                      <span className="text-xs text-slate-400 ml-2">Qty: {item.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{item.status}</Badge>
                      <Badge variant={complianceBadgeVariant(itemCompliance)}>{itemCompliance}</Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Check Sessions */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">Recent Checks</h2>
          <Link to={`/checks?locationId=${location.id}`}>
            <Button size="sm" icon={<ClipboardCheck size={16} />}>
              Start Check
            </Button>
          </Link>
        </div>
        {!checkSessions || checkSessions.length === 0 ? (
          <p className="text-slate-400 text-sm">No check sessions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {checkSessions.map((session) => (
              <Card key={session.id} className="!p-3">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{formatDateTime(session.startedAt)}</span>
                    {session.sealVerified && (
                      <span className="ml-2"><Badge variant="info">Seal Verified</Badge></span>
                    )}
                  </div>
                  <span className="text-slate-400">
                    {session.completedAt ? `Completed ${formatDateTime(session.completedAt)}` : 'In progress'}
                  </span>
                </div>
                {session.notes && <p className="text-xs text-slate-400 mt-1">{session.notes}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
