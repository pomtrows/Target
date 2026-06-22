import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import UsersManagement from '../components/Admin/UsersManagement';

export default function AdminPage() {
  const { isAdmin } = useAuth();

  // Guard: if not admin, redirect to home
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center justify-center text-center gap-6 border-b border-dark-600/30 pb-6">
        <div className="text-center w-full flex flex-col items-center">
          <h1 className="text-3xl font-black text-dark-100 tracking-tight mb-2 text-center">
            Administration des Utilisateurs
          </h1>
          <p className="text-dark-400 text-center">
            Consultez les statistiques de performance et gérez les comptes utilisateurs.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <UsersManagement />
      </div>
    </div>
  );
}
