import type { ComplianceStatus } from '@/db/types';

export function getComplianceStatus(lastCheckedAt: string, checkFrequencyHours: number): ComplianceStatus {
  const lastCheck = new Date(lastCheckedAt).getTime();
  const now = Date.now();
  const elapsed = (now - lastCheck) / (1000 * 60 * 60);
  const threshold = checkFrequencyHours;
  
  if (elapsed >= threshold) return 'Overdue';
  if (elapsed >= threshold * 0.75) return 'DueSoon';
  return 'OK';
}

export function getExpirationStatus(expirationDate: string): ComplianceStatus {
  const exp = new Date(expirationDate).getTime();
  const now = Date.now();
  const daysUntil = (exp - now) / (1000 * 60 * 60 * 24);
  
  if (daysUntil <= 0) return 'Overdue';
  if (daysUntil <= 30) return 'DueSoon';
  return 'OK';
}

export function complianceBadgeVariant(status: ComplianceStatus) {
  switch (status) {
    case 'OK': return 'ok' as const;
    case 'DueSoon': return 'warning' as const;
    case 'Overdue': return 'danger' as const;
  }
}
