import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Inbox, BarChart3, Settings, Menu, X, Sun, Moon, LogOut, Users, FileText, Dumbbell } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/backlog', label: 'Backlog', icon: Inbox },
  { path: '/history', label: 'Historique', icon: BarChart3 },
  { path: '/admin/categories', label: 'Catégories', icon: Settings },
  { path: '/notes', label: 'Notes', icon: FileText },
  { path: '/sport', label: 'Sport', icon: Dumbbell },
  { path: '/admin/users', label: 'Administration', icon: Users },
];

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { logout, isAdmin } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (item.path.startsWith('/admin')) return isAdmin;
    return true;
  });

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-[100] md:hidden p-2 rounded-xl glass text-dark-200 hover:text-dark-100 transition-colors"
      >
        <Menu size={22} />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-[90] md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        className="fixed top-0 left-0 h-full w-64 bg-dark-800 border-r border-dark-600/30 z-[100] flex flex-col transition-transform duration-300 ease-in-out"
        style={{ transform: mobileOpen ? 'translateX(0)' : undefined }}
        data-sidebar
      >
        {/* Close button mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 md:hidden p-1 rounded-lg text-dark-400 hover:text-dark-100"
        >
          <X size={20} />
        </button>

        {/* Logo */}
        <div className="px-6 py-8 flex flex-col items-center text-center gap-0" style={{ marginTop: '20px' }}>
          <h1 className="text-3xl font-black tracking-tighter text-dark-100 leading-none">TARGET</h1>
          <p className="text-[7px] text-dark-400 uppercase tracking-[0.25em] mt-1 font-bold">Performance Tracking System</p>
        </div>

        {/* Nav */}
        <nav 
          className="flex-1 py-4" 
          style={{ 
            marginTop: '20px', 
            paddingLeft: '10px', 
            paddingRight: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}
        >
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-4 px-5 py-4 rounded-xl text-base font-semibold transition-all duration-200 relative
                  ${isActive
                    ? 'bg-gradient-to-r from-accent-cyan/15 to-accent-violet/15 text-dark-100'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
                  }`}
              >
                <Icon size={24} className={isActive ? 'text-accent-cyan' : ''} />
                {item.label}
                {isActive && (
                  <motion.div
                    className="absolute left-0 w-1 h-8 rounded-r-full bg-gradient-to-b from-accent-cyan to-accent-violet"
                    layoutId="activeNav"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer with theme toggle */}
        <div className="px-4 py-4 border-t border-dark-600/30 mb-32" style={{ paddingLeft: '15px' }}>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 transition-all duration-200"
          >
            <motion.div
              key={isDark ? 'dark' : 'light'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </motion.div>
            {isDark ? 'Mode clair' : 'Mode sombre'}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-500 hover:text-accent-red hover:bg-accent-red/10 transition-all duration-200 mt-2"
          >
            <LogOut size={20} />
            Déconnexion
          </button>


        </div>
      </motion.aside>
    </>
  );
}
