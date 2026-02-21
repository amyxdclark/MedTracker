import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle, Plus, Trash2, Search } from 'lucide-react';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { useAuth } from '@/auth';
import { nowISO } from '@/utils/date';
import { Stepper, Button, Card, Badge } from '@/components';
import type { InventoryItem, ItemCatalog } from '@/db/types';

const STEPS = ['Incident Details', 'Add Items Used', 'Review', 'Complete'];

interface SelectedItem {
  item: InventoryItem;
  catalog: ItemCatalog;
  quantityUsed: number;
  notes: string;
}

export default function NewIncidentPage() {
  const navigate = useNavigate();
  const { currentUser, currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const userId = currentUser?.id ?? 0;

  const [step, setStep] = useState(0);

  // Step 0 – Incident details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 16));

  // Step 1 – Items used
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupError, setLookupError] = useState('');

  const [processing, setProcessing] = useState(false);
  const [incidentId, setIncidentId] = useState<number | null>(null);

  const inventoryItems = useLiveQuery(
    () =>
      db.inventoryItems
        .where('serviceId')
        .equals(serviceId)
        .filter(i => i.isActive && i.status === 'InStock')
        .toArray(),
    [serviceId],
  );

  const catalogs = useLiveQuery(
    () => db.itemCatalogs.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );

  const catalogMap = useMemo(() => {
    const m = new Map<number, ItemCatalog>();
    (catalogs ?? []).forEach(c => m.set(c.id!, c));
    return m;
  }, [catalogs]);

  const filteredItems = useMemo(() => {
    if (!inventoryItems) return [];
    const q = searchQuery.toLowerCase();
    return inventoryItems.filter(item => {
      const cat = catalogMap.get(item.catalogId);
      if (!cat) return false;
      if (q && !cat.name.toLowerCase().includes(q)) return false;
      // Exclude already-selected items
      if (selectedItems.some(si => si.item.id === item.id)) return false;
      return true;
    });
  }, [inventoryItems, catalogMap, searchQuery, selectedItems]);

  const handleAddItem = useCallback(
    (item: InventoryItem) => {
      const catalog = catalogMap.get(item.catalogId);
      if (!catalog) {
        setLookupError('Catalog entry not found for this item.');
        return;
      }
      setLookupError('');
      setSelectedItems(prev => [
        ...prev,
        { item, catalog, quantityUsed: 1, notes: '' },
      ]);
    },
    [catalogMap],
  );

  const handleRemoveItem = (itemId: number) => {
    setSelectedItems(prev => prev.filter(si => si.item.id !== itemId));
  };

  const handleUpdateQty = (itemId: number, qty: number) => {
    setSelectedItems(prev =>
      prev.map(si =>
        si.item.id === itemId ? { ...si, quantityUsed: Math.max(0, qty) } : si,
      ),
    );
  };

  const handleUpdateNotes = (itemId: number, notes: string) => {
    setSelectedItems(prev =>
      prev.map(si => (si.item.id === itemId ? { ...si, notes } : si)),
    );
  };

  const handleComplete = useCallback(async () => {
    setProcessing(true);
    try {
      const now = nowISO();

      const id = await db.incidents.add({
        serviceId,
        title: title.trim(),
        description: description.trim(),
        incidentDate: new Date(incidentDate).toISOString(),
        status: 'Open',
        createdBy: userId,
        createdAt: now,
      });

      await writeAuditEvent(
        serviceId,
        userId,
        'INCIDENT_CREATED',
        'Incident',
        id as number,
        `Incident created: ${title}`,
      );

      for (const si of selectedItems) {
        const incItemId = await db.incidentItems.add({
          incidentId: id as number,
          itemId: si.item.id!,
          quantityUsed: si.quantityUsed,
          notes: si.notes,
          addedBy: userId,
          addedAt: now,
        });

        await writeAuditEvent(
          serviceId,
          userId,
          'INCIDENT_ITEM_ADDED',
          'IncidentItem',
          incItemId as number,
          `Added ${si.catalog.name} (qty ${si.quantityUsed}) to incident ${title}`,
        );
      }

      setIncidentId(id as number);
      setStep(3);
    } finally {
      setProcessing(false);
    }
  }, [serviceId, userId, title, description, incidentDate, selectedItems]);

  // Step 0: Incident Details
  const renderDetails = () => (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Incident Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. MVA on Highway 12"
              className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date &amp; Time *</label>
            <input
              type="datetime-local"
              value={incidentDate}
              onChange={e => setIncidentDate(e.target.value)}
              className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the incident..."
              className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Card>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={() => setStep(1)} disabled={!title.trim() || !incidentDate}>
          Continue
        </Button>
      </div>
    </div>
  );

  // Step 1: Add Items Used
  const renderAddItems = () => (
    <div className="space-y-4">
      {selectedItems.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">Selected items ({selectedItems.length})</h3>
          <div className="space-y-2">
            {selectedItems.map(si => (
              <Card key={si.item.id} className="!p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{si.catalog.name}</p>
                    <p className="text-xs text-slate-400">QR: {si.item.qrCode6} · Available: {si.item.quantity} {si.catalog.unit}</p>
                    <div className="flex gap-3 mt-2">
                      <div>
                        <label className="block text-xs text-slate-400 mb-0.5">Qty Used</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={si.quantityUsed}
                          onChange={e => handleUpdateQty(si.item.id!, Number(e.target.value))}
                          className="w-24 rounded border bg-slate-700 border-slate-600 text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-400 mb-0.5">Notes</label>
                        <input
                          type="text"
                          value={si.notes}
                          onChange={e => handleUpdateNotes(si.item.id!, e.target.value)}
                          placeholder="Optional"
                          className="w-full rounded border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveItem(si.item.id!)}
                    className="text-slate-500 hover:text-red-400 mt-0.5 shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Add supply or medication</h3>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by item name…"
            className="w-full pl-10 pr-3 py-2 rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        {lookupError && <p className="text-red-400 text-sm mb-2">{lookupError}</p>}
        {filteredItems.length === 0 ? (
          <p className="text-slate-400 text-sm">No available items{searchQuery ? ' matching that search' : ''}.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredItems.map(item => {
              const cat = catalogMap.get(item.catalogId);
              if (!cat) return null;
              return (
                <button
                  key={item.id}
                  onClick={() => handleAddItem(item)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-700 text-left"
                >
                  <div>
                    <p className="font-medium text-white text-sm">{cat.name}</p>
                    <p className="text-xs text-slate-400">QR: {item.qrCode6} · Qty: {item.quantity} {cat.unit}</p>
                  </div>
                  <Plus size={16} className="text-blue-400 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
        <Button onClick={() => setStep(2)}>
          Continue to Review
        </Button>
      </div>
    </div>
  );

  // Step 2: Review
  const renderReview = () => (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-white mb-3">Incident Summary</h3>
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <p className="text-slate-400">Title</p>
            <p className="font-medium text-white">{title}</p>
          </div>
          <div>
            <p className="text-slate-400">Date</p>
            <p className="font-medium text-white">{new Date(incidentDate).toLocaleString()}</p>
          </div>
          {description && (
            <div className="col-span-2">
              <p className="text-slate-400">Description</p>
              <p className="font-medium text-white">{description}</p>
            </div>
          )}
        </div>

        {selectedItems.length > 0 ? (
          <>
            <h4 className="text-sm font-medium text-slate-300 mb-2">Items Used ({selectedItems.length})</h4>
            <div className="space-y-2">
              {selectedItems.map(si => (
                <div key={si.item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-white">{si.catalog.name}</span>
                    {si.notes && <span className="text-slate-400 ml-2">— {si.notes}</span>}
                  </div>
                  <Badge variant="neutral">{si.quantityUsed} {si.catalog.unit}</Badge>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">No items linked to this incident.</p>
        )}
      </Card>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
        <Button onClick={handleComplete} disabled={processing} variant="success">
          {processing ? 'Saving…' : 'Create Incident'}
        </Button>
      </div>
    </div>
  );

  // Step 3: Complete
  const renderComplete = () => (
    <div className="text-center space-y-4 py-8">
      <CheckCircle className="mx-auto h-16 w-16 text-emerald-400" />
      <h2 className="text-xl font-bold text-white">Incident Created</h2>
      <p className="text-slate-400">
        &quot;{title}&quot; has been recorded with {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} linked.
      </p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => navigate('/incidents')}>View All Incidents</Button>
        {incidentId && (
          <Button variant="secondary" onClick={() => navigate(`/incidents/${incidentId}`)}>
            View This Incident
          </Button>
        )}
      </div>
    </div>
  );

  const stepRenderers = [renderDetails, renderAddItems, renderReview, renderComplete];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">New Incident</h1>
      <Stepper steps={STEPS} currentStep={step} />
      {stepRenderers[step]()}
    </div>
  );
}
