import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Paperclip, FileText, Calendar, AlertTriangle, Clock, 
  MoreVertical, Edit2, Trash2, CheckCircle2, ChevronRight,
  Target, AlertCircle
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore, differenceInCalendarDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTarget } from '../../contexts/TargetContext';
import { useNotes } from '../../contexts/NotesContext';
import { useProjects } from '../../contexts/ProjectsContext';
import { getObjectiveProjectProgress } from '../../utils/progressUtils';
import AttachmentManager from '../Attachments/AttachmentManager';
import NoteEditor from '../Notes/NoteEditor';
import Modal from '../Shared/Modal';

export default function ProjectCard({ 
  project, 
  onEdit, 
  onOpenDetails,
  compact = false 
}) {
  const { state: targetState } = useTarget();
  const { state: notesState, createFolder, createNote } = useNotes();
  const { updateProject, deleteProject, changeProjectStatus } = useProjects();

  const [showMenu, setShowMenu] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [projectNoteId, setProjectNoteId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Category
  const category = (targetState.categories || []).find(c => c.id === project.categoryId) || {
    id: 'autre',
    label: 'Autre',
    icon: '📌',
    color: '#94a3b8'
  };

  // Linked objectives
  const linkedObjectiveIds = new Set(project.objectiveIds || []);
  const linkedObjectives = (targetState.objectives || []).filter(
    obj => linkedObjectiveIds.has(obj.id) || obj.projectId === project.id
  );

  // Calculate progress based on all recorded weeks for linked objectives
  let completedObjectivesCount = 0;
  let totalProgressRatio = 0;

  if (linkedObjectives.length > 0) {
    linkedObjectives.forEach(obj => {
      const prog = getObjectiveProjectProgress(obj, targetState.progress);
      totalProgressRatio += prog;
      if (prog >= 1) completedObjectivesCount++;
    });
  }

  const progressPercent = linkedObjectives.length > 0
    ? Math.round((totalProgressRatio / linkedObjectives.length) * 100)
    : 0;

  // Priority metadata
  const priorityConfig = {
    1: { label: 'P1', badgeBg: 'bg-accent-red/15 text-accent-red border-accent-red/30', dot: 'bg-accent-red' },
    2: { label: 'P2', badgeBg: 'bg-accent-violet/15 text-accent-violet border-accent-violet/30', dot: 'bg-accent-violet' },
    3: { label: 'P3', badgeBg: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30', dot: 'bg-accent-cyan' },
    'P1': { label: 'P1', badgeBg: 'bg-accent-red/15 text-accent-red border-accent-red/30', dot: 'bg-accent-red' },
    'P2': { label: 'P2', badgeBg: 'bg-accent-violet/15 text-accent-violet border-accent-violet/30', dot: 'bg-accent-violet' },
    'P3': { label: 'P3', badgeBg: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30', dot: 'bg-accent-cyan' }
  }[project.priority] || { label: 'P2', badgeBg: 'bg-accent-violet/15 text-accent-violet border-accent-violet/30', dot: 'bg-accent-violet' };

  // Status metadata
  const statusConfig = {
    '0-Non lancé': { label: 'Non lancé', color: 'text-dark-400', bg: 'bg-dark-700/60 border-dark-600/40' },
    '1-En cours': { label: 'En cours', color: 'text-accent-cyan', bg: 'bg-accent-cyan/15 border-accent-cyan/30' },
    '2-Terminé': { label: 'Terminé', color: 'text-accent-green', bg: 'bg-accent-green/15 border-accent-green/30' }
  }[project.status] || { label: project.status, color: 'text-dark-300', bg: 'bg-dark-700/50 border-dark-600/30' };

  // Date alerts calculation
  const today = startOfDay(new Date());
  let dateAlert = null;

  if (project.endDate) {
    try {
      const endDateObj = startOfDay(parseISO(project.endDate));
      const daysDiff = differenceInCalendarDays(endDateObj, today);

      if (project.status !== '2-Terminé') {
        if (daysDiff < 0) {
          dateAlert = {
            type: 'danger',
            text: `En retard (${Math.abs(daysDiff)} j)`,
            icon: AlertTriangle
          };
        } else if (daysDiff === 0) {
          dateAlert = {
            type: 'warning',
            text: `Échéance aujourd'hui`,
            icon: Clock
          };
        } else if (daysDiff <= 3) {
          dateAlert = {
            type: 'warning',
            text: `J-${daysDiff}`,
            icon: Clock
          };
        }
      }
    } catch {
      // Ignored if invalid date
    }
  }

  // Handle opening notes
  const handleOpenNotes = async (e) => {
    e?.stopPropagation();
    let folder = notesState.folders.find(f => f.name === 'Projets');
    let folderId = folder?.id;

    if (!folderId) {
      try {
        const newFolder = await createFolder('Projets');
        folderId = newFolder?.id;
      } catch (err) {
        console.error('Error creating Projets folder:', err);
        alert('Impossible de créer le dossier pour les notes des projets.');
        return;
      }
      if (!folderId) {
        alert('Impossible de créer le dossier pour les notes des projets.');
        return;
      }
    }

    let note = notesState.notes.find(n => n.folder_id === folderId && n.title === project.id);
    let noteId = note?.id;

    if (!noteId) {
      try {
        const newNote = await createNote(project.id, folderId);
        noteId = newNote?.id;
      } catch (err) {
        console.error('Error creating note:', err);
      }
      if (!noteId) {
        alert('Impossible de créer la note du projet.');
        return;
      }
    }

    setProjectNoteId(noteId);
    setShowNotesModal(true);
  };

  const notesFolder = notesState.folders.find(f => f.name === 'Projets');
  const projectNote = notesFolder ? notesState.notes.find(n => n.folder_id === notesFolder.id && n.title === project.id) : null;
  const hasNotes = !!(projectNote && projectNote.content && projectNote.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() !== '');

  const attachmentsCount = (project.attachments || []).length;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="group relative bg-dark-800/90 hover:bg-dark-800 border border-dark-600/40 hover:border-dark-500/60 rounded-2xl transition-all duration-200 shadow-lg flex flex-col justify-between gap-3"
        style={{ padding: '10px 12px' }}
      >
        {/* Top bar: Project Name & Menu */}
        <div className="flex items-center justify-between gap-2">
          <h3 
            onClick={() => onOpenDetails?.(project)}
            className="text-base font-bold text-dark-100 leading-snug group-hover:text-accent-cyan transition-colors cursor-pointer truncate"
          >
            {project.name}
          </h3>

          {/* Menu Dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-700/60 transition-colors cursor-pointer"
              style={{ padding: '3px 4px' }}
              title="Options"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }} 
                />
                <div className="absolute right-0 top-7 w-36 bg-dark-800 border border-dark-600/70 rounded-xl shadow-2xl py-1 z-50 flex flex-col text-xs font-medium overflow-hidden">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onEdit?.(project);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-dark-200 hover:bg-dark-700/60 text-left transition-colors cursor-pointer"
                  >
                    <Edit2 size={14} className="text-accent-violet" />
                    Modifier
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-accent-red hover:bg-accent-red/10 text-left transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Dates, Date Alert and Category */}
        <div className="flex items-center justify-between gap-2 text-xs text-dark-400">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 text-dark-400">
              <Calendar size={13} className="text-dark-400 flex-shrink-0" />
              <span className="truncate">
                {project.startDate ? format(parseISO(project.startDate), 'd MMM', { locale: fr }) : '—'}
                {' ➔ '}
                {project.endDate ? format(parseISO(project.endDate), 'd MMM yyyy', { locale: fr }) : '—'}
              </span>
            </div>

            {dateAlert && (
              <span 
                className={`inline-flex items-center gap-1.5 rounded-md text-[11px] font-bold flex-shrink-0 ${
                  dateAlert.type === 'danger' 
                    ? 'bg-accent-red/20 text-accent-red border border-accent-red/30' 
                    : 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30'
                }`}
                style={{ padding: '1px 5px' }}
              >
                <dateAlert.icon size={11} />
                {dateAlert.text}
              </span>
            )}
          </div>

          {/* Category */}
          <div 
            className="flex items-center gap-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
            style={{ 
              backgroundColor: `${category.color}15`, 
              color: category.color,
              border: `1px solid ${category.color}35`,
              padding: '2px 6px'
            }}
          >
            <span>{category.icon}</span>
            <span className="truncate max-w-[120px]">{category.label}</span>
          </div>
        </div>

        {/* Objectives Progress Bar */}
        <div 
          className="flex flex-col gap-1.5 bg-dark-900/50 rounded-xl border border-dark-700/30"
          style={{ padding: '6px 8px' }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-dark-300 font-medium">
              <Target size={13} className="text-accent-cyan" />
              Objectifs :
              <strong className="text-dark-100">
                {linkedObjectives.length > 0 ? `${completedObjectivesCount}/${linkedObjectives.length}` : '0'}
              </strong>
            </span>
            <span className="font-bold text-accent-cyan text-[11px]">
              {linkedObjectives.length > 0 ? `${progressPercent}%` : 'Aucun lié'}
            </span>
          </div>

          <div className="w-full bg-dark-700 h-2 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                progressPercent === 100 
                  ? 'bg-accent-green' 
                  : progressPercent > 0 
                  ? 'bg-gradient-to-r from-accent-cyan to-accent-violet' 
                  : 'bg-dark-600'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Bottom Actions: Status selector, Priority & Badges (Attachments, Notes, Details) */}
        <div 
          className="flex items-center justify-between gap-2 border-t border-dark-700/40"
          style={{ paddingTop: '6px' }}
        >
          {/* Status Quick Dropdown & Priority */}
          <div className="flex items-center gap-2">
            <select
              value={project.status}
              onChange={(e) => changeProjectStatus(project.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className={`text-xs font-bold rounded-lg border cursor-pointer transition-all outline-none ${statusConfig.bg} ${statusConfig.color}`}
              style={{ padding: '3px 6px' }}
            >
              <option value="0-Non lancé" className="bg-dark-800 text-dark-200">⚪ 0-Non lancé</option>
              <option value="1-En cours" className="bg-dark-800 text-accent-cyan">🔵 1-En cours</option>
              <option value="2-Terminé" className="bg-dark-800 text-accent-green">🟢 2-Terminé</option>
            </select>

            {/* Priority Badge */}
            <span 
              className={`text-[11px] font-bold rounded-md border flex items-center gap-1.5 ${priorityConfig.badgeBg}`}
              style={{ padding: '2px 6px' }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot}`} />
              {priorityConfig.label}
            </span>
          </div>

          {/* Attachments & Notes buttons */}
          <div className="flex items-center gap-1.5">
            {/* Attachments button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAttachmentsModal(true);
              }}
              className={`rounded-lg border transition-all flex items-center gap-1.5 text-xs cursor-pointer ${
                attachmentsCount > 0
                  ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan'
                  : 'bg-dark-700/40 border-dark-600/30 text-dark-400 hover:text-dark-200'
              }`}
              style={{ padding: '3px 6px' }}
              title={attachmentsCount > 0 ? `${attachmentsCount} pièce(s) jointe(s)` : 'Ajouter une pièce jointe'}
            >
              <Paperclip size={14} />
              {attachmentsCount > 0 && <span className="font-bold text-[10px]">{attachmentsCount}</span>}
            </button>

            {/* Notes button */}
            <button
              onClick={handleOpenNotes}
              className={`rounded-lg border transition-all flex items-center gap-1.5 text-xs cursor-pointer ${
                hasNotes
                  ? 'bg-accent-violet/20 border-accent-violet/40 text-accent-violet'
                  : 'bg-dark-700/40 border-dark-600/30 text-dark-400 hover:text-dark-200'
              }`}
              style={{ padding: '3px 6px' }}
              title={hasNotes ? 'Voir les notes du projet' : 'Rédiger une note'}
            >
              <FileText size={14} />
              {hasNotes && <span className="w-1.5 h-1.5 rounded-full bg-accent-violet" />}
            </button>

            {/* Details trigger */}
            <button
              onClick={() => onOpenDetails?.(project)}
              className="rounded-lg bg-dark-700/40 border border-dark-600/30 text-dark-300 hover:text-accent-cyan hover:border-accent-cyan/40 transition-all ml-1 cursor-pointer"
              style={{ padding: '3px 5px' }}
              title="Ouvrir la fiche complète"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Attachments Modal */}
      {showAttachmentsModal && (
        <AttachmentManager
          isOpen={showAttachmentsModal}
          onClose={() => setShowAttachmentsModal(false)}
          objective={{
            id: project.id,
            attachments: project.attachments || []
          }}
          onUpdate={({ attachments }) => {
            updateProject(project.id, { attachments });
          }}
        />
      )}

      {/* Project Notes Modal */}
      {showNotesModal && projectNoteId && (
        <Modal
          isOpen={showNotesModal}
          onClose={() => setShowNotesModal(false)}
          title={`Notes du projet : ${project.name}`}
          maxWidth="max-w-4xl"
        >
          <div className="h-[75vh] flex flex-col p-1">
            <NoteEditor 
              noteId={projectNoteId} 
            />
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Supprimer le projet ?"
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-4 text-dark-200">
          <p className="text-sm">
            Êtes-vous sûr de vouloir supprimer le projet <strong className="text-dark-100">« {project.name} »</strong> ?
          </p>
          <p className="text-xs text-dark-400">
            Les objectifs qui lui étaient rattachés ne seront pas supprimés et redeviendront indépendants.
          </p>
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-dark-300 hover:bg-dark-700 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                deleteProject(project.id);
                setShowDeleteConfirm(false);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-red text-white hover:bg-accent-red/90 transition-colors shadow-lg shadow-accent-red/20"
            >
              Supprimer définitivement
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
