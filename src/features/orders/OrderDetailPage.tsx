import { useParams, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { formatDateTime } from '@/utils/date';
import { Badge, Card, Button } from '@/components';
import type { OrderStatus } from '@/db/types';

const statusVariant = (s: OrderStatus) => {
  if (s === 'Received') return 'ok' as const;
  if (s === 'Cancelled') return 'danger' as const;
  if (s === 'PartiallyReceived') return 'warning' as const;
  if (s === 'Submitted') return 'info' as const;
  return 'neutral' as const;
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentService } = useAuth();
  const orderId = Number(id);

  const order = useLiveQuery(() => db.orders.get(orderId), [orderId]);

  const vendor = useLiveQuery(
    () => (order?.vendorId ? db.vendors.get(order.vendorId) : undefined),
    [order?.vendorId],
  );

  const lines = useLiveQuery(
    () => db.orderLines.where('orderId').equals(orderId).toArray(),
    [orderId],
  );

  const catalogs = useLiveQuery(
    () => db.itemCatalogs.where('serviceId').equals(currentService?.id ?? 0).toArray(),
    [currentService?.id],
  );

  const createdByUser = useLiveQuery(
    () => (order?.createdBy ? db.users.get(order.createdBy) : undefined),
    [order?.createdBy],
  );

  const auditEvents = useLiveQuery(
    () =>
      db.auditEvents
        .where('entityType')
        .equals('Order')
        .filter(e => e.entityId === orderId)
        .toArray(),
    [orderId],
  );

  const catalogMap = new Map<number, string>();
  catalogs?.forEach(c => catalogMap.set(c.id!, c.name));

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-slate-500">Order not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="secondary" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate('/orders')}>
        Back to Orders
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Order #{order.id}</h1>
        <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Vendor</p>
            <p className="font-medium text-slate-900">{vendor?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Order Date</p>
            <p className="font-medium text-slate-900">{formatDateTime(order.orderDate)}</p>
          </div>
          <div>
            <p className="text-slate-500">Created By</p>
            <p className="font-medium text-slate-900">
              {createdByUser ? `${createdByUser.firstName} ${createdByUser.lastName}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Notes</p>
            <p className="font-medium text-slate-900">{order.notes || '—'}</p>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Order Lines</h2>
        {!lines || lines.length === 0 ? (
          <p className="text-slate-500 text-sm">No order lines.</p>
        ) : (
          <div className="space-y-2">
            {lines.map(line => (
              <Card key={line.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {catalogMap.get(line.catalogId) ?? `Catalog #${line.catalogId}`}
                  </p>
                </div>
                <div className="text-sm text-slate-600 text-right">
                  <p>Ordered: {line.quantityOrdered}</p>
                  <p>Received: {line.quantityReceived}</p>
                  {line.quantityReceived !== line.quantityOrdered && line.quantityReceived > 0 && (
                    <Badge variant="warning">Discrepancy</Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Audit Trail</h2>
        {!auditEvents || auditEvents.length === 0 ? (
          <p className="text-slate-500 text-sm">No audit events.</p>
        ) : (
          <div className="space-y-2">
            {[...auditEvents].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(event => (
              <Card key={event.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <Badge variant="info">{event.eventType}</Badge>
                  <span className="text-slate-500">{formatDateTime(event.timestamp)}</span>
                </div>
                <p className="text-slate-700 mt-1">{event.details}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
