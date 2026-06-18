import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Calendar, Trash2, Pencil, AlertTriangle, List, Clock, Check } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { getCurrentWeekId, getAdjacentWeeks, formatWeekLabelParts, isCurrentWeek, getWeeksInMonth } from '../../utils/weekUtils';
import { getObjectivesForWeek, getWeekProgressPercent, isWeekComplete, getWeekProgress, getObjectiveProgress, getProgressColor, countSetBits, isBitSet } from '../../utils/progressUtils';
import ProgressRing from './ProgressRing';
import ObjectiveCard from './ObjectiveCard';
import RewardBanner from './RewardBanner';
import ObjectiveForm from './ObjectiveForm';
import Modal from '../Shared/Modal';

const getObjectiveSchedule = (objective) => {
  const assignments = objective?.assignments || [];
  const daysStr = assignments.find(a => typeof a === 'string' && a.startsWith('days:'));
  const timeStr = assignments.find(a => typeof a === 'string' && a.startsWith('time:'));
  
  let days = [];
  if (daysStr) {
    days = daysStr.replace('days:', '').split(',').map(Number).filter(d => !isNaN(d));
  }
  
  let startTime = '';
  let endTime = '';
  if (timeStr) {
    const parts = timeStr.replace('time:', '').split('-');
    startTime = parts[0] || '';
    endTime = parts[1] || '';
  }
  
  return { days, startTime, endTime };
};

const compareTimes = (a, b) => {
  const schedA = getObjectiveSchedule(a);
  const schedB = getObjectiveSchedule(b);
  
  if (schedA.startTime && !schedB.startTime) return -1;
  if (!schedA.startTime && schedB.startTime) return 1;
  if (!schedA.startTime && !schedB.startTime) return 0;
  
  return schedA.startTime.localeCompare(schedB.startTime);
};

function CompactObjectiveCard({ objective, weekId, onEdit, onDelete }) {
  const { state, dispatch } = useTarget();
  const { startTime, endTime } = getObjectiveSchedule(objective);
  const weekProgress = state.progress[weekId] || {};
  const current = weekProgress[objective.id] || 0;
  
  const hasSubObjectives = Number(objective.target) === 1 && objective.subObjectives?.length > 0;
  const isCheckbox = objective.target < 1;
  const isChecked = current >= 1;
  
  const progress = getObjectiveProgress(objective, weekProgress);
  const isCompleted = progress >= 1;
  
  const category = state.categories.find((c) => c.id === objective.categoryId);
  const color = isCompleted ? '#22c55e' : getProgressColor(progress);

  const handleIncrement = (e) => {
    e.stopPropagation();
    dispatch({
      type: 'INCREMENT_PROGRESS',
      payload: { weekId, objectiveId: objective.id },
    });
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    dispatch({
      type: 'TOGGLE_PROGRESS',
      payload: { weekId, objectiveId: objective.id },
    });
  };

  const handleToggleSub = (subIndex, e) => {
    e.stopPropagation();
    dispatch({
      type: 'TOGGLE_SUB_OBJECTIVE',
      payload: { weekId, objectiveId: objective.id, subIndex },
    });
  };

  let timeText = '';
  if (startTime || endTime) {
    if (startTime && endTime) timeText = `${startTime} - ${endTime}`;
    else timeText = startTime || endTime;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group/card relative rounded-2xl bg-dark-800 border border-dark-600/60 hover:bg-dark-700/50 hover:border-dark-400/80 shadow-sm hover:shadow transition-all flex flex-col justify-between overflow-hidden flex-shrink-0"
      style={{ padding: '16px' }}
    >
      {/* Edit/Delete Icons (Visible on mobile, top right on hover for desktop) */}
      <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit?.(objective); }}
          className="p-1 rounded text-dark-300 hover:text-dark-100 hover:bg-dark-600/50 transition-all cursor-pointer"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(objective.id); }}
          className="p-1 rounded text-dark-400 hover:text-accent-red hover:bg-accent-red/10 transition-all cursor-pointer"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div>
        {/* Header: Time & Icon */}
        <div className="flex items-center justify-between gap-2 mb-2 pr-12">
          {timeText ? (
            <span className="text-[10px] font-bold text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Clock size={10} />
              {timeText}
            </span>
          ) : (
            <div />
          )}
          <span className="text-xs" title={category?.label}>{category?.icon}</span>
        </div>

        {/* Title */}
        <h4 
          className="text-sm font-bold text-dark-100 mb-2 leading-snug cursor-pointer hover:text-accent-cyan transition-colors font-sans"
          style={{ wordBreak: 'break-word' }}
          onClick={() => onEdit?.(objective)}
        >
          {objective.title}
        </h4>

        {/* Sub-objectives or checklist */}
        {hasSubObjectives && (
          <div className="space-y-1.5 mb-3">
            {objective.subObjectives.map((sub, i) => {
              const isSubChecked = isBitSet(current, i);
              return (
                <button
                  key={sub.id}
                  onClick={(e) => handleToggleSub(i, e)}
                  className="flex items-start gap-2 w-full text-left transition-colors cursor-pointer"
                >
                  <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                    isSubChecked
                      ? 'bg-accent-green/20 border-accent-green/50'
                      : 'border-dark-500 hover:border-dark-400'
                  }`}>
                    {isSubChecked && <Check size={8} className="text-accent-green" strokeWidth={4} />}
                  </div>
                  <span className={`text-[11px] leading-tight transition-all truncate ${isSubChecked ? 'text-dark-500 line-through' : 'text-dark-200'}`}>
                    {sub.title}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Progress & Quick Action */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex-1">
          {/* Progress bar / fraction */}
          {!hasSubObjectives && !isCheckbox && (
            <div className="flex items-center gap-1.5 text-xs text-dark-300">
              <span className={`font-semibold ${isCompleted ? 'text-accent-green' : 'text-dark-200'}`}>
                {current}/{objective.target}
              </span>
              <div className="h-1 flex-1 bg-dark-600/30 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )}

          {hasSubObjectives && (
            <div className="flex items-center gap-1.5 text-xs text-dark-300">
              <span className={`font-semibold ${isCompleted ? 'text-accent-green' : 'text-dark-200'}`}>
                {countSetBits(current)}/{objective.subObjectives.length}
              </span>
              <div className="h-1 flex-1 bg-dark-600/30 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )}

          {isCheckbox && (
            <div className="flex items-center gap-1 text-[11px] text-dark-400">
              <span className={isCompleted ? 'text-accent-green font-medium' : ''}>
                {isCompleted ? 'Complété' : 'Non complété'}
              </span>
            </div>
          )}
        </div>

        {/* Quick Action Button */}
        {!isCompleted && (
          <div className="flex-shrink-0">
            {isCheckbox ? (
              <button
                onClick={handleToggle}
                className="w-6 h-6 rounded-lg bg-dark-600/60 flex items-center justify-center text-dark-300 hover:bg-dark-600/90 hover:text-dark-100 transition-all cursor-pointer border-none"
              >
                <Check size={14} />
              </button>
            ) : !hasSubObjectives ? (
              <button
                onClick={handleIncrement}
                className="w-6 h-6 rounded-lg bg-dark-600/60 flex items-center justify-center text-dark-300 hover:bg-dark-600/90 hover:text-dark-100 transition-all cursor-pointer border-none"
              >
                <Plus size={14} />
              </button>
            ) : null}
          </div>
        )}

        {isCompleted && (
          <div className="w-6 h-6 rounded-full bg-accent-green/15 flex items-center justify-center text-accent-green flex-shrink-0">
            <Check size={12} strokeWidth={3} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function WeekView() {
  const { state, dispatch } = useTarget();
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeekId());
  const [showForm, setShowForm] = useState(false);
  const [editObjective, setEditObjective] = useState(null);
  const [direction, setDirection] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showPlanning, setShowPlanning] = useState(false);

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

    const categoryOrderMap = {};
    state.categories.forEach((cat, idx) => {
      categoryOrderMap[cat.id] = idx;
    });

    return Object.values(groups).sort((a, b) => {
      const orderA = categoryOrderMap[a.category.id] !== undefined ? categoryOrderMap[a.category.id] : 999;
      const orderB = categoryOrderMap[b.category.id] !== undefined ? categoryOrderMap[b.category.id] : 999;
      return orderA - orderB;
    });
  }, [objectives, state.categories]);

  const dayColumns = useMemo(() => [
    { id: 1, label: 'Lundi' },
    { id: 2, label: 'Mardi' },
    { id: 3, label: 'Mercredi' },
    { id: 4, label: 'Jeudi' },
    { id: 5, label: 'Vendredi' },
    { id: 6, label: 'Samedi' },
    { id: 7, label: 'Dimanche' },
    { id: 'unscheduled', label: 'Non planifiés' }
  ], []);

  return (
    <div 
      className={`mx-auto pb-28 transition-all duration-300 ${showPlanning ? 'max-w-7xl' : 'max-w-3xl'}`}
      style={showPlanning ? { paddingLeft: '3px', paddingRight: '3px' } : undefined}
    >
      {/* Week Navigation & Header Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-12 sm:mb-16 w-full relative">
        {/* Week navigation controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={goToPrev}
            className="p-2 rounded-xl text-dark-400 hover:text-accent-cyan hover:bg-dark-700/50 transition-all flex-shrink-0 border-none cursor-pointer"
          >
            <ChevronLeft size={32} />
          </button>

          <div className="text-center px-2 min-w-[180px]">
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
                  className="text-xs text-accent-cyan hover:underline flex items-center gap-1 mx-auto bg-transparent border-none cursor-pointer"
                >
                  <Calendar size={12} />
                  Revenir à cette semaine
                </button>
              )}
            </div>
          </div>

          <button
            onClick={goToNext}
            className="p-2 rounded-xl text-dark-400 hover:text-accent-cyan hover:bg-dark-700/50 transition-all flex-shrink-0 border-none cursor-pointer"
          >
            <ChevronRight size={32} />
          </button>
        </div>

        {/* Header Actions: Toggle view */}
        <div className="fixed top-[12px] left-1/2 -translate-x-1/2 z-[80] md:absolute md:top-1/2 md:right-0 md:-translate-y-1/2 md:left-auto md:translate-x-0 flex-shrink-0">
          <div 
            className="flex items-center gap-3 bg-dark-800/95 rounded-full border border-dark-600/30 backdrop-blur-md flex-shrink-0 shadow-sm"
            style={{ padding: '4px 6px' }}
          >
            <button
              onClick={() => setShowPlanning(false)}
              className={`flex items-center gap-1.5 rounded-full text-xs font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
                !showPlanning
                  ? 'bg-accent-cyan/15 text-accent-cyan'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
              style={{ padding: '3px 8px' }}
            >
              <List size={13} />
              <span>Liste</span>
            </button>
            <button
              onClick={() => setShowPlanning(true)}
              className={`flex items-center gap-1.5 rounded-full text-xs font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
                showPlanning
                  ? 'bg-accent-cyan/15 text-accent-cyan'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
              style={{ padding: '3px 8px' }}
            >
              <Calendar size={13} />
              <span>Planning</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Ring + Stats (Only in list view) */}
      {!showPlanning && (
        <div className="flex flex-col items-center relative" style={{ marginTop: '8px', marginBottom: '16px' }}>
          <ProgressRing progress={progress} size={160} strokeWidth={12} />
          
          {/* Desktop Add Button (Next to ring) */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setEditObjective(null);
              setShowForm(true);
            }}
            className="hidden md:flex absolute right-[72px] top-[80px] -translate-y-1/2 w-14 h-14 rounded-full bg-dark-100 text-dark-900 shadow-xl items-center justify-center transition-all duration-300 cursor-pointer border-none"
          >
            <Plus size={28} strokeWidth={2.5} />
          </motion.button>

          <p className="text-sm text-dark-400" style={{ marginTop: '8px' }}>
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
      )}

      {/* Reward Banner (Only in list view) */}
      {!showPlanning && (
        <div className="group" style={{ marginBottom: '12px' }}>
          <RewardBanner weekId={currentWeek} isUnlocked={unlocked} />
        </div>
      )}

      {/* Main Content Area */}
      {showPlanning ? (
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-300 mt-12 sm:mt-0"
          style={{ paddingLeft: '0px', paddingRight: '0px', marginTop: '24px' }}
        >
          {dayColumns.map((col) => {
            const items = objectives.filter((obj) => {
              const { days } = getObjectiveSchedule(obj);
              if (col.id === 'unscheduled') {
                return days.length === 0;
              }
              return days.includes(col.id);
            }).sort(compareTimes);

            return (
              <div 
                key={col.id} 
                className="glass rounded-3xl border border-dark-600/25 flex flex-col min-h-[220px]"
                style={{ padding: '16px 0' }}
              >
                <div 
                  className="flex items-center justify-between pb-2 border-b border-dark-600/15 mb-3"
                  style={{ marginLeft: '16px', marginRight: '16px' }}
                >
                  <h4 className="text-sm font-bold text-dark-200 tracking-wide">{col.label}</h4>
                  {items.length > 0 && (
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-accent-cyan/15 text-accent-cyan">
                      {items.length}
                    </span>
                  )}
                </div>
                <div 
                  className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar pb-2"
                  style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '4px' }}
                >
                  {items.map((obj) => (
                    <CompactObjectiveCard
                      key={`${col.id}-${obj.id}`}
                      objective={obj}
                      weekId={currentWeek}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="flex-1 flex items-center justify-center py-8 text-xs text-dark-500 border border-dashed border-dark-600/15 rounded-2xl mx-1">
                      Aucun objectif
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Objectives List grouped by category */
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

          {/* Empty state for list view */}
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
        </div>
      )}

      {/* Floating Add button (Always visible in planning view, mobile-only in list view) */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setEditObjective(null);
          setShowForm(true);
        }}
        className={`${showPlanning ? 'flex' : 'md:hidden flex'} fixed bottom-8 right-8 w-14 h-14 rounded-full bg-dark-100 text-dark-900 shadow-2xl items-center justify-center z-50 transition-all duration-300 cursor-pointer border-none`}
      >
        <Plus size={28} strokeWidth={2.5} />
      </motion.button>

      {/* Spacer to allow scrolling past the floating action button */}
      <div className="h-32 flex-shrink-0" />

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
