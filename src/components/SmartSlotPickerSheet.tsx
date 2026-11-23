import { CalendarClock, Clock, RefreshCw, Sparkles, X } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { SUBJECT_META, SUGGEST_SESSION_CHIPS } from '../data/previewData';
import {
  FridayAnchor,
  FridayWeekOverrides,
  SlotSuggestion,
  SubjectId,
  TaskImportance,
  TimePreference,
  TimetableSlot,
} from '../types';
import {
  addDaysISO,
  formatDeadlineRelative,
  formatShortDateISO,
  getDayOfWeek,
  getTodayISO,
  getWeekDaysForOffset,
  parseISODateLocal,
} from '../utils/dateUtils';
import { haptics } from '../utils/haptics';
import {
  minutesToHHMM,
  resolveFridayModeForWeek,
  suggestSlotsForTask,
} from '../utils/schedulerEngine';
import { formatDuration, formatTime12h, getDurationMinutes, toMinutes } from '../utils/timeUtils';
import { CrystalSheet, LiquidSwitch } from './FluidControls';
import { GlassTimePicker } from './GlassTimePicker';

export interface SmartSlotPickerPayload {
  title: string;
  subject: SubjectId;
  durationMins: number;
  deadlineISO?: string;
  importance?: TaskImportance;
  autoBlockDefault?: boolean;
  badgeLabel?: string;
  subtitleNote?: string;
}

interface SmartSlotPickerSheetProps {
  open: boolean;
  target: SmartSlotPickerPayload | null;
  slots: TimetableSlot[];
  fridayAnchor: FridayAnchor;
  fridayOverrides: FridayWeekOverrides;
  onConfirmSlot: (suggestion: SlotSuggestion) => void;
  onClose: () => void;
}

export const SmartSlotPickerSheet = memo(function SmartSlotPickerSheet({
  open,
  target,
  slots,
  fridayAnchor,
  fridayOverrides,
  onConfirmSlot,
  onClose,
}: SmartSlotPickerSheetProps) {
  const todayISO = getTodayISO();
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [durMins, setDurMins] = useState<number>(60);
  const [timePref, setTimePref] = useState<TimePreference>('any');
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [pickedIdx, setPickedIdx] = useState<number>(0);
  const [scanSpin, setScanSpin] = useState<number>(0);

  // Manual controls
  const [manualDateISO, setManualDateISO] = useState<string>(todayISO);
  const [manualStart, setManualStart] = useState<string>('18:00');
  const [manualEnd, setManualEnd] = useState<string>('19:00');
  const [manualAutoBlock, setManualAutoBlock] = useState<boolean>(true);
  const [clockTarget, setClockTarget] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (!open || !target) return;
    const clampedDur = Math.max(15, Math.min(240, target.durationMins || 60));
    setDurMins(clampedDur);
    setMode('auto');
    setTimePref('any');
    setWeekOffset(0);
    setPickedIdx(0);
    setScanSpin(0);
    const tomorrow = addDaysISO(todayISO, 1);
    setManualDateISO(tomorrow);
    setManualStart('18:00');
    setManualEnd(minutesToHHMM(Math.min(1410, toMinutes('18:00') + clampedDur)));
    setManualAutoBlock(target.autoBlockDefault ?? true);
  }, [open, target, todayISO]);

  const suggestions = useMemo(() => {
    if (!open || !target) return [];
    const targetDays = getWeekDaysForOffset(weekOffset, new Date());
    const fridayMode = resolveFridayModeForWeek(
      targetDays[0]?.dateISO ?? todayISO,
      fridayAnchor,
      fridayOverrides,
    );
    const list = suggestSlotsForTask({
      slots,
      subject: target.subject,
      durationMins: durMins,
      timePreference: timePref,
      autoBlockDefault: target.autoBlockDefault ?? true,
      fridayWeekMode: fridayMode,
      fridayAnchor,
      fridayOverrides,
      scanWeekOffset: weekOffset,
      deadlineISO: target.deadlineISO,
      importance: target.importance,
    });
    if (scanSpin === 0 || list.length <= 1) return list;
    const shift = scanSpin % list.length;
    return [...list.slice(shift), ...list.slice(0, shift)];
  }, [
    open,
    target,
    weekOffset,
    todayISO,
    fridayAnchor,
    fridayOverrides,
    slots,
    durMins,
    timePref,
    scanSpin,
  ]);

  if (!target) return null;
  const subj = SUBJECT_META[target.subject];
  const selectedSug = suggestions[pickedIdx] ?? suggestions[0] ?? null;

  const manualDur = getDurationMinutes(manualStart, manualEnd);
  const manualValid = manualDur > 0 && Boolean(manualDateISO);

  const handleConfirmManual = () => {
    if (!manualValid) return;
    const dObj = parseISODateLocal(manualDateISO);
    const sug: SlotSuggestion = {
      id: `manual-${Date.now()}`,
      day: getDayOfWeek(dObj),
      dateISO: manualDateISO,
      startTime: manualStart,
      endTime: manualEnd,
      durationMins: manualDur,
      reason: target.subtitleNote ?? 'Scheduled manually',
      autoBlock: manualAutoBlock,
    };
    haptics.success();
    onConfirmSlot(sug);
  };

  return (
    <CrystalSheet
      open={open}
      onClose={onClose}
      zIndexClass="z-[85]"
      maxWidthClass="max-w-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${subj.text}`}>
            {target.badgeLabel ?? `${subj.name} · Smart Slot Picker`}
          </p>
          <h2 className="mt-0.5 truncate text-lg font-semibold text-[#07142B] dark:text-white">
            {target.title}
          </h2>
          {target.deadlineISO && (
            <p className="mt-0.5 text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Deadline: {formatShortDateISO(target.deadlineISO)} ({formatDeadlineRelative(target.deadlineISO, todayISO)})
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close slot picker"
          className="ios-glass-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#07142B] dark:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode Switcher: Auto-Suggest vs Manual */}
      <div className="ios-glass-control mt-3 grid grid-cols-2 gap-1 rounded-full p-1">
        <button
          type="button"
          onClick={() => {
            haptics.tick();
            setMode('auto');
          }}
          className={`min-h-[36px] rounded-full text-xs font-semibold transition-colors ${
            mode === 'auto'
              ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
              : 'text-[#0B234A]/75 dark:text-sky-200/80'
          }`}
        >
          Auto-Suggest Free Gaps
        </button>
        <button
          type="button"
          onClick={() => {
            haptics.tick();
            setMode('manual');
          }}
          className={`min-h-[36px] rounded-full text-xs font-semibold transition-colors ${
            mode === 'manual'
              ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
              : 'text-[#0B234A]/75 dark:text-sky-200/80'
          }`}
        >
          Pick Date &amp; Time
        </button>
      </div>

      {mode === 'auto' ? (
        <div className="mt-3 space-y-3">
          {/* Duration selector */}
          <div>
            <p className="text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Session length
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SUGGEST_SESSION_CHIPS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setDurMins(mins);
                    setPickedIdx(0);
                  }}
                  className={`min-h-[32px] rounded-full px-3 text-[11px] font-semibold transition-colors ${
                    durMins === mins
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'ios-glass-control text-[#0B234A]/80 dark:text-sky-100/85'
                  }`}
                >
                  {formatDuration(mins)}
                </button>
              ))}
            </div>
          </div>

          {/* Time Preference + Week Offset */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: 'any', label: 'Any' },
                  { id: 'morning', label: 'Morning' },
                  { id: 'afternoon', label: 'Afternoon' },
                  { id: 'night', label: 'Night' },
                ] as const
              ).map((pref) => (
                <button
                  key={pref.id}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setTimePref(pref.id);
                    setPickedIdx(0);
                  }}
                  className={`min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold ${
                    timePref === pref.id
                      ? 'bg-cyan-500/25 text-blue-800 ring-1 ring-blue-500/50 dark:text-cyan-200 dark:ring-cyan-300/60'
                      : 'ios-glass-control text-[#0B234A]/75 dark:text-sky-200/75'
                  }`}
                >
                  {pref.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              {[0, 1].map((wOff) => (
                <button
                  key={wOff}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setWeekOffset(wOff);
                    setPickedIdx(0);
                  }}
                  className={`min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold ${
                    weekOffset === wOff
                      ? 'bg-blue-600 text-white dark:bg-blue-500'
                      : 'ios-glass-control text-[#0B234A]/75 dark:text-sky-200/75'
                  }`}
                >
                  {wOff === 0 ? 'This Week' : 'Next Week'}
                </button>
              ))}
            </div>
          </div>

          {/* Suggested Windows List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#07142B] dark:text-white">
                Best Open Windows
              </p>
              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setScanSpin((c) => c + 1);
                  setPickedIdx(0);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-cyan-300"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Shuffle options</span>
              </button>
            </div>

            {suggestions.length === 0 ? (
              <div className="ios-glass-control rounded-[20px] p-4 text-center text-xs text-[#0B234A]/75 dark:text-sky-200/80">
                No clean {formatDuration(durMins)} gap found in this week. Try shorter duration or Pick Date &amp; Time.
              </div>
            ) : (
              suggestions.slice(0, 4).map((sug, idx) => {
                const isSelected = idx === pickedIdx;
                return (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setPickedIdx(idx);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-[20px] border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/15 dark:border-cyan-300 dark:bg-cyan-400/15'
                        : 'ios-glass-control border-transparent'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#07142B] dark:text-white">
                        {sug.day} · {sug.dateISO ? formatShortDateISO(sug.dateISO) : 'This week'}
                      </p>
                      <p className="tabular-nums mt-0.5 text-[11px] font-semibold text-blue-700 dark:text-cyan-200">
                        {formatTime12h(sug.startTime)} – {formatTime12h(sug.endTime)} ({formatDuration(sug.durationMins)})
                      </p>
                      <p className="mt-0.5 truncate text-[10.5px] text-[#0B234A]/70 dark:text-sky-200/75">
                        {sug.reason}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        isSelected
                          ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-[#04143B]'
                          : 'bg-blue-500/12 text-blue-700 dark:text-sky-200'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Pick'}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            disabled={!selectedSug}
            onClick={() => {
              if (!selectedSug) return;
              haptics.success();
              onConfirmSlot(selectedSug);
            }}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-semibold text-white shadow-md transition-transform active:scale-[0.98] disabled:opacity-45 dark:bg-blue-500"
          >
            <Sparkles className="h-4 w-4" />
            <span>Confirm &amp; Schedule Slot</span>
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#07142B] dark:text-white">
              Target Date
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="date"
                value={manualDateISO}
                onChange={(e) => setManualDateISO(e.target.value)}
                className="ios-glass-control min-h-[42px] flex-1 rounded-full px-4 text-xs font-semibold text-[#07142B] focus:outline-none dark:text-white"
              />
              {[0, 1, 2].map((dOff) => {
                const iso = addDaysISO(todayISO, dOff);
                return (
                  <button
                    key={dOff}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setManualDateISO(iso);
                    }}
                    className={`min-h-[38px] rounded-full px-3 text-[11px] font-semibold ${
                      manualDateISO === iso
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'ios-glass-control text-[#0B234A]/80 dark:text-sky-100'
                    }`}
                  >
                    {dOff === 0 ? 'Today' : dOff === 1 ? 'Tmrw' : formatShortDateISO(iso)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setClockTarget('start')}
              className="ios-glass-control flex min-h-[54px] flex-col justify-center rounded-[20px] px-3.5 text-left"
            >
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0B234A]/65 dark:text-sky-200/70">
                <Clock className="h-3 w-3" /> Start Time
              </span>
              <span className="tabular-nums text-sm font-bold text-[#07142B] dark:text-white">
                {formatTime12h(manualStart)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setClockTarget('end')}
              className="ios-glass-control flex min-h-[54px] flex-col justify-center rounded-[20px] px-3.5 text-left"
            >
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0B234A]/65 dark:text-sky-200/70">
                <CalendarClock className="h-3 w-3" /> End Time
              </span>
              <span className="tabular-nums text-sm font-bold text-[#07142B] dark:text-white">
                {formatTime12h(manualEnd)}
              </span>
            </button>
          </div>

          <div className="ios-glass-control flex items-center justify-between rounded-[20px] px-4 py-2.5">
            <span className="text-xs font-semibold text-[#07142B] dark:text-white">
              Enforce Focus Blocker during slot
            </span>
            <LiquidSwitch
              checked={manualAutoBlock}
              onToggle={() => setManualAutoBlock((v) => !v)}
              ariaLabel="Toggle blocker for scheduled slot"
            />
          </div>

          <button
            type="button"
            disabled={!manualValid}
            onClick={handleConfirmManual}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-semibold text-white shadow-md transition-transform active:scale-[0.98] disabled:opacity-45 dark:bg-blue-500"
          >
            <span>
              Schedule ({manualValid ? formatDuration(manualDur) : 'Invalid range'})
            </span>
          </button>

          {clockTarget && (
            <GlassTimePicker
              open={true}
              label={clockTarget === 'start' ? 'Pick Start Time' : 'Pick End Time'}
              value={clockTarget === 'start' ? manualStart : manualEnd}
              onChange={(val) => {
                if (clockTarget === 'start') {
                  setManualStart(val);
                  const nextEnd = Math.min(1425, toMinutes(val) + durMins);
                  setManualEnd(minutesToHHMM(nextEnd));
                } else {
                  setManualEnd(val);
                }
              }}
              onClose={() => setClockTarget(null)}
            />
          )}
        </div>
      )}
    </CrystalSheet>
  );
});
