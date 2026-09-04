import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderKanban, Plus, Search, Filter, LayoutGrid, Columns, 
  CheckCircle2, Clock, AlertTriangle, Circle, Eye, EyeOff,
  Database, Copy, Check, Info
} from 'lucide-react';
import { parseISO, isBefore, startOfDay } from 'date-fns';
import { useProjects } from '../contexts/ProjectsContext';
import { useTarget } from '../contexts/TargetContext';
import ProjectCard from '../components/Projects/ProjectCard';
import ProjectKanban from '../components/Projects/ProjectKanban';
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
  const { projects, loading, isLocalFallback } = useProjects();
  const { state: targetState } = useTarget();

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('target_projects_view_mode') || 'kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [hideCompleted, setHideCompleted] = useState(false);

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
        if (Number(p.priority) !== Number(selectedPriority)) return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (p.status !== selectedStatus) return false;
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
    <div className="flex-1 flex flex-col gap-6 pb-12">
      {/* Top Header */}
      <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="flex items-center justify-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-accent-cyan/20 to-accent-violet/20 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan shadow-md">
            <FolderKanban size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-dark-100">
            Projets
          </h1>
        </div>
        <button
          onClick={handleOpenCreate}
          className="sm:absolute sm:right-0 flex items-center gap-2 rounded-xl bg-accent-cyan hover:bg-accent-cyan/90 text-dark-950 font-bold text-xs transition-all shadow-lg shadow-accent-cyan/20 active:scale-95 cursor-pointer"
          style={{ padding: '6px 12px' }}
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>Nouveau projet</span>
        </button>
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

          {/* Mini-légende avec compteurs */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-dark-300">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-dark-400"></span>
              <span>{stats.nonLances} non lancé{stats.nonLances > 1 ? 's' : ''}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-accent-cyan">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan"></span>
              <span>{stats.enCours} en cours</span>
            </span>
            <span className="inline-flex items-center gap-1 text-accent-green">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green"></span>
              <span>{stats.termines} terminé{stats.termines > 1 ? 's' : ''}</span>
            </span>
            {stats.enRetard > 0 && (
              <span className="inline-flex items-center gap-1 text-accent-red font-semibold">
                <AlertTriangle size={11} />
                <span>{stats.enRetard} en retard</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Bar - Desktop (>= sm) */}
      <div className="hidden sm:grid sm:grid-cols-5 gap-3">
        {/* Total */}
        <div className="bg-dark-800/60 border border-dark-600/30 rounded-2xl flex flex-col items-center justify-center text-center gap-1" style={{ padding: '8px 10px' }}>
          <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider">Total</span>
          <span className="text-xl font-black text-dark-100">{stats.total}</span>
        </div>

        {/* Non lancés */}
        <div className="bg-dark-800/60 border border-dark-600/30 rounded-2xl flex flex-col items-center justify-center text-center gap-1" style={{ padding: '8px 10px' }}>
          <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Circle size={11} /> Non lancés
          </span>
          <span className="text-xl font-black text-dark-300">{stats.nonLances}</span>
        </div>

        {/* En cours */}
        <div className="bg-dark-800/60 border border-dark-600/30 rounded-2xl flex flex-col items-center justify-center text-center gap-1" style={{ padding: '8px 10px' }}>
          <span className="text-[11px] font-semibold text-accent-cyan uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Clock size={11} /> En cours
          </span>
          <span className="text-xl font-black text-accent-cyan">{stats.enCours}</span>
        </div>

        {/* Terminés */}
        <div className="bg-dark-800/60 border border-dark-600/30 rounded-2xl flex flex-col items-center justify-center text-center gap-1" style={{ padding: '8px 10px' }}>
          <span className="text-[11px] font-semibold text-accent-green uppercase tracking-wider flex items-center justify-center gap-1.5">
            <CheckCircle2 size={11} /> Terminés
          </span>
          <span className="text-xl font-black text-accent-green">{stats.termines}</span>
        </div>

        {/* En retard */}
        <div 
          className={`rounded-2xl flex flex-col items-center justify-center text-center gap-1 col-span-2 sm:col-span-1 border ${
            stats.enRetard > 0 
              ? 'bg-accent-red/10 border-accent-red/30 text-accent-red' 
              : 'bg-dark-800/60 border-dark-600/30 text-dark-400'
          }`}
          style={{ padding: '8px 10px' }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5">
            <AlertTriangle size={11} /> En retard
          </span>
          <span className="text-xl font-black">{stats.enRetard}</span>
        </div>
      </div>

      {/* Filter & View Bar */}
      <div 
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-dark-850/80 border border-dark-600/40 rounded-2xl"
        style={{ padding: '8px 10px' }}
      >
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un projet..."
              className="w-full bg-dark-800/90 border border-dark-600/40 rounded-xl text-xs text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-colors"
              style={{ padding: '6px 10px 6px 30px' }}
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-dark-800/90 border border-dark-600/40 rounded-xl text-xs text-dark-200 focus:outline-none focus:border-accent-cyan cursor-pointer"
            style={{ padding: '6px 8px' }}
          >
            <option value="all">🏷️ Toutes catégories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>

          {/* Priority Dropdown */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-dark-800/90 border border-dark-600/40 rounded-xl text-xs text-dark-200 focus:outline-none focus:border-accent-cyan cursor-pointer"
            style={{ padding: '6px 8px' }}
          >
            <option value="all">⚡ Toutes priorités</option>
            <option value="1">🔴 1 - Haute</option>
            <option value="2">🟠 2 - Moyenne</option>
            <option value="3">🔵 3 - Basse</option>
          </select>

          {/* Status Dropdown (relevant for grid view) */}
          {viewMode === 'grid' && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-dark-800/90 border border-dark-600/40 rounded-xl text-xs text-dark-200 focus:outline-none focus:border-accent-cyan cursor-pointer"
              style={{ padding: '6px 8px' }}
            >
              <option value="all">📌 Tous statuts</option>
              <option value="0-Non lancé">⚪ 0-Non lancé</option>
              <option value="1-En cours">🔵 1-En cours</option>
              <option value="2-Terminé">🟢 2-Terminé</option>
            </select>
          )}

          {/* Hide completed toggle */}
          <button
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`flex items-center gap-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              hideCompleted 
                ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan' 
                : 'bg-dark-800/80 border-dark-600/40 text-dark-400 hover:text-dark-200'
            }`}
            style={{ padding: '6px 10px' }}
          >
            {hideCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{hideCompleted ? 'Terminés masqués' : 'Masquer terminés'}</span>
          </button>
        </div>

        {/* View Switcher: Kanban vs Grid */}
        <div 
          className="flex items-center gap-1 self-end lg:self-auto bg-dark-800/90 rounded-xl border border-dark-600/40"
          style={{ padding: '2px' }}
        >
          <button
            onClick={() => handleViewModeChange('kanban')}
            className={`flex items-center gap-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'kanban'
                ? 'bg-accent-cyan text-dark-950 shadow-md shadow-accent-cyan/20'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
            }`}
            style={{ padding: '4px 8px' }}
          >
            <Columns size={13} />
            <span>Kanban</span>
          </button>
          <button
            onClick={() => handleViewModeChange('grid')}
            className={`flex items-center gap-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-accent-cyan text-dark-950 shadow-md shadow-accent-cyan/20'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
            }`}
            style={{ padding: '4px 8px' }}
          >
            <LayoutGrid size={13} />
            <span>Grille</span>
          </button>
        </div>
      </div>

      {/* Main Content View */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[350px] gap-3">
          <div className="w-8 h-8 border-3 border-accent-cyan border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-dark-400 font-medium">Chargement des projets...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[350px] p-8 text-center bg-dark-850/40 border border-dashed border-dark-700 rounded-3xl gap-4">
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
    </div>
  );
}
