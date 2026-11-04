package com.tasklert.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;

public class AlarmRingingService extends Service {

    private static final String TAG = "AlarmRingingService";
    public static final String CHANNEL_ID = "tasklert_focus_alarms_v2";
    public static final int NOTIFICATION_ID = 998877;

    public static final String ACTION_RING = "com.tasklert.app.ACTION_RING";
    public static final String ACTION_SNOOZE = "com.tasklert.app.ACTION_SNOOZE";
    public static final String ACTION_DISMISS = "com.tasklert.app.ACTION_DISMISS";

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

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
                channel.setDescription("High-priority alarm notifications that wake the screen");
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                // Keep channel sound null because MediaPlayer handles the exact custom audio
                channel.setSound(null, null);
                channel.enableVibration(false); // Managed directly by Vibrator service
                channel.enableLights(true);
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

        // Action is ACTION_RING
        acquireScreenWakeLock();

        String id = intent.getStringExtra("id");
        String title = intent.getStringExtra("title");
        String mode = intent.getStringExtra("mode");
        String customAudioPath = intent.getStringExtra("customAudioPath");
        String ringtoneFileName = intent.getStringExtra("ringtoneFileName");
        int volume = intent.getIntExtra("volume", 80);
        boolean vibration = intent.getBooleanExtra("vibration", true);

        if (title == null || title.isEmpty()) {
            title = "focus".equals(mode) ? "🎯 Focus Session Complete!" : "☕ Break Over!";
        }

        // Start Foreground Service with Heads-up & FullScreenIntent
        Notification notification = buildAlarmNotification(id, title, mode, ringtoneFileName);
        startForeground(NOTIFICATION_ID, notification);

        // Start Audio Playback via MediaPlayer
        startAudioPlayback(customAudioPath, volume);

        // Start Hardware Vibration
        if (vibration) {
            startVibration();
        }

        // Launch full-screen Lock Screen Activity
        launchLockScreenActivity(id, title, mode, ringtoneFileName);

        return START_STICKY;
    }

    private void acquireScreenWakeLock() {
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "tasklert:AlarmRingingWakeLock"
                );
                wakeLock.acquire(10 * 60 * 1000L); // 10 minutes max timeout
            }
        }
    }

    private void startAudioPlayback(String customAudioPath, int volume) {
        stopAudioPlayback();

        try {
            mediaPlayer = new MediaPlayer();

            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(attrs);

            boolean loaded = false;
            if (customAudioPath != null) {
                File file = new File(customAudioPath);
                if (file.exists() && file.canRead()) {
                    mediaPlayer.setDataSource(customAudioPath);
                    loaded = true;
                    Log.i(TAG, "Playing exact custom ringtone from disk: " + customAudioPath);
                }
            }

            if (!loaded) {
                // Fallback to system alarm ringtone
                Uri alert = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alert == null) {
                    alert = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }
                mediaPlayer.setDataSource(this, alert);
                Log.i(TAG, "Playing default system alarm tone fallback");
            }

            float vol = Math.max(0.1f, Math.min(1.0f, volume / 100.0f));
            mediaPlayer.setVolume(vol, vol);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();

        } catch (Exception e) {
            Log.e(TAG, "Error starting MediaPlayer", e);
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
            Log.warn(TAG, "Vibration error", e);
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

    private Notification buildAlarmNotification(String id, String title, String mode, String ringtoneFileName) {
        Intent fullScreenIntent = new Intent(this, AlarmAlertActivity.class);
        fullScreenIntent.putExtra("id", id);
        fullScreenIntent.putExtra("title", title);
        fullScreenIntent.putExtra("mode", mode);
        fullScreenIntent.putExtra("ringtoneFileName", ringtoneFileName);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(this, 101, fullScreenIntent, flags);

        // Snooze Action (5 mins)
        Intent snoozeIntent = new Intent(this, AlarmRingingService.class);
        snoozeIntent.setAction(ACTION_SNOOZE);
        snoozeIntent.putExtra("snoozeMinutes", 5);
        PendingIntent snoozePendingIntent = PendingIntent.getService(this, 102, snoozeIntent, flags);

        // Dismiss Action
        Intent dismissIntent = new Intent(this, AlarmRingingService.class);
        dismissIntent.setAction(ACTION_DISMISS);
        PendingIntent dismissPendingIntent = PendingIntent.getService(this, 103, dismissIntent, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏰ " + title)
            .setContentText("Ringtone: " + (ringtoneFileName != null ? ringtoneFileName : "Custom Alarm"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setOngoing(true)
            .setAutoCancel(false)
            .addAction(android.R.drawable.ic_popup_sync, "Snooze 5m", snoozePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent)
            .build();
    }

    private void launchLockScreenActivity(String id, String title, String mode, String ringtoneFileName) {
        try {
            Intent alertIntent = new Intent(this, AlarmAlertActivity.class);
            alertIntent.putExtra("id", id);
            alertIntent.putExtra("title", title);
            alertIntent.putExtra("mode", mode);
            alertIntent.putExtra("ringtoneFileName", ringtoneFileName);
            alertIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            startActivity(alertIntent);
        } catch (Exception e) {
            Log.e(TAG, "Could not launch AlarmAlertActivity directly: " + e.getMessage());
        }
    }

    private void handleSnooze(int minutes) {
        Log.i(TAG, "Handling Snooze for " + minutes + " minutes");
        stopAudioPlayback();
        stopVibration();

        long targetMs = System.currentTimeMillis() + (minutes * 60 * 1000L);
        Context context = getApplicationContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        if (alarmManager != null) {
            Intent intent = new Intent(context, FocusAlarmReceiver.class);
            intent.setAction("com.tasklert.app.ALARM_TRIGGER");
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
        }

        cleanupAndStop();
    }

    private void handleDismiss() {
        Log.i(TAG, "Handling Dismiss");
        stopAudioPlayback();
        stopVibration();

        // Clear active alarm flag in preferences
        SharedPreferences prefs = getSharedPreferences(TasklertAlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("alarm_active", false).apply();

        cleanupAndStop();
    }

    private void cleanupAndStop() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
            wakeLock = null;
        }

        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopAudioPlayback();
        stopVibration();
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
            wakeLock = null;
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
