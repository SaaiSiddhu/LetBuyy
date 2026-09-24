// lib/providers/locale_provider.dart
// 🌐 LOCALE PROVIDER - Multi-Language Support

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocaleProvider extends ChangeNotifier {
  static const String _localeKey = 'app_locale';
  
  Locale _locale = const Locale('en'); // Default to English
  
  Locale get locale => _locale;
  
  LocaleProvider() {
    _loadLocale();
  }
  
  /// Get available locales
  static List<Map<String, dynamic>> get supportedLocales => [
    {'locale': const Locale('en'), 'name': 'English', 'nativeName': 'English', 'icon': '🇬🇧'},
    {'locale': const Locale('ta'), 'name': 'Tamil', 'nativeName': 'தமிழ்', 'icon': '🇮🇳'},
    {'locale': const Locale('hi'), 'name': 'Hindi', 'nativeName': 'हिंदी', 'icon': '🇮🇳'},
  ];
  
  /// Load saved locale from SharedPreferences
  Future<void> _loadLocale() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final localeCode = prefs.getString(_localeKey);
      if (localeCode != null) {
        _locale = Locale(localeCode);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading locale: $e');
    }
  }
  
  /// Change locale
  Future<void> setLocale(Locale locale) async {
    if (_locale == locale) return;
    
    _locale = locale;
    notifyListeners();
    
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_localeKey, locale.languageCode);
    } catch (e) {
      debugPrint('Error saving locale: $e');
    }
  }
  
  /// Get current language name
  String get currentLanguageName {
    final found = supportedLocales.firstWhere(
      (l) => l['locale'].languageCode == _locale.languageCode,
      orElse: () => supportedLocales.first,
    );
    return found['nativeName'] as String;
  }
  
  /// Check if locale is RTL
  bool get isRTL => false; // None of our languages are RTL
}
