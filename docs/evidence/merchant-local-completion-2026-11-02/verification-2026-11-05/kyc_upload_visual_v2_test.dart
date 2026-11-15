// Actual KYC/shared form composition with controlled transport. No provider/device claim.
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/kyc_service.dart';
import 'package:letbuyy_store/screens/kyc/kyc_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../../../apps/merchant/mobile/test/kyc_containment_test.dart' as f;
const output='/Users/saai_mithra/.codex/worktrees/merchant-mobile-parity/LetBuyy/docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/kyc-upload-rendered-v2';
void main(){
 setUpAll(()async{await initializeLetbuyyTypography();await(FontLoader('MaterialIcons')..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();});
 for(final dark in[false,true])for(final large in[false,true])testWidgets('actual GST upload form ${dark?'dark':'light'} ${large?'320dp scale2.4':'390dp scale1'}',(tester)async{
  tester.view.devicePixelRatio=1;tester.view.physicalSize=large?const Size(320,760):const Size(390,844);addTearDown(tester.view.resetDevicePixelRatio);addTearDown(tester.view.resetPhysicalSize);WidgetController.hitTestWarningShouldBeFatal=true;
  final fixture=f.Fixture(),key=GlobalKey();addTearDown(()async{await tester.pumpWidget(const SizedBox.shrink());fixture.service.dispose();fixture.stores.dispose();fixture.api.close();});
  await tester.pumpWidget(RepaintBoundary(key:key,child:MultiProvider(providers:[ChangeNotifierProvider<StoreContext>.value(value:fixture.stores),ChangeNotifierProvider<KycService>.value(value:fixture.service)],child:MaterialApp(debugShowCheckedModeBanner:false,theme:dark?StoreTheme.dark():StoreTheme.light(),builder:(context,child)=>MediaQuery(data:MediaQuery.of(context).copyWith(textScaler:TextScaler.linear(large?2.4:1)),child:child!),home:const KycScreen()))));
  await tester.pump();await f.replyWidget(tester,fixture,{...f.overview('store-a'),'required_documents':[{'document_type':'gst_certificate','title':'GST certificate','required':true,'status':'draft'}]});await tester.pumpAndSettle();expect(tester.takeException(),isNull);
  final trigger=find.byKey(const ValueKey('record-reference-gst_certificate'));await tester.ensureVisible(trigger);await tester.pumpAndSettle();await tester.tap(trigger);await tester.pumpAndSettle();expect(tester.takeException(),isNull);
  Future<void> capture(String suffix)async{final boundary=key.currentContext!.findRenderObject()!as RenderRepaintBoundary;await tester.runAsync(()async{final frame=await boundary.toImage();try{final bytes=await frame.toByteData(format:ui.ImageByteFormat.png);final file=File('$output/${large?'large':'normal'}-${dark?'dark':'light'}-$suffix.png');await file.parent.create(recursive:true);expect(file.existsSync(),isFalse);await file.writeAsBytes(bytes!.buffer.asUint8List(),flush:true);}finally{frame.dispose();}});}
  await capture('top');await tester.ensureVisible(find.widgetWithText(FilledButton,'Upload document'));await tester.pumpAndSettle();expect(tester.takeException(),isNull);await capture('actions');expect(find.widgetWithText(DropdownButtonFormField<String>,'GST certificate'),findsOneWidget);await tester.tap(find.widgetWithText(TextButton,'Close'));await tester.pumpAndSettle();expect(find.text('Upload verification document'),findsNothing);expect(fixture.calls.where((r)=>r.method=='POST'),isEmpty);
 });
}
