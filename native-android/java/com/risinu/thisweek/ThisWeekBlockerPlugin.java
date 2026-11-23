package com.risinu.thisweek;

import android.Manifest;
import android.app.AppOpsManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.provider.Settings;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ThisWeekBlocker")
public class ThisWeekBlockerPlugin extends Plugin {

    private static final int REQ_NOTIFICATIONS = 4109;

    @PluginMethod
    public void syncScheduleAndLock(PluginCall call) {
        Context ctx = getContext();
        String slotsJson = call.getString("slotsJson", "[]");
        Double manualObj = call.getDouble("manualLockUntilMs", 0.0);
        long manualLockUntilMs = manualObj != null ? manualObj.longValue() : 0L;
        JSArray allowlist = call.getArray("allowlistPackages");

        SchedulePrefs.saveSyncData(ctx, slotsJson, manualLockUntilMs, allowlist);
        SlotReminderReceiver.scheduleAll(ctx);

        SchedulePrefs.ActiveLockState lockState = SchedulePrefs.getActiveLockState(ctx);
        if (lockState.active || SchedulePrefs.hasAnyAutoBlockSlots(ctx)) {
            BlockerForegroundService.startOrUpdate(ctx);
        } else {
            BlockerForegroundService.stopService(ctx);
        }

        call.resolve();
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        ret.put("isNativeAndroid", true);
        ret.put("usageAccess", hasUsageStatsPermission(ctx));
        ret.put("overlayAccess", hasOverlayPermission(ctx));
        ret.put("notifications", hasNotificationPermission(ctx));
        ret.put("batteryUnrestricted", isIgnoringBatteryOptimizations(ctx));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        String type = call.getString("type", "");
        Context ctx = getContext();

        if ("usage".equals(type)) {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
            return;
        }

        if ("overlay".equals(type)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + ctx.getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            }
            call.resolve();
            return;
        }

        if ("notifications".equals(type)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotificationPermission(ctx)) {
                if (getActivity() != null) {
                    ActivityCompat.requestPermissions(
                            getActivity(),
                            new String[]{Manifest.permission.POST_NOTIFICATIONS},
                            REQ_NOTIFICATIONS
                    );
                }
            } else {
                Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            }
            call.resolve();
            return;
        }

        if ("battery".equals(type)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:" + ctx.getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            }
            call.resolve();
            return;
        }

        call.resolve();
    }

    @PluginMethod
    public void sendNotificationNow(PluginCall call) {
        Context ctx = getContext();
        String title = call.getString("title", "This Week");
        String body = call.getString("body", "Study reminder");
        SlotReminderReceiver.postHeadsUpNotification(ctx, title, body);
        call.resolve();
    }

    @PluginMethod
    public void saveVaultSnapshot(PluginCall call) {
        Context ctx = getContext();
        String vaultJson = call.getString("vaultJson", "");
        if (vaultJson != null && !vaultJson.isEmpty()) {
            SchedulePrefs.saveVaultJson(ctx, vaultJson);
        }
        call.resolve();
    }

    @PluginMethod
    public void loadVaultSnapshot(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        ret.put("vaultJson", SchedulePrefs.getVaultJson(ctx));
        call.resolve(ret);
    }

    @PluginMethod
    public void exportBackupFile(PluginCall call) {
        Context ctx = getContext();
        String fileName = call.getString("fileName", "ThisWeek-Backup.json");
        String vaultJson = call.getString("vaultJson", "");
        JSObject ret = new JSObject();
        if (vaultJson == null || vaultJson.isEmpty()) {
            ret.put("ok", false);
            ret.put("error", "Empty backup data");
            call.resolve(ret);
            return;
        }
        try {
            byte[] bytes = vaultJson.getBytes(StandardCharsets.UTF_8);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = ctx.getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ThisWeek");
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (OutputStream os = resolver.openOutputStream(uri)) {
                        if (os != null) {
                            os.write(bytes);
                            os.flush();
                        }
                    }
                    ret.put("ok", true);
                    ret.put("savedPath", "Downloads/ThisWeek/" + fileName);
                    call.resolve(ret);
                    return;
                }
            }
            File dir = new File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    "ThisWeek"
            );
            if (!dir.exists()) dir.mkdirs();
            File outFile = new File(dir, fileName);
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(bytes);
                fos.flush();
            }
            ret.put("ok", true);
            ret.put("savedPath", outFile.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", e.getMessage() != null ? e.getMessage() : "Could not write to Downloads");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void shareBackupFile(PluginCall call) {
        Context ctx = getContext();
        String fileName = call.getString("fileName", "ThisWeek-Backup.json");
        String vaultJson = call.getString("vaultJson", "");
        JSObject ret = new JSObject();
        try {
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType("text/plain");
            sendIntent.putExtra(Intent.EXTRA_SUBJECT, fileName);
            sendIntent.putExtra(Intent.EXTRA_TEXT, vaultJson);
            Intent chooser = Intent.createChooser(sendIntent, "Save or Share " + fileName);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(chooser);
            ret.put("ok", true);
        } catch (Exception e) {
            ret.put("ok", false);
        }
        call.resolve(ret);
    }

    public static boolean hasUsageStatsPermission(Context ctx) {
        try {
            AppOpsManager appOps = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return false;
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = appOps.unsafeCheckOpNoThrow(
                        AppOpsManager.OPSTR_GET_USAGE_STATS,
                        android.os.Process.myUid(),
                        ctx.getPackageName()
                );
            } else {
                mode = appOps.checkOpNoThrow(
                        AppOpsManager.OPSTR_GET_USAGE_STATS,
                        android.os.Process.myUid(),
                        ctx.getPackageName()
                );
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    public static boolean hasOverlayPermission(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return Settings.canDrawOverlays(ctx);
    }

    public static boolean hasNotificationPermission(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    public static boolean isIgnoringBatteryOptimizations(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }
}
