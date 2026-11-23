import { buildCleanDefaultClassSlots } from '../data/previewData';
import {
  AppearanceStudioConfig,
  DayCompletionLog,
  FridayAnchor,
  FridayWeekMode,
  FridayWeekOverrides,
  MissedLessonItem,
  PaperEntry,
  ProgressionState,
  StudyTask,
  TimetableSlot,
} from '../types';
import { getMondayOfWeek, getTodayISO, toISODate } from './dateUtils';
import {
  createDefaultProgressionState,
  DEFAULT_STUDIO_CONFIG,
} from './progressionEngine';

const KEYS = {
  slots: 'thisweek_slots_v1',
  scheduleSeededV222: 'thisweek_schedule_v222_clean',
  commutePatchV223: 'thisweek_commute_patch_v223',
  fridayWeekMode: 'thisweek_friday_mode_v1',
  fridayAnchor: 'thisweek_friday_anchor_v311',
  fridayOverrides: 'thisweek_friday_overrides_v311',
  papers: 'thisweek_papers_v1',
  dailyLogs: 'thisweek_daily_logs_v1',
  tasks: 'thisweek_planner_tasks_v2',
  missed: 'thisweek_missed_v1',
  unitCovered: 'thisweek_unit_covered_v1',
  theme: 'thisweek_theme_v1',
  manualLockUntil: 'thisweek_manual_lock_until_v1',
  notifiedSlots: 'thisweek_notified_slots_v1',
  glassTransparency: 'thisweek_glass_transparency_v1',
  calmBackdrop: 'thisweek_calm_backdrop_v1',
  progression: 'thisweek_progression_v320',
  studio: 'thisweek_studio_v320',
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadSlots(): TimetableSlot[] {
  try {
    const seeded = window.localStorage.getItem(KEYS.scheduleSeededV222);
    if (!seeded) {
      const cleanSlots = buildCleanDefaultClassSlots(getTodayISO());
      window.localStorage.setItem(KEYS.scheduleSeededV222, '1');
      window.localStorage.setItem(KEYS.commutePatchV223, '1');
      safeWrite(KEYS.slots, cleanSlots);
      return cleanSlots;
    }

    const stored = safeRead<TimetableSlot[]>(KEYS.slots, []);
    const patched = window.localStorage.getItem(KEYS.commutePatchV223);
    if (!patched && stored.length > 0) {
      const updated = stored.map((slot) => {
        if (slot.id === 'cls-thu-phy-paper') {
          return {
            ...slot,
            travelBeforeMins: 120,
            travelAfterMins: 210,
            subtitle: 'Physical · Leave 5:00 AM · Home ~4:30 PM',
          };
        }
        if (slot.id === 'cls-fri-bio-paper-a') {
          return {
            ...slot,
            travelBeforeMins: 120,
            travelAfterMins: 120,
            subtitle: 'Bi-weekly Physical · Leave 6:00 AM',
          };
        }
        if (slot.id === 'cls-fri-chem-paper-a') {
          return {
            ...slot,
            travelBeforeMins: 120,
            travelAfterMins: 90,
            subtitle: 'Physical (Bio Week) · Home ~4:30 PM',
          };
        }
        if (slot.id === 'cls-fri-chem-paper-b') {
          return {
            ...slot,
            travelBeforeMins: 120,
            travelAfterMins: 150,
            subtitle: 'Physical (No-Bio Week) · Leave 6:00 AM · Home ~2:30 PM',
          };
        }
        return slot;
      });
      window.localStorage.setItem(KEYS.commutePatchV223, '1');
      safeWrite(KEYS.slots, updated);
      return updated;
    }
    return stored;
  } catch {
    // Fallback below
  }
  return safeRead<TimetableSlot[]>(KEYS.slots, []);
}

export function saveSlots(slots: TimetableSlot[]): void {
  safeWrite(KEYS.slots, slots);
}

export function loadFridayWeekMode(): FridayWeekMode {
  return safeRead<FridayWeekMode>(KEYS.fridayWeekMode, 'bio-week');
}

export function saveFridayWeekMode(mode: FridayWeekMode): void {
  safeWrite(KEYS.fridayWeekMode, mode);
}

export function loadFridayAnchor(): FridayAnchor {
  const defaultMonday = toISODate(getMondayOfWeek(new Date()));
  const legacyMode = loadFridayWeekMode();
  return safeRead<FridayAnchor>(KEYS.fridayAnchor, {
    mondayISO: defaultMonday,
    mode: legacyMode,
  });
}

export function saveFridayAnchor(anchor: FridayAnchor): void {
  safeWrite(KEYS.fridayAnchor, anchor);
  saveFridayWeekMode(anchor.mode);
}

export function loadFridayOverrides(): FridayWeekOverrides {
  return safeRead<FridayWeekOverrides>(KEYS.fridayOverrides, {});
}

export function saveFridayOverrides(overrides: FridayWeekOverrides): void {
  safeWrite(KEYS.fridayOverrides, overrides);
}

export function loadPapers(): PaperEntry[] {
  return safeRead<PaperEntry[]>(KEYS.papers, []);
}

export function savePapers(papers: PaperEntry[]): void {
  safeWrite(KEYS.papers, papers);
}

export function loadDailyLogs(): Record<string, DayCompletionLog> {
  return safeRead<Record<string, DayCompletionLog>>(KEYS.dailyLogs, {});
}

export function saveDailyLogs(logs: Record<string, DayCompletionLog>): void {
  safeWrite(KEYS.dailyLogs, logs);
}

export function loadTasks(): StudyTask[] {
  return safeRead<StudyTask[]>(KEYS.tasks, []);
}

export function saveTasks(tasks: StudyTask[]): void {
  safeWrite(KEYS.tasks, tasks);
}

export function loadMissedLessons(): MissedLessonItem[] {
  return safeRead<MissedLessonItem[]>(KEYS.missed, []);
}

export function saveMissedLessons(items: MissedLessonItem[]): void {
  safeWrite(KEYS.missed, items);
}

export function loadUnitCoveredMap(): Record<string, boolean> {
  return safeRead<Record<string, boolean>>(KEYS.unitCovered, {});
}

export function saveUnitCoveredMap(map: Record<string, boolean>): void {
  safeWrite(KEYS.unitCovered, map);
}

export function loadThemeDark(): boolean {
  return safeRead<boolean>(KEYS.theme, true);
}

export function saveThemeDark(isDark: boolean): void {
  safeWrite(KEYS.theme, isDark);
}

export function loadManualLockUntil(): number {
  return safeRead<number>(KEYS.manualLockUntil, 0);
}

export function saveManualLockUntil(timestampMs: number): void {
  safeWrite(KEYS.manualLockUntil, timestampMs);
}

export function loadNotifiedKeys(): Record<string, boolean> {
  return safeRead<Record<string, boolean>>(KEYS.notifiedSlots, {});
}

export function saveNotifiedKeys(keys: Record<string, boolean>): void {
  safeWrite(KEYS.notifiedSlots, keys);
}

export function loadGlassTransparency(): number {
  const val = safeRead<number>(KEYS.glassTransparency, 72);
  return Math.max(0, Math.min(100, Number.isFinite(val) ? val : 72));
}

export function saveGlassTransparency(val: number): void {
  safeWrite(KEYS.glassTransparency, Math.max(0, Math.min(100, Math.round(val))));
}

export function loadCalmBackdrop(): boolean {
  return safeRead<boolean>(KEYS.calmBackdrop, true);
}

export function saveCalmBackdrop(calm: boolean): void {
  safeWrite(KEYS.calmBackdrop, calm);
}

export function loadProgressionState(): ProgressionState {
  const fallback = createDefaultProgressionState();
  const stored = safeRead<Partial<ProgressionState>>(KEYS.progression, {});
  return {
    ...fallback,
    ...stored,
    unlockedAbilities: stored.unlockedAbilities ?? {},
    checkIns: stored.checkIns ?? {},
    rewardedEntities: stored.rewardedEntities ?? {},
    claimedBounties: stored.claimedBounties ?? {},
    history: Array.isArray(stored.history) ? stored.history : [],
    checkInAnchorISO:
      typeof stored.checkInAnchorISO === 'string' && stored.checkInAnchorISO.length >= 10
        ? stored.checkInAnchorISO
        : fallback.checkInAnchorISO,
  };
}

export function saveProgressionState(state: ProgressionState): void {
  safeWrite(KEYS.progression, state);
}

export function loadStudioConfig(): AppearanceStudioConfig {
  const stored = safeRead<Partial<AppearanceStudioConfig>>(KEYS.studio, {});
  return {
    ...DEFAULT_STUDIO_CONFIG,
    ...stored,
  };
}

export function saveStudioConfig(studio: AppearanceStudioConfig): void {
  safeWrite(KEYS.studio, studio);
}

export interface ThisWeekBackupData {
  slots: TimetableSlot[];
  fridayAnchor: FridayAnchor;
  fridayOverrides: FridayWeekOverrides;
  papers: PaperEntry[];
  dailyLogs: Record<string, DayCompletionLog>;
  tasks: StudyTask[];
  missedItems: MissedLessonItem[];
  unitCoveredMap: Record<string, boolean>;
  isDark: boolean;
  glassTransparency: number;
  calmBackdrop: boolean;
  progression?: ProgressionState;
  studio?: AppearanceStudioConfig;
}

export interface ThisWeekBackupBundle {
  app: 'ThisWeek';
  version: 1 | 2;
  exportedAtISO: string;
  data: ThisWeekBackupData;
}

export function buildVaultSnapshot(custom?: Partial<ThisWeekBackupData>): ThisWeekBackupBundle {
  return {
    app: 'ThisWeek',
    version: 2,
    exportedAtISO: new Date().toISOString(),
    data: {
      slots: custom?.slots ?? loadSlots(),
      fridayAnchor: custom?.fridayAnchor ?? loadFridayAnchor(),
      fridayOverrides: custom?.fridayOverrides ?? loadFridayOverrides(),
      papers: custom?.papers ?? loadPapers(),
      dailyLogs: custom?.dailyLogs ?? loadDailyLogs(),
      tasks: custom?.tasks ?? loadTasks(),
      missedItems: custom?.missedItems ?? loadMissedLessons(),
      unitCoveredMap: custom?.unitCoveredMap ?? loadUnitCoveredMap(),
      isDark: custom?.isDark ?? loadThemeDark(),
      glassTransparency: custom?.glassTransparency ?? loadGlassTransparency(),
      calmBackdrop: custom?.calmBackdrop ?? loadCalmBackdrop(),
      progression: custom?.progression ?? loadProgressionState(),
      studio: custom?.studio ?? loadStudioConfig(),
    },
  };
}

export function exportVaultJson(custom?: Partial<ThisWeekBackupData>): string {
  return JSON.stringify(buildVaultSnapshot(custom));
}

export function parseVaultBundle(rawJson: string): ThisWeekBackupBundle | null {
  try {
    const parsed = JSON.parse(rawJson) as Partial<ThisWeekBackupBundle>;
    if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
      return null;
    }
    const d = parsed.data as Partial<ThisWeekBackupData>;
    if (!Array.isArray(d.slots)) {
      return null;
    }
    const defProg = createDefaultProgressionState();
    return {
      app: 'ThisWeek',
      version: 2,
      exportedAtISO:
        typeof parsed.exportedAtISO === 'string'
          ? parsed.exportedAtISO
          : new Date().toISOString(),
      data: {
        slots: d.slots,
        fridayAnchor:
          d.fridayAnchor && typeof d.fridayAnchor.mondayISO === 'string'
            ? d.fridayAnchor
            : loadFridayAnchor(),
        fridayOverrides:
          d.fridayOverrides && typeof d.fridayOverrides === 'object' ? d.fridayOverrides : {},
        papers: Array.isArray(d.papers) ? d.papers : [],
        dailyLogs: d.dailyLogs && typeof d.dailyLogs === 'object' ? d.dailyLogs : {},
        tasks: Array.isArray(d.tasks) ? d.tasks : [],
        missedItems: Array.isArray(d.missedItems) ? d.missedItems : [],
        unitCoveredMap:
          d.unitCoveredMap && typeof d.unitCoveredMap === 'object' ? d.unitCoveredMap : {},
        isDark: typeof d.isDark === 'boolean' ? d.isDark : true,
        glassTransparency:
          typeof d.glassTransparency === 'number' && Number.isFinite(d.glassTransparency)
            ? Math.max(0, Math.min(100, Math.round(d.glassTransparency)))
            : 72,
        calmBackdrop: typeof d.calmBackdrop === 'boolean' ? d.calmBackdrop : true,
        progression:
          d.progression && typeof d.progression === 'object'
            ? {
                ...defProg,
                ...d.progression,
                unlockedAbilities: d.progression.unlockedAbilities ?? {},
                checkIns: d.progression.checkIns ?? {},
                rewardedEntities: d.progression.rewardedEntities ?? {},
                claimedBounties: d.progression.claimedBounties ?? {},
                history: Array.isArray(d.progression.history) ? d.progression.history : [],
              }
            : defProg,
        studio:
          d.studio && typeof d.studio === 'object'
            ? { ...DEFAULT_STUDIO_CONFIG, ...d.studio }
            : DEFAULT_STUDIO_CONFIG,
      },
    };
  } catch {
    return null;
  }
}

export function applyVaultBundle(bundle: ThisWeekBackupBundle): void {
  const { data } = bundle;
  try {
    window.localStorage.setItem(KEYS.scheduleSeededV222, '1');
    window.localStorage.setItem(KEYS.commutePatchV223, '1');
  } catch {
    // Ignore storage quota errors
  }
  saveSlots(data.slots);
  saveFridayAnchor(data.fridayAnchor);
  saveFridayOverrides(data.fridayOverrides);
  savePapers(data.papers);
  saveDailyLogs(data.dailyLogs);
  saveTasks(data.tasks);
  saveMissedLessons(data.missedItems);
  saveUnitCoveredMap(data.unitCoveredMap);
  saveThemeDark(data.isDark);
  saveGlassTransparency(data.glassTransparency);
  saveCalmBackdrop(data.calmBackdrop);
  if (data.progression) saveProgressionState(data.progression);
  if (data.studio) saveStudioConfig(data.studio);
}

export function importVaultJson(rawJson: string): ThisWeekBackupBundle | null {
  const bundle = parseVaultBundle(rawJson);
  if (!bundle) return null;
  applyVaultBundle(bundle);
  return bundle;
}

export function hasAnySavedLocalData(): boolean {
  try {
    return Boolean(
      window.localStorage.getItem(KEYS.scheduleSeededV222) ||
        window.localStorage.getItem(KEYS.slots) ||
        window.localStorage.getItem(KEYS.tasks) ||
        window.localStorage.getItem(KEYS.papers) ||
        window.localStorage.getItem(KEYS.missed) ||
        window.localStorage.getItem(KEYS.dailyLogs) ||
        window.localStorage.getItem(KEYS.unitCovered) ||
        window.localStorage.getItem(KEYS.progression),
    );
  } catch {
    return true;
  }
}

const VAULT_IDB_NAME = 'thisweek_vault_db';
const VAULT_IDB_STORE = 'vault';
const VAULT_IDB_KEY = 'latest';

function openVaultIDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }
    try {
      const req = window.indexedDB.open(VAULT_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(VAULT_IDB_STORE)) {
          db.createObjectStore(VAULT_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveVaultToIndexedDB(json: string): Promise<void> {
  const db = await openVaultIDB();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(VAULT_IDB_STORE, 'readwrite');
      tx.objectStore(VAULT_IDB_STORE).put(json, VAULT_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB errors
  } finally {
    db.close();
  }
}

export async function loadVaultFromIndexedDB(): Promise<string | null> {
  const db = await openVaultIDB();
  if (!db) return null;
  try {
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction(VAULT_IDB_STORE, 'readonly');
      const req = tx.objectStore(VAULT_IDB_STORE).get(VAULT_IDB_KEY);
      req.onsuccess = () => {
        const val = req.result;
        resolve(typeof val === 'string' && val.trim().length > 0 ? val : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}
