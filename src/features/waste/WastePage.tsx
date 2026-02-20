import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Search, CheckCircle, AlertTriangle, Undo2 } from 'lucide-react';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import { useAuth } from '@/auth';
import { nowISO, formatDateTime } from '@/utils/date';
import { Stepper, Button, Card, Badge } from '@/components';
import type { InventoryItem, ItemCatalog, AdministrationRecord } from '@/db/types';

const STEPS = ['Find Item', 'Waste Details', 'Witness', 'Review', 'Complete'];
const WASTE_METHODS = ['Witnessed disposal', 'Drain into waste container', 'Sharps container', 'Other'];

export default function WastePage() {
  const navigate = useNavigate();
  const { currentUser, currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;
  const userId = currentUser?.id ?? 0;

  const [step, setStep] = useState(0);
  const [qrInput, setQrInput] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [catalog, setCatalog] = useState<ItemCatalog | null>(null);
  const [adminRecord, setAdminRecord] = useState<AdministrationRecord | null>(null);

  // Correction mode: user logged waste against the wrong item
  const [isCorrection, setIsCorrection] = useState(false);
  const [correctionNotes, setCorrectionNotes] = useState('');

  // Waste details
  const [amountWasted, setAmountWasted] = useState<number>(0);
  const [wasteMethod, setWasteMethod] = useState(WASTE_METHODS[0]);
  const [wasteNotes, setWasteNotes] = useState('');

  // Witness
  const [witnessEmail, setWitnessEmail] = useState('');
  const [witnessPassword, setWitnessPassword] = useState('');
  const [witnessError, setWitnessError] = useState('');
  const [witnessVerified, setWitnessVerified] = useState(false);
  const [witnessUserId, setWitnessUserId] = useState<number>(0);

  const [processing, setProcessing] = useState(false);

  const handleLookup = useCallback(async () => {
    setLookupError('');
    if (!qrInput.trim()) {
      setLookupError('Please enter a QR code.');
      return;
    }

    const found = await db.inventoryItems
      .where('qrCode6')
      .equals(qrInput.trim().toUpperCase())
      .filter(i => i.serviceId === serviceId && i.isActive)
      .first();

    if (!found) {
      setLookupError('No active item found with that code.');
      return;
    }

    const cat = await db.itemCatalogs.get(found.catalogId);
    if (!cat) {
      setLookupError('Catalog entry not found for this item.');
      return;
    }

    // Check if item was administered (look for existing admin record)
    const existingAdmin = await db.administrationRecords
      .where('itemId')
      .equals(found.id!)
      .last();

    setItem(found);
    setCatalog(cat);
    setAdminRecord(existingAdmin ?? null);
    setAmountWasted(found.quantity);
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

      if (isCorrection) {
        // Correction: mark the previous waste/admin as corrected
        await writeAuditEvent(
          serviceId, userId, 'CORRECTION_MADE', 'InventoryItem', item.id!,
          `Correction: ${correctionNotes}. Item ${item.qrCode6} (${catalog.name}).`,
        );

        // Revert item status to InStock if it was wrongly administered
        if (item.status === 'Administered' || item.status === 'Wasted') {
          await db.inventoryItems.update(item.id!, { status: 'InStock', notes: `Corrected: ${correctionNotes}` });
        }
      } else {
        // Normal waste flow
        const administrationId = adminRecord?.id ?? 0;

        const wasteId = await db.wasteRecords.add({
          administrationId,
          amountWasted,
          wastedBy: userId,
          wastedAt: now,
          method: wasteMethod,
          notes: wasteNotes,
        });

        await writeAuditEvent(
          serviceId, userId, 'ITEM_WASTED', 'WasteRecord', wasteId,
          `Wasted ${amountWasted} ${catalog.unit} of ${catalog.name} via ${wasteMethod}`,
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
            `Witnessed waste of ${amountWasted} ${catalog.unit} of ${catalog.name}`,
          );
        }

        // Update item status
        await db.inventoryItems.update(item.id!, { status: 'Wasted' });
      }

      setStep(4);
    } finally {
      setProcessing(false);
    }
  }, [item, catalog, serviceId, userId, isCorrection, correctionNotes, adminRecord, amountWasted, wasteMethod, wasteNotes, witnessVerified, witnessUserId, witnessEmail]);

  // Step 0: Find Item
  const renderFindItem = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Scan or enter QR Code (6-char)</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={qrInput}
              onChange={e => setQrInput(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="e.g. FNT001"
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm uppercase"
            />
          </div>
          <Button onClick={handleLookup}>Look Up</Button>
        </div>
        {lookupError && <p className="text-red-600 text-sm mt-1">{lookupError}</p>}
      </div>

      {item && catalog && (
        <Card>
          <h3 className="font-semibold text-slate-900 mb-2">Item Found</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Name</p>
              <p className="font-medium text-slate-900">{catalog.name}</p>
            </div>
            <div>
              <p className="text-slate-500">QR Code</p>
              <p className="font-medium text-slate-900">{item.qrCode6}</p>
            </div>
            <div>
              <p className="text-slate-500">Status</p>
              <Badge variant={item.status === 'InStock' ? 'ok' : 'warning'}>{item.status}</Badge>
            </div>
            <div>
              <p className="text-slate-500">Quantity</p>
              <p className="font-medium text-slate-900">{item.quantity} {catalog.unit}</p>
            </div>
            {adminRecord && (
              <div className="col-span-2">
                <p className="text-slate-500">Last Administration</p>
                <p className="font-medium text-slate-900">{formatDateTime(adminRecord.administeredAt)}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <Button onClick={() => { setIsCorrection(false); setStep(1); }}>Log Waste</Button>
            <Button variant="secondary" icon={<Undo2 size={16} />} onClick={() => { setIsCorrection(true); setStep(1); }}>
              Correction
            </Button>
          </div>
        </Card>
      )}
    </div>
  );

  // Step 1: Waste or Correction Details
  const renderDetails = () => (
    <div className="space-y-4">
      {isCorrection ? (
        <Card className="border-amber-300 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Correction Mode</p>
              <p className="text-sm text-slate-600 mt-1">
                This will correct a previous waste or administration logged against {catalog?.name} ({item?.qrCode6}).
                The item will be reverted to InStock.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Correction</label>
            <textarea
              value={correctionNotes}
              onChange={e => setCorrectionNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Accidentally logged waste against the wrong item"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-slate-500 mb-3">Wasting: <span className="font-semibold text-slate-900">{catalog?.name}</span></p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount to Waste ({catalog?.unit})</label>
                <input
                  type="number"
                  min={0}
                  max={item?.quantity ?? 0}
                  step="any"
                  value={amountWasted}
                  onChange={e => setAmountWasted(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                <select
                  value={wasteMethod}
                  onChange={e => setWasteMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {WASTE_METHODS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={wasteNotes}
                onChange={e => setWasteNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>
      )}

      <Button
        onClick={() => setStep(2)}
        disabled={isCorrection ? !correctionNotes.trim() : amountWasted <= 0}
      >
        Continue to Witness
      </Button>
    </div>
  );

  // Step 2: Witness
  const renderWitness = () => (
    <div className="space-y-4">
      <Card className="border-amber-300 bg-amber-50">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-900">
              {isCorrection ? 'Correction requires a witness' : 'Waste requires a witness'}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              Another authorized user must verify this {isCorrection ? 'correction' : 'waste'}.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Witness Email</label>
          <input
            type="email"
            value={witnessEmail}
            onChange={e => { setWitnessEmail(e.target.value); setWitnessVerified(false); }}
            placeholder="witness@example.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Witness Password</label>
          <input
            type="password"
            value={witnessPassword}
            onChange={e => { setWitnessPassword(e.target.value); setWitnessVerified(false); }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {witnessError && <p className="text-red-600 text-sm">{witnessError}</p>}
        {witnessVerified && (
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} />
            <span>Witness verified successfully.</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
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
        <h3 className="font-semibold text-slate-900 mb-3">
          {isCorrection ? 'Correction Summary' : 'Waste Summary'}
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Medication</p>
            <p className="font-medium text-slate-900">{catalog?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">QR Code</p>
            <p className="font-medium text-slate-900">{item?.qrCode6}</p>
          </div>
          {isCorrection ? (
            <div className="col-span-2">
              <p className="text-slate-500">Correction Reason</p>
              <p className="font-medium text-slate-900">{correctionNotes}</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-slate-500">Amount Wasted</p>
                <p className="font-medium text-slate-900">{amountWasted} {catalog?.unit}</p>
              </div>
              <div>
                <p className="text-slate-500">Method</p>
                <p className="font-medium text-slate-900">{wasteMethod}</p>
              </div>
            </>
          )}
          <div className="col-span-2">
            <p className="text-slate-500">Witness</p>
            <p className="font-medium text-slate-900">{witnessEmail}</p>
          </div>
        </div>
      </Card>
      <Button onClick={handleComplete} disabled={processing} variant={isCorrection ? 'danger' : 'success'}>
        {processing ? 'Processing…' : isCorrection ? 'Confirm Correction' : 'Confirm Waste'}
      </Button>
    </div>
  );

  // Step 4: Complete
  const renderComplete = () => (
    <div className="text-center space-y-4 py-8">
      <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
      <h2 className="text-xl font-bold text-slate-900">
        {isCorrection ? 'Correction Recorded' : 'Waste Recorded'}
      </h2>
      <p className="text-slate-500">
        {isCorrection
          ? `Correction applied to ${catalog?.name} (${item?.qrCode6}). Item reverted to InStock.`
          : `${amountWasted} ${catalog?.unit} of ${catalog?.name} has been wasted and witnessed.`
        }
      </p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => navigate('/')}>Home</Button>
        <Button variant="secondary" onClick={() => navigate('/inventory')}>Inventory</Button>
      </div>
    </div>
  );

  const stepRenderers = [renderFindItem, renderDetails, renderWitness, renderReview, renderComplete];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">
        Waste / Correction
      </h1>
      <Stepper steps={STEPS} currentStep={step} />
      {stepRenderers[step]()}
    </div>
  );
}
