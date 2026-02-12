// lib/core/constants/storage_constants.dart

class StorageConstants {
  // ============================================
  // 🔥 USER SESSION & AUTH (PERSISTENCE)
  // ============================================
  static const String keyIsLoggedIn = 'is_logged_in';
  static const String keyUserId = 'user_id';
  static const String keyUserEmail = 'user_email';
  static const String keyUserName = 'user_name';
  static const String keyUserRole = 'user_role';
  static const String keyUserToken = 'user_token';
  static const String keyUserType = 'user_type'; // 'buyer' or 'seller'
  static const String keyLastLoginTime = 'last_login_time';
  static const String keySessionStartTime = 'session_start_time';
  static const String keyAuthTokenExpiry = 'auth_token_expiry';

  // ============================================
  // REMEMBER ME & AUTH
  // ============================================
  static const String keyRememberMe = 'remember_me';
  static const String keyRememberEmail = 'remember_email';
  static const String keyBiometricEnabled = 'biometric_enabled';

  // ============================================
  // THEME
  // ============================================
  static const String keyThemeMode = 'theme_mode';
  static const String keyIsDarkMode = 'is_dark_mode';

  // ============================================
  // LANGUAGE & LOCALE
  // ============================================
  static const String keyLanguage = 'language';
  static const String keyLocale = 'locale';

  // ============================================
  // ONBOARDING
  // ============================================
  static const String keyIsFirstLaunch = 'is_first_launch';
  static const String keyOnboardingCompleted = 'onboarding_completed';

  // ============================================
  // CART
  // ============================================
  static const String keyCartItems = 'cart_items';
  static const String keyCartCount = 'cart_count';

  // ============================================
  // WISHLIST
  // ============================================
  static const String keyWishlistItems = 'wishlist_items';

  // ============================================
  // SEARCH & HISTORY
  // ============================================
  static const String keySearchHistory = 'search_history';
  static const String keyRecentSearches = 'recent_searches';

  // ============================================
  // FILTER & SORT
  // ============================================
  static const String keyLastFilter = 'last_filter';
  static const String keyLastSort = 'last_sort';

  // ============================================
  // ADDRESS
  // ============================================
  static const String keyDefaultAddress = 'default_address';
  static const String keySavedAddresses = 'saved_addresses';

  // ============================================
  // NOTIFICATIONS
  // ============================================
  static const String keyNotificationsEnabled = 'notifications_enabled';
  static const String keyPushToken = 'push_token';

  // ============================================
  // APP SETTINGS
  // ============================================
  static const String keyAutoUpdateCart = 'auto_update_cart';
  static const String keyShowPriceAlerts = 'show_price_alerts';

  // ============================================
  // CACHE
  // ============================================
  static const String keyCacheVersion = 'cache_version';
  static const String keyLastCacheUpdate = 'last_cache_update';

  // ============================================
  // DEVICE INFO
  // ============================================
  static const String keyDeviceId = 'device_id';
}