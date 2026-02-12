import 'package:shared_preferences/shared_preferences.dart';
import '../constants/storage_constants.dart';

class SharedPreferencesService {
  static SharedPreferences? _preferences;

  // ============================================
  // INITIALIZE
  // ============================================
  static Future<void> init() async {
    try {
      _preferences = await SharedPreferences.getInstance();
      print('✅ SharedPreferencesService initialized');
    } catch (e) {
      print('❌ Error initializing SharedPreferences: $e');
      rethrow;
    }
  }

  // ============================================
  // GET INSTANCE
  // ============================================
  static SharedPreferences get instance {
    if (_preferences == null) {
      throw Exception('❌ SharedPreferencesService not initialized. Call init() first.');
    }
    return _preferences!;
  }

  // ============================================
  // STRING OPERATIONS
  // ============================================
  static Future<bool> setString(String key, String value) async {
    try {
      return await instance.setString(key, value);
    } catch (e) {
      print('❌ Error setting string: $e');
      return false;
    }
  }

  static String? getString(String key) {
    try {
      return instance.getString(key);
    } catch (e) {
      print('⚠️ Error getting string: $e');
      return null;
    }
  }

  // ============================================
  // INT OPERATIONS
  // ============================================
  static Future<bool> setInt(String key, int value) async {
    try {
      return await instance.setInt(key, value);
    } catch (e) {
      print('❌ Error setting int: $e');
      return false;
    }
  }

  static int? getInt(String key) {
    try {
      return instance.getInt(key);
    } catch (e) {
      print('⚠️ Error getting int: $e');
      return null;
    }
  }

  // ============================================
  // BOOL OPERATIONS
  // ============================================
  static Future<bool> setBool(String key, bool value) async {
    try {
      return await instance.setBool(key, value);
    } catch (e) {
      print('❌ Error setting bool: $e');
      return false;
    }
  }

  static bool? getBool(String key) {
    try {
      return instance.getBool(key);
    } catch (e) {
      print('⚠️ Error getting bool: $e');
      return null;
    }
  }

  // ============================================
  // DOUBLE OPERATIONS
  // ============================================
  static Future<bool> setDouble(String key, double value) async {
    try {
      return await instance.setDouble(key, value);
    } catch (e) {
      print('❌ Error setting double: $e');
      return false;
    }
  }

  static double? getDouble(String key) {
    try {
      return instance.getDouble(key);
    } catch (e) {
      print('⚠️ Error getting double: $e');
      return null;
    }
  }

  // ============================================
  // STRING LIST OPERATIONS
  // ============================================
  static Future<bool> setStringList(String key, List<String> value) async {
    try {
      return await instance.setStringList(key, value);
    } catch (e) {
      print('❌ Error setting string list: $e');
      return false;
    }
  }

  static List<String>? getStringList(String key) {
    try {
      return instance.getStringList(key);
    } catch (e) {
      print('⚠️ Error getting string list: $e');
      return null;
    }
  }

  // ============================================
  // REMOVE & CLEAR OPERATIONS
  // ============================================
  static Future<bool> remove(String key) async {
    try {
      return await instance.remove(key);
    } catch (e) {
      print('❌ Error removing key: $e');
      return false;
    }
  }

  static Future<bool> clear() async {
    try {
      return await instance.clear();
    } catch (e) {
      print('❌ Error clearing preferences: $e');
      return false;
    }
  }

  // ============================================
  // KEY OPERATIONS
  // ============================================
  static bool containsKey(String key) {
    try {
      return instance.containsKey(key);
    } catch (e) {
      print('⚠️ Error checking key: $e');
      return false;
    }
  }

  static Set<String> getKeys() {
    try {
      return instance.getKeys();
    } catch (e) {
      print('⚠️ Error getting keys: $e');
      return {};
    }
  }

  // ============================================
  // USER SESSION METHODS
  // ============================================
  static Future<void> saveUserSession({
    required String userId,
    required String email,
    required String name,
    required String role,
  }) async {
    try {
      await setBool(StorageConstants.keyIsLoggedIn, true);
      await setString(StorageConstants.keyUserId, userId);
      await setString(StorageConstants.keyUserEmail, email);
      await setString(StorageConstants.keyUserName, name);
      await setString(StorageConstants.keyUserRole, role);
      print('✅ User session saved: $email');
    } catch (e) {
      print('❌ Error saving user session: $e');
    }
  }

  static Future<void> clearUserSession() async {
    try {
      await remove(StorageConstants.keyIsLoggedIn);
      await remove(StorageConstants.keyUserId);
      await remove(StorageConstants.keyUserEmail);
      await remove(StorageConstants.keyUserName);
      await remove(StorageConstants.keyUserRole);
      await remove(StorageConstants.keyUserToken);
      await remove(StorageConstants.keyRememberMe);
      await remove(StorageConstants.keyRememberEmail);
      print('✅ User session cleared');
    } catch (e) {
      print('❌ Error clearing user session: $e');
    }
  }

  static bool isLoggedIn() {
    return getBool(StorageConstants.keyIsLoggedIn) ?? false;
  }

  static String? getUserId() {
    return getString(StorageConstants.keyUserId);
  }

  static String? getUserEmail() {
    return getString(StorageConstants.keyUserEmail);
  }

  static String? getUserName() {
    return getString(StorageConstants.keyUserName);
  }

  static String? getUserRole() {
    return getString(StorageConstants.keyUserRole);
  }

  // ============================================
  // REMEMBER ME METHODS
  // ============================================
  static Future<void> setRememberMe(String email, bool remember) async {
    try {
      await setBool(StorageConstants.keyRememberMe, remember);
      if (remember) {
        await setString(StorageConstants.keyRememberEmail, email);
        print('✅ Remember me enabled for: $email');
      } else {
        await remove(StorageConstants.keyRememberEmail);
        print('✅ Remember me disabled');
      }
    } catch (e) {
      print('❌ Error setting remember me: $e');
    }
  }

  static bool isRememberMeEnabled() {
    return getBool(StorageConstants.keyRememberMe) ?? false;
  }

  static String? getRememberedEmail() {
    return getString(StorageConstants.keyRememberEmail);
  }

  // ============================================
  // THEME METHODS
  // ============================================
  static Future<void> setThemeMode(bool isDark) async {
    try {
      await setBool(StorageConstants.keyIsDarkMode, isDark);
      print('✅ Theme set to: ${isDark ? "Dark" : "Light"}');
    } catch (e) {
      print('❌ Error setting theme: $e');
    }
  }

  static bool isDarkMode() {
    return getBool(StorageConstants.keyIsDarkMode) ?? false;
  }

  // ============================================
  // ONBOARDING METHODS
  // ============================================
  static Future<void> setOnboardingCompleted() async {
    try {
      await setBool(StorageConstants.keyOnboardingCompleted, true);
      print('✅ Onboarding marked as completed');
    } catch (e) {
      print('❌ Error setting onboarding: $e');
    }
  }

  static bool isOnboardingCompleted() {
    return getBool(StorageConstants.keyOnboardingCompleted) ?? false;
  }

  static Future<void> resetOnboarding() async {
    try {
      await remove(StorageConstants.keyOnboardingCompleted);
      print('✅ Onboarding reset');
    } catch (e) {
      print('❌ Error resetting onboarding: $e');
    }
  }

  // ============================================
  // SEARCH HISTORY METHODS
  // ============================================
  static Future<void> addSearchQuery(String query) async {
    try {
      if (query.trim().isEmpty) return;

      List<String> history =
          getStringList(StorageConstants.keySearchHistory) ?? [];

      // Remove if already exists (avoid duplicates)
      history.removeWhere((h) => h.toLowerCase() == query.toLowerCase());

      // Add to beginning (most recent first)
      history.insert(0, query.trim());

      // Keep only last 20 searches
      if (history.length > 20) {
        history = history.sublist(0, 20);
      }

      await setStringList(StorageConstants.keySearchHistory, history);
      print('✅ Search query added: $query');
    } catch (e) {
      print('❌ Error adding search query: $e');
    }
  }

  static List<String> getSearchHistory() {
    try {
      return getStringList(StorageConstants.keySearchHistory) ?? [];
    } catch (e) {
      print('⚠️ Error getting search history: $e');
      return [];
    }
  }

  static Future<void> removeSearchQuery(String query) async {
    try {
      List<String> history =
          getStringList(StorageConstants.keySearchHistory) ?? [];
      history.removeWhere((h) => h.toLowerCase() == query.toLowerCase());
      await setStringList(StorageConstants.keySearchHistory, history);
      print('✅ Search query removed: $query');
    } catch (e) {
      print('❌ Error removing search query: $e');
    }
  }

  static Future<void> clearSearchHistory() async {
    try {
      await remove(StorageConstants.keySearchHistory);
      print('✅ Search history cleared');
    } catch (e) {
      print('❌ Error clearing search history: $e');
    }
  }

  // ============================================
  // DEVICE INFO METHODS
  // ============================================
  static Future<void> setDeviceId(String deviceId) async {
    try {
      await setString(StorageConstants.keyDeviceId, deviceId);
      print('✅ Device ID saved');
    } catch (e) {
      print('❌ Error saving device ID: $e');
    }
  }

  static String? getDeviceId() {
    return getString(StorageConstants.keyDeviceId);
  }

  static Future<void> setLastLoginTime(DateTime time) async {
    try {
      await setString(StorageConstants.keyLastLoginTime, time.toIso8601String());
      print('✅ Last login time saved');
    } catch (e) {
      print('❌ Error saving last login time: $e');
    }
  }

  static DateTime? getLastLoginTime() {
    try {
      final timeStr = getString(StorageConstants.keyLastLoginTime);
      return timeStr != null ? DateTime.parse(timeStr) : null;
    } catch (e) {
      print('⚠️ Error getting last login time: $e');
      return null;
    }
  }

  // ============================================
  // DEBUG METHODS
  // ============================================
  static void debugPrintAllPreferences() {
    try {
      print('=== ALL PREFERENCES ===');
      final keys = getKeys();
      if (keys.isEmpty) {
        print('No preferences stored');
      } else {
        for (var key in keys) {
          final value = instance.get(key);
          print('$key: $value');
        }
      }
      print('======================');
    } catch (e) {
      print('❌ Error printing preferences: $e');
    }
  }

  static int getStorageSize() {
    try {
      final keys = getKeys();
      int size = 0;
      for (var key in keys) {
        final value = instance.get(key);
        if (value is String) {
          size += value.length;
        }
      }
      return size;
    } catch (e) {
      print('⚠️ Error calculating storage size: $e');
      return 0;
    }
  }
}
