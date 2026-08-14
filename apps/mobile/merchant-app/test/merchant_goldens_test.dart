import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/l10n/app_localizations.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/app_badge_service.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/screens/customers/customers_screen.dart';
import 'package:letbuyy_store/screens/orders/order_detail_screen.dart';
import 'package:letbuyy_store/screens/store_health/store_health_screen.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _TolerantGoldenComparator extends LocalFileComparator {
  _TolerantGoldenComparator(super.testFile, {this.tolerance = 0.01});

  final double tolerance;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );

    if (!result.passed && result.diffPercent <= tolerance) {
      debugPrint(
        'A difference of ${(result.diffPercent * 100).toStringAsFixed(2)}% was found, '
        'which is within acceptable tolerance of ${(tolerance * 100).toStringAsFixed(2)}%.',
      );
      return true;
    }

    if (!result.passed) {
      final error = await generateFailureOutput(result, golden, basedir);
      throw FlutterError(error);
    }
    return result.passed;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    if (goldenFileComparator is LocalFileComparator) {
      final testUrl = (goldenFileComparator as LocalFileComparator).basedir;
      goldenFileComparator = _TolerantGoldenComparator(
        Uri.parse('$testUrl/merchant_goldens_test.dart'),
        tolerance: 0.01,
      );
    }
  });

  testWidgets('golden: order detail fulfillment surface', (tester) async {
    final api = _GoldenApiClient();
    await _pumpGolden(
      tester,
      providers: _orderProviders(api),
      child: OrderDetailScreen(
        orderId: 'order_1',
        initialOrder: OrderContract.fromJson(_orderJson()),
      ),
    );

    await expectLater(
      find.byType(OrderDetailScreen),
      matchesGoldenFile('goldens/order_detail_fulfillment.png'),
    );
  });

  testWidgets('golden: customers CRM list surface', (tester) async {
    final api = _GoldenApiClient();
    await _pumpGolden(
      tester,
      providers: _storeProviders(api),
      child: const CustomersScreen(),
    );

    await expectLater(
      find.byType(CustomersScreen),
      matchesGoldenFile('goldens/customers_crm_list.png'),
    );
  });

  testWidgets('golden: store health center surface', (tester) async {
    final api = _GoldenApiClient();
    await _pumpGolden(
      tester,
      providers: _storeProviders(api),
      child: const StoreHealthScreen(),
    );

    await expectLater(
      find.byType(StoreHealthScreen),
      matchesGoldenFile('goldens/store_health_center.png'),
    );
  });
}

Future<void> _pumpGolden(
  WidgetTester tester, {
  required List<SingleChildWidget> providers,
  required Widget child,
}) async {
  SharedPreferences.setMockInitialValues({
    'letbuyy.selected_store_id': 'store_1',
  });
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;

  await tester.pumpWidget(
    MultiProvider(
      providers: providers,
      child: MaterialApp(
        localizationsDelegates: const [AppLocalizations.delegate],
        supportedLocales: AppLocalizations.supportedLocales,
        theme: ThemeData(useMaterial3: true),
        home: child,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

List<SingleChildWidget> _storeProviders(_GoldenApiClient api) {
  final cache = CacheService.memory();
  final storeService = StoreService(api: api, cache: cache);
  return [
    Provider<ApiClient>.value(value: api),
    Provider<CacheService>.value(value: cache),
    ChangeNotifierProvider<StoreService>.value(value: storeService),
    ChangeNotifierProvider<StoreContext>(
      create: (_) => StoreContext(storeService: storeService),
    ),
    ChangeNotifierProvider<CustomerService>(
      create: (_) => CustomerService(api: api),
    ),
  ];
}

List<SingleChildWidget> _orderProviders(_GoldenApiClient api) {
  final appBadgeService = const AppBadgeService();
  return [
    Provider<ApiClient>.value(value: api),
    ChangeNotifierProvider<OrderService>(
      create: (_) => OrderService(
        api: api,
        cache: CacheService.memory(),
        appBadgeService: appBadgeService,
      ),
    ),
    Provider<AppBadgeService>.value(value: appBadgeService),
  ];
}

class _GoldenApiClient extends ApiClient {
  _GoldenApiClient() : super(baseUrl: 'https://gateway.test/v1');

  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    return {'success': true, 'data': _jsonFor(path)};
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    return Map<String, dynamic>.from(_jsonFor(path) as Map);
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    return decoder(_jsonFor(path));
  }

  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    final rows = _rowsFor(path);
    return PaginatedResponse<JsonMap>(
      data: rows,
      total: rows.length,
      page: 1,
      limit: rows.length,
      hasMore: false,
    );
  }

  List<Map<String, dynamic>> _rowsFor(String path) {
    switch (path) {
      case '/stores':
        return [_storeJson()];
      case '/customers':
        return [
          _customerJson(),
          _customerJson(
            id: 'customer_2',
            email: 'anu@example.com',
            firstName: 'Anu',
            lastName: 'Sharma',
          ),
        ];
    }
    return const [];
  }

  Object _jsonFor(String path) {
    switch (path) {
      case '/orders/order_1':
        return _orderJson();
      case '/stores/store_1/health':
        return _storeHealthJson();
      case '/customers/segments':
        return [_customerSegmentJson()];
    }
    return {};
  }
}

Map<String, dynamic> _storeJson() => {
  'id': 'store_1',
  'seller_id': 'seller_1',
  'name': 'Demo Store India',
  'tagline': 'Everyday essentials',
  'subdomain': 'demo',
  'store_url': 'https://demo.letbuyy.com',
  'theme_id': 'modern',
  'tax_inclusive': false,
  'dns_config': const {},
  'business_profile': const {},
  'invoice_address': const {},
  'invoice_number_next': 1,
  'created_at': '2026-06-01T00:00:00.000Z',
  'updated_at': '2026-06-01T00:00:00.000Z',
};

Map<String, dynamic> _orderJson() => {
  'id': 'order_1',
  'store_id': 'store_1',
  'order_number': 'LB-1001',
  'customer_name': 'Meera Merchant',
  'customer_email': 'meera@example.com',
  'customer_phone': '+919999999999',
  'status': 'paid',
  'payment_status': 'paid',
  'fulfillment_status': 'unfulfilled',
  'currency': 'INR',
  'subtotal': 1499,
  'discount_amount': 100,
  'shipping_amount': 60,
  'tax_amount': 72,
  'total': 1531,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:30:00.000Z',
  'shipping_address': const {
    'name': 'Meera Merchant',
    'line1': '12 Market Road',
    'city': 'Bengaluru',
    'state': 'Karnataka',
    'postal_code': '560001',
    'country': 'IN',
  },
  'billing_address': const {
    'name': 'Meera Merchant',
    'line1': '12 Market Road',
    'city': 'Bengaluru',
    'state': 'Karnataka',
    'postal_code': '560001',
    'country': 'IN',
  },
  'line_items': const [
    {
      'id': 'line_1',
      'name': 'Cotton Tee',
      'sku': 'TEE-001',
      'quantity': 2,
      'unit_price': 699,
      'total': 1398,
      'currency': 'INR',
    },
    {
      'id': 'line_2',
      'name': 'Gift Wrap',
      'sku': 'GIFT-001',
      'quantity': 1,
      'unit_price': 101,
      'total': 101,
      'currency': 'INR',
    },
  ],
};

Map<String, dynamic> _customerJson({
  String id = 'customer_1',
  String email = 'meera@example.com',
  String firstName = 'Meera',
  String lastName = 'Merchant',
}) => {
  'id': id,
  'store_id': 'store_1',
  'email': email,
  'phone': '+919999999999',
  'first_name': firstName,
  'last_name': lastName,
  'display_name': '$firstName $lastName',
  'status': 'active',
  'accepts_marketing': true,
  'tags': ['vip'],
  'notes': 'Prefers COD',
  'order_count': id == 'customer_1' ? 4 : 1,
  'total_spent': id == 'customer_1' ? 7899 : 999,
  'last_order_at': '2026-06-01T10:00:00.000Z',
  'addresses': const [
    {
      'name': 'Customer',
      'line1': '12 Market Road',
      'city': 'Bengaluru',
      'state': 'Karnataka',
      'postal_code': '560001',
      'country': 'IN',
    },
  ],
};

Map<String, dynamic> _customerSegmentJson() => {
  'id': 'segment_1',
  'site_id': 'store_1',
  'name': 'VIP customers',
  'description': 'High-value repeat buyers',
  'definition': const {
    'rules': [
      {'field': 'tag', 'operator': 'contains', 'value': 'vip'},
    ],
  },
  'customer_count': 1,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
};

Map<String, dynamic> _storeHealthJson() => {
  'store_id': 'store_1',
  'score': 84,
  'generated_at': '2026-06-01T10:00:00.000Z',
  'pillars': const [
    {
      'id': 'launch',
      'label': 'Launch readiness',
      'score': 88,
      'status': 'ready',
      'summary': 'Store is published with visible branding.',
      'action_label': 'Review details',
      'route': '/store-details',
      'metrics': {'status': 'published'},
    },
    {
      'id': 'catalog',
      'label': 'Catalog and inventory',
      'score': 72,
      'status': 'attention',
      'summary': '1 product needs inventory attention.',
      'action_label': 'Open products',
      'route': '/products',
      'metrics': {'product_count': 4, 'low_stock_count': 1},
    },
    {
      'id': 'orders',
      'label': 'Orders and fulfillment',
      'score': 92,
      'status': 'ready',
      'summary': 'Orders are moving through fulfillment.',
      'action_label': 'Open orders',
      'route': '/orders',
      'metrics': {'open_orders': 2},
    },
  ],
};
