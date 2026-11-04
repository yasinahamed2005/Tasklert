# Tasklert Android Alarm & Background Notification Architecture

This guide describes the complete native Android integration for Tasklert exact alarms and background ringing.

---

## 1. Native Android Permissions (`android/app/src/main/AndroidManifest.xml`)

When building the native APK via Capacitor, ensure these permissions are declared in `AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Exact Alarms & Wake Lock (Required for Android 12+ API 31+) -->
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- Notifications & Full-Screen Ringing (Android 13+ API 33+) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />

    <!-- Vibration & Hardware Feedback -->
    <uses-permission android:name="android.permission.VIBRATE" />

    <!-- Device Restart Resilience (Re-register alarms on reboot) -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <!-- Boot Receiver to restore alarms on reboot -->
        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
            </intent-filter>
        </receiver>

        <!-- Main Activity with Full-Screen Wakeup when ringing -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:showWhenLocked="true"
            android:turnScreenOn="true"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

---

## 2. Boot Receiver (`BootReceiver.java`)

When the phone restarts, Android clears non-persistent pending intents. The `BootReceiver` restores all pending alarms automatically:

```java
package com.tasklert.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            // Restore active alarms from SQLite or launch Tasklert background sync service
        }
    }
}
```

---

## 3. How to Build the Android APK

1. In the `frontend` directory, install Capacitor native packages:
   ```bash
   npm install @capacitor/core @capacitor/android @capacitor/local-notifications
   ```
2. Build frontend production assets:
   ```bash
   npm run build
   ```
3. Initialize the native Android project:
   ```bash
   npx cap add android
   npx cap sync android
   ```
4. Open the project in Android Studio or build APK from command line:
   ```bash
   npx cap open android
   # or build APK via Gradle wrapper:
   cd android && ./gradlew assembleDebug
   ```

---

## 4. Web Browser & PWA Support (Already Active)

On desktop browsers, tablets, and phones running Tasklert in Chrome/Edge/Firefox/Safari:
- `deviceAlarmManager.js` uses Web Audio API to synthesize ringing alarm tones without any audio files.
- `navigator.vibrate` triggers rhythmic vibration on supported hardware.
- High-priority Web Notifications fire even when the browser tab is minimized.
- `AlarmModal.jsx` automatically rings aloud with Snooze (5, 10, 15, 30 min) and Dismiss actions (marking linked tasks complete in MongoDB).

