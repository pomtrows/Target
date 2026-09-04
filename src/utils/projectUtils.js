import { parseISO, format, isValid, startOfDay, endOfDay } from 'date-fns';
import { getWeekDates } from './weekUtils.js';
import { getObjectiveProgress } from './progressUtils.js';

/**
 * Calcule automatiquement les dates de début et de fin effectives d'un projet.
 * Si des objectifs rattachés ont été affectés à des semaines ou réalisés
 * en dehors des bornes initiales, les bornes s'élargissent automatiquement.
 *
 * @param {Object} project - L'objet projet (startDate, endDate, objectiveIds, id)
 * @param {Array} allObjectives - Liste de tous les objectifs
 * @param {Object} allProgress - Dictionnaire des progressions par semaine
 * @returns {Object} { startDate, endDate, isAdjusted, initialStartDate, initialEndDate }
 */
export function getProjectEffectiveDates(project, allObjectives = [], allProgress = {}) {
  if (!project) {
    return { startDate: null, endDate: null, isAdjusted: false, initialStartDate: null, initialEndDate: null };
  }

  const initialStart = project.startDate || project.start_date || null;
  const initialEnd = project.endDate || project.end_date || null;

  let minDate = null;
  let maxDate = null;

  if (initialStart) {
    const s = parseISO(initialStart);
    if (isValid(s)) minDate = startOfDay(s);
  }

  if (initialEnd) {
    const e = parseISO(initialEnd);
    if (isValid(e)) maxDate = endOfDay(e);
  }

  // Objectifs rattachés à ce projet
  const pObjIds = new Set(project.objectiveIds || project.objective_ids || []);
  const linkedObjectives = (allObjectives || []).filter(
    o => pObjIds.has(o.id) || o.projectId === project.id
  );

  // Collecter toutes les semaines pertinentes (affectées ou réalisées)
  const relevantWeeks = new Set();

  linkedObjectives.forEach(obj => {
    // 1. Semaines d'affectation
    (obj.assignments || []).forEach(wId => {
      if (typeof wId === 'string' && wId.match(/^\d{4}-S\d{2}$/)) {
        relevantWeeks.add(wId);
      }
    });

    // 2. Semaines où l'objectif a été réalisé ou a fait l'objet d'un suivi
    if (allProgress && typeof allProgress === 'object') {
      for (const weekId of Object.keys(allProgress)) {
        const weekData = allProgress[weekId];
        if (weekData && typeof weekData === 'object' && weekData[obj.id] !== undefined) {
          if (typeof weekId === 'string' && weekId.match(/^\d{4}-S\d{2}$/)) {
            // Considérer si l'objectif est réalisé ou a progressé (> 0)
            const prog = getObjectiveProgress(obj, weekData);
            if (prog > 0) {
              relevantWeeks.add(weekId);
            }
          }
        }
      }
    }
  });

  // Comparer et étendre les bornes
  relevantWeeks.forEach(weekId => {
    const wDates = getWeekDates(weekId);
    if (wDates && wDates.start && wDates.end) {
      const wStart = startOfDay(wDates.start);
      const wEnd = endOfDay(wDates.end);

      if (!minDate || wStart < minDate) {
        minDate = wStart;
      }
      if (!maxDate || wEnd > maxDate) {
        maxDate = wEnd;
      }
    }
  });

  const effectiveStartDate = minDate ? format(minDate, 'yyyy-MM-dd') : null;
  const effectiveEndDate = maxDate ? format(maxDate, 'yyyy-MM-dd') : null;

  const isAdjusted = 
    (effectiveStartDate !== initialStart && effectiveStartDate !== null) ||
    (effectiveEndDate !== initialEnd && effectiveEndDate !== null);

  return {
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    initialStartDate: initialStart,
    initialEndDate: initialEnd,
    isAdjusted
  };
}
