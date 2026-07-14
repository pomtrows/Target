import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Trophy, Lock, ChevronRight, Filter, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTarget } from '../../contexts/TargetContext';
import { getRecentWeeks, formatWeekShort, isCurrentWeek, getWeeksInMonth, formatWeekLabelParts, compareWeekIds } from '../../utils/weekUtils';
import { getObjectivesForWeek, getWeekProgress, getWeekProgressPercent, isWeekComplete, getObjectiveProgress } from '../../utils/progressUtils';
import ProgressRing from '../Dashboard/ProgressRing';
import Badge from '../Shared/Badge';
import CategoryHistogram from './CategoryHistogram';

export default function HistoryView() {
  const { state } = useTarget();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'objective'
  const [filterCategory, setFilterCategory] = useState(null);

  const weeks = useMemo(() => {
    return getRecentWeeks(24).map((weekId) => {
      const objectives = getObjectivesForWeek(state.objectives, weekId, getWeeksInMonth);
      const wp = state.progress[weekId] || {};
      const progress = getWeekProgress(objectives, wp);
      const percent = getWeekProgressPercent(objectives, wp);
      const complete = isWeekComplete(objectives, wp) && objectives.length > 0;
      return {
        weekId, objectives, progress, percent, complete,
        reward: state.rewards[weekId],
        isCurrent: isCurrentWeek(weekId),
        count: objectives.length,
      };
    });
  }, [state]);

  const completedObjectives = useMemo(() => {
    const completed = [];
    
    // Parcourir toutes les semaines où il y a de la progression
    Object.entries(state.progress).forEach(([weekId, weekProg]) => {
      Object.entries(weekProg).forEach(([objId, val]) => {
        const obj = state.objectives.find(o => o.id === objId);
        if (obj) {
          // Utiliser l'objet de progression de la semaine pour le calcul
          const progressPercent = getObjectiveProgress(obj, weekProg);
          
          if (progressPercent >= 1) {
            completed.push({
              id: `${obj.id}-${weekId}`,
              objective: obj,
              weekId: weekId,
              completedAt: state.progressTimestamps[`${weekId}-${objId}`]
            });
          }
        }
      });
    });

    // Tri par ordre décroissant de validation (le plus récent en haut)
    completed.sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      
      if (dateA !== dateB) {
        return dateB - dateA; // Décroissant
      }
      
      // Si dates identiques ou manquantes, repli sur l'ID de semaine
      return compareWeekIds(b.weekId, a.weekId);
    });

    return completed;
  }, [state]);

  const filteredCompleted = useMemo(() => {
    if (!filterCategory) return completedObjectives;
    return completedObjectives.filter(item => item.objective.categoryId === filterCategory);
  }, [completedObjectives, filterCategory]);

  const tracked = weeks.filter((w) => w.count > 0).length;
  const perfect = weeks.filter((w) => w.complete).length;
  const avg = tracked > 0 ? Math.round(weeks.filter((w) => w.count > 0).reduce((s, w) => s + w.percent, 0) / tracked) : 0;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-10">
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-cyan/20 flex items-center justify-center">
            <BarChart3 size={22} className="text-accent-cyan" />
          </div>
          Historique
        </h1>
        <p className="text-sm text-dark-400 mt-2 text-center">Vos performances sur les dernières semaines</p>
        
        {/* Tabs */}
        <div 
          style={{ marginTop: '15px' }}
          className="flex p-1 bg-dark-700/50 rounded-xl border border-dark-400/40 w-fit"
        >
          <button
            onClick={() => setViewMode('week')}
            style={{ padding: '4px 16px' }}
            className={`rounded-lg text-sm font-medium transition-all ${
              viewMode === 'week' ? 'bg-dark-500 text-white shadow-sm' : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            Par semaine
          </button>
          <button
            onClick={() => setViewMode('objective')}
            style={{ padding: '4px 16px' }}
            className={`rounded-lg text-sm font-medium transition-all ${
              viewMode === 'objective' ? 'bg-dark-500 text-white shadow-sm' : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            Par objectif
          </button>
        </div>
      </div>

      {viewMode === 'week' ? (
        <>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold gradient-text">{tracked}</p>
              <p className="text-xs text-dark-400 mt-1">Semaines trackées</p>
            </div>
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-accent-gold">{perfect}</p>
              <p className="text-xs text-dark-400 mt-1">Semaines parfaites</p>
            </div>
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-accent-cyan">{avg}%</p>
              <p className="text-xs text-dark-400 mt-1">Moyenne d'atteinte</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {weeks.map((week, i) => (
              <motion.button
                key={week.weekId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/?week=${week.weekId}`)}
                style={{ padding: '16px 20px' }}
                className={`group relative text-left rounded-2xl transition-all duration-300 ${
                  week.isCurrent
                    ? 'gradient-border bg-dark-700/80 shadow-lg'
                    : week.complete
                      ? 'bg-dark-700/50 border border-accent-gold/40 hover:border-accent-gold/80'
                      : 'bg-dark-700/30 border border-dark-400/40 hover:border-dark-400/60 hover:bg-dark-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-dark-200">{formatWeekShort(week.weekId)}</span>
                      {week.isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-cyan/20 text-accent-cyan font-medium">En cours</span>
                      )}
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5">{week.count} objectif{week.count > 1 ? 's' : ''}</p>
                  </div>
                  
                  <div className="flex-1 flex justify-center px-2">
                    <CategoryHistogram 
                      objectives={week.objectives}
                      weekProgress={state.progress[week.weekId] || {}}
                      categories={state.categories}
                    />
                  </div>

                  <div className="flex-shrink-0">
                    <ProgressRing progress={week.progress} size={48} strokeWidth={4} />
                  </div>
                </div>

                {week.reward && (
                  <div className={`flex items-center gap-1.5 mt-3 pr-6 text-xs ${week.complete ? 'text-accent-gold' : 'text-dark-500'}`}>
                    {week.complete ? <Trophy size={12} /> : <Lock size={12} />}
                    <span className="truncate">{week.reward}</span>
                  </div>
                )}

                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={16} className="text-dark-400" />
                </div>
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <Filter size={16} className="text-dark-500 flex-shrink-0" />
            <button
              onClick={() => setFilterCategory(null)}
              style={{ padding: '3px 8px' }}
              className={`rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                !filterCategory
                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                  : 'text-dark-400 border border-dark-600/30 hover:text-dark-300'
              }`}
            >
              Tous
            </button>
            {state.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id === filterCategory ? null : cat.id)}
                className={`rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                  filterCategory === cat.id
                    ? 'border'
                    : 'text-dark-400 border border-dark-600/30 hover:text-dark-300'
                }`}
                style={
                  filterCategory === cat.id
                    ? {
                        padding: '3px 8px',
                        borderColor: cat.color,
                        backgroundColor: `${cat.color}15`,
                        color: cat.color,
                      }
                    : { padding: '3px 8px' }
                }
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {filteredCompleted.length === 0 ? (
              <div className="text-center py-10 text-dark-400 text-sm glass rounded-2xl">
                Aucun objectif complété pour le moment.
              </div>
            ) : (
              filteredCompleted.map((item, i) => {
                const cat = state.categories.find(c => c.id === item.objective.categoryId);
                const { title, dates } = formatWeekLabelParts(item.weekId);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ padding: '16px 24px' }}
                    className="rounded-2xl bg-dark-700/50 border border-dark-400/40 flex items-center justify-between hover:border-dark-400/60 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${cat?.color || '#94a3b8'}20`, color: cat?.color || '#94a3b8' }}
                      >
                        <span className="text-xl">{cat?.icon || '📌'}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-dark-100">{item.objective.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {cat && <Badge label={cat.label} color={cat.color} size="xs" />}
                          <span className="text-[11px] text-dark-400 font-medium">{title} • {dates}</span>
                        </div>

                        {/* Detail of sub-tasks */}
                        {item.objective.subObjectives?.length > 0 && (
                          <div className="mt-4 grid grid-cols-1 gap-1 border-t border-dark-600/30 pt-3">
                            {item.objective.subObjectives.map((sub, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-[11px] text-dark-400/80">
                                <div className="w-4 h-4 rounded-full bg-accent-gold/10 flex items-center justify-center text-accent-gold flex-shrink-0">
                                  <Check size={10} strokeWidth={3} />
                                </div>
                                <span className="truncate">{sub.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-accent-gold/10 flex items-center justify-center text-accent-gold flex-shrink-0">
                      <Trophy size={14} />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
