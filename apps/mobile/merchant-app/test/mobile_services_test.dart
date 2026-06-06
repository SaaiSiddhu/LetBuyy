import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/services/analytics_service.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/coupon_service.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/notification_settings_service.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/subscription_service.dart';
import 'package:letbuyy_store/services/theme_service.dart';
import 'package:letbuyy_store/screens/customers/customer_detail_screen.dart';
import 'package:letbuyy_store/screens/customers/customers_screen.dart';
import 'package:letbuyy_store/screens/discounts/coupon_form_screen.dart';
import 'package:letbuyy_store/screens/discounts/coupons_screen.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/orders/order_detail_screen.dart';
import 'package:letbuyy_store/screens/settings/notifications_screen.dart';
import 'package:provider/provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('mobile gateway services', () {
    test('StoreService fetches store list through the API client', () async {
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
        },
      );

      final stores = await StoreService(api: api).fetchStores();

      expect(stores.single.id, 'store_1');
      expect(api.paths, contains('/stores'));
    });

    test('ProductService keeps canonical ProductContract payloads', () async {
      final api = _FakeApiClient(
        paginated: {
          '/products': [_productJson()],
        },
      );

      final products = await ProductService(api: api).fetchProducts('store_1');

      expect(products.single['store_id'], 'store_1');
      expect(products.single.containsKey('salePrice'), isFalse);
    });

    test('OrderService fetches typed orders and status counts', () async {
      final api = _FakeApiClient(
        paginated: {
          '/orders': [
            _orderJson(status: 'paid'),
            _orderJson(id: 'order_2', status: 'paid'),
          ],
        },
      );
      final service = OrderService(api: api);

      final orders = await service.fetchOrders('store_1');

      expect(orders, hasLength(2));
      expect(service.statusCounts['paid'], 2);
    });

    test('OrderService fetches detail and refund lifecycle routes', () async {
      final api = _FakeApiClient(
        json: {
          '/orders/order_1': _orderJson(),
          '/orders/order_1/refund': _orderJson(status: 'refund_pending'),
          '/orders/order_1/refund/complete': _orderJson(status: 'refunded'),
        },
      );
      final service = OrderService(api: api);

      final detail = await service.fetchOrder('order_1');
      await service.refundOrder(
        'order_1',
        amount: 499,
        reason: 'Customer requested return',
        idempotencyKey: 'test-refund-key',
      );
      final completed = await service.completeRefund(
        'order_1',
        refundId: 'refund_1',
        providerRefundId: 'rfnd_1',
      );

      expect(detail.id, 'order_1');
      expect(completed.status, 'refunded');
      expect(api.paths, contains('/orders/order_1'));
      expect(api.paths, contains('/orders/order_1/refund'));
      expect(api.paths, contains('/orders/order_1/refund/complete'));
    });

    test('CustomerService manages customers and addresses', () async {
      final api = _FakeApiClient(
        paginated: {
          '/customers': [_customerJson()],
        },
        json: {
          '/customers/meera%40example.com': _customerJson(),
          '/customers/meera%40example.com/addresses': [_addressJson()],
          '/customers/meera%40example.com/addresses/address_1': _addressJson(),
        },
      );
      final service = CustomerService(api: api);

      final customers = await service.fetchCustomers('store_1');
      final detail = await service.fetchCustomerByEmail('meera@example.com');
      final addresses = await service.fetchAddresses('meera@example.com');
      await service.createAddress('meera@example.com', _addressJson());
      await service.updateAddress(
        'meera@example.com',
        'address_1',
        _addressJson(),
      );
      await service.deleteAddress('meera@example.com', 'address_1');

      expect(customers.single.email, 'meera@example.com');
      expect(detail.displayName, 'Meera Merchant');
      expect(addresses.single.city, 'Bengaluru');
      expect(api.paths, contains('/customers'));
      expect(api.paths, contains('/customers/meera%40example.com'));
      expect(
        api.paths,
        contains('/customers/meera%40example.com/addresses/address_1'),
      );
    });

    test('InventoryService lists and adjusts stock levels', () async {
      final api = _FakeApiClient(
        paginated: {
          '/inventory/levels': [_inventoryJson()],
        },
        json: {'/inventory/adjust': _inventoryJson(available: 15)},
      );
      final service = InventoryService(api: api);

      final levels = await service.fetchLevels('store_1');
      final adjusted = await service.adjustStock(
        storeId: 'store_1',
        level: levels.single,
        delta: 5,
        reason: 'stock_count',
      );

      expect(levels.single.sku, 'TEE-001');
      expect(adjusted.available, 15);
      expect(api.paths, contains('/inventory/levels'));
      expect(api.paths, contains('/inventory/adjust'));
    });

    test('CouponService handles coupon CRUD and validation', () async {
      final api = _FakeApiClient(
        paginated: {
          '/coupons': [_couponJson()],
        },
        json: {
          '/coupons': _couponJson(id: 'coupon_2', code: 'WELCOME'),
          '/coupons/coupon_1': _couponJson(isActive: false),
          '/coupons/validate': {'message': 'Coupon is valid'},
        },
      );
      final service = CouponService(api: api);

      final coupons = await service.fetchCoupons('store_1');
      final created = await service.createCoupon(_couponJson(code: 'WELCOME'));
      final toggled = await service.toggleCoupon(coupons.single);
      await service.deleteCoupon('coupon_1');
      final validation = await service.validateCoupon(
        storeId: 'store_1',
        code: 'SAVE10',
        subtotal: 1000,
      );

      expect(coupons.single.code, 'SAVE10');
      expect(created.code, 'WELCOME');
      expect(toggled.isActive, isFalse);
      expect(validation['message'], 'Coupon is valid');
      expect(api.paths, contains('/coupons'));
      expect(api.paths, contains('/coupons/coupon_1'));
      expect(api.paths, contains('/coupons/validate'));
    });

    test('NotificationSettingsService persists preferences', () async {
      final api = _FakeApiClient(
        json: {'/notifications/preferences': _notificationPreferenceRows()},
      );
      final service = NotificationSettingsService(api: api);

      final settings = await service.fetchSettings('store_1');
      final updated = await service.updateSettings(
        settings.copyWith(marketing: true),
      );

      expect(settings.emailEnabled, isTrue);
      expect(updated.lowStock, isTrue);
      expect(api.paths, contains('/notifications/preferences'));
    });

    test('AnalyticsService assembles dashboard metrics', () async {
      final api = _FakeApiClient(
        json: {
          '/analytics/dashboard': {
            'summary': {
              'revenue': {'value': 1200},
              'orders': {'value': 4},
              'products': 2,
              'avg_order_value': 300,
            },
          },
          '/analytics/orders': {
            'breakdown': {'paid': 3, 'pending': 1},
          },
          '/analytics/revenue': {
            'chart': [
              {'date': '2026-06-01', 'revenue': 1200, 'orders': 4},
            ],
          },
          '/analytics/top-products': [
            {'id': 'prod_1', 'name': 'Tee', 'total_sold': 2, 'revenue': 600},
          ],
        },
      );

      final analytics = await AnalyticsService(
        api: api,
      ).getStoreAnalytics('store_1');

      expect(analytics.totalRevenue, 1200);
      expect(analytics.ordersByStatus['paid'], 3);
      expect(analytics.topProducts.single.name, 'Tee');
    });

    test(
      'ThemeService reads catalog payload without native previews',
      () async {
        final api = _FakeApiClient(
          raw: {
            '/themes': {
              'data': [
                {'id': 'theme_1', 'slug': 'modern', 'name': 'Modern'},
              ],
              'current_theme': 'modern',
              'store_status': 'published',
            },
          },
        );

        final catalog = await ThemeService(api: api).fetchThemes('store_1');

        expect(catalog.themes.single.slug, 'modern');
        expect(catalog.currentTheme, 'modern');
      },
    );

    test(
      'SubscriptionService creates and verifies Razorpay checkout',
      () async {
        final api = _FakeApiClient(
          json: {
            'payments/subscription/order': {
              'razorpay_order_id': 'order_123',
              'amount': 39900,
              'currency': 'INR',
              'key_id': 'rzp_test_public',
            },
            'payments/subscription/verify': {
              'subscription': {'id': 'sub_1', 'status': 'active'},
            },
          },
        );
        final service = SubscriptionService(api: api);

        final checkout = await service.createSubscriptionOrder(
          storeId: 'store_1',
          plan: SubscriptionPlan.business,
        );
        await service.verifySubscriptionPayment(
          storeId: 'store_1',
          plan: SubscriptionPlan.business,
          razorpayPaymentId: 'pay_123',
          razorpaySignature: 'sig_123',
          razorpayOrderId: 'order_123',
        );

        expect(checkout['razorpay_order_id'], 'order_123');
        expect(api.paths, contains('payments/subscription/verify'));
      },
    );
  });

  group('StoreAuthService', () {
    setUp(() {
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('requests signup OTP with CSRF cookie and Turnstile token', () async {
      final requests = <http.Request>[];
      final auth = StoreAuthService(
        api: _FakeApiClient(),
        identityBaseUrl: 'https://accounts.test',
        turnstileTokenProvider: () => 'turnstile_token',
        httpClient: MockClient((request) async {
          requests.add(request);
          if (request.url.path == '/login') {
            return http.Response(
              '',
              200,
              headers: {'set-cookie': 'letbuyy_csrf=csrf_123; Path=/;'},
            );
          }
          return http.Response(
            '{"success":true,"needsVerification":true,"message":"sent"}',
            200,
          );
        }),
      );

      final pending = await auth.requestSignUpOtp('M@Example.COM');

      expect(pending.email, 'm@example.com');
      expect(requests.last.url.path, '/api/auth/signup');
      expect(requests.last.body, contains('turnstile_token'));
      expect(requests.last.headers['X-CSRF-Token'], 'csrf_123');
    });

    test('verifies OTP, sets password, and persists lb_session', () async {
      final auth = StoreAuthService(
        api: _FakeApiClient(),
        identityBaseUrl: 'https://accounts.test',
        turnstileTokenProvider: () => 'turnstile_token',
        httpClient: MockClient((request) async {
          switch (request.url.path) {
            case '/login':
              return http.Response(
                '',
                200,
                headers: {'set-cookie': 'letbuyy_csrf=csrf_123; Path=/;'},
              );
            case '/api/auth/signup':
              return http.Response(
                '{"success":true,"needsVerification":true}',
                200,
              );
            case '/api/auth/verify-otp':
              return http.Response(
                '{"success":true,"verified":true}',
                200,
                headers: {
                  'set-cookie': 'password_set_intent=intent_1; Path=/;',
                },
              );
            case '/api/auth/set-password':
              return http.Response(
                '{"success":true}',
                200,
                headers: {'set-cookie': 'lb_session=session_123; Path=/;'},
              );
            case '/api/auth/session':
              return http.Response(
                '{"authenticated":true,"user":{"id":"user_1","email":"m@example.com"}}',
                200,
              );
          }
          return http.Response('not found', 404);
        }),
      );

      await auth.requestSignUpOtp('m@example.com');
      final user = await auth.signUp(
        'm@example.com',
        'Password123',
        otp: '123456',
      );
      final storage = const FlutterSecureStorage();

      expect(user?.email, 'm@example.com');
      expect(await storage.read(key: 'lb_session'), 'session_123');
      expect(auth.isSignedIn, isTrue);
    });
  });

  testWidgets('OrderDetailScreen renders customer, totals, and actions', (
    tester,
  ) async {
    final api = _FakeApiClient(json: {'/orders/order_1': _orderJson()});
    final orderService = OrderService(api: api);
    final order = OrderContract.fromJson(_orderJson());

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: orderService,
        child: MaterialApp(
          home: OrderDetailScreen(orderId: order.id, initialOrder: order),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Customer'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();

    expect(find.text('Line items'), findsOneWidget);
    expect(find.text('Cotton Tee'), findsOneWidget);
    expect(find.text('Refund'), findsOneWidget);
  });

  testWidgets('CustomersScreen renders customer list from gateway service', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/customers': [_customerJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
        ],
        child: const MaterialApp(home: CustomersScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Customers'), findsWidgets);
    expect(find.text('Meera Merchant'), findsOneWidget);
    expect(find.text('meera@example.com'), findsOneWidget);
  });

  testWidgets('CustomerDetailScreen renders addresses and recent orders', (
    tester,
  ) async {
    final api = _FakeApiClient(
      json: {
        '/customers/meera%40example.com': _customerJson(),
        '/customers/meera%40example.com/addresses': [_addressJson()],
      },
      paginated: {
        '/orders': [_orderJson()],
      },
    );
    final customer = CustomerContract.fromJson(_customerJson());

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
          ChangeNotifierProvider(create: (_) => OrderService(api: api)),
        ],
        child: MaterialApp(
          home: CustomerDetailScreen(
            email: 'meera@example.com',
            initialCustomer: customer,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Meera Merchant'), findsWidgets);
    expect(find.text('Addresses'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(find.text('Recent orders'), findsOneWidget);
    expect(find.text('order_1'), findsOneWidget);
  });

  testWidgets('InventoryScreen renders stock levels and low-stock filter', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/inventory/levels': [_inventoryJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: InventoryScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Inventory'), findsOneWidget);
    expect(find.text('Cotton Tee'), findsOneWidget);
    expect(find.text('TEE-001'), findsOneWidget);
    expect(find.text('Adjust'), findsOneWidget);
  });

  testWidgets('CouponsScreen renders coupon list and actions', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/coupons': [_couponJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => CouponService(api: api)),
        ],
        child: const MaterialApp(home: CouponsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Coupons'), findsWidgets);
    expect(find.text('SAVE10'), findsOneWidget);
    expect(find.text('Active'), findsWidgets);
  });

  testWidgets('CouponFormScreen renders create form', (tester) async {
    final api = _FakeApiClient(json: {'/coupons': _couponJson()});

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => CouponService(api: api),
        child: const MaterialApp(home: CouponFormScreen(storeId: 'store_1')),
      ),
    );

    expect(find.text('New coupon'), findsOneWidget);
    expect(find.text('Create coupon'), findsOneWidget);
    expect(find.text('Code'), findsOneWidget);
  });

  testWidgets('NotificationsScreen renders persisted toggles', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {'/notifications/preferences': _notificationPreferenceRows()},
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(
            create: (_) => NotificationSettingsService(api: api),
          ),
        ],
        child: const MaterialApp(home: NotificationsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Channels'), findsOneWidget);
    expect(find.text('New orders'), findsOneWidget);
    expect(find.text('Low stock'), findsOneWidget);
  });
}

class _FakeApiClient extends ApiClient {
  _FakeApiClient({
    Map<String, dynamic> json = const {},
    Map<String, dynamic> raw = const {},
    Map<String, List<Map<String, dynamic>>> paginated = const {},
  }) : _json = json,
       _raw = raw,
       _paginated = paginated,
       super(baseUrl: 'https://gateway.test/v1', maxRetries: 0);

  final Map<String, dynamic> _json;
  final Map<String, dynamic> _raw;
  final Map<String, List<Map<String, dynamic>>> _paginated;
  final List<String> paths = [];

  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    paths.add(path);
    return _raw[path] ?? {'success': true, 'data': _json[path] ?? {}};
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    paths.add(path);
    final value = _json[path] ?? {};
    if (value is List && value.isNotEmpty) {
      return Map<String, dynamic>.from(value.first as Map);
    }
    return Map<String, dynamic>.from(value as Map);
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    paths.add(path);
    return decoder(_json[path]);
  }

  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    paths.add(path);
    final rows = _paginated[path] ?? const <Map<String, dynamic>>[];
    return PaginatedResponse<JsonMap>(
      data: rows,
      total: rows.length,
      page: 1,
      limit: rows.length,
      hasMore: false,
    );
  }
}

Map<String, dynamic> _storeJson() => {
  'id': 'store_1',
  'seller_id': 'seller_1',
  'name': 'Demo Store',
  'tagline': 'Demo',
  'subdomain': 'demo',
  'store_url': 'https://demo.letbuyy.store',
  'theme_id': 'modern',
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
  'order_count': 1,
  'total_spent': 499,
  'last_order_at': '2026-06-01T10:00:00.000Z',
  'addresses': [_addressJson()],
};

Map<String, dynamic> _addressJson() => {
  'id': 'address_1',
  'store_id': 'store_1',
  'customer_id': 'customer_1',
  'full_name': 'Meera Merchant',
  'phone': '+919999999999',
  'address_line1': '12 Market Road',
  'address_line2': '',
  'city': 'Bengaluru',
  'state': 'Karnataka',
  'postal_code': '560001',
  'country': 'IN',
  'label': 'Home',
  'is_default': true,
};

Map<String, dynamic> _inventoryJson({int available = 10}) => {
  'id': 'inventory_1',
  'store_id': 'store_1',
  'product_id': 'prod_1',
  'variant_id': 'variant_1',
  'sku': 'TEE-001',
  'product_name': 'Cotton Tee',
  'location_id': 'main',
  'available': available,
  'reserved': 1,
  'committed': 2,
  'on_hand': available + 3,
};

Map<String, dynamic> _couponJson({
  String id = 'coupon_1',
  String code = 'SAVE10',
  bool isActive = true,
}) => {
  'id': id,
  'store_id': 'store_1',
  'code': code,
  'description': 'Launch campaign',
  'type': 'percentage',
  'value': 10,
  'currency': 'INR',
  'minimum_order_amount': 500,
  'maximum_discount': 200,
  'usage_limit': 100,
  'used_count': 3,
  'per_customer_limit': 1,
  'expires_at': '2026-12-31T23:59:59.000Z',
  'is_active': isActive,
};

List<Map<String, dynamic>> _notificationPreferenceRows() => [
  {
    'store_id': 'store_1',
    'channel': 'email',
    'category': 'system',
    'enabled': true,
  },
  {
    'store_id': 'store_1',
    'channel': 'sms',
    'category': 'system',
    'enabled': false,
  },
  {
    'store_id': 'store_1',
    'channel': 'push',
    'category': 'system',
    'enabled': true,
  },
  {
    'store_id': 'store_1',
    'channel': 'push',
    'category': 'order_created',
    'enabled': true,
  },
  {
    'store_id': 'store_1',
    'channel': 'push',
    'category': 'low_stock',
    'enabled': true,
  },
];

Map<String, dynamic> _orderJson({
  String id = 'order_1',
  String status = 'paid',
}) => {
  'id': id,
  'store_id': 'store_1',
  'order_number': id,
  'customer_name': 'Meera Merchant',
  'customer_email': 'meera@example.com',
  'customer_phone': '+919999999999',
  'status': status,
  'payment_status': 'paid',
  'fulfillment_status': 'unfulfilled',
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
