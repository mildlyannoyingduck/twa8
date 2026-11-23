import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Split,
  Trophy,
  XCircle,
} from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { SUBJECT_META } from '../data/previewData';
import { TimetableSlot } from '../types';
import { formatShortDateISO } from '../utils/dateUtils';
import { haptics } from '../utils/haptics';
import { XP_VALUES } from '../utils/progressionEngine';
import { formatDuration, formatTime12h, getDurationMinutes } from '../utils/timeUtils';
import { CrystalSheet } from './FluidControls';

export interface PendingCheckInItem {
  key: string; // `${dateISO}::${slot.id}`
  dateISO: string;
  slot: TimetableSlot;
}

interface SlotCheckInModalProps {
  queue: PendingCheckInItem[];
  onComplete: (item: PendingCheckInItem) => void;
  onSplitAndFinish: (item: PendingCheckInItem, percentDone: number) => void;
  onMissedChooseRescue: (item: PendingCheckInItem) => void;
  onMissedDrop: (item: PendingCheckInItem) => void;
  onDoubleBustLock: (item: PendingCheckInItem) => void;
  onDismissForNow: () => void;
}

export const SlotCheckInModal = memo(function SlotCheckInModal({
  queue,
  onComplete,
  onSplitAndFinish,
  onMissedChooseRescue,
  onMissedDrop,
  onDoubleBustLock,
  onDismissForNow,
}: SlotCheckInModalProps) {
  const current = queue[0] ?? null;
  const [step, setStep] = useState<'ask' | 'split' | 'missed-rescue'>('ask');
  const [splitPercent, setSplitPercent] = useState<number>(50);

  useEffect(() => {
    setStep('ask');
    setSplitPercent(50);
  }, [current?.key]);

  if (!current) return null;

  const { slot, dateISO } = current;
  const subj = SUBJECT_META[slot.subject];
  const durMins = getDurationMinutes(slot.startTime, slot.endTime);
  const doneMins = Math.max(5, Math.round((durMins * splitPercent) / 100));
  const remainingMins = Math.max(15, durMins - doneMins);

  const isRescue = Boolean(slot.isRescueSlot);
  const winXp = isRescue
    ? XP_VALUES.rescueComeback
    : slot.category === 'class'
      ? XP_VALUES.classComplete
      : XP_VALUES.selfStudyComplete;

  return (
    <CrystalSheet
      open={Boolean(current)}
      onClose={onDismissForNow}
      zIndexClass="z-[80]"
      maxWidthClass="max-w-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-blue-700 dark:text-cyan-300">
            End-of-Session Check-In {queue.length > 1 ? `· 1 of ${queue.length}` : ''}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-[#07142B] dark:text-white">
            Did you finish this session?
          </h2>
        </div>

        {isRescue && (
          <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            RESCUE · FINAL CHANCE
          </span>
        )}
      </div>

      {/* Session Preview Card */}
      <div className="ios-glass-control mt-3 rounded-[22px] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-bold ${subj.text}`}>{subj.name}</span>
          <span className="tabular-nums text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
            {formatShortDateISO(dateISO)} · {formatTime12h(slot.startTime)}–{formatTime12h(slot.endTime)}
          </span>
        </div>
        <p className="mt-1 text-base font-bold text-[#07142B] dark:text-white">
          {slot.title}
        </p>
        <p className="mt-0.5 text-xs text-[#0B234A]/75 dark:text-sky-200/80">
          {slot.subtitle} · {formatDuration(durMins)}
        </p>
      </div>

      {step === 'ask' && (
        <div className="mt-4 space-y-2.5">
          {/* Option 1: Completed */}
          <button
            type="button"
            onClick={() => {
              haptics.success();
              onComplete(current);
            }}
            className="flex min-h-[50px] w-full items-center justify-between rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-md transition-transform active:scale-[0.98]"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4.5 w-4.5" />
              <span>Yes, Finished</span>
            </span>
            <span className="tabular-nums inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
              <Trophy className="h-3 w-3" />+{winXp} XP
            </span>
          </button>

          {/* Option 2: Split & Finish (Partial, Zero Penalty) */}
          {!isRescue && (
            <button
              type="button"
              onClick={() => {
                haptics.tick();
                setStep('split');
              }}
              className="ios-glass-control flex min-h-[48px] w-full items-center justify-between rounded-full px-5 text-sm font-semibold text-[#07142B] transition-transform active:scale-[0.98] dark:text-white"
            >
              <span className="inline-flex items-center gap-2">
                <Split className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
                <span>Split &amp; Finish</span>
              </span>
              <span className="text-xs font-medium text-blue-700 dark:text-cyan-300">
                No penalty · Move rest
              </span>
            </button>
          )}

          {/* Option 3: Missed */}
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              if (isRescue) {
                onDoubleBustLock(current);
              } else {
                setStep('missed-rescue');
              }
            }}
            className="flex min-h-[48px] w-full items-center justify-between rounded-full border border-rose-500/40 bg-rose-500/12 px-5 text-sm font-semibold text-rose-700 transition-transform active:scale-[0.98] dark:text-rose-300"
          >
            <span className="inline-flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span>No, Missed It</span>
            </span>
            <span className="tabular-nums text-xs font-bold">
              {isRescue
                ? `${XP_VALUES.secondMissDoubleBust} XP · Final Lock`
                : `${XP_VALUES.firstMissPenalty} XP · 1x Rescue`}
            </span>
          </button>

          <button
            type="button"
            onClick={onDismissForNow}
            className="w-full py-1.5 text-center text-[11px] font-medium text-[#0B234A]/60 dark:text-sky-200/60"
          >
            Remind me later
          </button>
        </div>
      )}

      {step === 'split' && (
        <div className="mt-4 space-y-3">
          <div className="ios-glass-control rounded-[22px] p-3.5">
            <p className="text-xs font-semibold text-[#07142B] dark:text-white">
              How much did you finish cleanly? (Zero penalty)
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {[25, 50, 75].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setSplitPercent(pct);
                  }}
                  className={`min-h-[40px] rounded-full text-xs font-bold transition-colors ${
                    splitPercent === pct
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'ios-glass-tile text-[#07142B] dark:text-sky-100'
                  }`}
                >
                  {pct}% Done
                </button>
              ))}
            </div>
            <p className="tabular-nums mt-2.5 text-[11px] font-medium text-blue-700 dark:text-cyan-300">
              Logs {formatDuration(doneMins)} completed (+{Math.max(5, Math.round((winXp * splitPercent) / 100))} XP) · Schedules {formatDuration(remainingMins)} follow-up
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStep('ask')}
              className="ios-glass-control min-h-[44px] rounded-full text-xs font-semibold text-[#0B234A] dark:text-sky-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.success();
                onSplitAndFinish(current, splitPercent);
              }}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-blue-600 text-xs font-semibold text-white shadow-sm dark:bg-blue-500"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span>Schedule Remaining</span>
            </button>
          </div>
        </div>
      )}

      {step === 'missed-rescue' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-[22px] border border-rose-500/35 bg-rose-500/12 p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
              <div>
                <p className="text-xs font-bold text-rose-700 dark:text-rose-200">
                  {XP_VALUES.firstMissPenalty} Trophy XP Penalty · Use 1-Time Rescue?
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#0B234A]/80 dark:text-sky-100/80">
                  Arrange one recovery slot now (Auto-Suggest or Manual). Finish it to win back{' '}
                  <strong>+{XP_VALUES.rescueComeback} XP Comeback</strong>. Miss it again for{' '}
                  <strong>{XP_VALUES.secondMissDoubleBust} XP</strong> with no third chance.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onMissedChooseRescue(current);
            }}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-semibold text-white shadow-md transition-transform active:scale-[0.98] dark:bg-blue-500"
          >
            <Clock className="h-4 w-4" />
            <span>Arrange 1-Time Rescue Slot</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStep('ask')}
              className="ios-glass-control min-h-[42px] rounded-full text-xs font-semibold text-[#0B234A] dark:text-sky-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onMissedDrop(current);
              }}
              className="min-h-[42px] rounded-full border border-rose-500/35 bg-rose-500/10 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              Take -30 XP &amp; Drop
            </button>
          </div>
        </div>
      )}
    </CrystalSheet>
  );
});
