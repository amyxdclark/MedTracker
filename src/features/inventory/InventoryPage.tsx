import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ChevronRight, ChevronDown, MapPin, List, Layers } from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { getExpirationStatus, complianceBadgeVariant } from '@/utils/compliance';
import { Badge, Card } from '@/components';
import type { InventoryItem, ItemStatus, Location } from '@/db/types';

const STATUS_OPTIONS: ItemStatus[] = ['InStock', 'Administered', 'Wasted', 'Expired', 'Lost', 'Transferred', 'Damaged'];

const statusVariant = (s: ItemStatus) => {
  if (s === 'InStock') return 'ok' as const;
  if (s === 'Expired' || s === 'Lost' || s === 'Damaged') return 'danger' as const;
  if (s === 'Transferred') return 'info' as const;
  return 'neutral' as const;
};

interface LocationTreeNode {
  location: Location;
  children: LocationTreeNode[];
}

function buildLocationTree(locations: Location[]): LocationTreeNode[] {
  const map = new Map<number, LocationTreeNode>();
  const roots: LocationTreeNode[] = [];
  for (const loc of locations) {
    map.set(loc.id!, { location: loc, children: [] });
  }
  for (const loc of locations) {
    const node = map.get(loc.id!)!;
    if (loc.parentId && map.has(loc.parentId)) {
      map.get(loc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

interface ItemCardProps {
  item: InventoryItem;
  catalogName: string;
  locationName: string;
  expDate?: string;
  onClick: () => void;
}

function ItemCard({ item, catalogName, locationName, expDate, onClick }: ItemCardProps) {
  const expStatus = expDate ? getExpirationStatus(expDate) : undefined;
  return (
    <Card onClick={onClick} className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-white truncate">{catalogName}</p>
        <p className="text-sm text-slate-400">{locationName} · Qty {item.quantity}</p>
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
}

interface LocationGroupProps {
  node: LocationTreeNode;
  items: InventoryItem[];
  catalogMap: Map<number, string>;
  locationMap: Map<number, string>;
  lotMap: Map<number, string>;
  depth: number;
  onItemClick: (id: number) => void;
}

function LocationGroup({ node, items, catalogMap, locationMap, lotMap, depth, onItemClick }: LocationGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const loc = node.location;
  const locItems = items.filter(i => i.locationId === loc.id);
  const hasContent = locItems.length > 0 || node.children.length > 0;

  if (!hasContent) return null;

  return (
    <div style={{ marginLeft: depth > 0 ? '1.25rem' : 0 }}>
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-700/50 mb-1"
      >
        {expanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
        <MapPin size={14} className="text-slate-400 shrink-0" />
        <span className="font-medium text-slate-200 text-sm">{loc.name}</span>
        <Badge variant="neutral">{loc.type}</Badge>
        <span className="ml-auto text-xs text-slate-500">{locItems.length} item{locItems.length !== 1 ? 's' : ''}</span>
      </button>

      {expanded && (
        <div className="space-y-2 mb-2">
          {locItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              catalogName={catalogMap.get(item.catalogId) ?? `Item #${item.catalogId}`}
              locationName={locationMap.get(item.locationId) ?? 'Unknown location'}
              expDate={item.lotId ? lotMap.get(item.lotId) : undefined}
              onClick={() => onItemClick(item.id!)}
            />
          ))}
          {node.children.map(child => (
            <LocationGroup
              key={child.location.id}
              node={child}
              items={items}
              catalogMap={catalogMap}
              locationMap={locationMap}
              lotMap={lotMap}
              depth={depth + 1}
              onItemClick={onItemClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const { currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | ''>('');
  const [groupByLocation, setGroupByLocation] = useState(false);

  const items = useLiveQuery(
    () => db.inventoryItems.where('serviceId').equals(serviceId).filter(i => i.isActive).toArray(),
    [serviceId],
  );

  const catalogs = useLiveQuery(
    () => db.itemCatalogs.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const locations = useLiveQuery(
    () => db.locations.where('serviceId').equals(serviceId).filter(l => l.isActive).toArray(),
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

  const locationTree = useMemo(() => buildLocationTree(locations ?? []), [locations]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Inventory</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by item name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ItemStatus | '')}
          className="rounded-lg border bg-slate-700 border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setGroupByLocation(prev => !prev)}
          title={groupByLocation ? 'Switch to flat list' : 'Group by location'}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            groupByLocation
              ? 'bg-blue-600/20 border-blue-600/40 text-blue-400'
              : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {groupByLocation ? <Layers size={16} /> : <List size={16} />}
          {groupByLocation ? 'Grouped' : 'Flat list'}
        </button>
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <p className="text-slate-400 text-sm">No inventory items found.</p>
      ) : groupByLocation ? (
        <div className="space-y-1">
          {locationTree.map(node => (
            <LocationGroup
              key={node.location.id}
              node={node}
              items={filtered}
              catalogMap={catalogMap}
              locationMap={locationMap}
              lotMap={lotMap}
              depth={0}
              onItemClick={id => navigate(`/inventory/${id}`)}
            />
          ))}
          {/* Items with no matching location in tree */}
          {filtered.filter(item => !locations?.find(l => l.id === item.locationId)).map(item => {
            const expDate = item.lotId ? lotMap.get(item.lotId) : undefined;
            return (
              <ItemCard
                key={item.id}
                item={item}
                catalogName={catalogMap.get(item.catalogId) ?? `Item #${item.catalogId}`}
                locationName={locationMap.get(item.locationId) ?? 'Unknown location'}
                expDate={expDate}
                onClick={() => navigate(`/inventory/${item.id}`)}
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const expDate = item.lotId ? lotMap.get(item.lotId) : undefined;
            return (
              <ItemCard
                key={item.id}
                item={item}
                catalogName={catalogMap.get(item.catalogId) ?? `Item #${item.catalogId}`}
                locationName={locationMap.get(item.locationId) ?? 'Unknown location'}
                expDate={expDate}
                onClick={() => navigate(`/inventory/${item.id}`)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
