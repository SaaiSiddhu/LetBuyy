import 'package:flutter/material.dart';

import '../tokens/quickcommerce_colors.dart';
import '../tokens/quickcommerce_radius.dart';
import '../tokens/quickcommerce_typography.dart';

final class QuickcommerceTheme {
  const QuickcommerceTheme._();

  static ThemeData light({Color seedColor = QuickcommerceColors.customerGreen}) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: seedColor,
      surface: QuickcommerceColors.surface,
    ).copyWith(
      primary: QuickcommerceColors.customerGreenAccessible,
      onPrimary: Colors.white,
    );
    return _build(
      colorScheme: colorScheme,
      scaffoldBackgroundColor: QuickcommerceColors.surfaceSubtle,
      textColor: QuickcommerceColors.ink,
    );
  }

  static ThemeData dark({Color seedColor = QuickcommerceColors.customerGreen}) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: seedColor,
      brightness: Brightness.dark,
    ).copyWith(
      primary: QuickcommerceColors.customerGreenLight,
      onPrimary: Colors.black,
    );
    return _build(
      colorScheme: colorScheme,
      scaffoldBackgroundColor: QuickcommerceColors.surfaceDark,
      textColor: colorScheme.onSurface,
    );
  }

  static ThemeData highContrastLight() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: QuickcommerceColors.customerGreenAccessible,
      surface: Colors.white,
    ).copyWith(
      primary: QuickcommerceColors.customerGreenAccessible,
      onPrimary: Colors.white,
    );
    return _build(
      colorScheme: colorScheme,
      scaffoldBackgroundColor: Colors.white,
      textColor: Colors.black,
    );
  }

  static ThemeData highContrastDark() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: QuickcommerceColors.customerGreen,
      brightness: Brightness.dark,
      primary: QuickcommerceColors.customerGreenLight,
      surface: QuickcommerceColors.surfaceHighContrastDark,
    ).copyWith(
      onPrimary: Colors.black,
    );
    return _build(
      colorScheme: colorScheme,
      scaffoldBackgroundColor: QuickcommerceColors.surfaceHighContrastDark,
      textColor: Colors.white,
    );
  }

  static ThemeData _build({
    required ColorScheme colorScheme,
    required Color scaffoldBackgroundColor,
    required Color textColor,
  }) {
    return ThemeData(
      colorScheme: colorScheme,
      useMaterial3: true,
      scaffoldBackgroundColor: scaffoldBackgroundColor,
      textTheme: QuickcommerceTypography.textTheme(textColor),
      cardTheme: CardThemeData(
        elevation: 0,
        color: colorScheme.surface,
        surfaceTintColor: colorScheme.surfaceTint,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(QuickcommerceRadius.md),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(QuickcommerceRadius.md),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: colorScheme.secondaryContainer,
      ),
      navigationRailTheme: NavigationRailThemeData(
        indicatorColor: colorScheme.secondaryContainer,
      ),
    );
  }
}
