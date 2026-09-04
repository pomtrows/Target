import { useState } from 'react';
import { 
  Target, FileText, Paperclip, Calendar, AlertTriangle, 
  CheckCircle2, Clock, Plus, ExternalLink, Trash2, Edit2, 
  Check, X, FolderKanban
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTarget } from '../../contexts/TargetContext';
import { useNotes } from '../../contexts/NotesContext';
import { useProjects } from '../../contexts/ProjectsContext';
import { getObjectiveProgress, getObjectiveProjectProgress, getObjectiveCompletedWeeks } from '../../utils/progressUtils';
import { getCurrentWeekId } from '../../utils/weekUtils';
import NoteEditor from '../Notes/NoteEditor';
import AttachmentManager from '../Attachments/AttachmentManager';
import Modal from '../Shared/Modal';

export default function ProjectDetailModal({ 
  isOpen, 
  onClose, 
  project, 
  onEdit 
}) {
  const { state: targetState, dispatch: targetDispatch } = useTarget();
  const { state: notesState, createFolder, createNote } = useNotes();
  const { updateProject, changeProjectStatus } = useProjects();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'notes' | 'attachments'
  const [projectNoteId, setProjectNoteId] = useState(null);
  const [showAttachmentsManager, setShowAttachmentsManager] = useState(false);
  const [showAddObjectives, setShowAddObjectives] = useState(false);

  if (!isOpen || !project) return null;

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

  // Unlinked objectives available to add
  const availableObjectives = (targetState.objectives || []).filter(
    obj => !linkedObjectiveIds.has(obj.id) && obj.projectId !== project.id
  );

  // Calculate progress across all recorded history
  const currentWeekId = getCurrentWeekId();

  let completedCount = 0;
  let totalProgressRatio = 0;

  if (linkedObjectives.length > 0) {
    linkedObjectives.forEach(obj => {
      const prog = getObjectiveProjectProgress(obj, targetState.progress);
      totalProgressRatio += prog;
      if (prog >= 1) completedCount++;
    });
  }

  const progressPercent = linkedObjectives.length > 0
    ? Math.round((totalProgressRatio / linkedObjectives.length) * 100)
    : 0;

  const handleToggleObjective = (obj) => {
    const isDone = getObjectiveProjectProgress(obj, targetState.progress) >= 1;
    if (isDone) {
      const completedWeeks = getObjectiveCompletedWeeks(obj, targetState.progress);
      if (completedWeeks.length > 0) {
        completedWeeks.forEach(w => {
          targetDispatch({
            type: 'TOGGLE_PROGRESS',
            payload: { weekId: w, objectiveId: obj.id, value: 0 }
          });
        });
      } else {
        targetDispatch({
          type: 'TOGGLE_PROGRESS',
          payload: { weekId: currentWeekId, objectiveId: obj.id, value: 0 }
        });
      }
    } else {
      const targetWeek = (obj.assignments && obj.assignments.find(a => /^\d{4}-S\d{2}$/.test(a))) || currentWeekId;
      const completeValue = obj.subObjectives?.length > 0 
        ? (1 << obj.subObjectives.length) - 1 
        : (Number(obj.target) > 1 ? Number(obj.target) : 1);

      targetDispatch({
        type: 'TOGGLE_PROGRESS',
        payload: { weekId: targetWeek, objectiveId: obj.id, value: completeValue }
      });
    }
  };

  // Priority config
  const priorityConfig = {
    1: { label: '1 - Haute', color: 'bg-accent-red/20 text-accent-red border-accent-red/30' },
    2: { label: '2 - Moyenne', color: 'bg-accent-orange/20 text-accent-orange border-accent-orange/30' },
    3: { label: '3 - Basse', color: 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30' }
  }[project.priority] || { label: '2 - Moyenne', color: 'bg-accent-orange/20 text-accent-orange border-accent-orange/30' };

  // Status config
  const statusConfig = {
    '0-Non lancé': { label: '⚪ Non lancé', color: 'text-dark-300 bg-dark-700/60 border-dark-600/40' },
    '1-En cours': { label: '🔵 En cours', color: 'text-accent-cyan bg-accent-cyan/15 border-accent-cyan/30' },
    '2-Terminé': { label: '🟢 Terminé', color: 'text-accent-green bg-accent-green/15 border-accent-green/30' }
  }[project.status] || { label: project.status, color: 'text-dark-300 bg-dark-700/50 border-dark-600/30' };

  // Date alert
  const today = startOfDay(new Date());
  let dateAlert = null;
  if (project.endDate && project.status !== '2-Terminé') {
    try {
      const daysDiff = differenceInCalendarDays(startOfDay(parseISO(project.endDate)), today);
      if (daysDiff < 0) {
        dateAlert = { text: `En retard (${Math.abs(daysDiff)} j)`, danger: true };
      } else if (daysDiff <= 3) {
        dateAlert = { text: `Échéance proche (J-${daysDiff})`, danger: false };
      }
    } catch {}
  }

  // Ensure note exists for NoteEditor tab
  const getOrCreateProjectNote = async () => {
    let folder = notesState.folders.find(f => f.name === 'Projets');
    let folderId = folder ? folder.id : null;

    if (!folderId) {
      folderId = await createFolder('Projets');
      if (!folderId) return null;
    }

    let note = notesState.notes.find(n => n.folder_id === folderId && n.title === project.id);
    if (!note) {
      const noteId = await createNote(folderId, project.id, `<h1>Notes du projet : ${project.name}</h1><p></p>`);
      return noteId;
    }
    return note.id;
  };

  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    if (tab === 'notes' && !projectNoteId) {
      const nId = await getOrCreateProjectNote();
      setProjectNoteId(nId);
    }
  };

  const handleAddObjectiveToProject = (objId) => {
    const current = project.objectiveIds || [];
    if (!current.includes(objId)) {
      updateProject(project.id, {
        objectiveIds: [...current, objId]
      });
    }
  };

  const handleRemoveObjectiveFromProject = (objId) => {
    const current = project.objectiveIds || [];
    updateProject(project.id, {
      objectiveIds: current.filter(id => id !== objId)
    });
  };

  const attachments = project.attachments || [];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        headerPadding="20px 24px"
        bodyPadding="20px 24px"
        title={
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-accent-cyan/15 text-accent-cyan flex items-center justify-center" style={{ padding: '8px' }}>
              <FolderKanban size={20} />
            </span>
            <div className="flex flex-col">
              <span className="text-base font-bold text-dark-100">{project.name}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span 
                  className="text-[11px] font-semibold rounded-md flex items-center gap-1"
                  style={{ backgroundColor: `${category.color}20`, color: category.color, padding: '3px 8px' }}
                >
                  {category.icon} {category.label}
                </span>
                <span 
                  className={`text-[10px] font-bold rounded-md border ${priorityConfig.color}`}
                  style={{ padding: '3px 8px' }}
                >
                  {priorityConfig.label}
                </span>
              </div>
            </div>
          </div>
        }
        maxWidth="max-w-4xl"
      >
        <div className="flex flex-col gap-6 text-dark-200 min-h-[500px]">
          {/* Header Controls: Status selector, Dates, Edit button */}
          <div 
            className="flex flex-wrap items-center justify-between gap-3 bg-dark-900/60 border border-dark-600/30 rounded-2xl"
            style={{ padding: '14px 18px' }}
          >
            {/* Status changer */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-dark-400 font-semibold">Statut :</span>
              <select
                value={project.status}
                onChange={(e) => changeProjectStatus(project.id, e.target.value)}
                className={`text-xs font-bold rounded-xl border cursor-pointer transition-all outline-none ${statusConfig.color}`}
                style={{ padding: '8px 14px' }}
              >
                <option value="0-Non lancé" className="bg-dark-800 text-dark-200">⚪ 0-Non lancé</option>
                <option value="1-En cours" className="bg-dark-800 text-accent-cyan">🔵 1-En cours</option>
                <option value="2-Terminé" className="bg-dark-800 text-accent-green">🟢 2-Terminé</option>
              </select>
            </div>

            {/* Dates */}
            <div className="flex items-center gap-3 text-xs text-dark-300">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-accent-cyan" />
                <span>
                  {project.startDate ? format(parseISO(project.startDate), 'd MMMM yyyy', { locale: fr }) : 'Non définie'}
                  {' ➔ '}
                  {project.endDate ? format(parseISO(project.endDate), 'd MMMM yyyy', { locale: fr }) : 'Non définie'}
                </span>
              </div>

              {dateAlert && (
                <span 
                  className={`rounded-md text-[11px] font-bold ${
                    dateAlert.danger 
                      ? 'bg-accent-red/20 text-accent-red border border-accent-red/30' 
                      : 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30'
                  }`}
                  style={{ padding: '3px 8px' }}
                >
                  {dateAlert.text}
                </span>
              )}
            </div>

            {/* Edit button */}
            <button
              onClick={() => onEdit?.(project)}
              className="flex items-center gap-1.5 rounded-xl bg-dark-700/60 hover:bg-dark-700 text-dark-200 hover:text-dark-100 text-xs font-semibold border border-dark-600/40 transition-colors cursor-pointer"
              style={{ padding: '8px 16px' }}
            >
              <Edit2 size={13} className="text-accent-violet" />
              Modifier
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-dark-700/60 gap-2">
            <button
              onClick={() => handleTabChange('overview')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === 'overview' ? 'text-accent-cyan font-bold' : 'text-dark-400 hover:text-dark-200'
              }`}
              style={{ padding: '10px 14px' }}
            >
              <Target size={16} />
              <span>Aperçu & Objectifs ({linkedObjectives.length})</span>
              {activeTab === 'overview' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-cyan rounded-full" />
              )}
            </button>

            <button
              onClick={() => handleTabChange('notes')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === 'notes' ? 'text-accent-violet font-bold' : 'text-dark-400 hover:text-dark-200'
              }`}
              style={{ padding: '10px 14px' }}
            >
              <FileText size={16} />
              <span>Notes de projet</span>
              {activeTab === 'notes' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-violet rounded-full" />
              )}
            </button>

            <button
              onClick={() => handleTabChange('attachments')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === 'attachments' ? 'text-accent-orange font-bold' : 'text-dark-400 hover:text-dark-200'
              }`}
              style={{ padding: '10px 14px' }}
            >
              <Paperclip size={16} />
              <span>Pièces jointes ({attachments.length})</span>
              {activeTab === 'attachments' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-orange rounded-full" />
              )}
            </button>
          </div>

          {/* TAB 1: OVERVIEW & OBJECTIVES */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              {/* Description */}
              {project.description ? (
                <div 
                  className="bg-dark-900/40 rounded-2xl border border-dark-600/30 text-sm text-dark-200 leading-relaxed whitespace-pre-wrap"
                  style={{ padding: '16px 20px' }}
                >
                  <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-2">Description</h4>
                  {project.description}
                </div>
              ) : (
                <div 
                  className="bg-dark-900/30 rounded-xl border border-dashed border-dark-700 text-xs text-dark-400 italic"
                  style={{ padding: '14px 18px' }}
                >
                  Aucune description renseignée pour ce projet.
                </div>
              )}

              {/* Progress Summary */}
              <div 
                className="flex flex-col gap-2.5 bg-gradient-to-br from-dark-850 to-dark-900 rounded-2xl border border-dark-600/40"
                style={{ padding: '16px 20px' }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-dark-200">
                    Progression globale du projet :
                    <strong className="text-accent-cyan ml-1.5 text-sm">{progressPercent}%</strong>
                  </span>
                  <span className="text-dark-400">
                    {completedCount} sur {linkedObjectives.length} objectif(s) réalisé(s)
                  </span>
                </div>
                <div className="w-full bg-dark-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      progressPercent === 100 
                        ? 'bg-accent-green' 
                        : 'bg-gradient-to-r from-accent-cyan to-accent-violet'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Objectives List */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-dark-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Target size={15} className="text-accent-cyan" />
                    Objectifs associés ({linkedObjectives.length})
                  </h4>

                  <button
                    type="button"
                    onClick={() => setShowAddObjectives(!showAddObjectives)}
                    className="flex items-center gap-1.5 text-xs font-bold text-accent-cyan hover:underline cursor-pointer"
                    style={{ padding: '6px 12px' }}
                  >
                    <Plus size={14} />
                    {showAddObjectives ? 'Masquer la sélection' : 'Associer des objectifs'}
                  </button>
                </div>

                {/* Inline Objectives Selector (when expanded) */}
                {showAddObjectives && (
                  <div 
                    className="bg-dark-900/80 border border-dark-600/40 rounded-2xl flex flex-col gap-2.5 animate-fade-in"
                    style={{ padding: '16px 20px' }}
                  >
                    <span className="text-xs font-semibold text-dark-200">Sélectionnez les objectifs à rattacher :</span>
                    {availableObjectives.length === 0 ? (
                      <p className="text-xs text-dark-400 italic">Tous vos objectifs sont déjà associés à ce projet.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-2 mt-1">
                        {availableObjectives.map(obj => {
                          const isObjDone = getObjectiveProjectProgress(obj, targetState.progress) >= 1;
                          return (
                            <div
                              key={obj.id}
                              onClick={() => handleAddObjectiveToProject(obj.id)}
                              className="flex items-center justify-between rounded-xl bg-dark-800/80 hover:bg-dark-700 border border-dark-600/30 text-xs cursor-pointer transition-all"
                              style={{ padding: '10px 16px' }}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <span className="text-dark-200 font-medium truncate">{obj.title}</span>
                                {isObjDone && (
                                  <span 
                                    className="text-[10px] font-bold rounded bg-accent-green/20 text-accent-green border border-accent-green/30 flex-shrink-0"
                                    style={{ padding: '2px 8px' }}
                                  >
                                    ✓ Réalisé
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                className="rounded bg-accent-cyan/20 text-accent-cyan text-[11px] font-bold flex-shrink-0 ml-2 cursor-pointer"
                                style={{ padding: '6px 14px' }}
                              >
                                + Associer
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Linked Objectives items */}
                {linkedObjectives.length === 0 ? (
                  <div 
                    className="text-center bg-dark-900/20 border border-dashed border-dark-700/50 rounded-2xl flex flex-col items-center gap-2"
                    style={{ padding: '32px 20px' }}
                  >
                    <Target size={28} className="text-dark-500" />
                    <span className="text-xs text-dark-400">Aucun objectif n'est encore affecté à ce projet.</span>
                    <button
                      onClick={() => setShowAddObjectives(true)}
                      className="text-xs font-bold text-accent-cyan underline mt-1 cursor-pointer"
                      style={{ padding: '4px 8px' }}
                    >
                      Associer des objectifs maintenant
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {linkedObjectives.map((obj) => {
                      const prog = getObjectiveProjectProgress(obj, targetState.progress);
                      const isDone = prog >= 1;
                      const objCat = (targetState.categories || []).find(c => c.id === obj.categoryId);

                      return (
                        <div
                          key={obj.id}
                          className={`flex items-center justify-between rounded-xl border transition-all text-xs ${
                            isDone 
                              ? 'bg-dark-800/40 border-dark-700/50' 
                              : 'bg-dark-800/80 border-dark-600/30 hover:border-dark-500/50'
                          }`}
                          style={{ padding: '12px 18px' }}
                        >
                          <div className="flex items-center gap-3.5">
                            <button
                              type="button"
                              onClick={() => handleToggleObjective(obj)}
                              className={`rounded-xl flex items-center justify-center font-bold transition-all cursor-pointer ${
                                isDone 
                                  ? 'bg-accent-green/20 text-accent-green border border-accent-green/40 hover:bg-accent-green/30 shadow-sm shadow-accent-green/10' 
                                  : 'bg-dark-700 text-dark-400 hover:bg-dark-600 hover:text-dark-200 border border-dark-600/50'
                              }`}
                              style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', padding: '6px' }}
                              title={isDone ? "Cliquer pour marquer comme non validé" : "Cliquer pour marquer comme validé"}
                            >
                              {isDone ? <Check size={16} strokeWidth={3} /> : <span className="text-xs">⏳</span>}
                            </button>

                            <div className="flex flex-col">
                              <span className={`font-semibold text-sm ${isDone ? 'text-dark-300 line-through' : 'text-dark-100'}`}>
                                {obj.title}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] text-dark-400 mt-1">
                                {objCat && (
                                  <span 
                                    className="rounded flex items-center gap-1"
                                    style={{ color: objCat.color, backgroundColor: `${objCat.color}15`, padding: '2px 6px' }}
                                  >
                                    {objCat.icon} {objCat.label}
                                  </span>
                                )}
                                <span>•</span>
                                <span>Cible : {obj.target || 1}x</span>
                                {isDone && (
                                  <>
                                    <span>•</span>
                                    <span className="text-accent-green font-semibold">Validé</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3.5">
                            <span 
                              className={`rounded-md text-[11px] font-bold ${
                                isDone ? 'bg-accent-green/15 text-accent-green border border-accent-green/30' : 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20'
                              }`}
                              style={{ padding: '4px 10px' }}
                            >
                              {Math.round(prog * 100)}%
                            </span>

                            <button
                              onClick={() => handleRemoveObjectiveFromProject(obj.id)}
                              className="rounded text-dark-500 hover:text-accent-red hover:bg-accent-red/10 transition-colors cursor-pointer"
                              style={{ padding: '6px' }}
                              title="Détacher du projet"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RICH NOTE EDITOR */}
          {activeTab === 'notes' && (
            <div className="h-[65vh] flex flex-col bg-dark-900/40 rounded-2xl border border-dark-600/30 p-2">
              {projectNoteId ? (
                <NoteEditor 
                  noteId={projectNoteId} 
                  onClose={onClose} 
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-dark-400">
                  Chargement des notes du projet...
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ATTACHMENTS */}
          {activeTab === 'attachments' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-dark-300 font-semibold">
                  Fichiers et pièces jointes rattachés ({attachments.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowAttachmentsManager(true)}
                  className="rounded-xl bg-accent-cyan text-dark-950 text-xs font-bold hover:bg-accent-cyan/90 transition-all flex items-center gap-2 cursor-pointer"
                  style={{ padding: '8px 16px' }}
                >
                  <Paperclip size={14} />
                  Gérer les fichiers
                </button>
              </div>

              {attachments.length === 0 ? (
                <div 
                  className="text-center bg-dark-900/30 border border-dashed border-dark-700 rounded-2xl flex flex-col items-center gap-2"
                  style={{ padding: '36px 20px' }}
                >
                  <Paperclip size={28} className="text-dark-500" />
                  <span className="text-xs text-dark-400">Aucune pièce jointe pour ce projet.</span>
                  <button
                    onClick={() => setShowAttachmentsManager(true)}
                    className="text-xs font-bold text-accent-cyan underline mt-1 cursor-pointer"
                    style={{ padding: '4px 8px' }}
                  >
                    Téléverser un document ou une image
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-xl bg-dark-800/80 border border-dark-600/30 hover:border-dark-500/50 text-xs"
                      style={{ padding: '12px 16px' }}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Paperclip size={15} className="text-accent-cyan flex-shrink-0" />
                        <span className="truncate font-medium text-dark-200">{file.name}</span>
                      </div>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-dark-700 hover:bg-dark-600 text-dark-200 text-[11px] font-medium flex items-center gap-1 flex-shrink-0"
                        style={{ padding: '6px 12px' }}
                      >
                        <ExternalLink size={12} />
                        Voir
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Attachments Manager Modal */}
      {showAttachmentsManager && (
        <AttachmentManager
          isOpen={showAttachmentsManager}
          onClose={() => setShowAttachmentsManager(false)}
          objective={{
            id: project.id,
            attachments: project.attachments || []
          }}
          onUpdate={({ attachments: updated }) => {
            updateProject(project.id, { attachments: updated });
          }}
        />
      )}
    </>
  );
}
