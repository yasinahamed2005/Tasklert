package com.tasklert.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Tasklert Multi-Alarm Boot Receiver
 * Automatically restores all valid future alarms after device reboot.
 * Handles:
 * - Android ACTION_BOOT_COMPLETED & QUICKBOOT_POWERON
 * - Rescheduling of multiple concurrent alarms (Focus, Clock, Reminder)
 * - Purging of expired alarms (> 15 minutes ago)
 * - Missed alarm notification for alarms due during reboot (< 15 minutes ago)
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "TasklertBootReceiver";

    @Override
    public void onReceive(Context context, Intent bootIntent) {
        if (bootIntent == null) return;

        String action = bootIntent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {

            Log.i(TAG, "Device rebooted. Inspecting Tasklert multi-alarm registry...");

            try {
                JSONObject registry = TasklertAlarmPlugin.getAlarmRegistry(context);
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

                if (alarmManager == null) {
                    Log.e(TAG, "AlarmManager unavailable during boot completion");
                    return;
                }

                long now = System.currentTimeMillis();
                int restoredCount = 0;
                int missedCount = 0;
                List<String> toRemove = new ArrayList<>();

                Iterator<String> keys = registry.keys();
                while (keys.hasNext()) {
                    String id = keys.next();
                    JSONObject item = registry.getJSONObject(id);
                    long targetEndAtMs = item.optLong("targetEndAtMs", 0L);

                    if (targetEndAtMs > now) {
                        // 1. Future Alarm: Re-schedule exact alarm with setAlarmClock()
                        Intent intent = new Intent(context, FocusAlarmReceiver.class);
                        intent.setAction("com.tasklert.app.ALARM_TRIGGER");
                        intent.putExtra("id", id);
                        intent.putExtra("title", item.optString("title", "Tasklert Alarm"));
                        intent.putExtra("message", item.optString("message", ""));
                        intent.putExtra("mode", item.optString("mode", "reminder"));
                        intent.putExtra("alarmType", item.optString("alarmType", "reminder"));
                        intent.putExtra("sound", item.optString("sound", "custom"));
                        intent.putExtra("volume", item.optInt("volume", 80));
                        intent.putExtra("vibration", item.optBoolean("vibration", true));
                        intent.putExtra("ringtoneFileName", item.optString("ringtoneFileName", "Global Ringtone.mp3"));
                        intent.putExtra("customAudioPath", item.optString("customAudioPath", null));

                        int requestCode = Math.abs(id.hashCode());
                        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            flags |= PendingIntent.FLAG_IMMUTABLE;
                        }

                        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags);
                        Intent showIntent = new Intent(context, MainActivity.class);
                        PendingIntent showPi = PendingIntent.getActivity(context, requestCode, showIntent, flags);

                        AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(targetEndAtMs, showPi);
                        alarmManager.setAlarmClock(clockInfo, pendingIntent);

                        restoredCount++;
                        AlarmLogger.log("ALARM_RESTORED_AFTER_REBOOT", id, "SUCCESS",
                            "Restored targetMs=" + targetEndAtMs + " | title=" + item.optString("title", ""));

                    } else if (now - targetEndAtMs < 15 * 60 * 1000L) {
                        // 2. Missed Alarm: Due while phone was powering off/rebooting (< 15 mins ago)
                        missedCount++;
                        Intent intent = new Intent(context, FocusAlarmReceiver.class);
                        intent.setAction("com.tasklert.app.ALARM_TRIGGER");
                        intent.putExtra("id", id);
                        intent.putExtra("title", "⚠️ Missed Alarm: " + item.optString("title", "Alarm"));
                        intent.putExtra("message", "This alarm was due while your device was rebooting.");
                        intent.putExtra("mode", item.optString("mode", "reminder"));
                        intent.putExtra("alarmType", item.optString("alarmType", "reminder"));
                        intent.putExtra("sound", item.optString("sound", "custom"));
                        intent.putExtra("volume", item.optInt("volume", 80));
                        intent.putExtra("vibration", true);
                        intent.putExtra("customAudioPath", item.optString("customAudioPath", null));

                        context.sendBroadcast(intent);
                        toRemove.add(id);

                        AlarmLogger.log("MISSED_ALARM_RECOVERED", id, "SUCCESS",
                            "Triggered missed alarm alert for alarm due during reboot (" + (now - targetEndAtMs) / 1000 + "s ago)");
                    } else {
                        // 3. Stale expired alarm (> 15 mins ago): mark for removal
                        toRemove.add(id);
                    }
                }

                // Clean expired alarms from registry
                for (String expiredId : toRemove) {
                    registry.remove(expiredId);
                }
                TasklertAlarmPlugin.saveAlarmRegistry(context, registry);

                Log.i(TAG, "Reboot recovery complete: " + restoredCount + " alarms restored, " +
                    missedCount + " missed alarms recovered, " + toRemove.size() + " expired alarms purged.");

            } catch (Exception e) {
                Log.e(TAG, "Failed to restore alarms after reboot", e);
                AlarmLogger.logError("BOOT_RESTORE_FAILED", "system", "Exception in BootReceiver", e);
            }
        }
    }
}
