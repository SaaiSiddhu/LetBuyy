import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

void main() {
  for (final keyboard in [false, true]) {
    testWidgets(
      'queued feedback leaves editor Save reachable (keyboard=$keyboard)',
      (tester) async {
        tester.view.physicalSize = const Size(402, 874);
        tester.view.devicePixelRatio = 1;
        tester.view.viewPadding = const FakeViewPadding(bottom: 34);
        tester.view.padding = keyboard
            ? const FakeViewPadding()
            : const FakeViewPadding(bottom: 34);
        if (keyboard) {
          tester.view.viewInsets = const FakeViewPadding(bottom: 300);
        }
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetViewPadding);
        addTearDown(tester.view.resetPadding);
        addTearDown(tester.view.resetViewInsets);
        var saves = 0;
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(
              snackBarTheme: const SnackBarThemeData(
                behavior: SnackBarBehavior.floating,
              ),
            ),
            home: LetbuyyEditorScaffold(
              title: 'Edit product',
              hasChanges: true,
              actions: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => saves++,
                  child: const Text('Save'),
                ),
              ),
              body: const SingleChildScrollView(
                child: TextField(
                  decoration: InputDecoration(labelText: 'Title'),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final context = tester.element(find.byType(TextField));
        showLetbuyyOperationFeedback(context, message: 'Media uploaded');
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Product image added.')));
        await tester.pumpAndSettle();
        final save = find.widgetWithText(FilledButton, 'Save');
        final saveRect = tester.getRect(save);
        final feedbackRect = tester.getRect(find.byType(SnackBar));
        expect(
          feedbackRect.overlaps(saveRect),
          isFalse,
          reason:
              'Acknowledgement feedback must not intercept the save action.',
        );
        expect(saveRect.bottom, lessThanOrEqualTo(keyboard ? 574 : 840));
        await tester.tap(save);
        await tester.pump();
        expect(saves, 1);
        await tester.pump(const Duration(seconds: 5));
        await tester.pumpAndSettle();
        expect(find.text('Product image added.'), findsOneWidget);
        expect(
          tester.getRect(find.byType(SnackBar)).overlaps(tester.getRect(save)),
          isFalse,
        );
        await tester.tap(save);
        await tester.pump();
        expect(saves, 2);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}
