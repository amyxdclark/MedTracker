import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { MapPin, Lock, CheckCircle2, ClipboardCheck, Home, RotateCcw } from 'lucide-react';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { useAuth } from '@/auth';
import { Stepper, Badge, Card, Button } from '@/components';
import { getComplianceStatus, complianceBadgeVariant } from '@/utils/compliance';
import { nowISO } from '@/utils/date';
import type { Location, InventoryItem, ItemCatalog } from '@/db/types';

const STEPS = ['Choose Location', 'Perform Check', 'Review', 'Done'];

interface ItemCheckState {
  itemId: number;
  verified: boolean;
  notes: string;
}

export default function ChecksPage() {
  const { currentUser, currentService } = useAuth();
  const [searchParams] = useSearchParams();
  const serviceId = currentService?.id ?? 0;
  const userId = currentUser?.id ?? 0;

  const [step, setStep] = useState(0);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [sealNotes, setSealNotes] = useState('');
  const [itemChecks, setItemChecks] = useState<ItemCheckState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [checkedCount, setCheckedCount] = useState(0);
  const [wasSealCheck, setWasSealCheck] = useState(false);

  const locations = useLiveQuery(
    () => db.locations.where('serviceId').equals(serviceId).filter((l) => l.isActive).toArray(),
    [serviceId]
  );

  const allItems = useLiveQuery(
    () => db.inventoryItems.where('serviceId').equals(serviceId).filter((i) => i.isActive).toArray(),
    [serviceId]
  );

  const allCatalogs = useLiveQuery(
    () => db.itemCatalogs.where('serviceId').equals(serviceId).toArray(),
    [serviceId]
  );

  // Auto-select location from query param
  useEffect(() => {
    const locId = searchParams.get('locationId');
    if (locId && step === 0) {
      const id = Number(locId);
      if (locations?.find((l) => l.id === id)) {
        setSelectedLocationId(id);
        setStep(1);
      }
    }
  }, [searchParams, locations, step]);

  const selectedLocation = locations?.find((l) => l.id === selectedLocationId) ?? null;
  const locationItems = (allItems ?? []).filter(
    (i) => i.locationId === selectedLocationId && i.status === 'InStock'
  );
  const catalogMap = new Map((allCatalogs ?? []).map((c) => [c.id!, c]));

  function getLocationCompliance(loc: Location) {
    const locItems = (allItems ?? []).filter((i) => i.locationId === loc.id && i.isActive);
    if (locItems.length === 0) return 'OK' as const;
    const statuses = locItems.map((i) => getComplianceStatus(i.lastCheckedAt, loc.checkFrequencyHours));
    if (statuses.includes('Overdue')) return 'Overdue' as const;
    if (statuses.includes('DueSoon')) return 'DueSoon' as const;
    return 'OK' as const;
  }

  function handleSelectLocation(loc: Location) {
    setSelectedLocationId(loc.id!);
    // Initialize item check states for unsealed locations
    if (!loc.sealed) {
      const locItems = (allItems ?? []).filter(
        (i) => i.locationId === loc.id && i.isActive && i.status === 'InStock'
      );
      setItemChecks(locItems.map((i) => ({ itemId: i.id!, verified: false, notes: '' })));
    }
    setStep(1);
  }

  function toggleItemVerified(itemId: number) {
    setItemChecks((prev) =>
      prev.map((ic) => (ic.itemId === itemId ? { ...ic, verified: !ic.verified } : ic))
    );
  }

  function setItemNotes(itemId: number, notes: string) {
    setItemChecks((prev) =>
      prev.map((ic) => (ic.itemId === itemId ? { ...ic, notes } : ic))
    );
  }

  async function handleSealVerify() {
    if (!selectedLocation || submitting) return;
    setSubmitting(true);
    try {
      const now = nowISO();
      const sid = await db.checkSessions.add({
        serviceId,
        locationId: selectedLocation.id!,
        checkedBy: userId,
        sealVerified: true,
        startedAt: now,
        completedAt: now,
        notes: sealNotes,
      });

      await writeAuditEvent(serviceId, userId, 'CHECK_SESSION_STARTED', 'CheckSession', sid as number, `Seal check at ${selectedLocation.name}`);
      await writeAuditEvent(serviceId, userId, 'CHECK_SEAL_VERIFIED', 'Location', selectedLocation.id!, `Seal verified: ${selectedLocation.sealId}`);

      // Update lastCheckedAt for all items in this location
      const locItems = (allItems ?? []).filter((i) => i.locationId === selectedLocation.id && i.isActive);
      for (const item of locItems) {
        await db.inventoryItems.update(item.id!, { lastCheckedAt: now });
      }

      await writeAuditEvent(serviceId, userId, 'CHECK_SESSION_COMPLETED', 'CheckSession', sid as number, `Seal check completed, ${locItems.length} items updated`);

      setSessionId(sid as number);
      setCheckedCount(locItems.length);
      setWasSealCheck(true);
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnsealedSubmit() {
    if (!selectedLocation || submitting) return;
    const allVerified = itemChecks.every((ic) => ic.verified);
    if (!allVerified) return;
    setSubmitting(true);
    try {
      const now = nowISO();
      const sid = await db.checkSessions.add({
        serviceId,
        locationId: selectedLocation.id!,
        checkedBy: userId,
        sealVerified: false,
        startedAt: now,
        completedAt: now,
        notes: '',
      });

      await writeAuditEvent(serviceId, userId, 'CHECK_SESSION_STARTED', 'CheckSession', sid as number, `Item check at ${selectedLocation.name}`);

      for (const ic of itemChecks) {
        await db.checkLines.add({
          sessionId: sid as number,
          itemId: ic.itemId,
          verified: ic.verified,
          notes: ic.notes,
        });
        await db.inventoryItems.update(ic.itemId, { lastCheckedAt: now });
        await writeAuditEvent(serviceId, userId, 'CHECK_ITEM_VERIFIED', 'InventoryItem', ic.itemId, `Item verified at ${selectedLocation.name}`);
      }

      await writeAuditEvent(serviceId, userId, 'CHECK_SESSION_COMPLETED', 'CheckSession', sid as number, `Item check completed, ${itemChecks.length} items verified`);

      setSessionId(sid as number);
      setCheckedCount(itemChecks.length);
      setWasSealCheck(false);
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setStep(0);
    setSelectedLocationId(null);
    setSealNotes('');
    setItemChecks([]);
    setSessionId(null);
    setCheckedCount(0);
    setWasSealCheck(false);
  }

  if (!locations || !allItems || !allCatalogs) {
    return <p className="text-slate-400 p-4">Loading...</p>;
  }

  // Sort locations: Overdue first, then DueSoon, then OK
  const sortedLocations = [...locations].sort((a, b) => {
    const order = { Overdue: 0, DueSoon: 1, OK: 2 };
    return order[getLocationCompliance(a)] - order[getLocationCompliance(b)];
  });

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-4">Daily Check</h1>
      <Stepper steps={STEPS} currentStep={step} />

      {/* Step 0: Choose Location */}
      {step === 0 && (
        <div>
          <p className="text-slate-400 mb-4">Select a location to check:</p>
          {sortedLocations.length === 0 ? (
            <p className="text-slate-400">No locations available.</p>
          ) : (
            <div className="space-y-2">
              {sortedLocations.map((loc) => {
                const compliance = getLocationCompliance(loc);
                return (
                  <Card key={loc.id} onClick={() => handleSelectLocation(loc)} className="!p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-slate-400" />
                        <span className="font-medium">{loc.name}</span>
                        <Badge variant="neutral">{loc.type}</Badge>
                        {loc.sealed && (
                          <Badge variant="info">
                            <Lock size={10} className="mr-1 inline" />
                            Sealed
                          </Badge>
                        )}
                      </div>
                      <Badge variant={complianceBadgeVariant(compliance)}>{compliance}</Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Perform Check */}
      {step === 1 && selectedLocation && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={18} className="text-blue-400" />
            <h2 className="text-lg font-semibold">{selectedLocation.name}</h2>
            <Badge variant="neutral">{selectedLocation.type}</Badge>
          </div>

          {selectedLocation.sealed ? (
            /* Sealed location: verify seal */
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Lock size={18} className="text-blue-400" />
                <h3 className="font-semibold text-white">Verify Seal</h3>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">Seal ID</label>
                <input
                  type="text"
                  value={selectedLocation.sealId}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border bg-slate-700 border-slate-600 text-slate-300"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes (optional)</label>
                <textarea
                  value={sealNotes}
                  onChange={(e) => setSealNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  rows={2}
                  placeholder="Any observations..."
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setStep(0); setSelectedLocationId(null); }}>
                  Back
                </Button>
                <Button
                  variant="success"
                  icon={<CheckCircle2 size={18} />}
                  onClick={handleSealVerify}
                  disabled={submitting}
                >
                  {submitting ? 'Verifying...' : 'Seal is intact and verified'}
                </Button>
              </div>
            </Card>
          ) : (
            /* Unsealed location: verify each item */
            <div>
              <p className="text-sm text-slate-400 mb-3">
                Verify each item at this location ({locationItems.length} items):
              </p>
              {locationItems.length === 0 ? (
                <Card>
                  <p className="text-slate-400 text-sm">No items at this location.</p>
                </Card>
              ) : (
                <div className="space-y-2 mb-4">
                  {itemChecks.map((ic) => {
                    const item = locationItems.find((i) => i.id === ic.itemId);
                    const catalog = item ? catalogMap.get(item.catalogId) : null;
                    return (
                      <Card key={ic.itemId} className="!p-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={ic.verified}
                            onChange={() => toggleItemVerified(ic.itemId)}
                            className="mt-1 h-5 w-5 rounded border-slate-600 text-blue-500 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {catalog?.name ?? `Item #${ic.itemId}`}
                              </span>
                              <span className="text-xs text-slate-400">QR: {item?.qrCode6}</span>
                              <span className="text-xs text-slate-400">Qty: {item?.quantity}</span>
                            </div>
                            <input
                              type="text"
                              value={ic.notes}
                              onChange={(e) => setItemNotes(ic.itemId, e.target.value)}
                              placeholder="Notes (optional)"
                              className="mt-1 w-full px-2 py-1 text-sm rounded border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                            />
                          </div>
                          {ic.verified && <CheckCircle2 size={20} className="text-emerald-400 mt-1" />}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setStep(0); setSelectedLocationId(null); }}>
                  Back
                </Button>
                <Button
                  variant="success"
                  icon={<ClipboardCheck size={18} />}
                  onClick={handleUnsealedSubmit}
                  disabled={submitting || !itemChecks.every((ic) => ic.verified) || itemChecks.length === 0}
                >
                  {submitting ? 'Submitting...' : 'Complete Check'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && selectedLocation && (
        <div>
          <Card className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={24} className="text-emerald-400" />
              <h2 className="text-lg font-semibold text-emerald-300">Check Complete</h2>
            </div>
            <div className="text-sm text-slate-400 space-y-1">
              <p><span className="font-medium">Location:</span> {selectedLocation.name}</p>
              <p><span className="font-medium">Type:</span> {wasSealCheck ? 'Seal Verification' : 'Item-by-Item Check'}</p>
              <p><span className="font-medium">Items updated:</span> {checkedCount}</p>
              <p>
                <span className="font-medium">Compliance:</span>{' '}
                <Badge variant="ok">OK</Badge>
              </p>
            </div>
          </Card>
          <Button onClick={() => setStep(3)}>Continue</Button>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div className="text-center py-8">
          <CheckCircle2 size={64} className="text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">All Done!</h2>
          <p className="text-slate-400 mb-6">The daily check has been recorded successfully.</p>
          <div className="flex justify-center gap-3">
            <Link to="/">
              <Button variant="primary" icon={<Home size={18} />}>Go Home</Button>
            </Link>
            <Button variant="secondary" icon={<RotateCcw size={18} />} onClick={handleReset}>
              Check Another Location
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
