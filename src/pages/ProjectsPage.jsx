import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderKanban, Plus, Search, Filter, TrendingUp, Columns, CalendarRange,
  CheckCircle2, Clock, AlertTriangle, Circle, Eye, EyeOff,
  Database, Copy, Check, Info, X, ArrowLeft, Pencil, Calendar
} from 'lucide-react';
import { parseISO, isBefore, startOfDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useProjects } from '../contexts/ProjectsContext';
import { useTarget } from '../contexts/TargetContext';
import { getProjectEffectiveDates } from '../utils/projectUtils';
import { getObjectiveProjectProgress } from '../utils/progressUtils';
import { getCurrentWeekId } from '../utils/weekUtils';
import ProjectKanban from '../components/Projects/ProjectKanban';
import ProjectObjectiveKanban from '../components/Projects/ProjectObjectiveKanban';
import ObjectiveForm from '../components/Dashboard/ObjectiveForm';
import Modal from '../components/Shared/Modal';

// Code Splitting / Lazy Loading for heavy views and modals
const ProjectGantt = lazy(() => import('../components/Projects/ProjectGantt'));
const ProjectVelocity = lazy(() => import('../components/Projects/ProjectVelocity'));
const ProjectModal = lazy(() => import('../components/Projects/ProjectModal'));
const ProjectDetailModal = lazy(() => import('../components/Projects/ProjectDetailModal'));

function ViewLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[350px] gap-3">
      <div className="w-8 h-8 border-3 border-accent-cyan border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-dark-400 font-medium animate-pulse">Chargement...</span>
    </div>
  );
}

const SQL_SCRIPT = `-- 1. Création de la table projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile TEXT NOT NULL DEFAULT 'perso',
  name TEXT NOT NULL,
  category_id TEXT,
  description TEXT DEFAULT '',
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)),
  status TEXT NOT NULL DEFAULT '0-Non lancé' CHECK (status IN ('0-Non lancé', '1-En cours', '2-Terminé')),
  start_date DATE,
  end_date DATE,
  attachments JSONB DEFAULT '[]'::JSONB,
  objective_ids JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Sécurité RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own projects" ON public.projects;
CREATE POLICY "Users can manage their own projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Colonne project_id sur objectives
ALTER TABLE public.objectives 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;`;

export default function ProjectsPage() {
  const { projects: rawProjects, loading, isLocalFallback, updateProject } = useProjects();
  const { state: targetState, dispatch: targetDispatch } = useTarget();

  // Calcul dynamique des dates effectives selon les objectifs rattachés et leurs semaines
  const projects = useMemo(() => {
    const allObjs = targetState.objectives || [];
    const allProg = targetState.progress || {};
    return (rawProjects || []).map(p => {
      const effective = getProjectEffectiveDates(p, allObjs, allProg);
      if (effective.isAdjusted) {
        return {
          ...p,
          startDate: effective.startDate,
          start_date: effective.startDate,
          endDate: effective.endDate,
          end_date: effective.endDate,
          isDateAutoAdjusted: true
        };
      }
      return p;
    });
  }, [rawProjects, targetState.objectives, targetState.progress]);

  // Synchroniser automatiquement en arrière-plan les dates corrigées si nécessaire
  const lastSyncHashRef = useRef('');
  useEffect(() => {
    if (loading || !rawProjects || rawProjects.length === 0) return;
    const allObjs = targetState.objectives || [];
    const allProg = targetState.progress || {};

    const projectsToUpdate = [];
    rawProjects.forEach(p => {
      const effective = getProjectEffectiveDates(p, allObjs, allProg);
      if (effective.isAdjusted) {
        projectsToUpdate.push({
          id: p.id,
          startDate: effective.startDate,
          endDate: effective.endDate
        });
      }
    });

    if (projectsToUpdate.length === 0) return;

    const hash = projectsToUpdate.map(p => `${p.id}:${p.startDate}:${p.endDate}`).join('|');
    if (lastSyncHashRef.current === hash) return;
    lastSyncHashRef.current = hash;

    projectsToUpdate.forEach(item => {
      updateProject(item.id, {
        startDate: item.startDate,
        endDate: item.endDate
      });
    });
  }, [rawProjects, targetState.objectives, targetState.progress, loading, updateProject]);

  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('target_projects_view_mode');
    if (saved === 'grid') return 'velocity';
    return saved || 'kanban';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const mobileSearchInputRef = useRef(null);
  const desktopSearchInputRef = useRef(null);

  // Modals state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [detailProject, setDetailProject] = useState(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Focus Project Mode State
  const [focusedProjectId, setFocusedProjectId] = useState(null);
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [objectiveToEdit, setObjectiveToEdit] = useState(null);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('target_projects_view_mode', mode);
  };

  const categories = targetState.categories || [];

  // KPIs
  const today = useMemo(() => startOfDay(new Date()), []);
  const stats = useMemo(() => {
    let nonLances = 0;
    let enCours = 0;
    let termines = 0;
    let enRetard = 0;

    projects.forEach(p => {
      if (p.status === '0-Non lancé') nonLances++;
      if (p.status === '1-En cours') enCours++;
      if (p.status === '2-Terminé') termines++;

      if (p.status !== '2-Terminé' && p.endDate) {
        try {
          if (isBefore(startOfDay(parseISO(p.endDate)), today)) {
            enRetard++;
          }
        } catch {}
      }
    });

    return {
      total: projects.length,
      nonLances,
      enCours,
      termines,
      enRetard
    };
  }, [projects, today]);

  // Calculs pour le graphique compact mobile
  const totalProjects = stats.total || 0;
  const donutRadius = 15;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const terminesDash = totalProjects > 0 ? (stats.termines / totalProjects) * donutCircumference : 0;
  const enCoursDash = totalProjects > 0 ? (stats.enCours / totalProjects) * donutCircumference : 0;
  const nonLancesDash = totalProjects > 0 ? (stats.nonLances / totalProjects) * donutCircumference : 0;

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = p.name?.toLowerCase().includes(query);
        const matchDesc = p.description?.toLowerCase().includes(query);
        if (!matchName && !matchDesc) return false;
      }

      // Category filter
      if (selectedCategory !== 'all') {
        const catId = p.categoryId || p.category_id;
        if (catId !== selectedCategory) return false;
      }

      // Priority filter
      if (selectedPriority !== 'all') {
        const pVal = p.priority === 'P1' ? 1 : p.priority === 'P2' ? 2 : p.priority === 'P3' ? 3 : Number(p.priority);
        if (pVal !== Number(selectedPriority)) return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'enRetard') {
          if (!p.endDate || p.status === '2-Terminé') return false;
          try {
            if (!isBefore(startOfDay(parseISO(p.endDate)), today)) return false;
          } catch {
            return false;
          }
        } else if (p.status !== selectedStatus) {
          return false;
        }
      }

      return true;
    });
  }, [projects, searchQuery, selectedCategory, selectedPriority, selectedStatus]);

  const handleOpenCreate = () => {
    setProjectToEdit(null);
    setShowProjectModal(true);
  };

  const handleOpenEdit = (project) => {
    setProjectToEdit(project);
    setShowProjectModal(true);
  };

  const handleOpenDetails = (project) => {
    setDetailProject(project);
  };

  // Keep detailProject in sync with projects list
  const activeDetailProject = detailProject ? (projects.find(p => p.id === detailProject.id) || null) : null;

  // Focused project (synced with projects list)
  const focusedProject = useMemo(() => {
    if (!focusedProjectId) return null;
    return projects.find(p => p.id === focusedProjectId) || null;
  }, [projects, focusedProjectId]);

  // Objectives linked to focused project
  const focusedProjectObjectives = useMemo(() => {
    if (!focusedProject) return [];
    const linkedIds = new Set(focusedProject.objectiveIds || []);
    return (targetState.objectives || []).filter(
      obj => linkedIds.has(obj.id) || obj.projectId === focusedProject.id
    );
  }, [focusedProject, targetState.objectives]);

  // Progress stats of focused project
  const focusedProjectStats = useMemo(() => {
    if (!focusedProject || focusedProjectObjectives.length === 0) {
      return { total: 0, completed: 0, percent: 0 };
    }
    let totalRatio = 0;
    let completed = 0;
    focusedProjectObjectives.forEach(obj => {
      const prog = getObjectiveProjectProgress(obj, targetState.progress);
      totalRatio += prog;
      if (prog >= 1) completed++;
    });
    const percent = Math.round((totalRatio / focusedProjectObjectives.length) * 100);
    return {
      total: focusedProjectObjectives.length,
      completed,
      percent
    };
  }, [focusedProject, focusedProjectObjectives, targetState.progress]);

  const focusedCategory = useMemo(() => {
    if (!focusedProject) return null;
    return (targetState.categories || []).find(c => c.id === (focusedProject.categoryId || focusedProject.category_id));
  }, [focusedProject, targetState.categories]);

  const handleFocusProject = (project) => {
    setFocusedProjectId(project?.id || null);
  };

  const handleExitFocus = () => {
    setFocusedProjectId(null);
  };

  const [objectiveInitialData, setObjectiveInitialData] = useState(null);

  const handleOpenAddObjective = (colStatus) => {
    setObjectiveToEdit(null);
    const baseData = focusedProject ? {
      projectId: focusedProject.id,
      categoryId: focusedProject.categoryId || focusedProject.category_id
    } : {};

    if (colStatus === 'termine') {
      setObjectiveInitialData({
        ...baseData,
        assignType: 'week',
        assignments: [getCurrentWeekId()],
        markCompleted: true
      });
    } else if (colStatus === 'en_cours') {
      setObjectiveInitialData({
        ...baseData,
        assignType: 'week',
        assignments: [getCurrentWeekId()]
      });
    } else if (colStatus === 'non_lance') {
      setObjectiveInitialData({
        ...baseData,
        assignType: 'backlog',
        assignments: []
      });
    } else {
      setObjectiveInitialData(baseData);
    }

    setShowObjectiveModal(true);
  };

  const handleOpenEditObjective = (obj) => {
    setObjectiveToEdit(obj);
    setShowObjectiveModal(true);
  };

  const renderFilterControls = (isMobile = false) => {
    const inputRef = isMobile ? mobileSearchInputRef : desktopSearchInputRef;
    return (
      <>
        {/* Recherche */}
        {isSearchOpen ? (
          <div className="flex items-center gap-2 bg-dark-800/90 border border-accent-cyan/40 rounded-full px-3 py-1 shadow-sm">
            <Search size={14} className="text-accent-cyan flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (searchQuery) setSearchQuery('');
                  else setIsSearchOpen(false);
                }
              }}
              placeholder="Rechercher..."
              className="bg-transparent text-dark-100 placeholder-dark-400 focus:outline-none text-xs w-28 sm:w-36"
              autoFocus
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                className="p-1 hover:text-white text-dark-400 transition-colors border-none bg-transparent cursor-pointer rounded-full flex items-center justify-center"
                title="Effacer"
              >
                <X size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-1 hover:text-white text-dark-400 transition-colors border-none bg-transparent cursor-pointer rounded-full flex items-center justify-center"
                title="Fermer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className={`flex items-center gap-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              searchQuery
                ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/50 shadow-sm font-bold'
                : 'bg-dark-800/40 text-dark-400 border border-dark-600/25 hover:border-dark-500/40 hover:text-dark-200'
            }`}
            style={{ padding: '5px 12px' }}
            title="Rechercher un projet"
          >
            <Search size={14} />
            <span>{searchQuery ? `"${searchQuery}"` : 'Recherche'}</span>
          </button>
        )}

        {/* Priorité */}
        <button
          type="button"
          onClick={() => {
            let nextPriority = 'all';
            if (selectedPriority === 'all') nextPriority = '1';
            else if (selectedPriority === '1') nextPriority = '2';
            else if (selectedPriority === '2') nextPriority = '3';
            setSelectedPriority(nextPriority);
          }}
          className={`flex items-center gap-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            selectedPriority !== 'all'
              ? selectedPriority === '1'
                ? 'bg-accent-red/15 text-accent-red border border-accent-red/50 shadow-sm font-bold'
                : selectedPriority === '2'
                  ? 'bg-accent-violet/15 text-accent-violet border border-accent-violet/50 shadow-sm font-bold'
                  : 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/50 shadow-sm font-bold'
              : 'bg-dark-800/40 text-dark-400 border border-dark-600/25 hover:border-dark-500/40 hover:text-dark-200'
          }`}
          style={{ padding: '5px 12px' }}
          title="Filtrer par priorité (P1, P2, P3)"
        >
          <Filter size={14} />
          <span>{selectedPriority !== 'all' ? `Priorité P${selectedPriority}` : 'Priorité'}</span>
        </button>

        {/* Catégorie */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            className={`flex items-center gap-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory !== 'all'
                ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/50 shadow-sm font-bold'
                : 'bg-dark-800/40 text-dark-400 border border-dark-600/25 hover:border-dark-500/40 hover:text-dark-200'
            }`}
            style={{ padding: '5px 12px' }}
            title="Filtrer par catégorie"
          >
            <Filter size={14} />
            <span>
              {selectedCategory !== 'all' ? categories.find(c => c.id === selectedCategory)?.label || 'Catégorie' : 'Catégorie'}
            </span>
          </button>

          {isCategoryDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsCategoryDropdownOpen(false)} 
              />
              <div className="absolute z-50 top-full mt-2 left-0 min-w-[200px] bg-dark-800 border border-dark-600/70 rounded-xl shadow-2xl p-2 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setIsCategoryDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer border-none ${
                    selectedCategory === 'all' ? 'bg-accent-cyan/20 text-accent-cyan font-bold' : 'text-dark-200 hover:bg-dark-700/50'
                  }`}
                >
                  Toutes les catégories
                </button>
                {categories.map(cat => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setIsCategoryDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer border-none ${
                      selectedCategory === cat.id ? 'bg-accent-cyan/20 text-accent-cyan font-bold' : 'text-dark-200 hover:bg-dark-700/50'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

      </>
    );
  };

  return (
    <div className={`flex-1 flex flex-col ${viewMode === 'gantt' ? 'h-full min-h-0 gap-2 pb-1 overflow-hidden' : 'gap-5 sm:gap-6 pb-28 md:pb-32 px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4'}`}>
      {/* View Switcher: Kanban / Grille / Gantt (Style exact écran Objectifs, aligné avec le menu mobile) */}
      <div className="fixed top-[12px] left-1/2 -translate-x-1/2 z-[80] md:static md:translate-x-0 md:flex md:justify-center md:mb-1">
        <div 
          className="flex items-center gap-0.5 bg-dark-800/95 rounded-full border border-dark-600/30 backdrop-blur-md flex-shrink-0 shadow-sm"
          style={{ padding: '3px 4px' }}
        >
          <button
            type="button"
            onClick={() => handleViewModeChange('kanban')}
            className={`flex items-center gap-1 rounded-full text-[11px] font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
              viewMode === 'kanban'
                ? 'bg-accent-cyan/15 text-accent-cyan'
                : 'text-dark-400 hover:text-dark-200'
            }`}
            style={{ padding: '3px 8px' }}
          >
            <Columns size={12} />
            <span>Kanban</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('gantt')}
            className={`flex items-center gap-1 rounded-full text-[11px] font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
              viewMode === 'gantt'
                ? 'bg-accent-cyan/15 text-accent-cyan'
                : 'text-dark-400 hover:text-dark-200'
            }`}
            style={{ padding: '3px 8px' }}
          >
            <CalendarRange size={12} />
            <span>Gantt</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('velocity')}
            className={`flex items-center gap-1 rounded-full text-[11px] font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
              viewMode === 'velocity'
                ? 'bg-accent-cyan/15 text-accent-cyan'
                : 'text-dark-400 hover:text-dark-200'
            }`}
            style={{ padding: '3px 8px' }}
          >
            <TrendingUp size={12} />
            <span>Vélocité</span>
          </button>
        </div>
      </div>

      {/* Local Fallback Notice Banner */}
      {isLocalFallback && (
        <div 
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-accent-cyan/10 to-accent-violet/10 border border-accent-cyan/30 rounded-2xl text-xs"
          style={{ padding: '7px 10px' }}
        >
          <div className="flex items-center gap-2.5 text-dark-200">
            <span className="p-1.5 rounded-lg bg-accent-cyan/20 text-accent-cyan flex-shrink-0">
              <Database size={15} />
            </span>
            <span>
              <strong className="text-dark-100">Mode de secours local immédiat actif</strong> : Vos projets sont enregistrés sur cet appareil et 100% opérationnels sans attendre.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="self-start sm:self-auto rounded-xl bg-accent-cyan text-dark-950 font-bold hover:bg-accent-cyan/90 transition-all cursor-pointer whitespace-nowrap shadow-sm text-xs"
            style={{ padding: '4px 10px' }}
          >
            Activer le Cloud (SQL)
          </button>
        </div>
      )}

      {/* Focus Project Header OR Global Projects KPIs & Filters */}
      {focusedProject ? (
        <div className="flex flex-col gap-3.5 bg-dark-800/90 border border-dark-600/50 rounded-2xl p-4 sm:p-5 shadow-lg animate-in fade-in duration-200">
          {/* Top Bar: Return link + Actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Back button to all projects */}
            <button
              type="button"
              onClick={handleExitFocus}
              className="flex items-center gap-2 text-xs font-bold text-accent-cyan hover:text-accent-cyan/80 bg-accent-cyan/10 hover:bg-accent-cyan/15 border border-accent-cyan/30 rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft size={14} />
              <span>← Tous les projets</span>
            </button>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenDetails(focusedProject)}
                className="flex items-center gap-1.5 text-xs font-semibold text-dark-200 hover:text-white bg-dark-700 hover:bg-dark-600 border border-dark-600/50 rounded-xl px-3 py-1.5 transition-colors cursor-pointer"
                title="Consulter la fiche détaillée du projet"
              >
                <Info size={13} className="text-accent-cyan" />
                <span>Détails</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenEdit(focusedProject)}
                className="flex items-center gap-1.5 text-xs font-semibold text-dark-200 hover:text-white bg-dark-700 hover:bg-dark-600 border border-dark-600/50 rounded-xl px-3 py-1.5 transition-colors cursor-pointer"
                title="Modifier les informations du projet"
              >
                <Pencil size={13} className="text-accent-violet" />
                <span>Modifier</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddObjective}
                className="flex items-center gap-1.5 text-xs font-bold text-dark-950 bg-accent-cyan hover:bg-accent-cyan/90 rounded-xl px-3.5 py-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                title="Ajouter un objectif à ce projet"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Ajouter un objectif</span>
              </button>
            </div>
          </div>

          {/* Project Summary Card */}
          <div className="flex items-start justify-between gap-4 pt-1 flex-wrap sm:flex-nowrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-dark-100 leading-tight truncate">
                  {focusedProject.name}
                </h2>

                {/* Priority */}
                <span className={`text-[10px] font-black rounded border px-1.5 py-0.5 ${
                  focusedProject.priority === 1 ? 'text-accent-red border-accent-red/40 bg-accent-red/10' :
                  focusedProject.priority === 2 ? 'text-accent-violet border-accent-violet/40 bg-accent-violet/10' :
                  'text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10'
                }`}>
                  P{focusedProject.priority || 2}
                </span>

                {/* Status */}
                <span className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${
                  focusedProject.status === '2-Terminé' ? 'text-accent-green border-accent-green/30 bg-accent-green/10' :
                  focusedProject.status === '1-En cours' ? 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10' :
                  'text-dark-300 border-dark-600/40 bg-dark-700/60'
                }`}>
                  {focusedProject.status === '2-Terminé' ? 'Terminé' :
                   focusedProject.status === '1-En cours' ? 'En cours' : 'Non lancé'}
                </span>
              </div>

              {/* Dates & Category */}
              <div className="flex items-center gap-3 text-xs text-dark-400 mt-1.5 flex-wrap">
                {focusedCategory && (
                  <span className="flex items-center gap-1 font-medium text-dark-300">
                    <span>{focusedCategory.icon}</span>
                    <span>{focusedCategory.label}</span>
                  </span>
                )}

                <span className="flex items-center gap-1">
                  <Calendar size={13} className="text-dark-400" />
                  <span>
                    {focusedProject.startDate ? format(parseISO(focusedProject.startDate), 'd MMM', { locale: fr }) : '—'}
                    {' ➔ '}
                    {focusedProject.endDate ? format(parseISO(focusedProject.endDate), 'd MMM yyyy', { locale: fr }) : '—'}
                  </span>
                </span>
              </div>
            </div>

            {/* Progress summary box */}
            <div className="w-full sm:w-56 shrink-0 bg-dark-900/60 border border-dark-700/50 rounded-xl p-2.5">
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-dark-400">Objectifs</span>
                <span className={focusedProjectStats.percent === 100 ? 'text-accent-green font-bold' : 'text-accent-cyan font-bold'}>
                  {focusedProjectStats.completed} / {focusedProjectStats.total} ({focusedProjectStats.percent}%)
                </span>
              </div>
              <div className="h-2 w-full bg-dark-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    focusedProjectStats.percent === 100 ? 'bg-accent-green' : 'bg-accent-cyan'
                  }`}
                  style={{ width: `${focusedProjectStats.percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Mobile Summary Chart (< sm) */}
          <div 
            className="sm:hidden bg-dark-800/60 border border-dark-600/30 rounded-2xl flex items-center gap-3.5 shadow-sm"
            style={{ padding: '10px 14px', marginTop: '6px', marginBottom: '-6px' }}
          >
            {/* Donut SVG */}
            <div className="relative flex-shrink-0 w-12 h-12 flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 40 40" className="-rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r={donutRadius}
                  fill="none"
                  stroke="rgba(51, 65, 85, 0.4)"
                  strokeWidth="4"
                />
                {terminesDash > 0 && (
                  <circle
                    cx="20"
                    cy="20"
                    r={donutRadius}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="4"
                    strokeDasharray={`${terminesDash} ${donutCircumference}`}
                    strokeDashoffset={0}
                  />
                )}
                {enCoursDash > 0 && (
                  <circle
                    cx="20"
                    cy="20"
                    r={donutRadius}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="4"
                    strokeDasharray={`${enCoursDash} ${donutCircumference}`}
                    strokeDashoffset={-terminesDash}
                  />
                )}
                {nonLancesDash > 0 && (
                  <circle
                    cx="20"
                    cy="20"
                    r={donutRadius}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="4"
                    strokeDasharray={`${nonLancesDash} ${donutCircumference}`}
                    strokeDashoffset={-(terminesDash + enCoursDash)}
                  />
                )}
              </svg>
            </div>

            {/* Détails & Barre multi-segments */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
              <div className="flex items-center text-xs">
                <span className="font-bold text-dark-100 flex items-center gap-1.5">
                  <span>Projets</span>
                  <span className="text-dark-400 font-normal">({totalProjects})</span>
                </span>
              </div>

              {/* Barre multi-segments */}
              <div className="w-full h-2 rounded-full bg-dark-700/60 flex overflow-hidden">
                {stats.termines > 0 && (
                  <div
                    style={{ width: `${(stats.termines / totalProjects) * 100}%` }}
                    className="h-full bg-accent-green transition-all duration-500"
                  />
                )}
                {stats.enCours > 0 && (
                  <div
                    style={{ width: `${(stats.enCours / totalProjects) * 100}%` }}
                    className="h-full bg-accent-cyan transition-all duration-500"
                  />
                )}
                {stats.nonLances > 0 && (
                  <div
                    style={{ width: `${(stats.nonLances / totalProjects) * 100}%` }}
                    className="h-full bg-dark-400/60 transition-all duration-500"
                  />
                )}
              </div>

              {/* Mini-légende avec compteurs cliquables pour filtrer */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-dark-300">
                <button
                  type="button"
                  onClick={() => setSelectedStatus(selectedStatus === '0-Non lancé' ? 'all' : '0-Non lancé')}
                  className={`inline-flex items-center gap-1 cursor-pointer transition-all rounded-full px-2 py-0.5 border ${
                    selectedStatus === '0-Non lancé'
                      ? 'bg-dark-700/90 text-dark-100 border-dark-400 font-bold shadow-sm ring-1 ring-dark-400/50'
                      : 'bg-dark-900/30 text-dark-400 border-transparent hover:border-dark-600/50 hover:text-dark-200'
                  }`}
                  title={selectedStatus === '0-Non lancé' ? 'Afficher tous les statuts' : 'Filtrer : Non lancés'}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-dark-400"></span>
                  <span>{stats.nonLances} non lancé{stats.nonLances > 1 ? 's' : ''}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus(selectedStatus === '1-En cours' ? 'all' : '1-En cours')}
                  className={`inline-flex items-center gap-1 cursor-pointer transition-all rounded-full px-2 py-0.5 border ${
                    selectedStatus === '1-En cours'
                      ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/60 font-bold shadow-sm ring-1 ring-accent-cyan/40'
                      : 'bg-dark-900/30 text-accent-cyan/80 border-transparent hover:border-accent-cyan/30 hover:text-accent-cyan'
                  }`}
                  title={selectedStatus === '1-En cours' ? 'Afficher tous les statuts' : 'Filtrer : En cours'}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan"></span>
                  <span>{stats.enCours} en cours</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus(selectedStatus === '2-Terminé' ? 'all' : '2-Terminé')}
                  className={`inline-flex items-center gap-1 cursor-pointer transition-all rounded-full px-2 py-0.5 border ${
                    selectedStatus === '2-Terminé'
                      ? 'bg-accent-green/20 text-accent-green border-accent-green/60 font-bold shadow-sm ring-1 ring-accent-green/40'
                      : 'bg-dark-900/30 text-accent-green/80 border-transparent hover:border-accent-green/30 hover:text-accent-green'
                  }`}
                  title={selectedStatus === '2-Terminé' ? 'Afficher tous les statuts' : 'Filtrer : Terminés'}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green"></span>
                  <span>{stats.termines} terminé{stats.termines > 1 ? 's' : ''}</span>
                </button>
                {stats.enRetard > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStatus(selectedStatus === 'enRetard' ? 'all' : 'enRetard')}
                    className={`inline-flex items-center gap-1 font-semibold cursor-pointer transition-all rounded-full px-2 py-0.5 border ${
                      selectedStatus === 'enRetard'
                        ? 'bg-accent-red/25 text-accent-red border-accent-red font-bold shadow-sm ring-1 ring-accent-red/50'
                        : 'bg-accent-red/10 text-accent-red border-accent-red/30 hover:bg-accent-red/20'
                    }`}
                    title={selectedStatus === 'enRetard' ? 'Afficher tous les statuts' : 'Filtrer : En retard'}
                  >
                    <AlertTriangle size={11} />
                    <span>{stats.enRetard} en retard</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Filter Bar (< sm) */}
          <div 
            className="sm:hidden flex flex-wrap items-center gap-2 bg-dark-800/80 border border-dark-600/40 rounded-2xl"
            style={{ padding: '8px 12px', marginBottom: '-10px' }}
          >
            {renderFilterControls(true)}
          </div>

          {/* Unified Counters & Filters Bar - Desktop (>= sm) */}
          <div 
            className="hidden sm:flex flex-wrap items-center gap-2.5 bg-dark-800/80 border border-dark-600/40 rounded-2xl"
            style={{ padding: '6px 12px', marginBottom: '-4px' }}
          >
            {/* Tightened Counters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Total */}
              <button
                type="button"
                onClick={() => setSelectedStatus('all')}
                className={`flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  selectedStatus === 'all'
                    ? 'border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/30 shadow-sm'
                    : 'border-dark-600/30 bg-dark-800/60 text-dark-300 hover:border-dark-500/50 hover:bg-dark-750/60'
                }`}
                style={{ padding: '5px 10px' }}
                title="Afficher tous les projets"
              >
                <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider">Total</span>
                <span className="text-xs font-black text-dark-100 bg-dark-700/50 px-1.5 py-0.5 rounded">{stats.total}</span>
              </button>

              {/* Non lancés */}
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === '0-Non lancé' ? 'all' : '0-Non lancé')}
                className={`flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  selectedStatus === '0-Non lancé'
                    ? 'border-dark-400 ring-1 ring-dark-400/50 bg-dark-700/80 text-dark-100 shadow-sm'
                    : 'border-dark-600/30 bg-dark-800/60 text-dark-400 hover:border-dark-500/50 hover:bg-dark-750/60'
                }`}
                style={{ padding: '5px 10px' }}
                title="Filtrer : Projets non lancés"
              >
                <Circle size={11} className="text-dark-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Non lancés</span>
                <span className="text-xs font-black text-dark-300 bg-dark-700/50 px-1.5 py-0.5 rounded">{stats.nonLances}</span>
              </button>

              {/* En cours */}
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === '1-En cours' ? 'all' : '1-En cours')}
                className={`flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  selectedStatus === '1-En cours'
                    ? 'border-accent-cyan ring-1 ring-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan shadow-sm'
                    : 'border-dark-600/30 bg-dark-800/60 text-accent-cyan/80 hover:border-dark-500/50 hover:bg-dark-750/60'
                }`}
                style={{ padding: '5px 10px' }}
                title="Filtrer : Projets en cours"
              >
                <Clock size={11} className="text-accent-cyan" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">En cours</span>
                <span className="text-xs font-black text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded">{stats.enCours}</span>
              </button>

              {/* Terminés */}
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === '2-Terminé' ? 'all' : '2-Terminé')}
                className={`flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  selectedStatus === '2-Terminé'
                    ? 'border-accent-green ring-1 ring-accent-green/50 bg-accent-green/15 text-accent-green shadow-sm'
                    : 'border-dark-600/30 bg-dark-800/60 text-accent-green/80 hover:border-dark-500/50 hover:bg-dark-750/60'
                }`}
                style={{ padding: '5px 10px' }}
                title="Filtrer : Projets terminés"
              >
                <CheckCircle2 size={11} className="text-accent-green" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Terminés</span>
                <span className="text-xs font-black text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded">{stats.termines}</span>
              </button>

              {/* En retard */}
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === 'enRetard' ? 'all' : 'enRetard')}
                className={`flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  selectedStatus === 'enRetard'
                    ? 'border-accent-red ring-2 ring-accent-red/50 bg-accent-red/20 text-accent-red shadow-sm'
                    : stats.enRetard > 0 
                      ? 'bg-accent-red/10 border-accent-red/30 text-accent-red hover:bg-accent-red/20' 
                      : 'border-dark-600/30 bg-dark-800/60 text-dark-400 hover:border-dark-500/50 hover:bg-dark-750/60'
                }`}
                style={{ padding: '5px 10px' }}
                title="Filtrer : Projets en retard"
              >
                <AlertTriangle size={11} className={stats.enRetard > 0 || selectedStatus === 'enRetard' ? 'text-accent-red' : 'text-dark-400'} />
                <span className="text-[11px] font-semibold uppercase tracking-wider">En retard</span>
                <span className={`text-xs font-black px-1.5 py-0.5 rounded ${stats.enRetard > 0 ? 'text-accent-red bg-accent-red/20' : 'text-dark-400 bg-dark-700/50'}`}>{stats.enRetard}</span>
              </button>
            </div>

            {/* Separator between Counters and Filters */}
            <div className="hidden lg:block h-6 w-px bg-dark-600/50 mx-0.5" />

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {renderFilterControls(false)}
            </div>
          </div>
        </>
      )}

      {/* Main Content View */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[350px] gap-3">
          <div className="w-8 h-8 border-3 border-accent-cyan border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-dark-400 font-medium">Chargement des projets...</span>
        </div>
      ) : focusedProject ? (
        viewMode === 'kanban' ? (
          <ProjectObjectiveKanban
            project={focusedProject}
            onEditObjective={handleOpenEditObjective}
            onAddObjective={handleOpenAddObjective}
          />
        ) : viewMode === 'gantt' ? (
          <Suspense fallback={<ViewLoader />}>
            <ProjectGantt
              key={focusedProject.id}
              projects={[focusedProject]}
              focusedProjectId={focusedProject.id}
              onEdit={handleOpenEdit}
              onOpenDetails={handleOpenDetails}
              onFocusProject={handleFocusProject}
              onEditObjective={handleOpenEditObjective}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewLoader />}>
            <ProjectVelocity
              project={focusedProject}
              onEditObjective={handleOpenEditObjective}
              onAddObjective={handleOpenAddObjective}
              onOpenDetails={handleOpenDetails}
            />
          </Suspense>
        )
      ) : filteredProjects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[350px] p-8 text-center bg-dark-800/40 border border-dashed border-dark-700 rounded-3xl gap-4">
          <div className="w-16 h-16 rounded-2xl bg-dark-700/60 flex items-center justify-center text-dark-400">
            <FolderKanban size={32} />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="text-base font-bold text-dark-100">
              {projects.length === 0 ? 'Aucun projet créé pour le moment' : 'Aucun projet ne correspond à vos filtres'}
            </h3>
            <p className="text-xs text-dark-400 leading-relaxed">
              {projects.length === 0 
                ? 'Créez votre premier projet pour regrouper vos objectifs, centraliser vos notes et suivre vos échéances.' 
                : 'Essayez de réinitialiser vos critères de recherche ou vos filtres de statut et de catégorie.'}
            </p>
          </div>
          {projects.length === 0 ? (
            <button
              onClick={handleOpenCreate}
              className="px-5 py-2.5 rounded-xl bg-accent-cyan text-dark-950 font-bold text-xs hover:bg-accent-cyan/90 transition-all shadow-md active:scale-95 mt-2"
            >
              + Créer mon premier projet
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedPriority('all');
                setSelectedStatus('all');
                setHideCompleted(false);
              }}
              className="px-4 py-2 rounded-xl bg-dark-700 text-dark-200 text-xs font-semibold hover:bg-dark-600 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        <ProjectKanban
          projects={filteredProjects}
          onEdit={handleOpenEdit}
          onOpenDetails={handleOpenDetails}
          onFocusProject={handleFocusProject}
        />
      ) : viewMode === 'gantt' ? (
        <Suspense fallback={<ViewLoader />}>
          <ProjectGantt
            projects={filteredProjects}
            onEdit={handleOpenEdit}
            onOpenDetails={handleOpenDetails}
            onFocusProject={handleFocusProject}
            onEditObjective={handleOpenEditObjective}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<ViewLoader />}>
          <ProjectVelocity
            projects={filteredProjects}
            onEditObjective={handleOpenEditObjective}
            onAddObjective={handleOpenAddObjective}
            onOpenDetails={handleOpenDetails}
            onFocusProject={handleFocusProject}
          />
        </Suspense>
      )}

      {/* Project Create / Edit Modal */}
      {showProjectModal && (
        <Suspense fallback={null}>
          <ProjectModal
            isOpen={showProjectModal}
            onClose={() => setShowProjectModal(false)}
            projectToEdit={projectToEdit}
          />
        </Suspense>
      )}

      {/* Project Detail Modal */}
      {activeDetailProject && (
        <Suspense fallback={null}>
          <ProjectDetailModal
            isOpen={!!activeDetailProject}
            onClose={() => setDetailProject(null)}
            project={activeDetailProject}
            onEdit={handleOpenEdit}
          />
        </Suspense>
      )}

      {/* Objective Create / Edit Modal (from project focus mode) */}
      {showObjectiveModal && (
        <ObjectiveForm
          isOpen={showObjectiveModal}
          onClose={() => {
            setShowObjectiveModal(false);
            setObjectiveToEdit(null);
            setObjectiveInitialData(null);
          }}
          editObjective={objectiveToEdit}
          defaultProjectId={focusedProject?.id || ''}
          initialData={objectiveInitialData || (!objectiveToEdit && focusedProject ? { 
            projectId: focusedProject.id, 
            categoryId: focusedProject.categoryId || focusedProject.category_id 
          } : null)}
          onObjectiveCreated={(savedObjId) => {
            if (objectiveInitialData?.markCompleted) {
              const targetWeek = getCurrentWeekId();
              targetDispatch({
                type: 'TOGGLE_PROGRESS',
                payload: { weekId: targetWeek, objectiveId: savedObjId, value: 1 }
              });
            }
          }}
          zIndex={220}
        />
      )}

      {/* SQL Migration Modal */}
      {showSqlModal && (
        <Modal
          isOpen={showSqlModal}
          onClose={() => setShowSqlModal(false)}
          title="Activer la synchronisation Cloud Supabase ☁️"
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col gap-4 text-dark-200">
            <p className="text-xs text-dark-300 leading-relaxed">
              Vos projets fonctionnent actuellement en <strong>mode de secours local</strong> (enregistrés en toute sécurité sur votre appareil).
              Pour activer la synchronisation cloud et accéder à vos projets sur tous vos appareils, copiez ce script et exécutez-le dans le <strong>SQL Editor</strong> de votre console Supabase :
            </p>

            <div className="relative">
              <pre className="bg-dark-900 border border-dark-600/50 rounded-xl p-3 text-[11px] text-dark-200 font-mono overflow-x-auto max-h-64 custom-scrollbar">
                {SQL_SCRIPT}
              </pre>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(SQL_SCRIPT);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 3000);
                }}
                className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-500/50 text-xs font-semibold text-dark-100 transition-all shadow-md cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <Check size={14} className="text-accent-green" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copier le code SQL
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-dark-700 hover:bg-dark-600 text-dark-200 transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bouton flottant Nouveau projet / Nouvel objectif (+) */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={focusedProject ? handleOpenAddObjective : handleOpenCreate}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-dark-100 text-dark-900 shadow-2xl flex items-center justify-center z-50 hover:bg-dark-100 transition-all duration-300 md:bottom-10 md:right-10 cursor-pointer border-none"
        title={focusedProject ? "Nouvel objectif pour ce projet" : "Nouveau projet"}
      >
        <Plus size={28} strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}
