import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { TargetProvider } from './contexts/TargetContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotesProvider } from './contexts/NotesContext';
import { SportProvider } from './contexts/SportContext';
import Sidebar from './components/Layout/Sidebar';
import AuthScreen from './components/Auth/AuthScreen';
import InstallPrompt from './components/Shared/InstallPrompt';
import { checkAndTriggerNotifications } from './utils/notificationService';
import { useTarget } from './contexts/TargetContext';

// Code Splitting / Lazy Loading of Pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BacklogPage = lazy(() => import('./pages/BacklogPage'));
const RewardsPage = lazy(() => import('./pages/RewardsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SportPage = lazy(() => import('./pages/SportPage'));

function PageLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] gap-3">
      <div className="w-8 h-8 border-3 border-accent-cyan border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs text-dark-400 font-medium animate-pulse">Chargement de la page...</span>
    </div>
  );
}

function NotificationScheduler() {
  const { state } = useTarget();

  useEffect(() => {
    if (!state.objectives || state.objectives.length === 0) return;

    // Check immediately on load/change
    checkAndTriggerNotifications(state.objectives);

    // Schedule checks every 60 seconds
    const interval = setInterval(() => {
      checkAndTriggerNotifications(state.objectives);
    }, 60000);

    return () => clearInterval(interval);
  }, [state.objectives]);

  return null;
}

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <TargetProvider>
      <NotificationScheduler />
      <NotesProvider>
        <SportProvider>
          <div className="flex overflow-hidden" style={{ height: 'var(--app-height, 100vh)' }}>
            <Sidebar />
            <InstallPrompt />

            {/* Main content - offset for sidebar */}
            <main data-main style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '20px' }} className="flex-1 h-full overflow-hidden flex flex-col py-6 md:py-8">
              {/* Spacer for mobile menu to prevent overlap */}
              <div className="flex-none h-12 w-full md:hidden"></div>
              
              <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-y-auto custom-scrollbar h-full px-2">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/rewards" element={<RewardsPage />} />
                    <Route path="/backlog" element={<BacklogPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/notes" element={<NotesPage />} />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/admin/users" element={<AdminPage defaultTab="users" />} />
                    <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
                    <Route path="/sport" element={<SportPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </div>
            </main>
          </div>
        </SportProvider>
      </NotesProvider>
    </TargetProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ProfileProvider>
        <SettingsProvider>
          <AuthProvider>
            <ToastProvider>
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </ToastProvider>
          </AuthProvider>
        </SettingsProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
}
