package com.tasklert.app;

import android.util.Log;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmLogger {

    private static final String TAG = "TASKLERT_ALARM";
    private static final SimpleDateFormat DATE_FORMAT = 
        new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US);

    public static void log(String action, String sessionId, String result, String details) {
        String timestamp = DATE_FORMAT.format(new Date());
        String msg = String.format(
            Locale.US,
            "[%s] action=%s | sessionId=%s | timestamp=%s | result=%s | details=%s",
            TAG,
            action != null ? action : "UNKNOWN",
            sessionId != null ? sessionId : "none",
            timestamp,
            result != null ? result : "UNKNOWN",
            details != null ? details : ""
        );
        Log.i(TAG, msg);
    }

    public static void logError(String action, String sessionId, String error, Throwable tr) {
        String timestamp = DATE_FORMAT.format(new Date());
        String msg = String.format(
            Locale.US,
            "[%s] action=%s | sessionId=%s | timestamp=%s | result=FAILED | error=%s",
            TAG,
            action != null ? action : "UNKNOWN",
            sessionId != null ? sessionId : "none",
            timestamp,
            error != null ? error : "Unknown error"
        );
        if (tr != null) {
            Log.e(TAG, msg, tr);
        } else {
            Log.e(TAG, msg);
        }
    }
}

