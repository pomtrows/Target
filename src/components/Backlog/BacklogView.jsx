import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Plus, Trash2, Pencil, Filter } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { getBacklogObjectives } from '../../utils/progressUtils';
import Badge from '../Shared/Badge';
import ObjectiveForm from '../Dashboard/ObjectiveForm';

export default function BacklogView() {
  const { state, dispatch } = useTarget();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editObjective, setEditObjective] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  const [highlightedObjectiveId, setHighlightedObjectiveId] = useState(null);

  const highlightParam = searchParams.get('highlight');

  useEffect(() => {
    const handleHighlight = (e) => {
      const { objectiveId } = e.detail || {};
      if (objectiveId) {
        setHighlightedObjectiveId(objectiveId);
        setTimeout(() => {
          const el = document.getElementById(`objective-card-${objectiveId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
        setTimeout(() => setHighlightedObjectiveId(null), 3000);
      }
    };

    window.addEventListener('highlight-objective', handleHighlight);
    return () => window.removeEventListener('highlight-objective', handleHighlight);
  }, []);

  useEffect(() => {
    if (highlightParam) {
      setHighlightedObjectiveId(highlightParam);
      setTimeout(() => {
        const el = document.getElementById(`objective-card-${highlightParam}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      const timer = setTimeout(() => {
        setHighlightedObjectiveId(null);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('highlight');
        setSearchParams(newParams, { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightParam]);

  const backlogObjectives = useMemo(() => {
    let objectives = getBacklogObjectives(state.objectives);
    if (filterCategory) {
      objectives = objectives.filter((o) => o.categoryId === filterCategory);
    }
    return objectives;
  }, [state.objectives, filterCategory]);

  const handleDelete = (objectiveId) => {
    dispatch({ type: 'DELETE_OBJECTIVE', payload: objectiveId });
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-28">
      {/* Header */}
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-violet/20 flex items-center justify-center">
            <Inbox size={22} className="text-accent-violet" />
          </div>
          Backlog
        </h1>
        <p className="text-sm text-dark-400 mt-2 text-center">
          {backlogObjectives.length} objectif{backlogObjectives.length !== 1 ? 's' : ''} non assigné{backlogObjectives.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Floating Add button */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setEditObjective(null);
          setShowForm(true);
        }}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-dark-100 text-dark-900 shadow-2xl flex items-center justify-center z-50 hover:bg-dark-100 transition-all duration-300 md:bottom-10 md:right-10"
      >
        <Plus size={28} strokeWidth={2.5} />
      </motion.button>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <Filter size={16} className="text-dark-500 flex-shrink-0" />
        <button
          onClick={() => setFilterCategory(null)}
          style={{ padding: '3px 8px' }}
          className={`rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            !filterCategory
              ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
              : 'text-dark-400 border border-dark-600/30 hover:text-dark-300'
          }`}
        >
          Tous
        </button>
        {state.categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id === filterCategory ? null : cat.id)}
            className={`rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
              filterCategory === cat.id
                ? 'border'
                : 'text-dark-400 border border-dark-600/30 hover:text-dark-300'
            }`}
            style={
              filterCategory === cat.id
                ? {
                    padding: '3px 8px',
                    borderColor: cat.color,
                    backgroundColor: `${cat.color}15`,
                    color: cat.color,
                  }
                : { padding: '3px 8px' }
            }
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Objectives List */}
      <div className="flex flex-col gap-3">
        <AnimatePresence>
          {backlogObjectives.map((obj, i) => {
            const cat = state.categories.find((c) => c.id === obj.categoryId);

            return (
              <motion.div
                key={obj.id}
                id={`objective-card-${obj.id}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  scale: highlightedObjectiveId === obj.id ? [1, 1.05, 1, 1.05, 1] : 1
                }}
                exit={{ opacity: 0, x: 100 }}
                transition={{ 
                  scale: highlightedObjectiveId === obj.id ? { duration: 1.2, ease: "easeInOut" } : undefined
                }}
                style={{ padding: '16px 10px' }}
                className={`group rounded-2xl bg-dark-700/50 border transition-all ${
                  highlightedObjectiveId === obj.id 
                    ? 'border-accent-cyan ring-4 ring-accent-cyan shadow-[0_0_35px_rgba(6,182,212,0.8)] z-20 bg-dark-700/80' 
                    : 'border-dark-400/40 hover:border-dark-400/60'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Category icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat?.color || '#94a3b8'}15` }}
                  >
                    <span className="text-xl">{cat?.icon || '📌'}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 
                      className="font-semibold text-sm text-dark-100"
                      style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                    >
                      {obj.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {cat && <Badge label={cat.label} color={cat.color} size="xs" />}
                      {obj.target > 0 && (
                        <span className="text-xs text-dark-500">
                          Cible : {obj.target}×
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditObjective(obj);
                          setShowForm(true);
                        }}
                        className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-600/50 transition-all"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(obj.id)}
                        className="p-2 rounded-lg text-dark-400 hover:text-accent-red hover:bg-dark-600/50 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {backlogObjectives.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-2xl bg-dark-700/50 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📋</span>
          </div>
          <h3 className="text-lg font-semibold text-dark-300 mb-2">
            {filterCategory ? 'Aucun objectif dans cette catégorie' : 'Backlog vide'}
          </h3>
          <p className="text-sm text-dark-500 mb-6">
            {filterCategory
              ? 'Essayez un autre filtre ou créez un nouvel objectif'
              : 'Les objectifs sans semaine assignée apparaîtront ici'}
          </p>
        </motion.div>
      )}

      {/* Spacer to allow scrolling past the floating action button */}
      <div className="h-32 flex-shrink-0" />

      {/* Form Modal */}
      <ObjectiveForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditObjective(null);
        }}
        editObjective={editObjective}
      />
    </div>
  );
}
