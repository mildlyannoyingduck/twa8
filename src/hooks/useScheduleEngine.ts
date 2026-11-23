import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendNativeNotification } from '../native/thisWeekBridge';
import { ActiveLockInfo, TimetableSlot } from '../types';
import { getDayOfWeek, getTodayISO } from '../utils/dateUtils';
import { loadNotifiedKeys, saveNotifiedKeys } from '../utils/storage';
import { formatTime12h, toMinutes } from '../utils/timeUtils';

export interface UpcomingReminderToast {
  id: string;
  title: string;
  subtitle: string;
  startTime: string;
}

function playGentleChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.46);
  } catch {
    // Ignore autoplay restriction if user hasn't interacted yet
  }
}

function computeActiveLock(
  slots: TimetableSlot[],
  manualLockUntilMs: number,
  now: Date,
): ActiveLockInfo {
  const nowMs = now.getTime();
  const todayDow = getDayOfWeek(now);
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const activeSlot = slots.find((slot) => {
    if (slot.day !== todayDow || !slot.autoBlock) return false;
    const startMin = toMinutes(slot.startTime);
    const endMin = toMinutes(slot.endTime);
    return currentMin >= startMin && currentMin < endMin;
  });

  let slotEndMs = 0;
  if (activeSlot) {
    const [eh, em] = activeSlot.endTime.split(':').map(Number);
    const endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      eh,
      em,
      0,
      0,
    );
    slotEndMs = endDate.getTime();
  }

  const manualActive = manualLockUntilMs > nowMs;

  if (activeSlot && (!manualActive || slotEndMs >= manualLockUntilMs)) {
    return {
      active: true,
      reason: `${activeSlot.title} · ${activeSlot.subtitle}`,
      untilTimeLabel: formatTime12h(activeSlot.endTime),
      untilTimestampMs: slotEndMs,
      source: 'auto-slot',
    };
  }

  if (manualActive) {
    const endD = new Date(manualLockUntilMs);
    const hhmm = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
    return {
      active: true,
      reason: 'Strict Study Focus Lock',
      untilTimeLabel: formatTime12h(hhmm),
      untilTimestampMs: manualLockUntilMs,
      source: 'manual',
    };
  }

  return {
    active: false,
    reason: '',
    untilTimeLabel: '',
    untilTimestampMs: 0,
    source: 'none',
  };
}

function getMinuteKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}:${d.getMinutes()}`;
}

export function useScheduleEngine(
  slots: TimetableSlot[],
  manualLockUntilMs: number,
  onClearExpiredManualLock: () => void,
) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [reminderToast, setReminderToast] = useState<UpcomingReminderToast | null>(null);
  const lastMinuteKeyRef = useRef<string>(getMinuteKey(now));

  useEffect(() => {
    const tick = (force = false) => {
      if (document.hidden && !force) return;
      const current = new Date();
      const nextKey = getMinuteKey(current);

      if (manualLockUntilMs > 0 && manualLockUntilMs <= current.getTime()) {
        onClearExpiredManualLock();
      }

      if (nextKey !== lastMinuteKeyRef.current || force) {
        lastMinuteKeyRef.current = nextKey;
        setNow(current);

        // Check 10-minute pre-slot notification once per minute
        const todayDow = getDayOfWeek(current);
        const todayISO = getTodayISO(current);
        const currentMin = current.getHours() * 60 + current.getMinutes();

        const notified = loadNotifiedKeys();
        let updated = false;

        for (const slot of slots) {
          if (slot.day !== todayDow) continue;
          const startMin = toMinutes(slot.startTime);
          const endMin =
            slot.endTime === '00:00' && startMin > 0 ? 1440 : toMinutes(slot.endTime);
          const minsUntil = startMin - currentMin;
          const notifyKey = `${todayISO}:${slot.id}`;

          if (minsUntil > 0 && minsUntil <= 10 && !notified[notifyKey]) {
            notified[notifyKey] = true;
            updated = true;

            const alertTitle = `Starting in ${minsUntil} min: ${slot.title}`;
            const alertBody = `${slot.subtitle} · ${formatTime12h(slot.startTime)}`;

            setReminderToast({
              id: notifyKey,
              title: alertTitle,
              subtitle: slot.subtitle,
              startTime: formatTime12h(slot.startTime),
            });
            playGentleChime();
            void sendNativeNotification(alertTitle, alertBody);
          }

          const endKey = `${todayISO}::end::${slot.id}`;
          const minsSinceEnd = currentMin - endMin;
          if (minsSinceEnd >= 0 && minsSinceEnd <= 2 && !notified[endKey]) {
            notified[endKey] = true;
            updated = true;

            const endTitle = `Did you finish? · ${slot.title}`;
            const endBody = `Ended at ${formatTime12h(slot.endTime)} · Claim XP or rescue if missed.`;

            setReminderToast({
              id: endKey,
              title: endTitle,
              subtitle: slot.isRescueSlot ? 'Rescue Chance (1x)' : 'Session Check-In',
              startTime: formatTime12h(slot.endTime),
            });
            playGentleChime();
            void sendNativeNotification(endTitle, endBody);
          }
        }

        if (updated) {
          saveNotifiedKeys(notified);
        }
      }
    };

    tick(true);
    const timer = window.setInterval(() => tick(false), 15000);
    const onVisible = () => {
      if (!document.hidden) tick(true);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [slots, manualLockUntilMs, onClearExpiredManualLock]);

  const activeLock = useMemo(
    () => computeActiveLock(slots, manualLockUntilMs, now),
    [slots, manualLockUntilMs, now],
  );

  const dismissReminderToast = useCallback(() => setReminderToast(null), []);

  return {
    now,
    activeLock,
    reminderToast,
    dismissReminderToast,
  };
}
