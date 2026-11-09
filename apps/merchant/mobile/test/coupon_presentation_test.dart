// Synthetic presentation/SDK contract checks, not hosted commerce acceptance.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/app/routes.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/discounts/coupon_form_screen.dart';
import 'package:letbuyy_store/screens/discounts/coupons_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/coupon_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';

const site = '11111111-1111-4111-8111-111111111111';
JsonMap coupon({double value = 12.75}) => {
  'id': '22222222-2222-4222-8222-222222222222',
  'store_id': site,
  'code': 'SYNTHETIC',
  'type': 'percentage',
  'value': value,
  'is_active': true,
  'usage_count': 4,
  'currency': 'INR',
};

class CouponTransport extends ApiClient {
  CouponTransport() : super(baseUrl: 'https://coupon.synthetic.invalid/v1');
  int epoch = 0;
  final queries = <QueryParams>[];
  final commands = <({String path, ApiRequestOptions options})>[];
  List<JsonMap> rows = [coupon()];
  JsonMap validation = {'valid': false, 'reason': 'Synthetic code unavailable'};
  Future<PaginatedResponse<JsonMap>> Function(ApiRequestOptions?)? pageReply;
  Future<JsonMap> Function(String, ApiRequestOptions)? commandReply;
  @override
  Object captureRequestContext() => epoch;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    expect(path, '/coupons');
    queries.add(Map.of(options?.query ?? {}));
    if (pageReply != null) return pageReply!(options);
    final page = options?.query?['page'] as int? ?? 1;
    final limit = options?.query?['limit'] as int? ?? 50;
    return PaginatedResponse(
      data: rows,
      total: rows.length,
      page: page,
      limit: limit,
      hasMore: false,
      meta: {
        'total': rows.length,
        'page': page,
        'per_page': limit,
        'has_next': false,
      },
    );
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    commands.add((path: path, options: options!));
    if (commandReply != null) return commandReply!(path, options);
    if (path == '/coupons/validate') return validation;
    return {...coupon(), ...?options.body as Map<String, dynamic>?};
  }
}

class CouponScope extends StoreContext {
  CouponScope(this.api) : super(storeService: StoreService(api: api));
  final CouponTransport api;
  int epoch = 0;
  String selected = site;
  @override
  Object get requestContextKey => epoch;
  @override
  String get selectedStoreId => selected;
  @override
  StoreModel get selectedStore => StoreModel.fromJson({
    'id': selected,
    'name': 'Synthetic store',
    'subdomain': 'synthetic',
  });
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async =>
      selectedStore;
  void retire({String? store}) {
    epoch++;
    api.epoch = epoch;
    selected = store ?? selected;
    notifyListeners();
  }
}

Finder field(String label) => find.byWidgetPredicate(
  (w) => w is TextField && w.decoration?.labelText == label,
);
Finder icon(String label) =>
    find.byWidgetPredicate((w) => w is IconButton && w.tooltip == label);
Future<void> reveal(WidgetTester tester, Finder target) async {
  final scroll = find
      .byWidgetPredicate(
        (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
      )
      .last;
  if (target.evaluate().isEmpty) {
    await tester.scrollUntilVisible(target, 160, scrollable: scroll);
  } else {
    await tester.ensureVisible(target);
  }
  await tester.pumpAndSettle();
}

Future<
  ({
    CouponScope scope,
    CouponService service,
    GlobalKey<NavigatorState> navigator,
  })
>
mount(
  WidgetTester tester,
  CouponTransport api, {
  Widget? screen,
  bool dark = false,
  double scale = 1,
  Size size = const Size(390, 844),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final scope = CouponScope(api),
      service = CouponService(api: api),
      navigator = GlobalKey<NavigatorState>();
  addTearDown(scope.dispose);
  addTearDown(service.dispose);
  addTearDown(api.close);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<StoreContext>.value(value: scope),
        ChangeNotifierProvider<CouponService>.value(value: service),
      ],
      child: MaterialApp(
        navigatorKey: navigator,
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: screen ?? const CouponsScreen(),
        onGenerateRoute: AppRoutes.generateRoute,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  return (scope: scope, service: service, navigator: navigator);
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  test('active reader binds the canonical server status field', () async {
    final api = CouponTransport();
    final owner = CouponService(api: api);
    addTearDown(api.close);
    addTearDown(owner.dispose);
    await owner.fetchCoupons(site, active: true, page: 2, limit: 20);
    expect(api.queries.single, {
      'store_id': site,
      'page': 2,
      'limit': 20,
      'status': 'active',
    });
  });
  testWidgets('editing preserves the exact fractional input from the server', (
    tester,
  ) async {
    await mount(
      tester,
      CouponTransport(),
      screen: CouponFormScreen(
        storeId: site,
        coupon: CouponContract.fromJson(coupon()),
      ),
    );
    expect(
      tester.widget<TextField>(field('Discount percentage')).controller!.text,
      '12.75',
    );
  });
  testWidgets('list reads observed usage_count rather than inventing zero', (
    tester,
  ) async {
    await mount(tester, CouponTransport());
    await reveal(tester, find.textContaining('4/unlimited used'));
    expect(find.textContaining('4/unlimited used'), findsOneWidget);
  });
  testWidgets('normal200 rejected code never reports a valid coupon', (
    tester,
  ) async {
    final api = CouponTransport();
    await mount(tester, api);
    await tester.tap(find.text('Validate'));
    await tester.pumpAndSettle();
    await tester.enterText(field('Code'), 'INVALID');
    await tester.tap(find.text('Validate').last);
    await tester.pumpAndSettle();
    expect(find.textContaining('Synthetic code unavailable'), findsOneWidget);
    expect(find.text('Coupon is valid'), findsNothing);
    expect(api.commands.single.path, '/coupons/validate');
  });
}
