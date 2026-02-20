import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import type { Service } from '@/db';
import {
  Home, QrCode, Search, Package, MapPin, ClipboardCheck,
  ShoppingCart, ArrowRightLeft, BarChart3, Settings as SettingsIcon,
  Users, Shield, Menu, X, Bell, ChevronDown, LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/scan', label: 'Scan', icon: QrCode },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/locations', label: 'Locations', icon: MapPin },
  { to: '/checks', label: 'Checks', icon: ClipboardCheck },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/transfers/new', label: 'Transfers', icon: ArrowRightLeft },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Layout() {
  const { currentUser, currentService, currentRole, memberships, logout, selectService } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [serviceSwitcherOpen, setServiceSwitcherOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const serviceSwitcherRef = useRef<HTMLDivElement>(null);

  // Load service names for membership switcher
  const serviceIds = memberships.map(m => m.serviceId);
  const services = useLiveQuery(
    () => serviceIds.length > 0
      ? db.services.where('id').anyOf(serviceIds).toArray()
      : Promise.resolve([] as Service[]),
    [serviceIds.join(',')],
  );

  const serviceMap = new Map(services?.map(s => [s.id!, s]) ?? []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (serviceSwitcherRef.current && !serviceSwitcherRef.current.contains(e.target as Node)) {
        setServiceSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allNav = [
    ...navItems,
    ...(currentRole && ['SystemAdmin', 'CompanyAdmin', 'Supervisor'].includes(currentRole)
      ? [{ to: '/users', label: 'Users', icon: Users }]
      : []),
    ...(currentRole === 'SystemAdmin'
      ? [{ to: '/system', label: 'System', icon: Shield }]
      : []),
  ];

  const handleServiceSwitch = async (serviceId: number) => {
    await selectService(serviceId);
    setServiceSwitcherOpen(false);
    navigate('/home');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-200">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            M+
          </div>
          <span className="font-bold text-lg text-slate-900">MedTracker</span>
          <button
            className="lg:hidden ml-auto p-1"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="p-2 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {allNav.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* Service switcher */}
          <div className="relative" ref={serviceSwitcherRef}>
            <button
              onClick={() => memberships.length > 1 && setServiceSwitcherOpen(!serviceSwitcherOpen)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100"
            >
              {currentService?.name ?? 'Select Service'}
              {memberships.length > 1 && <ChevronDown size={14} />}
            </button>
            {serviceSwitcherOpen && memberships.length > 1 && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px] z-50">
                {memberships.map(m => {
                  const svc = serviceMap.get(m.serviceId);
                  return (
                    <button
                      key={m.serviceId}
                      onClick={() => handleServiceSwitch(m.serviceId)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      {svc?.name ?? `Service #${m.serviceId}`}
                      <span className="ml-2 text-xs text-slate-400">({m.role})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <Link to="/search" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Search">
            <Search size={20} />
          </Link>
          <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 relative" aria-label="Notifications">
            <Bell size={20} />
          </button>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {userMenuOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px] z-50">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium">{currentUser?.firstName} {currentUser?.lastName}</p>
                  <p className="text-xs text-slate-500">{currentRole}</p>
                </div>
                <button
                  onClick={async () => {
                    await logout();
                    setUserMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
