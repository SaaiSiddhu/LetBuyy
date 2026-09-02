import 'package:quickcommerce_design_system/quickcommerce_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders enterprise shell banner', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: EnterpriseShellBanner(
            title: 'Title',
            subtitle: 'Subtitle',
          ),
        ),
      ),
    );

    expect(find.text('Title'), findsOneWidget);
    expect(find.text('Subtitle'), findsOneWidget);
  });
}

