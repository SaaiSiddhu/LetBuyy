import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/preview/live_preview_screen.dart';

void main() {
  for (final url in ['', 'missing-scheme', 'javascript:alert(1)']) {
    testWidgets('invalid preview URL renders an unavailable state: $url', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: LivePreviewScreen(storeUrl: url, storeName: 'Local store'),
        ),
      );
      expect(find.text('Store URL not available'), findsOneWidget);
      expect(tester.takeException(), isNull);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      final refresh = tester.widget<IconButton>(
        find.byWidgetPredicate(
          (w) => w is IconButton && w.tooltip == 'Refresh',
        ),
      );
      expect(refresh.onPressed, isNull);
    });
  }
}
