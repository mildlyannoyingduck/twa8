import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarPlus,
  Check,
  FileText,
  GripVertical,
  Lock,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  DAYS_ORDER,
  IMPORTANCE_META,
  SUBJECT_GLASS_CARD,
  SUBJECT_META,
  SYLLABUS_UNITS,
  findSyllabusUnit,
} from '../data/previewData';
import {
  DayCompletionLog,
  FridayAnchor,
  FridayWeekMode,
  FridayWeekOverrides,
  MissedLessonItem,
  SlotSuggestion,
  StudyChecklistItem,
  StudyTask,
  SubjectId,
  SyllabusUnit,
  TaskImportance,
  TimetableSlot,
} from '../types';
import { addDaysISO, formatDeadlineRelative, formatShortDateISO, getTodayISO } from '../utils/dateUtils';
import { haptics } from '../utils/haptics';
import { formatDuration, formatTime12h, getDurationMinutes } from '../utils/timeUtils';
import { CrystalSheet, LiquidSwitch } from './FluidControls';
import { SmartSlotPickerPayload } from './SmartSlotPickerSheet';

interface PlannerViewProps {
  tasks: StudyTask[];
  missedItems: MissedLessonItem[];
  slots: TimetableSlot[];
  dailyLogs: Record<string, DayCompletionLog>;
  fridayWeekMode?: FridayWeekMode;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  unitCoveredMap: Record<string, boolean>;
  focusedTaskId: string | null;
  onClearFocusedTask: () => void;
  onAddTask: (task: StudyTask) => void;
  onUpdateTask: (task: StudyTask) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTasks: (orderedIds: string[]) => void;
  onApproveSuggestedSlot: (task: StudyTask, suggestion: SlotSuggestion) => void;
  onRequestSlotPicker: (
    payload: SmartSlotPickerPayload,
    onConfirm: (suggestion: SlotSuggestion) => void,
  ) => void;
  onToggleLinkedSlotComplete: (slot: TimetableSlot) => void;
  onMarkLinkedSlotIncomplete: (slot: TimetableSlot, partialMinutes: number) => void;
  onDeleteLinkedSlot: (slotId: string) => void;
  onToggleUnitCovered: (unitId: string) => void;
  onOpenWeeklyFocusSuggest: () => void;
}

type PlannerMode = 'queue' | 'units';
type TaskFilterTab = 'active' | 'needs-slot' | 'completed';

const SUBJECT_ACTIVE_RING: Record<SubjectId, string> = {
  biology: 'ring-2 ring-emerald-400/80 dark:ring-emerald-300/75',
  physics: 'ring-2 ring-orange-400/80 dark:ring-orange-300/75',
  chemistry: 'ring-2 ring-blue-500/80 dark:ring-cyan-300/75',
};

const SUBJECT_COMPLETE_RING: Record<SubjectId, { checked: string; unchecked: string }> = {
  biology: {
    checked: 'border-emerald-500 bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]',
    unchecked: 'border-emerald-600/55 bg-emerald-500/10 text-transparent dark:border-emerald-400/55',
  },
  physics: {
    checked: 'border-orange-500 bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]',
    unchecked: 'border-orange-600/55 bg-orange-500/10 text-transparent dark:border-orange-400/55',
  },
  chemistry: {
    checked: 'border-violet-500 bg-violet-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.4)]',
    unchecked: 'border-violet-600/55 bg-violet-500/10 text-transparent dark:border-violet-400/55',
  },
};

const SESSION_DURATION_CHIPS = [30, 45, 60, 90, 120];
const IMPORTANCE_ORDER: Record<TaskImportance, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface TaskComputedStats {
  linkedSlots: TimetableSlot[];
  completedCount: number;
  incompleteCount: number;
  upcomingCount: number;
  nextUpcomingSlot: TimetableSlot | null;
  loggedMinutes: number;
  scheduledMinutes: number;
  needsFollowUpSlot: boolean;
}

function computeTaskStats(
  task: StudyTask,
  slots: TimetableSlot[],
  dailyLogs: Record<string, DayCompletionLog>,
): TaskComputedStats {
  const linkedSlots = slots.filter((s) => s.linkedTaskId === task.id);

  const slotLoggedMap: Record<string, number> = {};
  const completedSlotSet = new Set<string>();
  const incompleteSlotSet = new Set<string>();

  for (const log of Object.values(dailyLogs)) {
    for (const sid of log.completedSlotIds) {
      const slot = linkedSlots.find((s) => s.id === sid);
      if (slot) {
        completedSlotSet.add(sid);
        const dur = getDurationMinutes(slot.startTime, slot.endTime);
        slotLoggedMap[sid] = (slotLoggedMap[sid] ?? 0) + dur;
      }
    }
    for (const sid of log.incompleteSlotIds ?? []) {
      const slot = linkedSlots.find((s) => s.id === sid);
      if (slot && !completedSlotSet.has(sid)) {
        incompleteSlotSet.add(sid);
        const partial = log.loggedMinutesBySlot?.[sid] ?? 0;
        slotLoggedMap[sid] = Math.max(slotLoggedMap[sid] ?? 0, partial);
      }
    }
  }

  let loggedMinutes = 0;
  let scheduledMinutes = 0;
  let completedCount = 0;
  let incompleteCount = 0;
  let upcomingCount = 0;
  const upcomingSlots: TimetableSlot[] = [];

  for (const slot of linkedSlots) {
    const dur = getDurationMinutes(slot.startTime, slot.endTime);
    if (completedSlotSet.has(slot.id)) {
      completedCount += 1;
      loggedMinutes += slotLoggedMap[slot.id] ?? dur;
    } else if (incompleteSlotSet.has(slot.id)) {
      incompleteCount += 1;
      loggedMinutes += slotLoggedMap[slot.id] ?? 0;
    } else {
      upcomingCount += 1;
      scheduledMinutes += dur;
      upcomingSlots.push(slot);
    }
  }

  upcomingSlots.sort((a, b) => {
    const dayDiff = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
    return dayDiff !== 0 ? dayDiff : a.startTime.localeCompare(b.startTime);
  });

  const needsFollowUpSlot = task.status === 'active' && upcomingCount === 0;

  return {
    linkedSlots,
    completedCount,
    incompleteCount,
    upcomingCount,
    nextUpcomingSlot: upcomingSlots[0] ?? null,
    loggedMinutes,
    scheduledMinutes,
    needsFollowUpSlot,
  };
}

export const PlannerView = memo(function PlannerView({
  tasks,
  missedItems,
  slots,
  dailyLogs,
  unitCoveredMap,
  focusedTaskId,
  onClearFocusedTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTasks,
  onApproveSuggestedSlot,
  onRequestSlotPicker,
  onToggleLinkedSlotComplete,
  onMarkLinkedSlotIncomplete,
  onDeleteLinkedSlot,
  onToggleUnitCovered,
  onOpenWeeklyFocusSuggest,
}: PlannerViewProps) {
  const todayISO = getTodayISO();

  const [plannerMode, setPlannerMode] = useState<PlannerMode>('queue');
  const [unitsSubject, setUnitsSubject] = useState<SubjectId>('biology');

  const [filterTab, setFilterTab] = useState<TaskFilterTab>('active');
  const [subjectFilter, setSubjectFilter] = useState<'all' | SubjectId>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState<SubjectId>('physics');
  const [newUnitId, setNewUnitId] = useState<string>('');
  const [newImportance, setNewImportance] = useState<TaskImportance>('medium');
  const [newDeadlineISO, setNewDeadlineISO] = useState<string>('');
  const [newSessionMins, setNewSessionMins] = useState(90);
  const [newTargetHours, setNewTargetHours] = useState('');
  const [newChecklistDraft, setNewChecklistDraft] = useState('');
  const [newChecklistItems, setNewChecklistItems] = useState<StudyChecklistItem[]>([]);
  const [newNotes, setNewNotes] = useState('');
  const [newAutoBlock, setNewAutoBlock] = useState(true);

  const [inspectTaskId, setInspectTaskId] = useState<string | null>(null);
  const [detailChecklistInput, setDetailChecklistInput] = useState('');
  const [partialSlotTarget, setPartialSlotTarget] = useState<TimetableSlot | null>(null);
  const [partialMinsDraft, setPartialMinsDraft] = useState<number>(30);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (focusedTaskId) {
      setPlannerMode('queue');
      setInspectTaskId(focusedTaskId);
      onClearFocusedTask();
    }
  }, [focusedTaskId, onClearFocusedTask]);

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        const impA = IMPORTANCE_ORDER[a.importance ?? 'medium'];
        const impB = IMPORTANCE_ORDER[b.importance ?? 'medium'];
        return impA - impB;
      }),
    [tasks],
  );

  const statsById = useMemo(() => {
    const map: Record<string, TaskComputedStats> = {};
    for (const t of sortedTasks) {
      map[t.id] = computeTaskStats(t, slots, dailyLogs);
    }
    return map;
  }, [sortedTasks, slots, dailyLogs]);

  // Aggregate per-unit invested minutes + active tasks/missed count across tasks & missed lessons
  const unitStatsMap = useMemo(() => {
    const map: Record<
      string,
      { investedMins: number; scheduledMins: number; activeTasks: number; activeMissed: number }
    > = {};

    const ensure = (uid: string) => {
      if (!map[uid]) {
        map[uid] = { investedMins: 0, scheduledMins: 0, activeTasks: 0, activeMissed: 0 };
      }
      return map[uid];
    };

    for (const t of sortedTasks) {
      if (!t.unitId) continue;
      const entry = ensure(t.unitId);
      const st = statsById[t.id];
      if (st) {
        entry.investedMins += st.loggedMinutes;
        entry.scheduledMins += st.scheduledMinutes;
      }
      if (t.status === 'active') entry.activeTasks += 1;
    }

    for (const m of missedItems) {
      if (!m.unitId) continue;
      const entry = ensure(m.unitId);
      if (m.status === 'active') entry.activeMissed += 1;
    }

    return map;
  }, [sortedTasks, statsById, missedItems]);

  const totalInvestedMinutesAll = useMemo(
    () => Object.values(statsById).reduce((acc, st) => acc + st.loggedMinutes, 0),
    [statsById],
  );

  const totalScheduledMinutesAll = useMemo(
    () => Object.values(statsById).reduce((acc, st) => acc + st.scheduledMinutes, 0),
    [statsById],
  );

  const activeTasksCount = sortedTasks.filter((t) => t.status === 'active').length;
  const needsSlotCount = sortedTasks.filter(
    (t) => statsById[t.id]?.needsFollowUpSlot,
  ).length;
  const completedTasksCount = sortedTasks.filter((t) => t.status === 'completed').length;

  const subjectMomentum = useMemo(() => {
    const items = (['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
      const subTasks = sortedTasks.filter((t) => t.subject === subj);
      const activeCount = subTasks.filter((t) => t.status === 'active').length;
      const investedMins = subTasks.reduce(
        (acc, t) => acc + (statsById[t.id]?.loggedMinutes ?? 0),
        0,
      );
      const scheduledMins = subTasks.reduce(
        (acc, t) => acc + (statsById[t.id]?.scheduledMinutes ?? 0),
        0,
      );
      const totalUnits = SYLLABUS_UNITS[subj].length;
      const coveredUnits = SYLLABUS_UNITS[subj].filter((u) => unitCoveredMap[u.id]).length;
      return {
        subj,
        activeCount,
        investedMins,
        scheduledMins,
        coveredUnits,
        totalUnits,
        totalLoadMins: investedMins + scheduledMins,
      };
    });
    const maxLoad = Math.max(60, ...items.map((it) => it.totalLoadMins));
    return items.map((it) => ({
      ...it,
      barPct: Math.min(100, Math.round((it.totalLoadMins / maxLoad) * 100)),
    }));
  }, [sortedTasks, statsById, unitCoveredMap]);

  const visibleTasks = useMemo(() => {
    return sortedTasks.filter((t) => {
      if (subjectFilter !== 'all' && t.subject !== subjectFilter) return false;
      const st = statsById[t.id];
      if (filterTab === 'active') return t.status === 'active';
      if (filterTab === 'needs-slot') return Boolean(st?.needsFollowUpSlot);
      return t.status === 'completed';
    });
  }, [sortedTasks, statsById, filterTab, subjectFilter]);

  const inspectTask = sortedTasks.find((t) => t.id === inspectTaskId) ?? null;

  const openSuggesterForTask = (task: StudyTask, customDuration?: number) => {
    haptics.tap();
    onRequestSlotPicker(
      {
        title: task.title,
        subject: task.subject,
        durationMins: customDuration ?? task.defaultSessionMins,
        deadlineISO: task.deadlineISO,
        importance: task.importance ?? 'medium',
        autoBlockDefault: task.autoBlockDefault,
        badgeLabel: `${SUBJECT_META[task.subject].name} · Planner Slot`,
      },
      (sug) => onApproveSuggestedSlot(task, sug),
    );
  };

  const handleOpenCreate = (presetSubject?: SubjectId, presetUnitId?: string) => {
    haptics.tap();
    const subj = presetSubject ?? (subjectFilter === 'all' ? 'physics' : subjectFilter);
    const unitObj = findSyllabusUnit(presetUnitId);
    setNewTitle(unitObj ? `Cover ${unitObj.code}: ${unitObj.title}` : '');
    setNewSubject(subj);
    setNewUnitId(presetUnitId ?? '');
    setNewImportance('medium');
    setNewDeadlineISO('');
    setNewSessionMins(90);
    setNewTargetHours('');
    setNewChecklistDraft('');
    setNewChecklistItems([]);
    setNewNotes('');
    setNewAutoBlock(true);
    setCreateOpen(true);
  };

  const handleCoverUnitQuick = (unit: SyllabusUnit) => {
    const existingActive = sortedTasks.find(
      (t) => t.unitId === unit.id && t.status === 'active',
    );
    if (existingActive) {
      openSuggesterForTask(existingActive);
      return;
    }

    haptics.success();
    const created: StudyTask = {
      id: `task-unit-${Date.now()}`,
      title: `Cover ${unit.code}: ${unit.title}`,
      subject: unit.subject,
      unitId: unit.id,
      kind: 'task',
      defaultSessionMins: 90,
      importance: 'high',
      checklist: [
        { id: `chk-u1-${Date.now()}`, text: 'Review theory notes & key concepts', done: false },
        { id: `chk-u2-${Date.now() + 1}`, text: 'Practice past paper questions', done: false },
      ],
      notes: '',
      status: 'active',
      order: sortedTasks.length,
      createdAtISO: todayISO,
      autoBlockDefault: true,
    };
    onAddTask(created);
    openSuggesterForTask(created, 90);
  };

  const handleAddDraftChecklist = () => {
    const clean = newChecklistDraft.trim();
    if (!clean) return;
    haptics.tick();
    setNewChecklistItems((prev) => [
      ...prev,
      { id: `chk-${Date.now()}-${prev.length}`, text: clean, done: false },
    ]);
    setNewChecklistDraft('');
  };

  const handleCreateTask = (andSuggestImmediately: boolean) => {
    if (!newTitle.trim()) return;
    haptics.success();
    const targetHoursNum = Number(newTargetHours);
    const created: StudyTask = {
      id: `task-${Date.now()}`,
      title: newTitle.trim(),
      subject: newSubject,
      unitId: newUnitId || undefined,
      kind: 'task',
      defaultSessionMins: newSessionMins,
      targetMinutes:
        !isNaN(targetHoursNum) && targetHoursNum > 0
          ? Math.round(targetHoursNum * 60)
          : undefined,
      deadlineISO: newDeadlineISO || undefined,
      importance: newImportance,
      checklist: newChecklistItems,
      notes: newNotes.trim(),
      status: 'active',
      order: sortedTasks.length,
      createdAtISO: todayISO,
      autoBlockDefault: newAutoBlock,
    };
    onAddTask(created);
    setCreateOpen(false);
    setPlannerMode('queue');
    setFilterTab('active');
    if (andSuggestImmediately) {
      openSuggesterForTask(created, created.defaultSessionMins);
    }
  };

  const moveTaskPriority = (taskId: string, delta: -1 | 1) => {
    const idx = visibleTasks.findIndex((t) => t.id === taskId);
    const swapIdx = idx + delta;
    if (idx < 0 || swapIdx < 0 || swapIdx >= visibleTasks.length) return;
    haptics.tick();
    const fullIds = sortedTasks.map((t) => t.id);
    const aGlobal = fullIds.indexOf(visibleTasks[idx].id);
    const bGlobal = fullIds.indexOf(visibleTasks[swapIdx].id);
    const copy = [...fullIds];
    [copy[aGlobal], copy[bGlobal]] = [copy[bGlobal], copy[aGlobal]];
    onReorderTasks(copy);
  };

  const handleDragPointerMove = (clientY: number) => {
    if (!draggingId) return;
    const currentIdx = visibleTasks.findIndex((t) => t.id === draggingId);
    if (currentIdx < 0) return;

    for (let i = 0; i < visibleTasks.length; i++) {
      if (i === currentIdx) continue;
      const candidate = visibleTasks[i];
      const el = cardRefs.current[candidate.id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if ((i < currentIdx && clientY < midY) || (i > currentIdx && clientY > midY)) {
        haptics.tick();
        const fullIds = sortedTasks.map((t) => t.id);
        const aGlobal = fullIds.indexOf(draggingId);
        const bGlobal = fullIds.indexOf(candidate.id);
        const copy = [...fullIds];
        copy.splice(aGlobal, 1);
        copy.splice(bGlobal, 0, draggingId);
        onReorderTasks(copy);
        break;
      }
    }
  };

  const activeUnitsList = SYLLABUS_UNITS[unitsSubject];
  const coveredUnitsCount = activeUnitsList.filter((u) => unitCoveredMap[u.id]).length;
  const unitsPct = Math.round((coveredUnitsCount / activeUnitsList.length) * 100);

  return (
    <div
      className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pt-6"
      onPointerMove={(e) => {
        if (draggingId) handleDragPointerMove(e.clientY);
      }}
      onPointerUp={() => {
        if (draggingId) setDraggingId(null);
      }}
      onPointerCancel={() => {
        if (draggingId) setDraggingId(null);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#07142B] dark:text-white">
            Planner
          </h1>
          <p className="mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
            {plannerMode === 'queue'
              ? 'Study queue with syllabus units, deadlines, importance & smart gap fitting'
              : 'Cover all 35 A/L Biology, Physics & Chemistry units systematically'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="ios-glass grid grid-cols-2 items-center rounded-full p-1">
            {(
              [
                { id: 'queue', label: 'Queue' },
                { id: 'units', label: 'Units (35)' },
              ] as { id: PlannerMode; label: string }[]
            ).map((m) => {
              const active = plannerMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setPlannerMode(m.id);
                  }}
                  className={`min-h-[34px] rounded-full px-3.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/80'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onOpenWeeklyFocusSuggest();
            }}
            title="Auto-suggest least self-study focused subject & task for this week"
            className="ios-glass-control inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-blue-700 transition-transform duration-100 active:scale-95 dark:text-cyan-300 whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Auto-Suggest</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreate()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-95 dark:bg-blue-500 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Executive Subject Momentum Bento Deck */}
      <section className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <div className="ios-glass-strong flex flex-col justify-between rounded-[32px] p-5 lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700/80 dark:text-cyan-300/85">
                Cumulative Effort
              </p>
              <p className="tabular-nums mt-1 text-3xl font-bold tracking-tight text-[#07142B] dark:text-white">
                {formatDuration(totalInvestedMinutesAll)}
              </p>
              <p className="mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                Logged across active &amp; archived study tasks
              </p>
            </div>
            <div className="text-right tabular-nums">
              <p className="text-[11px] font-medium text-[#0B234A]/65 dark:text-sky-200/70">
                Upcoming
              </p>
              <p className="text-lg font-bold text-blue-700 dark:text-cyan-300">
                {formatDuration(totalScheduledMinutesAll)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/40 pt-3.5 text-center dark:border-sky-300/18">
            <div>
              <p className="tabular-nums text-lg font-bold text-[#07142B] dark:text-white">
                {activeTasksCount}
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">Active Queue</p>
            </div>
            <div>
              <p className="tabular-nums text-lg font-bold text-orange-600 dark:text-orange-300">
                {needsSlotCount}
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">Needs Slot</p>
            </div>
            <div>
              <p className="tabular-nums text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {completedTasksCount}
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">Completed</p>
            </div>
          </div>
        </div>

        {/* Right: 3 Interactive Subject Momentum Bento Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-7">
          {subjectMomentum.map((item) => {
            const meta = SUBJECT_META[item.subj];
            const isSelected =
              plannerMode === 'units'
                ? unitsSubject === item.subj
                : subjectFilter === item.subj;
            return (
              <button
                key={item.subj}
                type="button"
                onClick={() => {
                  haptics.tick();
                  if (plannerMode === 'units') {
                    setUnitsSubject(item.subj);
                  } else {
                    setSubjectFilter(isSelected ? 'all' : item.subj);
                  }
                }}
                className={`flex flex-col justify-between rounded-[28px] border p-4 text-left transition-opacity duration-150 active:scale-[0.98] ${
                  SUBJECT_GLASS_CARD[item.subj]
                } ${
                  isSelected
                    ? SUBJECT_ACTIVE_RING[item.subj]
                    : plannerMode === 'queue' && subjectFilter !== 'all'
                      ? 'opacity-60 hover:opacity-90'
                      : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold ${meta.text}`}>{meta.name}</span>
                  <span className="tabular-nums text-[11px] font-semibold text-[#0B234A]/70 dark:text-sky-200/75">
                    {item.coveredUnits}/{item.totalUnits} units
                  </span>
                </div>

                <div className="mt-3">
                  <p className="tabular-nums text-xl font-bold text-[#07142B] dark:text-white">
                    {formatDuration(item.investedMins)}
                  </p>
                  <p className="tabular-nums text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                    {item.scheduledMins > 0
                      ? `+${formatDuration(item.scheduledMins)} booked`
                      : `${item.activeCount} active tasks`}
                  </p>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/40 dark:bg-sky-300/15">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${meta.bar}`}
                    style={{ width: `${Math.max(8, item.barPct)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {plannerMode === 'units' ? (
        /* SYLLABUS UNITS COVERAGE TRACKER */
        <section className="mt-4 space-y-3.5">
          <div className="ios-glass flex flex-wrap items-center justify-between gap-3 rounded-[28px] p-4 sm:px-5">
            <div className="flex items-center gap-2">
              {(['biology', 'physics', 'chemistry'] as SubjectId[]).map((sub) => {
                const active = unitsSubject === sub;
                const count = SYLLABUS_UNITS[sub].length;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setUnitsSubject(sub);
                    }}
                    className={`min-h-[36px] rounded-full px-3.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : 'ios-glass-control text-[#0B234A]/80 dark:text-sky-100'
                    }`}
                  >
                    {SUBJECT_META[sub].name} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className="h-2 w-28 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${SUBJECT_META[unitsSubject].bar}`}
                  style={{ width: `${Math.max(4, unitsPct)}%` }}
                />
              </div>
              <span className="tabular-nums text-xs font-bold text-[#07142B] dark:text-white">
                {coveredUnitsCount}/{activeUnitsList.length} covered ({unitsPct}%)
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {activeUnitsList.map((unit) => {
              const subj = SUBJECT_META[unit.subject];
              const isCovered = Boolean(unitCoveredMap[unit.id]);
              const ust = unitStatsMap[unit.id] ?? {
                investedMins: 0,
                scheduledMins: 0,
                activeTasks: 0,
                activeMissed: 0,
              };

              return (
                <div
                  key={unit.id}
                  className={`flex flex-col gap-3 rounded-[26px] border p-4 sm:flex-row sm:items-center sm:justify-between ${
                    SUBJECT_GLASS_CARD[unit.subject]
                  } ${isCovered ? 'opacity-80' : 'opacity-100'}`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        haptics.success();
                        onToggleUnitCovered(unit.id);
                      }}
                      aria-label={`Mark ${unit.code} covered`}
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isCovered
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-blue-500/45 bg-blue-500/10 text-transparent dark:border-sky-300/45'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs">
                        <span className={`font-bold ${subj.text}`}>{unit.code}</span>
                        <span className="opacity-40">·</span>
                        <span className="tabular-nums text-[#0B234A]/75 dark:text-sky-200/80">
                          {formatDuration(ust.investedMins)} studied
                        </span>
                        {ust.scheduledMins > 0 && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="tabular-nums text-blue-700 dark:text-cyan-300">
                              +{formatDuration(ust.scheduledMins)} booked
                            </span>
                          </>
                        )}
                        {ust.activeMissed > 0 && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="text-orange-600 dark:text-orange-300">
                              {ust.activeMissed} missed item
                            </span>
                          </>
                        )}
                      </div>
                      <p
                        className={`mt-0.5 text-sm font-bold text-[#07142B] dark:text-white sm:text-base ${
                          isCovered ? 'line-through opacity-75' : ''
                        }`}
                      >
                        {unit.title}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleOpenCreate(unit.subject, unit.id)}
                      className="ios-glass-control min-h-[38px] rounded-full px-3.5 text-xs font-semibold text-[#07142B] transition-transform duration-100 active:scale-95 dark:text-white whitespace-nowrap"
                    >
                      Custom Task
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCoverUnitQuick(unit)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-transform duration-100 active:scale-95 dark:bg-blue-500 whitespace-nowrap"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Cover Unit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          {/* Filter Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5">
            <div className="ios-glass relative grid grid-cols-3 items-center rounded-full p-1">
              {(
                [
                  { id: 'active', label: `Active (${activeTasksCount})` },
                  { id: 'needs-slot', label: `Needs Slot (${needsSlotCount})` },
                  { id: 'completed', label: `Done (${completedTasksCount})` },
                ] as { id: TaskFilterTab; label: string }[]
              ).map((tab) => {
                const active = filterTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setFilterTab(tab.id);
                    }}
                    className={`min-h-[34px] rounded-full px-3 text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : 'text-[#0B234A]/75 dark:text-sky-200/80'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="ios-glass relative flex items-center gap-1 rounded-full p-1">
              {(['all', 'biology', 'physics', 'chemistry'] as const).map((sub) => {
                const active = subjectFilter === sub;
                const label = sub === 'all' ? 'All' : SUBJECT_META[sub].short;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setSubjectFilter(sub);
                    }}
                    className={`min-h-[32px] rounded-full px-3 text-[11px] font-semibold transition-colors duration-150 ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : 'text-[#0B234A]/75 dark:text-sky-200/80'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Task Queue List */}
          {visibleTasks.length === 0 ? (
            <section className="ios-glass mt-4 flex flex-col items-center justify-center rounded-[34px] px-6 py-12 text-center">
              <CalendarPlus className="h-8 w-8 text-blue-600 dark:text-sky-300" />
              <p className="mt-3 text-sm font-semibold text-[#07142B] dark:text-white">
                {filterTab === 'completed'
                  ? 'No completed tasks yet'
                  : filterTab === 'needs-slot'
                    ? 'All active tasks already have upcoming Timetable slots'
                    : 'Your Planner queue is clear'}
              </p>
              <p className="mt-1 max-w-sm text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                Create a study task or open Units (35) to pick a syllabus unit, set its deadline &amp; importance, and drop it into open Timetable gaps.
              </p>
              {filterTab !== 'completed' && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCreate()}
                    className="min-h-[44px] rounded-full bg-blue-600 px-5 text-xs font-semibold text-white shadow-md shadow-blue-600/25 transition-transform duration-100 active:scale-95 dark:bg-blue-500"
                  >
                    Create First Task
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setPlannerMode('units');
                    }}
                    className="ios-glass-control min-h-[44px] rounded-full px-5 text-xs font-semibold transition-transform duration-100 active:scale-95"
                  >
                    Browse 35 Units
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="mt-4 space-y-3">
              {visibleTasks.map((task, idx) => {
                const subj = SUBJECT_META[task.subject];
                const unit = findSyllabusUnit(task.unitId);
                const imp = IMPORTANCE_META[task.importance ?? 'medium'];
                const deadlineLabel = formatDeadlineRelative(task.deadlineISO, todayISO);
                const st = statsById[task.id] ?? {
                  linkedSlots: [],
                  completedCount: 0,
                  incompleteCount: 0,
                  upcomingCount: 0,
                  nextUpcomingSlot: null,
                  loggedMinutes: 0,
                  scheduledMinutes: 0,
                  needsFollowUpSlot: false,
                };
                const doneSub = task.checklist.filter((c) => c.done).length;
                const totalSub = task.checklist.length;
                const nextSubItem = task.checklist.find((c) => !c.done) ?? null;
                const targetPct =
                  task.targetMinutes && task.targetMinutes > 0
                    ? Math.min(100, Math.round((st.loggedMinutes / task.targetMinutes) * 100))
                    : null;
                const isDragging = draggingId === task.id;
                const rankNum = String(idx + 1).padStart(2, '0');

                return (
                  <div
                    key={task.id}
                    ref={(el) => {
                      cardRefs.current[task.id] = el;
                    }}
                    className={`rounded-[30px] border p-4 transition-transform duration-150 sm:p-5 ${
                      SUBJECT_GLASS_CARD[task.subject]
                    } ${isDragging ? 'z-20 scale-[1.02] ring-2 ring-cyan-400/75' : ''}`}
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3.5">
                      <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (task.status === 'active') haptics.success();
                            else haptics.tick();
                            onUpdateTask({
                              ...task,
                              status: task.status === 'active' ? 'completed' : 'active',
                            });
                          }}
                          aria-label={
                            task.status === 'completed'
                              ? `Reopen ${task.title}`
                              : `Mark ${task.title} done`
                          }
                          title={task.status === 'completed' ? 'Reopen task' : 'Finish task (+15 XP)'}
                          className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors active:scale-90 ${
                            task.status === 'completed'
                              ? SUBJECT_COMPLETE_RING[task.subject].checked
                              : SUBJECT_COMPLETE_RING[task.subject].unchecked
                          }`}
                        >
                          {task.status === 'completed' && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </button>
                        <div
                          onPointerDown={() => {
                            haptics.tap();
                            setDraggingId(task.id);
                          }}
                          title="Drag to reorder priority"
                          className="flex min-h-[32px] w-7 cursor-grab touch-none items-center justify-center rounded-full text-[#0B234A]/50 transition-colors hover:bg-white/30 active:cursor-grabbing dark:text-sky-200/55 dark:hover:bg-sky-300/10"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <span className="tabular-nums text-[10.5px] font-bold text-[#0B234A]/45 dark:text-sky-200/45">
                          {rankNum}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          setInspectTaskId(task.id);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span className={`font-semibold ${subj.text}`}>{subj.name}</span>
                          {task.kind === 'paper-review' && (
                            <>
                              <span className="opacity-45">·</span>
                              <span className="font-semibold text-violet-700 dark:text-violet-300">
                                Paper Review
                              </span>
                            </>
                          )}
                          {unit && (
                            <>
                              <span className="opacity-45">·</span>
                              <span className="font-medium text-[#0B234A]/80 dark:text-sky-100/85">
                                {unit.code}: {unit.title}
                              </span>
                            </>
                          )}
                          <span className="opacity-45">·</span>
                          <span className={`font-semibold ${imp.text}`}>{imp.short}</span>
                          {deadlineLabel && (
                            <>
                              <span className="opacity-45">·</span>
                              <span className="tabular-nums font-medium text-orange-600 dark:text-orange-300">
                                {deadlineLabel}
                              </span>
                            </>
                          )}
                          <span className="opacity-45">·</span>
                          <span className="tabular-nums font-medium text-[#0B234A]/80 dark:text-sky-100/85">
                            {formatDuration(st.loggedMinutes)} invested
                          </span>
                          {st.nextUpcomingSlot ? (
                            <>
                              <span className="opacity-45">·</span>
                              <span className="tabular-nums text-blue-700 dark:text-cyan-300">
                                Next: {st.nextUpcomingSlot.specificDateISO
                                  ? formatShortDateISO(st.nextUpcomingSlot.specificDateISO)
                                  : st.nextUpcomingSlot.day}{' '}
                                {formatTime12h(st.nextUpcomingSlot.startTime)}
                              </span>
                            </>
                          ) : (
                            task.status === 'active' && (
                              <>
                                <span className="opacity-45">·</span>
                                <span className="font-medium text-orange-600 dark:text-orange-300">
                                  Needs next slot
                                </span>
                              </>
                            )
                          )}
                        </div>

                        <p className="mt-1 text-base font-bold tracking-tight text-[#07142B] dark:text-white sm:text-lg">
                          {task.title}
                        </p>

                        {totalSub > 0 && (
                          <div className="mt-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                                <div
                                  className={`h-full rounded-full transition-[width] duration-300 ${subj.bar}`}
                                  style={{ width: `${Math.round((doneSub / totalSub) * 100)}%` }}
                                />
                              </div>
                              <span className="tabular-nums text-[11px] font-semibold text-[#0B234A]/75 dark:text-sky-200/80">
                                {doneSub}/{totalSub}
                              </span>
                            </div>
                            {nextSubItem && (
                              <p className="mt-1 truncate text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                                Next item: {nextSubItem.text}
                              </p>
                            )}
                          </div>
                        )}

                        {totalSub === 0 && targetPct !== null && task.targetMinutes && (
                          <div className="mt-2.5 flex items-center gap-2.5">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                              <div
                                className={`h-full rounded-full transition-[width] duration-300 ${subj.bar}`}
                                style={{ width: `${targetPct}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-[11px] font-semibold text-[#0B234A]/75 dark:text-sky-200/80">
                              {targetPct}% of {formatDuration(task.targetMinutes)}
                            </span>
                          </div>
                        )}

                        {task.notes && totalSub === 0 && (
                          <p className="mt-1.5 flex items-center gap-1.5 truncate text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                            <FileText className="h-3 w-3 shrink-0 opacity-75" />
                            <span className="truncate">{task.notes}</span>
                          </p>
                        )}
                      </button>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="flex items-center gap-1.5">
                          {visibleTasks.length > 1 && (
                            <div className="hidden items-center gap-0.5 sm:flex">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveTaskPriority(task.id, -1)}
                                aria-label="Move priority up"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#0B234A]/65 transition-transform duration-100 hover:bg-blue-500/15 active:scale-90 disabled:opacity-25 dark:text-sky-200"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === visibleTasks.length - 1}
                                onClick={() => moveTaskPriority(task.id, 1)}
                                aria-label="Move priority down"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#0B234A]/65 transition-transform duration-100 hover:bg-blue-500/15 active:scale-90 disabled:opacity-25 dark:text-sky-200"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              haptics.tap();
                              setInspectTaskId(task.id);
                            }}
                            className="ios-glass-control hidden min-h-[38px] items-center rounded-full px-3 text-xs font-semibold text-[#07142B] transition-transform duration-100 active:scale-95 sm:inline-flex dark:text-sky-100"
                          >
                            Details
                          </button>

                          {task.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => openSuggesterForTask(task)}
                              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-blue-600/95 px-3.5 text-xs font-semibold text-white shadow-sm transition-transform duration-100 active:scale-95 dark:bg-blue-500 whitespace-nowrap"
                            >
                              <CalendarPlus className="h-3.5 w-3.5" />
                              <span>Suggest Slot</span>
                            </button>
                          )}
                        </div>

                        <p className="tabular-nums text-[11px] text-[#0B234A]/60 dark:text-sky-200/65">
                          {st.completedCount + st.incompleteCount} logged · {st.upcomingCount} booked
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}

      {/* Create New Study Task Modal */}
      <CrystalSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidthClass="max-w-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Study Task</h2>
          <button
            type="button"
            onClick={() => setCreateOpen(false)}
            aria-label="Close new task modal"
            className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-100 active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Task Title
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Unit 03 Oscillations Past Papers"
              className="ios-glass-control mt-1 min-h-[46px] w-full rounded-full px-4 text-sm placeholder:text-[#0B234A]/45 focus:outline-none dark:placeholder:text-sky-200/45"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Subject
            </label>
            <div className="ios-glass-control relative mt-1 grid grid-cols-3 gap-1 rounded-full p-1">
              {(['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
                const meta = SUBJECT_META[subj];
                const active = newSubject === subj;
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setNewSubject(subj);
                      setNewUnitId('');
                    }}
                    className={`min-h-[38px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : meta.text
                    }`}
                  >
                    {meta.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Syllabus Unit (Optional)
            </label>
            <select
              value={newUnitId}
              onChange={(e) => {
                const val = e.target.value;
                setNewUnitId(val);
                if (val && !newTitle.trim()) {
                  const u = findSyllabusUnit(val);
                  if (u) setNewTitle(`Cover ${u.code}: ${u.title}`);
                }
              }}
              className="ios-glass-control mt-1 min-h-[44px] w-full rounded-full px-4 text-xs font-semibold text-[#07142B] focus:outline-none dark:text-white"
            >
              <option value="" className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white">
                General / Multi-Unit Task
              </option>
              {SYLLABUS_UNITS[newSubject].map((u) => (
                <option
                  key={u.id}
                  value={u.id}
                  className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white"
                >
                  {u.code}: {u.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Importance (How quick to finish)
            </label>
            <div className="ios-glass-control mt-1 grid grid-cols-4 gap-1 rounded-full p-1">
              {(['low', 'medium', 'high', 'urgent'] as TaskImportance[]).map((imp) => (
                <button
                  key={imp}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setNewImportance(imp);
                  }}
                  className={`min-h-[34px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                    newImportance === imp
                      ? IMPORTANCE_META[imp].activeClass
                      : IMPORTANCE_META[imp].text
                  }`}
                >
                  {IMPORTANCE_META[imp].short}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                Deadline (Optional · guides Gap Scanner)
              </label>
              {newDeadlineISO && (
                <button
                  type="button"
                  onClick={() => setNewDeadlineISO('')}
                  className="text-[11px] font-semibold text-orange-600 dark:text-orange-300"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {[
                { label: 'Today', days: 0 },
                { label: 'Tomorrow', days: 1 },
                { label: '3 Days', days: 3 },
                { label: 'This Week', days: 6 },
              ].map((preset) => {
                const iso = addDaysISO(todayISO, preset.days);
                const active = newDeadlineISO === iso;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setNewDeadlineISO(iso);
                    }}
                    className={`min-h-[32px] rounded-full px-3 text-[11px] font-semibold transition-colors ${
                      active
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'ios-glass-control text-[#0B234A]/80 dark:text-sky-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <input
                type="date"
                value={newDeadlineISO}
                min={todayISO}
                onChange={(e) => setNewDeadlineISO(e.target.value)}
                className="ios-glass-control tabular-nums min-h-[34px] flex-1 rounded-full px-3 text-xs font-semibold focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Typical Session Block
            </label>
            <div className="ios-glass-control relative mt-1.5 grid grid-cols-5 gap-1 rounded-full p-1">
              {SESSION_DURATION_CHIPS.map((m) => {
                const active = newSessionMins === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setNewSessionMins(m);
                    }}
                    className={`tabular-nums min-h-[34px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : 'text-[#0B234A]/75 dark:text-sky-200/80'
                    }`}
                  >
                    {formatDuration(m)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Sub-Items / Papers Checklist (Optional)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={newChecklistDraft}
                onChange={(e) => setNewChecklistDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDraftChecklist();
                  }
                }}
                placeholder="e.g., 2019 Essay & MCQ"
                className="ios-glass-control min-h-[42px] flex-1 rounded-full px-4 text-xs placeholder:text-[#0B234A]/45 focus:outline-none dark:placeholder:text-sky-200/45"
              />
              <button
                type="button"
                onClick={handleAddDraftChecklist}
                className="ios-glass-control min-h-[42px] rounded-full px-4 text-xs font-semibold transition-transform duration-100 active:scale-95"
              >
                Add
              </button>
            </div>
            {newChecklistItems.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {newChecklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="ios-glass-control flex items-center justify-between rounded-full px-3.5 py-2 text-xs"
                  >
                    <span className="truncate">{item.text}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewChecklistItems((prev) => prev.filter((c) => c.id !== item.id))
                      }
                      aria-label="Remove sub-item"
                      className="ml-2 text-orange-600 dark:text-orange-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                Target Hours (Blank = Ongoing)
              </label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={newTargetHours}
                onChange={(e) => setNewTargetHours(e.target.value)}
                placeholder="Ongoing"
                className="ios-glass-control tabular-nums mt-1 min-h-[42px] w-full rounded-full px-4 text-xs placeholder:text-[#0B234A]/45 focus:outline-none dark:placeholder:text-sky-200/45"
              />
            </div>
            <div className="flex items-end">
              <div className="ios-glass-control flex min-h-[42px] w-full items-center justify-between rounded-full px-3.5 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Lock Phone</span>
                </span>
                <LiquidSwitch
                  checked={newAutoBlock}
                  onToggle={() => setNewAutoBlock((v) => !v)}
                  ariaLabel="Toggle Lock Phone default"
                  activeColorClass="bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.45)]"
                />
              </div>
            </div>
          </div>

          <textarea
            rows={2}
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes, weak areas, or page numbers..."
            className="ios-glass-control w-full rounded-[24px] px-4 py-3 text-xs placeholder:text-[#0B234A]/45 focus:outline-none dark:placeholder:text-sky-200/45"
          />
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            disabled={!newTitle.trim()}
            onClick={() => handleCreateTask(false)}
            className="ios-glass-control min-h-[48px] rounded-full px-4 text-xs font-semibold transition-transform duration-100 active:scale-95 disabled:opacity-45"
          >
            Save Only
          </button>
          <button
            type="button"
            disabled={!newTitle.trim()}
            onClick={() => handleCreateTask(true)}
            className="min-h-[48px] flex-1 rounded-full bg-blue-600 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-[0.98] disabled:opacity-45 dark:bg-blue-500"
          >
            Save &amp; Suggest Time Slot
          </button>
        </div>
      </CrystalSheet>

      {/* Task Detail & History Inspector Sheet */}
      <CrystalSheet
        open={inspectTask !== null}
        onClose={() => setInspectTaskId(null)}
        maxWidthClass="max-w-lg"
      >
        {inspectTask && (() => {
          const subj = SUBJECT_META[inspectTask.subject];
          const unit = findSyllabusUnit(inspectTask.unitId);
          const st = statsById[inspectTask.id];
          const targetPct =
            inspectTask.targetMinutes && inspectTask.targetMinutes > 0
              ? Math.min(100, Math.round((st.loggedMinutes / inspectTask.targetMinutes) * 100))
              : null;

          return (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                    <span className={`font-semibold ${subj.text}`}>{subj.name}</span>
                    {unit ? ` · ${unit.code}` : ''}
                    {' · '}
                    {inspectTask.status === 'completed'
                      ? 'Completed Task'
                      : inspectTask.kind === 'paper-review'
                        ? 'Paper Mistake Review'
                        : 'Ongoing Study Task'}
                  </p>
                  <h2 className="mt-0.5 text-xl font-bold">{inspectTask.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectTaskId(null)}
                  aria-label="Close task inspector"
                  className="ios-glass-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-100 active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="ios-glass-control mt-4 rounded-[26px] p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="tabular-nums text-lg font-bold text-blue-700 dark:text-cyan-300">
                      {formatDuration(st.loggedMinutes)}
                    </p>
                    <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                      Time Invested
                    </p>
                  </div>
                  <div>
                    <p className="tabular-nums text-lg font-bold">
                      {st.completedCount + st.incompleteCount}
                    </p>
                    <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                      Sessions Logged
                    </p>
                  </div>
                  <div>
                    <p className="tabular-nums text-lg font-bold">
                      {formatDuration(st.scheduledMinutes)}
                    </p>
                    <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                      Upcoming
                    </p>
                  </div>
                </div>
                {targetPct !== null && inspectTask.targetMinutes && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                      <span>Progress vs {formatDuration(inspectTask.targetMinutes)} target</span>
                      <span className="tabular-nums font-semibold">{targetPct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-500/15">
                      <div
                        className={`h-full rounded-full ${subj.bar}`}
                        style={{ width: `${targetPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Edit Unit, Importance & Deadline */}
              <div className="mt-3.5 space-y-2.5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={inspectTask.unitId ?? ''}
                    onChange={(e) =>
                      onUpdateTask({ ...inspectTask, unitId: e.target.value || undefined })
                    }
                    className="ios-glass-control min-h-[38px] rounded-full px-3.5 text-xs font-semibold text-[#07142B] focus:outline-none dark:text-white"
                  >
                    <option value="" className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white">
                      No Syllabus Unit
                    </option>
                    {SYLLABUS_UNITS[inspectTask.subject].map((u) => (
                      <option
                        key={u.id}
                        value={u.id}
                        className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white"
                      >
                        {u.code}: {u.title}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={inspectTask.deadlineISO ?? ''}
                    min={todayISO}
                    onChange={(e) =>
                      onUpdateTask({ ...inspectTask, deadlineISO: e.target.value || undefined })
                    }
                    className="ios-glass-control tabular-nums min-h-[38px] rounded-full px-3.5 text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div className="ios-glass-control grid grid-cols-4 gap-1 rounded-full p-1">
                  {(['low', 'medium', 'high', 'urgent'] as TaskImportance[]).map((imp) => (
                    <button
                      key={imp}
                      type="button"
                      onClick={() => {
                        haptics.tick();
                        onUpdateTask({ ...inspectTask, importance: imp });
                      }}
                      className={`min-h-[32px] rounded-full text-[11px] font-semibold transition-colors ${
                        (inspectTask.importance ?? 'medium') === imp
                          ? IMPORTANCE_META[imp].activeClass
                          : IMPORTANCE_META[imp].text
                      }`}
                    >
                      {IMPORTANCE_META[imp].short}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold text-[#0B234A]/80 dark:text-sky-100/85">
                  Checklist &amp; Sub-Units
                </p>
                <div className="mt-2 space-y-1.5">
                  {inspectTask.checklist.map((item) => (
                    <div
                      key={item.id}
                      className="ios-glass-control flex items-center justify-between gap-2 rounded-full px-3.5 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          haptics.tick();
                          onUpdateTask({
                            ...inspectTask,
                            checklist: inspectTask.checklist.map((c) =>
                              c.id === item.id ? { ...c, done: !c.done } : c,
                            ),
                          });
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            item.done
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-blue-400/55'
                          }`}
                        >
                          {item.done && <Check className="h-3 w-3 stroke-[2.5]" />}
                        </span>
                        <span
                          className={`truncate text-xs ${
                            item.done ? 'line-through opacity-60' : 'font-medium'
                          }`}
                        >
                          {item.text}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTask({
                            ...inspectTask,
                            checklist: inspectTask.checklist.filter((c) => c.id !== item.id),
                          })
                        }
                        aria-label="Remove item"
                        className="text-[#0B234A]/50 hover:text-orange-600 dark:text-sky-200/50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {inspectTask.status === 'active' &&
                  inspectTask.checklist.length > 0 &&
                  inspectTask.checklist.every((c) => c.done) && (
                    <button
                      type="button"
                      onClick={() => {
                        haptics.success();
                        onUpdateTask({ ...inspectTask, status: 'completed' });
                        setInspectTaskId(null);
                      }}
                      className="mt-2.5 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>All Steps Checked — Finish Task (+15 XP)</span>
                    </button>
                  )}

                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={detailChecklistInput}
                    onChange={(e) => setDetailChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && detailChecklistInput.trim()) {
                        e.preventDefault();
                        haptics.tick();
                        onUpdateTask({
                          ...inspectTask,
                          checklist: [
                            ...inspectTask.checklist,
                            {
                              id: `chk-${Date.now()}`,
                              text: detailChecklistInput.trim(),
                              done: false,
                            },
                          ],
                        });
                        setDetailChecklistInput('');
                      }
                    }}
                    placeholder="Add sub-item (e.g., 2022 Paper Part II)..."
                    className="ios-glass-control min-h-[38px] flex-1 rounded-full px-3.5 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!detailChecklistInput.trim()) return;
                      haptics.tick();
                      onUpdateTask({
                        ...inspectTask,
                        checklist: [
                          ...inspectTask.checklist,
                          {
                            id: `chk-${Date.now()}`,
                            text: detailChecklistInput.trim(),
                            done: false,
                          },
                        ],
                      });
                      setDetailChecklistInput('');
                    }}
                    className="ios-glass-control min-h-[38px] rounded-full px-3.5 text-xs font-semibold transition-transform duration-100 active:scale-95"
                  >
                    Add
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={inspectTask.notes}
                  onChange={(e) =>
                    onUpdateTask({ ...inspectTask, notes: e.target.value })
                  }
                  placeholder="Notes (where you stopped, weak spots)..."
                  className="ios-glass-control mt-2.5 w-full rounded-[22px] px-3.5 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#0B234A]/80 dark:text-sky-100/85">
                    Timetable Slots ({st.linkedSlots.length})
                  </p>
                  {inspectTask.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => {
                        setInspectTaskId(null);
                        openSuggesterForTask(inspectTask);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-cyan-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Suggest Another Slot</span>
                    </button>
                  )}
                </div>

                {st.linkedSlots.length === 0 ? (
                  <div className="ios-glass-control mt-2 rounded-[22px] px-4 py-4 text-center text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                    No Timetable slots attached yet — tap Suggest Slot to add one automatically.
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {st.linkedSlots.map((slot) => {
                      const dur = getDurationMinutes(slot.startTime, slot.endTime);
                      let isDone = false;
                      let isIncomplete = false;
                      let loggedHere = 0;

                      for (const log of Object.values(dailyLogs)) {
                        if (log.completedSlotIds.includes(slot.id)) {
                          isDone = true;
                          loggedHere = dur;
                        } else if ((log.incompleteSlotIds ?? []).includes(slot.id)) {
                          isIncomplete = true;
                          loggedHere = Math.max(loggedHere, log.loggedMinutesBySlot?.[slot.id] ?? 0);
                        }
                      }

                      return (
                        <div
                          key={slot.id}
                          className="ios-glass-control flex items-center justify-between gap-2 rounded-[22px] px-3.5 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold">
                              {slot.revisionStage ? `${slot.revisionStage.toUpperCase()} · ` : ''}
                              {slot.specificDateISO ? `${slot.day} ${formatShortDateISO(slot.specificDateISO)}` : slot.day} · {formatTime12h(slot.startTime)} ({formatDuration(dur)})
                            </p>
                            <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                              {isDone
                                ? `Completed ✓ (${formatDuration(loggedHere)})`
                                : isIncomplete
                                  ? `Incomplete ↺ (${formatDuration(loggedHere)} logged)`
                                  : 'Scheduled on Timetable'}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                haptics.success();
                                onToggleLinkedSlotComplete(slot);
                              }}
                              title={isDone ? 'Undo complete' : 'Mark complete'}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs transition-transform duration-100 active:scale-90 ${
                                isDone
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-blue-500/15 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            {!isDone && (
                              <button
                                type="button"
                                onClick={() => {
                                  haptics.tap();
                                  setPartialMinsDraft(loggedHere || Math.round(dur / 2));
                                  setPartialSlotTarget(slot);
                                }}
                                title="Mark incomplete / log partial mins"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/15 text-orange-700 transition-transform duration-100 active:scale-90 dark:text-orange-300"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                haptics.tap();
                                onDeleteLinkedSlot(slot.id);
                              }}
                              title="Remove slot from Timetable"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-[#0B234A]/65 transition-transform duration-100 active:scale-90 dark:text-sky-200/75"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onDeleteTask(inspectTask.id);
                    setInspectTaskId(null);
                  }}
                  className="ios-glass-control inline-flex min-h-[46px] items-center justify-center rounded-full px-4 text-xs font-semibold text-orange-600 transition-transform duration-100 active:scale-95 dark:text-orange-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptics.success();
                    onUpdateTask({
                      ...inspectTask,
                      status: inspectTask.status === 'active' ? 'completed' : 'active',
                    });
                    setInspectTaskId(null);
                  }}
                  className="ios-glass-control min-h-[46px] flex-1 rounded-full px-4 text-xs font-semibold transition-transform duration-100 active:scale-[0.98]"
                >
                  {inspectTask.status === 'active' ? 'Mark Whole Task Done' : 'Reopen Task'}
                </button>

                {inspectTask.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => {
                      setInspectTaskId(null);
                      openSuggesterForTask(inspectTask);
                    }}
                    className="min-h-[46px] flex-1 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-[0.98] dark:bg-blue-500"
                  >
                    + Suggest Next Slot
                  </button>
                )}
              </div>
            </>
          );
        })()}
      </CrystalSheet>

      {/* Log Partial / Incomplete Mins Modal */}
      <CrystalSheet
        open={partialSlotTarget !== null}
        onClose={() => setPartialSlotTarget(null)}
        zIndexClass="z-[65]"
        maxWidthClass="max-w-sm"
      >
        {partialSlotTarget && (
          <>
            <h3 className="text-base font-semibold">Mark Slot Incomplete</h3>
            <p className="mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
              Log how much you studied in this session—your task stays open to keep dragging.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={getDurationMinutes(partialSlotTarget.startTime, partialSlotTarget.endTime)}
                step={5}
                value={partialMinsDraft}
                onChange={(e) => setPartialMinsDraft(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
              <span className="tabular-nums min-w-[52px] text-right text-sm font-bold">
                {formatDuration(partialMinsDraft)}
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPartialSlotTarget(null)}
                className="ios-glass-control min-h-[44px] flex-1 rounded-full text-xs font-semibold transition-transform duration-100 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  onMarkLinkedSlotIncomplete(partialSlotTarget, partialMinsDraft);
                  setPartialSlotTarget(null);
                }}
                className="min-h-[44px] flex-1 rounded-full bg-orange-500 text-xs font-semibold text-white transition-transform duration-100 active:scale-95"
              >
                Save Incomplete
              </button>
            </div>
          </>
        )}
      </CrystalSheet>
    </div>
  );
});
