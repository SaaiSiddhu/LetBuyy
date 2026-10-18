import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

CartItemModel item({required String variantId, required int quantity}) =>
    CartItemModel(
      id: 'cart-$variantId',
      productId: 'listing-1',
      marketplaceListingId: 'listing-1',
      catalogProductId: 'product-1',
      variantId: variantId,
      productName: 'T-shirt',
      productImage: '',
      price: 100,
      quantity: quantity,
      userId: 'guest',
      addedAt: DateTime.utc(2026, 10, 4),
      variant: 'Large',
    );

void main() {
  test('cart lines with distinct canonical variants stay separate', () {
    final cart =
        CartModel(
              id: 'cart',
              userId: 'guest',
              items: const [],
              updatedAt: DateTime.utc(2026, 10, 4),
            )
            .addItem(item(variantId: 'variant-a', quantity: 1))
            .addItem(item(variantId: 'variant-b', quantity: 2));

    expect(cart.items, hasLength(2));
    expect(cart.items.map((line) => line.variantId), [
      'variant-a',
      'variant-b',
    ]);
  });

  test('checkout snapshot removes only the purchased variant and quantity', () {
    final cart =
        CartModel(
              id: 'cart',
              userId: 'guest',
              items: const [],
              updatedAt: DateTime.utc(2026, 10, 4),
            )
            .addItem(item(variantId: 'variant-a', quantity: 3))
            .addItem(item(variantId: 'variant-b', quantity: 2));

    final remaining = cart.subtractSnapshot([
      item(variantId: 'variant-a', quantity: 2),
    ]);

    expect(remaining.items, hasLength(2));
    expect(
      remaining.items
          .singleWhere((line) => line.variantId == 'variant-a')
          .quantity,
      1,
    );
    expect(
      remaining.items
          .singleWhere((line) => line.variantId == 'variant-b')
          .quantity,
      2,
    );
  });
}
