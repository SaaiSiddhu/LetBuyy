// Explicit fake Identity/account transport for widget session-race tests only.
// Actual normal sign-in/device/database acceptance is verified independently.
import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';

class _Store implements BuyerSessionStore {
  StoredBuyerSession? session = StoredBuyerSession(token: 'A', expiresAt: DateTime.now().toUtc().add(const Duration(hours: 1)));
  PendingBuyerSignIn? pending;
  @override Future<StoredBuyerSession?> readSession() async => session;
  @override Future<void> writeSession(StoredBuyerSession value) async { session = value; }
  @override Future<void> deleteSession() async { session = null; }
  @override Future<PendingBuyerSignIn?> readPending() async => pending;
  @override Future<void> writePending(PendingBuyerSignIn value) async { pending = value; }
  @override Future<void> deletePending() async { pending = null; }
}

class _Browser implements BuyerSignInBrowser {
  @override Future<Uri?> authorize(Uri url) async => Uri.parse('com.letbuyy.letbuyy:/oauth/callback?code=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB&state=${url.queryParameters['state']}');
  @override Future<Uri?> takeLaunchCallback() async => null;
  @override Future<void> cancelWaiting() async {}
}

Future<BuyerSignInController> createSyntheticBuyerSession() async {
  final accountDio = Dio()..interceptors.add(InterceptorsWrapper(onRequest: (request, handler) {
    final token = request.headers[letbuyyBuyerSessionHeader];
    handler.resolve(Response(requestOptions: request, statusCode: 200, data: {'success': true, 'data': {'buyer': {'id': 'buyer-$token', 'email': 'syn-$token@example.invalid', 'email_verified': true}}}));
  }));
  final identityDio = Dio()..interceptors.add(InterceptorsWrapper(onRequest: (request, handler) {
    handler.resolve(Response(requestOptions: request, statusCode: 200, data: {'access_token': 'B', 'token_type': 'Bearer', 'expires_in': 3600}));
  }));
  final auth = BuyerSignInController(client: BuyerSignInClient(identityBaseUrl: 'https://identity.example.invalid', dio: identityDio), accounts: BuyerAccountApi(ApiClient(baseUrl: 'https://gateway.example.invalid', dio: accountDio, maxRetries: 0)), browser: _Browser(), store: _Store());
  await auth.start();
  return auth;
}

