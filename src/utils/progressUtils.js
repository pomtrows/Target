/**
 * Count set bits in an integer (used for sub-objectives progression)
 */
export function countSetBits(n) {
  let count = 0;
  let temp = Number(n) || 0;
  while (temp > 0) {
    temp &= (temp - 1);
    count++;
  }
  return count;
}

/**
 * Check if a specific bit is set
 */
export function isBitSet(value, index) {
  return (Number(value) & (1 << index)) !== 0;
}

/**
 * Toggle a bit in a value
 */
export function toggleBit(value, index) {
  return Number(value) ^ (1 << index);
}

/**
 * Calculate the progress for a single objective in a given week
 * Returns a value between 0 and 1
 */
export function getObjectiveProgress(objective, weekProgress) {
  if (!weekProgress) return 0;
  const current = weekProgress[objective.id] || 0;

  // Handle Sub-objectives (if target is 1 and sub-objectives exist)
  if (Number(objective.target) === 1 && objective.subObjectives?.length > 0) {
    const done = countSetBits(current);
    return Math.min(done / objective.subObjectives.length, 1);
  }

  // If target is 0 or 1 (boolean/checkbox), treat as toggle
  if (!objective.target || Number(objective.target) <= 1) {
    return current >= 1 ? 1 : 0;
  }

  return Math.min(current / objective.target, 1);
}

/**
 * Calculate the global progress for a week
 * Returns a value between 0 and 1
 */
export function getWeekProgress(objectives, weekProgress) {
  if (!objectives || objectives.length === 0) return 0;

  const total = objectives.reduce((sum, obj) => {
    return sum + getObjectiveProgress(obj, weekProgress);
  }, 0);

  return total / objectives.length;
}

/**
 * Get the progress percentage (0-100)
 */
export function getWeekProgressPercent(objectives, weekProgress) {
  return Math.round(getWeekProgress(objectives, weekProgress) * 100);
}

/**
 * Check if a week is fully completed (based on a threshold, default 100%)
 */
export function isWeekComplete(objectives, weekProgress, threshold = 100) {
  return getWeekProgressPercent(objectives, weekProgress) >= threshold;
}

/**
 * Get color for a progress value (0-1)
 */
export function getProgressColor(progress) {
  if (progress >= 1) return '#22c55e'; // green
  if (progress >= 0.75) return '#06b6d4'; // cyan
  if (progress >= 0.5) return '#f97316'; // orange
  if (progress >= 0.25) return '#fbbf24'; // yellow
  return '#ef4444'; // red
}

/**
 * Get objectives assigned to a specific week (including month-level assignments)
 */
export function getObjectivesForWeek(objectives, weekId, getWeeksInMonthFn) {
  return objectives.filter((obj) => {
    if (!obj.assignments || !Array.isArray(obj.assignments) || obj.assignments.length === 0) return false;

    return obj.assignments.some((assignment) => {
      if (typeof assignment !== 'string') return false;

      // Direct week assignment
      if (assignment === weekId) return true;

      // Month assignment (format: YYYY-MM)
      if (assignment.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = assignment.split('-').map(Number);
        const weeksInMonth = getWeeksInMonthFn(year, month - 1);
        return weeksInMonth.includes(weekId);
      }

      return false;
    });
  });
}

/**
 * Get backlog objectives (no assignments)
 */
export function getBacklogObjectives(objectives) {
  return objectives.filter(
    (obj) => !obj.assignments || obj.assignments.length === 0
  );
}
