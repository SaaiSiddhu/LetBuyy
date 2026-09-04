// CUS-1 — the seam through which this app reads the canonical marketplace.
//
// Today customer_app has 63 direct FirebaseFirestore.instance calls across 29 screen files and no
// API client at all, so there is no single place a canonical read could be introduced. This is that
// place. Screens depend on MarketplaceRepository; what stands behind it — Firestore during the
// cutover, the canonical gateway after — is a wiring decision, not something 29 files each re-make.
//
// NOTHING CONSUMES THIS YET, and the reason is measured rather than preference: migrations 217 and
// 220 have been applied to no dev, staging or production database, so
// /storefront/marketplace/{feed,categories,listings/:id} cannot return a single row to anyone, while
// this app is live on the Play Store as com.letbuyy.letbuyy. Repointing a live screen at those
// endpoints today would empty it for real users. The cutover is gated on data existing (MIG-1), not
// on this code; CUS-2 flips screens once it does. Wiring a screen now would look like progress and
// ship an empty catalogue.

import 'package:letbuyy_api_client/letbuyy_api_client.dart';

/// What a marketplace screen needs, independent of where the data comes from.
abstract class MarketplaceRepository {
  /// One page of the cross-merchant grid. Pass [cursor] from a previous page to continue.
  Future<MarketplaceFeedPage> feed({
    String? category,
    String? search,
    int? limit,
    MarketplaceFeedCursor? cursor,
  });

  /// The live platform taxonomy.
  Future<List<MarketplaceCategory>> categories();

  /// One listing, or null when it is no longer publicly visible.
  Future<MarketplaceListingDetail?> listing(String listingId);
}

/// The canonical implementation: reads the gateway, and nothing else.
///
/// It deliberately holds no cache and no fallback to Firestore. A repository that silently answers
/// from a second source hides which system is actually serving a screen, and this programme's named
/// failure mode is exactly that — two systems where the code claims one.
class ApiMarketplaceRepository implements MarketplaceRepository {
  const ApiMarketplaceRepository(this._client);

  final ApiClient _client;

  @override
  Future<MarketplaceFeedPage> feed({
    String? category,
    String? search,
    int? limit,
    MarketplaceFeedCursor? cursor,
  }) {
    return _client.marketplaceFeed(
      category: category,
      search: search,
      limit: limit,
      cursor: cursor,
    );
  }

  @override
  Future<List<MarketplaceCategory>> categories() => _client.marketplaceCategories();

  @override
  Future<MarketplaceListingDetail?> listing(String listingId) =>
      _client.marketplaceListing(listingId);
}
