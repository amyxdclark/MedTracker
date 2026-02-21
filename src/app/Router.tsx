import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/auth';
import { Layout } from './Layout';
import { ErrorPage } from './ErrorPage';

// Placeholder for pages not yet built
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-4">{title}</h1>
      <p className="text-slate-400">This page is under construction.</p>
    </div>
  );
}

// Lazy-loaded page wrappers
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const SelectServicePage = lazy(() => import('@/features/auth/SelectServicePage'));
const HomePage = lazy(() => import('@/features/home/HomePage'));
const ScanPage = lazy(() => import('@/features/scan/ScanPage'));
const SearchPage = lazy(() => import('@/features/search/SearchPage'));
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage'));
const InventoryDetailPage = lazy(() => import('@/features/inventory/InventoryDetailPage'));
const LocationsPage = lazy(() => import('@/features/locations/LocationsPage'));
const LocationDetailPage = lazy(() => import('@/features/locations/LocationDetailPage'));
const ChecksPage = lazy(() => import('@/features/checks/ChecksPage'));
const OrdersPage = lazy(() => import('@/features/orders/OrdersPage'));
const NewOrderPage = lazy(() => import('@/features/orders/NewOrderPage'));
const OrderDetailPage = lazy(() => import('@/features/orders/OrderDetailPage'));
const AdministerPage = lazy(() => import('@/features/administer/AdministerPage'));
const WastePage = lazy(() => import('@/features/waste/WastePage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const UsersPage = lazy(() => import('@/features/users/UsersPage'));
const NewTransferPage = lazy(() => import('@/features/transfers/NewTransferPage'));
const ExpiredExchangePage = lazy(() => import('@/features/expired/ExpiredExchangePage'));
const DiscrepanciesPage = lazy(() => import('@/features/discrepancies/DiscrepanciesPage'));
const BillingPage = lazy(() => import('@/features/billing/BillingPage'));
const SystemPage = lazy(() => import('@/features/system/SystemPage'));
const HelpPage = lazy(() => import('@/features/help/HelpPage'));
const IncidentsPage = lazy(() => import('@/features/incidents/IncidentsPage'));
const NewIncidentPage = lazy(() => import('@/features/incidents/NewIncidentPage'));
const IncidentDetailPage = lazy(() => import('@/features/incidents/IncidentDetailPage'));

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400 text-sm">Loading…</div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const router = createBrowserRouter(
  [
    {
      path: '/login',
      element: <SuspenseWrapper><LoginPage /></SuspenseWrapper>,
      errorElement: <ErrorPage />,
    },
    {
      path: '/select-service',
      element: <SuspenseWrapper><SelectServicePage /></SuspenseWrapper>,
      errorElement: <ErrorPage />,
    },
    {
      element: <RequireAuth />,
      errorElement: <ErrorPage />,
      children: [
        {
          element: <Layout />,
          errorElement: <ErrorPage />,
          children: [
            { path: '/home', element: <SuspenseWrapper><HomePage /></SuspenseWrapper> },
            { path: '/scan', element: <SuspenseWrapper><ScanPage /></SuspenseWrapper> },
            { path: '/search', element: <SuspenseWrapper><SearchPage /></SuspenseWrapper> },
            { path: '/inventory', element: <SuspenseWrapper><InventoryPage /></SuspenseWrapper> },
            { path: '/inventory/:id', element: <SuspenseWrapper><InventoryDetailPage /></SuspenseWrapper> },
            { path: '/locations', element: <SuspenseWrapper><LocationsPage /></SuspenseWrapper> },
            { path: '/locations/:id', element: <SuspenseWrapper><LocationDetailPage /></SuspenseWrapper> },
            { path: '/checks', element: <SuspenseWrapper><ChecksPage /></SuspenseWrapper> },
            { path: '/orders', element: <SuspenseWrapper><OrdersPage /></SuspenseWrapper> },
            { path: '/orders/new', element: <SuspenseWrapper><NewOrderPage /></SuspenseWrapper> },
            { path: '/orders/:id', element: <SuspenseWrapper><OrderDetailPage /></SuspenseWrapper> },
            { path: '/transfers/new', element: <SuspenseWrapper><NewTransferPage /></SuspenseWrapper> },
            { path: '/administer/new', element: <SuspenseWrapper><AdministerPage /></SuspenseWrapper> },
            { path: '/waste/new', element: <SuspenseWrapper><WastePage /></SuspenseWrapper> },
            { path: '/expired-exchange/new', element: <SuspenseWrapper><ExpiredExchangePage /></SuspenseWrapper> },
            { path: '/discrepancies', element: <SuspenseWrapper><DiscrepanciesPage /></SuspenseWrapper> },
            { path: '/reports', element: <SuspenseWrapper><ReportsPage /></SuspenseWrapper> },
            { path: '/settings', element: <SuspenseWrapper><SettingsPage /></SuspenseWrapper> },
            { path: '/users', element: <SuspenseWrapper><UsersPage /></SuspenseWrapper> },
            { path: '/billing', element: <SuspenseWrapper><BillingPage /></SuspenseWrapper> },
            { path: '/system', element: <SuspenseWrapper><SystemPage /></SuspenseWrapper> },
            { path: '/help', element: <SuspenseWrapper><HelpPage /></SuspenseWrapper> },
            { path: '/incidents', element: <SuspenseWrapper><IncidentsPage /></SuspenseWrapper> },
            { path: '/incidents/new', element: <SuspenseWrapper><NewIncidentPage /></SuspenseWrapper> },
            { path: '/incidents/:id', element: <SuspenseWrapper><IncidentDetailPage /></SuspenseWrapper> },
            { path: '*', element: <Navigate to="/home" replace /> },
          ],
        },
      ],
    },
    { path: '*', element: <Navigate to="/login" replace />, errorElement: <ErrorPage /> },
  ],
  { basename: '/MedTracker/' },
);

export function Router() {
  return <RouterProvider router={router} />;
}
