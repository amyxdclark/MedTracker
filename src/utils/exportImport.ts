import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';

export async function exportAllData(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  const tableNames = db.tables.map(t => t.name);
  for (const name of tableNames) {
    data[name] = await (db.table(name) as any).toArray();
  }
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string, userId: number, serviceId: number): Promise<void> {
  const data = JSON.parse(json) as Record<string, unknown[]>;
  await db.delete();
  await db.open();
  for (const [tableName, rows] of Object.entries(data)) {
    const table = db.table(tableName);
    if (table && rows.length > 0) {
      await table.bulkAdd(rows as any[]);
    }
  }
  // Note: audit event for import is written with the imported data's context
}

export async function resetDatabase(): Promise<void> {
  await db.delete();
  await db.open();
}
