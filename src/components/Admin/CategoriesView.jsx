import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Plus, Pencil, Trash2, Check, X, AlertTriangle, GripVertical, Repeat } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useTarget } from '../../contexts/TargetContext';
import Modal from '../Shared/Modal';

const PRESET_COLORS = [
  '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', // Cyans
  '#4ade80', '#22c55e', '#16a34a', '#15803d', // Greens
  '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', // Violets
  '#f472b6', '#ec4899', '#db2777', '#be185d', // Pinks
  '#fb923c', '#f97316', '#ea580c', '#c2410c', // Oranges
  '#fbbf24', '#f59e0b', '#d97706', '#b45309', // Yellows
  '#ef4444', '#dc2626', '#b91c1c', '#991b1b', // Reds
  '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', // Blues
  '#6366f1', '#4f46e5', '#4338ca', '#3730a3', // Indigos
  '#94a3b8', '#64748b', '#475569', '#334155', // Slates
];

const PRESET_ICONS = [
  '🏃', '🥗', '👥', '🎮', '📋', '🛒', '📌', '💪',
  '📚', '🧘', '💰', '🎯', '🏠', '✈️', '🎵', '💊',
  '🧠', '❤️', '🌱', '⭐', '🔥', '🎨', '💻', '🍳',
  '🎭', '🏛️', '🎬', '🎟️', '🎻', '🖼️', '🧗', '🚴',
  '🏊', '🎾', '⚽', '🏀', '🥊', '🛹', '🍎', '🍕',
  '☕', '🍷', '🍺', '🍦', '🍰', '🍣', '🐶', '🐱',
  '🐦', '🌸', '🌳', '☀️', '🌙', '☁️',
];

export default function CategoriesView() {
  const { state, dispatch } = useTarget();
  const [editingId, setEditingId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ label: '', icon: '📌', color: '#94a3b8', auto_rollover: false });
  const [deleteError, setDeleteError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setForm({ label: cat.label, icon: cat.icon, color: cat.color, auto_rollover: cat.auto_rollover || false });
    setShowNew(false);
  };

  const startNew = () => {
    setShowNew(true);
    setEditingId(null);
    setForm({ label: '', icon: '📌', color: '#94a3b8', auto_rollover: false });
  };

  const handleSave = () => {
    if (!form.label.trim()) return;
    if (editingId) {
      dispatch({ type: 'UPDATE_CATEGORY', payload: { id: editingId, ...form } });
      setEditingId(null);
    } else {
      dispatch({ type: 'ADD_CATEGORY', payload: form });
      setShowNew(false);
    }
    setForm({ label: '', icon: '📌', color: '#94a3b8', auto_rollover: false });
  };

  const handleToggleRollover = (cat) => {
    dispatch({ 
      type: 'UPDATE_CATEGORY', 
      payload: { ...cat, auto_rollover: !cat.auto_rollover } 
    });
  };

  const handleDelete = (catId) => {
    if (catId === 'autre') return; // Cannot delete "Autre"
    const category = state.categories.find(c => c.id === catId);
    setDeleteConfirm(category || { id: catId, label: 'cette catégorie' });
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      dispatch({ type: 'DELETE_CATEGORY', payload: deleteConfirm.id });
      setDeleteConfirm(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowNew(false);
    setForm({ label: '', icon: '📌', color: '#94a3b8' });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(state.categories);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    dispatch({ type: 'REORDER_CATEGORIES', payload: items });
  };

  const renderForm = () => (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="p-4 rounded-2xl bg-dark-700/50 border border-dark-600/30">
        <div>
          <label className="block text-xs font-medium text-dark-400 mb-1.5">Nom</label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => {
              const val = e.target.value;
              setForm({ ...form, label: val.charAt(0).toUpperCase() + val.slice(1) });
            }}
            placeholder="Ex: Fitness"
            autoFocus
            className="w-full bg-dark-600/50 border border-dark-500/50 rounded-xl py-2 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-cyan/50"
            style={{ paddingLeft: '15px' }}
          />
        </div>

        <div style={{ marginTop: '10px' }}>
          <label className="block text-xs font-medium text-dark-400 mb-1.5">Icône</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setForm({ ...form, icon })}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                  form.icon === icon
                    ? 'bg-accent-cyan/20 ring-2 ring-accent-cyan/50'
                    : 'bg-dark-600/30 hover:bg-dark-600/50'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label className="block text-xs font-medium text-dark-400 mb-1.5">Couleur</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setForm({ ...form, color })}
                className={`w-8 h-8 rounded-full transition-all ${
                  form.color === color ? 'ring-2 ring-offset-2 ring-offset-dark-800 scale-110' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color, ringColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between bg-dark-900/40 p-3 rounded-xl border border-dark-600/30" style={{ marginTop: '16px' }}>
          <div>
            <span className="text-sm font-semibold text-dark-200">Report automatique</span>
            <p className="text-xs text-dark-400 mt-0.5">Reporter les objectifs non terminés à la semaine suivante</p>
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, auto_rollover: !form.auto_rollover })}
            className={`w-12 h-6 rounded-full transition-all relative border-none cursor-pointer flex-shrink-0 ${
              form.auto_rollover ? 'bg-accent-cyan' : 'bg-dark-600'
            }`}
          >
            <motion.div
              layout
              className="w-5 h-5 bg-dark-900 rounded-full absolute top-0.5 left-0.5"
              style={{ x: form.auto_rollover ? '24px' : '0px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        <div className="flex gap-2" style={{ marginTop: '10px' }}>
          <button
            onClick={handleCancel}
            className="flex-1 px-3 py-2 rounded-xl text-sm text-dark-400 bg-dark-600/30 hover:text-dark-200 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!form.label.trim()}
            className="flex-1 px-3 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-accent-cyan to-accent-violet disabled:opacity-40 transition-opacity"
          >
            {editingId ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="max-w-2xl mx-auto" style={{ paddingTop: '0px' }}>
      <div className="flex flex-col items-center gap-4" style={{ marginBottom: '25px', width: '100%' }}>
        <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-3 w-full justify-center">
          <div className="w-10 h-10 rounded-xl bg-accent-orange/20 flex items-center justify-center">
            <Settings size={22} className="text-accent-orange" />
          </div>
          Catégories
        </h1>

        {!showNew && !editingId && (
          <div className="w-full flex justify-end">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startNew}
              className="py-2.5 rounded-full text-sm font-medium text-white bg-gradient-to-r from-accent-cyan to-accent-violet hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap"
              style={{ paddingLeft: '24px', paddingRight: '24px' }}
            >
              <Plus size={18} />
              Nouvelle
            </motion.button>
          </div>
        )}
      </div>

      {/* New Category Form */}
      <AnimatePresence>
        {showNew && <div className="mb-4">{renderForm()}</div>}
      </AnimatePresence>

      {/* Categories List */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="categories-list">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-3"
            >
              {state.categories.map((cat, i) => {
                const objCount = state.objectives.filter((o) => o.categoryId === cat.id).length;
                const isEditing = editingId === cat.id;

                return (
                  <Draggable key={cat.id} draggableId={cat.id} index={i}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`group p-4 rounded-2xl bg-dark-700/50 border ${snapshot.isDragging ? 'border-accent-cyan shadow-2xl bg-dark-700' : 'border-dark-600/30'} hover:border-dark-500/50 transition-all`}
                      >
                        {isEditing ? (
                          renderForm()
                        ) : (
                          <div>
                            <div className="flex items-center gap-4">
                              <div
                                {...provided.dragHandleProps}
                                className="text-dark-500 hover:text-dark-300 cursor-grab active:cursor-grabbing p-1"
                              >
                                <GripVertical size={20} />
                              </div>

                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${cat.color}15` }}
                              >
                                <span className="text-2xl">{cat.icon}</span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: cat.color }}>
                                  {cat.label}
                                  {cat.auto_rollover && (
                                    <Repeat size={14} className="opacity-60" title="Report automatique activé" />
                                  )}
                                </h3>
                                <p className="text-xs text-dark-500">{objCount} objectif{objCount !== 1 ? 's' : ''}</p>
                              </div>

                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />

                              <div className="flex items-center gap-4 opacity-40 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleToggleRollover(cat)}
                                  className={`p-2 rounded-lg transition-all ${
                                    cat.auto_rollover 
                                      ? 'text-accent-cyan bg-accent-cyan/10 hover:bg-accent-cyan/20' 
                                      : 'text-dark-400 hover:text-accent-cyan hover:bg-dark-600/50'
                                  }`}
                                  title={cat.auto_rollover ? "Désactiver le report automatique" : "Activer le report automatique"}
                                >
                                  <Repeat size={16} />
                                </button>
                                <button
                                  onClick={() => startEdit(cat)}
                                  className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-600/50 transition-all"
                                >
                                  <Pencil size={16} />
                                </button>
                                {cat.id !== 'autre' && (
                                  <button
                                    onClick={() => handleDelete(cat.id)}
                                    className="p-2 rounded-lg text-dark-400 hover:text-accent-red hover:bg-dark-600/50 transition-all"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Delete error */}
                            {deleteError === cat.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-3 flex items-center gap-2 text-xs text-accent-orange"
                              >
                                <AlertTriangle size={14} />
                                Impossible de supprimer : {objCount} objectif{objCount !== 1 ? 's' : ''} utilisent cette catégorie
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Supprimer la catégorie"
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
            La catégorie <strong className="text-dark-200">"{deleteConfirm?.label}"</strong> sera définitivement supprimée.
            {state.objectives.some(o => o.categoryId === deleteConfirm?.id) && (
              <>
                <br />
                <span className="text-accent-orange font-medium">Les objectifs associés seront déplacés dans "Autre".</span>
              </>
            )}
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 py-3 rounded-xl bg-dark-700 text-dark-200 font-bold hover:bg-dark-600 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 py-3 rounded-xl bg-accent-red text-white font-bold hover:bg-accent-red/80 transition-all"
            >
              Supprimer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
