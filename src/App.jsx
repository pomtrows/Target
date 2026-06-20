import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TargetProvider } from './contexts/TargetContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Layout/Sidebar';
import DashboardPage from './pages/DashboardPage';
import BacklogPage from './pages/BacklogPage';
import HistoryPage from './pages/HistoryPage';
import NotesPage from './pages/NotesPage';
import AdminPage from './pages/AdminPage';
import AuthScreen from './components/Auth/AuthScreen';
import InstallPrompt from './components/Shared/InstallPrompt';
import { NotesProvider } from './contexts/NotesContext';
import { SportProvider } from './contexts/SportContext';
import SportPage from './pages/SportPage';


import { useEffect } from 'react';
import { checkAndTriggerNotifications } from './utils/notificationService';
import { useTarget } from './contexts/TargetContext';

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
          <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <InstallPrompt />

          {/* Main content - offset for sidebar */}
          <main data-main style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '20px' }} className="flex-1 h-full overflow-hidden flex flex-col py-6 md:py-8">
            {/* Spacer for mobile menu to prevent overlap */}
            <div className="flex-none h-12 w-full md:hidden"></div>
            
            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-y-auto custom-scrollbar h-full px-2">
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/backlog" element={<BacklogPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/admin/categories" element={<AdminPage defaultTab="categories" />} />
                <Route path="/admin/users" element={<AdminPage defaultTab="users" />} />
                <Route path="/admin" element={<Navigate to="/admin/categories" replace />} />
                <Route path="/sport" element={<SportPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
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
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
