package com.letbuyy.letbuyy

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel

/**
 * APPID-P4d — the native half of "Sign in with LetBuyy".
 *
 * Opens identity-platform in the system browser as a Custom Tab, in this app's own task, and hands the
 * browser's callback back to Dart. Never a WebView (RFC 8252 §8.12): the buyer's password is typed into
 * identity-platform's page in a browser this app cannot read. Holds no token and no verifier; the Dart
 * side keeps those in protected storage and checks every callback against the attempt it started.
 */
object BuyerSignInBridge {
    private const val CHANNEL = "com.letbuyy.letbuyy/buyer_sign_in"
    const val CALLBACK_SCHEME = "com.letbuyy.letbuyy"

    private var activity: Activity? = null
    private var waiting: MethodChannel.Result? = null
    private var launchCallback: String? = null

    fun attach(activity: Activity, messenger: BinaryMessenger) {
        // A new engine: a call the previous one was waiting on can never be answered there. A callback
        // that arrives from now on is kept for the new engine to collect.
        finishWaiting()
        this.activity = activity
        MethodChannel(messenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "authorize" -> authorize(call.argument<String>("url"), result)
                "cancelWaiting" -> {
                    finishWaiting()
                    result.success(null)
                }
                "takeLaunchCallback" -> {
                    val kept = launchCallback
                    launchCallback = null
                    result.success(kept)
                }
                else -> result.notImplemented()
            }
        }
    }

    fun detach(activity: Activity) {
        if (this.activity === activity) {
            finishWaiting()
            this.activity = null
        }
    }

    private fun authorize(url: String?, result: MethodChannel.Result) {
        val uri = url?.let(Uri::parse)
        val loopback = uri?.host == "localhost" || uri?.host == "127.0.0.1"
        if (uri == null || !(uri.scheme == "https" || (uri.scheme == "http" && loopback))) {
            result.error("INVALID_URL", "Sign-in opens only an https address.", null)
            return
        }
        val host = activity
        if (host == null) {
            result.error("NO_ACTIVITY", "The app is not in the foreground.", null)
            return
        }
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            addCategory(Intent.CATEGORY_BROWSABLE)
            // The Custom Tabs protocol: a session extra, even an empty one, asks a browser that supports
            // Custom Tabs for one in this task; any other browser opens the address as it would a link.
            putExtras(Bundle().apply { putBinder("android.support.customtabs.extra.SESSION", null) })
        }
        finishWaiting()
        waiting = result
        try {
            host.startActivity(intent)
        } catch (error: ActivityNotFoundException) {
            waiting = null
            result.error("NO_BROWSER", "No web browser is installed.", null)
        }
    }

    /** From [BuyerSignInCallbackActivity]: hands [uri] to the waiting sign-in, or keeps it for Dart to collect. */
    fun deliver(uri: String) {
        val result = waiting
        if (result != null) {
            waiting = null
            result.success(uri)
        } else {
            launchCallback = uri
        }
    }

    private fun finishWaiting() {
        val result = waiting ?: return
        waiting = null
        result.success(null)
    }
}
