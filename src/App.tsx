import { Bell, TrendingDown, TrendingUp, X } from 'lucide-react';
import { TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppearanceSheet } from './components/AppearanceSheet';
import { BottomNav } from './components/BottomNav';
import { CountdownView } from './components/CountdownView';
import { DayView } from './components/DayView';
import { FocusRushSheet } from './components/FocusRushSheet';
import { LeagueCrest } from './components/LeagueCrest';
import { MissedView } from './components/MissedView';
import { PapersView } from './components/PapersView';
import { PermissionsSheet } from './components/PermissionsSheet';
import { PlannerView } from './components/PlannerView';
import { ReviseLoopSheet } from './components/ReviseLoopSheet';
import { PendingCheckInItem, SlotCheckInModal } from './components/SlotCheckInModal';
import { SmartSlotPickerPayload, SmartSlotPickerSheet } from './components/SmartSlotPickerSheet';
import { TimetableView } from './components/TimetableView';
import { TopBar } from './components/TopBar';
import { WeeklyFocusSuggestSheet } from './components/WeeklyFocusSuggestSheet';
import { XPArenaOverlay } from './components/XPArenaOverlay';
import {
  buildCleanDefaultClassSlots,
  findSyllabusUnit,
  SUBJECT_META,
} from './data/previewData';
import { useScheduleEngine } from './hooks/useScheduleEngine';
import {
  fetchNativePermissions,
  fetchNativeVaultSnapshot,
  syncNativeBlockerAndAlarms,
  syncNativeVaultSnapshot,
} from './native/thisWeekBridge';
import {
  AbilityId,
  AppearanceStudioConfig,
  DayCompletionLog,
  DayOfWeek,
  FridayAnchor,
  FridayWeekMode,
  FridayWeekOverrides,
  MissedLessonItem,
  NativePermissionStatus,
  PaperEntry,
  ProgressionState,
  ProgressLogEntry,
  RevisionStage,
  SlotCheckInEntry,
  SlotSuggestion,
  StudyChecklistItem,
  StudyTask,
  SubjectId,
  TabId,
  TimetableSlot,
} from './types';
import {
  addDaysISO,
  diffDaysISO,
  getCurrentWeekDays,
  getDayOfWeek,
  getMondayISOForDate,
  getTodayISO,
  getWeekDaysForOffset,
  parseISODateLocal,
} from './utils/dateUtils';
import { haptics } from './utils/haptics';
import {
  ABILITIES,
  applyProgressDelta,
  ArenaBountyItem,
  AURORA_THEMES,
  CRYSTAL_VALUES,
  DEFAULT_STUDIO_CONFIG,
  evaluateArenaBounties,
  isAbilityActive,
  isFocusRushActive,
  isLeagueAtLeast,
  resolveEffectiveStudio,
  XP_VALUES,
} from './utils/progressionEngine';
import {
  getActiveSlotsForSchedule,
  getActiveSlotsForWeek,
  isSlotActiveOnDate,
  resolveFridayModeForWeek,
  SuggestedWeeklyTaskPlan,
  suggestSlotsForTask,
} from './utils/schedulerEngine';
import {
  applyVaultBundle,
  exportVaultJson,
  hasAnySavedLocalData,
  loadCalmBackdrop,
  loadDailyLogs,
  loadFridayAnchor,
  loadFridayOverrides,
  loadGlassTransparency,
  loadManualLockUntil,
  loadMissedLessons,
  loadPapers,
  loadProgressionState,
  loadSlots,
  loadStudioConfig,
  loadTasks,
  loadThemeDark,
  loadUnitCoveredMap,
  loadVaultFromIndexedDB,
  parseVaultBundle,
  saveCalmBackdrop,
  saveDailyLogs,
  saveFridayAnchor,
  saveFridayOverrides,
  saveGlassTransparency,
  saveManualLockUntil,
  saveMissedLessons,
  savePapers,
  saveProgressionState,
  saveSlots,
  saveStudioConfig,
  saveTasks,
  saveThemeDark,
  saveUnitCoveredMap,
  saveVaultToIndexedDB,
  ThisWeekBackupBundle,
} from './utils/storage';
import { formatDuration, getDurationMinutes, toMinutes } from './utils/timeUtils';
import {
  applyA07PerfClass,
  applyGlassTransparencyVars,
  applyStudioAppearanceVars,
} from './utils/transparency';

const TAB_ORDER: TabId[] = ['day', 'timetable', 'planner', 'missed', 'papers', 'countdown'];

const PARTICLE_SEEDS = [
  { left: '8%', top: '76%', delay: '0s', dur: '11s', size: 6 },
  { left: '19%', top: '84%', delay: '1.8s', dur: '13s', size: 5 },
  { left: '29%', top: '70%', delay: '3.2s', dur: '10s', size: 7 },
  { left: '41%', top: '88%', delay: '0.7s', dur: '14s', size: 4 },
  { left: '53%', top: '74%', delay: '2.4s', dur: '12s', size: 6 },
  { left: '64%', top: '82%', delay: '4.1s', dur: '11s', size: 5 },
  { left: '75%', top: '78%', delay: '1.1s', dur: '13s', size: 7 },
  { left: '86%', top: '86%', delay: '3.6s', dur: '10.5s', size: 5 },
  { left: '14%', top: '58%', delay: '2.9s', dur: '12.5s', size: 4 },
  { left: '48%', top: '62%', delay: '0.4s', dur: '11.5s', size: 5 },
  { left: '71%', top: '55%', delay: '4.5s', dur: '13.5s', size: 6 },
  { left: '92%', top: '66%', delay: '1.5s', dur: '12s', size: 4 },
];

export default function App() {
  const hadLocalDataAtBootRef = useRef<boolean | null>(null);
  if (hadLocalDataAtBootRef.current === null) {
    hadLocalDataAtBootRef.current = hasAnySavedLocalData();
  }
  const [vaultBootReady, setVaultBootReady] = useState<boolean>(() =>
    Boolean(hadLocalDataAtBootRef.current),
  );

  const [activeTab, setActiveTab] = useState<TabId>('day');
  const [isDark, setIsDark] = useState<boolean>(() => loadThemeDark());
  const [glassTransparency, setGlassTransparency] = useState<number>(() =>
    loadGlassTransparency(),
  );
  const [calmBackdrop, setCalmBackdrop] = useState<boolean>(() => loadCalmBackdrop());
  const [blockerModalOpen, setBlockerModalOpen] = useState<boolean>(false);
  const [appearanceOpen, setAppearanceOpen] = useState<boolean>(false);
  const [abilitiesOpen, setAbilitiesOpen] = useState<boolean>(false);
  const [weeklyFocusSuggestOpen, setWeeklyFocusSuggestOpen] = useState<boolean>(false);
  const [permissionsOpen, setPermissionsOpen] = useState<boolean>(false);
  const [nativePerms, setNativePerms] = useState<NativePermissionStatus | null>(null);
  const [isTimetableDragging, setIsTimetableDragging] = useState<boolean>(false);

  const [slots, setSlots] = useState<TimetableSlot[]>(() => loadSlots());
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [fridayAnchor, setFridayAnchor] = useState<FridayAnchor>(() => loadFridayAnchor());
  const [fridayOverrides, setFridayOverrides] = useState<FridayWeekOverrides>(() =>
    loadFridayOverrides(),
  );
  const [papers, setPapers] = useState<PaperEntry[]>(() => loadPapers());
  const [tasks, setTasks] = useState<StudyTask[]>(() => loadTasks());
  const [missedItems, setMissedItems] = useState<MissedLessonItem[]>(() =>
    loadMissedLessons(),
  );
  const [unitCoveredMap, setUnitCoveredMap] = useState<Record<string, boolean>>(() =>
    loadUnitCoveredMap(),
  );
  const [dailyLogs, setDailyLogs] = useState<Record<string, DayCompletionLog>>(() =>
    loadDailyLogs(),
  );
  const [manualLockUntil, setManualLockUntil] = useState<number>(() =>
    loadManualLockUntil(),
  );
  const [progression, setProgression] = useState<ProgressionState>(() =>
    loadProgressionState(),
  );
  const [studio, setStudio] = useState<AppearanceStudioConfig>(() => loadStudioConfig());

  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [reviseLoopClassSlot, setReviseLoopClassSlot] = useState<TimetableSlot | null>(null);
  const [dismissedCheckInKeys, setDismissedCheckInKeys] = useState<Set<string>>(() => new Set());
  const [slotPickerState, setSlotPickerState] = useState<{
    payload: SmartSlotPickerPayload;
    onConfirm: (sug: SlotSuggestion) => void;
  } | null>(null);
  const [leagueBanner, setLeagueBanner] = useState<{
    text: string;
    subtext?: string;
    tone: 'win' | 'loss' | 'promo';
  } | null>(null);

  const leagueBannerTimerRef = useRef<number | null>(null);
  const pendingBannerRef = useRef<{
    text: string;
    tone: 'win' | 'loss' | 'promo';
    subtext?: string;
    haptic?: 'success' | 'tap';
  } | null>(null);

  const showLeagueBanner = useCallback(
    (text: string, tone: 'win' | 'loss' | 'promo', subtext?: string) => {
      setLeagueBanner({ text, tone, subtext });
      if (leagueBannerTimerRef.current) {
        window.clearTimeout(leagueBannerTimerRef.current);
      }
      leagueBannerTimerRef.current = window.setTimeout(() => {
        setLeagueBanner(null);
      }, 4200);
    },
    [],
  );

  useEffect(() => {
    const pending = pendingBannerRef.current;
    if (!pending) return;
    pendingBannerRef.current = null;
    if (pending.haptic === 'success') haptics.success();
    else if (pending.haptic === 'tap') haptics.tap();
    showLeagueBanner(pending.text, pending.tone, pending.subtext);
  }, [progression, showLeagueBanner]);

  const awardProgress = useCallback(
    (
      deltaXp: number,
      deltaCrystals: number,
      label: string,
      tone: ProgressLogEntry['tone'],
      silentToast = false,
    ) => {
      setProgression((prev) => {
        const res = applyProgressDelta(prev, deltaXp, deltaCrystals, label, tone);
        if (res.promotedTo) {
          pendingBannerRef.current = {
            text: `Promoted to ${res.promotedTo.name}!`,
            tone: 'promo',
            subtext: `+${CRYSTAL_VALUES.leaguePromoBonus} Crystals · 24h Demotion Shield active`,
            haptic: 'success',
          };
        } else if (res.demotedTo) {
          pendingBannerRef.current = {
            text: `Demoted to ${res.demotedTo.name}`,
            tone: 'loss',
            subtext: 'Earn trophies back to restore higher-tier gear',
            haptic: 'tap',
          };
        } else if (res.shieldSavedDemotion) {
          pendingBannerRef.current = {
            text: '24h Promotion Shield Protected Your League',
            tone: 'win',
            subtext: `${deltaXp} Trophy XP absorbed safely`,
          };
        } else if (!silentToast) {
          const actualXp = res.next.xp - prev.xp;
          const actualCry = res.next.crystals - prev.crystals;
          const signXp = deltaXp >= 0 ? `+${actualXp > 0 ? actualXp : deltaXp}` : `${deltaXp}`;
          const cryNote = actualCry > 0 ? ` · +${actualCry}💎` : '';
          pendingBannerRef.current = {
            text: `${label} (${signXp} XP${cryNote})`,
            tone: deltaXp >= 0 ? 'win' : 'loss',
          };
        }
        return res.next;
      });
    },
    [],
  );

  const syncEntityReward = useCallback(
    (
      entityKey: string,
      shouldAward: boolean,
      baseXp: number,
      baseCry: number,
      label: string,
      tone: ProgressLogEntry['tone'] = 'gain',
      silentToast = false,
    ) => {
      setProgression((prev) => {
        const entities = prev.rewardedEntities ?? {};
        const already = entities[entityKey];

        if (shouldAward) {
          if (already) return prev;
          const res = applyProgressDelta(prev, baseXp, baseCry, label, tone);
          const actualXp = res.next.xp - prev.xp;
          const actualCry = res.next.crystals - prev.crystals;
          const storedXp = actualXp > 0 ? actualXp : baseXp;
          const storedCry = actualCry > 0 ? actualCry : baseCry;

          if (res.promotedTo) {
            pendingBannerRef.current = {
              text: `Promoted to ${res.promotedTo.name}!`,
              tone: 'promo',
              subtext: `+${CRYSTAL_VALUES.leaguePromoBonus} Crystals · 24h Demotion Shield active`,
              haptic: 'success',
            };
          } else if (!silentToast) {
            pendingBannerRef.current = {
              text: `${label} (+${storedXp} XP${storedCry > 0 ? ` · +${storedCry}💎` : ''})`,
              tone: 'win',
            };
          }

          return {
            ...res.next,
            rewardedEntities: {
              ...(res.next.rewardedEntities ?? entities),
              [entityKey]: { xp: storedXp, cry: storedCry },
            },
          };
        }

        if (!already) return prev;
        const res = applyProgressDelta(
          prev,
          -already.xp,
          -already.cry,
          `Undid: ${label}`,
          'reversal',
        );
        const nextEntities = { ...(res.next.rewardedEntities ?? entities) };
        delete nextEntities[entityKey];

        if (!silentToast) {
          pendingBannerRef.current = {
            text: `Undid: ${label} (-${already.xp} XP)`,
            tone: 'loss',
          };
        }

        return {
          ...res.next,
          rewardedEntities: nextEntities,
        };
      });
    },
    [],
  );

  const effStudio = useMemo(
    () => resolveEffectiveStudio(studio, progression.currentLeague),
    [studio, progression.currentLeague],
  );

  const todayISO = getTodayISO();
  const fridayWeekMode = useMemo(
    () =>
      resolveFridayModeForWeek(
        getMondayISOForDate(todayISO),
        fridayAnchor,
        fridayOverrides,
      ),
    [todayISO, fridayAnchor, fridayOverrides],
  );

  const activeSlots = useMemo(
    () =>
      getActiveSlotsForSchedule(
        slots,
        { anchor: fridayAnchor, overrides: fridayOverrides },
        todayISO,
      ),
    [slots, fridayAnchor, fridayOverrides, todayISO],
  );

  const nativeWeekSlots = useMemo(
    () =>
      getActiveSlotsForWeek(
        slots,
        getWeekDaysForOffset(0, new Date()),
        { anchor: fridayAnchor, overrides: fridayOverrides },
      ).allWeekSlots,
    [slots, fridayAnchor, fridayOverrides],
  );

  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const fridayAnchorRef = useRef(fridayAnchor);
  fridayAnchorRef.current = fridayAnchor;
  const fridayOverridesRef = useRef(fridayOverrides);
  fridayOverridesRef.current = fridayOverrides;
  const nativeWeekSlotsRef = useRef(nativeWeekSlots);
  nativeWeekSlotsRef.current = nativeWeekSlots;
  const progressionRef = useRef(progression);
  progressionRef.current = progression;
  const dailyLogsRef = useRef(dailyLogs);
  dailyLogsRef.current = dailyLogs;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const missedItemsRef = useRef(missedItems);
  missedItemsRef.current = missedItems;
  const unitCoveredMapRef = useRef(unitCoveredMap);
  unitCoveredMapRef.current = unitCoveredMap;

  const handleSelectTab = useCallback((nextTab: TabId) => {
    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Direct-DOM Finger-Tracking Swipe (disabled on Timetable & while dragging slots)
  const mainRef = useRef<HTMLElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number; lockedAxis: 'x' | 'y' | null } | null>(null);

  const resetMainTransform = () => {
    const el = mainRef.current;
    if (!el) return;
    el.style.transition = 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.transform = '';
  };

  const handleTouchStart = (e: TouchEvent<HTMLElement>) => {
    if (activeTab === 'timetable' || isTimetableDragging || e.touches.length !== 1) return;
    if (mainRef.current) {
      mainRef.current.style.transition = 'none';
    }
    swipeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      lockedAxis: null,
    };
  };

  const handleTouchMove = (e: TouchEvent<HTMLElement>) => {
    if (
      activeTab === 'timetable' ||
      isTimetableDragging ||
      !swipeStartRef.current ||
      e.touches.length !== 1
    ) {
      return;
    }
    const dx = e.touches[0].clientX - swipeStartRef.current.x;
    const dy = e.touches[0].clientY - swipeStartRef.current.y;

    if (!swipeStartRef.current.lockedAxis) {
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        swipeStartRef.current.lockedAxis = 'x';
      } else if (Math.abs(dy) > 14) {
        swipeStartRef.current.lockedAxis = 'y';
      }
    }

    if (swipeStartRef.current.lockedAxis === 'x' && mainRef.current) {
      const currIdx = TAB_ORDER.indexOf(activeTab);
      const atLeftEdge = currIdx === 0 && dx > 0;
      const atRightEdge = currIdx === TAB_ORDER.length - 1 && dx < 0;
      const damped = atLeftEdge || atRightEdge ? dx * 0.22 : dx * 0.55;
      const clamped = Math.max(-110, Math.min(110, damped));
      mainRef.current.style.transform = `translate3d(${clamped}px, 0, 0)`;
    }
  };

  const handleTouchEnd = (e: TouchEvent<HTMLElement>) => {
    if (
      activeTab === 'timetable' ||
      isTimetableDragging ||
      !swipeStartRef.current ||
      e.changedTouches.length !== 1
    ) {
      swipeStartRef.current = null;
      resetMainTransform();
      return;
    }

    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const wasHorizontal = swipeStartRef.current.lockedAxis === 'x';
    swipeStartRef.current = null;
    resetMainTransform();

    if (wasHorizontal && Math.abs(dx) > 56) {
      const currIdx = TAB_ORDER.indexOf(activeTab);
      if (dx < 0 && currIdx < TAB_ORDER.length - 1) {
        haptics.tick();
        handleSelectTab(TAB_ORDER[currIdx + 1]);
      } else if (dx > 0 && currIdx > 0) {
        haptics.tick();
        handleSelectTab(TAB_ORDER[currIdx - 1]);
      }
    }
  };

  const clearExpiredManualLock = useCallback(() => {
    setManualLockUntil(0);
    saveManualLockUntil(0);
  }, []);

  const { now, activeLock, reminderToast, dismissReminderToast } = useScheduleEngine(
    activeSlots,
    manualLockUntil,
    clearExpiredManualLock,
  );

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveThemeDark(isDark);
  }, [isDark]);

  useEffect(() => {
    applyGlassTransparencyVars(glassTransparency);
    const id = window.setTimeout(() => {
      saveGlassTransparency(glassTransparency);
    }, 120);
    return () => window.clearTimeout(id);
  }, [glassTransparency]);

  const handleChangeTransparency = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    applyGlassTransparencyVars(clamped);
    setGlassTransparency(clamped);
  }, []);

  useEffect(() => {
    applyA07PerfClass(calmBackdrop);
    saveCalmBackdrop(calmBackdrop);
  }, [calmBackdrop]);

  useEffect(() => {
    applyStudioAppearanceVars(studio, progression.currentLeague);
  }, [studio, progression.currentLeague]);

  useEffect(() => {
    saveProgressionState(progression);
  }, [progression]);

  useEffect(() => {
    saveStudioConfig(studio);
  }, [studio]);

  useEffect(() => {
    let active = true;
    fetchNativePermissions().then((status) => {
      if (!active) return;
      setNativePerms(status);
      if (
        status.isNativeAndroid &&
        (!status.notifications ||
          !status.usageAccess ||
          !status.overlayAccess ||
          !status.batteryUnrestricted)
      ) {
        setPermissionsOpen(true);
      }
    });

    const handleResume = () => {
      fetchNativePermissions().then((status) => {
        if (active) setNativePerms(status);
      });
    };
    window.addEventListener('focus', handleResume);
    return () => {
      active = false;
      window.removeEventListener('focus', handleResume);
    };
  }, []);

  useEffect(() => {
    saveSlots(slots);
    syncNativeBlockerAndAlarms(nativeWeekSlots, manualLockUntil);
  }, [slots, nativeWeekSlots, manualLockUntil]);

  useEffect(() => {
    saveFridayAnchor(fridayAnchor);
  }, [fridayAnchor]);

  useEffect(() => {
    saveFridayOverrides(fridayOverrides);
  }, [fridayOverrides]);

  useEffect(() => {
    savePapers(papers);
  }, [papers]);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveMissedLessons(missedItems);
  }, [missedItems]);

  useEffect(() => {
    saveUnitCoveredMap(unitCoveredMap);
  }, [unitCoveredMap]);

  useEffect(() => {
    saveDailyLogs(dailyLogs);
  }, [dailyLogs]);

  const applyBundleToReactState = useCallback((bundle: ThisWeekBackupBundle) => {
    applyVaultBundle(bundle);
    const d = bundle.data;
    setSlots(d.slots);
    setFridayAnchor(d.fridayAnchor);
    setFridayOverrides(d.fridayOverrides);
    setPapers(d.papers);
    setDailyLogs(d.dailyLogs);
    setTasks(d.tasks);
    setMissedItems(d.missedItems);
    setUnitCoveredMap(d.unitCoveredMap);
    setIsDark(d.isDark);
    applyGlassTransparencyVars(d.glassTransparency);
    setGlassTransparency(d.glassTransparency);
    setCalmBackdrop(d.calmBackdrop);
    if (d.progression) setProgression(d.progression);
    if (d.studio) setStudio(d.studio);
  }, []);

  // Auto-recovery if WebView localStorage was cleared between APK installs/updates
  useEffect(() => {
    if (hadLocalDataAtBootRef.current) {
      setVaultBootReady(true);
      return;
    }
    let cancelled = false;
    Promise.all([fetchNativeVaultSnapshot(), loadVaultFromIndexedDB()])
      .then(([nativeRaw, idbRaw]) => {
        if (cancelled) return;
        const nativeBundle = nativeRaw ? parseVaultBundle(nativeRaw) : null;
        const idbBundle = idbRaw ? parseVaultBundle(idbRaw) : null;
        let chosen: ThisWeekBackupBundle | null = nativeBundle ?? idbBundle;
        if (nativeBundle && idbBundle) {
          chosen =
            nativeBundle.exportedAtISO >= idbBundle.exportedAtISO ? nativeBundle : idbBundle;
        }
        if (chosen) {
          applyBundleToReactState(chosen);
        }
      })
      .finally(() => {
        if (!cancelled) setVaultBootReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [applyBundleToReactState]);

  // Auto-mirror full user vault (slots, tasks, papers, progression, studio)
  useEffect(() => {
    if (!vaultBootReady) return;
    const id = window.setTimeout(() => {
      const json = exportVaultJson({
        slots,
        fridayAnchor,
        fridayOverrides,
        papers,
        dailyLogs,
        tasks,
        missedItems,
        unitCoveredMap,
        isDark,
        glassTransparency,
        calmBackdrop,
        progression,
        studio,
      });
      void saveVaultToIndexedDB(json);
      void syncNativeVaultSnapshot(json);
    }, 320);
    return () => window.clearTimeout(id);
  }, [
    vaultBootReady,
    slots,
    fridayAnchor,
    fridayOverrides,
    papers,
    dailyLogs,
    tasks,
    missedItems,
    unitCoveredMap,
    isDark,
    glassTransparency,
    calmBackdrop,
    progression,
    studio,
  ]);

  const handleExportBackupJson = useCallback(
    () =>
      exportVaultJson({
        slots,
        fridayAnchor,
        fridayOverrides,
        papers,
        dailyLogs,
        tasks,
        missedItems,
        unitCoveredMap,
        isDark,
        glassTransparency,
        calmBackdrop,
        progression,
        studio,
      }),
    [
      slots,
      fridayAnchor,
      fridayOverrides,
      papers,
      dailyLogs,
      tasks,
      missedItems,
      unitCoveredMap,
      isDark,
      glassTransparency,
      calmBackdrop,
      progression,
      studio,
    ],
  );

  const handleImportBackupJson = useCallback(
    (rawJson: string): { ok: boolean; message: string } => {
      const parsed = parseVaultBundle(rawJson);
      if (!parsed) {
        return {
          ok: false,
          message: 'Invalid backup JSON. Please choose a valid This Week backup file or code.',
        };
      }
      applyBundleToReactState(parsed);
      const serialized = exportVaultJson(parsed.data);
      void saveVaultToIndexedDB(serialized);
      void syncNativeVaultSnapshot(serialized);
      return {
        ok: true,
        message: `Restored ${parsed.data.slots.length} slots, ${parsed.data.tasks.length} tasks & ${parsed.data.progression?.xp ?? 0} XP.`,
      };
    },
    [applyBundleToReactState],
  );

  const liveBanner = useMemo((): { text: string; subject: SubjectId } | null => {
    const todayDow = getDayOfWeek(now);
    const currMin = now.getHours() * 60 + now.getMinutes();
    const todaySlots = activeSlots
      .filter((s) => s.day === todayDow)
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    const running = todaySlots.find((s) => {
      const start = toMinutes(s.startTime);
      const end = s.endTime === '00:00' && start > 0 ? 1440 : toMinutes(s.endTime);
      return currMin >= start && currMin < end;
    });

    if (running) {
      const start = toMinutes(running.startTime);
      const end = running.endTime === '00:00' && start > 0 ? 1440 : toMinutes(running.endTime);
      return {
        text: `${running.title} · ${formatDuration(end - currMin)} left`,
        subject: running.subject,
      };
    }

    const upcoming = todaySlots.find((s) => toMinutes(s.startTime) > currMin);
    if (upcoming) {
      const diff = toMinutes(upcoming.startTime) - currMin;
      return {
        text: `Next: ${upcoming.title} in ${formatDuration(diff)}`,
        subject: upcoming.subject,
      };
    }
    return null;
  }, [activeSlots, now]);

  const recalcDayLog = useCallback(
    (
      prev: Record<string, DayCompletionLog>,
      dateISO: string,
      nextCompletedIds: string[],
      nextIncompleteIds: string[],
      nextLoggedMap: Record<string, number>,
    ): Record<string, DayCompletionLog> => {
      const [y, m, d] = dateISO.split('-').map(Number);
      const dow = getDayOfWeek(new Date(y, m - 1, d));
      const resolver = {
        anchor: fridayAnchorRef.current,
        overrides: fridayOverridesRef.current,
      };
      const daySlots = slotsRef.current.filter((s) => {
        const sDow = s.specificDateISO
          ? getDayOfWeek(parseISODateLocal(s.specificDateISO))
          : s.day;
        return sDow === dow && isSlotActiveOnDate(s, resolver, dateISO);
      });

      const plannedMinutes = daySlots.reduce(
        (acc, s) => acc + getDurationMinutes(s.startTime, s.endTime),
        0,
      );
      const completedMinutes = daySlots.reduce((acc, s) => {
        if (nextCompletedIds.includes(s.id)) {
          return acc + getDurationMinutes(s.startTime, s.endTime);
        }
        if (nextIncompleteIds.includes(s.id) && nextLoggedMap[s.id]) {
          return acc + nextLoggedMap[s.id];
        }
        return acc;
      }, 0);

      return {
        ...prev,
        [dateISO]: {
          dateISO,
          completedSlotIds: nextCompletedIds,
          incompleteSlotIds: nextIncompleteIds,
          loggedMinutesBySlot: nextLoggedMap,
          plannedMinutes,
          completedMinutes,
          tasksTotal: daySlots.length,
          tasksDone: daySlots.filter((s) => nextCompletedIds.includes(s.id)).length,
        },
      };
    },
    [],
  );

  const handleToggleSlotComplete = useCallback(
    (dateISO: string, slotId: string) => {
      const wasCompleted = (dailyLogsRef.current[dateISO]?.completedSlotIds ?? []).includes(slotId);
      const becameCompleted = !wasCompleted;

      setDailyLogs((prev) => {
        const cur = prev[dateISO];
        const existingCompleted = cur?.completedSlotIds ?? [];
        const existingIncomplete = cur?.incompleteSlotIds ?? [];
        const existingLoggedMap = { ...(cur?.loggedMinutesBySlot ?? {}) };

        const isRemoving = existingCompleted.includes(slotId);
        const nextCompleted = isRemoving
          ? existingCompleted.filter((id) => id !== slotId)
          : [...existingCompleted, slotId];
        const nextIncomplete = existingIncomplete.filter((id) => id !== slotId);
        if (!isRemoving) {
          delete existingLoggedMap[slotId];
        }

        return recalcDayLog(prev, dateISO, nextCompleted, nextIncomplete, existingLoggedMap);
      });

      const completedSlot = slotsRef.current.find((s) => s.id === slotId);
      const checkInKey = `${dateISO}::${slotId}`;
      const entityKey = `slot:${checkInKey}`;

      if (completedSlot) {
        const isRescue = Boolean(completedSlot.isRescueSlot);
        const fullXp = isRescue
          ? XP_VALUES.rescueComeback
          : completedSlot.category === 'class'
            ? XP_VALUES.classComplete
            : XP_VALUES.selfStudyComplete;
        const fullCry = isRescue
          ? CRYSTAL_VALUES.rescueComeback
          : completedSlot.category === 'class'
            ? CRYSTAL_VALUES.classComplete
            : CRYSTAL_VALUES.selfStudyComplete;

        if (becameCompleted) {
          setProgression((prev) => {
            const existingCheckIn = prev.checkIns[checkInKey];
            const entities = prev.rewardedEntities ?? {};
            const alreadyRewarded = entities[entityKey];

            // Skip only if already finished/penalized and NOT a recoverable 'split'
            if (alreadyRewarded || (existingCheckIn && existingCheckIn.outcome !== 'split')) {
              return prev;
            }

            const xpToAdd =
              existingCheckIn?.outcome === 'split'
                ? Math.max(5, fullXp - existingCheckIn.xpDelta)
                : fullXp;
            const cryToAdd =
              existingCheckIn?.outcome === 'split'
                ? Math.max(2, fullCry - 4)
                : fullCry;

            const label = isRescue
              ? `Rescue Comeback: ${completedSlot.title}`
              : existingCheckIn?.outcome === 'split'
                ? `Finished Split: ${completedSlot.title}`
                : `Done: ${completedSlot.title}`;
            const tone: ProgressLogEntry['tone'] = isRescue ? 'comeback' : 'gain';

            const res = applyProgressDelta(prev, xpToAdd, cryToAdd, label, tone);
            const actualXp = res.next.xp - prev.xp;
            const actualCry = res.next.crystals - prev.crystals;
            const gainedXp = actualXp > 0 ? actualXp : xpToAdd;
            const gainedCry = actualCry > 0 ? actualCry : cryToAdd;

            const prevPartialXp =
              existingCheckIn?.outcome === 'split' ? existingCheckIn.xpDelta : 0;
            const checkInRecord: SlotCheckInEntry = {
              key: checkInKey,
              dateISO,
              slotId,
              outcome: 'completed',
              xpDelta: prevPartialXp + gainedXp,
              resolvedAtMs: Date.now(),
            };

            if (res.promotedTo) {
              pendingBannerRef.current = {
                text: `Promoted to ${res.promotedTo.name}!`,
                tone: 'promo',
                subtext: `+${CRYSTAL_VALUES.leaguePromoBonus} Crystals · 24h Demotion Shield active`,
                haptic: 'success',
              };
            } else {
              pendingBannerRef.current = {
                text: `${label} (+${gainedXp} XP${gainedCry > 0 ? ` · +${gainedCry}💎` : ''})`,
                tone: 'win',
              };
            }

            return {
              ...res.next,
              checkIns: { ...res.next.checkIns, [checkInKey]: checkInRecord },
              rewardedEntities: {
                ...(res.next.rewardedEntities ?? entities),
                [entityKey]: { xp: gainedXp, cry: gainedCry },
              },
            };
          });

          if (completedSlot.linkedTaskId) {
            const linkedTask = tasksRef.current.find((t) => t.id === completedSlot.linkedTaskId);
            if (linkedTask?.kind === 'paper-review' && linkedTask.linkedPaperId) {
              setPapers((prev) =>
                prev.map((p) =>
                  p.id === linkedTask.linkedPaperId ? { ...p, reviewStatus: 'reviewed' } : p,
                ),
              );
              setTasks((prev) =>
                prev.map((t) => (t.id === linkedTask.id ? { ...t, status: 'completed' } : t)),
              );
            }
          }
        } else {
          // Unticking a slot: reverse manual slot XP cleanly so user can re-tick accurately
          setProgression((prev) => {
            const entities = prev.rewardedEntities ?? {};
            const recorded = entities[entityKey];
            if (!recorded) return prev;

            const res = applyProgressDelta(
              prev,
              -recorded.xp,
              -recorded.cry,
              `Undid Slot: ${completedSlot.title}`,
              'reversal',
            );
            const nextEntities = { ...(res.next.rewardedEntities ?? entities) };
            delete nextEntities[entityKey];

            const nextCheckIns = { ...res.next.checkIns };
            if (nextCheckIns[checkInKey]?.outcome === 'completed') {
              delete nextCheckIns[checkInKey];
            }

            pendingBannerRef.current = {
              text: `Undid: ${completedSlot.title} (-${recorded.xp} XP)`,
              tone: 'loss',
            };

            return {
              ...res.next,
              checkIns: nextCheckIns,
              rewardedEntities: nextEntities,
            };
          });
        }
      }
    },
    [recalcDayLog],
  );

  const handleMarkSlotIncomplete = useCallback(
    (dateISO: string, slotId: string, partialMinutes: number) => {
      setDailyLogs((prev) => {
        const cur = prev[dateISO];
        const nextCompleted = (cur?.completedSlotIds ?? []).filter((id) => id !== slotId);
        const existingIncomplete = cur?.incompleteSlotIds ?? [];
        const nextIncomplete = existingIncomplete.includes(slotId)
          ? existingIncomplete
          : [...existingIncomplete, slotId];
        const nextLoggedMap = {
          ...(cur?.loggedMinutesBySlot ?? {}),
          [slotId]: Math.max(0, partialMinutes),
        };

        return recalcDayLog(prev, dateISO, nextCompleted, nextIncomplete, nextLoggedMap);
      });
    },
    [recalcDayLog],
  );

  const resolveDateISOForSlotDay = useCallback((day: TimetableSlot['day']): string => {
    const week = getCurrentWeekDays(new Date());
    return week.find((w) => w.day === day)?.dateISO ?? getTodayISO();
  }, []);

  const handleAddSlot = useCallback((newSlot: TimetableSlot, triggerReviseLoop?: boolean) => {
    setSlots((prev) => [...prev, newSlot]);
    if (triggerReviseLoop && newSlot.category === 'class') {
      setReviseLoopClassSlot(newSlot);
    }
  }, []);

  const handleUpdateSlot = useCallback((updatedSlot: TimetableSlot) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === updatedSlot.id ? updatedSlot : slot)),
    );
  }, []);

  const handleDeleteSlot = useCallback((slotId: string) => {
    setSlots((prev) => prev.filter((slot) => slot.id !== slotId));
  }, []);

  const handleResetCleanSchedule = useCallback(() => {
    const baseline = buildCleanDefaultClassSlots(getTodayISO());
    setSlots(baseline);
  }, []);

  const handleChangeFridayModeForWeek = useCallback(
    (weekMondayISO: string, mode: FridayWeekMode) => {
      const currentMonday = getMondayISOForDate(getTodayISO());
      if (weekMondayISO === currentMonday) {
        setFridayAnchor({ mondayISO: currentMonday, mode });
        setFridayOverrides((prev) => {
          const next = { ...prev };
          delete next[weekMondayISO];
          return next;
        });
      } else {
        setFridayOverrides((prev) => ({ ...prev, [weekMondayISO]: mode }));
      }
    },
    [],
  );

  const handleResetFridayOverrideForWeek = useCallback((weekMondayISO: string) => {
    setFridayOverrides((prev) => {
      const next = { ...prev };
      delete next[weekMondayISO];
      return next;
    });
  }, []);

  const handleSkipSlotForDate = useCallback((slotId: string, dateISO: string) => {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== slotId) return slot;
        const existing = slot.skippedDates ?? [];
        if (existing.includes(dateISO)) return slot;
        return { ...slot, skippedDates: [...existing, dateISO] };
      }),
    );
  }, []);

  const handleRestoreSkippedSlotForDate = useCallback((slotId: string, dateISO: string) => {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== slotId || !slot.skippedDates) return slot;
        return {
          ...slot,
          skippedDates: slot.skippedDates.filter((d) => d !== dateISO),
        };
      }),
    );
  }, []);

  const handleMoveRecurringSlotOneWeekOnly = useCallback(
    (
      sourceSlot: TimetableSlot,
      fromDateISO: string,
      newDay: DayOfWeek,
      newDateISO: string,
      newStartTime: string,
      newEndTime: string,
    ) => {
      setSlots((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== sourceSlot.id) return s;
          const skipped = s.skippedDates ?? [];
          return skipped.includes(fromDateISO)
            ? s
            : { ...s, skippedDates: [...skipped, fromDateISO] };
        });
        const movedCopy: TimetableSlot = {
          ...sourceSlot,
          id: `slot-move-${Date.now()}`,
          day: newDay,
          specificDateISO: newDateISO,
          startTime: newStartTime,
          endTime: newEndTime,
          skippedDates: undefined,
          weekPattern: undefined,
          expiresAtISO: undefined,
        };
        return [...updated, movedCopy];
      });
    },
    [],
  );

  const handleApproveReviseLoop = useCallback(
    (
      classSlot: TimetableSlot,
      stages: Record<RevisionStage, SlotSuggestion>,
    ) => {
      const existingLoop = tasks.find(
        (t) => t.kind === 'revision-loop' && t.sourceClassSlotId === classSlot.id,
      );
      const loopTaskId = existingLoop?.id ?? `task-loop-${Date.now()}`;

      const stageLabels: Record<RevisionStage, string> = {
        r1: 'Quick Revise (R1)',
        r2: 'Deep Revise (R2 · +3d)',
        r3: 'Pre-Class Warm-Up (R3)',
      };

      const newReviseSlots: TimetableSlot[] = (['r1', 'r2', 'r3'] as RevisionStage[]).map(
        (stage, idx) => {
          const sug = stages[stage];
          return {
            id: `slot-rev-${classSlot.id}-${stage}-${Date.now() + idx}`,
            day: sug.day,
            startTime: sug.startTime,
            endTime: sug.endTime,
            category: 'self-study',
            subject: classSlot.subject,
            title: `${classSlot.title}`,
            subtitle: stageLabels[stage],
            autoBlock: sug.autoBlock,
            mode: 'online',
            travelBeforeMins: 0,
            travelAfterMins: 0,
            linkedTaskId: loopTaskId,
            revisionStage: stage,
            sourceClassSlotId: classSlot.id,
          };
        },
      );

      setSlots((prev) => [
        ...prev.filter((s) => !(s.sourceClassSlotId === classSlot.id && s.revisionStage)),
        ...newReviseSlots,
      ]);

      if (!existingLoop) {
        const loopTask: StudyTask = {
          id: loopTaskId,
          title: `${classSlot.title} · 3-Step Revise`,
          subject: classSlot.subject,
          kind: 'revision-loop',
          sourceClassSlotId: classSlot.id,
          defaultSessionMins: 30,
          importance: 'medium',
          checklist: [
            { id: `chk-r1-${Date.now()}`, text: 'R1 · Quick recall after class (30m)', done: false },
            { id: `chk-r2-${Date.now() + 1}`, text: 'R2 · Deep revision 3 days later (1h)', done: false },
            { id: `chk-r3-${Date.now() + 2}`, text: 'R3 · Pre-class warm-up day before (30m)', done: false },
          ],
          notes: `Linked to ${classSlot.day} ${classSlot.title}`,
          status: 'active',
          order: tasks.length,
          createdAtISO: getTodayISO(),
          autoBlockDefault: classSlot.autoBlock,
        };
        setTasks((prev) => [...prev, loopTask]);
      }

      setReviseLoopClassSlot(null);
    },
    [tasks],
  );

  const handleAddTask = useCallback((task: StudyTask) => {
    setTasks((prev) => [...prev, task]);
  }, []);

  const handleUpdateTask = useCallback(
    (updated: StudyTask) => {
      const prevTask = tasksRef.current.find((t) => t.id === updated.id);
      if (prevTask) {
        if (prevTask.status !== updated.status) {
          syncEntityReward(
            `task:${updated.id}`,
            updated.status === 'completed',
            XP_VALUES.taskComplete,
            CRYSTAL_VALUES.taskComplete,
            `Task Done: ${updated.title}`,
          );
        }

        // Universal XP for Planner checklist sub-steps
        const prevMap = new Map(prevTask.checklist.map((c) => [c.id, c.done]));
        for (const item of updated.checklist) {
          const wasDone = prevMap.get(item.id);
          if (wasDone !== undefined && wasDone !== item.done) {
            syncEntityReward(
              `chk:${updated.id}:${item.id}`,
              item.done,
              XP_VALUES.checklistSubItem,
              CRYSTAL_VALUES.checklistSubItem,
              `Step: ${item.text}`,
            );
          }
        }
      }

      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (updated.kind === 'paper-review' && updated.linkedPaperId) {
        setPapers((prev) =>
          prev.map((p) =>
            p.id === updated.linkedPaperId
              ? {
                  ...p,
                  reviewStatus: updated.status === 'completed' ? 'reviewed' : 'needs-review',
                  mistakesChecklist: updated.checklist,
                }
              : p,
          ),
        );
      }
    },
    [syncEntityReward],
  );

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSlots((prev) => prev.filter((s) => s.linkedTaskId !== taskId));
    setPapers((prev) =>
      prev.map((p) =>
        p.linkedReviewTaskId === taskId ? { ...p, linkedReviewTaskId: undefined } : p,
      ),
    );
  }, []);

  const handleReorderTasks = useCallback((orderedIds: string[]) => {
    setTasks((prev) =>
      prev.map((t) => {
        const nextOrder = orderedIds.indexOf(t.id);
        return nextOrder >= 0 ? { ...t, order: nextOrder } : t;
      }),
    );
  }, []);

  const handleApproveSuggestedSlot = useCallback(
    (task: StudyTask, sug: SlotSuggestion) => {
      const targetDate = sug.dateISO ?? resolveDateISOForSlotDay(sug.day);
      const newSlot: TimetableSlot = {
        id: `slot-task-${Date.now()}`,
        day: sug.day,
        specificDateISO: targetDate,
        startTime: sug.startTime,
        endTime: sug.endTime,
        category: 'self-study',
        subject: task.subject,
        unitId: task.unitId,
        title: task.title,
        subtitle: sug.reason,
        autoBlock: sug.autoBlock,
        mode: 'online',
        travelBeforeMins: 0,
        travelAfterMins: 0,
        linkedTaskId: task.id,
        revisionStage: sug.revisionStage,
      };
      setSlots((prev) => [...prev, newSlot]);
    },
    [resolveDateISOForSlotDay],
  );

  const handleAddMissed = useCallback((item: MissedLessonItem) => {
    setMissedItems((prev) => [...prev, item]);
  }, []);

  const handleUpdateMissed = useCallback(
    (updated: MissedLessonItem) => {
      const prevItem = missedItemsRef.current.find((m) => m.id === updated.id);
      if (prevItem && prevItem.status !== updated.status) {
        syncEntityReward(
          `missed:${updated.id}`,
          updated.status === 'covered',
          XP_VALUES.missedCovered,
          CRYSTAL_VALUES.missedCovered,
          `Caught Up: ${updated.title}`,
        );
      }
      setMissedItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    },
    [syncEntityReward],
  );

  const handleDeleteMissed = useCallback((id: string) => {
    setMissedItems((prev) => prev.filter((m) => m.id !== id));
    setSlots((prev) => prev.filter((s) => s.linkedMissedId !== id));
  }, []);

  const handleApproveMissedSlots = useCallback(
    (item: MissedLessonItem, sugs: SlotSuggestion[]) => {
      const catLabel = item.category === 'recording' ? 'Missed Rec' : 'Missed HW';
      const newSlots: TimetableSlot[] = sugs.map((sug, i) => ({
        id: `slot-missed-${Date.now() + i}`,
        day: sug.day,
        specificDateISO: sug.dateISO ?? resolveDateISOForSlotDay(sug.day),
        startTime: sug.startTime,
        endTime: sug.endTime,
        category: 'self-study',
        subject: item.subject,
        unitId: item.unitId,
        title: `${catLabel} · ${item.title}`,
        subtitle: sug.reason,
        autoBlock: sug.autoBlock,
        mode: 'online',
        travelBeforeMins: 0,
        travelAfterMins: 0,
        linkedMissedId: item.id,
      }));
      setSlots((prev) => [...prev, ...newSlots]);
    },
    [resolveDateISOForSlotDay],
  );

  const handleToggleUnitCovered = useCallback(
    (unitId: string) => {
      const becameCovered = !unitCoveredMapRef.current[unitId];
      const unit = findSyllabusUnit(unitId);
      setUnitCoveredMap((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
      syncEntityReward(
        `unit:${unitId}`,
        becameCovered,
        XP_VALUES.unitCovered,
        CRYSTAL_VALUES.unitCovered,
        unit ? `Mastered ${unit.code}` : 'Syllabus Unit Covered',
      );
    },
    [syncEntityReward],
  );

  const handleAddPaper = useCallback(
    (entry: PaperEntry) => {
      setPapers((prev) => [...prev, entry]);
      awardProgress(
        XP_VALUES.paperLog,
        CRYSTAL_VALUES.paperLog,
        `Logged Paper: ${entry.paperName}`,
        'gain',
      );
    },
    [awardProgress],
  );

  const handleUpdatePaper = useCallback((updated: PaperEntry) => {
    setPapers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleDeletePaper = useCallback((paperId: string) => {
    setPapers((prev) => prev.filter((p) => p.id !== paperId));
    setTasks((prev) =>
      prev.map((t) =>
        t.linkedPaperId === paperId ? { ...t, linkedPaperId: undefined } : t,
      ),
    );
  }, []);

  const handleStartManualLock = useCallback((durationMinutes: number) => {
    const untilMs = Date.now() + durationMinutes * 60 * 1000;
    setManualLockUntil(untilMs);
    saveManualLockUntil(untilMs);
    syncNativeBlockerAndAlarms(nativeWeekSlotsRef.current, untilMs);
  }, []);

  const openPlannerTask = useCallback(
    (taskId: string) => {
      setFocusedTaskId(taskId);
      handleSelectTab('planner');
    },
    [handleSelectTab],
  );

  const handleCreateOrOpenReviewTask = useCallback(
    (entry: PaperEntry, openPlanner = true) => {
      const existing = tasks.find(
        (t) => t.id === entry.linkedReviewTaskId || t.linkedPaperId === entry.id,
      );
      const weakNames = (entry.weakUnitIds ?? [])
        .map((id) => findSyllabusUnit(id))
        .filter(Boolean)
        .map((u) => `${u!.code}: ${u!.title}`)
        .join(', ');

      const defaultChecklist: StudyChecklistItem[] =
        (entry.mistakesChecklist && entry.mistakesChecklist.length > 0
          ? entry.mistakesChecklist
          : [
              {
                id: `rev-c1-${Date.now()}`,
                text: `Re-solve wrong MCQs & Part II questions (${entry.paperName})`,
                done: false,
              },
              {
                id: `rev-c2-${Date.now() + 1}`,
                text: weakNames ? `Review weak units: ${weakNames}` : 'Write mistake notes & key formulas',
                done: false,
              },
            ]);

      if (existing) {
        const nextTask: StudyTask = {
          ...existing,
          title: `Review: ${entry.paperName}`,
          subject: entry.subject,
          unitId: entry.weakUnitIds?.[0] ?? existing.unitId,
          checklist:
            entry.mistakesChecklist && entry.mistakesChecklist.length > 0
              ? entry.mistakesChecklist
              : existing.checklist,
          notes: weakNames
            ? `Weak units: ${weakNames}${entry.note ? ` · ${entry.note}` : ''}`
            : existing.notes,
          status: entry.reviewStatus === 'reviewed' ? 'completed' : 'active',
        };
        setTasks((prev) => prev.map((t) => (t.id === existing.id ? nextTask : t)));
        setPapers((prev) =>
          prev.map((p) =>
            p.id === entry.id
              ? {
                  ...p,
                  linkedReviewTaskId: existing.id,
                  reviewStatus: p.reviewStatus === 'reviewed' ? 'reviewed' : 'needs-review',
                }
              : p,
          ),
        );
        if (openPlanner) openPlannerTask(existing.id);
        return;
      }

      const taskId = `task-rev-${Date.now()}`;
      const newTask: StudyTask = {
        id: taskId,
        title: `Review: ${entry.paperName}`,
        subject: entry.subject,
        kind: 'paper-review',
        linkedPaperId: entry.id,
        unitId: entry.weakUnitIds?.[0],
        defaultSessionMins: 60,
        importance: entry.combinedPercent < 65 ? 'urgent' : 'high',
        checklist: defaultChecklist,
        notes: [
          `Score: ${entry.combinedPercent}% (${entry.date})`,
          weakNames ? `Weak units: ${weakNames}` : '',
          entry.note ?? '',
        ]
          .filter(Boolean)
          .join(' · '),
        status: entry.reviewStatus === 'reviewed' ? 'completed' : 'active',
        order: tasks.length,
        createdAtISO: getTodayISO(),
        autoBlockDefault: true,
      };
      setTasks((prev) => [...prev, newTask]);
      setPapers((prev) =>
        prev.map((p) =>
          p.id === entry.id
            ? {
                ...p,
                linkedReviewTaskId: taskId,
                reviewStatus: p.reviewStatus === 'reviewed' ? 'reviewed' : 'needs-review',
              }
            : p,
        ),
      );
      if (openPlanner) openPlannerTask(taskId);
    },
    [tasks, openPlannerTask],
  );

  const handleToggleReviewStatus = useCallback(
    (entry: PaperEntry) => {
      const nextStatus = entry.reviewStatus === 'reviewed' ? 'needs-review' : 'reviewed';
      haptics.tick();

      const chainUnlocked = isAbilityActive(progressionRef.current, 'review_chain_radar');
      const fastDays = diffDaysISO(getTodayISO(), entry.date);
      const multiplier = chainUnlocked && Math.abs(fastDays) <= 2 ? 1.5 : 1;

      syncEntityReward(
        `review:${entry.id}`,
        nextStatus === 'reviewed',
        Math.round(XP_VALUES.paperReview * multiplier),
        CRYSTAL_VALUES.paperReview,
        multiplier > 1
          ? `1.5× Fast Review: ${entry.paperName}`
          : `Reviewed: ${entry.paperName}`,
      );

      setPapers((prev) =>
        prev.map((p) => (p.id === entry.id ? { ...p, reviewStatus: nextStatus } : p)),
      );
      setTasks((prev) =>
        prev.map((t) =>
          t.id === entry.linkedReviewTaskId || t.linkedPaperId === entry.id
            ? { ...t, status: nextStatus === 'reviewed' ? 'completed' : 'active' }
            : t,
        ),
      );
    },
    [syncEntityReward],
  );

  const handleToggleTaskComplete = useCallback(
    (taskId: string) => {
      const target = tasksRef.current.find((t) => t.id === taskId);
      if (!target) return;
      const nextStatus = target.status === 'completed' ? 'active' : 'completed';

      syncEntityReward(
        `task:${target.id}`,
        nextStatus === 'completed',
        XP_VALUES.taskComplete,
        CRYSTAL_VALUES.taskComplete,
        `Task Done: ${target.title}`,
      );

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)),
      );
      if (target.kind === 'paper-review' && target.linkedPaperId) {
        setPapers((prev) =>
          prev.map((p) =>
            p.id === target.linkedPaperId
              ? { ...p, reviewStatus: nextStatus === 'completed' ? 'reviewed' : 'needs-review' }
              : p,
          ),
        );
      }
    },
    [syncEntityReward],
  );

  const handleToggleMissedCovered = useCallback(
    (missedId: string) => {
      const target = missedItemsRef.current.find((m) => m.id === missedId);
      if (!target) return;
      const nextStatus = target.status === 'covered' ? 'active' : 'covered';
      syncEntityReward(
        `missed:${target.id}`,
        nextStatus === 'covered',
        XP_VALUES.missedCovered,
        CRYSTAL_VALUES.missedCovered,
        `Caught Up: ${target.title}`,
      );
      setMissedItems((prev) =>
        prev.map((m) => (m.id === missedId ? { ...m, status: nextStatus } : m)),
      );
    },
    [syncEntityReward],
  );

  const handleClaimBounty = useCallback((bounty: ArenaBountyItem) => {
    setProgression((prev) => {
      if ((prev.claimedBounties ?? {})[bounty.id] === bounty.periodKey) return prev;
      const res = applyProgressDelta(
        prev,
        bounty.rewardXp,
        bounty.rewardCrystals,
        `Bounty Claimed: ${bounty.title}`,
        'bounty',
      );
      if (res.promotedTo) {
        pendingBannerRef.current = {
          text: `Promoted to ${res.promotedTo.name}!`,
          tone: 'promo',
          subtext: `+${CRYSTAL_VALUES.leaguePromoBonus} Crystals · 24h Demotion Shield active`,
          haptic: 'success',
        };
      } else {
        pendingBannerRef.current = {
          text: `Bounty Claimed (+${bounty.rewardXp} XP · +${bounty.rewardCrystals}💎)`,
          tone: 'win',
          haptic: 'success',
        };
      }
      return {
        ...res.next,
        claimedBounties: {
          ...(res.next.claimedBounties ?? {}),
          [bounty.id]: bounty.periodKey,
        },
      };
    });
  }, []);

  // Ability Shop & Active Powers
  const handleUnlockAbility = useCallback(
    (abilityId: AbilityId) => {
      const spec = ABILITIES.find((a) => a.id === abilityId);
      if (!spec) return;
      setProgression((prev) => {
        if (!isLeagueAtLeast(prev.currentLeague, spec.requiredLeague)) return prev;
        if (prev.unlockedAbilities[abilityId]) return prev;
        if (prev.crystals < spec.unlockCostCrystals) return prev;
        return {
          ...prev,
          crystals: prev.crystals - spec.unlockCostCrystals,
          unlockedAbilities: { ...prev.unlockedAbilities, [abilityId]: true },
          streakShieldCharges:
            abilityId === 'streak_shield' ? prev.streakShieldCharges + 1 : prev.streakShieldCharges,
          focusRushCharges:
            abilityId === 'focus_rush' ? prev.focusRushCharges + 2 : prev.focusRushCharges,
        };
      });
      showLeagueBanner(`Unlocked ${spec.name}!`, 'promo');
    },
    [showLeagueBanner],
  );

  const handleBuyCharge = useCallback(
    (abilityId: 'streak_shield' | 'focus_rush') => {
      const spec = ABILITIES.find((a) => a.id === abilityId);
      const cost = spec?.chargeCostCrystals ?? 25;
      setProgression((prev) => {
        if (!isAbilityActive(prev, abilityId) || prev.crystals < cost) return prev;
        return {
          ...prev,
          crystals: prev.crystals - cost,
          streakShieldCharges:
            abilityId === 'streak_shield' ? prev.streakShieldCharges + 1 : prev.streakShieldCharges,
          focusRushCharges:
            abilityId === 'focus_rush' ? prev.focusRushCharges + 1 : prev.focusRushCharges,
        };
      });
    },
    [],
  );

  const handleActivateFocusRush = useCallback(
    (durationMinutes: 60 | 90) => {
      const nowMs = Date.now();
      const canActivate =
        isAbilityActive(progressionRef.current, 'focus_rush') &&
        (progressionRef.current.focusRushCharges > 0 ||
          progressionRef.current.focusRushUntilMs > nowMs);
      if (!canActivate) return;

      const baseStart = Math.max(nowMs, progressionRef.current.focusRushUntilMs);
      const nextUntil = baseStart + durationMinutes * 60 * 1000;
      const alreadyLive = progressionRef.current.focusRushUntilMs > nowMs;

      setProgression((prev) => ({
        ...prev,
        focusRushCharges: alreadyLive ? prev.focusRushCharges : Math.max(0, prev.focusRushCharges - 1),
        focusRushUntilMs: nextUntil,
      }));

      handleStartManualLock(durationMinutes);
      showLeagueBanner(
        `2× Focus Rush Active (${durationMinutes}m)`,
        'promo',
        'All study completions earn Double Trophy XP',
      );
    },
    [handleStartManualLock, showLeagueBanner],
  );

  const handleRunSmartGapFiller = useCallback((): { addedCount: number; message: string } => {
    if (!isAbilityActive(progressionRef.current, 'smart_gap_filler')) {
      return {
        addedCount: 0,
        message: 'Unlock Smart Gap Filler at Gold Strategist first.',
      };
    }
    const candidates = missedItems.filter(
      (m) =>
        m.status === 'active' &&
        !m.rescheduleLocked &&
        !slots.some((s) => s.linkedMissedId === m.id),
    );
    if (candidates.length === 0) {
      return {
        addedCount: 0,
        message: 'Every unscheduled missed lesson already has a Timetable slot.',
      };
    }

    let workingSlots = [...slots];
    const addedSlots: TimetableSlot[] = [];

    for (const item of candidates.slice(0, 4)) {
      const sugs = suggestSlotsForTask({
        slots: workingSlots,
        subject: item.subject,
        durationMins: Math.min(90, Math.max(45, item.estimatedMins)),
        timePreference: 'any',
        autoBlockDefault: item.autoBlockDefault,
        fridayWeekMode,
        fridayAnchor,
        fridayOverrides,
        scanWeekOffset: 0,
        deadlineISO: item.deadlineISO,
        importance: item.importance,
      });
      const best = sugs[0];
      if (!best) continue;
      const newSlot: TimetableSlot = {
        id: `slot-gap-${Date.now()}-${addedSlots.length}`,
        day: best.day,
        specificDateISO: best.dateISO ?? resolveDateISOForSlotDay(best.day),
        startTime: best.startTime,
        endTime: best.endTime,
        category: 'self-study',
        subject: item.subject,
        unitId: item.unitId,
        title: `${item.category === 'recording' ? 'Missed Rec' : 'Missed HW'} · ${item.title}`,
        subtitle: `Auto-Gap · ${best.reason}`,
        autoBlock: best.autoBlock,
        mode: 'online',
        travelBeforeMins: 0,
        travelAfterMins: 0,
        linkedMissedId: item.id,
      };
      workingSlots = [...workingSlots, newSlot];
      addedSlots.push(newSlot);
    }

    if (addedSlots.length === 0) {
      return {
        addedCount: 0,
        message: 'No open 45–90m gaps free this week — try Next Week manually.',
      };
    }

    setSlots(workingSlots);
    const msg = `Auto-slotted ${addedSlots.length} catch-up session${addedSlots.length > 1 ? 's' : ''} cleanly.`;
    showLeagueBanner(msg, 'win');
    return { addedCount: addedSlots.length, message: msg };
  }, [
    fridayAnchor,
    fridayOverrides,
    fridayWeekMode,
    missedItems,
    resolveDateISOForSlotDay,
    showLeagueBanner,
    slots,
  ]);

  // End-of-Slot Check-In Queue (scans today after endTime & yesterday evening if within anchor)
  const pendingCheckInQueue = useMemo<PendingCheckInItem[]>(() => {
    const todayStr = getTodayISO(now);
    const yesterdayStr = addDaysISO(todayStr, -1);
    const currMin = now.getHours() * 60 + now.getMinutes();
    const queue: PendingCheckInItem[] = [];

    const checkDates: Array<{ dateISO: string; checkEndPassed: boolean }> = [];
    if (yesterdayStr >= progression.checkInAnchorISO) {
      checkDates.push({ dateISO: yesterdayStr, checkEndPassed: false });
    }
    if (todayStr >= progression.checkInAnchorISO) {
      checkDates.push({ dateISO: todayStr, checkEndPassed: true });
    }

    for (const { dateISO, checkEndPassed } of checkDates) {
      const dow = getDayOfWeek(parseISODateLocal(dateISO));
      const daySlots = getActiveSlotsForSchedule(
        slots,
        { anchor: fridayAnchor, overrides: fridayOverrides },
        dateISO,
      ).filter((s) => s.day === dow);
      const completedSet = new Set(dailyLogs[dateISO]?.completedSlotIds ?? []);

      for (const slot of daySlots) {
        if (slot.rescheduleLocked) continue;
        const key = `${dateISO}::${slot.id}`;
        if (progression.checkIns[key] || completedSet.has(slot.id) || dismissedCheckInKeys.has(key)) {
          continue;
        }
        const startMin = toMinutes(slot.startTime);
        const endMin =
          slot.endTime === '00:00' && startMin > 0 ? 1440 : toMinutes(slot.endTime);
        if (!checkEndPassed || currMin >= endMin) {
          queue.push({ key, dateISO, slot });
        }
      }
    }

    return queue;
  }, [
    dailyLogs,
    dismissedCheckInKeys,
    fridayAnchor,
    fridayOverrides,
    now,
    progression.checkInAnchorISO,
    progression.checkIns,
    slots,
  ]);

  const handleCheckInComplete = useCallback(
    (item: PendingCheckInItem) => {
      handleToggleSlotComplete(item.dateISO, item.slot.id);
    },
    [handleToggleSlotComplete],
  );

  const handleCheckInSplit = useCallback(
    (item: PendingCheckInItem, percentDone: number) => {
      const dur = getDurationMinutes(item.slot.startTime, item.slot.endTime);
      const doneMins = Math.max(5, Math.round((dur * percentDone) / 100));
      const remainingMins = Math.max(15, dur - doneMins);

      const fullXp =
        item.slot.category === 'class' ? XP_VALUES.classComplete : XP_VALUES.selfStudyComplete;
      const partXp = Math.max(5, Math.round((fullXp * percentDone) / 100));

      handleMarkSlotIncomplete(item.dateISO, item.slot.id, doneMins);
      const splitRecord: SlotCheckInEntry = {
        key: item.key,
        dateISO: item.dateISO,
        slotId: item.slot.id,
        outcome: 'split',
        xpDelta: partXp,
        resolvedAtMs: Date.now(),
      };
      setProgression((prev) => ({
        ...prev,
        checkIns: { ...prev.checkIns, [item.key]: splitRecord },
      }));

      awardProgress(partXp, 4, `Split (${percentDone}%): ${item.slot.title}`, 'gain');

      setSlotPickerState({
        payload: {
          title: `Finish: ${item.slot.title}`,
          subject: item.slot.subject,
          durationMins: remainingMins,
          autoBlockDefault: item.slot.autoBlock,
          badgeLabel: `${SUBJECT_META[item.slot.subject].name} · Split Remainder (No Penalty)`,
          subtitleNote: `Remaining ${percentDone}% split finish`,
        },
        onConfirm: (sug) => {
          const targetDate = sug.dateISO ?? resolveDateISOForSlotDay(sug.day);
          const followSlot: TimetableSlot = {
            id: `slot-split-${Date.now()}`,
            day: sug.day,
            specificDateISO: targetDate,
            startTime: sug.startTime,
            endTime: sug.endTime,
            category: 'self-study',
            subject: item.slot.subject,
            unitId: item.slot.unitId,
            title: `${item.slot.title} (Part 2)`,
            subtitle: `Split finish · ${sug.reason}`,
            autoBlock: sug.autoBlock,
            mode: 'online',
            travelBeforeMins: 0,
            travelAfterMins: 0,
            linkedTaskId: item.slot.linkedTaskId,
            linkedMissedId: item.slot.linkedMissedId,
          };
          setSlots((prev) => [...prev, followSlot]);
          setSlotPickerState(null);
        },
      });
    },
    [awardProgress, handleMarkSlotIncomplete, resolveDateISOForSlotDay],
  );

  const handleCheckInMissedRescue = useCallback(
    (item: PendingCheckInItem) => {
      const dur = getDurationMinutes(item.slot.startTime, item.slot.endTime);
      const rescueRecord: SlotCheckInEntry = {
        key: item.key,
        dateISO: item.dateISO,
        slotId: item.slot.id,
        outcome: 'missed-rescued',
        xpDelta: XP_VALUES.firstMissPenalty,
        resolvedAtMs: Date.now(),
      };
      setProgression((prev) => ({
        ...prev,
        checkIns: { ...prev.checkIns, [item.key]: rescueRecord },
      }));
      awardProgress(XP_VALUES.firstMissPenalty, 0, `Missed: ${item.slot.title}`, 'penalty');

      setSlotPickerState({
        payload: {
          title: `Rescue: ${item.slot.title}`,
          subject: item.slot.subject,
          durationMins: Math.min(180, Math.max(30, dur)),
          autoBlockDefault: item.slot.autoBlock,
          badgeLabel: '1-Time Rescue Slot · Final Chance (+50 XP Comeback)',
          subtitleNote: 'Final Rescue chance — do not miss',
        },
        onConfirm: (sug) => {
          const targetDate = sug.dateISO ?? resolveDateISOForSlotDay(sug.day);
          const rescueSlotId = `slot-rescue-${Date.now()}`;
          const rescueSlot: TimetableSlot = {
            id: rescueSlotId,
            day: sug.day,
            specificDateISO: targetDate,
            startTime: sug.startTime,
            endTime: sug.endTime,
            category: 'self-study',
            subject: item.slot.subject,
            unitId: item.slot.unitId,
            title: `${item.slot.title}`,
            subtitle: `1× Rescue · ${sug.reason}`,
            autoBlock: sug.autoBlock,
            mode: 'online',
            travelBeforeMins: 0,
            travelAfterMins: 0,
            linkedTaskId: item.slot.linkedTaskId,
            linkedMissedId: item.slot.linkedMissedId,
            isRescueSlot: true,
            rescueSourceKey: item.key,
          };
          setSlots((prev) => [...prev, rescueSlot]);
          setProgression((prev) => {
            const existing = prev.checkIns[item.key];
            if (!existing) return prev;
            return {
              ...prev,
              checkIns: {
                ...prev.checkIns,
                [item.key]: { ...existing, rescueSlotId },
              },
            };
          });
          setSlotPickerState(null);
          showLeagueBanner('1-Time Rescue Slot Booked!', 'win', 'Complete it to win +50 XP Comeback');
        },
      });
    },
    [awardProgress, resolveDateISOForSlotDay, showLeagueBanner],
  );

  const handleCheckInMissedDrop = useCallback(
    (item: PendingCheckInItem) => {
      const droppedRecord: SlotCheckInEntry = {
        key: item.key,
        dateISO: item.dateISO,
        slotId: item.slot.id,
        outcome: 'missed-dropped',
        xpDelta: XP_VALUES.firstMissPenalty,
        resolvedAtMs: Date.now(),
      };
      setProgression((prev) => ({
        ...prev,
        checkIns: { ...prev.checkIns, [item.key]: droppedRecord },
      }));
      awardProgress(XP_VALUES.firstMissPenalty, 0, `Dropped: ${item.slot.title}`, 'penalty');
    },
    [awardProgress],
  );

  const handleCheckInDoubleBustLock = useCallback(
    (item: PendingCheckInItem) => {
      const failedRecord: SlotCheckInEntry = {
        key: item.key,
        dateISO: item.dateISO,
        slotId: item.slot.id,
        outcome: 'failed-locked',
        xpDelta: XP_VALUES.secondMissDoubleBust,
        resolvedAtMs: Date.now(),
      };
      setProgression((prev) => ({
        ...prev,
        checkIns: { ...prev.checkIns, [item.key]: failedRecord },
      }));
      awardProgress(
        XP_VALUES.secondMissDoubleBust,
        0,
        `Rescue Failed (Locked): ${item.slot.title}`,
        'penalty',
      );
      setSlots((prev) =>
        prev.map((s) => (s.id === item.slot.id ? { ...s, rescheduleLocked: true } : s)),
      );
      if (item.slot.linkedMissedId) {
        setMissedItems((prev) =>
          prev.map((m) =>
            m.id === item.slot.linkedMissedId ? { ...m, rescheduleLocked: true } : m,
          ),
        );
      }
    },
    [awardProgress],
  );

  const handleDismissCheckInsForNow = useCallback(() => {
    setDismissedCheckInKeys((prev) => {
      const next = new Set(prev);
      pendingCheckInQueue.forEach((it) => next.add(it.key));
      return next;
    });
  }, [pendingCheckInQueue]);

  const handleRequestSlotPicker = useCallback(
    (payload: SmartSlotPickerPayload, onConfirm: (sug: SlotSuggestion) => void) => {
      setSlotPickerState({
        payload,
        onConfirm: (sug) => {
          onConfirm(sug);
          setSlotPickerState(null);
        },
      });
    },
    [],
  );

  const createTaskFromWeeklyPlan = useCallback(
    (plan: SuggestedWeeklyTaskPlan, chosenDurationMins: number): StudyTask | null => {
      if (plan.existingTaskId) {
        return tasksRef.current.find((t) => t.id === plan.existingTaskId) ?? null;
      }
      if (plan.linkedMissedId) {
        return null;
      }
      const newTask: StudyTask = {
        id: `task-auto-${Date.now()}`,
        title: plan.title,
        subject: plan.subject,
        unitId: plan.unitId,
        kind: plan.source === 'paper-review' ? 'paper-review' : 'task',
        linkedPaperId: plan.linkedPaperId,
        defaultSessionMins: chosenDurationMins,
        deadlineISO: plan.deadlineISO,
        importance: plan.importance,
        checklist: (plan.checklistTexts ?? []).map((txt, idx) => ({
          id: `chk-auto-${Date.now()}-${idx}`,
          text: txt,
          done: false,
        })),
        notes: plan.subtitle,
        status: 'active',
        order: tasksRef.current.length,
        createdAtISO: getTodayISO(),
        autoBlockDefault: true,
      };
      setTasks((prev) => [...prev, newTask]);
      if (plan.source === 'paper-review' && plan.linkedPaperId) {
        setPapers((prev) =>
          prev.map((p) =>
            p.id === plan.linkedPaperId ? { ...p, linkedReviewTaskId: newTask.id } : p,
          ),
        );
      }
      return newTask;
    },
    [],
  );

  const handleSaveWeeklyFocusTaskOnly = useCallback(
    (plan: SuggestedWeeklyTaskPlan, chosenDurationMins: number) => {
      const created = createTaskFromWeeklyPlan(plan, chosenDurationMins);
      if (created) {
        showLeagueBanner(`Added "${created.title}" to Planner Queue`, 'win');
      }
    },
    [createTaskFromWeeklyPlan, showLeagueBanner],
  );

  const handleAcceptAndScheduleWeeklyFocus = useCallback(
    (plan: SuggestedWeeklyTaskPlan, chosenDurationMins: number) => {
      const existingTask =
        plan.existingTaskId
          ? tasksRef.current.find((t) => t.id === plan.existingTaskId) ?? null
          : null;
      const existingMissed =
        plan.linkedMissedId
          ? missedItemsRef.current.find((m) => m.id === plan.linkedMissedId) ?? null
          : null;

      let taskIdForSlot = existingTask?.id;
      if (!existingTask && !existingMissed) {
        const created = createTaskFromWeeklyPlan(plan, chosenDurationMins);
        taskIdForSlot = created?.id;
      }

      handleRequestSlotPicker(
        {
          title: plan.title,
          subject: plan.subject,
          durationMins: chosenDurationMins,
          deadlineISO: plan.deadlineISO,
          importance: plan.importance,
          autoBlockDefault: true,
          badgeLabel: `${SUBJECT_META[plan.subject].name} · Weekly Auto-Suggest`,
          subtitleNote: plan.subtitle,
        },
        (sug) => {
          const targetDate = sug.dateISO ?? resolveDateISOForSlotDay(sug.day);
          const newSlot: TimetableSlot = {
            id: `slot-wsug-${Date.now()}`,
            day: sug.day,
            specificDateISO: targetDate,
            startTime: sug.startTime,
            endTime: sug.endTime,
            category: 'self-study',
            subject: plan.subject,
            unitId: plan.unitId,
            title: plan.title,
            subtitle: sug.reason,
            autoBlock: sug.autoBlock,
            mode: 'online',
            travelBeforeMins: 0,
            travelAfterMins: 0,
            linkedTaskId: taskIdForSlot,
            linkedMissedId: existingMissed?.id,
          };
          setSlots((prev) => [...prev, newSlot]);
        },
      );
    },
    [createTaskFromWeeklyPlan, handleRequestSlotPicker, resolveDateISOForSlotDay],
  );

  const handleToggleTheme = useCallback(() => setIsDark((prev) => !prev), []);
  const handleToggleCalmBackdrop = useCallback(() => setCalmBackdrop((prev) => !prev), []);
  const handleOpenBlocker = useCallback(() => setBlockerModalOpen(true), []);
  const handleCloseBlocker = useCallback(() => setBlockerModalOpen(false), []);
  const handleOpenAppearance = useCallback(() => setAppearanceOpen(true), []);
  const handleCloseAppearance = useCallback(() => setAppearanceOpen(false), []);
  const handleOpenAbilities = useCallback(() => setAbilitiesOpen(true), []);
  const handleCloseAbilities = useCallback(() => setAbilitiesOpen(false), []);
  const handleOpenWeeklyFocusSuggest = useCallback(() => setWeeklyFocusSuggestOpen(true), []);
  const handleCloseWeeklyFocusSuggest = useCallback(() => setWeeklyFocusSuggestOpen(false), []);
  const handleOpenPermissions = useCallback(() => setPermissionsOpen(true), []);
  const handleClosePermissions = useCallback(() => setPermissionsOpen(false), []);
  const handleOpenLiveBanner = useCallback(() => handleSelectTab('day'), [handleSelectTab]);
  const handleGoToTimetable = useCallback(() => handleSelectTab('timetable'), [handleSelectTab]);
  const handleGoToPlanner = useCallback(() => handleSelectTab('planner'), [handleSelectTab]);
  const handleGoToMissed = useCallback(() => handleSelectTab('missed'), [handleSelectTab]);
  const handleGoToPapers = useCallback(() => handleSelectTab('papers'), [handleSelectTab]);
  const handleClearFocusedTask = useCallback(() => setFocusedTaskId(null), []);
  const handleToggleLinkedSlotComplete = useCallback(
    (slot: TimetableSlot) =>
      handleToggleSlotComplete(
        slot.specificDateISO ?? resolveDateISOForSlotDay(slot.day),
        slot.id,
      ),
    [handleToggleSlotComplete, resolveDateISOForSlotDay],
  );
  const handleMarkLinkedSlotIncomplete = useCallback(
    (slot: TimetableSlot, partialMins: number) =>
      handleMarkSlotIncomplete(
        slot.specificDateISO ?? resolveDateISOForSlotDay(slot.day),
        slot.id,
        partialMins,
      ),
    [handleMarkSlotIncomplete, resolveDateISOForSlotDay],
  );

  const pendingMissedCount = useMemo(
    () => missedItems.filter((m) => m.status === 'active').length,
    [missedItems],
  );

  const unreviewedPapersCount = useMemo(
    () => papers.filter((p) => p.reviewStatus === 'needs-review').length,
    [papers],
  );

  const activeTasksCount = useMemo(
    () => tasks.filter((t) => t.status === 'active').length,
    [tasks],
  );

  const readyBountiesCount = useMemo(
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
      }).filter((b) => b.readyToClaim).length,
    [
      dailyLogs,
      fridayAnchor,
      fridayOverrides,
      missedItems,
      papers,
      progression,
      slots,
      tasks,
      unitCoveredMap,
    ],
  );

  const navBadges = useMemo<Partial<Record<TabId, number>>>(
    () => ({
      planner: activeTasksCount,
      missed: pendingMissedCount,
      papers: unreviewedPapersCount,
    }),
    [activeTasksCount, pendingMissedCount, unreviewedPapersCount],
  );

  const missingPermCount = useMemo(() => {
    if (!nativePerms) return 0;
    if (!nativePerms.isNativeAndroid) {
      return nativePerms.notifications ? 0 : 1;
    }
    return [
      nativePerms.notifications,
      nativePerms.usageAccess,
      nativePerms.overlayAccess,
      nativePerms.batteryUnrestricted,
    ].filter((granted) => !granted).length;
  }, [nativePerms]);

  const activeAurora = useMemo(
    () => AURORA_THEMES.find((a) => a.id === effStudio.auroraTheme) ?? AURORA_THEMES[0],
    [effStudio.auroraTheme],
  );

  const bgHex =
    effStudio.auroraTheme === 'custom'
      ? isDark
        ? effStudio.customBgHex
        : '#CFE3FF'
      : isDark
        ? activeAurora.darkBg
        : activeAurora.lightBg;

  const orb1Color =
    effStudio.auroraTheme === 'custom' ? effStudio.customOrb1Hex : activeAurora.orb1;
  const orb2Color =
    effStudio.auroraTheme === 'custom' ? effStudio.customOrb2Hex : activeAurora.orb2;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#CFE3FF] text-[#07142B] transition-colors duration-300 dark:bg-[#02071A] dark:text-white"
      style={
        effStudio.auroraTheme !== 'sapphire'
          ? { backgroundColor: bgHex }
          : undefined
      }
    >
      {/* GPU-Isolated Arctic Sapphire Crystal Prism Aurora Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden [transform:translateZ(0)]"
      >
        <div className="arctic-grid-bg absolute inset-0 opacity-90" />
        <div
          className="absolute inset-0 opacity-85 dark:opacity-80"
          style={{
            background:
              'radial-gradient(ellipse 80% 56% at 50% 34%, rgba(59,130,246,0.22) 0%, rgba(34,211,238,0.14) 46%, rgba(34,211,238,0) 78%)',
          }}
        />
        <div
          className={`${calmBackdrop ? '' : 'animate-orb-a'} absolute -left-24 -top-24 h-[520px] w-[520px] rounded-full opacity-95`}
          style={{
            background: `radial-gradient(circle, ${orb1Color} 0%, rgba(56,189,248,0.18) 48%, rgba(37,99,235,0) 72%)`,
          }}
        />
        <div
          className={`${calmBackdrop ? '' : 'animate-orb-b'} absolute right-[-90px] top-[14%] h-[480px] w-[480px] rounded-full opacity-90`}
          style={{
            background: `radial-gradient(circle, ${orb2Color} 0%, rgba(16,185,129,0.14) 48%, rgba(16,185,129,0) 72%)`,
          }}
        />
        <div
          className={`${calmBackdrop ? '' : 'animate-orb-a'} absolute bottom-[-90px] left-[16%] h-[420px] w-[420px] rounded-full opacity-85`}
          style={{
            background: `radial-gradient(circle, ${orb1Color} 0%, rgba(34,211,238,0.12) 48%, rgba(59,130,246,0) 74%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-60 dark:opacity-45"
          style={{
            background:
              'linear-gradient(125deg, rgba(255,255,255,0.32) 0%, rgba(125,211,252,0.12) 38%, rgba(255,255,255,0) 68%, rgba(34,211,238,0.14) 100%)',
          }}
        />

        {/* Diamond/Apex Live Particles Layer (hidden in A07 battery saver mode) */}
        {effStudio.liveParticles !== 'off' && !calmBackdrop && (
          <div className="absolute inset-0 overflow-hidden">
            {PARTICLE_SEEDS.map((p, idx) => (
              <span
                key={idx}
                className="animate-particle absolute rounded-full"
                style={{
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  animationDelay: p.delay,
                  animationDuration: p.dur,
                  background:
                    effStudio.liveParticles === 'sparks'
                      ? '#34D399'
                      : effStudio.liveParticles === 'stardust'
                        ? '#FBBF24'
                        : '#67E8F9',
                  boxShadow:
                    effStudio.liveParticles === 'stardust'
                      ? '0 0 10px rgba(251,191,36,0.75)'
                      : '0 0 10px rgba(103,232,249,0.7)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10">
        <TopBar
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          blockerActive={activeLock.active}
          onOpenBlockerPreview={handleOpenBlocker}
          onOpenAppearance={handleOpenAppearance}
          appearanceOpen={appearanceOpen}
          onOpenAbilities={handleOpenAbilities}
          abilitiesOpen={abilitiesOpen}
          currentLeague={progression.currentLeague}
          xp={progression.xp}
          rushActive={isFocusRushActive(progression)}
          readyBountiesCount={readyBountiesCount}
          hasMissingPermissions={missingPermCount > 0}
          liveBannerText={liveBanner?.text ?? null}
          liveBannerSubject={liveBanner?.subject ?? null}
          onOpenLiveBanner={handleOpenLiveBanner}
        />

        {/* League Promotion / Trophy Feedback Toast */}
        {leagueBanner && (
          <div className="animate-sheet-in mx-auto mt-2 max-w-md px-4">
            <div
              className={`ios-glass-modal flex items-center justify-between gap-2.5 rounded-full border px-4 py-2 text-xs ${
                leagueBanner.tone === 'promo'
                  ? 'border-amber-400/70'
                  : leagueBanner.tone === 'loss'
                    ? 'border-rose-500/60'
                    : 'border-emerald-400/60'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {leagueBanner.tone === 'promo' ? (
                  <LeagueCrest league={progression.currentLeague} size="xs" />
                ) : leagueBanner.tone === 'loss' ? (
                  <TrendingDown className="h-4 w-4 shrink-0 text-rose-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-bold text-[#07142B] dark:text-white">
                    {leagueBanner.text}
                  </p>
                  {leagueBanner.subtext && (
                    <p className="truncate text-[10.5px] text-[#0B234A]/75 dark:text-sky-200/80">
                      {leagueBanner.subtext}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLeagueBanner(null)}
                aria-label="Dismiss trophy alert"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Floating Pre-Slot / End-of-Slot Alert Toast */}
        {reminderToast && (
          <div className="animate-sheet-in mx-auto mt-2 max-w-md px-4">
            <div className="ios-glass-modal flex items-center justify-between gap-3 rounded-full px-4 py-2.5 text-xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <Bell className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-300" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#07142B] dark:text-white">
                    {reminderToast.title}
                  </p>
                  <p className="truncate text-[11px] text-[#0B234A]/75 dark:text-sky-200/80">
                    {reminderToast.subtitle} · {reminderToast.startTime}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissReminderToast}
                aria-label="Dismiss reminder"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <main
          ref={mainRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {activeTab === 'day' && (
            <DayView
              slots={slots}
              tasks={tasks}
              missedItems={missedItems}
              papers={papers}
              dailyLogs={dailyLogs}
              activeLock={activeLock}
              fridayAnchor={fridayAnchor}
              fridayOverrides={fridayOverrides}
              unitCoveredMap={unitCoveredMap}
              progression={progression}
              studio={studio}
              pendingMissedCount={pendingMissedCount}
              unreviewedPapersCount={unreviewedPapersCount}
              onToggleSlotComplete={handleToggleSlotComplete}
              onMarkSlotIncomplete={handleMarkSlotIncomplete}
              onToggleTaskComplete={handleToggleTaskComplete}
              onToggleMissedCovered={handleToggleMissedCovered}
              onQuickAddSlot={handleAddSlot}
              onQuickAddTask={handleAddTask}
              onQuickAddMissed={handleAddMissed}
              onOpenBlockerPreview={handleOpenBlocker}
              onOpenAbilities={handleOpenAbilities}
              onOpenWeeklyFocusSuggest={handleOpenWeeklyFocusSuggest}
              onAcceptWeeklyFocusPlan={handleAcceptAndScheduleWeeklyFocus}
              onGoToTimetable={handleGoToTimetable}
              onOpenPlannerForTask={openPlannerTask}
              onOpenPlanner={handleGoToPlanner}
              onOpenMissedPage={handleGoToMissed}
              onOpenPapers={handleGoToPapers}
            />
          )}

          {activeTab === 'timetable' && (
            <TimetableView
              slots={slots}
              weekOffset={weekOffset}
              onChangeWeekOffset={setWeekOffset}
              fridayAnchor={fridayAnchor}
              fridayOverrides={fridayOverrides}
              onChangeFridayModeForWeek={handleChangeFridayModeForWeek}
              onResetFridayOverrideForWeek={handleResetFridayOverrideForWeek}
              dailyLogs={dailyLogs}
              onResetCleanSchedule={handleResetCleanSchedule}
              isActive={true}
              onDragActiveChange={setIsTimetableDragging}
              onAddSlot={handleAddSlot}
              onUpdateSlot={handleUpdateSlot}
              onDeleteSlot={handleDeleteSlot}
              onSkipSlotForDate={handleSkipSlotForDate}
              onRestoreSkippedSlotForDate={handleRestoreSkippedSlotForDate}
              onMoveRecurringSlotOneWeekOnly={handleMoveRecurringSlotOneWeekOnly}
              onOpenReviseLoop={setReviseLoopClassSlot}
              onToggleSlotComplete={handleToggleSlotComplete}
              onOpenPlannerForTask={openPlannerTask}
              onOpenMissedPage={handleGoToMissed}
            />
          )}

          {activeTab === 'planner' && (
            <PlannerView
              tasks={tasks}
              missedItems={missedItems}
              slots={slots}
              dailyLogs={dailyLogs}
              fridayWeekMode={fridayWeekMode}
              fridayAnchor={fridayAnchor}
              fridayOverrides={fridayOverrides}
              unitCoveredMap={unitCoveredMap}
              focusedTaskId={focusedTaskId}
              onClearFocusedTask={handleClearFocusedTask}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onReorderTasks={handleReorderTasks}
              onApproveSuggestedSlot={handleApproveSuggestedSlot}
              onRequestSlotPicker={handleRequestSlotPicker}
              onToggleLinkedSlotComplete={handleToggleLinkedSlotComplete}
              onMarkLinkedSlotIncomplete={handleMarkLinkedSlotIncomplete}
              onDeleteLinkedSlot={handleDeleteSlot}
              onToggleUnitCovered={handleToggleUnitCovered}
              onOpenWeeklyFocusSuggest={handleOpenWeeklyFocusSuggest}
            />
          )}

          {activeTab === 'missed' && (
            <MissedView
              missedItems={missedItems}
              slots={slots}
              dailyLogs={dailyLogs}
              fridayWeekMode={fridayWeekMode}
              fridayAnchor={fridayAnchor}
              fridayOverrides={fridayOverrides}
              canSmartGapFill={isAbilityActive(progression, 'smart_gap_filler')}
              onOpenAbilities={handleOpenAbilities}
              onRunSmartGapFiller={handleRunSmartGapFiller}
              onAddMissed={handleAddMissed}
              onUpdateMissed={handleUpdateMissed}
              onDeleteMissed={handleDeleteMissed}
              onApproveMissedSlots={handleApproveMissedSlots}
              onRequestSlotPicker={handleRequestSlotPicker}
              onToggleLinkedSlotComplete={handleToggleLinkedSlotComplete}
              onDeleteLinkedSlot={handleDeleteSlot}
            />
          )}

          {activeTab === 'papers' && (
            <PapersView
              papers={papers}
              tasks={tasks}
              reviewChainActive={isAbilityActive(progression, 'review_chain_radar')}
              onOpenAbilities={handleOpenAbilities}
              onAddPaper={handleAddPaper}
              onUpdatePaper={handleUpdatePaper}
              onDeletePaper={handleDeletePaper}
              onCreateOrOpenReviewTask={handleCreateOrOpenReviewTask}
              onToggleReviewStatus={handleToggleReviewStatus}
              isDark={isDark}
            />
          )}

          {activeTab === 'countdown' && (
            <CountdownView
              activeLock={activeLock}
              onOpenBlockerPreview={handleOpenBlocker}
              isActive={true}
              calmBackdrop={calmBackdrop}
              unitCoveredMap={unitCoveredMap}
              papers={papers}
              missedItems={missedItems}
              dailyLogs={dailyLogs}
              progression={progression}
              onOpenAbilities={handleOpenAbilities}
            />
          )}
        </main>

        <BottomNav
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          badges={navBadges}
        />

        {blockerModalOpen && (
          <FocusRushSheet
            open
            activeLock={activeLock}
            progression={progression}
            missingPermissionsCount={missingPermCount}
            onStartManualLock={handleStartManualLock}
            onActivateFocusRush={handleActivateFocusRush}
            onOpenPermissions={handleOpenPermissions}
            onClose={handleCloseBlocker}
          />
        )}

        {abilitiesOpen && (
          <XPArenaOverlay
            open
            progression={progression}
            slots={slots}
            tasks={tasks}
            missedItems={missedItems}
            papers={papers}
            dailyLogs={dailyLogs}
            unitCoveredMap={unitCoveredMap}
            fridayAnchor={fridayAnchor}
            fridayOverrides={fridayOverrides}
            activeMissedCount={pendingMissedCount}
            onUnlockAbility={handleUnlockAbility}
            onBuyCharge={handleBuyCharge}
            onOpenFocusRush={() => {
              setAbilitiesOpen(false);
              setBlockerModalOpen(true);
            }}
            onRunSmartGapFiller={handleRunSmartGapFiller}
            onOpenWeeklyFocusSuggest={handleOpenWeeklyFocusSuggest}
            onClaimBounty={handleClaimBounty}
            onClose={handleCloseAbilities}
          />
        )}

        {weeklyFocusSuggestOpen && (
          <WeeklyFocusSuggestSheet
            open
            slots={slots}
            tasks={tasks}
            missedItems={missedItems}
            papers={papers}
            unitCoveredMap={unitCoveredMap}
            fridayAnchor={fridayAnchor}
            fridayOverrides={fridayOverrides}
            onSaveTaskOnly={handleSaveWeeklyFocusTaskOnly}
            onAcceptAndSchedule={handleAcceptAndScheduleWeeklyFocus}
            onClose={handleCloseWeeklyFocusSuggest}
          />
        )}

        {appearanceOpen && (
          <AppearanceSheet
            open
            transparency={glassTransparency}
            onChangeTransparency={handleChangeTransparency}
            calmBackdrop={calmBackdrop}
            onToggleCalmBackdrop={handleToggleCalmBackdrop}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
            currentLeague={progression.currentLeague}
            studio={studio}
            onChangeStudio={setStudio}
            missingPermCount={missingPermCount}
            onOpenPermissions={handleOpenPermissions}
            onExportBackupJson={handleExportBackupJson}
            onImportBackupJson={handleImportBackupJson}
            onClose={handleCloseAppearance}
          />
        )}

        {permissionsOpen && (
          <PermissionsSheet
            open
            initialStatus={nativePerms}
            onStatusUpdated={setNativePerms}
            onClose={handleClosePermissions}
          />
        )}

        {reviseLoopClassSlot !== null && (
          <ReviseLoopSheet
            open
            classSlot={reviseLoopClassSlot}
            allSlots={slots}
            fridayWeekMode={fridayWeekMode}
            fridayAnchor={fridayAnchor}
            fridayOverrides={fridayOverrides}
            onApproveLoop={handleApproveReviseLoop}
            onClose={() => setReviseLoopClassSlot(null)}
          />
        )}

        {pendingCheckInQueue.length > 0 && !slotPickerState && (
          <SlotCheckInModal
            queue={pendingCheckInQueue}
            onComplete={handleCheckInComplete}
            onSplitAndFinish={handleCheckInSplit}
            onMissedChooseRescue={handleCheckInMissedRescue}
            onMissedDrop={handleCheckInMissedDrop}
            onDoubleBustLock={handleCheckInDoubleBustLock}
            onDismissForNow={handleDismissCheckInsForNow}
          />
        )}

        {slotPickerState && (
          <SmartSlotPickerSheet
            open
            target={slotPickerState.payload}
            slots={slots}
            fridayAnchor={fridayAnchor}
            fridayOverrides={fridayOverrides}
            onConfirmSlot={slotPickerState.onConfirm}
            onClose={() => setSlotPickerState(null)}
          />
        )}
      </div>
    </div>
  );
}
