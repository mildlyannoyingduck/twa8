import {
  Activity,
  ArrowLeft,
  Award,
  BookCheck,
  Check,
  Compass,
  Flame,
  Gem,
  History,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
  Volume2,
  Wand2,
  Zap,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import {
  AbilityId,
  DayCompletionLog,
  FridayAnchor,
  FridayWeekOverrides,
  MissedLessonItem,
  PaperEntry,
  ProgressionState,
  StudyTask,
  TimetableSlot,
} from '../types';
import { haptics } from '../utils/haptics';
import {
  ABILITIES,
  ArenaBountyItem,
  CRYSTAL_VALUES,
  evaluateArenaBounties,
  getDivisionInfo,
  getLeagueSpec,
  isAbilityActive,
  isFocusRushActive,
  isLeagueAtLeast,
  LEAGUES,
  XP_VALUES,
} from '../utils/progressionEngine';
import { LEAGUE_AURA_STYLE, LeagueCrest } from './LeagueCrest';

type ArenaTab = 'road' | 'powers' | 'bounties' | 'log';
type LogFilter = 'all' | 'gain' | 'penalty' | 'other';

interface XPArenaOverlayProps {
  open: boolean;
  progression: ProgressionState;
  slots: TimetableSlot[];
  tasks: StudyTask[];
  missedItems: MissedLessonItem[];
  papers: PaperEntry[];
  dailyLogs: Record<string, DayCompletionLog>;
  unitCoveredMap: Record<string, boolean>;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  activeMissedCount: number;
  onUnlockAbility: (abilityId: AbilityId) => void;
  onBuyCharge: (abilityId: 'streak_shield' | 'focus_rush') => void;
  onOpenFocusRush: () => void;
  onRunSmartGapFiller: () => { addedCount: number; message: string };
  onOpenWeeklyFocusSuggest: () => void;
  onClaimBounty: (bounty: ArenaBountyItem) => void;
  onClose: () => void;
}

const ABILITY_ICONS: Record<AbilityId, typeof Shield> = {
  streak_shield: Shield,
  focus_rush: Zap,
  smart_gap_filler: Wand2,
  subject_balance_radar: Activity,
  focus_soundscapes: Volume2,
  review_chain_radar: Sparkles,
  exam_readiness_index: Award,
};

function formatHistoryTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const XPArenaOverlay = memo(function XPArenaOverlay({
  open,
  progression,
  slots,
  tasks,
  missedItems,
  papers,
  dailyLogs,
  unitCoveredMap,
  fridayAnchor,
  fridayOverrides,
  activeMissedCount,
  onUnlockAbility,
  onBuyCharge,
  onOpenFocusRush,
  onRunSmartGapFiller,
  onOpenWeeklyFocusSuggest,
  onClaimBounty,
  onClose,
}: XPArenaOverlayProps) {
  const [arenaTab, setArenaTab] = useState<ArenaTab>('road');
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [actionToast, setActionToast] = useState<string | null>(null);

  const nowMs = Date.now();
  const divInfo = getDivisionInfo(progression.xp, progression.currentLeague);
  const aura = LEAGUE_AURA_STYLE[progression.currentLeague];
  const shieldHoursLeft =
    progression.promoShieldUntilMs > nowMs
      ? Math.max(1, Math.ceil((progression.promoShieldUntilMs - nowMs) / 3600000))
      : 0;
  const rushActive = isFocusRushActive(progression, nowMs);
  const rushMinsLeft = rushActive
    ? Math.max(1, Math.ceil((progression.focusRushUntilMs - nowMs) / 60000))
    : 0;

  const bounties = useMemo(
    () =>
      evaluateArenaBounties({
        progression,
        slots,
        tasks,
        missedItems,
        papers,
        dailyLogs,
        unitCoveredMap,
        fridayAnchor,
        fridayOverrides,
      }),
    [progression, slots, tasks, missedItems, papers, dailyLogs, unitCoveredMap, fridayAnchor, fridayOverrides],
  );

  const claimableCount = bounties.filter((b) => b.readyToClaim).length;

  const filteredHistory = useMemo(() => {
    return progression.history.filter((h) => {
      if (logFilter === 'gain') return h.deltaXp > 0 && h.tone !== 'bounty';
      if (logFilter === 'penalty') return h.deltaXp < 0 || h.tone === 'penalty';
      if (logFilter === 'other') return h.tone === 'shop' || h.tone === 'bounty' || h.tone === 'reversal';
      return true;
    });
  }, [progression.history, logFilter]);

  if (!open) return null;

  const pushToast = (msg: string) => {
    setActionToast(msg);
    window.setTimeout(() => {
      setActionToast((cur) => (cur === msg ? null : cur));
    }, 3000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kithnuka XP Arena"
      className="fixed inset-0 z-[72] overflow-y-auto bg-[#CFE3FF]/94 text-[#07142B] backdrop-blur-xl dark:bg-[#02071A]/94 dark:text-white"
    >
      {/* Ambient Arena Halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden [transform:translateZ(0)]"
      >
        <div className="arctic-grid-bg absolute inset-0 opacity-75" />
        <div
          className="absolute left-1/2 top-[-120px] h-[420px] w-[520px] -translate-x-1/2 rounded-full opacity-70 blur-2xl"
          style={{
            background: `radial-gradient(circle, ${divInfo.league.glowRgba} 0%, rgba(37,99,235,0) 70%)`,
          }}
        />
      </div>

      {/* Sticky Arena Header */}
      <header className="ios-glass-topbar sticky top-0 z-20">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-2 px-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => {
              haptics.tick();
              onClose();
            }}
            className="ios-glass-control inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#07142B] transition-transform active:scale-95 dark:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <LeagueCrest league={progression.currentLeague} division={divInfo.division} size="xs" />
            <span className="font-brand truncate text-sm font-bold tracking-tight text-[#07142B] dark:text-white sm:text-base">
              Kithnuka&apos;s XP Arena
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="ios-glass-control flex items-center gap-1 rounded-full px-2.5 py-1">
              <Gem className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-300" />
              <span className="tabular-nums text-xs font-bold">{progression.crystals}</span>
            </div>
            <div className="ios-glass-control flex items-center gap-1 rounded-full px-2.5 py-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span className="tabular-nums text-xs font-bold">{progression.streakDays}d</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-4xl px-3.5 pb-16 pt-4 sm:px-6">
        {/* Hero Rank Stage Card */}
        <section
          className={`ios-glass-hero relative overflow-hidden rounded-[32px] border p-5 sm:p-6 ${aura.ringBorder} ${aura.glowShadow}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <LeagueCrest
                league={progression.currentLeague}
                division={divInfo.division}
                size="xl"
                showDivision
                withAura
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm ${aura.pillBg}`}
                  >
                    {divInfo.league.shortName} · Div {divInfo.roman}
                  </span>
                  {rushActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      <Zap className="h-3 w-3" />
                      2× Rush ({rushMinsLeft}m)
                    </span>
                  )}
                </div>

                <h1 className="font-brand mt-1 text-xl font-bold tracking-tight text-[#07142B] dark:text-white sm:text-2xl">
                  Kithnuka · {divInfo.league.name}
                </h1>
                <p className="mt-0.5 text-xs text-[#0B234A]/75 dark:text-sky-100/80">
                  {divInfo.league.unlockSummary}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:w-auto">
              <div className="ios-glass-tile rounded-[20px] px-3 py-2 text-center">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#0B234A]/65 dark:text-sky-200/70">
                  Trophies
                </p>
                <p className="tabular-nums mt-0.5 text-base font-extrabold text-[#07142B] dark:text-white">
                  {progression.xp}
                </p>
              </div>
              <div className="ios-glass-tile rounded-[20px] px-3 py-2 text-center">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#0B234A]/65 dark:text-sky-200/70">
                  Lifetime
                </p>
                <p className="tabular-nums mt-0.5 text-base font-extrabold text-blue-700 dark:text-cyan-300">
                  {progression.lifetimeXpEarned}
                </p>
              </div>
              <div className="ios-glass-tile rounded-[20px] px-3 py-2 text-center">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#0B234A]/65 dark:text-sky-200/70">
                  Peak
                </p>
                <p className="mt-0.5 text-xs font-extrabold text-[#07142B] dark:text-white">
                  {getLeagueSpec(progression.highestLeagueReached).shortName}
                </p>
              </div>
            </div>
          </div>

          {/* Trophy Progress Bar */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold">
              <span className="tabular-nums text-[#07142B] dark:text-sky-100">
                {divInfo.nextLeague
                  ? `${progression.xp} / ${divInfo.nextLeague.minXp} Trophies to ${divInfo.nextLeague.name}`
                  : `${progression.xp} Trophies · Max Sapphire Apex League Reached`}
              </span>
              <span className="tabular-nums text-blue-700 dark:text-cyan-300">
                {divInfo.progressPercent}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-blue-950/15 p-0.5 dark:bg-white/12">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${divInfo.league.badgeGradient} transition-[width] duration-300`}
                style={{ width: `${Math.max(5, divInfo.progressPercent)}%` }}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            {shieldHoursLeft > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>24h Demotion Shield active ({shieldHoursLeft}h remaining)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[#0B234A]/75 dark:text-sky-200/80">
                <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />
                <span>Misses drop -30 / -70 Trophies · 2× Focus Rush doubles gains</span>
              </span>
            )}

            {claimableCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setArenaTab('bounties');
                }}
                className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-700 transition-transform active:scale-95 dark:text-emerald-300"
              >
                {claimableCount} Bounty Ready to Claim →
              </button>
            )}
          </div>
        </section>

        {actionToast && (
          <div className="animate-sheet-in mt-3 rounded-full bg-emerald-500/20 px-4 py-2 text-center text-xs font-bold text-emerald-800 dark:text-emerald-200">
            {actionToast}
          </div>
        )}

        {/* 4 Arena Section Tabs */}
        <div className="ios-glass-control mt-4 grid grid-cols-4 gap-1 rounded-full p-1">
          {(
            [
              { id: 'road', label: 'Trophy Road', Icon: Trophy },
              { id: 'powers', label: 'Powers (7)', Icon: Swords },
              {
                id: 'bounties',
                label: claimableCount > 0 ? `Bounties (${claimableCount})` : 'Bounties',
                Icon: BookCheck,
              },
              { id: 'log', label: 'XP Log', Icon: History },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = arenaTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setArenaTab(id);
                }}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-full px-2 text-[11px] font-bold transition-colors sm:text-xs ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm dark:bg-cyan-400 dark:text-[#04143B]'
                    : 'text-[#0B234A]/78 dark:text-sky-100/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: 6-LEAGUE TROPHY ROAD */}
        {arenaTab === 'road' && (
          <div className="mt-4 space-y-3">
            {LEAGUES.map((lg) => {
              const isCurrent = lg.id === progression.currentLeague;
              const unlocked = isLeagueAtLeast(progression.currentLeague, lg.id);
              const lgAura = LEAGUE_AURA_STYLE[lg.id];
              const tierAbilities = ABILITIES.filter((a) => a.requiredLeague === lg.id);

              return (
                <div
                  key={lg.id}
                  className={`ios-glass relative overflow-hidden rounded-[26px] border p-4 transition-opacity ${
                    isCurrent
                      ? `${lgAura.ringBorder} ${lgAura.glowShadow}`
                      : unlocked
                        ? 'border-emerald-400/45'
                        : 'opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <LeagueCrest
                        league={lg.id}
                        size="lg"
                        withAura={isCurrent}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`text-sm font-extrabold sm:text-base ${lg.textClass}`}>
                            {lg.name}
                          </h3>
                          {isCurrent && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white ${lgAura.pillBg}`}
                            >
                              Current Rank
                            </span>
                          )}
                          {!isCurrent && unlocked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/18 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              <Check className="h-3 w-3" />
                              Cleared
                            </span>
                          )}
                          {!unlocked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/10 px-2 py-0.5 text-[10px] font-semibold text-[#0B234A]/70 dark:bg-white/10 dark:text-sky-200/70">
                              <Lock className="h-3 w-3" />
                              {lg.minXp} XP
                            </span>
                          )}
                        </div>

                        <p className="tabular-nums mt-0.5 text-xs font-semibold text-[#07142B] dark:text-sky-100">
                          {lg.maxXp >= 999999 ? `${lg.minXp}+ Trophy XP` : `${lg.minXp} – ${lg.maxXp - 1} Trophy XP`}
                          {lg.order > 0 ? ` · +${CRYSTAL_VALUES.leaguePromoBonus}💎 Promo Bonus` : ''}
                        </p>
                        <p className="mt-1 text-[11.5px] text-[#0B234A]/80 dark:text-sky-200/80">
                          {lg.unlockSummary}
                        </p>

                        {tierAbilities.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {tierAbilities.map((ab) => (
                              <span
                                key={ab.id}
                                className="ios-glass-control rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold text-[#07142B] dark:text-sky-100"
                              >
                                Power: {ab.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: POWERS & WEEKLY LOADOUT */}
        {arenaTab === 'powers' && (
          <div className="mt-4 space-y-3">
            {/* All-Tiers Core Weekly Auto-Suggest */}
            <div className="ios-glass-hero rounded-[26px] border border-cyan-400/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-sm">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-bold text-[#07142B] dark:text-white">
                        Weekly Self-Study Auto-Suggest
                      </p>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        All Tiers Unlocked
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#0B234A]/78 dark:text-sky-200/80">
                      Finds your least self-study focused subject this week and recommends the best next task &amp; open slot.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onClose();
                    onOpenWeeklyFocusSuggest();
                  }}
                  className="min-h-[38px] shrink-0 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 dark:bg-blue-500"
                >
                  Open Auto-Suggest
                </button>
              </div>
            </div>

            {ABILITIES.map((ab) => {
              const Icon = ABILITY_ICONS[ab.id];
              const reqLeague = getLeagueSpec(ab.requiredLeague);
              const leagueMet = isLeagueAtLeast(progression.currentLeague, ab.requiredLeague);
              const unlocked = Boolean(progression.unlockedAbilities[ab.id]);
              const activeNow = isAbilityActive(progression, ab.id);
              const canAffordUnlock = progression.crystals >= ab.unlockCostCrystals;
              const canAffordCharge =
                ab.chargeCostCrystals !== undefined &&
                progression.crystals >= ab.chargeCostCrystals;

              return (
                <div
                  key={ab.id}
                  className={`ios-glass rounded-[24px] p-4 ${!leagueMet ? 'opacity-80' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] ${
                          activeNow
                            ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-[#04143B]'
                            : 'bg-blue-500/15 text-blue-700 dark:text-sky-200'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-bold text-[#07142B] dark:text-white">
                            {ab.name}
                          </p>
                          <span className={`text-[11px] font-bold ${reqLeague.textClass}`}>
                            · {reqLeague.shortName}+
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-snug text-[#0B234A]/78 dark:text-sky-200/80">
                          {ab.description}
                        </p>
                      </div>
                    </div>

                    {!leagueMet ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-950/10 px-3 py-1.5 text-[11px] font-semibold text-[#0B234A]/75 dark:bg-white/10 dark:text-sky-200/75">
                        <Lock className="h-3 w-3" />
                        {reqLeague.shortName}
                      </span>
                    ) : !unlocked ? (
                      <button
                        type="button"
                        disabled={!canAffordUnlock}
                        onClick={() => {
                          haptics.success();
                          onUnlockAbility(ab.id);
                          pushToast(`Unlocked ${ab.name}!`);
                        }}
                        className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-45 dark:bg-blue-500"
                      >
                        <Gem className="h-3.5 w-3.5" />
                        <span>Buy {ab.unlockCostCrystals}</span>
                      </button>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/18 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        <Check className="h-3.5 w-3.5" />
                        Active
                      </span>
                    )}
                  </div>

                  {activeNow && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-blue-950/10 pt-2.5 dark:border-white/10">
                      {ab.id === 'streak_shield' && (
                        <>
                          <span className="tabular-nums text-xs font-semibold text-[#07142B] dark:text-sky-100">
                            Charges stocked: {progression.streakShieldCharges}
                          </span>
                          <button
                            type="button"
                            disabled={!canAffordCharge}
                            onClick={() => {
                              haptics.success();
                              onBuyCharge('streak_shield');
                              pushToast('Bought +1 Streak Shield charge!');
                            }}
                            className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-blue-600/15 px-3 text-xs font-semibold text-blue-700 disabled:opacity-45 dark:bg-cyan-400/15 dark:text-cyan-200"
                          >
                            <Gem className="h-3.5 w-3.5" />
                            <span>+1 Charge ({ab.chargeCostCrystals})</span>
                          </button>
                        </>
                      )}

                      {ab.id === 'focus_rush' && (
                        <>
                          <span className="tabular-nums text-xs font-semibold text-[#07142B] dark:text-sky-100">
                            {rushActive
                              ? `2× Rush Live (${rushMinsLeft}m left)`
                              : `Charges stocked: ${progression.focusRushCharges}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!canAffordCharge}
                              onClick={() => {
                                haptics.success();
                                onBuyCharge('focus_rush');
                                pushToast('Bought +1 Focus Rush charge!');
                              }}
                              className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-blue-600/15 px-3 text-xs font-semibold text-blue-700 disabled:opacity-45 dark:bg-cyan-400/15 dark:text-cyan-200"
                            >
                              <Gem className="h-3.5 w-3.5" />
                              <span>+1 ({ab.chargeCostCrystals})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                haptics.tap();
                                onClose();
                                onOpenFocusRush();
                              }}
                              className="min-h-[32px] rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white dark:bg-blue-500"
                            >
                              Open Focus Rush
                            </button>
                          </div>
                        </>
                      )}

                      {ab.id === 'smart_gap_filler' && (
                        <>
                          <span className="text-xs text-[#0B234A]/75 dark:text-sky-200/80">
                            {activeMissedCount} active missed item(s) waiting
                          </span>
                          <button
                            type="button"
                            disabled={activeMissedCount === 0}
                            onClick={() => {
                              const res = onRunSmartGapFiller();
                              if (res.addedCount > 0) haptics.success();
                              pushToast(res.message);
                            }}
                            className="min-h-[32px] rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white disabled:opacity-45 dark:bg-blue-500"
                          >
                            Auto-Slot Missed Now
                          </button>
                        </>
                      )}

                      {(ab.id === 'subject_balance_radar' ||
                        ab.id === 'focus_soundscapes' ||
                        ab.id === 'review_chain_radar' ||
                        ab.id === 'exam_readiness_index') && (
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Passive perk active automatically across your workspace
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: DAILY/WEEKLY BOUNTIES & RULEBOOK */}
        {arenaTab === 'bounties' && (
          <div className="mt-4 space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#07142B] dark:text-white">
                  Daily &amp; Weekly Arena Bounties
                </h2>
                <span className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                  Resets daily / every Monday
                </span>
              </div>

              {bounties.map((b) => {
                const pct = Math.min(100, Math.round((b.progress / Math.max(1, b.target)) * 100));
                return (
                  <div
                    key={b.id}
                    className={`ios-glass rounded-[24px] border p-4 ${
                      b.readyToClaim
                        ? 'border-emerald-400/75 shadow-[0_0_20px_rgba(16,185,129,0.22)]'
                        : 'border-white/50 dark:border-sky-300/20'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              b.cadence === 'daily'
                                ? 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-200'
                                : 'bg-violet-500/20 text-violet-800 dark:text-violet-200'
                            }`}
                          >
                            {b.cadence}
                          </span>
                          <p className="text-sm font-bold text-[#07142B] dark:text-white">
                            {b.title}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs text-[#0B234A]/78 dark:text-sky-200/80">
                          {b.description}
                        </p>

                        <div className="mt-2.5 flex items-center gap-2.5">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-blue-950/12 dark:bg-white/12">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-400 transition-[width] duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-[11px] font-bold text-[#07142B] dark:text-sky-100">
                            {b.progress}/{b.target}
                          </span>
                        </div>
                      </div>

                      {b.claimed ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/18 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          <Check className="h-3.5 w-3.5" />
                          Claimed
                        </span>
                      ) : b.readyToClaim ? (
                        <button
                          type="button"
                          onClick={() => {
                            haptics.success();
                            onClaimBounty(b);
                            pushToast(`Claimed +${b.rewardXp} XP & +${b.rewardCrystals}💎!`);
                          }}
                          className="min-h-[36px] shrink-0 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 text-xs font-bold text-white shadow-md transition-transform active:scale-95"
                        >
                          Claim +{b.rewardXp} XP · +{b.rewardCrystals}💎
                        </button>
                      ) : (
                        <span className="ios-glass-control tabular-nums shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-[#0B234A]/75 dark:text-sky-200/80">
                          +{b.rewardXp} XP · +{b.rewardCrystals}💎
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Universal XP & COC Penalty Rulebook */}
            <div className="ios-glass rounded-[26px] p-4 sm:p-5">
              <h2 className="text-sm font-bold text-[#07142B] dark:text-white">
                Universal XP &amp; COC Trophy Stakes Rulebook
              </h2>
              <p className="mt-0.5 text-xs text-[#0B234A]/75 dark:text-sky-200/75">
                Ticking off items anywhere across Dashboard, Timetable, Planner, Missed, Units &amp; Papers adds XP automatically.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { label: 'Self-Study Slot Complete', xp: `+${XP_VALUES.selfStudyComplete} XP`, cry: `+${CRYSTAL_VALUES.selfStudyComplete}💎`, good: true },
                  { label: 'Class Slot Complete', xp: `+${XP_VALUES.classComplete} XP`, cry: `+${CRYSTAL_VALUES.classComplete}💎`, good: true },
                  { label: 'Planner Task Complete', xp: `+${XP_VALUES.taskComplete} XP`, cry: `+${CRYSTAL_VALUES.taskComplete}💎`, good: true },
                  { label: 'Checklist Sub-Step Done', xp: `+${XP_VALUES.checklistSubItem} XP`, cry: `+${CRYSTAL_VALUES.checklistSubItem}💎`, good: true },
                  { label: 'Syllabus Unit Mastered', xp: `+${XP_VALUES.unitCovered} XP`, cry: `+${CRYSTAL_VALUES.unitCovered}💎`, good: true },
                  { label: 'Missed Item Caught Up', xp: `+${XP_VALUES.missedCovered} XP`, cry: `+${CRYSTAL_VALUES.missedCovered}💎`, good: true },
                  { label: 'Past Paper Logged / Reviewed', xp: `+${XP_VALUES.paperLog} / +${XP_VALUES.paperReview} XP`, cry: `+${CRYSTAL_VALUES.paperLog} / +${CRYSTAL_VALUES.paperReview}💎`, good: true },
                  { label: '1× Rescue Slot Comeback', xp: `+${XP_VALUES.rescueComeback} XP`, cry: `+${CRYSTAL_VALUES.rescueComeback}💎`, good: true },
                  { label: 'Split Session Check-In', xp: 'Pro-rated XP', cry: 'Zero Penalty', good: true },
                  { label: '1st Miss Penalty', xp: `${XP_VALUES.firstMissPenalty} XP`, cry: '1 Rescue Offered', good: false },
                  { label: '2nd Miss Double Bust', xp: `${XP_VALUES.secondMissDoubleBust} XP`, cry: 'Slot Locked', good: false },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="ios-glass-tile flex items-center justify-between gap-2 rounded-[18px] px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-[#07142B] dark:text-sky-100">
                      {row.label}
                    </span>
                    <span
                      className={`tabular-nums shrink-0 font-bold ${
                        row.good
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-rose-600 dark:text-rose-300'
                      }`}
                    >
                      {row.xp} · {row.cry}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FILTERABLE XP & TROPHY LOG */}
        {arenaTab === 'log' && (
          <div className="mt-4 space-y-3">
            <div className="ios-glass-control grid grid-cols-4 gap-1 rounded-full p-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'gain', label: 'Gains' },
                  { id: 'penalty', label: 'Penalties' },
                  { id: 'other', label: 'Bounties & Shop' },
                ] as { id: LogFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setLogFilter(f.id);
                  }}
                  className={`min-h-[34px] rounded-full px-2 text-[11px] font-bold transition-colors ${
                    logFilter === f.id
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/75'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="ios-glass rounded-[26px] px-5 py-10 text-center text-xs text-[#0B234A]/72 dark:text-sky-200/75">
                No XP entries in this filter yet. Tick off any slot, task, checklist step, or syllabus unit to start climbing!
              </div>
            ) : (
              <div className="ios-glass rounded-[26px] divide-y divide-blue-950/8 p-2 dark:divide-white/8">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {item.deltaXp < 0 ? (
                        <TrendingDown className="h-4 w-4 shrink-0 text-rose-500" />
                      ) : (
                        <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#07142B] dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-[#0B234A]/60 dark:text-sky-200/65">
                          {formatHistoryTime(item.timestampMs)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`tabular-nums shrink-0 font-bold ${
                        item.deltaXp < 0
                          ? 'text-rose-600 dark:text-rose-300'
                          : 'text-emerald-600 dark:text-emerald-300'
                      }`}
                    >
                      {item.deltaXp >= 0 ? `+${item.deltaXp}` : item.deltaXp} XP
                      {item.deltaCrystals !== 0
                        ? ` · ${item.deltaCrystals > 0 ? `+${item.deltaCrystals}` : item.deltaCrystals}💎`
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
