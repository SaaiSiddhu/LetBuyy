// Phase 1R shipping-semantics correction (owner-requested completion, same day): this file
// originally guarded "checkout computes a total that includes the same shipping fee the cart
// screen would show" -- but the fee it guarded was itself the bug: a fabricated ₹40 fallback for
// a product whose real shipping price was never provided by the canonical gateway (see
// shipping_fee_calculator.dart's own header comment). Under the corrected code, the exact same
// mock-gateway response (no shipping fields at all) now correctly resolves to "unknown", so
// checkout's total is null and the payment screen shows an honest pending state instead of a
// confident wrong number. What this file now guards is that honesty -- plus the original,
// still-valid concern that checkout_screen.dart and payment_method_screen.dart must never
// silently disagree about the same cart (mobile_cart_screen.dart's own equivalent cases live in
// shipping_fee_calculator_test.dart, which tests the shared pure logic directly).
// Reuses checkout_screen_address_test.dart's own fake-gateway/harness shape, duplicated rather
// than shared, per that file's own stated reasoning.

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_platform_interface.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/screens/checkout/checkout_screen.dart';
import 'package:letbuyy_marketplace/screens/checkout/payment_method_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

const _sessionToken = 'pricing-session-token';

class _MemoryStore implements BuyerSessionStore {
  StoredBuyerSession? session;
  PendingBuyerSignIn? pending;
  @override
  Future<StoredBuyerSession?> readSession() async => session;
  @override
  Future<void> writeSession(StoredBuyerSession value) async => session = value;
  @override
  Future<void> deleteSession() async => session = null;
  @override
  Future<PendingBuyerSignIn?> readPending() async => pending;
  @override
  Future<void> writePending(PendingBuyerSignIn value) async => pending = value;
  @override
  Future<void> deletePending() async => pending = null;
}

class _ScriptedBrowser implements BuyerSignInBrowser {
  const _ScriptedBrowser();
  @override
  Future<Uri?> authorize(Uri url) async => null;
  @override
  Future<Uri?> takeLaunchCallback() async => null;
  @override
  Future<void> cancelWaiting() async {}
}

/// One product, seeded into the cart directly (CartProvider.addItem snapshots its price/name/etc
/// into the cart item at add-time) and ALSO served back by the mock gateway below when
/// checkout_screen.dart fetches it by id to compute shipping -- same id both times, matching how
/// ProductProvider.fetchProductById looks up a cart item's own productId in the real app.
ProductModel _seedProduct() {
  final now = DateTime.now();
  return ProductModel(
    id: 'ship-test-1',
    sellerId: 'seller-1',
    name: 'Shipping Test Item',
    description: '',
    salePrice: 500,
    categoryId: 'cat-1',
    images: const [],
    stock: 5,
    stockKnown: true,
    priceKnown: true,
    createdAt: now,
    updatedAt: now,
  );
}

/// Serves /buyer/account, /buyer/addresses (one saved address, so checkout's own "Continue to
/// Payment" is reachable) and /storefront/marketplace/listings/{id} for _seedProduct() above.
/// ProductModel._productFromListingDetail() doesn't map any shipping-specific field from that
/// response, so this product's shipping fee is genuinely unknown -- this is today's real behavior
/// against the actual canonical gateway, not a test-only shortcut (see this session's own evidence
/// document for that finding), and the corrected code must render that honestly rather than
/// inventing a number for it.
Dio _gatewayDio() {
  final dio = Dio();
  dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) {
    final path = o.path;
    if (path.endsWith('/buyer/account')) {
      handler.resolve(Response(requestOptions: o, statusCode: 200, data: {
        'success': true,
        'data': {
          'buyer': {
            'id': 'buyer-1',
            'email': 'pricing@example.com',
            'email_verified': true,
            'full_name': 'Pricing Buyer',
            'phone': null,
          },
        },
      }));
      return;
    }
    if (path.endsWith('/buyer/addresses')) {
      handler.resolve(Response(requestOptions: o, statusCode: 200, data: {
        'success': true,
        'data': {
          'addresses': [
            {
              'id': 'addr-1',
              'label': 'home',
              'full_name': 'Pricing Buyer',
              'phone': '9999999999',
              'address_line1': '1 Test Street',
              'city': 'Bengaluru',
              'state': 'Karnataka',
              'postal_code': '560001',
              'country': 'IN',
              'is_default': true,
            },
          ],
        },
      }));
      return;
    }
    if (path.contains('/storefront/marketplace/listings/')) {
      handler.resolve(Response(requestOptions: o, statusCode: 200, data: {
        'success': true,
        'data': {
          'listing_id': 'ship-test-1',
          'product_id': 'ship-test-1',
          'site_id': 'site-1',
          'name': 'Shipping Test Item',
          'price': 500,
        },
      }));
      return;
    }
    handler.resolve(Response(
      requestOptions: o,
      statusCode: 404,
      data: {
        'success': false,
        'error': {'code': 'NOT_FOUND', 'message': 'unmapped'},
      },
    ));
  }));
  return dio;
}

({BuyerSignInController controller, CartProvider cart, ProductProvider products}) _harness() {
  final client = ApiClient(baseUrl: 'https://gateway.test/v1', dio: _gatewayDio(), maxRetries: 0);
  final store = _MemoryStore()
    ..session = StoredBuyerSession(token: _sessionToken, expiresAt: DateTime.utc(2100));
  final controller = BuyerSignInController(
    client: BuyerSignInClient(identityBaseUrl: 'https://accounts.letbuyy.test'),
    accounts: BuyerAccountApi(client),
    browser: const _ScriptedBrowser(),
    store: store,
  );
  return (controller: controller, cart: CartProvider(), products: ProductProvider(client: client));
}

Widget _wrapCheckout(BuyerSignInController controller, CartProvider cart, ProductProvider products) {
  final addressClient = ApiClient(baseUrl: 'https://gateway.test/v1', dio: _gatewayDio(), maxRetries: 0);
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<BuyerSignInController>.value(value: controller),
      Provider<BuyerAddressApi>(create: (_) => BuyerAddressApi(addressClient)),
      ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
      ChangeNotifierProvider<CartProvider>.value(value: cart),
      ChangeNotifierProvider<ProductProvider>.value(value: products),
    ],
    child: const MaterialApp(home: CheckoutScreen()),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    SharedPreferencesStorePlatform.instance = InMemorySharedPreferencesStore.empty();
  });

  testWidgets(
    "checkout carries an honest 'shipping unknown' state through to the payment screen instead of "
    "fabricating a total -- the real canonical gateway never returns shipping data for this product",
    (tester) async {
      // checkout_screen.dart itself never renders a ₹ total anywhere in its own UI (confirmed by
      // reading its build tree -- the "Continue to Payment" button shows no amount); the only way
      // to observe what total it actually computed is to follow it through to the screen that
      // does display it, exactly as a real buyer would.
      final h = _harness();
      addTearDown(h.controller.dispose);
      await tester.runAsync(h.controller.start);
      await h.cart.ready;
      h.cart.updateUserId('buyer-1');
      await h.cart.ready;
      await h.cart.addItem(_seedProduct(), quantity: 1);

      await tester.pumpWidget(_wrapCheckout(h.controller, h.cart, h.products));
      await tester.pumpAndSettle();

      expect(find.text('Pricing Buyer'), findsOneWidget,
          reason: 'the seeded address must actually have loaded and rendered before proceeding');

      await tester.tap(find.text('Continue to Payment'));
      await tester.pumpAndSettle();

      // The bug this used to guard against showed a confident ₹540 (subtotal ₹500 + a fabricated
      // ₹40 shipping fallback) for a product whose shipping price the gateway never actually sent.
      // The corrected behavior shows neither that number nor the bare subtotal dressed up as the
      // total -- it shows that the amount genuinely isn't known yet.
      expect(find.text('Pay ₹540'), findsNothing,
          reason: 'the old ₹40-fallback total must never reappear');
      expect(find.text('Pay ₹500'), findsNothing,
          reason: 'the bare subtotal must never silently stand in for a real total, either');
      expect(find.text('Review server total'), findsOneWidget,
          reason: 'with shipping genuinely unknown, the button must show no amount at all');
      expect(find.text('Pending'), findsOneWidget,
          reason: 'the Shipping Fee row must honestly say the fee is not known yet');
      expect(find.text('Shown after repricing'), findsOneWidget,
          reason: 'the Total Amount row must not present a partial or fabricated sum as complete');
      expect(find.textContaining('business days'), findsNothing,
          reason: 'no delivery-time promise may be shown when shippingDays was never provided');
      expect(find.textContaining('2-3'), findsNothing,
          reason: 'the old fabricated delivery-estimate fallback must never reappear');
    },
  );

  testWidgets(
    'PaymentMethodScreen labels the app-provided amount as an estimate until the server reprices it',
    (tester) async {
      // Deliberately mismatched: CartProvider's own subtotal here (₹100) differs from the
      // total/shippingFee this screen is constructed with (₹540). If payment_method_screen.dart
      // regressed to recomputing `subtotal - discount` instead of trusting widget.total, ₹100
      // would leak into the UI instead of the ₹540 it was actually handed -- proving which number
      // really drives what the buyer sees.
      final cart = CartProvider();
      await cart.ready;
      cart.updateUserId('buyer-1');
      await cart.ready;
      await cart.addItem(_seedProduct().copyWith(salePrice: 100), quantity: 1);

      final address = AddressModel(
        id: 'addr-1',
        userId: 'buyer-1',
        name: 'Pricing Buyer',
        phone: '9999999999',
        addressLine1: '1 Test Street',
        addressLine2: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipcode: '560001',
        country: 'IN',
        isDefault: true,
        createdAt: DateTime.now(),
      );

      await tester.pumpWidget(MultiProvider(
        providers: [
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
          ChangeNotifierProvider<CartProvider>.value(value: cart),
        ],
        child: MaterialApp(
          home: PaymentMethodScreen(selectedAddress: address, total: 540, shippingFee: 40),
        ),
      ));
      await tester.pump();

      expect(find.text('Review server total'), findsOneWidget,
          reason: 'the server must reprice the cart before the app offers COD order placement');
      expect(find.text('Estimate (not final)'), findsOneWidget);
      expect(find.text('Subtotal'), findsOneWidget,
          reason: 'the Subtotal row legitimately shows the cart\'s own ₹100 -- only Total/Pay must reflect widget.total, not this row');
    },
  );

  testWidgets(
    'PaymentMethodScreen given a null total/shippingFee (shipping not yet known) renders that honestly, never a fabricated amount',
    (tester) async {
      final cart = CartProvider();
      await cart.ready;
      cart.updateUserId('buyer-1');
      await cart.ready;
      await cart.addItem(_seedProduct(), quantity: 1);

      final address = AddressModel(
        id: 'addr-1',
        userId: 'buyer-1',
        name: 'Pricing Buyer',
        phone: '9999999999',
        addressLine1: '1 Test Street',
        addressLine2: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipcode: '560001',
        country: 'IN',
        isDefault: true,
        createdAt: DateTime.now(),
      );

      await tester.pumpWidget(MultiProvider(
        providers: [
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
          ChangeNotifierProvider<CartProvider>.value(value: cart),
        ],
        child: MaterialApp(
          home: PaymentMethodScreen(selectedAddress: address, total: null, shippingFee: null),
        ),
      ));
      await tester.pump();

      expect(find.text('Review server total'), findsOneWidget);
      expect(find.text('Pending'), findsOneWidget);
      expect(find.text('Shown after repricing'), findsOneWidget);
      expect(find.textContaining('₹null'), findsNothing,
          reason: 'a null total must never leak into a rendered string via naive interpolation');
    },
  );
}
