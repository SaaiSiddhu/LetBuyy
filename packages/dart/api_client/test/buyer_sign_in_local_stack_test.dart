// APPID-P4d — the marketplace app's sign-in protocol against the REAL local stack: identity-platform
// (next dev, :9002) and the gateway (wrangler dev, :9010) on a local Supabase with migrations through
// 259. Only the system browser is played by this test: it makes the two requests the browser would
// (the signed-in buyer's Continue, which returns the callback address).
//
// Skipped unless LETBUYY_LOCAL_STACK=1, because it needs those servers running. A skip here is a
// skip, not a pass: the phase evidence records the run that exercised it.
//
//   LETBUYY_LOCAL_STACK=1 dart test test/buyer_sign_in_local_stack_test.dart

import 'dart:io';

import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

const identity = 'http://localhost:9002';
const gateway = 'http://localhost:9010/v1';
final String? skipReason = Platform.environment['LETBUYY_LOCAL_STACK'] == '1'
    ? null
    : 'needs the local stack: identity-platform on :9002 and the gateway on :9010 (LETBUYY_LOCAL_STACK=1)';

/// identity-platform's CSRF double submit: the same value in the header and the cookie.
final String csrf = 'c' * 64;

String? cookieFrom(Response<Object?> response, String name) {
  for (final header in response.headers[HttpHeaders.setCookieHeader] ?? const <String>[]) {
    final pair = header.split(';').first;
    final index = pair.indexOf('=');
    if (index > 0 && pair.substring(0, index).trim() == name) return pair.substring(index + 1);
  }
  return null;
}

void main() {
  final browser = Dio(BaseOptions(baseUrl: identity, validateStatus: (_) => true, followRedirects: false));
  Options asBrowser({String? buyerCookie}) => Options(headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf,
        'cookie': 'letbuyy_csrf=$csrf${buyerCookie == null ? '' : '; lb_buyer_session=$buyerCookie'}',
        'x-forwarded-for': '198.51.100.${DateTime.now().millisecond % 250 + 1}',
      });

  late String buyerCookie;
  late String email;

  setUpAll(() async {
    if (skipReason != null) return;
    email = 'p4d-app-${DateTime.now().microsecondsSinceEpoch}@example.com';
    final registered = await browser.post<Object?>('/api/buyer/register',
        data: {'email': email, 'password': 'correct-horse-battery-staple', 'turnstileToken': 'XXXX.DUMMY.TOKEN.XXXX'},
        options: asBrowser());
    expect(registered.statusCode, 201, reason: 'buyer registered at identity-platform');
    buyerCookie = cookieFrom(registered, 'lb_buyer_session')!;
  });

  /// What the browser does: the buyer, signed in at identity-platform, presses Continue.
  Future<Uri> continueInBrowser(Uri authorizationUrl) async {
    final page = await browser.get<Object?>(authorizationUrl.toString(),
        options: Options(headers: {'cookie': 'lb_buyer_session=$buyerCookie'}, responseType: ResponseType.plain));
    expect(page.statusCode, 200);
    expect(page.data.toString(), contains('Continue to the LetBuyy app'));
    final answer = await browser.post<Object?>('/api/buyer/oauth/authorize',
        data: authorizationUrl.queryParameters, options: asBrowser(buyerCookie: buyerCookie));
    expect(answer.statusCode, 200, reason: 'Continue issues a code for the app callback');
    return Uri.parse((answer.data as Map)['redirect'] as String);
  }

  test('sign in: authorize, callback, exchange, and the gateway knows the buyer', () async {
    final client = BuyerSignInClient(identityBaseUrl: identity);
    final pending = client.begin();
    final callback = await continueInBrowser(client.authorizationUrl(pending));
    expect(callback.scheme, 'com.letbuyy.letbuyy');
    expect(callback.path, '/oauth/callback');

    final read = client.readCallback(callback, pending);
    expect(read, isA<BuyerSignInCode>());
    final grant = await client.exchange((read as BuyerSignInCode).code, pending);
    expect(grant.expiresAt.difference(DateTime.now().toUtc()).inDays, inInclusiveRange(29, 30));

    final account = await BuyerAccountApi(ApiClient(baseUrl: gateway, maxRetries: 0)).account(grant.accessToken);
    expect(account.email, email);

    // The code was spent by the exchange: a second exchange of the same code is refused.
    await expectLater(client.exchange(read.code, pending),
        throwsA(isA<BuyerSignInException>().having((e) => e.failure, 'failure', BuyerSignInFailure.invalidGrant)));
  }, skip: skipReason);

  test('a code redeemed with another verifier is refused, and burned for the right one too', () async {
    final client = BuyerSignInClient(identityBaseUrl: identity);
    final pending = client.begin();
    final callback = await continueInBrowser(client.authorizationUrl(pending));
    final code = (client.readCallback(callback, pending) as BuyerSignInCode).code;

    final interceptor = client.begin(); // another app that caught the redirect has its own verifier
    await expectLater(client.exchange(code, interceptor),
        throwsA(isA<BuyerSignInException>().having((e) => e.failure, 'failure', BuyerSignInFailure.invalidGrant)));
    await expectLater(client.exchange(code, pending),
        throwsA(isA<BuyerSignInException>().having((e) => e.failure, 'failure', BuyerSignInFailure.invalidGrant)));
  }, skip: skipReason);

  test('identity-platform refuses the app client with any other callback, and names no store for it', () async {
    final client = BuyerSignInClient(identityBaseUrl: identity);
    final url = client.authorizationUrl(client.begin());
    final other = url.replace(queryParameters: {...url.queryParameters, 'redirect_uri': 'com.letbuyy.letbuyy://oauth/callback'});
    final page = await browser.get<Object?>(other.toString(), options: Options(responseType: ResponseType.plain));
    expect(page.data.toString(), contains('incomplete or has been changed'));
    final answer = await browser.post<Object?>('/api/buyer/oauth/authorize',
        data: other.queryParameters, options: asBrowser(buyerCookie: buyerCookie));
    expect(answer.statusCode, 400);
  }, skip: skipReason);

  test('"sign out everywhere" at identity-platform ends the app session too', () async {
    final client = BuyerSignInClient(identityBaseUrl: identity);
    final pending = client.begin();
    final callback = await continueInBrowser(client.authorizationUrl(pending));
    final grant = await client.exchange((client.readCallback(callback, pending) as BuyerSignInCode).code, pending);
    final accounts = BuyerAccountApi(ApiClient(baseUrl: gateway, maxRetries: 0));
    expect((await accounts.account(grant.accessToken)).email, email);

    final everywhere = await browser.post<Object?>('/api/buyer/sign-out-everywhere', options: asBrowser(buyerCookie: buyerCookie));
    expect(everywhere.statusCode, 200);
    await expectLater(accounts.account(grant.accessToken), throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)));
  }, skip: skipReason);

  test('the Firebase link refuses a token Google did not sign, and links nothing', () async {
    // setUpAll's buyer session was ended by the previous test; sign in again.
    final again = await browser.post<Object?>('/api/buyer/login',
        data: {'email': email, 'password': 'correct-horse-battery-staple', 'turnstileToken': 'XXXX.DUMMY.TOKEN.XXXX'},
        options: asBrowser());
    expect(again.statusCode, 200);
    buyerCookie = cookieFrom(again, 'lb_buyer_session')!;

    final client = BuyerSignInClient(identityBaseUrl: identity);
    final pending = client.begin();
    final callback = await continueInBrowser(client.authorizationUrl(pending));
    final grant = await client.exchange((client.readCallback(callback, pending) as BuyerSignInCode).code, pending);
    final result = await BuyerAccountApi(ApiClient(baseUrl: gateway, maxRetries: 0))
        .linkFirebase(grant.accessToken, 'eyJhbGciOiJSUzI1NiIsImtpZCI6Im5vdC1nb29nbGUifQ.eyJzdWIiOiJ4In0.c2lnbmF0dXJl');
    expect(result, anyOf(FirebaseLinkResult.refused, FirebaseLinkResult.unavailable));
  }, skip: skipReason);
}
