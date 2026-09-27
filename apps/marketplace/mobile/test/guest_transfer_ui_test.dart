// D-BUYER-SCOPE (guest-transfer UI wiring, "Complete ALL remaining Phase 1R work" task) --
// cart_wishlist_buyer_scope_test.dart already exercises transferGuestCartToBuyer/
// transferGuestWishlistToBuyer at the provider level in depth (including the receipt-based
// crash/retry recovery). This file covers the one thing that level can't: the real UI action --
// does MobileCartScreen/MobileWishlistScreen actually show the "move your items" banner when
// there is something to transfer, does tapping it call through to the provider, and does the
// banner honestly reflect the outcome afterward. Both screens live behind AuthGatedWidget (see
// cart_screen.dart/wishlist_screen.dart), so only a signed-in buyer ever reaches them -- there is
// no separate "guest view" of this banner to test.

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_platform_interface.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/screens/cart/mobile_cart_screen.dart';
import 'package:letbuyy_marketplace/screens/wishlist/mobile_wishlist_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

ProductModel _product(String id) {
  final now = DateTime.now();
  return ProductModel(
    id: id,
    sellerId: 'seller-1',
    name: 'Widget $id',
    description: '',
    salePrice: 199,
    categoryId: 'cat-1',
    images: const [],
    stock: 5,
    stockKnown: true,
    priceKnown: true,
    createdAt: now,
    updatedAt: now,
  );
}

/// A client that always fails fast (connection refused) -- this test only cares that the screen
/// doesn't crash while its background product-detail lookups fail, never that they succeed.
ApiClient _deadApiClient() => ApiClient(
      baseUrl: 'http://127.0.0.1:1',
      dio: Dio(BaseOptions(connectTimeout: const Duration(milliseconds: 200))),
    );

Widget _wrap(Widget child, {required CartProvider cart, required WishlistProvider wishlist}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
      ChangeNotifierProvider<CartProvider>.value(value: cart),
      ChangeNotifierProvider<WishlistProvider>.value(value: wishlist),
      Provider<ApiClient>(create: (_) => _deadApiClient()),
      ChangeNotifierProvider<ProductProvider>(create: (context) => ProductProvider(client: context.read<ApiClient>())),
    ],
    child: MaterialApp(home: child),
  );
}

/// Not pumpAndSettle(): PremiumScaffold's own chrome renders an indeterminate
/// CircularProgressIndicator somewhere in its always-mounted tree (unrelated to anything under
/// test here), which animates forever and makes pumpAndSettle() time out on both screens this
/// file covers. A bounded pump is the standard workaround and is enough to let one microtask
/// round trip (the transfer call) and one frame settle.
Future<void> _pumpBounded(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    SharedPreferencesStorePlatform.instance = InMemorySharedPreferencesStore.empty();
  });

  testWidgets('MobileCartScreen shows the guest-transfer banner and moving items works end to end', (tester) async {
    final cart = CartProvider();
    await cart.ready;
    await cart.addItem(_product('guest-item'), quantity: 2);
    cart.updateUserId('buyer-1');
    await cart.ready;

    final wishlist = WishlistProvider();
    await wishlist.ready;

    await tester.pumpWidget(_wrap(const MobileCartScreen(), cart: cart, wishlist: wishlist));
    await _pumpBounded(tester);

    expect(find.text('You have items from before you signed in.'), findsOneWidget,
        reason: 'the buyer has a non-empty guest basket waiting -- the banner must offer to move it');

    await tester.tap(find.text('Move to my cart'));
    await _pumpBounded(tester);

    expect(find.text('You have items from before you signed in.'), findsNothing,
        reason: 'a successful transfer must make the banner disappear, not linger claiming there is still something to move');
    expect(cart.getItemQuantity('guest-item'), 2, reason: 'the tap must have actually driven a real transfer, not just hidden the banner');
    expect(find.text('Moved your items from before you signed in'), findsOneWidget);
  });

  testWidgets('MobileCartScreen shows no banner when there is nothing to transfer', (tester) async {
    final cart = CartProvider();
    await cart.ready;
    cart.updateUserId('buyer-1');
    await cart.ready;
    await cart.addItem(_product('already-buyers'), quantity: 1);

    final wishlist = WishlistProvider();
    await wishlist.ready;

    await tester.pumpWidget(_wrap(const MobileCartScreen(), cart: cart, wishlist: wishlist));
    await _pumpBounded(tester);

    expect(find.text('You have items from before you signed in.'), findsNothing,
        reason: 'an empty guest basket must never show a false invitation to move something');
  });

  testWidgets('MobileWishlistScreen shows the guest-transfer banner and moving items works end to end', (tester) async {
    final wishlist = WishlistProvider();
    await wishlist.ready;
    await wishlist.addItem(_product('guest-item'));
    wishlist.updateUserId('buyer-1');
    await wishlist.ready;

    final cart = CartProvider();
    await cart.ready;

    await tester.pumpWidget(_wrap(const MobileWishlistScreen(), cart: cart, wishlist: wishlist));
    await _pumpBounded(tester);

    expect(find.text('You have wishlist items from before you signed in.'), findsOneWidget);

    await tester.tap(find.text('Move to my wishlist'));
    await _pumpBounded(tester);

    expect(find.text('You have wishlist items from before you signed in.'), findsNothing);
    expect(wishlist.isInWishlist('guest-item'), isTrue, reason: 'the tap must have actually driven a real transfer');
    expect(find.text('Moved your items from before you signed in'), findsOneWidget);
  });
}
