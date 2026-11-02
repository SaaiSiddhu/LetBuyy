package com.letbuyy.store

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsIntent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var accountsChannel: MethodChannel? = null
    private var pendingAccountCallback: String? = null
    private var accountBrowserActive = false
    private var callbackDelivered = false
    private val accountsRequestCode = 8172

    private fun accountCallback(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        val hosts = setOf("accounts.letbuyy.com", "accounts.staging.letbuyy.com")
        val approvedOrigin = (uri.scheme == "https" && uri.host in hosts && uri.port == -1) ||
            (BuildConfig.DEBUG && uri.scheme == "http" && uri.host == "localhost" && uri.port == 9002)
        return if (approvedOrigin && uri.path == "/merchant/auth/callback" && uri.fragment == null && uri.userInfo == null) uri.toString() else null
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        accountCallback(intent)?.let {
            callbackDelivered = true
            pendingAccountCallback = it
            accountsChannel?.invokeMethod("callback", it)
        }
    }

    @Deprecated("Custom Tab result compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == accountsRequestCode && accountBrowserActive && !callbackDelivered) {
            accountBrowserActive = false
            accountsChannel?.invokeMethod("cancelled", null)
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        pendingAccountCallback = accountCallback(intent)
        accountsChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.letbuyy.store/accounts")
        accountsChannel!!.setMethodCallHandler { call, result ->
            when (call.method) {
                "takeInitialCallback" -> { result.success(pendingAccountCallback); pendingAccountCallback = null }
                "close" -> { accountBrowserActive = false; result.success(null) }
                "open" -> {
                    val uri = call.argument<String>("url")?.let { Uri.parse(it) }
                    val allowed = uri != null && uri.path == "/mobile/authorize" && uri.userInfo == null &&
                        ((uri.scheme == "https" && uri.host in setOf("accounts.letbuyy.com", "accounts.staging.letbuyy.com") && uri.port == -1) ||
                            (BuildConfig.DEBUG && uri.scheme == "http" && uri.host in setOf("localhost", "127.0.0.1") && uri.port == 9002))
                    val browserPackage = CustomTabsClient.getPackageName(this, null)
                    if (!allowed || browserPackage == null) {
                        result.error("BROWSER_UNAVAILABLE", "A secure authentication browser is unavailable.", null)
                    } else {
                        try {
                            callbackDelivered = false
                            accountBrowserActive = true
                            val tab = CustomTabsIntent.Builder().setShowTitle(true).build()
                            tab.intent.setPackage(browserPackage)
                            tab.intent.data = uri
                            startActivityForResult(tab.intent, accountsRequestCode)
                            result.success(null)
                        } catch (_: Exception) {
                            accountBrowserActive = false
                            result.error("BROWSER_UNAVAILABLE", "Secure sign-in could not open.", null)
                        }
                    }
                }
                else -> result.notImplemented()
            }
        }

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
