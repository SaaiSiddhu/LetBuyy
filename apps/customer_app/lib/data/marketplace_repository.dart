// CUS-1 — the seam through which this app reads the canonical marketplace.
//
// Today customer_app has 63 direct FirebaseFirestore.instance calls across 29 screen files and no
// API client at all, so there is no single place a canonical read could be introduced. This is that
// place. Screens depend on MarketplaceRepository; what stands behind it — Firestore during the
// cutover, the canonical gateway after — is a wiring decision, not something 29 files each re-make.
//
// FB-2 (2026-09-05) — THE GATE ABOVE IS VOID AND THIS IS NOW CONSUMED. The original note said the
// cutover was gated on MIG-1 importing the Firestore catalogue. The owner cancelled MIG-1 in the
// same decision that retires Firebase ("its test data, delete firebase completely"), so that gate
// can never open: there will be no import. The canonical catalogue fills when real merchants list
// real products through the canonical path, or it stays empty — and an empty canonical catalogue
// shown honestly is the correct state, where Firestore test data shown as a live storefront was
// not. `lib/data/canonical_api.dart` builds the client; `main.dart` provides this repository;
// `deal_cards_section.dart` is the first screen reading it.
//
// Still true, and the reason screens must handle failure explicitly rather than falling through to
// an empty state: migrations 217 and 220 are applied to no dev, staging or production database, so
// today these endpoints error rather than return an empty list. A screen that renders "nothing
// here" on a failed read is lying about a merchant's stock.

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
