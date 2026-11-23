package com.risinu.thisweek;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.text.TextUtils;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public final class SchedulePrefs {

    private static final String PREFS_NAME = "ThisWeekPrefs";
    private static final String KEY_SLOTS_JSON = "slots_json";
    private static final String KEY_MANUAL_LOCK_UNTIL = "manual_lock_until_ms";
    private static final String KEY_ALLOWLIST_JSON = "allowlist_json";
    private static final String KEY_NOTIFIED_SET = "notified_slot_keys";
    private static final String KEY_USER_VAULT_JSON = "user_vault_json";

    public static final class ActiveLockState {
        public final boolean active;
        public final String reason;
        public final String untilLabel;
        public final long untilMs;

        public ActiveLockState(boolean active, String reason, String untilLabel, long untilMs) {
            this.active = active;
            this.reason = reason;
            this.untilLabel = untilLabel;
            this.untilMs = untilMs;
        }
    }

    private SchedulePrefs() {}

    public static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static void saveSyncData(Context context, String slotsJson, long manualLockUntilMs, JSONArray allowlist) {
        prefs(context).edit()
                .putString(KEY_SLOTS_JSON, slotsJson != null ? slotsJson : "[]")
                .putLong(KEY_MANUAL_LOCK_UNTIL, manualLockUntilMs)
                .putString(KEY_ALLOWLIST_JSON, allowlist != null ? allowlist.toString() : "[]")
                .apply();
    }

    public static void saveVaultJson(Context context, String vaultJson) {
        if (TextUtils.isEmpty(vaultJson)) return;
        prefs(context).edit()
                .putString(KEY_USER_VAULT_JSON, vaultJson)
                .apply();
    }

    public static String getVaultJson(Context context) {
        return prefs(context).getString(KEY_USER_VAULT_JSON, "");
    }

    public static String getSlotsJson(Context context) {
        return prefs(context).getString(KEY_SLOTS_JSON, "[]");
    }

    public static long getManualLockUntilMs(Context context) {
        return prefs(context).getLong(KEY_MANUAL_LOCK_UNTIL, 0L);
    }

    public static boolean hasAnyAutoBlockSlots(Context context) {
        try {
            JSONArray arr = new JSONArray(getSlotsJson(context));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.optJSONObject(i);
                if (obj != null && obj.optBoolean("autoBlock", false)) {
                    return true;
                }
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    public static String getDayOfWeekString(Calendar cal) {
        switch (cal.get(Calendar.DAY_OF_WEEK)) {
            case Calendar.MONDAY: return "Mon";
            case Calendar.TUESDAY: return "Tue";
            case Calendar.WEDNESDAY: return "Wed";
            case Calendar.THURSDAY: return "Thu";
            case Calendar.FRIDAY: return "Fri";
            case Calendar.SATURDAY: return "Sat";
            case Calendar.SUNDAY: return "Sun";
            default: return "Mon";
        }
    }

    public static int dayStringToCalendarDay(String day) {
        if ("Tue".equals(day)) return Calendar.TUESDAY;
        if ("Wed".equals(day)) return Calendar.WEDNESDAY;
        if ("Thu".equals(day)) return Calendar.THURSDAY;
        if ("Fri".equals(day)) return Calendar.FRIDAY;
        if ("Sat".equals(day)) return Calendar.SATURDAY;
        if ("Sun".equals(day)) return Calendar.SUNDAY;
        return Calendar.MONDAY;
    }

    public static int toMinutes(String hhmm) {
        if (TextUtils.isEmpty(hhmm) || !hhmm.contains(":")) return 0;
        String[] parts = hhmm.split(":");
        try {
            int h = Integer.parseInt(parts[0].trim());
            int m = Integer.parseInt(parts[1].trim());
            return h * 60 + m;
        } catch (Exception e) {
            return 0;
        }
    }

    public static String formatTime12h(String hhmm) {
        int mins = toMinutes(hhmm);
        int h24 = (mins / 60) % 24;
        int m = mins % 60;
        String period = h24 >= 12 ? "PM" : "AM";
        int h12 = h24 % 12;
        if (h12 == 0) h12 = 12;
        return String.format(Locale.US, "%d:%02d %s", h12, m, period);
    }

    public static String formatTimestamp12h(long timeMs) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(timeMs);
        String hhmm = String.format(Locale.US, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
        return formatTime12h(hhmm);
    }

    public static ActiveLockState getActiveLockState(Context context) {
        long nowMs = System.currentTimeMillis();
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(nowMs);
        String todayDow = getDayOfWeekString(cal);
        int currentMin = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);

        String matchedReason = "";
        String matchedUntilLabel = "";
        long matchedSlotEndMs = 0L;

        try {
            JSONArray arr = new JSONArray(getSlotsJson(context));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject slot = arr.optJSONObject(i);
                if (slot == null || !slot.optBoolean("autoBlock", false)) continue;
                if (!todayDow.equals(slot.optString("day", ""))) continue;

                String startTime = slot.optString("startTime", "");
                String endTime = slot.optString("endTime", "");
                int startMin = toMinutes(startTime);
                int endMin = toMinutes(endTime);
                if ("00:00".equals(endTime) && startMin > 0) {
                    endMin = 1440;
                }

                if (currentMin >= startMin && currentMin < endMin) {
                    Calendar endCal = (Calendar) cal.clone();
                    if (endMin >= 1440) {
                        endCal.add(Calendar.DAY_OF_YEAR, 1);
                        endCal.set(Calendar.HOUR_OF_DAY, 0);
                        endCal.set(Calendar.MINUTE, 0);
                    } else {
                        endCal.set(Calendar.HOUR_OF_DAY, endMin / 60);
                        endCal.set(Calendar.MINUTE, endMin % 60);
                    }
                    endCal.set(Calendar.SECOND, 0);
                    endCal.set(Calendar.MILLISECOND, 0);

                    long slotEnd = endCal.getTimeInMillis();
                    if (slotEnd > matchedSlotEndMs) {
                        matchedSlotEndMs = slotEnd;
                        String title = slot.optString("title", "Study Slot");
                        String subtitle = slot.optString("subtitle", "");
                        matchedReason = TextUtils.isEmpty(subtitle) ? title : (title + " · " + subtitle);
                        matchedUntilLabel = formatTime12h(endTime);
                    }
                }
            }
        } catch (Exception ignored) {
        }

        long manualUntilMs = getManualLockUntilMs(context);
        boolean manualActive = manualUntilMs > nowMs;

        if (matchedSlotEndMs > nowMs && (!manualActive || matchedSlotEndMs >= manualUntilMs)) {
            return new ActiveLockState(true, matchedReason, matchedUntilLabel, matchedSlotEndMs);
        }

        if (manualActive) {
            return new ActiveLockState(
                    true,
                    "Strict Study Focus Lock",
                    formatTimestamp12h(manualUntilMs),
                    manualUntilMs
            );
        }

        return new ActiveLockState(false, "", "", 0L);
    }

    public static boolean isPackageAllowed(Context context, String pkg) {
        if (TextUtils.isEmpty(pkg)) return true;

        Set<String> allowed = new HashSet<>();
        // Always allow This Week itself + essential Samsung/Android UI & emergency phone layers
        allowed.add(context.getPackageName());
        allowed.add("com.risinu.thisweek");
        allowed.add("com.android.systemui");
        allowed.add("com.sec.android.app.launcher");
        allowed.add("com.android.launcher3");
        allowed.add("com.android.permissioncontroller");
        allowed.add("com.google.android.permissioncontroller");
        allowed.add("com.samsung.android.honeyboard");
        allowed.add("com.google.android.inputmethod.latin");
        allowed.add("com.android.phone");
        allowed.add("com.android.server.telecom");
        allowed.add("com.samsung.android.telecom");
        allowed.add("com.samsung.android.dialer");
        allowed.add("com.samsung.android.incallui");
        allowed.add("com.android.incallui");
        allowed.add("com.google.android.dialer");
        allowed.add("com.android.dialer");
        allowed.add("com.samsung.android.app.contacts");
        allowed.add("com.android.contacts");
        allowed.add("com.google.android.contacts");
        allowed.add("com.sec.android.app.popupcalculator");
        allowed.add("com.samsung.android.calculator");
        allowed.add("com.google.android.calculator");
        allowed.add("com.android.calculator2");
        allowed.add("com.android.settings");

        // Resolve default Home launcher dynamically
        try {
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            ResolveInfo resolveInfo = context.getPackageManager().resolveActivity(homeIntent, PackageManager.MATCH_DEFAULT_ONLY);
            if (resolveInfo != null && resolveInfo.activityInfo != null && resolveInfo.activityInfo.packageName != null) {
                allowed.add(resolveInfo.activityInfo.packageName);
            }
        } catch (Exception ignored) {
        }

        // Merge JS-synced allowlist
        try {
            JSONArray arr = new JSONArray(prefs(context).getString(KEY_ALLOWLIST_JSON, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                String p = arr.optString(i, "");
                if (!TextUtils.isEmpty(p)) {
                    allowed.add(p);
                }
            }
        } catch (Exception ignored) {
        }

        return allowed.contains(pkg);
    }

    public static boolean wasNotified(Context context, String key) {
        Set<String> set = prefs(context).getStringSet(KEY_NOTIFIED_SET, null);
        return set != null && set.contains(key);
    }

    public static void markNotified(Context context, String key) {
        Set<String> existing = prefs(context).getStringSet(KEY_NOTIFIED_SET, null);
        Set<String> next = existing != null ? new HashSet<>(existing) : new HashSet<>();
        if (next.size() > 150) {
            next.clear();
        }
        next.add(key);
        prefs(context).edit().putStringSet(KEY_NOTIFIED_SET, next).apply();
    }
}
