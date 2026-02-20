import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search } from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { getExpirationStatus, complianceBadgeVariant } from '@/utils/compliance';
import { Badge, Card } from '@/components';
import type { ItemStatus } from '@/db/types';

const STATUS_OPTIONS: ItemStatus[] = ['InStock', 'Administered', 'Wasted', 'Expired', 'Lost', 'Transferred', 'Damaged'];

const statusVariant = (s: ItemStatus) => {
  if (s === 'InStock') return 'ok' as const;
  if (s === 'Expired' || s === 'Lost' || s === 'Damaged') return 'danger' as const;
  if (s === 'Transferred') return 'info' as const;
  return 'neutral' as const;
};

export default function InventoryPage() {
  const navigate = useNavigate();
  const { currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | ''>('');

  const items = useLiveQuery(
    () => db.inventoryItems.where('serviceId').equals(serviceId).filter(i => i.isActive).toArray(),
    [serviceId],
  );

  const catalogs = useLiveQuery(
    () => db.itemCatalogs.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const locations = useLiveQuery(
    () => db.locations.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const lots = useLiveQuery(
    () => db.medicationLots.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const catalogMap = useMemo(() => {
    const m = new Map<number, string>();
    catalogs?.forEach(c => m.set(c.id!, c.name));
    return m;
  }, [catalogs]);

  const locationMap = useMemo(() => {
    const m = new Map<number, string>();
    locations?.forEach(l => m.set(l.id!, l.name));
    return m;
  }, [locations]);

  const lotMap = useMemo(() => {
    const m = new Map<number, string>();
    lots?.forEach(l => m.set(l.id!, l.expirationDate));
    return m;
  }, [lots]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter(item => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (search) {
        const name = catalogMap.get(item.catalogId)?.toLowerCase() ?? '';
        if (!name.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, statusFilter, search, catalogMap]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by item name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ItemStatus | '')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <p className="text-slate-500 text-sm">No inventory items found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const expDate = item.lotId ? lotMap.get(item.lotId) : undefined;
            const expStatus = expDate ? getExpirationStatus(expDate) : undefined;
            return (
              <Card key={item.id} onClick={() => navigate(`/inventory/${item.id}`)} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {catalogMap.get(item.catalogId) ?? `Item #${item.catalogId}`}
                  </p>
                  <p className="text-sm text-slate-500">
                    {locationMap.get(item.locationId) ?? 'Unknown location'} · Qty {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  {expStatus && expStatus !== 'OK' && (
                    <Badge variant={complianceBadgeVariant(expStatus)}>
                      {expStatus === 'Overdue' ? 'Expired' : 'Exp. Soon'}
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
