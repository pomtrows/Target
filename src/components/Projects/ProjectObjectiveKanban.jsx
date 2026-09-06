import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Circle, Clock, CheckCircle2, Plus } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { getObjectiveProjectProgress, getObjectiveCompletedWeeks, getObjectiveProgress } from '../../utils/progressUtils';
import { getCurrentWeekId } from '../../utils/weekUtils';
import ObjectiveCard from '../Dashboard/ObjectiveCard';
import Modal from '../Shared/Modal';

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
  const [deleteConfirmObjective, setDeleteConfirmObjective] = useState(null);

  // Filter linked objectives
  const linkedObjectiveIds = useMemo(() => new Set(project.objectiveIds || []), [project.objectiveIds]);
  const projectObjectives = useMemo(() => {
    return (targetState.objectives || []).filter(
      obj => linkedObjectiveIds.has(obj.id) || obj.projectId === project.id
    );
  }, [targetState.objectives, linkedObjectiveIds, project.id]);

  // Distribute into 3 columns and sort each column:
  // 1. "termine" : progress >= 1 -> most recently completed to oldest completed
  // 2. "en_cours" : planned weeks ascending (oldest weeks first), ties broken by P1 > P2 > P3
  // 3. "non_lance" : progress < 1 AND backlog -> priority P1 > P2 > P3
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

    const getPriorityRank = (p) => {
      if (p === 'P1' || p === 1 || p === '1') return 1;
      if (p === 'P2' || p === 2 || p === '2') return 2;
      if (p === 'P3' || p === 3 || p === '3') return 3;
      return 4;
    };

    // 1. Terminé : du plus récemment terminé au plus ancien
    const getObjectiveCompletionInfo = (obj) => {
      const completedWeeks = getObjectiveCompletedWeeks(obj, targetState.progress);
      let latestTimestamp = 0;
      let latestWeek = '';

      completedWeeks.forEach(wId => {
        if (!latestWeek || wId > latestWeek) {
          latestWeek = wId;
        }
        const ts = targetState.progressTimestamps?.[`${wId}-${obj.id}`];
        if (ts) {
          const t = new Date(ts).getTime();
          if (t > latestTimestamp) {
            latestTimestamp = t;
          }
        }
      });

      if (!latestTimestamp) {
        if (obj.completedAt) latestTimestamp = new Date(obj.completedAt).getTime();
        else if (obj.updatedAt) latestTimestamp = new Date(obj.updatedAt).getTime();
      }

      return { latestTimestamp, latestWeek };
    };

    termine.sort((a, b) => {
      const infoA = getObjectiveCompletionInfo(a);
      const infoB = getObjectiveCompletionInfo(b);

      if (infoA.latestTimestamp && infoB.latestTimestamp && infoA.latestTimestamp !== infoB.latestTimestamp) {
        return infoB.latestTimestamp - infoA.latestTimestamp;
      }
      if (infoA.latestTimestamp && !infoB.latestTimestamp) return -1;
      if (!infoA.latestTimestamp && infoB.latestTimestamp) return 1;

      if (infoA.latestWeek !== infoB.latestWeek) {
        return infoB.latestWeek.localeCompare(infoA.latestWeek);
      }

      return (a.title || '').localeCompare(b.title || '');
    });

    // 2. En cours : ordre de planification (semaines anciennes d'abord, futur après), puis P1 > P2 > P3
    const getEarliestWeek = (obj) => {
      const weeks = (obj.assignments || [])
        .filter(a => typeof a === 'string' && /^\d{4}-S\d{2}$/.test(a))
        .sort();
      return weeks.length > 0 ? weeks[0] : '9999-S99';
    };

    enCours.sort((a, b) => {
      const weekA = getEarliestWeek(a);
      const weekB = getEarliestWeek(b);

      if (weekA !== weekB) {
        return weekA.localeCompare(weekB);
      }

      const rankA = getPriorityRank(a.priority);
      const rankB = getPriorityRank(b.priority);
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return (a.title || '').localeCompare(b.title || '');
    });

    // 3. Non lancé : ordre de priorisation P1 > P2 > P3
    nonLance.sort((a, b) => {
      const rankA = getPriorityRank(a.priority);
      const rankB = getPriorityRank(b.priority);
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return (a.title || '').localeCompare(b.title || '');
    });

    return {
      non_lance: nonLance,
      en_cours: enCours,
      termine: termine
    };
  }, [projectObjectives, targetState.progress, targetState.progressTimestamps]);

  // Determine the most representative weekId for an objective
  const getEffectiveWeekId = (obj) => {
    // 1. If completed in any week, use the latest completed week
    const completedWeeks = getObjectiveCompletedWeeks(obj, targetState.progress);
    if (completedWeeks.length > 0) return completedWeeks[0];

    // 2. If has progress recorded in any week in targetState.progress, pick the one with highest progress
    let bestWeek = null;
    let maxProgress = 0;
    if (targetState.progress) {
      for (const [wId, weekProg] of Object.entries(targetState.progress)) {
        if (weekProg && weekProg[obj.id] !== undefined) {
          const prog = getObjectiveProgress(obj, weekProg);
          if (prog > maxProgress) {
            maxProgress = prog;
            bestWeek = wId;
          }
        }
      }
    }
    if (bestWeek) return bestWeek;

    // 3. If assigned to weeks, prefer currentWeekId if in assignments, otherwise earliest assigned week
    const assignedWeeks = (obj.assignments || []).filter(a => typeof a === 'string' && /^\d{4}-S\d{2}$/.test(a));
    if (assignedWeeks.includes(currentWeekId)) return currentWeekId;
    if (assignedWeeks.length > 0) return assignedWeeks[0];

    // 4. Default to currentWeekId
    return currentWeekId;
  };

  const handleDeleteClick = (objectiveId) => {
    const obj = projectObjectives.find(o => o.id === objectiveId);
    setDeleteConfirmObjective(obj || { id: objectiveId, title: 'cet objectif' });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmObjective) {
      targetDispatch({ type: 'DELETE_OBJECTIVE', payload: deleteConfirmObjective.id });
      setDeleteConfirmObjective(null);
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
      const assignedWeeks = (targetObjective.assignments || []).filter(a => typeof a === 'string' && /^\d{4}-S\d{2}$/.test(a));
      const isBacklog = assignedWeeks.length === 0 || targetObjective.assignType === 'backlog';
      const targetWeek = (!isBacklog && assignedWeeks[0]) || currentWeekId;

      if (isBacklog) {
        const otherAssignments = (targetObjective.assignments || []).filter(a => typeof a === 'string' && !/^\d{4}-S\d{2}$/.test(a));
        targetDispatch({
          type: 'UPDATE_OBJECTIVE',
          payload: {
            ...targetObjective,
            assignType: 'week',
            assignments: [...otherAssignments, currentWeekId]
          }
        });
      }

      const completeValue = targetObjective.subObjectives?.length > 0
        ? (1 << targetObjective.subObjectives.length) - 1
        : (Number(targetObjective.target) > 1 ? Number(targetObjective.target) : 1);

      targetDispatch({
        type: 'TOGGLE_PROGRESS',
        payload: { weekId: targetWeek, objectiveId: targetObjective.id, value: completeValue }
      });
    } else if (destCol === 'non_lance') {
      // Reset progress from any recorded week
      const recordedWeeks = Object.keys(targetState.progress || {}).filter(
        w => (targetState.progress[w]?.[targetObjective.id] || 0) > 0
      );
      const weeksToReset = recordedWeeks.length > 0 ? recordedWeeks : [currentWeekId];
      weeksToReset.forEach(w => {
        targetDispatch({
          type: 'TOGGLE_PROGRESS',
          payload: { weekId: w, objectiveId: targetObjective.id, value: 0 }
        });
      });

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
        const recordedWeeks = Object.keys(targetState.progress || {}).filter(
          w => (targetState.progress[w]?.[targetObjective.id] || 0) > 0
        );
        const weeksToReset = recordedWeeks.length > 0 ? recordedWeeks : [currentWeekId];
        weeksToReset.forEach(w => {
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
                    className={`flex-1 flex flex-col gap-2.5 transition-colors rounded-xl ${
                      snapshot.isDraggingOver ? 'bg-dark-800/60 ring-2 ring-accent-cyan/30' : ''
                    }`}
                    style={{ padding: '6px 8px' }}
                  >
                    {colObjectives.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-dark-400 border border-dashed border-dark-700/40 rounded-xl">
                        <span className="text-xs">Aucun objectif</span>
                      </div>
                    ) : (
                      colObjectives.map((obj, index) => {
                        const effectiveWeekId = getEffectiveWeekId(obj);

                        return (
                          <Draggable key={obj.id} draggableId={obj.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`transition-shadow ${
                                  dragSnapshot.isDragging 
                                    ? 'shadow-2xl ring-2 ring-accent-cyan rounded-[24px] z-50' 
                                    : ''
                                }`}
                                style={{
                                  ...dragProvided.draggableProps.style,
                                  marginBottom: '10px'
                                }}
                              >
                                <ObjectiveCard
                                  objective={obj}
                                  weekId={effectiveWeekId}
                                  index={index}
                                  onEdit={onEditObjective}
                                  onDelete={handleDeleteClick}
                                  compactMode={true}
                                  hideProject={true}
                                  disableLayout={true}
                                />
                              </div>
                            )}
                          </Draggable>
                        );
                      })
                    )}
                    {provided.placeholder}

                    {/* Quick Add button inside each status column */}
                    <button
                      type="button"
                      onClick={() => onAddObjective?.(col.id)}
                      className={`mt-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-dark-600/50 rounded-xl text-xs font-semibold text-dark-300 transition-all cursor-pointer ${
                        col.id === 'termine' 
                          ? 'hover:border-accent-green/60 hover:text-accent-green hover:bg-accent-green/5' 
                          : 'hover:border-accent-cyan/60 hover:text-accent-cyan hover:bg-accent-cyan/5'
                      }`}
                    >
                      <Plus size={14} />
                      <span>Ajouter un objectif</span>
                    </button>
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmObjective && (
        <Modal
          isOpen={!!deleteConfirmObjective}
          onClose={() => setDeleteConfirmObjective(null)}
          title="Supprimer l'objectif ?"
          maxWidth="max-w-sm"
        >
          <div className="flex flex-col gap-4 text-dark-200">
            <p className="text-sm">
              Êtes-vous sûr de vouloir supprimer l'objectif <strong className="text-dark-100">« {deleteConfirmObjective.title} »</strong> ?
            </p>
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmObjective(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-dark-300 hover:bg-dark-700 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-red text-white hover:bg-accent-red/90 transition-colors shadow-lg shadow-accent-red/20 cursor-pointer"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </Modal>
      )}
    </DragDropContext>
  );
}
