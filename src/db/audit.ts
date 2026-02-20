import { db } from './database';
import type { AuditEventType } from './types';

export async function writeAuditEvent(
  serviceId: number,
  userId: number,
  eventType: AuditEventType,
  entityType: string,
  entityId: number,
  details: string
) {
  await db.auditEvents.add({
    serviceId,
    userId,
    eventType,
    entityType,
    entityId,
    details,
    timestamp: new Date().toISOString(),
  });
}
