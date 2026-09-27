// Phase 1R corrective (found via C5 device testing, "checkout total silently drops the shipping
// fee"): mobile_cart_screen.dart's own total included a real, non-zero shipping fee for a cart;
// checkout_screen.dart and payment_method_screen.dart both independently recomputed
// `subtotal - discount`, silently dropping it -- a buyer could see one total on the cart screen
// and a lower one moments later on the payment screen, for the identical cart. Both screens now
// share shipping_fee_calculator.dart's calculateShippingFees() instead of each carrying their own
// copy (or, for payment_method_screen.dart, ignoring the total/shippingFee it was even given).
// This file guards both halves of that fix. Reuses checkout_screen_address_test.dart's own
// fake-gateway/harness shape, duplicated rather than shared, per that file's own stated reasoning.

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
/// response, so any valid listing body makes checkout's shipping calculation fall back to the
/// same standard ₹40 fee the cart screen itself falls back to for a product with no shipping
/// price set -- this is also today's real behavior against the actual canonical gateway, not a
/// test-only shortcut (see this session's own evidence document for that finding).
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
    "checkout computes a total that includes the same shipping fee the cart screen would show, and "
    "carries it through to the payment screen -- not just the bare subtotal",
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

      // The real bug this guards against showed exactly this: a payment total equal to the bare
      // subtotal, silently missing the shipping fee the cart screen had already displayed for
      // this same cart.
      expect(find.text('Pay ₹500'), findsNothing,
          reason: 'the amount actually charged must include shipping, never equal the bare subtotal alone');
      expect(find.text('Pay ₹540'), findsOneWidget,
          reason: 'subtotal ₹500 + the ₹40 standard-shipping fallback both screens now share = ₹540');
    },
  );

  testWidgets(
    'PaymentMethodScreen trusts the total/shippingFee it is given instead of silently recomputing subtotal - discount',
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

      expect(find.text('Pay ₹540'), findsOneWidget,
          reason: 'must show the total it was constructed with, not subtotal(100) - discount(0) = 100');
      expect(find.text('Subtotal'), findsOneWidget,
          reason: 'the Subtotal row legitimately shows the cart\'s own ₹100 -- only Total/Pay must reflect widget.total, not this row');
    },
  );
}
