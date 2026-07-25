import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Calendar, Trash2, Pencil, AlertTriangle, List, Clock, Check, FileText, Columns3, Filter } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { useNotes } from '../../contexts/NotesContext';
import { useSettings } from '../../contexts/SettingsContext';
import NoteEditor from '../Notes/NoteEditor';
import { getCurrentWeekId, getAdjacentWeeks, formatWeekLabelParts, isCurrentWeek, getWeeksInMonth, getWeekDates, getWeekIdFromDate } from '../../utils/weekUtils';
import { getObjectivesForWeek, getWeekProgressPercent, isWeekComplete, getWeekProgress, getObjectiveProgress, getProgressColor, countSetBits, isBitSet, getWeekProgressByPriority } from '../../utils/progressUtils';
import ProgressRing from './ProgressRing';
import ObjectiveCard from './ObjectiveCard';
import RewardBanner from './RewardBanner';
import ObjectiveForm from './ObjectiveForm';
import Modal from '../Shared/Modal';
import AgendaView from './AgendaView';
import MonthView from './MonthView';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const { state: notesState, createFolder, createNote } = useNotes();
  const { startTime, endTime } = getObjectiveSchedule(objective);
  const weekProgress = state.progress[weekId] || {};
  const current = weekProgress[objective.id] || 0;
  
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [objectiveNoteId, setObjectiveNoteId] = useState(null);

  const handleOpenNotes = async (e) => {
    e.stopPropagation();
    
    // Find or create "Objectifs" folder
    let folder = notesState.folders.find(f => f.name === 'Objectifs');
    let folderId = folder?.id;
    
    if (!folderId) {
      try {
        const newFolder = await createFolder('Objectifs');
        folderId = newFolder.id;
      } catch (err) {
        console.error('Error creating Objectifs folder:', err);
        return;
      }
    }
    
    // Find or create note for this objective
    let note = notesState.notes.find(n => n.folder_id === folderId && n.title === objective.id);
    let noteId = note?.id;
    
    if (!noteId) {
      try {
        const newNote = await createNote(objective.id, folderId);
        noteId = newNote.id;
      } catch (err) {
        console.error('Error creating note for objective:', err);
        return;
      }
    }
    
    setObjectiveNoteId(noteId);
    setShowNotesModal(true);
  };

  const notesFolder = notesState.folders.find(f => f.name === 'Objectifs');
  const objectiveNote = notesFolder ? notesState.notes.find(n => n.folder_id === notesFolder.id && n.title === objective.id) : null;
  const hasNotes = !!(objectiveNote && objectiveNote.content && objectiveNote.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() !== '');

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
      <div>
        {/* Header: Time & Icon & Edit/Delete Actions */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {timeText ? (
            <span className="text-[10px] font-bold text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Clock size={10} />
              {timeText}
            </span>
          ) : (
            <div />
          )}
          
          <div className="flex items-center gap-3.5">
            {/* Edit/Delete Icons (Visible on mobile, hover-triggered for desktop) */}
            <div className="flex gap-3 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity z-10">
              <button
                onClick={handleOpenNotes}
                className={`p-1 rounded transition-all cursor-pointer border-none bg-transparent ${
                  hasNotes 
                    ? 'text-accent-cyan hover:bg-accent-cyan/10'
                    : 'text-dark-400 hover:text-dark-100 hover:bg-dark-600/50'
                }`}
                title={hasNotes ? "Voir les notes (contient du texte)" : "Prendre des notes"}
              >
                <FileText size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit?.(objective); }}
                className="p-1 rounded text-dark-300 hover:text-dark-100 hover:bg-dark-600/50 transition-all cursor-pointer border-none bg-transparent"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(objective.id); }}
                className="p-1 rounded text-dark-400 hover:text-accent-red hover:bg-accent-red/10 transition-all cursor-pointer border-none bg-transparent"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <span className="text-xs" title={category?.label}>{category?.icon}</span>
          </div>
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

      {showNotesModal && objectiveNoteId && (
        <Modal
          isOpen={showNotesModal}
          onClose={() => setShowNotesModal(false)}
          title={`Notes : ${objective.title}`}
          maxWidth="max-w-4xl"
        >
          <div className="h-[65vh] flex flex-col -m-5 overflow-hidden rounded-b-2xl">
            <NoteEditor noteId={objectiveNoteId} />
          </div>
        </Modal>
      )}
    </motion.div>
  );
}

export default function WeekView() {
  const { state, dispatch } = useTarget();
  const { maxColumns } = useSettings();
  const [searchParams] = useSearchParams();
  const weekParam = searchParams.get('week');
  const [currentWeek, setCurrentWeek] = useState(weekParam || getCurrentWeekId());

  useEffect(() => {
    if (weekParam && weekParam !== currentWeek) {
      setCurrentWeek(weekParam);
    }
  }, [weekParam]);

  // Déclencher le report automatique à chaque changement de semaine affichée
  useEffect(() => {
    dispatch({ type: 'TRIGGER_ROLLOVER' });
  }, [currentWeek, dispatch]);

  const [showForm, setShowForm] = useState(false);
  const [editObjective, setEditObjective] = useState(null);
  const [direction, setDirection] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('planning_view_mode') || 'list');
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [filterToday, setFilterToday] = useState(false);
  const [filterPriority, setFilterPriority] = useState(null);
  const [priorityFilterIds, setPriorityFilterIds] = useState(null);
  const [showPriorityBreakdown, setShowPriorityBreakdown] = useState(false);

  const objectives = useMemo(
    () => getObjectivesForWeek(state.objectives, currentWeek, getWeeksInMonth),
    [state.objectives, currentWeek]
  );

  const sortPriorities = useMemo(() => {
    const map = new Map();
    objectives.forEach(obj => map.set(obj.id, obj.priority || 'P3'));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterIncomplete, filterToday, filterPriority, currentWeek]);

  const weekProgress = state.progress[currentWeek] || {};
  const progress = getWeekProgress(objectives, weekProgress);
  const progressPercent = getWeekProgressPercent(objectives, weekProgress);
  const priorityProgress = useMemo(() => getWeekProgressByPriority(objectives, weekProgress), [objectives, weekProgress]);
  const unlocked = isWeekComplete(objectives, weekProgress, state.rewardThresholds || { P1: 100, P2: 100, P3: 100 }) && objectives.length > 0;

  useEffect(() => {
    const rewardItemLocked = state.rewardItems?.find(r => r.assigned_week === currentWeek && r.status === 'locked');
    const rewardItemUnlocked = state.rewardItems?.find(r => r.assigned_week === currentWeek && r.status === 'unlocked');

    if (unlocked && rewardItemLocked) {
      dispatch({ type: 'UPDATE_REWARD_ITEM', payload: { id: rewardItemLocked.id, status: 'unlocked' } });
    } else if (!unlocked && rewardItemUnlocked) {
      dispatch({ type: 'UPDATE_REWARD_ITEM', payload: { id: rewardItemUnlocked.id, status: 'locked' } });
    }
  }, [unlocked, currentWeek, state.rewardItems, dispatch]);

  const todayDayId = new Date().getDay() === 0 ? 7 : new Date().getDay();

  const filteredObjectives = useMemo(() => {
    return objectives.filter((obj) => {
      if (filterIncomplete) {
        const progress = getObjectiveProgress(obj, weekProgress);
        if (progress >= 1) return false;
      }
      if (filterToday) {
        const { days } = getObjectiveSchedule(obj);
        if (!days.includes(todayDayId)) return false;
      }
      if (filterPriority) {
        const matchesCurrent = (obj.priority || 'P3') === filterPriority;
        const matchedOriginally = priorityFilterIds ? priorityFilterIds.has(obj.id) : false;
        if (!matchesCurrent && !matchedOriginally) return false;
      }
      return true;
    });
  }, [objectives, filterIncomplete, filterToday, filterPriority, priorityFilterIds, weekProgress, todayDayId]);

  const { prev, next } = getAdjacentWeeks(currentWeek);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('planning_view_mode', mode);
  };

  const goToPrev = () => {
    setDirection(-1);
    if (viewMode === 'month') {
      const dates = getWeekDates(currentWeek);
      const date = dates ? new Date(dates.start) : new Date();
      date.setMonth(date.getMonth() - 1);
      setCurrentWeek(getWeekIdFromDate(date));
    } else {
      setCurrentWeek(prev);
    }
  };

  const goToNext = () => {
    setDirection(1);
    if (viewMode === 'month') {
      const dates = getWeekDates(currentWeek);
      const date = dates ? new Date(dates.start) : new Date();
      date.setMonth(date.getMonth() + 1);
      setCurrentWeek(getWeekIdFromDate(date));
    } else {
      setCurrentWeek(next);
    }
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
    filteredObjectives.forEach((obj) => {
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

    const priorityOrder = { 'P1': 1, 'P2': 2, 'P3': 3 };
    
    // Sort items within each group by their initial priority snapshot
    Object.values(groups).forEach(group => {
      group.items.sort((a, b) => {
        const pA = sortPriorities.get(a.id) || a.priority || 'P3';
        const pB = sortPriorities.get(b.id) || b.priority || 'P3';
        return priorityOrder[pA] - priorityOrder[pB];
      });
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
  }, [filteredObjectives, state.categories, sortPriorities]);

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

  const isWideLayout = viewMode !== 'list';

  return (
    <div className="mx-auto pb-28 transition-all duration-300 w-full flex flex-col items-center">
      {/* Week Navigation & Header Actions Wrapper */}
      <div className="max-w-7xl mx-auto px-[3px] w-full">
        <div className="flex items-center justify-center mb-12 sm:mb-16 w-full relative">
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
                key={currentWeek + viewMode}
                initial={{ opacity: 0, y: direction * 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction * -20 }}
                transition={{ duration: 0.2 }}
              >
                {(() => {
                  if (viewMode === 'month') {
                    const dates = getWeekDates(currentWeek);
                    const date = dates ? new Date(dates.start) : new Date();
                    const label = format(date, 'MMMM yyyy', { locale: fr });
                    return (
                      <>
                        <h2 className="text-2xl font-bold text-dark-100 leading-tight uppercase first-letter:capitalize">
                          {label}
                        </h2>
                        <p className="text-base text-dark-400 mt-0.5">
                          Vue mensuelle
                        </p>
                      </>
                    );
                  }
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
          </div>

          <button
            onClick={goToNext}
            className="p-2 rounded-xl text-dark-400 hover:text-accent-cyan hover:bg-dark-700/50 transition-all flex-shrink-0 border-none cursor-pointer"
          >
            <ChevronRight size={32} />
          </button>
        </div>

        {/* Header Actions: Toggle view */}
        {!showForm && (
          <div className="fixed top-[12px] left-1/2 -translate-x-1/2 z-[80] md:absolute md:top-1/2 md:right-[3px] md:-translate-y-1/2 md:left-auto md:translate-x-0 flex-shrink-0">
            <div 
              className="flex items-center gap-0.5 bg-dark-800/95 rounded-full border border-dark-600/30 backdrop-blur-md flex-shrink-0 shadow-sm"
              style={{ padding: '3px 4px' }}
            >
              <button
                onClick={() => handleViewModeChange('list')}
                className={`flex items-center gap-1 rounded-full text-[11px] font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
                  viewMode === 'list'
                    ? 'bg-accent-cyan/15 text-accent-cyan'
                    : 'text-dark-400 hover:text-dark-200'
                }`}
                style={{ padding: '3px 6px' }}
              >
                <List size={12} />
                <span>Liste</span>
              </button>
              <button
                onClick={() => handleViewModeChange('columns')}
                className={`flex items-center gap-1 rounded-full text-[11px] font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
                  viewMode === 'columns'
                    ? 'bg-accent-cyan/15 text-accent-cyan'
                    : 'text-dark-400 hover:text-dark-200'
                }`}
                style={{ padding: '3px 6px' }}
              >
                <Columns3 size={12} />
                <span>Jour</span>
              </button>
              <button
                onClick={() => handleViewModeChange('agenda')}
                className={`flex items-center gap-1 rounded-full text-[11px] font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
                  viewMode === 'agenda'
                    ? 'bg-accent-cyan/15 text-accent-cyan'
                    : 'text-dark-400 hover:text-dark-200'
                }`}
                style={{ padding: '3px 6px' }}
              >
                <Clock size={12} />
                <span>Semaine</span>
              </button>
              <button
                onClick={() => handleViewModeChange('month')}
                className={`flex items-center gap-1 rounded-full text-[11px] font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
                  viewMode === 'month'
                    ? 'bg-accent-cyan/15 text-accent-cyan'
                    : 'text-dark-400 hover:text-dark-200'
                }`}
                style={{ padding: '3px 6px' }}
              >
                <Calendar size={12} />
                <span>Mois</span>
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Progress Ring + Stats (Only in list view) - centered relative to max-w-7xl like the header */}
      {viewMode === 'list' && (
        <div className="max-w-7xl mx-auto px-[3px] w-full">
          <div className="flex flex-col items-center relative" style={{ marginTop: '8px', marginBottom: '16px' }}>
            <div 
              className="cursor-pointer hover:scale-105 transition-transform duration-300"
              onClick={() => setShowPriorityBreakdown(!showPriorityBreakdown)}
              title="Cliquez pour voir le détail par priorité"
            >
              <ProgressRing progress={progress} size={160} strokeWidth={12} />
            </div>
            
            <AnimatePresence>
              {showPriorityBreakdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0, marginTop: 16 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="w-full max-w-[280px] bg-dark-800 rounded-2xl border border-dark-600 shadow-2xl z-10"
                  style={{ padding: '14px' }}
                >
                  <div className="flex flex-col gap-4">
                    {['P1', 'P2', 'P3'].map(p => {
                      const prog = priorityProgress[p];
                      if (prog === null) return null;
                      const colorClass = p === 'P1' ? 'text-accent-red' : p === 'P2' ? 'text-accent-violet' : 'text-accent-cyan';
                      const bgClass = p === 'P1' ? 'bg-accent-red' : p === 'P2' ? 'bg-accent-violet' : 'bg-accent-cyan';
                      return (
                        <div key={p} className="flex flex-col gap-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className={`font-black ${colorClass}`}>{p}</span>
                            <div className="flex items-center justify-end gap-2 text-right">
                              <span className="font-bold text-dark-100 w-10">{prog.percent}%</span>
                              <span className="text-[11px] text-dark-400 font-normal w-12">({prog.completed}/{prog.total})</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-dark-700/50 rounded-full overflow-hidden">
                            <div className={`h-full ${bgClass} rounded-full transition-all duration-500`} style={{ width: `${prog.percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {priorityProgress.P1 === null && priorityProgress.P2 === null && priorityProgress.P3 === null && (
                      <div className="text-center text-xs text-dark-400 italic">Aucun objectif assigné</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
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
        </div>
      )}

      {/* Content wrapper with custom layouts */}
      <div className={viewMode === 'list' ? `${maxColumns === 4 ? 'max-w-7xl' : maxColumns === 3 ? 'max-w-5xl' : 'max-w-3xl'} mx-auto w-full px-4` : 'max-w-7xl mx-auto px-[3px] w-full'}>

        {/* Reward Banner (Only in list view) */}
        {viewMode === 'list' && (
          <div className="group" style={{ marginBottom: '12px' }}>
            <RewardBanner weekId={currentWeek} isUnlocked={unlocked} />
          </div>
        )}

        {/* Filters Bar (Only in list and columns views) */}
        {(viewMode === 'list' || viewMode === 'columns') && (
          <div 
            className="flex flex-wrap items-center justify-center gap-3 animate-in fade-in duration-300"
            style={{ marginTop: isWideLayout ? '12px' : '0px', marginBottom: '24px' }}
          >
            <button
              onClick={() => setFilterIncomplete(!filterIncomplete)}
              className={`flex items-center gap-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterIncomplete
                  ? 'bg-accent-violet/15 text-accent-violet border border-accent-violet/50 shadow-sm font-bold'
                  : 'bg-dark-800/40 text-dark-400 border border-dark-600/25 hover:border-dark-500/40 hover:text-dark-200'
              }`}
              style={{ padding: '5px 12px' }}
            >
              <Clock size={14} />
              <span>Non complétés</span>
            </button>

            <button
              onClick={() => {
                const newVal = !filterToday;
                setFilterToday(newVal);
                if (newVal) {
                  setCurrentWeek(getCurrentWeekId());
                }
              }}
              className={`flex items-center gap-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterToday
                  ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/50 shadow-sm font-bold'
                  : 'bg-dark-800/40 text-dark-400 border border-dark-600/25 hover:border-dark-500/40 hover:text-dark-200'
              }`}
              style={{ padding: '5px 12px' }}
            >
              <Calendar size={14} />
              <span>Aujourd'hui</span>
            </button>

            <button
              onClick={() => {
                let nextPriority = null;
                if (!filterPriority) nextPriority = 'P1';
                else if (filterPriority === 'P1') nextPriority = 'P2';
                else if (filterPriority === 'P2') nextPriority = 'P3';
                
                setFilterPriority(nextPriority);
                if (nextPriority) {
                  setPriorityFilterIds(new Set(objectives.filter(o => (o.priority || 'P3') === nextPriority).map(o => o.id)));
                } else {
                  setPriorityFilterIds(null);
                }
              }}
              className={`flex items-center gap-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterPriority
                  ? filterPriority === 'P1' ? 'bg-accent-red/15 text-accent-red border border-accent-red/50 shadow-sm font-bold'
                    : filterPriority === 'P2' ? 'bg-accent-violet/15 text-accent-violet border border-accent-violet/50 shadow-sm font-bold'
                    : 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/50 shadow-sm font-bold'
                  : 'bg-dark-800/40 text-dark-400 border border-dark-600/25 hover:border-dark-500/40 hover:text-dark-200'
              }`}
              style={{ padding: '5px 12px' }}
            >
              <Filter size={14} />
              <span>{filterPriority ? `Priorité ${filterPriority.replace('P', '')}` : 'Priorité'}</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {viewMode === 'columns' && (
          <div 
            className={`animate-in fade-in duration-300 mt-12 sm:mt-0 ${
              filterToday 
                ? 'flex justify-center max-w-md mx-auto w-full' 
                : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'
            }`}
            style={{ paddingLeft: '0px', paddingRight: '0px', marginTop: '24px' }}
          >
            {(filterToday ? dayColumns.filter((col) => col.id === todayDayId) : dayColumns).map((col) => {
              const items = filteredObjectives.filter((obj) => {
                const { days } = getObjectiveSchedule(obj);
                if (col.id === 'unscheduled') {
                  return days.length === 0;
                }
                return days.includes(col.id);
              }).sort(compareTimes);

              return (
                <div 
                  key={col.id} 
                  className="glass rounded-3xl border border-dark-600/25 flex flex-col min-h-[220px] w-full"
                  style={{ padding: '16px 0' }}
                >
                  <div 
                    className="flex items-center justify-between pb-2 border-b border-dark-600/15 mb-3"
                    style={{ marginLeft: '16px', marginRight: '16px' }}
                  >
                    <h4 className="text-sm font-bold text-dark-200 tracking-wide">{col.label}</h4>
                  </div>
                  <div 
                    className="flex flex-col gap-3 flex-1 pb-2"
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
        )}

        {viewMode === 'agenda' && (
          <div className="animate-in fade-in duration-300" style={{ marginTop: '24px' }}>
            <AgendaView 
              currentWeekId={currentWeek} 
              onEdit={handleEdit} 
              onDelete={handleDelete} 
            />
          </div>
        )}

        {viewMode === 'month' && (
          <div className="animate-in fade-in duration-300" style={{ marginTop: '24px' }}>
            <MonthView 
              currentWeekId={currentWeek} 
              onEdit={handleEdit} 
            />
          </div>
        )}

        {viewMode === 'list' && (
          /* Objectives List grouped by category */
          <div className="animate-in fade-in duration-300">
            {groupedObjectives.map((group, index) => (
              <div key={group.category.id} style={index > 0 ? { marginTop: '40px' } : {}}>
                <div className="flex items-center gap-4" style={{ marginBottom: '20px' }}>
                  <span className="text-3xl">{group.category.icon}</span>
                  <h3 className="text-lg font-bold uppercase tracking-widest" style={{ color: group.category.color }}>
                    {group.category.label}
                  </h3>
                  <div className="flex-1 h-px bg-dark-700" />
                </div>

                <div className={`grid gap-4 sm:grid-cols-2 ${maxColumns >= 3 ? 'lg:grid-cols-3' : ''} ${maxColumns >= 4 ? 'xl:grid-cols-4' : ''}`}>
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

      </div>

      {/* Floating Add button (Always visible in planning view, mobile-only in list view) */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setEditObjective(null);
          setShowForm(true);
        }}
        className={`${isWideLayout ? 'flex' : 'md:hidden flex'} fixed bottom-8 right-8 w-14 h-14 rounded-full bg-dark-100 text-dark-900 shadow-2xl items-center justify-center z-50 transition-all duration-300 cursor-pointer border-none`}
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
