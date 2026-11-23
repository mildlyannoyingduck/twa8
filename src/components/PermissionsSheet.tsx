import {
  BatteryCharging,
  Bell,
  CheckCircle2,
  Eye,
  Layers,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  fetchNativePermissions,
  requestNativePermission,
} from '../native/thisWeekBridge';
import { NativePermissionStatus } from '../types';
import { haptics } from '../utils/haptics';
import { CrystalSheet } from './FluidControls';

interface PermissionsSheetProps {
  open: boolean;
  initialStatus?: NativePermissionStatus | null;
  onStatusUpdated?: (status: NativePermissionStatus) => void;
  onClose: () => void;
}

interface PermItem {
  id: 'notifications' | 'usage' | 'overlay' | 'battery';
  title: string;
  desc: string;
  icon: typeof Bell;
  granted: boolean;
}

export function PermissionsSheet({
  open,
  initialStatus,
  onStatusUpdated,
  onClose,
}: PermissionsSheetProps) {
  const [perms, setPerms] = useState<NativePermissionStatus>(
    initialStatus ?? {
      isNativeAndroid: false,
      usageAccess: false,
      overlayAccess: false,
      notifications: false,
      batteryUnrestricted: false,
    },
  );

  useEffect(() => {
    if (initialStatus) {
      setPerms(initialStatus);
    }
  }, [initialStatus]);

  useEffect(() => {
    if (!open) return;
    const refresh = () => {
      fetchNativePermissions().then((status) => {
        setPerms(status);
        onStatusUpdated?.(status);
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [open, onStatusUpdated]);

  const items: PermItem[] = perms.isNativeAndroid
    ? [
        {
          id: 'notifications',
          title: 'Slot Notifications',
          desc: '10-minute reminder alerts before every class & study session.',
          icon: Bell,
          granted: perms.notifications,
        },
        {
          id: 'usage',
          title: 'Usage Access',
          desc: 'Detects distracting apps during strict study lock blocks.',
          icon: Eye,
          granted: perms.usageAccess,
        },
        {
          id: 'overlay',
          title: 'Display Over Other Apps',
          desc: 'Brings up the lock screen over distracting apps automatically.',
          icon: Layers,
          granted: perms.overlayAccess,
        },
        {
          id: 'battery',
          title: 'Unrestricted Battery',
          desc: 'Prevents Samsung One UI from stopping exact study alarms.',
          icon: BatteryCharging,
          granted: perms.batteryUnrestricted,
        },
      ]
    : [
        {
          id: 'notifications',
          title: 'Reminder Alerts',
          desc: '10-minute pre-slot study alerts in your browser & APK.',
          icon: Bell,
          granted: perms.notifications,
        },
      ];

  const grantedCount = items.filter((i) => i.granted).length;
  const totalCount = items.length;
  const allGranted = grantedCount === totalCount;
  const nextMissing = items.find((i) => !i.granted) ?? null;

  const handleGrant = async (type: PermItem['id']) => {
    haptics.tap();
    await requestNativePermission(type);
    const updated = await fetchNativePermissions();
    setPerms(updated);
    onStatusUpdated?.(updated);
  };

  return (
    <CrystalSheet open={open} onClose={onClose} zIndexClass="z-[70]" maxWidthClass="max-w-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-blue-700 dark:text-cyan-300">
            {perms.isNativeAndroid ? 'Samsung Galaxy A07 Setup' : 'App Permissions'}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[#07142B] dark:text-white">
            {allGranted ? 'All Permissions Ready' : 'Required Permissions'}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close permissions sheet"
          className="ios-glass-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Strip */}
      <div className="ios-glass-control mt-3.5 rounded-[24px] p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#07142B] dark:text-white">
            <ShieldCheck
              className={`h-4 w-4 ${
                allGranted ? 'text-emerald-500' : 'text-blue-600 dark:text-cyan-300'
              }`}
            />
            <span>
              {allGranted
                ? 'Ready for strict lock & 10-min alerts'
                : `${totalCount - grantedCount} permission${
                    totalCount - grantedCount === 1 ? '' : 's'
                  } missing for full focus shield`}
            </span>
          </span>
          <span className="tabular-nums font-bold text-blue-700 dark:text-cyan-300">
            {grantedCount}/{totalCount}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
          <div
            style={{ width: `${Math.round((grantedCount / totalCount) * 100)}%` }}
            className={`h-full rounded-full transition-[width] duration-300 ${
              allGranted
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-blue-600 to-cyan-400'
            }`}
          />
        </div>
      </div>

      {/* Step-by-Step Permission Cards */}
      <div className="mt-3.5 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`ios-glass-control flex items-center justify-between gap-3 rounded-[24px] px-4 py-3 ${
                item.granted ? '!border-emerald-400/45' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    item.granted
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-blue-500/15 text-blue-700 dark:text-cyan-300'
                  }`}
                >
                  {item.granted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#07142B] dark:text-white">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#0B234A]/70 dark:text-sky-200/75">
                    {item.desc}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleGrant(item.id)}
                className={`min-h-[36px] shrink-0 rounded-full px-3.5 text-xs font-semibold transition-transform duration-100 active:scale-95 ${
                  item.granted
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                }`}
              >
                {item.granted ? 'Allowed' : 'Allow'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="mt-5 flex items-center gap-2.5">
        {!allGranted ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="ios-glass-control min-h-[46px] rounded-full px-4 text-xs font-semibold text-[#0B234A]/80 transition-transform duration-100 active:scale-95 dark:text-sky-100"
            >
              Skip for now
            </button>
            {nextMissing && (
              <button
                type="button"
                onClick={() => handleGrant(nextMissing.id)}
                className="min-h-[46px] flex-1 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-95 dark:bg-blue-500"
              >
                Allow {nextMissing.title}
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              haptics.success();
              onClose();
            }}
            className="min-h-[46px] w-full rounded-full bg-emerald-600 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 transition-transform duration-100 active:scale-95 dark:bg-emerald-500"
          >
            Done · Start Using This Week
          </button>
        )}
      </div>
    </CrystalSheet>
  );
}
