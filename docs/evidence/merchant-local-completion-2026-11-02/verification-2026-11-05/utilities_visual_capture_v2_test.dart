// Diagnostic rendering only. No native launch, backend call or production data.
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/settings/help_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/shared/capability_gate.dart';
import 'package:letbuyy_store/widgets/shared/confirm_dialog.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

const directory = '/Users/saai_mithra/.codex/worktrees/merchant-mobile-parity/LetBuyy/docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/utility-rendered-v2';

void main() {
  setUpAll(() async {
    await initializeLetbuyyTypography();
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
  });
  testWidgets('capture actual utility widgets in both themes and difficult text', (tester) async {
    WidgetController.hitTestWarningShouldBeFatal = true;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    Future<GlobalKey> mount(Widget child, bool dark, Size size, double scale) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      final key = GlobalKey();
      await tester.pumpWidget(RepaintBoundary(key: key, child: MaterialApp(debugShowCheckedModeBanner: false,
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: child,
      )));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      return key;
    }
    Future<void> capture(GlobalKey key, String name) async {
      final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final frame = await boundary.toImage();
        try {
          final bytes = await frame.toByteData(format: ui.ImageByteFormat.png);
          final out = File('$directory/$name.png');
          await out.parent.create(recursive: true);
          await out.writeAsBytes(bytes!.buffer.asUint8List(), flush: true);
        } finally {
          frame.dispose();
        }
      });
    }
    for (final dark in [false, true]) {
      final theme = dark ? 'dark' : 'light';
      var key = await mount(const HelpScreen(), dark, const Size(390, 844), 1);
      await capture(key, 'help-normal-$theme');
      key = await mount(const HelpScreen(), dark, const Size(320, 620), 2.4);
      await capture(key, 'help-large-$theme');
      key = await mount(Scaffold(body: Builder(builder: (context) => TextButton(
        onPressed: () => ConfirmDialog.show(context,
          title: 'Reload the currently selected store details?',
          message: 'The current unsaved draft will be discarded only after this confirmation. Review the consequence first.',
          confirmLabel: 'Reload the saved store details',
          cancelLabel: 'Keep the current unsaved edits', isDestructive: true),
        child: const Text('Open'),
      ))), dark, const Size(320, 620), 2.4);
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await capture(key, 'confirmation-large-$theme');
      await tester.tap(find.text('Keep the current unsaved edits'));
      await tester.pumpAndSettle();
      key = await mount(Scaffold(body: CapabilityGate(
        availability: FeatureAvailability.providerSetupRequired,
        title: 'Review the currently selected store configuration',
        description: 'This workflow needs the supported configuration before it can continue. Your existing saved records remain available through their current authorized destinations.',
        primaryActionLabel: 'Review the supported store setup', onPrimaryAction: () {},
      )), dark, const Size(320, 360), 2.4);
      await capture(key, 'capability-large-top-$theme');
      await tester.ensureVisible(find.text('Review the supported store setup'));
      await tester.pumpAndSettle();
      await capture(key, 'capability-large-action-$theme');
      expect(tester.takeException(), isNull);
    }
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
}
