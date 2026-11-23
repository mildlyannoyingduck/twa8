import { DAYS_ORDER, SUBJECT_META, SYLLABUS_UNITS } from '../data/previewData';
import {
  DayOfWeek,
  FridayAnchor,
  FridayWeekMode,
  FridayWeekOverrides,
  MissedLessonItem,
  PaperEntry,
  RevisionStage,
  SlotSuggestion,
  StudyTask,
  SubjectId,
  TaskImportance,
  TimePreference,
  TimetableSlot,
} from '../types';
import {
  addDaysISO,
  addWeeksISO,
  diffDaysISO,
  formatShortDateISO,
  getDayOfWeek,
  getMondayISOForDate,
  getTodayISO,
  getWeekDaysForOffset,
  parseISODateLocal,
  WeekDayInfo,
} from './dateUtils';
import { formatDuration, formatTime12h, getDurationMinutes, toMinutes } from './timeUtils';

export type FridayWeekResolver =
  | FridayWeekMode
  | { anchor: FridayAnchor; overrides?: FridayWeekOverrides };

export function resolveFridayModeForWeek(
  weekMondayISO: string,
  anchor: FridayAnchor,
  overrides: FridayWeekOverrides = {},
): FridayWeekMode {
  if (overrides[weekMondayISO]) {
    return overrides[weekMondayISO];
  }
  const weekDiff = Math.round(diffDaysISO(anchor.mondayISO, weekMondayISO) / 7);
  if (Math.abs(weekDiff) % 2 === 0) {
    return anchor.mode;
  }
  return anchor.mode === 'bio-week' ? 'chem-only-week' : 'bio-week';
}

export function getFridayModeForDate(
  dateISO: string,
  resolver: FridayWeekResolver = 'bio-week',
): FridayWeekMode {
  if (typeof resolver === 'string') return resolver;
  const mondayISO = getMondayISOForDate(dateISO);
  return resolveFridayModeForWeek(mondayISO, resolver.anchor, resolver.overrides);
}

export interface BusyInterval {
  startMin: number;
  endMin: number;
  kind: 'slot' | 'transit';
  slotId?: string;
}

export interface SlotTravelVisual {
  slotId: string;
  beforeStartMin: number | null;
  beforeMins: number;
  afterEndMin: number | null;
  afterMins: number;
}

export function isSlotActiveOnDate(
  slot: TimetableSlot,
  fridayResolver: FridayWeekResolver = 'bio-week',
  dateISO: string = getTodayISO(),
): boolean {
  if (slot.specificDateISO) {
    return slot.specificDateISO === dateISO;
  }
  if (slot.skippedDates && slot.skippedDates.includes(dateISO)) {
    return false;
  }
  if (slot.expiresAtISO && dateISO >= slot.expiresAtISO) {
    return false;
  }
  const fridayMode = getFridayModeForDate(dateISO, fridayResolver);
  if (slot.weekPattern === 'week-a' && fridayMode !== 'bio-week') {
    return false;
  }
  if (slot.weekPattern === 'week-b' && fridayMode !== 'chem-only-week') {
    return false;
  }
  return true;
}

export function getActiveSlotsForSchedule(
  slots: TimetableSlot[],
  fridayResolver: FridayWeekResolver = 'bio-week',
  dateISO: string = getTodayISO(),
): TimetableSlot[] {
  const dow = getDayOfWeek(parseISODateLocal(dateISO));
  return slots.filter((slot) => {
    if (slot.specificDateISO) {
      return slot.specificDateISO === dateISO;
    }
    if (slot.day === dow) {
      return isSlotActiveOnDate(slot, fridayResolver, dateISO);
    }
    // Preserve other recurring slots during single-day schedule callers where week context isn't expanded
    return true;
  });
}

export function getActiveSlotsForWeek(
  slots: TimetableSlot[],
  weekDays: WeekDayInfo[],
  fridayResolver: FridayWeekResolver = 'bio-week',
): {
  slotsByDay: Record<DayOfWeek, TimetableSlot[]>;
  allWeekSlots: TimetableSlot[];
  skippedThisWeek: { slot: TimetableSlot; dateISO: string }[];
} {
  const slotsByDay: Record<DayOfWeek, TimetableSlot[]> = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  };
  const allWeekSlots: TimetableSlot[] = [];
  const skippedThisWeek: { slot: TimetableSlot; dateISO: string }[] = [];

  for (const wd of weekDays) {
    for (const slot of slots) {
      const targetDay = slot.specificDateISO
        ? getDayOfWeek(parseISODateLocal(slot.specificDateISO))
        : slot.day;
      if (targetDay !== wd.day) continue;

      if (!slot.specificDateISO && slot.skippedDates?.includes(wd.dateISO)) {
        skippedThisWeek.push({ slot, dateISO: wd.dateISO });
        continue;
      }

      if (isSlotActiveOnDate(slot, fridayResolver, wd.dateISO)) {
        const normalized = slot.specificDateISO ? { ...slot, day: wd.day } : slot;
        slotsByDay[wd.day].push(normalized);
        allWeekSlots.push(normalized);
      }
    }
    slotsByDay[wd.day].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return { slotsByDay, allWeekSlots, skippedThisWeek };
}

export function minutesToHHMM(totalMins: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(totalMins)));
  if (clamped >= 1440) return '00:00';
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getEffectiveEndMin(slot: TimetableSlot): number {
  const s = toMinutes(slot.startTime);
  let e = toMinutes(slot.endTime);
  if (slot.endTime === '00:00' && s > 0) e = 1440;
  return Math.max(s, e);
}

export function computePhysicalTravelVisuals(
  slots: TimetableSlot[],
  day: DayOfWeek,
): Record<string, SlotTravelVisual> {
  const physicalSlots = slots
    .filter((s) => s.day === day && s.mode === 'physical')
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  const visuals: Record<string, SlotTravelVisual> = {};

  for (let i = 0; i < physicalSlots.length; i++) {
    const curr = physicalSlots[i];
    const prev = i > 0 ? physicalSlots[i - 1] : null;
    const next = i < physicalSlots.length - 1 ? physicalSlots[i + 1] : null;

    const currStart = toMinutes(curr.startTime);
    const currEnd = getEffectiveEndMin(curr);

    const chainedFromPrev =
      prev !== null && currStart - getEffectiveEndMin(prev) <= 120;
    const chainedToNext =
      next !== null && toMinutes(next.startTime) - currEnd <= 120;

    const beforeMins = chainedFromPrev ? 0 : (curr.travelBeforeMins ?? 120);
    const afterMins = chainedToNext ? 0 : (curr.travelAfterMins ?? 120);

    visuals[curr.id] = {
      slotId: curr.id,
      beforeStartMin: beforeMins > 0 ? Math.max(0, currStart - beforeMins) : null,
      beforeMins,
      afterEndMin: afterMins > 0 ? Math.min(1440, currEnd + afterMins) : null,
      afterMins,
    };
  }

  return visuals;
}

export function getDayBusyIntervals(
  slots: TimetableSlot[],
  day: DayOfWeek,
  extraBusy: BusyInterval[] = [],
): BusyInterval[] {
  const daySlots = slots.filter((s) => s.day === day);
  const travelVisuals = computePhysicalTravelVisuals(slots, day);
  const raw: BusyInterval[] = [...extraBusy];

  for (const slot of daySlots) {
    const startMin = toMinutes(slot.startTime);
    const endMin = getEffectiveEndMin(slot);
    raw.push({ startMin, endMin, kind: 'slot', slotId: slot.id });

    const tv = travelVisuals[slot.id];
    if (tv) {
      if (tv.beforeStartMin !== null && tv.beforeMins > 0) {
        raw.push({
          startMin: tv.beforeStartMin,
          endMin: startMin,
          kind: 'transit',
          slotId: slot.id,
        });
      }
      if (tv.afterEndMin !== null && tv.afterMins > 0) {
        raw.push({
          startMin: endMin,
          endMin: tv.afterEndMin,
          kind: 'transit',
          slotId: slot.id,
        });
      }
    }
  }

  if (raw.length === 0) return [];
  raw.sort((a, b) => a.startMin - b.startMin);

  const merged: BusyInterval[] = [{ ...raw[0] }];
  for (let i = 1; i < raw.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = raw[i];
    if (curr.startMin <= prev.endMin) {
      prev.endMin = Math.max(prev.endMin, curr.endMin);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

function getSearchRanges(pref: TimePreference): { min: number; max: number }[] {
  switch (pref) {
    case 'morning':
      return [{ min: 5 * 60, max: 12 * 60 }];
    case 'afternoon':
      return [{ min: 12 * 60, max: 18 * 60 }];
    case 'night':
      return [{ min: 18 * 60, max: 1440 }];
    case 'late-night':
      return [
        { min: 22 * 60, max: 1440 },
        { min: 0, max: 5 * 60 + 30 },
      ];
    default:
      // Zero restriction: full 24h scan (12:00 AM through midnight next night)
      return [{ min: 0, max: 1440 }];
  }
}

interface DayCandidate {
  startMin: number;
  endMin: number;
  reason: string;
  score: number;
  deadlineFit: 'before-deadline' | 'after-deadline' | 'no-deadline';
}

function findDayCandidates(options: {
  slots: TimetableSlot[];
  day: DayOfWeek;
  durationMins: number;
  pref: TimePreference;
  minStartAfterMin?: number;
  extraBusy?: BusyInterval[];
  importance?: TaskImportance;
  offsetFromToday?: number;
  daysUntilDeadline?: number | null;
}): DayCandidate[] {
  const {
    slots,
    day,
    durationMins,
    pref,
    minStartAfterMin = 0,
    extraBusy = [],
    importance = 'medium',
    offsetFromToday = 0,
    daysUntilDeadline = null,
  } = options;

  const busy = getDayBusyIntervals(slots, day, extraBusy);
  const ranges = getSearchRanges(pref);

  const daySlots = slots.filter((s) => s.day === day);
  const dayLoadMins = daySlots.reduce(
    (acc, s) => acc + (getEffectiveEndMin(s) - toMinutes(s.startTime)),
    0,
  );

  const deadlineFit: DayCandidate['deadlineFit'] =
    daysUntilDeadline === null
      ? 'no-deadline'
      : offsetFromToday <= daysUntilDeadline
        ? 'before-deadline'
        : 'after-deadline';

  const candidates: DayCandidate[] = [];
  const seenStarts = new Set<number>();

  for (const range of ranges) {
    const searchMin = Math.max(range.min, minStartAfterMin);
    const searchMax = range.max;
    if (searchMax - searchMin < durationMins) continue;

    const gaps: { start: number; end: number }[] = [];
    let cursor = searchMin;

    for (const block of busy) {
      if (block.endMin <= cursor) continue;
      if (block.startMin >= searchMax) break;
      if (block.startMin > cursor) {
        gaps.push({ start: cursor, end: Math.min(block.startMin, searchMax) });
      }
      const breather = block.kind === 'transit' ? 15 : 10;
      cursor = Math.max(cursor, block.endMin + breather);
    }
    if (cursor < searchMax) {
      gaps.push({ start: cursor, end: searchMax });
    }

    for (const gap of gaps) {
      if (gap.end - gap.start < durationMins) continue;

      // On wide open 24h spans, generate natural anchor points AND the raw earliest start (e.g. 00:00 / 05:30 / 08:30 / 14:00)
      const earliestSnapped = Math.ceil(gap.start / 5) * 5;
      const anchors = [earliestSnapped];
      if (pref === 'any' || pref === 'late-night') {
        for (const anchor of [5 * 60 + 30, 8 * 60 + 30, 14 * 60, 20 * 60]) {
          if (anchor > earliestSnapped + 15 && anchor + durationMins <= gap.end) {
            anchors.push(anchor);
          }
        }
      }

      for (const startMin of anchors) {
        const endMin = startMin + durationMins;
        if (endMin > gap.end || seenStarts.has(startMin)) continue;
        seenStarts.add(startMin);

        const priorBlock = daySlots
          .filter((s) => getEffectiveEndMin(s) <= startMin)
          .sort((a, b) => getEffectiveEndMin(b) - getEffectiveEndMin(a))[0];

        const isVeryEarlyOrLate = startMin < 5 * 60 || startMin >= 23 * 60;
        let reason = `Free ${formatDuration(gap.end - gap.start)} window`;
        if (importance === 'urgent' && offsetFromToday <= 1) {
          reason = `Urgent priority · earliest open gap`;
        } else if (priorBlock) {
          reason = `Open gap after ${priorBlock.title}`;
        } else if (startMin < 5 * 60) {
          reason = `Late-night / pre-dawn quiet window`;
        } else if (startMin < 8 * 60) {
          reason = `Early 5:30 AM+ head-start window`;
        } else if (dayLoadMins <= 120) {
          reason = `Light study day · ${formatDuration(durationMins)} clean block`;
        } else if (startMin < 12 * 60) {
          reason = `Fresh morning window`;
        } else if (startMin >= 18 * 60) {
          reason = `Night focus block`;
        }

        if (deadlineFit === 'before-deadline' && daysUntilDeadline !== null) {
          const bufferDays = daysUntilDeadline - offsetFromToday;
          if (bufferDays === 0) {
            reason += ' · On deadline day';
          } else if (bufferDays >= 1) {
            reason += ` · ${bufferDays}d before deadline`;
          }
        } else if (deadlineFit === 'after-deadline') {
          reason = `After deadline · ${reason}`;
        }

        const loadPenalty = dayLoadMins / 60;

        // Importance & Deadline weighted score
        let score = 100;

        if (deadlineFit === 'before-deadline') {
          score += 240;
          if (daysUntilDeadline !== null && daysUntilDeadline <= 1) {
            score += 90 - offsetFromToday * 40;
          } else if (daysUntilDeadline !== null && daysUntilDeadline <= 3) {
            score += 50 - offsetFromToday * 16;
          }
        } else if (deadlineFit === 'after-deadline') {
          score -= 180 + (offsetFromToday - (daysUntilDeadline ?? 0)) * 20;
        }

        if (importance === 'urgent') {
          // ASAP: strongly reward minimal offset & earliest clock start
          score += 140 - offsetFromToday * 28 - startMin / 120;
          score -= loadPenalty * 1.2;
        } else if (importance === 'high') {
          score += 75 - offsetFromToday * 14 - loadPenalty * 2.5 - startMin / 200;
        } else if (importance === 'medium') {
          score += 25 - offsetFromToday * 5 - loadPenalty * 4.2;
          if (isVeryEarlyOrLate && pref === 'any') score -= 18;
        } else {
          // Low importance: favor lightest study days & comfortable daytime windows
          score -= offsetFromToday * 1.5 + loadPenalty * 6.5;
          if (isVeryEarlyOrLate && pref === 'any') score -= 35;
        }

        // Slight nudge for convenient waking start if importance is not urgent and pref is 'any'
        if (pref === 'any' && importance !== 'urgent' && startMin === 0) {
          score -= 16;
        }

        candidates.push({ startMin, endMin, reason, score, deadlineFit });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function suggestSlotsForTask(options: {
  slots: TimetableSlot[];
  subject: SubjectId;
  durationMins: number;
  timePreference: TimePreference;
  autoBlockDefault: boolean;
  fridayWeekMode?: FridayWeekMode;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  scanWeekOffset?: number;
  deadlineISO?: string;
  importance?: TaskImportance;
  startFromDay?: DayOfWeek;
  now?: Date;
  extraBusyByDay?: Partial<Record<DayOfWeek, BusyInterval[]>>;
}): SlotSuggestion[] {
  const {
    slots,
    durationMins,
    timePreference,
    autoBlockDefault,
    fridayWeekMode = 'bio-week',
    fridayAnchor,
    fridayOverrides,
    scanWeekOffset = 0,
    deadlineISO,
    importance = 'medium',
    now = new Date(),
    extraBusyByDay = {},
  } = options;

  const resolver: FridayWeekResolver = fridayAnchor
    ? { anchor: fridayAnchor, overrides: fridayOverrides }
    : fridayWeekMode;

  const todayISO = getTodayISO(now);
  const scanBaseISO =
    scanWeekOffset > 0
      ? addWeeksISO(getMondayISOForDate(todayISO), scanWeekOffset)
      : todayISO;
  const currentMin =
    scanWeekOffset > 0 || options.startFromDay
      ? 0
      : now.getHours() * 60 + now.getMinutes() + 10;

  const scoredResults: (SlotSuggestion & { _score: number })[] = [];

  for (let offset = 0; offset < 7; offset++) {
    const dateISO = addDaysISO(scanBaseISO, offset);
    const day = getDayOfWeek(parseISODateLocal(dateISO));
    const offsetFromToday = diffDaysISO(todayISO, dateISO);
    const daysUntilDeadline = deadlineISO ? diffDaysISO(todayISO, deadlineISO) : null;

    // Filter slots strictly for this exact YYYY-MM-DD date
    const activeDaySchedule = slots.filter((s) => {
      const sDay = s.specificDateISO ? getDayOfWeek(parseISODateLocal(s.specificDateISO)) : s.day;
      return sDay === day && isSlotActiveOnDate(s, resolver, dateISO);
    });
    const minAfter = scanWeekOffset === 0 && offset === 0 ? currentMin : 0;

    const dayCands = findDayCandidates({
      slots: activeDaySchedule,
      day,
      durationMins,
      pref: timePreference,
      minStartAfterMin: minAfter,
      extraBusy: extraBusyByDay[day] ?? [],
      importance,
      offsetFromToday: Math.max(0, offsetFromToday),
      daysUntilDeadline,
    });

    const dateTag = dateISO === todayISO ? 'Today' : `${day} ${formatShortDateISO(dateISO)}`;

    for (const cand of dayCands) {
      scoredResults.push({
        id: `sug-${dateISO}-${cand.startMin}-${scoredResults.length}`,
        day,
        dateISO,
        startTime: minutesToHHMM(cand.startMin),
        endTime: minutesToHHMM(cand.endMin),
        durationMins,
        reason: `${dateTag} · ${cand.reason}`,
        autoBlock: autoBlockDefault,
        deadlineFit: cand.deadlineFit,
        _score: cand.score,
      });
    }
  }

  if (scoredResults.length === 0 && timePreference !== 'any') {
    return suggestSlotsForTask({ ...options, timePreference: 'any' });
  }

  scoredResults.sort((a, b) => b._score - a._score);

  const picked: SlotSuggestion[] = [];
  const usedDates = new Set<string>();
  for (const item of scoredResults) {
    if (picked.length >= 3) break;
    const key = item.dateISO ?? item.day;
    if (!usedDates.has(key) || scoredResults.length <= 3) {
      const { _score: _, ...clean } = item;
      picked.push(clean);
      usedDates.add(key);
    }
  }
  for (const item of scoredResults) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.id === item.id)) {
      const { _score: _, ...clean } = item;
      picked.push(clean);
    }
  }

  return picked;
}

export function suggestMultiSessionPlan(options: {
  slots: TimetableSlot[];
  subject: SubjectId;
  totalRemainingMins: number;
  chunkMins: number;
  timePreference: TimePreference;
  autoBlockDefault: boolean;
  fridayWeekMode?: FridayWeekMode;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  scanWeekOffset?: number;
  deadlineISO?: string;
  importance?: TaskImportance;
  now?: Date;
}): SlotSuggestion[] {
  const {
    slots,
    subject,
    totalRemainingMins,
    chunkMins,
    timePreference,
    autoBlockDefault,
    fridayWeekMode = 'bio-week',
    fridayAnchor,
    fridayOverrides,
    scanWeekOffset = 0,
    deadlineISO,
    importance = 'high',
    now = new Date(),
  } = options;

  const plan: SlotSuggestion[] = [];
  const extraBusyByDay: Partial<Record<DayOfWeek, BusyInterval[]>> = {};
  let left = Math.max(30, totalRemainingMins);
  let guard = 0;

  while (left > 0 && guard < 4) {
    guard += 1;
    const dur = Math.min(left, chunkMins);
    const cands = suggestSlotsForTask({
      slots,
      subject,
      durationMins: dur,
      timePreference,
      autoBlockDefault,
      fridayWeekMode,
      fridayAnchor,
      fridayOverrides,
      scanWeekOffset,
      deadlineISO,
      importance,
      now,
      extraBusyByDay,
    });

    const best = cands[0];
    if (!best) break;

    plan.push({
      ...best,
      id: `multi-${best.dateISO ?? best.day}-${best.startTime}-${guard}-${Date.now()}`,
    });

    const startMin = toMinutes(best.startTime);
    const endMin = best.endTime === '00:00' && startMin > 0 ? 1440 : toMinutes(best.endTime);
    extraBusyByDay[best.day] = [
      ...(extraBusyByDay[best.day] ?? []),
      { startMin, endMin, kind: 'slot' },
    ];
    left -= dur;
  }

  return plan;
}

export function suggestThreeStepRevisionLoop(options: {
  classSlot: TimetableSlot;
  allSlots: TimetableSlot[];
  r1Mins: number;
  r2Mins: number;
  r3Mins: number;
  autoBlockDefault: boolean;
  fridayWeekMode?: FridayWeekMode;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
}): Record<RevisionStage, SlotSuggestion> {
  const {
    classSlot,
    allSlots,
    r1Mins,
    r2Mins,
    r3Mins,
    autoBlockDefault,
    fridayWeekMode = 'bio-week',
    fridayAnchor,
    fridayOverrides,
  } = options;

  const resolver: FridayWeekResolver = fridayAnchor
    ? { anchor: fridayAnchor, overrides: fridayOverrides }
    : fridayWeekMode;
  const activeSlots = getActiveSlotsForSchedule(allSlots, resolver, getTodayISO());
  const classIdx = DAYS_ORDER.indexOf(classSlot.day);
  const classEndMin = getEffectiveEndMin(classSlot);
  const afterCommuteMins =
    classSlot.mode === 'physical' ? (classSlot.travelAfterMins ?? 120) : 0;
  const r1ReadyMin = classEndMin + afterCommuteMins + 10;

  let r1Day = classSlot.day;
  let r1Cands = findDayCandidates({
    slots: activeSlots,
    day: r1Day,
    durationMins: r1Mins,
    pref: 'any',
    minStartAfterMin: r1ReadyMin,
    importance: 'high',
  });
  let r1Note =
    classSlot.mode === 'physical'
      ? `After ${formatDuration(afterCommuteMins)} commute home`
      : 'Right after online class finishes';

  if (r1Cands.length === 0) {
    r1Day = DAYS_ORDER[(classIdx + 1) % 7];
    r1Cands = findDayCandidates({
      slots: activeSlots,
      day: r1Day,
      durationMins: r1Mins,
      pref: 'morning',
      minStartAfterMin: 5 * 60 + 30,
      importance: 'high',
    });
    if (r1Cands.length === 0) {
      r1Cands = findDayCandidates({
        slots: activeSlots,
        day: r1Day,
        durationMins: r1Mins,
        pref: 'any',
        minStartAfterMin: 0,
        importance: 'high',
      });
    }
    r1Note = 'Next morning after getting home late';
  }

  const r1Picked = r1Cands[0] ?? {
    startMin: Math.min(22 * 60, Math.max(6 * 60, r1ReadyMin)),
    endMin: Math.min(22 * 60 + r1Mins, Math.max(6 * 60, r1ReadyMin) + r1Mins),
    reason: r1Note,
  };

  const extraBusyByDay: Partial<Record<DayOfWeek, BusyInterval[]>> = {
    [r1Day]: [
      {
        startMin: r1Picked.startMin,
        endMin: r1Picked.endMin,
        kind: 'slot',
      },
    ],
  };

  const r2Day = DAYS_ORDER[(classIdx + 3) % 7];
  let r2Cands = findDayCandidates({
    slots: activeSlots,
    day: r2Day,
    durationMins: r2Mins,
    pref: 'any',
    minStartAfterMin: 0,
    extraBusy: extraBusyByDay[r2Day] ?? [],
  });
  if (r2Cands.length === 0) {
    const fallbackDay = DAYS_ORDER[(classIdx + 4) % 7];
    r2Cands = findDayCandidates({
      slots: activeSlots,
      day: fallbackDay,
      durationMins: r2Mins,
      pref: 'any',
      minStartAfterMin: 0,
    });
  }
  const r2Picked = r2Cands[0] ?? {
    startMin: 16 * 60,
    endMin: 16 * 60 + r2Mins,
    reason: `${r2Day} · 3 days after class`,
  };
  extraBusyByDay[r2Day] = [
    ...(extraBusyByDay[r2Day] ?? []),
    { startMin: r2Picked.startMin, endMin: r2Picked.endMin, kind: 'slot' },
  ];

  const r3Day = DAYS_ORDER[(classIdx + 6) % 7];
  const r3Cands = findDayCandidates({
    slots: activeSlots,
    day: r3Day,
    durationMins: r3Mins,
    pref: 'any',
    minStartAfterMin: 0,
    extraBusy: extraBusyByDay[r3Day] ?? [],
  });
  const r3Picked = r3Cands[0] ?? {
    startMin: 19 * 60,
    endMin: 19 * 60 + r3Mins,
    reason: `${r3Day} · Day before next class`,
  };

  return {
    r1: {
      id: `r1-${Date.now()}`,
      day: r1Day,
      startTime: minutesToHHMM(r1Picked.startMin),
      endTime: minutesToHHMM(r1Picked.endMin),
      durationMins: r1Mins,
      reason: `Quick R1 · ${r1Note} (${formatTime12h(minutesToHHMM(r1Picked.startMin))})`,
      autoBlock: autoBlockDefault,
      revisionStage: 'r1',
      note: r1Note,
    },
    r2: {
      id: `r2-${Date.now() + 1}`,
      day: r2Day,
      startTime: minutesToHHMM(r2Picked.startMin),
      endTime: minutesToHHMM(r2Picked.endMin),
      durationMins: r2Mins,
      reason: `Deep R2 (3 days later) · ${r2Picked.reason}`,
      autoBlock: autoBlockDefault,
      revisionStage: 'r2',
    },
    r3: {
      id: `r3-${Date.now() + 2}`,
      day: r3Day,
      startTime: minutesToHHMM(r3Picked.startMin),
      endTime: minutesToHHMM(r3Picked.endMin),
      durationMins: r3Mins,
      reason: `Warm-Up R3 (day before class) · ${r3Picked.reason}`,
      autoBlock: autoBlockDefault,
      revisionStage: 'r3',
    },
  };
}

export interface SubjectWeeklyStudyStats {
  subject: SubjectId;
  selfStudyMins: number;
  selfStudyCount: number;
  classMins: number;
  plannedTotalMins: number;
  coveredUnits: number;
  totalUnits: number;
  activeTasksCount: number;
  pendingMissedCount: number;
  unreviewedPapersCount: number;
}

export interface SuggestedWeeklyTaskPlan {
  id: string;
  source: 'existing-task' | 'missed-item' | 'paper-review' | 'syllabus-unit' | 'general-drill';
  subject: SubjectId;
  title: string;
  subtitle: string;
  durationMins: number;
  importance: TaskImportance;
  deadlineISO?: string;
  unitId?: string;
  existingTaskId?: string;
  linkedMissedId?: string;
  linkedPaperId?: string;
  checklistTexts?: string[];
}

export interface WeeklyFocusSuggestionResult {
  recommendedSubject: SubjectId;
  activeSubject: SubjectId;
  reason: string;
  selfStudyRankings: SubjectWeeklyStudyStats[];
  suggestedTasks: SuggestedWeeklyTaskPlan[];
  primaryTask: SuggestedWeeklyTaskPlan;
}

const IMPORTANCE_WEIGHT: Record<TaskImportance, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function suggestLeastSelfStudyFocus(options: {
  slots: TimetableSlot[];
  tasks: StudyTask[];
  missedItems: MissedLessonItem[];
  papers: PaperEntry[];
  unitCoveredMap: Record<string, boolean>;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  preferredSubject?: SubjectId;
  now?: Date;
}): WeeklyFocusSuggestionResult {
  const {
    slots,
    tasks,
    missedItems,
    papers,
    unitCoveredMap,
    fridayAnchor,
    fridayOverrides,
    preferredSubject,
    now = new Date(),
  } = options;

  const resolver: FridayWeekResolver = fridayAnchor
    ? { anchor: fridayAnchor, overrides: fridayOverrides }
    : 'bio-week';

  const weekDays = getWeekDaysForOffset(0, now);
  const { allWeekSlots } = getActiveSlotsForWeek(slots, weekDays, resolver);

  const subjects: SubjectId[] = ['biology', 'physics', 'chemistry'];
  const statsList: SubjectWeeklyStudyStats[] = subjects.map((subj) => {
    const subjWeekSlots = allWeekSlots.filter((s) => s.subject === subj);
    const selfStudySlots = subjWeekSlots.filter((s) => s.category === 'self-study');
    const classSlots = subjWeekSlots.filter((s) => s.category === 'class');

    const selfStudyMins = selfStudySlots.reduce(
      (acc, s) => acc + getDurationMinutes(s.startTime, s.endTime),
      0,
    );
    const classMins = classSlots.reduce(
      (acc, s) => acc + getDurationMinutes(s.startTime, s.endTime),
      0,
    );

    const subjUnits = SYLLABUS_UNITS[subj];
    const coveredUnits = subjUnits.filter((u) => unitCoveredMap[u.id]).length;

    return {
      subject: subj,
      selfStudyMins,
      selfStudyCount: selfStudySlots.length,
      classMins,
      plannedTotalMins: selfStudyMins + classMins,
      coveredUnits,
      totalUnits: subjUnits.length,
      activeTasksCount: tasks.filter((t) => t.status === 'active' && t.subject === subj).length,
      pendingMissedCount: missedItems.filter(
        (m) => m.status === 'active' && !m.rescheduleLocked && m.subject === subj,
      ).length,
      unreviewedPapersCount: papers.filter(
        (p) => p.reviewStatus === 'needs-review' && p.subject === subj,
      ).length,
    };
  });

  // Sort strictly ascending by self-study minutes planned this week;
  // tie-break by pending backlog count, then lower syllabus % covered, then lower total class load.
  const selfStudyRankings = [...statsList].sort((a, b) => {
    if (a.selfStudyMins !== b.selfStudyMins) {
      return a.selfStudyMins - b.selfStudyMins;
    }
    const backlogA = a.activeTasksCount + a.pendingMissedCount + a.unreviewedPapersCount;
    const backlogB = b.activeTasksCount + b.pendingMissedCount + b.unreviewedPapersCount;
    if (backlogA !== backlogB) {
      return backlogB - backlogA;
    }
    const covA = a.totalUnits > 0 ? a.coveredUnits / a.totalUnits : 1;
    const covB = b.totalUnits > 0 ? b.coveredUnits / b.totalUnits : 1;
    if (covA !== covB) {
      return covA - covB;
    }
    return a.classMins - b.classMins;
  });

  const recommendedSubject = selfStudyRankings[0].subject;
  const activeSubject = preferredSubject ?? recommendedSubject;

  const activeStat =
    selfStudyRankings.find((s) => s.subject === activeSubject) ?? selfStudyRankings[0];
  const mostStudied = selfStudyRankings[selfStudyRankings.length - 1];
  const subjMeta = SUBJECT_META[activeSubject];

  let reason = '';
  if (activeSubject === recommendedSubject) {
    if (activeStat.selfStudyMins === 0 && mostStudied.selfStudyMins > 0) {
      reason = `${subjMeta.name} has 0m self-study planned this week vs ${SUBJECT_META[mostStudied.subject].name} (${formatDuration(mostStudied.selfStudyMins)}).`;
    } else if (activeStat.selfStudyMins < mostStudied.selfStudyMins) {
      reason = `${subjMeta.name} has the least weekly self-study (${formatDuration(activeStat.selfStudyMins)} vs ${SUBJECT_META[mostStudied.subject].name}: ${formatDuration(mostStudied.selfStudyMins)}).`;
    } else if (activeStat.selfStudyMins === 0) {
      reason = `No self-study blocks scheduled this week yet — ${subjMeta.name} stands out with ${activeStat.activeTasksCount + activeStat.pendingMissedCount + activeStat.unreviewedPapersCount} pending items / ${activeStat.totalUnits - activeStat.coveredUnits} uncovered units.`;
    } else {
      reason = `${subjMeta.name} matches your lightest self-study balance (${formatDuration(activeStat.selfStudyMins)} this week).`;
    }
  } else {
    reason = `${subjMeta.name} currently has ${formatDuration(activeStat.selfStudyMins)} self-study planned this week.`;
  }

  const suggestedTasks: SuggestedWeeklyTaskPlan[] = [];

  // 1. Existing active Planner tasks for the subject (needs-slot & due-soonest first)
  const subjActiveTasks = tasks
    .filter((t) => t.status === 'active' && t.subject === activeSubject)
    .sort((a, b) => {
      const aHasSlot = slots.some((s) => s.linkedTaskId === a.id);
      const bHasSlot = slots.some((s) => s.linkedTaskId === b.id);
      if (aHasSlot !== bHasSlot) return aHasSlot ? 1 : -1;
      if (a.deadlineISO && b.deadlineISO && a.deadlineISO !== b.deadlineISO) {
        return a.deadlineISO.localeCompare(b.deadlineISO);
      }
      if (a.deadlineISO && !b.deadlineISO) return -1;
      if (!a.deadlineISO && b.deadlineISO) return 1;
      const impDiff =
        IMPORTANCE_WEIGHT[a.importance ?? 'medium'] - IMPORTANCE_WEIGHT[b.importance ?? 'medium'];
      if (impDiff !== 0) return impDiff;
      return a.order - b.order;
    });

  for (const t of subjActiveTasks.slice(0, 3)) {
    const hasSlot = slots.some((s) => s.linkedTaskId === t.id);
    suggestedTasks.push({
      id: `wsug-task-${t.id}`,
      source: 'existing-task',
      subject: activeSubject,
      title: t.title,
      subtitle: hasSlot
        ? 'Active Planner task · Book an extra reinforcement session'
        : 'Active Planner task · Needs a Timetable self-study slot',
      durationMins: t.defaultSessionMins || 60,
      importance: t.importance ?? 'high',
      deadlineISO: t.deadlineISO,
      unitId: t.unitId,
      existingTaskId: t.id,
    });
  }

  // 2. Pending missed lesson/homework for the subject
  const subjMissed = missedItems
    .filter((m) => m.status === 'active' && !m.rescheduleLocked && m.subject === activeSubject)
    .sort((a, b) => {
      const impDiff = IMPORTANCE_WEIGHT[a.importance] - IMPORTANCE_WEIGHT[b.importance];
      if (impDiff !== 0) return impDiff;
      return (a.deadlineISO ?? '9999').localeCompare(b.deadlineISO ?? '9999');
    });

  for (const m of subjMissed.slice(0, 2)) {
    suggestedTasks.push({
      id: `wsug-missed-${m.id}`,
      source: 'missed-item',
      subject: activeSubject,
      title: `${m.category === 'recording' ? 'Catch Up Rec' : 'Finish HW'}: ${m.title}`,
      subtitle: 'Pending item from your Missed queue',
      durationMins: Math.min(120, Math.max(45, m.estimatedMins || 60)),
      importance: m.importance,
      deadlineISO: m.deadlineISO,
      unitId: m.unitId,
      linkedMissedId: m.id,
    });
  }

  // 3. Unreviewed past papers for the subject
  const subjPapers = papers.filter(
    (p) => p.reviewStatus === 'needs-review' && p.subject === activeSubject,
  );
  for (const p of subjPapers.slice(0, 2)) {
    suggestedTasks.push({
      id: `wsug-paper-${p.id}`,
      source: 'paper-review',
      subject: activeSubject,
      title: `Review Paper: ${p.paperName}`,
      subtitle: `Scored ${p.combinedPercent}% · Needs mistake review`,
      durationMins: 60,
      importance: p.combinedPercent < 65 ? 'urgent' : 'high',
      unitId: p.weakUnitIds?.[0],
      linkedPaperId: p.id,
      checklistTexts: [
        `Re-solve missed MCQ & Part II questions (${p.paperName})`,
        'Write key concept notes for weak syllabus points',
      ],
    });
  }

  // 4. Next uncovered syllabus units
  const uncoveredUnits = SYLLABUS_UNITS[activeSubject].filter((u) => !unitCoveredMap[u.id]);
  for (const u of uncoveredUnits.slice(0, 2)) {
    suggestedTasks.push({
      id: `wsug-unit-${u.id}`,
      source: 'syllabus-unit',
      subject: activeSubject,
      title: `Cover ${u.code}: ${u.title}`,
      subtitle: `Next uncovered ${subjMeta.name} syllabus unit (${activeStat.coveredUnits}/${activeStat.totalUnits} done)`,
      durationMins: 60,
      importance: 'high',
      unitId: u.id,
      checklistTexts: [
        `Summarize theory & core mechanisms for ${u.code}`,
        `Complete 20 timed MCQ & structured questions`,
      ],
    });
  }

  // 5. Fallback general timed drill
  suggestedTasks.push({
    id: `wsug-drill-${activeSubject}`,
    source: 'general-drill',
    subject: activeSubject,
    title: `${subjMeta.name} Timed Past Paper & Recall Drill`,
    subtitle: 'Focused weekly self-study boost for A/L exam readiness',
    durationMins: 60,
    importance: 'medium',
    checklistTexts: [
      `Timed 30-min ${subjMeta.name} MCQ / structured set`,
      'Check marking scheme & log weak topics',
    ],
  });

  return {
    recommendedSubject,
    activeSubject,
    reason,
    selfStudyRankings,
    suggestedTasks,
    primaryTask: suggestedTasks[0],
  };
}

