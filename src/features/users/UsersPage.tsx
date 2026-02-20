import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users, Plus, Shield } from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { formatDateTime } from '@/utils/date';
import { Button, Card, Badge, Modal } from '@/components';
import type { Role } from '@/db/types';

const ROLES: Role[] = ['Driver', 'EMT', 'AdvancedEMT', 'Paramedic', 'Supervisor', 'CompanyAdmin', 'SystemAdmin'];

const roleBadgeVariant = (role: Role): 'ok' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (role === 'SystemAdmin' || role === 'CompanyAdmin') return 'danger';
  if (role === 'Supervisor') return 'warning';
  if (role === 'Paramedic' || role === 'AdvancedEMT') return 'info';
  return 'neutral';
};

export default function UsersPage() {
  const { currentUser, currentService, hasPermission } = useAuth();
  const serviceId = currentService?.id ?? 0;

  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  // Role assignment modal
  const [roleModalUserId, setRoleModalUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('EMT');

  const users = useLiveQuery(() => db.users.toArray(), []);
  const memberships = useLiveQuery(
    () => db.serviceMemberships.where('serviceId').equals(serviceId).toArray(),
    [serviceId],
  );
  const services = useLiveQuery(() => db.services.toArray(), []);

  const allMemberships = useLiveQuery(() => db.serviceMemberships.toArray(), []);

  if (!hasPermission('Supervisor')) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500">You need Supervisor or higher permissions to manage users.</p>
      </div>
    );
  }

  const getMembershipsForUser = (userId: number) =>
    (allMemberships ?? []).filter(m => m.userId === userId && m.isActive);

  const getServiceName = (svcId: number) =>
    (services ?? []).find(s => s.id === svcId)?.name ?? `Service #${svcId}`;

  const getUserRoleInService = (userId: number) =>
    (memberships ?? []).find(m => m.userId === userId && m.isActive);

  const handleAddUser = async () => {
    setFormError('');
    if (!email.trim() || !firstName.trim() || !lastName.trim() || !password.trim()) {
      setFormError('All fields are required.');
      return;
    }

    const existing = await db.users.where('email').equals(email.trim()).first();
    if (existing) {
      setFormError('A user with this email already exists.');
      return;
    }

    await db.users.add({
      email: email.trim(),
      passwordHash: password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    setEmail('');
    setFirstName('');
    setLastName('');
    setPassword('');
    setShowAddForm(false);
  };

  const handleAssignRole = async () => {
    if (!roleModalUserId) return;

    const existing = await db.serviceMemberships
      .where('[userId+serviceId]')
      .equals([roleModalUserId, serviceId])
      .first();

    if (existing) {
      await db.serviceMemberships.update(existing.id!, { role: selectedRole, isActive: true });
    } else {
      await db.serviceMemberships.add({
        userId: roleModalUserId,
        serviceId,
        role: selectedRole,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }

    setRoleModalUserId(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Users size={24} /> User Management
        </h1>
        <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowAddForm(!showAddForm)}>
          Add User
        </Button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">New User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {formError && <p className="text-red-600 text-sm mt-2">{formError}</p>}
          <div className="mt-3">
            <Button size="sm" onClick={handleAddUser}>Create User</Button>
          </div>
        </Card>
      )}

      {/* User List */}
      <div className="space-y-2">
        {(users ?? []).length === 0 && (
          <Card>
            <p className="text-slate-500 text-center py-4">No users found.</p>
          </Card>
        )}
        {(users ?? []).map(user => {
          const userMemberships = getMembershipsForUser(user.id!);
          const serviceRole = getUserRoleInService(user.id!);

          return (
            <Card key={user.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      {user.firstName} {user.lastName}
                    </span>
                    {!user.isActive && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-slate-500">{user.email}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {userMemberships.map(m => (
                      <Badge key={m.id} variant={roleBadgeVariant(m.role)}>
                        {getServiceName(m.serviceId)}: {m.role}
                      </Badge>
                    ))}
                    {userMemberships.length === 0 && (
                      <span className="text-xs text-slate-400">No service memberships</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Shield size={14} />}
                    onClick={() => {
                      setRoleModalUserId(user.id!);
                      setSelectedRole(serviceRole?.role ?? 'EMT');
                    }}
                  >
                    Role
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Role Assignment Modal */}
      <Modal
        open={roleModalUserId !== null}
        onClose={() => setRoleModalUserId(null)}
        title="Assign Role"
      >
        <p className="text-sm text-slate-600 mb-4">
          Set role for this user in <strong>{currentService?.name}</strong>.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value as Role)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleAssignRole}>Save Role</Button>
          <Button variant="secondary" onClick={() => setRoleModalUserId(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
