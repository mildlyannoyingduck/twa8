import {
  Activity,
  ArrowRight,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FileBarChart2,
  Flame,
  Gem,
  History,
  Lock,
  PlaySquare,
  Plus,
  RotateCcw,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import {
  SUBJECT_GLASS_CARD,
  SUBJECT_META,
  SUGGEST_SESSION_CHIPS,
} from '../data/previewData';
import {
  ActiveLockInfo,
  AppearanceStudioConfig,
  DayCompletionLog,
  FridayAnchor,
  FridayWeekOverrides,
  MissedCategory,
  MissedLessonItem,
  PaperEntry,
  ProgressionState,
  SlotCategory,
  StudyTask,
  SubjectId,
  TaskImportance,
  TimetableSlot,
  WeekPerformance,
} from '../types';
import {
  addDaysISO,
  diffDaysISO,
  formatDeadlineRelative,
  formatFullDateLabel,
  formatWeekRange,
  getDayOfWeek,
  getMondayOfWeek,
  getTodayISO,
  getWeekDaysForOffset,
  parseISODateLocal,
  toISODate,
} from '../utils/dateUtils';
import { haptics } from '../utils/haptics';
import {
  getDivisionInfo,
  isAbilityActive,
  isFocusRushActive,
  resolveEffectiveStudio,
  XP_VALUES,
} from '../utils/progressionEngine';
import {
  getActiveSlotsForWeek,
  SuggestedWeeklyTaskPlan,
  suggestLeastSelfStudyFocus,
} from '../utils/schedulerEngine';
import {
  formatDuration,
  formatTime12h,
  getDurationMinutes,
  getExamCountdown,
  toMinutes,
} from '../utils/timeUtils';
import { CrystalSheet, LiquidSwitch } from './FluidControls';
import { GlassTimePicker } from './GlassTimePicker';
import { LEAGUE_AURA_STYLE, LeagueCrest } from './LeagueCrest';

interface DayViewProps {
  slots: TimetableSlot[];
  tasks: StudyTask[];
  missedItems?: MissedLessonItem[];
  papers?: PaperEntry[];
  dailyLogs: Record<string, DayCompletionLog>;
  activeLock: ActiveLockInfo;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  unitCoveredMap?: Record<string, boolean>;
  progression: ProgressionState;
  studio: AppearanceStudioConfig;
  pendingMissedCount?: number;
  unreviewedPapersCount?: number;
  onToggleSlotComplete: (dateISO: string, slotId: string) => void;
  onMarkSlotIncomplete: (dateISO: string, slotId: string, partialMinutes: number) => void;
  onToggleTaskComplete?: (taskId: string) => void;
  onToggleMissedCovered?: (missedId: string) => void;
  onQuickAddSlot?: (slot: TimetableSlot) => void;
  onQuickAddTask?: (task: StudyTask) => void;
  onQuickAddMissed?: (item: MissedLessonItem) => void;
  onOpenBlockerPreview: () => void;
  onOpenAbilities: () => void;
  onOpenWeeklyFocusSuggest?: () => void;
  onAcceptWeeklyFocusPlan?: (plan: SuggestedWeeklyTaskPlan, durationMins: number) => void;
  onGoToTimetable: () => void;
  onOpenPlannerForTask?: (taskId: string) => void;
  onOpenPlanner?: () => void;
  onOpenMissedPage?: () => void;
  onOpenPapers?: () => void;
}

const SUBJECT_CHECK_STYLE: Record<SubjectId, { checked: string; unchecked: string }> = {
  biology: {
    checked: 'border-emerald-500 bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.42)]',
    unchecked: 'border-emerald-600/55 bg-emerald-500/10 dark:border-emerald-400/55',
  },
  physics: {
    checked: 'border-orange-500 bg-orange-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.42)]',
    unchecked: 'border-orange-600/55 bg-orange-500/10 dark:border-orange-400/55',
  },
  chemistry: {
    checked: 'border-violet-500 bg-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.42)]',
    unchecked: 'border-violet-600/55 bg-violet-500/10 dark:border-violet-400/55',
  },
};

type QuickAddKind = 'task' | 'slot' | 'missed';

function getTimeGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour >= 4 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 22) return 'Good Evening';
  return 'Late Night Focus';
}

export const DayView = memo(function DayView({
  slots,
  tasks,
  missedItems = [],
  papers = [],
  dailyLogs,
  activeLock,
  fridayAnchor,
  fridayOverrides,
  unitCoveredMap = {},
  progression,
  studio,
  pendingMissedCount = 0,
  unreviewedPapersCount = 0,
  onToggleSlotComplete,
  onMarkSlotIncomplete,
  onToggleTaskComplete,
  onToggleMissedCovered,
  onQuickAddSlot,
  onQuickAddTask,
  onQuickAddMissed,
  onOpenBlockerPreview,
  onOpenAbilities,
  onOpenWeeklyFocusSuggest,
  onAcceptWeeklyFocusPlan,
  onGoToTimetable,
  onOpenPlannerForTask,
  onOpenPlanner,
  onOpenMissedPage,
  onOpenPapers,
}: DayViewProps) {
  const now = new Date();
  const todayISO = useMemo(() => getTodayISO(new Date()), []);
  const tomorrowISO = useMemo(() => addDaysISO(todayISO, 1), [todayISO]);
  const currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();

  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [rewardPop, setRewardPop] = useState<{ id: string; text: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [partialModalSlot, setPartialModalSlot] = useState<TimetableSlot | null>(null);
  const [partialMinsInput, setPartialMinsInput] = useState<number>(30);

  // Quick-Add Modal State
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickKind, setQuickKind] = useState<QuickAddKind>('task');
  const [qaSubject, setQaSubject] = useState<SubjectId>('biology');
  const [qaTitle, setQaTitle] = useState('');
  const [qaDeadline, setQaDeadline] = useState(tomorrowISO);
  const [qaImportance, setQaImportance] = useState<TaskImportance>('high');
  const [qaEstMins, setQaEstMins] = useState(45);
  const [qaMissedCat, setQaMissedCat] = useState<MissedCategory>('recording');
  const [qaSlotDate, setQaSlotDate] = useState(todayISO);
  const [qaSlotCat, setQaSlotCat] = useState<SlotCategory>('self-study');
  const [qaStart, setQaStart] = useState('18:00');
  const [qaEnd, setQaEnd] = useState('19:00');
  const [qaAutoBlock, setQaAutoBlock] = useState(true);
  const [qaClockTarget, setQaClockTarget] = useState<'start' | 'end' | null>(null);

  const effectiveStudio = useMemo(
    () => resolveEffectiveStudio(studio, progression.currentLeague),
    [studio, progression.currentLeague],
  );
  const divInfo = useMemo(
    () => getDivisionInfo(progression.xp, progression.currentLeague),
    [progression.xp, progression.currentLeague],
  );
  const rushLive = isFocusRushActive(progression);
  const balanceRadarActive = isAbilityActive(progression, 'subject_balance_radar');

  const weeklySelfStudyFocus = useMemo(
    () =>
      suggestLeastSelfStudyFocus({
        slots,
        tasks,
        missedItems,
        papers,
        unitCoveredMap,
        fridayAnchor,
        fridayOverrides,
      }),
    [slots, tasks, missedItems, papers, unitCoveredMap, fridayAnchor, fridayOverrides],
  );

  const currentWeekDays = useMemo(() => getWeekDaysForOffset(0, new Date()), []);
  const nextWeekDays = useMemo(() => getWeekDaysForOffset(1, new Date()), []);

  const resolverArg = useMemo(
    () =>
      fridayAnchor
        ? { anchor: fridayAnchor, overrides: fridayOverrides }
        : ('bio-week' as const),
    [fridayAnchor, fridayOverrides],
  );

  const currentWeekData = useMemo(
    () => getActiveSlotsForWeek(slots, currentWeekDays, resolverArg),
    [slots, currentWeekDays, resolverArg],
  );
  const nextWeekData = useMemo(
    () => getActiveSlotsForWeek(slots, nextWeekDays, resolverArg),
    [slots, nextWeekDays, resolverArg],
  );

  const todayInfo = useMemo(
    () => currentWeekDays.find((d) => d.dateISO === todayISO) ?? currentWeekDays[0],
    [currentWeekDays, todayISO],
  );
  const todaySlots = useMemo(
    () => currentWeekData.slotsByDay[todayInfo.day] ?? [],
    [currentWeekData, todayInfo.day],
  );

  const todayLog = dailyLogs[todayISO];
  const todayCompletedIds = todayLog?.completedSlotIds ?? [];
  const todayIncompleteIds = todayLog?.incompleteSlotIds ?? [];
  const todayLoggedBySlot = todayLog?.loggedMinutesBySlot ?? {};

  // Weekly Completion % & Study Time This Week
  const currentWeekTelemetry = useMemo(() => {
    let totalSlots = 0;
    let doneSlots = 0;
    let plannedMins = 0;
    let studiedMins = 0;
    let classStudiedMins = 0;
    let selfStudiedMins = 0;

    const perSubject: Record<SubjectId, { planned: number; done: number }> = {
      biology: { planned: 0, done: 0 },
      physics: { planned: 0, done: 0 },
      chemistry: { planned: 0, done: 0 },
    };

    for (const wd of currentWeekDays) {
      const list = currentWeekData.slotsByDay[wd.day] ?? [];
      const log = dailyLogs[wd.dateISO];
      const doneIds = log?.completedSlotIds ?? [];
      const incIds = log?.incompleteSlotIds ?? [];
      const loggedMap = log?.loggedMinutesBySlot ?? {};

      for (const s of list) {
        const dur = getDurationMinutes(s.startTime, s.endTime);
        totalSlots += 1;
        plannedMins += dur;
        perSubject[s.subject].planned += dur;

        let credited = 0;
        if (doneIds.includes(s.id)) {
          doneSlots += 1;
          credited = dur;
        } else if (incIds.includes(s.id) && loggedMap[s.id]) {
          credited = loggedMap[s.id];
        }

        if (credited > 0) {
          studiedMins += credited;
          perSubject[s.subject].done += credited;
          if (s.category === 'class') classStudiedMins += credited;
          else selfStudiedMins += credited;
        }
      }
    }

    const completionPct =
      plannedMins > 0
        ? Math.min(100, Math.round((studiedMins / plannedMins) * 100))
        : totalSlots > 0
          ? Math.round((doneSlots / totalSlots) * 100)
          : 0;

    let topSubject: SubjectId = 'biology';
    let topScore = -1;
    let weakestSubject: SubjectId = 'chemistry';
    let weakestMins = Number.MAX_SAFE_INTEGER;
    for (const subj of ['biology', 'physics', 'chemistry'] as SubjectId[]) {
      const score = perSubject[subj].done > 0 ? perSubject[subj].done : perSubject[subj].planned;
      if (score > topScore) {
        topScore = score;
        topSubject = subj;
      }
      if (perSubject[subj].planned < weakestMins) {
        weakestMins = perSubject[subj].planned;
        weakestSubject = subj;
      }
    }

    const bioShare = plannedMins > 0 ? Math.round((perSubject.biology.planned / plannedMins) * 100) : 33;
    const phyShare = plannedMins > 0 ? Math.round((perSubject.physics.planned / plannedMins) * 100) : 33;
    const chemShare = Math.max(0, 100 - bioShare - phyShare);

    return {
      totalSlots,
      doneSlots,
      plannedMins,
      studiedMins,
      classStudiedMins,
      selfStudiedMins,
      completionPct,
      perSubject,
      topSubject,
      weakestSubject,
      shares: { biology: bioShare, physics: phyShare, chemistry: chemShare },
    };
  }, [currentWeekDays, currentWeekData, dailyLogs]);

  // Live / Next Session Spotlight (Today)
  const todaySpotlight = useMemo(() => {
    const activeNow = todaySlots.find((s) => {
      const start = toMinutes(s.startTime);
      const end = s.endTime === '00:00' && start > 0 ? 1440 : toMinutes(s.endTime);
      return currentMinuteOfDay >= start && currentMinuteOfDay < end;
    });
    if (activeNow) {
      const start = toMinutes(activeNow.startTime);
      const end =
        activeNow.endTime === '00:00' && start > 0 ? 1440 : toMinutes(activeNow.endTime);
      const total = Math.max(1, end - start);
      return {
        kind: 'live' as const,
        slot: activeNow,
        elapsedPct: Math.min(100, Math.max(2, Math.round(((currentMinuteOfDay - start) / total) * 100))),
        minsRemaining: end - currentMinuteOfDay,
      };
    }

    const nextUp = todaySlots.find((s) => toMinutes(s.startTime) > currentMinuteOfDay);
    if (nextUp) {
      return {
        kind: 'next' as const,
        slot: nextUp,
        elapsedPct: 0,
        minsRemaining: toMinutes(nextUp.startTime) - currentMinuteOfDay,
      };
    }
    return null;
  }, [todaySlots, currentMinuteOfDay]);

  // Upcoming Classes Today & Tomorrow
  const upcomingClasses = useMemo(() => {
    const result: {
      slot: TimetableSlot;
      dateISO: string;
      dayLabel: string;
      isDone: boolean;
    }[] = [];

    for (const s of todaySlots) {
      if (s.category !== 'class') continue;
      const start = toMinutes(s.startTime);
      const end = s.endTime === '00:00' && start > 0 ? 1440 : toMinutes(s.endTime);
      if (end <= currentMinuteOfDay) continue;
      result.push({
        slot: s,
        dateISO: todayISO,
        dayLabel: 'Today',
        isDone: todayCompletedIds.includes(s.id),
      });
    }

    const tomorrowInCurr = currentWeekDays.some((d) => d.dateISO === tomorrowISO);
    const tomorrowDow = getDayOfWeek(parseISODateLocal(tomorrowISO));
    const tomorrowSlots = tomorrowInCurr
      ? currentWeekData.slotsByDay[tomorrowDow] ?? []
      : nextWeekData.slotsByDay[tomorrowDow] ?? [];
    const tomorrowDoneIds = dailyLogs[tomorrowISO]?.completedSlotIds ?? [];

    for (const s of tomorrowSlots) {
      if (s.category !== 'class') continue;
      result.push({
        slot: s,
        dateISO: tomorrowISO,
        dayLabel: `Tomorrow (${tomorrowDow})`,
        isDone: tomorrowDoneIds.includes(s.id),
      });
    }

    return result.slice(0, 5);
  }, [
    todaySlots,
    currentMinuteOfDay,
    todayISO,
    todayCompletedIds,
    currentWeekDays,
    nextWeekDays.length,
    tomorrowISO,
    currentWeekData,
    nextWeekData,
    dailyLogs,
  ]);

  const todayRemainingSlots = useMemo(
    () => todaySlots.filter((s) => !todayCompletedIds.includes(s.id)),
    [todaySlots, todayCompletedIds],
  );

  const activeTasksSorted = useMemo(() => {
    const rank: Record<TaskImportance, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...tasks]
      .filter((t) => t.status === 'active')
      .sort((a, b) => {
        const aDueToday = a.deadlineISO && a.deadlineISO <= todayISO ? 0 : 1;
        const bDueToday = b.deadlineISO && b.deadlineISO <= todayISO ? 0 : 1;
        if (aDueToday !== bDueToday) return aDueToday - bDueToday;
        const ra = rank[a.importance ?? 'medium'];
        const rb = rank[b.importance ?? 'medium'];
        return ra !== rb ? ra - rb : a.order - b.order;
      });
  }, [tasks, todayISO]);

  const upcomingDeadlines = useMemo(() => {
    type DeadlineEntry = {
      id: string;
      kind: 'task' | 'review' | 'missed';
      title: string;
      subject: SubjectId;
      deadlineISO: string;
      relativeLabel: string;
      isOverdue: boolean;
      isDueToday: boolean;
      badgeLabel: string;
    };

    const list: DeadlineEntry[] = [];
    for (const t of tasks) {
      if (t.status !== 'active' || !t.deadlineISO) continue;
      const diff = diffDaysISO(todayISO, t.deadlineISO);
      list.push({
        id: t.id,
        kind: t.kind === 'paper-review' ? 'review' : 'task',
        title: t.title,
        subject: t.subject,
        deadlineISO: t.deadlineISO,
        relativeLabel: formatDeadlineRelative(t.deadlineISO, todayISO) ?? t.deadlineISO,
        isOverdue: diff < 0,
        isDueToday: diff === 0,
        badgeLabel: t.kind === 'paper-review' ? 'Paper Review' : 'Task',
      });
    }

    for (const m of missedItems) {
      if (m.status !== 'active' || !m.deadlineISO) continue;
      const diff = diffDaysISO(todayISO, m.deadlineISO);
      list.push({
        id: m.id,
        kind: 'missed',
        title: m.title,
        subject: m.subject,
        deadlineISO: m.deadlineISO,
        relativeLabel: formatDeadlineRelative(m.deadlineISO, todayISO) ?? m.deadlineISO,
        isOverdue: diff < 0,
        isDueToday: diff === 0,
        badgeLabel: m.category === 'recording' ? 'Missed Rec' : 'Missed HW',
      });
    }

    return list.sort((a, b) => a.deadlineISO.localeCompare(b.deadlineISO));
  }, [tasks, missedItems, todayISO]);

  const pastWeeks: WeekPerformance[] = useMemo(() => {
    const currentMondayISO = toISODate(getMondayOfWeek(new Date()));
    const weekBuckets: Record<
      string,
      { plannedMins: number; doneMins: number; tasksDone: number; tasksTotal: number }
    > = {};

    for (const [dateISO, log] of Object.entries(dailyLogs)) {
      const [y, m, d] = dateISO.split('-').map(Number);
      const monISO = toISODate(getMondayOfWeek(new Date(y, m - 1, d)));
      if (monISO >= currentMondayISO) continue;
      if (!weekBuckets[monISO]) {
        weekBuckets[monISO] = { plannedMins: 0, doneMins: 0, tasksDone: 0, tasksTotal: 0 };
      }
      weekBuckets[monISO].plannedMins += log.plannedMinutes;
      weekBuckets[monISO].doneMins += log.completedMinutes;
      weekBuckets[monISO].tasksDone += log.tasksDone;
      weekBuckets[monISO].tasksTotal += log.tasksTotal;
    }

    return Object.entries(weekBuckets)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 8)
      .map(([weekStartISO, stats], idx) => ({
        weekStartISO,
        label: idx === 0 ? 'Last Week' : `${idx + 1} Weeks Ago`,
        range: formatWeekRange(weekStartISO),
        completionPercent:
          stats.plannedMins > 0 ? Math.round((stats.doneMins / stats.plannedMins) * 100) : 0,
        tasksDone: stats.tasksDone,
        tasksTotal: stats.tasksTotal,
        hoursCompleted: Number((stats.doneMins / 60).toFixed(1)),
        hoursPlanned: Number((stats.plannedMins / 60).toFixed(1)),
      }));
  }, [dailyLogs]);

  const lastWeekPct = pastWeeks[0]?.completionPercent ?? null;
  const weekTrendDelta =
    lastWeekPct !== null ? currentWeekTelemetry.completionPct - lastWeekPct : null;

  const examCountdown = useMemo(() => getExamCountdown(), []);
  const latestPaperAvg = useMemo(() => {
    if (papers.length === 0) return null;
    return Math.round(papers.reduce((acc, p) => acc + p.combinedPercent, 0) / papers.length);
  }, [papers]);

  const ringRadius = 33;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const weeklyRingOffset =
    ringCircumference - (currentWeekTelemetry.completionPct / 100) * ringCircumference;

  const showRewardPop = (id: string, baseXp: number) => {
    const mult = rushLive ? 2 : 1;
    const text = `+${baseXp * mult} XP`;
    setRewardPop({ id, text });
    window.setTimeout(() => {
      setRewardPop((cur) => (cur?.id === id ? null : cur));
    }, 1100);
  };

  const triggerCompleteToggle = (
    dateISO: string,
    slotId: string,
    currentlyDone: boolean,
    slotCategory: SlotCategory = 'self-study',
  ) => {
    if (!currentlyDone) {
      haptics.success();
      setJustCompletedId(slotId);
      showRewardPop(
        slotId,
        slotCategory === 'class' ? XP_VALUES.classComplete : XP_VALUES.selfStudyComplete,
      );
      window.setTimeout(() => {
        setJustCompletedId((cur) => (cur === slotId ? null : cur));
      }, 760);
    } else {
      haptics.tick();
    }
    onToggleSlotComplete(dateISO, slotId);
  };

  const openPartialDialog = (slot: TimetableSlot) => {
    haptics.tap();
    const full = getDurationMinutes(slot.startTime, slot.endTime);
    setPartialMinsInput(todayLoggedBySlot[slot.id] ?? Math.max(15, Math.round(full / 2)));
    setPartialModalSlot(slot);
  };

  const openQuickAdd = (preferredKind: QuickAddKind = 'task') => {
    haptics.tap();
    setQuickKind(preferredKind);
    setQaTitle('');
    setQaDeadline(tomorrowISO);
    setQaSlotDate(todayISO);
    setQuickAddOpen(true);
  };

  const qaInvalidRange = getDurationMinutes(qaStart, qaEnd) <= 0;

  const handleSubmitQuickAdd = () => {
    if (!qaTitle.trim()) return;
    haptics.success();

    if (quickKind === 'task' && onQuickAddTask) {
      onQuickAddTask({
        id: `task-qa-${Date.now()}`,
        title: qaTitle.trim(),
        subject: qaSubject,
        kind: 'task',
        defaultSessionMins: qaEstMins,
        deadlineISO: qaDeadline || undefined,
        importance: qaImportance,
        checklist: [],
        notes: 'Added via Home Quick-Add',
        status: 'active',
        order: tasks.length,
        createdAtISO: todayISO,
        autoBlockDefault: true,
      });
    } else if (quickKind === 'missed' && onQuickAddMissed) {
      onQuickAddMissed({
        id: `missed-qa-${Date.now()}`,
        category: qaMissedCat,
        subject: qaSubject,
        title: qaTitle.trim(),
        notes: 'Added via Home Quick-Add',
        estimatedMins: qaEstMins,
        playbackSpeed: qaMissedCat === 'recording' ? 1.5 : undefined,
        deadlineISO: qaDeadline || undefined,
        importance: qaImportance,
        status: 'active',
        autoBlockDefault: true,
        createdAtISO: todayISO,
      });
    } else if (quickKind === 'slot' && onQuickAddSlot && !qaInvalidRange) {
      const targetDate = qaSlotDate || todayISO;
      const dow = getDayOfWeek(parseISODateLocal(targetDate));
      onQuickAddSlot({
        id: `slot-qa-${Date.now()}`,
        day: dow,
        specificDateISO: targetDate,
        startTime: qaStart,
        endTime: qaEnd,
        category: qaSlotCat,
        subject: qaSubject,
        title:
          qaSlotCat === 'class'
            ? qaTitle.trim()
            : `Self-Study · ${SUBJECT_META[qaSubject].short}`,
        subtitle: qaSlotCat === 'class' ? 'One-off class' : qaTitle.trim(),
        autoBlock: qaAutoBlock,
        mode: 'online',
        travelBeforeMins: 0,
        travelAfterMins: 0,
      });
    }

    setQuickAddOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pt-6">
      {/* Greeting, Kithnuka League Emblem Aura, Date & Quick Add */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-[#07142B] dark:text-white sm:text-2xl">
              {getTimeGreeting(now)},
            </h1>

            <button
              type="button"
              onClick={() => {
                haptics.tick();
                onOpenAbilities();
              }}
              aria-label="Open Kithnuka XP Arena"
              className={`ios-glass-control group relative inline-flex items-center gap-2 rounded-full border px-3 py-1 transition-transform active:scale-95 ${
                LEAGUE_AURA_STYLE[progression.currentLeague].ringBorder
              } ${LEAGUE_AURA_STYLE[progression.currentLeague].glowShadow}`}
            >
              <LeagueCrest
                league={progression.currentLeague}
                division={divInfo.division}
                size="xs"
                withAura
              />
              <span className="font-brand bg-gradient-to-r from-[#07142B] via-blue-700 to-cyan-600 bg-clip-text text-lg font-extrabold tracking-tight text-transparent dark:from-white dark:via-sky-200 dark:to-cyan-300 sm:text-xl">
                Kithnuka
              </span>
              {effectiveStudio.showCrestInHeader && (
                <span
                  className={`tabular-nums rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm ${
                    LEAGUE_AURA_STYLE[progression.currentLeague].pillBg
                  }`}
                >
                  {divInfo.league.shortName} {divInfo.roman}
                </span>
              )}
              {effectiveStudio.customTitle.trim() && (
                <span className="hidden text-[11px] font-semibold text-blue-700 dark:text-cyan-300 sm:inline">
                  · {effectiveStudio.customTitle.trim()}
                </span>
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
            {formatFullDateLabel(now)} · {examCountdown.days} days to A/L Exam
          </p>
        </div>

        <button
          type="button"
          onClick={() => openQuickAdd('task')}
          className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-95 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Quick Add</span>
        </button>
      </div>

      {/* Row 1: Weekly Completion %, Study Time This Week & Weekly Productivity Summary */}
      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        <section className="ios-glass-hero relative flex flex-col justify-between gap-4 overflow-hidden rounded-[34px] p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90" aria-hidden="true">
                  <defs>
                    <linearGradient id="dashWeekRing" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2563EB" />
                      <stop offset="55%" stopColor="#22D3EE" />
                      <stop offset="100%" stopColor="#34D399" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="38"
                    cy="38"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-blue-500/15 dark:text-sky-300/15"
                  />
                  <circle
                    cx="38"
                    cy="38"
                    r={ringRadius}
                    fill="none"
                    stroke="url(#dashWeekRing)"
                    strokeWidth="6.5"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={weeklyRingOffset}
                    className="transition-[stroke-dashoffset] duration-300 ease-out"
                  />
                </svg>
                <span className="tabular-nums absolute text-base font-bold text-[#07142B] dark:text-white">
                  {currentWeekTelemetry.completionPct}%
                </span>
              </div>

              <div className="min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-cyan-300">
                  Kithnuka · {formatWeekRange(currentWeekDays[0].dateISO)}
                </p>
                <h2 className="tabular-nums mt-0.5 text-xl font-bold tracking-tight text-[#07142B] dark:text-white">
                  {formatDuration(currentWeekTelemetry.studiedMins)} studied
                </h2>
                <p className="tabular-nums mt-0.5 text-xs text-[#0B234A]/72 dark:text-sky-100/80">
                  {currentWeekTelemetry.doneSlots}/{currentWeekTelemetry.totalSlots} slots done ·{' '}
                  {formatDuration(currentWeekTelemetry.plannedMins)} planned
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenAbilities();
                }}
                className="ios-glass-control inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 text-[11px] font-bold text-[#07142B] transition-transform duration-100 active:scale-95 dark:text-sky-50"
              >
                <Gem className="h-3 w-3 text-cyan-500" />
                <span className="tabular-nums">{progression.xp} XP</span>
                <span className="opacity-45">·</span>
                <Flame className="h-3 w-3 text-orange-500" />
                <span className="tabular-nums">{progression.streakDays}d</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenBlockerPreview();
                }}
                className={`ios-glass-control inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition-transform duration-100 active:scale-95 ${
                  rushLive || activeLock.active
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-[#07142B] dark:text-sky-50'
                }`}
              >
                {rushLive ? <Zap className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                <span>
                  {rushLive
                    ? '2× Rush Live'
                    : activeLock.active
                      ? `Locked · ${activeLock.untilTimeLabel}`
                      : 'Shield'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-white/40 pt-3.5 dark:border-sky-300/15 sm:grid-cols-2">
            <div className="ios-glass-control rounded-[22px] px-3.5 py-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-[#0B234A]/75 dark:text-sky-200/80">Study Time Split</span>
                <span className="tabular-nums text-blue-700 dark:text-cyan-300">
                  Classes {formatDuration(currentWeekTelemetry.classStudiedMins)} · Study{' '}
                  {formatDuration(currentWeekTelemetry.selfStudiedMins)}
                </span>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                <div
                  style={{
                    width: `${
                      currentWeekTelemetry.studiedMins > 0
                        ? Math.round(
                            (currentWeekTelemetry.classStudiedMins /
                              currentWeekTelemetry.studiedMins) *
                              100,
                          )
                        : 50
                    }%`,
                  }}
                  className="h-full bg-blue-600 dark:bg-blue-400"
                />
                <div
                  style={{
                    width: `${
                      currentWeekTelemetry.studiedMins > 0
                        ? Math.round(
                            (currentWeekTelemetry.selfStudiedMins /
                              currentWeekTelemetry.studiedMins) *
                              100,
                          )
                        : 50
                    }%`,
                  }}
                  className="h-full bg-cyan-500 dark:bg-cyan-300"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              {(['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
                const meta = SUBJECT_META[subj];
                const stat = currentWeekTelemetry.perSubject[subj];
                const pct =
                  stat.planned > 0
                    ? Math.min(100, Math.round((stat.done / stat.planned) * 100))
                    : 0;
                return (
                  <div key={subj} className="flex items-center gap-2 text-[11px]">
                    <span className={`w-9 shrink-0 font-bold ${meta.text}`}>{meta.short}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-[width] duration-300 ${meta.bar}`}
                      />
                    </div>
                    <span className="tabular-nums w-20 text-right text-[#0B234A]/72 dark:text-sky-200/75">
                      {stat.planned > 0
                        ? `${formatDuration(stat.done)}/${formatDuration(stat.planned)}`
                        : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Weekly Productivity Summary + Past Weeks Modal Trigger */}
        <section className="ios-glass flex flex-col justify-between gap-3 rounded-[34px] p-5 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
              <h2 className="text-sm font-semibold text-[#07142B] dark:text-white">
                Weekly Productivity Summary
              </h2>
            </div>
            {weekTrendDelta !== null && (
              <span
                className={`tabular-nums rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                  weekTrendDelta >= 0
                    ? 'bg-emerald-500/18 text-emerald-700 dark:text-emerald-300'
                    : 'bg-orange-500/18 text-orange-700 dark:text-orange-300'
                }`}
              >
                {weekTrendDelta >= 0 ? `+${weekTrendDelta}%` : `${weekTrendDelta}%`} vs last wk
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="ios-glass-tile rounded-[22px] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#0B234A]/60 dark:text-sky-200/70">
                Top Subject
              </p>
              <p className={`mt-1 text-sm font-bold ${SUBJECT_META[currentWeekTelemetry.topSubject].text}`}>
                {SUBJECT_META[currentWeekTelemetry.topSubject].name}
              </p>
              <p className="tabular-nums text-[10.5px] text-[#0B234A]/65 dark:text-sky-200/70">
                {formatDuration(currentWeekTelemetry.perSubject[currentWeekTelemetry.topSubject].planned)} this week
              </p>
            </div>

            <div className="ios-glass-tile rounded-[22px] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#0B234A]/60 dark:text-sky-200/70">
                Today Progress
              </p>
              <p className="tabular-nums mt-1 text-sm font-bold text-[#07142B] dark:text-white">
                {todayCompletedIds.length}/{todaySlots.length} slots
              </p>
              <p className="tabular-nums text-[10.5px] text-[#0B234A]/65 dark:text-sky-200/70">
                {todayRemainingSlots.length} left today
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenMissedPage?.();
              }}
              className="ios-glass-tile rounded-[22px] p-3 text-left transition-transform duration-100 active:scale-[0.98]"
            >
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-300">
                <PlaySquare className="h-3 w-3" />
                <span>Missed Backlog</span>
              </p>
              <p className="tabular-nums mt-1 text-sm font-bold text-[#07142B] dark:text-white">
                {pendingMissedCount} pending
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenPapers?.();
              }}
              className="ios-glass-tile rounded-[22px] p-3 text-left transition-transform duration-100 active:scale-[0.98]"
            >
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                <FileBarChart2 className="h-3 w-3" />
                <span>Paper Reviews</span>
              </p>
              <p className="tabular-nums mt-1 text-sm font-bold text-[#07142B] dark:text-white">
                {unreviewedPapersCount > 0
                  ? `${unreviewedPapersCount} to review`
                  : latestPaperAvg !== null
                    ? `${latestPaperAvg}% avg`
                    : 'All clear'}
              </p>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.tick();
              setHistoryOpen(true);
            }}
            className="ios-glass-control flex min-h-[38px] items-center justify-between rounded-full px-4 text-xs font-semibold text-blue-700 transition-transform duration-100 active:scale-[0.98] dark:text-cyan-300"
          >
            <span className="inline-flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              <span>Past Weeks Completion History ({pastWeeks.length})</span>
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </section>
      </div>

      {/* All-Tiers Core Feature: Weekly Least Self-Study Auto-Suggest */}
      <section
        className={`mt-4 rounded-[30px] border p-4 sm:p-5 ${
          SUBJECT_GLASS_CARD[weeklySelfStudyFocus.recommendedSubject]
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#07142B] dark:text-white">
                <Compass className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
                <span>Next Self-Study Focus</span>
              </span>
              <span className="rounded-full bg-emerald-500/18 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                All Tiers
              </span>
              <span className="tabular-nums text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                {weeklySelfStudyFocus.selfStudyRankings
                  .map(
                    (r) =>
                      `${SUBJECT_META[r.subject].short} ${r.selfStudyMins > 0 ? formatDuration(r.selfStudyMins) : '0m'}`,
                  )
                  .join(' · ')}
              </span>
            </div>

            <p className="mt-1.5 text-sm font-bold text-[#07142B] dark:text-white">
              <span className={SUBJECT_META[weeklySelfStudyFocus.recommendedSubject].text}>
                {SUBJECT_META[weeklySelfStudyFocus.recommendedSubject].name}
              </span>
              {' · '}
              {weeklySelfStudyFocus.primaryTask.title}
            </p>
            <p className="mt-0.5 text-[11.5px] text-[#0B234A]/75 dark:text-sky-100/80">
              {weeklySelfStudyFocus.reason}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {onOpenWeeklyFocusSuggest && (
              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  onOpenWeeklyFocusSuggest();
                }}
                className="ios-glass-control min-h-[36px] rounded-full px-3 text-[11px] font-semibold text-[#07142B] transition-transform duration-100 active:scale-95 dark:text-sky-100"
              >
                Options
              </button>
            )}
            {onAcceptWeeklyFocusPlan && (
              <button
                type="button"
                onClick={() => {
                  haptics.success();
                  onAcceptWeeklyFocusPlan(
                    weeklySelfStudyFocus.primaryTask,
                    weeklySelfStudyFocus.primaryTask.durationMins,
                  );
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-blue-600 px-3.5 text-[11px] font-semibold text-white shadow-sm transition-transform duration-100 active:scale-95 dark:bg-blue-500"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                <span>Schedule ({formatDuration(weeklySelfStudyFocus.primaryTask.durationMins)})</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Ability #4: Subject Balance & Burnout Radar */}
      <section className="ios-glass mt-3 rounded-[28px] px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#07142B] dark:text-white">
            <Activity className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
            <span>Subject Balance &amp; Burnout Radar</span>
          </span>
          {balanceRadarActive ? (
            <span className="text-[11px] font-semibold text-[#0B234A]/80 dark:text-sky-100/85">
              Bio {currentWeekTelemetry.shares.biology}% · Phy {currentWeekTelemetry.shares.physics}% · Chem{' '}
              {currentWeekTelemetry.shares.chemistry}% · Lightest:{' '}
              <strong className={SUBJECT_META[currentWeekTelemetry.weakestSubject].text}>
                {SUBJECT_META[currentWeekTelemetry.weakestSubject].name}
              </strong>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                haptics.tick();
                onOpenAbilities();
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
            >
              <Sparkles className="h-3 w-3" />
              <span>Unlock at Gold Strategist →</span>
            </button>
          )}
        </div>
      </section>

      {/* Row 2: Live Session Spotlight & Upcoming Classes */}
      <section className="ios-glass mt-4 rounded-[34px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
            <h2 className="text-sm font-semibold text-[#07142B] dark:text-white">
              Upcoming Classes &amp; Live Session
            </h2>
          </div>
          <button
            type="button"
            onClick={onGoToTimetable}
            className="text-xs font-semibold text-blue-700 hover:underline dark:text-cyan-300"
          >
            Timetable →
          </button>
        </div>

        {todaySpotlight && (
          <div
            className={`relative mt-3 overflow-hidden rounded-[26px] border px-4 py-3.5 ${
              SUBJECT_GLASS_CARD[todaySpotlight.slot.subject]
            }`}
          >
            {justCompletedId === todaySpotlight.slot.id && (
              <span
                aria-hidden="true"
                className="animate-crystal-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-cyan-200/35"
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className={`font-bold ${SUBJECT_META[todaySpotlight.slot.subject].text}`}>
                    {SUBJECT_META[todaySpotlight.slot.subject].name}
                  </span>
                  <span className="opacity-45">·</span>
                  <span className="font-semibold text-blue-700 dark:text-cyan-300">
                    {todaySpotlight.kind === 'live'
                      ? `Happening Now · ${formatDuration(todaySpotlight.minsRemaining)} left`
                      : `Up Next in ${formatDuration(todaySpotlight.minsRemaining)}`}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-base font-bold text-[#07142B] dark:text-white">
                  {todaySpotlight.slot.title}
                </p>
                <p className="truncate text-xs text-[#0B234A]/75 dark:text-sky-100/80">
                  {todaySpotlight.slot.subtitle} · {formatTime12h(todaySpotlight.slot.startTime)} –{' '}
                  {formatTime12h(todaySpotlight.slot.endTime)}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  triggerCompleteToggle(
                    todayISO,
                    todaySpotlight.slot.id,
                    todayCompletedIds.includes(todaySpotlight.slot.id),
                    todaySpotlight.slot.category,
                  )
                }
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-transform duration-100 active:scale-95 ${
                  todayCompletedIds.includes(todaySpotlight.slot.id)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white dark:bg-blue-500'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                <span>{todayCompletedIds.includes(todaySpotlight.slot.id) ? 'Done' : 'Complete'}</span>
              </button>
            </div>

            {todaySpotlight.kind === 'live' && (
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-blue-950/12 dark:bg-white/15">
                <div
                  style={{ width: `${todaySpotlight.elapsedPct}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-3 space-y-2">
          {upcomingClasses.length === 0 ? (
            <div className="ios-glass-control flex items-center justify-between gap-3 rounded-[22px] px-4 py-3 text-xs">
              <span className="text-[#0B234A]/72 dark:text-sky-200/75">
                No remaining classes scheduled for today or tomorrow.
              </span>
              <button
                type="button"
                onClick={() => openQuickAdd('slot')}
                className="font-semibold text-blue-700 dark:text-cyan-300"
              >
                + Add Slot
              </button>
            </div>
          ) : (
            upcomingClasses.map((item) => {
              const meta = SUBJECT_META[item.slot.subject];
              const checkStyle = SUBJECT_CHECK_STYLE[item.slot.subject];
              return (
                <div
                  key={`${item.dateISO}-${item.slot.id}`}
                  className={`relative flex items-center justify-between gap-3 overflow-hidden rounded-[24px] border px-3.5 py-2.5 ${
                    SUBJECT_GLASS_CARD[item.slot.subject]
                  } ${item.isDone ? 'opacity-70' : 'opacity-100'}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        triggerCompleteToggle(
                          item.dateISO,
                          item.slot.id,
                          item.isDone,
                          item.slot.category,
                        )
                      }
                      aria-label={`Mark ${item.slot.title} complete`}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        item.isDone ? checkStyle.checked : checkStyle.unchecked
                      }`}
                    >
                      {item.isDone && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </button>

                    <div className="min-w-0">
                      <p
                        className={`truncate text-xs font-bold text-[#07142B] dark:text-white ${
                          item.isDone ? 'line-through opacity-75' : ''
                        }`}
                      >
                        {item.slot.title}
                      </p>
                      <p className="truncate text-[11px] text-[#0B234A]/72 dark:text-sky-100/75">
                        <span className={`font-semibold ${meta.text}`}>{meta.short}</span> · {item.dayLabel}{' '}
                        · {item.slot.mode === 'physical' ? 'Physical (2h transit open)' : 'Online'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right tabular-nums">
                    <p className="text-xs font-semibold text-[#07142B] dark:text-white">
                      {formatTime12h(item.slot.startTime)}
                    </p>
                    <p className="text-[10.5px] text-[#0B234A]/65 dark:text-sky-200/70">
                      {formatDuration(getDurationMinutes(item.slot.startTime, item.slot.endTime))}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Row 3: Today's Remaining Tasks & Upcoming Deadlines */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="ios-glass flex flex-col justify-between rounded-[34px] p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-semibold text-[#07142B] dark:text-white">
                  Today&apos;s Remaining Tasks
                </h2>
              </div>
              <span className="tabular-nums rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-sky-400/20 dark:text-cyan-300">
                {todayRemainingSlots.length + activeTasksSorted.slice(0, 4).length} left
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {todayRemainingSlots.length === 0 && activeTasksSorted.length === 0 ? (
                <div className="ios-glass-control rounded-[22px] px-4 py-5 text-center text-xs text-[#0B234A]/72 dark:text-sky-200/75">
                  All scheduled blocks and tasks for today are checked off.
                </div>
              ) : (
                <>
                  {todayRemainingSlots.slice(0, 5).map((slot) => {
                    const meta = SUBJECT_META[slot.subject];
                    const checkStyle = SUBJECT_CHECK_STYLE[slot.subject];
                    const isInc = todayIncompleteIds.includes(slot.id);
                    return (
                      <div
                        key={`rem-slot-${slot.id}`}
                        className={`flex items-center justify-between gap-2.5 rounded-[22px] border px-3.5 py-2.5 ${
                          SUBJECT_GLASS_CARD[slot.subject]
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            triggerCompleteToggle(todayISO, slot.id, false, slot.category)
                          }
                          aria-label={`Complete ${slot.title}`}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors active:scale-90 ${checkStyle.unchecked}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[#07142B] dark:text-white">
                            {slot.title}
                          </p>
                          <p className="truncate text-[10.5px] text-[#0B234A]/72 dark:text-sky-100/75">
                            <span className={`font-bold ${meta.text}`}>{meta.short}</span> ·{' '}
                            {formatTime12h(slot.startTime)}
                            {isInc && ` · Split (${formatDuration(todayLoggedBySlot[slot.id] ?? 0)})`}
                          </p>
                        </div>
                        {rewardPop?.id === slot.id && (
                          <span className="animate-sheet-in rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                            {rewardPop.text}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openPartialDialog(slot)}
                          title="Log partial minutes"
                          className="ios-glass-control inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#0B234A]/75 dark:text-sky-200"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}

                  {activeTasksSorted.slice(0, 4).map((task) => {
                    const meta = SUBJECT_META[task.subject];
                    const checkStyle = SUBJECT_CHECK_STYLE[task.subject];
                    const dueRel = formatDeadlineRelative(task.deadlineISO, todayISO);
                    return (
                      <div
                        key={`rem-task-${task.id}`}
                        className="ios-glass-tile flex items-center justify-between gap-2.5 rounded-[22px] px-3.5 py-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            haptics.success();
                            showRewardPop(task.id, XP_VALUES.taskComplete);
                            onToggleTaskComplete?.(task.id);
                          }}
                          aria-label={`Mark task ${task.title} complete`}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors active:scale-90 ${checkStyle.unchecked}`}
                        />
                        <button
                          type="button"
                          onClick={() => onOpenPlannerForTask?.(task.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-xs font-semibold text-[#07142B] dark:text-white">
                            {task.title}
                          </p>
                          <p className="truncate text-[10.5px] text-[#0B234A]/70 dark:text-sky-200/75">
                            <span className={`font-bold ${meta.text}`}>{meta.short}</span> ·{' '}
                            {task.kind === 'paper-review' ? 'Paper Review' : 'Planner Task'}
                            {dueRel ? ` · ${dueRel}` : ''}
                          </p>
                        </button>
                        {rewardPop?.id === task.id ? (
                          <span className="animate-sheet-in shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                            {rewardPop.text}
                          </span>
                        ) : (
                          <span className="tabular-nums shrink-0 text-[10.5px] font-semibold text-[#0B234A]/68 dark:text-sky-200/75">
                            {formatDuration(task.defaultSessionMins)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/30 pt-3 text-xs dark:border-sky-300/15">
            <button
              type="button"
              onClick={() => onOpenPlanner?.()}
              className="font-semibold text-blue-700 hover:underline dark:text-cyan-300"
            >
              Open Planner →
            </button>
            <button
              type="button"
              onClick={() => openQuickAdd('task')}
              className="inline-flex items-center gap-1 font-semibold text-[#0B234A]/75 dark:text-sky-200"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Task</span>
            </button>
          </div>
        </section>

        {/* Upcoming Deadlines */}
        <section className="ios-glass flex flex-col justify-between rounded-[34px] p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-[#07142B] dark:text-white">
                  Upcoming Deadlines
                </h2>
              </div>
              <span className="tabular-nums rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[11px] font-bold text-orange-700 dark:text-orange-300">
                {upcomingDeadlines.length} active
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {upcomingDeadlines.length === 0 ? (
                <div className="ios-glass-control rounded-[22px] px-4 py-5 text-center text-xs text-[#0B234A]/72 dark:text-sky-200/75">
                  No deadlines queued. Add a due date in Quick Add, Planner, or Missed.
                </div>
              ) : (
                upcomingDeadlines.slice(0, 6).map((dl) => {
                  const meta = SUBJECT_META[dl.subject];
                  const checkStyle = SUBJECT_CHECK_STYLE[dl.subject];
                  return (
                    <div
                      key={`dl-${dl.kind}-${dl.id}`}
                      className="ios-glass-tile flex items-center justify-between gap-2.5 rounded-[22px] px-3.5 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          haptics.success();
                          showRewardPop(
                            dl.id,
                            dl.kind === 'missed' ? XP_VALUES.missedCovered : XP_VALUES.taskComplete,
                          );
                          if (dl.kind === 'missed') onToggleMissedCovered?.(dl.id);
                          else onToggleTaskComplete?.(dl.id);
                        }}
                        aria-label={`Mark deadline ${dl.title} done`}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors active:scale-90 ${checkStyle.unchecked}`}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (dl.kind === 'missed') onOpenMissedPage?.();
                          else onOpenPlannerForTask?.(dl.id);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-xs font-semibold text-[#07142B] dark:text-white">
                          {dl.title}
                        </p>
                        <p className="truncate text-[10.5px] text-[#0B234A]/70 dark:text-sky-200/75">
                          <span className={`font-bold ${meta.text}`}>{meta.short}</span> · {dl.badgeLabel}
                        </p>
                      </button>

                      <span
                        className={`tabular-nums shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                          dl.isOverdue
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                            : dl.isDueToday
                              ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
                              : 'bg-blue-500/15 text-blue-700 dark:bg-sky-400/20 dark:text-cyan-200'
                        }`}
                      >
                        {dl.relativeLabel}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/30 pt-3 text-xs dark:border-sky-300/15">
            <button
              type="button"
              onClick={() => onOpenMissedPage?.()}
              className="font-semibold text-orange-700 hover:underline dark:text-orange-300"
            >
              View Missed Queue →
            </button>
            <button
              type="button"
              onClick={() => openQuickAdd('missed')}
              className="inline-flex items-center gap-1 font-semibold text-[#0B234A]/75 dark:text-sky-200"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Missed</span>
            </button>
          </div>
        </section>
      </div>

      {/* Compact Past Weeks History Modal */}
      <CrystalSheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        maxWidthClass="max-w-lg"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-blue-700 dark:text-cyan-300">
              Weekly Progress Archive
            </p>
            <h2 className="text-lg font-semibold text-[#07142B] dark:text-white">
              Past Weeks History
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            aria-label="Close history modal"
            className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] dark:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {pastWeeks.length === 0 ? (
          <div className="ios-glass-control mt-4 rounded-[24px] px-5 py-8 text-center text-xs text-[#0B234A]/75 dark:text-sky-200/75">
            No past weeks recorded yet. Completed sessions roll into weekly stats every Monday.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="ios-glass-control grid grid-cols-4 gap-3 rounded-[24px] p-4">
              {[...pastWeeks]
                .slice(0, 4)
                .reverse()
                .map((wk) => (
                  <div key={wk.weekStartISO} className="flex flex-col items-center gap-1.5">
                    <span className="tabular-nums text-xs font-bold text-[#07142B] dark:text-white">
                      {wk.completionPercent}%
                    </span>
                    <div className="flex h-24 w-full items-end rounded-[16px] bg-blue-500/15 p-1 dark:bg-sky-400/18">
                      <div
                        className="w-full rounded-[12px] bg-gradient-to-t from-blue-600 to-cyan-400"
                        style={{ height: `${Math.max(8, wk.completionPercent)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[#0B234A]/70 dark:text-sky-200/75">
                      {wk.range.split('–')[0].trim()}
                    </span>
                  </div>
                ))}
            </div>

            <div className="space-y-2">
              {pastWeeks.map((wk) => (
                <div
                  key={wk.weekStartISO}
                  className="ios-glass-control flex items-center justify-between gap-3 rounded-[22px] px-4 py-3"
                >
                  <div>
                    <p className="text-xs font-bold text-[#07142B] dark:text-white">
                      {wk.label} · {wk.range}
                    </p>
                    <p className="tabular-nums text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                      {wk.tasksDone}/{wk.tasksTotal} tasks · {wk.hoursCompleted}h / {wk.hoursPlanned}h
                    </p>
                  </div>
                  <span className="tabular-nums text-lg font-bold text-blue-700 dark:text-cyan-300">
                    {wk.completionPercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CrystalSheet>

      {/* Quick-Add Sheet */}
      <CrystalSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} maxWidthClass="max-w-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[#0B234A]/70 dark:text-sky-200/75">Fast Capture from Home</p>
            <h2 className="text-lg font-semibold text-[#07142B] dark:text-white">Quick Add</h2>
          </div>
          <button
            type="button"
            onClick={() => setQuickAddOpen(false)}
            aria-label="Close Quick Add"
            className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] dark:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="ios-glass-control mt-3.5 grid grid-cols-3 gap-1 rounded-full p-1">
          {(
            [
              { id: 'task', label: 'Task' },
              { id: 'slot', label: 'Study Slot' },
              { id: 'missed', label: 'Missed' },
            ] as { id: QuickAddKind; label: string }[]
          ).map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                haptics.tick();
                setQuickKind(k.id);
              }}
              className={`min-h-[34px] rounded-full text-xs font-semibold transition-colors ${
                quickKind === k.id
                  ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                  : 'text-[#0B234A]/75 dark:text-sky-200/80'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="ios-glass-control mt-3 grid grid-cols-3 gap-1 rounded-full p-1">
          {(['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
            const meta = SUBJECT_META[subj];
            return (
              <button
                key={subj}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setQaSubject(subj);
                }}
                className={`min-h-[34px] rounded-full text-xs font-semibold transition-colors ${
                  qaSubject === subj ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500' : meta.text
                }`}
              >
                {meta.name}
              </button>
            );
          })}
        </div>

        <div className="mt-3 space-y-3">
          <input
            type="text"
            value={qaTitle}
            onChange={(e) => setQaTitle(e.target.value)}
            placeholder={
              quickKind === 'task'
                ? 'Task title (e.g., 2022 MCQ Mistakes)'
                : quickKind === 'slot'
                  ? 'Session focus (e.g., Unit 05 Past Paper)'
                  : 'Missed lesson / homework title'
            }
            className="ios-glass-control w-full rounded-[22px] px-4 py-3 text-sm text-[#07142B] placeholder:text-[#0B234A]/45 focus:outline-none dark:text-white dark:placeholder:text-sky-200/45"
          />

          {quickKind === 'slot' ? (
            <>
              <div className="ios-glass-control grid grid-cols-2 gap-1 rounded-full p-1">
                {(
                  [
                    { id: 'self-study', label: 'Self-Study' },
                    { id: 'class', label: 'One-Off Class' },
                  ] as { id: SlotCategory; label: string }[]
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setQaSlotCat(c.id)}
                    className={`min-h-[32px] rounded-full text-xs font-semibold ${
                      qaSlotCat === c.id
                        ? 'bg-blue-600 text-white'
                        : 'text-[#0B234A]/75 dark:text-sky-200/80'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="ios-glass-control flex items-center justify-between gap-2 rounded-full px-4 py-2.5">
                <span className="text-xs font-semibold text-[#07142B] dark:text-white">Date</span>
                <input
                  type="date"
                  value={qaSlotDate}
                  onChange={(e) => setQaSlotDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-blue-700 focus:outline-none dark:text-cyan-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setQaClockTarget('start')}
                  className="ios-glass-control tabular-nums flex min-h-[42px] items-center justify-between rounded-full px-3.5 text-xs font-semibold text-[#07142B] dark:text-white"
                >
                  <span>Start: {formatTime12h(qaStart)}</span>
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
                </button>
                <button
                  type="button"
                  onClick={() => setQaClockTarget('end')}
                  className="ios-glass-control tabular-nums flex min-h-[42px] items-center justify-between rounded-full px-3.5 text-xs font-semibold text-[#07142B] dark:text-white"
                >
                  <span>End: {formatTime12h(qaEnd)}</span>
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
                </button>
              </div>

              {qaInvalidRange && (
                <p className="text-xs font-medium text-orange-600 dark:text-orange-300">
                  End time must be after start time.
                </p>
              )}

              <div className="ios-glass-control flex items-center justify-between rounded-full px-4 py-2.5">
                <span className="text-xs font-medium text-[#07142B] dark:text-white">
                  Auto-Lock Phone
                </span>
                <LiquidSwitch
                  checked={qaAutoBlock}
                  onToggle={() => setQaAutoBlock((v) => !v)}
                  ariaLabel="Toggle Quick Add Auto Lock"
                  activeColorClass="bg-emerald-500"
                />
              </div>
            </>
          ) : (
            <>
              {quickKind === 'missed' && (
                <div className="ios-glass-control grid grid-cols-2 gap-1 rounded-full p-1">
                  {(
                    [
                      { id: 'recording', label: 'Class Recording' },
                      { id: 'homework', label: 'Homework' },
                    ] as { id: MissedCategory; label: string }[]
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setQaMissedCat(c.id)}
                      className={`min-h-[32px] rounded-full text-xs font-semibold ${
                        qaMissedCat === c.id
                          ? 'bg-orange-500 text-white'
                          : 'text-[#0B234A]/75 dark:text-sky-200/80'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="ios-glass-control flex items-center justify-between gap-2 rounded-full px-3.5 py-2">
                  <span className="text-[11px] font-semibold text-[#0B234A]/75 dark:text-sky-200/80">
                    Due
                  </span>
                  <input
                    type="date"
                    value={qaDeadline}
                    onChange={(e) => setQaDeadline(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-blue-700 focus:outline-none dark:text-cyan-300"
                  />
                </div>

                <div className="ios-glass-control flex items-center justify-between gap-2 rounded-full px-3.5 py-2">
                  <span className="text-[11px] font-semibold text-[#0B234A]/75 dark:text-sky-200/80">
                    Mins
                  </span>
                  <select
                    value={qaEstMins}
                    onChange={(e) => setQaEstMins(Number(e.target.value))}
                    className="bg-transparent text-xs font-semibold text-[#07142B] focus:outline-none dark:text-white"
                  >
                    {SUGGEST_SESSION_CHIPS.map((m) => (
                      <option
                        key={m}
                        value={m}
                        className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white"
                      >
                        {formatDuration(m)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ios-glass-control grid grid-cols-4 gap-1 rounded-full p-1">
                {(['low', 'medium', 'high', 'urgent'] as TaskImportance[]).map((imp) => (
                  <button
                    key={imp}
                    type="button"
                    onClick={() => setQaImportance(imp)}
                    className={`min-h-[30px] rounded-full text-[11px] font-semibold capitalize ${
                      qaImportance === imp
                        ? imp === 'urgent'
                          ? 'bg-rose-600 text-white'
                          : imp === 'high'
                            ? 'bg-orange-500 text-white'
                            : 'bg-blue-600 text-white'
                        : 'text-[#0B234A]/75 dark:text-sky-200/80'
                    }`}
                  >
                    {imp}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          {onOpenPapers && (
            <button
              type="button"
              onClick={() => {
                setQuickAddOpen(false);
                onOpenPapers();
              }}
              className="ios-glass-control min-h-[44px] rounded-full px-4 text-xs font-semibold text-violet-700 dark:text-violet-300"
            >
              Log Paper →
            </button>
          )}
          <button
            type="button"
            disabled={!qaTitle.trim() || (quickKind === 'slot' && qaInvalidRange)}
            onClick={handleSubmitQuickAdd}
            className="min-h-[44px] flex-1 rounded-full bg-blue-600 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-[0.98] disabled:opacity-45 dark:bg-blue-500"
          >
            Save {quickKind === 'task' ? 'Task' : quickKind === 'slot' ? 'Study Slot' : 'Missed Item'}
          </button>
        </div>
      </CrystalSheet>

      <GlassTimePicker
        open={qaClockTarget !== null}
        label={qaClockTarget === 'start' ? 'Slot Start Time' : 'Slot End Time'}
        value={qaClockTarget === 'start' ? qaStart : qaEnd}
        onChange={(val) => {
          if (qaClockTarget === 'start') setQaStart(val);
          else setQaEnd(val);
        }}
        onClose={() => setQaClockTarget(null)}
      />

      {/* Partial Completion Sheet */}
      <CrystalSheet
        open={partialModalSlot !== null}
        onClose={() => setPartialModalSlot(null)}
        maxWidthClass="max-w-md"
      >
        {partialModalSlot && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                  Log Completed Minutes (No Penalty)
                </p>
                <h3 className="mt-0.5 text-lg font-semibold">{partialModalSlot.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPartialModalSlot(null)}
                aria-label="Close incomplete sheet"
                className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
              <input
                type="range"
                min={0}
                max={getDurationMinutes(partialModalSlot.startTime, partialModalSlot.endTime)}
                step={5}
                value={partialMinsInput}
                onChange={(e) => setPartialMinsInput(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <span className="tabular-nums min-w-[54px] text-right text-sm font-bold">
                {formatDuration(partialMinsInput)}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setPartialModalSlot(null)}
                className="ios-glass-control min-h-[46px] rounded-full px-5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  onMarkSlotIncomplete(todayISO, partialModalSlot.id, partialMinsInput);
                  const linkedId = partialModalSlot.linkedTaskId;
                  setPartialModalSlot(null);
                  if (linkedId && onOpenPlannerForTask) {
                    onOpenPlannerForTask(linkedId);
                  }
                }}
                className="min-h-[46px] flex-1 rounded-full bg-blue-600 text-xs font-semibold text-white shadow-lg dark:bg-blue-500"
              >
                Save Progress
              </button>
            </div>
          </>
        )}
      </CrystalSheet>
    </div>
  );
});
