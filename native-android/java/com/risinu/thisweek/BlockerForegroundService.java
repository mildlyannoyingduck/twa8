package com.risinu.thisweek;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.text.TextUtils;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class BlockerForegroundService extends Service {

    private static final String CHANNEL_ID = "this_week_blocker_service";
    private static final int NOTIFICATION_ID = 202701;
    private static final long POLL_INTERVAL_MS = 650L;

    private Handler handler;
    private Runnable pollRunnable;
    private String lastNotifText = "";
    private long lastOverlayLaunchMs = 0L;

    public static void startOrUpdate(Context context) {
        Intent intent = new Intent(context, BlockerForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stopService(Context context) {
        Intent intent = new Intent(context, BlockerForegroundService.class);
        context.stopService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        handler = new Handler(Looper.getMainLooper());
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                tickCheck();
                if (handler != null) {
                    handler.postDelayed(this, POLL_INTERVAL_MS);
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SchedulePrefs.ActiveLockState state = SchedulePrefs.getActiveLockState(this);
        String body = state.active
                ? ("Strict Lock Active · Until " + state.untilLabel)
                : "This Week · Timetable Guard Ready";
        lastNotifText = body;
        startForeground(NOTIFICATION_ID, buildNotification(body));

        handler.removeCallbacks(pollRunnable);
        handler.post(pollRunnable);
        return START_STICKY;
    }

    private void tickCheck() {
        SlotReminderReceiver.checkDueSoonNotifications(this);
        SchedulePrefs.ActiveLockState state = SchedulePrefs.getActiveLockState(this);
        String desiredBody = state.active
                ? ("Strict Lock Active · Until " + state.untilLabel)
                : "This Week · Timetable Guard Ready";

        if (!desiredBody.equals(lastNotifText)) {
            lastNotifText = desiredBody;
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, buildNotification(desiredBody));
            }
        }

        if (!state.active) {
            if (!SchedulePrefs.hasAnyAutoBlockSlots(this)) {
                stopSelf();
            }
            return;
        }

        if (!ThisWeekBlockerPlugin.hasUsageStatsPermission(this)) {
            return;
        }

        String fgPackage = getCurrentForegroundPackage();
        if (!TextUtils.isEmpty(fgPackage) && !SchedulePrefs.isPackageAllowed(this, fgPackage)) {
            long now = System.currentTimeMillis();
            if (now - lastOverlayLaunchMs > 800L) {
                lastOverlayLaunchMs = now;
                Intent lockIntent = new Intent(this, LockOverlayActivity.class);
                lockIntent.addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK
                                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                );
                lockIntent.putExtra("reason", state.reason);
                lockIntent.putExtra("untilLabel", state.untilLabel);
                lockIntent.putExtra("untilMs", state.untilMs);
                lockIntent.putExtra("blockedPkg", fgPackage);
                startActivity(lockIntent);
            }
        }
    }

    private String getCurrentForegroundPackage() {
        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return "";
            long end = System.currentTimeMillis();
            long begin = end - 10_000L;
            UsageEvents events = usm.queryEvents(begin, end);
            UsageEvents.Event event = new UsageEvents.Event();
            String latestPkg = "";
            long latestTs = 0L;
            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                int type = event.getEventType();
                boolean isFg = type == UsageEvents.Event.MOVE_TO_FOREGROUND
                        || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && type == UsageEvents.Event.ACTIVITY_RESUMED);
                if (isFg && event.getTimeStamp() >= latestTs) {
                    latestTs = event.getTimeStamp();
                    latestPkg = event.getPackageName();
                }
            }
            return latestPkg;
        } catch (Exception e) {
            return "";
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "This Week Focus Guard",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps scheduled phone locks active on Samsung Galaxy A07");
            channel.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String text) {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentTitle("This Week")
                .setContentText(text)
                .setOngoing(true)
                .setSilent(true)
                .setContentIntent(pi)
                .build();
    }

    @Override
    public void onDestroy() {
        if (handler != null && pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
