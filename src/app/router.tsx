import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { AppLayout } from '@/shared/ui/AppLayout';
import { LoginPage } from '@/pages/login/LoginPage';
import { HomePage } from '@/pages/home/HomePage';
import { InvoicesPage } from '@/pages/invoices/InvoicesPage';
import { TransactionsPage } from '@/pages/transactions/TransactionsPage';
import { ClientsPage } from '@/pages/clients/ClientsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
