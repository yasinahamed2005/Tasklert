package com.tasklert.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

public class FocusAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "FocusAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(TAG, "ALARM TRIGGERED BY ANDROID ALARMMANAGER! Waking device CPU & audio engine...");

        // Acquire a temporary 10-second WakeLock to guarantee execution while launching service
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "tasklert:FocusAlarmReceiverWakeLock"
            );
            wakeLock.acquire(10000L);
        }

        try {
            Intent serviceIntent = new Intent(context, AlarmRingingService.class);
            serviceIntent.setAction(AlarmRingingService.ACTION_RING);
            serviceIntent.putExtras(intent);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }

            Log.i(TAG, "Successfully started AlarmRingingService from BroadcastReceiver");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start AlarmRingingService", e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try {
                    wakeLock.release();
                } catch (Exception ignored) {}
            }
        }
    }
}

