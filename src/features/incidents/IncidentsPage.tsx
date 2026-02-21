import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { formatDateTime } from '@/utils/date';
import { Badge, Card, Button } from '@/components';
import type { IncidentStatus } from '@/db/types';

const statusVariant = (s: IncidentStatus) => {
  if (s === 'Open') return 'warning' as const;
  return 'ok' as const;
};

export default function IncidentsPage() {
  const navigate = useNavigate();
  const { currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;

  const incidents = useLiveQuery(
    () =>
      db.incidents
        .where('serviceId')
        .equals(serviceId)
        .toArray()
        .then(arr => arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    [serviceId],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Incidents</h1>
        <Button icon={<Plus size={16} />} onClick={() => navigate('/incidents/new')}>
          New Incident
        </Button>
      </div>

      {!incidents || incidents.length === 0 ? (
        <p className="text-slate-400 text-sm">No incidents recorded.</p>
      ) : (
        <div className="space-y-3">
          {incidents.map(incident => (
            <Card
              key={incident.id}
              className="flex items-center justify-between gap-4"
              onClick={() => navigate(`/incidents/${incident.id}`)}
            >
              <div className="flex items-start gap-3 min-w-0">
                {incident.status === 'Open' ? (
                  <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{incident.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(incident.incidentDate)}</p>
                  {incident.description && (
                    <p className="text-sm text-slate-400 truncate mt-0.5">{incident.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={statusVariant(incident.status)}>{incident.status}</Badge>
                <ChevronRight size={16} className="text-slate-500" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
