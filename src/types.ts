export type TabId =
  | 'dashboard'
  | 'timetable'
  | 'planner'
  | 'missed'
  | 'day'
  | 'papers'
  | 'countdown';

export type SubjectId = 'biology' | 'physics' | 'chemistry';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type SlotCategory = 'class' | 'self-study';

export type ClassMode = 'online' | 'physical';

export type RevisionStage = 'r1' | 'r2' | 'r3';

export type PaperFormat = 'both' | 'part1' | 'part2';

export type TimePreference = 'any' | 'morning' | 'afternoon' | 'night' | 'late-night';

export type TaskImportance = 'low' | 'medium' | 'high' | 'urgent';

export type WeekPattern = 'every' | 'week-a' | 'week-b';

export type FridayWeekMode = 'bio-week' | 'chem-only-week';

export type MissedCategory = 'recording' | 'homework';

export interface FridayAnchor {
  mondayISO: string;
  mode: FridayWeekMode;
}

export type FridayWeekOverrides = Record<string, FridayWeekMode>;

export type PaperReviewStatus = 'none' | 'needs-review' | 'reviewed';

export interface SyllabusUnit {
  id: string;
  subject: SubjectId;
  number: number;
  code: string;
  title: string;
}

export interface ClassPreset {
  id: string;
  subject: SubjectId;
  title: string;
  teacher: string;
  kind: 'Theory' | 'Paper' | 'Revision' | 'Catch-Up';
  defaultMode: ClassMode;
  defaultTravelBeforeMins: number;
  defaultTravelAfterMins: number;
  supportsReviseLoop: boolean;
}

export interface TimetableSlot {
  id: string;
  day: DayOfWeek;
  startTime: string; // HH:MM (24h)
  endTime: string;   // HH:MM (24h)
  category: SlotCategory;
  subject: SubjectId;
  classPresetId?: string;
  title: string;
  subtitle: string;
  autoBlock: boolean;
  mode?: ClassMode;
  travelBeforeMins?: number;
  travelAfterMins?: number;
  linkedTaskId?: string;
  linkedMissedId?: string;
  unitId?: string;
  revisionStage?: RevisionStage;
  sourceClassSlotId?: string;
  weekPattern?: WeekPattern;
  specificDateISO?: string; // One-off YYYY-MM-DD date; when omitted slot repeats weekly
  skippedDates?: string[];  // YYYY-MM-DD dates where a recurring slot is cancelled for that week only
  expiresAtISO?: string;
  isCatchUpClass?: boolean;
  isRescueSlot?: boolean;       // 1-time recovery slot created from missed check-in
  rescueSourceKey?: string;     // `${originDateISO}::${originSlotId}`
  rescheduleLocked?: boolean;   // True if failed or locked after rescue
}

export interface DayCompletionLog {
  dateISO: string; // YYYY-MM-DD
  completedSlotIds: string[];
  incompleteSlotIds?: string[];
  loggedMinutesBySlot?: Record<string, number>;
  plannedMinutes: number;
  completedMinutes: number;
  tasksTotal: number;
  tasksDone: number;
}

export interface PaperEntry {
  id: string;
  paperName: string;
  subject: SubjectId;
  classLabel: string;
  date: string; // YYYY-MM-DD
  format: PaperFormat;
  part1Score?: number;
  part1Max?: number;
  part2Score?: number;
  part2Max?: number;
  combinedPercent: number;
  note?: string;
  reviewStatus?: PaperReviewStatus;
  weakUnitIds?: string[];
  mistakesChecklist?: StudyChecklistItem[];
  linkedReviewTaskId?: string;
}

export interface StudyChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface StudyTask {
  id: string;
  title: string;
  subject: SubjectId;
  unitId?: string;
  kind: 'task' | 'revision-loop' | 'paper-review';
  sourceClassSlotId?: string;
  linkedPaperId?: string;
  defaultSessionMins: number;
  targetMinutes?: number;
  deadlineISO?: string;
  importance?: TaskImportance;
  checklist: StudyChecklistItem[];
  notes: string;
  status: 'active' | 'completed';
  order: number;
  createdAtISO: string;
  autoBlockDefault: boolean;
}

export interface MissedLessonItem {
  id: string;
  category: MissedCategory;
  subject: SubjectId;
  unitId?: string;
  title: string;
  notes: string;
  estimatedMins: number;
  playbackSpeed?: 1 | 1.25 | 1.5 | 2;
  deadlineISO?: string;
  importance: TaskImportance;
  status: 'active' | 'covered';
  autoBlockDefault: boolean;
  createdAtISO: string;
  rescheduleLocked?: boolean;
}

export interface SlotSuggestion {
  id: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMins: number;
  reason: string;
  autoBlock: boolean;
  revisionStage?: RevisionStage;
  note?: string;
  deadlineFit?: 'before-deadline' | 'after-deadline' | 'no-deadline';
  dateISO?: string;
}

export interface WeekPerformance {
  weekStartISO: string;
  label: string;
  range: string;
  completionPercent: number;
  tasksDone: number;
  tasksTotal: number;
  hoursCompleted: number;
  hoursPlanned: number;
}

export interface NativePermissionStatus {
  isNativeAndroid: boolean;
  usageAccess: boolean;
  overlayAccess: boolean;
  notifications: boolean;
  batteryUnrestricted: boolean;
}

export interface ActiveLockInfo {
  active: boolean;
  reason: string;
  untilTimeLabel: string;
  untilTimestampMs: number;
  source: 'auto-slot' | 'manual' | 'none';
}

/* =====================================================================
 * v3.2.0 LEAGUES, COC TROPHY PENALTIES, ABILITIES & APPEARANCE STUDIO
 * ===================================================================== */

export type LeagueId =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'apex';

export type DivisionNumber = 3 | 2 | 1;

export type AbilityId =
  | 'streak_shield'
  | 'focus_rush'
  | 'smart_gap_filler'
  | 'subject_balance_radar'
  | 'focus_soundscapes'
  | 'review_chain_radar'
  | 'exam_readiness_index';

export type AccentPresetId =
  | 'arctic'
  | 'cyan'
  | 'emerald'
  | 'cobalt'
  | 'violet'
  | 'holo'
  | 'solar-gold';

export type SubjectPaletteId =
  | 'classic'
  | 'neon-frost'
  | 'pastel-prism'
  | 'vivid-lab';

export type AuroraThemeId =
  | 'sapphire'
  | 'polar-dawn'
  | 'bio-reef'
  | 'midnight-violet'
  | 'cyber-holo'
  | 'liquid-chrome'
  | 'abyssal-gold'
  | 'custom';

export type LiveParticlesMode = 'off' | 'crystals' | 'sparks' | 'stardust';
export type CompletionFxMode = 'ripple' | 'burst' | 'aurora';
export type SoundscapePresetId = 'rain' | 'hum' | 'ocean';

export interface AppearanceStudioConfig {
  accentPreset: AccentPresetId;
  customTitle: string;
  subjectPalette: SubjectPaletteId;
  auroraTheme: AuroraThemeId;
  prismBorders: boolean;
  liveParticles: LiveParticlesMode;
  completionFx: CompletionFxMode;
  showCrestInHeader: boolean;
  customBgHex: string;
  customOrb1Hex: string;
  customOrb2Hex: string;
  customRimHex: string;
}

export type SlotCheckInOutcome =
  | 'completed'
  | 'split'
  | 'missed-rescued'
  | 'missed-dropped'
  | 'failed-locked';

export interface SlotCheckInEntry {
  key: string; // `${dateISO}::${slotId}`
  dateISO: string;
  slotId: string;
  outcome: SlotCheckInOutcome;
  xpDelta: number;
  resolvedAtMs: number;
  rescueSlotId?: string;
}

export interface ProgressLogEntry {
  id: string;
  timestampMs: number;
  deltaXp: number;
  deltaCrystals: number;
  label: string;
  tone: 'gain' | 'penalty' | 'comeback' | 'shop' | 'bounty' | 'reversal';
}

export interface ProgressionState {
  xp: number; // COC-style fluctuating League Rating (min 0)
  lifetimeXpEarned: number;
  crystals: number; // Spendable currency for buying & recharging abilities
  highestLeagueReached: LeagueId;
  currentLeague: LeagueId;
  promoShieldUntilMs: number; // 24h demotion grace after entering a higher league
  unlockedAbilities: Partial<Record<AbilityId, boolean>>;
  streakShieldCharges: number;
  focusRushCharges: number;
  focusRushUntilMs: number;
  streakDays: number;
  lastStudyDateISO: string;
  checkInAnchorISO: string; // Prevents Day-1 phantom penalties for historical dates
  checkIns: Record<string, SlotCheckInEntry>;
  rewardedEntities?: Record<string, { xp: number; cry: number }>;
  claimedBounties?: Record<string, string>;
  history: ProgressLogEntry[];
}
