import { DayOfWeek } from '../types';

const JS_DAY_TO_DOW: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function parseISODateLocal(dateISO: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysISO(baseISO: string, days: number): string {
  const d = parseISODateLocal(baseISO);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function diffDaysISO(fromISO: string, toISO: string): number {
  const a = parseISODateLocal(fromISO).getTime();
  const b = parseISODateLocal(toISO).getTime();
  return Math.round((b - a) / 86400000);
}

export function formatShortDateISO(dateISO: string): string {
  const d = parseISODateLocal(dateISO);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function formatDeadlineRelative(deadlineISO?: string, todayISO: string = getTodayISO()): string | null {
  if (!deadlineISO) return null;
  const diff = diffDaysISO(todayISO, deadlineISO);
  if (diff < 0) return `Overdue (${formatShortDateISO(deadlineISO)})`;
  if (diff === 0) return 'Due Today';
  if (diff === 1) return 'Due Tomorrow';
  if (diff <= 6) return `Due in ${diff}d (${formatShortDateISO(deadlineISO)})`;
  return `Due ${formatShortDateISO(deadlineISO)}`;
}

export function getDayOfWeek(date: Date = new Date()): DayOfWeek {
  return JS_DAY_TO_DOW[date.getDay()];
}

export function formatFullDateLabel(date: Date): string {
  return `${DAYS_FULL[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

export function getMondayOfWeek(date: Date = new Date()): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay(); // 0 Sun .. 6 Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diffToMon);
  return copy;
}

export function getMondayISOForDate(dateISO: string): string {
  return toISODate(getMondayOfWeek(parseISODateLocal(dateISO)));
}

export function addWeeksISO(mondayISO: string, weeks: number): string {
  return addDaysISO(mondayISO, weeks * 7);
}

export interface WeekDayInfo {
  day: DayOfWeek;
  dateISO: string;
  dateNum: string;
  shortDate: string;
  fullLabel: string;
  isToday: boolean;
}

export function getWeekDaysFromMondayISO(
  mondayISO: string,
  now: Date = new Date(),
): WeekDayInfo[] {
  const monday = parseISODateLocal(mondayISO);
  const todayISO = toISODate(now);
  const order: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return order.map((day, idx) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
    const iso = toISODate(d);
    return {
      day,
      dateISO: iso,
      dateNum: String(d.getDate()),
      shortDate: `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`,
      fullLabel: formatFullDateLabel(d),
      isToday: iso === todayISO,
    };
  });
}

export function getWeekDaysForOffset(
  weekOffset: number = 0,
  now: Date = new Date(),
): WeekDayInfo[] {
  const currentMonday = toISODate(getMondayOfWeek(now));
  const targetMonday = addWeeksISO(currentMonday, weekOffset);
  return getWeekDaysFromMondayISO(targetMonday, now);
}

export function getCurrentWeekDays(now: Date = new Date()): WeekDayInfo[] {
  return getWeekDaysForOffset(0, now);
}

export function formatWeekOffsetLabel(weekOffset: number): string {
  if (weekOffset === 0) return 'This Week';
  if (weekOffset === 1) return 'Next Week (+1w)';
  if (weekOffset === -1) return 'Last Week (-1w)';
  return weekOffset > 0 ? `+${weekOffset} Weeks` : `${weekOffset} Weeks`;
}

export function formatWeekRange(weekStartISO: string): string {
  const [y, m, d] = weekStartISO.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
}
