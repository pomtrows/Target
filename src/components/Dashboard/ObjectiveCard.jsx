import { motion } from 'framer-motion';
import { Plus, Minus, Check, Pencil, Trash2 } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { getObjectiveProgress, getProgressColor } from '../../utils/progressUtils';

export default function ObjectiveCard({ objective, weekId, index, onEdit, onDelete }) {
  const { state, dispatch } = useTarget();

  const category = state.categories.find((c) => c.id === objective.categoryId);
  const weekProgress = state.progress[weekId] || {};
  const current = weekProgress[objective.id] || 0;
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
        <h3 className="font-bold text-lg text-dark-100 mb-6 px-1">
          {objective.title}
        </h3>

        {/* Counter Section */}
        <div className="flex items-center gap-6 mb-8 px-1">
          {!isCheckbox && (
            <div className="flex items-center gap-4">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleDecrement}
                disabled={current <= 0}
                className="w-10 h-10 rounded-xl bg-dark-600/60 flex items-center justify-center text-dark-300 hover:bg-dark-600/80 hover:text-dark-100 disabled:opacity-10 disabled:cursor-not-allowed transition-all"
              >
                <Minus size={18} />
              </motion.button>

              <div className="flex flex-col items-center min-w-[60px]">
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
          )}

          {isCheckbox && (
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
    </motion.div>
  );
}
