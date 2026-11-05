package com.tasklert.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;

public class AlarmDismissReceiver extends BroadcastReceiver {

    public static final String ACTION_DISMISS = "com.tasklert.app.ACTION_DISMISS_ALARM";
    public static final String ACTION_SNOOZE = "com.tasklert.app.ACTION_SNOOZE_ALARM";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        String sessionId = intent.getStringExtra("id");
        if (sessionId == null || sessionId.isEmpty()) {
            SharedPreferences prefs = context.getSharedPreferences(TasklertAlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE);
            sessionId = prefs.getString("alarm_id", "active-focus-session");
        }

        if (ACTION_DISMISS.equals(action)) {
            handleDismiss(context, sessionId, intent);
        } else if (ACTION_SNOOZE.equals(action)) {
            int snoozeMinutes = intent.getIntExtra("snoozeMinutes", 5);
            handleSnooze(context, sessionId, snoozeMinutes);
        }
    }

    private void handleDismiss(Context context, String sessionId, Intent intent) {
        AlarmLogger.log("ALARM_DISMISS_ACTION_RECEIVED", sessionId, "SUCCESS", "Dismiss triggered via notification or lockscreen button");

        SharedPreferences prefs = context.getSharedPreferences(TasklertAlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE);

        // Duplicate action protection: check if already dismissed within the last 5 seconds
        String lastDismissedId = prefs.getString("last_dismissed_session_id", "");
        long lastDismissedTime = prefs.getLong("last_dismissed_timestamp", 0L);
        long now = System.currentTimeMillis();

        if (sessionId.equals(lastDismissedId) && (now - lastDismissedTime) < 5000L) {
            AlarmLogger.log("ALARM_DISMISS_ACTION_RECEIVED", sessionId, "IGNORED_DUPLICATE", "Duplicate dismissal click within 5 seconds");
            return;
        }

        // 1. Tell AlarmRingingService to stop audio and finish
        try {
            Intent stopService = new Intent(context, AlarmRingingService.class);
            stopService.setAction(AlarmRingingService.ACTION_DISMISS);
            context.startService(stopService);
            AlarmLogger.log("ALARM_AUDIO_STOPPED", sessionId, "SUCCESS", "MediaPlayer and vibrator stopped");
        } catch (Exception e) {
            AlarmLogger.logError("ALARM_AUDIO_STOPPED", sessionId, "Failed to send stop to AlarmRingingService", e);
        }

        // 2. Cancel Notification explicitly
        try {
            NotificationManagerCompat.from(context).cancel(AlarmRingingService.NOTIFICATION_ID);
            AlarmLogger.log("ALARM_NOTIFICATION_CANCELLED", sessionId, "SUCCESS", "Notification ID " + AlarmRingingService.NOTIFICATION_ID + " removed from shade");
        } catch (Exception e) {
            AlarmLogger.logError("ALARM_NOTIFICATION_CANCELLED", sessionId, "Failed to cancel notification", e);
        }

        // 3. Mark alarm as inactive & record dismissal timestamp
        prefs.edit()
            .putBoolean("alarm_active", false)
            .putString("last_dismissed_session_id", sessionId)
            .putLong("last_dismissed_timestamp", now)
            .apply();

        AlarmLogger.log("ALARM_SESSION_DISMISSED", sessionId, "SUCCESS", "Session marked dismissed in native storage; phone remaining on existing screen without launching Activity");
    }

    private void handleSnooze(Context context, String sessionId, int minutes) {
        AlarmLogger.log("ALARM_DISMISS_ACTION_RECEIVED", sessionId, "SUCCESS", "Snooze action received for " + minutes + " minutes");

        // 1. Stop current audio and dismiss current notification
        try {
            Intent stopService = new Intent(context, AlarmRingingService.class);
            stopService.setAction(AlarmRingingService.ACTION_DISMISS);
            context.startService(stopService);
            AlarmLogger.log("ALARM_AUDIO_STOPPED", sessionId, "SUCCESS", "Stopped audio before snoozing");
        } catch (Exception ignored) {}

        try {
            NotificationManagerCompat.from(context).cancel(AlarmRingingService.NOTIFICATION_ID);
            AlarmLogger.log("ALARM_NOTIFICATION_CANCELLED", sessionId, "SUCCESS", "Notification cancelled for snooze");
        } catch (Exception ignored) {}

        // 2. Schedule next exact alarm via AlarmManager setAlarmClock()
        long targetMs = System.currentTimeMillis() + (minutes * 60 * 1000L);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        if (alarmManager != null) {
            Intent intent = new Intent(context, FocusAlarmReceiver.class);
            intent.setAction("com.tasklert.app.ALARM_TRIGGER");
            intent.putExtra("id", sessionId);
            intent.putExtra("title", "⏰ Snoozed Focus Alarm");
            intent.putExtra("mode", "focus");

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getBroadcast(context, 777, intent, flags);

            Intent showIntent = new Intent(context, MainActivity.class);
            PendingIntent showPi = PendingIntent.getActivity(context, 0, showIntent, flags);

            AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(targetMs, showPi);
            alarmManager.setAlarmClock(clockInfo, pi);

            // Update SharedPreferences with new target time
            SharedPreferences prefs = context.getSharedPreferences(TasklertAlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putBoolean("alarm_active", true)
                .putLong("alarm_target_ms", targetMs)
                .apply();

            AlarmLogger.log("ALARM_SNOOZE_SCHEDULED", sessionId, "SUCCESS", "Snoozed for " + minutes + " mins, next alarm at " + targetMs);
        } else {
            AlarmLogger.logError("ALARM_SNOOZE_SCHEDULED", sessionId, "AlarmManager unavailable", null);
        }
    }
}

