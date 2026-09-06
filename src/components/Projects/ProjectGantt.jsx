import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  CalendarRange, 
  ZoomIn, 
  ZoomOut, 
  ChevronRight, 
  ChevronDown, 
  Target, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Maximize2, 
  Minimize2, 
  Layers, 
  ArrowLeft,
  Filter,
  Circle
} from 'lucide-react';
import { 
  parseISO, 
  format, 
  startOfISOWeek, 
  endOfISOWeek, 
  addWeeks, 
  subWeeks, 
  differenceInCalendarDays, 
  eachWeekOfInterval, 
  startOfDay,
  isValid
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTarget } from '../../contexts/TargetContext';
import { useProjects } from '../../contexts/ProjectsContext';
import { getObjectiveProgress, getObjectiveProjectProgress, getObjectiveCompletedWeeks } from '../../utils/progressUtils';
import { 
  getCurrentWeekId, 
  getWeekIdFromDate, 
  parseWeekId, 
  getWeekDates, 
  formatWeekShort 
} from '../../utils/weekUtils';

const ZOOM_CONFIGS = {
  compact: { colWidth: 42, label: 'Compact' },
  normal: { colWidth: 72, label: 'Normal' },
  detailed: { colWidth: 115, label: 'Détaillé' }
};

export default function ProjectGantt({ 
  projects, 
  onEdit, 
  onOpenDetails,
  onFocusProject,
  focusedProjectId: externalFocusedProjectId
}) {
  const { state: targetState } = useTarget();
  const { changeProjectStatus } = useProjects();
  
  const allObjectives = targetState.objectives || [];
  const categories = targetState.categories || [];
  const allProgress = targetState.progress || {};

  // Zoom & Views (default: 'compact')
  const [zoomLevel, setZoomLevel] = useState(() => localStorage.getItem('target_gantt_zoom') || 'compact');
  const [internalFocusedProjectId, setInternalFocusedProjectId] = useState(null);
  const focusedProjectId = externalFocusedProjectId || internalFocusedProjectId;

  // By default, expand if focusedProjectId is set or if viewing a single project
  const [expandedProjectIds, setExpandedProjectIds] = useState(() => {
    if (externalFocusedProjectId) return new Set([externalFocusedProjectId]);
    if (projects && projects.length === 1) return new Set([projects[0].id]);
    return new Set();
  });

  const scrollContainerRef = useRef(null);
  const todayMarkerRef = useRef(null);

  const colWidth = ZOOM_CONFIGS[zoomLevel].colWidth;
  const currentWeekId = useMemo(() => getCurrentWeekId(), []);
  const today = useMemo(() => startOfDay(new Date()), []);

  // Focused project (if any)
  const focusedProject = useMemo(() => {
    if (!focusedProjectId) return null;
    return projects.find(p => p.id === focusedProjectId) || null;
  }, [projects, focusedProjectId]);

  // Expand focused project automatically
  useEffect(() => {
    if (focusedProjectId) {
      setExpandedProjectIds(prev => new Set([...prev, focusedProjectId]));
    } else if (projects && projects.length === 1) {
      setExpandedProjectIds(prev => new Set([...prev, projects[0].id]));
    }
  }, [focusedProjectId, projects]);

  // 1. Calculate Timeline Range (Start & End dates)
  const { timelineStart, timelineEnd, weeks } = useMemo(() => {
    let minDate = today;
    let maxDate = addWeeks(today, 8);

    const relevantProjects = focusedProject ? [focusedProject] : projects;

    if (relevantProjects.length > 0) {
      let foundValidDate = false;

      relevantProjects.forEach(p => {
        if (p.startDate) {
          const s = parseISO(p.startDate);
          if (isValid(s)) {
            if (!foundValidDate || s < minDate) minDate = s;
            foundValidDate = true;
          }
        }
        if (p.endDate) {
          const e = parseISO(p.endDate);
          if (isValid(e)) {
            if (!foundValidDate || e > maxDate) maxDate = e;
            foundValidDate = true;
          }
        }

        // Also check linked objectives assignments
        const pObjIds = new Set(p.objectiveIds || []);
        const pObjs = allObjectives.filter(o => pObjIds.has(o.id) || o.projectId === p.id);
        pObjs.forEach(o => {
          (o.assignments || []).forEach(wId => {
            const wDates = getWeekDates(wId);
            if (wDates) {
              if (!foundValidDate || wDates.start < minDate) minDate = wDates.start;
              if (!foundValidDate || wDates.end > maxDate) maxDate = wDates.end;
              foundValidDate = true;
            }
          });
        });
      });
    }

    // Add padding before and after
    const paddingWeeksBefore = focusedProject ? 1 : 2;
    const paddingWeeksAfter = focusedProject ? 2 : 4;

    const start = startOfISOWeek(subWeeks(minDate, paddingWeeksBefore));
    const end = endOfISOWeek(addWeeks(maxDate, paddingWeeksAfter));

    const weeksList = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((date) => {
      const wId = getWeekIdFromDate(date);
      const wDates = getWeekDates(wId);
      const isCurrent = wId === currentWeekId;
      const parsed = parseWeekId(wId);

      return {
        weekId: wId,
        date,
        startDate: wDates ? wDates.start : date,
        endDate: wDates ? wDates.end : addWeeks(date, 1),
        shortLabel: formatWeekShort(wId),
        weekNum: parsed ? parsed.week : '',
        year: parsed ? parsed.year : '',
        isCurrent,
        monthLabel: format(date, 'MMMM yyyy', { locale: fr })
      };
    });

    return {
      timelineStart: start,
      timelineEnd: end,
      weeks: weeksList
    };
  }, [projects, focusedProject, today, currentWeekId, allObjectives]);

  // Group weeks by Month for the top-level timeline header
  const monthGroups = useMemo(() => {
    const groups = [];
    weeks.forEach((w, idx) => {
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.label !== w.monthLabel) {
        groups.push({
          label: w.monthLabel,
          startIndex: idx,
          count: 1
        });
      } else {
        lastGroup.count += 1;
      }
    });
    return groups;
  }, [weeks]);

  // Today position in px
  const todayPosition = useMemo(() => {
    const totalDays = differenceInCalendarDays(today, timelineStart);
    if (totalDays < 0) return null;
    return (totalDays / 7) * colWidth;
  }, [today, timelineStart, colWidth]);

  // Scroll to Today on mount or when requested
  const scrollToToday = () => {
    if (!scrollContainerRef.current || todayPosition === null) return;
    const container = scrollContainerRef.current;
    const targetScroll = Math.max(0, todayPosition - container.clientWidth / 2 + 150);
    container.scrollTo({ left: targetScroll, behavior: 'smooth' });
  };

  const handleTimelineWheel = (e) => {
    if (scrollContainerRef.current) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        scrollContainerRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  useEffect(() => {
    // Center on today on initial load
    const timer = setTimeout(() => {
      scrollToToday();
    }, 150);
    return () => clearTimeout(timer);
  }, [zoomLevel, focusedProjectId]);

  // Toggle expand for a project
  const toggleExpand = (projectId) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedProjectIds(new Set(projects.map(p => p.id)));
  };

  const collapseAll = () => {
    setExpandedProjectIds(new Set());
  };

  // Helper to get linked objectives for a project, sorted by realization date:
  // - Oldest planned weeks at the top
  // - Furthest planned weeks below
  // - Backlog objectives at the very bottom
  const getProjectObjectives = (project) => {
    const pObjIds = new Set(project.objectiveIds || []);
    const list = allObjectives.filter(o => pObjIds.has(o.id) || o.projectId === project.id);

    const getEarliestRealizationWeek = (obj) => {
      const isDone = getObjectiveProjectProgress(obj, allProgress) >= 1;
      const completedWeeks = getObjectiveCompletedWeeks(obj, allProgress).sort();
      if (isDone && completedWeeks.length > 0) {
        return completedWeeks[0];
      }
      if (obj.assignType === 'backlog') return null;
      const assignedWeeks = (obj.assignments || [])
        .filter(a => typeof a === 'string' && /^\d{4}-S\d{2}$/.test(a))
        .sort();
      if (assignedWeeks.length > 0) {
        return assignedWeeks[0];
      }
      if (completedWeeks.length > 0) {
        return completedWeeks[0];
      }
      return null;
    };

    const getPriorityRank = (p) => {
      if (p === 'P1' || p === 1 || p === '1') return 1;
      if (p === 'P2' || p === 2 || p === '2') return 2;
      if (p === 'P3' || p === 3 || p === '3') return 3;
      return 4;
    };

    return [...list].sort((a, b) => {
      const weekA = getEarliestRealizationWeek(a);
      const weekB = getEarliestRealizationWeek(b);

      const isBacklogA = !weekA;
      const isBacklogB = !weekB;

      // 1. Les objectifs en backlog vont tout en dernier
      if (isBacklogA && !isBacklogB) return 1;
      if (!isBacklogA && isBacklogB) return -1;

      // 2. Si tous les deux sont planifiés : les plus anciens en premier, les plus dans le futur plus bas
      if (!isBacklogA && !isBacklogB) {
        if (weekA !== weekB) {
          return weekA.localeCompare(weekB);
        }
      }

      // 3. À semaine équivalente (ou tous deux en backlog) : priorité P1 > P2 > P3
      const rankA = getPriorityRank(a.priority);
      const rankB = getPriorityRank(b.priority);
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      // 4. Repli alphabétique par titre
      return (a.title || '').localeCompare(b.title || '');
    });
  };

  // Calculate project bar position
  const getProjectBarCoordinates = (project) => {
    let sDate = project.startDate ? parseISO(project.startDate) : null;
    let eDate = project.endDate ? parseISO(project.endDate) : null;

    const hasExplicitDates = sDate && isValid(sDate) && eDate && isValid(eDate);

    if (!hasExplicitDates) {
      // Fallback: estimate from linked objectives or default to current week
      const linked = getProjectObjectives(project);
      let earliestW = null;
      let latestW = null;
      linked.forEach(o => {
        (o.assignments || []).forEach(wId => {
          const wDates = getWeekDates(wId);
          if (wDates) {
            if (!earliestW || wDates.start < earliestW) earliestW = wDates.start;
            if (!latestW || wDates.end > latestW) latestW = wDates.end;
          }
        });
      });

      if (earliestW && latestW) {
        sDate = earliestW;
        eDate = latestW;
      } else {
        sDate = today;
        eDate = addWeeks(today, 2);
      }
    }

    const startDays = differenceInCalendarDays(sDate, timelineStart);
    const durationDays = Math.max(1, differenceInCalendarDays(eDate, sDate) + 1);

    const left = (startDays / 7) * colWidth;
    const width = Math.max(colWidth * 0.8, (durationDays / 7) * colWidth);

    return {
      left,
      width,
      hasExplicitDates,
      sDate,
      eDate
    };
  };

  // Calculate objective segments for Gantt
  const getObjectiveSegments = (objective) => {
    let assignments = (objective.assignments || []).filter(a => typeof a === 'string' && a.match(/^\d{4}-S\d{2}$/));
    if (assignments.length === 0) {
      const completedWeeks = getObjectiveCompletedWeeks(objective, allProgress);
      if (completedWeeks.length > 0) {
        assignments = completedWeeks;
      } else {
        return [];
      }
    }

    // Group assigned weeks that are present in the timeline
    const segments = [];

    assignments.forEach(wId => {
      const weekIndex = weeks.findIndex(w => w.weekId === wId);
      if (weekIndex >= 0) {
        const weekProg = allProgress[wId];
        const isDoneInWeek = weekProg ? getObjectiveProgress(objective, weekProg) >= 1 : false;
        const globalProg = getObjectiveProjectProgress(objective, allProgress);

        segments.push({
          weekId: wId,
          weekIndex,
          left: weekIndex * colWidth + 4,
          width: colWidth - 8,
          isDone: isDoneInWeek || globalProg >= 1,
          prog: weekProg ? getObjectiveProgress(objective, weekProg) : globalProg
        });
      }
    });

    return segments;
  };

  const displayedProjects = focusedProject ? [focusedProject] : projects;
  const totalTimelineWidth = weeks.length * colWidth;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-dark-800/80 border border-dark-600/40 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl h-full">
      {/* 1. TOP TOOLBAR CONTROLS */}
      <div 
        className="flex flex-wrap items-center justify-between gap-3 border-b border-dark-600/40 bg-dark-800 flex-shrink-0"
        style={{ padding: '10px 14px' }}
      >
        {/* Left: Mode Title or Focus Indicator */}
        <div className="flex items-center gap-2">
          {focusedProject ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFocusedProjectId(null)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/40 text-accent-cyan text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <ArrowLeft size={14} />
                <span>Tous les projets</span>
              </button>
              <div className="flex items-center gap-1.5 text-xs text-dark-200">
                <span className="text-dark-400 font-normal">Focus :</span>
                <strong className="text-dark-100 font-bold truncate max-w-[200px]">{focusedProject.name}</strong>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
                <CalendarRange size={16} />
              </span>
              <span className="text-xs font-bold text-dark-200">
                Planning Gantt ({projects.length} projet{projects.length > 1 ? 's' : ''})
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions, Expand all & Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Bouton Aujourd'hui */}
          <button
            type="button"
            onClick={scrollToToday}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-700/70 hover:bg-dark-700 border border-dark-600/50 text-dark-200 text-xs font-semibold transition-all cursor-pointer"
            title="Centrer la frise sur la semaine en cours"
          >
            <Clock size={12} className="text-accent-cyan" />
            <span>Aujourd'hui</span>
          </button>

          {/* Expand / Collapse All */}
          <button
            type="button"
            onClick={expandedProjectIds.size === projects.length ? collapseAll : expandAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-700/70 hover:bg-dark-700 border border-dark-600/50 text-dark-300 hover:text-dark-100 text-xs font-medium transition-all cursor-pointer"
          >
            <Layers size={12} className="text-accent-violet" />
            <span>
              {expandedProjectIds.size === projects.length ? 'Replier tout' : 'Déplier objectifs'}
            </span>
          </button>

          {/* Zoom scale selector */}
          <div className="flex items-center gap-1.5 bg-dark-900/90 rounded-full border border-dark-600/60 p-1 shadow-sm">
            {Object.keys(ZOOM_CONFIGS).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  setZoomLevel(lvl);
                  localStorage.setItem('target_gantt_zoom', lvl);
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
                  zoomLevel === lvl
                    ? 'bg-accent-cyan text-slate-950 shadow-sm'
                    : 'text-dark-300 hover:text-dark-100 hover:bg-dark-700/60'
                }`}
              >
                {ZOOM_CONFIGS[lvl].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. GANTT MAIN SPLIT TABLE & TIMELINE CANVAS */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* SCROLLABLE WRAPPER (Horizontal + Vertical) */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-auto custom-scrollbar relative flex items-stretch"
        >
          {/* A. LEFT FROZEN COLUMN: PROJECTS & OBJECTIVES TREE */}
          <div 
            className="sticky left-0 z-30 flex flex-col bg-dark-800 border-r border-dark-600/60 shrink-0 shadow-lg min-h-full"
            style={{ width: '310px', minWidth: '310px' }}
          >
            {/* Header matching height and 2-level structure of timeline header (65px total: 30px + 35px) */}
            <div 
              className="sticky top-0 z-40 flex flex-col bg-dark-800 shrink-0"
              style={{ height: '65px', minHeight: '65px', maxHeight: '65px', boxSizing: 'border-box' }}
            >
              {/* Level 1: Matches Month header line (30px) */}
              <div 
                className="flex items-center justify-between pl-3.5 pr-6 border-b border-dark-500/30 text-xs font-bold text-dark-300 uppercase tracking-wider shrink-0 bg-dark-800"
                style={{ height: '30px', minHeight: '30px', maxHeight: '30px', boxSizing: 'border-box' }}
              >
                <span>Projets & Objectifs</span>
                <span className="text-[10px] text-dark-400 font-normal">Arborescence</span>
              </div>

              {/* Level 2: Matches Week header line (35px) */}
              <div 
                className="flex items-center justify-between pl-3.5 pr-6 border-b border-dark-500/30 text-[10px] text-dark-400 font-medium tracking-wider shrink-0 bg-dark-800/80"
                style={{ height: '35px', minHeight: '35px', maxHeight: '35px', boxSizing: 'border-box' }}
              >
                <span>Titre / Catégorie</span>
                <span>Priorité</span>
              </div>
            </div>

            {/* Tree Rows List */}
            <div className="flex flex-col shrink-0">
              {displayedProjects.map((project) => {
                const isExpanded = expandedProjectIds.has(project.id);
                const linkedObjectives = getProjectObjectives(project);
                const category = categories.find(c => c.id === project.categoryId) || { label: 'Autre', color: '#64748b', icon: '📁' };
                const completedCount = linkedObjectives.filter(o => getObjectiveProjectProgress(o, allProgress) >= 1).length;
                const progressPct = linkedObjectives.length > 0 ? Math.round((completedCount / linkedObjectives.length) * 100) : 0;

                return (
                  <React.Fragment key={project.id}>
                    {/* Project Row Header in Tree */}
                    <div 
                      className="group flex items-center justify-between gap-2 pl-3.5 pr-6 hover:bg-dark-500/10 transition-colors border-b border-dark-500/30 bg-dark-800/90 shrink-0 overflow-hidden"
                      style={{ height: '48px', minHeight: '48px', maxHeight: '48px', boxSizing: 'border-box' }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {/* Expand Button */}
                        {linkedObjectives.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(project.id)}
                            className="p-1 rounded-lg hover:bg-dark-600/60 text-dark-400 hover:text-dark-100 transition-colors cursor-pointer flex-shrink-0"
                            title={isExpanded ? 'Masquer les objectifs' : 'Afficher les objectifs'}
                          >
                            {isExpanded ? <ChevronDown size={14} className="text-accent-cyan" /> : <ChevronRight size={14} />}
                          </button>
                        ) : (
                          <span className="w-5 flex-shrink-0" />
                        )}

                        {/* Title & Category */}
                        <div className="flex flex-col min-w-0">
                          <span 
                            onClick={() => (onFocusProject || onOpenDetails)?.(project)}
                            className="text-xs font-bold text-dark-100 truncate hover:text-accent-cyan cursor-pointer transition-colors"
                            title="Cliquer pour focaliser sur ce projet"
                          >
                            {project.name}
                          </span>
                          <span className="text-[10px] text-dark-400 truncate flex items-center gap-1">
                            <span>{category.icon}</span>
                            <span>{category.label}</span>
                          </span>
                        </div>
                      </div>

                      {/* Right metadata in tree */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Priority P1/P2/P3 */}
                        <span 
                          className={`text-[9px] font-black rounded border px-1 ${
                            project.priority === 1 ? 'text-accent-red border-accent-red/40 bg-accent-red/10' :
                            project.priority === 2 ? 'text-accent-violet border-accent-violet/40 bg-accent-violet/10' :
                            'text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10'
                          }`}
                        >
                          P{project.priority || 2}
                        </span>

                        {/* Zoom / Focus Project button (when multiple projects) */}
                        {projects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setInternalFocusedProjectId(focusedProjectId === project.id ? null : project.id)}
                            className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                              focusedProjectId === project.id
                                ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan'
                                : 'bg-transparent border-transparent hover:border-dark-600 text-dark-400 hover:text-accent-cyan'
                            }`}
                            title={focusedProjectId === project.id ? 'Quitter le zoom focus' : 'Zoomer spécifiquement sur ce projet'}
                          >
                            {focusedProjectId === project.id ? <Minimize2 size={13} /> : <ZoomIn size={13} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sub-Rows: Linked Objectives */}
                    {isExpanded && linkedObjectives.map((obj) => {
                      const objProg = getObjectiveProjectProgress(obj, allProgress);
                      const isDone = objProg >= 1;
                      const assignmentsCount = (obj.assignments || []).length;

                      return (
                        <div 
                          key={obj.id}
                          className="flex items-center justify-between gap-2 pl-8 pr-6 hover:bg-dark-500/10 transition-colors border-b border-dark-500/20 even:bg-dark-500/[0.02] odd:bg-transparent shrink-0 overflow-hidden"
                          style={{ height: '38px', minHeight: '38px', maxHeight: '38px', boxSizing: 'border-box' }}
                        >
                          <div className="flex items-center min-w-0 flex-1">
                            <span className="text-xs text-dark-200 truncate font-medium" title={obj.title}>
                              {obj.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isDone ? (
                              <span className="text-[10px] font-bold text-accent-green bg-accent-green/10 border border-accent-green/30 rounded px-1.5 py-0.5">
                                ✓ Fait
                              </span>
                            ) : assignmentsCount > 0 ? (
                              <span className="text-[10px] text-dark-400 bg-dark-800 border border-dark-700 rounded px-1.5 py-0.5">
                                {assignmentsCount} sem.
                              </span>
                            ) : (
                              <span className="text-[9px] text-dark-500 italic">
                                Non planifié
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* B. RIGHT TIMELINE CANVAS */}
          <div 
            className="flex flex-col relative bg-dark-900/30 min-h-full shrink-0"
            style={{ width: `${totalTimelineWidth}px`, minWidth: `${totalTimelineWidth}px` }}
          >
            {/* Header: Months (Level 1) + Weeks (Level 2) */}
            <div 
              onWheel={handleTimelineWheel}
              className="sticky top-0 z-20 flex flex-col bg-dark-800/95 backdrop-blur-md shrink-0"
              style={{ height: '65px', minHeight: '65px', maxHeight: '65px', boxSizing: 'border-box' }}
            >
              {/* Level 1: Month Headers */}
              <div 
                className="flex border-b border-dark-500/30 text-xs font-bold text-dark-200 shrink-0"
                style={{ height: '30px', minHeight: '30px', maxHeight: '30px', boxSizing: 'border-box' }}
              >
                {monthGroups.map((group, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-center border-r border-dark-500/30 text-center truncate uppercase tracking-wider text-[11px]"
                    style={{ width: `${group.count * colWidth}px` }}
                  >
                    {group.label}
                  </div>
                ))}
              </div>

              {/* Level 2: Week Columns Header */}
              <div 
                className="relative flex text-[11px] text-dark-300 border-b border-dark-500/30 shrink-0"
                style={{ height: '35px', minHeight: '35px', maxHeight: '35px', boxSizing: 'border-box' }}
              >
                {weeks.map((w) => (
                  <div
                    key={w.weekId}
                    className={`flex flex-col items-center justify-center border-r font-semibold transition-colors ${
                      w.isCurrent 
                        ? 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/40 font-black' 
                        : 'border-dark-500/25 hover:bg-dark-500/10'
                    }`}
                    style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }}
                    title={`${w.weekId} : du ${format(w.startDate, 'd MMM', { locale: fr })} au ${format(w.endDate, 'd MMM', { locale: fr })}`}
                  >
                    <span>{w.shortLabel}</span>
                    {zoomLevel === 'detailed' && (
                      <span className="text-[9px] text-dark-400 font-normal">
                        {format(w.startDate, 'd/M')}
                      </span>
                    )}
                  </div>
                ))}

                {/* Sticky "Aujourd'hui" Marker on Header */}
                {todayPosition !== null && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-30"
                    style={{ left: `${todayPosition}px` }}
                  >
                    <div className="absolute top-1 -left-7 px-1.5 py-0.5 rounded-full bg-accent-cyan text-dark-950 font-black text-[9px] uppercase tracking-wider shadow-md whitespace-nowrap">
                      Aujourd'hui
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Rows Container with Full-Height Vertical Grid */}
            <div className="relative flex-1 shrink-0">
              {/* Full-Height Background Grid Columns Lines */}
              <div className="absolute inset-0 pointer-events-none flex">
                {weeks.map((w) => (
                  <div
                    key={w.weekId}
                    className={`h-full border-r ${
                      w.isCurrent 
                        ? 'border-accent-cyan/40 bg-accent-cyan/[0.04]' 
                        : 'border-dark-500/25'
                    }`}
                    style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px` }}
                  />
                ))}

                {/* Red/Cyan Vertical Indicator Line for Today (covers entire height of all rows) */}
                {todayPosition !== null && (
                  <div
                    ref={todayMarkerRef}
                    className="absolute top-0 bottom-0 z-20 w-[2px] bg-accent-cyan shadow-[0_0_8px_rgba(6,182,212,0.8)] pointer-events-none"
                    style={{ left: `${todayPosition}px` }}
                  />
                )}
              </div>

              {/* Timeline Rows: Project Bars & Objective Sub-Bars */}
              <div className="flex flex-col relative z-10 shrink-0">
              {displayedProjects.map((project) => {
                const isExpanded = expandedProjectIds.has(project.id);
                const linkedObjectives = getProjectObjectives(project);
                const coords = getProjectBarCoordinates(project);
                const completedCount = linkedObjectives.filter(o => getObjectiveProjectProgress(o, allProgress) >= 1).length;
                const progressPct = linkedObjectives.length > 0 ? Math.round((completedCount / linkedObjectives.length) * 100) : 0;

                return (
                  <React.Fragment key={project.id}>
                    {/* Project Gantt Row */}
                    <div 
                      className="relative flex items-center border-b border-dark-500/30 hover:bg-dark-500/5 transition-colors shrink-0 overflow-hidden"
                      style={{ height: '48px', minHeight: '48px', maxHeight: '48px', boxSizing: 'border-box' }}
                    >
                      {/* Project Horizontal Bar */}
                      <div
                        onClick={() => onOpenDetails?.(project)}
                        style={{
                          left: `${Math.max(0, coords.left)}px`,
                          width: `${Math.max(30, coords.width)}px`,
                        }}
                        className={`absolute h-7 rounded-xl flex items-center px-2.5 text-xs font-bold shadow-md cursor-pointer transition-all hover:brightness-110 group overflow-hidden border ${
                          project.status === '2-Terminé'
                            ? 'bg-gradient-to-r from-accent-green/80 to-accent-green text-dark-950 border-accent-green'
                            : project.status === '0-Non lancé'
                            ? 'bg-dark-700/90 text-dark-200 border-dark-600'
                            : 'bg-gradient-to-r from-accent-cyan/90 to-accent-violet/90 text-dark-950 border-accent-cyan/60'
                        }`}
                        title={`${project.name} (${progressPct}%) — Du ${format(coords.sDate, 'd MMM yyyy', { locale: fr })} au ${format(coords.eDate, 'd MMM yyyy', { locale: fr })}`}
                      >
                        {/* Progress Fill inside the bar */}
                        {progressPct > 0 && progressPct < 100 && (
                          <div
                            className="absolute top-0 bottom-0 left-0 bg-white/20 pointer-events-none transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        )}

                        <div className="relative z-10 flex items-center justify-between w-full min-w-0 gap-2">
                          <span className="truncate drop-shadow-sm">{project.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-dark-950/40 text-white font-bold whitespace-nowrap">
                            {progressPct}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sub-Rows: Objectives Gantt Sub-bars */}
                    {isExpanded && linkedObjectives.map((obj) => {
                      const segments = getObjectiveSegments(obj);

                      return (
                        <div 
                          key={obj.id} 
                          className="relative flex items-center border-b border-dark-500/20 hover:bg-dark-500/10 transition-colors even:bg-dark-500/[0.02] odd:bg-transparent shrink-0 overflow-hidden"
                          style={{ height: '38px', minHeight: '38px', maxHeight: '38px', boxSizing: 'border-box' }}
                        >
                          {segments.length > 0 ? (
                            segments.map((seg, sIdx) => (
                              <div
                                key={sIdx}
                                style={{
                                  left: `${seg.left}px`,
                                  width: `${seg.width}px`
                                }}
                                className={`absolute h-5 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-sm transition-transform hover:scale-105 border ${
                                  seg.isDone 
                                    ? 'bg-accent-green text-dark-950 border-accent-green/80' 
                                    : seg.prog > 0 
                                    ? 'bg-accent-cyan text-dark-950 border-accent-cyan/80' 
                                    : 'bg-dark-700/90 text-dark-200 border-dark-600/60'
                                }`}
                                title={`${obj.title} [${seg.weekId}] : ${seg.isDone ? 'Complété ✓' : seg.prog > 0 ? `${Math.round(seg.prog * 100)}% réalisé` : 'Affecté à cette semaine'}`}
                              >
                                <span className="truncate px-1">
                                  {seg.isDone ? '✓' : formatWeekShort(seg.weekId)}
                                </span>
                              </div>
                            ))
                          ) : (
                            /* Non-assigned objective pill */
                            <div 
                              style={{ left: `${Math.max(4, coords.left)}px` }}
                              className="absolute h-5 rounded-lg border border-dashed border-dark-600 bg-dark-800/60 text-dark-400 text-[10px] px-2 flex items-center gap-1 italic"
                              title="Aucune semaine d'affectation : cet objectif est dans le backlog"
                            >
                              <span>Non planifié (Backlog)</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* 3. BOTTOM LEGEND */}
      <div 
        className="flex flex-wrap items-center justify-between gap-3 border-t border-dark-600/40 bg-dark-800 text-xs text-dark-300 flex-shrink-0 pr-20 md:pr-24"
        style={{ padding: '8px 14px', paddingRight: '80px' }}
      >
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <span className="font-semibold text-dark-400">Légende des barres :</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded bg-accent-cyan"></span>
            <span>En cours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded bg-accent-green"></span>
            <span>Terminé / Réalisé</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded bg-dark-600"></span>
            <span>Non lancé / À venir</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded border border-dashed border-dark-500"></span>
            <span>Backlog (Sans semaine)</span>
          </div>
        </div>

        <div className="text-[11px] text-dark-400">
          💡 Astuce : Cliquez sur <strong className="text-dark-200">▶</strong> pour révéler les barres par semaine, ou sur <strong className="text-accent-cyan">🔍</strong> pour zoomer au sein d'un projet.
        </div>
      </div>
    </div>
  );
}
