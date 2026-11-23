export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function getDurationMinutes(start: string, end: string): number {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (end === '00:00' && s > 0) {
    e = 1440;
  }
  return Math.max(0, e - s);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTime12h(hhmm: string): string {
  const [hRaw, m] = hhmm.split(':').map(Number);
  const period = hRaw >= 12 ? 'PM' : 'AM';
  const h = hRaw % 12 === 0 ? 12 : hRaw % 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

export interface CountdownBreakdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  weeks: number;
  weekends: number;
  totalHours: number;
  prepProgressPercent: number;
}

// Target: August 3, 2027 08:30 AM Sri Lanka Standard Time (+05:30)
const EXAM_START_MS = new Date('2027-08-03T08:30:00+05:30').getTime();
// Reference start of final year prep window (Jan 1, 2026) for visual progress bar
const PREP_ORIGIN_MS = new Date('2026-01-01T00:00:00+05:30').getTime();

export function getExamCountdown(nowMs: number = Date.now()): CountdownBreakdown {
  const diff = Math.max(0, EXAM_START_MS - nowMs);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const weeks = Math.floor(days / 7);
  const weekends = Math.floor(days / 7);
  const totalHours = Math.floor(diff / 3600000);

  const totalSpan = EXAM_START_MS - PREP_ORIGIN_MS;
  const elapsed = Math.max(0, Math.min(totalSpan, nowMs - PREP_ORIGIN_MS));
  const prepProgressPercent = Math.round((elapsed / totalSpan) * 100);

  return {
    days,
    hours,
    minutes,
    seconds,
    weeks,
    weekends,
    totalHours,
    prepProgressPercent,
  };
}
