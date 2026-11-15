// Prepared outside frozen inputs. Run/move only after the currently active
// qualification or native run has a collected terminal and owned cleanup.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/widgets/shared/confirm_dialog.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'supporting_presentation_test.dart' as s;

void main() {
  setUpAll(initializeLetbuyyTypography);

  testWidgets('covered legacy confirmation cannot pop the covering route', (
    tester,
  ) async {
    bool? result;
    final owner = await s.mount(
      tester,
      s.HealthTransport(),
      child: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () async {
              result = await ConfirmDialog.show(
                context,
                title: 'Discard draft?',
                message: 'Only discard after this confirmation.',
                confirmLabel: 'Discard',
              );
            },
            child: const Text('Open confirmation'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open confirmation'));
    await tester.pumpAndSettle();
    final old = tester.widget<ButtonStyleButton>(s.button('Discard')).onPressed!;
    await s.cover(tester, owner.navigator);
    old();
    await tester.pumpAndSettle();
    expect(find.text('Cover'), findsOneWidget);
    expect(result, isNull);
    owner.navigator.currentState!.pop();
    await tester.pumpAndSettle();
    await tester.tap(s.button('Discard'));
    await tester.pumpAndSettle();
    expect(result, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('covered owner cannot open a new legacy confirmation', (
    tester,
  ) async {
    late BuildContext origin;
    final owner = await s.mount(
      tester,
      s.HealthTransport(),
      child: Builder(builder: (context) {
        origin = context;
        return const Scaffold(body: Text('Original owner'));
      }),
    );
    await s.cover(tester, owner.navigator);
    final pending = ConfirmDialog.show(
      origin,
      title: 'Old confirmation',
      message: 'Must not be presented over a newer task.',
    );
    await tester.pumpAndSettle();
    expect(find.text('Old confirmation'), findsNothing);
    expect(await pending, isFalse);
  });

  testWidgets('disposed owner returns false without navigator access', (
    tester,
  ) async {
    late BuildContext origin;
    await s.mount(
      tester,
      s.HealthTransport(),
      child: Builder(builder: (context) {
        origin = context;
        return const Scaffold(body: Text('Original owner'));
      }),
    );
    await tester.pumpWidget(const MaterialApp(home: Text('New app owner')));
    expect(
      await ConfirmDialog.show(
        origin,
        title: 'Old confirmation',
        message: 'The originating widget was disposed.',
      ),
      isFalse,
    );
    expect(tester.takeException(), isNull);
  });

  for (final confirmed in [false, true]) {
    testWidgets('legacy result $confirmed and optional visuals stay exact', (
      tester,
    ) async {
      bool? result;
      final owner = await s.mount(
        tester,
        s.HealthTransport(),
        child: Builder(builder: (context) {
          return Scaffold(
            body: TextButton(
              onPressed: () async {
                result = await ConfirmDialog.show(
                  context,
                  title: 'Existing consequence',
                  message: 'Original message',
                  confirmLabel: 'Proceed',
                  cancelLabel: 'Keep editing',
                  icon: Icons.warning_amber,
                  confirmColor: Colors.amber,
                );
              },
              child: const Text('Open confirmation'),
            ),
          );
        }),
      );
      await tester.tap(find.text('Open confirmation'));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.warning_amber), findsOneWidget);
      final style = tester.widget<ButtonStyleButton>(s.button('Proceed')).style;
      expect(style?.backgroundColor?.resolve({}), Colors.amber);
      final old = tester.widget<ButtonStyleButton>(s.button(
        confirmed ? 'Proceed' : 'Keep editing',
      )).onPressed!;
      old();
      await tester.pumpAndSettle();
      expect(result, confirmed);
      await s.cover(tester, owner.navigator);
      old();
      await tester.pumpAndSettle();
      expect(find.text('Cover'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  for (final dark in [false, true]) {
    testWidgets('long confirmation actions wrap at320dp scale2.4 dark=$dark', (
      tester,
    ) async {
      await s.mount(
        tester,
        s.HealthTransport(),
        dark: dark,
        size: const Size(320, 620),
        scale: 2.4,
        child: Builder(builder: (context) {
          return Scaffold(
            body: TextButton(
              onPressed: () => ConfirmDialog.show(
                context,
                title: 'Reload the currently selected store details?',
                message: 'The current unsaved draft will be discarded only '
                    'after this confirmation. Review the consequence first.',
                confirmLabel: 'Reload the saved store details',
                cancelLabel: 'Keep the current unsaved edits',
                isDestructive: true,
              ),
              child: const Text('Open'),
            ),
          );
        }),
      );
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      final action = s.button('Keep the current unsaved edits');
      await tester.ensureVisible(action);
      await tester.tap(action);
      await tester.pumpAndSettle();
      expect(find.text('Open'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
