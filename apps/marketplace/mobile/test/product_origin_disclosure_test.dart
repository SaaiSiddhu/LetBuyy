import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace/screens/shop/widgets/product_origin_disclosure.dart';

void main() {
  testWidgets('shows available seller disclosures with an unverified label', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ProductOriginDisclosure(
            countryOfOrigin: ' Japan ',
            importerDetails: ' Example Imports, Mumbai ',
          ),
        ),
      ),
    );

    expect(find.text('Origin and importer information'), findsOneWidget);
    expect(find.text('Country of origin'), findsOneWidget);
    expect(find.text('Japan'), findsOneWidget);
    expect(find.text('Importer details'), findsOneWidget);
    expect(find.text('Example Imports, Mumbai'), findsOneWidget);
    expect(
      find.text(
        'Provided by the seller; not independently verified by LetBuyy.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('omits the disclosure when both values are blank', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ProductOriginDisclosure(
            countryOfOrigin: '  ',
            importerDetails: '\n  ',
          ),
        ),
      ),
    );

    expect(find.text('Origin and importer information'), findsNothing);
  });
}
