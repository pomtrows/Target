import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderKanban, Plus, Search, Filter, LayoutGrid, Columns, CalendarRange,
  CheckCircle2, Clock, AlertTriangle, Circle, Eye, EyeOff,
  Database, Copy, Check, Info, X
} from 'lucide-react';
import { parseISO, isBefore, startOfDay } from 'date-fns';
import { useProjects } from '../contexts/ProjectsContext';
import { useTarget } from '../contexts/TargetContext';
import { getProjectEffectiveDates } from '../utils/projectUtils';
import ProjectCard from '../components/Projects/ProjectCard';
import ProjectKanban from '../components/Projects/ProjectKanban';
import ProjectGantt from '../components/Projects/ProjectGantt';
import ProjectModal from '../components/Projects/ProjectModal';
import ProjectDetailModal from '../components/Projects/ProjectDetailModal';
import Modal from '../components/Shared/Modal';

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
  const { state: targetState } = useTarget();

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

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('target_projects_view_mode') || 'kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const searchInputRef = useRef(null);

  // Modals state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [detailProject, setDetailProject] = useState(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('target_projects_view_mode', mode);
  };

  const categories = targetState.categories || [];

  // KPIs
  const today = startOfDay(new Date());
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
  const completionRate = totalProjects > 0 ? Math.round((stats.termines / totalProjects) * 100) : 0;
  const donutRadius = 15;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const terminesDash = totalProjects > 0 ? (stats.termines / totalProjects) * donutCircumference : 0;
  const enCoursDash = totalProjects > 0 ? (stats.enCours / totalProjects) * donutCircumference : 0;
  const nonLancesDash = totalProjects > 0 ? (stats.nonLances / totalProjects) * donutCircumference : 0;

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Hide completed
      if (hideCompleted && p.status === '2-Terminé') return false;

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
  }, [projects, searchQuery, selectedCategory, selectedPriority, selectedStatus, hideCompleted]);

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

  return (
    <div className={`flex-1 flex flex-col ${viewMode === 'gantt' ? 'gap-3 pb-6 md:pb-6' : 'gap-6 pb-28 md:pb-32'}`}>
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
            onClick={() => handleViewModeChange('grid')}
            className={`flex items-center gap-1 rounded-full text-[11px] font-bold transition-all border-none cursor-pointer flex-shrink-0 ${
              viewMode === 'grid'
                ? 'bg-accent-cyan/15 text-accent-cyan'
                : 'text-dark-400 hover:text-dark-200'
            }`}
            style={{ padding: '3px 8px' }}
          >
            <LayoutGrid size={12} />
            <span>Grille</span>
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
        </div>
      </div>

      {/* Top Header */}
      <div className="flex items-center justify-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-accent-cyan/20 to-accent-violet/20 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan shadow-md">
            <FolderKanban size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-dark-100">
            Projets
          </h1>
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

      {/* KPI Mobile Summary Chart (< sm) */}
      <div 
        className="sm:hidden bg-dark-800/60 border border-dark-600/30 rounded-2xl flex items-center gap-3.5 shadow-sm"
        style={{ padding: '10px 14px' }}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[11px] font-black text-dark-100 leading-none">
              {completionRate}%
            </span>
          </div>
        </div>

        {/* Détails & Barre multi-segments */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-dark-100 flex items-center gap-1.5">
              <span>Projets</span>
              <span className="text-dark-400 font-normal">({totalProjects})</span>
            </span>
            <span className="font-semibold text-accent-green text-[11px]">
              {completionRate}% terminé{stats.termines > 1 ? 's' : ''}
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

      {/* KPI Stats Bar - Desktop (>= sm) */}
      <div className="hidden sm:grid sm:grid-cols-5 gap-3">
        {/* Total */}
        <button
          type="button"
          onClick={() => setSelectedStatus('all')}
          className={`bg-dark-800/60 border rounded-2xl flex flex-col items-center justify-center text-center gap-1 cursor-pointer transition-all ${
            selectedStatus === 'all'
              ? 'border-accent-cyan/60 ring-1 ring-accent-cyan/30 shadow-md'
              : 'border-dark-600/30 hover:border-dark-500/50 hover:bg-dark-750/60'
          }`}
          style={{ padding: '8px 10px' }}
          title="Afficher tous les projets"
        >
          <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider">Total</span>
          <span className="text-xl font-black text-dark-100">{stats.total}</span>
        </button>

        {/* Non lancés */}
        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === '0-Non lancé' ? 'all' : '0-Non lancé')}
          className={`bg-dark-800/60 border rounded-2xl flex flex-col items-center justify-center text-center gap-1 cursor-pointer transition-all ${
            selectedStatus === '0-Non lancé'
              ? 'border-dark-400 ring-1 ring-dark-400/50 bg-dark-700/60 shadow-md'
              : 'border-dark-600/30 hover:border-dark-500/50 hover:bg-dark-750/60'
          }`}
          style={{ padding: '8px 10px' }}
          title="Filtrer : Projets non lancés"
        >
          <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Circle size={11} /> Non lancés
          </span>
          <span className="text-xl font-black text-dark-300">{stats.nonLances}</span>
        </button>

        {/* En cours */}
        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === '1-En cours' ? 'all' : '1-En cours')}
          className={`bg-dark-800/60 border rounded-2xl flex flex-col items-center justify-center text-center gap-1 cursor-pointer transition-all ${
            selectedStatus === '1-En cours'
              ? 'border-accent-cyan ring-1 ring-accent-cyan/50 bg-accent-cyan/10 shadow-md'
              : 'border-dark-600/30 hover:border-dark-500/50 hover:bg-dark-750/60'
          }`}
          style={{ padding: '8px 10px' }}
          title="Filtrer : Projets en cours"
        >
          <span className="text-[11px] font-semibold text-accent-cyan uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Clock size={11} /> En cours
          </span>
          <span className="text-xl font-black text-accent-cyan">{stats.enCours}</span>
        </button>

        {/* Terminés */}
        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === '2-Terminé' ? 'all' : '2-Terminé')}
          className={`bg-dark-800/60 border rounded-2xl flex flex-col items-center justify-center text-center gap-1 cursor-pointer transition-all ${
            selectedStatus === '2-Terminé'
              ? 'border-accent-green ring-1 ring-accent-green/50 bg-accent-green/10 shadow-md'
              : 'border-dark-600/30 hover:border-dark-500/50 hover:bg-dark-750/60'
          }`}
          style={{ padding: '8px 10px' }}
          title="Filtrer : Projets terminés"
        >
          <span className="text-[11px] font-semibold text-accent-green uppercase tracking-wider flex items-center justify-center gap-1.5">
            <CheckCircle2 size={11} /> Terminés
          </span>
          <span className="text-xl font-black text-accent-green">{stats.termines}</span>
        </button>

        {/* En retard */}
        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'enRetard' ? 'all' : 'enRetard')}
          className={`rounded-2xl flex flex-col items-center justify-center text-center gap-1 col-span-2 sm:col-span-1 border cursor-pointer transition-all ${
            selectedStatus === 'enRetard'
              ? 'border-accent-red ring-2 ring-accent-red/50 bg-accent-red/20 shadow-md'
              : stats.enRetard > 0 
                ? 'bg-accent-red/10 border-accent-red/30 text-accent-red hover:bg-accent-red/20' 
                : 'bg-dark-800/60 border-dark-600/30 text-dark-400 hover:border-dark-500/50'
          }`}
          style={{ padding: '8px 10px' }}
          title="Filtrer : Projets en retard"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5">
            <AlertTriangle size={11} /> En retard
          </span>
          <span className="text-xl font-black">{stats.enRetard}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div 
        className="flex flex-wrap items-center gap-2 bg-dark-800/80 border border-dark-600/40 rounded-2xl"
        style={{ padding: '8px 12px' }}
      >
          {/* Recherche */}
          {isSearchOpen ? (
            <div className="flex items-center gap-2 bg-dark-800/90 border border-accent-cyan/40 rounded-full px-3 py-1 shadow-sm">
              <Search size={14} className="text-accent-cyan flex-shrink-0" />
              <input
                ref={searchInputRef}
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
                    searchInputRef.current?.focus();
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

          {/* Non complétés */}
          <button
            type="button"
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`flex items-center gap-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              hideCompleted 
                ? 'bg-accent-violet/15 text-accent-violet border border-accent-violet/50 shadow-sm font-bold' 
                : 'bg-dark-800/40 text-dark-400 border border-dark-600/25 hover:border-dark-500/40 hover:text-dark-200'
            }`}
            style={{ padding: '5px 12px' }}
            title="Masquer ou afficher les projets terminés"
          >
            <Clock size={14} />
            <span>Non complétés</span>
          </button>

          {/* Bouton Réinitialiser si des filtres sont actifs */}
          {(searchQuery || selectedCategory !== 'all' || selectedPriority !== 'all' || selectedStatus !== 'all' || hideCompleted) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
                setSelectedCategory('all');
                setSelectedPriority('all');
                setSelectedStatus('all');
                setHideCompleted(false);
              }}
              className="flex items-center gap-1 rounded-full text-xs font-medium text-dark-400 hover:text-accent-red transition-colors cursor-pointer px-2 py-1"
              title="Réinitialiser tous les filtres"
            >
              <X size={13} />
              <span>Réinitialiser</span>
            </button>
          )}
      </div>

      {/* Main Content View */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[350px] gap-3">
          <div className="w-8 h-8 border-3 border-accent-cyan border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-dark-400 font-medium">Chargement des projets...</span>
        </div>
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
        />
      ) : viewMode === 'gantt' ? (
        <ProjectGantt
          projects={filteredProjects}
          onEdit={handleOpenEdit}
          onOpenDetails={handleOpenDetails}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={handleOpenEdit}
              onOpenDetails={handleOpenDetails}
            />
          ))}
        </div>
      )}

      {/* Project Create / Edit Modal */}
      {showProjectModal && (
        <ProjectModal
          isOpen={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          projectToEdit={projectToEdit}
        />
      )}

      {/* Project Detail Modal */}
      {activeDetailProject && (
        <ProjectDetailModal
          isOpen={!!activeDetailProject}
          onClose={() => setDetailProject(null)}
          project={activeDetailProject}
          onEdit={handleOpenEdit}
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

      {/* Bouton flottant Nouveau projet (+) */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleOpenCreate}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-dark-100 text-dark-900 shadow-2xl flex items-center justify-center z-50 hover:bg-white transition-all duration-300 md:bottom-10 md:right-10 cursor-pointer border-none"
        title="Nouveau projet"
      >
        <Plus size={28} strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}
