import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { getProgressColor } from '../../utils/progressUtils';

export default function ProgressRing({
  progress,
  size = 160,
  strokeWidth = 12,
  className = '',
}) {
  const percent = Math.round(progress * 100);
  const color = getProgressColor(progress);

  const { radius, circumference, offset } = useMemo(() => {
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const o = c - progress * c;
    return { radius: r, circumference: c, offset: o };
  }, [size, strokeWidth, progress]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(51, 65, 85, 0.5)"
          strokeWidth={strokeWidth}
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', damping: 20, stiffness: 60, duration: 1.5 }}
          style={{
            filter: `drop-shadow(0 0 8px ${color}40)`,
          }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`${size < 60 ? 'text-sm' : size < 100 ? 'text-xl' : 'text-3xl'} font-bold`}
          style={{ color }}
          key={percent}
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
        >
          {percent}%
        </motion.span>
        {size >= 80 && (
          <span className="text-xs text-dark-400 mt-0.5">Atteinte</span>
        )}
      </div>
    </div>
  );
}
