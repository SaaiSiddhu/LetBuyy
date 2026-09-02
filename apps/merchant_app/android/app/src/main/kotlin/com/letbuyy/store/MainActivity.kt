package com.letbuyy.store

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "com.letbuyy.store/home_widgets",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "publishMetricsSnapshot" -> {
                    MerchantMetricsWidgetProvider.refreshAll(this)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "com.letbuyy.store/app_badge",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "setBadgeCount",
                "clearBadge" -> result.success(null)
                else -> result.notImplemented()
            }
        }
    }
}
