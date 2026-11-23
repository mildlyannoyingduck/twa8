import { Check, Clock, Lock, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DAYS_ORDER, SUBJECT_META } from '../data/previewData';
import {
  DayOfWeek,
  FridayAnchor,
  FridayWeekMode,
  FridayWeekOverrides,
  RevisionStage,
  SlotSuggestion,
  TimetableSlot,
} from '../types';
import { haptics } from '../utils/haptics';
import { minutesToHHMM, suggestThreeStepRevisionLoop } from '../utils/schedulerEngine';
import { formatDuration, formatTime12h, toMinutes } from '../utils/timeUtils';
import { CrystalSheet } from './FluidControls';
import { GlassTimePicker } from './GlassTimePicker';

interface ReviseLoopSheetProps {
  open: boolean;
  classSlot: TimetableSlot | null;
  allSlots: TimetableSlot[];
  fridayWeekMode?: FridayWeekMode;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  onApproveLoop: (
    classSlot: TimetableSlot,
    stages: Record<RevisionStage, SlotSuggestion>,
  ) => void;
  onClose: () => void;
}

const STAGE_META: Record<
  RevisionStage,
  { badge: string; title: string }
> = {
  r1: {
    badge: 'R1',
    title: 'Quick Consolidation',
  },
  r2: {
    badge: 'R2',
    title: 'Deep Revise Session',
  },
  r3: {
    badge: 'R3',
    title: 'Pre-Class Warm-Up',
  },
};

const QUICK_DURATION_OPTIONS = [20, 30, 45, 60, 90];

export function ReviseLoopSheet({
  open,
  classSlot,
  allSlots,
  fridayWeekMode = 'bio-week',
  fridayAnchor,
  fridayOverrides,
  onApproveLoop,
  onClose,
}: ReviseLoopSheetProps) {
  const [r1Mins, setR1Mins] = useState(30);
  const [r2Mins, setR2Mins] = useState(60);
  const [r3Mins, setR3Mins] = useState(30);
  const [drafts, setDrafts] = useState<Record<RevisionStage, SlotSuggestion> | null>(null);
  const [clockStage, setClockStage] = useState<RevisionStage | null>(null);

  const recompute = (
    slot: TimetableSlot,
    d1: number,
    d2: number,
    d3: number,
  ) => {
    const generated = suggestThreeStepRevisionLoop({
      classSlot: slot,
      allSlots,
      r1Mins: d1,
      r2Mins: d2,
      r3Mins: d3,
      autoBlockDefault: slot.autoBlock,
      fridayWeekMode,
      fridayAnchor,
      fridayOverrides,
    });
    setDrafts(generated);
  };

  useEffect(() => {
    if (!open || !classSlot) return;
    setR1Mins(30);
    setR2Mins(60);
    setR3Mins(30);
    recompute(classSlot, 30, 60, 30);
  }, [open, classSlot]);

  const updateStageDuration = (stage: RevisionStage, mins: number) => {
    haptics.tick();
    if (stage === 'r1') setR1Mins(mins);
    if (stage === 'r2') setR2Mins(mins);
    if (stage === 'r3') setR3Mins(mins);

    setDrafts((prev) => {
      if (!prev) return prev;
      const cur = prev[stage];
      const startMin = toMinutes(cur.startTime);
      const nextEndMin = Math.min(1440, startMin + mins);
      return {
        ...prev,
        [stage]: {
          ...cur,
          durationMins: mins,
          endTime: minutesToHHMM(nextEndMin),
        },
      };
    });
  };

  const updateStageField = <K extends keyof SlotSuggestion>(
    stage: RevisionStage,
    key: K,
    value: SlotSuggestion[K],
  ) => {
    setDrafts((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [stage]: {
          ...prev[stage],
          [key]: value,
        },
      };
    });
  };

  const isVisible = Boolean(open && classSlot && drafts);
  const subj = classSlot ? SUBJECT_META[classSlot.subject] : null;

  return (
    <>
      <CrystalSheet open={isVisible} onClose={onClose} zIndexClass="z-[60]" maxWidthClass="max-w-lg">
        {classSlot && drafts && subj && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                  <span className={subj.text}>{subj.name}</span> · {classSlot.day}{' '}
                  {formatTime12h(classSlot.startTime)}
                  {classSlot.mode === 'physical' ? ' · 2h commute aware' : ' · Online'}
                </p>
                <h2 className="mt-0.5 truncate text-lg font-semibold">
                  3-Step Revise Loop
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    recompute(classSlot, r1Mins, r2Mins, r3Mins);
                  }}
                  aria-label="Regenerate suggestions"
                  className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close revise loop sheet"
                  className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(['r1', 'r2', 'r3'] as RevisionStage[]).map((stage) => {
                const info = STAGE_META[stage];
                const item = drafts[stage];
                return (
                  <div
                    key={stage}
                    className="ios-glass-control rounded-[26px] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${subj.text}`}>
                            {info.badge}
                          </span>
                          <span className="text-sm font-semibold">
                            {info.title}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                          {item.reason}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          haptics.tick();
                          updateStageField(stage, 'autoBlock', !item.autoBlock);
                        }}
                        className={`inline-flex min-h-[30px] items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 active:scale-95 ${
                          item.autoBlock
                            ? 'bg-emerald-500/22 text-emerald-800 dark:text-emerald-200'
                            : 'bg-blue-500/12 text-[#0B234A]/70 dark:text-sky-200/75'
                        }`}
                      >
                        <Lock className="h-3 w-3" />
                        <span>{item.autoBlock ? 'Lock' : 'Open'}</span>
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <select
                        value={item.day}
                        onChange={(e) => {
                          haptics.tick();
                          updateStageField(stage, 'day', e.target.value as DayOfWeek);
                        }}
                        className="ios-glass-control min-h-[38px] rounded-full px-3 text-xs font-semibold text-[#07142B] focus:outline-none dark:text-white"
                      >
                        {DAYS_ORDER.map((d) => (
                          <option
                            key={d}
                            value={d}
                            className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white"
                          >
                            {d}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          setClockStage(stage);
                        }}
                        className="ios-glass-control tabular-nums inline-flex min-h-[38px] flex-1 items-center justify-between gap-2 rounded-full px-3.5 text-xs font-semibold transition-transform duration-100 active:scale-[0.98]"
                      >
                        <span>
                          {formatTime12h(item.startTime)} – {formatTime12h(item.endTime)}
                        </span>
                        <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-sky-300" />
                      </button>
                    </div>

                    <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      <span className="mr-1 shrink-0 text-[11px] text-[#0B234A]/65 dark:text-sky-200/70">
                        Length:
                      </span>
                      {QUICK_DURATION_OPTIONS.map((mins) => {
                        const active = item.durationMins === mins;
                        return (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => updateStageDuration(stage, mins)}
                            className={`tabular-nums min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 active:scale-95 ${
                              active
                                ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                                : 'bg-blue-500/12 text-[#0B234A]/80 dark:text-sky-100/85'
                            }`}
                          >
                            {formatDuration(mins)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="ios-glass-control min-h-[48px] rounded-full px-5 text-xs font-semibold transition-transform duration-100 active:scale-95"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.success();
                  onApproveLoop(classSlot, drafts);
                }}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-[0.98] dark:bg-blue-500"
              >
                <Check className="h-4 w-4" />
                <span>Approve All 3 &amp; Add</span>
              </button>
            </div>
          </>
        )}
      </CrystalSheet>

      {clockStage !== null && (
        <GlassTimePicker
          open
          label={`${STAGE_META[clockStage].badge} Start Time`}
          value={drafts ? drafts[clockStage].startTime : '16:00'}
          onChange={(newStart) => {
            const dur = drafts?.[clockStage].durationMins ?? 30;
            const startMin = toMinutes(newStart);
            const nextEnd = minutesToHHMM(Math.min(1440, startMin + dur));
            setDrafts((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                [clockStage]: {
                  ...prev[clockStage],
                  startTime: newStart,
                  endTime: nextEnd,
                },
              };
            });
          }}
          onClose={() => setClockStage(null)}
        />
      )}
    </>
  );
}
