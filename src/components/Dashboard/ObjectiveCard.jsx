import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Check, Pencil, Trash2, Play, FileText, Paperclip } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTarget } from '../../contexts/TargetContext';
import { useSport } from '../../contexts/SportContext';
import { useNotes } from '../../contexts/NotesContext';
import { getObjectiveProgress, getProgressColor, isBitSet } from '../../utils/progressUtils';
import WorkoutPlayer from '../Sport/WorkoutPlayer';
import Modal from '../Shared/Modal';
import NoteEditor from '../Notes/NoteEditor';
import AttachmentManager from '../Attachments/AttachmentManager';

export default function ObjectiveCard({ objective, weekId, index, onEdit, onDelete, compactMode = false }) {
  const { user } = useAuth();
  const { state, dispatch } = useTarget();
  const { sessions } = useSport();
  const { state: notesState, createFolder, createNote } = useNotes();
  const [sessionToPlay, setSessionToPlay] = useState(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [objectiveNoteId, setObjectiveNoteId] = useState(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const hasAttachments = objective.attachments && objective.attachments.length > 0;

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
        alert('Impossible de créer le dossier pour les notes des objectifs.');
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
        alert('Impossible de créer la note pour cet objectif.');
        return;
      }
    }
    
    setObjectiveNoteId(noteId);
    setShowNotesModal(true);
  };

  const notesFolder = notesState.folders.find(f => f.name === 'Objectifs');
  const objectiveNote = notesFolder ? notesState.notes.find(n => n.folder_id === notesFolder.id && n.title === objective.id) : null;
  const hasNotes = !!(objectiveNote && objectiveNote.content && objectiveNote.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() !== '');

  const category = state.categories.find((c) => c.id === objective.categoryId);
  const sportSession = objective.sportSessionId ? sessions.find(s => s.id === objective.sportSessionId) : null;
  const weekProgress = state.progress[weekId] || {};
  const current = weekProgress[objective.id] || 0;
  
  const hasSubObjectives = objective.target === 1 && objective.subObjectives?.length > 0;
  const isCheckbox = objective.target < 1;
  const isChecked = current >= 1;
  const progress = getObjectiveProgress(objective, weekProgress);
  const isCompleted = progress >= 1;
  const color = isCompleted ? '#22c55e' : getProgressColor(progress);

  const handleIncrement = () => {
    dispatch({
      type: 'INCREMENT_PROGRESS',
      payload: { weekId, objectiveId: objective.id },
    });
  };

  const handleDecrement = () => {
    dispatch({
      type: 'DECREMENT_PROGRESS',
      payload: { weekId, objectiveId: objective.id },
    });
  };

  const handleToggle = () => {
    dispatch({
      type: 'TOGGLE_PROGRESS',
      payload: { weekId, objectiveId: objective.id },
    });
  };

  const handleToggleSub = (subIndex) => {
    dispatch({
      type: 'TOGGLE_SUB_OBJECTIVE',
      payload: { weekId, objectiveId: objective.id, subIndex },
    });
  };

  const handlePriorityClick = (e) => {
    e.stopPropagation();
    const currentPriority = objective.priority || 'P3';
    let newPriority = 'P3';
    if (currentPriority === 'P3') newPriority = 'P2';
    else if (currentPriority === 'P2') newPriority = 'P1';
    else if (currentPriority === 'P1') newPriority = 'P3';

    dispatch({
      type: 'UPDATE_OBJECTIVE',
      payload: {
        ...objective,
        priority: newPriority,
      },
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
      style={{ padding: compactMode ? '12px 14px 10px 14px' : '16px 20px 12px 20px' }}
      className="group relative h-full min-h-[110px] rounded-[24px] bg-dark-700/40 border border-dark-600 transition-all duration-300 hover:bg-dark-700/60 flex flex-col justify-between shadow-xl hover:shadow-2xl"
    >
      {/* Edit/Delete Icons (Top Right) */}
      <div 
        className="absolute top-3 flex gap-2.5 opacity-60 group-hover:opacity-100 transition-opacity z-10"
        style={{ right: '20px' }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onEdit?.(objective); }}
          className="p-1.5 rounded-lg text-dark-200 hover:text-dark-100 hover:bg-dark-600/50 transition-all"
        >
          <Pencil size={18} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(objective.id); }}
          className="p-1.5 rounded-lg text-dark-300 hover:text-accent-red hover:bg-accent-red/10 transition-all"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex-1 w-full">
        {/* Title */}
        <h3 
          className="font-bold text-lg text-dark-100 mb-2 pl-1"
          style={{ 
            paddingRight: '100px',
            wordBreak: 'break-word',
            overflowWrap: 'break-word'
          }}
        >
          {objective.title}
        </h3>

        {/* Assignment Badge */}
        {objective.assigned_to && (
          <div className="mb-4 pl-1 text-xs">
            {objective.user_id === user.id ? (
              <span className="bg-dark-600/50 text-dark-300 px-2 py-1 rounded-md">
                Délégué à {state.contacts?.find(c => c.contact_user_id === objective.assigned_to)?.contact_name || 'un contact'}
                {objective.assignment_status === 'PENDING' && ' (En attente)'}
                {objective.assignment_status === 'REJECTED' && ' (Refusé)'}
              </span>
            ) : (
              <span className="bg-accent-violet/20 text-accent-violet px-2 py-1 rounded-md">
                Assigné par {state.contacts?.find(c => c.contact_user_id === objective.user_id)?.contact_name || 'un contact'}
              </span>
            )}
          </div>
        )}

        {/* Counter Section OR Sub-objectives */}
        <div className="flex items-center mb-6 pl-1 pr-0 w-full" style={{ gap: compactMode ? '12px' : '35px' }}>
          <div className={hasSubObjectives ? "flex-1 min-w-0" : "grow min-w-0"}>
            {objective.assigned_to === user.id && objective.assignment_status === 'PENDING' ? (
              isRejecting ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Motif du refus..."
                    className="w-full bg-dark-700/50 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-dark-100 placeholder-dark-400 focus:outline-none focus:border-accent-red"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        dispatch({ 
                          type: 'UPDATE_OBJECTIVE', 
                          payload: { 
                            ...objective, 
                            assigned_to: null, 
                            assignment_status: null, 
                            rejectReason: rejectComment || 'Sans commentaire' 
                          } 
                        });
                        setIsRejecting(false);
                      }}
                      className="px-3 py-1 bg-accent-red/20 text-accent-red rounded-lg text-xs font-bold hover:bg-accent-red/30"
                    >
                      Confirmer le refus
                    </button>
                    <button
                      onClick={() => setIsRejecting(false)}
                      className="px-3 py-1 bg-dark-600/50 text-dark-300 rounded-lg text-xs hover:bg-dark-500/50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => dispatch({ type: 'UPDATE_OBJECTIVE', payload: { ...objective, assignment_status: 'ACCEPTED' } })}
                    className="px-3 py-1.5 bg-accent-green/20 text-accent-green rounded-lg text-sm font-medium hover:bg-accent-green/30"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => setIsRejecting(true)}
                    className="px-3 py-1.5 bg-accent-red/20 text-accent-red rounded-lg text-sm font-medium hover:bg-accent-red/30"
                  >
                    Refuser
                  </button>
                </div>
              )
            ) : hasSubObjectives ? (
              <div className="space-y-2.5">
                {objective.subObjectives.map((sub, i) => {
                  const isSubChecked = isBitSet(current, i);
                  return (
                    <button
                      key={sub.id}
                      onClick={() => handleToggleSub(i)}
                      className="flex items-start gap-3 w-full group/sub text-left transition-colors"
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                        isSubChecked
                          ? 'bg-accent-green/20 border-accent-green/50'
                          : 'border-dark-500 group-hover/sub:border-dark-400'
                      }`}>
                        {isSubChecked && <Check size={12} className="text-accent-green" strokeWidth={3} />}
                      </div>
                      <span className={`text-sm leading-tight transition-all ${isSubChecked ? 'text-dark-500 line-through' : 'text-dark-200'}`}>
                        {sub.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : !isCheckbox ? (
              <div className={`flex items-center w-full ${compactMode ? 'gap-1.5' : 'gap-1.5 sm:gap-3'}`}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleDecrement}
                  disabled={current <= 0}
                  className={`${compactMode ? 'w-8 h-8' : 'w-8 h-8 sm:w-10 sm:h-10'} rounded-xl bg-dark-600/60 flex items-center justify-center text-dark-300 hover:bg-dark-600/80 hover:text-dark-100 disabled:opacity-10 disabled:cursor-not-allowed transition-all`}
                >
                  <Minus size={16} className="sm:w-[18px] sm:h-[18px]" />
                </motion.button>

                <div className={`flex flex-col items-center ${compactMode ? 'min-w-[30px]' : 'min-w-[40px] sm:min-w-[50px]'}`}>
                  <motion.span
                    key={current}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className={`font-black tabular-nums ${compactMode ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} ${isCompleted ? 'text-accent-green' : 'text-dark-100'}`}
                  >
                    {current}/{objective.target}
                  </motion.span>
                </div>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleIncrement}
                  disabled={isCompleted}
                  className={`${compactMode ? 'w-8 h-8' : 'w-8 h-8 sm:w-10 sm:h-10'} rounded-xl bg-dark-600/60 flex items-center justify-center transition-all ${
                    isCompleted 
                      ? 'opacity-0 cursor-default' 
                      : 'text-dark-300 hover:text-dark-100 hover:bg-dark-600/80'
                  }`}
                >
                  <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
                </motion.button>

                {sportSession && (
                  <div className="flex-1 flex justify-center min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        import('../../utils/audioUnlock').then(({ unlockAudioAndTTS }) => {
                          unlockAudioAndTTS();
                        });
                        setSessionToPlay(sportSession);
                      }}
                      className={`flex items-center bg-accent-cyan/15 text-accent-cyan font-bold rounded-xl hover:bg-accent-cyan/25 transition-all text-xs shadow-lg shadow-accent-cyan/5 border border-accent-cyan/30 flex-shrink-0 ${compactMode ? 'translate-x-1' : 'translate-x-3 sm:translate-x-4'}`}
                      style={{ padding: compactMode ? '5px 8px' : '6px 14px', gap: compactMode ? '4px' : '5px' }}
                    >
                      <Play size={14} fill="currentColor" />
                      <span>Lancer</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleToggle}
                className="flex items-center gap-4 group/check"
              >
                <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                  isChecked
                    ? 'bg-accent-green/20 border-accent-green'
                    : 'border-dark-600 group-hover/check:border-dark-500'
                }`}>
                  {isChecked && <Check size={20} className="text-accent-green" />}
                </div>
                <span className={`text-lg font-bold ${isChecked ? 'text-accent-green' : 'text-dark-300'}`}>
                  {isChecked ? 'Terminé' : 'Marquer comme fait'}
                </span>
              </button>
            )}
          </div>

          <div className={`flex items-center flex-shrink-0 ml-auto ${compactMode ? 'gap-1' : 'gap-2.5'}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAttachmentsModal(true);
              }}
              className={`flex items-center justify-center w-[30px] h-10 rounded-lg transition-all cursor-pointer bg-transparent relative ${
                hasAttachments 
                  ? 'text-accent-violet hover:bg-accent-violet/10'
                  : 'text-dark-300 hover:bg-dark-600/50 hover:text-dark-100'
              }`}
              style={{ border: 'none', marginRight: '-5px' }}
              title={hasAttachments ? "Voir les pièces jointes" : "Ajouter une pièce jointe"}
            >
              <Paperclip size={18} />
              {hasAttachments && (
                <span className="absolute -top-1 -right-1 bg-accent-violet text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-dark-800">
                  {objective.attachments.length}
                </span>
              )}
            </button>

            <button
              onClick={handleOpenNotes}
              className={`flex items-center justify-center w-[30px] h-10 rounded-lg transition-all cursor-pointer bg-transparent ${
                hasNotes 
                  ? 'text-accent-cyan hover:bg-accent-cyan/10'
                  : 'text-dark-300 hover:bg-dark-600/50 hover:text-dark-100'
              }`}
              style={{ border: 'none', marginRight: '-5px' }}
              title={hasNotes ? "Voir les notes (contient du texte)" : "Prendre des notes"}
            >
              <FileText size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Footer Progress Bar with integrated Checkmark */}
      <div className="mt-auto px-1 flex items-center h-10 gap-3">
        <div className="relative flex-1 flex items-center h-full">
          <div className="h-[6px] w-full bg-dark-600/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: isCompleted ? 'calc(100% - 15px)' : `${progress * 100}%` }}
              transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            />
          </div>
          
          {/* Checkmark Badge */}
          {isCompleted && (
            <motion.div
              initial={{ scale: 0, x: 20 }}
              animate={{ scale: 1, x: 0 }}
              className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-dark-700 border-[6px] border-dark-800/50 flex items-center justify-center shadow-xl z-10"
            >
              <div className="w-full h-full rounded-full bg-accent-green/20 flex items-center justify-center">
                <Check size={20} className="text-accent-green" strokeWidth={4} />
              </div>
            </motion.div>
          )}
        </div>
        
        {/* Priority Badge */}
        <button 
          onClick={handlePriorityClick}
          className="flex-shrink-0 w-[40px] flex justify-center items-center font-black text-lg cursor-pointer hover:scale-110 transition-transform bg-transparent border-none"
          title="Changer la priorité"
        >
          <span className={
            objective.priority === 'P1' ? 'text-accent-red' :
            (objective.priority || 'P3') === 'P3' ? 'text-accent-cyan' :
            'text-accent-violet'
          }>
            {objective.priority || 'P3'}
          </span>
        </button>
      </div>

      {sessionToPlay && (
        <WorkoutPlayer
          session={sessionToPlay}
          onClose={() => setSessionToPlay(null)}
          onFinish={() => {
            if (!isCompleted) {
              handleIncrement();
            }
          }}
        />
      )}

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

      <AttachmentManager
        isOpen={showAttachmentsModal}
        onClose={() => setShowAttachmentsModal(false)}
        objective={objective}
      />
    </motion.div>
  );
}
