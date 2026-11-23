package com.risinu.thisweek;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

public class SlotReminderReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "this_week_slot_reminders_v2";
    private static final int MAX_ALARM_SLOTS = 80;

    @Override
    public void onReceive(Context context, Intent intent) {
        String kind = intent.getStringExtra("kind");
        String title = intent.getStringExtra("title");
        String subtitle = intent.getStringExtra("subtitle");
        String startTime = intent.getStringExtra("startTime");
        String endTime = intent.getStringExtra("endTime");
        String notifyKey = intent.getStringExtra("notifyKey");

        if (title != null && !title.isEmpty()) {
            if (notifyKey == null || !SchedulePrefs.wasNotified(context, notifyKey)) {
                if (notifyKey != null) {
                    SchedulePrefs.markNotified(context, notifyKey);
                }
                if ("end".equals(kind)) {
                    String body = "Ended at " + (endTime != null ? endTime : "")
                            + " · Open This Week to claim XP or rescue if missed.";
                    postHeadsUpNotification(context, "Did you finish? · " + title, body);
                } else {
                    String body = (subtitle == null || subtitle.isEmpty())
                            ? ("Starts at " + (startTime != null ? startTime : ""))
                            : (subtitle + " · Starts at " + (startTime != null ? startTime : ""));
                    postHeadsUpNotification(context, "Starting in 10 min: " + title, body);
                }
            }
        }

        scheduleAll(context);
        if (SchedulePrefs.hasAnyAutoBlockSlots(context)) {
            BlockerForegroundService.startOrUpdate(context);
        }
    }

    public static void postHeadsUpNotification(Context ctx, String heading, String body) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Class & Study Reminders",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Heads-up alerts 10 minutes before slots and right when sessions end");
            channel.enableVibration(true);
            channel.enableLights(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(channel);
        }

        Intent openIntent = new Intent(ctx, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                ctx,
                1,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(heading)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(pi);

        nm.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
    }

    public static void checkDueSoonNotifications(Context ctx) {
        try {
            Calendar cal = Calendar.getInstance();
            String todayDow = SchedulePrefs.getDayOfWeekString(cal);
            String todayISO = String.format(
                    Locale.US,
                    "%04d-%02d-%02d",
                    cal.get(Calendar.YEAR),
                    cal.get(Calendar.MONTH) + 1,
                    cal.get(Calendar.DAY_OF_MONTH)
            );
            int currentMin = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);

            JSONArray arr = new JSONArray(SchedulePrefs.getSlotsJson(ctx));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject slot = arr.optJSONObject(i);
                if (slot == null) continue;
                if (!todayDow.equals(slot.optString("day", ""))) continue;

                String slotId = slot.optString("id", String.valueOf(i));
                String startTime = slot.optString("startTime", "");
                String endTime = slot.optString("endTime", "");
                int startMin = SchedulePrefs.toMinutes(startTime);
                int endMin = "00:00".equals(endTime) && startMin > 0 ? 1440 : SchedulePrefs.toMinutes(endTime);
                int minsUntil = startMin - currentMin;
                String notifyKey = todayISO + ":" + slotId;

                if (minsUntil > 0 && minsUntil <= 10 && !SchedulePrefs.wasNotified(ctx, notifyKey)) {
                    SchedulePrefs.markNotified(ctx, notifyKey);
                    String title = slot.optString("title", "Study Slot");
                    String subtitle = slot.optString("subtitle", "");
                    String timeLabel = SchedulePrefs.formatTime12h(startTime);
                    String body = subtitle.isEmpty()
                            ? ("Starts at " + timeLabel)
                            : (subtitle + " · Starts at " + timeLabel);
                    postHeadsUpNotification(ctx, "Starting in " + minsUntil + " min: " + title, body);
                }

                String endNotifyKey = todayISO + "::end::" + slotId;
                int minsSinceEnd = currentMin - endMin;
                if (minsSinceEnd >= 0 && minsSinceEnd <= 5 && !SchedulePrefs.wasNotified(ctx, endNotifyKey)) {
                    SchedulePrefs.markNotified(ctx, endNotifyKey);
                    String title = slot.optString("title", "Study Slot");
                    String endLabel = SchedulePrefs.formatTime12h(endTime);
                    postHeadsUpNotification(
                            ctx,
                            "Did you finish? · " + title,
                            "Ended at " + endLabel + " · Tap to claim XP or rescue if missed."
                    );
                }
            }
        } catch (Exception ignored) {
        }
    }

    private static void scheduleSingleAlarm(
            Context ctx,
            AlarmManager am,
            int requestCode,
            long triggerMs,
            String kind,
            String title,
            String subtitle,
            String startLabel,
            String endLabel,
            String notifyKey
    ) {
        Intent alarmIntent = new Intent(ctx, SlotReminderReceiver.class);
        alarmIntent.putExtra("kind", kind);
        alarmIntent.putExtra("title", title);
        alarmIntent.putExtra("subtitle", subtitle);
        alarmIntent.putExtra("startTime", startLabel);
        alarmIntent.putExtra("endTime", endLabel);
        alarmIntent.putExtra("notifyKey", notifyKey);

        PendingIntent pi = PendingIntent.getBroadcast(
                ctx,
                requestCode,
                alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        boolean canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (canExact) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi);
            }
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, triggerMs, pi);
        }
    }

    public static void scheduleAll(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        for (int i = 0; i < MAX_ALARM_SLOTS; i++) {
            for (int base : new int[]{5000, 6000}) {
                Intent cancelIntent = new Intent(ctx, SlotReminderReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(
                        ctx,
                        base + i,
                        cancelIntent,
                        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                if (pi != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
            }
        }

        try {
            JSONArray arr = new JSONArray(SchedulePrefs.getSlotsJson(ctx));
            long now = System.currentTimeMillis();
            int count = Math.min(arr.length(), MAX_ALARM_SLOTS);

            for (int i = 0; i < count; i++) {
                JSONObject slot = arr.optJSONObject(i);
                if (slot == null) continue;

                String slotId = slot.optString("id", String.valueOf(i));
                String day = slot.optString("day", "Mon");
                String startTime = slot.optString("startTime", "08:00");
                String endTime = slot.optString("endTime", "09:00");
                String title = slot.optString("title", "Study Slot");
                String subtitle = slot.optString("subtitle", "");
                int startMin = SchedulePrefs.toMinutes(startTime);
                int endMin = "00:00".equals(endTime) && startMin > 0 ? 1440 : SchedulePrefs.toMinutes(endTime);

                // 1. Pre-start 10-minute reminder
                int reminderMin = startMin - 10;
                Calendar startCal = Calendar.getInstance();
                startCal.setTimeInMillis(now);
                startCal.set(Calendar.DAY_OF_WEEK, SchedulePrefs.dayStringToCalendarDay(day));
                if (reminderMin < 0) {
                    startCal.add(Calendar.DAY_OF_YEAR, -1);
                    reminderMin += 1440;
                }
                startCal.set(Calendar.HOUR_OF_DAY, reminderMin / 60);
                startCal.set(Calendar.MINUTE, reminderMin % 60);
                startCal.set(Calendar.SECOND, 0);
                startCal.set(Calendar.MILLISECOND, 0);
                if (startCal.getTimeInMillis() <= now) {
                    startCal.add(Calendar.DAY_OF_YEAR, 7);
                }

                String startISO = String.format(
                        Locale.US,
                        "%04d-%02d-%02d",
                        startCal.get(Calendar.YEAR),
                        startCal.get(Calendar.MONTH) + 1,
                        startCal.get(Calendar.DAY_OF_MONTH)
                );

                scheduleSingleAlarm(
                        ctx,
                        am,
                        5000 + i,
                        startCal.getTimeInMillis(),
                        "start",
                        title,
                        subtitle,
                        SchedulePrefs.formatTime12h(startTime),
                        SchedulePrefs.formatTime12h(endTime),
                        startISO + ":" + slotId
                );

                // 2. Exact end-of-slot check-in alarm
                Calendar endCal = Calendar.getInstance();
                endCal.setTimeInMillis(now);
                endCal.set(Calendar.DAY_OF_WEEK, SchedulePrefs.dayStringToCalendarDay(day));
                int resolvedEndMin = endMin;
                if (resolvedEndMin >= 1440) {
                    endCal.add(Calendar.DAY_OF_YEAR, 1);
                    resolvedEndMin -= 1440;
                }
                endCal.set(Calendar.HOUR_OF_DAY, resolvedEndMin / 60);
                endCal.set(Calendar.MINUTE, resolvedEndMin % 60);
                endCal.set(Calendar.SECOND, 0);
                endCal.set(Calendar.MILLISECOND, 0);
                if (endCal.getTimeInMillis() <= now) {
                    endCal.add(Calendar.DAY_OF_YEAR, 7);
                }

                String endISO = String.format(
                        Locale.US,
                        "%04d-%02d-%02d",
                        endCal.get(Calendar.YEAR),
                        endCal.get(Calendar.MONTH) + 1,
                        endCal.get(Calendar.DAY_OF_MONTH)
                );

                scheduleSingleAlarm(
                        ctx,
                        am,
                        6000 + i,
                        endCal.getTimeInMillis(),
                        "end",
                        title,
                        subtitle,
                        SchedulePrefs.formatTime12h(startTime),
                        SchedulePrefs.formatTime12h(endTime),
                        endISO + "::end::" + slotId
                );
            }
        } catch (Exception ignored) {
        }
    }
}
