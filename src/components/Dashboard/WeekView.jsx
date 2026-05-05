import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Calendar, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { getCurrentWeekId, getAdjacentWeeks, formatWeekLabelParts, isCurrentWeek, getWeeksInMonth } from '../../utils/weekUtils';
import { getObjectivesForWeek, getWeekProgressPercent, isWeekComplete, getWeekProgress } from '../../utils/progressUtils';
import ProgressRing from './ProgressRing';
import ObjectiveCard from './ObjectiveCard';
import RewardBanner from './RewardBanner';
import ObjectiveForm from './ObjectiveForm';
import Modal from '../Shared/Modal';

export default function WeekView() {
  const { state, dispatch } = useTarget();
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeekId());
  const [showForm, setShowForm] = useState(false);
  const [editObjective, setEditObjective] = useState(null);
  const [direction, setDirection] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const objectives = useMemo(
    () => getObjectivesForWeek(state.objectives, currentWeek, getWeeksInMonth),
    [state.objectives, currentWeek]
  );

  const weekProgress = state.progress[currentWeek] || {};
  const progress = getWeekProgress(objectives, weekProgress);
  const progressPercent = getWeekProgressPercent(objectives, weekProgress);
  const unlocked = isWeekComplete(objectives, weekProgress) && objectives.length > 0;

  const { prev, next } = getAdjacentWeeks(currentWeek);

  const goToPrev = () => {
    setDirection(-1);
    setCurrentWeek(prev);
  };

  const goToNext = () => {
    setDirection(1);
    setCurrentWeek(next);
  };

  const goToCurrentWeek = () => {
    setDirection(0);
    setCurrentWeek(getCurrentWeekId());
  };

  const handleDelete = (objectiveId) => {
    const objective = state.objectives.find(o => o.id === objectiveId);
    setDeleteConfirm(objective || { id: objectiveId, title: 'cet objectif' });
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      dispatch({ type: 'DELETE_OBJECTIVE', payload: deleteConfirm.id });
      setDeleteConfirm(null);
    }
  };

  const handleEdit = (objective) => {
    setEditObjective(objective);
    setShowForm(true);
  };

  // Group objectives by category
  const groupedObjectives = useMemo(() => {
    const groups = {};
    objectives.forEach((obj) => {
      const cat = state.categories.find((c) => c.id === obj.categoryId);
      const key = cat?.id || 'autre';
      if (!groups[key]) {
        groups[key] = {
          category: cat || { id: 'autre', label: 'Autre', icon: '📌', color: '#94a3b8' },
          items: [],
        };
      }
      groups[key].items.push(obj);
    });
    return Object.values(groups);
  }, [objectives, state.categories]);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Week Navigation */}
      <div className="flex items-center justify-center gap-4 mb-16">
        <button
          onClick={goToPrev}
          className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-700/50 transition-all flex-shrink-0"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="text-center px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWeek}
              initial={{ opacity: 0, y: direction * 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: direction * -20 }}
              transition={{ duration: 0.2 }}
            >
              {(() => {
                const parts = formatWeekLabelParts(currentWeek);
                return (
                  <>
                    <h2 className="text-2xl font-bold text-dark-100 leading-tight">
                      {parts.title}
                    </h2>
                    <p className="text-base text-dark-400 mt-0.5">
                      {parts.dates}
                    </p>
                  </>
                );
              })()}
            </motion.div>
          </AnimatePresence>

          <div className="mt-2 min-h-[24px]">
            {isCurrentWeek(currentWeek) ? (
              <span className="inline-block text-xs font-medium text-accent-cyan bg-accent-cyan/10 px-3 py-1 rounded-full">
                Semaine en cours
              </span>
            ) : (
              <button
                onClick={goToCurrentWeek}
                className="text-xs text-accent-cyan hover:underline flex items-center gap-1 mx-auto"
              >
                <Calendar size={12} />
                Revenir à cette semaine
              </button>
            )}
          </div>
        </div>

        <button
          onClick={goToNext}
          className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-700/50 transition-all flex-shrink-0"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Progress Ring + Stats */}
      <div className="flex flex-col items-center relative" style={{ marginTop: '20px', marginBottom: '20px' }}>
        <ProgressRing progress={progress} size={160} strokeWidth={12} />
        
        {/* Desktop Add Button (Next to ring) */}
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setEditObjective(null);
            setShowForm(true);
          }}
          className="hidden md:flex absolute left-[calc(50%+200px)] top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-dark-100 text-dark-900 shadow-xl items-center justify-center transition-all duration-300"
        >
          <Plus size={28} strokeWidth={2.5} />
        </motion.button>

        <p className="mt-3 text-sm text-dark-400">
          {objectives.length === 0
            ? 'Aucun objectif cette semaine'
            : `${objectives.filter((o) => {
                const wp = weekProgress[o.id] || 0;
                const t = o.target || 1;
                return wp >= t;
              }).length} / ${objectives.length} objectifs complétés`
          }
        </p>
      </div>

      {/* Reward Banner */}
      <div className="group" style={{ marginBottom: '15px' }}>
        <RewardBanner weekId={currentWeek} isUnlocked={unlocked} />
      </div>

      {/* Objectives */}
      <div>
        {groupedObjectives.map((group, index) => (
          <div key={group.category.id} style={index > 0 ? { marginTop: '40px' } : {}}>
            <div className="flex items-center gap-4" style={{ marginBottom: '20px' }}>
              <span className="text-3xl">{group.category.icon}</span>
              <h3 className="text-lg font-bold uppercase tracking-widest" style={{ color: group.category.color }}>
                {group.category.label}
              </h3>
              <div className="flex-1 h-px bg-dark-700" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AnimatePresence>
                {group.items.map((obj, i) => (
                  <div key={obj.id} className="h-full p-2">
                    <ObjectiveCard
                      objective={obj}
                      weekId={currentWeek}
                      index={i}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {objectives.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >

          <h3 className="text-lg font-semibold text-dark-300 mb-2">Aucun objectif</h3>
          <p className="text-sm text-dark-500 mb-6">
            Ajoutez des objectifs pour commencer à tracker votre semaine
          </p>
        </motion.div>
      )}

      {/* Floating Add button (Mobile only) */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setEditObjective(null);
          setShowForm(true);
        }}
        className="md:hidden fixed bottom-8 right-8 w-14 h-14 rounded-full bg-dark-100 text-dark-900 shadow-2xl flex items-center justify-center z-50 transition-all duration-300"
      >
        <Plus size={28} strokeWidth={2.5} />
      </motion.button>

      {/* Form Modal */}
      <ObjectiveForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditObjective(null);
        }}
        weekId={currentWeek}
        editObjective={editObjective}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Supprimer l'objectif"
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
            L'objectif <strong className="text-dark-200">"{deleteConfirm?.title}"</strong> sera définitivement supprimé.
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
