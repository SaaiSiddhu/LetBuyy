// Local widget renders with actual canonical fonts; not native picker/provider evidence.
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/screens/content/media_library_screen.dart';
import 'package:letbuyy_store/services/media_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:provider/provider.dart';
import '../../../../apps/merchant/mobile/test/media_library_recovery_test.dart' as m;
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    await initializeLetbuyyTypography();
    await (FontLoader('MaterialIcons')..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });
  for (final dark in [false,true]) for(final stored in [false,true]) {
    testWidgets('media recovery $stored ${dark?'dark':'light'} at320 scale2.4', (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      final f=m.Fixture(), visual=GlobalKey();
      await SecurityCommandStore().prepare((actorId:'synthetic-owner', storeId:f.stores.store, version:null),
        'media-upload', {'stage':stored?'create':'upload_pending'}, check:(){});
      tester.view.physicalSize=const Size(320,1000); tester.view.devicePixelRatio=1;
      addTearDown(tester.view.resetPhysicalSize); addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(() async {await tester.pumpWidget(const SizedBox.shrink()); f.media.dispose(); f.stores.dispose(); f.api.close();});
      await tester.pumpWidget(MultiProvider(providers:[
        ChangeNotifierProvider<StoreContext>.value(value:f.stores),
        ChangeNotifierProvider<MediaService>.value(value:f.media),
      ],child:MaterialApp(debugShowCheckedModeBanner:false,
        theme:dark?StoreTheme.dark():StoreTheme.light(),
        builder:(context,child)=>MediaQuery(data:MediaQuery.of(context).copyWith(textScaler:const TextScaler.linear(2.4)),child:child!),
        home:RepaintBoundary(key:visual,child:const MediaLibraryScreen()))));
      await tester.pumpAndSettle();
      final control=find.text(stored?'Confirm library entry':'Check saved upload');
      await tester.ensureVisible(control); await tester.pumpAndSettle();
      expect(control.hitTestable(),findsOneWidget);
      expect(tester.widget<FloatingActionButton>(find.byType(FloatingActionButton)).onPressed,isNull);
      expect(tester.takeException(),isNull);
      final boundary=visual.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final frame=await boundary.toImage();
        try {
          final bytes=await frame.toByteData(format:ui.ImageByteFormat.png);
          final output=Platform.environment['LETBUYY_MEDIA_RECOVERY_VISUAL_DIR']!;
          final file=File('$output/${dark?'dark':'light'}-${stored?'stored':'unknown'}.png');
          await file.parent.create(recursive:true); expect(file.existsSync(),isFalse);
          await file.writeAsBytes(bytes!.buffer.asUint8List(),flush:true);
        } finally {frame.dispose();}
      });
    });
  }
}
