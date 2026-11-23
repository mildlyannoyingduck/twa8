import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { haptics } from '../utils/haptics';
import { CrystalSheet } from './FluidControls';

interface GlassTimePickerProps {
  open: boolean;
  label: string;
  value: string; // HH:MM 24h
  onChange: (newValue: string) => void;
  onClose: () => void;
}

const MINUTE_PRESETS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function GlassTimePicker({
  open,
  label,
  value,
  onChange,
  onClose,
}: GlassTimePickerProps) {
  const [hour12, setHour12] = useState(8);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    if (!open) return;
    const [hRaw, mRaw] = value.split(':').map(Number);
    const h = isNaN(hRaw) ? 8 : hRaw;
    const m = isNaN(mRaw) ? 0 : mRaw;
    setPeriod(h >= 12 ? 'PM' : 'AM');
    setHour12(h % 12 === 0 ? 12 : h % 12);
    setMinute(m);
  }, [open, value]);

  const commit = (h12: number, min: number, per: 'AM' | 'PM') => {
    haptics.tap();
    let h24 = h12 % 12;
    if (per === 'PM') h24 += 12;
    const formatted = `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    onChange(formatted);
    onClose();
  };

  const stepHour = (delta: number) => {
    haptics.tick();
    setHour12((prev) => ((prev - 1 + delta + 12) % 12) + 1);
  };

  const stepMinute = (delta: number) => {
    haptics.tick();
    setMinute((prev) => (prev + delta + 60) % 60);
  };

  return (
    <CrystalSheet open={open} onClose={onClose} zIndexClass="z-[70]" maxWidthClass="max-w-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
            Custom Time
          </p>
          <h3 className="text-lg font-semibold tracking-tight">{label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close clock picker"
          className="ios-glass-control inline-flex h-10 w-10 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <div className="ios-glass-control flex flex-col items-center rounded-[28px] px-4 py-2.5">
          <button
            type="button"
            onClick={() => stepHour(1)}
            aria-label="Increase hour"
            className="flex h-9 w-11 items-center justify-center rounded-full text-[#0B234A]/75 transition-transform duration-100 hover:bg-blue-500/15 active:scale-85 dark:text-sky-200"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <span className="tabular-nums my-1 text-4xl font-bold tracking-tight">
            {String(hour12).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => stepHour(-1)}
            aria-label="Decrease hour"
            className="flex h-9 w-11 items-center justify-center rounded-full text-[#0B234A]/75 transition-transform duration-100 hover:bg-blue-500/15 active:scale-85 dark:text-sky-200"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <span className="text-3xl font-bold text-[#0B234A]/50 dark:text-sky-200/60">
          :
        </span>

        <div className="ios-glass-control flex flex-col items-center rounded-[28px] px-4 py-2.5">
          <button
            type="button"
            onClick={() => stepMinute(1)}
            aria-label="Increase minute"
            className="flex h-9 w-11 items-center justify-center rounded-full text-[#0B234A]/75 transition-transform duration-100 hover:bg-blue-500/15 active:scale-85 dark:text-sky-200"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <span className="tabular-nums my-1 text-4xl font-bold tracking-tight">
            {String(minute).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => stepMinute(-1)}
            aria-label="Decrease minute"
            className="flex h-9 w-11 items-center justify-center rounded-full text-[#0B234A]/75 transition-transform duration-100 hover:bg-blue-500/15 active:scale-85 dark:text-sky-200"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <div className="ios-glass-control relative flex flex-col gap-1.5 rounded-[26px] p-1.5">
          {(['AM', 'PM'] as const).map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setPeriod(p);
                }}
                className={`min-h-[42px] rounded-full px-3.5 text-xs font-semibold transition-colors duration-150 ${
                  active
                    ? 'bg-blue-600 text-white shadow-md dark:bg-blue-500'
                    : 'text-[#0B234A]/75 dark:text-sky-200/80'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
          Quick Minutes
        </p>
        <div className="mt-2 grid grid-cols-6 gap-1.5">
          {MINUTE_PRESETS.map((m) => {
            const active = minute === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setMinute(m);
                }}
                className={`tabular-nums min-h-[36px] rounded-full text-xs font-semibold transition-colors duration-150 active:scale-95 ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                    : 'ios-glass-control text-[#07142B] dark:text-sky-100'
                }`}
              >
                :{String(m).padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => commit(hour12, minute, period)}
        className="mt-5 min-h-[48px] w-full rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-[0.98] dark:bg-blue-500"
      >
        Set {String(hour12).padStart(2, '0')}:{String(minute).padStart(2, '0')} {period}
      </button>
    </CrystalSheet>
  );
}
