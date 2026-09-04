import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderKanban, Plus, Search, Filter, LayoutGrid, Columns, 
  CheckCircle2, Clock, AlertTriangle, Circle, Eye, EyeOff
} from 'lucide-react';
import { parseISO, isBefore, startOfDay } from 'date-fns';
import { useProjects } from '../contexts/ProjectsContext';
import { useTarget } from '../contexts/TargetContext';
import ProjectCard from '../components/Projects/ProjectCard';
import ProjectKanban from '../components/Projects/ProjectKanban';
import ProjectModal from '../components/Projects/ProjectModal';
import ProjectDetailModal from '../components/Projects/ProjectDetailModal';

export default function ProjectsPage() {
  const { projects, loading } = useProjects();
  const { state: targetState } = useTarget();

  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'grid'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [hideCompleted, setHideCompleted] = useState(false);

  // Modals state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [detailProject, setDetailProject] = useState(null);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-accent-cyan/20 to-accent-violet/20 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan shadow-md">
            <FolderKanban size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-dark-100">
              Projets
            </h1>
            <p className="text-xs text-dark-400 font-medium">
              Pilotez vos chantiers, vos échéances et les objectifs qui y contribuent.
            </p>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={handleOpenCreate}
          className="self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-violet hover:opacity-95 text-dark-950 font-bold text-xs transition-all shadow-lg shadow-accent-cyan/20 active:scale-95 cursor-pointer"
        >
          <Plus size={16} strokeWidth={2.5} />
          Nouveau projet
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total */}
        <div className="bg-dark-800/60 border border-dark-600/30 p-3 rounded-2xl flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider">Total</span>
          <span className="text-xl font-black text-dark-100">{stats.total}</span>
        </div>

        {/* Non lancés */}
        <div className="bg-dark-800/60 border border-dark-600/30 p-3 rounded-2xl flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider flex items-center gap-1">
            <Circle size={10} /> Non lancés
          </span>
          <span className="text-xl font-black text-dark-300">{stats.nonLances}</span>
        </div>

        {/* En cours */}
        <div className="bg-dark-800/60 border border-dark-600/30 p-3 rounded-2xl flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-accent-cyan uppercase tracking-wider flex items-center gap-1">
            <Clock size={10} /> En cours
          </span>
          <span className="text-xl font-black text-accent-cyan">{stats.enCours}</span>
        </div>

        {/* Terminés */}
        <div className="bg-dark-800/60 border border-dark-600/30 p-3 rounded-2xl flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-accent-green uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={10} /> Terminés
          </span>
          <span className="text-xl font-black text-accent-green">{stats.termines}</span>
        </div>

        {/* En retard */}
        <div className={`p-3 rounded-2xl flex flex-col gap-1 col-span-2 sm:col-span-1 border ${
          stats.enRetard > 0 
            ? 'bg-accent-red/10 border-accent-red/30 text-accent-red' 
            : 'bg-dark-800/60 border-dark-600/30 text-dark-400'
        }`}>
          <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle size={10} /> En retard
          </span>
          <span className="text-xl font-black">{stats.enRetard}</span>
        </div>
      </div>

      {/* Filter & View Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-dark-850/80 border border-dark-600/40 rounded-2xl">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-2.5 text-dark-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un projet..."
              className="w-full bg-dark-800/90 border border-dark-600/40 rounded-xl pl-9 pr-3 py-1.5 text-xs text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-colors"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-dark-800/90 border border-dark-600/40 rounded-xl px-3 py-1.5 text-xs text-dark-200 focus:outline-none focus:border-accent-cyan cursor-pointer"
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
            className="bg-dark-800/90 border border-dark-600/40 rounded-xl px-3 py-1.5 text-xs text-dark-200 focus:outline-none focus:border-accent-cyan cursor-pointer"
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
              className="bg-dark-800/90 border border-dark-600/40 rounded-xl px-3 py-1.5 text-xs text-dark-200 focus:outline-none focus:border-accent-cyan cursor-pointer"
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              hideCompleted 
                ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan' 
                : 'bg-dark-800/80 border-dark-600/40 text-dark-400 hover:text-dark-200'
            }`}
          >
            {hideCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{hideCompleted ? 'Terminés masqués' : 'Masquer terminés'}</span>
          </button>
        </div>

        {/* View Switcher: Kanban vs Grid */}
        <div className="flex items-center gap-1 self-end lg:self-auto bg-dark-800/90 p-1 rounded-xl border border-dark-600/40">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'kanban' 
                ? 'bg-accent-cyan text-dark-950 shadow-sm' 
                : 'text-dark-400 hover:text-dark-200'
            }`}
            title="Vue Tableau Kanban"
          >
            <Columns size={14} />
            <span className="hidden sm:inline">Kanban</span>
          </button>

          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grid' 
                ? 'bg-accent-cyan text-dark-950 shadow-sm' 
                : 'text-dark-400 hover:text-dark-200'
            }`}
            title="Vue Grille"
          >
            <LayoutGrid size={14} />
            <span className="hidden sm:inline">Grille</span>
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
    </div>
  );
}
