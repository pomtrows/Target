import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, Gift, Sparkles, Pencil, Check } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';

export default function RewardBanner({ weekId, isUnlocked }) {
  const { state, dispatch } = useTarget();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const reward = state.rewards[weekId] || '';

  const handleStartEdit = () => {
    setEditValue(reward);
    setIsEditing(true);
  };

  const handleSave = () => {
    dispatch({
      type: 'SET_REWARD',
      payload: { weekId, reward: editValue.trim() },
    });
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setIsEditing(false);
  };

  if (!reward && !isEditing) {
    return (
      <motion.button
        onClick={handleStartEdit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full p-4 rounded-2xl border-2 border-dashed border-dark-600/50 text-dark-500 hover:text-dark-300 hover:border-dark-500/50 transition-all flex items-center justify-center gap-2 text-sm"
      >
        <Gift size={18} />
        Définir une récompense pour cette semaine
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl transition-all duration-500 ${
        isUnlocked
          ? 'bg-gradient-to-r from-accent-gold/10 via-amber-500/10 to-accent-gold/10 border border-accent-gold/30'
          : 'glass border border-dark-600/30'
      }`}
    >
      {/* Unlocked shimmer effect */}
      {isUnlocked && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-gold/10 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{ width: '50%' }}
        />
      )}

      <div className="relative p-5 flex items-center gap-4">
        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isUnlocked
              ? 'bg-accent-gold/20'
              : 'bg-dark-600/50'
          }`}
        >
          {isUnlocked ? (
            <motion.div
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              <Sparkles size={24} className="text-accent-gold" />
            </motion.div>
          ) : (
            <Lock size={22} className="text-dark-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              isUnlocked ? 'text-accent-gold' : 'text-dark-400'
            }`}>
              {isUnlocked ? '🎉 Récompense débloquée !' : '🔒 Récompense verrouillée'}
            </span>
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Un restaurant japonais 🍣"
                autoFocus
                className="flex-1 bg-dark-600/50 border border-dark-500/50 rounded-lg px-3 py-1.5 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-cyan/50"
              />
              <button
                onClick={handleSave}
                className="p-2 rounded-lg bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors"
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className={`text-sm font-medium truncate ${
                isUnlocked ? 'text-dark-100' : 'text-dark-400'
              }`}>
                {reward}
              </p>
              <button
                onClick={handleStartEdit}
                className="p-1 rounded text-dark-500 hover:text-dark-300 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>


      </div>
    </motion.div>
  );
}
