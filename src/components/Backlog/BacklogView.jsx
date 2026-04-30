import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Plus, ArrowRight, Calendar, Trash2, Pencil, Filter } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { getBacklogObjectives } from '../../utils/progressUtils';
import { getCurrentWeekId, formatWeekShort } from '../../utils/weekUtils';
import Badge from '../Shared/Badge';
import ObjectiveForm from '../Dashboard/ObjectiveForm';

export default function BacklogView() {
  const { state, dispatch } = useTarget();
  const [showForm, setShowForm] = useState(false);
  const [editObjective, setEditObjective] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [assignWeek, setAssignWeek] = useState(getCurrentWeekId());

  const backlogObjectives = useMemo(() => {
    let objectives = getBacklogObjectives(state.objectives);
    if (filterCategory) {
      objectives = objectives.filter((o) => o.categoryId === filterCategory);
    }
    return objectives;
  }, [state.objectives, filterCategory]);

  const handleAssign = (objectiveId) => {
    if (!assignWeek) return;
    dispatch({
      type: 'ASSIGN_OBJECTIVE',
      payload: { objectiveId, assignment: assignWeek },
    });
    setAssigningId(null);
  };

  const handleDelete = (objectiveId) => {
    dispatch({ type: 'DELETE_OBJECTIVE', payload: objectiveId });
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-violet/20 flex items-center justify-center">
              <Inbox size={22} className="text-accent-violet" />
            </div>
            Backlog
          </h1>
          <p className="text-sm text-dark-400 mt-1 ml-[52px]">
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
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-dark-100 text-dark-900 shadow-2xl flex items-center justify-center z-50 hover:bg-white transition-all duration-300 md:bottom-10 md:right-10"
      >
        <Plus size={28} strokeWidth={2.5} />
      </motion.button>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter size={16} className="text-dark-500 flex-shrink-0" />
        <button
          onClick={() => setFilterCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
              filterCategory === cat.id
                ? 'border'
                : 'text-dark-400 border border-dark-600/30 hover:text-dark-300'
            }`}
            style={
              filterCategory === cat.id
                ? {
                    borderColor: cat.color,
                    backgroundColor: `${cat.color}15`,
                    color: cat.color,
                  }
                : {}
            }
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Objectives List */}
      <div className="space-y-3">
        <AnimatePresence>
          {backlogObjectives.map((obj, i) => {
            const cat = state.categories.find((c) => c.id === obj.categoryId);
            const isAssigning = assigningId === obj.id;

            return (
              <motion.div
                key={obj.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 100 }}
                transition={{ delay: i * 0.03 }}
                className="group p-4 rounded-2xl bg-dark-700/50 border border-dark-600/30 hover:border-dark-500/50 transition-all"
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
                    <h3 className="font-semibold text-sm text-dark-100">{obj.title}</h3>
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
                    {isAssigning ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={assignWeek}
                          onChange={(e) => setAssignWeek(e.target.value)}
                          placeholder="2026-S18"
                          className="w-28 bg-dark-600/50 border border-dark-500/50 rounded-lg px-2.5 py-1.5 text-xs text-dark-100 focus:outline-none focus:border-accent-cyan/50"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAssign(obj.id);
                            if (e.key === 'Escape') setAssigningId(null);
                          }}
                        />
                        <button
                          onClick={() => handleAssign(obj.id)}
                          className="p-1.5 rounded-lg bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors"
                        >
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setAssigningId(obj.id)}
                          className="p-2 rounded-lg text-dark-400 hover:text-accent-cyan hover:bg-dark-600/50 transition-all"
                          title="Assigner à une semaine"
                        >
                          <Calendar size={16} />
                        </button>
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
                    )}
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
