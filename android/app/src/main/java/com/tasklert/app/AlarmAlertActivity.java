package com.tasklert.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmAlertActivity extends Activity {

    private TextView tvClockHours;
    private TextView tvClockMinutes;
    private TextView tvDate;
    private TextView tvTitle;
    private TextView tvRingtoneName;
    private TextView tvSnoozeLabel;

    private int selectedSnoozeMinutes = 5;
    private String sessionId = "active-focus-session";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        sessionId = getIntent().getStringExtra("id");
        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = "active-focus-session";
        }

        AlarmLogger.log("ALARM_ACTIVITY_ON_CREATE", sessionId, "SUCCESS", 
            "Configuring window parameters for lock-screen wake-up (SDK=" + Build.VERSION.SDK_INT + ")");

        // 1. Modern Android 8.1+ (API 27+) lock-screen wake-up APIs
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        }

        // 2. Hardware Window Flags across all Android versions to guarantee screen stays ON and unlocked
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );

        setContentView(R.layout.activity_alarm_alert);

        tvClockHours = findViewById(R.id.tvClockHours);
        tvClockMinutes = findViewById(R.id.tvClockMinutes);
        tvDate = findViewById(R.id.tvDate);
        tvTitle = findViewById(R.id.tvTitle);
        tvRingtoneName = findViewById(R.id.tvRingtoneName);
        tvSnoozeLabel = findViewById(R.id.tvSnoozeLabel);
        TextView tvBrand = findViewById(R.id.tvBrand);

        // Bind intent data
        String title = getIntent().getStringExtra("title");
        String ringtoneName = getIntent().getStringExtra("ringtoneFileName");
        String mode = getIntent().getStringExtra("mode");
        String alarmType = getIntent().getStringExtra("alarmType");

        if (tvBrand != null) {
            if ("clock".equalsIgnoreCase(mode) || "clock".equalsIgnoreCase(alarmType)) {
                tvBrand.setText("TASKLERT CLOCK ALARM");
            } else if ("reminder".equalsIgnoreCase(mode) || "reminder".equalsIgnoreCase(alarmType)) {
                tvBrand.setText("TASKLERT SMART REMINDER");
            } else {
                tvBrand.setText("TASKLERT FOCUS");
            }
        }

        if (title != null && !title.isEmpty()) {
            tvTitle.setText(title);
        }

        if (ringtoneName != null && !ringtoneName.isEmpty()) {
            tvRingtoneName.setText("🎵 " + ringtoneName);
        } else {
            tvRingtoneName.setText("🎵 Custom Alarm Ringtone");
        }

        // Populate Samsung Clock Time & Date
        Date now = new Date();
        SimpleDateFormat sdfHours = new SimpleDateFormat("hh", Locale.getDefault());
        SimpleDateFormat sdfMinutes = new SimpleDateFormat("mm", Locale.getDefault());
        SimpleDateFormat sdfDate = new SimpleDateFormat("EEE, MMMM d", Locale.getDefault());

        tvClockHours.setText(sdfHours.format(now));
        tvClockMinutes.setText(sdfMinutes.format(now));
        tvDate.setText(sdfDate.format(now));

        // Circular Dismiss button
        findViewById(R.id.btnDismiss).setOnClickListener(v -> dismiss());

        // Snooze Bar controls
        FrameLayout btnMinus = findViewById(R.id.btnSnoozeMinus);
        FrameLayout btnPlus = findViewById(R.id.btnSnoozePlus);
        FrameLayout btnPill = findViewById(R.id.btnSnoozePill);

        btnMinus.setOnClickListener(v -> adjustSnooze(-5));
        btnPlus.setOnClickListener(v -> adjustSnooze(5));
        btnPill.setOnClickListener(v -> snooze(selectedSnoozeMinutes));
    }

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        // Re-enforce lock-screen display on vendor devices (Samsung OneUI, Xiaomi MIUI)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        AlarmLogger.log("ALARM_ACTIVITY_ON_RESUME", sessionId, "SUCCESS", "AlarmAlertActivity resumed");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            AlarmLogger.log("ALARM_ACTIVITY_VISIBLE", sessionId, "SUCCESS", 
                "AlarmAlertActivity has window focus and is visibly displayed over lockscreen");
            AlarmLogger.log("SCREEN_WAKE_SUCCESS", sessionId, "SUCCESS", 
                "Device display verified ON and Tasklert alarm UI active");

            // Release wake lock safely now that Activity window has fully taken over
            AlarmWakeLockManager.release(sessionId);
        }
    }

    private void adjustSnooze(int delta) {
        int next = selectedSnoozeMinutes + delta;
        if (next < 5) next = 5;
        if (next > 30) next = 30;
        selectedSnoozeMinutes = next;
        tvSnoozeLabel.setText("Snooze " + selectedSnoozeMinutes + " mins");
    }

    private void snooze(int minutes) {
        AlarmLogger.log("ALARM_DISMISS_ACTION_RECEIVED", sessionId, "SUCCESS", 
            "Snooze requested for " + minutes + " mins");

        Intent snoozeIntent = new Intent(this, AlarmDismissReceiver.class);
        snoozeIntent.setAction(AlarmDismissReceiver.ACTION_SNOOZE);
        snoozeIntent.putExtra("snoozeMinutes", minutes);
        snoozeIntent.putExtra("id", sessionId);
        sendBroadcast(snoozeIntent);

        AlarmWakeLockManager.release(sessionId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask();
        } else {
            finish();
        }
    }

    private void dismiss() {
        AlarmLogger.log("ALARM_DISMISS_ACTION_RECEIVED", sessionId, "SUCCESS", "Dismiss clicked in AlarmAlertActivity");

        Intent dismissIntent = new Intent(this, AlarmDismissReceiver.class);
        dismissIntent.setAction(AlarmDismissReceiver.ACTION_DISMISS);
        dismissIntent.putExtra("id", sessionId);
        sendBroadcast(dismissIntent);

        AlarmWakeLockManager.release(sessionId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask();
        } else {
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        AlarmWakeLockManager.release(sessionId);
        super.onDestroy();
    }
}
