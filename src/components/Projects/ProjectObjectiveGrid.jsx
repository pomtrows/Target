import { useMemo } from 'react';
import { 
  CheckCircle2, Clock, Circle, Plus, Pencil, Trash2, 
  Paperclip, FileText, Calendar, Target, AlertCircle 
} from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { getObjectiveProjectProgress, getObjectiveCompletedWeeks } from '../../utils/progressUtils';
import { getCurrentWeekId, formatWeekShort } from '../../utils/weekUtils';

export default function ProjectObjectiveGrid({
  project,
  onEditObjective,
  onAddObjective
}) {
  const { state: targetState, dispatch: targetDispatch } = useTarget();
  const currentWeekId = useMemo(() => getCurrentWeekId(), []);

  // Filter linked objectives
  const linkedObjectiveIds = useMemo(() => new Set(project.objectiveIds || []), [project.objectiveIds]);
  const projectObjectives = useMemo(() => {
    return (targetState.objectives || []).filter(
      obj => linkedObjectiveIds.has(obj.id) || obj.projectId === project.id
    );
  }, [targetState.objectives, linkedObjectiveIds, project.id]);

  // Toggle objective completed / uncompleted
  const handleToggleObjective = (obj, e) => {
    e?.stopPropagation();
    const isDone = getObjectiveProjectProgress(obj, targetState.progress) >= 1;

    if (isDone) {
      // Uncomplete
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
      // Complete
      const assignedWeeks = (obj.assignments || []).filter(a => typeof a === 'string' && /^\d{4}-S\d{2}$/.test(a));
      const isBacklog = assignedWeeks.length === 0 || obj.assignType === 'backlog';
      const targetWeek = (!isBacklog && assignedWeeks[0]) || currentWeekId;

      if (isBacklog) {
        const otherAssignments = (obj.assignments || []).filter(a => typeof a === 'string' && !/^\d{4}-S\d{2}$/.test(a));
        targetDispatch({
          type: 'UPDATE_OBJECTIVE',
          payload: {
            ...obj,
            assignType: 'week',
            assignments: [...otherAssignments, currentWeekId]
          }
        });
      }

      const completeValue = obj.subObjectives?.length > 0
        ? (1 << obj.subObjectives.length) - 1
        : (Number(obj.target) > 1 ? Number(obj.target) : 1);

      targetDispatch({
        type: 'TOGGLE_PROGRESS',
        payload: { weekId: targetWeek, objectiveId: obj.id, value: completeValue }
      });
    }
  };

  const categories = targetState.categories || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* List of Objectives */}
      {projectObjectives.map((obj) => {
        const prog = getObjectiveProjectProgress(obj, targetState.progress);
        const isDone = prog >= 1;
        const percent = Math.round(prog * 100);
        const completedWeeks = getObjectiveCompletedWeeks(obj, targetState.progress);
        const assignedWeeks = (obj.assignments || []).filter(a => /^\d{4}-S\d{2}$/.test(a));
        const weeks = isDone && completedWeeks.length > 0 ? completedWeeks : assignedWeeks;
        const isBacklog = !isDone && (!weeks || weeks.length === 0 || obj.assignType === 'backlog');
        const attachmentsCount = (obj.attachments || []).length;
        const hasNotes = !!(obj.note && obj.note.trim());
        const cat = categories.find(c => c.id === obj.categoryId);

        const priorityClass = 
          obj.priority === 'P1' ? 'text-accent-red border-accent-red/40 bg-accent-red/10' :
          obj.priority === 'P2' ? 'text-accent-violet border-accent-violet/40 bg-accent-violet/10' :
          'text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10';

        return (
          <div
            key={obj.id}
            className="group relative bg-dark-800/90 hover:bg-dark-800 border border-dark-600/40 hover:border-dark-500/60 rounded-2xl p-4 shadow-md transition-all flex flex-col justify-between gap-3"
          >
            {/* Top row: Checkbox, Title, Priority */}
            <div>
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => handleToggleObjective(obj, e)}
                    className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isDone
                        ? 'bg-accent-green border-accent-green text-white shadow-sm'
                        : 'border-dark-500 hover:border-accent-cyan bg-dark-900/60'
                    }`}
                    title={isDone ? "Marquer comme non terminé" : "Marquer comme terminé"}
                  >
                    {isDone && <CheckCircle2 size={15} className="text-white" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <h4
                      onClick={() => onEditObjective?.(obj)}
                      className={`text-sm font-bold leading-snug cursor-pointer transition-colors ${
                        isDone ? 'text-dark-200 hover:text-accent-cyan' : 'text-dark-100 hover:text-accent-cyan'
                      }`}
                    >
                      {obj.title}
                    </h4>

                    {cat && (
                      <span className="text-[11px] text-dark-400 flex items-center gap-1 mt-0.5">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                    )}
                  </div>
                </div>

                <span className={`text-[10px] font-black rounded border px-1.5 py-0.5 shrink-0 ${priorityClass}`}>
                  {obj.priority || 'P2'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-dark-400 mb-1">
                  <span>Progression</span>
                  <span className={`font-bold ${isDone ? 'text-accent-green' : percent > 0 ? 'text-accent-cyan' : 'text-dark-400'}`}>
                    {percent}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-dark-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      isDone ? 'bg-accent-green' : 'bg-accent-cyan'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Sub-objectives info if any */}
              {obj.subObjectives?.length > 0 && (
                <div className="flex items-center gap-1 mt-2 text-[11px] text-dark-300">
                  <Target size={12} className="text-dark-400" />
                  <span>{obj.subObjectives.length} sous-objectifs</span>
                </div>
              )}
            </div>

            {/* Bottom Row: Status / Planning badge & actions */}
            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-dark-700/40 text-xs">
              {/* Status pill */}
              <div>
                {isDone ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-green bg-accent-green/10 border border-accent-green/30 rounded-lg px-2 py-0.5">
                    <CheckCircle2 size={12} /> Terminé {weeks.length > 0 && `(${weeks.map(formatWeekShort).join(', ')})`}
                  </span>
                ) : !isBacklog ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg px-2 py-0.5">
                    <Clock size={12} /> {weeks.map(formatWeekShort).join(', ')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-dark-300 bg-dark-700/60 border border-dark-600/40 rounded-lg px-2 py-0.5">
                    <Circle size={12} /> Non lancé (Backlog)
                  </span>
                )}
              </div>

              {/* Actions & icons */}
              <div className="flex items-center gap-2">
                {hasNotes && (
                  <span className="text-accent-violet" title="Contient une note">
                    <FileText size={14} />
                  </span>
                )}
                {attachmentsCount > 0 && (
                  <span className="text-accent-cyan flex items-center gap-0.5" title={`${attachmentsCount} pièce(s) jointe(s)`}>
                    <Paperclip size={14} />
                    <span className="text-[10px] font-bold">{attachmentsCount}</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onEditObjective?.(obj)}
                  className="text-dark-400 hover:text-dark-100 p-1 rounded-lg hover:bg-dark-700/60 transition-colors cursor-pointer"
                  title="Modifier l'objectif"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add Objective Card */}
      <button
        type="button"
        onClick={onAddObjective}
        className="min-h-[160px] border border-dashed border-dark-600/60 hover:border-accent-cyan/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 text-dark-400 hover:text-accent-cyan hover:bg-accent-cyan/5 transition-all cursor-pointer group"
      >
        <div className="w-10 h-10 rounded-full bg-dark-700/60 group-hover:bg-accent-cyan/15 flex items-center justify-center transition-colors">
          <Plus size={20} className="text-dark-300 group-hover:text-accent-cyan" />
        </div>
        <span className="text-xs font-bold">Ajouter un objectif au projet</span>
      </button>
    </div>
  );
}
