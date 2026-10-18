// Real local provider/serialization/storage code with an explicit in-memory
// platform store. This is a race reproduction, not Android persistence proof.
import 'dart:async';

import 'package:shared_preferences_platform_interface/shared_preferences_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

ProductModel product(String id) {
  final now = DateTime.now();
  return ProductModel(
    id: id,
    sellerId: 'synthetic-seller',
    name: id,
    description: '',
    salePrice: 10,
    categoryId: 'synthetic-category',
    images: const [],
    stock: 5,
    stockKnown: true,
    priceKnown: true,
    createdAt: now,
    updatedAt: now,
  );
}

class HeldStore extends InMemorySharedPreferencesStore {
  HeldStore() : super.empty();
  Completer<void>? entered, release;
  bool failHeld = false;
  void holdNext() {
    entered = Completer<void>();
    release = Completer<void>();
  }

  @override
  Future<bool> setValue(String type, String key, Object value) async {
    final gate = release;
    if (gate != null && !gate.isCompleted) {
      entered!.complete();
      await gate.future;
      if (failHeld) return false;
    }
    return super.setValue(type, key, value);
  }
}

void main() {
  late HeldStore store;
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    store = HeldStore();
    SharedPreferencesStorePlatform.instance = store;
  });
  test('pending A cart mutation cannot copy existing A contents into B storage after a synchronous identity switch', () async {
    final p = CartProvider();
    addTearDown(p.dispose);
    await p.ready;
    p.updateUserId('buyer-a');
    await p.ready;
    await p.addItem(product('private-a'));
    final pending = p.addItem(product('queued-a'));
    p.updateUserId('buyer-b');
    expect(await pending, isFalse);
    await p.ready;
    expect(
      p.items,
      isEmpty,
      reason: 'A queued write must never persist A state under the later B key',
    );
    final fresh = CartProvider();
    addTearDown(fresh.dispose);
    await fresh.ready;
    fresh.updateUserId('buyer-b');
    await fresh.ready;
    expect(
      fresh.items,
      isEmpty,
      reason: 'A restart must not read cross-buyer contamination',
    );
    p.updateUserId('buyer-a');
    await p.ready;
    expect(p.isInCart('private-a'), isTrue);
  });
  test('pending A wishlist mutation cannot copy existing A contents into B storage after a synchronous identity switch', () async {
    final p = WishlistProvider();
    addTearDown(p.dispose);
    await p.ready;
    p.updateUserId('buyer-a');
    await p.ready;
    await p.addItem(product('private-a'));
    final pending = p.addItem(product('queued-a'));
    p.updateUserId('buyer-b');
    expect(await pending, isFalse);
    await p.ready;
    expect(
      p.productIds,
      isEmpty,
      reason: 'A queued write must never persist A state under the later B key',
    );
    final fresh = WishlistProvider();
    addTearDown(fresh.dispose);
    await fresh.ready;
    fresh.updateUserId('buyer-b');
    await fresh.ready;
    expect(fresh.productIds, isEmpty);
    p.updateUserId('buyer-a');
    await p.ready;
    expect(p.isInWishlist('private-a'), isTrue);
  });
  test('cart getters discard the previous buyer immediately while the new namespace loads', () async {
    final p = CartProvider();
    addTearDown(p.dispose);
    await p.ready;
    p.updateUserId('buyer-a');
    await p.ready;
    await p.addItem(product('private-a'));
    p.updateUserId('buyer-b');
    expect(p.isLoading, isTrue);
    expect(p.items, isEmpty);
    expect(p.itemCount, 0);
    expect(p.isInCart('private-a'), isFalse);
    await p.ready;
  });
  test('wishlist getters discard the previous buyer immediately while the new namespace loads', () async {
    final p = WishlistProvider();
    addTearDown(p.dispose);
    await p.ready;
    p.updateUserId('buyer-a');
    await p.ready;
    await p.addItem(product('private-a'));
    p.updateUserId('buyer-b');
    expect(p.isLoading, isTrue);
    expect(p.productIds, isEmpty);
    expect(p.itemCount, 0);
    expect(p.isInWishlist('private-a'), isFalse);
    await p.ready;
  });
  test('in-flight cart storage completion stays in A and cannot repopulate B or report B success', () async {
    final p = CartProvider();
    addTearDown(p.dispose);
    await p.ready;
    p.updateUserId('buyer-a');
    await p.ready;
    store.holdNext();
    final pending = p.addItem(product('late-a'));
    await store.entered!.future;
    p.updateUserId('buyer-b');
    expect(p.items, isEmpty);
    store.release!.complete();
    expect(await pending, isFalse);
    await p.ready;
    expect(p.items, isEmpty);
    expect(p.error, isNull);
    expect(await p.addItem(product('own-b')), isTrue);
    p.updateUserId('buyer-a');
    await p.ready;
    expect(p.isInCart('late-a'), isTrue);
    expect(p.isInCart('own-b'), isFalse);
  });
  test('in-flight wishlist storage completion stays in A and cannot repopulate B or report B success', () async {
    final p = WishlistProvider();
    addTearDown(p.dispose);
    await p.ready;
    p.updateUserId('buyer-a');
    await p.ready;
    store.holdNext();
    final pending = p.addItem(product('late-a'));
    await store.entered!.future;
    p.updateUserId('buyer-b');
    expect(p.productIds, isEmpty);
    store.release!.complete();
    expect(await pending, isFalse);
    await p.ready;
    expect(p.productIds, isEmpty);
    expect(p.error, isNull);
    expect(await p.addItem(product('own-b')), isTrue);
    p.updateUserId('buyer-a');
    await p.ready;
    expect(p.isInWishlist('late-a'), isTrue);
    expect(p.isInWishlist('own-b'), isFalse);
  });
  test('rapid A-B-A switches do not authorize an older queued command just because the buyer id matches again', () async {
    final cart = CartProvider(), wish = WishlistProvider();
    addTearDown(cart.dispose);
    addTearDown(wish.dispose);
    await Future.wait([cart.ready, wish.ready]);
    cart.updateUserId('buyer-a');
    wish.updateUserId('buyer-a');
    await Future.wait([cart.ready, wish.ready]);
    final c = cart.addItem(product('stale-a')),
        w = wish.addItem(product('stale-a'));
    cart.updateUserId('buyer-b');
    wish.updateUserId('buyer-b');
    cart.updateUserId('buyer-a');
    wish.updateUserId('buyer-a');
    expect(await c, isFalse);
    expect(await w, isFalse);
    await Future.wait([cart.ready, wish.ready]);
    expect(cart.items, isEmpty);
    expect(wish.productIds, isEmpty);
    expect(await cart.addItem(product('current-a')), isTrue);
    expect(await wish.addItem(product('current-a')), isTrue);
  });
  test('an old identity storage failure cannot replace the new buyer error or stop its independent retry', () async {
    final p = WishlistProvider();
    addTearDown(p.dispose);
    await p.ready;
    p.updateUserId('buyer-a');
    await p.ready;
    store.holdNext();
    store.failHeld = true;
    final pending = p.addItem(product('failing-a'));
    await store.entered!.future;
    p.updateUserId('buyer-b');
    store.release!.complete();
    expect(await pending, isFalse);
    await p.ready;
    expect(p.error, isNull);
    store.failHeld = false;
    expect(await p.addItem(product('retry-b')), isTrue);
    expect(p.productIds, ['retry-b']);
  });
  test('Buy Now replacement is one durable identity-bound write and a failed replacement preserves the prior cart', () async {
    final p = CartProvider();
    addTearDown(p.dispose);
    await p.ready;
    p.updateUserId('buyer-a');
    await p.ready;
    await p.addItem(product('original-a'), quantity: 2);
    store.holdNext();
    store.failHeld = true;
    final failed = p.addItem(product('buy-now'), replaceExisting: true);
    await store.entered!.future;
    store.release!.complete();
    expect(await failed, isFalse);
    expect(p.getItemQuantity('original-a'), 2);
    expect(p.isInCart('buy-now'), isFalse);
    store.failHeld = false;
    expect(
      await p.addItem(product('buy-now'), quantity: 3, replaceExisting: true),
      isTrue,
    );
    expect(p.isInCart('original-a'), isFalse);
    expect(p.getItemQuantity('buy-now'), 3);
  });
  test('a queued Buy Now action cannot replace another buyer cart', () async {
    final p = CartProvider();
    addTearDown(p.dispose);
    await p.ready;
    p.updateUserId('buyer-a');
    await p.ready;
    await p.addItem(product('original-a'));
    final pending = p.addItem(product('stale-buy-now'), replaceExisting: true);
    p.updateUserId('buyer-b');
    final own = p.addItem(product('own-b'));
    expect(await pending, isFalse);
    expect(await own, isTrue);
    expect(p.isInCart('stale-buy-now'), isFalse);
    expect(p.isInCart('own-b'), isTrue);
    p.updateUserId('buyer-a');
    await p.ready;
    expect(p.isInCart('original-a'), isTrue);
  });
}
