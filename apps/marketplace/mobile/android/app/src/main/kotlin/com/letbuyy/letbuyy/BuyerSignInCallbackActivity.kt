package com.letbuyy.letbuyy

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * APPID-P4d — receives `com.letbuyy.letbuyy:/oauth/callback` from the browser.
 *
 * It shows nothing and decides nothing: the address goes to [BuyerSignInBridge], and Dart accepts it
 * only if it answers the attempt Dart started (the state), and redeems its code only with that
 * attempt's PKCE verifier. Then it brings the app's own task back: CLEAR_TOP closes the Custom Tab that
 * was opened above MainActivity, and SINGLE_TOP reuses the running MainActivity instead of starting a
 * second copy of the app. The intent carries no data, so Flutter's own deep-link routing sees nothing.
 */
class BuyerSignInCallbackActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val data = intent?.data
        if (data != null && data.scheme == BuyerSignInBridge.CALLBACK_SCHEME) {
            BuyerSignInBridge.deliver(data.toString())
        }
        startActivity(
            Intent(this, MainActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP,
            ),
        )
        finish()
    }
}
