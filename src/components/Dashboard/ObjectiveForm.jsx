import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Dumbbell, FileText, Paperclip, UserPlus, Check, FolderKanban } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSport } from '../../contexts/SportContext';
import { useNotes } from '../../contexts/NotesContext';
import { useProjects } from '../../contexts/ProjectsContext';
import Modal from '../Shared/Modal';
import NoteEditor from '../Notes/NoteEditor';
import AttachmentManager from '../Attachments/AttachmentManager';
import { getCurrentWeekId, getSelectableWeeks, formatWeekLabel } from '../../utils/weekUtils';

const getInitialSchedule = (objective) => {
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

const getInitialWeeks = (objective, defaultWeek) => {
  const assignments = objective?.assignments || [];
  const weeks = assignments.filter(a => typeof a === 'string' && !a.startsWith('days:') && !a.startsWith('time:'));
  return weeks;
};

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 6; h <= 22; h++) {
    const padH = String(h).padStart(2, '0');
    slots.push(`${padH}:00`);
    slots.push(`${padH}:30`);
  }
  slots.push('23:00');
  return slots;
})();

export default function ObjectiveForm({ isOpen, onClose, weekId = null, editObjective = null }) {
  const { state, dispatch } = useTarget();
  const { user } = useAuth();
  const { sessions } = useSport();
  const { state: notesState, createFolder, createNote } = useNotes();
  const { projects, updateProject } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const delegatableContacts = useMemo(() => {
    if (!state.contacts) return [];
    const seen = new Set();
    return state.contacts.filter(c => {
      if (c.status !== 'ACCEPTED') return false;
      if (!c.contact_user_id) return false;
      if (c.contact_user_id === user?.id) return false;
      if (c.contact_email && user?.email && c.contact_email.toLowerCase() === user.email.toLowerCase()) return false;
      if (seen.has(c.contact_user_id)) return false;
      seen.add(c.contact_user_id);
      return true;
    });
  }, [state.contacts, user]);

  const sortedCategories = useMemo(() => {
    return [...(state.categories || [])].sort((a, b) => {
      const isAutreA = a.id === 'autre' || a.label?.trim().toLowerCase() === 'autre';
      const isAutreB = b.id === 'autre' || b.label?.trim().toLowerCase() === 'autre';
      if (isAutreA && !isAutreB) return -1;
      if (!isAutreA && isAutreB) return 1;
      return 0;
    });
  }, [state.categories]);

  const initialSchedule = getInitialSchedule(editObjective);
  const initialWeeks = getInitialWeeks(editObjective, weekId);

  const [tempId, setTempId] = useState(() => editObjective?.id || `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);
  const [formNoteId, setFormNoteId] = useState(null);
  const [formAttachments, setFormAttachments] = useState(editObjective?.attachments || []);
  
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  
  const handleOpenNotes = async (e) => {
    e.preventDefault();
    
    let folder = notesState.folders.find(f => f.name === 'Objectifs');
    let folderId = folder?.id;
    
    if (!folderId) {
      try {
        const newFolder = await createFolder('Objectifs');
        folderId = newFolder.id;
      } catch (err) {
        console.error("Erreur création dossier Objectifs", err);
        return;
      }
    }
    
    const existingNote = notesState.notes.find(n => n.folder_id === folderId && n.title === tempId);
    let noteId = existingNote?.id;
    
    if (!noteId) {
      try {
        const newNote = await createNote(tempId, folderId);
        noteId = newNote.id;
      } catch (err) {
        console.error("Erreur création note", err);
        return;
      }
    }
    
    setFormNoteId(noteId);
    setShowNotesModal(true);
  };

  const [title, setTitle] = useState(editObjective?.title || '');
  const [target, setTarget] = useState(editObjective?.target || 1);
  const [categoryId, setCategoryId] = useState(editObjective?.categoryId || 'autre');
  const [priority, setPriority] = useState(editObjective?.priority || 'P3');
  const [sportSessionId, setSportSessionId] = useState(editObjective?.sportSessionId || '');
  const [assignedTo, setAssignedTo] = useState(editObjective?.assigned_to || '');
  const assignedContactName = useMemo(() => {
    if (!assignedTo) return null;
    const c = delegatableContacts.find(c => c.contact_user_id === assignedTo);
    if (c) {
      return (state.profiles && state.profiles[c.contact_user_id]?.display_name)
        || (state.profiles && state.profiles[c.contact_user_id]?.email)
        || c.contact_name
        || c.contact_email
        || 'Délégué';
    }
    if (state.profiles && state.profiles[assignedTo]) {
      return state.profiles[assignedTo].display_name || state.profiles[assignedTo].email || 'Délégué';
    }
    return 'Délégué';
  }, [assignedTo, delegatableContacts, state.profiles]);
  const [subObjectives, setSubObjectives] = useState(editObjective?.subObjectives || []);
  const [assignType, setAssignType] = useState(
    editObjective
      ? (initialWeeks.length > 0 ? 'week' : 'backlog')
      : (weekId ? 'week' : 'backlog')
  );
  
  const [assignWeeks, setAssignWeeks] = useState(
    initialWeeks.length > 0 
      ? initialWeeks 
      : (weekId ? [weekId] : [getCurrentWeekId()])
  );
  const [scheduleDays, setScheduleDays] = useState(initialSchedule.days);
  const [startTime, setStartTime] = useState(initialSchedule.startTime);
  const [endTime, setEndTime] = useState(initialSchedule.endTime);
  const [showPlanningSection, setShowPlanningSection] = useState(
    initialSchedule.days.length > 0 || !!initialSchedule.startTime || !!initialSchedule.endTime
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Dedicated planning modal states
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [tempDays, setTempDays] = useState([]);
  const [tempStartTime, setTempStartTime] = useState('');
  const [tempEndTime, setTempEndTime] = useState('');

  // Sync temp planning state when modal opens
  useEffect(() => {
    if (isPlanningModalOpen) {
      setTempDays(scheduleDays);
      setTempStartTime(startTime);
      setTempEndTime(endTime);
    }
  }, [isPlanningModalOpen, scheduleDays, startTime, endTime]);

  const handleTimeSlotClick = (time) => {
    if (!tempStartTime || (tempStartTime && tempEndTime)) {
      setTempStartTime(time);
      setTempEndTime('');
    } else {
      if (time > tempStartTime) {
        setTempEndTime(time);
      } else {
        setTempStartTime(time);
        setTempEndTime('');
      }
    }
  };

  const selectedDay = tempDays.length === 1 ? tempDays[0] : null;
  const otherPlannedObjectives = selectedDay 
    ? state.objectives.filter(obj => {
        if (editObjective && obj.id === editObjective.id) return false;
        
        const assignments = obj.assignments || [];
        const inCurrentWeek = assignments.includes(weekId);
        if (!inCurrentWeek) return false;
        
        const daysStr = assignments.find(a => typeof a === 'string' && a.startsWith('days:'));
        if (!daysStr) return false;
        
        const days = daysStr.replace('days:', '').split(',').map(Number);
        return days.includes(selectedDay);
      })
    : [];

  const getConflictForTime = (time) => {
    if (tempDays.length !== 1) return null;
    const day = tempDays[0];
    
    for (const obj of state.objectives) {
      if (editObjective && obj.id === editObjective.id) continue;
      
      const assignments = obj.assignments || [];
      const inCurrentWeek = assignments.includes(weekId);
      if (!inCurrentWeek) continue;
      
      const daysStr = assignments.find(a => typeof a === 'string' && a.startsWith('days:'));
      if (!daysStr) continue;
      const days = daysStr.replace('days:', '').split(',').map(Number);
      if (!days.includes(day)) continue;
      
      const timeStr = assignments.find(a => typeof a === 'string' && a.startsWith('time:'));
      if (!timeStr) continue;
      
      const parts = timeStr.replace('time:', '').split('-');
      const start = parts[0];
      const end = parts[1];
      
      if (start && end && time >= start && time < end) {
        return obj;
      }
    }
    return null;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync state when editObjective or isOpen changes
  useEffect(() => {
    if (isOpen) {
      const initSched = getInitialSchedule(editObjective);
      const initWks = getInitialWeeks(editObjective, weekId);

      setTempId(editObjective?.id || `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);
      setFormNoteId(null);
      setFormAttachments(editObjective?.attachments || []);
      setTitle(editObjective?.title || '');
      setTarget(editObjective?.target || 1);
      setCategoryId(editObjective?.categoryId || 'autre');
      setPriority(editObjective?.priority || 'P3');
      setSportSessionId(editObjective?.sportSessionId || '');
      const matchedProj = (projects || []).find(p => (p.objectiveIds || []).includes(editObjective?.id) || p.id === editObjective?.projectId);
      setSelectedProjectId(matchedProj ? matchedProj.id : '');
      setAssignedTo(editObjective?.assigned_to || '');
      setSubObjectives(editObjective?.subObjectives || []);
      setAssignType(
        editObjective
          ? (initWks.length > 0 ? 'week' : 'backlog')
          : (weekId ? 'week' : 'backlog')
      );
      setAssignWeeks(
        initWks.length > 0 
          ? initWks 
          : (weekId ? [weekId] : [getCurrentWeekId()])
      );
      setScheduleDays(initSched.days);
      setStartTime(initSched.startTime);
      setEndTime(initSched.endTime);
      setShowPlanningSection(initSched.days.length > 0 || !!initSched.startTime || !!initSched.endTime);
    }
  }, [isOpen, editObjective, weekId]);

  const addSubObjective = () => {
    setSubObjectives([...subObjectives, { id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, title: '' }]);
  };

  const removeSubObjective = (id) => {
    setSubObjectives(subObjectives.filter(s => s.id !== id));
  };

  const updateSubObjective = (id, title) => {
    setSubObjectives(subObjectives.map(s => s.id === id ? { ...s, title } : s));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const assignments = [];
    const isScheduled = scheduleDays.length > 0 || startTime || endTime;
    const finalAssignType = isScheduled ? 'week' : assignType;

    if (finalAssignType === 'week' && assignWeeks.length > 0) {
      assignments.push(...assignWeeks);
    }

    // Add schedule info
    if (scheduleDays.length > 0) {
      assignments.push(`days:${scheduleDays.join(',')}`);
    }
    if (startTime || endTime) {
      assignments.push(`time:${startTime}-${endTime}`);
    }

    // Only keep sub-objectives if target is 1 and they have a title
    const finalSubObjectives = Number(target) === 1 
      ? subObjectives.filter(s => s.title.trim() !== '')
      : [];

    console.log('--- Submitting Objective ---');
    console.log('Title:', title);
    console.log('assignType:', assignType);
    console.log('assignWeeks:', assignWeeks);
    console.log('scheduleDays:', scheduleDays);
    console.log('startTime:', startTime);
    console.log('endTime:', endTime);
    console.log('Generated assignments:', assignments);

    if (editObjective) {
      dispatch({
        type: 'UPDATE_OBJECTIVE',
        payload: {
          id: editObjective.id,
          title: title.trim(),
          target: Number(target),
          categoryId,
          priority,
          sportSessionId: sportSessionId || null,
          assignments,
          subObjectives: finalSubObjectives,
          attachments: formAttachments,
          assigned_to: assignedTo || null,
          assignment_status: assignedTo ? 'PENDING' : null
        },
      });
    } else {
      dispatch({
        type: 'ADD_OBJECTIVE',
        payload: {
          id: tempId,
          title: title.trim(),
          target: Number(target),
          categoryId,
          priority,
          sportSessionId: sportSessionId || null,
          assignments,
          subObjectives: finalSubObjectives,
          attachments: formAttachments,
          assigned_to: assignedTo || null,
          assignment_status: assignedTo ? 'PENDING' : null
        },
      });
    }

    // Update project affiliation
    const savedObjId = editObjective ? editObjective.id : tempId;
    (projects || []).forEach(p => {
      const hasObj = (p.objectiveIds || []).includes(savedObjId);
      if (p.id === selectedProjectId && !hasObj) {
        updateProject(p.id, { objectiveIds: [...(p.objectiveIds || []), savedObjId] });
      } else if (p.id !== selectedProjectId && hasObj) {
        updateProject(p.id, { objectiveIds: (p.objectiveIds || []).filter(id => id !== savedObjId) });
      }
    });

    onClose();
    // Reset
    setTempId(`obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);
    setSelectedProjectId('');
    setFormNoteId(null);
    setFormAttachments([]);
    setTitle('');
    setTarget(1);
    setCategoryId('autre');
    setPriority('P3');
    setSportSessionId('');
    setAssignedTo('');
    setSubObjectives([]);
    setScheduleDays([]);
    setStartTime('');
    setEndTime('');
    setShowPlanningSection(false);
    setAssignType(weekId ? 'week' : 'backlog');
    setAssignWeeks(weekId ? [weekId] : [getCurrentWeekId()]);
    setIsDropdownOpen(false);
  };

  const selectedCategory = state.categories.find(c => c.id === categoryId);
  const isSportCategory = selectedCategory && (selectedCategory.id === 'sport' || selectedCategory.label.toLowerCase() === 'sport');

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editObjective ? 'Modifier l\'objectif' : 'Nouvel objectif'}
        closeOnOutsideClick={false}
        centerTitle={true}
        headerPadding="10px 16px 4px 16px"
        bodyPadding="2px 16px 14px 16px"
        className="h-[90dvh] sm:h-auto"
      >
      <form 
        onSubmit={handleSubmit} 
        style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
      >
        {/* Title */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              const val = e.target.value;
              setTitle(val.charAt(0).toUpperCase() + val.slice(1));
            }}
            placeholder="Ex: Courir, Lire, Méditer..."
            aria-label="Titre de l'objectif"
            autoFocus
            className="w-full bg-dark-700/50 border border-dark-600/50 rounded-xl py-2.5 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-cyan/50 transition-colors"
            style={{ paddingLeft: '16px', paddingRight: '16px' }}
          />
        </div>

        <div className="flex gap-4 items-end">
          {/* Target quantity */}
          <div className="w-24">
            <label className="block text-center text-sm font-medium text-dark-200 mb-2 truncate">
              Cible
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full text-center bg-dark-700/50 border border-dark-600/50 rounded-xl py-2.5 text-sm text-dark-100 focus:outline-none focus:border-accent-cyan/50 transition-colors"
            />
          </div>

          {/* Priority */}
          <div className="w-24">
            <label className="block text-center text-sm font-medium text-dark-200 mb-2 truncate">
              Priorité
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full text-center bg-dark-700/50 border border-dark-600/50 rounded-xl py-2.5 text-sm font-bold focus:outline-none focus:border-accent-cyan/50 transition-colors"
              style={{
                textAlignLast: 'center',
                color: priority === 'P1' ? 'var(--color-accent-red, #ef4444)' :
                       priority === 'P2' ? 'var(--color-accent-violet, #8b5cf6)' :
                       'var(--color-accent-cyan, #06b6d4)'
              }}
            >
              <option value="P1" className="text-accent-red font-bold">P1</option>
              <option value="P2" className="text-accent-violet font-bold">P2</option>
              <option value="P3" className="text-accent-cyan font-bold">P3</option>
            </select>
          </div>

          {/* Sub-objectives Button */}
          {Number(target) === 1 && (
            <button
              type="button"
              onClick={addSubObjective}
              className="flex-1 h-[42px] px-3 sm:px-4 rounded-xl text-xs font-bold text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 hover:bg-accent-cyan/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Plus size={16} className="shrink-0" /> Sous-tâches
            </button>
          )}
        </div>

        {/* Sub-objectives List */}
        {Number(target) === 1 && subObjectives.length > 0 && (
          <div className="space-y-3 bg-dark-900/30 p-4 rounded-2xl border border-dark-600/20">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-dark-400 uppercase tracking-wider">
                Sous-tâches
              </label>
              <span className="text-[10px] text-dark-500">{subObjectives.length} étape{subObjectives.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {subObjectives.map((sub, index) => (
                <div key={sub.id} className="flex gap-2">
                  <input
                    type="text"
                    value={sub.title}
                    onChange={(e) => updateSubObjective(sub.id, e.target.value)}
                    placeholder={`Étape ${index + 1}...`}
                    className="flex-1 bg-dark-800/50 border border-dark-600/30 rounded-xl py-2 text-sm text-dark-100 placeholder-dark-600 focus:outline-none focus:border-accent-cyan/30 transition-colors"
                    style={{ paddingLeft: '15px', paddingRight: '12px' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeSubObjective(sub.id)}
                    className="p-2 text-dark-500 hover:text-accent-red transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

         {/* Category */}
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-1.5">
            Catégorie
          </label>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {sortedCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={`flex items-center gap-2 rounded-xl text-sm transition-all border ${
                  categoryId === cat.id
                    ? ''
                    : 'border-dark-600/30 hover:border-dark-500/50'
                }`}
                style={
                  categoryId === cat.id
                    ? {
                        borderColor: cat.color,
                        backgroundColor: `${cat.color}15`,
                        color: cat.color,
                        padding: '0px 8px',
                      }
                    : { color: 'var(--color-dark-200)', padding: '0px 8px' }
                }
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="text-sm font-medium">{cat.label}</span>
              </button>
            ))}
          </div>

          {isSportCategory && (
            <div className="mt-4 bg-accent-cyan/5 p-4 rounded-2xl border border-accent-cyan/20 transition-all">
              <label className="block text-xs font-bold text-accent-cyan mb-2 flex items-center gap-2">
                <Dumbbell size={14} /> Associer une séance de sport (Optionnel)
              </label>
              <select
                value={sportSessionId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSportSessionId(val);
                  if (!title.trim() && val) {
                    const selectedSession = sessions.find(s => s.id === val);
                    if (selectedSession) setTitle(selectedSession.name);
                  }
                }}
                className="w-full bg-dark-800 border border-dark-600/50 rounded-xl py-2.5 px-3 text-sm text-dark-100 focus:outline-none focus:border-accent-cyan/50 transition-colors"
              >
                <option value="">-- Aucune séance associée --</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.exercises?.length || 0} ex)</option>
                ))}
              </select>
            </div>
          )}

          {/* Rattacher à un Projet (Optionnel) */}
          {(projects || []).length > 0 && (
            <div className="mt-3 bg-dark-900/40 p-3 rounded-2xl border border-dark-600/30">
              <label className="block text-xs font-bold text-dark-200 mb-1.5 flex items-center gap-1.5">
                <FolderKanban size={14} className="text-accent-cyan" /> Rattacher à un projet (Optionnel)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-dark-800 border border-dark-600/50 rounded-xl py-2 px-3 text-xs text-dark-100 focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer"
              >
                <option value="">-- Aucun projet (objectif autonome) --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    📁 {p.name} ({p.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>


        {/* Assignment (Week/Backlog) */}
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-3">
            Planifier
          </label>
          <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 mb-4">
            <button
              type="button"
              onClick={() => setAssignType('week')}
              className={`rounded-xl text-xs sm:text-sm font-medium transition-all ${
                assignType === 'week'
                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                  : 'bg-dark-700/50 text-dark-400 border border-dark-600/30 hover:text-dark-300'
              }`}
              style={{ padding: '6px 12px' }}
            >
              📅 Semaine
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlanningModalOpen(true);
                setAssignType('week');
              }}
              className={`rounded-xl text-xs sm:text-sm font-medium transition-all ${
                showPlanningSection
                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                  : 'bg-dark-700/50 text-dark-400 border border-dark-600/30 hover:text-dark-300'
              }`}
              style={{ padding: '6px 12px' }}
            >
              📅 Jour/heure
            </button>
            <button
              type="button"
              onClick={() => setAssignType('backlog')}
              className={`rounded-xl text-xs sm:text-sm font-medium transition-all ${
                assignType === 'backlog'
                  ? 'bg-accent-violet/20 text-accent-violet border border-accent-violet/30'
                  : 'bg-dark-700/50 text-dark-400 border border-dark-600/30 hover:text-dark-300'
              }`}
              style={{ padding: '6px 12px' }}
            >
              📋 Backlog
            </button>
          </div>

          {/* Planning Summary Card */}
          {showPlanningSection && assignType === 'week' && (
            <div className="bg-dark-900/30 p-4 rounded-2xl border border-dark-600/20 flex items-center justify-between mb-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">
                  Planification
                </span>
                <span className="text-sm text-dark-200">
                  {scheduleDays.length > 0
                    ? `${scheduleDays.map(d => ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][d - 1]).join(', ')}`
                    : 'Aucun jour sélectionné'}
                  {startTime || endTime ? ` à ${startTime || '00:00'} - ${endTime || '23:59'}` : ''}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlanningModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 hover:bg-accent-cyan/20 transition-all"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPlanningSection(false);
                    setScheduleDays([]);
                    setStartTime('');
                    setEndTime('');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-accent-red bg-accent-red/10 border border-accent-red/20 hover:bg-accent-red/20 transition-all"
                >
                  Retirer
                </button>
              </div>
            </div>
          )}

          {assignType === 'week' && (
            <div className="relative mt-4" style={{ marginTop: '16px' }} ref={dropdownRef}>
              <button 
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between bg-dark-700/50 border border-dark-600/50 rounded-xl py-2.5 text-sm text-dark-100 focus:outline-none focus:border-accent-cyan/50 transition-colors"
                style={{ paddingLeft: '16px', paddingRight: '16px' }}
              >
                <span className="truncate">
                  {assignWeeks.length === 0 
                    ? "Sélectionner des semaines..." 
                    : assignWeeks.length === 1 
                      ? formatWeekLabel(assignWeeks[0]) 
                      : `${assignWeeks.length} semaines sélectionnées`}
                </span>
                <span className="text-dark-400 text-xs">▼</span>
              </button>

              {isDropdownOpen && (
                <div className="absolute z-10 bottom-full left-0 right-0 mb-2 max-h-60 overflow-y-auto bg-dark-800 border border-dark-600/50 rounded-xl shadow-xl p-2 space-y-1">
                  {getSelectableWeeks(4, 52).map(week => (
                    <label key={week} className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-700/50 cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={assignWeeks.includes(week)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignWeeks([...assignWeeks, week]);
                          } else {
                            setAssignWeeks(assignWeeks.filter(w => w !== week));
                          }
                        }}
                        className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-cyan focus:ring-accent-cyan/50 focus:ring-offset-dark-800"
                      />
                      <span className={`text-sm ${assignWeeks.includes(week) ? 'text-accent-cyan font-medium' : 'text-dark-200'}`}>
                        {formatWeekLabel(week)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Note, Attachments & Delegation */}
        <div className="flex flex-wrap gap-2.5 sm:gap-3 pt-3 mt-1.5">
          <button
            type="button"
            onClick={handleOpenNotes}
            className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
              (formNoteId || (() => {
                const notesFolder = notesState.folders.find(f => f.name === 'Objectifs');
                const objectiveNote = notesFolder ? notesState.notes.find(n => n.folder_id === notesFolder.id && n.title === tempId) : null;
                return !!(objectiveNote && objectiveNote.content && objectiveNote.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() !== '');
              })())
                ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30' 
                : 'bg-dark-800/40 text-dark-300 border border-dark-600/30 hover:bg-dark-700/50 hover:text-dark-200'
            }`}
          >
            <FileText size={16} className="shrink-0" />
            <span>Note</span>
          </button>
          
          <button
            type="button"
            onClick={() => setShowAttachmentsModal(true)}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
              formAttachments.length > 0 
                ? 'bg-accent-violet/15 text-accent-violet border border-accent-violet/30' 
                : 'bg-dark-800/40 text-dark-300 border border-dark-600/30 hover:bg-dark-700/50 hover:text-dark-200'
            }`}
          >
            <Paperclip size={16} className="shrink-0" />
            <span className="truncate">Pièces jointes {formAttachments.length > 0 && `(${formAttachments.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDelegateModal(true)}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
              assignedTo
                ? 'bg-accent-green/15 text-accent-green border border-accent-green/30' 
                : 'bg-dark-800/40 text-dark-300 border border-dark-600/30 hover:bg-dark-700/50 hover:text-dark-200'
            }`}
          >
            <UserPlus size={16} className="shrink-0" />
            <span className="truncate">
              {assignedContactName ? assignedContactName : 'Déléguer'}
            </span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-dark-400 bg-dark-700/50 border border-dark-600/30 hover:text-dark-200 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-accent-cyan to-accent-violet hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {editObjective ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </form>
      </Modal>

      {/* Dedicated Planning Modal */}
      <Modal
        isOpen={isPlanningModalOpen}
        onClose={() => setIsPlanningModalOpen(false)}
        title="Planification de l'objectif"
        maxWidth="max-w-md"
        closeOnOutsideClick={false}
      >
        <div className="flex flex-col gap-5" style={{ marginTop: '-10px' }}>

          {/* Days selector */}
          <div className="flex flex-col gap-3">
            <label className="block text-xs font-bold text-dark-400 uppercase tracking-wider">
              Jours de la semaine
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day, idx) => {
                const dayNum = idx + 1;
                const isSelected = tempDays.includes(dayNum);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setTempDays(tempDays.filter(d => d !== dayNum));
                      } else {
                        setTempDays([...tempDays, dayNum].sort());
                      }
                    }}
                    className={`py-3 rounded-xl text-xs font-bold transition-all border cursor-pointer text-center ${
                      isSelected
                        ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan shadow-lg shadow-accent-cyan/10'
                        : 'bg-dark-800/40 border-dark-600/30 text-dark-300 hover:border-dark-500/50'
                    } ${idx === 6 ? 'col-span-2' : ''}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visual Agenda / Timeline (Outlook style) */}
          <div className="flex flex-col gap-3">
            <label className="block text-xs font-bold text-dark-400 uppercase tracking-wider">
              Créneau horaire (Vue Agenda)
            </label>
            <div className="border border-dark-600/35 rounded-xl bg-dark-900/40 overflow-hidden">
              <div 
                style={{ padding: '5px 10px' }} 
                className="bg-dark-800/80 border-b border-dark-600/35 flex justify-between items-center text-xs font-bold text-dark-300 uppercase"
              >
                <span>Sélection Agenda</span>
                <span className="text-accent-cyan font-mono">
                  {tempStartTime && tempEndTime 
                    ? `De ${tempStartTime} à ${tempEndTime}` 
                    : tempStartTime 
                      ? `Début à ${tempStartTime} (cliquez sur l'heure de fin)`
                      : 'Choisissez un créneau'
                  }
                </span>
              </div>
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2 space-y-1 bg-dark-950/20">
                {TIME_SLOTS.map((time) => {
                  const isStart = tempStartTime === time;
                  const isEnd = tempEndTime === time;
                  const isInRange = tempStartTime && tempEndTime && time > tempStartTime && time < tempEndTime;
                  const isSelected = isStart || isEnd || isInRange;
                  const conflictObj = getConflictForTime(time);
                  const cat = conflictObj ? state.categories.find(c => c.id === conflictObj.categoryId) : null;

                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleTimeSlotClick(time)}
                      className={`w-full flex items-center gap-4 px-3 py-1.5 rounded-lg text-left transition-all border cursor-pointer ${
                        isStart
                          ? 'bg-accent-cyan/25 border-accent-cyan text-accent-cyan font-bold shadow-sm'
                          : isEnd
                            ? 'bg-accent-violet/25 border-accent-violet text-accent-violet font-bold shadow-sm'
                            : isInRange
                              ? 'bg-accent-cyan/10 border-accent-cyan/20 text-accent-cyan/85'
                              : conflictObj
                                ? 'bg-dark-800/20 border-dashed border-dark-700/50 text-dark-400 opacity-60 hover:opacity-95'
                                : 'bg-transparent border-transparent text-dark-300 hover:bg-dark-850/50 hover:border-dark-700/30'
                      }`}
                    >
                      <span className="text-xs font-mono w-10 flex-shrink-0 text-dark-400">
                        {time}
                      </span>
                      <span className="flex-1 text-[11px] font-medium flex items-center gap-1.5">
                        {conflictObj ? (
                          <>
                            <span style={{ color: cat?.color }}>
                              {cat?.icon || '📅'}
                            </span>
                            <span className="font-semibold text-dark-300">{conflictObj.title}</span>
                            <span className="text-[10px] text-dark-500">(Déjà planifié)</span>
                          </>
                        ) : (
                          isStart ? '🏁 Heure de début' : isEnd ? '🛑 Heure de fin' : isInRange ? '⚡ Durée réservée' : ''
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Time fields (Precise Adjustment) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-dark-400 uppercase tracking-wider mb-2">
                Ajustement Début
              </label>
              <input
                type="time"
                value={tempStartTime}
                onChange={(e) => setTempStartTime(e.target.value)}
                className="w-full bg-dark-800/50 border border-dark-600/35 rounded-xl py-2 px-3 text-sm text-dark-100 focus:outline-none focus:border-accent-cyan/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-dark-400 uppercase tracking-wider mb-2">
                Ajustement Fin
              </label>
              <input
                type="time"
                value={tempEndTime}
                onChange={(e) => setTempEndTime(e.target.value)}
                className="w-full bg-dark-800/50 border border-dark-600/35 rounded-xl py-2 px-3 text-sm text-dark-100 focus:outline-none focus:border-accent-cyan/50"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-dark-600/20">
            <button
              type="button"
              onClick={() => {
                setTempDays([]);
                setTempStartTime('');
                setTempEndTime('');
              }}
              style={{ padding: '5px 12px' }}
              className="rounded-xl text-xs font-semibold text-accent-red bg-accent-red/10 border border-accent-red/25 hover:bg-accent-red/20 transition-all cursor-pointer"
            >
              Réinitialiser
            </button>
            <div className="flex-1 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsPlanningModalOpen(false)}
                style={{ padding: '5px 12px' }}
                className="rounded-xl text-xs font-medium text-dark-400 hover:text-dark-200 cursor-pointer bg-transparent border-none"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setScheduleDays(tempDays);
                  setStartTime(tempStartTime);
                  setEndTime(tempEndTime);
                  if (tempDays.length > 0 || tempStartTime || tempEndTime) {
                    setShowPlanningSection(true);
                    setAssignType('week');
                  } else {
                    setShowPlanningSection(false);
                  }
                  setIsPlanningModalOpen(false);
                }}
                style={{ padding: '5px 12px' }}
                className="rounded-xl text-xs font-bold text-white bg-gradient-to-r from-accent-cyan to-accent-violet hover:opacity-90 transition-opacity cursor-pointer border-none"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Notes Modal */}
      {showNotesModal && formNoteId && (
        <Modal 
          isOpen={true} 
          onClose={() => setShowNotesModal(false)}
          title={`Notes: ${title || 'Nouvel objectif'}`}
          maxWidth="max-w-4xl"
        >
          <div className="h-[65vh] flex flex-col -m-5 overflow-hidden rounded-b-2xl">
            <NoteEditor 
              noteId={formNoteId} 
              onClose={() => setShowNotesModal(false)} 
            />
          </div>
        </Modal>
      )}

      {/* Attachments Modal */}
      {showAttachmentsModal && (
        <AttachmentManager
          isOpen={true}
          onClose={() => setShowAttachmentsModal(false)}
          objective={{ id: tempId, attachments: formAttachments }}
          onUpdate={(updates) => setFormAttachments(updates.attachments)}
        />
      )}

      {/* Delegate Modal */}
      {showDelegateModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowDelegateModal(false)}
          title="Déléguer à un contact"
          maxWidth="max-w-md"
          closeOnOutsideClick={true}
          centerTitle={true}
        >
          <div className="flex flex-col gap-2 py-1">
            {/* Tâche personnelle (Non assigné) */}
            <button
              type="button"
              onClick={() => {
                setAssignedTo('');
                setShowDelegateModal(false);
              }}
              className={`flex items-center justify-between p-3 rounded-xl transition-all text-left border ${
                !assignedTo
                  ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan'
                  : 'bg-dark-800/40 border-dark-600/30 text-dark-200 hover:bg-dark-700/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-dark-700/70 border border-dark-600/50 flex items-center justify-center text-sm font-bold text-dark-300">
                  👤
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-100">Tâche personnelle</p>
                  <p className="text-xs text-dark-400">Non assigné à un contact</p>
                </div>
              </div>
              {!assignedTo && <Check size={18} className="text-accent-cyan shrink-0" />}
            </button>

            {delegatableContacts.length > 0 && (
              <div className="mt-2 mb-1 px-1">
                <p className="text-xs font-bold text-dark-400 uppercase tracking-wider">
                  Contacts ({delegatableContacts.length})
                </p>
              </div>
            )}

            {delegatableContacts.map((c) => {
              const displayName = (state.profiles && state.profiles[c.contact_user_id]?.display_name)
                || (state.profiles && state.profiles[c.contact_user_id]?.email)
                || c.contact_name
                || c.contact_email
                || 'Contact';
              const email = (state.profiles && state.profiles[c.contact_user_id]?.email) || c.contact_email || '';
              const isSelected = assignedTo === c.contact_user_id;

              return (
                <button
                  key={c.contact_user_id}
                  type="button"
                  onClick={() => {
                    setAssignedTo(c.contact_user_id);
                    setShowDelegateModal(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all text-left border ${
                    isSelected
                      ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan'
                      : 'bg-dark-800/40 border-dark-600/30 text-dark-200 hover:bg-dark-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center text-xs font-bold text-accent-cyan uppercase">
                      {displayName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-dark-100">{displayName}</p>
                      {email && email !== displayName && (
                        <p className="text-xs text-dark-400 truncate max-w-[220px]">{email}</p>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check size={18} className="text-accent-cyan shrink-0" />}
                </button>
              );
            })}

            {delegatableContacts.length === 0 && (
              <div className="text-center py-4 px-2">
                <p className="text-sm text-dark-300 mb-1">Aucun contact disponible</p>
                <p className="text-xs text-dark-500">
                  Ajoutez des contacts depuis la section Contacts pour pouvoir leur assigner des tâches.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
