import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'catalog_presentation_test.dart' as fixture;
import 'product_status_recovery_test.dart' as data;

void main() {
  setUpAll(initializeLetbuyyTypography);
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets(
    'catalog uses separate live-variant availability without overwriting base stock',
    (tester) async {
      final f = fixture.CatalogFixture();
      f.api.rows['one'] = {
        ...data.product('one'),
        'stock': 0,
        'catalog_available_quantity': 7,
      };
      try {
        await f.mount(tester);
        final card = find.byKey(const ValueKey('product-card-one'));
        expect(
          find.descendant(of: card, matching: find.text('Stock: 7')),
          findsOneWidget,
        );
        expect(
          find.descendant(of: card, matching: find.text('Out of Stock')),
          findsNothing,
        );
        expect(f.api.rows['one']!['stock'], 0);
      } finally {
        await f.dispose(tester);
      }
    },
  );
  testWidgets(
    'unknown catalog availability cannot fall back to the base cache',
    (tester) async {
      final f = fixture.CatalogFixture();
      f.api.rows['one'] = {
        ...data.product('one'),
        'stock': 99,
        'catalog_available_quantity': null,
      };
      try {
        await f.mount(tester);
        final card = find.byKey(const ValueKey('product-card-one'));
        expect(
          find.descendant(of: card, matching: find.text('Stock unavailable')),
          findsOneWidget,
        );
        expect(find.text('— Out of stock on page'), findsOneWidget);
      } finally {
        await f.dispose(tester);
      }
    },
  );
}
