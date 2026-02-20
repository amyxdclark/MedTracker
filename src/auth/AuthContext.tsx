import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db } from '@/db/database';
import { writeAuditEvent } from '@/db/audit';
import type { User, Service, ServiceMembership, Role } from '@/db/types';

const ROLE_HIERARCHY: Role[] = [
  'Driver',
  'EMT',
  'AdvancedEMT',
  'Paramedic',
  'Supervisor',
  'CompanyAdmin',
  'SystemAdmin',
];

interface AuthContextType {
  currentUser: User | null;
  currentService: Service | null;
  currentRole: Role | null;
  memberships: ServiceMembership[];
  login(email: string, password: string): Promise<boolean>;
  logout(): Promise<void>;
  selectService(serviceId: number): Promise<void>;
  hasPermission(minRole: Role): boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentService, setCurrentService] = useState<Service | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [memberships, setMemberships] = useState<ServiceMembership[]>([]);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    const restore = async () => {
      const storedId = localStorage.getItem('userId');
      if (storedId) {
        const user = await db.users.get(Number(storedId));
        if (user) {
          setCurrentUser(user);
          const ms = await db.serviceMemberships
            .where('userId')
            .equals(user.id!)
            .filter((m) => m.isActive)
            .toArray();
          setMemberships(ms);

          const storedSvcId = localStorage.getItem('serviceId');
          const autoMembership = ms.length === 1 ? ms[0] : storedSvcId ? ms.find(m => m.serviceId === Number(storedSvcId)) : undefined;
          if (autoMembership) {
            const svc = await db.services.get(autoMembership.serviceId);
            if (svc) {
              setCurrentService(svc);
              setCurrentRole(autoMembership.role);
            }
          }
        }
      }
      setLoading(false);
    };
    restore();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const user = await db.users.where('email').equals(email).first();
    if (!user || user.passwordHash !== password || !user.isActive) return false;

    localStorage.setItem('userId', String(user.id));
    setCurrentUser(user);

    const ms = await db.serviceMemberships
      .where('userId')
      .equals(user.id!)
      .filter((m) => m.isActive)
      .toArray();
    setMemberships(ms);

    if (ms.length === 1) {
      const svc = await db.services.get(ms[0].serviceId);
      if (svc) {
        setCurrentService(svc);
        setCurrentRole(ms[0].role);
        await writeAuditEvent(svc.id!, user.id!, 'USER_LOGIN', 'User', user.id!, `User logged in`);
      }
    } else {
      await writeAuditEvent(0, user.id!, 'USER_LOGIN', 'User', user.id!, `User logged in`);
    }

    return true;
  }, []);

  const logout = useCallback(async () => {
    if (currentUser) {
      await writeAuditEvent(
        currentService?.id ?? 0,
        currentUser.id!,
        'USER_LOGOUT',
        'User',
        currentUser.id!,
        'User logged out'
      );
    }
    localStorage.removeItem('userId');
    localStorage.removeItem('serviceId');
    setCurrentUser(null);
    setCurrentService(null);
    setCurrentRole(null);
    setMemberships([]);
  }, [currentUser, currentService]);

  const selectService = useCallback(
    async (serviceId: number) => {
      const membership = memberships.find((m) => m.serviceId === serviceId);
      if (!membership) return;
      const svc = await db.services.get(serviceId);
      if (!svc) return;
      localStorage.setItem('serviceId', String(serviceId));
      setCurrentService(svc);
      setCurrentRole(membership.role);
    },
    [memberships]
  );

  const hasPermission = useCallback(
    (minRole: Role): boolean => {
      if (!currentRole) return false;
      return ROLE_HIERARCHY.indexOf(currentRole) >= ROLE_HIERARCHY.indexOf(minRole);
    },
    [currentRole]
  );

  if (loading) return null;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentService,
        currentRole,
        memberships,
        login,
        logout,
        selectService,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
