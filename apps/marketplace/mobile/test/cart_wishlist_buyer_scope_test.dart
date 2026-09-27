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
///
/// [failOnBareGuestKey] is a separate, single-shot trigger for exactly the guest cart/wishlist's
/// own key ('local_cart_v1'/'local_wishlist_v1') -- needed because that key is a strict prefix of
/// every other transfer-related key (the receipt, the per-buyer cart, the subtraction marker: all
/// 'local_cart_v1:...'), so a plain substring match on it would also catch those. This matches a
/// key that contains [failOnBareGuestKey] but not immediately followed by ':' -- robust to
/// whatever internal prefix the platform channel itself may add to every key, since it only
/// inspects what comes right after the substring, not what (if anything) comes before it.
class _FlakyStore extends InMemorySharedPreferencesStore {
  _FlakyStore.empty() : super.empty();
  String? failOnKeyContaining;
  String? failOnBareGuestKey;

  @override
  Future<bool> setValue(String valueType, String key, Object value) async {
    final bareGuestKey = failOnBareGuestKey;
    if (bareGuestKey != null) {
      final i = key.indexOf(bareGuestKey);
      final isBareKey = i != -1 && (i + bareGuestKey.length == key.length || key[i + bareGuestKey.length] != ':');
      if (isBareKey) {
        failOnBareGuestKey = null;
        return false;
      }
    }
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

    // The 4 tests below exercise the receipt/snapshot recovery design directly -- they compile
    // unmodified against the OLD (pre-receipt) transferGuestCartToBuyer and genuinely FAIL there:
    // the old version had no notion of a resumable transfer at all, so a guest-clear failure left
    // nothing for a retry to find except "guest basket already has less than the buyer got," and a
    // second call would re-merge the SAME guest quantities a second time (a real, reproducible
    // double-count, not a hypothetical one -- confirmed by temporarily reverting this file's own
    // production source and watching these exact assertions fail on the duplicated quantity).

    test('guest cleanup failing after a successful merge does not lose or duplicate the item on retry', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('guest-item'), quantity: 2);
      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);

      store.failOnBareGuestKey = 'local_cart_v1';
      final firstAttempt = await provider.transferGuestCartToBuyer();
      expect(firstAttempt, isFalse, reason: 'the guest-side cleanup write was made to fail');
      expect(provider.getItemQuantity('guest-item'), 2, reason: 'the buyer cart must already show the merge -- it is durably saved even though cleanup is still pending');

      // Forces the next SharedPreferences.getInstance() to genuinely re-read from the store
      // (this test's own _FlakyStore) rather than the legacy SharedPreferences API's own
      // in-memory _preferenceCache, which optimistically records every setString() call's
      // intended value regardless of whether the underlying platform write actually succeeded --
      // without this, a "failed" write would still read back as applied for the rest of this
      // process, masking exactly the bug this test exists to catch.
      SharedPreferences.resetStatic();
      final secondAttempt = await provider.transferGuestCartToBuyer();
      expect(secondAttempt, isTrue, reason: 'a retry must finish the pending cleanup, not fail forever');
      expect(provider.getItemQuantity('guest-item'), 2, reason: 'the retry must not re-merge the same 2 units a second time (would show 4 under the old bug)');

      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      expect(provider.isEmpty, isTrue, reason: 'the guest basket must end up cleared once the retry actually completes');
    });

    test('a fresh provider instance (simulating an app restart) resumes an interrupted transfer correctly', () async {
      final firstRun = CartProvider();
      await Future<void>.delayed(Duration.zero);
      await firstRun.addItem(_product('guest-item'), quantity: 3);
      firstRun.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);

      store.failOnBareGuestKey = 'local_cart_v1';
      expect(await firstRun.transferGuestCartToBuyer(), isFalse);
      // The app "restarts" here -- a brand new provider instance, reading the same durable store,
      // with no in-memory knowledge of the interrupted transfer above. resetStatic() forces the
      // legacy SharedPreferences singleton to genuinely re-read from the store too -- see the
      // sibling test above for why that matters.
      SharedPreferences.resetStatic();

      final afterRestart = CartProvider();
      await Future<void>.delayed(Duration.zero);
      afterRestart.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      expect(afterRestart.getItemQuantity('guest-item'), 3, reason: 'the merge from before the restart is already durably visible');

      expect(await afterRestart.transferGuestCartToBuyer(), isTrue, reason: 'the fresh instance must resume and finish the same pending transfer from disk');
      expect(afterRestart.getItemQuantity('guest-item'), 3, reason: 'resuming after a restart must not duplicate the quantity either');

      afterRestart.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      expect(afterRestart.isEmpty, isTrue);
    });

    test('an item the guest adds while cleanup is still pending survives the retry untouched', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('being-transferred'), quantity: 1);
      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);

      store.failOnBareGuestKey = 'local_cart_v1';
      expect(await provider.transferGuestCartToBuyer(), isFalse);
      SharedPreferences.resetStatic();

      // The guest (this same device, still signed out in another tab/flow) adds something new
      // while the earlier transfer's cleanup is still pending.
      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('added-after-snapshot'), quantity: 1);

      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);
      expect(await provider.transferGuestCartToBuyer(), isTrue);
      expect(provider.getItemQuantity('being-transferred'), 1, reason: 'the originally-snapshotted item must not be duplicated');

      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInCart('added-after-snapshot'), isTrue, reason: 'an item added after the snapshot was taken must never be silently discarded by a blind clear');
      expect(provider.isInCart('being-transferred'), isFalse, reason: 'the originally-snapshotted item must still be removed from the guest basket once cleanup actually completes');
    });

    test('a stale receipt left by a buyer who signed out mid-transfer is completed for its own buyer, never applied to whoever signs in next', () async {
      final provider = CartProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('a-item'), quantity: 5);
      provider.updateUserId('buyer-a');
      await Future<void>.delayed(Duration.zero);

      store.failOnBareGuestKey = 'local_cart_v1';
      expect(await provider.transferGuestCartToBuyer(), isFalse, reason: 'buyer-a\'s cleanup is left pending');
      SharedPreferences.resetStatic();

      // buyer-a signs out without ever retrying; buyer-b signs in and adds their own guest-style
      // flow (a fresh guest item, then their own transfer).
      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('b-item'), quantity: 1);
      provider.updateUserId('buyer-b');
      await Future<void>.delayed(Duration.zero);

      final resultForB = await provider.transferGuestCartToBuyer();
      expect(resultForB, isTrue);
      expect(provider.isInCart('b-item'), isTrue, reason: 'buyer-b\'s own transfer must still succeed');
      expect(provider.isInCart('a-item'), isFalse, reason: 'buyer-a\'s stale pending transfer must never leak into buyer-b\'s cart');

      provider.updateUserId('buyer-a');
      await Future<void>.delayed(Duration.zero);
      expect(provider.getItemQuantity('a-item'), 5, reason: 'buyer-a\'s own transfer must have been completed (for buyer-a), not discarded, while resolving the stale receipt');
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

    test('guest cleanup failing after a successful merge does not lose or re-duplicate the id on retry', () async {
      final provider = WishlistProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('guest-item'));
      provider.updateUserId('buyer-1');
      await Future<void>.delayed(Duration.zero);

      store.failOnBareGuestKey = 'local_wishlist_v1';
      expect(await provider.transferGuestWishlistToBuyer(), isFalse);
      expect(provider.isInWishlist('guest-item'), isTrue, reason: 'the merge is already durably saved even though cleanup is still pending');
      // Unlike CartProvider's quantity-sum, a set union is idempotent even against the OLD design
      // (re-merging the same id twice is a no-op) -- resetStatic() (see CartProvider's own sibling
      // test for why it is needed) makes this genuinely re-read the still-uncleared guest wishlist
      // rather than the legacy SharedPreferences cache's optimistic "already cleared" view, so this
      // exercises a real retry, even though this particular assertion would hold either way.
      SharedPreferences.resetStatic();

      expect(await provider.transferGuestWishlistToBuyer(), isTrue, reason: 'a retry must finish the pending cleanup');

      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      expect(provider.isEmpty, isTrue, reason: 'the guest wishlist must end up cleared once the retry actually completes');
    });

    test('a stale receipt left by a buyer who signed out mid-transfer is completed for its own buyer, never applied to whoever signs in next', () async {
      final provider = WishlistProvider();
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('a-item'));
      provider.updateUserId('buyer-a');
      await Future<void>.delayed(Duration.zero);

      store.failOnBareGuestKey = 'local_wishlist_v1';
      expect(await provider.transferGuestWishlistToBuyer(), isFalse);
      SharedPreferences.resetStatic();

      provider.updateUserId(null);
      await Future<void>.delayed(Duration.zero);
      await provider.addItem(_product('b-item'));
      provider.updateUserId('buyer-b');
      await Future<void>.delayed(Duration.zero);

      expect(await provider.transferGuestWishlistToBuyer(), isTrue);
      expect(provider.isInWishlist('b-item'), isTrue);
      expect(provider.isInWishlist('a-item'), isFalse, reason: 'buyer-a\'s stale pending transfer must never leak into buyer-b\'s wishlist');

      provider.updateUserId('buyer-a');
      await Future<void>.delayed(Duration.zero);
      expect(provider.isInWishlist('a-item'), isTrue, reason: 'buyer-a\'s own transfer must have been completed for buyer-a, not discarded');
    });
  });
}
