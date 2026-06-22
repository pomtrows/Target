import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, Inbox, BarChart3, Settings, Menu, X, Sun, Moon, LogOut, Users, FileText, Dumbbell, Bell, BellOff, Info, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../Shared/Modal';
import {
  isNotificationSupported,
  getNotificationStatus,
  requestNotificationPermission,
  sendTestNotification
} from '../../utils/notificationService';

const navItems = [
  { path: '/', label: 'Objectifs', icon: Target },
  { path: '/backlog', label: 'Backlog', icon: Inbox },
  { path: '/history', label: 'Historique', icon: BarChart3 },
  { path: '/categories', label: 'Catégories', icon: Settings },
  { path: '/notes', label: 'Notes', icon: FileText },
  { path: '/sport', label: 'Sport', icon: Dumbbell },
  { path: '/admin/users', label: 'Administration', icon: Users },
];

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { logout, isAdmin } = useAuth();

  // Notification settings states
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    setNotifSupported(isNotificationSupported());
    setNotifPermission(getNotificationStatus());
    const enabled = localStorage.getItem('notifications_enabled') !== 'false';
    setNotifEnabled(enabled);
  }, [showNotificationSettings]);

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      localStorage.setItem('notifications_enabled', 'true');
      setNotifEnabled(true);
    }
  };

  const handleToggleNotifications = () => {
    const newVal = !notifEnabled;
    setNotifEnabled(newVal);
    localStorage.setItem('notifications_enabled', newVal ? 'true' : 'false');
  };

  const handleTestNotification = async () => {
    setTestResult('sending');
    const success = await sendTestNotification();
    if (success) {
      setTestResult('success');
      setTimeout(() => setTestResult(null), 3000);
    } else {
      setTestResult('failed');
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  const filteredNavItems = navItems.filter(item => {
    if (item.path.startsWith('/admin')) return isAdmin;
    return true;
  });

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-[100] md:hidden p-2 rounded-xl glass text-dark-200 hover:text-dark-100 transition-colors mobile-sidebar-toggle"
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 transition-all duration-200 animate-fade-in"
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
            onClick={() => setShowNotificationSettings(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 transition-all duration-200 mt-2"
          >
            {notifEnabled && notifPermission === 'granted' ? <Bell size={20} className="text-accent-cyan animate-pulse" /> : <BellOff size={20} />}
            Notifications
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

      {/* Notification Settings Modal */}
      <Modal
        isOpen={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
        title="Paramètres de Notifications ⏱️"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-6 text-dark-200">
          <p className="text-sm leading-relaxed text-dark-300">
            Activez les notifications pour recevoir des alertes automatiques <strong>15 minutes</strong> avant le début de vos objectifs planifiés.
          </p>

          {!notifSupported ? (
            <div className="flex gap-3 p-4 bg-accent-red/10 border border-accent-red/20 rounded-2xl text-accent-red text-sm">
              <Info size={18} className="flex-shrink-0 mt-0.5" />
              <span>Votre navigateur ou appareil ne supporte pas les notifications locales.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Permission Status */}
              <div className="flex justify-between items-center bg-dark-900/40 p-4 rounded-2xl border border-dark-600/30">
                <span className="text-sm font-semibold">Autorisation système</span>
                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${
                  notifPermission === 'granted' ? 'bg-accent-green/20 text-accent-green' :
                  notifPermission === 'denied' ? 'bg-accent-red/20 text-accent-red' :
                  'bg-dark-600/30 text-dark-300'
                }`}>
                  {notifPermission === 'granted' ? 'Autorisé' :
                   notifPermission === 'denied' ? 'Bloqué' :
                   'Non configuré'}
                </span>
              </div>

              {/* Toggle to turn notifications on/off in app */}
              {notifPermission === 'granted' && (
                <div className="flex justify-between items-center bg-dark-900/40 p-4 rounded-2xl border border-dark-600/30">
                  <span className="text-sm font-semibold">Activer les alertes de planning</span>
                  <button
                    onClick={handleToggleNotifications}
                    className={`w-12 h-6 rounded-full transition-all relative border-none cursor-pointer ${
                      notifEnabled ? 'bg-accent-cyan' : 'bg-dark-600'
                    }`}
                  >
                    <motion.div
                      layout
                      className="w-5 h-5 bg-dark-900 rounded-full absolute top-0.5 left-0.5"
                      style={{ x: notifEnabled ? '24px' : '0px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              {notifPermission === 'default' && (
                <button
                  onClick={handleRequestPermission}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-violet text-dark-900 font-black text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all cursor-pointer border-none"
                >
                  <Bell size={16} />
                  Autoriser les notifications
                </button>
              )}

              {notifPermission === 'denied' && (
                <div className="flex gap-3 p-4 bg-accent-orange/10 border border-accent-orange/20 rounded-2xl text-accent-orange text-xs leading-relaxed">
                  <Info size={16} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Les notifications sont bloquées par votre navigateur. Veuillez ouvrir les paramètres de votre navigateur ou de votre système pour autoriser les notifications de TARGET.
                  </span>
                </div>
              )}

              {notifPermission === 'granted' && notifEnabled && (
                <button
                  onClick={handleTestNotification}
                  disabled={testResult === 'sending'}
                  className="w-full py-3 rounded-xl bg-dark-700 hover:bg-dark-600 text-dark-100 font-bold text-sm flex items-center justify-center gap-2 border border-dark-600 transition-all cursor-pointer disabled:opacity-50"
                >
                  {testResult === 'success' ? (
                    <>
                      <CheckCircle2 size={16} className="text-accent-green" />
                      Notification envoyée !
                    </>
                  ) : (
                    <>
                      <Bell size={16} />
                      {testResult === 'sending' ? 'Envoi...' : 'Tester la notification'}
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
