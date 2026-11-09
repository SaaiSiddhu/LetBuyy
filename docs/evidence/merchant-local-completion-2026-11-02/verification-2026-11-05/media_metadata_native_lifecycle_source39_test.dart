// Actual screen/animated-dialog lifetime repro for native69. Synthetic transport
// validates this UI boundary only; actual native Worker/API effects are separate.
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import '/Users/saai_mithra/.codex/worktrees/merchant-mobile-parity/LetBuyy/apps/merchant/mobile/test/media_library_recovery_test.dart' as base;

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  for (final action in ['Cancel', 'Save']) {
    testWidgets('focused metadata $action finishes its animated route without Flutter errors', (tester) async {
      final semantics=tester.ensureSemantics();addTearDown(semantics.dispose);
      final f=base.Fixture();var writes=0;
      var row=<String,dynamic>{'id':'media-1','store_id':'store-a','filename':'document-1.pdf','url':'https://synthetic.invalid/one.pdf','mime_type':'application/pdf','media_type':'document','size_bytes':12,'alt_text':'Original synthetic label','folder':'media','tags':<String>[]};
      f.api.dio.interceptors.clear();
      f.api.dio.interceptors.add(InterceptorsWrapper(onRequest:(o,h){
        if(o.method=='PATCH'){writes++;row={...row,...Map<String,dynamic>.from(o.data as Map)};}
        h.resolve(Response(requestOptions:o,statusCode:200,data:{'data':o.method=='PATCH'?row:[row],'meta':{'has_next':false}}));
      }));
      await f.mount(tester);
      await tester.tap(find.byTooltip('Edit media').first);await tester.pumpAndSettle();
      final field=find.descendant(of:find.byType(AlertDialog),matching:find.byType(TextField)).first;
      await tester.enterText(field,'Saved synthetic label');await tester.pump();
      expect(tester.widget<TextField>(field).controller!.text,'Saved synthetic label');
      await tester.tap(find.widgetWithText(action=='Save'?FilledButton:TextButton,action));
      final failures=<Object>[];
      for(var i=0;i<25;i++){
        await tester.pump(const Duration(milliseconds:16));
        for(var failure=tester.takeException();failure!=null;failure=tester.takeException()){failures.add(failure);}
      }
      expect(failures,isEmpty,reason:'Closing a focused native editor must preserve the screen through its reverse transition: $failures');
      expect(writes,action=='Save'?1:0);
      expect(find.byType(AlertDialog),findsNothing);
      expect(find.text('document-1.pdf'),findsOneWidget);
      if(action=='Save')expect(find.text('Saved synthetic label'),findsOneWidget);
      expect(tester.takeException(),isNull);
    });
  }
}
