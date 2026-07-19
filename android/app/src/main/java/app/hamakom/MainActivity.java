package app.hamakom;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Android 15+ (targetSdk 35+) force-enables edge-to-edge and IGNORES
    // Window#setDecorFitsSystemWindows / windowOptOutEdgeToEdgeEnforcement,
    // so there is no reliable native opt-out anymore. Instead, Capacitor's
    // SystemBars plugin reports the system-bar insets to the WebView
    // (env(safe-area-inset-*) / --safe-area-inset-* variables) and the web
    // layer pads its own headers, sheets, and bottom nav (see the --hm-sat /
    // --hm-sab variables in index.html).
}
