import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Check, Pencil, Trash2, Play } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { useSport } from '../../contexts/SportContext';
import { getObjectiveProgress, getProgressColor, isBitSet } from '../../utils/progressUtils';
import WorkoutPlayer from '../Sport/WorkoutPlayer';

export default function ObjectiveCard({ objective, weekId, index, onEdit, onDelete }) {
  const { state, dispatch } = useTarget();
  const { sessions } = useSport();
  const [sessionToPlay, setSessionToPlay] = useState(null);

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
      style={{ padding: '16px 20px 12px 20px' }}
      className="group relative h-full min-h-[110px] rounded-[24px] bg-dark-700/40 border border-dark-600 transition-all duration-300 hover:bg-dark-700/60 flex flex-col justify-between shadow-xl hover:shadow-2xl"
    >
      {/* Edit/Delete Icons (Top Right) */}
      <div className="absolute top-3 right-4 flex gap-4 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit?.(objective); }}
          className="p-2 rounded-lg text-dark-200 hover:text-dark-100 hover:bg-dark-600/50 transition-all"
        >
          <Pencil size={18} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(objective.id); }}
          className="p-2 rounded-lg text-dark-300 hover:text-accent-red hover:bg-accent-red/10 transition-all"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex-1">
        {/* Title */}
        <h3 className="font-bold text-lg text-dark-100 mb-6 px-1 pr-12">
          {objective.title}
        </h3>

        {/* Counter Section OR Sub-objectives */}
        <div className="flex items-center mb-6 px-1" style={{ gap: '35px' }}>
          <div className={hasSubObjectives ? "flex-1" : ""}>
            {hasSubObjectives ? (
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
              <div className="flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleDecrement}
                  disabled={current <= 0}
                  className="w-10 h-10 rounded-xl bg-dark-600/60 flex items-center justify-center text-dark-300 hover:bg-dark-600/80 hover:text-dark-100 disabled:opacity-10 disabled:cursor-not-allowed transition-all"
                >
                  <Minus size={18} />
                </motion.button>

                <div className="flex flex-col items-center min-w-[50px]">
                  <motion.span
                    key={current}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className={`text-2xl font-black tabular-nums ${isCompleted ? 'text-accent-green' : 'text-dark-100'}`}
                  >
                    {current}/{objective.target}
                  </motion.span>
                </div>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleIncrement}
                  disabled={isCompleted}
                  className={`w-10 h-10 rounded-xl bg-dark-600/60 flex items-center justify-center transition-all ${
                    isCompleted 
                      ? 'opacity-0 cursor-default' 
                      : 'text-dark-300 hover:text-dark-100 hover:bg-dark-600/80'
                  }`}
                >
                  <Plus size={18} />
                </motion.button>
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

          {sportSession && (
            <button
              onClick={() => setSessionToPlay(sportSession)}
              className="flex items-center bg-accent-cyan/15 text-accent-cyan font-bold rounded-xl hover:bg-accent-cyan/25 transition-all text-xs shadow-lg shadow-accent-cyan/5 border border-accent-cyan/30 flex-shrink-0"
              style={{ padding: '8px 18px', gap: '6px' }}
            >
              <Play size={14} fill="currentColor" />
              <span>Lancer</span>
            </button>
          )}
        </div>
      </div>

      {/* Footer Progress Bar with integrated Checkmark */}
      <div className="relative mt-auto px-1 flex items-center h-10">
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
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-dark-700 border-[6px] border-dark-800/50 flex items-center justify-center shadow-xl z-10"
          >
            <div className="w-full h-full rounded-full bg-accent-green/20 flex items-center justify-center">
              <Check size={20} className="text-accent-green" strokeWidth={4} />
            </div>
          </motion.div>
        )}
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
    </motion.div>
  );
}
