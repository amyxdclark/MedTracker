import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { formatDate } from '@/utils/date';
import { Badge, Card, Button } from '@/components';
import type { OrderStatus } from '@/db/types';

const STATUS_OPTIONS: OrderStatus[] = ['Draft', 'Submitted', 'PartiallyReceived', 'Received', 'Cancelled'];

const statusVariant = (s: OrderStatus) => {
  if (s === 'Received') return 'ok' as const;
  if (s === 'Cancelled') return 'danger' as const;
  if (s === 'PartiallyReceived') return 'warning' as const;
  if (s === 'Submitted') return 'info' as const;
  return 'neutral' as const;
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const { currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');

  const orders = useLiveQuery(
    () => db.orders.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const vendors = useLiveQuery(
    () => db.vendors.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const users = useLiveQuery(() => db.users.toArray(), []);

  const vendorMap = useMemo(() => {
    const m = new Map<number, string>();
    vendors?.forEach(v => m.set(v.id!, v.name));
    return m;
  }, [vendors]);

  const userMap = useMemo(() => {
    const m = new Map<number, string>();
    users?.forEach(u => m.set(u.id!, `${u.firstName} ${u.lastName}`));
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!statusFilter) return sorted;
    return sorted.filter(o => o.status === statusFilter);
  }, [orders, statusFilter]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Orders</h1>
        <Button icon={<Plus size={18} />} onClick={() => navigate('/orders/new')}>
          Create New Order
        </Button>
      </div>

      <div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as OrderStatus | '')}
          className="rounded-lg border bg-slate-700 border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-slate-400 text-sm">No orders found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <Card key={order.id} onClick={() => navigate(`/orders/${order.id}`)} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">
                  {vendorMap.get(order.vendorId) ?? 'Unknown Vendor'}
                </p>
                <p className="text-sm text-slate-400">
                  {formatDate(order.orderDate)} · Created by {userMap.get(order.createdBy) ?? 'Unknown'}
                </p>
              </div>
              <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
