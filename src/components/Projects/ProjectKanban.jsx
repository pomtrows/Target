import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Circle, Clock, CheckCircle2 } from 'lucide-react';
import ProjectCard from './ProjectCard';
import { useProjects } from '../../contexts/ProjectsContext';

const COLUMNS = [
  {
    id: '0-Non lancé',
    title: 'Non lancé',
    icon: Circle,
    headerColor: 'text-dark-300',
    headerBg: 'bg-dark-800/80 border-dark-600/40',
    countBg: 'bg-dark-700 text-dark-300'
  },
  {
    id: '1-En cours',
    title: 'En cours',
    icon: Clock,
    headerColor: 'text-accent-cyan',
    headerBg: 'bg-accent-cyan/10 border-accent-cyan/30',
    countBg: 'bg-accent-cyan/20 text-accent-cyan'
  },
  {
    id: '2-Terminé',
    title: 'Terminé',
    icon: CheckCircle2,
    headerColor: 'text-accent-green',
    headerBg: 'bg-accent-green/10 border-accent-green/30',
    countBg: 'bg-accent-green/20 text-accent-green'
  }
];

export default function ProjectKanban({ 
  projects, 
  onEdit, 
  onOpenDetails 
}) {
  const { changeProjectStatus } = useProjects();

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // New column status
    const newStatus = destination.droppableId;
    changeProjectStatus(draggableId, newStatus);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {COLUMNS.map((col) => {
          const colProjects = projects.filter(p => p.status === col.id);
          const ColIcon = col.icon;

          return (
            <div 
              key={col.id} 
              className="flex flex-col bg-dark-900/40 border border-dark-700/50 rounded-2xl min-h-[450px]"
              style={{ padding: '16px' }}
            >
              {/* Column Header */}
              <div 
                className={`flex items-center justify-between rounded-xl border mb-3 ${col.headerBg}`}
                style={{ padding: '12px 16px' }}
              >
                <div className="flex items-center gap-2">
                  <ColIcon size={16} className={col.headerColor} />
                  <h3 className={`text-sm font-bold ${col.headerColor}`}>
                    {col.title}
                  </h3>
                </div>
                <span 
                  className={`text-xs font-black rounded-full ${col.countBg}`}
                  style={{ padding: '4px 10px' }}
                >
                  {colProjects.length}
                </span>
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 flex flex-col gap-3 rounded-xl p-1 transition-colors ${
                      snapshot.isDraggingOver ? 'bg-dark-800/40 border-2 border-dashed border-accent-cyan/40' : ''
                    }`}
                  >
                    {colProjects.length === 0 ? (
                      <div 
                        className="flex-1 flex items-center justify-center text-center text-xs text-dark-400 border border-dashed border-dark-800 rounded-xl"
                        style={{ padding: '28px 16px' }}
                      >
                        Glissez un projet ici
                      </div>
                    ) : (
                      colProjects.map((project, index) => (
                        <Draggable key={project.id} draggableId={project.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`transition-shadow ${
                                snapshot.isDragging ? 'shadow-2xl ring-2 ring-accent-cyan/50 rounded-2xl z-50' : ''
                              }`}
                            >
                              <ProjectCard
                                project={project}
                                onEdit={onEdit}
                                onOpenDetails={onOpenDetails}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
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
