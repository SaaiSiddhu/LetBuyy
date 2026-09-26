import 'package:firebase_auth/firebase_auth.dart';

// Phase 1R (R1.5, found via real device verification): FirebaseAuth.instance itself throws
// [core/no-app] once Firebase.initializeApp() is no longer called (main.dart, R1.3) — and across
// this app, "read the current Firebase user" is a common first, synchronous statement in a build()
// method or its direct helper, executed before any try/catch could run. firebase_auth stays a real
// dependency (R1.1: most of this app's product/cart/checkout/chat surface has no canonical
// successor yet), so the fix is not removing these reads — it's making them fail the same way "no
// user signed in" already does, instead of crashing the widget that asked.

/// The signed-in Firebase user's uid, or null if nobody is signed in OR Firebase itself is
/// unavailable. Safe to call from build() or initState().
String? safeFirebaseUserId() {
  try {
    return FirebaseAuth.instance.currentUser?.uid;
  } catch (_) {
    return null;
  }
}

/// The signed-in Firebase user, or null if nobody is signed in OR Firebase itself is unavailable.
/// Safe to call from build() or initState().
User? safeFirebaseCurrentUser() {
  try {
    return FirebaseAuth.instance.currentUser;
  } catch (_) {
    return null;
  }
}
