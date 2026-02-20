import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Download, Filter, Calendar } from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { formatDateTime } from '@/utils/date';
import { Button, Card, Badge } from '@/components';
import type { AuditEventType } from '@/db/types';

const EVENT_TYPE_OPTIONS: AuditEventType[] = [
  'USER_LOGIN', 'USER_LOGOUT', 'SERVICE_SWITCH',
  'ORDER_CREATED', 'ORDER_SUBMITTED', 'ORDER_RECEIVED', 'ORDER_LINE_RECEIVED',
  'ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DEACTIVATED',
  'ITEM_TRANSFERRED', 'ITEM_ADMINISTERED', 'ITEM_WASTED', 'ITEM_EXPIRED_EXCHANGE',
  'LOCATION_CREATED', 'LOCATION_UPDATED',
  'CHECK_SESSION_STARTED', 'CHECK_SEAL_VERIFIED', 'CHECK_ITEM_VERIFIED', 'CHECK_SESSION_COMPLETED',
  'WASTE_WITNESSED', 'CORRECTION_MADE',
  'DISCREPANCY_OPENED', 'DISCREPANCY_RESOLVED',
  'DATA_EXPORTED', 'DATA_IMPORTED', 'DATA_RESET', 'DATA_SEEDED',
];

const ENTITY_TYPES = [
  'User', 'InventoryItem', 'WasteRecord', 'WitnessSignature', 'Order',
  'OrderLine', 'Location', 'CheckSession', 'Transfer', 'DiscrepancyCase', 'System',
];

function eventBadgeVariant(type: AuditEventType): 'ok' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (type.startsWith('ITEM_WASTED') || type.startsWith('DISCREPANCY') || type === 'CORRECTION_MADE' || type === 'DATA_RESET') return 'danger';
  if (type.startsWith('CHECK_') || type.startsWith('WASTE_WITNESSED')) return 'warning';
  if (type.startsWith('ORDER_') || type.startsWith('ITEM_CREATED') || type === 'DATA_SEEDED') return 'ok';
  if (type.startsWith('USER_')) return 'info';
  return 'neutral';
}

export default function ReportsPage() {
  const { currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;

  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const allEvents = useLiveQuery(
    () => db.auditEvents.where('serviceId').equals(serviceId).reverse().sortBy('timestamp'),
    [serviceId],
  );

  const filteredEvents = useMemo(() => {
    if (!allEvents) return [];
    return allEvents.filter(e => {
      if (eventTypeFilter && e.eventType !== eventTypeFilter) return false;
      if (entityTypeFilter && e.entityType !== entityTypeFilter) return false;
      if (dateFrom && e.timestamp < new Date(dateFrom).toISOString()) return false;
      if (dateTo) {
        const toEnd = new Date(dateTo);
        toEnd.setDate(toEnd.getDate() + 1);
        if (e.timestamp >= toEnd.toISOString()) return false;
      }
      return true;
    });
  }, [allEvents, eventTypeFilter, entityTypeFilter, dateFrom, dateTo]);

  // Compliance summary
  const summary = useMemo(() => {
    if (!allEvents) return { total: 0, byType: {} as Record<string, number> };
    const byType: Record<string, number> = {};
    for (const e of allEvents) {
      byType[e.eventType] = (byType[e.eventType] || 0) + 1;
    }
    return { total: allEvents.length, byType };
  }, [allEvents]);

  const downloadFile = useCallback((content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportCSV = useCallback(() => {
    const header = 'ID,Timestamp,Event Type,Entity Type,Entity ID,User ID,Details';
    const rows = filteredEvents.map(e =>
      `${e.id},"${e.timestamp}","${e.eventType}","${e.entityType}",${e.entityId},${e.userId},"${e.details.replace(/"/g, '""')}"`
    );
    downloadFile([header, ...rows].join('\n'), 'audit-log.csv', 'text/csv');
  }, [filteredEvents, downloadFile]);

  const handleExportJSON = useCallback(() => {
    downloadFile(JSON.stringify(filteredEvents, null, 2), 'audit-log.json', 'application/json');
  }, [filteredEvents, downloadFile]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Reports</h1>

      {/* Compliance Summary */}
      <Card>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <FileText size={20} /> Compliance Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="bg-blue-500/20 rounded-lg p-3">
            <p className="text-slate-400">Total Events</p>
            <p className="text-2xl font-bold text-blue-400">{summary.total}</p>
          </div>
          <div className="bg-emerald-500/20 rounded-lg p-3">
            <p className="text-slate-400">Checks</p>
            <p className="text-2xl font-bold text-emerald-400">
              {(summary.byType['CHECK_SESSION_COMPLETED'] ?? 0)}
            </p>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-3">
            <p className="text-slate-400">Witnessed Waste</p>
            <p className="text-2xl font-bold text-amber-400">
              {(summary.byType['WASTE_WITNESSED'] ?? 0)}
            </p>
          </div>
          <div className="bg-red-500/20 rounded-lg p-3">
            <p className="text-slate-400">Corrections</p>
            <p className="text-2xl font-bold text-red-400">
              {(summary.byType['CORRECTION_MADE'] ?? 0)}
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Filter size={20} /> Audit Event Filters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Event Type</label>
            <select
              value={eventTypeFilter}
              onChange={e => setEventTypeFilter(e.target.value)}
              className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Events</option>
              {EVENT_TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Entity Type</label>
            <select
              value={entityTypeFilter}
              onChange={e => setEntityTypeFilter(e.target.value)}
              className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Entities</option>
              {ENTITY_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-1">
              <Calendar size={14} /> From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-1">
              <Calendar size={14} /> To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Card>

      {/* Export */}
      <div className="flex gap-3">
        <Button size="sm" icon={<Download size={16} />} onClick={handleExportCSV}>
          Export CSV
        </Button>
        <Button size="sm" variant="secondary" icon={<Download size={16} />} onClick={handleExportJSON}>
          Export JSON
        </Button>
        <span className="text-sm text-slate-400 self-center">{filteredEvents.length} events</span>
      </div>

      {/* Event List */}
      <div className="space-y-2">
        {filteredEvents.length === 0 && (
          <Card>
            <p className="text-slate-400 text-center py-4">No audit events match the current filters.</p>
          </Card>
        )}
        {filteredEvents.slice(0, 100).map(event => (
          <Card key={event.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={eventBadgeVariant(event.eventType)}>{event.eventType}</Badge>
                  <Badge variant="neutral">{event.entityType} #{event.entityId}</Badge>
                </div>
                <p className="text-sm text-slate-300 mt-1 truncate">{event.details}</p>
              </div>
              <div className="text-right text-xs text-slate-400 whitespace-nowrap shrink-0">
                <p>{formatDateTime(event.timestamp)}</p>
                <p>User #{event.userId}</p>
              </div>
            </div>
          </Card>
        ))}
        {filteredEvents.length > 100 && (
          <p className="text-sm text-slate-400 text-center">
            Showing first 100 of {filteredEvents.length} events. Use filters or export to see all.
          </p>
        )}
      </div>
    </div>
  );
}
