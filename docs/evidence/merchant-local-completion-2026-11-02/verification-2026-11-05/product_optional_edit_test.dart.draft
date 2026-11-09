// Draft: actual existing editor and ProductService; synthetic transport only.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../../../../apps/merchant/mobile/test/product_edit_concurrency_test.dart' as f;

void main() {
  for(final shape in ['no-description','no-media','neither']) {
    testWidgets('name edit preserves canonical valid optional $shape product', (tester)async {
      tester.view.physicalSize=const Size(1000,1600);
      tester.view.devicePixelRatio=1;
      addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
      final api=f.ProductTransport('clean');
      if(shape!='no-media')api.current['description']=null;
      if(shape!='no-description')api.current['images']=[];
      final owners=await f.mount(tester,api);
      await tester.enterText(f.nameField(),'Renamed valid product');
      await tester.tap(find.widgetWithText(FilledButton,'Update'));
      await tester.pumpAndSettle();
      expect(api.calls,hasLength(1),reason:'A valid existing product must not require unrelated optional content before a name edit');
      final body=api.calls.single.body as Map;
      expect(body['name'],'Renamed valid product');
      if(shape!='no-media') {
        expect(body.containsKey('description'),isFalse,reason:'An unchanged null description must remain null in saved data');
        expect(api.current['description'],isNull);
      } else { expect(body['description'],'Synthetic complete description'); }
      if(shape!='no-description') { expect(body['images'],isEmpty);expect(api.current['images'],isEmpty); }
      expect(api.current['name'],'Renamed valid product');
      await tester.pumpWidget(const SizedBox.shrink());
      owners.service.dispose();owners.stores.dispose();api.close();
    });
  }
}
