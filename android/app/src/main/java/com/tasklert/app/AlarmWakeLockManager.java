package com.tasklert.app;

import android.content.Context;
import android.os.PowerManager;
import android.util.Log;

public class AlarmWakeLockManager {

    private static final String TAG = "AlarmWakeLockManager";
    private static PowerManager.WakeLock sCpuWakeLock;
    private static PowerManager.WakeLock sScreenWakeLock;

    public static synchronized void acquire(Context context, String sessionId, long timeoutMs) {
        if (context == null) return;
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;

        try {
            // 1. Partial CPU WakeLock ensures the device CPU continues processing even under deep Doze
            if (sCpuWakeLock == null || !sCpuWakeLock.isHeld()) {
                sCpuWakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "tasklert:AlarmCpuWakeLock"
                );
                sCpuWakeLock.setReferenceCounted(false);
                sCpuWakeLock.acquire(Math.max(timeoutMs, 60000L));
            }

            // 2. Screen WakeLock with ACQUIRE_CAUSES_WAKEUP illuminates physical display
            @SuppressWarnings("deprecation")
            int screenFlags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                              PowerManager.ACQUIRE_CAUSES_WAKEUP |
                              PowerManager.ON_AFTER_RELEASE;

            if (sScreenWakeLock == null || !sScreenWakeLock.isHeld()) {
                sScreenWakeLock = pm.newWakeLock(screenFlags, "tasklert:AlarmScreenWakeLock");
                sScreenWakeLock.setReferenceCounted(false);
                // 15 seconds is ample time for the AlarmAlertActivity window to attach and take over screen-on
                sScreenWakeLock.acquire(15000L);
            }

            AlarmLogger.log("WAKE_LOCK_ACQUIRED", sessionId, "SUCCESS", 
                "CPU & Screen WakeLocks acquired (isInteractive=" + pm.isInteractive() + ")");

        } catch (Exception e) {
            AlarmLogger.logError("WAKE_LOCK_ACQUIRED", sessionId, "Could not acquire wake locks: " + e.getMessage(), e);
        }
    }

    public static synchronized void release(String sessionId) {
        try {
            if (sScreenWakeLock != null && sScreenWakeLock.isHeld()) {
                sScreenWakeLock.release();
                sScreenWakeLock = null;
            }
            if (sCpuWakeLock != null && sCpuWakeLock.isHeld()) {
                sCpuWakeLock.release();
                sCpuWakeLock = null;
            }
            AlarmLogger.log("WAKE_LOCK_RELEASED", sessionId, "SUCCESS", "All wake locks safely released");
        } catch (Exception e) {
            Log.w(TAG, "Error releasing wake lock: " + e.getMessage());
        }
    }
}

