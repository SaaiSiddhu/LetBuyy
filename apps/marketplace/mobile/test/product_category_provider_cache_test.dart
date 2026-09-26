// C2 corrective (27 September 2026 review, finding 2) -- regression coverage for the cache-
// revalidation bug: ProductProvider.initializeFromCache/refreshProducts and CategoryProvider's
// equivalents called loadProducts()/loadCategories() with no forceReload, intending a background
// revalidation. But both load methods have a dedup guard ("already loaded, skip the fetch") keyed
// on the list already being non-empty -- exactly the condition cache hydration (or a prior
// successful fetch) creates. So the "revalidation" was always a no-op: once any data populated the
// list, from cache or otherwise, the real canonical source was never consulted again without an
// explicit forceReload somewhere else in the call chain.
//
// Deliberately isolated from CacheService/SharedPreferences: the bug is in the interaction between
// loadProducts's own dedup guard and a non-empty list, which is exactly as true right after a
// first successful loadProducts() call as it is after cache hydration populates the same field --
// CacheService is how _products got non-empty on a real device, not what the bug depends on. This
// keeps the test to a plain Dart unit test (no widget tree, no SharedPreferences mock lifecycle,
// no risk of the CacheService singleton's own state leaking across test files in the same process).
//
// Exercises refreshProducts()/refreshCategories() specifically, not loadProducts()/loadCategories()
// directly -- forceReload itself was never broken (loadProducts(forceReload: true) already bypassed
// the dedup guard correctly before this fix). The actual bug was entirely in refreshProducts and
// initializeFromCache calling loadProducts() with NO forceReload -- a first version of this test
// called loadProducts() and loadProducts(forceReload: true) directly and passed against the
// unfixed source too, since it never touched the two call sites that were actually wrong.
// initializeFromCache's own fix is identical (loadProducts() -> loadProducts(forceReload: true))
// but is not independently exercised here, since triggering its cache-hit branch needs a real,
// populated CacheService/SharedPreferences -- refreshProducts/refreshCategories cover the same
// one-line fix without that dependency.

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

/// A minimal stand-in for the gateway's marketplace feed/categories routes -- just enough to
/// control what a second fetch returns and prove whether it actually ran.
class _FakeMarketplaceGateway {
  List<Map<String, Object?>> feedItems = const [];
  List<Map<String, Object?>> categories = const [];
  int feedRequests = 0;
  int categoryRequests = 0;

  Dio dio() {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) {
      if (o.path.endsWith('/storefront/marketplace/feed')) {
        feedRequests++;
        handler.resolve(Response(
          requestOptions: o,
          statusCode: 200,
          data: {'data': feedItems, 'meta': {'limit': 100, 'next_cursor': null}},
        ));
        return;
      }
      if (o.path.endsWith('/storefront/marketplace/categories')) {
        categoryRequests++;
        handler.resolve(Response(requestOptions: o, statusCode: 200, data: {'data': categories}));
        return;
      }
      handler.resolve(Response(requestOptions: o, statusCode: 404, data: {'error': 'unmapped'}));
    }));
    return dio;
  }
}

Map<String, Object?> _feedItem(String listingId, String name) => {
      'listing_id': listingId,
      'product_id': 'prod-$listingId',
      'site_id': 'site-1',
      'name': name,
      'approved_at': '2026-09-01T00:00:00Z',
    };

Map<String, Object?> _category(String id, String slug, String name) => {
      'id': id,
      'slug': slug,
      'name': name,
      'parent_id': null,
      'position': 0,
    };

void main() {
  test('ProductProvider.refreshProducts() actually re-fetches once products are already loaded', () async {
    final gateway = _FakeMarketplaceGateway()..feedItems = [_feedItem('p1', 'Seed Product')];
    final client = ApiClient(baseUrl: 'https://gateway.test/v1', dio: gateway.dio(), maxRetries: 0);
    final provider = ProductProvider(client: client);

    // Simulates however _products first became non-empty (a real first load here; cache
    // hydration on a real device) -- what matters is that it IS non-empty, which is exactly the
    // condition loadProducts's own dedup guard checks.
    await provider.loadProducts();
    expect(provider.products.map((p) => p.name), ['Seed Product']);
    expect(gateway.feedRequests, 1);

    // The canonical catalog changes on the server.
    gateway.feedItems = [_feedItem('p2', 'Fresh Product')];

    // The bug: refreshProducts() called loadProducts() with no forceReload, so the dedup guard
    // silently swallowed every "refresh" once products were already loaded -- a caller that
    // explicitly asked to revalidate got stale data back with no indication anything was wrong.
    await provider.refreshProducts();
    expect(provider.products.map((p) => p.name), ['Fresh Product'], reason: 'refreshProducts() must actually re-fetch, not silently no-op');
    expect(gateway.feedRequests, 2);
  });

  test('CategoryProvider.refreshCategories() actually re-fetches once categories are already loaded', () async {
    final gateway = _FakeMarketplaceGateway()..categories = [_category('cat-1', 'electronics', 'Electronics')];
    final client = ApiClient(baseUrl: 'https://gateway.test/v1', dio: gateway.dio(), maxRetries: 0);
    final provider = CategoryProvider(client: client);

    await provider.loadCategories();
    expect(provider.allCategories.map((c) => c.name), ['Electronics']);
    expect(gateway.categoryRequests, 1);

    gateway.categories = [_category('cat-2', 'fashion', 'Fashion')];

    await provider.refreshCategories();
    expect(provider.allCategories.map((c) => c.name), ['Fashion'], reason: 'refreshCategories() must actually re-fetch, not silently no-op');
    expect(gateway.categoryRequests, 2);
  });
}
