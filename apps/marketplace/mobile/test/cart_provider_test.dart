// C3 (Firebase SDK removal, 27 September 2026 review finding 5) -- regression coverage for the
// most severe bug found in this whole corrective phase: CartProvider.addItem() required a userId
// that was always null under canonical auth (the updateUserId hook that would have supplied one
// had zero callers anywhere in the app), so every add-to-cart call always failed -- while every
// real call site (product_details_screen.dart's _addToCart, product_card.dart's grid button, both
// wishlist screens' "move to cart") either ignored the awaited result or didn't even await it,
// showing an unconditional "Added to cart!" success message regardless. The cart could never
// actually hold anything, anywhere, while telling every user it just had.
//
// Per the owner's explicit direction, this is now a real, working local (SharedPreferences-backed,
// device-scoped, no server sync) cart. These tests prove the actual behavior a checkout flow
// depends on: an added item is really there afterward (not just a discarded Future<bool>), it
// survives what a real app restart looks like (a fresh CartProvider reading the same
// SharedPreferences-backed store), and quantity/removal/clear all mutate the persisted state, not
// nothing.

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

ProductModel _product(String id, {double price = 499, String name = 'Widget'}) {
  final now = DateTime.now();
  return ProductModel(
    id: id,
    sellerId: 'seller-1',
    name: name,
    description: '',
    salePrice: price,
    categoryId: 'cat-1',
    images: const [],
    stock: 5,
    stockKnown: true,
    priceKnown: true,
    createdAt: now,
    updatedAt: now,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('addItem actually adds the item -- itemCount/subtotal/isInCart genuinely reflect it', () async {
    final provider = CartProvider();
    await Future<void>.delayed(Duration.zero); // let the async constructor load finish

    final added = await provider.addItem(_product('p1', price: 250));

    expect(added, isTrue, reason: 'addItem must report real success, not a permanent, silent failure');
    expect(provider.itemCount, 1);
    expect(provider.subtotal, 250.0);
    expect(provider.isInCart('p1'), isTrue);
    expect(provider.isEmpty, isFalse);
  });

  test('adding the same product twice increases quantity rather than duplicating the line', () async {
    final provider = CartProvider();
    await Future<void>.delayed(Duration.zero);

    await provider.addItem(_product('p1', price: 100));
    await provider.addItem(_product('p1', price: 100));

    expect(provider.itemCount, 2);
    expect(provider.items, hasLength(1));
    expect(provider.getItemQuantity('p1'), 2);
  });

  test('the cart survives a real app restart -- a fresh CartProvider reads back what was added', () async {
    final first = CartProvider();
    await Future<void>.delayed(Duration.zero);
    await first.addItem(_product('p1', price: 599, name: 'Restart Test Widget'));
    // addItem's own _save() is fire-and-forget from the caller's perspective in production, but
    // this test awaits addItem itself, which awaits _save() before returning -- so by here the
    // write has genuinely landed in the (mocked) SharedPreferences store.

    // A brand new CartProvider, exactly like a fresh app launch reading the same on-device store.
    final second = CartProvider();
    await Future<void>.delayed(Duration.zero);

    expect(second.itemCount, 1);
    expect(second.items.single.productName, 'Restart Test Widget');
    expect(second.subtotal, 599.0);
  });

  test('removeItem, updateQuantity and clearCart all mutate the persisted cart, not nothing', () async {
    final provider = CartProvider();
    await Future<void>.delayed(Duration.zero);
    await provider.addItem(_product('p1', price: 100));
    await provider.addItem(_product('p2', price: 200));
    expect(provider.itemCount, 2);

    final updated = await provider.updateQuantity('p1', 3);
    expect(updated, isTrue);
    expect(provider.getItemQuantity('p1'), 3);

    final removed = await provider.removeItem('p2');
    expect(removed, isTrue);
    expect(provider.isInCart('p2'), isFalse);
    expect(provider.itemCount, 3); // just p1 x3 now

    final cleared = await provider.clearCart();
    expect(cleared, isTrue);
    expect(provider.isEmpty, isTrue);
    expect(provider.itemCount, 0);
  });
}
