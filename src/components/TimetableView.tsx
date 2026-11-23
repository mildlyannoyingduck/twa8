import {
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  Layers,
  Lock,
  Maximize2,
  Minimize2,
  Navigation,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { memo, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CLASS_PRESETS,
  DAYS_ORDER,
  GLASS_SUBJECT_BLOCK,
  LEGACY_PRESET_MAP,
  SUBJECT_META,
} from '../data/previewData';
import {
  ClassMode,
  DayCompletionLog,
  DayOfWeek,
  FridayAnchor,
  FridayWeekMode,
  FridayWeekOverrides,
  SlotCategory,
  SubjectId,
  TimetableSlot,
} from '../types';
import {
  formatShortDateISO,
  formatWeekOffsetLabel,
  formatWeekRange,
  getDayOfWeek,
  getTodayISO,
  getWeekDaysForOffset,
  parseISODateLocal,
} from '../utils/dateUtils';
import { haptics } from '../utils/haptics';
import {
  computePhysicalTravelVisuals,
  getActiveSlotsForWeek,
  minutesToHHMM,
  resolveFridayModeForWeek,
} from '../utils/schedulerEngine';
import { formatDuration, formatTime12h, getDurationMinutes, toMinutes } from '../utils/timeUtils';
import { CrystalSheet, LiquidSwitch } from './FluidControls';
import { GlassTimePicker } from './GlassTimePicker';

interface TimetableViewProps {
  slots: TimetableSlot[];
  weekOffset?: number;
  onChangeWeekOffset?: (offset: number) => void;
  fridayAnchor?: FridayAnchor;
  fridayOverrides?: FridayWeekOverrides;
  onChangeFridayModeForWeek?: (weekMondayISO: string, mode: FridayWeekMode) => void;
  onResetFridayOverrideForWeek?: (weekMondayISO: string) => void;
  dailyLogs?: Record<string, DayCompletionLog>;
  onResetCleanSchedule?: () => void;
  isActive?: boolean;
  onDragActiveChange?: (dragging: boolean) => void;
  onAddSlot: (slot: TimetableSlot, triggerReviseLoop?: boolean) => void;
  onUpdateSlot: (slot: TimetableSlot) => void;
  onDeleteSlot: (slotId: string) => void;
  onSkipSlotForDate?: (slotId: string, dateISO: string) => void;
  onRestoreSkippedSlotForDate?: (slotId: string, dateISO: string) => void;
  onMoveRecurringSlotOneWeekOnly?: (
    sourceSlot: TimetableSlot,
    fromDateISO: string,
    newDay: DayOfWeek,
    newDateISO: string,
    newStartTime: string,
    newEndTime: string,
  ) => void;
  onOpenReviseLoop: (classSlot: TimetableSlot) => void;
  onToggleSlotComplete?: (dateISO: string, slotId: string) => void;
  onOpenPlannerForTask?: (taskId: string) => void;
  onOpenMissedPage?: () => void;
}

const GRID_START_HOUR = 0;
const GRID_END_HOUR = 24;
const HOUR_HEIGHT = 48;

const SPOTLIGHT_ACTIVE_STYLE: Record<'all' | SubjectId, string> = {
  all: 'bg-blue-600 text-white shadow-sm dark:bg-blue-500',
  biology: 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500',
  physics: 'bg-orange-500 text-white shadow-sm dark:bg-orange-500',
  chemistry: 'bg-violet-600 text-white shadow-sm dark:bg-violet-500',
};

const COMMUTE_OPTIONS = [0, 30, 60, 90, 120, 150, 180, 210];

function formatMinutesCompact(minutes: number): string {
  if (minutes <= 0) return 'Free';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface ActiveDragState {
  slot: TimetableSlot;
  originDateISO: string;
  durMin: number;
  grabOffsetMins: number;
  targetColIdx: number;
  targetStartMin: number;
  hoverArrow: 'prev' | 'next' | null;
}

interface PendingRecurringDrop {
  slot: TimetableSlot;
  originDateISO: string;
  targetDay: DayOfWeek;
  targetDateISO: string;
  newStartTime: string;
  newEndTime: string;
}

export const TimetableView = memo(function TimetableView({
  slots,
  weekOffset,
  onChangeWeekOffset,
  fridayAnchor,
  fridayOverrides,
  onChangeFridayModeForWeek,
  onResetFridayOverrideForWeek,
  dailyLogs = {},
  onResetCleanSchedule,
  isActive = true,
  onDragActiveChange,
  onAddSlot,
  onUpdateSlot,
  onDeleteSlot,
  onSkipSlotForDate,
  onRestoreSkippedSlotForDate,
  onMoveRecurringSlotOneWeekOnly,
  onOpenReviseLoop,
  onToggleSlotComplete,
  onOpenPlannerForTask,
  onOpenMissedPage,
}: TimetableViewProps) {
  const todayDow = getDayOfWeek();
  const [viewMode, setViewMode] = useState<'grid' | 'day'>('grid');
  const [horizontalOpen, setHorizontalOpen] = useState(false);
  const [isPortraitViewport, setIsPortraitViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false,
  );
  const [internalWeekOffset, setInternalWeekOffset] = useState<number>(0);
  const activeWeekOffset = weekOffset ?? internalWeekOffset;
  const setWeekOffset = useCallback(
    (next: number) => {
      if (onChangeWeekOffset) onChangeWeekOffset(next);
      else setInternalWeekOffset(next);
    },
    [onChangeWeekOffset],
  );

  const [activeDay, setActiveDay] = useState<DayOfWeek>(todayDow);
  const [categoryFilter, setCategoryFilter] = useState<'all' | SlotCategory>('all');
  const [subjectFilter, setSubjectFilter] = useState<'all' | SubjectId>('all');
  const isFilterActive = categoryFilter !== 'all' || subjectFilter !== 'all';
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const handleResize = () => {
      setIsPortraitViewport(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!horizontalOpen) return;
    try {
      const orientation = (window.screen as unknown as {
        orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void };
      }).orientation;
      void orientation?.lock?.('landscape').catch(() => {});
    } catch {
      // Orientation lock optional; CSS 90deg rotation handles portrait phones seamlessly
    }
    return () => {
      try {
        const orientation = (window.screen as unknown as {
          orientation?: { unlock?: () => void };
        }).orientation;
        orientation?.unlock?.();
      } catch {
        // Ignore
      }
    };
  }, [horizontalOpen]);

  useEffect(() => {
    if (!isActive) return;
    const update = () => {
      if (!document.hidden) {
        const d = new Date();
        setNowMinutes(d.getHours() * 60 + d.getMinutes());
      }
    };
    update();
    const t = window.setInterval(update, 30000);
    return () => window.clearInterval(t);
  }, [isActive]);

  const weekDays = useMemo(
    () => getWeekDaysForOffset(activeWeekOffset, new Date()),
    [activeWeekOffset],
  );
  const weekMondayISO = weekDays[0].dateISO;
  const weekRangeLabel = formatWeekRange(weekMondayISO);
  const weekOffsetLabel = formatWeekOffsetLabel(activeWeekOffset);

  const effectiveFridayMode: FridayWeekMode = useMemo(() => {
    if (!fridayAnchor) return 'bio-week';
    return resolveFridayModeForWeek(weekMondayISO, fridayAnchor, fridayOverrides);
  }, [weekMondayISO, fridayAnchor, fridayOverrides]);

  const isFridayOverridden = Boolean(fridayOverrides?.[weekMondayISO]);

  const { slotsByDay, allWeekSlots, skippedThisWeek } = useMemo(
    () =>
      getActiveSlotsForWeek(
        slots,
        weekDays,
        fridayAnchor
          ? { anchor: fridayAnchor, overrides: fridayOverrides }
          : effectiveFridayMode,
      ),
    [slots, weekDays, fridayAnchor, fridayOverrides, effectiveFridayMode],
  );

  const filteredSlotsByDay = useMemo(() => {
    const matches = (slot: TimetableSlot) =>
      (categoryFilter === 'all' || slot.category === categoryFilter) &&
      (subjectFilter === 'all' || slot.subject === subjectFilter);

    const out = {} as Record<DayOfWeek, TimetableSlot[]>;
    for (const day of DAYS_ORDER) {
      out[day] = (slotsByDay[day] ?? []).filter(matches);
    }
    return out;
  }, [slotsByDay, categoryFilter, subjectFilter]);

  const filteredWeekSlots = useMemo(
    () => DAYS_ORDER.flatMap((d) => filteredSlotsByDay[d] ?? []),
    [filteredSlotsByDay],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotSpecificDate, setEditingSlotSpecificDate] = useState<string | undefined>(
    undefined,
  );
  const [editingLinkedTaskId, setEditingLinkedTaskId] = useState<string | undefined>(undefined);
  const [editingLinkedMissedId, setEditingLinkedMissedId] = useState<string | undefined>(undefined);
  const [editingIsCatchUp, setEditingIsCatchUp] = useState<boolean>(false);
  const [formDay, setFormDay] = useState<DayOfWeek>(todayDow);
  const [repeatScope, setRepeatScope] = useState<'recurring' | 'one-off'>('recurring');
  const [specificDateInput, setSpecificDateInput] = useState<string>(getTodayISO());
  const [category, setCategory] = useState<SlotCategory>('class');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(CLASS_PRESETS[0].id);
  const [classDropdownOpen, setClassDropdownOpen] = useState<boolean>(false);
  const [classMode, setClassMode] = useState<ClassMode>('online');
  const [travelBeforeMins, setTravelBeforeMins] = useState<number>(0);
  const [travelAfterMins, setTravelAfterMins] = useState<number>(0);
  const [planReviseLoop, setPlanReviseLoop] = useState<boolean>(true);

  const [selfSubject, setSelfSubject] = useState<SubjectId>('biology');
  const [selfNote, setSelfNote] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('11:00');
  const [autoBlock, setAutoBlock] = useState(true);

  const [clockTarget, setClockTarget] = useState<'start' | 'end' | null>(null);

  // Physical Drag-and-Drop refs & state (supports normal + 90deg rotated landscape)
  const gridBodyRef = useRef<HTMLDivElement | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const prevWeekBtnRef = useRef<HTMLButtonElement | null>(null);
  const nextWeekBtnRef = useRef<HTMLButtonElement | null>(null);
  const suppressNextClickRef = useRef<boolean>(false);
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const activeDragRef = useRef<ActiveDragState | null>(null);
  const [pendingRecurringDrop, setPendingRecurringDrop] = useState<PendingRecurringDrop | null>(
    null,
  );

  const weekDaysRef = useRef(weekDays);
  weekDaysRef.current = weekDays;
  const activeWeekOffsetRef = useRef(activeWeekOffset);
  activeWeekOffsetRef.current = activeWeekOffset;
  const setWeekOffsetRef = useRef(setWeekOffset);
  setWeekOffsetRef.current = setWeekOffset;
  const isRotatedLandscapeRef = useRef(false);
  isRotatedLandscapeRef.current = horizontalOpen && isPortraitViewport;

  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
    (_, i) => GRID_START_HOUR + i,
  );

  // Weekly Telemetry & Per-Day Totals (scoped strictly to active week + active filters)
  const weeklyTelemetry = useMemo(() => {
    let totalMins = 0;
    let classMins = 0;
    let studyMins = 0;
    let transitMins = 0;
    let transitTrips = 0;
    const perDayMins: Record<DayOfWeek, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };

    for (const s of filteredWeekSlots) {
      const dur = getDurationMinutes(s.startTime, s.endTime);
      totalMins += dur;
      perDayMins[s.day] += dur;
      if (s.category === 'class') classMins += dur;
      else studyMins += dur;
    }

    for (const day of DAYS_ORDER) {
      const tvMap = computePhysicalTravelVisuals(filteredSlotsByDay[day], day);
      for (const tv of Object.values(tvMap)) {
        if (tv.beforeMins > 0) {
          transitMins += tv.beforeMins;
          transitTrips += 1;
        }
        if (tv.afterMins > 0) {
          transitMins += tv.afterMins;
          transitTrips += 1;
        }
      }
    }

    const classPct = totalMins > 0 ? Math.round((classMins / totalMins) * 100) : 50;

    return {
      totalMins,
      classMins,
      studyMins,
      classPct,
      transitMins,
      transitTrips,
      perDayMins,
      visibleCount: filteredWeekSlots.length,
    };
  }, [filteredWeekSlots, filteredSlotsByDay]);

  const daySlots = filteredSlotsByDay[activeDay] ?? [];

  const dayTravelVisuals = useMemo(
    () => computePhysicalTravelVisuals(daySlots, activeDay),
    [daySlots, activeDay],
  );

  const activeDayTransitMins = useMemo(
    () =>
      Object.values(dayTravelVisuals).reduce(
        (acc, tv) => acc + tv.beforeMins + tv.afterMins,
        0,
      ),
    [dayTravelVisuals],
  );

  const resolvedPresetId = LEGACY_PRESET_MAP[selectedPresetId] ?? selectedPresetId;
  const selectedPreset =
    CLASS_PRESETS.find((c) => c.id === resolvedPresetId) ?? CLASS_PRESETS[0];

  const previewDuration = getDurationMinutes(startTime, endTime);
  const invalidTimeRange = previewDuration <= 0;

  const applyPresetDefaults = (presetId: string) => {
    const preset = CLASS_PRESETS.find((c) => c.id === presetId) ?? CLASS_PRESETS[0];
    setSelectedPresetId(preset.id);
    setClassMode(preset.defaultMode);
    setTravelBeforeMins(preset.defaultTravelBeforeMins);
    setTravelAfterMins(preset.defaultTravelAfterMins);
    setPlanReviseLoop(preset.supportsReviseLoop);
  };

  const openCreatorForDay = (day: DayOfWeek) => {
    haptics.tap();
    const targetDayDate = weekDays.find((d) => d.day === day)?.dateISO ?? getTodayISO();
    setEditingSlotId(null);
    setEditingSlotSpecificDate(undefined);
    setEditingLinkedTaskId(undefined);
    setEditingLinkedMissedId(undefined);
    setEditingIsCatchUp(false);
    setFormDay(day);
    setSpecificDateInput(targetDayDate);
    setRepeatScope(activeWeekOffset === 0 ? 'recurring' : 'one-off');
    setCategory('class');
    applyPresetDefaults(CLASS_PRESETS[0].id);
    setSelfSubject('biology');
    setSelfNote('');
    setStartTime('08:00');
    setEndTime('11:00');
    setAutoBlock(true);
    setClassDropdownOpen(false);
    setSheetOpen(true);
  };

  const openExistingSlot = (slot: TimetableSlot) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    haptics.tap();
    const fallbackWeekDate =
      weekDays.find((d) => d.day === slot.day)?.dateISO ?? getTodayISO();
    setEditingSlotId(slot.id);
    setEditingSlotSpecificDate(slot.specificDateISO);
    setEditingLinkedTaskId(slot.linkedTaskId);
    setEditingLinkedMissedId(slot.linkedMissedId);
    setEditingIsCatchUp(Boolean(slot.isCatchUpClass));
    setFormDay(slot.day);
    setRepeatScope(slot.specificDateISO ? 'one-off' : 'recurring');
    setSpecificDateInput(slot.specificDateISO ?? fallbackWeekDate);
    setCategory(slot.category);
    if (slot.category === 'class') {
      const mapped = LEGACY_PRESET_MAP[slot.classPresetId ?? ''] ?? slot.classPresetId ?? CLASS_PRESETS[0].id;
      const preset = CLASS_PRESETS.find((c) => c.id === mapped) ?? CLASS_PRESETS[0];
      setSelectedPresetId(preset.id);
      setClassMode(slot.mode ?? preset.defaultMode);
      setTravelBeforeMins(slot.travelBeforeMins ?? preset.defaultTravelBeforeMins);
      setTravelAfterMins(slot.travelAfterMins ?? preset.defaultTravelAfterMins);
      setPlanReviseLoop(false);
    } else {
      setSelfSubject(slot.subject);
      setSelfNote(slot.subtitle);
      setClassMode('online');
      setTravelBeforeMins(0);
      setTravelAfterMins(0);
      setPlanReviseLoop(false);
    }
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setAutoBlock(slot.autoBlock);
    setClassDropdownOpen(false);
    setSheetOpen(true);
  };

  const handleSaveSlot = () => {
    if (invalidTimeRange) return;
    haptics.success();

    const existingSlot = editingSlotId ? slots.find((s) => s.id === editingSlotId) : undefined;
    const isOneOff = repeatScope === 'one-off';
    const effectiveDay = isOneOff
      ? getDayOfWeek(parseISODateLocal(specificDateInput))
      : formDay;

    const slotPayload: TimetableSlot =
      category === 'class'
        ? {
            id: editingSlotId ?? `slot-${Date.now()}`,
            day: effectiveDay,
            startTime,
            endTime,
            category: 'class',
            subject: selectedPreset.subject,
            classPresetId: selectedPreset.id,
            title: selectedPreset.title,
            subtitle: selectedPreset.teacher.replace(/\s·\s(Online|Physical)$/, ''),
            autoBlock,
            mode: classMode,
            travelBeforeMins: classMode === 'physical' ? travelBeforeMins : 0,
            travelAfterMins: classMode === 'physical' ? travelAfterMins : 0,
            linkedTaskId: existingSlot?.linkedTaskId,
            specificDateISO: isOneOff ? specificDateInput : undefined,
            skippedDates: isOneOff ? undefined : existingSlot?.skippedDates,
            weekPattern: isOneOff ? undefined : existingSlot?.weekPattern,
            expiresAtISO: isOneOff ? undefined : existingSlot?.expiresAtISO,
            isCatchUpClass: existingSlot?.isCatchUpClass,
          }
        : {
            id: editingSlotId ?? `slot-${Date.now()}`,
            day: effectiveDay,
            startTime,
            endTime,
            category: 'self-study',
            subject: selfSubject,
            title: existingSlot?.linkedTaskId
              ? existingSlot.title
              : `Self-Study · ${SUBJECT_META[selfSubject].short}`,
            subtitle: selfNote.trim() || 'Focused revision block',
            autoBlock,
            mode: 'online',
            travelBeforeMins: 0,
            travelAfterMins: 0,
            linkedTaskId: existingSlot?.linkedTaskId,
            linkedMissedId: existingSlot?.linkedMissedId,
            revisionStage: existingSlot?.revisionStage,
            sourceClassSlotId: existingSlot?.sourceClassSlotId,
            specificDateISO: isOneOff ? specificDateInput : undefined,
            skippedDates: isOneOff ? undefined : existingSlot?.skippedDates,
          };

    if (editingSlotId) {
      onUpdateSlot(slotPayload);
    } else {
      onAddSlot(slotPayload, category === 'class' && planReviseLoop);
    }

    setActiveDay(effectiveDay);
    setSheetOpen(false);
  };

  const handleDeleteCurrentSlot = () => {
    if (!editingSlotId) return;
    haptics.tap();
    onDeleteSlot(editingSlotId);
    setSheetOpen(false);
  };

  // Touch-safe Physical Drag-and-Drop Controller (260ms long-press on touch, 6px drag on mouse)
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const handleSlotPointerDown = (
    e: ReactPointerEvent<HTMLElement>,
    slot: TimetableSlot,
    originDateISO: string,
    slotIndexCol: number,
    immediate = false,
  ) => {
    if (slot.rescheduleLocked) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragCleanupRef.current?.();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const isTouch = e.pointerType === 'touch';
    const startMin = toMinutes(slot.startTime);
    const durMin = Math.max(30, getDurationMinutes(slot.startTime, slot.endTime));

    const computeRelCoords = (cx: number, cy: number, gRect: DOMRect) => {
      if (isRotatedLandscapeRef.current) {
        return {
          relX: cy - gRect.top,
          relY: gRect.right - cx,
          logicalWidth: gRect.height,
        };
      }
      return {
        relX: cx - gRect.left,
        relY: cy - gRect.top,
        logicalWidth: gRect.width,
      };
    };

    let grabOffsetMins = Math.min(durMin / 2, 30);
    const gridRect = gridBodyRef.current?.getBoundingClientRect();
    if (gridRect) {
      const { relY } = computeRelCoords(startClientX, startClientY, gridRect);
      const pointerMin = (relY / (24 * HOUR_HEIGHT)) * 1440;
      grabOffsetMins = Math.max(0, Math.min(durMin - 15, pointerMin - startMin));
    }

    let activated = false;
    let arrowTimer: number | null = null;
    let currentHoveredArrow: 'prev' | 'next' | null = null;

    const activateDrag = () => {
      if (activated) return;
      activated = true;
      suppressNextClickRef.current = true;
      onDragActiveChange?.(true);
      haptics.tap();
      const snappedStart = Math.max(0, Math.min(1440 - durMin, Math.round(startMin / 15) * 15));
      const initial: ActiveDragState = {
        slot,
        originDateISO,
        durMin,
        grabOffsetMins,
        targetColIdx: slotIndexCol,
        targetStartMin: snappedStart,
        hoverArrow: null,
      };
      activeDragRef.current = initial;
      setActiveDrag(initial);
    };

    if (immediate) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
      activateDrag();
    }

    const longPressTimer =
      isTouch && !immediate
        ? window.setTimeout(() => {
            activateDrag();
          }, 260)
        : null;

    const clearArrowTimer = () => {
      if (arrowTimer !== null) {
        window.clearInterval(arrowTimer);
        arrowTimer = null;
      }
      currentHoveredArrow = null;
    };

    const hitTestArrow = (x: number, y: number): 'prev' | 'next' | null => {
      const prevRect = prevWeekBtnRef.current?.getBoundingClientRect();
      if (
        prevRect &&
        x >= prevRect.left - 12 &&
        x <= prevRect.right + 12 &&
        y >= prevRect.top - 12 &&
        y <= prevRect.bottom + 12
      ) {
        return 'prev';
      }
      const nextRect = nextWeekBtnRef.current?.getBoundingClientRect();
      if (
        nextRect &&
        x >= nextRect.left - 12 &&
        x <= nextRect.right + 12 &&
        y >= nextRect.top - 12 &&
        y <= nextRect.bottom + 12
      ) {
        return 'next';
      }
      return null;
    };

    const onWindowMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      const dist = Math.hypot(dx, dy);

      if (!activated) {
        if (isTouch) {
          if (dist > 14 && longPressTimer !== null) {
            window.clearTimeout(longPressTimer);
            cleanup();
          }
          return;
        } else {
          if (dist < 6) return;
          activateDrag();
        }
      }

      if (ev.cancelable) ev.preventDefault();

      // Auto-scroll container when dragging near vertical edge on mobile
      const scroller = gridScrollRef.current;
      if (scroller) {
        const sRect = scroller.getBoundingClientRect();
        if (isRotatedLandscapeRef.current) {
          if (ev.clientX > sRect.right - 44) scroller.scrollTop -= 12;
          else if (ev.clientX < sRect.left + 44) scroller.scrollTop += 12;
        } else {
          if (ev.clientY < sRect.top + 48) scroller.scrollTop -= 12;
          else if (ev.clientY > sRect.bottom - 48) scroller.scrollTop += 12;
        }
      }

      const cur = activeDragRef.current;
      const gRect = gridBodyRef.current?.getBoundingClientRect();
      if (!cur || !gRect) return;

      const { relX, relY, logicalWidth } = computeRelCoords(ev.clientX, ev.clientY, gRect);
      const colAreaWidth = Math.max(1, logicalWidth - 64);
      const rawCol = Math.floor(((relX - 64) / colAreaWidth) * 7);
      const targetColIdx = Math.max(0, Math.min(6, rawCol));

      const rawMin = (relY / (24 * HOUR_HEIGHT)) * 1440 - cur.grabOffsetMins;
      const snappedStart = Math.round(rawMin / 15) * 15;
      const targetStartMin = Math.max(0, Math.min(1440 - cur.durMin, snappedStart));

      const hoveredArrow = hitTestArrow(ev.clientX, ev.clientY);
      if (hoveredArrow !== currentHoveredArrow) {
        clearArrowTimer();
        currentHoveredArrow = hoveredArrow;
        if (hoveredArrow) {
          const step = hoveredArrow === 'prev' ? -1 : 1;
          arrowTimer = window.setInterval(() => {
            haptics.tick();
            setWeekOffsetRef.current(activeWeekOffsetRef.current + step);
          }, 560);
        }
      }

      const nextDrag: ActiveDragState = {
        ...cur,
        targetColIdx,
        targetStartMin,
        hoverArrow: hoveredArrow,
      };
      activeDragRef.current = nextDrag;
      setActiveDrag(nextDrag);
    };

    const cleanup = () => {
      if (longPressTimer !== null) window.clearTimeout(longPressTimer);
      clearArrowTimer();
      onDragActiveChange?.(false);
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowCancel);
      dragCleanupRef.current = null;
    };

    const finishDrop = (cancelled: boolean) => {
      const finalDrag = activeDragRef.current;
      activeDragRef.current = null;
      setActiveDrag(null);
      cleanup();

      if (cancelled || !activated || !finalDrag) {
        return;
      }

      const targetDayInfo = weekDaysRef.current[finalDrag.targetColIdx];
      if (!targetDayInfo) return;

      const newStartTime = minutesToHHMM(finalDrag.targetStartMin);
      const newEndTime = minutesToHHMM(finalDrag.targetStartMin + finalDrag.durMin);

      if (
        targetDayInfo.dateISO === finalDrag.originDateISO &&
        newStartTime === finalDrag.slot.startTime
      ) {
        return;
      }

      if (finalDrag.slot.specificDateISO) {
        haptics.success();
        onUpdateSlot({
          ...finalDrag.slot,
          day: targetDayInfo.day,
          specificDateISO: targetDayInfo.dateISO,
          startTime: newStartTime,
          endTime: newEndTime,
        });
      } else {
        haptics.tap();
        setPendingRecurringDrop({
          slot: finalDrag.slot,
          originDateISO: finalDrag.originDateISO,
          targetDay: targetDayInfo.day,
          targetDateISO: targetDayInfo.dateISO,
          newStartTime,
          newEndTime,
        });
      }
    };

    const onWindowUp = () => finishDrop(false);
    const onWindowCancel = () => finishDrop(true);

    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onWindowMove, { passive: false });
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowCancel);
  };

  const nowLineTopPx = (nowMinutes / 60) * HOUR_HEIGHT;
  const nowTimeHHMM = `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(
    nowMinutes % 60,
  ).padStart(2, '0')}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#07142B] dark:text-white">
            Timetable
          </h1>
          <p className="mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
            {slots.length === 0
              ? '24h schedule · online & 2h physical transit aware'
              : 'Hold & drag any slot to reschedule · tap to edit or plan revise loops'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="ios-glass relative grid grid-cols-2 items-center rounded-full p-1">
            {(['grid', 'day'] as const).map((mode) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setViewMode(mode);
                  }}
                  className={`min-h-[34px] rounded-full px-3.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/80'
                  }`}
                >
                  {mode === 'grid' ? 'Week Grid' : 'Day List'}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setHorizontalOpen(true);
            }}
            aria-label="Open horizontal full-screen timetable"
            title="Horizontal Full-Screen Timetable"
            className="ios-glass inline-flex h-[40px] w-[40px] items-center justify-center rounded-full text-blue-700 transition-transform duration-100 active:scale-90 dark:text-cyan-200 shrink-0"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => openCreatorForDay(activeDay)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Slot</span>
          </button>
        </div>
      </div>

      {/* Unlimited Multi-Week Calendar Navigator Bar */}
      <div className="ios-glass mt-4 flex items-center justify-between gap-2 rounded-full px-2 py-1.5">
        <button
          ref={prevWeekBtnRef}
          type="button"
          onClick={() => {
            haptics.tick();
            setWeekOffset(activeWeekOffset - 1);
          }}
          aria-label="Previous week"
          className={`ios-glass-control inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white ${
            activeDrag?.hoverArrow === 'prev' ? 'scale-105 ring-2 ring-cyan-400' : ''
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2 text-center">
          <span className="truncate text-xs font-bold text-[#07142B] dark:text-white sm:text-sm">
            {weekRangeLabel}
          </span>
          <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-blue-700 dark:bg-sky-400/20 dark:text-cyan-200">
            {weekOffsetLabel}
          </span>
          {activeWeekOffset !== 0 && (
            <button
              type="button"
              onClick={() => {
                haptics.tick();
                setWeekOffset(0);
              }}
              className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10.5px] font-semibold text-white shadow-sm transition-transform duration-100 active:scale-95 dark:bg-blue-500"
            >
              This Week
            </button>
          )}
        </div>

        <button
          ref={nextWeekBtnRef}
          type="button"
          onClick={() => {
            haptics.tick();
            setWeekOffset(activeWeekOffset + 1);
          }}
          aria-label="Next week"
          className={`ios-glass-control inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white ${
            activeDrag?.hoverArrow === 'next' ? 'scale-105 ring-2 ring-cyan-400' : ''
          }`}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Live Physical Drag-and-Drop HUD */}
      {activeDrag && (
        <div className="ios-glass-strong mt-2.5 flex items-center justify-between gap-3 rounded-full border border-cyan-400/50 px-4 py-2 text-xs shadow-lg">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${SUBJECT_META[activeDrag.slot.subject].bar}`} />
            <p className="truncate font-semibold text-[#07142B] dark:text-white">
              Moving {activeDrag.slot.title} → {weekDays[activeDrag.targetColIdx]?.day}{' '}
              {weekDays[activeDrag.targetColIdx]?.shortDate} ·{' '}
              {formatTime12h(minutesToHHMM(activeDrag.targetStartMin))}
            </p>
          </div>
          <span className="hidden shrink-0 text-[10.5px] font-medium text-blue-700 dark:text-cyan-300 sm:inline">
            Drag onto Prev/Next to switch weeks
          </span>
        </div>
      )}

      {/* Skipped This Week Notice & Quick Restore */}
      {skippedThisWeek.length > 0 && (
        <div className="ios-glass mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-[22px] px-4 py-2 text-xs">
          <span className="font-medium text-[#0B234A]/80 dark:text-sky-100/85">
            {skippedThisWeek.length} recurring{' '}
            {skippedThisWeek.length === 1 ? 'slot' : 'slots'} skipped this week:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {skippedThisWeek.map(({ slot: skSlot, dateISO }) => (
              <button
                key={`restore-${skSlot.id}-${dateISO}`}
                type="button"
                onClick={() => {
                  haptics.tick();
                  onRestoreSkippedSlotForDate?.(skSlot.id, dateISO);
                }}
                className="ios-glass-control inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition-transform duration-100 active:scale-95 dark:text-cyan-300"
              >
                <RotateCcw className="h-3 w-3" />
                <span>
                  Restore {skSlot.title} ({formatShortDateISO(dateISO)})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Load Telemetry & Strict Dual Filter Row */}
      <section className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="grid grid-cols-3 gap-2.5 lg:col-span-7">
          {/* Card 1: Total Weekly Load */}
          <div className="ios-glass-tile flex flex-col justify-between rounded-[26px] p-3.5 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700/80 dark:text-cyan-300/85">
              {isFilterActive ? 'Filtered Load' : 'Weekly Load'}
            </p>
            <div className="mt-2">
              <p className="tabular-nums text-lg font-bold text-[#07142B] dark:text-white sm:text-xl">
                {formatDuration(weeklyTelemetry.totalMins)}
              </p>
              <p className="tabular-nums text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                {weeklyTelemetry.visibleCount}
                {isFilterActive ? ` of ${allWeekSlots.length}` : ''} slots
              </p>
            </div>
          </div>

          {/* Card 2: Class vs Self-Study Balance */}
          <div className="ios-glass-tile flex flex-col justify-between rounded-[26px] p-3.5 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700/80 dark:text-cyan-300/85">
              Class / Study
            </p>
            <div className="mt-2">
              <p className="tabular-nums text-sm font-bold text-[#07142B] dark:text-white sm:text-base">
                {formatDuration(weeklyTelemetry.classMins)} · {formatDuration(weeklyTelemetry.studyMins)}
              </p>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-cyan-400/25">
                <div
                  className="h-full bg-blue-600 transition-[width] duration-300 dark:bg-blue-400"
                  style={{ width: `${weeklyTelemetry.classPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Unlocked Physical Transit */}
          <div className="ios-glass-tile flex flex-col justify-between rounded-[26px] p-3.5 sm:p-4">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
              <Navigation className="h-2.5 w-2.5" />
              <span>Transit</span>
            </p>
            <div className="mt-2">
              <p className="tabular-nums text-lg font-bold text-[#07142B] dark:text-white sm:text-xl">
                {formatDuration(weeklyTelemetry.transitMins)}
              </p>
              <p className="text-[11px] text-cyan-700 dark:text-cyan-300/85">
                {weeklyTelemetry.transitTrips} trips · unlocked
              </p>
            </div>
          </div>
        </div>

        {/* Right: Strict Dual Timetable Filter (Subjects × Classes/Self-Study) + Friday Cycle */}
        <div className="ios-glass-tile flex flex-col justify-between gap-2.5 rounded-[26px] p-3.5 sm:p-4 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700/80 dark:text-cyan-300/85">
              Filter Timetable
            </p>
            <div className="flex items-center gap-2">
              {isFilterActive && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setCategoryFilter('all');
                    setSubjectFilter('all');
                  }}
                  className="rounded-full bg-blue-600/15 px-2.5 py-0.5 text-[10.5px] font-bold text-blue-700 hover:bg-blue-600/25 dark:bg-cyan-400/18 dark:text-cyan-200"
                >
                  {weeklyTelemetry.visibleCount}/{allWeekSlots.length} · Reset
                </button>
              )}
              {onResetCleanSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onResetCleanSchedule();
                  }}
                  title="Restore default class timetable"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 hover:underline dark:text-cyan-300"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  <span>Reset Slots</span>
                </button>
              )}
            </div>
          </div>

          {/* Row A: Category Filter (All | Classes | Self-Study) */}
          <div className="ios-glass-control relative grid grid-cols-3 gap-1 rounded-full p-1">
            {(
              [
                { id: 'all', label: 'All Types' },
                { id: 'class', label: 'Classes' },
                { id: 'self-study', label: 'Self-Study' },
              ] as const
            ).map((cat) => {
              const active = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setCategoryFilter(cat.id);
                  }}
                  className={`min-h-[28px] rounded-full text-[11px] font-semibold transition-colors duration-150 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/80'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Row B: Subject Filter (All | Bio | Phy | Chem) */}
          <div className="ios-glass-control relative grid grid-cols-4 gap-1 rounded-full p-1">
            {(['all', 'biology', 'physics', 'chemistry'] as const).map((sub) => {
              const active = subjectFilter === sub;
              const label = sub === 'all' ? 'All Subj' : SUBJECT_META[sub].short;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setSubjectFilter(sub);
                  }}
                  className={`inline-flex min-h-[28px] items-center justify-center gap-1.5 rounded-full text-[11px] font-semibold transition-colors duration-150 ${
                    active
                      ? sub === 'all'
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : SPOTLIGHT_ACTIVE_STYLE[sub]
                      : sub === 'all'
                        ? 'text-[#0B234A]/75 dark:text-sky-200/80'
                        : SUBJECT_META[sub].text
                  }`}
                >
                  {sub !== 'all' && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        active ? 'bg-white' : SUBJECT_META[sub].bar
                      }`}
                    />
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {onChangeFridayModeForWeek && (
            <div className="space-y-1">
              <div className="ios-glass-control grid grid-cols-2 gap-1 rounded-full p-1">
                {(
                  [
                    { id: 'bio-week', label: 'Fri: Bio 8–12 + Chem 12–3' },
                    { id: 'chem-only-week', label: 'Fri: Chem Only 8–12' },
                  ] as { id: FridayWeekMode; label: string }[]
                ).map((m) => {
                  const active = effectiveFridayMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        haptics.tick();
                        onChangeFridayModeForWeek(weekMondayISO, m.id);
                      }}
                      className={`min-h-[28px] truncate rounded-full px-2 text-[10.5px] font-semibold transition-colors duration-150 ${
                        active
                          ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                          : 'text-[#0B234A]/75 dark:text-sky-200/80'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between px-1 text-[10px] text-[#0B234A]/65 dark:text-sky-200/70">
                <span>
                  {isFridayOverridden
                    ? 'Manual override for this Friday'
                    : 'Auto-alternating bi-weekly Friday'}
                </span>
                {isFridayOverridden && onResetFridayOverrideForWeek && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      onResetFridayOverrideForWeek(weekMondayISO);
                    }}
                    className="font-semibold text-blue-700 hover:underline dark:text-cyan-300"
                  >
                    Use Auto
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {horizontalOpen && (
        <div className="fixed inset-0 z-[80] overflow-hidden bg-[#CFE3FF] dark:bg-[#02071A]">
          <div
            style={
              isPortraitViewport
                ? {
                    position: 'fixed',
                    top: 0,
                    left: '100vw',
                    width: '100dvh',
                    height: '100dvw',
                    transform: 'rotate(90deg)',
                    transformOrigin: 'top left',
                  }
                : undefined
            }
            className={`flex flex-col ${
              isPortraitViewport ? '' : 'h-full w-full'
            } p-2.5 sm:p-3`}
          >
            {/* Compact Landscape Toolbar */}
            <div className="ios-glass mb-2 flex flex-wrap items-center justify-between gap-2 rounded-full px-3 py-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setHorizontalOpen(false);
                  }}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-full bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm dark:bg-blue-500"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>Exit</span>
                </button>
                <span className="truncate text-xs font-bold text-[#07142B] dark:text-white">
                  {weekRangeLabel} · {weekOffsetLabel}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setWeekOffset(activeWeekOffset - 1);
                  }}
                  aria-label="Previous week"
                  className="ios-glass-control inline-flex h-8 w-8 items-center justify-center rounded-full text-[#07142B] dark:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setWeekOffset(activeWeekOffset + 1);
                  }}
                  aria-label="Next week"
                  className="ios-glass-control inline-flex h-8 w-8 items-center justify-center rounded-full text-[#07142B] dark:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {(['all', 'biology', 'physics', 'chemistry'] as const).map((sub) => (
                  <button
                    key={`h-${sub}`}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setSubjectFilter(sub);
                    }}
                    className={`min-h-[30px] rounded-full px-2.5 text-[10.5px] font-semibold ${
                      subjectFilter === sub
                        ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-[#04143B]'
                        : 'ios-glass-control text-[#0B234A] dark:text-sky-100'
                    }`}
                  >
                    {sub === 'all' ? 'All' : SUBJECT_META[sub].short}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => openCreatorForDay(activeDay)}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-3 text-[11px] font-semibold text-white"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Horizontal 7-Column Grid Container */}
            <div className="ios-glass-hero flex-1 overflow-hidden rounded-[26px]">
              <div
                ref={horizontalOpen ? gridScrollRef : undefined}
                className={`h-full no-scrollbar ${
                  activeDrag ? 'overflow-hidden touch-none' : 'overflow-auto'
                }`}
              >
                <div className="min-w-[700px]">
                  <div className="sticky top-0 z-20 grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-white/40 bg-[#E0EDFF]/95 dark:border-sky-300/15 dark:bg-[#061A4A]/95">
                    <div className="flex flex-col items-center justify-center py-2 text-[10px] font-medium text-[#0B234A]/60 dark:text-sky-200/60">
                      <span>24h</span>
                    </div>
                    {weekDays.map((wd) => (
                      <button
                        key={`hz-hdr-${wd.dateISO}`}
                        type="button"
                        onClick={() => openCreatorForDay(wd.day)}
                        className={`mx-1 my-1 flex flex-col items-center justify-center rounded-[14px] py-1 text-center ${
                          wd.isToday
                            ? 'bg-blue-500/20 text-blue-700 dark:bg-cyan-400/20 dark:text-cyan-200'
                            : 'text-[#07142B] dark:text-sky-50'
                        }`}
                      >
                        <span className="text-[11px] font-bold">
                          {wd.day} {wd.dateNum}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div
                    ref={horizontalOpen ? gridBodyRef : undefined}
                    className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
                    style={{ height: `${(GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT}px` }}
                  >
                    <div className="relative border-r border-white/30 dark:border-sky-300/10">
                      {hours.slice(0, -1).map((hour, i) => (
                        <div
                          key={`hz-hr-${hour}`}
                          style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                          className="tabular-nums absolute left-0 right-0 pr-2 pt-1 text-right text-[10px] text-[#0B234A]/60 dark:text-sky-200/60"
                        >
                          {String(hour).padStart(2, '0')}:00
                        </div>
                      ))}
                    </div>

                    {weekDays.map((wd, colIdx) => {
                      const colSlots = filteredSlotsByDay[wd.day] ?? [];
                      const completedIdsForDay = dailyLogs[wd.dateISO]?.completedSlotIds ?? [];
                      const isGhostInThisCol = activeDrag && activeDrag.targetColIdx === colIdx;

                      return (
                        <div
                          key={`hz-col-${wd.dateISO}`}
                          className={`timetable-grid-lines relative border-r border-white/25 last:border-r-0 dark:border-sky-300/[0.07] ${
                            wd.isToday ? 'bg-blue-400/[0.06] dark:bg-cyan-400/[0.04]' : ''
                          } ${isGhostInThisCol ? 'bg-cyan-400/[0.06]' : ''}`}
                        >
                          {isGhostInThisCol && activeDrag && (
                            <div
                              aria-hidden="true"
                              style={{
                                top: `${Math.max(2, (activeDrag.targetStartMin / 60) * HOUR_HEIGHT + 1)}px`,
                                height: `${Math.max(24, (activeDrag.durMin / 60) * HOUR_HEIGHT - 2)}px`,
                              }}
                              className={`pointer-events-none absolute left-1 right-1 z-30 overflow-hidden rounded-[16px] border-2 border-dashed border-cyan-400 py-1 px-2.5 shadow-xl ${
                                GLASS_SUBJECT_BLOCK[activeDrag.slot.subject]
                              }`}
                            >
                              <p className="truncate text-[10.5px] font-bold">{activeDrag.slot.title}</p>
                            </div>
                          )}

                          {colSlots.map((slot) => {
                            const startMin = toMinutes(slot.startTime);
                            const durMin = Math.max(25, getDurationMinutes(slot.startTime, slot.endTime));
                            const topPx = ((startMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT;
                            const heightPx = (durMin / 60) * HOUR_HEIGHT;
                            const subj = SUBJECT_META[slot.subject];
                            const isSlotDone = completedIdsForDay.includes(slot.id);
                            return (
                              <div
                                key={`hz-slot-${slot.id}`}
                                style={{
                                  top: `${Math.max(2, topPx + 1)}px`,
                                  height: `${Math.max(24, heightPx - 2)}px`,
                                }}
                                onClick={() => openExistingSlot(slot)}
                                onContextMenu={(e) => e.preventDefault()}
                                className={`absolute left-1 right-1 flex flex-col overflow-hidden rounded-[16px] py-1 pl-3 pr-1.5 text-left select-none ${
                                  GLASS_SUBJECT_BLOCK[slot.subject]
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`absolute bottom-1.5 left-1 top-1.5 w-1 rounded-full ${subj.bar}`}
                                />
                                <div className="flex items-start justify-between gap-1">
                                  <p className="truncate text-[10.5px] font-bold leading-tight">
                                    {slot.title}
                                  </p>
                                  {!slot.rescheduleLocked && (
                                    <button
                                      type="button"
                                      aria-label={`Drag ${slot.title}`}
                                      onClick={(e) => e.stopPropagation()}
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        handleSlotPointerDown(e, slot, wd.dateISO, colIdx, true);
                                      }}
                                      className="touch-none shrink-0 rounded p-0.5 text-current opacity-65 hover:opacity-100"
                                    >
                                      <GripVertical className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                                {heightPx >= 44 && (
                                  <p className="tabular-nums truncate text-[9.5px] opacity-80">
                                    {slot.startTime}–{slot.endTime} {isSlotDone ? '· ✓' : ''}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="ios-glass-hero mt-4 overflow-hidden rounded-[34px]">
            <div
              ref={!horizontalOpen ? gridScrollRef : undefined}
              className={`max-h-[68vh] no-scrollbar ${
                activeDrag ? 'overflow-hidden touch-none' : 'overflow-auto'
              }`}
            >
              <div className="min-w-[820px]">
                <div className="sticky top-0 z-20 grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-white/40 bg-[#E0EDFF]/95 dark:border-sky-300/15 dark:bg-[#061A4A]/95">
                  <div className="flex flex-col items-center justify-center py-3 text-[11px] font-medium text-[#0B234A]/60 dark:text-sky-200/60">
                    <span>24h</span>
                  </div>
                  {weekDays.map((wd) => {
                    const dayMins = weeklyTelemetry.perDayMins[wd.day];
                    return (
                      <button
                        key={wd.dateISO}
                        type="button"
                        onClick={() => openCreatorForDay(wd.day)}
                        className={`mx-1 my-1.5 flex flex-col items-center justify-center rounded-[18px] py-1.5 text-center transition-colors hover:bg-white/35 dark:hover:bg-blue-400/15 ${
                          wd.isToday
                            ? 'bg-blue-500/20 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:bg-cyan-400/20 dark:text-cyan-200'
                            : 'text-[#07142B] dark:text-sky-50'
                        }`}
                      >
                        <span className="flex items-center gap-1 text-xs font-semibold">
                          {wd.isToday && (
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-300" />
                          )}
                          <span>
                            {wd.day} {wd.dateNum}
                          </span>
                        </span>
                        <span className="tabular-nums text-[10px] font-medium opacity-70">
                          {formatMinutesCompact(dayMins)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div
                  ref={!horizontalOpen ? gridBodyRef : undefined}
                  className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
                  style={{ height: `${(GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT}px` }}
                >
                  <div className="relative border-r border-white/30 dark:border-sky-300/10">
                    {hours.slice(0, -1).map((hour, i) => (
                      <div
                        key={hour}
                        style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                        className="tabular-nums absolute left-0 right-0 pr-2 pt-1 text-right text-[11px] text-[#0B234A]/60 dark:text-sky-200/60"
                      >
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                    <div className="tabular-nums absolute bottom-0.5 left-0 right-0 pr-2 text-right text-[10px] text-[#0B234A]/50 dark:text-sky-200/50">
                      24:00
                    </div>
                  </div>

                  {weekDays.map((wd, colIdx) => {
                    const colSlots = filteredSlotsByDay[wd.day] ?? [];
                    const travelVisuals = computePhysicalTravelVisuals(colSlots, wd.day);
                    const isTodayCol = wd.isToday;
                    const completedIdsForDay = dailyLogs[wd.dateISO]?.completedSlotIds ?? [];
                    const isGhostInThisCol = activeDrag && activeDrag.targetColIdx === colIdx;

                    return (
                      <div
                        key={wd.dateISO}
                        className={`timetable-grid-lines relative border-r border-white/25 last:border-r-0 dark:border-sky-300/[0.07] ${
                          isTodayCol ? 'bg-blue-400/[0.06] dark:bg-cyan-400/[0.04]' : ''
                        } ${isGhostInThisCol ? 'bg-cyan-400/[0.06]' : ''}`}
                      >

                        {/* Live Current Time Crystal Beam with Pulsing Beacon & Timestamp */}
                        {isTodayCol && (
                          <div
                            aria-hidden="true"
                            style={{ top: `${nowLineTopPx}px` }}
                            className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                          >
                            <span className="animate-beacon -ml-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.98)]" />
                            <span className="tabular-nums ml-1 rounded-full bg-cyan-400/90 px-1.5 py-0.5 text-[9px] font-bold text-[#041434] shadow-sm">
                              {formatTime12h(nowTimeHHMM)}
                            </span>
                            <div className="h-[1.5px] flex-1 bg-gradient-to-r from-cyan-400 to-blue-400/35" />
                          </div>
                        )}

                        {/* Diagonal Transit-Hatch Commute Wings (Phone Lock Always Off) */}
                        {colSlots.map((slot) => {
                          const tv = travelVisuals[slot.id];
                          if (!tv) return null;
                          const slotStartMin = toMinutes(slot.startTime);
                          const slotDurMin = getDurationMinutes(slot.startTime, slot.endTime);
                          const slotEndMin = slotStartMin + slotDurMin;

                          return (
                            <div key={`tv-${slot.id}`}>
                              {tv.beforeStartMin !== null && tv.beforeMins > 0 && (
                                <div
                                  style={{
                                    top: `${(tv.beforeStartMin / 60) * HOUR_HEIGHT}px`,
                                    height: `${(tv.beforeMins / 60) * HOUR_HEIGHT}px`,
                                  }}
                                  className="transit-hatch pointer-events-none absolute left-1.5 right-1.5 flex items-center justify-center rounded-t-[14px] border border-dashed border-sky-400/55 px-1.5 text-center dark:border-sky-300/35"
                                >
                                  <span className="truncate text-[9px] font-semibold text-sky-900/80 dark:text-sky-100/85">
                                    {formatDuration(tv.beforeMins)} commute · open
                                  </span>
                                </div>
                              )}

                              {tv.afterEndMin !== null && tv.afterMins > 0 && (
                                <div
                                  style={{
                                    top: `${(slotEndMin / 60) * HOUR_HEIGHT}px`,
                                    height: `${((tv.afterEndMin - slotEndMin) / 60) * HOUR_HEIGHT}px`,
                                  }}
                                  className="transit-hatch pointer-events-none absolute left-1.5 right-1.5 flex items-center justify-center rounded-b-[14px] border border-dashed border-sky-400/55 px-1.5 text-center dark:border-sky-300/35"
                                >
                                  <span className="truncate text-[9px] font-semibold text-sky-900/80 dark:text-sky-100/85">
                                    {formatDuration(tv.afterMins)} return · open
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Physical Drag-and-Drop Snap Target Ghost */}
                        {isGhostInThisCol && activeDrag && (
                          <div
                            aria-hidden="true"
                            style={{
                              top: `${Math.max(2, (activeDrag.targetStartMin / 60) * HOUR_HEIGHT + 1)}px`,
                              height: `${Math.max(24, (activeDrag.durMin / 60) * HOUR_HEIGHT - 2)}px`,
                            }}
                            className={`pointer-events-none absolute left-1 right-1 z-30 overflow-hidden rounded-[18px] border-2 border-dashed border-cyan-400 py-1.5 pl-3.5 pr-2 shadow-xl ${
                              GLASS_SUBJECT_BLOCK[activeDrag.slot.subject]
                            }`}
                          >
                            <span
                              className={`absolute bottom-1.5 left-1.5 top-1.5 w-1 rounded-full ${
                                SUBJECT_META[activeDrag.slot.subject].bar
                              }`}
                            />
                            <p className="truncate text-[11px] font-bold">
                              {activeDrag.slot.title}
                            </p>
                            <p className="tabular-nums truncate text-[10px] font-semibold text-cyan-700 dark:text-cyan-200">
                              {formatTime12h(minutesToHHMM(activeDrag.targetStartMin))} –{' '}
                              {formatTime12h(
                                minutesToHHMM(activeDrag.targetStartMin + activeDrag.durMin),
                              )}
                            </p>
                          </div>
                        )}

                        {colSlots.map((slot) => {
                          const startMin = toMinutes(slot.startTime);
                          const durMin = Math.max(25, getDurationMinutes(slot.startTime, slot.endTime));
                          const topPx = ((startMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT;
                          const heightPx = (durMin / 60) * HOUR_HEIGHT;
                          const compact = durMin <= 45;
                          const subj = SUBJECT_META[slot.subject];
                          const isBeingDragged =
                            activeDrag?.slot.id === slot.id &&
                            activeDrag?.originDateISO === wd.dateISO;
                          const isSlotDone = completedIdsForDay.includes(slot.id);

                          return (
                            <div
                              key={slot.id}
                              role="button"
                              tabIndex={0}
                              onPointerDown={(e) =>
                                handleSlotPointerDown(e, slot, wd.dateISO, colIdx, false)
                              }
                              onContextMenu={(e) => e.preventDefault()}
                              onClick={() => openExistingSlot(slot)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') openExistingSlot(slot);
                              }}
                              style={{
                                top: `${Math.max(2, topPx + 1)}px`,
                                height: `${Math.max(24, heightPx - 2)}px`,
                                WebkitTouchCallout: 'none',
                              }}
                              className={`absolute left-1 right-1 cursor-pointer select-none overflow-hidden rounded-[18px] py-1.5 pl-3.5 pr-1.5 text-left transition-opacity duration-150 active:scale-[0.98] ${
                                GLASS_SUBJECT_BLOCK[slot.subject]
                              } ${isBeingDragged ? 'border-dashed opacity-30' : 'opacity-100'}`}
                            >
                              <span
                                aria-hidden="true"
                                className={`absolute bottom-1.5 left-1.5 top-1.5 w-1 rounded-full ${subj.bar}`}
                              />
                              <div className="flex items-start justify-between gap-1">
                                <p className="truncate text-[11px] font-semibold leading-tight">
                                  <span className={`font-bold ${subj.text}`}>{subj.short}</span>
                                  {' · '}
                                  {slot.revisionStage ? `${slot.revisionStage.toUpperCase()} · ` : ''}
                                  {slot.title}
                                </p>
                                <div className="flex shrink-0 items-center gap-0.5">
                                  {isSlotDone && (
                                    <Check className="mt-0.5 h-2.5 w-2.5 text-emerald-600 dark:text-emerald-300" />
                                  )}
                                  {slot.isRescueSlot && (
                                    <span className="rounded-full bg-amber-500/25 px-1 text-[8px] font-bold text-amber-800 dark:text-amber-200">
                                      1xR
                                    </span>
                                  )}
                                  {slot.rescheduleLocked && (
                                    <span className="rounded-full bg-rose-500/25 px-1 text-[8px] font-bold text-rose-700 dark:text-rose-200">
                                      LOCK
                                    </span>
                                  )}
                                  {slot.specificDateISO && !slot.isRescueSlot && (
                                    <span className="rounded-full bg-white/40 px-1 text-[8.5px] font-bold leading-tight dark:bg-blue-400/20">
                                      1x
                                    </span>
                                  )}
                                  {slot.autoBlock && (
                                    <Lock className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-75" />
                                  )}
                                  {!slot.rescheduleLocked && (
                                    <span
                                      aria-label={`Drag handle for ${slot.title}`}
                                      onClick={(e) => e.stopPropagation()}
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        handleSlotPointerDown(e, slot, wd.dateISO, colIdx, true);
                                      }}
                                      className="touch-none -mr-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md opacity-70 hover:bg-white/25 hover:opacity-100"
                                    >
                                      <GripVertical className="h-3 w-3" />
                                    </span>
                                  )}
                                </div>
                              </div>
                              {!compact && (
                                <p className="mt-0.5 truncate text-[10px] opacity-85">
                                  {slot.subtitle}
                                </p>
                              )}
                              {heightPx >= 54 && (
                                <p className="tabular-nums mt-0.5 text-[10px] opacity-75">
                                  {slot.startTime}–{slot.endTime}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            {/* Day Selector Ribbon with Scheduled Load Dots */}
            <div className="ios-glass relative grid grid-cols-7 gap-1 rounded-[26px] p-1.5">
              {weekDays.map((wd) => {
                const active = activeDay === wd.day;
                const hasSlots = weeklyTelemetry.perDayMins[wd.day] > 0;
                return (
                  <button
                    key={wd.dateISO}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setActiveDay(wd.day);
                    }}
                    className={`flex min-h-[48px] flex-col items-center justify-center rounded-[20px] text-xs font-semibold transition-colors duration-150 active:scale-95 ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : 'text-[#0B234A]/75 dark:text-sky-200/80'
                    }`}
                  >
                    <span className="text-[10px] opacity-80">{wd.day}</span>
                    <span className="tabular-nums text-xs font-bold">{wd.dateNum}</span>
                    {hasSlots && (
                      <span
                        className={`mt-0.5 h-1 w-1 rounded-full ${
                          active ? 'bg-cyan-200' : 'bg-blue-500/70 dark:bg-cyan-300/75'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Day Agenda Summary */}
            <div className="ios-glass mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[22px] px-4 py-3 text-xs">
              <span className="font-semibold text-[#07142B] dark:text-white">
                {activeDay} {weekDays.find((d) => d.day === activeDay)?.shortDate} ·{' '}
                {formatMinutesCompact(weeklyTelemetry.perDayMins[activeDay])} planned
              </span>
              <span className="tabular-nums text-[#0B234A]/70 dark:text-sky-200/75">
                {daySlots.length} {daySlots.length === 1 ? 'session' : 'sessions'}
                {activeDayTransitMins > 0 &&
                  ` · ${formatDuration(activeDayTransitMins)} unlocked transit`}
              </span>
            </div>

            {daySlots.length === 0 ? (
              <div className="ios-glass mt-4 rounded-[28px] px-6 py-10 text-center">
                <p className="text-sm font-semibold text-[#07142B] dark:text-white">
                  {isFilterActive
                    ? `No matching slots on ${activeDay}`
                    : `No slots on ${activeDay}`}
                </p>
                <p className="mt-1 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                  {isFilterActive
                    ? 'Clear your Timetable filter above to view hidden slots.'
                    : 'Tap Add Slot to schedule a class or self-study block.'}
                </p>
              </div>
            ) : (
              <div
                key={activeDay}
                className="relative mt-4 space-y-2.5 pl-4 before:absolute before:bottom-4 before:left-1.5 before:top-4 before:w-[2px] before:rounded-full before:bg-gradient-to-b before:from-blue-400/55 before:via-cyan-400/45 before:to-blue-400/15"
              >
                {daySlots.map((slot) => {
                  const mins = getDurationMinutes(slot.startTime, slot.endTime);
                  const subj = SUBJECT_META[slot.subject];
                  const tv = dayTravelVisuals[slot.id];

                  return (
                    <div key={slot.id} className="space-y-2">
                      {/* Outbound Physical Transit Card */}
                      {tv && tv.beforeStartMin !== null && tv.beforeMins > 0 && (
                        <div className="transit-hatch relative flex items-center justify-between gap-3 rounded-[22px] border border-dashed border-cyan-400/55 px-4 py-2.5 dark:border-cyan-300/35">
                          <span
                            aria-hidden="true"
                            className="absolute -left-[15px] h-2 w-2 rounded-full border border-cyan-400 bg-cyan-200 dark:bg-cyan-900"
                          />
                          <div className="flex items-center gap-2 text-xs font-medium text-cyan-900 dark:text-cyan-100">
                            <Unlock className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
                            <span>
                              Going Transit to {slot.title} · Phone Unlocked
                            </span>
                          </div>
                          <span className="tabular-nums text-[11px] font-semibold text-cyan-800 dark:text-cyan-200">
                            {formatDuration(tv.beforeMins)}
                          </span>
                        </div>
                      )}

                      {/* Main Class or Self-Study Block */}
                      <button
                        type="button"
                        onClick={() => openExistingSlot(slot)}
                        className={`relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-[24px] py-4 pl-6 pr-5 text-left transition-transform duration-100 active:scale-[0.985] ${
                          GLASS_SUBJECT_BLOCK[slot.subject]
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute bottom-3 left-2.5 top-3 w-1.5 rounded-full ${subj.bar}`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`font-bold ${subj.text}`}>{subj.name}</span>
                            <span className="opacity-50">·</span>
                            <span className="opacity-75">
                              {slot.category === 'class'
                                ? slot.mode === 'physical'
                                  ? 'Physical Class'
                                  : 'Online Class'
                                : slot.revisionStage
                                  ? `Revise ${slot.revisionStage.toUpperCase()}`
                                  : 'Self-Study'}
                            </span>
                            {slot.specificDateISO && (
                              <>
                                <span className="opacity-50">·</span>
                                <span className="font-semibold text-blue-700 dark:text-cyan-300">
                                  One-off
                                </span>
                              </>
                            )}
                            {slot.autoBlock && (
                              <>
                                <span className="opacity-50">·</span>
                                <span className="inline-flex items-center gap-1 opacity-80">
                                  <Lock className="h-3 w-3" />
                                  <span>Locked</span>
                                </span>
                              </>
                            )}
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-[#07142B] dark:text-white">
                            {slot.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[#0B234A]/75 dark:text-sky-100/80">
                            {slot.subtitle}
                          </p>
                        </div>

                        <div className="shrink-0 text-right tabular-nums">
                          <p className="text-xs font-semibold text-[#07142B] dark:text-white">
                            {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                          </p>
                          <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-100/75">
                            {formatDuration(mins)}
                          </p>
                        </div>
                      </button>

                      {/* Return Physical Transit Card */}
                      {tv && tv.afterEndMin !== null && tv.afterMins > 0 && (
                        <div className="transit-hatch relative flex items-center justify-between gap-3 rounded-[22px] border border-dashed border-sky-400/55 px-4 py-2.5 dark:border-sky-300/35">
                          <span
                            aria-hidden="true"
                            className="absolute -left-[15px] h-2 w-2 rounded-full border border-sky-400 bg-sky-200 dark:bg-sky-900"
                          />
                          <div className="flex items-center gap-2 text-xs font-medium text-sky-900 dark:text-sky-100">
                            <Unlock className="h-3.5 w-3.5 text-sky-600 dark:text-cyan-300" />
                            <span>
                              Return Transit from {slot.title} · Phone Unlocked
                            </span>
                          </div>
                          <span className="tabular-nums text-[11px] font-semibold text-sky-800 dark:text-cyan-200">
                            {formatDuration(tv.afterMins)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {/* Create / View / Edit Slot Sheet */}
      <CrystalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} maxWidthClass="max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#0B234A]/70 dark:text-sky-200/75">
              {formDay} · {invalidTimeRange ? 'Pick valid range' : formatDuration(previewDuration)}
            </p>
            <h2 className="text-lg font-semibold text-[#07142B] dark:text-white">
              {editingSlotId ? 'View & Edit Slot' : 'Add Slot'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            aria-label="Close slot sheet"
            className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {editingSlotId && onToggleSlotComplete && (() => {
          const targetDateISO =
            editingSlotSpecificDate ??
            weekDays.find((d) => d.day === formDay)?.dateISO ??
            getTodayISO();
          const isSlotDone = (dailyLogs?.[targetDateISO]?.completedSlotIds ?? []).includes(
            editingSlotId,
          );
          return (
            <button
              type="button"
              onClick={() => {
                haptics.success();
                onToggleSlotComplete(targetDateISO, editingSlotId);
              }}
              className={`mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-bold transition-transform duration-100 active:scale-[0.98] ${
                isSlotDone
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'ios-glass-control border border-emerald-500/45 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>
                {isSlotDone
                  ? `Completed ✓ (${formatShortDateISO(targetDateISO)})`
                  : `Mark Complete & Earn XP (${formatShortDateISO(targetDateISO)})`}
              </span>
            </button>
          );
        })()}

        {editingLinkedTaskId && onOpenPlannerForTask && (
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setSheetOpen(false);
              onOpenPlannerForTask(editingLinkedTaskId);
            }}
            className="ios-glass-control mt-3 flex min-h-[40px] w-full items-center justify-between rounded-full px-4 text-xs font-semibold text-blue-700 transition-transform duration-100 active:scale-[0.98] dark:text-cyan-200"
          >
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span>Linked to Planner Task · Open Details</span>
            </span>
            <span>View</span>
          </button>
        )}

        {editingLinkedMissedId && onOpenMissedPage && (
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setSheetOpen(false);
              onOpenMissedPage();
            }}
            className="ios-glass-control mt-3 flex min-h-[40px] w-full items-center justify-between rounded-full px-4 text-xs font-semibold text-blue-700 transition-transform duration-100 active:scale-[0.98] dark:text-cyan-200"
          >
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span>Linked to Missed Lesson Catch-Up · Open</span>
            </span>
            <span>View</span>
          </button>
        )}

        {editingIsCatchUp && editingSlotId && (
          <button
            type="button"
            onClick={handleDeleteCurrentSlot}
            className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full bg-emerald-500/20 px-4 text-xs font-semibold text-emerald-800 transition-transform duration-100 active:scale-[0.98] dark:text-emerald-200"
          >
            <span>Mark Catch-Up Lesson Finished (Remove from Timetable)</span>
          </button>
        )}

        {/* Repeat Scope: Weekly Recurring vs One-Off Exact Date */}
        <div className="mt-4 space-y-2.5">
          <div className="ios-glass-control relative grid grid-cols-2 gap-1 rounded-full p-1">
            {(
              [
                { id: 'recurring', label: 'Weekly Recurring' },
                { id: 'one-off', label: 'One-Off Date' },
              ] as const
            ).map((opt) => {
              const active = repeatScope === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setRepeatScope(opt.id);
                    if (opt.id === 'one-off') {
                      const matched = weekDays.find((d) => d.day === formDay)?.dateISO;
                      if (matched) setSpecificDateInput(matched);
                    }
                  }}
                  className={`min-h-[34px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/80'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {repeatScope === 'one-off' ? (
            <div className="ios-glass-control flex items-center justify-between gap-2 rounded-full px-4 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#07142B] dark:text-white">
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
                <span>Exact Date</span>
              </span>
              <input
                type="date"
                value={specificDateInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  setSpecificDateInput(val);
                  setFormDay(getDayOfWeek(parseISODateLocal(val)));
                }}
                className="bg-transparent text-xs font-semibold text-blue-700 focus:outline-none dark:text-cyan-200"
              />
            </div>
          ) : (
            <div className="ios-glass-control relative grid grid-cols-7 gap-1 rounded-full p-1">
              {DAYS_ORDER.map((day) => {
                const active = formDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setFormDay(day);
                      const matched = weekDays.find((d) => d.day === day)?.dateISO;
                      if (matched) setSpecificDateInput(matched);
                    }}
                    className={`min-h-[36px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : 'text-[#07142B] dark:text-sky-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="ios-glass-control relative mt-4 grid grid-cols-2 gap-1 rounded-full p-1">
          {(
            [
              { id: 'class', label: 'Class' },
              { id: 'self-study', label: 'Self-Study' },
            ] as { id: SlotCategory; label: string }[]
          ).map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setCategory(cat.id);
                  if (!editingSlotId) {
                    setRepeatScope(
                      cat.id === 'self-study'
                        ? 'one-off'
                        : activeWeekOffset === 0
                          ? 'recurring'
                          : 'one-off',
                    );
                  }
                }}
                className={`min-h-[38px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                  active
                    ? 'bg-white/85 text-[#07142B] shadow-sm dark:bg-blue-500 dark:text-white'
                    : 'text-[#0B234A]/75 dark:text-sky-200/80'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {category === 'class' ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                Class
              </label>

              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setClassDropdownOpen((open) => !open);
                }}
                aria-expanded={classDropdownOpen}
                className="ios-glass-control mt-1.5 flex min-h-[54px] w-full items-center justify-between gap-3 rounded-[24px] px-4 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#07142B] dark:text-white">
                    {selectedPreset.title}
                  </p>
                  <p className="truncate text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                    <span className={SUBJECT_META[selectedPreset.subject].text}>
                      {SUBJECT_META[selectedPreset.subject].short}
                    </span>
                    {' · '}
                    {selectedPreset.teacher}
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#0B234A]/70 transition-transform duration-150 dark:text-sky-200 ${
                    classDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {classDropdownOpen && (
                <div className="ios-glass-control mt-2 max-h-60 divide-y divide-white/30 overflow-y-auto rounded-[24px] dark:divide-sky-300/15">
                  {CLASS_PRESETS.map((preset) => {
                    const meta = SUBJECT_META[preset.subject];
                    const active = resolvedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          haptics.tick();
                          applyPresetDefaults(preset.id);
                          setClassDropdownOpen(false);
                        }}
                        className={`flex min-h-[46px] w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${
                          active
                            ? 'bg-blue-500/20 font-semibold'
                            : 'hover:bg-white/30 dark:hover:bg-blue-400/10'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#07142B] dark:text-white">
                            {preset.title}
                          </p>
                          <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                            {preset.teacher}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold ${meta.text}`}>
                          {meta.short}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Online vs Physical Mode + Editable Travel Buffers */}
            <div className="ios-glass-control rounded-[24px] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#07142B] dark:text-white">
                  Attendance Mode
                </span>
                <div className="relative flex items-center gap-1 rounded-full bg-blue-500/12 p-1">
                  {(['online', 'physical'] as ClassMode[]).map((m) => {
                    const active = classMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          haptics.tick();
                          setClassMode(m);
                          if (m === 'online') {
                            setTravelBeforeMins(0);
                            setTravelAfterMins(0);
                          } else {
                            if (travelBeforeMins === 0) setTravelBeforeMins(120);
                            if (travelAfterMins === 0) setTravelAfterMins(120);
                          }
                        }}
                        className={`min-h-[30px] rounded-full px-3 text-[11px] font-semibold transition-colors duration-150 ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                            : 'text-[#0B234A]/75 dark:text-sky-200/80'
                        }`}
                      >
                        {m === 'online' ? 'Online · Home' : 'Physical · Commute'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {classMode === 'physical' && (
                <div className="mt-3 grid grid-cols-2 gap-2.5 overflow-hidden border-t border-white/30 pt-3 dark:border-sky-300/15">
                  <div>
                    <label className="block text-[10px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                      Going Commute (Phone Unlocked)
                    </label>
                    <select
                      value={travelBeforeMins}
                      onChange={(e) => setTravelBeforeMins(Number(e.target.value))}
                      className="ios-glass-control mt-1 min-h-[36px] w-full rounded-full px-3 text-xs font-semibold text-[#07142B] focus:outline-none dark:text-white"
                    >
                      {COMMUTE_OPTIONS.map((m) => (
                        <option
                          key={m}
                          value={m}
                          className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white"
                        >
                          {m === 0 ? 'None' : `${formatDuration(m)} before`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                      Return Commute (Phone Unlocked)
                    </label>
                    <select
                      value={travelAfterMins}
                      onChange={(e) => setTravelAfterMins(Number(e.target.value))}
                      className="ios-glass-control mt-1 min-h-[36px] w-full rounded-full px-3 text-xs font-semibold text-[#07142B] focus:outline-none dark:text-white"
                    >
                      {COMMUTE_OPTIONS.map((m) => (
                        <option
                          key={m}
                          value={m}
                          className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white"
                        >
                          {m === 0 ? 'None' : `${formatDuration(m)} after`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="ios-glass-control relative grid grid-cols-3 gap-1 rounded-full p-1">
              {(['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
                const meta = SUBJECT_META[subj];
                const active = selfSubject === subj;
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setSelfSubject(subj);
                    }}
                    className={`min-h-[38px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : meta.text
                    }`}
                  >
                    {meta.name}
                  </button>
                );
              })}
            </div>
            <textarea
              rows={2}
              value={selfNote}
              onChange={(e) => setSelfNote(e.target.value)}
              placeholder="What are you going to do? (questions, recap...)"
              className="ios-glass-control w-full rounded-[24px] px-4 py-3 text-sm text-[#07142B] placeholder:text-[#0B234A]/45 focus:outline-none dark:text-white dark:placeholder:text-sky-200/45"
            />
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Start Time
            </label>
            <button
              type="button"
              onClick={() => setClockTarget('start')}
              className="ios-glass-control tabular-nums mt-1 flex min-h-[46px] w-full items-center justify-between rounded-full px-4 text-sm font-semibold text-[#07142B] transition-transform duration-100 active:scale-[0.98] dark:text-white"
            >
              <span>{formatTime12h(startTime)}</span>
              <Clock className="h-4 w-4 text-blue-600 dark:text-sky-300" />
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              End Time
            </label>
            <button
              type="button"
              onClick={() => setClockTarget('end')}
              className="ios-glass-control tabular-nums mt-1 flex min-h-[46px] w-full items-center justify-between rounded-full px-4 text-sm font-semibold text-[#07142B] transition-transform duration-100 active:scale-[0.98] dark:text-white"
            >
              <span>{formatTime12h(endTime)}</span>
              <Clock className="h-4 w-4 text-blue-600 dark:text-sky-300" />
            </button>
          </div>
        </div>

        {invalidTimeRange && (
          <p className="mt-2 px-2 text-xs font-medium text-orange-600 dark:text-orange-300">
            End time must be after start time.
          </p>
        )}

        <div className="ios-glass-control mt-4 flex items-center justify-between rounded-full px-4 py-3">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium text-[#07142B] dark:text-white">
              Auto-Lock Phone (Class/Study only)
            </span>
          </div>
          <LiquidSwitch
            checked={autoBlock}
            onToggle={() => setAutoBlock((v) => !v)}
            ariaLabel="Toggle Auto-Lock Phone"
            activeColorClass="bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.45)]"
          />
        </div>

        {/* 3-Step Revise Loop Option on Classes */}
        {category === 'class' && !editingSlotId && (
          <div className="ios-glass-control mt-3 flex items-center justify-between rounded-full px-4 py-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
              <span className="text-xs font-medium text-[#07142B] dark:text-white">
                Suggest 3 Revise Sessions (30m · 1h · 30m)
              </span>
            </div>
            <LiquidSwitch
              checked={planReviseLoop}
              onToggle={() => setPlanReviseLoop((v) => !v)}
              ariaLabel="Toggle 3-Step Revise Loop"
            />
          </div>
        )}

        {category === 'class' && editingSlotId && (
          <button
            type="button"
            onClick={() => {
              const target = slots.find((s) => s.id === editingSlotId);
              if (!target) return;
              haptics.tap();
              setSheetOpen(false);
              onOpenReviseLoop({
                ...target,
                day: formDay,
                startTime,
                endTime,
                mode: classMode,
                travelBeforeMins: classMode === 'physical' ? travelBeforeMins : 0,
                travelAfterMins: classMode === 'physical' ? travelAfterMins : 0,
              });
            }}
            className="ios-glass-control mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-blue-700 transition-transform duration-100 active:scale-[0.98] dark:text-cyan-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Plan / Refresh 3-Step Revise Loop</span>
          </button>
        )}

        <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
          <Bell className="h-3.5 w-3.5 text-blue-600 dark:text-sky-300" />
          <span>10-minute reminder alert before start</span>
        </div>

        {editingSlotId && !editingSlotSpecificDate && onSkipSlotForDate && (
          <button
            type="button"
            onClick={() => {
              const dateForSlot =
                weekDays.find((d) => d.day === formDay)?.dateISO ?? getTodayISO();
              haptics.tap();
              onSkipSlotForDate(editingSlotId, dateForSlot);
              setSheetOpen(false);
            }}
            className="ios-glass-control mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-orange-700 transition-transform duration-100 active:scale-[0.98] dark:text-orange-300"
          >
            <X className="h-3.5 w-3.5" />
            <span>
              Skip / Cancel on{' '}
              {formatShortDateISO(
                weekDays.find((d) => d.day === formDay)?.dateISO ?? getTodayISO(),
              )}{' '}
              Only
            </span>
          </button>
        )}

        <div className="mt-5 flex items-center gap-2.5">
          {editingSlotId && (
            <button
              type="button"
              onClick={handleDeleteCurrentSlot}
              className="ios-glass-control inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full px-5 text-xs font-semibold text-orange-600 transition-transform duration-100 active:scale-95 dark:text-orange-300"
            >
              <Trash2 className="h-4 w-4" />
              <span>Remove</span>
            </button>
          )}
          <button
            type="button"
            disabled={invalidTimeRange}
            onClick={handleSaveSlot}
            className="min-h-[48px] flex-1 rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-[0.98] disabled:opacity-45 dark:bg-blue-500"
          >
            {editingSlotId
              ? 'Save Changes'
              : repeatScope === 'one-off'
                ? `Add to ${formatShortDateISO(specificDateInput)}`
                : `Add Weekly (${formDay})`}
          </button>
        </div>
      </CrystalSheet>

      {/* Recurring Slot Drag Choice Sheet (Move This Week Only vs Move Every Week) */}
      <CrystalSheet
        open={pendingRecurringDrop !== null}
        onClose={() => setPendingRecurringDrop(null)}
        maxWidthClass="max-w-md"
      >
        {pendingRecurringDrop && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-blue-700 dark:text-cyan-300">
                  Moved Recurring Slot
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-[#07142B] dark:text-white">
                  {pendingRecurringDrop.slot.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingRecurringDrop(null)}
                aria-label="Cancel move"
                className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-[#0B234A]/80 dark:text-sky-100/85">
              Target:{' '}
              <span className="font-semibold text-[#07142B] dark:text-white">
                {pendingRecurringDrop.targetDay}{' '}
                {formatShortDateISO(pendingRecurringDrop.targetDateISO)} ·{' '}
                {formatTime12h(pendingRecurringDrop.newStartTime)} –{' '}
                {formatTime12h(pendingRecurringDrop.newEndTime)}
              </span>
            </p>

            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  haptics.success();
                  onMoveRecurringSlotOneWeekOnly?.(
                    pendingRecurringDrop.slot,
                    pendingRecurringDrop.originDateISO,
                    pendingRecurringDrop.targetDay,
                    pendingRecurringDrop.targetDateISO,
                    pendingRecurringDrop.newStartTime,
                    pendingRecurringDrop.newEndTime,
                  );
                  setPendingRecurringDrop(null);
                }}
                className="min-h-[46px] w-full rounded-full bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-[0.98] dark:bg-blue-500"
              >
                Move This Week Only ({formatShortDateISO(pendingRecurringDrop.targetDateISO)})
              </button>

              <button
                type="button"
                onClick={() => {
                  haptics.success();
                  onUpdateSlot({
                    ...pendingRecurringDrop.slot,
                    day: pendingRecurringDrop.targetDay,
                    startTime: pendingRecurringDrop.newStartTime,
                    endTime: pendingRecurringDrop.newEndTime,
                  });
                  setPendingRecurringDrop(null);
                }}
                className="ios-glass-control min-h-[46px] w-full rounded-full px-4 text-xs font-semibold text-[#07142B] transition-transform duration-100 active:scale-[0.98] dark:text-white"
              >
                Move Every Week ({pendingRecurringDrop.targetDay})
              </button>
            </div>
          </>
        )}
      </CrystalSheet>

      {clockTarget !== null && (
        <GlassTimePicker
          open
          label={clockTarget === 'start' ? 'Start Time' : 'End Time'}
          value={clockTarget === 'start' ? startTime : endTime}
          onChange={(newVal) => {
            if (clockTarget === 'start') setStartTime(newVal);
            if (clockTarget === 'end') setEndTime(newVal);
          }}
          onClose={() => setClockTarget(null)}
        />
      )}
    </div>
  );
});
