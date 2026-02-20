import { db } from './database';
import { writeAuditEvent } from './audit';

export async function seedDemoData() {
  await db.delete();
  await db.open();

  const now = () => new Date().toISOString();

  // Company
  const companyId = await db.companies.add({ name: 'Tri-County EMS', isActive: true, createdAt: now() });

  // Services – three distinct EMS services
  const mc1Id = await db.services.add({ companyId, name: 'MC1', isActive: true, createdAt: now() });
  const lisbonId = await db.services.add({ companyId, name: 'Lisbon EMS', isActive: true, createdAt: now() });
  const metroId = await db.services.add({ companyId, name: 'Metro EMS Station 1', isActive: true, createdAt: now() });

  // Users – plaintext passwords for demo only; never use in production
  const demoUserId = await db.users.add({ email: 'demo@medtracker.app', passwordHash: 'demo1234', firstName: 'Jane', lastName: 'Doe', isActive: true, createdAt: now() });
  const adminUserId = await db.users.add({ email: 'admin@medtracker.app', passwordHash: 'admin1234', firstName: 'Admin', lastName: 'User', isActive: true, createdAt: now() });
  const driverUserId = await db.users.add({ email: 'driver@medtracker.app', passwordHash: 'driver1234', firstName: 'Mike', lastName: 'Smith', isActive: true, createdAt: now() });

  // Service Memberships
  await db.serviceMemberships.bulkAdd([
    { userId: demoUserId, serviceId: mc1Id, role: 'Paramedic', isActive: true, createdAt: now() },
    { userId: demoUserId, serviceId: lisbonId, role: 'Supervisor', isActive: true, createdAt: now() },
    { userId: demoUserId, serviceId: metroId, role: 'Paramedic', isActive: true, createdAt: now() },
    { userId: adminUserId, serviceId: mc1Id, role: 'SystemAdmin', isActive: true, createdAt: now() },
    { userId: adminUserId, serviceId: lisbonId, role: 'SystemAdmin', isActive: true, createdAt: now() },
    { userId: adminUserId, serviceId: metroId, role: 'SystemAdmin', isActive: true, createdAt: now() },
    { userId: driverUserId, serviceId: lisbonId, role: 'Driver', isActive: true, createdAt: now() },
  ]);

  // Vendors
  await db.vendors.add({ serviceId: mc1Id, name: 'MedSupply Direct', contactInfo: 'orders@medsupply.example.com', isActive: true });
  await db.vendors.add({ serviceId: lisbonId, name: 'Tri-County Supply', contactInfo: 'supply@tricounty.example.com', isActive: true });

  const MS_PER_DAY = 86400000;
  const MS_PER_HOUR = 3600000;
  const thirtyHoursAgo = new Date(Date.now() - 30 * MS_PER_HOUR).toISOString();
  const recentCheck = new Date(Date.now() - 2 * MS_PER_HOUR).toISOString();
  const futureExpiry = (days: number) => new Date(Date.now() + days * MS_PER_DAY).toISOString().split('T')[0];

  // ─── MC1: Paramedic Level Fly Car ───────────────────────────────────
  // Item catalogs for MC1
  const mc1Fent = await db.itemCatalogs.add({ serviceId: mc1Id, name: 'Fentanyl 100mcg', category: 'Controlled', isControlled: true, unit: 'vial', defaultParLevel: 4, isActive: true });
  const mc1Morph = await db.itemCatalogs.add({ serviceId: mc1Id, name: 'Morphine 10mg', category: 'Controlled', isControlled: true, unit: 'vial', defaultParLevel: 4, isActive: true });
  const mc1Epi = await db.itemCatalogs.add({ serviceId: mc1Id, name: 'Epinephrine 1mg', category: 'Emergency', isControlled: false, unit: 'ampule', defaultParLevel: 6, isActive: true });
  const mc1Narcan = await db.itemCatalogs.add({ serviceId: mc1Id, name: 'Naloxone 2mg', category: 'Emergency', isControlled: false, unit: 'vial', defaultParLevel: 4, isActive: true });
  const mc1Alb = await db.itemCatalogs.add({ serviceId: mc1Id, name: 'Albuterol 2.5mg', category: 'Respiratory', isControlled: false, unit: 'nebule', defaultParLevel: 10, isActive: true });
  const mc1Asp = await db.itemCatalogs.add({ serviceId: mc1Id, name: 'Aspirin 325mg', category: 'Cardiac', isControlled: false, unit: 'packet', defaultParLevel: 10, isActive: true });

  // MC1 Locations: fly car with sealed narcotic box, sealed non-narcotic box, med bag, trauma bag, pediatric kit, plus rear items
  const mc1Car = await db.locations.add({ serviceId: mc1Id, parentId: null, name: 'MC1 Fly Car', type: 'Unit', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const mc1NarcBox = await db.locations.add({ serviceId: mc1Id, parentId: mc1Car, name: 'Sealed Narcotic Box', type: 'DrugBox', sealed: true, sealId: 'MC1-N-001', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const mc1NonNarcBox = await db.locations.add({ serviceId: mc1Id, parentId: mc1Car, name: 'Sealed Non-Narcotic Box', type: 'DrugBox', sealed: true, sealId: 'MC1-NN-001', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const mc1MedBag = await db.locations.add({ serviceId: mc1Id, parentId: mc1Car, name: 'Medical Bag', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const mc1TraumaBag = await db.locations.add({ serviceId: mc1Id, parentId: mc1Car, name: 'Trauma Bag', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const mc1PedKit = await db.locations.add({ serviceId: mc1Id, parentId: mc1Car, name: 'Pediatric Kit', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const mc1Rear = await db.locations.add({ serviceId: mc1Id, parentId: mc1Car, name: 'Rear of Car', type: 'Other', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  await db.locations.add({ serviceId: mc1Id, parentId: mc1Rear, name: 'Cardiac Monitor', type: 'Other', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  await db.locations.add({ serviceId: mc1Id, parentId: mc1Rear, name: 'IV Pump', type: 'Other', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });

  // MC1 Medication Lots & Inventory
  const mc1LotFent = await db.medicationLots.add({ serviceId: mc1Id, catalogId: mc1Fent, lotNumber: 'LOT-F-2025-001', serialNumber: 'SN-MC1-F001', expirationDate: futureExpiry(20), qrCode6: 'FNT001', createdAt: now() });
  const mc1LotMorph = await db.medicationLots.add({ serviceId: mc1Id, catalogId: mc1Morph, lotNumber: 'LOT-M-2025-001', serialNumber: 'SN-MC1-M001', expirationDate: futureExpiry(90), qrCode6: 'MRP001', createdAt: now() });

  await db.inventoryItems.bulkAdd([
    { serviceId: mc1Id, catalogId: mc1Fent, lotId: mc1LotFent, locationId: mc1NarcBox, status: 'InStock', quantity: 2, qrCode6: 'FNT001', notes: '', isActive: true, lastCheckedAt: thirtyHoursAgo, createdAt: now() },
    { serviceId: mc1Id, catalogId: mc1Morph, lotId: mc1LotMorph, locationId: mc1NarcBox, status: 'InStock', quantity: 2, qrCode6: 'MRP001', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
    { serviceId: mc1Id, catalogId: mc1Epi, locationId: mc1NonNarcBox, status: 'InStock', quantity: 4, qrCode6: 'EPI001', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
    { serviceId: mc1Id, catalogId: mc1Narcan, locationId: mc1NonNarcBox, status: 'InStock', quantity: 2, qrCode6: 'NRC001', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
    { serviceId: mc1Id, catalogId: mc1Alb, locationId: mc1MedBag, status: 'InStock', quantity: 6, qrCode6: 'ALB001', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
    { serviceId: mc1Id, catalogId: mc1Asp, locationId: mc1TraumaBag, status: 'InStock', quantity: 10, qrCode6: 'ASP001', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
  ]);

  await db.locationExpectedContents.bulkAdd([
    { locationId: mc1NarcBox, catalogId: mc1Fent, expectedQuantity: 2 },
    { locationId: mc1NarcBox, catalogId: mc1Morph, expectedQuantity: 2 },
    { locationId: mc1NonNarcBox, catalogId: mc1Epi, expectedQuantity: 4 },
    { locationId: mc1NonNarcBox, catalogId: mc1Narcan, expectedQuantity: 2 },
  ]);

  // ─── Lisbon EMS: Three Units (42, 43, 44) ──────────────────────────
  // Item catalogs for Lisbon EMS
  const lisFent = await db.itemCatalogs.add({ serviceId: lisbonId, name: 'Fentanyl 100mcg', category: 'Controlled', isControlled: true, unit: 'vial', defaultParLevel: 4, isActive: true });
  const lisMorph = await db.itemCatalogs.add({ serviceId: lisbonId, name: 'Morphine 10mg', category: 'Controlled', isControlled: true, unit: 'vial', defaultParLevel: 4, isActive: true });
  const lisEpi = await db.itemCatalogs.add({ serviceId: lisbonId, name: 'Epinephrine 1mg', category: 'Emergency', isControlled: false, unit: 'ampule', defaultParLevel: 6, isActive: true });
  const lisNarcan = await db.itemCatalogs.add({ serviceId: lisbonId, name: 'Naloxone 2mg', category: 'Emergency', isControlled: false, unit: 'vial', defaultParLevel: 4, isActive: true });
  const lisAlb = await db.itemCatalogs.add({ serviceId: lisbonId, name: 'Albuterol 2.5mg', category: 'Respiratory', isControlled: false, unit: 'nebule', defaultParLevel: 10, isActive: true });
  const lisAsp = await db.itemCatalogs.add({ serviceId: lisbonId, name: 'Aspirin 325mg', category: 'Cardiac', isControlled: false, unit: 'packet', defaultParLevel: 10, isActive: true });

  // Helper to create common Lisbon unit locations
  const createLisbonUnitLocations = async (unitName: string) => {
    const unit = await db.locations.add({ serviceId: lisbonId, parentId: null, name: unitName, type: 'Unit', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    const narcBox = await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Sealed Narcotic Box', type: 'DrugBox', sealed: true, sealId: `${unitName}-NARC-001`, checkFrequencyHours: 24, isActive: true, createdAt: now() });
    const triCountyBox = await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Sealed Tri-County Box', type: 'DrugBox', sealed: true, sealId: `${unitName}-TC-001`, checkFrequencyHours: 24, isActive: true, createdAt: now() });
    const medBox = await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Unsealed Med Box', type: 'DrugBox', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Exterior Oxygen Tank Cabinet', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Driver Side Rear Exterior Cabinet', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Passenger Side Exterior Trauma Cabinet', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Passenger Side Exterior Small Cabinet', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Interior Front Cabinet', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Interior Passenger Cabinet Above Bench Seat', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Interior Driver Side Cabinet Airway Forward', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Interior Cabinet Above Seat Driver Side', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Interior Cabinet Next To Seat Driver Side', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Interior Cabinet Driver Side Rear', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Front Cab', type: 'Other', sealed: false, sealId: '', checkFrequencyHours: 48, isActive: true, createdAt: now() });
    await db.locations.add({ serviceId: lisbonId, parentId: unit, name: 'Engine Compartment', type: 'Other', sealed: false, sealId: '', checkFrequencyHours: 48, isActive: true, createdAt: now() });
    return { unit, narcBox, triCountyBox, medBox };
  };

  const u42 = await createLisbonUnitLocations('Unit 42');
  const u43 = await createLisbonUnitLocations('Unit 43');
  const u44 = await createLisbonUnitLocations('Unit 44');

  // Lisbon EMS Medication Lots & Inventory for each unit
  for (const u of [u42, u43, u44]) {
    const lotF = await db.medicationLots.add({ serviceId: lisbonId, catalogId: lisFent, lotNumber: `LOT-F-LIS-${u.unit}`, serialNumber: `SN-LIS-F${u.unit}`, expirationDate: futureExpiry(60), qrCode6: `LF${String(u.unit).padStart(4, '0')}`, createdAt: now() });
    const lotM = await db.medicationLots.add({ serviceId: lisbonId, catalogId: lisMorph, lotNumber: `LOT-M-LIS-${u.unit}`, serialNumber: `SN-LIS-M${u.unit}`, expirationDate: futureExpiry(120), qrCode6: `LM${String(u.unit).padStart(4, '0')}`, createdAt: now() });

    await db.inventoryItems.bulkAdd([
      { serviceId: lisbonId, catalogId: lisFent, lotId: lotF, locationId: u.narcBox, status: 'InStock', quantity: 2, qrCode6: `LF${String(u.unit).padStart(4, '0')}`, notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
      { serviceId: lisbonId, catalogId: lisMorph, lotId: lotM, locationId: u.narcBox, status: 'InStock', quantity: 2, qrCode6: `LM${String(u.unit).padStart(4, '0')}`, notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
      { serviceId: lisbonId, catalogId: lisEpi, locationId: u.triCountyBox, status: 'InStock', quantity: 4, qrCode6: `LE${String(u.unit).padStart(4, '0')}`, notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
      { serviceId: lisbonId, catalogId: lisNarcan, locationId: u.medBox, status: 'InStock', quantity: 3, qrCode6: `LN${String(u.unit).padStart(4, '0')}`, notes: '', isActive: true, lastCheckedAt: thirtyHoursAgo, createdAt: now() },
      { serviceId: lisbonId, catalogId: lisAlb, locationId: u.medBox, status: 'InStock', quantity: 8, qrCode6: `LA${String(u.unit).padStart(4, '0')}`, notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
      { serviceId: lisbonId, catalogId: lisAsp, locationId: u.medBox, status: 'InStock', quantity: 10, qrCode6: `LS${String(u.unit).padStart(4, '0')}`, notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
    ]);

    await db.locationExpectedContents.bulkAdd([
      { locationId: u.narcBox, catalogId: lisFent, expectedQuantity: 2 },
      { locationId: u.narcBox, catalogId: lisMorph, expectedQuantity: 2 },
      { locationId: u.triCountyBox, catalogId: lisEpi, expectedQuantity: 4 },
      { locationId: u.medBox, catalogId: lisNarcan, expectedQuantity: 4 },
    ]);
  }

  // ─── Metro EMS Station 1 (original baseline) ───────────────────────
  const catFent = await db.itemCatalogs.add({ serviceId: metroId, name: 'Fentanyl 100mcg', category: 'Controlled', isControlled: true, unit: 'vial', defaultParLevel: 4, isActive: true });
  const catMorph = await db.itemCatalogs.add({ serviceId: metroId, name: 'Morphine 10mg', category: 'Controlled', isControlled: true, unit: 'vial', defaultParLevel: 4, isActive: true });
  const catEpi = await db.itemCatalogs.add({ serviceId: metroId, name: 'Epinephrine 1mg', category: 'Emergency', isControlled: false, unit: 'ampule', defaultParLevel: 6, isActive: true });
  const catNarcan = await db.itemCatalogs.add({ serviceId: metroId, name: 'Naloxone 2mg', category: 'Emergency', isControlled: false, unit: 'vial', defaultParLevel: 4, isActive: true });
  const catAlb = await db.itemCatalogs.add({ serviceId: metroId, name: 'Albuterol 2.5mg', category: 'Respiratory', isControlled: false, unit: 'nebule', defaultParLevel: 10, isActive: true });
  const catAsp = await db.itemCatalogs.add({ serviceId: metroId, name: 'Aspirin 325mg', category: 'Cardiac', isControlled: false, unit: 'packet', defaultParLevel: 10, isActive: true });

  const locHQ = await db.locations.add({ serviceId: metroId, parentId: null, name: 'Station 1 HQ', type: 'Station', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const locUnit = await db.locations.add({ serviceId: metroId, parentId: locHQ, name: 'Unit 51', type: 'Unit', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const locCabinet = await db.locations.add({ serviceId: metroId, parentId: locUnit, name: 'Drug Cabinet', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const locBoxA = await db.locations.add({ serviceId: metroId, parentId: locCabinet, name: 'Drug Box A', type: 'DrugBox', sealed: true, sealId: 'S12345', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const locBoxB = await db.locations.add({ serviceId: metroId, parentId: locCabinet, name: 'Drug Box B', type: 'DrugBox', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: now() });
  const locStockRoom = await db.locations.add({ serviceId: metroId, parentId: locHQ, name: 'Stock Room', type: 'StockRoom', sealed: false, sealId: '', checkFrequencyHours: 48, isActive: true, createdAt: now() });

  const lotFent1 = await db.medicationLots.add({ serviceId: metroId, catalogId: catFent, lotNumber: 'LOT-F-2025-001', serialNumber: 'SN-F001', expirationDate: futureExpiry(20), qrCode6: 'MET001', createdAt: now() });
  const lotMorph1 = await db.medicationLots.add({ serviceId: metroId, catalogId: catMorph, lotNumber: 'LOT-M-2025-001', serialNumber: 'SN-M001', expirationDate: futureExpiry(90), qrCode6: 'MET002', createdAt: now() });

  await db.inventoryItems.bulkAdd([
    { serviceId: metroId, catalogId: catFent, lotId: lotFent1, locationId: locBoxA, status: 'InStock', quantity: 1, qrCode6: 'MET001', notes: '', isActive: true, lastCheckedAt: thirtyHoursAgo, createdAt: now() },
    { serviceId: metroId, catalogId: catMorph, lotId: lotMorph1, locationId: locBoxA, status: 'InStock', quantity: 1, qrCode6: 'MET002', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
    { serviceId: metroId, catalogId: catEpi, locationId: locBoxB, status: 'InStock', quantity: 3, qrCode6: 'MET003', notes: '', isActive: true, lastCheckedAt: thirtyHoursAgo, createdAt: now() },
    { serviceId: metroId, catalogId: catNarcan, locationId: locBoxB, status: 'InStock', quantity: 2, qrCode6: 'MET004', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
    { serviceId: metroId, catalogId: catAlb, locationId: locCabinet, status: 'InStock', quantity: 8, qrCode6: 'MET005', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
    { serviceId: metroId, catalogId: catAsp, locationId: locStockRoom, status: 'InStock', quantity: 20, qrCode6: 'MET006', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: now() },
  ]);

  await db.locationExpectedContents.bulkAdd([
    { locationId: locBoxA, catalogId: catFent, expectedQuantity: 2 },
    { locationId: locBoxA, catalogId: catMorph, expectedQuantity: 2 },
    { locationId: locBoxB, catalogId: catEpi, expectedQuantity: 4 },
    { locationId: locBoxB, catalogId: catNarcan, expectedQuantity: 2 },
  ]);

  await writeAuditEvent(mc1Id, adminUserId, 'DATA_SEEDED', 'System', 0, 'Demo data seeded');
}
