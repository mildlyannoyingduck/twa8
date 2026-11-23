package com.risinu.thisweek;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        SlotReminderReceiver.scheduleAll(context);
        SchedulePrefs.ActiveLockState state = SchedulePrefs.getActiveLockState(context);
        if (state.active || SchedulePrefs.hasAnyAutoBlockSlots(context)) {
            BlockerForegroundService.startOrUpdate(context);
        }
    }
}
