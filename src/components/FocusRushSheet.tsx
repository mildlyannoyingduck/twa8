import {
  CheckCircle2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { memo, useState } from 'react';
import { SAMSUNG_A07_ALLOWLIST } from '../native/thisWeekBridge';
import {
  ActiveLockInfo,
  ProgressionState,
  SoundscapePresetId,
} from '../types';
import { haptics } from '../utils/haptics';
import {
  isAbilityActive,
  isFocusRushActive,
} from '../utils/progressionEngine';
import { soundscapeEngine } from '../utils/soundscapes';
import { CrystalSheet } from './FluidControls';

interface FocusRushSheetProps {
  open: boolean;
  activeLock: ActiveLockInfo;
  progression: ProgressionState;
  missingPermissionsCount: number;
  onStartManualLock: (durationMinutes: number) => void;
  onActivateFocusRush: (durationMinutes: 60 | 90) => void;
  onOpenPermissions: () => void;
  onClose: () => void;
}

const SOUNDSCAPES: Array<{ id: SoundscapePresetId; label: string; desc: string }> = [
  { id: 'rain', label: 'Rain on Glass', desc: 'Filtered soft rainfall' },
  { id: 'hum', label: '40Hz Sapphire Hum', desc: 'Deep focus resonance' },
  { id: 'ocean', label: 'Arctic Wave', desc: 'Calm low-pass tide' },
];

export const FocusRushSheet = memo(function FocusRushSheet({
  open,
  activeLock,
  progression,
  missingPermissionsCount,
  onStartManualLock,
  onActivateFocusRush,
  onOpenPermissions,
  onClose,
}: FocusRushSheetProps) {
  const [activeAudio, setActiveAudio] = useState<SoundscapePresetId | null>(() =>
    soundscapeEngine.getActivePreset(),
  );

  const nowMs = Date.now();
  const rushUnlocked = isAbilityActive(progression, 'focus_rush');
  const rushLive = isFocusRushActive(progression, nowMs);
  const soundscapesUnlocked = isAbilityActive(progression, 'focus_soundscapes');

  const rushMinsLeft = rushLive
    ? Math.max(1, Math.ceil((progression.focusRushUntilMs - nowMs) / 60000))
    : 0;

  return (
    <CrystalSheet open={open} onClose={onClose} zIndexClass="z-[72]" maxWidthClass="max-w-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-blue-700 dark:text-cyan-300">
            Samsung A07 Shield &amp; 2× Focus Rush
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[#07142B] dark:text-white">
            Focus Lock &amp; Rush Hub
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close focus hub"
          className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] dark:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Live Status Banner */}
      <div className="ios-glass-hero mt-3.5 rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {activeLock.active ? (
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            ) : (
              <Lock className="h-5 w-5 text-blue-600 dark:text-cyan-300" />
            )}
            <div>
              <p className="text-xs font-bold text-[#07142B] dark:text-white">
                {activeLock.active
                  ? `Lock Active until ${activeLock.untilTimeLabel}`
                  : 'App Blocker Ready'}
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                {activeLock.active
                  ? activeLock.reason
                  : `Allows Dialer, Contacts, Calculator & This Week (${SAMSUNG_A07_ALLOWLIST.length} packages)`}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[30, 60, 120].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => {
                haptics.success();
                onStartManualLock(mins);
              }}
              className="min-h-[38px] rounded-full bg-blue-600 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 dark:bg-blue-500"
            >
              Lock {mins}m
            </button>
          ))}
        </div>
      </div>

      {/* Ability #2: 2x Focus Rush */}
      <div className="ios-glass-control mt-3 rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#07142B] dark:text-white">
            <Zap className="h-4 w-4 text-cyan-500" />
            <span>2× XP Focus Rush</span>
          </span>
          <span className="tabular-nums text-[11px] font-semibold text-blue-700 dark:text-cyan-300">
            {rushLive
              ? `ACTIVE · ${rushMinsLeft}m left`
              : rushUnlocked
                ? `${progression.focusRushCharges} charges`
                : 'Unlocks at Silver'}
          </span>
        </div>

        <p className="mt-1 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
          Locks distractions AND doubles all XP earned during the rush window.
        </p>

        {rushUnlocked ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([60, 90] as const).map((mins) => (
              <button
                key={mins}
                type="button"
                disabled={progression.focusRushCharges <= 0 && !rushLive}
                onClick={() => {
                  haptics.success();
                  onActivateFocusRush(mins);
                }}
                className="min-h-[40px] rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-45"
              >
                {rushLive ? `Extend +${mins}m` : `Start ${mins}m (2× XP)`}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            Reach Silver Scholar &amp; buy Focus Rush in the Top Bar Abilities Shop.
          </p>
        )}
      </div>

      {/* Ability #5: Offline Focus Soundscapes */}
      <div className="ios-glass-control mt-3 rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#07142B] dark:text-white">
            <Volume2 className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
            <span>Ambient Focus Soundscapes</span>
          </span>
          {activeAudio && (
            <button
              type="button"
              onClick={() => {
                soundscapeEngine.stop();
                setActiveAudio(null);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300"
            >
              <VolumeX className="h-3 w-3" />
              Stop
            </button>
          )}
        </div>

        {soundscapesUnlocked ? (
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {SOUNDSCAPES.map((snd) => {
              const playing = activeAudio === snd.id;
              return (
                <button
                  key={snd.id}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    soundscapeEngine.play(snd.id);
                    setActiveAudio(soundscapeEngine.getActivePreset());
                  }}
                  className={`rounded-[18px] p-2.5 text-left transition-colors ${
                    playing
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-cyan-400 dark:text-[#04143B]'
                      : 'ios-glass-tile text-[#07142B] dark:text-sky-100'
                  }`}
                >
                  <p className="truncate text-[11px] font-bold">{snd.label}</p>
                  <p className="truncate text-[9.5px] opacity-80">{snd.desc}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
            Unlocks at Platinum Alchemist — zero-internet WebAudio study ambience.
          </p>
        )}
      </div>

      {/* Permissions Check Shortcut */}
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          onClose();
          onOpenPermissions();
        }}
        className="ios-glass-control mt-3 flex min-h-[44px] w-full items-center justify-between rounded-full px-4 text-xs font-semibold"
      >
        <span className="inline-flex items-center gap-2 text-[#07142B] dark:text-white">
          {missingPermissionsCount > 0 ? (
            <ShieldAlert className="h-4 w-4 text-orange-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          <span>Android Lock &amp; Alarm Permissions</span>
        </span>
        <span
          className={
            missingPermissionsCount > 0
              ? 'text-orange-600 dark:text-orange-300'
              : 'text-emerald-600 dark:text-emerald-300'
          }
        >
          {missingPermissionsCount > 0 ? `${missingPermissionsCount} Needed` : 'Ready'}
        </span>
      </button>
    </CrystalSheet>
  );
});
