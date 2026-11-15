// Isolated visual baseline: registering real fonts must not change other test
// files' existing Ahem baselines. This is fixture/widget evidence, not native QA.
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:letbuyy_store/screens/orders/order_detail_screen.dart';
import 'merchant_goldens_test.dart' as fixtures;
import 'order_detail_presentation_test.dart' as detail;
import 'orders_read_presentation_test.dart' as read;

void main() {
  testWidgets('golden: order detail fulfillment surface', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = detail.DetailUiTransport()
      ..result = {
        ...fixtures.goldenOrderJson(),
        'id': read.recordId,
        'store_id': read.site,
      };
    await detail.mountDetail(tester, api, initial: false);
    await tester.runAsync(() async {
      await GoogleFonts.pendingFonts();
      final icons = FontLoader('MaterialIcons')
        ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
      await icons.load();
    });
    await tester.pumpAndSettle();
    expect(api.detailReads, hasLength(1));
    expect(find.text('LB-1001'), findsOneWidget);
    expect(find.text('₹1,531.00'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(OrderDetailScreen),
      matchesGoldenFile('goldens/order_detail_fulfillment.png'),
    );
  });
}
