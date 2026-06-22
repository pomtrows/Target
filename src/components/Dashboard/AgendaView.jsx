import { useEffect, useRef, useState } from 'react';
import { useTarget } from '../../contexts/TargetContext';
import { getWeekDates, getCurrentWeekId } from '../../utils/weekUtils';
import { getObjectivesForWeek, getProgressColor, getObjectiveProgress } from '../../utils/progressUtils';
import { Clock, Plus, Pencil, Trash2 } from 'lucide-react';
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

const HOUR_HEIGHT = 60; // 60px per hour (1px per minute)
const START_HOUR = 0;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

export default function AgendaView({ currentWeekId, onEdit, onDelete }) {
  const { state } = useTarget();
  const containerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const weekDates = getWeekDates(currentWeekId);
  const startOfWeek = weekDates ? new Date(weekDates.start) : new Date();

  // Update current time line every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to current time or 8 AM initially
  useEffect(() => {
    if (containerRef.current) {
      const currentHour = new Date().getHours();
      const scrollHour = Math.max(0, currentHour - 2); // Show 2 hours before current
      containerRef.current.scrollTop = scrollHour * HOUR_HEIGHT;
    }
  }, [currentWeekId]);

  const objectives = getObjectivesForWeek(state.objectives, currentWeekId, () => []);

  // Day columns (Lundi = 1 to Dimanche = 7)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return {
      id: i + 1,
      name: format(date, 'EEEE', { locale: fr }),
      shortName: format(date, 'EEE', { locale: fr }),
      dayLabel: format(date, 'd', { locale: fr }),
      date: date
    };
  });

  const getObjectivePosition = (startTime, endTime) => {
    if (!startTime) return { top: 0, height: HOUR_HEIGHT };
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime ? endTime.split(':').map(Number) : [startH + 1, startM];

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max(30, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT);

    return { top, height };
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // Get position of current time indicator
  const getCurrentTimeIndicatorPosition = (date) => {
    if (!isToday(date)) return null;
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    return ((hours * 60 + minutes) / 60) * HOUR_HEIGHT;
  };

  const weekProgress = state.progress[currentWeekId] || {};

  return (
    <div className="agenda-container glass rounded-3xl border border-dark-600/25 flex flex-col h-[650px] overflow-hidden bg-dark-900/30">
      {/* Header Row */}
      <div className="flex border-b border-dark-600/30 bg-dark-800/60 sticky top-0 z-20">
        {/* Empty space for hour labels */}
        <div className="w-14 sm:w-16 border-r border-dark-600/30 flex-shrink-0" />
        
        {/* Day Headers */}
        <div className="flex-1 grid grid-cols-7 divide-x divide-dark-600/20">
          {days.map((day) => {
            const today = isToday(day.date);
            return (
              <div 
                key={day.id} 
                className={`py-3 text-center flex flex-col items-center justify-center gap-1 ${
                  today ? 'bg-accent-cyan/5' : ''
                }`}
              >
                <span className={`text-[10px] font-bold tracking-wider uppercase ${
                  today ? 'text-accent-cyan' : 'text-dark-400'
                }`}>
                  {day.shortName}
                </span>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                  today 
                    ? 'bg-accent-cyan text-dark-900 shadow-lg shadow-accent-cyan/20' 
                    : 'text-dark-100'
                }`}>
                  {day.dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable Agenda Area */}
      <div 
        ref={containerRef}
        className="flex-1 flex overflow-y-auto custom-scrollbar relative"
      >
        {/* Left Hours Scale */}
        <div className="w-14 sm:w-16 bg-dark-800/20 border-r border-dark-600/30 flex-shrink-0 select-none sticky left-0 z-10">
          {HOURS.map((hour) => (
            <div 
              key={hour} 
              className="relative text-right pr-2 text-[10px] font-bold text-dark-500"
              style={{ height: `${HOUR_HEIGHT}px`, paddingTop: '4px' }}
            >
              <span>{String(hour).padStart(2, '0')}:00</span>
              {/* Grid sub-line for hour boundary */}
              <div className="absolute right-0 bottom-0 left-0 border-b border-dark-600/10" />
            </div>
          ))}
        </div>

        {/* Calendar Grid Columns */}
        <div className="flex-1 grid grid-cols-7 divide-x divide-dark-600/25 relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
          
          {/* Horizontal Grid lines */}
          <div className="absolute inset-0 pointer-events-none flex flex-col">
            {HOURS.map((hour) => (
              <div 
                key={hour} 
                className="border-b border-dark-600/10 w-full" 
                style={{ height: `${HOUR_HEIGHT}px` }} 
              />
            ))}
          </div>

          {/* Days Columns content */}
          {days.map((day) => {
            const dayObjectives = objectives.filter(obj => {
              const { days } = getObjectiveSchedule(obj);
              return days.includes(day.id);
            });

            const timeIndicatorTop = getCurrentTimeIndicatorPosition(day.date);

            return (
              <div 
                key={day.id} 
                className="relative h-full select-none"
              >
                {/* Time Indicator Line */}
                {timeIndicatorTop !== null && (
                  <div 
                    className="absolute left-0 right-0 z-10 border-t-2 border-accent-cyan flex items-center pointer-events-none"
                    style={{ top: `${timeIndicatorTop}px` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-accent-cyan -ml-1.5 shadow-lg shadow-accent-cyan/50" />
                  </div>
                )}

                {/* Objectives in this day */}
                {dayObjectives.map((obj) => {
                  const { startTime, endTime } = getObjectiveSchedule(obj);
                  const { top, height } = getObjectivePosition(startTime, endTime);
                  const category = state.categories.find(c => c.id === obj.categoryId) || { color: '#94a3b8' };
                  const progress = getObjectiveProgress(obj, weekProgress);
                  const isCompleted = progress >= 1;
                  const cardColor = isCompleted ? '#22c55e' : category.color;

                  return (
                    <div
                      key={obj.id}
                      onClick={() => onEdit?.(obj)}
                      className="absolute left-1 right-1 rounded-none p-2 border border-dark-600/60 transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10 cursor-pointer overflow-hidden flex flex-col justify-between"
                      style={{ 
                        top: `${top}px`, 
                        height: `${height}px`,
                        backgroundColor: `${cardColor}15`
                      }}
                    >
                      <div className="min-w-0">
                        <h4 className="text-[10px] font-extrabold tracking-wide truncate" style={{ color: cardColor }}>
                          {obj.title}
                        </h4>
                        {height > 40 && (
                          <div className="flex items-center gap-1 text-[8px] text-dark-400 font-bold mt-0.5">
                            <Clock size={8} />
                            <span>{startTime || '00:00'}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Edit/Delete actions hover panel (only for larger slots) */}
                      {height > 50 && (
                        <div className="flex items-center justify-end gap-1.5 opacity-0 hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete?.(obj.id); }}
                            className="p-0.5 rounded text-dark-500 hover:text-accent-red hover:bg-accent-red/10 border-none bg-transparent cursor-pointer"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
