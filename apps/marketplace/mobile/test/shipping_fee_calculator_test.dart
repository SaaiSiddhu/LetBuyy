// Phase 1R shipping-semantics correction (owner-requested completion, same day): unit coverage
// for shipping_fee_calculator.dart's sealed-class API, directly -- no widget harness, no gateway
// mock, since this logic is pure and deterministic given a cart and a product-lookup map. Each
// group below maps to one of the mandate's explicitly required cases; see that file's own header
// comment for why the old ₹40 / "2-3 days" / +₹9-express fallbacks were the bug, not a feature,
// and why "we don't know" and "confirmed free" must never collapse into the same plain double.

import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace/utils/shipping_fee_calculator.dart';

ProductModel _product({
  required String id,
  String name = 'Product',
  double? shippingPrice,
  bool? isFreeDelivery,
}) {
  final now = DateTime.now();
  return ProductModel(
    id: id,
    sellerId: 'seller-1',
    name: name,
    description: '',
    salePrice: 100,
    categoryId: 'cat-1',
    images: const [],
    stock: 5,
    stockKnown: true,
    priceKnown: true,
    createdAt: now,
    updatedAt: now,
    shippingPrice: shippingPrice,
    isFreeDelivery: isFreeDelivery,
  );
}

CartItemModel _item({
  required String id,
  required String productId,
  String productName = 'Product',
  bool isFreeItem = false,
}) {
  return CartItemModel(
    id: id,
    productId: productId,
    productName: productName,
    productImage: '',
    price: 100,
    quantity: 1,
    userId: 'buyer-1',
    addedAt: DateTime.now(),
    isFreeItem: isFreeItem,
  );
}

void main() {
  group('itemShippingFee', () {
    test('a confirmed free-delivery product is a known ₹0 fee, not unknown', () {
      final lookup = ProductLoaded(_product(id: 'p1', isFreeDelivery: true));
      expect(itemShippingFee(lookup), const KnownFee(0));
    });

    test('a product with a real shipping price is that known fee', () {
      final lookup = ProductLoaded(_product(id: 'p1', shippingPrice: 25));
      expect(itemShippingFee(lookup), const KnownFee(25));
    });

    test('a product with neither isFreeDelivery nor shippingPrice set is unknown, never a fallback price', () {
      final lookup = ProductLoaded(_product(id: 'p1'));
      final fee = itemShippingFee(lookup);
      expect(fee, isA<UnknownShippingFee>());
      expect(fee, isNot(const KnownFee(0)));
    });

    test('a lookup not yet present (null) is loading -- distinct from unknown and from a free ₹0', () {
      final fee = itemShippingFee(null);
      expect(fee, isA<LoadingShippingFee>());
      expect(fee, isNot(const KnownFee(0)));
    });

    test('a failed product fetch is failed -- distinct from unknown, loading, and a free ₹0', () {
      final fee = itemShippingFee(const ProductLookupFailed());
      expect(fee, isA<FailedShippingFee>());
      expect(fee, isNot(const KnownFee(0)));
    });
  });

  group('cartShippingFees', () {
    test('a free promotional cart item is a known ₹0 fee even with no product lookup at all', () {
      final item = _item(id: 'line-1', productId: 'promo-1', isFreeItem: true);
      final fees = cartShippingFees([item], {});
      expect(fees['line-1'], const KnownFee(0));
    });

    test('two different products sharing a display name get independent fees, keyed by product id not name', () {
      final items = [
        _item(id: 'line-1', productId: 'prod-A', productName: 'Same Name'),
        _item(id: 'line-2', productId: 'prod-B', productName: 'Same Name'),
      ];
      final lookups = {
        'prod-A': ProductLoaded(_product(id: 'prod-A', name: 'Same Name', shippingPrice: 10)),
        'prod-B': ProductLoaded(_product(id: 'prod-B', name: 'Same Name', shippingPrice: 99)),
      };
      final fees = cartShippingFees(items, lookups);
      expect(fees['line-1'], const KnownFee(10));
      expect(fees['line-2'], const KnownFee(99));
    });

    test('two cart lines of the same product each keep their own entry, keyed by cart line id', () {
      final items = [
        _item(id: 'line-1', productId: 'prod-A'),
        _item(id: 'line-2', productId: 'prod-A'),
      ];
      final lookups = {'prod-A': ProductLoaded(_product(id: 'prod-A', shippingPrice: 15))};
      final fees = cartShippingFees(items, lookups);
      expect(fees.length, 2);
      expect(fees['line-1'], const KnownFee(15));
      expect(fees['line-2'], const KnownFee(15));
    });

    test('item order never changes the per-line result', () {
      final itemA = _item(id: 'line-A', productId: 'prod-A');
      final itemB = _item(id: 'line-B', productId: 'prod-B');
      final lookups = {
        'prod-A': ProductLoaded(_product(id: 'prod-A', shippingPrice: 12)),
        'prod-B': const ProductLookupFailed(),
      };
      final forward = cartShippingFees([itemA, itemB], lookups);
      final reversed = cartShippingFees([itemB, itemA], lookups);
      expect(forward.length, reversed.length);
      expect(forward['line-A'], reversed['line-A']);
      expect(forward['line-B'], reversed['line-B']);
    });
  });

  group('CartShippingSummary', () {
    test('an empty cart is empty, and never claims allKnown', () {
      final summary = CartShippingSummary.compute(const [], const {});
      expect(summary.isEmpty, isTrue);
      expect(summary.allKnown, isFalse);
    });

    test('cold start: no product fetched yet for any line is a loading state, never allKnown', () {
      final items = [_item(id: 'line-1', productId: 'prod-A'), _item(id: 'line-2', productId: 'prod-B')];
      final summary = CartShippingSummary.compute(items, const {});
      expect(summary.anyLoading, isTrue);
      expect(summary.allKnown, isFalse);
    });

    test('a fetch failure is reflected as anyFailed, retry-shaped and distinct from a permanent unknown', () {
      final items = [_item(id: 'line-1', productId: 'prod-A')];
      final summary = CartShippingSummary.compute(items, {'prod-A': const ProductLookupFailed()});
      expect(summary.anyFailed, isTrue);
      expect(summary.anyUnknown, isFalse);
      expect(summary.allKnown, isFalse);
    });

    test('a successfully fetched product with no shipping data is anyUnknown, not a failure and not free', () {
      final items = [_item(id: 'line-1', productId: 'prod-A')];
      final summary = CartShippingSummary.compute(items, {'prod-A': ProductLoaded(_product(id: 'prod-A'))});
      expect(summary.anyUnknown, isTrue);
      expect(summary.anyFailed, isFalse);
      expect(summary.allKnown, isFalse);
      expect(summary.knownSoFar, 0);
    });

    test('mixed known/unknown: knownSoFar sums only the known lines, and allKnown stays false so a '
        'caller must not present that partial sum as the complete shipping cost', () {
      final items = [
        _item(id: 'line-1', productId: 'prod-A'),
        _item(id: 'line-2', productId: 'prod-B'),
      ];
      final lookups = {
        'prod-A': ProductLoaded(_product(id: 'prod-A', shippingPrice: 30)),
        // prod-B deliberately absent from the map -- still loading.
      };
      final summary = CartShippingSummary.compute(items, lookups);
      expect(summary.allKnown, isFalse);
      expect(summary.anyLoading, isTrue);
      expect(summary.knownSoFar, 30);
    });

    test('every line confirmed free (₹0) is allKnown true with knownSoFar 0 -- real free, not "we don\'t know"', () {
      final items = [_item(id: 'line-1', productId: 'prod-A'), _item(id: 'line-2', productId: 'prod-B')];
      final lookups = {
        'prod-A': ProductLoaded(_product(id: 'prod-A', isFreeDelivery: true)),
        'prod-B': ProductLoaded(_product(id: 'prod-B', isFreeDelivery: true)),
      };
      final summary = CartShippingSummary.compute(items, lookups);
      expect(summary.allKnown, isTrue);
      expect(summary.knownSoFar, 0);
    });

    test('one confirmed-free line plus one still-unknown line must NOT be allKnown just because knownSoFar is 0', () {
      final items = [_item(id: 'line-1', productId: 'prod-A'), _item(id: 'line-2', productId: 'prod-B')];
      final lookups = {
        'prod-A': ProductLoaded(_product(id: 'prod-A', isFreeDelivery: true)),
        'prod-B': ProductLoaded(_product(id: 'prod-B')), // unknown
      };
      final summary = CartShippingSummary.compute(items, lookups);
      expect(summary.knownSoFar, 0);
      expect(summary.allKnown, isFalse,
          reason: 'a ₹0 knownSoFar must never be read as "everything is confirmed free" when a line is still unknown');
    });

    test('all lines with a real, non-zero shipping price are allKnown true with the correct sum', () {
      final items = [_item(id: 'line-1', productId: 'prod-A'), _item(id: 'line-2', productId: 'prod-B')];
      final lookups = {
        'prod-A': ProductLoaded(_product(id: 'prod-A', shippingPrice: 20)),
        'prod-B': ProductLoaded(_product(id: 'prod-B', shippingPrice: 35)),
      };
      final summary = CartShippingSummary.compute(items, lookups);
      expect(summary.allKnown, isTrue);
      expect(summary.knownSoFar, 55);
    });
  });
}
