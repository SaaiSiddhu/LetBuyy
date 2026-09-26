// C3 corrective (27 September 2026 review, findings 1-2) -- regression coverage for the three real
// gaps that review found in CartProvider/WishlistProvider's local persistence, underneath the
// already-tested happy-path behaviour in cart_provider_test.dart/wishlist_provider_test.dart:
//
// 1. Dishonest persistence contract: _save() never inspected SharedPreferences.setString's own
//    returned bool, so a mutation always returned `true` even when the underlying disk write
//    failed, and the in-memory state was never rolled back to match.
// 2. Initialization ordering: a mutation issued before the constructor's own _load() resolves
//    used to run immediately, only for _load()'s later, unconditional replacement of the whole
//    cart/wishlist to silently discard it.
// 3. Concurrent writes: two overlapping mutations' own SharedPreferences.setString calls on the
//    identical key had no ordering guarantee against each other.
//
// Uses a small SharedPreferencesStorePlatform test double (a real, first-party extension point --
// InMemorySharedPreferencesStore is the same in-memory implementation SharedPreferences.
// setMockInitialValues installs) to make writes controllably fail or overlap, rather than a broad
// new mocking framework: this is the one seam needed to prove the three claims above.

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_platform_interface.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

class _FlakyStore extends InMemorySharedPreferencesStore {
  _FlakyStore.empty() : super.empty();

  bool failNextWrite = false;
  Duration writeDelay = Duration.zero;
  int _inFlightWrites = 0;
  int maxConcurrentWrites = 0;

  @override
  Future<bool> setValue(String valueType, String key, Object value) async {
    _inFlightWrites++;
    if (_inFlightWrites > maxConcurrentWrites) maxConcurrentWrites = _inFlightWrites;
    try {
      if (failNextWrite) {
        failNextWrite = false;
        return false;
      }
      if (writeDelay > Duration.zero) {
        await Future<void>.delayed(writeDelay);
      }
      return await super.setValue(valueType, key, value);
    } finally {
      _inFlightWrites--;
    }
  }
}

ProductModel _product(String id) {
  final now = DateTime.now();
  return ProductModel(
    id: id,
    sellerId: 'seller-1',
    name: 'Widget $id',
    description: '',
    salePrice: 499,
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
  late _FlakyStore store;

  setUp(() {
    // Establishes the mock channel plumbing SharedPreferences.getInstance() relies on, then
    // immediately swaps in a controllable store instead of the plain one setMockInitialValues
    // itself installs.
    SharedPreferences.setMockInitialValues({});
    store = _FlakyStore.empty();
    SharedPreferencesStorePlatform.instance = store;
  });

  group('CartProvider', () {
    test('a failed disk write is reported honestly, and the in-memory cart is rolled back', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);

      store.failNextWrite = true;
      final added = await provider.addItem(_product('p1'));

      expect(added, isFalse, reason: 'a disk write failure must not be reported as success');
      expect(provider.isInCart('p1'), isFalse,
          reason: 'a failed save must roll back the in-memory addition, not leave it half-applied');
      expect(provider.itemCount, 0);
    });

    test('a mutation issued right after construction is not discarded once the initial load resolves', () async {
      final provider = CartProvider();
      // No intervening await: addItem() is called before this provider's own _load() has had any
      // chance to complete.
      final added = await provider.addItem(_product('p1'));

      expect(added, isTrue);
      expect(provider.isInCart('p1'), isTrue,
          reason: 'the initial load must never silently replace an in-flight mutation\'s result');
    });

    test('two overlapping mutations never let their disk writes race, and both survive a reload', () async {
      store.writeDelay = const Duration(milliseconds: 5);
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);

      final results = await Future.wait([
        provider.addItem(_product('p1')),
        provider.addItem(_product('p2')),
      ]);

      expect(results, everyElement(isTrue));
      expect(store.maxConcurrentWrites, 1,
          reason: 'writes to this cart\'s one disk key must execute one at a time, never overlapped');
      expect(provider.isInCart('p1'), isTrue);
      expect(provider.isInCart('p2'), isTrue);

      final reloaded = CartProvider();
      await Future<void>.delayed(Duration.zero);
      expect(reloaded.isInCart('p1'), isTrue, reason: 'both additions must have actually persisted, not just landed in memory');
      expect(reloaded.isInCart('p2'), isTrue);
    });
  });

  group('WishlistProvider', () {
    test('a failed disk write is reported honestly, and the in-memory wishlist is rolled back', () async {
      final provider = WishlistProvider();
      await Future<void>.delayed(Duration.zero);

      store.failNextWrite = true;
      final added = await provider.addItem(_product('p1'));

      expect(added, isFalse);
      expect(provider.isInWishlist('p1'), isFalse);
      expect(provider.itemCount, 0);
    });

    test('a mutation issued right after construction is not discarded once the initial load resolves', () async {
      final provider = WishlistProvider();
      final added = await provider.addItem(_product('p1'));

      expect(added, isTrue);
      expect(provider.isInWishlist('p1'), isTrue);
    });

    test('two overlapping mutations never let their disk writes race, and both survive a reload', () async {
      store.writeDelay = const Duration(milliseconds: 5);
      final provider = WishlistProvider();
      await Future<void>.delayed(Duration.zero);

      final results = await Future.wait([
        provider.addItem(_product('p1')),
        provider.addItem(_product('p2')),
      ]);

      expect(results, everyElement(isTrue));
      expect(store.maxConcurrentWrites, 1);
      expect(provider.isInWishlist('p1'), isTrue);
      expect(provider.isInWishlist('p2'), isTrue);

      final reloaded = WishlistProvider();
      await Future<void>.delayed(Duration.zero);
      expect(reloaded.isInWishlist('p1'), isTrue);
      expect(reloaded.isInWishlist('p2'), isTrue);
    });
  });
}
