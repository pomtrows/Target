import { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Circle, Clock, CheckCircle2, Plus, Pencil, Paperclip, FileText, Calendar, Target } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { getObjectiveProjectProgress, getObjectiveCompletedWeeks } from '../../utils/progressUtils';
import { getCurrentWeekId, formatWeekShort } from '../../utils/weekUtils';

const COLUMNS = [
  {
    id: 'non_lance',
    title: 'Non lancé',
    subtitle: 'Backlog',
    icon: Circle,
    headerColor: 'text-dark-300',
    headerBg: 'bg-dark-800/80 border-dark-600/40',
    countBg: 'bg-dark-700 text-dark-300',
    badgeBg: 'bg-dark-700/60 text-dark-300 border-dark-600/40'
  },
  {
    id: 'en_cours',
    title: 'En cours',
    subtitle: 'Planifié',
    icon: Clock,
    headerColor: 'text-accent-cyan',
    headerBg: 'bg-accent-cyan/10 border-accent-cyan/30',
    countBg: 'bg-accent-cyan/20 text-accent-cyan',
    badgeBg: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30'
  },
  {
    id: 'termine',
    title: 'Terminé',
    subtitle: '100%',
    icon: CheckCircle2,
    headerColor: 'text-accent-green',
    headerBg: 'bg-accent-green/10 border-accent-green/30',
    countBg: 'bg-accent-green/20 text-accent-green',
    badgeBg: 'bg-accent-green/15 text-accent-green border-accent-green/30'
  }
];

export default function ProjectObjectiveKanban({
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

  // Distribute into 3 columns:
  // 1. "termine" : progress >= 1
  // 2. "non_lance" : progress < 1 AND (no weeks OR assignType === 'backlog')
  // 3. "en_cours" : progress < 1 AND has weeks AND assignType !== 'backlog'
  const categorizedObjectives = useMemo(() => {
    const nonLance = [];
    const enCours = [];
    const termine = [];

    projectObjectives.forEach(obj => {
      const prog = getObjectiveProjectProgress(obj, targetState.progress);
      if (prog >= 1) {
        termine.push(obj);
      } else {
        const hasWeeks = obj.assignments && obj.assignments.length > 0;
        const isBacklog = !hasWeeks || obj.assignType === 'backlog';
        if (isBacklog) {
          nonLance.push(obj);
        } else {
          enCours.push(obj);
        }
      }
    });

    return {
      non_lance: nonLance,
      en_cours: enCours,
      termine: termine
    };
  }, [projectObjectives, targetState.progress]);

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

  // Drag and drop between columns
  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const targetObjective = projectObjectives.find(o => o.id === draggableId);
    if (!targetObjective) return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    if (destCol === 'termine') {
      // Mark as 100% completed
      const targetWeek = (targetObjective.assignments && targetObjective.assignments.find(a => /^\d{4}-S\d{2}$/.test(a))) || currentWeekId;
      const completeValue = targetObjective.subObjectives?.length > 0
        ? (1 << targetObjective.subObjectives.length) - 1
        : (Number(targetObjective.target) > 1 ? Number(targetObjective.target) : 1);

      targetDispatch({
        type: 'TOGGLE_PROGRESS',
        payload: { weekId: targetWeek, objectiveId: targetObjective.id, value: completeValue }
      });
    } else if (destCol === 'non_lance') {
      // Unset progress if was completed
      if (sourceCol === 'termine') {
        const completedWeeks = getObjectiveCompletedWeeks(targetObjective, targetState.progress);
        completedWeeks.forEach(w => {
          targetDispatch({
            type: 'TOGGLE_PROGRESS',
            payload: { weekId: w, objectiveId: targetObjective.id, value: 0 }
          });
        });
      }
      // Move to Backlog (clear assignments)
      targetDispatch({
        type: 'UPDATE_OBJECTIVE',
        payload: {
          ...targetObjective,
          assignType: 'backlog',
          assignments: []
        }
      });
    } else if (destCol === 'en_cours') {
      // Unset progress if was completed
      if (sourceCol === 'termine') {
        const completedWeeks = getObjectiveCompletedWeeks(targetObjective, targetState.progress);
        completedWeeks.forEach(w => {
          targetDispatch({
            type: 'TOGGLE_PROGRESS',
            payload: { weekId: w, objectiveId: targetObjective.id, value: 0 }
          });
        });
      }
      // Assign to week if has none
      const currentWeeks = targetObjective.assignments?.filter(a => /^\d{4}-S\d{2}$/.test(a)) || [];
      const newWeeks = currentWeeks.length > 0 ? currentWeeks : [currentWeekId];
      targetDispatch({
        type: 'UPDATE_OBJECTIVE',
        payload: {
          ...targetObjective,
          assignType: 'week',
          assignments: newWeeks
        }
      });
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-start">
        {COLUMNS.map((col) => {
          const colObjectives = categorizedObjectives[col.id] || [];
          const ColIcon = col.icon;

          return (
            <div
              key={col.id}
              className="flex flex-col bg-dark-900/40 border border-dark-700/50 rounded-2xl min-h-[160px] md:min-h-[500px]"
              style={{ padding: '10px' }}
            >
              {/* Column Header */}
              <div
                className={`flex items-center justify-between rounded-xl border ${col.headerBg}`}
                style={{ padding: '8px 12px', marginBottom: '12px' }}
              >
                <div className="flex items-center gap-2">
                  <ColIcon size={16} className={col.headerColor} />
                  <div className="flex items-center gap-1.5">
                    <h3 className={`text-sm font-bold ${col.headerColor}`}>
                      {col.title}
                    </h3>
                    <span className="text-[10px] text-dark-400 font-medium">
                      ({col.subtitle})
                    </span>
                  </div>
                </div>

                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.countBg}`}>
                  {colObjectives.length}
                </span>
              </div>

              {/* Column Content Droppable */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 flex flex-col gap-2.5 transition-colors rounded-xl p-1 ${
                      snapshot.isDraggingOver ? 'bg-dark-800/60 ring-2 ring-accent-cyan/30' : ''
                    }`}
                  >
                    {colObjectives.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-dark-400 border border-dashed border-dark-700/40 rounded-xl">
                        <span className="text-xs">Aucun objectif</span>
                      </div>
                    ) : (
                      colObjectives.map((obj, index) => {
                        const prog = getObjectiveProjectProgress(obj, targetState.progress);
                        const isDone = prog >= 1;
                        const percent = Math.round(prog * 100);
                        const weeks = (obj.assignments || []).filter(a => /^\d{4}-S\d{2}$/.test(a));
                        const attachmentsCount = (obj.attachments || []).length;
                        const hasNotes = !!(obj.note && obj.note.trim());

                        const priorityClass = 
                          obj.priority === 'P1' ? 'text-accent-red border-accent-red/40 bg-accent-red/10' :
                          obj.priority === 'P2' ? 'text-accent-violet border-accent-violet/40 bg-accent-violet/10' :
                          'text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10';

                        return (
                          <Draggable key={obj.id} draggableId={obj.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`group relative bg-dark-800/90 hover:bg-dark-800 border rounded-xl p-3 shadow-md transition-all ${
                                  dragSnapshot.isDragging 
                                    ? 'shadow-2xl ring-2 ring-accent-cyan z-50 bg-dark-700 border-accent-cyan' 
                                    : 'border-dark-600/40 hover:border-dark-500/60'
                                }`}
                              >
                                {/* Top row: Toggle check & Title & Priority */}
                                <div className="flex items-start gap-2.5">
                                  {/* Checkbox circle */}
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleObjective(obj, e)}
                                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                      isDone
                                        ? 'bg-accent-green border-accent-green text-white shadow-sm'
                                        : 'border-dark-500 hover:border-accent-cyan bg-dark-900/60'
                                    }`}
                                    title={isDone ? "Marquer comme non terminé" : "Marquer comme terminé"}
                                  >
                                    {isDone && <CheckCircle2 size={13} className="text-white" />}
                                  </button>

                                  {/* Title */}
                                  <div className="flex-1 min-w-0">
                                    <h4
                                      onClick={() => onEditObjective?.(obj)}
                                      className={`text-xs font-semibold leading-snug cursor-pointer transition-colors ${
                                        isDone ? 'text-dark-200 hover:text-accent-cyan' : 'text-dark-100 hover:text-accent-cyan'
                                      }`}
                                    >
                                      {obj.title}
                                    </h4>

                                    {/* Sub-objectives counter if any */}
                                    {obj.subObjectives?.length > 0 && (
                                      <div className="flex items-center gap-1 mt-1 text-[10px] text-dark-400">
                                        <Target size={11} className="text-dark-400 shrink-0" />
                                        <span>{obj.subObjectives.length} sous-objectifs ({percent}%)</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Priority Badge */}
                                  <span className={`text-[9px] font-black rounded border px-1 shrink-0 ${priorityClass}`}>
                                    {obj.priority || 'P2'}
                                  </span>
                                </div>

                                {/* Bottom row: Week badges & Notes/PJ & Edit button */}
                                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-dark-700/30 text-xs">
                                  {/* Left: Weeks badges or Backlog */}
                                  <div className="flex items-center gap-1 flex-wrap min-w-0">
                                    {weeks.length > 0 ? (
                                      weeks.slice(0, 2).map(wId => (
                                        <span
                                          key={wId}
                                          className="inline-flex items-center gap-1 text-[10px] font-medium text-dark-300 bg-dark-700/60 border border-dark-600/40 rounded px-1.5 py-0.5"
                                        >
                                          <Calendar size={10} className="text-dark-400" />
                                          {formatWeekShort(wId)}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] font-medium text-accent-violet bg-accent-violet/10 border border-accent-violet/25 rounded px-1.5 py-0.5">
                                        📋 Backlog
                                      </span>
                                    )}
                                    {weeks.length > 2 && (
                                      <span className="text-[10px] text-dark-400 font-bold">
                                        +{weeks.length - 2}
                                      </span>
                                    )}
                                  </div>

                                  {/* Right: Notes, PJ indicators & Edit */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {hasNotes && (
                                      <span className="text-accent-violet" title="Contient des notes">
                                        <FileText size={12} />
                                      </span>
                                    )}
                                    {attachmentsCount > 0 && (
                                      <span className="text-accent-cyan flex items-center gap-0.5" title={`${attachmentsCount} pièce(s) jointe(s)`}>
                                        <Paperclip size={12} />
                                        <span className="text-[9px] font-bold">{attachmentsCount}</span>
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => onEditObjective?.(obj)}
                                      className="text-dark-400 hover:text-dark-200 p-1 rounded hover:bg-dark-700 transition-colors cursor-pointer"
                                      title="Modifier l'objectif"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })
                    )}
                    {provided.placeholder}

                    {/* Quick Add button inside Non lancé column */}
                    {col.id === 'non_lance' && (
                      <button
                        type="button"
                        onClick={onAddObjective}
                        className="mt-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-dark-600/50 hover:border-accent-cyan/60 rounded-xl text-xs font-semibold text-dark-300 hover:text-accent-cyan hover:bg-accent-cyan/5 transition-all cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Ajouter un objectif</span>
                      </button>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
