package com.tasklert.app;

import android.app.ActivityOptions;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

public class FocusAlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String sessionId = intent != null ? intent.getStringExtra("id") : "active-focus-session";
        if (sessionId == null) sessionId = "active-focus-session";

        AlarmLogger.log("ALARM_RECEIVER_TRIGGERED", sessionId, "SUCCESS", 
            "AlarmManager exact trigger received. Energizing CPU & display hardware pipeline...");

        // 1. Acquire managed wake lock to physically illuminate the screen and keep CPU active
        AlarmWakeLockManager.acquire(context, sessionId, 60000L);

        // 2. Start AlarmRingingService for continuous audio looping, vibration & notification
        try {
            Intent serviceIntent = new Intent(context, AlarmRingingService.class);
            serviceIntent.setAction(AlarmRingingService.ACTION_RING);
            if (intent != null && intent.getExtras() != null) {
                serviceIntent.putExtras(intent.getExtras());
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            AlarmLogger.log("ALARM_SERVICE_STARTED", sessionId, "SUCCESS", "AlarmRingingService execution requested");
        } catch (Exception e) {
            AlarmLogger.logError("ALARM_SERVICE_STARTED", sessionId, "Failed to start AlarmRingingService", e);
        }

        // 3. Directly attempt to launch AlarmAlertActivity over the lock screen
        // Exact alarms scheduled via setAlarmClock() receive a platform exemption for background activity start
        try {
            Intent activityIntent = new Intent(context, AlarmAlertActivity.class);
            if (intent != null && intent.getExtras() != null) {
                activityIntent.putExtras(intent.getExtras());
            }
            activityIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_NO_USER_ACTION
            );

            Bundle options = null;
            if (Build.VERSION.SDK_INT >= 34) { // Android 14 (UPSIDE_DOWN_CAKE)
                options = ActivityOptions.makeBasic()
                    .setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
                    .toBundle();
            }

            AlarmLogger.log("ALARM_ACTIVITY_LAUNCH_REQUESTED", sessionId, "SUCCESS", 
                "Attempting direct startActivity from FocusAlarmReceiver with BAL options");

            if (options != null) {
                context.startActivity(activityIntent, options);
            } else {
                context.startActivity(activityIntent);
            }
        } catch (Exception e) {
            AlarmLogger.log("ALARM_ACTIVITY_LAUNCH_REQUESTED", sessionId, "DEFERRED", 
                "Direct launch deferred to Notification fullScreenIntent: " + e.getMessage());
        }
    }
}
