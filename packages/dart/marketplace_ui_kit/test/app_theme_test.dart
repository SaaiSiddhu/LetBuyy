import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

void main() {
  group('AppTheme.lightTheme / darkTheme', () {
    test('lightTheme is genuinely a light ThemeData', () {
      expect(AppTheme.lightTheme.brightness, Brightness.light);
    });

    test('darkTheme is genuinely a dark ThemeData', () {
      expect(AppTheme.darkTheme.brightness, Brightness.dark);
    });

    test('the two themes use different scaffold background colors', () {
      // A real, meaningful assertion: it would be a genuine bug for
      // "dark mode" to silently reuse the light background.
      expect(
        AppTheme.lightTheme.scaffoldBackgroundColor,
        isNot(AppTheme.darkTheme.scaffoldBackgroundColor),
      );
    });

    test('the two themes use different app bar foreground colors', () {
      expect(
        AppTheme.lightTheme.appBarTheme.foregroundColor,
        isNot(AppTheme.darkTheme.appBarTheme.foregroundColor),
      );
    });

    test('both themes opt into Material 3', () {
      expect(AppTheme.lightTheme.useMaterial3, isTrue);
      expect(AppTheme.darkTheme.useMaterial3, isTrue);
    });
  });
}
