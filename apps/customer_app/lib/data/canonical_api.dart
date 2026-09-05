// FB-2 — the single place this app constructs a client for the canonical gateway.
//
// Before this file, `letbuyy_api_client` was a declared dependency of customer_app that nothing
// could reach: no base URL, no ApiClient, no provider. CUS-1's MarketplaceRepository existed with
// its only consumer being its own test. This is the wiring that makes the seam reachable.
//
// One client, built once. Constructing an ApiClient per screen would give each screen its own
// connection pool, its own retry budget and its own idea of the base URL — and would make "which
// backend is this screen actually talking to" a per-file question again, which is the condition
// CUS-1 was written to end.

import 'package:letbuyy_api_client/letbuyy_api_client.dart';

import '../config/app_config.dart';
import 'marketplace_repository.dart';

/// Builds the app's gateway client.
///
/// No token provider and no session cookie: the marketplace read surface is public, and attaching
/// credentials to an unauthenticated endpoint is how a client starts leaking them to routes that
/// never needed them. Buyer-authenticated calls arrive in FB-3 with their own, explicit token
/// wiring — they are not silently enabled here.
ApiClient buildCanonicalApiClient({String? baseUrl}) {
  return ApiClient(
    baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
    headers: const {'X-Client': 'flutter-customer'},
  );
}

/// The repository the screens depend on, backed by the canonical gateway.
MarketplaceRepository buildMarketplaceRepository({ApiClient? client}) {
  return ApiMarketplaceRepository(client ?? buildCanonicalApiClient());
}
