package com.letbuyy.letbuyy

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // APPID-P4d: "Sign in with LetBuyy" opens identity-platform in a Custom Tab and returns here.
        BuyerSignInBridge.attach(this, flutterEngine.dartExecutor.binaryMessenger)
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        BuyerSignInBridge.detach(this)
        super.cleanUpFlutterEngine(flutterEngine)
    }
}
