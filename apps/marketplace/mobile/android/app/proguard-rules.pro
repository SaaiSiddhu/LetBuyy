# ========================================
# FLUTTER WRAPPER
# ========================================
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# ========================================
# GOOGLE PLAY CORE
# ========================================
-keep class com.google.android.play.core.** { *; }
-dontwarn com.google.android.play.core.**

# ========================================
# FIREBASE (CRITICAL FOR NOTIFICATIONS)
# ========================================
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.tasks.** { *; }
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.auth.** { *; }
-keep class com.google.firebase.firestore.** { *; }
-keep class com.google.firebase.storage.** { *; }
-keep class com.google.firebase.analytics.** { *; }
-keep class com.google.firebase.functions.** { *; }

-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ========================================
# FIREBASE MESSAGING NOTIFICATIONS
# ========================================
-keep class com.google.firebase.messaging.RemoteMessage { *; }
-keep class com.google.firebase.messaging.FirebaseMessagingService { *; }
-keep class * extends com.google.firebase.messaging.FirebaseMessagingService

# ========================================
# ML KIT - TEXT RECOGNITION (FIX FOR R8 ERROR)
# ========================================
-keep class com.google.mlkit.** { *; }
-keep class com.google.mlkit.vision.** { *; }
-keep class com.google.mlkit.vision.text.** { *; }
-keep class com.google.mlkit.vision.text.chinese.** { *; }
-keep class com.google.mlkit.vision.text.devanagari.** { *; }
-keep class com.google.mlkit.vision.text.japanese.** { *; }
-keep class com.google.mlkit.vision.text.korean.** { *; }
-keep class com.google.mlkit.vision.text.latin.** { *; }
-keep class com.google.mlkit.vision.face.** { *; }
-keep class com.google.mlkit.common.** { *; }

-dontwarn com.google.mlkit.**

# ========================================
# RAZORPAY PAYMENT GATEWAY
# ========================================
-keep class com.razorpay.** { *; }
-keep class com.razorpay.checkout.** { *; }
-dontwarn com.razorpay.**

# ========================================
# ANDROIDX
# ========================================
-keep class androidx.** { *; }
-keep class androidx.core.** { *; }
-keep class androidx.lifecycle.** { *; }
-keep class androidx.appcompat.** { *; }
-keep class androidx.work.** { *; }
-dontwarn androidx.**

# ========================================
# KOTLIN & COROUTINES
# ========================================
-keep class kotlin.** { *; }
-keep class kotlin.jvm.** { *; }
-keep class kotlinx.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# ========================================
# OKHTTP & RETROFIT
# ========================================
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

-dontwarn retrofit2.**
-keep class retrofit2.** { *; }

# ========================================
# GSON JSON SERIALIZATION
# ========================================
-keep class com.google.gson.** { *; }
-keep class com.google.gson.stream.** { *; }
-dontwarn com.google.gson.**

# Preserve the line numbers so stack traces work
-keepattributes SourceFile,LineNumberTable

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ========================================
# RETROFIT GENERIC SIGNATURES
# ========================================
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response

# ========================================
# KOTLIN COROUTINES CONTINUATIONS
# ========================================
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation

# ========================================
# FLUTTER LOCAL NOTIFICATIONS
# ========================================
-keep class com.dexterous.** { *; }
-keep class com.dexterous.flutterlocalnotifications.** { *; }
-dontwarn com.dexterous.**

# ========================================
# APP LINKS & DEEP LINKING
# ========================================
-keep class android.app.** { *; }
-keep class android.content.** { *; }
-keep class android.net.** { *; }

# ========================================
# IMAGE PICKER & CAMERA PLUGINS
# ========================================
-keep class io.flutter.plugins.imagepicker.** { *; }
-keep class io.flutter.plugins.camera.** { *; }

# ========================================
# GOOGLE SIGN-IN
# ========================================
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.signin.** { *; }

# ========================================
# GOOGLE MAPS
# ========================================
-keep class com.google.android.gms.maps.** { *; }
-keep class com.google.maps.** { *; }

# ========================================
# SHARE PLUS & URL LAUNCHER
# ========================================
-keep class io.flutter.plugins.share.** { *; }
-keep class io.flutter.plugins.urllauncher.** { *; }

# ========================================
# LOCATION SERVICES
# ========================================
-keep class com.google.android.gms.location.** { *; }
-keep class io.flutter.plugins.location.** { *; }

# ========================================
# CUSTOM APP MODELS (Update with your package)
# ========================================
-keep class com.letbuyy.letbuyy.models.** { *; }
-keep class com.letbuyy.letbuyy.services.** { *; }
-keep class com.letbuyy.letbuyy.providers.** { *; }

# ========================================
# GENERIC SIGNATURES (Keep for debugging)
# ========================================
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes *Annotation*
-keepattributes Exceptions

# ========================================
# NATIVE METHODS
# ========================================
-keepclasseswithmembernames class * {
    native <methods>;
}

# ========================================
# KEEP PARCELABLE IMPLEMENTATIONS
# ========================================
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# ========================================
# KEEP SERIALIZABLE CLASSES
# ========================================
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ========================================
# KEEP R CLASS (Android Resources)
# ========================================
-keepclassmembers class **.R$* {
    public static <fields>;
}

# ========================================
# WEBVIEW
# ========================================
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public boolean *(android.webkit.WebView, java.lang.String);
}
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public void *(android.webkit.WebView, java.lang.String);
}

# ========================================
# REMOVE LOGGING IN RELEASE
# ========================================
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# ========================================
# KEEP FLUTTER PLUGINS REGISTRANT
# ========================================
-keep class io.flutter.plugins.GeneratedPluginRegistrant { *; }

# ========================================
# PERMISSION HANDLER
# ========================================
-keep class com.baseflow.permissionhandler.** { *; }

# ========================================
# SHARED PREFERENCES
# ========================================
-keep class android.content.SharedPreferences { *; }
-keep class android.content.SharedPreferences$Editor { *; }

# ========================================
# PACKAGE INFO PLUS
# ========================================
-keep class io.flutter.plugins.packageinfo.** { *; }

# ========================================
# DEVICE INFO PLUS
# ========================================
-keep class io.flutter.plugins.deviceinfo.** { *; }

# ========================================
# CONNECTIVITY PLUS
# ========================================
-keep class com.example.connectivity_plus.** { *; }

# ========================================
# VIDEO PLAYER
# ========================================
-keep class io.flutter.plugins.videoplayer.** { *; }

# ========================================
# PATH PROVIDER
# ========================================
-keep class io.flutter.plugins.pathprovider.** { *; }

# ========================================
# GOOGLE MOBILE ADS
# ========================================
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }

# ========================================
# FILE PICKER
# ========================================
-keep class com.mr.flutter.plugin.filepicker.** { *; }

# ========================================
# IMAGE CROPPER
# ========================================
-keep class com.yalantis.ucrop.** { *; }

# ========================================
# FLUTTERTOAST
# ========================================
-keep class io.github.ponnamkarthik.toast.** { *; }

# ========================================
# OPTIMIZATION FLAGS
# ========================================
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontpreverify
-verbose

# ========================================
# KEEP CUSTOM ATTRIBUTES
# ========================================
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeVisibleParameterAnnotations
-keepattributes RuntimeVisibleTypeAnnotations

# ========================================
# PREVENT OBFUSCATION OF RESOURCE IDS
# ========================================
-keep class **.R
-keep class **.R$*
