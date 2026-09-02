import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Check, Trash2, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTarget } from '../../contexts/TargetContext';
import { useToast } from '../../contexts/ToastContext';

export default function ContactsModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { state, dispatch } = useTarget();
  const { showToast } = useToast();
  
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contacts = state.contacts || [];
  const myContacts = contacts.filter(c => c.user_id === user.id);
  const pendingRequests = contacts.filter(c => c.contact_email === user.email && c.status === 'PENDING' && c.user_id !== user.id);

  const getContactDisplayName = (contact) => {
    if (contact.contact_user_id && state.profiles && state.profiles[contact.contact_user_id]) {
      const p = state.profiles[contact.contact_user_id];
      if (p.display_name) return p.display_name;
      if (p.email) return p.email;
    }
    return contact.contact_name || contact.contact_email || 'Contact';
  };

  const getSenderDisplayName = (req) => {
    if (state.profiles && state.profiles[req.user_id]) {
      const p = state.profiles[req.user_id];
      if (p.display_name) return p.display_name;
      if (p.email) return p.email;
    }
    return req.contact_name || 'Un utilisateur';
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!newContactName.trim()) return;
    
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('contacts').insert({
        user_id: user.id,
        contact_name: newContactName,
        contact_email: newContactEmail || null,
        status: newContactEmail ? 'PENDING' : 'ACCEPTED'
      }).select().single();
      
      if (error) throw error;
      
      dispatch({ type: 'ADD_CONTACT', payload: data });
      showToast('Contact ajouté avec succès !', 'success');
      setNewContactName('');
      setNewContactEmail('');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de l\'ajout du contact.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptRequest = async (contact) => {
    try {
      // 1. Mettre à jour la demande d'origine en ACCEPTED
      const { error } = await supabase.from('contacts').update({
        status: 'ACCEPTED',
        contact_user_id: user.id
      }).eq('id', contact.id);
      
      if (error) throw error;
      
      dispatch({ type: 'UPDATE_CONTACT', payload: { id: contact.id, status: 'ACCEPTED', contact_user_id: user.id } });

      // 2. Créer également le contact réciproque chez la personne qui a accepté
      const inviterProfile = state.profiles ? state.profiles[contact.user_id] : null;
      const inviterName = inviterProfile?.display_name || inviterProfile?.email || contact.contact_name || 'Contact';
      const myDisplayName = user.user_metadata?.display_name || localStorage.getItem('target-user-display-name') || user.email;

      const existing = (state.contacts || []).find(c => c.user_id === user.id && (c.contact_user_id === contact.user_id || (inviterProfile?.email && c.contact_email === inviterProfile.email)));

      if (!existing) {
        const { data: reciprocal, error: recipErr } = await supabase.from('contacts').insert({
          user_id: user.id,
          contact_name: inviterName,
          contact_email: inviterProfile?.email || null,
          contact_user_id: contact.user_id,
          status: 'ACCEPTED'
        }).select().single();

        if (!recipErr && reciprocal) {
          dispatch({ type: 'ADD_CONTACT', payload: reciprocal });
        }
      }

      // 3. Envoyer une notification à l'expéditeur de l'invitation
      try {
        await supabase.from('notifications').insert({
          user_id: contact.user_id,
          type: 'CONTACT_INVITE',
          message: `${myDisplayName} a accepté votre invitation de contact.`
        });
      } catch (notifErr) {
        console.warn('Notification error on accept contact:', notifErr);
      }

      showToast('Demande acceptée ! Vous êtes maintenant contacts.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de l\'acceptation.', 'error');
    }
  };

  const handleRejectRequest = async (contact) => {
    try {
      const { error } = await supabase.from('contacts').update({
        status: 'REJECTED'
      }).eq('id', contact.id);
      
      if (error) throw error;
      
      dispatch({ type: 'UPDATE_CONTACT', payload: { id: contact.id, status: 'REJECTED' } });
      showToast('Demande refusée.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors du refus.', 'error');
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce contact ?')) return;
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', contactId);
      if (error) throw error;
      
      dispatch({ type: 'DELETE_CONTACT', payload: contactId });
      showToast('Contact supprimé.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la suppression.', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-dark-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-dark-700"
        >
          <div className="flex items-center justify-between p-4 border-b border-dark-700 bg-dark-800/50">
            <h2 className="text-lg font-bold text-dark-100 flex items-center gap-2">
              <UserPlus className="text-accent-cyan" size={20} />
              Mes Contacts
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 overflow-y-auto custom-scrollbar">
            {/* Formulaire d'ajout */}
            <form onSubmit={handleAddContact} className="bg-dark-700/50 p-4 rounded-xl border border-dark-600 mb-6">
              <h3 className="text-sm font-semibold text-dark-200 mb-3">Ajouter un contact</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nom du contact"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2.5 text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-colors"
                  required
                />
                <input
                  type="email"
                  placeholder="Email (optionnel, pour l'inviter)"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2.5 text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newContactName.trim()}
                    className="flex-1 bg-accent-cyan text-dark-900 font-bold py-2.5 rounded-lg hover:bg-accent-cyan/90 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Ajout...' : 'Ajouter'}
                  </button>
                  {newContactEmail && (
                    <a
                      href={`mailto:${newContactEmail}?subject=Rejoignez-moi sur Target&body=Bonjour, %0A%0AJe vous invite à me rejoindre sur l'application Target. %0ACréez un compte avec cette adresse email pour que nous puissions partager des objectifs !`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-dark-600 text-dark-100 p-2.5 rounded-lg hover:bg-dark-500 transition-all flex items-center justify-center"
                      title="Envoyer un e-mail avec mon client de messagerie"
                    >
                      <Mail size={20} />
                    </a>
                  )}
                </div>
              </div>
            </form>

            {/* Demandes en attente */}
            {pendingRequests.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-accent-violet mb-3 flex items-center gap-2">
                  <Mail size={16} /> Invitations reçues ({pendingRequests.length})
                </h3>
                <div className="space-y-2">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between bg-dark-700 p-3 rounded-xl border border-accent-violet/30">
                      <div className="flex flex-col">
                        <span className="font-semibold text-dark-100">{getSenderDisplayName(req)}</span>
                        <span className="text-xs text-dark-400">souhaite vous ajouter à ses contacts</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleAcceptRequest(req)} title="Accepter" className="p-2 bg-accent-green/20 text-accent-green rounded-lg hover:bg-accent-green/30 transition-colors">
                          <Check size={16} />
                        </button>
                        <button onClick={() => handleRejectRequest(req)} title="Refuser" className="p-2 bg-accent-red/20 text-accent-red rounded-lg hover:bg-accent-red/30 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Liste de mes contacts */}
            <div>
              <h3 className="text-sm font-semibold text-dark-200 mb-3">Mes contacts ({myContacts.length})</h3>
              {myContacts.length === 0 ? (
                <p className="text-dark-400 text-sm italic text-center py-4">Aucun contact pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {myContacts.map(contact => (
                    <div key={contact.id} className="flex items-center justify-between bg-dark-900/50 p-3 rounded-xl border border-dark-700">
                      <div>
                        <div className="font-medium text-dark-100">{getContactDisplayName(contact)}</div>
                        <div className="flex items-center gap-1.5 text-xs text-dark-400">
                          {contact.contact_email && <span>{contact.contact_email} • </span>}
                          {contact.status === 'PENDING' && <span className="text-accent-orange font-medium">En attente...</span>}
                          {contact.status === 'ACCEPTED' && <span className="text-accent-green font-medium">Connecté</span>}
                          {contact.status === 'REJECTED' && <span className="text-accent-red font-medium">Refusé</span>}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteContact(contact.id)}
                        className="p-2 text-dark-400 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer ce contact"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
