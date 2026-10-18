import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_models/src/cart_item_model.dart';
import 'package:letbuyy_marketplace_models/src/product_model.dart';

void main() {
  group('marketplace purchase identity', () {
    test('product map keeps listing and catalog product IDs distinct', () {
      final product = ProductModel.fromMap({
        'marketplaceListingId': 'listing-123',
        'catalogProductId': 'product-456',
      }, 'listing-123');

      expect(product.id, 'listing-123');
      expect(product.marketplaceListingId, 'listing-123');
      expect(product.catalogProductId, 'product-456');
      expect(
        product.copyWith(catalogProductId: 'product-789').catalogProductId,
        'product-789',
      );
    });

    test('local cart serialization preserves both canonical identities', () {
      final original = CartItemModel(
        id: 'cart-row-1',
        productId: 'listing-123',
        marketplaceListingId: 'listing-123',
        catalogProductId: 'product-456',
        productName: 'Sample item',
        productImage: '',
        price: 12,
        quantity: 2,
        userId: 'local-buyer',
        addedAt: DateTime.utc(2026, 10, 4),
      );

      final restored = CartItemModel.fromMap(original.toMap());

      expect(restored.productId, 'listing-123');
      expect(restored.marketplaceListingId, 'listing-123');
      expect(restored.catalogProductId, 'product-456');
      expect(
        restored.copyWith(catalogProductId: 'product-789').catalogProductId,
        'product-789',
      );
    });

    test(
      'cart reference price is disclosed as prior low only for a listing',
      () {
        final marketplaceItem = CartItemModel(
          id: 'cart-marketplace',
          productId: 'listing-123',
          marketplaceListingId: 'listing-123',
          productName: 'Sample item',
          productImage: '',
          price: 12,
          originalPrice: 15,
          quantity: 1,
          userId: 'local-buyer',
          addedAt: DateTime.utc(2026, 10, 4),
        );
        final legacyItem = CartItemModel(
          id: 'cart-legacy',
          productId: 'legacy-product',
          productName: 'Legacy item',
          productImage: '',
          price: 12,
          originalPrice: 15,
          quantity: 1,
          userId: 'local-buyer',
          addedAt: DateTime.utc(2026, 10, 4),
        );

        expect(marketplaceItem.hasPriorThirtyDayLow, isTrue);
        expect(
          marketplaceItem.referencePriceLabel,
          'Lowest price in prior 30 days',
        );
        expect(legacyItem.hasPriorThirtyDayLow, isFalse);
        expect(legacyItem.referencePriceLabel, 'M.R.P.');

        final zeroPriceRow = CartItemModel(
          id: 'cart-zero-price',
          productId: 'listing-zero-price',
          marketplaceListingId: 'listing-zero-price',
          productName: 'Zero price item',
          productImage: '',
          price: 0,
          originalPrice: 15,
          quantity: 1,
          userId: 'local-buyer',
          addedAt: DateTime.utc(2026, 10, 4),
        );
        expect(zeroPriceRow.hasDisplayableReferencePrice, isFalse);
        expect(zeroPriceRow.hasPriorThirtyDayLow, isFalse);
      },
    );

    test(
      'legacy cart rows remain readable without canonical identity fields',
      () {
        final restored = CartItemModel.fromMap({
          'id': 'cart-row-legacy',
          'productId': 'legacy-product',
          'productName': 'Legacy item',
          'productImage': '',
          'price': 0,
          'quantity': 1,
          'userId': 'local-buyer',
          'addedAt': DateTime.utc(2026, 10, 4).millisecondsSinceEpoch,
        });

        expect(restored.productId, 'legacy-product');
        expect(restored.marketplaceListingId, isNull);
        expect(restored.catalogProductId, isNull);
      },
    );
  });
}
