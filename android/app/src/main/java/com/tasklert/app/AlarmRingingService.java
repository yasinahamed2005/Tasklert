package com.tasklert.app;

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
                channel.setDescription("High-priority alarm notifications that wake the screen");
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                channel.setBypassDnd(true);
                // Keep channel sound null because MediaPlayer handles the exact custom audio loop
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

        AlarmLogger.log("ALARM_SERVICE_STARTED", currentSessionId, "SUCCESS", "Service running for session: " + currentSessionId);

        // 1. Build and post Foreground Notification with FullScreenIntent
        Notification notification = buildAlarmNotification(currentSessionId, title, mode, ringtoneFileName);
        startForeground(NOTIFICATION_ID, notification);

        // 2. Start Audio Playback via MediaPlayer (exact custom ringtone preserved)
        startAudioPlayback(customAudioPath, volume, ringtoneFileName);

        // 3. Start Hardware Vibration
        if (vibration) {
            startVibration();
        }

        // 4. Request full-screen Lock Screen Activity
        launchLockScreenActivity(currentSessionId, title, mode, ringtoneFileName);

        return START_STICKY;
    }

    private void acquireScreenWakeLock() {
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                @SuppressWarnings("deprecation")
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "tasklert:AlarmRingingWakeLock"
                );
                wakeLock = wl;
                wakeLock.acquire(10 * 60 * 1000L); // 10 minutes max timeout
            }
        }
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

    private Notification buildAlarmNotification(String id, String title, String mode, String ringtoneFileName) {
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
        fullScreenIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(this, 101, fullScreenIntent, flags);

        // 2. VIEW TIMER ACTION (Activity PendingIntent): opens Tasklert to /focus
        Intent viewTimerIntent = new Intent(this, MainActivity.class);
        viewTimerIntent.setAction(Intent.ACTION_VIEW);
        viewTimerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        viewTimerIntent.putExtra("route", "/focus");
        PendingIntent viewTimerPendingIntent = PendingIntent.getActivity(this, 102, viewTimerIntent, flags);

        // 3. DISMISS ACTION (BroadcastReceiver PendingIntent): dismisses directly WITHOUT opening any Activity!
        Intent dismissIntent = new Intent(this, AlarmDismissReceiver.class);
        dismissIntent.setAction(AlarmDismissReceiver.ACTION_DISMISS);
        dismissIntent.putExtra("id", id);
        dismissIntent.putExtra("mode", mode);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(this, 103, dismissIntent, flags);

        // 4. SNOOZE ACTION (BroadcastReceiver PendingIntent): reschedules directly WITHOUT opening any Activity!
        Intent snoozeIntent = new Intent(this, AlarmDismissReceiver.class);
        snoozeIntent.setAction(AlarmDismissReceiver.ACTION_SNOOZE);
        snoozeIntent.putExtra("snoozeMinutes", 5);
        snoozeIntent.putExtra("id", id);
        snoozeIntent.putExtra("mode", mode);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(this, 104, snoozeIntent, flags);

        AlarmLogger.log("ALARM_FULL_SCREEN_REQUESTED", id, "SUCCESS", "Constructed high-priority notification with fullScreenIntent & broadcast actions");

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
            .addAction(android.R.drawable.ic_menu_view, "👉 View Timer", viewTimerPendingIntent)
            .addAction(android.R.drawable.ic_popup_sync, "💤 Snooze 5m", snoozePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "✕ Dismiss", dismissPendingIntent)
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
            AlarmLogger.log("ALARM_ACTIVITY_DISPLAYED", id, "REQUESTED", "Dispatched startActivity for AlarmAlertActivity");
        } catch (Exception e) {
            AlarmLogger.log("ALARM_ACTIVITY_DISPLAYED", id, "BACKGROUND_RESTRICTED", 
                "startActivity deferred to notification fullScreenIntent: " + e.getMessage());
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
