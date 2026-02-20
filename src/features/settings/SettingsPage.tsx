import { useState, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings, Database, Upload, Download, Trash2, MapPin, Plus, Package, RotateCcw, Building2, Edit2, Check, X as XIcon } from 'lucide-react';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { seedDemoData } from '@/db/seed';
import { exportAllData, importAllData, resetDatabase } from '@/utils/exportImport';
import { useAuth } from '@/auth';
import { Button, Card, Modal, Badge } from '@/components';
import type { Location, ItemCatalog, Service } from '@/db/types';

export default function SettingsPage() {
  const { currentUser, currentService, hasPermission } = useAuth();
  const isAdmin = hasPermission('CompanyAdmin');
  const userId = currentUser?.id ?? 0;

  // Admin service selector
  const [selectedServiceId, setSelectedServiceId] = useState<number>(currentService?.id ?? 0);
  const serviceId = isAdmin ? selectedServiceId : (currentService?.id ?? 0);

  // Load all services for admin selector
  const allServices = useLiveQuery(
    () => isAdmin ? db.services.filter(s => s.isActive).toArray() : Promise.resolve([] as Service[]),
    [isAdmin],
  );

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
  const [locCheckFreq, setLocCheckFreq] = useState<number | ''>(24);

  // Catalog form
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [catCategory, setCatCategory] = useState('');
  const [catIsControlled, setCatIsControlled] = useState(false);
  const [catUnit, setCatUnit] = useState('vial');
  const [catParLevel, setCatParLevel] = useState<number | ''>(4);

  // Editing state
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocType, setEditLocType] = useState('Station');
  const [editLocSealed, setEditLocSealed] = useState(false);
  const [editLocSealId, setEditLocSealId] = useState('');
  const [editLocCheckFreq, setEditLocCheckFreq] = useState<number | ''>(24);

  const [editingCatalogId, setEditingCatalogId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatCategory, setEditCatCategory] = useState('');
  const [editCatIsControlled, setEditCatIsControlled] = useState(false);
  const [editCatUnit, setEditCatUnit] = useState('vial');
  const [editCatParLevel, setEditCatParLevel] = useState<number | ''>(4);

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
      checkFrequencyHours: Number(locCheckFreq) || 24,
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
      defaultParLevel: Number(catParLevel) || 0,
      isActive: true,
    });
    await writeAuditEvent(serviceId, userId, 'ITEM_CREATED', 'ItemCatalog', id, `Created catalog item: ${catName}`);
    setCatName('');
    setCatCategory('');
    setCatIsControlled(false);
    setShowCatalogForm(false);
  };

  const startEditLocation = (loc: Location) => {
    setEditingLocationId(loc.id!);
    setEditLocName(loc.name);
    setEditLocType(loc.type);
    setEditLocSealed(loc.sealed);
    setEditLocSealId(loc.sealId);
    setEditLocCheckFreq(loc.checkFrequencyHours);
  };

  const handleSaveLocation = async () => {
    if (!editingLocationId || !editLocName.trim()) return;
    await db.locations.update(editingLocationId, {
      name: editLocName.trim(),
      type: editLocType,
      sealed: editLocSealed,
      sealId: editLocSealId,
      checkFrequencyHours: Number(editLocCheckFreq) || 24,
    });
    await writeAuditEvent(serviceId, userId, 'LOCATION_UPDATED', 'Location', editingLocationId, `Updated location: ${editLocName}`);
    setEditingLocationId(null);
  };

  const startEditCatalog = (cat: ItemCatalog) => {
    setEditingCatalogId(cat.id!);
    setEditCatName(cat.name);
    setEditCatCategory(cat.category);
    setEditCatIsControlled(cat.isControlled);
    setEditCatUnit(cat.unit);
    setEditCatParLevel(cat.defaultParLevel);
  };

  const handleSaveCatalog = async () => {
    if (!editingCatalogId || !editCatName.trim() || !editCatCategory.trim()) return;
    await db.itemCatalogs.update(editingCatalogId, {
      name: editCatName.trim(),
      category: editCatCategory.trim(),
      isControlled: editCatIsControlled,
      unit: editCatUnit,
      defaultParLevel: Number(editCatParLevel) || 0,
    });
    await writeAuditEvent(serviceId, userId, 'ITEM_UPDATED', 'ItemCatalog', editingCatalogId, `Updated catalog item: ${editCatName}`);
    setEditingCatalogId(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Settings size={24} /> Settings
      </h1>

      {/* Admin Service Selector */}
      {isAdmin && (allServices ?? []).length > 0 && (
        <Card>
          <div className="flex items-center gap-3">
            <Building2 size={20} className="text-blue-400 shrink-0" />
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-1">Manage settings for service</label>
              <select
                value={selectedServiceId}
                onChange={e => setSelectedServiceId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(allServices ?? []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}

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
                  onChange={e => setLocCheckFreq(e.target.value === '' ? '' : Number(e.target.value))}
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
            editingLocationId === loc.id ? (
              <div key={loc.id} className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={editLocName} onChange={e => setEditLocName(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <select value={editLocType} onChange={e => setEditLocType(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['Station', 'Unit', 'Cabinet', 'DrugBox', 'StockRoom', 'Other'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input type="number" min={1} value={editLocCheckFreq}
                    onChange={e => setEditLocCheckFreq(e.target.value === '' ? '' : Number(e.target.value))}
                    className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Check freq (hrs)" />
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={editLocSealed} onChange={e => setEditLocSealed(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-700" />
                    Sealed
                  </label>
                  {editLocSealed && (
                    <input type="text" value={editLocSealId} onChange={e => setEditLocSealId(e.target.value)}
                      placeholder="Seal ID"
                      className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveLocation} className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white" title="Save">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingLocationId(null)} className="p-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white" title="Cancel">
                    <XIcon size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div key={loc.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-700/30 text-sm">
                <div>
                  <span className="font-medium text-white">{loc.name}</span>
                  <span className="text-slate-400 ml-2">({loc.type})</span>
                </div>
                <div className="flex items-center gap-2">
                  {loc.sealed && <Badge variant="warning">Sealed</Badge>}
                  <Badge variant="neutral">{loc.checkFrequencyHours}h</Badge>
                  <button onClick={() => startEditLocation(loc)} className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white" title="Edit">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            )
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
                  onChange={e => setCatParLevel(e.target.value === '' ? '' : Number(e.target.value))}
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
            editingCatalogId === cat.id ? (
              <div key={cat.id} className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={editCatName} onChange={e => setEditCatName(e.target.value)}
                    placeholder="Name"
                    className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="text" value={editCatCategory} onChange={e => setEditCatCategory(e.target.value)}
                    placeholder="Category"
                    className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="text" value={editCatUnit} onChange={e => setEditCatUnit(e.target.value)}
                    placeholder="Unit"
                    className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="number" min={0} value={editCatParLevel}
                    onChange={e => setEditCatParLevel(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Par Level"
                    className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <label className="flex items-center gap-2 text-sm text-slate-300 col-span-2">
                    <input type="checkbox" checked={editCatIsControlled} onChange={e => setEditCatIsControlled(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-700" />
                    Controlled Substance
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveCatalog} className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white" title="Save">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingCatalogId(null)} className="p-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white" title="Cancel">
                    <XIcon size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div key={cat.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-700/30 text-sm">
                <div>
                  <span className="font-medium text-white">{cat.name}</span>
                  <span className="text-slate-400 ml-2">({cat.category})</span>
                </div>
                <div className="flex items-center gap-2">
                  {cat.isControlled && <Badge variant="danger">Controlled</Badge>}
                  <Badge variant="neutral">{cat.unit}</Badge>
                  <Badge variant="info">Par: {cat.defaultParLevel}</Badge>
                  <button onClick={() => startEditCatalog(cat)} className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white" title="Edit">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            )
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
