package com.tasklert.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Iterator;

/**
 * Tasklert Unified Native Alarm Engine (v4 - Multi-Alarm Registry & Global Ringtone)
 *
 * Provides authoritative Samsung-clock grade background scheduling for:
 * 1. Focus Timer
 * 2. Short Break
 * 3. Long Break
 * 4. Clock Alarms
 * 5. Smart Reminders
 *
 * Uses AlarmManager.setAlarmClock() which bypasses Android Doze mode and battery optimizations.
 * Persists scheduled alarms in a multi-alarm JSON registry for reliable reboot recovery.
 */
@CapacitorPlugin(name = "TasklertAlarmEngine")
public class TasklertAlarmPlugin extends Plugin {

    private static final String TAG = "TasklertAlarmEngine";
    public static final String PREFS_NAME = "tasklert_alarm_prefs";
    public static final String KEY_ALARM_REGISTRY = "tasklert_alarm_registry_json";
    public static final String GLOBAL_RINGTONE_FILE = "global_ringtone.mp3";

    /**
     * Helper to load the multi-alarm registry JSONObject from SharedPreferences
     */
    public static JSONObject getAlarmRegistry(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String jsonStr = prefs.getString(KEY_ALARM_REGISTRY, "{}");
        try {
            return new JSONObject(jsonStr);
        } catch (Exception e) {
            Log.w(TAG, "Failed to parse alarm registry JSON, resetting", e);
            return new JSONObject();
        }
    }

    /**
     * Helper to save the multi-alarm registry JSONObject to SharedPreferences
     */
    public static void saveAlarmRegistry(Context context, JSONObject registry) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_ALARM_REGISTRY, registry.toString()).apply();
    }

    /**
     * Resolve the active global ringtone file or fallback
     */
    public static String resolveRingtonePath(Context context, String customAudioPath, String mode) {
        File ringtoneDir = new File(context.getFilesDir(), "ringtones");

        // 1. Explicit path passed and exists
        if (customAudioPath != null && !customAudioPath.isEmpty()) {
            File explicit = new File(customAudioPath);
            if (explicit.exists() && explicit.canRead()) {
                return explicit.getAbsolutePath();
            }
        }

        // 2. Global Ringtone (Phase 4 requirement: ONE GLOBAL TASKLERT RINGTONE)
        File globalFile = new File(ringtoneDir, GLOBAL_RINGTONE_FILE);
        if (globalFile.exists() && globalFile.canRead()) {
            return globalFile.getAbsolutePath();
        }

        // 3. Mode-specific ringtone (backward compatibility with earlier slots)
        if (mode != null && !mode.isEmpty()) {
            File modeFile = new File(ringtoneDir, mode + ".mp3");
            if (modeFile.exists() && modeFile.canRead()) {
                return modeFile.getAbsolutePath();
            }
        }

        // 4. Focus fallback
        File focusFile = new File(ringtoneDir, "focus.mp3");
        if (focusFile.exists() && focusFile.canRead()) {
            return focusFile.getAbsolutePath();
        }

        return null; // System default alarm tone fallback
    }

    /**
     * Schedule an exact native alarm using setAlarmClock()
     */
    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        try {
            String id = call.getString("id", "alarm-" + System.currentTimeMillis());
            String title = call.getString("title", "Tasklert Alarm");
            String message = call.getString("message", "");
            String mode = call.getString("mode", "reminder"); // 'focus', 'short_break', 'long_break', 'clock', 'reminder'
            String alarmType = call.getString("alarmType", mode);
            long targetEndAtMs = call.getLong("targetEndAtMs", 0L);
            String soundName = call.getString("sound", "custom");
            int volume = call.getInt("volume", 80);
            boolean vibration = call.getBoolean("vibration", true);
            String ringtoneFileName = call.getString("ringtoneFileName", "Global Ringtone.mp3");
            String customAudioPath = call.getString("customAudioPath", null);

            if (targetEndAtMs <= System.currentTimeMillis()) {
                call.reject("targetEndAtMs must be in the future");
                return;
            }

            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (alarmManager == null) {
                call.reject("AlarmManager unavailable");
                return;
            }

            // Check if exact alarms are allowed (Android 12+ API 31+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!alarmManager.canScheduleExactAlarms()) {
                    Log.w(TAG, "Exact alarm permission not granted by user. Requesting permission...");
                }
            }

            // Resolve ringtone file
            String resolvedAudioPath = resolveRingtonePath(context, customAudioPath, mode);

            // 1. Build Intent for FocusAlarmReceiver
            Intent intent = new Intent(context, FocusAlarmReceiver.class);
            intent.setAction("com.tasklert.app.ALARM_TRIGGER");
            intent.putExtra("id", id);
            intent.putExtra("title", title);
            intent.putExtra("message", message);
            intent.putExtra("mode", mode);
            intent.putExtra("alarmType", alarmType);
            intent.putExtra("sound", soundName);
            intent.putExtra("volume", volume);
            intent.putExtra("vibration", vibration);
            intent.putExtra("ringtoneFileName", ringtoneFileName);
            intent.putExtra("customAudioPath", resolvedAudioPath);

            int requestCode = Math.abs(id.hashCode());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags);

            // Intent to show when user clicks the alarm clock icon in system tray
            Intent showIntent = new Intent(context, MainActivity.class);
            PendingIntent showPendingIntent = PendingIntent.getActivity(context, requestCode, showIntent, flags);

            // setAlarmClock() is the highest priority exact alarm API in Android:
            // Completely bypasses Doze mode, app standby, and battery optimizations.
            AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(targetEndAtMs, showPendingIntent);
            alarmManager.setAlarmClock(clockInfo, pendingIntent);

            // 2. Persist in multi-alarm JSON registry for multi-alarm reboot recovery
            JSONObject registry = getAlarmRegistry(context);
            JSONObject alarmRecord = new JSONObject();
            alarmRecord.put("id", id);
            alarmRecord.put("title", title);
            alarmRecord.put("message", message);
            alarmRecord.put("mode", mode);
            alarmRecord.put("alarmType", alarmType);
            alarmRecord.put("targetEndAtMs", targetEndAtMs);
            alarmRecord.put("sound", soundName);
            alarmRecord.put("volume", volume);
            alarmRecord.put("vibration", vibration);
            alarmRecord.put("ringtoneFileName", ringtoneFileName);
            alarmRecord.put("customAudioPath", resolvedAudioPath);
            alarmRecord.put("createdAt", System.currentTimeMillis());

            registry.put(id, alarmRecord);
            saveAlarmRegistry(context, registry);

            // Maintain backward compatibility for single-alarm preferences
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putString("alarm_id", id)
                .putString("alarm_title", title)
                .putString("alarm_mode", mode)
                .putLong("alarm_target_ms", targetEndAtMs)
                .putString("alarm_sound", soundName)
                .putInt("alarm_volume", volume)
                .putBoolean("alarm_vibration", vibration)
                .putString("alarm_ringtone_name", ringtoneFileName)
                .putString("alarm_ringtone_path", resolvedAudioPath)
                .putBoolean("alarm_active", true)
                .apply();

            AlarmLogger.log("ALARM_SCHEDULED", id, "SUCCESS",
                "TargetMs: " + targetEndAtMs + " | Type: " + alarmType + " | Ringtone: " + resolvedAudioPath);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("id", id);
            ret.put("scheduledAt", targetEndAtMs);
            ret.put("mode", mode);
            ret.put("alarmType", alarmType);
            ret.put("ringtonePath", resolvedAudioPath);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "scheduleAlarm error", e);
            call.reject("Could not schedule native alarm: " + e.getMessage());
        }
    }

    /**
     * Cancel an existing alarm by ID
     */
    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        try {
            String id = call.getString("id", "active-focus-session");
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (alarmManager != null && id != null) {
                Intent intent = new Intent(context, FocusAlarmReceiver.class);
                intent.setAction("com.tasklert.app.ALARM_TRIGGER");
                int requestCode = Math.abs(id.hashCode());
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags);
                alarmManager.cancel(pendingIntent);
            }

            // Remove from native multi-alarm JSON registry
            JSONObject registry = getAlarmRegistry(context);
            if (id != null && registry.has(id)) {
                registry.remove(id);
                saveAlarmRegistry(context, registry);
            }

            // Stop any currently playing alarm service if it matches this id or default
            Intent stopService = new Intent(context, AlarmRingingService.class);
            stopService.setAction(AlarmRingingService.ACTION_DISMISS);
            context.startService(stopService);

            // Update legacy SharedPreferences
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            if (id == null || id.equals(prefs.getString("alarm_id", ""))) {
                prefs.edit().putBoolean("alarm_active", false).apply();
            }

            AlarmLogger.log("ALARM_CANCELLED", id, "SUCCESS", "Alarm cancelled from AlarmManager and native registry");

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("id", id);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "cancelAlarm error", e);
            call.reject("Could not cancel alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void dismissAlarm(PluginCall call) {
        cancelAlarm(call);
    }

    @PluginMethod
    public void snoozeAlarm(PluginCall call) {
        try {
            int snoozeMinutes = call.getInt("snoozeMinutes", 5);
            Context context = getContext();

            // 1. Stop current ringing
            Intent stopService = new Intent(context, AlarmRingingService.class);
            stopService.setAction(AlarmRingingService.ACTION_DISMISS);
            context.startService(stopService);

            // 2. Schedule snooze alarm
            long targetEndAtMs = System.currentTimeMillis() + (snoozeMinutes * 60 * 1000L);
            call.getData().put("targetEndAtMs", targetEndAtMs);
            String oldTitle = call.getString("title", "Alarm");
            call.getData().put("title", "Snoozed (" + snoozeMinutes + "m): " + oldTitle);
            scheduleAlarm(call);
        } catch (Exception e) {
            Log.e(TAG, "snoozeAlarm error", e);
            call.reject("Could not snooze alarm: " + e.getMessage());
        }
    }

    /**
     * Retrieve all active scheduled alarms from native registry
     */
    @PluginMethod
    public void getScheduledAlarms(PluginCall call) {
        try {
            Context context = getContext();
            JSONObject registry = getAlarmRegistry(context);
            long now = System.currentTimeMillis();

            JSArray list = new JSArray();
            Iterator<String> keys = registry.keys();

            while (keys.hasNext()) {
                String key = keys.next();
                JSONObject item = registry.getJSONObject(key);
                long targetMs = item.optLong("targetEndAtMs", 0L);

                if (targetMs > now) {
                    JSObject obj = new JSObject();
                    obj.put("id", item.optString("id", key));
                    obj.put("title", item.optString("title", "Alarm"));
                    obj.put("message", item.optString("message", ""));
                    obj.put("mode", item.optString("mode", "reminder"));
                    obj.put("alarmType", item.optString("alarmType", "reminder"));
                    obj.put("targetEndAtMs", targetMs);
                    obj.put("remainingSeconds", Math.max(0, (targetMs - now) / 1000));
                    list.put(obj);
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("count", list.length());
            ret.put("alarms", list);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not retrieve scheduled alarms: " + e.getMessage());
        }
    }

    /**
     * Restore/re-schedule all active future alarms from registry (e.g. after update or reboot)
     */
    @PluginMethod
    public void restoreScheduledAlarms(PluginCall call) {
        try {
            Context context = getContext();
            JSONObject registry = getAlarmRegistry(context);
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            long now = System.currentTimeMillis();
            int restoredCount = 0;

            if (alarmManager != null) {
                Iterator<String> keys = registry.keys();
                while (keys.hasNext()) {
                    String id = keys.next();
                    JSONObject item = registry.getJSONObject(id);
                    long targetEndAtMs = item.optLong("targetEndAtMs", 0L);

                    if (targetEndAtMs > now) {
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
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("restoredCount", restoredCount);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Restore failed: " + e.getMessage());
        }
    }

    /**
     * Save Global Ringtone MP3 file into private native app storage
     * Phase 4: ONE GLOBAL TASKLERT RINGTONE used by all alarm types
     */
    @PluginMethod
    public void saveGlobalRingtone(PluginCall call) {
        try {
            String fileName = call.getString("fileName", "custom_ringtone.mp3");
            String base64Data = call.getString("base64Data");

            if (base64Data == null || base64Data.isEmpty()) {
                call.reject("base64Data is required");
                return;
            }

            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }

            byte[] audioBytes = Base64.decode(base64Data, Base64.DEFAULT);

            Context context = getContext();
            File ringtoneDir = new File(context.getFilesDir(), "ringtones");
            if (!ringtoneDir.exists()) {
                ringtoneDir.mkdirs();
            }

            // Write to global_ringtone.mp3
            File globalTarget = new File(ringtoneDir, GLOBAL_RINGTONE_FILE);
            try (FileOutputStream fos = new FileOutputStream(globalTarget)) {
                fos.write(audioBytes);
                fos.flush();
            }

            // Mirror to focus.mp3 for backward compatibility with existing services
            File focusTarget = new File(ringtoneDir, "focus.mp3");
            try (FileOutputStream fos = new FileOutputStream(focusTarget)) {
                fos.write(audioBytes);
                fos.flush();
            }

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putString("global_ringtone_name", fileName)
                .putString("global_ringtone_path", globalTarget.getAbsolutePath())
                .putLong("global_ringtone_size", audioBytes.length)
                .apply();

            Log.i(TAG, "Saved ONE GLOBAL RINGTONE to: " + globalTarget.getAbsolutePath() + " (" + audioBytes.length + " bytes)");

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("filePath", globalTarget.getAbsolutePath());
            ret.put("fileName", fileName);
            ret.put("fileSize", audioBytes.length);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "saveGlobalRingtone error", e);
            call.reject("Failed to save global ringtone: " + e.getMessage());
        }
    }

    /**
     * Retrieve global ringtone status
     */
    @PluginMethod
    public void getGlobalRingtone(PluginCall call) {
        try {
            Context context = getContext();
            File ringtoneDir = new File(context.getFilesDir(), "ringtones");
            File globalFile = new File(ringtoneDir, GLOBAL_RINGTONE_FILE);
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

            JSObject ret = new JSObject();
            ret.put("exists", globalFile.exists() && globalFile.canRead());
            ret.put("filePath", globalFile.exists() ? globalFile.getAbsolutePath() : null);
            ret.put("fileName", prefs.getString("global_ringtone_name", globalFile.exists() ? "Global Ringtone.mp3" : "None"));
            ret.put("fileSize", globalFile.exists() ? globalFile.length() : 0);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("getGlobalRingtone error: " + e.getMessage());
        }
    }

    /**
     * Legacy slot-based custom ringtone saver (mirrors to global_ringtone.mp3 as well)
     */
    @PluginMethod
    public void saveCustomRingtone(PluginCall call) {
        saveGlobalRingtone(call);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        try {
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            boolean exactAlarm = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                exactAlarm = alarmManager != null && alarmManager.canScheduleExactAlarms();
            }

            boolean notifications = NotificationManagerCompat.from(context).areNotificationsEnabled();

            boolean fullScreen = true;
            if (Build.VERSION.SDK_INT >= 34) {
                android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    fullScreen = nm.canUseFullScreenIntent();
                }
            }

            JSObject ret = new JSObject();
            ret.put("exactAlarm", exactAlarm);
            ret.put("notifications", notifications);
            ret.put("fullScreenIntent", fullScreen);
            ret.put("allGranted", exactAlarm && notifications && fullScreen);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not check permissions: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkExactAlarmPermission(PluginCall call) {
        try {
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            boolean exactAlarm = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                exactAlarm = alarmManager != null && alarmManager.canScheduleExactAlarms();
            }
            JSObject ret = new JSObject();
            ret.put("granted", exactAlarm);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not check exact alarm permission: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkFullScreenIntentPermission(PluginCall call) {
        try {
            Context context = getContext();
            boolean fullScreen = true;
            if (Build.VERSION.SDK_INT >= 34) {
                android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    fullScreen = nm.canUseFullScreenIntent();
                }
            }
            JSObject ret = new JSObject();
            ret.put("granted", fullScreen);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not check full-screen permission: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestAlarmPermissions(PluginCall call) {
        try {
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(android.net.Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } else if (Build.VERSION.SDK_INT >= 34) {
                openFullScreenIntentSettings(call);
                return;
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not request permissions: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getAlarmStatus(PluginCall call) {
        getDiagnosticStatus(call);
    }

    @PluginMethod
    public void getDiagnosticStatus(PluginCall call) {
        try {
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            boolean canScheduleExact = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                canScheduleExact = alarmManager != null && alarmManager.canScheduleExactAlarms();
            }

            boolean notifsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled();

            boolean canFullScreen = true;
            if (Build.VERSION.SDK_INT >= 34) {
                android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    canFullScreen = nm.canUseFullScreenIntent();
                }
            }

            File ringtoneDir = new File(context.getFilesDir(), "ringtones");
            File globalFile = new File(ringtoneDir, GLOBAL_RINGTONE_FILE);
            File focusFile = new File(ringtoneDir, "focus.mp3");

            JSONObject registry = getAlarmRegistry(context);
            long now = System.currentTimeMillis();
            int activeCount = 0;
            long nextAlarmMs = Long.MAX_VALUE;

            Iterator<String> keys = registry.keys();
            while (keys.hasNext()) {
                JSONObject item = registry.getJSONObject(keys.next());
                long targetMs = item.optLong("targetEndAtMs", 0L);
                if (targetMs > now) {
                    activeCount++;
                    if (targetMs < nextAlarmMs) {
                        nextAlarmMs = targetMs;
                    }
                }
            }

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String savedRingtoneName = prefs.getString("global_ringtone_name", prefs.getString("alarm_ringtone_name", "None"));

            JSObject ret = new JSObject();
            ret.put("platform", "Android Native (Capacitor)");
            ret.put("isNativeEngineActive", true);
            ret.put("canScheduleExactAlarms", canScheduleExact);
            ret.put("hasNotificationPermission", notifsEnabled);
            ret.put("hasFullScreenIntentPermission", canFullScreen);
            ret.put("activeAlarmCount", activeCount);
            ret.put("nextAlarmMs", nextAlarmMs == Long.MAX_VALUE ? null : nextAlarmMs);
            ret.put("remainingSeconds", nextAlarmMs == Long.MAX_VALUE ? 0 : Math.max(0, (nextAlarmMs - now) / 1000));
            ret.put("savedRingtoneName", savedRingtoneName);
            ret.put("globalRingtoneExists", globalFile.exists() && globalFile.canRead());
            ret.put("globalRingtoneSize", globalFile.exists() ? globalFile.length() : 0);
            ret.put("focusRingtoneExists", focusFile.exists() && focusFile.canRead());
            ret.put("androidVersion", Build.VERSION.RELEASE);
            ret.put("apiLevel", Build.VERSION.SDK_INT);

            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "getDiagnosticStatus error", e);
            call.reject("Could not get diagnostic status: " + e.getMessage());
        }
    }

    @PluginMethod
    public void testAlarm(PluginCall call) {
        try {
            long testTargetMs = System.currentTimeMillis() + 5000L; // 5 seconds from now
            call.getData().put("id", "test-alarm-" + System.currentTimeMillis());
            call.getData().put("targetEndAtMs", testTargetMs);
            call.getData().put("title", "🔔 Test Native Tasklert Alarm");
            call.getData().put("message", "Samsung Clock-style background alarm test succeeded!");
            call.getData().put("mode", "clock");
            scheduleAlarm(call);
        } catch (Exception e) {
            call.reject("Test alarm error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= 34) {
                Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                intent.setData(android.net.Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } else {
                Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(android.net.Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open settings: " + e.getMessage());
        }
    }
}
