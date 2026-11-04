package com.tasklert.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmAlertActivity extends Activity {

    private TextView tvClock;
    private TextView tvTitle;
    private TextView tvRingtoneName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configure lock-screen and screen wakeup flags
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }

        setContentView(R.layout.activity_alarm_alert);

        tvClock = findViewById(R.id.tvClock);
        tvTitle = findViewById(R.id.tvTitle);
        tvRingtoneName = findViewById(R.id.tvRingtoneName);

        String title = getIntent().getStringExtra("title");
        String ringtoneName = getIntent().getStringExtra("ringtoneFileName");

        if (title != null && !title.isEmpty()) {
            tvTitle.setText(title);
        }

        if (ringtoneName != null && !ringtoneName.isEmpty()) {
            tvRingtoneName.setText("🎵 " + ringtoneName);
        } else {
            tvRingtoneName.setText("🎵 Custom Alarm Ringtone");
        }

        SimpleDateFormat sdf = new SimpleDateFormat("hh:mm a", Locale.getDefault());
        tvClock.setText(sdf.format(new Date()));

        // Snooze Buttons
        findViewById(R.id.btnSnooze5).setOnClickListener(v -> snooze(5));
        findViewById(R.id.btnSnooze10).setOnClickListener(v -> snooze(10));
        findViewById(R.id.btnSnooze15).setOnClickListener(v -> snooze(15));

        // Dismiss Button
        findViewById(R.id.btnDismiss).setOnClickListener(v -> dismiss());
    }

    private void snooze(int minutes) {
        Intent snoozeIntent = new Intent(this, AlarmRingingService.class);
        snoozeIntent.setAction(AlarmRingingService.ACTION_SNOOZE);
        snoozeIntent.putExtra("snoozeMinutes", minutes);
        startService(snoozeIntent);
        finish();
    }

    private void dismiss() {
        Intent dismissIntent = new Intent(this, AlarmRingingService.class);
        dismissIntent.setAction(AlarmRingingService.ACTION_DISMISS);
        startService(dismissIntent);

        // Open main app
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(openApp);
        finish();
    }
}
