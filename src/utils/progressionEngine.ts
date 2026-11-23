import {
  AbilityId,
  AccentPresetId,
  AppearanceStudioConfig,
  AuroraThemeId,
  DayCompletionLog,
  DivisionNumber,
  FridayAnchor,
  FridayWeekOverrides,
  LeagueId,
  LiveParticlesMode,
  MissedLessonItem,
  PaperEntry,
  ProgressLogEntry,
  ProgressionState,
  StudyTask,
  SubjectId,
  SubjectPaletteId,
  TimetableSlot,
} from '../types';
import { getMondayISOForDate, getTodayISO, getWeekDaysForOffset } from './dateUtils';

export interface LeagueSpec {
  id: LeagueId;
  order: number;
  name: string;
  shortName: string;
  minXp: number;
  maxXp: number; // exclusive upper bound except apex
  colorHex: string;
  glowRgba: string;
  badgeGradient: string;
  textClass: string;
  unlockSummary: string;
}

export const LEAGUES: LeagueSpec[] = [
  {
    id: 'bronze',
    order: 0,
    name: 'Bronze Initiate',
    shortName: 'Bronze',
    minXp: 0,
    maxXp: 250,
    colorHex: '#CD7F32',
    glowRgba: 'rgba(217, 119, 6, 0.35)',
    badgeGradient: 'from-amber-600 via-orange-500 to-amber-700',
    textClass: 'text-amber-700 dark:text-amber-300',
    unlockSummary: 'Arctic Sapphire base glass + 2 accent glows',
  },
  {
    id: 'silver',
    order: 1,
    name: 'Silver Scholar',
    shortName: 'Silver',
    minXp: 250,
    maxXp: 650,
    colorHex: '#94A3B8',
    glowRgba: 'rgba(148, 163, 184, 0.42)',
    badgeGradient: 'from-sky-400 via-blue-400 to-cyan-500',
    textClass: 'text-sky-700 dark:text-sky-200',
    unlockSummary: 'Streak Shield & Focus Rush + 4 accent hues + Custom Title',
  },
  {
    id: 'gold',
    order: 2,
    name: 'Gold Strategist',
    shortName: 'Gold',
    minXp: 650,
    maxXp: 1200,
    colorHex: '#F59E0B',
    glowRgba: 'rgba(245, 158, 11, 0.45)',
    badgeGradient: 'from-amber-400 via-yellow-400 to-orange-500',
    textClass: 'text-amber-600 dark:text-amber-300',
    unlockSummary: 'Smart Gap Filler & Subject Radar + Subject Glow Palettes',
  },
  {
    id: 'platinum',
    order: 3,
    name: 'Platinum Alchemist',
    shortName: 'Platinum',
    minXp: 1200,
    maxXp: 2000,
    colorHex: '#22D3EE',
    glowRgba: 'rgba(34, 211, 238, 0.50)',
    badgeGradient: 'from-cyan-400 via-teal-300 to-blue-500',
    textClass: 'text-cyan-700 dark:text-cyan-300',
    unlockSummary: 'Review Chain & Focus Soundscapes + Aurora Atmosphere Engine',
  },
  {
    id: 'diamond',
    order: 4,
    name: 'Diamond Sovereign',
    shortName: 'Diamond',
    minXp: 2000,
    maxXp: 3200,
    colorHex: '#38BDF8',
    glowRgba: 'rgba(56, 189, 248, 0.58)',
    badgeGradient: 'from-blue-500 via-cyan-300 to-violet-500',
    textClass: 'text-blue-700 dark:text-cyan-200',
    unlockSummary: 'Exam Readiness Index + Iridescent Prism Rims & Completion FX',
  },
  {
    id: 'apex',
    order: 5,
    name: 'Sapphire Apex',
    shortName: 'Apex',
    minXp: 3200,
    maxXp: 999999,
    colorHex: '#60A5FA',
    glowRgba: 'rgba(96, 165, 250, 0.68)',
    badgeGradient: 'from-cyan-300 via-blue-500 to-emerald-400',
    textClass: 'text-blue-700 dark:text-cyan-200',
    unlockSummary: 'Full Studio Mode: Live Particles, Holo Presets & Custom Theme Forge',
  },
];

export interface AbilitySpec {
  id: AbilityId;
  name: string;
  tagline: string;
  description: string;
  requiredLeague: LeagueId;
  unlockCostCrystals: number;
  kind: 'passive' | 'charge';
  chargeCostCrystals?: number;
  chargeLabel?: string;
}

export const ABILITIES: AbilitySpec[] = [
  {
    id: 'streak_shield',
    name: 'Streak Shield',
    tagline: 'Daily streak armor',
    description: 'Protects your study streak for 1 missed day so momentum never snaps from a busy evening.',
    requiredLeague: 'silver',
    unlockCostCrystals: 40,
    kind: 'charge',
    chargeCostCrystals: 25,
    chargeLabel: 'Buy +1 Shield Charge',
  },
  {
    id: 'focus_rush',
    name: '2× Focus Rush',
    tagline: 'Double XP power hour',
    description: 'Triggers a 60m or 90m lock session where all finished blocks, tasks & papers earn 2× XP.',
    requiredLeague: 'silver',
    unlockCostCrystals: 50,
    kind: 'charge',
    chargeCostCrystals: 20,
    chargeLabel: 'Buy +1 Rush Charge',
  },
  {
    id: 'smart_gap_filler',
    name: 'Smart Gap Filler',
    tagline: '1-tap backlog auto-scheduler',
    description: 'Scans your open week around classes & 2h travel buffers to slot Missed lessons automatically.',
    requiredLeague: 'gold',
    unlockCostCrystals: 80,
    kind: 'passive',
  },
  {
    id: 'subject_balance_radar',
    name: 'Subject Balance Radar',
    tagline: 'Bio / Phy / Chem split check',
    description: 'Highlights neglected subjects on Home and warns early before an imbalance hurts mocks.',
    requiredLeague: 'gold',
    unlockCostCrystals: 75,
    kind: 'passive',
  },
  {
    id: 'focus_soundscapes',
    name: 'Focus Soundscapes',
    tagline: 'Offline study audio engine',
    description: 'Synthesizes crisp Rain on Glass, 40Hz Sapphire Hum & Ocean Noise inside Focus Rush.',
    requiredLeague: 'platinum',
    unlockCostCrystals: 110,
    kind: 'passive',
  },
  {
    id: 'review_chain_radar',
    name: 'Review Chain & Weak Radar',
    tagline: '1.5× review XP + error map',
    description: 'Awards 1.5× XP for reviewing Past Papers fast & ranks your weakest syllabus units across papers.',
    requiredLeague: 'platinum',
    unlockCostCrystals: 120,
    kind: 'passive',
  },
  {
    id: 'exam_readiness_index',
    name: 'Exam Readiness Index',
    tagline: 'Live A/L readiness forecast',
    description: 'Combines weekly completion, paper averages, review rate & subject balance on Exam Countdown.',
    requiredLeague: 'diamond',
    unlockCostCrystals: 160,
    kind: 'passive',
  },
];

export const XP_VALUES = {
  classComplete: 30,
  selfStudyComplete: 45,
  taskComplete: 15,
  checklistSubItem: 5,
  unitCovered: 25,
  paperLog: 50,
  paperReview: 40,
  missedCovered: 25,
  firstMissPenalty: -30,
  rescueComeback: 50, // Recovers -30 + grants +20 net comeback bonus
  secondMissDoubleBust: -70,
};

export const CRYSTAL_VALUES = {
  classComplete: 12,
  selfStudyComplete: 18,
  taskComplete: 6,
  checklistSubItem: 2,
  unitCovered: 10,
  paperLog: 22,
  paperReview: 16,
  missedCovered: 10,
  rescueComeback: 20,
  leaguePromoBonus: 45,
};

export const DEFAULT_STUDIO_CONFIG: AppearanceStudioConfig = {
  accentPreset: 'arctic',
  customTitle: '',
  subjectPalette: 'classic',
  auroraTheme: 'sapphire',
  prismBorders: false,
  liveParticles: 'off',
  completionFx: 'ripple',
  showCrestInHeader: true,
  customBgHex: '#020B24',
  customOrb1Hex: '#2563EB',
  customOrb2Hex: '#22D3EE',
  customRimHex: '#38BDF8',
};

export function createDefaultProgressionState(): ProgressionState {
  return {
    xp: 0,
    lifetimeXpEarned: 0,
    crystals: 30, // Starter crystals so user can preview saving toward first unlock
    highestLeagueReached: 'bronze',
    currentLeague: 'bronze',
    promoShieldUntilMs: 0,
    unlockedAbilities: {},
    streakShieldCharges: 0,
    focusRushCharges: 0,
    focusRushUntilMs: 0,
    streakDays: 0,
    lastStudyDateISO: '',
    checkInAnchorISO: getTodayISO(),
    checkIns: {},
    rewardedEntities: {},
    claimedBounties: {},
    history: [],
  };
}

export function getLeagueOrder(leagueId: LeagueId): number {
  return LEAGUES.find((l) => l.id === leagueId)?.order ?? 0;
}

export function getLeagueSpec(leagueId: LeagueId): LeagueSpec {
  return LEAGUES.find((l) => l.id === leagueId) ?? LEAGUES[0];
}

export function computeRawLeagueFromXp(xp: number): LeagueSpec {
  const safeXp = Math.max(0, Math.round(xp));
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (safeXp >= LEAGUES[i].minXp) return LEAGUES[i];
  }
  return LEAGUES[0];
}

export function getDivisionInfo(xp: number, leagueId: LeagueId): {
  league: LeagueSpec;
  division: DivisionNumber;
  roman: 'III' | 'II' | 'I';
  progressPercent: number;
  xpToNextLeague: number;
  nextLeague: LeagueSpec | null;
} {
  const league = getLeagueSpec(leagueId);
  const nextLeague = LEAGUES[league.order + 1] ?? null;

  if (!nextLeague) {
    return {
      league,
      division: 1,
      roman: 'I',
      progressPercent: 100,
      xpToNextLeague: 0,
      nextLeague: null,
    };
  }

  const span = Math.max(1, nextLeague.minXp - league.minXp);
  const rel = Math.max(0, Math.min(span, xp - league.minXp));
  const ratio = rel / span;
  const division: DivisionNumber = ratio >= 0.66 ? 1 : ratio >= 0.33 ? 2 : 3;
  const roman = division === 1 ? 'I' : division === 2 ? 'II' : 'III';

  return {
    league,
    division,
    roman,
    progressPercent: Math.round(ratio * 100),
    xpToNextLeague: Math.max(0, nextLeague.minXp - xp),
    nextLeague,
  };
}

export function isLeagueAtLeast(current: LeagueId, required: LeagueId): boolean {
  return getLeagueOrder(current) >= getLeagueOrder(required);
}

export function isAbilityActive(
  progression: ProgressionState,
  abilityId: AbilityId,
): boolean {
  const spec = ABILITIES.find((a) => a.id === abilityId);
  if (!spec) return false;
  if (!isLeagueAtLeast(progression.currentLeague, spec.requiredLeague)) {
    return false;
  }
  return Boolean(progression.unlockedAbilities[abilityId]);
}

export function isFocusRushActive(progression: ProgressionState, nowMs = Date.now()): boolean {
  return progression.focusRushUntilMs > nowMs && isLeagueAtLeast(progression.currentLeague, 'silver');
}

export function applyProgressDelta(
  prev: ProgressionState,
  deltaXpRaw: number,
  deltaCrystalsRaw: number,
  label: string,
  tone: ProgressLogEntry['tone'],
  nowMs: number = Date.now(),
): {
  next: ProgressionState;
  promotedTo: LeagueSpec | null;
  demotedTo: LeagueSpec | null;
  shieldSavedDemotion: boolean;
} {
  const rushMultiplier =
    deltaXpRaw > 0 && isFocusRushActive(prev, nowMs) && tone !== 'bounty' ? 2 : 1;
  const deltaXp = Math.round(deltaXpRaw * rushMultiplier);
  const deltaCrystals = Math.round(deltaCrystalsRaw);

  const nextXp = Math.max(0, prev.xp + deltaXp);
  const nextCrystals = Math.max(0, prev.crystals + deltaCrystals);
  const lifetimeXpEarned =
    deltaXp > 0
      ? prev.lifetimeXpEarned + deltaXp
      : tone === 'reversal'
        ? Math.max(0, prev.lifetimeXpEarned + deltaXp)
        : prev.lifetimeXpEarned;

  const prevSpec = getLeagueSpec(prev.currentLeague);
  const rawSpec = computeRawLeagueFromXp(nextXp);

  let nextLeague = prev.currentLeague;
  let nextPromoShieldUntilMs = prev.promoShieldUntilMs;
  let promotedTo: LeagueSpec | null = null;
  let demotedTo: LeagueSpec | null = null;
  let shieldSavedDemotion = false;
  let bonusCrystals = 0;

  if (rawSpec.order > prevSpec.order) {
    nextLeague = rawSpec.id;
    promotedTo = rawSpec;
    // Grant 24h COC promotion shield against instant bounce-back
    nextPromoShieldUntilMs = nowMs + 24 * 60 * 60 * 1000;
    bonusCrystals = CRYSTAL_VALUES.leaguePromoBonus;
  } else if (rawSpec.order < prevSpec.order) {
    if (tone !== 'reversal' && prev.promoShieldUntilMs > nowMs) {
      shieldSavedDemotion = true;
      nextLeague = prev.currentLeague;
    } else {
      nextLeague = rawSpec.id;
      if (tone !== 'reversal') {
        demotedTo = rawSpec;
      }
    }
  }

  const highestLeagueReached =
    getLeagueOrder(nextLeague) > getLeagueOrder(prev.highestLeagueReached)
      ? nextLeague
      : prev.highestLeagueReached;

  const todayISO = getTodayISO(new Date(nowMs));
  let streakDays = prev.streakDays;
  let lastStudyDateISO = prev.lastStudyDateISO;
  let streakShieldCharges = prev.streakShieldCharges;

  if (deltaXp > 0 && tone !== 'shop') {
    if (!lastStudyDateISO) {
      streakDays = 1;
      lastStudyDateISO = todayISO;
    } else if (lastStudyDateISO !== todayISO) {
      const prevD = new Date(`${lastStudyDateISO}T00:00:00`);
      const curD = new Date(`${todayISO}T00:00:00`);
      const diffDays = Math.round((curD.getTime() - prevD.getTime()) / 86400000);
      if (diffDays === 1) {
        streakDays += 1;
      } else if (diffDays === 2 && streakShieldCharges > 0 && isAbilityActive(prev, 'streak_shield')) {
        // Streak Shield absorbs a 1-day gap automatically!
        streakShieldCharges -= 1;
        streakDays += 1;
      } else if (diffDays > 1) {
        streakDays = 1;
      }
      lastStudyDateISO = todayISO;
    }
  }

  const logEntry: ProgressLogEntry = {
    id: `xp-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    timestampMs: nowMs,
    deltaXp,
    deltaCrystals: deltaCrystals + bonusCrystals,
    label: rushMultiplier > 1 ? `${label} (2× Rush)` : label,
    tone,
  };

  return {
    next: {
      ...prev,
      xp: nextXp,
      lifetimeXpEarned,
      crystals: nextCrystals + bonusCrystals,
      currentLeague: nextLeague,
      highestLeagueReached,
      promoShieldUntilMs: nextPromoShieldUntilMs,
      streakDays,
      lastStudyDateISO,
      streakShieldCharges,
      history: [logEntry, ...prev.history].slice(0, 40),
    },
    promotedTo,
    demotedTo,
    shieldSavedDemotion,
  };
}

/* =====================================================================
 * DAILY & WEEKLY ARENA BOUNTIES
 * ===================================================================== */

export interface ArenaBountyItem {
  id: string;
  cadence: 'daily' | 'weekly';
  periodKey: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardXp: number;
  rewardCrystals: number;
  claimed: boolean;
  readyToClaim: boolean;
}

export function evaluateArenaBounties(params: {
  progression: ProgressionState;
  slots: TimetableSlot[];
  tasks: StudyTask[];
  missedItems: MissedLessonItem[];
  papers: PaperEntry[];
  dailyLogs: Record<string, DayCompletionLog>;
  unitCoveredMap: Record<string, boolean>;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  now?: Date;
}): ArenaBountyItem[] {
  const now = params.now ?? new Date();
  const todayISO = getTodayISO(now);
  const mondayISO = getMondayISOForDate(todayISO);
  const weekDays = getWeekDaysForOffset(0, now);
  const claimedMap = params.progression.claimedBounties ?? {};

  const todayDoneSlots = params.dailyLogs[todayISO]?.completedSlotIds.length ?? 0;
  const rewardedKeys = Object.keys(params.progression.rewardedEntities ?? {});
  const tasksDoneCount = params.tasks.filter((t) => t.status === 'completed').length;
  const checklistDoneCount = params.tasks.reduce(
    (acc, t) => acc + t.checklist.filter((c) => c.done).length,
    0,
  );
  const coveredUnitsCount = Object.values(params.unitCoveredMap).filter(Boolean).length;
  const coveredMissedCount = params.missedItems.filter((m) => m.status === 'covered').length;
  const reviewedPapersCount = params.papers.filter((p) => p.reviewStatus === 'reviewed').length;

  // Bounty 1 (Daily): Finish 2 scheduled blocks today (or completed task/unit rewards)
  const warmupProgress = Math.min(2, todayDoneSlots + (tasksDoneCount > 0 && todayDoneSlots === 0 ? 1 : 0));

  // Bounty 2 (Daily): Clear 1 Missed item or review 1 Past Paper (or rescue comeback)
  const rescueCount = Object.values(params.progression.checkIns).filter(
    (c) => c.dateISO === todayISO && c.outcome === 'completed' && c.slotId.startsWith('slot-rescue-'),
  ).length;
  const terminatorProgress = Math.min(1, coveredMissedCount + reviewedPapersCount + rescueCount);

  // Bounty 3 (Weekly): Balanced Trio - at least 1 completed slot across Bio, Phy, and Chem this week
  const subjectsDoneThisWeek = new Set<SubjectId>();
  for (const wd of weekDays) {
    const doneIds = params.dailyLogs[wd.dateISO]?.completedSlotIds ?? [];
    for (const sid of doneIds) {
      const sl = params.slots.find((s) => s.id === sid);
      if (sl) subjectsDoneThisWeek.add(sl.subject);
    }
  }
  if (subjectsDoneThisWeek.size < 3) {
    for (const t of params.tasks) {
      if (t.status === 'completed') subjectsDoneThisWeek.add(t.subject);
    }
  }
  const trioProgress = Math.min(3, subjectsDoneThisWeek.size);

  // Bounty 4 (Weekly): Syllabus & Checklist Climber (1 covered unit OR 4 checklist steps OR 3 lifetime completions)
  const climberUnitsOrSteps = Math.min(4, coveredUnitsCount * 4 + checklistDoneCount + (rewardedKeys.length >= 4 ? 1 : 0));

  const specs: Array<Omit<ArenaBountyItem, 'claimed' | 'readyToClaim'>> = [
    {
      id: 'daily_warmup',
      cadence: 'daily',
      periodKey: todayISO,
      title: 'Daily Momentum Warm-Up',
      description: 'Tick off 2 timetable slots (or 1 slot + 1 planner task) today.',
      progress: warmupProgress,
      target: 2,
      rewardXp: 35,
      rewardCrystals: 15,
    },
    {
      id: 'daily_backlog_paper',
      cadence: 'daily',
      periodKey: todayISO,
      title: 'Backlog & Paper Sharp',
      description: 'Clear 1 Missed backlog item, review 1 Past Paper, or complete a Rescue slot.',
      progress: terminatorProgress,
      target: 1,
      rewardXp: 40,
      rewardCrystals: 18,
    },
    {
      id: 'weekly_balanced_trio',
      cadence: 'weekly',
      periodKey: mondayISO,
      title: 'Balanced Trio (Bio · Phy · Chem)',
      description: 'Complete at least 1 slot or task in all 3 A/L subjects this week.',
      progress: trioProgress,
      target: 3,
      rewardXp: 85,
      rewardCrystals: 36,
    },
    {
      id: 'weekly_syllabus_climber',
      cadence: 'weekly',
      periodKey: mondayISO,
      title: 'Checklist & Syllabus Climber',
      description: 'Master 1 full Syllabus Unit or tick off 4 Planner checklist sub-steps.',
      progress: climberUnitsOrSteps,
      target: 4,
      rewardXp: 70,
      rewardCrystals: 30,
    },
  ];

  return specs.map((b) => {
    const claimed = claimedMap[b.id] === b.periodKey;
    return {
      ...b,
      claimed,
      readyToClaim: !claimed && b.progress >= b.target,
    };
  });
}

/* =====================================================================
 * PROGRESSION-LOCKED APPEARANCE STUDIO CATALOG
 * ===================================================================== */

export const ACCENT_PRESETS: Array<{
  id: AccentPresetId;
  label: string;
  requiredLeague: LeagueId;
  swatchClass: string;
  primaryHex: string;
}> = [
  { id: 'arctic', label: 'Arctic', requiredLeague: 'bronze', swatchClass: 'bg-blue-600', primaryHex: '#2563EB' },
  { id: 'cyan', label: 'Frost Cyan', requiredLeague: 'bronze', swatchClass: 'bg-cyan-500', primaryHex: '#06B6D4' },
  { id: 'emerald', label: 'Bio Emerald', requiredLeague: 'silver', swatchClass: 'bg-emerald-500', primaryHex: '#10B981' },
  { id: 'cobalt', label: 'Deep Cobalt', requiredLeague: 'silver', swatchClass: 'bg-sky-600', primaryHex: '#0284C7' },
  { id: 'violet', label: 'Plasma', requiredLeague: 'gold', swatchClass: 'bg-violet-500', primaryHex: '#8B5CF6' },
  { id: 'holo', label: 'Holo Prism', requiredLeague: 'diamond', swatchClass: 'bg-gradient-to-tr from-cyan-400 to-violet-500', primaryHex: '#22D3EE' },
  { id: 'solar-gold', label: 'Apex Gold', requiredLeague: 'apex', swatchClass: 'bg-gradient-to-tr from-amber-400 to-cyan-400', primaryHex: '#F59E0B' },
];

export const SUBJECT_PALETTES: Array<{
  id: SubjectPaletteId;
  label: string;
  requiredLeague: LeagueId;
  desc: string;
}> = [
  { id: 'classic', label: 'Classic Lab', requiredLeague: 'bronze', desc: 'Emerald Bio · Orange Phy · Violet Chem' },
  { id: 'neon-frost', label: 'Neon Frost', requiredLeague: 'gold', desc: 'Bright cyan-infused high-glow borders' },
  { id: 'pastel-prism', label: 'Pastel Prism', requiredLeague: 'platinum', desc: 'Soft iridescent crystalline wash' },
  { id: 'vivid-lab', label: 'Apex Vivid', requiredLeague: 'apex', desc: 'Saturated high-contrast luminous glass' },
];

export const AURORA_THEMES: Array<{
  id: AuroraThemeId;
  label: string;
  requiredLeague: LeagueId;
  lightBg: string;
  darkBg: string;
  orb1: string;
  orb2: string;
}> = [
  {
    id: 'sapphire',
    label: 'Arctic Sapphire',
    requiredLeague: 'bronze',
    lightBg: '#CFE3FF',
    darkBg: '#02071A',
    orb1: 'rgba(37,99,235,0.44)',
    orb2: 'rgba(34,211,238,0.38)',
  },
  {
    id: 'polar-dawn',
    label: 'Polar Dawn',
    requiredLeague: 'platinum',
    lightBg: '#D8ECFF',
    darkBg: '#06112E',
    orb1: 'rgba(14,165,233,0.46)',
    orb2: 'rgba(167,139,250,0.34)',
  },
  {
    id: 'bio-reef',
    label: 'Bioluminescent',
    requiredLeague: 'platinum',
    lightBg: '#CCF5EE',
    darkBg: '#02181E',
    orb1: 'rgba(16,185,129,0.42)',
    orb2: 'rgba(34,211,238,0.42)',
  },
  {
    id: 'midnight-violet',
    label: 'Plasma Dusk',
    requiredLeague: 'platinum',
    lightBg: '#DCE4FF',
    darkBg: '#090624',
    orb1: 'rgba(124,58,237,0.42)',
    orb2: 'rgba(56,189,248,0.38)',
  },
  {
    id: 'cyber-holo',
    label: 'Cyber Holo',
    requiredLeague: 'diamond',
    lightBg: '#CCF0FF',
    darkBg: '#020E24',
    orb1: 'rgba(6,182,212,0.52)',
    orb2: 'rgba(168,85,247,0.40)',
  },
  {
    id: 'liquid-chrome',
    label: 'Liquid Chrome',
    requiredLeague: 'diamond',
    lightBg: '#E2ECFA',
    darkBg: '#050C1C',
    orb1: 'rgba(148,163,184,0.48)',
    orb2: 'rgba(56,189,248,0.40)',
  },
  {
    id: 'abyssal-gold',
    label: 'Abyssal Gold',
    requiredLeague: 'apex',
    lightBg: '#DFEAFF',
    darkBg: '#04091E',
    orb1: 'rgba(245,158,11,0.38)',
    orb2: 'rgba(34,211,238,0.48)',
  },
  {
    id: 'custom',
    label: 'Theme Forge',
    requiredLeague: 'apex',
    lightBg: '#CFE3FF',
    darkBg: '#020B24',
    orb1: 'rgba(37,99,235,0.45)',
    orb2: 'rgba(34,211,238,0.42)',
  },
];

export const PARTICLE_MODES: Array<{
  id: LiveParticlesMode;
  label: string;
  requiredLeague: LeagueId;
}> = [
  { id: 'off', label: 'Off', requiredLeague: 'bronze' },
  { id: 'crystals', label: 'Ice Crystals', requiredLeague: 'diamond' },
  { id: 'sparks', label: 'Bio Sparks', requiredLeague: 'apex' },
  { id: 'stardust', label: 'Apex Stardust', requiredLeague: 'apex' },
];

export function resolveEffectiveStudio(
  studio: AppearanceStudioConfig,
  currentLeague: LeagueId,
): AppearanceStudioConfig {
  const acc = ACCENT_PRESETS.find((a) => a.id === studio.accentPreset);
  const pal = SUBJECT_PALETTES.find((p) => p.id === studio.subjectPalette);
  const aur = AURORA_THEMES.find((a) => a.id === studio.auroraTheme);
  const part = PARTICLE_MODES.find((p) => p.id === studio.liveParticles);

  return {
    ...studio,
    accentPreset:
      acc && isLeagueAtLeast(currentLeague, acc.requiredLeague)
        ? studio.accentPreset
        : 'arctic',
    customTitle: isLeagueAtLeast(currentLeague, 'silver') ? studio.customTitle : '',
    subjectPalette:
      pal && isLeagueAtLeast(currentLeague, pal.requiredLeague)
        ? studio.subjectPalette
        : 'classic',
    auroraTheme:
      aur && isLeagueAtLeast(currentLeague, aur.requiredLeague)
        ? studio.auroraTheme
        : 'sapphire',
    prismBorders: isLeagueAtLeast(currentLeague, 'diamond') ? studio.prismBorders : false,
    liveParticles:
      part && isLeagueAtLeast(currentLeague, part.requiredLeague)
        ? studio.liveParticles
        : 'off',
    completionFx: isLeagueAtLeast(currentLeague, 'diamond')
      ? studio.completionFx
      : 'ripple',
  };
}
