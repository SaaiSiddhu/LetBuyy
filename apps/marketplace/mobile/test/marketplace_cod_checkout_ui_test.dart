import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/data/marketplace_checkout.dart';
import 'package:letbuyy_marketplace/screens/checkout/payment_method_screen.dart';

AddressModel _address() => AddressModel(
  id: 'addr-1',
  userId: 'buyer-1',
  name: 'Payment Test Buyer',
  phone: '9999999999',
  addressLine1: '1 Test Street',
  addressLine2: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  zipcode: '560001',
  country: 'IN',
  isDefault: true,
  createdAt: DateTime.utc(2026, 10, 4),
);

Widget _wrap(Widget child) => MultiProvider(
  providers: [
    ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
    ChangeNotifierProvider<CartProvider>(create: (_) => CartProvider()),
  ],
  child: MaterialApp(home: child),
);

class _MemoryBuyerStore implements BuyerSessionStore {
  _MemoryBuyerStore({this.session});

  StoredBuyerSession? session;

  @override
  Future<StoredBuyerSession?> readSession() async => session;
  @override
  Future<void> writeSession(StoredBuyerSession value) async => session = value;
  @override
  Future<void> deleteSession() async => session = null;
  @override
  Future<PendingBuyerSignIn?> readPending() async => null;
  @override
  Future<void> writePending(PendingBuyerSignIn pending) async {}
  @override
  Future<void> deletePending() async {}
}

class _NoopBuyerBrowser implements BuyerSignInBrowser {
  @override
  Future<Uri?> authorize(Uri url) async => null;
  @override
  Future<Uri?> takeLaunchCallback() async => null;
  @override
  Future<void> cancelWaiting() async {}
}

class _MemoryAttemptStore implements CheckoutAttemptStore {
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}

ProductModel _cartProduct() {
  final now = DateTime.utc(2026, 10, 4);
  return ProductModel(
    id: 'listing-1',
    marketplaceListingId: 'listing-1',
    catalogProductId: 'product-1',
    sellerId: 'site-1',
    name: 'Unavailable product',
    description: '',
    salePrice: 100,
    categoryId: 'cat-1',
    images: const [],
    stock: 1,
    createdAt: now,
    updatedAt: now,
  );
}

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await SharedPreferencesService.init();
  });

  testWidgets(
    'marketplace checkout shows COD and requests review of the server total',
    (tester) async {
      await tester.pumpWidget(
        _wrap(
          PaymentMethodScreen(
            selectedAddress: _address(),
            buyerEmail: 'buyer@example.invalid',
            total: 540,
            shippingFee: 40,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Cash on Delivery'), findsOneWidget);
      expect(find.text('Pay Online (Razorpay)'), findsNothing);
      expect(find.text('Review server total'), findsOneWidget);
      expect(find.text('buyer@example.invalid'), findsOneWidget);
      expect(find.text('Checkout isn’t available yet'), findsNothing);
    },
  );

  testWidgets(
    'withdrawn listing shows recovery and removes only the unavailable cart line',
    (tester) async {
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) => handler.resolve(
            Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: const {'success': true, 'data': null},
            ),
          ),
        ),
      );
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
      );
      final cart = CartProvider();
      await cart.addItem(_cartProduct());
      final attempts = _MemoryAttemptStore();
      final buyer = BuyerSignInController(
        client: BuyerSignInClient(
          identityBaseUrl: 'https://accounts.letbuyy.test',
        ),
        accounts: BuyerAccountApi(api),
        browser: _NoopBuyerBrowser(),
        store: _MemoryBuyerStore(),
      );
      addTearDown(buyer.dispose);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ThemeProvider>(
              create: (_) => ThemeProvider(),
            ),
            ChangeNotifierProvider<CartProvider>.value(value: cart),
            ChangeNotifierProvider<BuyerSignInController>.value(value: buyer),
            Provider<ApiClient>.value(value: api),
          ],
          child: MaterialApp(
            home: PaymentMethodScreen(
              selectedAddress: _address(),
              buyerEmail: 'buyer@example.invalid',
              total: null,
              shippingFee: null,
              checkoutAttemptStore: attempts,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Review server total'));
      await tester.tap(find.text('Review server total'));
      await tester.pumpAndSettle();

      expect(find.text('Cart items need attention'), findsOneWidget);
      expect(find.text('• Unavailable product'), findsOneWidget);
      expect(find.text('Remove unavailable items'), findsOneWidget);
      expect(
        tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,
        isNull,
      );

      await tester.ensureVisible(find.text('Remove unavailable items'));
      await tester.tap(find.text('Remove unavailable items'));
      await tester.pumpAndSettle();

      expect(cart.items, isEmpty);
      expect(find.text('Cart items need attention'), findsNothing);
    },
  );

  testWidgets(
    'listing revision conflict retires the reviewed total and returns to review',
    (tester) async {
      final dio = Dio();
      final requestPaths = <String>[];
      String? cartToken;
      var listingWithdrawnAtConfirm = false;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requestPaths.add(options.path);
            final path = options.path;
            if (path.contains('/checkout-status')) {
              handler.reject(
                DioException(
                  requestOptions: options,
                  response: Response<Object?>(
                    requestOptions: options,
                    statusCode: 404,
                    data: const {
                      'success': false,
                      'error': {'code': 'NOT_FOUND', 'message': 'Not found'},
                    },
                  ),
                  type: DioExceptionType.badResponse,
                ),
              );
              return;
            }
            Object response;
            if (path.contains('/marketplace/listings/listing-1')) {
              response = listingWithdrawnAtConfirm
                  ? const {'success': true, 'data': null}
                  : const {
                      'success': true,
                      'data': {
                        'listing_id': 'listing-1',
                        'product_id': 'product-1',
                        'site_id': 'site-1',
                        'subdomain': 'seller-one',
                        'name': 'Unavailable product',
                        'approved_at': '2026-10-04T00:00:00Z',
                      },
                    };
            } else if (path.endsWith('/marketplace-cart')) {
              final body = options.data as Map;
              cartToken = body['cart_token'] as String;
              response = {
                'success': true,
                'data': {
                  'id': 'cart-1',
                  'store_id': 'site-1',
                  'cart_token': body['cart_token'],
                  'sales_origin': 'marketplace',
                  'currency': 'INR',
                  'subtotal': 200,
                  'discount_total': 0,
                  'tax_total': 0,
                },
              };
            } else if (path.endsWith('/checkout-url')) {
              response = {
                'success': true,
                'data': {
                  'checkout_url':
                      'https://checkout.test/checkout/cart?cart_id=cart-1&site_id=site-1&cart_token=$cartToken&signature=signed-value',
                },
              };
            } else if (path.endsWith('/delivery-options')) {
              response = const {
                'success': true,
                'data': {
                  'serviceable': true,
                  'rates': [
                    {
                      'id': 'rate-1',
                      'name': 'Seller standard delivery',
                      'amount': 40,
                      'currency': 'INR',
                      'estimated_days_min': 3,
                      'estimated_days_max': 5,
                    },
                  ],
                },
              };
            } else if (path.endsWith('/delivery')) {
              response = const {
                'success': true,
                'data': {
                  'checkout': {
                    'delivery_quote': {
                      'amount': 40,
                      'currency': 'INR',
                      'shipping_rate_id': 'rate-1',
                      'server_resolved': true,
                    },
                  },
                },
              };
            } else if (path.endsWith('/payment-intent')) {
              response = const {
                'success': true,
                'data': {
                  'payment_intent': {'payment_intent_id': 'cod-intent-1'},
                },
              };
            } else if (path.endsWith('/confirm')) {
              listingWithdrawnAtConfirm = true;
              handler.reject(
                DioException(
                  requestOptions: options,
                  response: Response<Object?>(
                    requestOptions: options,
                    statusCode: 409,
                    data: const {
                      'success': false,
                      'error': {
                        'code': 'MARKETPLACE_LISTING_UNAVAILABLE',
                        'message':
                            'A marketplace listing became unavailable before order creation. Review your cart and try again.',
                      },
                    },
                  ),
                  type: DioExceptionType.badResponse,
                ),
              );
              return;
            } else {
              response = const {
                'success': true,
                'data': {'checkout': {}},
              };
            }
            handler.resolve(
              Response<Object?>(
                requestOptions: options,
                statusCode: 200,
                data: response,
              ),
            );
          },
        ),
      );
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
      );
      final cart = CartProvider();
      await cart.addItem(_cartProduct(), quantity: 2);
      final buyer = BuyerSignInController(
        client: BuyerSignInClient(
          identityBaseUrl: 'https://accounts.letbuyy.test',
        ),
        accounts: BuyerAccountApi(api),
        browser: _NoopBuyerBrowser(),
        store: _MemoryBuyerStore(),
      );
      addTearDown(buyer.dispose);
      final attempts = _MemoryAttemptStore();

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ThemeProvider>(
              create: (_) => ThemeProvider(),
            ),
            ChangeNotifierProvider<CartProvider>.value(value: cart),
            ChangeNotifierProvider<BuyerSignInController>.value(value: buyer),
            Provider<ApiClient>.value(value: api),
          ],
          child: MaterialApp(
            home: PaymentMethodScreen(
              selectedAddress: _address(),
              buyerEmail: 'buyer@example.invalid',
              total: null,
              shippingFee: null,
              checkoutAttemptStore: attempts,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Review server total'));
      await tester.tap(find.text('Review server total'));
      await tester.pumpAndSettle();
      expect(
        find.text('Seller standard delivery'),
        findsOneWidget,
        reason: 'requests: ${requestPaths.join(', ')}',
      );
      await tester.ensureVisible(find.text('Seller standard delivery'));
      await tester.tap(find.text('Seller standard delivery'));
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Review selected delivery total'));
      await tester.tap(find.text('Review selected delivery total'));
      await tester.pumpAndSettle();

      expect(find.text('Place COD order • ₹240.00'), findsOneWidget);
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Place COD order • ₹240.00'));
      await tester.tap(find.text('Place COD order • ₹240.00'));
      await tester.pumpAndSettle();

      expect(find.text('COD order placed'), findsNothing);
      expect(find.text('Review server total'), findsOneWidget);
      expect(find.text('Place COD order • ₹240.00'), findsNothing);
      expect(attempts.values, isEmpty);
      expect(
        cart.items,
        hasLength(1),
        reason: 'the cart remains available for recovery',
      );

      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Review server total'));
      await tester.tap(find.text('Review server total'));
      await tester.pumpAndSettle();
      expect(find.text('Cart items need attention'), findsOneWidget);
      expect(find.text('• Unavailable product'), findsOneWidget);
      expect(find.text('Remove unavailable items'), findsOneWidget);
      expect(cart.items, hasLength(1));

      await tester.ensureVisible(find.text('Remove unavailable items'));
      await tester.tap(find.text('Remove unavailable items'));
      await tester.pumpAndSettle();
      expect(cart.items, isEmpty);
      expect(find.text('Cart items need attention'), findsNothing);
    },
  );

  testWidgets(
    'buyer account switch during committed-order recovery hides the receipt and preserves scoped records',
    (tester) async {
      var statusReads = 0;
      var now = DateTime.utc(2026, 10, 8);
      late BuyerSignInController buyer;
      final buyerStore = _MemoryBuyerStore(
        session: StoredBuyerSession(
          token: 'buyer-one-session',
          expiresAt: DateTime.utc(2100),
        ),
      );
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) async {
            if (options.path.endsWith('/storefront/buyer/account')) {
              final isBuyerTwo =
                  options.headers[letbuyyBuyerSessionHeader] ==
                  'buyer-two-session';
              handler.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: {
                    'success': true,
                    'data': {
                      'buyer': {
                        'id': isBuyerTwo ? 'buyer-2' : 'buyer-1',
                        'email': isBuyerTwo
                            ? 'buyer-two@example.invalid'
                            : 'buyer@example.invalid',
                        'email_verified': true,
                      },
                    },
                  },
                ),
              );
              return;
            }
            if (options.path.contains('/checkout-status')) {
              statusReads++;
              buyerStore.session = StoredBuyerSession(
                token: 'buyer-two-session',
                expiresAt: DateTime.utc(2100),
              );
              now = now.add(const Duration(seconds: 1));
              await buyer.onResumed();
              handler.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: const {
                    'success': true,
                    'data': {
                      'checkout_state': 'completed',
                      'order': {
                        'id': 'buyer-one-committed-order',
                        'order_number': 'LB-PRIVATE-1001',
                        'status': 'pending_cod',
                        'currency': 'INR',
                        'total': 240,
                      },
                    },
                  },
                ),
              );
              return;
            }
            fail('unexpected request during receipt recovery: ${options.path}');
          },
        ),
      );
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
      );
      buyer = BuyerSignInController(
        client: BuyerSignInClient(
          identityBaseUrl: 'https://accounts.letbuyy.test',
        ),
        accounts: BuyerAccountApi(api),
        browser: _NoopBuyerBrowser(),
        store: buyerStore,
        clock: () => now,
        recheckAfter: Duration.zero,
      );
      addTearDown(buyer.dispose);
      await tester.runAsync(buyer.start);
      expect(buyer.buyerId, 'buyer-1');

      final cart = CartProvider();
      await cart.addItem(_cartProduct());
      final buyerOneAttempt = jsonEncode({
        'cart_token': 'buyer-one-recovery-token',
        'subdomain': 'seller-one',
        'cart_fingerprint': 'stored-cart-fingerprint',
        'input_fingerprint': 'stored-input-fingerprint',
        'local_cart_revision': 17,
      });
      final buyerTwoAttempt = jsonEncode({
        'cart_token': 'buyer-two-recovery-token',
        'subdomain': 'seller-two',
        'cart_fingerprint': 'second-stored-cart-fingerprint',
        'input_fingerprint': 'second-stored-input-fingerprint',
        'local_cart_revision': 23,
      });
      final attempts = _MemoryAttemptStore()
        ..values['letbuyy.marketplace.checkout-attempt.v1.buyer-1'] =
            buyerOneAttempt
        ..values['letbuyy.marketplace.checkout-attempt.v1.buyer-2'] =
            buyerTwoAttempt;

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ThemeProvider>(
              create: (_) => ThemeProvider(),
            ),
            ChangeNotifierProvider<CartProvider>.value(value: cart),
            ChangeNotifierProvider<BuyerSignInController>.value(value: buyer),
            Provider<ApiClient>.value(value: api),
          ],
          child: MaterialApp(
            home: PaymentMethodScreen(
              selectedAddress: _address(),
              buyerEmail: 'buyer@example.invalid',
              total: null,
              shippingFee: null,
              checkoutAttemptStore: attempts,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Review server total'));
      await tester.tap(find.text('Review server total'));
      await tester.pumpAndSettle();
      expect(buyer.buyerId, 'buyer-2');
      expect(buyer.email, 'buyer-two@example.invalid');
      expect(buyerStore.session?.token, 'buyer-two-session');
      expect(buyerStore.session?.buyerId, 'buyer-2');

      expect(statusReads, 1);
      expect(find.text('COD order placed'), findsNothing);
      expect(find.textContaining('LB-PRIVATE-1001'), findsNothing);
      expect(
        find.textContaining(
          'Checkout finished for the account that started it',
        ),
        findsOneWidget,
      );
      expect(cart.items, hasLength(1));
      expect(attempts.values, hasLength(2));
      expect(
        attempts.values['letbuyy.marketplace.checkout-attempt.v1.buyer-1'],
        buyerOneAttempt,
      );
      expect(
        attempts.values['letbuyy.marketplace.checkout-attempt.v1.buyer-2'],
        buyerTwoAttempt,
      );
    },
  );

  testWidgets('buyer reviews COD, recovers a committed order after a lost response', (
    tester,
  ) async {
    final requests = <RequestOptions>[];
    String? cartToken;
    var serverCommittedOrder = false;
    var confirmationCount = 0;
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          final path = options.path;
          Object response;
          if (path.contains('/checkout-status')) {
            if (serverCommittedOrder) {
              handler.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: const {
                    'success': true,
                    'data': {
                      'cart_status': 'checked_out',
                      'checkout_state': 'completed',
                      'order': {
                        'id': 'order-1',
                        'order_number': 'LB-1001',
                        'status': 'pending',
                        'currency': 'INR',
                        'total': 240,
                      },
                    },
                  },
                ),
              );
            } else {
              handler.reject(
                DioException(
                  requestOptions: options,
                  response: Response<Object?>(
                    requestOptions: options,
                    statusCode: 404,
                    data: const {
                      'success': false,
                      'error': {
                        'code': 'NOT_FOUND',
                        'message': 'Cart not found',
                      },
                    },
                  ),
                  type: DioExceptionType.badResponse,
                ),
              );
            }
            return;
          } else if (path.contains('/marketplace/listings/listing-1')) {
            response = const {
              'success': true,
              'data': {
                'listing_id': 'listing-1',
                'product_id': 'product-1',
                'site_id': 'site-1',
                'subdomain': 'seller-one',
                'name': 'Seller item',
                'approved_at': '2026-10-04T00:00:00Z',
              },
            };
          } else if (path.endsWith('/marketplace-cart')) {
            cartToken = (options.data as Map)['cart_token'] as String;
            response = {
              'success': true,
              'data': {
                'id': 'cart-1',
                'store_id': 'site-1',
                'cart_token': cartToken,
                'sales_origin': 'marketplace',
                'currency': 'INR',
                'subtotal': 200,
                'discount_total': 0,
                'tax_total': 0,
              },
            };
          } else if (path.endsWith('/checkout-url')) {
            response = {
              'success': true,
              'data': {
                'checkout_url':
                    'https://checkout.test/checkout/cart?cart_id=cart-1&site_id=site-1&cart_token=$cartToken&signature=signed-value',
              },
            };
          } else if (path.endsWith('/delivery-options')) {
            response = const {
              'success': true,
              'data': {
                'serviceable': true,
                'rates': [
                  {
                    'id': 'rate-1',
                    'name': 'Seller standard delivery',
                    'amount': 40,
                    'currency': 'INR',
                    'estimated_days_min': 3,
                    'estimated_days_max': 5,
                  },
                ],
              },
            };
          } else if (path.endsWith('/delivery')) {
            final body = options.data as Map;
            expect(body['shipping_quote']['shipping_rate_id'], 'rate-1');
            response = const {
              'success': true,
              'data': {
                'checkout': {
                  'delivery_quote': {
                    'amount': 40,
                    'currency': 'INR',
                    'shipping_rate_id': 'rate-1',
                    'server_resolved': true,
                  },
                },
              },
            };
          } else if (path.endsWith('/payment-intent')) {
            response = const {
              'success': true,
              'data': {
                'payment_intent': {'payment_intent_id': 'cod-intent-1'},
              },
            };
          } else if (path.endsWith('/confirm')) {
            confirmationCount++;
            // Model the order transaction committing before its response is lost.
            serverCommittedOrder = true;
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
                message: 'simulated response loss after order commit',
              ),
            );
            return;
          } else {
            response = const {
              'success': true,
              'data': {'checkout': {}},
            };
          }
          handler.resolve(
            Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: response,
            ),
          );
        },
      ),
    );
    final api = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      dio: dio,
      maxRetries: 0,
    );
    final cart = CartProvider();
    await cart.addItem(_cartProduct(), quantity: 2);
    final buyer = BuyerSignInController(
      client: BuyerSignInClient(
        identityBaseUrl: 'https://accounts.letbuyy.test',
      ),
      accounts: BuyerAccountApi(api),
      browser: _NoopBuyerBrowser(),
      store: _MemoryBuyerStore(),
    );
    addTearDown(buyer.dispose);
    final attemptStore = _MemoryAttemptStore();

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
          ChangeNotifierProvider<CartProvider>.value(value: cart),
          ChangeNotifierProvider<BuyerSignInController>.value(value: buyer),
          Provider<ApiClient>.value(value: api),
        ],
        child: MaterialApp(
          home: PaymentMethodScreen(
            selectedAddress: _address(),
            buyerEmail: 'buyer@example.invalid',
            total: null,
            shippingFee: null,
            checkoutAttemptStore: attemptStore,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Cash on Delivery'), findsOneWidget);
    expect(find.text('Pay Online (Razorpay)'), findsNothing);
    await tester.ensureVisible(find.text('Review server total'));
    await tester.tap(find.text('Review server total'));
    await tester.pumpAndSettle();

    expect(find.text('Seller standard delivery'), findsOneWidget);
    expect(find.text('Seller estimate: 3–5 days'), findsOneWidget);
    expect(find.text('₹40.00'), findsOneWidget);
    expect(
      requests.where((request) => request.path.endsWith('/confirm')),
      isEmpty,
    );

    await tester.ensureVisible(find.text('Seller standard delivery'));
    await tester.tap(find.text('Seller standard delivery'));
    await tester.pumpAndSettle();
    expect(find.text('Review selected delivery total'), findsOneWidget);
    // The first review intentionally told the buyer to select a rate; let that snackbar
    // disappear before tapping the fixed bottom action bar underneath it.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Review selected delivery total'));
    await tester.tap(find.text('Review selected delivery total'));
    await tester.pumpAndSettle();

    expect(
      find.textContaining('Server-confirmed total: ₹240.00'),
      findsOneWidget,
    );
    expect(find.text('Place COD order • ₹240.00'), findsOneWidget);
    expect(
      requests.where((request) => request.path.endsWith('/confirm')),
      isEmpty,
    );

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Place COD order • ₹240.00'));
    await tester.tap(find.text('Place COD order • ₹240.00'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pump();

    expect(find.text('COD order placed'), findsNothing);
    expect(confirmationCount, 1);
    expect(find.text('Place COD order • ₹240.00'), findsOneWidget);

    tester
        .state<ScaffoldMessengerState>(find.byType(ScaffoldMessenger).first)
        .hideCurrentSnackBar();
    await tester.pumpAndSettle();
    final currentCart = List<CartItemModel>.unmodifiable(cart.items);
    expect(currentCart, isNotEmpty);
    expect(
      await cart.removeSnapshot(currentCart, expectedBuyerId: buyer.buyerId),
      isTrue,
    );
    expect(cart.items, isEmpty);
    await tester.enterText(find.byType(TextField), 'changed-invalid-email');
    await tester.ensureVisible(find.text('Place COD order • ₹240.00'));
    await tester.tap(find.text('Place COD order • ₹240.00'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pump();

    expect(find.text('COD order placed'), findsOneWidget);
    expect(find.textContaining('Order LB-1001 is confirmed.'), findsOneWidget);
    expect(
      requests.where((request) => request.path.endsWith('/payment-intent')),
      hasLength(1),
    );
    expect(
      requests.where((request) => request.path.endsWith('/confirm')),
      hasLength(1),
    );
    expect(confirmationCount, 1);
    expect(find.text('Your cart is empty.'), findsNothing);
    expect(
      requests.where((request) => request.path.contains('/checkout-status')),
      hasLength(3),
    );
    final cartCreates = requests
        .where((request) => request.path.endsWith('/marketplace-cart'))
        .toList();
    expect(cartCreates, isNotEmpty);
    expect(
      cartCreates.every(
        (request) => (request.data as Map)['lines'].length == 1,
      ),
      isTrue,
    );
    expect(
      cartCreates.map((request) => (request.data as Map)['cart_token']).toSet(),
      hasLength(1),
    );
    expect(attemptStore.values, isEmpty);
  });
}
