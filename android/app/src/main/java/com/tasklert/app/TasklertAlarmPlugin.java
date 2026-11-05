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

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "TasklertAlarmEngine")
public class TasklertAlarmPlugin extends Plugin {

    private static final String TAG = "TasklertAlarmEngine";
    public static final String PREFS_NAME = "tasklert_alarm_prefs";

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        try {
            String id = call.getString("id", "active-focus-session");
            String title = call.getString("title", "Focus Session Complete!");
            String mode = call.getString("mode", "focus");
            long targetEndAtMs = call.getLong("targetEndAtMs", 0L);
            String soundName = call.getString("sound", "custom");
            int volume = call.getInt("volume", 80);
            boolean vibration = call.getBoolean("vibration", true);
            String ringtoneFileName = call.getString("ringtoneFileName", "Tere Vaaste.mp3");

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
                    Log.w(TAG, "Exact alarm permission not granted by user");
                }
            }

            // Check if custom ringtone exists in app storage
            File ringtoneDir = new File(context.getFilesDir(), "ringtones");
            File ringtoneFile = new File(ringtoneDir, mode + ".mp3");
            String customAudioPath = ringtoneFile.exists() ? ringtoneFile.getAbsolutePath() : null;

            if (customAudioPath == null) {
                // Check fallback to general focus ringtone
                File generalFocus = new File(ringtoneDir, "focus.mp3");
                if (generalFocus.exists()) {
                    customAudioPath = generalFocus.getAbsolutePath();
                }
            }

            // Persist alarm details in SharedPreferences for resilience across reboot
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
                .putString("alarm_ringtone_path", customAudioPath)
                .putBoolean("alarm_active", true)
                .apply();

            Intent intent = new Intent(context, FocusAlarmReceiver.class);
            intent.setAction("com.tasklert.app.ALARM_TRIGGER");
            intent.putExtra("id", id);
            intent.putExtra("title", title);
            intent.putExtra("mode", mode);
            intent.putExtra("sound", soundName);
            intent.putExtra("volume", volume);
            intent.putExtra("vibration", vibration);
            intent.putExtra("ringtoneFileName", ringtoneFileName);
            intent.putExtra("customAudioPath", customAudioPath);

            int requestCode = Math.abs(id.hashCode());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags);

            // Intent to show when user clicks the alarm clock icon in system tray
            Intent showIntent = new Intent(context, MainActivity.class);
            int showFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                showFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent showPendingIntent = PendingIntent.getActivity(context, 0, showIntent, showFlags);

            // setAlarmClock() is the highest priority user-visible exact alarm API in Android:
            // It completely bypasses Doze mode, app standby, and battery optimizations.
            AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(targetEndAtMs, showPendingIntent);
            alarmManager.setAlarmClock(clockInfo, pendingIntent);

            AlarmLogger.log("ALARM_SCHEDULED", id, "SUCCESS", "TargetMs: " + targetEndAtMs + 
                       " | Ringtone: " + customAudioPath + " | Sound: " + soundName);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("scheduledAt", targetEndAtMs);
            ret.put("mode", mode);
            ret.put("ringtonePath", customAudioPath);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "scheduleAlarm error", e);
            call.reject("Could not schedule native alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        try {
            String id = call.getString("id", "active-focus-session");
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (alarmManager != null) {
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

            // Stop any currently playing alarm service
            Intent stopService = new Intent(context, AlarmRingingService.class);
            stopService.setAction(AlarmRingingService.ACTION_DISMISS);
            context.startService(stopService);

            // Clear SharedPreferences
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean("alarm_active", false).apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
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
            call.getData().put("title", "Snoozed Focus Session (" + snoozeMinutes + "m)");
            scheduleAlarm(call);
        } catch (Exception e) {
            Log.e(TAG, "snoozeAlarm error", e);
            call.reject("Could not snooze alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getAlarmStatus(PluginCall call) {
        getDiagnosticStatus(call);
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
    public void saveCustomRingtone(PluginCall call) {
        try {
            String slot = call.getString("slot", "focus");
            String fileName = call.getString("fileName", "custom_ringtone.mp3");
            String base64Data = call.getString("base64Data");

            if (base64Data == null || base64Data.isEmpty()) {
                call.reject("base64Data is required");
                return;
            }

            // Strip data URL header if present (e.g. data:audio/mpeg;base64,...)
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }

            byte[] audioBytes = Base64.decode(base64Data, Base64.DEFAULT);

            Context context = getContext();
            File ringtoneDir = new File(context.getFilesDir(), "ringtones");
            if (!ringtoneDir.exists()) {
                ringtoneDir.mkdirs();
            }

            File targetFile = new File(ringtoneDir, slot + ".mp3");
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(audioBytes);
                fos.flush();
            }

            Log.i(TAG, "Saved custom ringtone to private storage: " + targetFile.getAbsolutePath() + 
                       " (" + audioBytes.length + " bytes)");

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("filePath", targetFile.getAbsolutePath());
            ret.put("fileName", fileName);
            ret.put("fileSize", audioBytes.length);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "saveCustomRingtone error", e);
            call.reject("Failed to save custom ringtone: " + e.getMessage());
        }
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
            File focusFile = new File(ringtoneDir, "focus.mp3");
            File shortBreakFile = new File(ringtoneDir, "short_break.mp3");
            File longBreakFile = new File(ringtoneDir, "long_break.mp3");

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean alarmActive = prefs.getBoolean("alarm_active", false);
            long targetMs = prefs.getLong("alarm_target_ms", 0L);
            String savedRingtoneName = prefs.getString("alarm_ringtone_name", "None");

            JSObject ret = new JSObject();
            ret.put("platform", "Android Native (Capacitor)");
            ret.put("isNativeEngineActive", true);
            ret.put("canScheduleExactAlarms", canScheduleExact);
            ret.put("hasNotificationPermission", notifsEnabled);
            ret.put("hasFullScreenIntentPermission", canFullScreen);
            ret.put("alarmActive", alarmActive);
            ret.put("targetEndAtMs", targetMs);
            ret.put("remainingSeconds", Math.max(0, (targetMs - System.currentTimeMillis()) / 1000));
            ret.put("savedRingtoneName", savedRingtoneName);
            ret.put("focusRingtoneExists", focusFile.exists());
            ret.put("focusRingtoneSize", focusFile.exists() ? focusFile.length() : 0);
            ret.put("shortBreakRingtoneExists", shortBreakFile.exists());
            ret.put("longBreakRingtoneExists", longBreakFile.exists());
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
            call.getData().put("targetEndAtMs", testTargetMs);
            call.getData().put("title", "🔔 Test Native Alarm");
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

