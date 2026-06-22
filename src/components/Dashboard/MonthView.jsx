import { useTarget } from '../../contexts/TargetContext';
import { getWeekDates, getWeekIdFromDate, getWeeksInMonth } from '../../utils/weekUtils';
import { getObjectivesForWeek, getObjectiveProgress } from '../../utils/progressUtils';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const getObjectiveSchedule = (objective) => {
  const assignments = objective?.assignments || [];
  const daysStr = assignments.find(a => typeof a === 'string' && a.startsWith('days:'));
  const timeStr = assignments.find(a => typeof a === 'string' && a.startsWith('time:'));
  
  let days = [];
  if (daysStr) {
    days = daysStr.replace('days:', '').split(',').map(Number).filter(d => !isNaN(d));
  }
  
  let startTime = '';
  let endTime = '';
  if (timeStr) {
    const parts = timeStr.replace('time:', '').split('-');
    startTime = parts[0] || '';
    endTime = parts[1] || '';
  }
  
  return { days, startTime, endTime };
};

export default function MonthView({ currentWeekId, onEdit }) {
  const { state } = useTarget();

  const weekDates = getWeekDates(currentWeekId);
  const anchorDate = weekDates ? new Date(weekDates.start) : new Date();
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  // Calculate calendar grid
  const firstDayOfMonth = new Date(year, month, 1);
  let startDayOfWeek = firstDayOfMonth.getDay();
  if (startDayOfWeek === 0) startDayOfWeek = 7; // Sunday = 7

  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDays = lastDayOfMonth.getDate();

  const grid = [];
  const prevMonthLast = new Date(year, month, 0).getDate();

  // Leading days from previous month
  for (let i = startDayOfWeek - 2; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLast - i);
    grid.push({ date: d, isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i);
    grid.push({ date: d, isCurrentMonth: true });
  }

  // Trailing days from next month
  const totalCells = grid.length;
  const targetCells = totalCells <= 35 ? 35 : 42;
  const trailingCount = targetCells - totalCells;
  for (let i = 1; i <= trailingCount; i++) {
    const d = new Date(year, month + 1, i);
    grid.push({ date: d, isCurrentMonth: false });
  }

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const getDayObjectives = (date) => {
    const dayWeekId = getWeekIdFromDate(date);
    const weekObjectives = getObjectivesForWeek(state.objectives, dayWeekId, getWeeksInMonth);
    // JS getDay(): 0 = Dimanche, 1 = Lundi... map to 1-7
    const dayNum = date.getDay() === 0 ? 7 : date.getDay();
    const weekProgress = state.progress[dayWeekId] || {};

    return weekObjectives.filter((obj) => {
      const { days } = getObjectiveSchedule(obj);
      return days.includes(dayNum);
    }).map(obj => ({
      ...obj,
      progress: getObjectiveProgress(obj, weekProgress),
      dayWeekId
    }));
  };

  const dayHeaders = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  return (
    <div className="glass rounded-3xl border border-dark-600/25 overflow-hidden flex flex-col bg-dark-900/30">
      {/* Day of week labels */}
      <div className="grid grid-cols-7 border-b border-dark-600/30 bg-dark-800/60 sticky top-0 z-10">
        {dayHeaders.map((h) => (
          <div key={h} className="py-2.5 text-center text-[10px] font-bold text-dark-400 uppercase tracking-wider">
            {h}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-dark-600/20 bg-dark-900/10">
        {grid.map((day, idx) => {
          const dayObjs = getDayObjectives(day.date);
          const today = isToday(day.date);
          const monthLabel = day.date.getDate() === 1 ? format(day.date, 'MMM ', { locale: fr }) : '';

          return (
            <div 
              key={idx} 
              className={`min-h-[100px] sm:min-h-[120px] p-2 flex flex-col gap-1 transition-all ${
                day.isCurrentMonth ? 'bg-transparent' : 'bg-dark-800/10 opacity-40'
              } ${today ? 'bg-accent-cyan/5 shadow-inner' : ''}`}
            >
              {/* Day Number / Month Indicator */}
              <div className="flex justify-between items-center text-[11px] font-bold">
                <span className={today ? 'text-accent-cyan' : 'text-dark-400'}>
                  {monthLabel}{day.date.getDate()}
                </span>
                {today && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
                )}
              </div>

              {/* Day's Objectives List */}
              <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[80px] sm:max-h-[100px] custom-scrollbar">
                {dayObjs.map((obj) => {
                  const category = state.categories.find(c => c.id === obj.categoryId) || { color: '#94a3b8' };
                  const isCompleted = obj.progress >= 1;
                  const itemColor = isCompleted ? '#22c55e' : category.color;

                  return (
                    <div 
                      key={obj.id}
                      onClick={() => onEdit?.(obj)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold truncate transition-all cursor-pointer border border-transparent hover:border-dark-600/40"
                      style={{ 
                        backgroundColor: `${itemColor}15`, 
                        color: itemColor,
                        borderLeft: `2.5px solid ${itemColor}`
                      }}
                      title={`${obj.title}${obj.startTime ? ` (${obj.startTime})` : ''}`}
                    >
                      {obj.startTime && `${obj.startTime} `}
                      {obj.title}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
