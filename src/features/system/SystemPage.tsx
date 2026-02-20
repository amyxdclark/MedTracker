import { useState } from 'react';
import { Shield, Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { nowISO } from '@/utils/date';
import { Button, Card, Badge } from '@/components';

export default function SystemPage() {
  const { hasPermission } = useAuth();

  const [showAddForm, setShowAddForm] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [processing, setProcessing] = useState(false);

  const companies = useLiveQuery(() => db.companies.toArray());

  if (!hasPermission('SystemAdmin')) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500">You need SystemAdmin permissions to access this page.</p>
      </div>
    );
  }

  const handleAddCompany = async () => {
    if (!companyName.trim()) return;
    setProcessing(true);
    try {
      await db.companies.add({
        name: companyName.trim(),
        isActive: true,
        createdAt: nowISO(),
      });
      setCompanyName('');
      setShowAddForm(false);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <Shield size={24} /> System Administration
      </h1>

      {/* Companies */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Companies</h2>
          <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowAddForm(!showAddForm)}>Add</Button>
        </div>

        {showAddForm && (
          <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button size="sm" onClick={handleAddCompany} disabled={processing || !companyName.trim()}>
              {processing ? 'Saving…' : 'Save Company'}
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {(companies ?? []).length === 0 && <p className="text-slate-500 text-sm text-center py-2">No companies found.</p>}
          {(companies ?? []).map(c => (
            <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 text-sm">
              <span className="font-medium text-slate-900">{c.name}</span>
              <Badge variant={c.isActive ? 'ok' : 'neutral'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Impersonation */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">User Impersonation</h2>
        <p className="text-sm text-slate-500 mb-3">
          Impersonate a user to troubleshoot issues. All actions will be logged under your account.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Impersonation is a concept feature and is not yet functional.
        </div>
      </Card>
    </div>
  );
}
