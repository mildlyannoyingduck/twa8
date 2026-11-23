import {
  BookOpen,
  CalendarPlus,
  Check,
  FileText,
  Lock,
  PlaySquare,
  Plus,
  RotateCcw,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
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
  MissedCategory,
  MissedLessonItem,
  SlotSuggestion,
  SubjectId,
  TaskImportance,
  TimetableSlot,
} from '../types';
import { addDaysISO, formatDeadlineRelative, getTodayISO } from '../utils/dateUtils';
import { haptics } from '../utils/haptics';
import { suggestMultiSessionPlan } from '../utils/schedulerEngine';
import { formatDuration, formatTime12h, getDurationMinutes } from '../utils/timeUtils';
import { CrystalSheet, LiquidSwitch } from './FluidControls';
import { SmartSlotPickerPayload } from './SmartSlotPickerSheet';

interface MissedViewProps {
  missedItems: MissedLessonItem[];
  slots: TimetableSlot[];
  dailyLogs: Record<string, DayCompletionLog>;
  fridayWeekMode: FridayWeekMode;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  canSmartGapFill?: boolean;
  onOpenAbilities?: () => void;
  onRunSmartGapFiller?: () => { addedCount: number; message: string };
  onAddMissed: (item: MissedLessonItem) => void;
  onUpdateMissed: (item: MissedLessonItem) => void;
  onDeleteMissed: (id: string) => void;
  onApproveMissedSlots: (item: MissedLessonItem, suggestions: SlotSuggestion[]) => void;
  onRequestSlotPicker: (
    payload: SmartSlotPickerPayload,
    onConfirm: (suggestion: SlotSuggestion) => void,
  ) => void;
  onToggleLinkedSlotComplete: (slot: TimetableSlot) => void;
  onDeleteLinkedSlot: (slotId: string) => void;
}

const REC_DURATION_CHIPS = [60, 90, 120, 180, 240, 300];
const HW_DURATION_CHIPS = [30, 60, 90, 120, 180, 240];
const SPEED_OPTIONS: (1 | 1.25 | 1.5 | 2)[] = [1, 1.25, 1.5, 2];
const IMPORTANCE_ORDER: Record<TaskImportance, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function getEffectiveStudyMins(item: MissedLessonItem): number {
  if (item.category === 'recording' && item.playbackSpeed && item.playbackSpeed > 1) {
    return Math.max(15, Math.round(item.estimatedMins / item.playbackSpeed));
  }
  return Math.max(15, item.estimatedMins);
}

interface MissedComputedStats {
  linkedSlots: TimetableSlot[];
  loggedMinutes: number;
  scheduledMinutes: number;
  effectiveTotalMins: number;
  remainingMins: number;
  nextUpcomingSlot: TimetableSlot | null;
}

function computeMissedStats(
  item: MissedLessonItem,
  slots: TimetableSlot[],
  dailyLogs: Record<string, DayCompletionLog>,
): MissedComputedStats {
  const linkedSlots = slots.filter((s) => s.linkedMissedId === item.id);
  const completedSet = new Set<string>();
  const partialMap: Record<string, number> = {};

  for (const log of Object.values(dailyLogs)) {
    for (const sid of log.completedSlotIds) {
      if (linkedSlots.some((s) => s.id === sid)) completedSet.add(sid);
    }
    for (const sid of log.incompleteSlotIds ?? []) {
      if (linkedSlots.some((s) => s.id === sid) && !completedSet.has(sid)) {
        partialMap[sid] = Math.max(partialMap[sid] ?? 0, log.loggedMinutesBySlot?.[sid] ?? 0);
      }
    }
  }

  let loggedMinutes = 0;
  let scheduledMinutes = 0;
  const upcoming: TimetableSlot[] = [];

  for (const slot of linkedSlots) {
    const dur = getDurationMinutes(slot.startTime, slot.endTime);
    if (completedSet.has(slot.id)) {
      loggedMinutes += dur;
    } else {
      if (partialMap[slot.id]) loggedMinutes += partialMap[slot.id];
      scheduledMinutes += dur;
      upcoming.push(slot);
    }
  }

  upcoming.sort((a, b) => {
    const d = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
    return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
  });

  const effectiveTotalMins = getEffectiveStudyMins(item);
  const remainingMins = Math.max(0, effectiveTotalMins - loggedMinutes);

  return {
    linkedSlots,
    loggedMinutes,
    scheduledMinutes,
    effectiveTotalMins,
    remainingMins,
    nextUpcomingSlot: upcoming[0] ?? null,
  };
}

export const MissedView = memo(function MissedView({
  missedItems,
  slots,
  dailyLogs,
  fridayWeekMode,
  fridayAnchor,
  fridayOverrides,
  canSmartGapFill = false,
  onOpenAbilities,
  onRunSmartGapFiller,
  onAddMissed,
  onUpdateMissed,
  onDeleteMissed,
  onApproveMissedSlots,
  onRequestSlotPicker,
  onToggleLinkedSlotComplete,
  onDeleteLinkedSlot,
}: MissedViewProps) {
  const todayISO = getTodayISO();

  const [statusTab, setStatusTab] = useState<'active' | 'covered'>('active');
  const [catFilter, setCatFilter] = useState<'all' | MissedCategory>('all');
  const [subjectFilter, setSubjectFilter] = useState<'all' | SubjectId>('all');

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] = useState<MissedCategory>('recording');
  const [draftSubject, setDraftSubject] = useState<SubjectId>('biology');
  const [draftUnitId, setDraftUnitId] = useState<string>('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftMins, setDraftMins] = useState(120);
  const [draftSpeed, setDraftSpeed] = useState<1 | 1.25 | 1.5 | 2>(1.25);
  const [draftImportance, setDraftImportance] = useState<TaskImportance>('high');
  const [draftDeadline, setDraftDeadline] = useState<string>('');
  const [draftAutoBlock, setDraftAutoBlock] = useState(true);

  // Detail Inspector State & Gap Filler feedback
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [gapFillStatus, setGapFillStatus] = useState<string | null>(null);

  const statsById = useMemo(() => {
    const map: Record<string, MissedComputedStats> = {};
    for (const item of missedItems) {
      map[item.id] = computeMissedStats(item, slots, dailyLogs);
    }
    return map;
  }, [missedItems, slots, dailyLogs]);

  const sortedItems = useMemo(() => {
    return [...missedItems].sort((a, b) => {
      const impDiff = IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance];
      if (impDiff !== 0) return impDiff;
      if (a.deadlineISO && b.deadlineISO) return a.deadlineISO.localeCompare(b.deadlineISO);
      if (a.deadlineISO) return -1;
      if (b.deadlineISO) return 1;
      return b.createdAtISO.localeCompare(a.createdAtISO);
    });
  }, [missedItems]);

  const visibleItems = useMemo(() => {
    return sortedItems.filter((item) => {
      if (item.status !== statusTab) return false;
      if (catFilter !== 'all' && item.category !== catFilter) return false;
      if (subjectFilter !== 'all' && item.subject !== subjectFilter) return false;
      return true;
    });
  }, [sortedItems, statusTab, catFilter, subjectFilter]);

  const summary = useMemo(() => {
    let recMinsLeft = 0;
    let hwMinsLeft = 0;
    let activeCount = 0;
    let coveredCount = 0;
    let urgentCount = 0;

    for (const item of missedItems) {
      if (item.status === 'covered') {
        coveredCount += 1;
        continue;
      }
      activeCount += 1;
      if (item.importance === 'urgent' || item.importance === 'high') urgentCount += 1;
      const rem = statsById[item.id]?.remainingMins ?? getEffectiveStudyMins(item);
      if (item.category === 'recording') recMinsLeft += rem;
      else hwMinsLeft += rem;
    }

    return {
      totalLeftMins: recMinsLeft + hwMinsLeft,
      recMinsLeft,
      hwMinsLeft,
      activeCount,
      coveredCount,
      urgentCount,
    };
  }, [missedItems, statsById]);

  const activeCatchUpClasses = useMemo(
    () => slots.filter((s) => s.isCatchUpClass),
    [slots],
  );

  const inspectItem = missedItems.find((i) => i.id === inspectId) ?? null;

  const openCreateModal = (presetCategory: MissedCategory = 'recording') => {
    haptics.tap();
    setEditingId(null);
    setDraftCategory(presetCategory);
    setDraftSubject(subjectFilter === 'all' ? 'biology' : subjectFilter);
    setDraftUnitId('');
    setDraftTitle('');
    setDraftNotes('');
    setDraftMins(presetCategory === 'recording' ? 180 : 60);
    setDraftSpeed(1.25);
    setDraftImportance('high');
    setDraftDeadline(addDaysISO(todayISO, 3));
    setDraftAutoBlock(true);
    setModalOpen(true);
  };

  const openEditModal = (item: MissedLessonItem) => {
    haptics.tap();
    setEditingId(item.id);
    setDraftCategory(item.category);
    setDraftSubject(item.subject);
    setDraftUnitId(item.unitId ?? '');
    setDraftTitle(item.title);
    setDraftNotes(item.notes);
    setDraftMins(item.estimatedMins);
    setDraftSpeed(item.playbackSpeed ?? 1.25);
    setDraftImportance(item.importance);
    setDraftDeadline(item.deadlineISO ?? '');
    setDraftAutoBlock(item.autoBlockDefault);
    setModalOpen(true);
  };

  const openSuggesterForItem = (item: MissedLessonItem) => {
    if (item.rescheduleLocked) return;
    haptics.tap();
    const st = statsById[item.id];
    const rem = st?.remainingMins ?? getEffectiveStudyMins(item);
    const defaultDur = rem <= 60 ? 60 : rem <= 90 ? 90 : 120;
    onRequestSlotPicker(
      {
        title: item.title,
        subject: item.subject,
        durationMins: defaultDur,
        deadlineISO: item.deadlineISO,
        importance: item.importance,
        autoBlockDefault: item.autoBlockDefault,
        badgeLabel: `${SUBJECT_META[item.subject].name} · Catch-Up Slot`,
      },
      (sug) => onApproveMissedSlots(item, [sug]),
    );
  };

  const handleAutoSplitRemaining = (item: MissedLessonItem) => {
    if (item.rescheduleLocked) return;
    const st = statsById[item.id];
    const rem = st?.remainingMins ?? getEffectiveStudyMins(item);
    const plan = suggestMultiSessionPlan({
      slots,
      subject: item.subject,
      totalRemainingMins: rem,
      chunkMins: Math.min(90, Math.max(45, rem)),
      timePreference: 'any',
      autoBlockDefault: item.autoBlockDefault,
      fridayWeekMode,
      fridayAnchor,
      fridayOverrides,
      scanWeekOffset: 0,
      deadlineISO: item.deadlineISO,
      importance: item.importance,
    });
    if (plan.length > 0) {
      haptics.success();
      onApproveMissedSlots(item, plan);
      setInspectId(null);
      setGapFillStatus(`Booked ${plan.length} split catch-up sessions for ${item.title}.`);
    }
  };

  const handleSaveItem = (andSuggest: boolean) => {
    if (!draftTitle.trim()) return;
    haptics.success();

    const payload: MissedLessonItem = {
      id: editingId ?? `missed-${Date.now()}`,
      category: draftCategory,
      subject: draftSubject,
      unitId: draftUnitId || undefined,
      title: draftTitle.trim(),
      notes: draftNotes.trim(),
      estimatedMins: Math.max(15, draftMins),
      playbackSpeed: draftCategory === 'recording' ? draftSpeed : undefined,
      deadlineISO: draftDeadline || undefined,
      importance: draftImportance,
      status: editingId
        ? (missedItems.find((i) => i.id === editingId)?.status ?? 'active')
        : 'active',
      autoBlockDefault: draftAutoBlock,
      createdAtISO: editingId
        ? (missedItems.find((i) => i.id === editingId)?.createdAtISO ?? todayISO)
        : todayISO,
    };

    if (editingId) {
      onUpdateMissed(payload);
    } else {
      onAddMissed(payload);
    }
    setModalOpen(false);
    setStatusTab('active');

    if (andSuggest) {
      openSuggesterForItem(payload);
    }
  };

  const draftEffectiveMins =
    draftCategory === 'recording' && draftSpeed > 1
      ? Math.max(15, Math.round(draftMins / draftSpeed))
      : draftMins;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#07142B] dark:text-white">
            Missed Lessons
          </h1>
          <p className="mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
            Catch up recordings &amp; missed homework sorted by urgency &amp; deadline
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCreateModal('homework')}
            className="ios-glass-control inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-[#07142B] transition-transform duration-100 active:scale-95 dark:text-white whitespace-nowrap shrink-0"
          >
            <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
            <span>+ Homework</span>
          </button>
          <button
            type="button"
            onClick={() => openCreateModal('recording')}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-95 dark:bg-blue-500 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Recording</span>
          </button>
        </div>
      </div>

      {/* Bento Backlog Overview */}
      <section className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <div className="ios-glass-strong flex flex-col justify-between rounded-[32px] p-5 lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700/80 dark:text-cyan-300/85">
                Backlog Remaining
              </p>
              <p className="tabular-nums mt-1 text-3xl font-bold tracking-tight text-[#07142B] dark:text-white">
                {formatDuration(summary.totalLeftMins)}
              </p>
              <p className="mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                Recordings {formatDuration(summary.recMinsLeft)} · Homework{' '}
                {formatDuration(summary.hwMinsLeft)}
              </p>
            </div>
            <div className="text-right tabular-nums">
              <p className="text-[11px] font-medium text-[#0B234A]/65 dark:text-sky-200/70">
                High / Urgent
              </p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-300">
                {summary.urgentCount} items
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/40 pt-3.5 text-center dark:border-sky-300/18">
            <div>
              <p className="tabular-nums text-lg font-bold text-[#07142B] dark:text-white">
                {summary.activeCount}
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">Pending</p>
            </div>
            <div>
              <p className="tabular-nums text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {summary.coveredCount}
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">Covered</p>
            </div>
            <div>
              <p className="tabular-nums text-lg font-bold text-blue-700 dark:text-cyan-300">
                {activeCatchUpClasses.length}
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">Live Class Fix</p>
            </div>
          </div>
        </div>

        {/* Excluded Scheduled Catch-Up Classes Note + Quick Rules */}
        <div className="ios-glass flex flex-col justify-between rounded-[32px] p-5 lg:col-span-7">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700/80 dark:text-cyan-300/85">
              Already Running on Timetable (Excluded Here)
            </p>
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {activeCatchUpClasses.length === 0 ? (
                <p className="text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                  No active catch-up classes on your Timetable right now.
                </p>
              ) : (
                activeCatchUpClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="ios-glass-control flex items-center justify-between gap-2 rounded-[22px] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#07142B] dark:text-white">
                        {cls.title.replace(' (Catch-Up)', '')}
                      </p>
                      <p className="truncate text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                        {cls.day} {formatTime12h(cls.startTime)}–{formatTime12h(cls.endTime)}
                        {cls.expiresAtISO ? ` · until ${cls.expiresAtISO}` : ' · until marked done'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
              24h gap scanner keeps all classes + 2h paper hall commutes untouched.
            </p>
            <button
              type="button"
              onClick={() => {
                if (canSmartGapFill && onRunSmartGapFiller) {
                  haptics.success();
                  const res = onRunSmartGapFiller();
                  setGapFillStatus(res.message);
                } else {
                  haptics.tap();
                  onOpenAbilities?.();
                }
              }}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-transform active:scale-95 ${
                canSmartGapFill
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm'
                  : 'ios-glass-control text-blue-700 dark:text-cyan-300'
              }`}
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>{canSmartGapFill ? '1-Tap Smart Gap Filler' : 'Smart Gap Filler (Gold)'}</span>
            </button>
          </div>
          {gapFillStatus && (
            <p className="mt-2 rounded-[14px] bg-blue-500/12 px-3 py-1.5 text-[11px] font-semibold text-blue-700 dark:text-cyan-200">
              {gapFillStatus}
            </p>
          )}
        </div>
      </section>

      {/* Filter Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="ios-glass grid grid-cols-2 items-center rounded-full p-1">
            {(
              [
                { id: 'active', label: `Pending (${summary.activeCount})` },
                { id: 'covered', label: `Covered (${summary.coveredCount})` },
              ] as const
            ).map((tab) => {
              const active = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setStatusTab(tab.id);
                  }}
                  className={`min-h-[34px] rounded-full px-3.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
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

          <div className="ios-glass flex items-center gap-1 rounded-full p-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'recording', label: 'Recordings' },
                { id: 'homework', label: 'Homework' },
              ] as const
            ).map((c) => {
              const active = catFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setCatFilter(c.id);
                  }}
                  className={`min-h-[32px] rounded-full px-3 text-[11px] font-semibold transition-colors duration-150 whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/80'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ios-glass flex items-center gap-1 rounded-full p-1">
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

      {/* Missed Items List */}
      {visibleItems.length === 0 ? (
        <section className="ios-glass mt-4 flex flex-col items-center justify-center rounded-[34px] px-6 py-12 text-center">
          <PlaySquare className="h-8 w-8 text-blue-600 dark:text-sky-300" />
          <p className="mt-3 text-sm font-semibold text-[#07142B] dark:text-white">
            {statusTab === 'covered'
              ? 'No covered items yet'
              : 'All caught up on missed recordings & homework'}
          </p>
          <p className="mt-1 max-w-sm text-xs text-[#0B234A]/70 dark:text-sky-200/75">
            Whenever you miss a recording or get extra homework, add it here with its deadline and urgency to drop sessions straight into your open week gaps.
          </p>
          {statusTab === 'active' && (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCreateModal('recording')}
                className="min-h-[44px] rounded-full bg-blue-600 px-5 text-xs font-semibold text-white shadow-md shadow-blue-600/25 transition-transform duration-100 active:scale-95 dark:bg-blue-500"
              >
                Add Missed Recording
              </button>
              <button
                type="button"
                onClick={() => openCreateModal('homework')}
                className="ios-glass-control min-h-[44px] rounded-full px-5 text-xs font-semibold transition-transform duration-100 active:scale-95"
              >
                Add Homework
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-4 space-y-3">
          {visibleItems.map((item) => {
            const subj = SUBJECT_META[item.subject];
            const imp = IMPORTANCE_META[item.importance];
            const unit = findSyllabusUnit(item.unitId);
            const st = statsById[item.id];
            const deadlineText = formatDeadlineRelative(item.deadlineISO, todayISO);
            const pct =
              st.effectiveTotalMins > 0
                ? Math.min(100, Math.round((st.loggedMinutes / st.effectiveTotalMins) * 100))
                : 0;

            return (
              <div
                key={item.id}
                className={`rounded-[30px] border p-4 sm:p-5 ${SUBJECT_GLASS_CARD[item.subject]}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setInspectId(item.id);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="font-semibold text-[#07142B] dark:text-white">
                        {item.category === 'recording' ? 'Recording' : 'Homework'}
                      </span>
                      <span className="opacity-40">·</span>
                      <span className={`font-semibold ${subj.text}`}>{subj.name}</span>
                      {unit && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="text-[#0B234A]/75 dark:text-sky-100/80">
                            {unit.code}: {unit.title}
                          </span>
                        </>
                      )}
                      <span className="opacity-40">·</span>
                      <span className={`font-semibold ${imp.text}`}>{imp.short}</span>
                      {item.rescheduleLocked && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                            LOCK
                          </span>
                        </>
                      )}
                      {deadlineText && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="tabular-nums font-medium text-orange-600 dark:text-orange-300">
                            {deadlineText}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="mt-1 text-base font-bold tracking-tight text-[#07142B] dark:text-white sm:text-lg">
                      {item.title}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#0B234A]/75 dark:text-sky-200/80">
                      <span className="tabular-nums font-semibold">
                        {formatDuration(st.remainingMins)} left
                      </span>
                      {item.category === 'recording' && item.playbackSpeed && item.playbackSpeed > 1 && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="tabular-nums">
                            {formatDuration(item.estimatedMins)} raw at {item.playbackSpeed}x
                          </span>
                        </>
                      )}
                      {st.nextUpcomingSlot && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="tabular-nums font-medium text-blue-700 dark:text-cyan-300">
                            Next: {st.nextUpcomingSlot.day}{' '}
                            {formatTime12h(st.nextUpcomingSlot.startTime)}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                        <div
                          className={`h-full rounded-full transition-[width] duration-300 ${subj.bar}`}
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-[11px] font-semibold text-[#0B234A]/75 dark:text-sky-200/80">
                        {pct}% ({formatDuration(st.loggedMinutes)}/{formatDuration(st.effectiveTotalMins)})
                      </span>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        haptics.success();
                        onUpdateMissed({
                          ...item,
                          status: item.status === 'active' ? 'covered' : 'active',
                        });
                      }}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-transform duration-100 active:scale-95 whitespace-nowrap ${
                        item.status === 'covered'
                          ? 'ios-glass-control text-[#07142B] dark:text-white'
                          : 'bg-emerald-500/18 text-emerald-800 dark:text-emerald-200'
                      }`}
                    >
                      {item.status === 'covered' ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Reopen</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Covered</span>
                        </>
                      )}
                    </button>

                    {item.status === 'active' && !item.rescheduleLocked && (
                      <button
                        type="button"
                        onClick={() => openSuggesterForItem(item)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-blue-600/95 px-3.5 text-xs font-semibold text-white shadow-sm transition-transform duration-100 active:scale-95 dark:bg-blue-500 whitespace-nowrap"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        <span>Suggest Slot</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Add / Edit Missed Item Modal */}
      <CrystalSheet open={modalOpen} onClose={() => setModalOpen(false)} maxWidthClass="max-w-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {editingId ? 'Edit Missed Item' : 'Add Missed Lesson / Work'}
          </h2>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            aria-label="Close missed item modal"
            className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-100 active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5">
          {/* Category Picker */}
          <div className="ios-glass-control grid grid-cols-2 gap-1 rounded-full p-1">
            {(
              [
                { id: 'recording', label: 'Missed Recording' },
                { id: 'homework', label: 'Missed Homework' },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setDraftCategory(c.id);
                  if (!editingId) {
                    setDraftMins(c.id === 'recording' ? 180 : 60);
                  }
                }}
                className={`min-h-[38px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                  draftCategory === c.id
                    ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                    : 'text-[#0B234A]/75 dark:text-sky-200/80'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              {draftCategory === 'recording' ? 'Recording / Lesson Title' : 'Homework / Tute Title'}
            </label>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder={
                draftCategory === 'recording'
                  ? 'e.g., Organic Mechanisms Part 2 Recording'
                  : 'e.g., Mechanics Momentum Tute Q1–Q15'
              }
              className="ios-glass-control mt-1 min-h-[46px] w-full rounded-full px-4 text-sm placeholder:text-[#0B234A]/45 focus:outline-none dark:placeholder:text-sky-200/45"
            />
          </div>

          {/* Subject & Unit */}
          <div className="ios-glass-control grid grid-cols-3 gap-1 rounded-full p-1">
            {(['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
              const meta = SUBJECT_META[subj];
              const active = draftSubject === subj;
              return (
                <button
                  key={subj}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setDraftSubject(subj);
                    setDraftUnitId('');
                  }}
                  className={`min-h-[38px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                    active ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500' : meta.text
                  }`}
                >
                  {meta.name}
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Syllabus Unit (Optional)
            </label>
            <select
              value={draftUnitId}
              onChange={(e) => setDraftUnitId(e.target.value)}
              className="ios-glass-control mt-1 min-h-[44px] w-full rounded-full px-4 text-xs font-semibold text-[#07142B] focus:outline-none dark:text-white"
            >
              <option value="" className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white">
                General / Not Unit-Specific
              </option>
              {SYLLABUS_UNITS[draftSubject].map((u) => (
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

          {/* Duration & Playback Speed */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              <span>
                {draftCategory === 'recording' ? 'Recording Length' : 'Estimated Work Time'}
              </span>
              <span className="tabular-nums font-bold text-blue-700 dark:text-cyan-300">
                {draftCategory === 'recording' && draftSpeed > 1
                  ? `${formatDuration(draftMins)} → ${formatDuration(draftEffectiveMins)} at ${draftSpeed}x`
                  : formatDuration(draftMins)}
              </span>
            </div>
            <div className="ios-glass-control mt-1.5 grid grid-cols-6 gap-1 rounded-full p-1">
              {(draftCategory === 'recording' ? REC_DURATION_CHIPS : HW_DURATION_CHIPS).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setDraftMins(m);
                  }}
                  className={`tabular-nums min-h-[34px] rounded-full text-[11px] font-semibold transition-colors duration-150 ${
                    draftMins === m
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/80'
                  }`}
                >
                  {formatDuration(m)}
                </button>
              ))}
            </div>

            {draftCategory === 'recording' && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                  Watch Speed
                </span>
                <div className="ios-glass-control grid grid-cols-4 gap-1 rounded-full p-1">
                  {SPEED_OPTIONS.map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => {
                        haptics.tick();
                        setDraftSpeed(sp);
                      }}
                      className={`tabular-nums min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold transition-colors duration-150 ${
                        draftSpeed === sp
                          ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                          : 'text-[#0B234A]/75 dark:text-sky-200/80'
                      }`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Importance */}
          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Importance (How quick to finish)
            </label>
            <div className="ios-glass-control mt-1.5 grid grid-cols-4 gap-1 rounded-full p-1">
              {(['low', 'medium', 'high', 'urgent'] as TaskImportance[]).map((imp) => {
                const active = draftImportance === imp;
                return (
                  <button
                    key={imp}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setDraftImportance(imp);
                    }}
                    className={`min-h-[34px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? IMPORTANCE_META[imp].activeClass
                        : IMPORTANCE_META[imp].text
                    }`}
                  >
                    {IMPORTANCE_META[imp].short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deadline */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                Deadline (Used by Slot Suggester)
              </label>
              {draftDeadline && (
                <button
                  type="button"
                  onClick={() => setDraftDeadline('')}
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
                const active = draftDeadline === iso;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setDraftDeadline(iso);
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
                value={draftDeadline}
                min={todayISO}
                onChange={(e) => setDraftDeadline(e.target.value)}
                className="ios-glass-control tabular-nums min-h-[34px] flex-1 rounded-full px-3 text-xs font-semibold focus:outline-none"
              />
            </div>
          </div>

          <div className="ios-glass-control flex items-center justify-between rounded-full px-4 py-2.5 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
              <span>Auto-Lock Phone during catch-up slot</span>
            </span>
            <LiquidSwitch
              checked={draftAutoBlock}
              onToggle={() => setDraftAutoBlock((v) => !v)}
              ariaLabel="Toggle Auto-Lock Phone"
              activeColorClass="bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.45)]"
            />
          </div>

          <textarea
            rows={2}
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            placeholder="Timestamp stopped at, question numbers, or recording link note..."
            className="ios-glass-control w-full rounded-[24px] px-4 py-3 text-xs placeholder:text-[#0B234A]/45 focus:outline-none dark:placeholder:text-sky-200/45"
          />
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            disabled={!draftTitle.trim()}
            onClick={() => handleSaveItem(false)}
            className="ios-glass-control min-h-[48px] rounded-full px-4 text-xs font-semibold transition-transform duration-100 active:scale-95 disabled:opacity-45"
          >
            Save Only
          </button>
          <button
            type="button"
            disabled={!draftTitle.trim()}
            onClick={() => handleSaveItem(true)}
            className="min-h-[48px] flex-1 rounded-full bg-blue-600 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-[0.98] disabled:opacity-45 dark:bg-blue-500"
          >
            Save &amp; Suggest Slot
          </button>
        </div>
      </CrystalSheet>

      {/* Inspector Modal */}
      <CrystalSheet
        open={inspectItem !== null}
        onClose={() => setInspectId(null)}
        maxWidthClass="max-w-lg"
      >
        {inspectItem && (() => {
          const st = statsById[inspectItem.id];
          const subj = SUBJECT_META[inspectItem.subject];
          const unit = findSyllabusUnit(inspectItem.unitId);
          return (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                    {inspectItem.category === 'recording' ? 'Recording' : 'Homework'} ·{' '}
                    <span className={`font-semibold ${subj.text}`}>{subj.name}</span>
                    {unit ? ` · ${unit.code}` : ''}
                  </p>
                  <h2 className="mt-0.5 text-xl font-bold">{inspectItem.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectId(null)}
                  aria-label="Close inspector"
                  className="ios-glass-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-100 active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {inspectItem.notes && (
                <p className="mt-3 flex items-start gap-2 text-xs text-[#0B234A]/80 dark:text-sky-100/85">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span>{inspectItem.notes}</span>
                </p>
              )}

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#0B234A]/80 dark:text-sky-100/85">
                    Booked Catch-Up Sessions ({st.linkedSlots.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setInspectId(null);
                      openEditModal(inspectItem);
                    }}
                    className="text-xs font-semibold text-blue-600 dark:text-cyan-300"
                  >
                    Edit Details
                  </button>
                </div>

                {st.linkedSlots.length === 0 ? (
                  <div className="ios-glass-control mt-2 rounded-[22px] px-4 py-4 text-center text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                    No catch-up slots scheduled yet.
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {st.linkedSlots.map((slot) => {
                      const dur = getDurationMinutes(slot.startTime, slot.endTime);
                      const isDone = Object.values(dailyLogs).some((l) =>
                        l.completedSlotIds.includes(slot.id),
                      );
                      return (
                        <div
                          key={slot.id}
                          className="ios-glass-control flex items-center justify-between gap-2 rounded-[22px] px-3.5 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold">
                              {slot.day} · {formatTime12h(slot.startTime)} ({formatDuration(dur)})
                            </p>
                            <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                              {isDone ? 'Completed ✓' : 'Scheduled on Timetable'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                haptics.success();
                                onToggleLinkedSlotComplete(slot);
                              }}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                                isDone
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-blue-500/15 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                haptics.tap();
                                onDeleteLinkedSlot(slot.id);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-[#0B234A]/65 dark:text-sky-200/75"
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

              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onDeleteMissed(inspectItem.id);
                    setInspectId(null);
                  }}
                  className="ios-glass-control inline-flex min-h-[46px] items-center justify-center rounded-full px-4 text-xs font-semibold text-orange-600 dark:text-orange-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                {inspectItem.rescheduleLocked ? (
                  <div className="flex min-h-[46px] flex-1 items-center justify-center rounded-full border border-rose-500/35 bg-rose-500/12 px-4 text-xs font-bold text-rose-700 dark:text-rose-300">
                    Final Rescue Missed · Locked
                  </div>
                ) : (
                  <>
                    {st.remainingMins > 90 && (
                      <button
                        type="button"
                        onClick={() => handleAutoSplitRemaining(inspectItem)}
                        className="ios-glass-control min-h-[46px] rounded-full px-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                      >
                        Auto-Split All
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setInspectId(null);
                        openSuggesterForItem(inspectItem);
                      }}
                      className="min-h-[46px] flex-1 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 dark:bg-blue-500"
                    >
                      + Suggest Catch-Up Slot
                    </button>
                  </>
                )}
              </div>
            </>
          );
        })()}
      </CrystalSheet>
    </div>
  );
});
