/// Compatibility facade for shared Dart service utilities.
library;

// Merchant runtime services now live app-local over `letbuyy_api_client`.
// Legacy provider-direct, shopper, and payment-provider services were removed
// in WS8 M5. Keep this package as a stable workspace facade for shared utility
// exports while downstream shopper ownership is decided.
export 'package:letbuyy_core/letbuyy_core.dart' show SharedPreferencesService;
