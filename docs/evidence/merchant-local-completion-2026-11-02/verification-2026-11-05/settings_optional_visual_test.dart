// Diagnostic current composition only; controlled denied optional reads, no backend/device claim.
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/subscription_service.dart';
import 'package:letbuyy_store/services/theme_provider.dart';
import 'package:letbuyy_store/screens/settings/settings_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../../../apps/merchant/mobile/test/settings_optional_reads_test.dart' as optional;
import '../../../../apps/merchant/mobile/test/store_switcher_presentation_test.dart' as fixture;
const output='/Users/saai_mithra/.codex/worktrees/merchant-mobile-parity/LetBuyy/docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/settings-optional-rendered-v1';
void main() {
  setUpAll(() async { await initializeLetbuyyTypography(); await(FontLoader('MaterialIcons')..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load(); });
  testWidgets('current Staff settings survives denied optional panels in both themes and large text',(tester)async {
    SharedPreferences.setMockInitialValues({});
    WidgetController.hitTestWarningShouldBeFatal=true;
    for(final dark in [false,true])for(final large in [false,true]) {
      final h=fixture.Harness();await h.mount(tester,dark:dark,size:large?const Size(320,620):const Size(390,844),scale:large?2.4:1);
      await h.stores.selectStoreById(fixture.b);
      final reads=optional.Reads(h.api);
      reads.billingErrors[fixture.b]=const ApiException(message:'Synthetic restricted billing',statusCode:403,code:'FORBIDDEN');
      reads.paymentErrors[fixture.b]=const ApiException(message:'Synthetic owner-only config',statusCode:404,code:'NOT_FOUND');
      final theme=ThemeProvider();addTearDown(theme.dispose);await theme.setThemeMode(dark?ThemeMode.dark:ThemeMode.light);
      final key=GlobalKey();
      await tester.pumpWidget(RepaintBoundary(key:key,child:MultiProvider(providers:[
        ChangeNotifierProvider<StoreContext>.value(value:h.stores),
        ChangeNotifierProvider<StoreService>.value(value:h.service),
        ChangeNotifierProvider<ThemeProvider>.value(value:theme),
        Provider<SubscriptionService>.value(value:reads),
      ],child:MaterialApp(debugShowCheckedModeBanner:false,theme:dark?StoreTheme.dark():StoreTheme.light(),builder:(context,child)=>MediaQuery(data:MediaQuery.of(context).copyWith(textScaler:TextScaler.linear(large?2.4:1)),child:child!),home:const SettingsScreen()))));
      await tester.pumpAndSettle();expect(tester.takeException(),isNull);
      Future<void> capture(String suffix)async {
        final boundary=key.currentContext!.findRenderObject()!as RenderRepaintBoundary;
        await tester.runAsync(()async {final frame=await boundary.toImage();try {final bytes=await frame.toByteData(format:ui.ImageByteFormat.png);final file=File('$output/settings-${large?'large':'normal'}-${dark?'dark':'light'}-$suffix.png');await file.parent.create(recursive:true);await file.writeAsBytes(bytes!.buffer.asUint8List(),flush:true);}finally{frame.dispose();}});
      }
      await capture('top');
      await tester.scrollUntilVisible(find.text('Payment Options'),300,maxScrolls:50);await tester.pumpAndSettle();await capture('payment');
      await tester.scrollUntilVisible(find.text('Online Payment (Razorpay)'),220,maxScrolls:15);await tester.pumpAndSettle();await capture('payment-online');
      expect(tester.takeException(),isNull);
      await tester.pumpWidget(const SizedBox.shrink());await tester.pumpAndSettle();
    }
  });
}
