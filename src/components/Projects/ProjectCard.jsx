import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Paperclip, FileText, Calendar, AlertTriangle, Clock, 
  MoreVertical, Edit2, Trash2, CheckCircle2, ChevronRight,
  ExternalLink, Target, AlertCircle
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
    1: { label: '1 - Haute', badgeBg: 'bg-accent-red/15 text-accent-red border-accent-red/30', dot: 'bg-accent-red' },
    2: { label: '2 - Moyenne', badgeBg: 'bg-accent-orange/15 text-accent-orange border-accent-orange/30', dot: 'bg-accent-orange' },
    3: { label: '3 - Basse', badgeBg: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30', dot: 'bg-accent-cyan' },
  }[project.priority] || { label: '2 - Moyenne', badgeBg: 'bg-accent-orange/15 text-accent-orange border-accent-orange/30', dot: 'bg-accent-orange' };

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
    let folderId = folder ? folder.id : null;

    if (!folderId) {
      folderId = await createFolder('Projets');
      if (!folderId) {
        alert('Impossible de créer le dossier pour les notes des projets.');
        return;
      }
    }

    let note = notesState.notes.find(n => n.folder_id === folderId && n.title === project.id);
    let noteId = note ? note.id : null;

    if (!noteId) {
      noteId = await createNote(folderId, project.id, `<h1>Notes : ${project.name}</h1><p></p>`);
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
        className="group relative bg-dark-800/90 hover:bg-dark-800 border border-dark-600/40 hover:border-dark-500/60 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-lg flex flex-col justify-between gap-4"
      >
        {/* Top bar: Category & Priority & Menu */}
        <div className="flex items-center justify-between gap-2">
          {/* Category */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{ 
              backgroundColor: `${category.color}15`, 
              color: category.color,
              border: `1px solid ${category.color}35`
            }}
          >
            <span>{category.icon}</span>
            <span className="truncate max-w-[120px]">{category.label}</span>
          </div>

          {/* Priority & Quick Menu */}
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${priorityConfig.badgeBg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot}`} />
              {priorityConfig.label}
            </span>

            {/* Menu Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-700/60 transition-colors"
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
                  <div className="absolute right-0 top-7 w-44 bg-dark-850 border border-dark-600 rounded-xl shadow-2xl py-1.5 z-50 flex flex-col text-xs font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onOpenDetails?.(project);
                      }}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-dark-200 hover:bg-dark-700/60 text-left transition-colors"
                    >
                      <ExternalLink size={14} className="text-accent-cyan" />
                      Fiche détaillée
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onEdit?.(project);
                      }}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-dark-200 hover:bg-dark-700/60 text-left transition-colors"
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
                      className="flex items-center gap-2.5 px-3.5 py-2 text-accent-red hover:bg-accent-red/10 text-left transition-colors"
                    >
                      <Trash2 size={14} />
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Project Name & Description */}
        <div className="flex flex-col gap-1.5 cursor-pointer" onClick={() => onOpenDetails?.(project)}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold text-dark-100 leading-snug group-hover:text-accent-cyan transition-colors">
              {project.name}
            </h3>
          </div>

          {project.description && (
            <p className="text-xs text-dark-400 line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}
        </div>

        {/* Dates and Alerts */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-dark-400 pt-1 border-t border-dark-700/40">
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-dark-400" />
            <span>
              {project.startDate ? format(parseISO(project.startDate), 'd MMM', { locale: fr }) : '—'}
              {' ➔ '}
              {project.endDate ? format(parseISO(project.endDate), 'd MMM yyyy', { locale: fr }) : '—'}
            </span>
          </div>

          {dateAlert && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
              dateAlert.type === 'danger' 
                ? 'bg-accent-red/20 text-accent-red border border-accent-red/30' 
                : 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30'
            }`}>
              <dateAlert.icon size={12} />
              {dateAlert.text}
            </span>
          )}
        </div>

        {/* Objectives Progress Bar */}
        <div className="flex flex-col gap-1.5 bg-dark-900/50 p-2.5 rounded-xl border border-dark-700/30">
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

        {/* Bottom Actions: Status selector & Badges (Attachments, Notes) */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-dark-700/40">
          {/* Status Quick Dropdown */}
          <select
            value={project.status}
            onChange={(e) => changeProjectStatus(project.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className={`text-xs font-bold py-1 px-2.5 rounded-lg border cursor-pointer transition-all outline-none ${statusConfig.bg} ${statusConfig.color}`}
          >
            <option value="0-Non lancé" className="bg-dark-800 text-dark-200">⚪ 0-Non lancé</option>
            <option value="1-En cours" className="bg-dark-800 text-accent-cyan">🔵 1-En cours</option>
            <option value="2-Terminé" className="bg-dark-800 text-accent-green">🟢 2-Terminé</option>
          </select>

          {/* Attachments & Notes buttons */}
          <div className="flex items-center gap-1">
            {/* Attachments button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAttachmentsModal(true);
              }}
              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-xs ${
                attachmentsCount > 0
                  ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan'
                  : 'bg-dark-700/40 border-dark-600/30 text-dark-400 hover:text-dark-200'
              }`}
              title={attachmentsCount > 0 ? `${attachmentsCount} pièce(s) jointe(s)` : 'Ajouter une pièce jointe'}
            >
              <Paperclip size={14} />
              {attachmentsCount > 0 && <span className="font-bold text-[10px]">{attachmentsCount}</span>}
            </button>

            {/* Notes button */}
            <button
              onClick={handleOpenNotes}
              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-xs ${
                hasNotes
                  ? 'bg-accent-violet/20 border-accent-violet/40 text-accent-violet'
                  : 'bg-dark-700/40 border-dark-600/30 text-dark-400 hover:text-dark-200'
              }`}
              title={hasNotes ? 'Voir les notes du projet' : 'Rédiger une note'}
            >
              <FileText size={14} />
              {hasNotes && <span className="w-1.5 h-1.5 rounded-full bg-accent-violet" />}
            </button>

            {/* Details trigger */}
            <button
              onClick={() => onOpenDetails?.(project)}
              className="p-1.5 rounded-lg bg-dark-700/40 border border-dark-600/30 text-dark-300 hover:text-accent-cyan hover:border-accent-cyan/40 transition-all ml-1"
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
              onClose={() => setShowNotesModal(false)} 
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
