import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, UserPlus, Target, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTarget } from '../../contexts/TargetContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function NotificationCenter({ isOpen, onClose, onOpenContacts }) {
  const { state, dispatch } = useTarget();
  const { user } = useAuth();
  const { showToast } = useToast();

  const pendingContacts = state.contacts?.filter(c => c.contact_email === user.email && c.status === 'PENDING' && c.user_id !== user.id) || [];
  
  // Combinaison des notifications de la DB avec les invitations virtuelles
  const notifications = [
    ...(state.notifications || []),
    ...pendingContacts.map(c => {
      const senderProfile = state.profiles ? state.profiles[c.user_id] : null;
      const senderName = senderProfile?.display_name || senderProfile?.email || c.contact_name || 'Un utilisateur';
      return {
        id: `contact-invite-${c.id}`,
        type: 'CONTACT_INVITE',
        message: `${senderName} vous invite à partager des objectifs.`,
        read: false,
        created_at: c.created_at,
        contact_id: c.id
      };
    })
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const handleMarkAsRead = async (id) => {
    if (typeof id === 'string' && id.startsWith('contact-invite-')) return;
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
      dispatch({ type: 'UPDATE_NOTIFICATION', payload: { id, read: true } });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.read && !(typeof n.id === 'string' && n.id.startsWith('contact-invite-')))
        .map(n => n.id);
        
      if (unreadIds.length === 0) return;
      
      const { error } = await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
      if (error) throw error;
      
      unreadIds.forEach(id => {
        dispatch({ type: 'UPDATE_NOTIFICATION', payload: { id, read: true } });
      });
      showToast('Toutes les notifications ont été marquées comme lues', 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.read) handleMarkAsRead(notif.id);
    
    if (notif.type === 'CONTACT_INVITE') {
      onClose();
      if (onOpenContacts) onOpenContacts();
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-start justify-end sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-dark-950/60 backdrop-blur-sm sm:hidden"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.95 }}
          className="relative w-full sm:w-[400px] h-full sm:h-auto sm:max-h-[85vh] bg-dark-800 sm:rounded-2xl shadow-2xl flex flex-col border-l sm:border border-dark-700"
        >
          <div className="flex items-center justify-between p-4 border-b border-dark-700 bg-dark-800/80">
            <h2 className="text-lg font-bold text-dark-100 flex items-center gap-2">
              <Bell className="text-accent-violet" size={20} />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-accent-violet text-white text-xs px-2 py-0.5 rounded-full ml-1">
                  {unreadCount}
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs font-medium text-dark-400 hover:text-accent-cyan transition-colors px-2 py-1"
                >
                  Tout lire
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-dark-400">
                <Bell size={32} className="mb-2 opacity-50" />
                <p className="text-sm">Aucune notification</p>
              </div>
            ) : (
              notifications.map(notif => {
                let Icon = Bell;
                let colorClass = 'text-dark-300 bg-dark-700';
                
                if (notif.type === 'CONTACT_INVITE') {
                  Icon = UserPlus;
                  colorClass = notif.read ? 'text-dark-300 bg-dark-700' : 'text-accent-cyan bg-accent-cyan/10';
                } else if (notif.type === 'TASK_ASSIGNED') {
                  Icon = Target;
                  colorClass = notif.read ? 'text-dark-300 bg-dark-700' : 'text-accent-violet bg-accent-violet/10';
                } else if (notif.type === 'TASK_COMPLETED') {
                  Icon = CheckCircle;
                  colorClass = notif.read ? 'text-dark-300 bg-dark-700' : 'text-accent-green bg-accent-green/10';
                }

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      notif.read ? 'hover:bg-dark-700/50 opacity-70' : 'bg-dark-700 hover:bg-dark-600 border border-dark-500/30'
                    }`}
                  >
                    <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${colorClass}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${notif.read ? 'text-dark-300' : 'text-dark-100 font-medium'}`}>
                        {notif.message}
                      </p>
                      <span className="text-[10px] text-dark-500 font-medium mt-1 block">
                        {new Date(notif.created_at).toLocaleString('fr-FR', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-accent-violet mt-2 flex-shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
