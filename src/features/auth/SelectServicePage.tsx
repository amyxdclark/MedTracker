import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import type { Service } from '@/db';

export default function SelectServicePage() {
  const { memberships, selectService, currentUser, currentService } = useAuth();
  const navigate = useNavigate();

  const serviceIds = memberships.map(m => m.serviceId);
  const services = useLiveQuery(
    () => serviceIds.length > 0
      ? db.services.where('id').anyOf(serviceIds).toArray()
      : Promise.resolve([] as Service[]),
    [serviceIds.join(',')],
  );

  const serviceMap = new Map(services?.map(s => [s.id!, s]) ?? []);

  useEffect(() => {
    if (currentService) {
      navigate('/home', { replace: true });
    }
  }, [currentService, navigate]);

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  const handleSelect = async (serviceId: number) => {
    await selectService(serviceId);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">M+</div>
          <span className="text-2xl font-bold text-white">MedTracker</span>
        </div>
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700 p-6 space-y-4">
          <h1 className="text-lg font-semibold text-white">Select Service</h1>
          <p className="text-sm text-slate-400">Choose which service to work in.</p>
          <div className="space-y-2">
            {memberships.map(m => {
              const svc = serviceMap.get(m.serviceId);
              return (
                <button
                  key={m.serviceId}
                  onClick={() => handleSelect(m.serviceId)}
                  className="w-full text-left px-4 py-3 border border-slate-700 rounded-lg hover:bg-blue-500/20 hover:border-blue-500/30 transition-colors"
                >
                  <p className="text-sm font-medium text-white">{svc?.name ?? `Service #${m.serviceId}`}</p>
                  <p className="text-xs text-slate-400">{m.role}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
