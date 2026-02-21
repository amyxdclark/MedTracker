export type Role = 'SystemAdmin' | 'CompanyAdmin' | 'Supervisor' | 'Paramedic' | 'AdvancedEMT' | 'EMT' | 'Driver';

export type ItemStatus = 'InStock' | 'Administered' | 'Wasted' | 'Expired' | 'Lost' | 'Transferred' | 'Damaged';
export type OrderStatus = 'Draft' | 'Submitted' | 'PartiallyReceived' | 'Received' | 'Cancelled';
export type ComplianceStatus = 'OK' | 'DueSoon' | 'Overdue';
export type DiscrepancyStatus = 'Open' | 'Investigating' | 'Resolved';

export type AuditEventType =
  | 'USER_LOGIN' | 'USER_LOGOUT' | 'SERVICE_SWITCH'
  | 'ORDER_CREATED' | 'ORDER_SUBMITTED' | 'ORDER_RECEIVED' | 'ORDER_LINE_RECEIVED'
  | 'ITEM_CREATED' | 'ITEM_UPDATED' | 'ITEM_DEACTIVATED'
  | 'ITEM_TRANSFERRED' | 'ITEM_ADMINISTERED' | 'ITEM_WASTED' | 'ITEM_EXPIRED_EXCHANGE'
  | 'LOCATION_CREATED' | 'LOCATION_UPDATED'
  | 'CHECK_SESSION_STARTED' | 'CHECK_SEAL_VERIFIED' | 'CHECK_ITEM_VERIFIED' | 'CHECK_SESSION_COMPLETED'
  | 'WASTE_WITNESSED' | 'CORRECTION_MADE'
  | 'DISCREPANCY_OPENED' | 'DISCREPANCY_RESOLVED'
  | 'INCIDENT_CREATED' | 'INCIDENT_ITEM_ADDED' | 'INCIDENT_CLOSED'
  | 'DATA_EXPORTED' | 'DATA_IMPORTED' | 'DATA_RESET' | 'DATA_SEEDED';

export interface Company {
  id?: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface Service {
  id?: number;
  companyId: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id?: number;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
}

export interface ServiceMembership {
  id?: number;
  userId: number;
  serviceId: number;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Vendor {
  id?: number;
  serviceId: number;
  name: string;
  contactInfo: string;
  isActive: boolean;
}

export interface ItemCatalog {
  id?: number;
  serviceId: number;
  name: string;
  category: string;
  isControlled: boolean;
  unit: string;
  defaultParLevel: number;
  isActive: boolean;
}

export interface MedicationLot {
  id?: number;
  serviceId: number;
  catalogId: number;
  lotNumber: string;
  serialNumber: string;
  expirationDate: string;
  qrCode6: string;
  createdAt: string;
}

export interface InventoryItem {
  id?: number;
  serviceId: number;
  catalogId: number;
  lotId?: number;
  locationId: number;
  status: ItemStatus;
  quantity: number;
  qrCode6: string;
  notes: string;
  isActive: boolean;
  lastCheckedAt: string;
  createdAt: string;
}

export interface Location {
  id?: number;
  serviceId: number;
  parentId: number | null;
  name: string;
  type: string;
  sealed: boolean;
  sealId: string;
  checkFrequencyHours: number;
  isActive: boolean;
  createdAt: string;
}

export interface LocationExpectedContent {
  id?: number;
  locationId: number;
  catalogId: number;
  expectedQuantity: number;
}

export interface Order {
  id?: number;
  serviceId: number;
  vendorId: number;
  status: OrderStatus;
  orderDate: string;
  notes: string;
  createdBy: number;
  createdAt: string;
}

export interface OrderLine {
  id?: number;
  orderId: number;
  catalogId: number;
  quantityOrdered: number;
  quantityReceived: number;
}

export interface Transfer {
  id?: number;
  serviceId: number;
  itemId: number;
  fromLocationId: number;
  toLocationId: number;
  transferredBy: number;
  transferredAt: string;
  notes: string;
}

export interface CheckSession {
  id?: number;
  serviceId: number;
  locationId: number;
  checkedBy: number;
  sealVerified: boolean;
  startedAt: string;
  completedAt: string;
  notes: string;
}

export interface CheckLine {
  id?: number;
  sessionId: number;
  itemId: number;
  verified: boolean;
  notes: string;
}

export interface AdministrationRecord {
  id?: number;
  serviceId: number;
  itemId: number;
  administeredBy: number;
  patientId: string;
  doseGiven: number;
  doseUnit: string;
  doseWasted: number;
  route: string;
  administeredAt: string;
  notes: string;
}

export interface WasteRecord {
  id?: number;
  administrationId: number;
  amountWasted: number;
  wastedBy: number;
  wastedAt: string;
  method: string;
  notes: string;
}

export interface WitnessSignature {
  id?: number;
  relatedType: string;
  relatedId: number;
  witnessUserId: number;
  witnessedAt: string;
  witnessEmail: string;
}

export interface DiscrepancyCase {
  id?: number;
  serviceId: number;
  itemId: number;
  status: DiscrepancyStatus;
  description: string;
  resolution: string;
  openedBy: number;
  openedAt: string;
  resolvedBy?: number;
  resolvedAt?: string;
}

export interface AuditEvent {
  id?: number;
  serviceId: number;
  userId: number;
  eventType: AuditEventType;
  entityType: string;
  entityId: number;
  details: string;
  timestamp: string;
}

export interface Settings {
  id?: number;
  serviceId: number;
  key: string;
  value: string;
}

export type IncidentStatus = 'Open' | 'Closed';

export interface Incident {
  id?: number;
  serviceId: number;
  title: string;
  description: string;
  incidentDate: string;
  status: IncidentStatus;
  createdBy: number;
  createdAt: string;
  closedAt?: string;
}

export interface IncidentItem {
  id?: number;
  incidentId: number;
  itemId: number;
  quantityUsed: number;
  notes: string;
  addedBy: number;
  addedAt: string;
}
