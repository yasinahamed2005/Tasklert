package com.tasklert.app;

import android.graphics.Color;
import android.os.Build;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    @PluginMethod
    public void setNavigationBar(PluginCall call) {
        String colorValue = call.getString("color", "#faf5ff");
        boolean lightIcons = call.getBoolean("lightIcons", false);
        final int color;
        try {
            color = Color.parseColor(colorValue);
        } catch (IllegalArgumentException error) {
            call.reject("Invalid navigation bar color.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().setNavigationBarColor(color);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
                getActivity().getWindow(), getBridge().getWebView());
            // The compat flag means dark system icons when true.
            controller.setAppearanceLightNavigationBars(!lightIcons);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                getActivity().getWindow().setNavigationBarContrastEnforced(false);
            }
            call.resolve();
        });
    }
}
