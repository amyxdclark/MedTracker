import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle, AlertTriangle, Search } from 'lucide-react';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { useAuth } from '@/auth';
import { nowISO, formatDate } from '@/utils/date';
import { Stepper, Button, Card, Badge } from '@/components';
import type { InventoryItem, ItemCatalog, MedicationLot } from '@/db/types';

const STEPS = ['Select Medication', 'Administration Details', 'Witness', 'Review', 'Complete'];

const ROUTES = ['IV', 'IM', 'IN', 'IO', 'PO', 'SL', 'PR', 'Topical', 'Nebulized', 'Other'];

export default function AdministerPage() {
  const navigate = useNavigate();
  const { currentUser, currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const userId = currentUser?.id ?? 0;

  const [step, setStep] = useState(0);
  const [qrInput, setQrInput] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [catalog, setCatalog] = useState<ItemCatalog | null>(null);
  const [lot, setLot] = useState<MedicationLot | null>(null);

  // Step 2
  const [patientId, setPatientId] = useState('');
  const [doseGiven, setDoseGiven] = useState<number | ''>(0);
  const [route, setRoute] = useState('IV');
  const [adminNotes, setAdminNotes] = useState('');

  // Step 3
  const [witnessEmail, setWitnessEmail] = useState('');
  const [witnessPassword, setWitnessPassword] = useState('');
  const [witnessError, setWitnessError] = useState('');
  const [witnessVerified, setWitnessVerified] = useState(false);
  const [witnessUserId, setWitnessUserId] = useState<number>(0);

  const [processing, setProcessing] = useState(false);
  const [adminRecordId, setAdminRecordId] = useState(0);

  const doseWasted = item ? Math.max(0, item.quantity - (doseGiven || 0)) : 0;
  const needsWitness = doseWasted > 0;
  const doseUnit = catalog?.unit ?? 'unit';

  const handleLookup = useCallback(async () => {
    setLookupError('');
    if (!qrInput.trim()) {
      setLookupError('Please enter a QR code.');
      return;
    }

    const found = await db.inventoryItems
      .where('qrCode6')
      .equals(qrInput.trim().toUpperCase())
      .filter(i => i.serviceId === serviceId && i.status === 'InStock' && i.isActive)
      .first();

    if (!found) {
      setLookupError('No active in-stock item found with that code.');
      return;
    }

    const cat = await db.itemCatalogs.get(found.catalogId);
    if (!cat) {
      setLookupError('Catalog entry not found for this item.');
      return;
    }

    if (!cat.isControlled) {
      setLookupError('This item is not a controlled substance. Use standard administration workflow.');
      return;
    }

    const lotRecord = found.lotId ? await db.medicationLots.get(found.lotId) : null;

    setItem(found);
    setCatalog(cat);
    setLot(lotRecord ?? null);
    setDoseGiven(found.quantity);
  }, [qrInput, serviceId]);

  const handleVerifyWitness = useCallback(async () => {
    setWitnessError('');
    if (!witnessEmail || !witnessPassword) {
      setWitnessError('Please enter witness email and password.');
      return;
    }

    const witness = await db.users.where('email').equals(witnessEmail).first();
    if (!witness || witness.passwordHash !== witnessPassword || !witness.isActive) {
      setWitnessError('Invalid witness credentials.');
      return;
    }

    if (witness.id === userId) {
      setWitnessError('Witness must be a different user.');
      return;
    }

    // Verify witness is in same service
    const membership = await db.serviceMemberships
      .where('[userId+serviceId]')
      .equals([witness.id!, serviceId])
      .first();
    if (!membership || !membership.isActive) {
      setWitnessError('Witness must be a member of the current service.');
      return;
    }

    setWitnessUserId(witness.id!);
    setWitnessVerified(true);
  }, [witnessEmail, witnessPassword, userId, serviceId]);

  const handleComplete = useCallback(async () => {
    if (!item || !catalog) return;
    setProcessing(true);
    try {
      const now = nowISO();

      // Create administration record
      const adminId = await db.administrationRecords.add({
        serviceId,
        itemId: item.id!,
        administeredBy: userId,
        patientId,
        doseGiven: Number(doseGiven),
        doseUnit,
        doseWasted,
        route,
        administeredAt: now,
        notes: adminNotes,
      });
      setAdminRecordId(adminId);

      await writeAuditEvent(
        serviceId, userId, 'ITEM_ADMINISTERED', 'InventoryItem', item.id!,
        `Administered ${doseGiven} ${doseUnit} of ${catalog.name} to patient ${patientId} via ${route}`,
      );

      // Waste record
      if (doseWasted > 0) {
        const wasteId = await db.wasteRecords.add({
          administrationId: adminId,
          amountWasted: doseWasted,
          wastedBy: userId,
          wastedAt: now,
          method: 'Witnessed disposal',
          notes: '',
        });

        await writeAuditEvent(
          serviceId, userId, 'ITEM_WASTED', 'WasteRecord', wasteId,
          `Wasted ${doseWasted} ${doseUnit} of ${catalog.name}`,
        );

        // Witness signature
        if (witnessVerified && witnessUserId > 0) {
          const sigId = await db.witnessSignatures.add({
            relatedType: 'WasteRecord',
            relatedId: wasteId,
            witnessUserId,
            witnessedAt: now,
            witnessEmail,
          });

          await writeAuditEvent(
            serviceId, witnessUserId, 'WASTE_WITNESSED', 'WitnessSignature', sigId,
            `Witnessed waste of ${doseWasted} ${doseUnit} of ${catalog.name}`,
          );
        }
      }

      // Update item status
      await db.inventoryItems.update(item.id!, { status: 'Administered' });

      setStep(4);
    } finally {
      setProcessing(false);
    }
  }, [item, catalog, serviceId, userId, patientId, doseGiven, doseUnit, doseWasted, route, adminNotes, witnessVerified, witnessUserId, witnessEmail]);

  // Step 0: Select Medication
  const renderSelectMedication = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Scan or enter QR Code (6-char)</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={qrInput}
              onChange={e => setQrInput(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="e.g. FNT001"
              className="w-full pl-10 pr-3 py-2 rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm uppercase"
            />
          </div>
          <Button onClick={handleLookup}>Look Up</Button>
        </div>
        {lookupError && <p className="text-red-400 text-sm mt-1">{lookupError}</p>}
      </div>

      {item && catalog && (
        <Card>
          <h3 className="font-semibold text-white mb-2">Item Found</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400">Name</p>
              <p className="font-medium text-white">{catalog.name}</p>
            </div>
            <div>
              <p className="text-slate-400">QR Code</p>
              <p className="font-medium text-white">{item.qrCode6}</p>
            </div>
            <div>
              <p className="text-slate-400">Quantity in Vial</p>
              <p className="font-medium text-white">{item.quantity} {catalog.unit}</p>
            </div>
            <div>
              <p className="text-slate-400">Controlled</p>
              <Badge variant="warning">Yes</Badge>
            </div>
            {lot && (
              <>
                <div>
                  <p className="text-slate-400">Lot Number</p>
                  <p className="font-medium text-white">{lot.lotNumber}</p>
                </div>
                <div>
                  <p className="text-slate-400">Expiration</p>
                  <p className="font-medium text-white">{formatDate(lot.expirationDate)}</p>
                </div>
              </>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            <Button onClick={() => setStep(1)}>Continue</Button>
          </div>
        </Card>
      )}
    </div>
  );

  // Step 1: Administration Details
  const renderAdminDetails = () => (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-slate-400 mb-3">Administering: <span className="font-semibold text-white">{catalog?.name}</span></p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Patient ID</label>
            <input
              type="text"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              placeholder="Enter patient identifier"
              className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Dose Given ({doseUnit})</label>
              <input
                type="number"
                min={0}
                max={item?.quantity ?? 0}
                step="any"
                value={doseGiven}
                onChange={e => setDoseGiven(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Route</label>
              <select
                value={route}
                onChange={e => setRoute(e.target.value)}
                className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROUTES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Card className={doseWasted > 0 ? 'border-amber-500/30 bg-amber-500/10' : 'bg-emerald-500/20'}>
            <div className="flex items-center gap-2 text-sm">
              {doseWasted > 0 ? (
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              ) : (
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              )}
              <div>
                <p className="font-medium text-white">
                  Dose wasted: {doseWasted} {doseUnit}
                </p>
                {doseWasted > 0 && (
                  <p className="text-amber-300">Partial waste requires a witness in the next step.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </Card>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <Button
              onClick={() => setStep(needsWitness ? 2 : 3)}
              disabled={!patientId.trim() || !doseGiven || doseGiven <= 0}
            >
              {needsWitness ? 'Continue to Witness' : 'Continue to Review'}
            </Button>
          </div>
    </div>
  );

  // Step 2: Witness
  const renderWitness = () => (
    <div className="space-y-4">
      <Card className="border-amber-500/30 bg-amber-500/10">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Partial waste requires a witness</p>
            <p className="text-sm text-slate-400 mt-1">
              {doseWasted} {doseUnit} of {catalog?.name} must be witnessed by another authorized user.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Witness Email</label>
          <input
            type="email"
            value={witnessEmail}
            onChange={e => { setWitnessEmail(e.target.value); setWitnessVerified(false); }}
            placeholder="witness@example.com"
            className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Witness Password</label>
          <input
            type="password"
            value={witnessPassword}
            onChange={e => { setWitnessPassword(e.target.value); setWitnessVerified(false); }}
            className="w-full rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {witnessError && <p className="text-red-400 text-sm">{witnessError}</p>}
        {witnessVerified && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle size={16} />
            <span>Witness verified successfully.</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
        {!witnessVerified && (
          <Button onClick={handleVerifyWitness}>Verify Witness</Button>
        )}
        {witnessVerified && (
          <Button onClick={() => setStep(3)}>Continue to Review</Button>
        )}
      </div>
    </div>
  );

  // Step 3: Review
  const renderReview = () => (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-white mb-3">Administration Summary</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-400">Medication</p>
            <p className="font-medium text-white">{catalog?.name}</p>
          </div>
          <div>
            <p className="text-slate-400">QR Code</p>
            <p className="font-medium text-white">{item?.qrCode6}</p>
          </div>
          <div>
            <p className="text-slate-400">Patient ID</p>
            <p className="font-medium text-white">{patientId}</p>
          </div>
          <div>
            <p className="text-slate-400">Route</p>
            <p className="font-medium text-white">{route}</p>
          </div>
          <div>
            <p className="text-slate-400">Dose Given</p>
            <p className="font-medium text-white">{doseGiven} {doseUnit}</p>
          </div>
          <div>
            <p className="text-slate-400">Dose Wasted</p>
            <p className="font-medium text-white">{doseWasted} {doseUnit}</p>
          </div>
          {needsWitness && (
            <div className="col-span-2">
              <p className="text-slate-400">Witness</p>
              <p className="font-medium text-white">{witnessEmail}</p>
            </div>
          )}
        </div>
      </Card>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setStep(needsWitness ? 2 : 1)}>Back</Button>
        <Button onClick={handleComplete} disabled={processing} variant="success">
          {processing ? 'Processing…' : 'Confirm Administration'}
        </Button>
      </div>
    </div>
  );

  // Step 4: Complete
  const renderComplete = () => (
    <div className="text-center space-y-4 py-8">
      <CheckCircle className="mx-auto h-16 w-16 text-emerald-400" />
      <h2 className="text-xl font-bold text-white">Administration Recorded</h2>
      <p className="text-slate-400">
        {doseGiven} {doseUnit} of {catalog?.name} administered to patient {patientId}.
        {doseWasted > 0 && ` ${doseWasted} ${doseUnit} wasted and witnessed.`}
      </p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => navigate('/')}>Home</Button>
        <Button variant="secondary" onClick={() => navigate('/inventory')}>Inventory</Button>
      </div>
    </div>
  );

  const stepRenderers = [renderSelectMedication, renderAdminDetails, renderWitness, renderReview, renderComplete];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Administer Controlled Substance</h1>
      <Stepper steps={STEPS} currentStep={step} />
      {stepRenderers[step]()}
    </div>
  );
}
