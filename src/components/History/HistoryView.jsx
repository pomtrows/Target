import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Trophy, Lock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTarget } from '../../contexts/TargetContext';
import { getRecentWeeks, formatWeekShort, isCurrentWeek, getWeeksInMonth } from '../../utils/weekUtils';
import { getObjectivesForWeek, getWeekProgress, getWeekProgressPercent, isWeekComplete } from '../../utils/progressUtils';
import ProgressRing from '../Dashboard/ProgressRing';

export default function HistoryView() {
  const { state } = useTarget();
  const navigate = useNavigate();

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

  const tracked = weeks.filter((w) => w.count > 0).length;
  const perfect = weeks.filter((w) => w.complete).length;
  const avg = tracked > 0 ? Math.round(weeks.filter((w) => w.count > 0).reduce((s, w) => s + w.percent, 0) / tracked) : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-cyan/20 flex items-center justify-center">
            <BarChart3 size={22} className="text-accent-cyan" />
          </div>
          Historique
        </h1>
        <p className="text-sm text-dark-400 mt-1 ml-[52px]">Vos performances sur les dernières semaines</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
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
            className={`group text-left p-5 rounded-2xl transition-all duration-300 ${
              week.isCurrent
                ? 'gradient-border bg-dark-700/80 shadow-lg'
                : week.complete
                  ? 'bg-dark-700/50 border border-accent-gold/20 hover:border-accent-gold/40'
                  : 'bg-dark-700/30 border border-dark-600/30 hover:border-dark-500/50 hover:bg-dark-700/50'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-dark-200">{formatWeekShort(week.weekId)}</span>
                  {week.isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-cyan/20 text-accent-cyan font-medium">En cours</span>
                  )}
                </div>
                <p className="text-xs text-dark-500 mt-0.5">{week.count} objectif{week.count !== 1 ? 's' : ''}</p>
              </div>
              <ProgressRing progress={week.progress} size={48} strokeWidth={4} />
            </div>

            {week.reward && (
              <div className={`flex items-center gap-1.5 mt-2 text-xs ${week.complete ? 'text-accent-gold' : 'text-dark-500'}`}>
                {week.complete ? <Trophy size={12} /> : <Lock size={12} />}
                <span>{week.reward}</span>
              </div>
            )}

            <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={16} className="text-dark-400" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
