// Diagnostic widget renderer only; no backend/native acceptance.
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/store/store_switcher_button.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../../../apps/merchant/mobile/test/store_switcher_presentation_test.dart' as fixture;
const output = '/Users/saai_mithra/.codex/worktrees/merchant-mobile-parity/LetBuyy/docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/switcher-rendered-v2';
void main() {
  setUpAll(() async {
    await initializeLetbuyyTypography();
    await (FontLoader('MaterialIcons')..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });
  testWidgets('capture canonical store selector in both themes and large text', (tester) async {
    WidgetController.hitTestWarningShouldBeFatal = true;
    for (final dark in [false, true]) {
      for (final large in [false, true]) {
        final h = fixture.Harness();
        await h.mount(tester, dark: dark, size: large ? const Size(320,620) : const Size(390,844), scale: large ? 2.4 : 1);
        if (large) {
          h.service.rows = [fixture.row(fixture.a, name: 'Long authorised store name, branch and reference Alpha'), fixture.row(fixture.b, name: 'Long authorised store name, branch and reference Beta')];
          await h.stores.loadStores(force: true);
        }
        final key=GlobalKey();
        await tester.pumpWidget(RepaintBoundary(key:key, child:ChangeNotifierProvider.value(value:h.stores, child:MaterialApp(
          debugShowCheckedModeBanner:false, theme:dark?StoreTheme.dark():StoreTheme.light(),
          builder:(context,child)=>MediaQuery(data:MediaQuery.of(context).copyWith(textScaler:TextScaler.linear(large?2.4:1)),child:child!),
          home:Scaffold(body:Align(alignment:Alignment.topCenter,child:StoreSwitcherButton(onChanged:(){}))),
        ))));
        await tester.pumpAndSettle();
        await tester.tap(find.descendant(of:find.byType(StoreSwitcherButton),matching:find.byWidgetPredicate((w)=>w is ButtonStyleButton)));
        await tester.pumpAndSettle();
        expect(tester.takeException(),isNull);
        Future<void> capture(String suffix) async {
          final boundary=key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
          await tester.runAsync(() async {
            final frame=await boundary.toImage();
            try {
              final bytes=await frame.toByteData(format:ui.ImageByteFormat.png);
              final file=File('$output/selector-${large?'large':'normal'}-${dark?'dark':'light'}-$suffix.png');
              await file.parent.create(recursive:true); await file.writeAsBytes(bytes!.buffer.asUint8List(),flush:true);
            } finally {frame.dispose();}
          });
        }
        await capture('top');
        if(large) {
          await tester.ensureVisible(find.text('Long authorised store name, branch and reference Beta'));
          await tester.pumpAndSettle(); await capture('last-choice');
        }
        await tester.ensureVisible(find.byTooltip('Close'));
        await tester.pumpAndSettle();
        await tester.tap(find.byTooltip('Close'));
        await tester.pumpAndSettle();
        expect(tester.takeException(),isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      }
    }
  });
}
