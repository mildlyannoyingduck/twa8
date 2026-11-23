import { NativePermissionStatus, TimetableSlot } from '../types';

interface ThisWeekBlockerPlugin {
  syncScheduleAndLock(options: {
    slotsJson: string;
    manualLockUntilMs: number;
    allowlistPackages: string[];
  }): Promise<void>;
  getPermissionStatus(): Promise<NativePermissionStatus>;
  requestPermission(options: {
    type: 'usage' | 'overlay' | 'notifications' | 'battery';
  }): Promise<void>;
  sendNotificationNow?(options: {
    title: string;
    body: string;
  }): Promise<void>;
  saveVaultSnapshot?(options: { vaultJson: string }): Promise<void>;
  loadVaultSnapshot?(): Promise<{ vaultJson: string }>;
  exportBackupFile?(options: {
    fileName: string;
    vaultJson: string;
  }): Promise<{ ok: boolean; savedPath?: string; error?: string }>;
  shareBackupFile?(options: {
    fileName: string;
    vaultJson: string;
  }): Promise<{ ok: boolean }>;
}

interface CapacitorWindow extends Window {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      ThisWeekBlocker?: ThisWeekBlockerPlugin;
    };
  };
}

export const SAMSUNG_A07_ALLOWLIST = [
  // Phone & Dialer
  'com.samsung.android.dialer',
  'com.samsung.android.incallui',
  'com.android.incallui',
  'com.google.android.dialer',
  'com.android.dialer',
  'com.android.server.telecom',
  // Contacts
  'com.samsung.android.app.contacts',
  'com.android.contacts',
  'com.google.android.contacts',
  // Calculator
  'com.sec.android.app.popupcalculator',
  'com.samsung.android.calculator',
  'com.google.android.calculator',
  'com.android.calculator2',
  // Settings
  'com.android.settings',
  // This Week App
  'com.risinu.thisweek',
];

function getPlugin(): ThisWeekBlockerPlugin | null {
  const win = window as CapacitorWindow;
  return win.Capacitor?.Plugins?.ThisWeekBlocker ?? null;
}

export function isNativeAndroidApp(): boolean {
  const win = window as CapacitorWindow;
  return Boolean(win.Capacitor?.isNativePlatform?.());
}

export async function syncNativeBlockerAndAlarms(
  slots: TimetableSlot[],
  manualLockUntilMs: number,
): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.syncScheduleAndLock({
      slotsJson: JSON.stringify(slots),
      manualLockUntilMs,
      allowlistPackages: SAMSUNG_A07_ALLOWLIST,
    });
  } catch {
    // Non-fatal in web preview
  }
}

export async function fetchNativePermissions(): Promise<NativePermissionStatus> {
  const plugin = getPlugin();
  if (!plugin) {
    const notifGranted =
      typeof Notification !== 'undefined' && Notification.permission === 'granted';
    return {
      isNativeAndroid: false,
      usageAccess: false,
      overlayAccess: false,
      notifications: notifGranted,
      batteryUnrestricted: false,
    };
  }
  try {
    return await plugin.getPermissionStatus();
  } catch {
    return {
      isNativeAndroid: true,
      usageAccess: false,
      overlayAccess: false,
      notifications: false,
      batteryUnrestricted: false,
    };
  }
}

export async function requestNativePermission(
  type: 'usage' | 'overlay' | 'notifications' | 'battery',
): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) {
    if (type === 'notifications' && typeof Notification !== 'undefined') {
      await Notification.requestPermission();
    }
    return;
  }
  try {
    await plugin.requestPermission({ type });
  } catch {
    // Ignore
  }
}

export async function sendNativeNotification(
  title: string,
  body: string,
): Promise<void> {
  const plugin = getPlugin();
  if (plugin?.sendNotificationNow) {
    try {
      await plugin.sendNotificationNow({ title, body });
      return;
    } catch {
      // Fallback below
    }
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore
    }
  }
}

export async function syncNativeVaultSnapshot(vaultJson: string): Promise<void> {
  const plugin = getPlugin();
  if (!plugin?.saveVaultSnapshot || !vaultJson) return;
  try {
    await plugin.saveVaultSnapshot({ vaultJson });
  } catch {
    // Non-fatal in web preview or older native binary
  }
}

export async function fetchNativeVaultSnapshot(): Promise<string | null> {
  const plugin = getPlugin();
  if (!plugin?.loadVaultSnapshot) return null;
  try {
    const res = await plugin.loadVaultSnapshot();
    const raw = res?.vaultJson;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export async function exportNativeBackupFile(
  fileName: string,
  vaultJson: string,
): Promise<{ ok: boolean; savedPath?: string; error?: string } | null> {
  const plugin = getPlugin();
  if (!plugin?.exportBackupFile) return null;
  try {
    return await plugin.exportBackupFile({ fileName, vaultJson });
  } catch {
    return null;
  }
}

export async function shareNativeBackup(
  fileName: string,
  vaultJson: string,
): Promise<boolean> {
  const plugin = getPlugin();
  if (plugin?.shareBackupFile) {
    try {
      const res = await plugin.shareBackupFile({ fileName, vaultJson });
      return Boolean(res?.ok);
    } catch {
      return false;
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: fileName, text: vaultJson });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
