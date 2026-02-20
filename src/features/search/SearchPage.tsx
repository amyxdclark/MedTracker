import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search as SearchIcon, Package, MapPin, ShoppingCart } from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { Card } from '@/components';

export default function SearchPage() {
  const navigate = useNavigate();
  const { currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const [query, setQuery] = useState('');

  const catalogs = useLiveQuery(
    () => db.itemCatalogs.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );
  const locations = useLiveQuery(
    () => db.locations.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );
  const orders = useLiveQuery(
    () => db.orders.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );
  const items = useLiveQuery(
    () => db.inventoryItems.where('serviceId').equals(serviceId).filter(i => i.isActive).toArray(),
    [serviceId],
  );
  const vendors = useLiveQuery(
    () => db.vendors.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const catalogMap = useMemo(() => {
    const m = new Map<number, string>();
    catalogs?.forEach(c => m.set(c.id!, c.name));
    return m;
  }, [catalogs]);

  const vendorMap = useMemo(() => {
    const m = new Map<number, string>();
    vendors?.forEach(v => m.set(v.id!, v.name));
    return m;
  }, [vendors]);

  const q = query.trim().toLowerCase();

  const matchedItems = useMemo(() => {
    if (!q || !items) return [];
    return items.filter(item => {
      const name = catalogMap.get(item.catalogId)?.toLowerCase() ?? '';
      return name.includes(q) || item.qrCode6.toLowerCase().includes(q);
    }).slice(0, 20);
  }, [q, items, catalogMap]);

  const matchedLocations = useMemo(() => {
    if (!q || !locations) return [];
    return locations.filter(l => l.isActive && l.name.toLowerCase().includes(q)).slice(0, 10);
  }, [q, locations]);

  const matchedOrders = useMemo(() => {
    if (!q || !orders) return [];
    return orders.filter(o => {
      const vName = vendorMap.get(o.vendorId)?.toLowerCase() ?? '';
      return vName.includes(q) || o.status.toLowerCase().includes(q) || String(o.id).includes(q);
    }).slice(0, 10);
  }, [q, orders, vendorMap]);

  const hasResults = matchedItems.length > 0 || matchedLocations.length > 0 || matchedOrders.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Search</h1>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search items, locations, orders…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-3 py-2 rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {q && !hasResults && (
        <p className="text-slate-400 text-sm">No results found for &ldquo;{query}&rdquo;.</p>
      )}

      {matchedItems.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Package className="h-4 w-4" /> Inventory Items
          </h2>
          <div className="space-y-2">
            {matchedItems.map(item => (
              <Card key={item.id} onClick={() => navigate(`/inventory/${item.id}`)} className="flex items-center justify-between">
                <span className="font-medium text-white">{catalogMap.get(item.catalogId) ?? `#${item.catalogId}`}</span>
                <span className="text-xs text-slate-400">Qty {item.quantity} · {item.status}</span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {matchedLocations.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <MapPin className="h-4 w-4" /> Locations
          </h2>
          <div className="space-y-2">
            {matchedLocations.map(loc => (
              <Card key={loc.id} onClick={() => navigate(`/locations/${loc.id}`)} className="flex items-center justify-between">
                <span className="font-medium text-white">{loc.name}</span>
                <span className="text-xs text-slate-400">{loc.type}</span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {matchedOrders.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <ShoppingCart className="h-4 w-4" /> Orders
          </h2>
          <div className="space-y-2">
            {matchedOrders.map(order => (
              <Card key={order.id} onClick={() => navigate(`/orders/${order.id}`)} className="flex items-center justify-between">
                <span className="font-medium text-white">Order #{order.id} — {vendorMap.get(order.vendorId) ?? 'Unknown'}</span>
                <span className="text-xs text-slate-400">{order.status}</span>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
