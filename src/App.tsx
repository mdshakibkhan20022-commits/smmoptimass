import { useEffect, type ReactNode } from 'react';
import { AppProvider } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { usePath } from '@/lib/router';
import { LoadingBlock, PageHeader } from '@/components/ui';
import { PanelLayout } from '@/components/PanelLayout';
import { ServicesTable } from '@/components/ServicesTable';
import { LandingPage } from '@/pages/LandingPage';
import { LegalPage, PublicApiPage, PublicServicesPage } from '@/pages/PublicPages';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from '@/pages/AuthPages';
import { NewOrderPage } from '@/pages/panel/NewOrderPage';
import { MassOrderPage } from '@/pages/panel/MassOrderPage';
import { OrdersPage } from '@/pages/panel/OrdersPage';
import { AddFundsPage } from '@/pages/panel/AddFundsPage';
import { TicketsPage } from '@/pages/panel/TicketsPage';
import { DashboardPage, UpdatesPage } from '@/pages/panel/DashboardPage';
import { AccountPage, AffiliatesPage, PanelApiPage } from '@/pages/panel/AccountPages';
import { AdminGate } from '@/pages/admin/AdminLayout';
import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage';
import { AdminServicesPage } from '@/pages/admin/AdminServicesPage';
import { AdminProvidersPage } from '@/pages/admin/AdminProvidersPage';
import { AdminPaymentsPage } from '@/pages/admin/AdminPaymentsPage';
import { AdminTicketsPage } from '@/pages/admin/AdminTicketsPage';
import { AdminAnnouncementsPage } from '@/pages/admin/AdminAnnouncementsPage';
import { AdminEmailPage } from '@/pages/admin/AdminEmailPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';

function PanelServicesPage() {
  return (
    <div>
      <PageHeader title="Services" subtitle="All services with prices per 1000. Click a service to order it." />
      <ServicesTable orderable />
    </div>
  );
}

const PANEL: Record<string, () => JSX.Element> = {
  '/new-order': NewOrderPage,
  '/mass-order': MassOrderPage,
  '/orders': OrdersPage,
  '/add-funds': AddFundsPage,
  '/tickets': TicketsPage,
  '/services': PanelServicesPage,
  '/dashboard': DashboardPage,
  '/updates': UpdatesPage,
  '/affiliates': AffiliatesPage,
  '/api': PanelApiPage,
  '/account': AccountPage,
};

const ADMIN: Record<string, () => JSX.Element> = {
  '/admin': AdminOverviewPage,
  '/admin/users': AdminUsersPage,
  '/admin/orders': AdminOrdersPage,
  '/admin/services': AdminServicesPage,
  '/admin/providers': AdminProvidersPage,
  '/admin/payments': AdminPaymentsPage,
  '/admin/tickets': AdminTicketsPage,
  '/admin/announcements': AdminAnnouncementsPage,
  '/admin/email': AdminEmailPage,
  '/admin/settings': AdminSettingsPage,
};

const PUBLIC: Record<string, () => JSX.Element> = {
  '/': LandingPage,
  '/login': LoginPage,
  '/signup': SignupPage,
  '/forgot-password': ForgotPasswordPage,
  '/reset-password': ResetPasswordPage,
  '/terms': () => <LegalPage page="terms" />,
  '/privacy': () => <LegalPage page="privacy" />,
  '/refund-policy': () => <LegalPage page="refund-policy" />,
};

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    window.history.replaceState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [to]);
  return null;
}

function FullPageLoader() {
  return <div className="flex min-h-screen items-center justify-center"><LoadingBlock /></div>;
}

function Panel({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!session) return <Redirect to="/login" />;
  return <PanelLayout>{children}</PanelLayout>;
}

function Routes() {
  const raw = usePath();
  const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
  const { session, loading } = useAuth();

  if (path === '/admin' || path.startsWith('/admin/')) {
    const Page = ADMIN[path];
    if (!Page) return <Redirect to="/admin" />;
    return <AdminGate><Page /></AdminGate>;
  }

  if ((path === '/services' || path === '/api') && !session) {
    if (loading) return <FullPageLoader />;
    return path === '/services' ? <PublicServicesPage /> : <PublicApiPage />;
  }

  const PanelPage = PANEL[path];
  if (PanelPage) return <Panel><PanelPage /></Panel>;

  if ((path === '/login' || path === '/signup') && session) return <Redirect to="/new-order" />;

  const PublicPage = PUBLIC[path];
  if (PublicPage) return <PublicPage />;
  return <Redirect to="/" />;
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes />
        </ToastProvider>
      </AuthProvider>
    </AppProvider>
  );
}
