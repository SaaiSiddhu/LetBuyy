import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Theme Provider - Manages app theme state with persistence
/// Supports Light, Dark, and System theme modes
class ThemeProvider extends ChangeNotifier {
  static const String _themeKey = 'app_theme_mode';
  
  ThemeMode _themeMode = ThemeMode.dark; // Default to dark (current behavior)
  bool _isLoaded = false;
  
  /// Current theme mode (light, dark, or system)
  ThemeMode get themeMode => _themeMode;
  
  /// Whether the theme provider has loaded the saved preference
  bool get isLoaded => _isLoaded;
  
  /// Convenience getter for checking dark mode
  bool isDarkMode(BuildContext context) {
    if (_themeMode == ThemeMode.system) {
      return MediaQuery.platformBrightnessOf(context) == Brightness.dark;
    }
    return _themeMode == ThemeMode.dark;
  }
  
  /// Load theme from SharedPreferences
  Future<void> loadTheme() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedTheme = prefs.getString(_themeKey);
      
      if (savedTheme != null) {
        switch (savedTheme) {
          case 'light':
            _themeMode = ThemeMode.light;
            break;
          case 'dark':
            _themeMode = ThemeMode.dark;
            break;
          case 'system':
            _themeMode = ThemeMode.system;
            break;
          default:
            _themeMode = ThemeMode.dark;
        }
      }
    } catch (e) {
      debugPrint('Error loading theme preference: $e');
      _themeMode = ThemeMode.dark;
    }
    
    _isLoaded = true;
    notifyListeners();
  }
  
  /// Set theme mode and persist to storage
  Future<void> setThemeMode(ThemeMode mode) async {
    if (_themeMode == mode) return;
    
    _themeMode = mode;
    notifyListeners();
    
    try {
      final prefs = await SharedPreferences.getInstance();
      String themeString;
      switch (mode) {
        case ThemeMode.light:
          themeString = 'light';
          break;
        case ThemeMode.dark:
          themeString = 'dark';
          break;
        case ThemeMode.system:
          themeString = 'system';
          break;
      }
      await prefs.setString(_themeKey, themeString);
    } catch (e) {
      debugPrint('Error saving theme preference: $e');
    }
  }
  
  /// Toggle between light and dark (ignoring system)
  void toggleTheme() {
    setThemeMode(_themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
  }
  
  /// Get display label for current theme
  String get themeLabel {
    switch (_themeMode) {
      case ThemeMode.light:
        return 'Light';
      case ThemeMode.dark:
        return 'Dark';
      case ThemeMode.system:
        return 'System';
    }
  }
}
