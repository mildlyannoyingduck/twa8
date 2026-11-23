import {
  CalendarPlus,
  Compass,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { SUBJECT_GLASS_CARD, SUBJECT_META } from '../data/previewData';
import {
  FridayAnchor,
  FridayWeekOverrides,
  MissedLessonItem,
  PaperEntry,
  StudyTask,
  SubjectId,
  TimetableSlot,
} from '../types';
import { haptics } from '../utils/haptics';
import {
  SuggestedWeeklyTaskPlan,
  suggestLeastSelfStudyFocus,
} from '../utils/schedulerEngine';
import { formatDuration } from '../utils/timeUtils';
import { CrystalSheet } from './FluidControls';

interface WeeklyFocusSuggestSheetProps {
  open: boolean;
  slots: TimetableSlot[];
  tasks: StudyTask[];
  missedItems: MissedLessonItem[];
  papers: PaperEntry[];
  unitCoveredMap: Record<string, boolean>;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  onSaveTaskOnly: (plan: SuggestedWeeklyTaskPlan, durationMins: number) => void;
  onAcceptAndSchedule: (plan: SuggestedWeeklyTaskPlan, durationMins: number) => void;
  onClose: () => void;
}

const SOURCE_LABELS: Record<SuggestedWeeklyTaskPlan['source'], string> = {
  'existing-task': 'From Active Queue',
  'missed-item': 'From Missed Backlog',
  'paper-review': 'Past Paper Review',
  'syllabus-unit': 'Next Syllabus Unit',
  'general-drill': 'Weekly Self-Study Boost',
};

const DURATION_OPTIONS = [45, 60, 90, 120];

export const WeeklyFocusSuggestSheet = memo(function WeeklyFocusSuggestSheet({
  open,
  slots,
  tasks,
  missedItems,
  papers,
  unitCoveredMap,
  fridayAnchor,
  fridayOverrides,
  onSaveTaskOnly,
  onAcceptAndSchedule,
  onClose,
}: WeeklyFocusSuggestSheetProps) {
  const [selectedSubject, setSelectedSubject] = useState<SubjectId | undefined>(undefined);
  const [taskIdx, setTaskIdx] = useState(0);
  const [durationMins, setDurationMins] = useState(60);

  const analysis = useMemo(
    () =>
      suggestLeastSelfStudyFocus({
        slots,
        tasks,
        missedItems,
        papers,
        unitCoveredMap,
        fridayAnchor,
        fridayOverrides,
        preferredSubject: selectedSubject,
      }),
    [
      slots,
      tasks,
      missedItems,
      papers,
      unitCoveredMap,
      fridayAnchor,
      fridayOverrides,
      selectedSubject,
    ],
  );

  useEffect(() => {
    if (open) {
      setSelectedSubject(undefined);
      setTaskIdx(0);
    }
  }, [open]);

  const activePlan =
    analysis.suggestedTasks[taskIdx % Math.max(1, analysis.suggestedTasks.length)] ??
    analysis.primaryTask;

  useEffect(() => {
    if (activePlan) {
      setDurationMins(activePlan.durationMins);
    }
  }, [activePlan?.id]);

  const activeMeta = SUBJECT_META[analysis.activeSubject];
  const maxSelfMins = Math.max(
    60,
    ...analysis.selfStudyRankings.map((r) => r.selfStudyMins),
  );

  return (
    <CrystalSheet open={open} onClose={onClose} zIndexClass="z-[66]" maxWidthClass="max-w-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Weekly Plan Auto-Suggest · All Tiers</span>
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[#07142B] dark:text-white">
            Least Self-Study Focus Finder
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close auto-suggest"
          className="ios-glass-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#07142B] dark:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Weekly Self-Study Plan Breakdown */}
      <div className="mt-3.5">
        <p className="text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
          Planned self-study hours in this week&apos;s Timetable (tap any subject to compare):
        </p>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {analysis.selfStudyRankings.map((stat) => {
            const meta = SUBJECT_META[stat.subject];
            const isRecommended = stat.subject === analysis.recommendedSubject;
            const isSelected = stat.subject === analysis.activeSubject;
            const pct = Math.min(100, Math.round((stat.selfStudyMins / maxSelfMins) * 100));

            return (
              <button
                key={stat.subject}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setSelectedSubject(stat.subject);
                  setTaskIdx(0);
                }}
                className={`rounded-[22px] border p-3 text-left transition-transform duration-100 active:scale-[0.98] ${
                  SUBJECT_GLASS_CARD[stat.subject]
                } ${
                  isSelected
                    ? 'ring-2 ring-blue-500/80 dark:ring-cyan-300/80'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold ${meta.text}`}>{meta.short}</span>
                  {isRecommended && (
                    <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white dark:bg-cyan-400 dark:text-[#04143B]">
                      Least
                    </span>
                  )}
                </div>
                <p className="tabular-nums mt-1.5 text-base font-bold text-[#07142B] dark:text-white">
                  {stat.selfStudyMins > 0 ? formatDuration(stat.selfStudyMins) : '0m'}
                </p>
                <p className="tabular-nums text-[10px] text-[#0B234A]/65 dark:text-sky-200/70">
                  {stat.selfStudyCount} study slot{stat.selfStudyCount === 1 ? '' : 's'}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/45 dark:bg-sky-300/15">
                  <div
                    className={`h-full rounded-full ${meta.bar}`}
                    style={{ width: `${Math.max(8, pct)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Why this subject + Recommended Task */}
      {activePlan && (
        <div
          className={`mt-3.5 rounded-[26px] border p-4 ${
            SUBJECT_GLASS_CARD[activePlan.subject]
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/55 px-2.5 py-0.5 text-[10.5px] font-bold text-[#07142B] dark:bg-sky-950/60 dark:text-cyan-200">
              <Compass className="h-3 w-3 text-blue-600 dark:text-cyan-300" />
              <span>{SOURCE_LABELS[activePlan.source]}</span>
            </span>

            {analysis.suggestedTasks.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setTaskIdx((i) => (i + 1) % analysis.suggestedTasks.length);
                }}
                className="ios-glass-control inline-flex min-h-[28px] items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-blue-700 transition-transform active:scale-95 dark:text-cyan-300"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Next Idea ({(taskIdx % analysis.suggestedTasks.length) + 1}/{analysis.suggestedTasks.length})</span>
              </button>
            )}
          </div>

          <p className={`mt-2.5 text-xs font-bold ${activeMeta.text}`}>
            Recommended Focus · {activeMeta.name}
          </p>
          <h3 className="mt-0.5 text-base font-bold leading-snug text-[#07142B] dark:text-white">
            {activePlan.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[#0B234A]/80 dark:text-sky-100/80">
            {analysis.reason}
          </p>
          <p className="mt-1 text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
            {activePlan.subtitle}
          </p>

          <div className="mt-3">
            <p className="text-[11px] font-semibold text-[#0B234A]/75 dark:text-sky-200/80">
              Session Length
            </p>
            <div className="ios-glass-control mt-1.5 grid grid-cols-4 gap-1 rounded-full p-1">
              {DURATION_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setDurationMins(mins);
                  }}
                  className={`tabular-nums min-h-[32px] rounded-full text-xs font-semibold transition-colors ${
                    durationMins === mins
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/80'
                  }`}
                >
                  {formatDuration(mins)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {activePlan && activePlan.source !== 'existing-task' && (
          <button
            type="button"
            onClick={() => {
              haptics.success();
              onSaveTaskOnly(activePlan, durationMins);
              onClose();
            }}
            className="ios-glass-control inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold text-[#07142B] transition-transform active:scale-95 dark:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add to Planner</span>
          </button>
        )}

        {activePlan && (
          <button
            type="button"
            onClick={() => {
              haptics.success();
              onClose();
              onAcceptAndSchedule(activePlan, durationMins);
            }}
            className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform active:scale-[0.98]"
          >
            <CalendarPlus className="h-4 w-4" />
            <span>Schedule Time Slot</span>
          </button>
        )}
      </div>
    </CrystalSheet>
  );
});
