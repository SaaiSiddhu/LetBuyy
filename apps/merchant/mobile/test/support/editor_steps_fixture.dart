import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

Future<void> selectEditorSection(WidgetTester tester, String label) async {
  final scroll = find
      .descendant(
        of: find.byType(LetbuyyEditorSteps),
        matching: find.byType(Scrollable),
      )
      .first;
  final choice = find.ancestor(
    of: find.text('Section'),
    matching: find.byType(OutlinedButton),
  );
  await tester.scrollUntilVisible(
    choice,
    -250,
    scrollable: scroll,
    maxScrolls: 20,
  );
  await tester.pumpAndSettle();
  expect(choice.hitTestable(), findsOneWidget);
  await tester.tap(choice);
  await tester.pumpAndSettle();
  final radio = find.widgetWithText(RadioListTile<int>, label);
  await tester.ensureVisible(radio);
  await tester.pumpAndSettle();
  expect(radio.hitTestable(), findsOneWidget);
  await tester.tap(radio);
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(FilledButton, 'Apply selection'));
  await tester.pumpAndSettle();
}
