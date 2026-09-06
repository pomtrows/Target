import { useState, useMemo } from 'react';
import { 
  TrendingUp, Calendar, CalendarDays, CalendarRange, Sun, 
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Clock, 
  Target, FolderKanban, ChevronDown, ChevronUp, Plus, 
  Filter, Check, AlertCircle, ArrowUpRight, Zap, Trophy,
  BarChart3, Layers
} from 'lucide-react';
import { 
  format, parseISO, startOfISOWeek, endOfISOWeek, 
  startOfMonth, endOfMonth, startOfYear, endOfYear, 
  startOfDay, endOfDay, addWeeks, subWeeks, 
  addMonths, subMonths, addYears, subYears, 
  addDays, subDays, eachDayOfInterval, getISOWeek, getISOWeekYear
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTarget } from '../../contexts/TargetContext';
import { useToast } from '../../contexts/ToastContext';
import { 
  getWeekIdFromDate, formatWeekShort, formatWeekLabelParts, 
  getWeeksInMonth, getWeekDates, getCurrentWeekId 
} from '../../utils/weekUtils';
import { getObjectiveProgress } from '../../utils/progressUtils';

export default function ProjectVelocity({
  projects = [],
  project = null,
  onEditObjective,
  onAddObjective,
  onOpenDetails,
  onFocusProject
}) {
  const { state: targetState, dispatch: targetDispatch } = useTarget();
  const { showToast } = useToast();

  // Mode de granularité : 'week' | 'month' | 'year' | 'day'
  const [granularity, setGranularity] = useState('week');
  // Date de référence pour la période active
  const [refDate, setRefDate] = useState(() => new Date());
  // Métrique du graphique comparatif : 'objectives' | 'projects'
  const [chartMetric, setChartMetric] = useState('objectives');
  // Filtre d'affichage des objectifs : 'all' | 'completed' | 'pending'
  const [statusFilter, setStatusFilter] = useState('all');
  // Recherche rapide dans la liste détaillée
  const [searchFilter, setSearchFilter] = useState('');
  // Projets dépliés dans l'accordéon
  const [expandedProjects, setExpandedProjects] = useState(() => new Set());

  const currentWeekId = useMemo(() => getCurrentWeekId(), []);
  const allObjectives = targetState.objectives || [];
  const categories = targetState.categories || [];

  // Déterminer la liste des projets concernés (projet ciblé ou ensemble de projets)
  const scopedProjects = useMemo(() => {
    if (project) return [project];
    return projects;
  }, [project, projects]);

  const scopedProjectIds = useMemo(() => {
    return new Set(scopedProjects.map(p => p.id));
  }, [scopedProjects]);

  // Objectifs associés aux projets ciblés
  const scopedObjectives = useMemo(() => {
    if (project) {
      const linkedIds = new Set(project.objectiveIds || []);
      return allObjectives.filter(o => linkedIds.has(o.id) || o.projectId === project.id);
    }
    return allObjectives.filter(o => {
      if (o.projectId && scopedProjectIds.has(o.projectId)) return true;
      return scopedProjects.some(p => (p.objectiveIds || []).includes(o.id));
    });
  }, [project, scopedProjects, scopedProjectIds, allObjectives]);

  // Associer chaque objectif à son projet
  const objectiveProjectMap = useMemo(() => {
    const map = new Map();
    scopedObjectives.forEach(obj => {
      let matched = scopedProjects.find(p => p.id === obj.projectId || (p.objectiveIds || []).includes(obj.id));
      if (!matched && !project) {
        matched = projects.find(p => p.id === obj.projectId || (p.objectiveIds || []).includes(obj.id));
      }
      map.set(obj.id, matched || null);
    });
    return map;
  }, [scopedObjectives, scopedProjects, project, projects]);

  // Index optimisé des timestamps de progression par ID d'objectif
  const timestampsByObjId = useMemo(() => {
    const map = new Map();
    if (!targetState.progressTimestamps) return map;
    for (const [key, ts] of Object.entries(targetState.progressTimestamps)) {
      const lastHyphen = key.lastIndexOf('-');
      if (lastHyphen !== -1) {
        const objId = key.substring(lastHyphen + 1);
        let list = map.get(objId);
        if (!list) {
          list = [];
          map.set(objId, list);
        }
        try {
          const ms = new Date(ts).getTime();
          if (!isNaN(ms)) list.push(ms);
        } catch {}
      }
    }
    return map;
  }, [targetState.progressTimestamps]);

  // ==========================================
  // 1. Définition des bornes temporelles
  // ==========================================
  const activePeriodInterval = useMemo(() => {
    if (granularity === 'year') {
      return {
        start: startOfYear(refDate),
        end: endOfYear(refDate),
        label: `Année ${format(refDate, 'yyyy')}`,
        subLabel: `1er janvier au 31 décembre ${format(refDate, 'yyyy')}`
      };
    }
    if (granularity === 'month') {
      return {
        start: startOfMonth(refDate),
        end: endOfMonth(refDate),
        label: format(refDate, 'MMMM yyyy', { locale: fr }),
        subLabel: `${format(startOfMonth(refDate), 'd MMMM', { locale: fr })} au ${format(endOfMonth(refDate), 'd MMMM yyyy', { locale: fr })}`
      };
    }
    if (granularity === 'day') {
      return {
        start: startOfDay(refDate),
        end: endOfDay(refDate),
        label: format(refDate, 'EEEE d MMMM yyyy', { locale: fr }),
        subLabel: `Semaine ${formatWeekShort(getWeekIdFromDate(refDate))}`
      };
    }
    // Par défaut : semaine
    const weekStart = startOfISOWeek(refDate);
    const weekEnd = endOfISOWeek(refDate);
    const weekId = getWeekIdFromDate(refDate);
    const parts = formatWeekLabelParts(weekId);
    return {
      start: weekStart,
      end: weekEnd,
      weekId,
      label: `Semaine ${parts.title.split(' - ')[0]}`,
      subLabel: `${parts.dates} (${parts.title.split(' - ')[1] || format(refDate, 'yyyy')})`
    };
  }, [granularity, refDate]);

  // Navigation temporelle
  const handlePrev = () => {
    if (granularity === 'year') setRefDate(prev => subYears(prev, 1));
    else if (granularity === 'month') setRefDate(prev => subMonths(prev, 1));
    else if (granularity === 'day') setRefDate(prev => subDays(prev, 1));
    else setRefDate(prev => subWeeks(prev, 1));
  };

  const handleNext = () => {
    if (granularity === 'year') setRefDate(prev => addYears(prev, 1));
    else if (granularity === 'month') setRefDate(prev => addMonths(prev, 1));
    else if (granularity === 'day') setRefDate(prev => addDays(prev, 1));
    else setRefDate(prev => addWeeks(prev, 1));
  };

  const handleResetCurrent = () => {
    setRefDate(new Date());
  };

  // ==========================================
  // 2. Moteur d'évaluation Planifié vs Réalisé
  // ==========================================

  // Fonction pour tester si un objectif est PLANIFIÉ sur un intervalle temporel donné
  const isObjectivePlannedIn = (obj, interval, weekIdsList) => {
    const assignments = obj.assignments || [];
    if (assignments.length === 0) return false;

    // Correspondance par ID de semaine
    if (weekIdsList && weekIdsList.length > 0) {
      const matchWeek = assignments.some(a => {
        if (typeof a !== 'string') return false;
        if (weekIdsList.includes(a)) return true;
        // Correspondance au format mois "YYYY-MM"
        if (/^\d{4}-\d{2}$/.test(a)) {
          const [y, m] = a.split('-').map(Number);
          const monthWeeks = getWeeksInMonth(y, m - 1);
          return monthWeeks.some(w => weekIdsList.includes(w));
        }
        return false;
      });
      if (matchWeek) return true;
    }

    // Correspondance par date de création ou de fin si pas d'affectation semaine
    if (obj.createdAt) {
      try {
        const cDate = parseISO(obj.createdAt);
        if (cDate >= interval.start && cDate <= interval.end) return true;
      } catch {}
    }

    return false;
  };

  // Fonction pour tester si un objectif est RÉALISÉ sur un intervalle temporel donné
  const isObjectiveCompletedIn = (obj, interval, weekIdsList) => {
    // 1. Vérification par progression dans les semaines de la période
    if (weekIdsList && weekIdsList.length > 0) {
      for (const wId of weekIdsList) {
        const weekProg = targetState.progress?.[wId];
        if (weekProg && getObjectiveProgress(obj, weekProg) >= 1) {
          // Si on est en granularité jour, vérifions la date exacte via timestamp
          if (granularity === 'day') {
            const ts = targetState.progressTimestamps?.[`${wId}-${obj.id}`];
            if (ts) {
              const d = new Date(ts);
              if (d >= interval.start && d <= interval.end) return true;
            }
          } else {
            return true;
          }
        }
      }
    }

    // 2. Vérification rapide par timestamp de progression indexé
    const tsList = timestampsByObjId.get(obj.id);
    if (tsList && tsList.length > 0) {
      const startMs = interval.start.getTime();
      const endMs = interval.end.getTime();
      for (const ms of tsList) {
        if (ms >= startMs && ms <= endMs) {
          return true;
        }
      }
    }

    // 3. Repli sur obj.completedAt si présent
    if (obj.completedAt) {
      try {
        const cDate = parseISO(obj.completedAt);
        if (cDate >= interval.start && cDate <= interval.end) return true;
      } catch {}
    }

    return false;
  };

  // Fonction pour tester si un projet est PLANIFIÉ sur un intervalle
  const isProjectPlannedIn = (proj, interval, weekIdsList, projObjectives) => {
    // 1. Si le projet a des objectifs planifiés sur cette période
    if (projObjectives.some(o => isObjectivePlannedIn(o, interval, weekIdsList))) {
      return true;
    }

    // 2. Si les dates de début/fin du projet chevauchent l'intervalle
    if (proj.startDate || proj.endDate) {
      try {
        const pStart = proj.startDate ? parseISO(proj.startDate) : interval.start;
        const pEnd = proj.endDate ? parseISO(proj.endDate) : interval.end;
        if (pStart <= interval.end && pEnd >= interval.start) {
          return true;
        }
      } catch {}
    }

    return false;
  };

  // Fonction pour tester si un projet est RÉALISÉ sur un intervalle
  const isProjectCompletedIn = (proj, interval, weekIdsList, projObjectives) => {
    if (proj.status !== '2-Terminé') return false;

    // Date de fin dans la période
    if (proj.endDate) {
      try {
        const pEnd = parseISO(proj.endDate);
        if (pEnd >= interval.start && pEnd <= interval.end) return true;
      } catch {}
    }

    if (proj.completedAt) {
      try {
        const cDate = parseISO(proj.completedAt);
        if (cDate >= interval.start && cDate <= interval.end) return true;
      } catch {}
    }

    // Ou si tous ses objectifs ont été complétés dans la période
    if (projObjectives.length > 0 && projObjectives.every(o => isObjectiveCompletedIn(o, interval, weekIdsList))) {
      return true;
    }

    return false;
  };

  // ==========================================
  // 3. Calcul des sous-périodes pour le graphique
  // ==========================================
  const chartSubPeriods = useMemo(() => {
    const periods = [];

    if (granularity === 'week') {
      // 8 semaines consécutives (5 passées, la semaine courante, 2 futures)
      const centerWeekStart = startOfISOWeek(refDate);
      for (let i = -5; i <= 2; i++) {
        const targetDate = addWeeks(centerWeekStart, i);
        const wId = getWeekIdFromDate(targetDate);
        const dates = getWeekDates(wId);
        if (!dates) continue;

        const interval = { start: dates.start, end: dates.end };
        const weekIdsList = [wId];

        const plannedObjs = scopedObjectives.filter(o => isObjectivePlannedIn(o, interval, weekIdsList));
        const completedObjs = scopedObjectives.filter(o => isObjectiveCompletedIn(o, interval, weekIdsList));

        const plannedProjs = scopedProjects.filter(p => {
          const pObjs = scopedObjectives.filter(o => objectiveProjectMap.get(o.id)?.id === p.id);
          return isProjectPlannedIn(p, interval, weekIdsList, pObjs);
        });
        const completedProjs = scopedProjects.filter(p => {
          const pObjs = scopedObjectives.filter(o => objectiveProjectMap.get(o.id)?.id === p.id);
          return isProjectCompletedIn(p, interval, weekIdsList, pObjs);
        });

        const isCurrent = wId === currentWeekId;
        const isSelected = wId === activePeriodInterval.weekId;

        periods.push({
          id: wId,
          refDate: targetDate,
          label: formatWeekShort(wId),
          title: `Semaine ${wId}`,
          subLabel: `${format(dates.start, 'd MMM', { locale: fr })} - ${format(dates.end, 'd MMM', { locale: fr })}`,
          plannedObjectives: plannedObjs.length,
          completedObjectives: completedObjs.length,
          plannedProjects: plannedProjs.length,
          completedProjects: completedProjs.length,
          isCurrent,
          isSelected
        });
      }
    } else if (granularity === 'month') {
      // Les 12 mois de l'année sélectionnée
      const year = refDate.getFullYear();
      for (let m = 0; m < 12; m++) {
        const mDate = new Date(year, m, 1);
        const interval = { start: startOfMonth(mDate), end: endOfMonth(mDate) };
        const weekIdsList = getWeeksInMonth(year, m);

        const plannedObjs = scopedObjectives.filter(o => isObjectivePlannedIn(o, interval, weekIdsList));
        const completedObjs = scopedObjectives.filter(o => isObjectiveCompletedIn(o, interval, weekIdsList));

        const plannedProjs = scopedProjects.filter(p => {
          const pObjs = scopedObjectives.filter(o => objectiveProjectMap.get(o.id)?.id === p.id);
          return isProjectPlannedIn(p, interval, weekIdsList, pObjs);
        });
        const completedProjs = scopedProjects.filter(p => {
          const pObjs = scopedObjectives.filter(o => objectiveProjectMap.get(o.id)?.id === p.id);
          return isProjectCompletedIn(p, interval, weekIdsList, pObjs);
        });

        const now = new Date();
        const isCurrent = now.getFullYear() === year && now.getMonth() === m;
        const isSelected = refDate.getMonth() === m;

        periods.push({
          id: `${year}-${String(m + 1).padStart(2, '0')}`,
          refDate: mDate,
          label: format(mDate, 'MMM', { locale: fr }),
          title: format(mDate, 'MMMM yyyy', { locale: fr }),
          subLabel: `${format(interval.start, 'd MMM', { locale: fr })} - ${format(interval.end, 'd MMM', { locale: fr })}`,
          plannedObjectives: plannedObjs.length,
          completedObjectives: completedObjs.length,
          plannedProjects: plannedProjs.length,
          completedProjects: completedProjs.length,
          isCurrent,
          isSelected
        });
      }
    } else if (granularity === 'year') {
      // 5 années consécutives (2 passées, l'année courante, 2 futures)
      const currentYear = refDate.getFullYear();
      for (let y = currentYear - 2; y <= currentYear + 2; y++) {
        const yDate = new Date(y, 0, 1);
        const interval = { start: startOfYear(yDate), end: endOfYear(yDate) };

        // Toutes les semaines de l'année
        const weekIdsList = [];
        for (let m = 0; m < 12; m++) {
          weekIdsList.push(...getWeeksInMonth(y, m));
        }

        const plannedObjs = scopedObjectives.filter(o => isObjectivePlannedIn(o, interval, weekIdsList));
        const completedObjs = scopedObjectives.filter(o => isObjectiveCompletedIn(o, interval, weekIdsList));

        const plannedProjs = scopedProjects.filter(p => {
          const pObjs = scopedObjectives.filter(o => objectiveProjectMap.get(o.id)?.id === p.id);
          return isProjectPlannedIn(p, interval, weekIdsList, pObjs);
        });
        const completedProjs = scopedProjects.filter(p => {
          const pObjs = scopedObjectives.filter(o => objectiveProjectMap.get(o.id)?.id === p.id);
          return isProjectCompletedIn(p, interval, weekIdsList, pObjs);
        });

        const now = new Date();
        const isCurrent = now.getFullYear() === y;
        const isSelected = refDate.getFullYear() === y;

        periods.push({
          id: String(y),
          refDate: yDate,
          label: String(y),
          title: `Année ${y}`,
          subLabel: `1er jan. - 31 déc. ${y}`,
          plannedObjectives: plannedObjs.length,
          completedObjectives: completedObjs.length,
          plannedProjects: plannedProjs.length,
          completedProjects: completedProjs.length,
          isCurrent,
          isSelected
        });
      }
    } else if (granularity === 'day') {
      // Les 7 jours de la semaine de référence
      const weekStart = startOfISOWeek(refDate);
      const weekEnd = endOfISOWeek(refDate);
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const wId = getWeekIdFromDate(refDate);
      const weekIdsList = [wId];

      days.forEach(dayDate => {
        const interval = { start: startOfDay(dayDate), end: endOfDay(dayDate) };
        const dayStr = format(dayDate, 'yyyy-MM-dd');

        const plannedObjs = scopedObjectives.filter(o => isObjectivePlannedIn(o, interval, weekIdsList));
        const completedObjs = scopedObjectives.filter(o => isObjectiveCompletedIn(o, interval, weekIdsList));

        const plannedProjs = scopedProjects.filter(p => {
          const pObjs = scopedObjectives.filter(o => objectiveProjectMap.get(o.id)?.id === p.id);
          return isProjectPlannedIn(p, interval, weekIdsList, pObjs);
        });
        const completedProjs = scopedProjects.filter(p => {
          const pObjs = scopedObjectives.filter(o => objectiveProjectMap.get(o.id)?.id === p.id);
          return isProjectCompletedIn(p, interval, weekIdsList, pObjs);
        });

        const nowStr = format(new Date(), 'yyyy-MM-dd');
        const isCurrent = dayStr === nowStr;
        const isSelected = dayStr === format(refDate, 'yyyy-MM-dd');

        periods.push({
          id: dayStr,
          refDate: dayDate,
          label: format(dayDate, 'EEE d', { locale: fr }),
          title: format(dayDate, 'EEEE d MMMM yyyy', { locale: fr }),
          subLabel: format(dayDate, 'd MMMM', { locale: fr }),
          plannedObjectives: plannedObjs.length,
          completedObjectives: completedObjs.length,
          plannedProjects: plannedProjs.length,
          completedProjects: completedProjs.length,
          isCurrent,
          isSelected
        });
      });
    }

    return periods;
  }, [
    granularity, refDate, scopedObjectives, scopedProjects, 
    objectiveProjectMap, currentWeekId, activePeriodInterval.weekId
  ]);

  // Max value for chart scaling
  const maxChartValue = useMemo(() => {
    let max = 1;
    chartSubPeriods.forEach(p => {
      const val = chartMetric === 'objectives' 
        ? Math.max(p.plannedObjectives, p.completedObjectives)
        : Math.max(p.plannedProjects, p.completedProjects);
      if (val > max) max = val;
    });
    return Math.max(max, 4);
  }, [chartSubPeriods, chartMetric]);

  // ==========================================
  // 4. Détail de la Période Active
  // ==========================================
  const activePeriodWeeks = useMemo(() => {
    if (granularity === 'year') {
      const year = refDate.getFullYear();
      const list = [];
      for (let m = 0; m < 12; m++) {
        list.push(...getWeeksInMonth(year, m));
      }
      return [...new Set(list)];
    }
    if (granularity === 'month') {
      return getWeeksInMonth(refDate.getFullYear(), refDate.getMonth());
    }
    // week or day
    return [getWeekIdFromDate(refDate)];
  }, [granularity, refDate]);

  // Liste des objectifs dans la période active avec statut
  const periodObjectivesDetailed = useMemo(() => {
    return scopedObjectives.map(obj => {
      const isPlanned = isObjectivePlannedIn(obj, activePeriodInterval, activePeriodWeeks);
      const isDone = isObjectiveCompletedIn(obj, activePeriodInterval, activePeriodWeeks);
      const matchedProj = objectiveProjectMap.get(obj.id);

      // Calcul de la progression exacte dans la semaine si applicable
      let progressVal = 0;
      if (activePeriodWeeks.length === 1) {
        const wp = targetState.progress?.[activePeriodWeeks[0]];
        progressVal = wp ? getObjectiveProgress(obj, wp) : 0;
      } else {
        progressVal = isDone ? 1 : 0;
      }

      return {
        ...obj,
        isPlanned,
        isDone,
        progressVal,
        project: matchedProj
      };
    }).filter(o => o.isPlanned || o.isDone);
  }, [scopedObjectives, activePeriodInterval, activePeriodWeeks, objectiveProjectMap, targetState.progress]);

  // Projets avec leurs objectifs détaillés pour la période active
  const periodProjectsDetailed = useMemo(() => {
    return scopedProjects.map(proj => {
      const projObjectives = periodObjectivesDetailed.filter(o => o.project?.id === proj.id);
      const plannedCount = projObjectives.filter(o => o.isPlanned).length;
      const completedCount = projObjectives.filter(o => o.isDone).length;
      const isPlanned = isProjectPlannedIn(proj, activePeriodInterval, activePeriodWeeks, projObjectives);
      const isDone = isProjectCompletedIn(proj, activePeriodInterval, activePeriodWeeks, projObjectives);
      const percent = plannedCount > 0 
        ? Math.round((completedCount / plannedCount) * 100) 
        : (completedCount > 0 ? 100 : 0);

      return {
        ...proj,
        isPlanned,
        isDone,
        objectives: projObjectives,
        plannedCount,
        completedCount,
        percent
      };
    }).filter(p => p.isPlanned || p.isDone || p.objectives.length > 0);
  }, [scopedProjects, periodObjectivesDetailed, activePeriodInterval, activePeriodWeeks]);

  // Objectifs sans projet rattaché
  const orphanObjectives = useMemo(() => {
    return periodObjectivesDetailed.filter(o => !o.project);
  }, [periodObjectivesDetailed]);

  // Métriques globales de la période active
  const activeMetrics = useMemo(() => {
    const plannedObjs = periodObjectivesDetailed.filter(o => o.isPlanned).length;
    const completedObjs = periodObjectivesDetailed.filter(o => o.isDone).length;
    const plannedProjs = periodProjectsDetailed.filter(p => p.isPlanned).length;
    const completedProjs = periodProjectsDetailed.filter(p => p.isDone).length;

    const velocityPercent = plannedObjs > 0 
      ? Math.round((completedObjs / plannedObjs) * 100) 
      : (completedObjs > 0 ? 100 : 0);

    const projectVelocityPercent = plannedProjs > 0 
      ? Math.round((completedProjs / plannedProjs) * 100) 
      : (completedProjs > 0 ? 100 : 0);

    return {
      plannedObjs,
      completedObjs,
      velocityPercent,
      plannedProjs,
      completedProjs,
      projectVelocityPercent
    };
  }, [periodObjectivesDetailed, periodProjectsDetailed]);

  // Bascule dépliage de projet
  const toggleExpandProject = (projId) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projId)) next.delete(projId);
      else next.add(projId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedProjects(new Set(periodProjectsDetailed.map(p => p.id)));
  };

  const collapseAll = () => {
    setExpandedProjects(new Set());
  };

  // Bascule rapide de complétion d'objectif
  const handleToggleObjective = (obj, e) => {
    e?.stopPropagation();
    const targetWeek = activePeriodWeeks[0] || currentWeekId;
    const isDone = obj.isDone;

    if (isDone) {
      // Dévalider
      targetDispatch({
        type: 'TOGGLE_PROGRESS',
        payload: { weekId: targetWeek, objectiveId: obj.id, value: 0 }
      });
      showToast(`Objectif marqué comme non terminé`, 'info');
    } else {
      // Valider
      const completeValue = obj.subObjectives?.length > 0
        ? (1 << obj.subObjectives.length) - 1
        : (Number(obj.target) > 1 ? Number(obj.target) : 1);

      targetDispatch({
        type: 'TOGGLE_PROGRESS',
        payload: { weekId: targetWeek, objectiveId: obj.id, value: completeValue }
      });
      showToast(`Objectif validé avec succès !`, 'success');
    }
  };

  // Filtrage des objectifs affichés
  const filteredProjectsDetailed = useMemo(() => {
    return periodProjectsDetailed.map(proj => {
      let objs = proj.objectives;

      if (statusFilter === 'completed') {
        objs = objs.filter(o => o.isDone);
      } else if (statusFilter === 'pending') {
        objs = objs.filter(o => !o.isDone);
      }

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        objs = objs.filter(o => o.title.toLowerCase().includes(q));
      }

      return {
        ...proj,
        filteredObjectives: objs
      };
    }).filter(p => p.filteredObjectives.length > 0 || (searchFilter === '' && statusFilter === 'all'));
  }, [periodProjectsDetailed, statusFilter, searchFilter]);

  return (
    <div className="flex flex-col gap-5 w-full animate-in fade-in duration-300">
      
      {/* ==================================================== */}
      {/* 1. Header & Barre de Contrôle : Granularité & Période */}
      {/* ==================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-800/80 border border-dark-600/40 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-sm">
        
        {/* Sélecteur de Granularité (Année, Mois, Semaine, Jour) */}
        <div className="flex items-center gap-1 bg-dark-900/80 border border-dark-700/60 rounded-xl p-1 self-start sm:self-auto overflow-x-auto">
          {[
            { id: 'year', label: 'Année', icon: Calendar },
            { id: 'month', label: 'Mois', icon: CalendarDays },
            { id: 'week', label: 'Semaine', icon: CalendarRange },
            { id: 'day', label: 'Jour', icon: Sun }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = granularity === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGranularity(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none whitespace-nowrap ${
                  isActive
                    ? 'bg-accent-cyan text-dark-950 shadow-md font-extrabold'
                    : 'text-dark-300 hover:text-dark-100 hover:bg-dark-800'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Navigateur Temporel */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-xl bg-dark-700 hover:bg-dark-600 text-dark-200 hover:text-white border border-dark-600/50 transition-colors cursor-pointer"
              title="Période précédente"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleResetCurrent}
              className="px-2.5 py-1.5 rounded-xl bg-dark-700 hover:bg-dark-600 text-dark-200 hover:text-white border border-dark-600/50 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              title="Revenir à la période actuelle"
            >
              Actuel
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-xl bg-dark-700 hover:bg-dark-600 text-dark-200 hover:text-white border border-dark-600/50 transition-colors cursor-pointer"
              title="Période suivante"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex flex-col sm:items-end">
            <span className="text-sm font-extrabold text-dark-100 leading-tight">
              {activePeriodInterval.label}
            </span>
            <span className="text-[11px] text-dark-400 font-medium">
              {activePeriodInterval.subLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. Cartes KPIs de Vélocité Globale sur la Période    */}
      {/* ==================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: Taux de Vélocité Objectifs */}
        <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 border border-dark-600/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">
              Vélocité Objectifs
            </span>
            <span className={`p-1.5 rounded-xl ${
              activeMetrics.velocityPercent >= 80 
                ? 'bg-accent-green/20 text-accent-green' 
                : activeMetrics.velocityPercent >= 50
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'bg-accent-orange/20 text-accent-orange'
            }`}>
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-dark-100">
              {activeMetrics.velocityPercent}%
            </span>
            <span className="text-xs text-dark-400 font-medium">
              de réalisation
            </span>
          </div>
          <div className="w-full bg-dark-700 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                activeMetrics.velocityPercent >= 80 
                  ? 'bg-accent-green' 
                  : activeMetrics.velocityPercent >= 50 
                  ? 'bg-accent-cyan' 
                  : 'bg-accent-orange'
              }`}
              style={{ width: `${Math.min(100, activeMetrics.velocityPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-dark-400 mt-2 font-medium">
            <span>{activeMetrics.completedObjs} réalisés</span>
            <span>{activeMetrics.plannedObjs} planifiés</span>
          </div>
        </div>

        {/* KPI 2: Projets (Planifié vs Réalisé) */}
        <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 border border-dark-600/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">
              Projets
            </span>
            <span className="p-1.5 rounded-xl bg-accent-violet/20 text-accent-violet">
              <FolderKanban size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-dark-100">
              {activeMetrics.completedProjs}
            </span>
            <span className="text-sm font-bold text-dark-400">
              / {activeMetrics.plannedProjs} terminés
            </span>
          </div>
          <div className="w-full bg-dark-700 h-2 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full bg-accent-violet transition-all duration-500"
              style={{ width: `${Math.min(100, activeMetrics.projectVelocityPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-dark-400 mt-2 font-medium">
            <span>{activeMetrics.projectVelocityPercent}% menés à terme</span>
            <span>{scopedProjects.length} au total</span>
          </div>
        </div>

        {/* KPI 3: Détail Objectifs (Réalisés vs Planifiés) */}
        <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 border border-dark-600/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">
              Objectifs au détail
            </span>
            <span className="p-1.5 rounded-xl bg-accent-cyan/20 text-accent-cyan">
              <Target size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-accent-green">
              {activeMetrics.completedObjs}
            </span>
            <span className="text-sm font-bold text-dark-400">
              / {activeMetrics.plannedObjs} atteints
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-accent-green/15 text-accent-green border border-accent-green/30">
              <CheckCircle2 size={11} /> {activeMetrics.completedObjs} faits
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-dark-700 text-dark-300 border border-dark-600/50">
              <Clock size={11} /> {Math.max(0, activeMetrics.plannedObjs - activeMetrics.completedObjs)} restants
            </span>
          </div>
          <div className="text-[11px] text-dark-400 mt-2 font-medium">
            {scopedObjectives.length} objectifs suivis
          </div>
        </div>

        {/* KPI 4: Indice d'Efficacité Agile */}
        <div className="bg-gradient-to-br from-dark-800/90 to-dark-900/90 border border-dark-600/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-dark-400 uppercase tracking-wider">
              Rythme & Tendance
            </span>
            <span className="p-1.5 rounded-xl bg-accent-gold/20 text-accent-gold">
              <Zap size={16} />
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-black text-dark-100 flex items-center gap-1.5">
              {activeMetrics.velocityPercent >= 100 ? (
                <>
                  <Trophy size={16} className="text-accent-gold" />
                  <span>Objectif 100% dépassé</span>
                </>
              ) : activeMetrics.velocityPercent >= 75 ? (
                <>
                  <Zap size={16} className="text-accent-green" />
                  <span>Cadence optimale</span>
                </>
              ) : activeMetrics.velocityPercent >= 40 ? (
                <>
                  <Clock size={16} className="text-accent-cyan" />
                  <span>Progression stable</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="text-accent-orange" />
                  <span>Effort requis</span>
                </>
              )}
            </span>
            <p className="text-[11px] text-dark-400 leading-tight mt-1">
              {project ? `Sur le projet « ${project.name} »` : `Comparaison de vélocité sur ${scopedProjects.length} projet(s)`}
            </p>
          </div>
          <div className="pt-2 border-t border-dark-700/50 flex items-center justify-between text-[11px] text-dark-400 font-semibold">
            <span>Granularité :</span>
            <span className="text-accent-cyan uppercase">{granularity}</span>
          </div>
        </div>

      </div>

      {/* ==================================================== */}
      {/* 3. Histogramme Comparatif Visuel (Planifié vs Réalisé)*/}
      {/* ==================================================== */}
      <div className="bg-dark-800/80 border border-dark-600/40 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base font-bold text-dark-100 flex items-center gap-2">
              <BarChart3 size={18} className="text-accent-cyan" />
              <span>Comparaison de Vélocité {granularity === 'week' ? 'par semaine' : `par ${granularity}`}</span>
            </h3>
            <p className="text-xs text-dark-400 mt-0.5">
              Barres juxtaposées : Planifié (cyan) vs Réalisé (vert) • Cliquez sur une barre pour afficher son détail
            </p>
          </div>

          {/* Toggle Métrique du Graphique (Objectifs vs Projets) */}
          <div className="flex items-center gap-1 bg-dark-900/90 border border-dark-700/70 rounded-xl p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartMetric('objectives')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                chartMetric === 'objectives'
                  ? 'bg-accent-cyan text-dark-950 shadow-sm font-extrabold'
                  : 'text-dark-300 hover:text-dark-100'
              }`}
            >
              <Target size={12} />
              <span>Objectifs</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('projects')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                chartMetric === 'projects'
                  ? 'bg-accent-cyan text-dark-950 shadow-sm font-extrabold'
                  : 'text-dark-300 hover:text-dark-100'
              }`}
            >
              <FolderKanban size={12} />
              <span>Projets</span>
            </button>
          </div>
        </div>

        {/* Légende du Graphique */}
        <div className="flex items-center gap-5 text-xs text-dark-300 font-semibold mb-4 px-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-accent-cyan shadow-sm" />
            <span>Planifié</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-accent-green shadow-sm" />
            <span>Réalisé</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-dark-400 text-[11px] ml-auto">
            <span className="w-2 h-2 rounded-full bg-accent-amber" />
            <span>Indicateur période actuelle</span>
          </div>
        </div>

        {/* Le Graphique à Barres Interactif */}
        <div className="flex items-end justify-between gap-2 sm:gap-4 h-56 pt-6 pb-2 px-1 sm:px-3 border-b border-dark-700/60 overflow-x-auto">
          {chartSubPeriods.map(sub => {
            const plannedVal = chartMetric === 'objectives' ? sub.plannedObjectives : sub.plannedProjects;
            const completedVal = chartMetric === 'objectives' ? sub.completedObjectives : sub.completedProjects;

            const plannedHeightPercent = Math.max(6, Math.round((plannedVal / maxChartValue) * 100));
            const completedHeightPercent = Math.max(6, Math.round((completedVal / maxChartValue) * 100));

            const periodVelocity = plannedVal > 0 
              ? Math.round((completedVal / plannedVal) * 100) 
              : (completedVal > 0 ? 100 : 0);

            return (
              <div
                key={sub.id}
                onClick={() => setRefDate(sub.refDate)}
                className={`flex-1 min-w-[48px] max-w-[80px] h-full flex flex-col justify-end items-center group cursor-pointer transition-all rounded-xl p-1.5 ${
                  sub.isSelected 
                    ? 'bg-dark-700/50 ring-2 ring-accent-cyan shadow-md' 
                    : 'hover:bg-dark-700/30'
                }`}
                title={`${sub.title} (${sub.subLabel}) : ${completedVal} réalisé(s) / ${plannedVal} planifié(s)`}
              >
                {/* Pourcentage de vélocité au-dessus */}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full mb-2 whitespace-nowrap ${
                  periodVelocity >= 100
                    ? 'bg-accent-green/20 text-accent-green'
                    : periodVelocity >= 50
                    ? 'bg-accent-cyan/20 text-accent-cyan'
                    : periodVelocity > 0
                    ? 'bg-accent-orange/20 text-accent-orange'
                    : 'text-dark-500'
                }`}>
                  {periodVelocity}%
                </span>

                {/* Les 2 barres comparatives côte à côte */}
                <div className="w-full flex items-end justify-center gap-1 h-36">
                  {/* Barre Planifié */}
                  <div className="w-1/2 flex flex-col items-center justify-end h-full">
                    <span className="text-[9px] font-bold text-dark-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {plannedVal}
                    </span>
                    <div
                      className="w-full bg-accent-cyan/80 group-hover:bg-accent-cyan rounded-t-md transition-all shadow-sm"
                      style={{ height: `${plannedVal > 0 ? plannedHeightPercent : 4}%` }}
                    />
                  </div>

                  {/* Barre Réalisé */}
                  <div className="w-1/2 flex flex-col items-center justify-end h-full">
                    <span className="text-[9px] font-bold text-accent-green mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {completedVal}
                    </span>
                    <div
                      className="w-full bg-accent-green/80 group-hover:bg-accent-green rounded-t-md transition-all shadow-sm"
                      style={{ height: `${completedVal > 0 ? completedHeightPercent : 4}%` }}
                    />
                  </div>
                </div>

                {/* Label de la période en bas */}
                <div className="mt-2 flex items-center gap-1">
                  <span className={`text-[11px] font-bold truncate ${
                    sub.isSelected ? 'text-accent-cyan' : 'text-dark-300 group-hover:text-dark-100'
                  }`}>
                    {sub.label}
                  </span>
                  {sub.isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-amber shrink-0" title="Période actuelle" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 4. Détail par Projet & par Objectif sur la Période   */}
      {/* ==================================================== */}
      <div className="flex flex-col gap-4 bg-dark-800/80 border border-dark-600/40 rounded-2xl p-4 sm:p-5 shadow-sm">
        
        {/* Titre & Filtres de la vue détaillée */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-dark-700/60">
          <div>
            <h3 className="text-base font-bold text-dark-100 flex items-center gap-2">
              <Layers size={18} className="text-accent-cyan" />
              <span>Détail des Projets & Objectifs ({activePeriodInterval.label})</span>
            </h3>
            <p className="text-xs text-dark-400 mt-0.5">
              {activeMetrics.completedObjs} objectifs réalisés sur {activeMetrics.plannedObjs} planifiés ({activeMetrics.velocityPercent}% de vélocité)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Filtre Tous / Réalisés / En attente */}
            <div className="flex items-center gap-1 bg-dark-900/80 border border-dark-700/60 rounded-xl p-0.5">
              {[
                { id: 'all', label: `Tous (${periodObjectivesDetailed.length})` },
                { id: 'completed', label: `Réalisés (${activeMetrics.completedObjs})` },
                { id: 'pending', label: `En attente (${Math.max(0, activeMetrics.plannedObjs - activeMetrics.completedObjs)})` }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-dark-700 text-dark-100 shadow-sm'
                      : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Boutons Tout Déplier / Tout Replier */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-dark-300 hover:text-dark-100 bg-dark-700/50 hover:bg-dark-700 border border-dark-600/40 cursor-pointer"
                title="Déplier tous les projets"
              >
                Déplier tout
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-dark-300 hover:text-dark-100 bg-dark-700/50 hover:bg-dark-700 border border-dark-600/40 cursor-pointer"
                title="Replier tous les projets"
              >
                Replier tout
              </button>
            </div>
          </div>
        </div>

        {/* Liste groupée par Projet */}
        <div className="flex flex-col gap-3">
          {filteredProjectsDetailed.length === 0 && orphanObjectives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-dark-900/40 border border-dashed border-dark-700/50 rounded-2xl gap-3">
              <Target size={32} className="text-dark-400 opacity-60" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-dark-200">
                  Aucun projet ni objectif trouvé pour cette période
                </span>
                <span className="text-xs text-dark-400">
                  Modifiez la période avec les flèches ci-dessus ou ajoutez un objectif planifié.
                </span>
              </div>
              {onAddObjective && (
                <button
                  type="button"
                  onClick={() => onAddObjective('en_cours')}
                  className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-cyan text-dark-950 font-bold text-xs hover:bg-accent-cyan/90 transition-all cursor-pointer shadow-sm"
                >
                  <Plus size={14} />
                  <span>Ajouter un objectif</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {filteredProjectsDetailed.map(proj => {
                const isExpanded = expandedProjects.has(proj.id);
                const projCategory = categories.find(c => c.id === proj.categoryId);

                return (
                  <div
                    key={proj.id}
                    className="bg-dark-900/50 border border-dark-600/40 rounded-xl overflow-hidden shadow-sm transition-all"
                  >
                    {/* Header du Projet */}
                    <div
                      onClick={() => toggleExpandProject(proj.id)}
                      className="flex items-center justify-between gap-3 p-3 sm:p-4 hover:bg-dark-800/60 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          className="p-1 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors border-none bg-transparent"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-sm text-dark-100 truncate">
                              {proj.name}
                            </h4>

                            {/* Badge Priorité */}
                            <span className={`text-[10px] font-black rounded border px-1.5 py-0.2 ${
                              proj.priority === 1 ? 'text-accent-red border-accent-red/40 bg-accent-red/10' :
                              proj.priority === 2 ? 'text-accent-violet border-accent-violet/40 bg-accent-violet/10' :
                              'text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10'
                            }`}>
                              P{proj.priority || 2}
                            </span>

                            {/* Badge Catégorie */}
                            {projCategory && (
                              <span className="text-[10px] font-semibold text-dark-300 flex items-center gap-1">
                                <span>{projCategory.icon}</span>
                                <span>{projCategory.label}</span>
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-dark-400 mt-0.5">
                            {proj.filteredObjectives.length} objectif(s) affiché(s) • {proj.completedCount} / {proj.plannedCount} réalisé(s) sur la période
                          </span>
                        </div>
                      </div>

                      {/* Taux de réalisation du projet & Barre de progression */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs font-black ${
                            proj.percent === 100 
                              ? 'text-accent-green' 
                              : proj.percent >= 50 
                              ? 'text-accent-cyan' 
                              : 'text-dark-300'
                          }`}>
                            {proj.completedCount} / {proj.plannedCount} ({proj.percent}%)
                          </span>
                          <div className="w-24 bg-dark-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                proj.percent === 100 ? 'bg-accent-green' : 'bg-accent-cyan'
                              }`}
                              style={{ width: `${proj.percent}%` }}
                            />
                          </div>
                        </div>

                        {onFocusProject && !project && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onFocusProject(proj);
                            }}
                            className="p-1.5 rounded-lg text-dark-400 hover:text-accent-cyan hover:bg-dark-700 transition-colors cursor-pointer border-none bg-transparent"
                            title="Ouvrir la vue détaillée de ce projet"
                          >
                            <ArrowUpRight size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Liste des objectifs (dépliée) */}
                    {isExpanded && (
                      <div className="flex flex-col gap-2 p-3 sm:px-4 sm:pb-4 pt-1 border-t border-dark-700/50 bg-dark-900/30">
                        {proj.filteredObjectives.length === 0 ? (
                          <span className="text-xs text-dark-400 italic py-2 pl-6">
                            Aucun objectif correspondant aux filtres.
                          </span>
                        ) : (
                          proj.filteredObjectives.map(obj => {
                            const assignedWeeks = (obj.assignments || [])
                              .filter(a => typeof a === 'string' && /^\d{4}-S\d{2}$/.test(a))
                              .sort();

                            return (
                              <div
                                key={obj.id}
                                className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                                  obj.isDone 
                                    ? 'bg-accent-green/5 border-accent-green/25' 
                                    : 'bg-dark-800/70 border-dark-700/50 hover:border-dark-600'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Bouton de validation rapide */}
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleObjective(obj, e)}
                                    className={`shrink-0 transition-transform active:scale-90 cursor-pointer border-none bg-transparent p-0 ${
                                      obj.isDone ? 'text-accent-green' : 'text-dark-400 hover:text-accent-cyan'
                                    }`}
                                    title={obj.isDone ? 'Marquer comme non terminé' : 'Valider cet objectif'}
                                  >
                                    {obj.isDone ? (
                                      <CheckCircle2 size={18} strokeWidth={2.5} />
                                    ) : (
                                      <Circle size={18} strokeWidth={2} />
                                    )}
                                  </button>

                                  <div className="flex flex-col min-w-0">
                                    <span className={`text-xs font-bold leading-snug truncate ${
                                      obj.isDone ? 'text-dark-200 line-through decoration-dark-400/60' : 'text-dark-100'
                                    }`}>
                                      {obj.title}
                                    </span>

                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-dark-400 flex-wrap">
                                      {/* Badge Priorité */}
                                      <span className={`font-black ${
                                        obj.priority === 'P1' ? 'text-accent-red' :
                                        obj.priority === 'P2' ? 'text-accent-violet' :
                                        'text-accent-cyan'
                                      }`}>
                                        {obj.priority || 'P3'}
                                      </span>

                                      {/* Semaines d'affectation */}
                                      {assignedWeeks.length > 0 && (
                                        <span className="flex items-center gap-1 font-semibold text-dark-300">
                                          <Calendar size={11} className="text-dark-400" />
                                          <span>Affecté : {assignedWeeks.map(formatWeekShort).join(', ')}</span>
                                        </span>
                                      )}

                                      {/* Statut Réalisé */}
                                      {obj.isDone && (
                                        <span className="font-bold text-accent-green flex items-center gap-0.5">
                                          <Check size={11} /> Réalisé sur la période
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Actions rapides */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {onEditObjective && (
                                    <button
                                      type="button"
                                      onClick={() => onEditObjective(obj)}
                                      className="p-1 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors cursor-pointer border-none bg-transparent"
                                      title="Modifier l'objectif"
                                    >
                                      <ArrowUpRight size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Objectifs orphelins (sans projet) si existants */}
              {orphanObjectives.length > 0 && (
                <div className="bg-dark-900/50 border border-dark-600/40 rounded-xl overflow-hidden p-3 shadow-sm">
                  <h4 className="font-bold text-xs text-dark-300 uppercase tracking-wider mb-2">
                    Objectifs hors projet ({orphanObjectives.length})
                  </h4>
                  <div className="flex flex-col gap-2">
                    {orphanObjectives.map(obj => (
                      <div
                        key={obj.id}
                        className={`flex items-center justify-between gap-3 p-2 rounded-xl border ${
                          obj.isDone ? 'bg-accent-green/5 border-accent-green/25' : 'bg-dark-800/60 border-dark-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => handleToggleObjective(obj, e)}
                            className={`shrink-0 cursor-pointer border-none bg-transparent p-0 ${
                              obj.isDone ? 'text-accent-green' : 'text-dark-400 hover:text-accent-cyan'
                            }`}
                          >
                            {obj.isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                          </button>
                          <span className={`text-xs font-semibold truncate ${obj.isDone ? 'line-through text-dark-400' : 'text-dark-100'}`}>
                            {obj.title}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>

    </div>
  );
}
