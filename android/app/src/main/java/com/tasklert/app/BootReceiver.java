package com.tasklert.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "TasklertBootReceiver";

    @Override
    public void onReceive(Context context, Intent bootIntent) {
        String action = bootIntent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {

            Log.i(TAG, "Device rebooted. Checking active Tasklert alarms to restore...");

            SharedPreferences prefs = context.getSharedPreferences(TasklertAlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE);
            boolean alarmActive = prefs.getBoolean("alarm_active", false);
            long targetMs = prefs.getLong("alarm_target_ms", 0L);

            if (alarmActive && targetMs > System.currentTimeMillis()) {
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null) {
                    Intent intent = new Intent(context, FocusAlarmReceiver.class);
                    intent.setAction("com.tasklert.app.ALARM_TRIGGER");
                    intent.putExtra("id", prefs.getString("alarm_id", "restored-focus"));
                    intent.putExtra("title", prefs.getString("alarm_title", "Focus Session Complete!"));
                    intent.putExtra("mode", prefs.getString("alarm_mode", "focus"));
                    intent.putExtra("sound", prefs.getString("alarm_sound", "custom"));
                    intent.putExtra("volume", prefs.getInt("alarm_volume", 80));
                    intent.putExtra("vibration", prefs.getBoolean("alarm_vibration", true));
                    intent.putExtra("ringtoneFileName", prefs.getString("alarm_ringtone_name", "Tere Vaaste.mp3"));
                    intent.putExtra("customAudioPath", prefs.getString("alarm_ringtone_path", null));

                    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        flags |= PendingIntent.FLAG_IMMUTABLE;
                    }

                    PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 888, intent, flags);

                    Intent showIntent = new Intent(context, MainActivity.class);
                    PendingIntent showPi = PendingIntent.getActivity(context, 0, showIntent, flags);

                    AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(targetMs, showPi);
                    alarmManager.setAlarmClock(clockInfo, pendingIntent);

                    Log.i(TAG, "Successfully restored scheduled Focus alarm for: " + targetMs);
                }
            }
        }
    }
}
