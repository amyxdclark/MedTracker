import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ShoppingCart, ClipboardCheck, Syringe, ArrowRightLeft,
  Trash2, RefreshCw, Package, QrCode, AlertTriangle, Clock, Archive,
} from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { getComplianceStatus, getExpirationStatus } from '@/utils/compliance';
import { Card } from '@/components';

const actions = [
  { label: 'Receive an Order', desc: 'Log incoming supplies from a vendor', icon: ShoppingCart, to: '/orders/new', color: 'bg-blue-500/20 text-blue-400' },
  { label: 'Do a Daily Check', desc: 'Verify items at a location', icon: ClipboardCheck, to: '/checks', color: 'bg-emerald-500/20 text-emerald-400' },
  { label: 'Administer Medication', desc: 'Record a dose given to a patient', icon: Syringe, to: '/administer/new', color: 'bg-purple-500/20 text-purple-400' },
  { label: 'Transfer Items', desc: 'Move items between locations', icon: ArrowRightLeft, to: '/transfers/new', color: 'bg-amber-500/20 text-amber-400' },
  { label: 'Log Waste', desc: 'Document wasted medication', icon: Trash2, to: '/waste/new', color: 'bg-red-500/20 text-red-400' },
  { label: 'Exchange Expired Items', desc: 'Swap out expired stock', icon: RefreshCw, to: '/expired-exchange/new', color: 'bg-orange-500/20 text-orange-400' },
  { label: 'View Inventory', desc: 'Browse all items in stock', icon: Package, to: '/inventory', color: 'bg-teal-500/20 text-teal-400' },
  { label: 'Scan a Code', desc: 'Look up an item by QR code', icon: QrCode, to: '/scan', color: 'bg-indigo-500/20 text-indigo-400' },
] as const;

export default function HomePage() {
  const navigate = useNavigate();
  const { currentUser, currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;

  const stats = useLiveQuery(async () => {
    const items = await db.inventoryItems
      .where('serviceId').equals(serviceId)
      .filter(i => i.isActive && i.status === 'InStock')
      .toArray();

    const locations = await db.locations
      .where('serviceId').equals(serviceId)
      .filter(l => l.isActive)
      .toArray();

    const lots = await db.medicationLots
      .where('serviceId').equals(serviceId)
      .toArray();

    let overdueChecks = 0;
    for (const loc of locations) {
      if (loc.checkFrequencyHours > 0) {
        const itemsAtLoc = items.filter(i => i.locationId === loc.id);
        const isOverdue = itemsAtLoc.some(
          i => getComplianceStatus(i.lastCheckedAt, loc.checkFrequencyHours) === 'Overdue'
        );
        if (isOverdue) overdueChecks++;
      }
    }

    const inStockLotIds = new Set(items.map(i => i.lotId).filter((id): id is number => id != null));
    let expiringSoon = 0;
    for (const lot of lots) {
      if (inStockLotIds.has(lot.id!) && getExpirationStatus(lot.expirationDate) !== 'OK') {
        expiringSoon++;
      }
    }

    return { totalInStock: items.length, overdueChecks, expiringSoon };
  }, [serviceId]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Hello, {currentUser?.firstName ?? 'User'}
        </h1>
        {currentService && (
          <p className="text-slate-400 mt-1">{currentService.name}</p>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <Archive className="mx-auto h-6 w-6 text-blue-400 mb-1" />
          <p className="text-2xl font-bold text-white">{stats?.totalInStock ?? '–'}</p>
          <p className="text-xs text-slate-400">Items in Stock</p>
        </Card>
        <Card className="text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-red-400 mb-1" />
          <p className="text-2xl font-bold text-white">{stats?.overdueChecks ?? '–'}</p>
          <p className="text-xs text-slate-400">Overdue Checks</p>
        </Card>
        <Card className="text-center">
          <Clock className="mx-auto h-6 w-6 text-amber-400 mb-1" />
          <p className="text-2xl font-bold text-white">{stats?.expiringSoon ?? '–'}</p>
          <p className="text-xs text-slate-400">Expiring Soon</p>
        </Card>
      </div>

      {/* Action buttons */}
      <div>
        <h2 className="text-lg font-semibold text-slate-300 mb-3">I want to…</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {actions.map(({ label, desc, icon: Icon, to, color }) => (
            <Card key={to} onClick={() => navigate(to)} className="flex items-start gap-4">
              <div className={`shrink-0 rounded-lg p-3 ${color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white">{label}</p>
                <p className="text-sm text-slate-400">{desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
