import 'dart:math' as math;

import 'package:quickcommerce_design_system/quickcommerce_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('theme variants expose Material 3 light, dark, and contrast schemes', () {
    final light = QuickcommerceTheme.light();
    final dark = QuickcommerceTheme.dark();
    final highContrastLight = QuickcommerceTheme.highContrastLight();
    final highContrastDark = QuickcommerceTheme.highContrastDark();

    expect(light.useMaterial3, true);
    expect(dark.useMaterial3, true);
    expect(light.colorScheme.brightness, Brightness.light);
    expect(dark.colorScheme.brightness, Brightness.dark);
    expect(highContrastLight.colorScheme.brightness, Brightness.light);
    expect(highContrastDark.colorScheme.brightness, Brightness.dark);
  });

  test('critical role pairs meet WCAG AA contrast', () {
    final themes = {
      'light': QuickcommerceTheme.light(),
      'dark': QuickcommerceTheme.dark(),
      'highContrastLight': QuickcommerceTheme.highContrastLight(),
      'highContrastDark': QuickcommerceTheme.highContrastDark(),
    };
    for (final entry in themes.entries) {
      final theme = entry.value;
      final scheme = theme.colorScheme;
      expect(
        _contrastRatio(scheme.primary, scheme.onPrimary),
        greaterThanOrEqualTo(4.5),
        reason:
            '${entry.key} primary/onPrimary ${scheme.primary} ${scheme.onPrimary}',
      );
      expect(
        _contrastRatio(scheme.surface, scheme.onSurface),
        greaterThanOrEqualTo(4.5),
        reason: '${entry.key} surface/onSurface',
      );
    }
  });

  testWidgets('enterprise banner renders in dark theme', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: QuickcommerceTheme.dark(),
        home: const Scaffold(
          body: EnterpriseShellBanner(
            title: 'Dark title',
            subtitle: 'Dark subtitle',
          ),
        ),
      ),
    );

    expect(find.text('Dark title'), findsOneWidget);
    expect(find.text('Dark subtitle'), findsOneWidget);
  });
}

double _contrastRatio(Color a, Color b) {
  final first = _relativeLuminance(a);
  final second = _relativeLuminance(b);
  final lighter = first > second ? first : second;
  final darker = first > second ? second : first;
  return (lighter + 0.05) / (darker + 0.05);
}

double _relativeLuminance(Color color) {
  final r = _linearize(color.r);
  final g = _linearize(color.g);
  final b = _linearize(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

double _linearize(double channel) {
  return channel <= 0.04045
      ? channel / 12.92
      : math.pow(((channel + 0.055) / 1.055).clamp(0, 1), 2.4).toDouble();
}
