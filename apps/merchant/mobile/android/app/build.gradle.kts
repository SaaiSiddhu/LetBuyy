import org.gradle.api.GradleException
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

fun signingValue(name: String): String? {
    val fromFile = keystoreProperties.getProperty(name)
    val fromGradle = providers.gradleProperty(name).orNull
    val fromEnv = System.getenv(name)
    return (fromFile ?: fromGradle ?: fromEnv)
        ?.trim()
        ?.takeIf { it.isNotEmpty() && !it.startsWith("SKIP_NEEDS_HUMAN_") }
}

val releaseKeystorePath = signingValue("LETBUYY_ANDROID_KEYSTORE_PATH")
val releaseKeystoreFile = releaseKeystorePath?.let { file(it) }
val releaseKeyAlias = signingValue("LETBUYY_ANDROID_KEY_ALIAS")
val releaseKeyPassword = signingValue("LETBUYY_ANDROID_KEY_PASSWORD")
val releaseStorePassword = signingValue("LETBUYY_ANDROID_STORE_PASSWORD")
val releaseSigningReady = releaseKeystoreFile?.exists() == true &&
    releaseKeyAlias != null &&
    releaseKeyPassword != null &&
    releaseStorePassword != null

android {
    buildFeatures { buildConfig = true }
    namespace = "com.letbuyy.store"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        // Enable core library desugaring for flutter_local_notifications
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.letbuyy.store"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        multiDexEnabled = true
        manifestPlaceholders["accountsCallbackHost"] = providers.gradleProperty("LETBUYY_ACCOUNTS_CALLBACK_HOST")
            .orElse("accounts.letbuyy.com").get().also {
                require(it in listOf("accounts.letbuyy.com", "accounts.staging.letbuyy.com")) { "Accounts callback host must be a registered estate" }
            }
    }

    signingConfigs {
        create("release") {
            if (releaseSigningReady) {
                storeFile = releaseKeystoreFile
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}

gradle.taskGraph.whenReady {
    if (allTasks.any { it.name.contains("Release", ignoreCase = true) } && !releaseSigningReady) {
        throw GradleException(
            "Release signing requires LETBUYY_ANDROID_KEYSTORE_PATH, LETBUYY_ANDROID_KEY_ALIAS, " +
                "LETBUYY_ANDROID_KEY_PASSWORD, and LETBUYY_ANDROID_STORE_PASSWORD. " +
                "Provision production signing secrets before running release builds."
        )
    }
}

flutter {
    source = "../.."
}

dependencies {
    implementation("androidx.browser:browser:1.8.0")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}
