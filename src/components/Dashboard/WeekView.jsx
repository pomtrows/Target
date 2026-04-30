import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Calendar, Trash2, Pencil } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { getCurrentWeekId, getAdjacentWeeks, formatWeekLabelParts, isCurrentWeek, getWeeksInMonth } from '../../utils/weekUtils';
import { getObjectivesForWeek, getWeekProgressPercent, isWeekComplete, getWeekProgress } from '../../utils/progressUtils';
import ProgressRing from './ProgressRing';
import ObjectiveCard from './ObjectiveCard';
import RewardBanner from './RewardBanner';
import ObjectiveForm from './ObjectiveForm';

export default function WeekView() {
  const { state, dispatch } = useTarget();
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeekId());
  const [showForm, setShowForm] = useState(false);
  const [editObjective, setEditObjective] = useState(null);
  const [direction, setDirection] = useState(0);

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
    dispatch({ type: 'DELETE_OBJECTIVE', payload: objectiveId });
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
      <div className="flex flex-col items-center" style={{ marginTop: '20px', marginBottom: '20px' }}>
        <ProgressRing progress={progress} size={160} strokeWidth={12} />
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

      {/* Floating Add button */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setEditObjective(null);
          setShowForm(true);
        }}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-dark-100 text-dark-900 shadow-2xl flex items-center justify-center z-50 transition-all duration-300 md:bottom-10 md:right-10"
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
    </div>
  );
}
