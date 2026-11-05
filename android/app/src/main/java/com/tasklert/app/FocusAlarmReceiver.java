package com.tasklert.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;

public class FocusAlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String sessionId = intent != null ? intent.getStringExtra("id") : "active-focus-session";
        if (sessionId == null) sessionId = "active-focus-session";

        AlarmLogger.log("ALARM_RECEIVER_TRIGGERED", sessionId, "SUCCESS", "AlarmManager exact trigger received. Waking screen & CPU...");

        // Acquire a 15-second SCREEN_BRIGHT_WAKE_LOCK with ACQUIRE_CAUSES_WAKEUP
        // This physically turns on the device display and keeps CPU awake while launching foreground service
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            try {
                @SuppressWarnings("deprecation")
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "tasklert:FocusAlarmReceiverWakeLock"
                );
                // Acquire with 15 second auto-timeout so we never leak or hold permanently
                wakeLock.acquire(15000L);
            } catch (Exception e) {
                AlarmLogger.logError("ALARM_RECEIVER_TRIGGERED", sessionId, "Could not acquire screen wake lock", e);
            }
        }

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

            AlarmLogger.log("ALARM_SERVICE_STARTED", sessionId, "SUCCESS", "Requested AlarmRingingService foreground execution");
        } catch (Exception e) {
            AlarmLogger.logError("ALARM_SERVICE_STARTED", sessionId, "Failed to start AlarmRingingService", e);
        }
    }
}
