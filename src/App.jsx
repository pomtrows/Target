import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TargetProvider } from './contexts/TargetContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Layout/Sidebar';
import DashboardPage from './pages/DashboardPage';
import BacklogPage from './pages/BacklogPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import AuthScreen from './components/Auth/AuthScreen';

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <TargetProvider>
      <div className="flex min-h-screen">
        <Sidebar />

        {/* Main content - offset for sidebar */}
        <main data-main style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '20px' }} className="flex-1 py-6 md:py-8">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/backlog" element={<BacklogPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
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
