import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:integration_test/integration_test.dart';
import 'package:letbuyy_store/app/routes.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/config/app_config.dart';
import 'package:letbuyy_store/l10n/app_localizations.dart';
import 'package:letbuyy_store/services/ai_studio_service.dart';
import 'package:letbuyy_store/services/analytics_service.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/app_badge_service.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/home_widget_service.dart';
import 'package:letbuyy_store/services/language_service.dart';
import 'package:letbuyy_store/services/money_service.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/subscription_service.dart';
import 'package:letbuyy_store/services/theme_provider.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'merchant signs in, opens an order, and ships it',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      SharedPreferences.setMockInitialValues({
        'letbuyy.selected_store_id': 'store_1',
      });
      final api = _IntegrationApiClient();
      final authService = StoreAuthService(
        api: api,
        identityBaseUrl: 'https://accounts.test',
        httpClient: _identityClient(),
        turnstileTokenProvider: () => 'integration-turnstile-token',
      );

      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.view.physicalSize = const Size(430, 932);
      tester.view.devicePixelRatio = 1;

      await tester.pumpWidget(
        MultiProvider(
          providers: _providers(api, authService),
          child: MaterialApp(
            localizationsDelegates: const [AppLocalizations.delegate],
            supportedLocales: AppLocalizations.supportedLocales,
            initialRoute: AppRoutes.login,
            onGenerateRoute: AppRoutes.generateRoute,
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));

      await tester.enterText(
        find.byType(TextFormField).at(0),
        'merchant@example.com',
      );
      await tester.enterText(find.byType(TextFormField).at(1), 'Password123');
      await tester.tap(find.text('Continue'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 2));

      expect(find.bySemanticsLabel('Orders tab'), findsOneWidget);
      expect(api.paths, contains('/stores'));

      await tester.tap(find.bySemanticsLabel('Orders tab'));
      await tester.pump(const Duration(seconds: 1));
      expect(api.paths, contains('/orders'));

      final orderFinder = find.text('order_1').first;
      await tester.ensureVisible(orderFinder);
      await tester.tap(orderFinder);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(api.paths, contains('/orders/order_1'));
      expect(find.text('Fulfill'), findsOneWidget);

      await tester.tap(find.text('Fulfill'));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('Fulfill order'), findsOneWidget);

      await tester.enterText(
        find.widgetWithText(TextField, 'Carrier'),
        'Shiprocket',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Tracking number'),
        'TRK123',
      );
      await tester.tap(find.text('Ship'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(api.paths, contains('/orders/order_1/fulfill'));
      expect(
        api.bodies['/orders/order_1/fulfill'],
        containsPair('carrier', 'Shiprocket'),
      );
      expect(
        api.bodies['/orders/order_1/fulfill'],
        containsPair('tracking_number', 'TRK123'),
      );
      expect(find.text('Order marked shipped'), findsOneWidget);
      expect(find.textContaining('S-0'), findsNothing);
      expect(find.textContaining('backend contract'), findsNothing);
      expect(find.textContaining('SKIP_NEEDS_HUMAN'), findsNothing);
    },
    skip: !AppConfig.hasTurnstileToken,
  );
}

List<SingleChildWidget> _providers(
  ApiClient api,
  StoreAuthService authService,
) {
  final cache = CacheService.memory();
  final storeService = StoreService(api: api, cache: cache);
  final appBadgeService = const AppBadgeService();

  return [
    Provider<ApiClient>.value(value: api),
    Provider<CacheService>.value(value: cache),
    ChangeNotifierProvider<LanguageService>(create: (_) => LanguageService()),
    ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
    ChangeNotifierProvider<StoreService>.value(value: storeService),
    ChangeNotifierProvider<StoreAuthService>.value(value: authService),
    ChangeNotifierProvider<StoreContext>(
      create: (_) => StoreContext(storeService: storeService),
    ),
    ChangeNotifierProvider<ProductService>(
      create: (_) => ProductService(api: api, cache: cache),
    ),
    ChangeNotifierProvider<OrderService>(
      create: (_) => OrderService(
        api: api,
        cache: cache,
        appBadgeService: appBadgeService,
      ),
    ),
    ChangeNotifierProvider<CustomerService>(
      create: (_) => CustomerService(api: api),
    ),
    ChangeNotifierProvider<AnalyticsService>(
      create: (_) => AnalyticsService(api: api),
    ),
    ChangeNotifierProvider<MoneyService>(create: (_) => MoneyService(api: api)),
    ChangeNotifierProvider<AiStudioService>(
      create: (_) => AiStudioService(api: api),
    ),
    Provider<AppBadgeService>.value(value: appBadgeService),
    Provider<HomeWidgetService>(create: (_) => const HomeWidgetService()),
    Provider<SubscriptionService>(create: (_) => SubscriptionService(api: api)),
  ];
}

MockClient _identityClient() {
  return MockClient((request) async {
    switch (request.url.path) {
      case '/login':
        return http.Response(
          '',
          200,
          headers: {'set-cookie': 'letbuyy_csrf=csrf_123; Path=/;'},
        );
      case '/api/auth/login':
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['email'], 'merchant@example.com');
        expect(body['password'], 'Password123');
        expect(body['turnstileToken'], 'integration-turnstile-token');
        expect(request.headers['X-CSRF-Token'], 'csrf_123');
        return http.Response(
          '{"success":true}',
          200,
          headers: {'set-cookie': 'lb_session=session_123; Path=/;'},
        );
      case '/api/auth/session':
        return http.Response(
          '{"authenticated":true,"user":{"id":"merchant_1","email":"merchant@example.com"}}',
          200,
          headers: {'content-type': 'application/json'},
        );
    }
    return http.Response('not found', 404);
  });
}

class _IntegrationApiClient extends ApiClient {
  _IntegrationApiClient() : super(baseUrl: 'https://gateway.test/v1');

  final List<String> paths = [];
  final Map<String, Object?> bodies = {};

  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    paths.add(path);
    _captureBody(path, options);
    return {'success': true, 'data': _jsonFor(path)};
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    paths.add(path);
    _captureBody(path, options);
    return Map<String, dynamic>.from(_jsonFor(path) as Map);
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    paths.add(path);
    _captureBody(path, options);
    return decoder(_jsonFor(path));
  }

  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    paths.add(path);
    _captureBody(path, options);
    final rows = _rowsFor(path);
    return PaginatedResponse<JsonMap>(
      data: rows,
      total: rows.length,
      page: 1,
      limit: rows.length,
      hasMore: false,
    );
  }

  void _captureBody(String path, ApiRequestOptions? options) {
    final body = options?.body;
    if (body != null) bodies[path] = body;
  }

  List<Map<String, dynamic>> _rowsFor(String path) {
    switch (path) {
      case '/stores':
        return [_storeJson()];
      case '/orders':
        return [_orderJson()];
      case '/products':
        return [_productJson()];
      case '/customers':
        return [_customerJson()];
      case '/customers/segments':
        return [_customerSegmentJson()];
    }
    return const [];
  }

  Object _jsonFor(String path) {
    switch (path) {
      case '/analytics/dashboard':
        return {
          'summary': {
            'revenue': {'value': 499},
            'orders': {'value': 1},
            'products': 1,
            'avg_order_value': 499,
          },
        };
      case '/analytics/orders':
        return {
          'breakdown': {'paid': 1},
        };
      case '/analytics/revenue':
        return {
          'chart': [
            {'date': '2026-06-01', 'revenue': 499, 'orders': 1},
          ],
        };
      case '/analytics/top-products':
        return [
          {
            'id': 'prod_1',
            'name': 'Cotton Tee',
            'total_sold': 1,
            'revenue': 499,
          },
        ];
      case '/payouts/summary':
        return _payoutSummaryJson();
      case '/orders/order_1':
        return _orderJson();
      case '/orders/order_1/fulfill':
        return _orderJson(
          fulfillmentStatus: 'shipped',
          carrier: 'Shiprocket',
          trackingNumber: 'TRK123',
        );
    }
    return {};
  }
}

Map<String, dynamic> _storeJson() => {
  'id': 'store_1',
  'seller_id': 'seller_1',
  'name': 'Demo Store',
  'tagline': 'Demo',
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

Map<String, dynamic> _productJson() => {
  'id': 'prod_1',
  'store_id': 'store_1',
  'name': 'Cotton Tee',
  'slug': 'cotton-tee',
  'price': 499,
  'currency': 'INR',
  'stock': 8,
  'is_active': true,
  'variants': const [],
};

Map<String, dynamic> _customerJson() => {
  'id': 'customer_1',
  'store_id': 'store_1',
  'email': 'meera@example.com',
  'phone': '+919999999999',
  'first_name': 'Meera',
  'last_name': 'Merchant',
  'display_name': 'Meera Merchant',
  'status': 'active',
  'accepts_marketing': true,
  'tags': ['vip'],
  'notes': 'Prefers COD',
  'order_count': 1,
  'total_spent': 499,
  'last_order_at': '2026-06-01T10:00:00.000Z',
  'addresses': const [
    {
      'name': 'Meera Merchant',
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
  'definition': const {
    'rules': [
      {'field': 'tag', 'operator': 'contains', 'value': 'vip'},
    ],
  },
  'customer_count': 1,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
};

Map<String, dynamic> _orderJson({
  String fulfillmentStatus = 'unfulfilled',
  String? carrier,
  String? trackingNumber,
}) => {
  'id': 'order_1',
  'store_id': 'store_1',
  'order_number': 'order_1',
  'customer_name': 'Meera Merchant',
  'customer_email': 'meera@example.com',
  'customer_phone': '+919999999999',
  'status': 'paid',
  'payment_status': 'paid',
  'fulfillment_status': fulfillmentStatus,
  'carrier': carrier,
  'tracking_number': trackingNumber,
  'currency': 'INR',
  'subtotal': 499,
  'discount_amount': 0,
  'shipping_amount': 0,
  'tax_amount': 0,
  'total': 499,
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
      'quantity': 1,
      'unit_price': 499,
      'total': 499,
      'currency': 'INR',
    },
  ],
};

Map<String, dynamic> _payoutSummaryJson() => {
  'site_id': 'store_1',
  'currency': 'INR',
  'pending_minor': 289380,
  'processing_minor': 0,
  'released_minor': 0,
  'failed_minor': 0,
  'next_payout': {
    'id': 'payout_1',
    'site_id': 'store_1',
    'statement_number': 'PYT-STORE1-1',
    'status': 'pending',
    'provider': 'razorpay_route',
    'provider_mode': 'sandbox',
    'rail': 'razorpay_route',
    'currency': 'INR',
    'gross_amount_minor': 300000,
    'platform_fee_minor': 9000,
    'tax_minor': 1620,
    'net_amount_minor': 289380,
    'available_on': '2026-06-03',
    'metadata': const {},
    'created_at': '2026-06-01T12:00:00.000Z',
    'updated_at': '2026-06-01T12:00:00.000Z',
  },
};
