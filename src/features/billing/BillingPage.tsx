import { CreditCard } from 'lucide-react';
import { useAuth } from '@/auth';
import { Card, Badge } from '@/components';

const BILLING_HISTORY = [
  { date: '2025-06-01', description: 'Professional Plan — Monthly', amount: '$149.00', status: 'Paid' },
  { date: '2025-05-01', description: 'Professional Plan — Monthly', amount: '$149.00', status: 'Paid' },
  { date: '2025-04-01', description: 'Professional Plan — Monthly', amount: '$149.00', status: 'Paid' },
  { date: '2025-03-01', description: 'Professional Plan — Monthly', amount: '$149.00', status: 'Paid' },
];

export default function BillingPage() {
  const { hasPermission } = useAuth();

  if (!hasPermission('CompanyAdmin')) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400">You need CompanyAdmin or higher permissions to access Billing.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <CreditCard size={24} /> Subscription Management
      </h1>

      <Card>
        <h2 className="text-lg font-semibold text-white mb-3">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold text-blue-400">Professional Plan</p>
            <p className="text-sm text-slate-400 mt-1">Up to 50 users · Unlimited inventory items · Priority support</p>
          </div>
          <Badge variant="ok">Active</Badge>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-700/30 rounded-lg p-3">
            <p className="text-2xl font-bold text-white">$149</p>
            <p className="text-xs text-slate-400">per month</p>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3">
            <p className="text-2xl font-bold text-white">12</p>
            <p className="text-xs text-slate-400">active users</p>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3">
            <p className="text-2xl font-bold text-white">Jul 1</p>
            <p className="text-xs text-slate-400">next billing</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white mb-3">Billing History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="pb-2 font-medium text-slate-400">Date</th>
                <th className="pb-2 font-medium text-slate-400">Description</th>
                <th className="pb-2 font-medium text-slate-400">Amount</th>
                <th className="pb-2 font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {BILLING_HISTORY.map((row, i) => (
                <tr key={i} className="border-b border-slate-700 last:border-0">
                  <td className="py-2 text-slate-300">{row.date}</td>
                  <td className="py-2 text-slate-300">{row.description}</td>
                  <td className="py-2 font-medium text-white">{row.amount}</td>
                  <td className="py-2"><Badge variant="ok">{row.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
