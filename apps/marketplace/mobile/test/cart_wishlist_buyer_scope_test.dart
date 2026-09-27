// D-BUYER-SCOPE (27 September 2026 review continuation, "Complete ALL remaining Phase 1R work"
// task) -- regression coverage for the gap Finding 3 named and this task's section 4B made
// concrete: CartProvider/WishlistProvider used to persist to one fixed, device-wide key regardless
// of who (if anyone) was signed in, and `updateUserId` was a no-op with zero callers anywhere in
// the app (confirmed by grep at the time). Two different buyers signed into the same device would
// have shared one cart/wishlist; there was no way to prove otherwise.
//
// The namespace-isolation tests below call only pre-existing public API (`updateUserId` already
// existed, as a no-op) -- they compile unchanged against the OLD provider files and FAIL on their
// assertions there (both "buyers," and the guest, would see the same shared items), a real
// behavioral negative control, not merely an API-dependency one. `transferGuestCartToBuyer`/
// `transferGuestWishlistToBuyer`/`hasGuestCartToTransfer`/`hasGuestWishlistToTransfer` are brand
// new capability with no prior equivalent to fall back to -- a test exercising them cannot compile
// against the old files at all, which is disclosed here rather than left implicit.

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_platform_interface.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

ProductModel _product(String id, {double price = 499}) {
  final now = DateTime.now();
  return ProductModel(
    id: id,
    sellerId: 'seller-1',
    name: 'Widget $id',
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

/// Fails exactly one write to the key containing [failOnKeyContaining], once. The same minimal
/// seam cart_wishlist_persistence_honesty_test.dart uses, scoped here to target one buyer's own
/// key without disturbing the guest key's own write during the same transfer operation.
class _FlakyStore extends InMemorySharedPreferencesStore {
  _FlakyStore.empty() : super.empty();
  String? failOnKeyContaining;

  @override
  Future<bool> setValue(String valueType, String key, Object value) async {
    if (failOnKeyContaining != null && key.contains(failOnKeyContaining!)) {
      failOnKeyContaining = null;
      return false;
    }
    return super.setValue(valueType, key, value);
  }
}

void main() {
  late _FlakyStore store;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    store = _FlakyStore.empty();
    SharedPreferencesStorePlatform.instance = store;
  });

  group('CartProvider buyer/guest namespace isolation', () {
    test('a guest cart and a signed-in buyer\'s cart are genuinely different carts', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);

      await provider.addItem(_product('guest-item'));
      expect(provider.isInCart('guest-item'), isTrue);

      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInCart('guest-item'), isFalse,
          reason: 'signing in must not inherit the guest basket automatically -- see transferGuestCartToBuyer');
      expect(provider.itemCount, 0);

      await provider.addItem(_product('buyer-1-item'));
      expect(provider.isInCart('buyer-1-item'), isTrue);

      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInCart('guest-item'), isTrue, reason: 'the guest basket must still be exactly as it was');
      expect(provider.isInCart('buyer-1-item'), isFalse);
    });

    test('two different buyers on the same device never see each other\'s cart', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);

      provider.updateUserId('buyer-a');
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('a-item'));

      provider.updateUserId('buyer-b');
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInCart('a-item'), isFalse, reason: 'buyer B must never see buyer A\'s cart');
      await provider.addItem(_product('b-item'));

      provider.updateUserId('buyer-a');
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInCart('a-item'), isTrue, reason: 'buyer A\'s own cart survives a round trip through buyer B');
      expect(provider.isInCart('b-item'), isFalse);
    });

    test('a fresh CartProvider reads back a specific buyer\'s own cart after a real restart', () async {
      final first = CartProvider();
      await Future<void>.delayed(Duration.zero);
      first.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      await first.addItem(_product('p1'));

      final second = CartProvider();
      await Future<void>.delayed(Duration.zero);
      second.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      expect(second.isInCart('p1'), isTrue);
    });

    test('switching to the same buyer already active is a no-op, not a reload', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);
      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('p1'));

      provider.updateUserId('buyer-1');
      expect(provider.isInCart('p1'), isTrue, reason: 'a redundant updateUserId for the same buyer must not clear anything');
    });
  });

  group('CartProvider explicit guest -> buyer transfer', () {
    test('transfer merges guest items into the buyer cart, then clears the guest basket', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('guest-item'));

      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('already-buyers'));

      final transferred = await provider.transferGuestCartToBuyer();
      expect(transferred, isTrue);
      expect(provider.isInCart('guest-item'), isTrue, reason: 'the guest item is now in the buyer\'s own cart');
      expect(provider.isInCart('already-buyers'), isTrue, reason: 'merging must not drop what the buyer already had');

      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      expect(provider.isEmpty, isTrue, reason: 'the guest basket must be cleared once the transfer is confirmed durable');
    });

    test('transfer is idempotent: calling it again after success finds nothing left and changes nothing', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('guest-item'));
      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);

      expect(await provider.transferGuestCartToBuyer(), isTrue);
      expect(await provider.transferGuestCartToBuyer(), isTrue, reason: 'nothing left to transfer is still a success, not a failure');
      expect(provider.itemCount, 1, reason: 'a second transfer must never duplicate the already-merged item');
    });

    test('a destination save failure preserves the guest cart exactly as it was', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('guest-item'));
      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);

      store.failOnKeyContaining = 'buyer:buyer-1';
      final transferred = await provider.transferGuestCartToBuyer();
      expect(transferred, isFalse);
      expect(provider.isInCart('guest-item'), isFalse, reason: 'the buyer\'s own in-memory cart must not show an unsaved merge');

      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInCart('guest-item'), isTrue, reason: 'a failed destination save must leave the guest basket untouched');
    });

    test('transfer with no active buyer, and with an empty guest cart, both report honestly', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);
      expect(await provider.transferGuestCartToBuyer(), isFalse, reason: 'nothing to transfer INTO without a signed-in buyer');

      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      expect(await provider.transferGuestCartToBuyer(), isTrue, reason: 'an empty guest cart is trivially, honestly nothing to do');
    });

    test('hasGuestCartToTransfer reflects the guest basket, not whatever namespace is active', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('guest-item'));

      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      expect(await provider.hasGuestCartToTransfer(), isTrue);

      await provider.transferGuestCartToBuyer();
      expect(await provider.hasGuestCartToTransfer(), isFalse);
    });
  });

  group('WishlistProvider buyer/guest namespace isolation', () {
    test('a guest wishlist and a signed-in buyer\'s wishlist are genuinely different lists', () async {
      final provider = WishlistProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('guest-item'));

      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInWishlist('guest-item'), isFalse);

      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInWishlist('guest-item'), isTrue);
    });

    test('two different buyers never see each other\'s wishlist', () async {
      final provider = WishlistProvider();
      await Future<void>.delayed(Duration.zero);

      provider.updateUserId('buyer-a');
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('a-item'));

      provider.updateUserId('buyer-b');
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInWishlist('a-item'), isFalse);
    });
  });

  group('WishlistProvider explicit guest -> buyer transfer', () {
    test('transfer unions guest and buyer product ids, then clears the guest wishlist', () async {
      final provider = WishlistProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('guest-item'));

      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('buyer-item'));

      expect(await provider.transferGuestWishlistToBuyer(), isTrue);
      expect(provider.isInWishlist('guest-item'), isTrue);
      expect(provider.isInWishlist('buyer-item'), isTrue);

      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      expect(provider.isEmpty, isTrue);
    });

    test('a destination save failure preserves the guest wishlist exactly as it was', () async {
      final provider = WishlistProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('guest-item'));
      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);

      store.failOnKeyContaining = 'buyer:buyer-1';
      expect(await provider.transferGuestWishlistToBuyer(), isFalse);

      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInWishlist('guest-item'), isTrue);
    });
  });
}
