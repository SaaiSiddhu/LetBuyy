// C3 (Firebase SDK removal, 27 September 2026 review finding 5) -- the same bug, and the same
// fix, as CartProvider (see cart_provider_test.dart's own doc comment for the full account):
// addItem/removeItem/clearWishlist all required a userId that was always null, so isInWishlist
// could never actually return true even immediately after "successfully" adding something --
// _wishlist itself never loaded past its initial empty state. Now a real, working local
// (SharedPreferences-backed, device-scoped) wishlist.

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

ProductModel _product(String id, {String name = 'Widget'}) {
  final now = DateTime.now();
  return ProductModel(
    id: id,
    sellerId: 'seller-1',
    name: name,
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
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('addItem actually adds the product -- isInWishlist genuinely reflects it', () async {
    final provider = WishlistProvider();
    await Future<void>.delayed(Duration.zero);

    final added = await provider.addItem(_product('p1'));

    expect(added, isTrue, reason: 'addItem must report real success, not a permanent, silent failure');
    expect(provider.isInWishlist('p1'), isTrue);
    expect(provider.itemCount, 1);
    expect(provider.isEmpty, isFalse);
  });

  test('toggleItem adds then removes on alternating calls', () async {
    final provider = WishlistProvider();
    await Future<void>.delayed(Duration.zero);

    await provider.toggleItem(_product('p1'));
    expect(provider.isInWishlist('p1'), isTrue);

    await provider.toggleItem(_product('p1'));
    expect(provider.isInWishlist('p1'), isFalse);
  });

  test('the wishlist survives a real app restart -- a fresh WishlistProvider reads back what was added', () async {
    final first = WishlistProvider();
    await Future<void>.delayed(Duration.zero);
    await first.addItem(_product('p1'));

    final second = WishlistProvider();
    await Future<void>.delayed(Duration.zero);

    expect(second.isInWishlist('p1'), isTrue);
    expect(second.itemCount, 1);
  });

  test('clearWishlist empties the persisted wishlist, not nothing', () async {
    final provider = WishlistProvider();
    await Future<void>.delayed(Duration.zero);
    await provider.addItem(_product('p1'));
    await provider.addItem(_product('p2'));
    expect(provider.itemCount, 2);

    final cleared = await provider.clearWishlist();
    expect(cleared, isTrue);
    expect(provider.isEmpty, isTrue);
  });
}
