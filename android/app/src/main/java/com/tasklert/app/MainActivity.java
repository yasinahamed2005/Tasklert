package com.tasklert.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TasklertAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
