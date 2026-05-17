import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Plus, GripVertical, Trash2, Clock, Dumbbell, PlayCircle, Check } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useSport, calculateTotalTime } from '../../contexts/SportContext';
import { exercisesCatalog, GOAL_TYPES } from '../../data/exercisesCatalog';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export default function SessionForm({ session, onClose }) {
  const { createSession, updateSession } = useSport();
  
  const [name, setName] = useState(session?.name || '');
  const [exercises, setExercises] = useState(session?.exercises || []);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [error, setError] = useState('');

  // Handle Drag & Drop
  const onDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(exercises);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setExercises(items);
  };

  const handleAddExercise = (catalogItem) => {
    const newExercise = {
      ...catalogItem,
      instanceId: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      targetValue: catalogItem.goalType === GOAL_TYPES.TIME ? 30 : 15, // default 30s or 15 reps
      restTime: 15, // default 15s rest
    };
    setExercises(prev => [...prev, newExercise]);
  };

  const handleUpdateExercise = (instanceId, field, value) => {
    setExercises(exercises.map(ex => {
      if (ex.instanceId === instanceId) {
        return { ...ex, [field]: Number(value) || 0 };
      }
      return ex;
    }));
  };

  const handleRemoveExercise = (instanceId) => {
    setExercises(exercises.filter(ex => ex.instanceId !== instanceId));
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError("Le nom de la séance est obligatoire.");
      return;
    }
    if (exercises.length === 0) {
      setError("Veuillez ajouter au moins un exercice.");
      return;
    }

    if (session) {
      updateSession(session.id, name, exercises);
    } else {
      createSession(name, exercises);
    }
    onClose();
  };

  const totalTime = calculateTotalTime(exercises);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-dark-800 rounded-3xl border border-dark-600/30 w-full max-w-4xl h-[96vh] flex flex-col relative z-10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-dark-600/30 flex items-center justify-center relative bg-dark-800/80 sticky top-0 z-20 backdrop-blur-md">
          <div className="text-center flex flex-col items-center">
            <h2 className="text-2xl font-bold text-dark-100">
              {session ? 'Modifier la séance' : 'Nouvelle séance'}
            </h2>
            <div className="text-dark-400 text-sm mt-1 flex items-center justify-center gap-2">
              <Clock size={14} /> Durée estimée : <span className="text-accent-cyan font-semibold">{formatTime(totalTime)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute right-6 p-2 rounded-xl text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-4 p-3 bg-accent-red/10 text-accent-red rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Nom de la séance <span className="text-accent-red">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="Ex: Routine Gainage Express"
                className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-cyan transition-colors"
                autoFocus
              />
            </div>

            {/* Liste des exercices */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-dark-300">
                  Exercices ({exercises.length})
                </label>
                <button
                  onClick={() => setIsCatalogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-cyan/10 text-accent-cyan rounded-lg text-sm font-bold hover:bg-accent-cyan/20 transition-colors"
                >
                  <Plus size={16} /> Ajouter
                </button>
              </div>

              {exercises.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-dark-600 rounded-2xl">
                  <p className="text-dark-400">Aucun exercice ajouté.</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="exercises-list">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3"
                      >
                        {exercises.map((ex, index) => (
                          <Draggable key={ex.instanceId} draggableId={ex.instanceId} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-3 p-3 bg-dark-900 border ${snapshot.isDragging ? 'border-accent-cyan shadow-lg' : 'border-dark-600/50'} rounded-xl transition-colors`}
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="text-dark-500 hover:text-dark-300 cursor-grab active:cursor-grabbing p-1"
                                >
                                  <GripVertical size={20} />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-dark-100 font-semibold text-sm truncate">{ex.name}</h4>
                                  <span className="text-xs text-dark-400">{ex.category}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  {/* Objectif */}
                                  <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-dark-400 uppercase font-bold px-1 text-center mb-0.5">{ex.goalType === GOAL_TYPES.TIME ? 'Temps (s)' : 'Nbre'}</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={ex.targetValue}
                                      onChange={(e) => handleUpdateExercise(ex.instanceId, 'targetValue', e.target.value)}
                                      className="w-16 bg-dark-800 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-center text-dark-100 focus:border-accent-cyan focus:outline-none"
                                    />
                                  </div>
                                  
                                  {/* Repos */}
                                  <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-dark-400 uppercase font-bold px-1 text-center mb-0.5">Repos (s)</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={ex.restTime}
                                      onChange={(e) => handleUpdateExercise(ex.instanceId, 'restTime', e.target.value)}
                                      className="w-16 bg-dark-800 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-center text-dark-100 focus:border-accent-cyan focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleRemoveExercise(ex.instanceId)}
                                  className="p-2 text-dark-500 hover:text-accent-red hover:bg-dark-800 rounded-lg transition-colors ml-1"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-600/30 flex justify-end gap-3 bg-dark-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-medium text-dark-200 hover:bg-dark-700 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            style={{ padding: '8px 20px', width: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            className="bg-gradient-to-r from-accent-cyan to-accent-violet text-white font-bold rounded-2xl hover:opacity-90 transition-opacity"
          >
            <Save size={20} className="flex-shrink-0" />
            <span>Enregistrer</span>
          </button>
        </div>

        {/* Modal Catalogue (Overlay) */}
        <AnimatePresence>
          {isCatalogOpen && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="absolute inset-0 bg-dark-800 z-30 flex flex-col"
            >
              <div className="p-4 border-b border-dark-600/30 flex items-center justify-center relative bg-dark-800 sticky top-0 z-10">
                <div className="text-center">
                  <h3 className="text-lg font-bold text-dark-100">Catalogue d'exercices</h3>
                  <p className="text-xs text-dark-400 mt-0.5">{exercises.length} exercice{exercises.length > 1 ? 's' : ''} dans la séance</p>
                </div>
                <button
                  onClick={() => setIsCatalogOpen(false)}
                  style={{ padding: '3px 5px', width: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  className="absolute right-4 bg-accent-cyan text-dark-900 font-bold rounded-xl hover:opacity-90 transition-opacity text-sm"
                >
                  Terminer
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {exercisesCatalog.map((catEx) => {
                  const count = exercises.filter(ex => ex.id === catEx.id).length;
                  return (
                    <div
                      key={catEx.id}
                      className="flex items-center gap-3 p-3 bg-dark-900 rounded-xl border border-dark-600/30 hover:border-accent-cyan/50 cursor-pointer transition-colors group relative"
                      onClick={() => handleAddExercise(catEx)}
                    >
                      <div className="w-24 h-24 bg-dark-800 rounded-lg overflow-hidden relative flex-shrink-0 border border-dark-600/30">
                        <img src={catEx.mediaUrl} alt={catEx.name} className="w-full h-full object-cover" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-dark-100 font-medium text-sm truncate">{catEx.name}</h4>
                        <div className="flex gap-2 text-xs text-dark-400 mt-0.5">
                          <span className="bg-dark-800 px-1.5 py-0.5 rounded">{catEx.category}</span>
                          <span className="bg-dark-800 px-1.5 py-0.5 rounded">{catEx.level}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {count > 0 && (
                          <span className="bg-accent-cyan text-dark-900 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        )}
                        <div className="text-accent-cyan opacity-0 group-hover:opacity-100 transition-opacity p-1">
                          <Plus size={20} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
