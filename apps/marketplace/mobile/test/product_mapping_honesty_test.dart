// C2 corrective (27 September 2026 review, finding 1) -- regression coverage for the canonical
// feed/detail-to-ProductModel adapters no longer inventing facts the source never supplied:
// stock: 1 for every feed item regardless of real availability ("listing approval is not evidence
// of stock quantity"), missing price collapsed into 0 ("unknown price is not a free price"), and
// createdAt/updatedAt stamped with the observation moment rather than a real timestamp
// ("observation time is not product creation time"). Each of those is provably a separate claim
// from "the value really is zero/now" -- ProductModel.stockKnown/priceKnown carry that distinction,
// and these tests check both the missing case and the real-zero/real-value case for each, per the
// review's own instruction ("Tests must cover missing versus zero values").

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

/// A minimal stand-in for the gateway's marketplace feed/listing routes.
class _FakeMarketplaceGateway {
  List<Map<String, Object?>> feedItems = const [];
  Map<String, Object?>? listing;

  Dio dio() {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, handler) {
          if (o.path.endsWith('/storefront/marketplace/feed')) {
            handler.resolve(
              Response(
                requestOptions: o,
                statusCode: 200,
                data: {
                  'data': feedItems,
                  'meta': {'limit': 100, 'next_cursor': null},
                },
              ),
            );
            return;
          }
          if (o.path.contains('/storefront/marketplace/listings/')) {
            if (listing == null) {
              handler.resolve(
                Response(
                  requestOptions: o,
                  statusCode: 404,
                  data: {'error': 'not found'},
                ),
              );
            } else {
              handler.resolve(
                Response(
                  requestOptions: o,
                  statusCode: 200,
                  data: {'data': listing},
                ),
              );
            }
            return;
          }
          handler.resolve(
            Response(
              requestOptions: o,
              statusCode: 404,
              data: {'error': 'unmapped'},
            ),
          );
        },
      ),
    );
    return dio;
  }
}

ProductProvider _providerWith(_FakeMarketplaceGateway gateway) {
  final client = ApiClient(
    baseUrl: 'https://gateway.test/v1',
    dio: gateway.dio(),
    maxRetries: 0,
  );
  return ProductProvider(client: client);
}

Map<String, Object?> _feedItem({
  required String listingId,
  required String name,
  Object? price = 499,
  String approvedAt = '2026-09-20T12:00:00Z',
}) => {
  'listing_id': listingId,
  'product_id': 'prod-$listingId',
  'site_id': 'site-1',
  'name': name,
  'approved_at': approvedAt,
  'price': price,
  'compare_price': 699,
};

Map<String, Object?> _listing({
  required String listingId,
  required String name,
  Object? price = 499,
  Object? stock = 12,
  String? approvedAt = '2026-09-20T12:00:00Z',
  List<Map<String, Object?>> variants = const [],
}) => {
  'listing_id': listingId,
  'product_id': 'prod-$listingId',
  'site_id': 'site-1',
  'name': name,
  'approved_at': approvedAt,
  'price': price,
  'stock': stock,
  'variants': variants,
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('feed-level mapping (marketplaceFeed has no stock field at all)', () {
    test('stock is always unknown -- never fabricated as available', () async {
      final gateway = _FakeMarketplaceGateway()
        ..feedItems = [_feedItem(listingId: 'p1', name: 'Widget')];
      final provider = _providerWith(gateway);
      await provider.loadProducts();

      final product = provider.products.single;
      expect(
        product.stockKnown,
        isFalse,
        reason: 'a feed row structurally has no stock field',
      );
      expect(
        product.stock,
        0,
        reason: 'the unknown-stock default is inert, not a positive claim',
      );
      expect(
        product.isPurchasable,
        isFalse,
        reason: 'unknown stock must never enable a purchase action',
      );
    });

    test('a real price is recognized as known', () async {
      final gateway = _FakeMarketplaceGateway()
        ..feedItems = [_feedItem(listingId: 'p1', name: 'Widget', price: 499)];
      final provider = _providerWith(gateway);
      await provider.loadProducts();

      final product = provider.products.single;
      expect(product.priceKnown, isTrue);
      expect(product.salePrice, 499.0);
    });

    test(
      'canonical compare price stays identified as the prior-30-day low',
      () async {
        final gateway = _FakeMarketplaceGateway()
          ..feedItems = [
            _feedItem(listingId: 'p1', name: 'Widget', price: 499),
          ];
        final provider = _providerWith(gateway);
        await provider.loadProducts();

        final product = provider.products.single;
        expect(product.marketplaceListingId, 'p1');
        expect(product.originalPrice, 699.0);
        expect(product.hasPriorThirtyDayLow, isTrue);
        expect(product.referencePriceLabel, 'Lowest price in prior 30 days');
        expect(product.discountLabel, '29% below prior 30-day low');
      },
    );

    test('non-marketplace product references keep their MRP wording', () {
      final product = ProductModel(
        id: 'legacy',
        sellerId: 'seller',
        name: 'Widget',
        description: '',
        salePrice: 499,
        originalPrice: 699,
        categoryId: 'category',
        images: const [],
        stock: 2,
        createdAt: DateTime.utc(2026),
        updatedAt: DateTime.utc(2026),
      );

      expect(product.hasPriorThirtyDayLow, isFalse);
      expect(product.referencePriceLabel, 'M.R.P.');
      expect(product.discountLabel, '29% OFF');
    });

    test('a missing price is NOT treated as a free (zero) price', () async {
      final gateway = _FakeMarketplaceGateway()
        ..feedItems = [_feedItem(listingId: 'p1', name: 'Widget', price: null)];
      final provider = _providerWith(gateway);
      await provider.loadProducts();

      final product = provider.products.single;
      expect(
        product.priceKnown,
        isFalse,
        reason: 'the source never sent a price',
      );
      expect(
        product.salePrice,
        0.0,
        reason: 'the unknown-price default is inert, not a "free" claim',
      );
      expect(
        product.hasDisplayableReferencePrice,
        isFalse,
        reason:
            'a reference price cannot be compared to an unknown current price',
      );
      expect(product.discountLabel, isEmpty);
      expect(
        product.isPurchasable,
        isFalse,
        reason:
            'an unknown price must never enable a purchase action, even with known stock',
      );
    });

    test(
      'createdAt/updatedAt use the real approvedAt timestamp, not the moment of observation',
      () async {
        final gateway = _FakeMarketplaceGateway()
          ..feedItems = [
            _feedItem(
              listingId: 'p1',
              name: 'Widget',
              approvedAt: '2020-01-01T00:00:00Z',
            ),
          ];
        final provider = _providerWith(gateway);
        await provider.loadProducts();

        final product = provider.products.single;
        expect(product.createdAt, DateTime.parse('2020-01-01T00:00:00Z'));
        expect(product.updatedAt, DateTime.parse('2020-01-01T00:00:00Z'));
        expect(
          product.createdAt.isBefore(
            DateTime.now().subtract(const Duration(days: 365)),
          ),
          isTrue,
          reason:
              'must reflect the real approval date, not "now" -- this would be false if createdAt were DateTime.now()',
        );
      },
    );

    test(
      'sortProducts("newest") reflects real approval order, not fetch/mapping order',
      () async {
        final gateway = _FakeMarketplaceGateway()
          ..feedItems = [
            _feedItem(
              listingId: 'old',
              name: 'Old Listing',
              approvedAt: '2020-01-01T00:00:00Z',
            ),
            _feedItem(
              listingId: 'new',
              name: 'New Listing',
              approvedAt: '2026-01-01T00:00:00Z',
            ),
          ];
        final provider = _providerWith(gateway);
        await provider.loadProducts();
        provider.sortProducts('newest');
        expect(provider.products.map((p) => p.name), [
          'New Listing',
          'Old Listing',
        ]);
      },
    );
  });

  group('detail-level mapping (marketplaceListing carries a real stock field)', () {
    test(
      'a real, present stock count is recognized as known -- including a genuine, confirmed zero',
      () async {
        final gateway = _FakeMarketplaceGateway()
          ..listing = _listing(listingId: 'p1', name: 'Widget', stock: 0);
        final provider = _providerWith(gateway);
        await provider.loadProductById('p1');

        final product = provider.selectedProduct!;
        expect(
          product.stockKnown,
          isTrue,
          reason:
              'the detail response explicitly sent stock: 0, a real observed value',
        );
        expect(product.stock, 0);
        expect(
          product.isPurchasable,
          isFalse,
          reason: 'a genuinely confirmed zero must still block purchase',
        );
      },
    );

    test(
      'a positive stock count is recognized as known and purchasable',
      () async {
        final gateway = _FakeMarketplaceGateway()
          ..listing = _listing(
            listingId: 'p1',
            name: 'Widget',
            stock: 12,
            price: 499,
          );
        final provider = _providerWith(gateway);
        await provider.loadProductById('p1');

        final product = provider.selectedProduct!;
        expect(product.stockKnown, isTrue);
        expect(product.stock, 12);
        expect(product.isPurchasable, isTrue);
      },
    );

    test(
      'a listing response missing stock entirely is treated as unknown, not zero',
      () async {
        final gateway = _FakeMarketplaceGateway()
          ..listing = _listing(listingId: 'p1', name: 'Widget', stock: null);
        final provider = _providerWith(gateway);
        await provider.loadProductById('p1');

        final product = provider.selectedProduct!;
        expect(product.stockKnown, isFalse);
        expect(product.stock, 0);
        expect(product.isPurchasable, isFalse);
      },
    );

    test(
      'variants map their own real stock the same way, unaffected by the parent listing\'s stockKnown',
      () async {
        final gateway = _FakeMarketplaceGateway()
          ..listing = _listing(
            listingId: 'p1',
            name: 'Widget',
            variants: [
              {
                'id': 'v1',
                'title': 'Small',
                'price': 499,
                'stock': 3,
                'option1': 'S',
              },
              {
                'id': 'v2',
                'title': 'Large',
                'price': 599,
                'stock': 0,
                'option1': 'L',
              },
            ],
          );
        final provider = _providerWith(gateway);
        await provider.loadProductById('p1');

        final product = provider.selectedProduct!;
        expect(product.variants, hasLength(2));
        expect(product.variants[0].stock, 3);
        expect(product.variants[0].inStock, isTrue);
        expect(product.variants[1].stock, 0);
        expect(product.variants[1].inStock, isFalse);
        // Generic "Option 1/2/3" labels, not a guessed real name -- see _variantOptionsFromCanonical's
        // own doc comment; not this finding's subject, but exercised here since it shares the same
        // detail-mapping path.
        expect(product.variantOptions.single.name, 'Option 1');
        expect(product.variantOptions.single.values, ['S', 'L']);
      },
    );
  });
}
