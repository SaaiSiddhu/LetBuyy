import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';

class _NoFontNetwork extends HttpOverrides {
  int requests = 0;
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    requests++;
    throw StateError('Typography must use the bundled font assets.');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('all Inter weights and Merchant themes load without networking', (
    tester,
  ) async {
    final previous = HttpOverrides.current;
    final blocked = _NoFontNetwork();
    HttpOverrides.global = blocked;
    try {
      final assets = await AssetManifest.loadFromAssetBundle(rootBundle);
      final fontAssets = assets.listAssets().where(
        (name) =>
            name.startsWith('packages/letbuyy_ui_kit/assets/fonts/') &&
            name.endsWith('.ttf'),
      );
      expect(fontAssets, hasLength(9));
      await initializeLetbuyyTypography();
      expect(GoogleFonts.config.allowRuntimeFetching, isFalse);
      for (final weight in FontWeight.values) {
        expect(
          GoogleFonts.inter(fontWeight: weight).fontFamily,
          startsWith('Inter'),
        );
      }
      await GoogleFonts.pendingFonts();
      for (final theme in [StoreTheme.light(), StoreTheme.dark()]) {
        await tester.pumpWidget(
          MaterialApp(
            theme: theme,
            home: const Scaffold(body: Text('Merchant ₹25.00')),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Merchant ₹25.00'), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
      final license = await LicenseRegistry.licenses.firstWhere(
        (entry) => entry.packages.contains('Inter'),
      );
      expect(license.paragraphs, isNotEmpty);
      expect(blocked.requests, 0);
    } finally {
      HttpOverrides.global = previous;
    }
  });
}
