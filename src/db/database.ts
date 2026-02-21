import Dexie, { type Table } from 'dexie';
import type {
  Company, Service, User, ServiceMembership, Vendor,
  ItemCatalog, MedicationLot, InventoryItem, Location, LocationExpectedContent,
  Order, OrderLine, Transfer, CheckSession, CheckLine,
  AdministrationRecord, WasteRecord, WitnessSignature,
  DiscrepancyCase, AuditEvent, Settings,
} from './types';

export class MedTrackerDB extends Dexie {
  companies!: Table<Company, number>;
  services!: Table<Service, number>;
  users!: Table<User, number>;
  serviceMemberships!: Table<ServiceMembership, number>;
  vendors!: Table<Vendor, number>;
  itemCatalogs!: Table<ItemCatalog, number>;
  medicationLots!: Table<MedicationLot, number>;
  inventoryItems!: Table<InventoryItem, number>;
  locations!: Table<Location, number>;
  locationExpectedContents!: Table<LocationExpectedContent, number>;
  orders!: Table<Order, number>;
  orderLines!: Table<OrderLine, number>;
  transfers!: Table<Transfer, number>;
  checkSessions!: Table<CheckSession, number>;
  checkLines!: Table<CheckLine, number>;
  administrationRecords!: Table<AdministrationRecord, number>;
  wasteRecords!: Table<WasteRecord, number>;
  witnessSignatures!: Table<WitnessSignature, number>;
  discrepancyCases!: Table<DiscrepancyCase, number>;
  auditEvents!: Table<AuditEvent, number>;
  settings!: Table<Settings, number>;

  constructor() {
    super('MedTrackerDB');
    this.version(1).stores({
      companies: '++id, name',
      services: '++id, companyId, name',
      users: '++id, &email',
      serviceMemberships: '++id, userId, serviceId, [userId+serviceId]',
      vendors: '++id, serviceId, name',
      itemCatalogs: '++id, serviceId, name, category',
      medicationLots: '++id, serviceId, catalogId, qrCode6, lotNumber',
      inventoryItems: '++id, serviceId, catalogId, locationId, status, qrCode6',
      locations: '++id, serviceId, parentId, name, type',
      locationExpectedContents: '++id, locationId, catalogId',
      orders: '++id, serviceId, vendorId, status, createdBy',
      orderLines: '++id, orderId, catalogId',
      transfers: '++id, serviceId, itemId, fromLocationId, toLocationId',
      checkSessions: '++id, serviceId, locationId, checkedBy',
      checkLines: '++id, sessionId, itemId',
      administrationRecords: '++id, serviceId, itemId, administeredBy',
      wasteRecords: '++id, administrationId, wastedBy',
      witnessSignatures: '++id, relatedType, relatedId, witnessUserId',
      discrepancyCases: '++id, serviceId, itemId, status',
      auditEvents: '++id, serviceId, userId, eventType, entityType, timestamp',
      settings: '++id, serviceId, key',
    });
    this.version(2).stores({
      auditEvents: '++id, serviceId, userId, eventType, entityType, timestamp, [entityType+entityId]',
    });
  }
}

export const db = new MedTrackerDB();
