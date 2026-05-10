import { useState, useEffect } from 'react';
import { Settings, Users } from 'lucide-react';
import CategoriesView from '../components/Admin/CategoriesView';
import UsersManagement from '../components/Admin/UsersManagement';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function AdminPage({ defaultTab = 'categories' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { isAdmin } = useAuth();

  // Sync state if defaultTab changes (due to route change)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Guard: if not admin, redirect to home
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-dark-600/30 pb-6">
        <div>
          <h1 className="text-3xl font-black text-dark-100 tracking-tight mb-2">
            {activeTab === 'categories' ? 'Gestion des Catégories' : 'Administration des Utilisateurs'}
          </h1>
          <p className="text-dark-400">
            {activeTab === 'categories' 
              ? 'Personnalisez les catégories d\'objectifs disponibles pour tous les utilisateurs.' 
              : 'Consultez les statistiques de performance et gérez les comptes utilisateurs.'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'categories' ? <CategoriesView /> : <UsersManagement />}
      </div>
    </div>
  );
}
