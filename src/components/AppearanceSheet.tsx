import {
  Check,
  Copy,
  Download,
  Droplets,
  HardDriveDownload,
  Lock,
  Palette,
  Share2,
  ShieldCheck,
  Sparkles,
  SunMoon,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { ChangeEvent, memo, useRef, useState } from 'react';
import {
  exportNativeBackupFile,
  isNativeAndroidApp,
  shareNativeBackup,
} from '../native/thisWeekBridge';
import {
  AppearanceStudioConfig,
  CompletionFxMode,
  LeagueId,
} from '../types';
import { haptics } from '../utils/haptics';
import {
  ACCENT_PRESETS,
  AURORA_THEMES,
  getLeagueSpec,
  isLeagueAtLeast,
  PARTICLE_MODES,
  SUBJECT_PALETTES,
} from '../utils/progressionEngine';
import { CrystalSheet, LiquidSwitch } from './FluidControls';

interface AppearanceSheetProps {
  open: boolean;
  transparency: number;
  onChangeTransparency: (val: number) => void;
  calmBackdrop: boolean;
  onToggleCalmBackdrop: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  currentLeague: LeagueId;
  studio: AppearanceStudioConfig;
  onChangeStudio: (next: AppearanceStudioConfig) => void;
  missingPermCount: number;
  onOpenPermissions: () => void;
  onExportBackupJson: () => string;
  onImportBackupJson: (rawJson: string) => { ok: boolean; message: string };
  onClose: () => void;
}

const TRANSPARENCY_PRESETS = [
  { val: 0, label: '0% Solid' },
  { val: 40, label: '40% Soft' },
  { val: 72, label: '72% Frost' },
  { val: 100, label: '100% Clear' },
];

export const AppearanceSheet = memo(function AppearanceSheet({
  open,
  transparency,
  onChangeTransparency,
  calmBackdrop,
  onToggleCalmBackdrop,
  isDark,
  onToggleTheme,
  currentLeague,
  studio,
  onChangeStudio,
  missingPermCount,
  onOpenPermissions,
  onExportBackupJson,
  onImportBackupJson,
  onClose,
}: AppearanceSheetProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [section, setSection] = useState<'studio' | 'backup'>('studio');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [backupStatus, setBackupStatus] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const leagueSpec = getLeagueSpec(currentLeague);

  const handleSaveBackupFile = async () => {
    haptics.success();
    const json = onExportBackupJson();
    const todayStamp = new Date().toISOString().slice(0, 10);
    const fileName = `ThisWeek-Backup-${todayStamp}.json`;

    if (isNativeAndroidApp()) {
      const nativeRes = await exportNativeBackupFile(fileName, json);
      if (nativeRes?.ok) {
        setBackupStatus({
          tone: 'ok',
          text: `Saved to ${nativeRes.savedPath ?? 'Downloads/ThisWeek/' + fileName}`,
        });
        return;
      }
    }

    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupStatus({
        tone: 'ok',
        text: `Downloaded ${fileName}`,
      });
    } catch {
      setBackupStatus({
        tone: 'err',
        text: 'File download blocked here — use Share or Copy Code below.',
      });
    }
  };

  const handleShareBackup = async () => {
    haptics.tap();
    const json = onExportBackupJson();
    const todayStamp = new Date().toISOString().slice(0, 10);
    const ok = await shareNativeBackup(`ThisWeek-Backup-${todayStamp}.json`, json);
    if (ok) {
      setBackupStatus({ tone: 'ok', text: 'Opened system Share / Save sheet.' });
    } else {
      setBackupStatus({
        tone: 'err',
        text: 'Share unavailable — use Save .json or Copy Code.',
      });
    }
  };

  const handleCopyCode = async () => {
    haptics.tick();
    try {
      const json = onExportBackupJson();
      await navigator.clipboard.writeText(json);
      setCopiedCode(true);
      setBackupStatus({
        tone: 'ok',
        text: 'Backup JSON copied to clipboard.',
      });
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setBackupStatus({
        tone: 'err',
        text: 'Clipboard unavailable — use Save .json or Share instead.',
      });
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const res = onImportBackupJson(content);
      if (res.ok) haptics.success();
      setBackupStatus({ tone: res.ok ? 'ok' : 'err', text: res.message });
    };
    reader.onerror = () => {
      setBackupStatus({ tone: 'err', text: 'Could not read that backup file.' });
    };
    reader.readAsText(file);
  };

  const handlePasteRestore = () => {
    const res = onImportBackupJson(pasteText.trim());
    if (res.ok) {
      haptics.success();
      setPasteText('');
      setPasteOpen(false);
    }
    setBackupStatus({ tone: res.ok ? 'ok' : 'err', text: res.message });
  };

  return (
    <CrystalSheet
      open={open}
      onClose={onClose}
      zIndexClass="z-[65]"
      maxWidthClass="max-w-lg"
      scrimClassName="bg-transparent sm:bg-[#061A4A]/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold ${leagueSpec.textClass}`}>
            {leagueSpec.name} Studio · Progression Cosmetics &amp; Real Saves
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[#07142B] dark:text-white">
            Appearance Studio &amp; Backup
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close appearance studio"
          className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] dark:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Studio vs Backup Tabs */}
      <div className="ios-glass-control mt-3 grid grid-cols-2 gap-1 rounded-full p-1">
        <button
          type="button"
          onClick={() => {
            haptics.tick();
            setSection('studio');
          }}
          className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors ${
            section === 'studio'
              ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
              : 'text-[#0B234A]/75 dark:text-sky-200/80'
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>Visual Studio</span>
        </button>
        <button
          type="button"
          onClick={() => {
            haptics.tick();
            setSection('backup');
          }}
          className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors ${
            section === 'backup'
              ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
              : 'text-[#0B234A]/75 dark:text-sky-200/80'
          }`}
        >
          <HardDriveDownload className="h-3.5 w-3.5" />
          <span>Save &amp; Restore</span>
        </button>
      </div>

      {section === 'studio' ? (
        <div className="mt-3 space-y-3">
          {/* 0–100% Transparency Slider */}
          <div className="ios-glass-control rounded-[24px] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#07142B] dark:text-white">
                <Droplets className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
                <span>Card Transparency</span>
              </span>
              <span className="tabular-nums text-sm font-bold text-blue-700 dark:text-cyan-300">
                {transparency}%
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="text-[10px] font-semibold text-[#0B234A]/65 dark:text-sky-200/70">
                Solid
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={transparency}
                aria-label="Adjust card transparency"
                onInput={(e) => onChangeTransparency(Number((e.target as HTMLInputElement).value))}
                onChange={(e) => onChangeTransparency(Number(e.target.value))}
                className="h-3 w-full cursor-pointer accent-blue-600 dark:accent-cyan-400"
              />
              <span className="text-[10px] font-semibold text-[#0B234A]/65 dark:text-sky-200/70">
                Clear
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              {TRANSPARENCY_PRESETS.map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    onChangeTransparency(p.val);
                  }}
                  className={`min-h-[34px] rounded-full px-2 text-[10.5px] font-semibold ${
                    Math.abs(transparency - p.val) <= 2
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'bg-blue-500/12 text-[#0B234A]/80 dark:text-sky-100/85'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tier 1+: Accent Glows + Custom Greeting Title (Silver+) */}
          <div className="ios-glass-control rounded-[24px] p-4">
            <p className="text-xs font-semibold text-[#07142B] dark:text-white">
              Accent Glows
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ACCENT_PRESETS.map((acc) => {
                const unlocked = isLeagueAtLeast(currentLeague, acc.requiredLeague);
                const selected = studio.accentPreset === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      haptics.tick();
                      onChangeStudio({ ...studio, accentPreset: acc.id });
                    }}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition-colors disabled:opacity-45 ${
                      selected
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-cyan-400 dark:text-[#04143B]'
                        : 'ios-glass-tile text-[#07142B] dark:text-sky-100'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${acc.swatchClass}`} />
                    <span>{acc.label}</span>
                    {!unlocked && <Lock className="h-3 w-3 opacity-75" />}
                  </button>
                );
              })}
            </div>

            {/* Silver+: Custom Scholar Title */}
            <div className="mt-3 border-t border-blue-950/10 pt-3 dark:border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#07142B] dark:text-white">
                  Custom Dashboard Title
                </label>
                {!isLeagueAtLeast(currentLeague, 'silver') && (
                  <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-300">
                    Unlocks at Silver
                  </span>
                )}
              </div>
              <input
                type="text"
                disabled={!isLeagueAtLeast(currentLeague, 'silver')}
                value={studio.customTitle}
                onChange={(e) => onChangeStudio({ ...studio, customTitle: e.target.value })}
                placeholder={isLeagueAtLeast(currentLeague, 'silver') ? 'e.g. BioScholar, Rank #1' : 'Reach Silver Scholar to customize'}
                className="ios-glass-tile mt-1.5 min-h-[36px] w-full rounded-full px-3.5 text-xs text-[#07142B] placeholder:text-[#0B234A]/45 focus:outline-none disabled:opacity-50 dark:text-white dark:placeholder:text-sky-200/45"
              />
            </div>
          </div>

          {/* Gold+: Subject Glow Palettes */}
          <div className="ios-glass-control rounded-[24px] p-4">
            <p className="text-xs font-semibold text-[#07142B] dark:text-white">
              Subject Card Glows (Gold+)
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {SUBJECT_PALETTES.map((pal) => {
                const unlocked = isLeagueAtLeast(currentLeague, pal.requiredLeague);
                const selected = studio.subjectPalette === pal.id;
                return (
                  <button
                    key={pal.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      haptics.tick();
                      onChangeStudio({ ...studio, subjectPalette: pal.id });
                    }}
                    className={`rounded-[18px] p-2.5 text-left transition-colors disabled:opacity-45 ${
                      selected
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-cyan-400 dark:text-[#04143B]'
                        : 'ios-glass-tile text-[#07142B] dark:text-sky-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold">{pal.label}</span>
                      {!unlocked && <Lock className="h-3 w-3 opacity-75" />}
                    </div>
                    <p className="mt-0.5 truncate text-[9.5px] opacity-80">{pal.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Platinum+: Aurora Atmosphere Engine */}
          <div className="ios-glass-control rounded-[24px] p-4">
            <p className="text-xs font-semibold text-[#07142B] dark:text-white">
              Aurora Atmosphere Presets (Platinum → Apex)
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {AURORA_THEMES.map((aur) => {
                const unlocked = isLeagueAtLeast(currentLeague, aur.requiredLeague);
                const selected = studio.auroraTheme === aur.id;
                return (
                  <button
                    key={aur.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      haptics.tick();
                      onChangeStudio({ ...studio, auroraTheme: aur.id });
                    }}
                    className={`flex items-center justify-between gap-2 rounded-[18px] px-3 py-2 text-left text-[11px] font-semibold transition-colors disabled:opacity-45 ${
                      selected
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-cyan-400 dark:text-[#04143B]'
                        : 'ios-glass-tile text-[#07142B] dark:text-sky-100'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/50"
                        style={{
                          background: `linear-gradient(135deg, ${aur.orb1}, ${aur.orb2})`,
                        }}
                      />
                      <span className="truncate">{aur.label}</span>
                    </span>
                    {!unlocked && <Lock className="h-3 w-3 shrink-0 opacity-75" />}
                  </button>
                );
              })}
            </div>

            {/* Apex Custom Theme Forge Color Pickers */}
            {studio.auroraTheme === 'custom' && isLeagueAtLeast(currentLeague, 'apex') && (
              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-blue-950/10 pt-3 dark:border-white/10">
                {(
                  [
                    { key: 'customBgHex', label: 'Backdrop' },
                    { key: 'customOrb1Hex', label: 'Orb 1' },
                    { key: 'customOrb2Hex', label: 'Orb 2' },
                    { key: 'customRimHex', label: 'Rim' },
                  ] as const
                ).map((item) => (
                  <label key={item.key} className="flex flex-col items-center gap-1 text-[10px] font-semibold">
                    <input
                      type="color"
                      value={studio[item.key]}
                      onChange={(e) =>
                        onChangeStudio({ ...studio, [item.key]: e.target.value })
                      }
                      className="h-8 w-full cursor-pointer rounded-full border border-white/40 bg-transparent"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Diamond & Apex Crazy Visual FX */}
          <div className="ios-glass-control rounded-[24px] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#07142B] dark:text-white">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
                  <span>Iridescent Prism Card Rims</span>
                </p>
                <p className="text-[10.5px] text-[#0B234A]/70 dark:text-sky-200/75">
                  {isLeagueAtLeast(currentLeague, 'diamond')
                    ? 'Holographic edge refraction around all liquid-glass cards'
                    : 'Unlocks at Diamond Sovereign'}
                </p>
              </div>
              <LiquidSwitch
                checked={studio.prismBorders && isLeagueAtLeast(currentLeague, 'diamond')}
                onToggle={() => {
                  if (!isLeagueAtLeast(currentLeague, 'diamond')) return;
                  onChangeStudio({ ...studio, prismBorders: !studio.prismBorders });
                }}
                ariaLabel="Toggle iridescent prism rims"
              />
            </div>

            <div className="border-t border-blue-950/10 pt-2.5 dark:border-white/10">
              <p className="text-[11px] font-semibold text-[#07142B] dark:text-white">
                Live Atmosphere Particles (Diamond → Apex)
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PARTICLE_MODES.map((pm) => {
                  const unlocked = isLeagueAtLeast(currentLeague, pm.requiredLeague);
                  const selected = studio.liveParticles === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        haptics.tick();
                        onChangeStudio({ ...studio, liveParticles: pm.id });
                      }}
                      className={`inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 text-[11px] font-semibold disabled:opacity-45 ${
                        selected
                          ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-[#04143B]'
                          : 'ios-glass-tile text-[#07142B] dark:text-sky-100'
                      }`}
                    >
                      <span>{pm.label}</span>
                      {!unlocked && <Lock className="h-3 w-3 opacity-75" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-blue-950/10 pt-2.5 dark:border-white/10">
              <p className="text-[11px] font-semibold text-[#07142B] dark:text-white">
                Completion FX (Diamond+)
              </p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'ripple', label: 'Ripple' },
                    { id: 'burst', label: 'Crystal Burst' },
                    { id: 'aurora', label: 'Aurora Flash' },
                  ] as Array<{ id: CompletionFxMode; label: string }>
                ).map((fx) => {
                  const unlocked =
                    fx.id === 'ripple' || isLeagueAtLeast(currentLeague, 'diamond');
                  return (
                    <button
                      key={fx.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        haptics.tick();
                        onChangeStudio({ ...studio, completionFx: fx.id });
                      }}
                      className={`min-h-[32px] rounded-full text-[11px] font-semibold disabled:opacity-45 ${
                        studio.completionFx === fx.id
                          ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-[#04143B]'
                          : 'ios-glass-tile text-[#07142B] dark:text-sky-100'
                      }`}
                    >
                      {fx.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* A07 60fps & Night Mode */}
          <div className="ios-glass-control flex items-center justify-between gap-3 rounded-[22px] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#07142B] dark:text-white">
                <Zap className="h-3.5 w-3.5 text-emerald-500" />
                <span>A07 Max 60fps Mode</span>
              </p>
              <p className="mt-0.5 text-[10.5px] text-[#0B234A]/70 dark:text-sky-200/75">
                Disables expensive live GPU blur &amp; orb drift for crisp 60fps scrolling
              </p>
            </div>
            <LiquidSwitch
              checked={calmBackdrop}
              onToggle={onToggleCalmBackdrop}
              ariaLabel="Toggle A07 Max 60fps Mode"
              activeColorClass="bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.4)]"
            />
          </div>

          <div className="ios-glass-control flex items-center justify-between gap-3 rounded-[22px] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#07142B] dark:text-white">
                <SunMoon className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
                <span>Night Arctic Mode</span>
              </p>
            </div>
            <LiquidSwitch
              checked={isDark}
              onToggle={onToggleTheme}
              ariaLabel="Toggle Night Arctic Mode"
            />
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Real Save Backup Vault */}
          <div className="ios-glass-control rounded-[24px] p-4">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#07142B] dark:text-white">
              <HardDriveDownload className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
              <span>Real File Save &amp; Cross-Version Restore</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#0B234A]/75 dark:text-sky-200/75">
              Saves your entire timetable, League XP, unlocked abilities, tasks, missed queue, and paper reviews straight to{' '}
              <strong>Downloads/ThisWeek/</strong> on Android (plus IndexedDB &amp; Android vault auto-sync).
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleSaveBackupFile()}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 dark:bg-blue-500"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Save .json File</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  fileInputRef.current?.click();
                }}
                className="ios-glass-tile inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#07142B] transition-transform active:scale-95 dark:text-white"
              >
                <Upload className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
                <span>Load .json File</span>
              </button>

              <button
                type="button"
                onClick={() => void handleShareBackup()}
                className="ios-glass-tile inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-[#0B234A] transition-transform active:scale-95 dark:text-sky-100"
              >
                <Share2 className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
                <span>Share Backup</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="ios-glass-tile inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-[#0B234A] transition-transform active:scale-95 dark:text-sky-100"
              >
                {copiedCode ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
                )}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                haptics.tick();
                setPasteOpen((v) => !v);
              }}
              className="ios-glass-tile mt-2 min-h-[36px] w-full rounded-full text-[11px] font-semibold text-[#0B234A] dark:text-sky-100"
            >
              {pasteOpen ? 'Hide Paste Restore Box' : 'Paste Backup Code Instead'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />

            {pasteOpen && (
              <div className="mt-2.5 space-y-2">
                <textarea
                  rows={3}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste your This Week backup JSON code here..."
                  className="ios-glass-tile w-full rounded-[18px] px-3 py-2 text-[11px] text-[#07142B] placeholder:text-[#0B234A]/45 focus:outline-none dark:text-white dark:placeholder:text-sky-200/45"
                />
                <button
                  type="button"
                  disabled={!pasteText.trim()}
                  onClick={handlePasteRestore}
                  className="min-h-[38px] w-full rounded-full bg-emerald-600 text-xs font-semibold text-white shadow-sm disabled:opacity-45"
                >
                  Restore Pasted Backup
                </button>
              </div>
            )}

            {backupStatus && (
              <p
                className={`mt-2.5 rounded-full px-3 py-1.5 text-center text-[11px] font-semibold ${
                  backupStatus.tone === 'ok'
                    ? 'bg-emerald-500/18 text-emerald-700 dark:text-emerald-300'
                    : 'bg-orange-500/18 text-orange-700 dark:text-orange-300'
                }`}
              >
                {backupStatus.text}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onClose();
              onOpenPermissions();
            }}
            className="ios-glass-control flex min-h-[46px] w-full items-center justify-between rounded-full px-4 text-xs font-semibold"
          >
            <span className="inline-flex items-center gap-2 text-[#07142B] dark:text-white">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
              <span>Phone Lock &amp; Alarm Permissions</span>
            </span>
            <span
              className={
                missingPermCount > 0
                  ? 'text-orange-600 dark:text-orange-300'
                  : 'text-emerald-600 dark:text-emerald-300'
              }
            >
              {missingPermCount > 0 ? `${missingPermCount} Missing` : 'All Set'}
            </span>
          </button>
        </div>
      )}
    </CrystalSheet>
  );
});
