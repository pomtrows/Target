import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, AlertCircle, Check, Search, Plus, X, Link2, Sparkles, Trash2, Paperclip, FileText, ChevronDown, ChevronUp, Edit2, UserPlus } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { useProjects } from '../../contexts/ProjectsContext';
import { useNotes } from '../../contexts/NotesContext';
import { useAuth } from '../../contexts/AuthContext';
import { getObjectiveProjectProgress } from '../../utils/progressUtils';
import { getCurrentWeekId, getSelectableWeeks, formatWeekLabel } from '../../utils/weekUtils';
import { getProjectEffectiveDates } from '../../utils/projectUtils';
import { generateUUID } from '../../utils/offlineSync';
import Modal from '../Shared/Modal';
import ObjectiveForm from '../Dashboard/ObjectiveForm';
import AttachmentManager from '../Attachments/AttachmentManager';
import NoteEditor from '../Notes/NoteEditor';

export default function ProjectModal({ isOpen, onClose, projectToEdit = null }) {
  const { user } = useAuth();
  const { state: targetState, dispatch } = useTarget();
  const { createProject, updateProject } = useProjects();

  const { state: notesState, createFolder, createNote } = useNotes();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('autre');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(2);
  const [status, setStatus] = useState('0-Non lancé');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState([]);
  const [objectiveSearch, setObjectiveSearch] = useState('');
  const [objectiveMode, setObjectiveMode] = useState(null); // 'create' | 'assign' | null
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);

  // Attachments and Notes states
  const [tempProjectId, setTempProjectId] = useState(() => projectToEdit?.id || generateUUID());
  const [formAttachments, setFormAttachments] = useState(projectToEdit?.attachments || []);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [projectNoteId, setProjectNoteId] = useState(null);
  const [showDescriptionMobile, setShowDescriptionMobile] = useState(false);

  // Inline objective creation state
  const [newObjTitle, setNewObjTitle] = useState('');
  const [newObjPriority, setNewObjPriority] = useState('P2');
  const [newObjTempId, setNewObjTempId] = useState(() => generateUUID());
  const [newObjAttachments, setNewObjAttachments] = useState([]);
  const [showNewObjAttachmentsModal, setShowNewObjAttachmentsModal] = useState(false);
  const [newObjNoteId, setNewObjNoteId] = useState(null);
  const [showNewObjNotesModal, setShowNewObjNotesModal] = useState(false);
  const [newObjAssignedTo, setNewObjAssignedTo] = useState('');
  const [showNewObjDelegateModal, setShowNewObjDelegateModal] = useState(false);
  const [newObjAssignWeeks, setNewObjAssignWeeks] = useState(() => [getCurrentWeekId()]);
  const [newObjAssignType, setNewObjAssignType] = useState('week'); // 'week' | 'backlog'
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);
  const weekDropdownRef = useRef(null);
  const [isCreatingInlineObj, setIsCreatingInlineObj] = useState(false);
  const [inlineObjFeedback, setInlineObjFeedback] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(event.target)) {
        setIsWeekDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (projectToEdit) {
      setTempProjectId(projectToEdit.id);
      setFormAttachments(projectToEdit.attachments || []);
      setName(projectToEdit.name || '');
      const cat = projectToEdit.categoryId || projectToEdit.category_id || 'autre';
      setCategoryId(cat);
      setDescription(projectToEdit.description || '');
      const prio = projectToEdit.priority === 'P1' ? 1 : projectToEdit.priority === 'P2' ? 2 : projectToEdit.priority === 'P3' ? 3 : (Number(projectToEdit.priority) || 2);
      setPriority(prio);
      setStatus(projectToEdit.status || '0-Non lancé');
      const initStart = projectToEdit.startDate || projectToEdit.start_date || '';
      const initEnd = projectToEdit.endDate || projectToEdit.end_date || '';
      const objIds = projectToEdit.objectiveIds || projectToEdit.objective_ids || [];
      const effective = getProjectEffectiveDates(
        {
          id: projectToEdit.id,
          startDate: initStart || null,
          endDate: initEnd || null,
          objectiveIds: objIds
        },
        targetState.objectives || [],
        targetState.progress || {}
      );
      setStartDate(effective.startDate || initStart);
      setEndDate(effective.endDate || initEnd);
      setSelectedObjectiveIds(objIds);
    } else {
      setTempProjectId(generateUUID());
      setFormAttachments([]);
      setName('');
      const defaultCat = targetState.categories?.[0]?.id || 'autre';
      setCategoryId(defaultCat);
      setDescription('');
      setPriority(2);
      setStatus('0-Non lancé');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
      setSelectedObjectiveIds([]);
    }
    setShowAttachmentsModal(false);
    setShowNotesModal(false);
    setProjectNoteId(null);
    setShowDescriptionMobile(false);
    setShowAssignModal(false);
    setEditingObjective(null);
    setObjectiveMode(null);
    setNewObjTitle('');
    setNewObjPriority('P2');
    setNewObjTempId(generateUUID());
    setNewObjAttachments([]);
    setNewObjNoteId(null);
    setNewObjAssignedTo('');
    setNewObjAssignType('week');
    setNewObjAssignWeeks([getCurrentWeekId()]);
    setIsWeekDropdownOpen(false);
    setShowNewObjAttachmentsModal(false);
    setShowNewObjNotesModal(false);
    setShowNewObjDelegateModal(false);
    setInlineObjFeedback('');
    setError('');
  }, [projectToEdit?.id, isOpen]);

  const notesFolder = notesState?.folders?.find(f => f.name === 'Projets');
  const projectNote = notesFolder ? notesState?.notes?.find(n => n.folder_id === notesFolder.id && n.title === tempProjectId) : null;
  const hasNotes = !!(projectNote && projectNote.content && projectNote.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() !== '');

  const handleOpenNotes = async (e) => {
    e?.preventDefault();
    let folder = notesState?.folders?.find(f => f.name === 'Projets');
    let folderId = folder?.id;
    if (!folderId) {
      try {
        const newFolder = await createFolder('Projets');
        folderId = newFolder.id;
      } catch (err) {
        console.error("Erreur création dossier Projets", err);
        return;
      }
    }
    const existingNote = notesState?.notes?.find(n => n.folder_id === folderId && n.title === tempProjectId);
    let noteId = existingNote?.id;
    if (!noteId) {
      try {
        const newNote = await createNote(tempProjectId, folderId);
        noteId = newNote?.id;
      } catch (err) {
        console.error("Erreur création note", err);
        return;
      }
    }
    setProjectNoteId(noteId);
    setShowNotesModal(true);
  };

  const delegatableContacts = useMemo(() => {
    if (!targetState?.contacts) return [];
    const seen = new Set();
    return targetState.contacts.filter(c => {
      if (c.status !== 'ACCEPTED') return false;
      if (!c.contact_user_id) return false;
      if (c.contact_user_id === user?.id) return false;
      if (c.contact_email && user?.email && c.contact_email.toLowerCase() === user.email.toLowerCase()) return false;
      if (seen.has(c.contact_user_id)) return false;
      seen.add(c.contact_user_id);
      return true;
    });
  }, [targetState?.contacts, user]);

  const newObjNotesFolder = notesState?.folders?.find(f => f.name === 'Objectifs');
  const newObjNote = newObjNotesFolder ? notesState?.notes?.find(n => n.folder_id === newObjNotesFolder.id && n.title === newObjTempId) : null;
  const hasNewObjNotes = !!(newObjNote && newObjNote.content && newObjNote.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() !== '');

  const handleOpenNewObjNotes = async (e) => {
    e?.preventDefault();
    let folder = notesState?.folders?.find(f => f.name === 'Objectifs');
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
    const existingNote = notesState?.notes?.find(n => n.folder_id === folderId && n.title === newObjTempId);
    let noteId = existingNote?.id;
    if (!noteId) {
      try {
        const newNote = await createNote(newObjTempId, folderId);
        noteId = newNote?.id;
      } catch (err) {
        console.error("Erreur création note objectif", err);
        return;
      }
    }
    setNewObjNoteId(noteId);
    setShowNewObjNotesModal(true);
  };

  if (!isOpen) return null;

  const categories = targetState.categories || [];
  const allObjectives = targetState.objectives || [];

  // Si des objectifs sélectionnés débordent des dates actuellement saisies, on élargit automatiquement
  useEffect(() => {
    if (!isOpen || selectedObjectiveIds.length === 0) return;
    const effective = getProjectEffectiveDates(
      {
        id: projectToEdit?.id,
        startDate: startDate || null,
        endDate: endDate || null,
        objectiveIds: selectedObjectiveIds
      },
      allObjectives,
      targetState.progress || {}
    );

    if (effective.startDate && (!startDate || effective.startDate < startDate)) {
      setStartDate(effective.startDate);
    }
    if (effective.endDate && (!endDate || effective.endDate > endDate)) {
      setEndDate(effective.endDate);
    }
  }, [selectedObjectiveIds, isOpen, allObjectives, targetState.progress]);

  const filteredObjectives = allObjectives.filter(obj => {
    if (!objectiveSearch.trim()) return true;
    return obj.title?.toLowerCase().includes(objectiveSearch.toLowerCase());
  });

  const toggleObjective = (objId) => {
    setSelectedObjectiveIds(prev => 
      prev.includes(objId) ? prev.filter(id => id !== objId) : [...prev, objId]
    );
  };

  const handleCreateInlineObjective = async (e) => {
    if (e) e.preventDefault();
    if (!newObjTitle.trim()) return;

    setIsCreatingInlineObj(true);
    setInlineObjFeedback('');
    try {
      const newId = newObjTempId;
      const assignments = newObjAssignType === 'backlog' ? [] : newObjAssignWeeks;

      await dispatch({
        type: 'ADD_OBJECTIVE',
        payload: {
          id: newId,
          title: newObjTitle.trim(),
          target: 1,
          categoryId: categoryId || 'autre',
          priority: newObjPriority || 'P2',
          projectId: projectToEdit?.id || null,
          assignments,
          subObjectives: [],
          attachments: newObjAttachments,
          note_id: newObjNoteId,
          assigned_to: newObjAssignedTo || null
        }
      });

      setSelectedObjectiveIds(prev => prev.includes(newId) ? prev : [...prev, newId]);
      setNewObjTitle('');
      setNewObjTempId(generateUUID());
      setNewObjAttachments([]);
      setNewObjNoteId(null);
      setNewObjAssignedTo('');
      setNewObjAssignType('week');
      setNewObjAssignWeeks([getCurrentWeekId()]);
      setIsWeekDropdownOpen(false);
      setInlineObjFeedback('✓ Objectif créé et rattaché !');
      setTimeout(() => setInlineObjFeedback(''), 3000);
    } catch (err) {
      console.error('Erreur création objectif inline:', err);
      setInlineObjFeedback('Erreur lors de la création.');
    } finally {
      setIsCreatingInlineObj(false);
    }
  };

  const handleDeleteObjective = async (objId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer définitivement cet objectif ?')) {
      return;
    }
    try {
      await dispatch({ type: 'DELETE_OBJECTIVE', payload: objId });
      setSelectedObjectiveIds(prev => prev.filter(id => id !== objId));
    } catch (err) {
      console.error('Erreur lors de la suppression de l\'objectif:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom du projet est obligatoire.');
      return;
    }

    const effective = getProjectEffectiveDates(
      {
        id: projectToEdit?.id,
        startDate: startDate || null,
        endDate: endDate || null,
        objectiveIds: selectedObjectiveIds
      },
      allObjectives,
      targetState.progress || {}
    );

    const finalStartDate = effective.startDate || (startDate || null);
    const finalEndDate = effective.endDate || (endDate || null);

    if (finalStartDate && finalEndDate && finalStartDate > finalEndDate) {
      setError('La date de début ne peut pas être postérieure à la date de fin.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        id: tempProjectId,
        name: name.trim(),
        categoryId,
        description: description.trim(),
        priority: Number(priority),
        status,
        startDate: finalStartDate,
        endDate: finalEndDate,
        objectiveIds: selectedObjectiveIds,
        attachments: formAttachments
      };

      if (projectToEdit) {
        await updateProject(projectToEdit.id, payload);
      } else {
        await createProject(payload);
      }

      onClose();
    } catch (err) {
      console.error('Error saving project:', err);
      setError("Erreur lors de l'enregistrement du projet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={projectToEdit ? 'Modifier le projet' : 'Nouveau projet 📁'}
      headerPadding="10px 12px 8px 12px"
      bodyPadding="6px 12px 14px 12px"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-dark-200">
        {error && (
          <div 
            className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs font-semibold"
            style={{ padding: '6px 10px' }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Name */}
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du projet (ex: Rénovation cuisine, Lancement produit...)"
            aria-label="Nom du projet"
            className="w-full bg-dark-900/80 border border-dark-600/60 rounded-xl text-sm text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-colors font-medium"
            style={{ padding: '7px 12px' }}
            required
            autoFocus
          />
        </div>

        {/* Category & Actions (Pièces jointes, Notes) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <label className="text-xs font-bold text-dark-300 uppercase tracking-wider shrink-0">
            Catégorie <span className="text-accent-red">*</span>
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-32 sm:w-36 bg-dark-900/80 border border-dark-600/60 rounded-xl text-xs sm:text-sm text-dark-100 focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer h-[34px] px-2 truncate shrink-0"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id} className="bg-dark-800 text-dark-100">
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>

          {/* Boutons Pièces jointes et Notes répartis équitablement */}
          <div className="flex-1 flex items-center justify-evenly max-w-[220px] sm:max-w-[240px] ml-auto">
            <button
              type="button"
              onClick={() => setShowAttachmentsModal(true)}
              className={`flex items-center justify-center gap-1.5 h-[34px] px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                formAttachments.length > 0
                  ? 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/40 shadow-sm'
                  : 'bg-dark-900/80 text-dark-300 border-dark-600/60 hover:text-dark-100 hover:border-dark-500 hover:bg-dark-800'
              }`}
              title={`Pièces jointes ${formAttachments.length > 0 ? `(${formAttachments.length})` : ''}`}
            >
              <Paperclip size={18} className="shrink-0" />
              {formAttachments.length > 0 && (
                <span className="text-[11px] font-black">{formAttachments.length}</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenNotes}
              className={`flex items-center justify-center h-[34px] px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                hasNotes
                  ? 'bg-accent-violet/15 text-accent-violet border-accent-violet/40 shadow-sm'
                  : 'bg-dark-900/80 text-dark-300 border-dark-600/60 hover:text-dark-100 hover:border-dark-500 hover:bg-dark-800'
              }`}
              title="Notes du projet"
            >
              <FileText size={18} className="shrink-0" />
            </button>
          </div>
        </div>

        {/* Priority & Status sur la même ligne */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3.5">
          {/* Priority */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider shrink-0">
              Priorité <span className="text-accent-red">*</span>
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-16 shrink-0 bg-dark-900/80 border border-dark-600/60 rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer h-[34px] px-2 text-center"
              style={{
                textAlignLast: 'center',
                color: Number(priority) === 1 ? 'var(--color-accent-red, #ef4444)' :
                       Number(priority) === 2 ? 'var(--color-accent-violet, #8b5cf6)' :
                       'var(--color-accent-cyan, #06b6d4)'
              }}
            >
              <option value={1} className="bg-dark-800 text-accent-red font-bold">P1</option>
              <option value={2} className="bg-dark-800 text-accent-violet font-bold">P2</option>
              <option value={3} className="bg-dark-800 text-accent-cyan font-bold">P3</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider shrink-0">
              Statut <span className="text-accent-red">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex-1 min-w-0 bg-dark-900/80 border border-dark-600/60 rounded-xl text-xs sm:text-sm text-dark-100 focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer h-[34px] px-1.5"
            >
              <option value="0-Non lancé" className="bg-dark-800 text-dark-200">⚪ 0-Non lancé</option>
              <option value="1-En cours" className="bg-dark-800 text-accent-cyan">🔵 1-En cours</option>
              <option value="2-Terminé" className="bg-dark-800 text-accent-green">🟢 2-Terminé</option>
            </select>
          </div>
        </div>

        {/* Dates Début et Fin */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3.5">
          {/* Start Date */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Calendar size={13} className="text-dark-400" />
              Début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 min-w-0 bg-dark-900/80 border border-dark-600/60 rounded-xl text-xs sm:text-sm text-dark-100 focus:outline-none focus:border-accent-cyan transition-colors h-[34px] px-2 text-center"
              style={{ textAlign: 'center' }}
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Calendar size={13} className="text-dark-400" />
              Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 min-w-0 bg-dark-900/80 border border-dark-600/60 rounded-xl text-xs sm:text-sm text-dark-100 focus:outline-none focus:border-accent-cyan transition-colors h-[34px] px-2 text-center"
              style={{ textAlign: 'center' }}
            />
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setShowDescriptionMobile(prev => !prev)}
            className="flex items-center gap-2 w-fit py-0.5 text-left cursor-pointer sm:cursor-default group"
          >
            <span className="text-xs font-bold text-dark-300 group-hover:text-dark-100 sm:group-hover:text-dark-300 uppercase tracking-wider transition-colors">
              Description
            </span>
            <span className="sm:hidden text-dark-400 group-hover:text-dark-200 transition-colors flex items-center">
              {showDescriptionMobile ? (
                <ChevronUp size={18} strokeWidth={2.5} />
              ) : (
                <ChevronDown size={18} strokeWidth={2.5} />
              )}
            </span>
            {description.trim() && !showDescriptionMobile && (
              <span className="sm:hidden text-[10px] font-semibold text-accent-cyan/80 bg-accent-cyan/10 border border-accent-cyan/25 rounded-md px-1.5 py-0.5">
                Remplie
              </span>
            )}
          </button>

          <div className={`${showDescriptionMobile ? 'block' : 'hidden sm:block'}`}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Détaillez les grandes étapes, les enjeux et les livrables de ce projet..."
              className="w-full bg-dark-900/80 border border-dark-600/60 rounded-xl text-sm text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-colors resize-none leading-relaxed"
              style={{ padding: '6px 10px', minHeight: '65px' }}
            />
          </div>
        </div>

        {/* Section Objectifs avec 2 boutons : Créer et Attribuer */}
        <div className="flex flex-col gap-2.5">
          {/* Header de la section avec les 2 boutons Créer et Attribuer */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-dark-300 uppercase tracking-wider">
                Objectifs
              </span>
              <span 
                className="text-[11px] font-bold rounded-full bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 min-w-[20px] text-center"
                style={{ padding: '1px 7px' }}
              >
                {selectedObjectiveIds.length}
              </span>
            </div>

            {/* Les 2 boutons d'action demandés : Créer et Attribuer */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setObjectiveMode(prev => prev === 'create' ? null : 'create')}
                className={`flex items-center gap-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  objectiveMode === 'create'
                    ? 'bg-accent-cyan text-dark-950 border-accent-cyan shadow-sm shadow-accent-cyan/20'
                    : 'bg-dark-800 text-dark-200 border-dark-600/50 hover:bg-dark-700 hover:text-dark-100 hover:border-dark-500'
                }`}
                style={{ padding: '5px 10px' }}
              >
                <Plus size={14} strokeWidth={2.5} />
                Créer
              </button>

              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                className={`flex items-center gap-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  selectedObjectiveIds.length > 0
                    ? 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/40 hover:bg-accent-cyan/25'
                    : 'bg-dark-800 text-dark-200 border-dark-600/50 hover:bg-dark-700 hover:text-dark-100 hover:border-dark-500'
                }`}
                style={{ padding: '5px 10px' }}
              >
                <Link2 size={14} strokeWidth={2.5} />
                Attribuer
              </button>
            </div>
          </div>

          {/* PANNEAU 1 : CRÉER UN OBJECTIF */}
          {objectiveMode === 'create' && (
            <div 
              className="flex flex-col gap-2.5 bg-dark-800/90 rounded-xl border border-accent-cyan/30"
              style={{ padding: '8px 6px' }}
            >
              {inlineObjFeedback && (
                <div 
                  className="text-xs font-semibold text-accent-green bg-accent-green/10 border border-accent-green/30 rounded-lg flex items-center justify-between gap-1.5"
                  style={{ padding: '4px 8px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <Check size={13} />
                    <span>{inlineObjFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setObjectiveMode(null)}
                    className="text-dark-400 hover:text-dark-200 text-xs cursor-pointer"
                    style={{ padding: '2px 4px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Titre de l'objectif et Choix de la Priorité avec alignement strict */}
              <div className="flex items-start gap-2">
                {/* Colonne Objectif (raccourci pour laisser la place à la priorité) */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-300 uppercase tracking-wider">
                    Objectif <span className="text-accent-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={newObjTitle}
                    onChange={(e) => setNewObjTitle(e.target.value)}
                    placeholder="Ex: Rédiger le cahier des charges, Maquette Figma..."
                    className="w-full bg-dark-900 border border-dark-600/60 rounded-xl text-xs text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan h-[34px] px-2.5"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateInlineObjective();
                      }
                    }}
                    autoFocus
                  />
                </div>

                {/* Colonne Priorité (parfaitement alignée verticalement) */}
                <div className="w-[88px] shrink-0 flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-300 uppercase tracking-wider text-center">
                    Priorité
                  </label>
                  <select
                    value={newObjPriority}
                    onChange={(e) => setNewObjPriority(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-600/60 rounded-xl text-xs font-bold focus:outline-none focus:border-accent-cyan cursor-pointer transition-colors h-[34px] px-1 text-center"
                    style={{
                      textAlignLast: 'center',
                      color: newObjPriority === 'P1' ? 'var(--color-accent-red, #ef4444)' :
                             newObjPriority === 'P2' ? 'var(--color-accent-violet, #8b5cf6)' :
                             'var(--color-accent-cyan, #06b6d4)'
                    }}
                    title="Priorité de l'objectif"
                  >
                    <option value="P1" className="bg-dark-800 text-accent-red font-bold">P1</option>
                    <option value="P2" className="bg-dark-800 text-accent-violet font-bold">P2</option>
                    <option value="P3" className="bg-dark-800 text-accent-cyan font-bold">P3</option>
                  </select>
                </div>

                {/* Bouton fermer */}
                <div className="w-[22px] shrink-0 flex items-center justify-end">
                  {!inlineObjFeedback && (
                    <button
                      type="button"
                      onClick={() => setObjectiveMode(null)}
                      className="text-dark-400 hover:text-dark-200 text-xs cursor-pointer shrink-0 mt-0.5"
                      style={{ padding: '2px 0' }}
                      title="Fermer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Ligne Planification (Semaine + Backlog) */}
              <div className="flex items-center gap-2 pt-0.5">
                {/* Sélecteur de semaines */}
                <div className="relative flex-1 min-w-0" ref={weekDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setNewObjAssignType('week');
                      setIsWeekDropdownOpen(!isWeekDropdownOpen);
                    }}
                    className={`w-full h-[34px] flex items-center justify-between gap-1.5 border rounded-xl px-2.5 text-xs transition-colors cursor-pointer ${
                      newObjAssignType === 'week'
                        ? 'bg-dark-700/50 hover:bg-dark-700/80 border-dark-600/50 text-dark-100 focus:border-accent-cyan/50'
                        : 'bg-dark-800/40 hover:bg-dark-700/40 border-dark-600/30 text-dark-400 opacity-60'
                    }`}
                  >
                    <span className="truncate">
                      {newObjAssignWeeks.length === 0
                        ? "Sélectionner des semaines..."
                        : newObjAssignWeeks.length === 1
                          ? formatWeekLabel(newObjAssignWeeks[0])
                          : `${newObjAssignWeeks.length} semaines sélectionnées`}
                    </span>
                    <span className="text-dark-400 text-xs shrink-0 ml-1">▼</span>
                  </button>

                  {isWeekDropdownOpen && (
                    <div className="absolute z-30 bottom-full left-0 mb-1.5 w-full sm:w-80 max-h-56 overflow-y-auto custom-scrollbar bg-dark-800 border border-dark-600/50 rounded-xl shadow-xl p-2 space-y-1">
                      {getSelectableWeeks(4, 52).map(week => (
                        <label key={week} className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-700/50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={newObjAssignWeeks.includes(week)}
                            onChange={(e) => {
                              setNewObjAssignType('week');
                              if (e.target.checked) {
                                setNewObjAssignWeeks([...newObjAssignWeeks, week]);
                              } else {
                                setNewObjAssignWeeks(newObjAssignWeeks.filter(w => w !== week));
                              }
                            }}
                            className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-cyan focus:ring-accent-cyan/50 focus:ring-offset-dark-800 cursor-pointer"
                          />
                          <span className={`text-xs sm:text-sm ${newObjAssignWeeks.includes(week) ? 'text-accent-cyan font-medium' : 'text-dark-200'}`}>
                            {formatWeekLabel(week)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bouton Backlog */}
                <button
                  type="button"
                  onClick={() => {
                    setNewObjAssignType(prev => prev === 'backlog' ? 'week' : 'backlog');
                    setIsWeekDropdownOpen(false);
                  }}
                  className={`h-[34px] w-[88px] justify-center rounded-xl text-xs font-medium shrink-0 flex items-center gap-1.5 transition-all cursor-pointer border ${
                    newObjAssignType === 'backlog'
                      ? 'bg-accent-violet/20 text-accent-violet border-accent-violet/40 font-semibold shadow-sm'
                      : 'bg-dark-700/50 text-dark-400 border-dark-600/30 hover:text-dark-200 hover:bg-dark-700/80'
                  }`}
                  title="Ajouter au Backlog (sans semaine)"
                >
                  <span>📋 Backlog</span>
                </button>

                {/* Espaceur pour alignement avec la colonne du bouton X */}
                <div className="w-[22px] shrink-0" />
              </div>

              {/* Ligne Actions Objectif : Pièces jointes, Note, Délégué & Bouton Ajouter (+) */}
              <div className="flex items-center gap-2 pt-0.5">
                {/* Icônes Pièces jointes, Note, Délégué */}
                <div className="flex items-center gap-5 sm:gap-7 flex-1 min-w-0">
                  {/* Pièces jointes */}
                  <button
                    type="button"
                    onClick={() => setShowNewObjAttachmentsModal(true)}
                    className={`flex items-center justify-center gap-1.5 h-[34px] min-w-[40px] px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      newObjAttachments.length > 0
                        ? 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/40 shadow-sm'
                        : 'bg-dark-900/80 text-dark-300 border-dark-600/60 hover:text-dark-100 hover:border-dark-500 hover:bg-dark-800'
                    }`}
                    title={`Pièces jointes ${newObjAttachments.length > 0 ? `(${newObjAttachments.length})` : ''}`}
                  >
                    <Paperclip size={20} className="shrink-0" />
                    {newObjAttachments.length > 0 && (
                      <span className="text-[10px] font-black">{newObjAttachments.length}</span>
                    )}
                  </button>

                  {/* Note */}
                  <button
                    type="button"
                    onClick={handleOpenNewObjNotes}
                    className={`flex items-center justify-center h-[34px] w-[40px] rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      hasNewObjNotes
                        ? 'bg-accent-violet/15 text-accent-violet border-accent-violet/40 shadow-sm'
                        : 'bg-dark-900/80 text-dark-300 border-dark-600/60 hover:text-dark-100 hover:border-dark-500 hover:bg-dark-800'
                    }`}
                    title="Note de l'objectif"
                  >
                    <FileText size={20} className="shrink-0" />
                  </button>

                  {/* Délégué */}
                  <button
                    type="button"
                    onClick={() => setShowNewObjDelegateModal(true)}
                    className={`flex items-center justify-center gap-1.5 h-[34px] min-w-[40px] px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      newObjAssignedTo
                        ? 'bg-accent-green/15 text-accent-green border-accent-green/40 shadow-sm'
                        : 'bg-dark-900/80 text-dark-300 border-dark-600/60 hover:text-dark-100 hover:border-dark-500 hover:bg-dark-800'
                    }`}
                    title={newObjAssignedTo ? "Délégué (cliquer pour modifier)" : "Déléguer l'objectif"}
                  >
                    <UserPlus size={20} className="shrink-0" />
                    {newObjAssignedTo && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
                    )}
                  </button>
                </div>

                {/* Bouton Ajouter (+) circulaire aligné sous le bouton Backlog et Priorité */}
                <div className="w-[88px] flex items-center justify-center shrink-0">
                  <button
                    type="button"
                    disabled={!newObjTitle.trim() || isCreatingInlineObj}
                    onClick={handleCreateInlineObjective}
                    className="w-8 h-8 rounded-full bg-black text-white hover:bg-neutral-900 active:scale-95 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-md shrink-0 cursor-pointer"
                    style={{ backgroundColor: '#000000', color: '#ffffff' }}
                    title="Ajouter l'objectif"
                  >
                    {isCreatingInlineObj ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus size={18} strokeWidth={2.5} className="text-white" />
                    )}
                  </button>
                </div>

                {/* Espaceur pour alignement avec la colonne du bouton X */}
                <div className="w-[22px] shrink-0" />
              </div>
            </div>
          )}

          {/* LISTE DES OBJECTIFS RATTACHÉS AU PROJET */}
          {selectedObjectiveIds.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-0.5">
                {selectedObjectiveIds.map((objId) => {
                  const obj = allObjectives.find(o => o.id === objId);
                  if (!obj) return null;
                  const progressRatio = getObjectiveProjectProgress(obj, targetState.progress);
                  const percent = Math.round(progressRatio * 100);

                  return (
                    <div
                      key={obj.id}
                      className="flex items-center justify-between rounded-xl bg-dark-800/70 border border-dark-600/40 text-xs text-dark-200 transition-all hover:border-dark-500"
                      style={{ padding: '5px 6px' }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <span className="truncate font-medium text-dark-100">{obj.title}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-1.5">
                        {obj.priority && (
                          <span 
                            className={`text-[9px] font-black rounded border ${
                              obj.priority === 'P1' ? 'text-accent-red border-accent-red/30 bg-accent-red/10' :
                              obj.priority === 'P2' ? 'text-accent-violet border-accent-violet/30 bg-accent-violet/10' :
                              'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10'
                            }`}
                            style={{ padding: '1px 4px' }}
                          >
                            {obj.priority}
                          </span>
                        )}
                        <span 
                          className={`text-[10px] font-black rounded border flex-shrink-0 ${
                            percent >= 100 
                              ? 'bg-accent-green/20 text-accent-green border-accent-green/30' 
                              : percent > 0 
                                ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30' 
                                : 'bg-dark-700/60 text-dark-400 border-dark-600/40'
                          }`}
                          style={{ padding: '1px 5px' }}
                        >
                          {percent}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingObjective(obj)}
                          className="text-dark-400 hover:text-accent-cyan hover:bg-accent-cyan/10 rounded-lg transition-colors cursor-pointer"
                          style={{ padding: '3px 5px' }}
                          title="Modifier cet objectif"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleObjective(obj.id)}
                          className="text-dark-400 hover:text-dark-100 hover:bg-dark-700/60 rounded-lg transition-colors cursor-pointer"
                          style={{ padding: '3px 5px' }}
                          title="Détacher du projet (ne supprime pas l'objectif)"
                        >
                          <X size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteObjective(obj.id)}
                          className="text-dark-400 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors cursor-pointer"
                          style={{ padding: '3px 5px' }}
                          title="Supprimer définitivement cet objectif"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-dark-600/30">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold text-dark-300 hover:text-dark-100 hover:bg-dark-700/50 transition-colors cursor-pointer"
            style={{ padding: '6px 14px' }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl text-xs font-bold bg-accent-cyan hover:bg-accent-cyan/90 text-dark-950 transition-all shadow-md shadow-accent-cyan/20 active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{ padding: '6px 18px' }}
          >
            {isSubmitting 
              ? 'Enregistrement...' 
              : projectToEdit 
              ? 'Mettre à jour le projet' 
              : 'Créer le projet'}
          </button>
        </div>
      </form>
    </Modal>

    {/* Modale Pièces jointes du nouvel objectif créé inline */}
    {showNewObjAttachmentsModal && (
      <AttachmentManager
        isOpen={showNewObjAttachmentsModal}
        onClose={() => setShowNewObjAttachmentsModal(false)}
        objective={{
          id: newObjTempId,
          attachments: newObjAttachments
        }}
        zIndex={240}
        onUpdate={({ attachments }) => {
          setNewObjAttachments(attachments);
        }}
      />
    )}

    {/* Modale Notes du nouvel objectif créé inline */}
    {showNewObjNotesModal && newObjNoteId && (
      <Modal
        isOpen={showNewObjNotesModal}
        onClose={() => setShowNewObjNotesModal(false)}
        title={`Notes de l'objectif : ${newObjTitle || 'Nouvel objectif'}`}
        maxWidth="max-w-4xl"
        zIndex={240}
      >
        <div className="h-[75vh] flex flex-col p-1">
          <NoteEditor
            noteId={newObjNoteId}
            onClose={() => setShowNewObjNotesModal(false)}
          />
        </div>
      </Modal>
    )}

    {/* Modale Délégation du nouvel objectif créé inline */}
    {showNewObjDelegateModal && (
      <Modal
        isOpen={true}
        onClose={() => setShowNewObjDelegateModal(false)}
        title="Déléguer à un contact"
        maxWidth="max-w-md"
        closeOnOutsideClick={true}
        centerTitle={true}
        zIndex={240}
      >
        <div className="flex flex-col gap-2 py-1">
          <button
            type="button"
            onClick={() => {
              setNewObjAssignedTo('');
              setShowNewObjDelegateModal(false);
            }}
            className={`flex items-center justify-between p-3 rounded-xl transition-all text-left border ${
              !newObjAssignedTo
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
            {!newObjAssignedTo && <Check size={18} className="text-accent-cyan shrink-0" />}
          </button>

          {delegatableContacts.length > 0 && (
            <div className="mt-2 mb-1 px-1">
              <p className="text-xs font-bold text-dark-400 uppercase tracking-wider">
                Contacts ({delegatableContacts.length})
              </p>
            </div>
          )}

          {delegatableContacts.map((c) => {
            const displayName = (targetState.profiles && targetState.profiles[c.contact_user_id]?.display_name)
              || (targetState.profiles && targetState.profiles[c.contact_user_id]?.email)
              || c.contact_name
              || c.contact_email
              || 'Contact';
            const email = (targetState.profiles && targetState.profiles[c.contact_user_id]?.email) || c.contact_email || '';
            const isSelected = newObjAssignedTo === c.contact_user_id;

            return (
              <button
                key={c.contact_user_id}
                type="button"
                onClick={() => {
                  setNewObjAssignedTo(c.contact_user_id);
                  setShowNewObjDelegateModal(false);
                }}
                className={`flex items-center justify-between p-3 rounded-xl transition-all text-left border ${
                  isSelected
                    ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan'
                    : 'bg-dark-800/40 border-dark-600/30 text-dark-200 hover:bg-dark-700/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center text-xs font-bold text-accent-cyan uppercase">
                    {displayName[0] || 'C'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark-100">{displayName}</p>
                    {email && <p className="text-xs text-dark-400">{email}</p>}
                  </div>
                </div>
                {isSelected && <Check size={18} className="text-accent-cyan shrink-0" />}
              </button>
            );
          })}

          {delegatableContacts.length === 0 && (
            <div className="p-4 text-center text-xs text-dark-400">
              Aucun contact disponible pour la délégation.
            </div>
          )}
        </div>
      </Modal>
    )}

    {/* Modale d'édition d'un objectif */}
    {editingObjective && (
      <ObjectiveForm
        isOpen={!!editingObjective}
        onClose={() => setEditingObjective(null)}
        editObjective={editingObjective}
        defaultProjectId={projectToEdit?.id || tempProjectId}
        zIndex={250}
      />
    )}

    {/* Modale Pièces jointes du projet */}
    {showAttachmentsModal && (
      <AttachmentManager
        isOpen={showAttachmentsModal}
        onClose={() => setShowAttachmentsModal(false)}
        objective={{
          id: tempProjectId,
          attachments: formAttachments
        }}
        zIndex={220}
        onUpdate={({ attachments }) => {
          setFormAttachments(attachments);
          if (projectToEdit) {
            updateProject(projectToEdit.id, { attachments });
          }
        }}
      />
    )}

    {/* Modale Notes du projet */}
    {showNotesModal && projectNoteId && (
      <Modal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        title={`Notes du projet : ${name || 'Nouveau projet'}`}
        maxWidth="max-w-4xl"
        zIndex={220}
      >
        <div className="h-[75vh] flex flex-col p-1">
          <NoteEditor 
            noteId={projectNoteId} 
          />
        </div>
      </Modal>
    )}

    {/* Modale dédiée : Attribution des objectifs */}
    {showAssignModal && (
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setObjectiveSearch('');
        }}
        title="Attribuer des objectifs"
        maxWidth="max-w-lg"
        zIndex={220}
      >
        <div className="flex flex-col gap-3 text-dark-200">
          {/* Entête avec nombre sélectionné et Tout désélectionner */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-dark-300">
              {selectedObjectiveIds.length === 0
                ? 'Aucun objectif sélectionné'
                : `${selectedObjectiveIds.length} objectif${selectedObjectiveIds.length > 1 ? 's' : ''} sélectionné${selectedObjectiveIds.length > 1 ? 's' : ''}`}
            </span>
            {selectedObjectiveIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedObjectiveIds([])}
                className="text-xs text-dark-400 hover:text-accent-red underline transition-colors cursor-pointer"
              >
                Tout désélectionner
              </button>
            )}
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
            <input
              type="text"
              value={objectiveSearch}
              onChange={(e) => setObjectiveSearch(e.target.value)}
              placeholder="Rechercher un objectif par mot-clé..."
              className="w-full bg-dark-900 border border-dark-600/50 rounded-xl text-xs sm:text-sm text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan"
              style={{ padding: '8px 10px 8px 34px' }}
              autoFocus
            />
          </div>

          {/* Liste des objectifs */}
          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-0.5">
            {filteredObjectives.length === 0 ? (
              <div className="text-center py-8 text-xs sm:text-sm text-dark-400">
                Aucun objectif trouvé.
              </div>
            ) : (
              filteredObjectives.map((obj) => {
                const isSelected = selectedObjectiveIds.includes(obj.id);
                const progressRatio = getObjectiveProjectProgress(obj, targetState.progress);
                const percent = Math.round(progressRatio * 100);

                return (
                  <div
                    key={obj.id}
                    onClick={() => toggleObjective(obj.id)}
                    className={`flex items-center justify-between rounded-xl border text-xs sm:text-sm cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-accent-cyan/15 border-accent-cyan/50 text-dark-100 font-semibold'
                        : 'bg-dark-900/60 border-dark-600/30 text-dark-300 hover:bg-dark-700/50 hover:text-dark-100'
                    }`}
                    style={{ padding: '7px 10px' }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 truncate">
                      <div 
                        className={`rounded-md flex items-center justify-center border transition-all flex-shrink-0 ${
                          isSelected 
                            ? 'bg-accent-cyan border-accent-cyan text-dark-950 font-black' 
                            : 'border-dark-500 bg-dark-800'
                        }`}
                        style={{ width: '18px', height: '18px' }}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="truncate">{obj.title}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {obj.priority && (
                        <span 
                          className={`text-[10px] font-black rounded border ${
                            obj.priority === 'P1' ? 'text-accent-red border-accent-red/30 bg-accent-red/10' :
                            obj.priority === 'P2' ? 'text-accent-violet border-accent-violet/30 bg-accent-violet/10' :
                            'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10'
                          }`}
                          style={{ padding: '1px 5px' }}
                        >
                          {obj.priority}
                        </span>
                      )}
                      <span 
                        className={`text-[11px] font-black rounded border flex-shrink-0 ${
                          percent >= 100 
                            ? 'bg-accent-green/20 text-accent-green border-accent-green/30' 
                            : percent > 0 
                              ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30' 
                              : 'bg-dark-700/60 text-dark-400 border-dark-600/40'
                        }`}
                        style={{ padding: '1px 6px' }}
                      >
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bouton de validation / fermeture */}
          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-dark-700/50">
            <button
              type="button"
              onClick={() => {
                setShowAssignModal(false);
                setObjectiveSearch('');
              }}
              className="rounded-xl text-xs font-bold bg-accent-cyan hover:bg-accent-cyan/90 text-dark-950 transition-all active:scale-95 cursor-pointer"
              style={{ padding: '7px 20px' }}
            >
              Terminer ({selectedObjectiveIds.length})
            </button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}
