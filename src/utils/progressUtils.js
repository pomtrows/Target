/**
 * Calculate the progress for a single objective in a given week
 * Returns a value between 0 and 1
 */
export function getObjectiveProgress(objective, weekProgress) {
  if (!weekProgress) return 0;
  const current = weekProgress[objective.id] || 0;

  // If target is 0 or 1 (boolean/checkbox), treat as toggle
  if (!objective.target || objective.target <= 1) {
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
 * Check if a week is fully completed (100%)
 */
export function isWeekComplete(objectives, weekProgress) {
  return getWeekProgress(objectives, weekProgress) === 1;
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
    if (!obj.assignments || obj.assignments.length === 0) return false;

    return obj.assignments.some((assignment) => {
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
