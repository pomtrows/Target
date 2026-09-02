import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, Inbox, BarChart3, Settings, Menu, X, Sun, Moon, LogOut, Users, FileText, Dumbbell, Bell, BellOff, Info, CheckCircle2, Gift, Sliders, Wifi, WifiOff, RotateCw, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTarget } from '../../contexts/TargetContext';
import { useNotes } from '../../contexts/NotesContext';
import { useSport } from '../../contexts/SportContext';
import Modal from '../Shared/Modal';
import {
  isNotificationSupported,
  getNotificationStatus,
  requestNotificationPermission,
  sendTestNotification
} from '../../utils/notificationService';

import { useProfile } from '../../contexts/ProfileContext';
import ContactsModal from '../Contacts/ContactsModal';
import NotificationCenter from '../Notifications/NotificationCenter';

const navItems = [
  { path: '/', label: 'Objectifs', icon: Target },
  { path: '/backlog', label: 'Backlog', icon: Inbox },
  { path: '/history', label: 'Historique', icon: BarChart3 },
  { path: '/categories', label: 'Catégories', icon: Settings },
  { path: '/notes', label: 'Notes', icon: FileText },
  { path: '/sport', label: 'Sport', icon: Dumbbell, persoOnly: true },
  { path: '/rewards', label: 'Récompenses', icon: Gift, persoOnly: true },
  { path: '/admin/users', label: 'Administration', icon: Users, persoOnly: true },
];

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const { currentProfile, setCurrentProfile } = useProfile();
  const { isOnline, isSyncing, pendingSyncCount, syncNow } = useTarget();
  const { isSyncingNotes, pendingNotesCount, syncNotesNow } = useNotes();
  const { isSyncingSport, pendingSportCount, syncSportNow } = useSport();

  const totalPending = (pendingSyncCount || 0) + (pendingNotesCount || 0) + (pendingSportCount || 0);
  const syncing = isSyncing || isSyncingNotes || isSyncingSport;

  const handleSyncAll = () => {
    syncNow();
    syncNotesNow?.();
    syncSportNow?.();
  };

  // Notification settings states
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  
  const { zoomLevel, setZoomLevel, maxColumns, setMaxColumns } = useSettings();
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [testResult, setTestResult] = useState(null);

  const { state } = useTarget();
  const { showToast } = useToast();
  const pendingContactInvites = (state.contacts || []).filter(
    c => c.contact_email === user?.email && c.status === 'PENDING' && c.user_id !== user?.id
  ).length;
  const unreadNotificationsCount = (state.notifications || []).filter(n => !n.read).length + pendingContactInvites;

  useEffect(() => {
    const handleOpenNotifs = () => setShowNotificationCenter(true);
    window.addEventListener('open-notifications', handleOpenNotifs);
    return () => window.removeEventListener('open-notifications', handleOpenNotifs);
  }, []);

  const [userName, setUserName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    if (user) {
      const saved = user.user_metadata?.display_name || localStorage.getItem('target-user-display-name') || '';
      setUserName(saved);
    }
  }, [user]);

  const handleSaveUserName = async (e) => {
    if (e) e.preventDefault();
    if (!user) return;
    setIsSavingName(true);
    try {
      const trimmed = userName.trim();
      // 1. Update Supabase Auth user metadata
      await supabase.auth.updateUser({ data: { display_name: trimmed } });
      localStorage.setItem('target-user-display-name', trimmed);

      // 2. Upsert in profiles table
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          display_name: trimmed,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Profiles upsert notice:', err);
      }

      // 3. Update reciprocal contact records where this user is the contact
      if (trimmed) {
        try {
          await supabase.from('contacts').update({ contact_name: trimmed }).eq('contact_user_id', user.id);
        } catch (err) {
          console.warn('Contacts update notice:', err);
        }
      }

      setNameSaved(true);
      showToast('Nom d\'utilisateur enregistré !', 'success');
      setTimeout(() => setNameSaved(false), 2500);
    } catch (err) {
      console.error('Error saving user name:', err);
      showToast('Erreur lors de l\'enregistrement.', 'error');
    } finally {
      setIsSavingName(false);
    }
  };

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
    if (item.path.startsWith('/admin')) return isAdmin && currentProfile === 'perso';
    if (item.persoOnly && currentProfile === 'pro') return false;
    return true;
  });

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden flex items-center justify-center rounded-xl glass text-dark-200 hover:text-dark-100 transition-colors mobile-sidebar-toggle cursor-pointer"
        style={{ position: 'fixed', top: '12px', left: '16px', width: '40px', height: '40px', zIndex: 70 }}
        title="Menu"
      >
        <Menu size={22} />
      </button>

      {/* Mobile Notification Button (Header top-right - Facebook style) */}
      <button
        onClick={() => setShowNotificationCenter(true)}
        className="md:hidden flex items-center justify-center rounded-full glass text-dark-200 hover:text-dark-100 transition-all cursor-pointer shadow-sm relative"
        style={{ position: 'fixed', top: '12px', right: '16px', width: '40px', height: '40px', zIndex: 70 }}
        title="Notifications"
      >
        <Bell size={22} />
        {unreadNotificationsCount > 0 && (
          <span
            className="pointer-events-none shadow-md"
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-6px',
              backgroundColor: '#e41e3f',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '800',
              minWidth: '20px',
              height: '20px',
              padding: '0 5px',
              borderRadius: '9999px',
              border: '2px solid var(--color-dark-800, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              zIndex: 10
            }}
          >
            {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
          </span>
        )}
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm md:hidden"
          style={{ zIndex: 110 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        className="fixed top-0 left-0 w-64 bg-dark-800 border-r border-dark-600/30 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 overflow-hidden"
        style={{ 
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', 
          height: 'var(--app-height, 100vh)',
          zIndex: 120 
        }}
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

        {/* Profile Selector */}
        <div className="px-4" style={{ marginBottom: '16px' }}>
          <div className="flex p-1 bg-dark-700/50 rounded-xl border border-dark-400/40 w-full">
            <button
              onClick={() => setCurrentProfile('perso')}
              className={`flex-1 rounded-lg text-sm font-medium py-2 transition-all ${
                currentProfile === 'perso' ? 'bg-dark-500 text-white shadow-sm' : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              Perso
            </button>
            <button
              onClick={() => setCurrentProfile('pro')}
              className={`flex-1 rounded-lg text-sm font-medium py-2 transition-all ${
                currentProfile === 'pro' ? 'bg-dark-500 text-white shadow-sm' : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              Pro
            </button>
          </div>
        </div>

        {/* Offline / Sync Status Indicator */}
        <div className="px-4" style={{ marginBottom: '24px' }}>
          {!isOnline ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-accent-orange/10 border border-accent-orange/30 text-accent-orange text-xs">
              <div className="flex items-center gap-2 font-medium">
                <WifiOff size={14} className="flex-shrink-0" />
                <span>Hors-ligne</span>
              </div>
              {totalPending > 0 && (
                <span className="font-bold bg-accent-orange/20 px-1.5 py-0.5 rounded text-[10px]">
                  {totalPending} en attente
                </span>
              )}
            </div>
          ) : syncing ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs font-medium">
              <RotateCw size={14} className="animate-spin flex-shrink-0" />
              <span>Synchronisation en cours...</span>
            </div>
          ) : totalPending > 0 ? (
            <button
              onClick={handleSyncAll}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/40 text-accent-cyan text-xs font-bold transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <RotateCw size={14} />
                <span>Synchroniser ({totalPending})</span>
              </div>
              <span className="text-[10px] uppercase underline">Envoi</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 text-dark-400 text-[11px]">
              <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              <span>Connecté & synchronisé</span>
            </div>
          )}
        </div>

        {/* Footer with theme toggle */}
        <div className="px-4 py-4 border-t border-dark-600/30 mb-32 flex flex-col gap-4" style={{ paddingLeft: '15px' }}>
          
          <button
            onClick={() => {
              setShowSettingsModal(true);
              setMobileOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 transition-all duration-200"
          >
            <Sliders size={20} />
            Réglages
          </button>

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
            onClick={() => {
              setShowContactsModal(true);
              setMobileOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 transition-all duration-200"
          >
            <Users size={20} />
            Mes Contacts
          </button>

          <button
            onClick={() => {
              setShowNotificationCenter(true);
              setMobileOpen(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <Bell size={20} />
              Notifications
            </div>
            {unreadNotificationsCount > 0 && (
              <span className="bg-accent-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-500 hover:text-accent-red hover:bg-accent-red/10 transition-all duration-200"
          >
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </motion.aside>

      {/* Contacts Modal */}
      <ContactsModal 
        isOpen={showContactsModal} 
        onClose={() => setShowContactsModal(false)} 
      />

      {/* Notification Center */}
      <NotificationCenter 
        isOpen={showNotificationCenter} 
        onClose={() => setShowNotificationCenter(false)} 
        onOpenContacts={() => setShowContactsModal(true)}
      />

      {/* Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Réglages de l'application ⚙️"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-6 text-dark-200 h-[65vh] overflow-y-auto custom-scrollbar p-1">
          {/* Nom d'utilisateur */}
          <div className="flex flex-col gap-3 bg-dark-900/40 p-4 rounded-2xl border border-dark-600/30">
            <label className="text-sm font-semibold text-dark-100 flex items-center gap-2">
              <User size={18} className="text-accent-cyan" />
              Mon Nom d'utilisateur
            </label>
            <p className="text-xs text-dark-400">
              Ce nom apparaîtra chez vos contacts lorsqu'ils acceptent vos invitations ou que vous leur assignez des objectifs.
            </p>
            <form onSubmit={handleSaveUserName} className="flex items-center gap-3 mt-1">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder={user?.email || "Votre nom..."}
                className="flex-1 min-w-0 bg-dark-800/80 border border-dark-600/50 rounded-xl px-4 py-2.5 text-sm text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-colors"
              />
              <button
                type="submit"
                disabled={isSavingName}
                className="flex-shrink-0 bg-accent-cyan hover:bg-accent-cyan/90 text-dark-950 font-bold rounded-xl text-sm transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
                style={{ padding: '10px 24px' }}
              >
                {isSavingName ? 'Enregistrement...' : nameSaved ? 'Enregistré !' : 'Enregistrer'}
              </button>
            </form>
            {!userName.trim() && (
              <p className="text-[11px] text-dark-400 italic">
                Par défaut, votre adresse e-mail ({user?.email}) sera affichée.
              </p>
            )}
          </div>

          {/* Zoom Setting */}
          <div className="flex flex-col gap-3 bg-dark-900/40 p-4 rounded-2xl border border-dark-600/30">
            <label className="text-sm font-semibold text-dark-100 flex items-center gap-2">
              Niveau de Zoom
            </label>
            <div className="flex items-center gap-4">
              <input 
                type="range" 
                min="0.5" 
                max="1.5" 
                step="0.05"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                className="w-full accent-accent-cyan"
              />
              <span className="text-xs font-bold text-accent-cyan w-12 text-right">
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-dark-400 font-medium px-1">
              <span>Petit</span>
              <span>Défaut</span>
              <span>Grand</span>
            </div>
            <button 
              onClick={() => setZoomLevel(1)}
              className="mt-2 rounded-xl bg-dark-700 hover:bg-dark-600 text-xs font-medium text-dark-200 transition-colors cursor-pointer"
              style={{ padding: '8px 16px' }}
            >
              Réinitialiser le zoom
            </button>
          </div>

          {/* Max Columns Setting */}
          <div className="flex flex-col gap-3 bg-dark-900/40 p-4 rounded-2xl border border-dark-600/30">
            <label className="text-sm font-semibold text-dark-100 flex items-center gap-2">
              Objectifs par ligne (Vue PC)
            </label>
            <p className="text-xs text-dark-400">
              Choisissez le nombre d'objectifs affichés sur une même ligne sur grand écran.
            </p>
            <div className="flex gap-3 mt-1">
              {[2, 3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => setMaxColumns(num)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    maxColumns === num
                      ? 'bg-accent-violet/20 text-accent-violet border border-accent-violet/50 shadow-sm'
                      : 'bg-dark-800/40 text-dark-400 border border-dark-600/30 hover:border-dark-500/50 hover:text-dark-200'
                  }`}
                >
                  {num} colonnes
                </button>
              ))}
            </div>
          </div>

          {/* Notifications Setting */}
          <div className="flex flex-col gap-3 bg-dark-900/40 p-4 rounded-2xl border border-dark-600/30">
            <label className="text-sm font-semibold text-dark-100 flex items-center gap-2">
              Notifications Push
            </label>
            <p className="text-xs text-dark-400">
              Activez les notifications pour recevoir des alertes automatiques 15 minutes avant le début de vos objectifs planifiés.
            </p>

            {!notifSupported ? (
              <div className="flex gap-2 p-2.5 mt-2 bg-accent-red/10 border border-accent-red/20 rounded-xl text-accent-red text-xs">
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                <span>Non supporté sur cet appareil.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex justify-between items-center bg-dark-800/50 p-3 rounded-xl">
                  <span className="text-xs font-semibold">Autorisation système</span>
                  <span 
                    className={`inline-flex items-center justify-center text-xs font-bold uppercase rounded-lg tracking-wide ${
                      notifPermission === 'granted' ? 'bg-accent-green/20 text-accent-green border border-accent-green/40' :
                      notifPermission === 'denied' ? 'bg-accent-red/20 text-accent-red border border-accent-red/40' :
                      'bg-dark-600/50 text-dark-300 border border-dark-500/40'
                    }`}
                    style={{ padding: '6px 14px' }}
                  >
                    {notifPermission === 'granted' ? 'Autorisé' :
                     notifPermission === 'denied' ? 'Bloqué' :
                     'Non configuré'}
                  </span>
                </div>

                {notifPermission === 'granted' && (
                  <div className="flex justify-between items-center bg-dark-800/50 p-3 rounded-xl">
                    <span className="text-xs font-semibold">Activer les alertes in-app</span>
                    <button
                      onClick={handleToggleNotifications}
                      className={`w-10 h-5 rounded-full relative transition-all ${
                        notifEnabled ? 'bg-accent-cyan' : 'bg-dark-600'
                      }`}
                    >
                      <motion.div
                        layout
                        className="w-4 h-4 bg-dark-900 rounded-full absolute top-0.5 left-0.5"
                        style={{ x: notifEnabled ? '20px' : '0px' }}
                      />
                    </button>
                  </div>
                )}

                {notifPermission === 'default' && (
                  <button
                    onClick={handleRequestPermission}
                    className="w-full rounded-xl bg-gradient-to-r from-accent-cyan to-accent-violet text-dark-900 font-bold text-xs flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all cursor-pointer"
                    style={{ padding: '12px 18px' }}
                  >
                    <Bell size={14} /> Autoriser les notifications
                  </button>
                )}

                {notifPermission === 'denied' && (
                  <div className="flex gap-2 p-3 bg-accent-orange/10 border border-accent-orange/20 rounded-xl text-accent-orange text-[11px] leading-tight">
                    <Info size={14} className="flex-shrink-0" />
                    <span>Bloqué par votre navigateur. Autorisez-les dans les paramètres de votre navigateur.</span>
                  </div>
                )}

                {notifPermission === 'granted' && notifEnabled && (
                  <button
                    onClick={handleTestNotification}
                    disabled={testResult === 'sending'}
                    className="w-full rounded-xl bg-dark-700 hover:bg-dark-600 text-dark-200 hover:text-dark-100 font-semibold text-xs flex items-center justify-center gap-2 border border-dark-600 transition-all disabled:opacity-50 mt-1 cursor-pointer"
                    style={{ padding: '10px 16px' }}
                  >
                    {testResult === 'success' ? (
                      <><CheckCircle2 size={14} className="text-accent-green" /> Envoyée !</>
                    ) : (
                      <><Bell size={14} /> {testResult === 'sending' ? 'Envoi...' : 'Tester la notification'}</>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
