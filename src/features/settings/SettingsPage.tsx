import { useState, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings, Database, Upload, Download, Trash2, MapPin, Plus, Package, RotateCcw } from 'lucide-react';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { seedDemoData } from '@/db/seed';
import { exportAllData, importAllData, resetDatabase } from '@/utils/exportImport';
import { useAuth } from '@/auth';
import { Button, Card, Modal, Badge } from '@/components';
import type { Location, ItemCatalog } from '@/db/types';

export default function SettingsPage() {
  const { currentUser, currentService, hasPermission } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const userId = currentUser?.id ?? 0;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  // Location form
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState('Station');
  const [locParentId, setLocParentId] = useState<string>('');
  const [locSealed, setLocSealed] = useState(false);
  const [locSealId, setLocSealId] = useState('');
  const [locCheckFreq, setLocCheckFreq] = useState(24);

  // Catalog form
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [catCategory, setCatCategory] = useState('');
  const [catIsControlled, setCatIsControlled] = useState(false);
  const [catUnit, setCatUnit] = useState('vial');
  const [catParLevel, setCatParLevel] = useState(4);

  const locations = useLiveQuery(
    () => db.locations.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const catalogs = useLiveQuery(
    () => db.itemCatalogs.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  if (!hasPermission('Supervisor')) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400">You need Supervisor or higher permissions to access Settings.</p>
      </div>
    );
  }

  const flash = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 4000);
  };

  const handleExport = async () => {
    setProcessing(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medtracker-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await writeAuditEvent(serviceId, userId, 'DATA_EXPORTED', 'System', 0, 'Full data export');
      flash('Data exported successfully.');
    } finally {
      setProcessing(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const text = await file.text();
      await importAllData(text, userId, serviceId);
      await writeAuditEvent(serviceId, userId, 'DATA_IMPORTED', 'System', 0, `Imported from ${file.name}`);
      flash('Data imported successfully. Refresh the page to see changes.');
    } catch {
      flash('Import failed. Please check the file format.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    setProcessing(true);
    try {
      await resetDatabase();
      setResetConfirmOpen(false);
      flash('Database reset. All data has been cleared.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSeed = async () => {
    setProcessing(true);
    try {
      await seedDemoData();
      flash('Demo data seeded successfully. Refresh the page to see changes.');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddLocation = async () => {
    if (!locName.trim()) return;
    const id = await db.locations.add({
      serviceId,
      parentId: locParentId ? Number(locParentId) : null,
      name: locName.trim(),
      type: locType,
      sealed: locSealed,
      sealId: locSealId,
      checkFrequencyHours: locCheckFreq,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    await writeAuditEvent(serviceId, userId, 'LOCATION_CREATED', 'Location', id, `Created location: ${locName}`);
    setLocName('');
    setLocParentId('');
    setLocSealed(false);
    setLocSealId('');
    setShowLocationForm(false);
  };

  const handleAddCatalog = async () => {
    if (!catName.trim() || !catCategory.trim()) return;
    const id = await db.itemCatalogs.add({
      serviceId,
      name: catName.trim(),
      category: catCategory.trim(),
      isControlled: catIsControlled,
      unit: catUnit,
      defaultParLevel: catParLevel,
      isActive: true,
    });
    await writeAuditEvent(serviceId, userId, 'ITEM_CREATED', 'ItemCatalog', id, `Created catalog item: ${catName}`);
    setCatName('');
    setCatCategory('');
    setCatIsControlled(false);
    setShowCatalogForm(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Settings size={24} /> Settings
      </h1>

      {statusMessage && (
        <div className="bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-lg px-4 py-3 text-sm">
          {statusMessage}
        </div>
      )}

      {/* Data Tools */}
      <Card>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Database size={20} /> Data Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button icon={<Download size={16} />} onClick={handleExport} disabled={processing}>
            Export All Data
          </Button>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <Button
              variant="secondary"
              icon={<Upload size={16} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="w-full"
            >
              Import Data
            </Button>
          </div>
          <Button
            variant="danger"
            icon={<Trash2 size={16} />}
            onClick={() => setResetConfirmOpen(true)}
            disabled={processing}
          >
            Reset Database
          </Button>
          <Button
            variant="success"
            icon={<RotateCcw size={16} />}
            onClick={handleSeed}
            disabled={processing}
          >
            Seed Demo Data
          </Button>
        </div>
      </Card>

      {/* Location Management */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <MapPin size={20} /> Locations
          </h2>
          <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowLocationForm(!showLocationForm)}>
            Add
          </Button>
        </div>

        {showLocationForm && (
          <div className="bg-slate-700/50 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={locName}
                  onChange={e => setLocName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
                <select
                  value={locType}
                  onChange={e => setLocType(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {['Station', 'Unit', 'Cabinet', 'DrugBox', 'StockRoom', 'Other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Parent Location</label>
                <select
                  value={locParentId}
                  onChange={e => setLocParentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None (top-level)</option>
                  {(locations ?? []).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Check Frequency (hrs)</label>
                <input
                  type="number"
                  min={1}
                  value={locCheckFreq}
                  onChange={e => setLocCheckFreq(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={locSealed}
                    onChange={e => setLocSealed(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-700"
                  />
                  Sealed
                </label>
              </div>
              {locSealed && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Seal ID</label>
                  <input
                    type="text"
                    value={locSealId}
                    onChange={e => setLocSealId(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            <Button size="sm" onClick={handleAddLocation} disabled={!locName.trim()}>Save Location</Button>
          </div>
        )}

        <div className="space-y-2">
          {(locations ?? []).length === 0 && (
            <p className="text-slate-400 text-sm text-center py-2">No locations configured.</p>
          )}
          {(locations ?? []).map(loc => (
            <div key={loc.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-700/30 text-sm">
              <div>
                <span className="font-medium text-white">{loc.name}</span>
                <span className="text-slate-400 ml-2">({loc.type})</span>
              </div>
              <div className="flex items-center gap-2">
                {loc.sealed && <Badge variant="warning">Sealed</Badge>}
                <Badge variant="neutral">{loc.checkFrequencyHours}h</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Item Catalog Management */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package size={20} /> Item Catalogs
          </h2>
          <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowCatalogForm(!showCatalogForm)}>
            Add
          </Button>
        </div>

        {showCatalogForm && (
          <div className="bg-slate-700/50 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                <input
                  type="text"
                  value={catCategory}
                  onChange={e => setCatCategory(e.target.value)}
                  placeholder="e.g. Controlled, Emergency"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Unit</label>
                <input
                  type="text"
                  value={catUnit}
                  onChange={e => setCatUnit(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Default Par Level</label>
                <input
                  type="number"
                  min={0}
                  value={catParLevel}
                  onChange={e => setCatParLevel(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3 col-span-2">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={catIsControlled}
                    onChange={e => setCatIsControlled(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-700"
                  />
                  Controlled Substance
                </label>
              </div>
            </div>
            <Button size="sm" onClick={handleAddCatalog} disabled={!catName.trim() || !catCategory.trim()}>
              Save Catalog Item
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {(catalogs ?? []).length === 0 && (
            <p className="text-slate-400 text-sm text-center py-2">No catalog items configured.</p>
          )}
          {(catalogs ?? []).map(cat => (
            <div key={cat.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-700/30 text-sm">
              <div>
                <span className="font-medium text-white">{cat.name}</span>
                <span className="text-slate-400 ml-2">({cat.category})</span>
              </div>
              <div className="flex items-center gap-2">
                {cat.isControlled && <Badge variant="danger">Controlled</Badge>}
                <Badge variant="neutral">{cat.unit}</Badge>
                <Badge variant="info">Par: {cat.defaultParLevel}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Reset Confirmation Modal */}
      <Modal open={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)} title="Reset Database">
        <p className="text-slate-300 mb-4">
          This will permanently delete <strong>all data</strong> in the database. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="danger" onClick={handleReset} disabled={processing}>
            {processing ? 'Resetting…' : 'Confirm Reset'}
          </Button>
          <Button variant="secondary" onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
