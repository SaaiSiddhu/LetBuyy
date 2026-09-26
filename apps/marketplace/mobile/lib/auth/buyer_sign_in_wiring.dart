// APPID-P4d — builds the app's "Sign in with LetBuyy" controller from its real parts. Only reached
// when AppConfig.buyerSignInEnabled is on; with it off, main.dart never calls this.

import 'package:letbuyy_api_client/letbuyy_api_client.dart';

import '../config/app_config.dart';
import '../data/canonical_api.dart';
import 'buyer_session_store.dart';
import 'buyer_sign_in_browser.dart';
import 'buyer_sign_in_controller.dart';

BuyerSignInController buildBuyerSignInController() {
  return BuyerSignInController(
    client: BuyerSignInClient(identityBaseUrl: AppConfig.identityBaseUrl),
    accounts: BuyerAccountApi(buildCanonicalApiClient()),
    browser: platformBuyerSignInBrowser(),
    store: SecureBuyerSessionStore(),
  );
}

// SUSTAINED-L — the buyer's own canonical, cross-store profile (D1) and address book (D2), for
// screens that need to call the profile/address routes directly rather than through the sign-in
// controller (which only ever calls .account()/.linkFirebase()). Each builds its own ApiClient via
// buildCanonicalApiClient(), the same as buildBuyerSignInController's own BuyerAccountApi above.
BuyerAccountApi buildBuyerAccountApi() => BuyerAccountApi(buildCanonicalApiClient());
BuyerAddressApi buildBuyerAddressApi() => BuyerAddressApi(buildCanonicalApiClient());
