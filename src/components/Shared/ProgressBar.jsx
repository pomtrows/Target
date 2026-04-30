import { motion } from 'framer-motion';

export default function ProgressBar({ progress, color, height = 8, showLabel = false, className = '' }) {
  const percent = Math.round(progress * 100);

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-dark-400">Progression</span>
          <span className="text-xs font-semibold" style={{ color }}>{percent}%</span>
        </div>
      )}
      <div
        className="w-full rounded-full bg-dark-600/30 border border-dark-600/50 overflow-hidden"
        style={{ height }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        />
      </div>
    </div>
  );
}
