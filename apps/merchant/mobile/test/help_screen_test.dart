import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/settings/help_screen.dart';

void main() {
  testWidgets('help uses visible material tiles and real support channel', (
    tester,
  ) async {
    final errors = <FlutterErrorDetails>[];
    final previous = FlutterError.onError;
    FlutterError.onError = errors.add;
    try {
      await tester.pumpWidget(const MaterialApp(home: HelpScreen()));
      expect(find.text('Email support'), findsOneWidget);
      expect(find.textContaining('24/7'), findsNothing);
      await tester.drag(find.byType(ListView), const Offset(0, -700));
      await tester.pumpAndSettle();
      expect(errors, isEmpty);
    } finally {
      FlutterError.onError = previous;
    }
  });
}
