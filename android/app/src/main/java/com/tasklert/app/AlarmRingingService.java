package com.tasklert.app;

import android.app.ActivityOptions;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;

public class AlarmRingingService extends Service {

    private static final String TAG = "AlarmRingingService";
    public static final String CHANNEL_ID = "tasklert_focus_alarms_v3";
    public static final int NOTIFICATION_ID = 998877;

    public static final String ACTION_RING = "com.tasklert.app.ACTION_RING";
    public static final String ACTION_SNOOZE = "com.tasklert.app.ACTION_SNOOZE";
    public static final String ACTION_DISMISS = "com.tasklert.app.ACTION_DISMISS";

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private String currentSessionId = "active-focus-session";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Tasklert Focus Alarms",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("High-priority alarm notifications that wake the screen and display over lockscreen");
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                channel.setBypassDnd(true);
                channel.enableLights(true);

                // Configure channel with Alarm audio attributes so Android SystemUI treats it as an active interruptive alarm
                Uri defaultAlarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (defaultAlarmUri == null) {
                    defaultAlarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                channel.setSound(defaultAlarmUri, audioAttributes);
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 500, 200, 500});

                nm.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        Log.i(TAG, "onStartCommand action: " + action);

        if (ACTION_DISMISS.equals(action)) {
            handleDismiss();
            return START_NOT_STICKY;
        } else if (ACTION_SNOOZE.equals(action)) {
            int snoozeMinutes = intent.getIntExtra("snoozeMinutes", 5);
            handleSnooze(snoozeMinutes);
            return START_NOT_STICKY;
        }

        currentSessionId = intent.getStringExtra("id");
        if (currentSessionId == null || currentSessionId.isEmpty()) {
            currentSessionId = "active-focus-session";
        }
        String title = intent.getStringExtra("title");
        String mode = intent.getStringExtra("mode");
        String customAudioPath = intent.getStringExtra("customAudioPath");
        String ringtoneFileName = intent.getStringExtra("ringtoneFileName");
        int volume = intent.getIntExtra("volume", 80);
        boolean vibration = intent.getBooleanExtra("vibration", true);

        if (title == null || title.isEmpty()) {
            title = "focus".equals(mode) ? "🎯 Focus Session Complete!" : "☕ Break Over!";
        }

        // Check full-screen intent permission on Android 14+ (API 34)
        boolean hasFullScreenPermission = true;
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                hasFullScreenPermission = nm.canUseFullScreenIntent();
            }
        }
        AlarmLogger.log("FULL_SCREEN_PERMISSION_CHECK", currentSessionId, 
            hasFullScreenPermission ? "GRANTED" : "DENIED", 
            "API=" + Build.VERSION.SDK_INT + " | canUseFullScreenIntent=" + hasFullScreenPermission);

        // 1. Build and post Foreground Notification with FullScreenIntent
        Notification notification = buildAlarmNotification(currentSessionId, title, mode, ringtoneFileName, customAudioPath);
        startForeground(NOTIFICATION_ID, notification);
        AlarmLogger.log("ALARM_NOTIFICATION_CREATED", currentSessionId, "SUCCESS", "Foreground alarm notification posted");

        // 2. Start Audio Playback via MediaPlayer (exact custom ringtone preserved)
        startAudioPlayback(customAudioPath, volume, ringtoneFileName);

        // 3. Start Hardware Vibration
        if (vibration) {
            startVibration();
        }

        // 4. Request full-screen Lock Screen Activity with Background Activity Launch exemption options
        launchLockScreenActivity(currentSessionId, title, mode, ringtoneFileName, customAudioPath);

        return START_STICKY;
    }

    private void startAudioPlayback(String customAudioPath, int volume, String ringtoneFileName) {
        stopAudioPlayback();

        try {
            mediaPlayer = new MediaPlayer();

            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(attrs);

            boolean loaded = false;
            String sourceDesc = "System Alarm Fallback";

            if (customAudioPath != null) {
                File file = new File(customAudioPath);
                if (file.exists() && file.canRead()) {
                    mediaPlayer.setDataSource(customAudioPath);
                    loaded = true;
                    sourceDesc = "Custom MP3: " + customAudioPath;
                }
            }

            if (!loaded) {
                // Check if general focus ringtone exists
                File fallbackFile = new File(new File(getFilesDir(), "ringtones"), "focus.mp3");
                if (fallbackFile.exists() && fallbackFile.canRead()) {
                    mediaPlayer.setDataSource(fallbackFile.getAbsolutePath());
                    loaded = true;
                    sourceDesc = "Fallback MP3: " + fallbackFile.getAbsolutePath();
                }
            }

            if (!loaded) {
                Uri alert = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alert == null) {
                    alert = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }
                mediaPlayer.setDataSource(this, alert);
                sourceDesc = "Android System Alarm URI";
            }

            float vol = Math.max(0.1f, Math.min(1.0f, volume / 100.0f));
            mediaPlayer.setVolume(vol, vol);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();

            AlarmLogger.log("ALARM_AUDIO_STARTED", currentSessionId, "SUCCESS", 
                "Playing: " + (ringtoneFileName != null ? ringtoneFileName : sourceDesc) + " | Volume: " + volume + "%");

        } catch (Exception e) {
            AlarmLogger.logError("ALARM_AUDIO_STARTED", currentSessionId, "Error initializing MediaPlayer", e);
        }
    }

    private void stopAudioPlayback() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
            AlarmLogger.log("ALARM_AUDIO_STOPPED", currentSessionId, "SUCCESS", "MediaPlayer released");
        }
    }

    private void startVibration() {
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 800, 400, 800, 400, 1200};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Vibration error: " + e.getMessage());
        }
    }

    private void stopVibration() {
        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception ignored) {}
            vibrator = null;
        }
    }

    private Notification buildAlarmNotification(String id, String title, String mode, String ringtoneFileName, String customAudioPath) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // 1. FULL SCREEN INTENT: launches AlarmAlertActivity over the lock screen
        Intent fullScreenIntent = new Intent(this, AlarmAlertActivity.class);
        fullScreenIntent.putExtra("id", id);
        fullScreenIntent.putExtra("title", title);
        fullScreenIntent.putExtra("mode", mode);
        fullScreenIntent.putExtra("ringtoneFileName", ringtoneFileName);
        fullScreenIntent.putExtra("customAudioPath", customAudioPath);
        fullScreenIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_NO_USER_ACTION
        );

        Bundle options = null;
        if (Build.VERSION.SDK_INT >= 34) { // Android 14+
            options = ActivityOptions.makeBasic()
                .setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
                .toBundle();
        }

        PendingIntent fullScreenPendingIntent;
        if (options != null) {
            fullScreenPendingIntent = PendingIntent.getActivity(this, 101, fullScreenIntent, flags, options);
        } else {
            fullScreenPendingIntent = PendingIntent.getActivity(this, 101, fullScreenIntent, flags);
        }

        AlarmLogger.log("FULL_SCREEN_INTENT_ATTACHED", id, "SUCCESS", 
            "Attached PendingIntent for AlarmAlertActivity with BAL background exemption");

        // 2. VIEW TIMER ACTION
        Intent viewTimerIntent = new Intent(this, MainActivity.class);
        viewTimerIntent.setAction(Intent.ACTION_VIEW);
        viewTimerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        viewTimerIntent.putExtra("route", "/focus");
        PendingIntent viewTimerPendingIntent = PendingIntent.getActivity(this, 102, viewTimerIntent, flags);

        // 3. DISMISS ACTION (BroadcastReceiver PendingIntent)
        Intent dismissIntent = new Intent(this, AlarmDismissReceiver.class);
        dismissIntent.setAction(AlarmDismissReceiver.ACTION_DISMISS);
        dismissIntent.putExtra("id", id);
        dismissIntent.putExtra("mode", mode);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(this, 103, dismissIntent, flags);

        // 4. SNOOZE ACTION (BroadcastReceiver PendingIntent)
        Intent snoozeIntent = new Intent(this, AlarmDismissReceiver.class);
        snoozeIntent.setAction(AlarmDismissReceiver.ACTION_SNOOZE);
        snoozeIntent.putExtra("snoozeMinutes", 5);
        snoozeIntent.putExtra("id", id);
        snoozeIntent.putExtra("mode", mode);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(this, 104, snoozeIntent, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏰ " + title)
            .setContentText("Ringtone: " + (ringtoneFileName != null ? ringtoneFileName : "Custom Alarm"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(viewTimerPendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .addAction(android.R.drawable.ic_popup_sync, "💤 Snooze 5m", snoozePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "✕ Dismiss", dismissPendingIntent)
            .build();
    }

    private void launchLockScreenActivity(String id, String title, String mode, String ringtoneFileName, String customAudioPath) {
        try {
            Intent alertIntent = new Intent(this, AlarmAlertActivity.class);
            alertIntent.putExtra("id", id);
            alertIntent.putExtra("title", title);
            alertIntent.putExtra("mode", mode);
            alertIntent.putExtra("ringtoneFileName", ringtoneFileName);
            alertIntent.putExtra("customAudioPath", customAudioPath);
            alertIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_NO_USER_ACTION
            );

            Bundle options = null;
            if (Build.VERSION.SDK_INT >= 34) {
                options = ActivityOptions.makeBasic()
                    .setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
                    .toBundle();
            }

            if (options != null) {
                startActivity(alertIntent, options);
            } else {
                startActivity(alertIntent);
            }
            AlarmLogger.log("ALARM_ACTIVITY_LAUNCH_REQUESTED", id, "SUCCESS", 
                "Dispatched startActivity for AlarmAlertActivity from AlarmRingingService");
        } catch (Exception e) {
            AlarmLogger.log("ALARM_ACTIVITY_LAUNCH_REQUESTED", id, "BACKGROUND_RESTRICTED", 
                "startActivity deferred to Notification fullScreenIntent: " + e.getMessage());
        }
    }

    private void handleSnooze(int minutes) {
        Intent snoozeBroadcast = new Intent(this, AlarmDismissReceiver.class);
        snoozeBroadcast.setAction(AlarmDismissReceiver.ACTION_SNOOZE);
        snoozeBroadcast.putExtra("snoozeMinutes", minutes);
        snoozeBroadcast.putExtra("id", currentSessionId);
        sendBroadcast(snoozeBroadcast);
    }

    private void handleDismiss() {
        stopAudioPlayback();
        stopVibration();

        SharedPreferences prefs = getSharedPreferences(TasklertAlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("alarm_active", false).apply();

        cleanupAndStop();
    }

    private void cleanupAndStop() {
        AlarmWakeLockManager.release(currentSessionId);
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopAudioPlayback();
        stopVibration();
        AlarmWakeLockManager.release(currentSessionId);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
