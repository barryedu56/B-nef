import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConsoleLayout } from '@/components/layout/ConsoleLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AuthProvider } from '@/context/AuthContext';
import { ActivitiesPage } from '@/pages/ActivitiesPage';
import { ActivityDetailPage } from '@/pages/ActivityDetailPage';
import { BudgetsPage } from '@/pages/BudgetsPage';
import { RecurringPage } from '@/pages/RecurringPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { DeleteAccountInfoPage, PrivacyPage } from '@/pages/LegalPages';
import { LoginPage } from '@/pages/LoginPage';
import { MoneyPage } from '@/pages/MoneyPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { PartiesPage } from '@/pages/PartiesPage';
import { PartyDetailPage } from '@/pages/PartyDetailPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { ConsoleDashboardPage } from '@/pages/console/ConsoleDashboardPage';
import { ConsoleHealthPage } from '@/pages/console/ConsoleHealthPage';
import { ConsoleJournalPage } from '@/pages/console/ConsoleJournalPage';
import { ConsoleOperationsPage } from '@/pages/console/ConsoleOperationsPage';
import { ConsoleRatesPage } from '@/pages/console/ConsoleRatesPage';
import { ConsoleUserPage } from '@/pages/console/ConsoleUserPage';
import { ConsoleUsersPage } from '@/pages/console/ConsoleUsersPage';

function App() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
              return failureCount < 2;
            },
            staleTime: 30_000,
          },
        },
      }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            {/* Pages publiques exigées par le Play Store (liens dans la fiche de l'app). */}
            <Route path="/confidentialite" element={<PrivacyPage />} />
            <Route path="/suppression-compte" element={<DeleteAccountInfoPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/money" element={<MoneyPage />} />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/activities/:id" element={<ActivityDetailPage />} />
                <Route path="/activities/:id/onboarding" element={<OnboardingPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/parties" element={<PartiesPage />} />
                <Route path="/parties/:id" element={<PartyDetailPage />} />
                <Route path="/budgets" element={<BudgetsPage />} />
                <Route path="/recurring" element={<RecurringPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="/console" element={<ConsoleLayout />}>
                <Route index element={<ConsoleDashboardPage />} />
                <Route path="users" element={<ConsoleUsersPage />} />
                <Route path="users/:id" element={<ConsoleUserPage />} />
                <Route path="operations" element={<ConsoleOperationsPage />} />
                <Route path="rates" element={<ConsoleRatesPage />} />
                <Route path="health" element={<ConsoleHealthPage />} />
                <Route path="journal" element={<ConsoleJournalPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
