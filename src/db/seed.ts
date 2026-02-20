import { db } from './database';
import { writeAuditEvent } from './audit';

export async function seedDemoData() {
  await db.delete();
  await db.open();

  // Company
  const companyId = await db.companies.add({ name: 'Metro EMS Corp', isActive: true, createdAt: new Date().toISOString() });

  // Services
  const svc1Id = await db.services.add({ companyId, name: 'Metro EMS Station 1', isActive: true, createdAt: new Date().toISOString() });
  const svc2Id = await db.services.add({ companyId, name: 'Metro EMS Station 2', isActive: true, createdAt: new Date().toISOString() });

  // Users – plaintext passwords for demo only; never use in production
  const demoUserId = await db.users.add({ email: 'demo@medtracker.app', passwordHash: 'demo1234', firstName: 'Jane', lastName: 'Doe', isActive: true, createdAt: new Date().toISOString() });
  const adminUserId = await db.users.add({ email: 'admin@medtracker.app', passwordHash: 'admin1234', firstName: 'Admin', lastName: 'User', isActive: true, createdAt: new Date().toISOString() });
  const driverUserId = await db.users.add({ email: 'driver@medtracker.app', passwordHash: 'driver1234', firstName: 'Mike', lastName: 'Smith', isActive: true, createdAt: new Date().toISOString() });

  // Service Memberships
  await db.serviceMemberships.bulkAdd([
    { userId: demoUserId, serviceId: svc1Id, role: 'Paramedic', isActive: true, createdAt: new Date().toISOString() },
    { userId: demoUserId, serviceId: svc2Id, role: 'Supervisor', isActive: true, createdAt: new Date().toISOString() },
    { userId: adminUserId, serviceId: svc1Id, role: 'SystemAdmin', isActive: true, createdAt: new Date().toISOString() },
    { userId: adminUserId, serviceId: svc2Id, role: 'SystemAdmin', isActive: true, createdAt: new Date().toISOString() },
    { userId: driverUserId, serviceId: svc1Id, role: 'Driver', isActive: true, createdAt: new Date().toISOString() },
  ]);

  // Vendor
  const vendorId = await db.vendors.add({ serviceId: svc1Id, name: 'MedSupply Direct', contactInfo: 'orders@medsupply.example.com', isActive: true });

  // Item Catalogs
  const catFent = await db.itemCatalogs.add({ serviceId: svc1Id, name: 'Fentanyl 100mcg', category: 'Controlled', isControlled: true, unit: 'vial', defaultParLevel: 4, isActive: true });
  const catMorph = await db.itemCatalogs.add({ serviceId: svc1Id, name: 'Morphine 10mg', category: 'Controlled', isControlled: true, unit: 'vial', defaultParLevel: 4, isActive: true });
  const catEpi = await db.itemCatalogs.add({ serviceId: svc1Id, name: 'Epinephrine 1mg', category: 'Emergency', isControlled: false, unit: 'ampule', defaultParLevel: 6, isActive: true });
  const catNarcan = await db.itemCatalogs.add({ serviceId: svc1Id, name: 'Naloxone 2mg', category: 'Emergency', isControlled: false, unit: 'vial', defaultParLevel: 4, isActive: true });
  const catAlb = await db.itemCatalogs.add({ serviceId: svc1Id, name: 'Albuterol 2.5mg', category: 'Respiratory', isControlled: false, unit: 'nebule', defaultParLevel: 10, isActive: true });
  const catAsp = await db.itemCatalogs.add({ serviceId: svc1Id, name: 'Aspirin 325mg', category: 'Cardiac', isControlled: false, unit: 'packet', defaultParLevel: 10, isActive: true });

  // Locations (nested)
  const locHQ = await db.locations.add({ serviceId: svc1Id, parentId: null, name: 'Station 1 HQ', type: 'Station', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: new Date().toISOString() });
  const locUnit = await db.locations.add({ serviceId: svc1Id, parentId: locHQ, name: 'Unit 51', type: 'Unit', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: new Date().toISOString() });
  const locCabinet = await db.locations.add({ serviceId: svc1Id, parentId: locUnit, name: 'Drug Cabinet', type: 'Cabinet', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: new Date().toISOString() });
  const locBoxA = await db.locations.add({ serviceId: svc1Id, parentId: locCabinet, name: 'Drug Box A', type: 'DrugBox', sealed: true, sealId: 'S12345', checkFrequencyHours: 24, isActive: true, createdAt: new Date().toISOString() });
  const locBoxB = await db.locations.add({ serviceId: svc1Id, parentId: locCabinet, name: 'Drug Box B', type: 'DrugBox', sealed: false, sealId: '', checkFrequencyHours: 24, isActive: true, createdAt: new Date().toISOString() });
  const locStockRoom = await db.locations.add({ serviceId: svc1Id, parentId: locHQ, name: 'Stock Room', type: 'StockRoom', sealed: false, sealId: '', checkFrequencyHours: 48, isActive: true, createdAt: new Date().toISOString() });

  // Medication Lots
  const MS_PER_DAY = 86400000;
  const MS_PER_HOUR = 3600000;
  const lotFent1 = await db.medicationLots.add({ serviceId: svc1Id, catalogId: catFent, lotNumber: 'LOT-F-2025-001', serialNumber: 'SN-F001', expirationDate: new Date(Date.now() + 20 * MS_PER_DAY).toISOString().split('T')[0], qrCode6: 'FNT001', createdAt: new Date().toISOString() });
  const lotMorph1 = await db.medicationLots.add({ serviceId: svc1Id, catalogId: catMorph, lotNumber: 'LOT-M-2025-001', serialNumber: 'SN-M001', expirationDate: new Date(Date.now() + 90 * MS_PER_DAY).toISOString().split('T')[0], qrCode6: 'MRP001', createdAt: new Date().toISOString() });

  const thirtyHoursAgo = new Date(Date.now() - 30 * MS_PER_HOUR).toISOString();
  const recentCheck = new Date(Date.now() - 2 * MS_PER_HOUR).toISOString();

  // Inventory Items
  await db.inventoryItems.bulkAdd([
    { serviceId: svc1Id, catalogId: catFent, lotId: lotFent1, locationId: locBoxA, status: 'InStock', quantity: 1, qrCode6: 'FNT001', notes: '', isActive: true, lastCheckedAt: thirtyHoursAgo, createdAt: new Date().toISOString() },
    { serviceId: svc1Id, catalogId: catMorph, lotId: lotMorph1, locationId: locBoxA, status: 'InStock', quantity: 1, qrCode6: 'MRP001', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: new Date().toISOString() },
    { serviceId: svc1Id, catalogId: catEpi, locationId: locBoxB, status: 'InStock', quantity: 3, qrCode6: 'EPI001', notes: '', isActive: true, lastCheckedAt: thirtyHoursAgo, createdAt: new Date().toISOString() },
    { serviceId: svc1Id, catalogId: catNarcan, locationId: locBoxB, status: 'InStock', quantity: 2, qrCode6: 'NRC001', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: new Date().toISOString() },
    { serviceId: svc1Id, catalogId: catAlb, locationId: locCabinet, status: 'InStock', quantity: 8, qrCode6: 'ALB001', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: new Date().toISOString() },
    { serviceId: svc1Id, catalogId: catAsp, locationId: locStockRoom, status: 'InStock', quantity: 20, qrCode6: 'ASP001', notes: '', isActive: true, lastCheckedAt: recentCheck, createdAt: new Date().toISOString() },
  ]);

  // Expected contents
  await db.locationExpectedContents.bulkAdd([
    { locationId: locBoxA, catalogId: catFent, expectedQuantity: 2 },
    { locationId: locBoxA, catalogId: catMorph, expectedQuantity: 2 },
    { locationId: locBoxB, catalogId: catEpi, expectedQuantity: 4 },
    { locationId: locBoxB, catalogId: catNarcan, expectedQuantity: 2 },
  ]);

  await writeAuditEvent(svc1Id, adminUserId, 'DATA_SEEDED', 'System', 0, 'Demo data seeded');
}
