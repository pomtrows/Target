import { useState } from 'react';
import { X, UserPlus, Check, Trash2, Mail } from 'lucide-react';
import Modal from '../Shared/Modal';
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
    let name = newContactName.trim();
    let email = newContactEmail.trim();

    if (!name && !email) return;

    // Si l'utilisateur a saisi une adresse email dans le champ Nom
    if (!email && name.includes('@')) {
      email = name;
      name = email.split('@')[0];
    } else if (!name && email) {
      name = email.split('@')[0];
    }

    if (email && user.email && email.toLowerCase() === user.email.toLowerCase()) {
      showToast('Vous ne pouvez pas vous ajouter vous-même en contact.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Chercher si ce compte Target existe déjà dans profiles
      let targetUserId = null;
      if (email && state.profiles) {
        const found = Object.values(state.profiles).find(
          p => p.email && p.email.toLowerCase() === email.toLowerCase()
        );
        if (found) {
          targetUserId = found.id;
          if (!name || name === email.split('@')[0]) {
            name = found.display_name || name;
          }
        }
      }

      // Si une adresse email est spécifiée, l'invitation DOIT rester en attente (PENDING)
      // jusqu'à ce que le destinataire accepte !
      const status = email ? 'PENDING' : 'ACCEPTED';

      const { data, error } = await supabase.from('contacts').insert({
        user_id: user.id,
        contact_name: name,
        contact_email: email || null,
        contact_user_id: targetUserId,
        status: status
      }).select().single();
      
      if (error) throw error;
      
      dispatch({ type: 'ADD_CONTACT', payload: data });
      showToast(email ? 'Invitation envoyée ! En attente d\'acceptation.' : 'Contact ajouté avec succès !', 'success');
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <UserPlus className="text-accent-cyan" size={22} />
          Mes Contacts
        </span>
      }
      maxWidth="max-w-md"
    >
      <div 
        className="flex flex-col text-dark-200"
        style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '6px 4px' }}
      >
        {/* Formulaire d'ajout */}
        <form 
          onSubmit={handleAddContact} 
          className="bg-dark-700/40 rounded-2xl border border-dark-600/40"
          style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <h3 className="text-sm font-bold text-dark-100 flex items-center gap-2">
            Ajouter un contact
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="Nom du contact (ex: Alice)"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              className="w-full bg-dark-800 border border-dark-600/60 rounded-xl text-sm text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-all"
              style={{ padding: '12px 16px' }}
            />
            <input
              type="email"
              placeholder="Email (pour l'inviter sur Target)"
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              className="w-full bg-dark-800 border border-dark-600/60 rounded-xl text-sm text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-all"
              style={{ padding: '12px 16px' }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="submit"
                disabled={isSubmitting || (!newContactName.trim() && !newContactEmail.trim())}
                className="flex-1 bg-accent-cyan hover:bg-accent-cyan/90 text-dark-950 font-bold rounded-xl text-sm transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-[0.99] flex items-center justify-center"
                style={{ padding: '12px 24px' }}
              >
                {isSubmitting ? 'Ajout...' : 'Ajouter'}
              </button>
              {newContactEmail && (
                <a
                  href={`mailto:${newContactEmail}?subject=Rejoignez-moi sur Target&body=Bonjour, %0A%0AJe vous invite à me rejoindre sur l'application Target. %0ACréez un compte avec cette adresse email pour que nous puissions partager des objectifs !`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-dark-600 hover:bg-dark-500 text-dark-100 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
                  style={{ padding: '12px 16px' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 className="text-sm font-bold text-accent-violet flex items-center gap-2">
              <Mail size={16} /> Invitations reçues ({pendingRequests.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingRequests.map(req => (
                <div 
                  key={req.id} 
                  className="bg-dark-700/60 rounded-xl border border-accent-violet/30"
                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-dark-100 text-sm">{getSenderDisplayName(req)}</span>
                    <span className="text-xs text-dark-400">souhaite vous ajouter à ses contacts</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAcceptRequest(req)} 
                      title="Accepter" 
                      className="bg-accent-green/20 text-accent-green rounded-xl hover:bg-accent-green/30 transition-colors cursor-pointer"
                      style={{ padding: '10px 14px' }}
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={() => handleRejectRequest(req)} 
                      title="Refuser" 
                      className="bg-accent-red/20 text-accent-red rounded-xl hover:bg-accent-red/30 transition-colors cursor-pointer"
                      style={{ padding: '10px 14px' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liste de mes contacts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 className="text-sm font-bold text-dark-200">Mes contacts ({myContacts.length})</h3>
          {myContacts.length === 0 ? (
            <div 
              className="text-dark-400 text-sm italic text-center bg-dark-700/20 rounded-xl border border-dashed border-dark-600/30"
              style={{ padding: '24px 16px' }}
            >
              Aucun contact pour le moment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myContacts.map(contact => (
                <div 
                  key={contact.id} 
                  className="bg-dark-700/40 rounded-xl border border-dark-600/30"
                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
                >
                  <div>
                    <div className="font-semibold text-dark-100 text-sm">{getContactDisplayName(contact)}</div>
                    <div className="flex items-center gap-1.5 text-xs text-dark-400 mt-0.5">
                      {contact.contact_email && <span>{contact.contact_email} • </span>}
                      {contact.status === 'PENDING' && <span className="text-accent-orange font-medium">En attente...</span>}
                      {contact.status === 'ACCEPTED' && <span className="text-accent-green font-medium">Connecté</span>}
                      {contact.status === 'REJECTED' && <span className="text-accent-red font-medium">Refusé</span>}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteContact(contact.id)}
                    className="text-dark-400 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors cursor-pointer"
                    style={{ padding: '8px' }}
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
    </Modal>
  );
}
