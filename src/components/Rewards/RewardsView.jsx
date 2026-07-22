import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Lock, Unlock, Plus, Pencil, Trash2, Check, X, AlertTriangle, Calendar } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import Modal from '../Shared/Modal';
import { formatWeekLabelParts } from '../../utils/weekUtils';

export default function RewardsView() {
  const { state, dispatch } = useTarget();
  const { user } = useAuth();
  const { currentProfile } = useProfile();
  const [editingId, setEditingId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', status: 'locked' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({ title: item.title, status: item.status });
    setShowNew(false);
  };

  const startNew = () => {
    setShowNew(true);
    setEditingId(null);
    setForm({ title: '', status: 'locked' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowNew(false);
    setForm({ title: '', status: 'locked' });
  };

  const saveItem = () => {
    if (!form.title.trim()) return;
    
    if (showNew) {
      dispatch({
        type: 'ADD_REWARD_ITEM',
        payload: {
          title: form.title.trim(),
          status: form.status
        }
      });
    } else if (editingId) {
      dispatch({
        type: 'UPDATE_REWARD_ITEM',
        payload: {
          id: editingId,
          title: form.title.trim(),
          status: form.status
        }
      });
    }
    cancelEdit();
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      dispatch({ type: 'DELETE_REWARD_ITEM', payload: deleteConfirm.id });
      setDeleteConfirm(null);
    }
  };

  const toggleStatus = (item) => {
    dispatch({
      type: 'UPDATE_REWARD_ITEM',
      payload: {
        id: item.id,
        title: item.title,
        status: item.status === 'locked' ? 'unlocked' : 'locked'
      }
    });
  };

  const lockedRewards = state.rewardItems.filter(r => r.status === 'locked');
  const unlockedRewards = state.rewardItems.filter(r => r.status === 'unlocked');

  const handleThresholdChange = (priority, e) => {
    const val = parseInt(e.target.value, 10);
    const newThresholds = {
      ...(state.rewardThresholds || { P1: 100, P2: 100, P3: 100 }),
      [priority]: val
    };
    dispatch({ type: 'SET_REWARD_THRESHOLDS', payload: newThresholds });
    if (user && currentProfile) {
      localStorage.setItem(`target_reward_thresholds_${user.id}_${currentProfile}`, JSON.stringify(newThresholds));
    }
  };

  return (
    <div className="mx-auto pb-28 transition-all duration-300 w-full px-2 sm:px-4 md:px-0 max-w-4xl">
      {/* Header */}
      <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4" style={{ marginBottom: '30px' }}>
        <div className="flex flex-row items-center justify-center gap-3">
          <div className="w-12 h-12 bg-accent-violet/20 text-accent-violet rounded-2xl flex items-center justify-center shadow-lg shadow-accent-violet/10">
            <Gift size={24} />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-bold text-dark-200">Récompenses</h1>
            <p className="text-sm text-dark-400 hidden sm:block">Gérez vos futures récompenses et celles débloquées</p>
          </div>
        </div>
        <div className="sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 mt-4 sm:mt-0">
          <button
            onClick={startNew}
            className="flex-shrink-0 flex items-center bg-accent-violet text-white rounded-full font-semibold shadow-lg shadow-accent-violet/20 hover:bg-accent-violet/90 transition-all cursor-pointer border-none"
            style={{ padding: '6px 12px', gap: '8px' }}
          >
            <Plus size={20} />
            <span className="hidden sm:inline whitespace-nowrap">Nouvelle récompense</span>
          </button>
        </div>
      </div>

      {/* Threshold Configuration */}
      <div className="bg-dark-800 p-6 sm:p-8 rounded-2xl border border-dark-600 shadow-md flex flex-col items-center justify-center text-center gap-4 max-w-2xl mx-auto" style={{ marginBottom: '30px' }}>
        <div>
          <h3 className="font-bold text-dark-200 text-lg">Seuil de déblocage hebdomadaire</h3>
          <p className="text-sm text-dark-400 mt-1">Pourcentage d'objectifs à atteindre pour débloquer la récompense de la semaine.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-2">
          {['P1', 'P2', 'P3'].map(priority => {
            const val = (state.rewardThresholds && state.rewardThresholds[priority]) !== undefined ? state.rewardThresholds[priority] : 100;
            return (
              <div key={priority} className="flex items-center gap-2">
                <span className={`font-black text-lg ${
                  priority === 'P1' ? 'text-accent-red' : 
                  priority === 'P2' ? 'text-accent-violet' : 
                  'text-accent-cyan'
                }`}>
                  {priority}
                </span>
                <select 
                  value={val} 
                  onChange={(e) => handleThresholdChange(priority, e)}
                  className="bg-dark-900 border border-dark-600 rounded-xl px-3 py-1.5 text-dark-200 focus:outline-none focus:border-accent-violet cursor-pointer font-medium"
                >
                  <option value="10">10%</option>
                  <option value="20">20%</option>
                  <option value="30">30%</option>
                  <option value="40">40%</option>
                  <option value="50">50%</option>
                  <option value="60">60%</option>
                  <option value="70">70%</option>
                  <option value="80">80%</option>
                  <option value="90">90%</option>
                  <option value="100">100%</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-12">
        {/* Futures récompenses */}
        <div>
          <h2 className="text-xl font-bold text-dark-200 mb-4 flex items-center gap-2">
            <Lock size={20} className="text-dark-400" />
            Futures récompenses
          </h2>
          
          <div className="flex flex-col gap-4">
            <AnimatePresence>
              {showNew && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-dark-800 p-4 rounded-2xl border border-dark-600 mb-4"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Nom de la récompense..."
                      className="flex-1 bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-dark-200 focus:outline-none focus:border-accent-violet"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveItem();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={cancelEdit} className="p-3 text-dark-400 hover:bg-dark-700 rounded-xl transition-colors">
                        <X size={20} />
                      </button>
                      <button onClick={saveItem} className="p-3 bg-accent-violet text-white rounded-xl hover:bg-accent-violet/90 shadow-lg shadow-accent-violet/20 transition-all">
                        <Check size={20} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {lockedRewards.length === 0 && !showNew ? (
              <p className="text-dark-400 text-sm py-4 italic text-center bg-dark-800/50 rounded-xl border border-dark-700">Aucune récompense en attente.</p>
            ) : (
              lockedRewards.map(item => (
                <div key={item.id} className="bg-dark-800 p-5 rounded-2xl border border-dark-700 flex items-center justify-between group hover:border-dark-600 shadow-md hover:shadow-lg transition-all opacity-75 hover:opacity-100">
                  {editingId === item.id ? (
                    <div className="flex-1 flex flex-col sm:flex-row gap-4">
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="flex-1 bg-dark-900 border border-dark-600 rounded-xl px-4 py-2 text-dark-200 focus:outline-none focus:border-accent-violet"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveItem();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancelEdit} className="p-2 text-dark-400 hover:bg-dark-700 rounded-lg">
                          <X size={20} />
                        </button>
                        <button onClick={saveItem} className="p-2 bg-accent-violet text-white rounded-lg hover:bg-accent-violet/90 shadow-lg">
                          <Check size={20} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => toggleStatus(item)}
                          className="w-8 h-8 rounded-full border border-dark-600 flex items-center justify-center text-dark-400 hover:bg-accent-cyan/10 hover:text-accent-cyan hover:border-accent-cyan transition-colors"
                          title="Marquer comme débloquée"
                        >
                          <Unlock size={14} />
                        </button>
                        <div className="flex flex-col">
                          <span className="text-dark-200 font-medium text-lg">{item.title}</span>
                          {item.assigned_week && (
                            <span className="text-xs text-accent-cyan bg-accent-cyan/10 px-2.5 py-1 rounded-md border border-accent-cyan/20 w-fit mt-2 flex items-center gap-1.5">
                              <Calendar size={12} />
                              Assignée à la {formatWeekLabelParts(item.assigned_week).title}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(item)} className="p-2 text-dark-400 hover:bg-dark-700 hover:text-dark-200 rounded-lg">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => setDeleteConfirm(item)} className="p-2 text-dark-400 hover:bg-dark-700 hover:text-accent-red rounded-lg">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Récompenses débloquées */}
        <div style={{ marginTop: '30px' }}>
          <h2 className="text-xl font-bold text-dark-200 mb-4 flex items-center gap-2">
            <Unlock size={20} className="text-accent-cyan" />
            Récompenses débloquées
          </h2>
          
          <div className="flex flex-col gap-4">
            {unlockedRewards.length === 0 ? (
              <p className="text-dark-400 text-sm py-4 italic text-center bg-dark-800/50 rounded-xl border border-dark-700">Aucune récompense débloquée pour le moment.</p>
            ) : (
              unlockedRewards.map(item => (
                <div key={item.id} className="bg-dark-800 p-5 rounded-2xl border border-accent-cyan/20 flex items-center justify-between group hover:border-accent-cyan/40 shadow-md hover:shadow-lg transition-all opacity-75 hover:opacity-100">
                  {editingId === item.id ? (
                    <div className="flex-1 flex flex-col sm:flex-row gap-4">
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="flex-1 bg-dark-900 border border-dark-600 rounded-xl px-4 py-2 text-dark-200 focus:outline-none focus:border-accent-cyan"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveItem();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancelEdit} className="p-2 text-dark-400 hover:bg-dark-700 rounded-lg">
                          <X size={20} />
                        </button>
                        <button onClick={saveItem} className="p-2 bg-accent-cyan text-white rounded-lg hover:bg-accent-cyan/90 shadow-lg">
                          <Check size={20} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => toggleStatus(item)}
                          className="w-8 h-8 rounded-full border border-accent-cyan bg-accent-cyan/10 flex items-center justify-center text-accent-cyan hover:bg-dark-700 hover:border-dark-600 hover:text-dark-400 transition-colors"
                          title="Remettre en futur"
                        >
                          <Lock size={14} />
                        </button>
                        <div className="flex flex-col">
                          <span className="text-dark-200 font-medium text-lg">{item.title}</span>
                          {item.assigned_week && (
                            <span className="text-xs text-accent-gold bg-accent-gold/10 px-2.5 py-1 rounded-md border border-accent-gold/20 w-fit mt-2 flex items-center gap-1.5">
                              <Calendar size={12} />
                              Débloquée la {formatWeekLabelParts(item.assigned_week).title}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(item)} className="p-2 text-dark-400 hover:bg-dark-700 hover:text-dark-200 rounded-lg">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => setDeleteConfirm(item)} className="p-2 text-dark-400 hover:bg-dark-700 hover:text-accent-red rounded-lg">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Supprimer la récompense"
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-accent-red/15 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-accent-red" />
          </div>
          <p className="text-dark-200 mb-2 text-lg font-semibold">
            Êtes-vous sûr ?
          </p>
          <p className="text-dark-400 text-sm" style={{ marginBottom: '32px' }}>
            La récompense <strong className="text-dark-200">"{deleteConfirm?.title}"</strong> sera définitivement supprimée.
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 py-3 rounded-xl bg-dark-700 text-dark-200 font-bold hover:bg-dark-600 transition-all cursor-pointer border-none"
            >
              Annuler
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 py-3 rounded-xl bg-accent-red text-white font-bold hover:bg-accent-red/80 transition-all cursor-pointer border-none"
            >
              Supprimer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
