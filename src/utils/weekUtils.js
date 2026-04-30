import {
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  subWeeks,
  format,
  eachWeekOfInterval,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Get the current week ID in format YYYY-SWW
 */
export function getCurrentWeekId() {
  return getWeekIdFromDate(new Date());
}

/**
 * Get week ID from a Date object
 */
export function getWeekIdFromDate(date) {
  const week = getISOWeek(date);
  const year = getISOWeekYear(date);
  return `${year}-S${String(week).padStart(2, '0')}`;
}

/**
 * Parse a week ID (YYYY-SWW) into { year, week }
 */
export function parseWeekId(weekId) {
  const match = weekId.match(/^(\d{4})-S(\d{2})$/);
  if (!match) return null;
  return { year: parseInt(match[1]), week: parseInt(match[2]) };
}

/**
 * Get the start and end dates of a given week ID
 */
export function getWeekDates(weekId) {
  const parsed = parseWeekId(weekId);
  if (!parsed) return null;

  // Build a date that falls in the desired ISO week
  // January 4th is always in week 1 of the ISO year
  const jan4 = new Date(parsed.year, 0, 4);
  const startOfWeek1 = startOfISOWeek(jan4);
  const targetDate = addWeeks(startOfWeek1, parsed.week - 1);

  return {
    start: startOfISOWeek(targetDate),
    end: endOfISOWeek(targetDate),
  };
}

export function formatWeekLabelParts(weekId) {
  const dates = getWeekDates(weekId);
  if (!dates) return { title: weekId, dates: '' };

  const parsed = parseWeekId(weekId);
  const startStr = format(dates.start, 'd MMM', { locale: fr });
  const endStr = format(dates.end, 'd MMM', { locale: fr });

  return {
    title: `S${parsed.week} - ${parsed.year}`,
    dates: `${startStr} au ${endStr}`,
  };
}

export function formatWeekLabel(weekId) {
  const parts = formatWeekLabelParts(weekId);
  return `${parts.title} — ${parts.dates}`;
}

/**
 * Get short label: "S18"
 */
export function formatWeekShort(weekId) {
  const parsed = parseWeekId(weekId);
  if (!parsed) return weekId;
  return `S${parsed.week}`;
}

/**
 * Get adjacent week IDs
 */
export function getAdjacentWeeks(weekId) {
  const dates = getWeekDates(weekId);
  if (!dates) return { prev: null, next: null };

  const prevDate = subWeeks(dates.start, 1);
  const nextDate = addWeeks(dates.start, 1);

  return {
    prev: getWeekIdFromDate(prevDate),
    next: getWeekIdFromDate(nextDate),
  };
}

/**
 * Get all week IDs in a given month (year, monthIndex 0-11)
 */
export function getWeeksInMonth(year, month) {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(new Date(year, month));

  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
  const weekIds = weeks.map((d) => getWeekIdFromDate(d));

  // Deduplicate
  return [...new Set(weekIds)];
}

/**
 * Get all weeks from the last N weeks
 */
export function getRecentWeeks(count = 12) {
  const weeks = [];
  let current = new Date();

  for (let i = 0; i < count; i++) {
    weeks.push(getWeekIdFromDate(current));
    current = subWeeks(current, 1);
  }

  return weeks;
}

/**
 * Get a range of weeks including past and future
 */
export function getSelectableWeeks(pastCount = 4, futureCount = 12) {
  const weeks = [];
  let current = subWeeks(new Date(), pastCount);

  for (let i = 0; i <= pastCount + futureCount; i++) {
    weeks.push(getWeekIdFromDate(current));
    current = addWeeks(current, 1);
  }

  return weeks;
}

/**
 * Compare two week IDs chronologically
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareWeekIds(a, b) {
  const parsedA = parseWeekId(a);
  const parsedB = parseWeekId(b);
  if (!parsedA || !parsedB) return 0;

  if (parsedA.year !== parsedB.year) return parsedA.year - parsedB.year;
  return parsedA.week - parsedB.week;
}

/**
 * Check if a week ID is in the past relative to current week
 */
export function isWeekPast(weekId) {
  return compareWeekIds(weekId, getCurrentWeekId()) < 0;
}

/**
 * Check if a week ID is the current week
 */
export function isCurrentWeek(weekId) {
  return weekId === getCurrentWeekId();
}

/**
 * Get month label from a YYYY-MM string
 */
export function getMonthLabel(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1);
  return format(date, 'MMMM yyyy', { locale: fr });
}

/**
 * Get all months for the current year
 */
export function getMonthsOfYear(year) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const date = new Date(year, m);
    months.push({
      value: `${year}-${String(m + 1).padStart(2, '0')}`,
      label: format(date, 'MMMM yyyy', { locale: fr }),
    });
  }
  return months;
}
