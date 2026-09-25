// APPID-P4d — the marketplace app's sign-in protocol, without a browser.
//
// What must hold: the challenge is RFC 7636's S256; an attempt is fresh random state and verifier;
// the address opened names the app's own client and callback; a callback is accepted only when it is
// exactly the app's callback with exactly this attempt's state, before the attempt expires; the code
// goes only to identity-platform's token endpoint with the verifier; and every way the exchange can
// fail says which way. The transport is a Dio interceptor standing in for identity-platform and the
// gateway; tests/…/buyer_sign_in_local_stack_test.dart drives the real servers.

import 'dart:math';

import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

const identity = 'https://accounts.letbuyy.test';

/// A fixed "random" source, so an attempt's values are predictable in a test and nowhere else.
class _Sequence implements Random {
  _Sequence(this.seed);
  int seed;
  @override
  int nextInt(int max) => (seed++) % max;
  @override
  double nextDouble() => 0;
  @override
  bool nextBool() => false;
}

({Dio dio, List<RequestOptions> requests}) transport(Response<Object?> Function(RequestOptions) answer) {
  final dio = Dio();
  final requests = <RequestOptions>[];
  dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
    requests.add(options);
    handler.resolve(answer(options));
  }));
  return (dio: dio, requests: requests);
}

void main() {
  final now = DateTime.utc(2026, 9, 24, 12);
  BuyerSignInClient client({Dio? dio, DateTime? at}) =>
      BuyerSignInClient(identityBaseUrl: identity, dio: dio, random: _Sequence(7), clock: () => at ?? now);

  group('the attempt', () {
    test('the challenge is RFC 7636 S256 (Appendix B)', () {
      expect(pkceS256Challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    });

    test('state and verifier are 32 random bytes each, base64url, unpadded, and never equal', () {
      final pending = BuyerSignInClient(identityBaseUrl: identity).begin();
      expect(pending.state, matches(RegExp(r'^[A-Za-z0-9_-]{43}$')));
      expect(pending.codeVerifier, matches(RegExp(r'^[A-Za-z0-9_-]{43}$')));
      expect(pending.state, isNot(pending.codeVerifier));
      final again = BuyerSignInClient(identityBaseUrl: identity).begin();
      expect(again.state, isNot(pending.state));
      expect(again.codeVerifier, isNot(pending.codeVerifier));
    });

    test('the address opened is identity-platform authorize page for the app, with S256', () {
      final c = client();
      final pending = c.begin();
      final url = c.authorizationUrl(pending);
      expect('${url.origin}${url.path}', '$identity/buyer/authorize');
      expect(url.queryParameters, {
        'response_type': 'code',
        'client_id': 'letbuyy-marketplace-app',
        'redirect_uri': 'com.letbuyy.letbuyy:/oauth/callback',
        'state': pending.state,
        'code_challenge': pkceS256Challenge(pending.codeVerifier),
        'code_challenge_method': 'S256',
      });
      expect(url.query.contains(pending.codeVerifier), isFalse, reason: 'the verifier never leaves the app in the browser');
    });

    test('identity-platform is an https origin; http only on loopback, for development', () {
      expect(BuyerSignInClient(identityBaseUrl: 'https://accounts.letbuyy.com/').authorizationUrl(client().begin()).origin, 'https://accounts.letbuyy.com');
      expect(BuyerSignInClient(identityBaseUrl: 'http://localhost:9002').authorizationUrl(client().begin()).origin, 'http://localhost:9002');
      for (final bad in [
        'http://accounts.letbuyy.com',
        'http://10.0.2.2:9002',
        'https://accounts.letbuyy.com/buyer',
        'https://accounts.letbuyy.com?x=1',
        'https://user:pw@accounts.letbuyy.com',
        'accounts.letbuyy.com',
        '',
      ]) {
        expect(() => BuyerSignInClient(identityBaseUrl: bad), throwsArgumentError, reason: bad);
      }
    });

    test('an attempt round-trips through storage, and anything else read back is nothing', () {
      final pending = client().begin();
      final restored = PendingBuyerSignIn.fromJson(pending.toJson());
      expect(restored?.state, pending.state);
      expect(restored?.codeVerifier, pending.codeVerifier);
      expect(restored?.startedAt, pending.startedAt);
      for (final bad in <Object?>[
        null,
        'string',
        {...pending.toJson(), 'v': 2},
        {...pending.toJson(), 'state': 'short'},
        {...pending.toJson(), 'code_verifier': 'x' * 44},
        {...pending.toJson(), 'started_at': 'yesterday'},
      ]) {
        expect(PendingBuyerSignIn.fromJson(bad), isNull, reason: '$bad');
      }
    });

    test('an attempt expires after 15 minutes, and one dated in the future is not trusted', () {
      final pending = client().begin();
      expect(pending.isExpired(now.add(const Duration(minutes: 14))), isFalse);
      expect(pending.isExpired(now.add(const Duration(minutes: 16))), isTrue);
      expect(PendingBuyerSignIn(state: pending.state, codeVerifier: pending.codeVerifier, startedAt: now.add(const Duration(hours: 1))).isExpired(now), isTrue);
    });
  });

  group('the callback', () {
    final c = client();
    final pending = c.begin();
    final code = 'C' * 43;
    Uri callback([String? query]) => Uri.parse('com.letbuyy.letbuyy:/oauth/callback?${query ?? 'code=$code&state=${pending.state}'}');

    test('exactly the app callback with this attempt state yields the code', () {
      final read = c.readCallback(callback(), pending);
      expect(read, isA<BuyerSignInCode>());
      expect((read as BuyerSignInCode).code, code);
    });

    test('any other address is rejected', () {
      for (final uri in [
        'com.letbuyy.letbuyy://oauth/callback?code=$code&state=${pending.state}',
        'com.letbuyy.letbuyy://evil.example/oauth/callback?code=$code&state=${pending.state}',
        'com.letbuyy.letbuyy:/oauth/callback/?code=$code&state=${pending.state}',
        'com.letbuyy.letbuyy:/oauth/other?code=$code&state=${pending.state}',
        'com.letbuyy.letbuyy:/oauth/callback?code=$code&state=${pending.state}#x',
        'com.letbuyy.evil:/oauth/callback?code=$code&state=${pending.state}',
        'letbuyy://open/oauth/callback?code=$code&state=${pending.state}',
        'https://letbuyy.com/oauth/callback?code=$code&state=${pending.state}',
      ]) {
        expect(c.readCallback(Uri.parse(uri), pending), isA<BuyerSignInRejected>(), reason: uri);
      }
    });

    test('another state, no state, a doubled parameter or a malformed code is rejected', () {
      // A different seed: client() is deterministic, so a second client() attempt would equal this one.
      final other = BuyerSignInClient(identityBaseUrl: identity, random: _Sequence(99), clock: () => now).begin();
      expect(other.state, isNot(pending.state));
      for (final query in [
        'code=$code&state=${other.state}',
        'code=$code',
        'code=$code&state=${pending.state}&state=${pending.state}',
        'code=$code&code=$code&state=${pending.state}',
        'code=short&state=${pending.state}',
        'code=${'C' * 42}%2B&state=${pending.state}',
        'state=${pending.state}',
      ]) {
        expect(c.readCallback(callback(query), pending), isA<BuyerSignInRejected>(), reason: query);
      }
      expect(c.readCallback(callback('code=$code&state=${pending.state}'), other), isA<BuyerSignInRejected>(),
          reason: 'a callback for one attempt does not answer another');
    });

    test('a decline with this state is a decline; with another state it is nothing', () {
      expect(c.readCallback(callback('error=access_denied&state=${pending.state}'), pending), isA<BuyerSignInDeclined>());
      expect(c.readCallback(callback('error=access_denied&state=${'x' * 43}'), pending), isA<BuyerSignInRejected>());
      expect(c.readCallback(callback('error=server_error&state=${pending.state}'), pending), isA<BuyerSignInRejected>());
    });

    test('a callback for an expired attempt is rejected', () {
      final late = client(at: now.add(const Duration(minutes: 20)));
      expect(late.readCallback(callback(), pending), isA<BuyerSignInRejected>());
    });
  });

  group('the exchange', () {
    final code = 'C' * 43;

    test('posts the code and verifier, form-encoded, to identity-platform token endpoint only', () async {
      final t = transport((o) => Response(requestOptions: o, statusCode: 200, data: {'access_token': 'session-token', 'token_type': 'Bearer', 'expires_in': 2592000}));
      final c = client(dio: t.dio);
      final pending = c.begin();
      final grant = await c.exchange(code, pending);
      expect(grant.accessToken, 'session-token');
      expect(grant.expiresAt, now.add(const Duration(days: 30)));
      expect(t.requests, hasLength(1));
      final request = t.requests.single;
      expect(request.uri.toString(), '$identity/api/buyer/oauth/token');
      expect(request.method, 'POST');
      expect(request.contentType, Headers.formUrlEncodedContentType);
      expect(request.followRedirects, isFalse);
      expect(request.data, {
        'grant_type': 'authorization_code',
        'code': code,
        'code_verifier': pending.codeVerifier,
        'client_id': 'letbuyy-marketplace-app',
        'redirect_uri': 'com.letbuyy.letbuyy:/oauth/callback',
      });
    });

    test('a refused code, an unavailable server, a redirect, a malformed answer and no network each say so', () async {
      Future<BuyerSignInFailure?> failureFor(Response<Object?> Function(RequestOptions) answer) async {
        try {
          final c = client(dio: transport(answer).dio);
          await c.exchange(code, c.begin());
          return null;
        } on BuyerSignInException catch (error) {
          return error.failure;
        }
      }

      expect(await failureFor((o) => Response(requestOptions: o, statusCode: 400, data: {'error': 'invalid_grant'})), BuyerSignInFailure.invalidGrant);
      expect(await failureFor((o) => Response(requestOptions: o, statusCode: 503, data: {'error': 'temporarily_unavailable'})), BuyerSignInFailure.unavailable);
      expect(await failureFor((o) => Response(requestOptions: o, statusCode: 302, data: null)), BuyerSignInFailure.unavailable);
      expect(await failureFor((o) => Response(requestOptions: o, statusCode: 200, data: {'access_token': 't', 'token_type': 'mac', 'expires_in': 60})), BuyerSignInFailure.unavailable);
      expect(await failureFor((o) => Response(requestOptions: o, statusCode: 200, data: {'access_token': '', 'token_type': 'Bearer', 'expires_in': 60})), BuyerSignInFailure.unavailable);
      expect(await failureFor((o) => Response(requestOptions: o, statusCode: 200, data: {'access_token': 't', 'token_type': 'Bearer', 'expires_in': 0})), BuyerSignInFailure.unavailable);
      expect(await failureFor((o) => Response(requestOptions: o, statusCode: 200, data: 'not json')), BuyerSignInFailure.unavailable);

      final offline = Dio();
      offline.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) => handler.reject(DioException(requestOptions: o, type: DioExceptionType.connectionError))));
      final c = client(dio: offline);
      await expectLater(c.exchange(code, c.begin()), throwsA(isA<BuyerSignInException>().having((e) => e.failure, 'failure', BuyerSignInFailure.network)));
    });
  });

  group('the gateway buyer routes', () {
    ({BuyerAccountApi api, List<RequestOptions> requests}) gateway(int status, Object? body) {
      final dio = Dio();
      final requests = <RequestOptions>[];
      dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) {
        requests.add(o);
        handler.resolve(Response(requestOptions: o, statusCode: status, data: body));
      }));
      return (api: BuyerAccountApi(ApiClient(baseUrl: 'https://gateway.test/v1', dio: dio, maxRetries: 0)), requests: requests);
    }

    test('the account read sends the session in the buyer header, and nowhere else', () async {
      final g = gateway(200, {'success': true, 'data': {'buyer': {'id': 'b-1', 'email': 'asha@example.com', 'email_verified': true}}});
      final account = await g.api.account('session-token');
      expect(account.email, 'asha@example.com');
      expect(account.emailVerified, isTrue);
      final request = g.requests.single;
      expect(request.uri.toString(), 'https://gateway.test/v1/storefront/buyer/account');
      expect(request.headers['X-LetBuyy-Buyer-Session'], 'session-token');
      expect(request.headers.containsKey('Authorization'), isFalse);
    });

    test('an ended session is an ApiException the app can act on', () async {
      final g = gateway(401, {'success': false, 'error': {'code': 'UNAUTHORIZED', 'message': 'A buyer session is required.'}});
      await expectLater(g.api.account('ended'), throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)));
    });

    test('each link answer maps to one result, and a 401 is still thrown', () async {
      expect(await gateway(200, {'success': true, 'data': {'linked': true, 'outcome': 'linked'}}).api.linkFirebase('s', 'f'), FirebaseLinkResult.linked);
      expect(await gateway(200, {'success': true, 'data': {'linked': true, 'outcome': 'already_linked'}}).api.linkFirebase('s', 'f'), FirebaseLinkResult.alreadyLinked);
      final cases = {
        (403, 'EMAIL_NOT_VERIFIED'): FirebaseLinkResult.notVerified,
        (409, 'EMAIL_MISMATCH'): FirebaseLinkResult.emailMismatch,
        (409, 'FIREBASE_LINK_CONFLICT'): FirebaseLinkResult.conflict,
        (422, 'FIREBASE_EMAIL_UNVERIFIED'): FirebaseLinkResult.noVerifiedFirebaseEmail,
        (503, 'FIREBASE_KEYS_UNAVAILABLE'): FirebaseLinkResult.unavailable,
        (400, 'INVALID_FIREBASE_TOKEN'): FirebaseLinkResult.refused,
      };
      for (final entry in cases.entries) {
        final (status, errorCode) = entry.key;
        final result = await gateway(status, {'success': false, 'error': {'code': errorCode, 'message': 'x'}}).api.linkFirebase('s', 'f');
        expect(result, entry.value, reason: errorCode);
      }
      final offline = Dio();
      offline.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) => handler.reject(DioException(requestOptions: o, type: DioExceptionType.connectionError))));
      expect(await BuyerAccountApi(ApiClient(baseUrl: 'https://gateway.test/v1', dio: offline, maxRetries: 0)).linkFirebase('s', 'f'), FirebaseLinkResult.unavailable,
          reason: 'offline is unavailable, not refused');
      final g = gateway(200, {'success': true, 'data': {'linked': true, 'outcome': 'linked'}});
      await g.api.linkFirebase('session-token', 'firebase-token');
      expect(g.requests.single.headers['X-LetBuyy-Buyer-Session'], 'session-token');
      expect(g.requests.single.data, {'id_token': 'firebase-token'});
      await expectLater(
        gateway(401, {'success': false, 'error': {'code': 'UNAUTHORIZED', 'message': 'x'}}).api.linkFirebase('s', 'f'),
        throwsA(isA<ApiException>()),
      );
    });

    test('updateProfile sends only the fields given, and distinguishes omitted from null', () async {
      final full = gateway(200, {'success': true, 'data': {'buyer': {'id': 'b-1', 'email': 'a@example.com', 'email_verified': true, 'full_name': 'Asha K', 'phone': '9900011122'}}});
      final account = await full.api.updateProfile('session-token', fullName: 'Asha K', phone: '9900011122');
      expect(account.fullName, 'Asha K');
      expect(account.phone, '9900011122');
      final fullRequest = full.requests.single;
      expect(fullRequest.method, 'PATCH');
      expect(fullRequest.uri.toString(), 'https://gateway.test/v1/storefront/buyer/profile');
      expect(fullRequest.data, {'full_name': 'Asha K', 'phone': '9900011122'});
      expect(fullRequest.headers['X-LetBuyy-Buyer-Session'], 'session-token');

      final nameOnly = gateway(200, {'success': true, 'data': {'buyer': {'id': 'b-1', 'email': 'a@example.com', 'email_verified': true, 'full_name': 'Asha K'}}});
      await nameOnly.api.updateProfile('session-token', fullName: 'Asha K');
      expect(nameOnly.requests.single.data, {'full_name': 'Asha K'}, reason: 'an omitted named parameter is never sent, not even as null');

      final clearPhone = gateway(200, {'success': true, 'data': {'buyer': {'id': 'b-1', 'email': 'a@example.com', 'email_verified': true, 'full_name': 'Asha K'}}});
      await clearPhone.api.updateProfile('session-token', phone: null);
      expect(clearPhone.requests.single.data, {'phone': null}, reason: 'an explicit null clears the field, distinct from omitting it');
    });

    test('an unexpected updateProfile response is an ApiException, and a 401 still throws', () async {
      await expectLater(
        gateway(200, {'success': true, 'data': {'buyer': null}}).api.updateProfile('session-token', fullName: 'x'),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'INVALID_RESPONSE')),
      );
      await expectLater(
        gateway(401, {'success': false, 'error': {'code': 'UNAUTHORIZED', 'message': 'x'}}).api.updateProfile('session-token', fullName: 'x'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)),
      );
    });
  });

  group('the gateway buyer address routes', () {
    ({BuyerAddressApi api, List<RequestOptions> requests}) gateway(int status, Object? body) {
      final dio = Dio();
      final requests = <RequestOptions>[];
      dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) {
        requests.add(o);
        handler.resolve(Response(requestOptions: o, statusCode: status, data: body));
      }));
      return (api: BuyerAddressApi(ApiClient(baseUrl: 'https://gateway.test/v1', dio: dio, maxRetries: 0)), requests: requests);
    }

    const addressJson = {
      'id': 'addr-1',
      'label': 'home',
      'full_name': 'Asha K',
      'phone': '9900011122',
      'address_line1': '12 MG Road',
      'address_line2': null,
      'city': 'Bengaluru',
      'state': 'Karnataka',
      'postal_code': '560001',
      'country': 'IN',
      'landmark': null,
      'is_default': true,
    };

    final address = BuyerAddress(
      id: 'addr-1',
      label: 'home',
      fullName: 'Asha K',
      phone: '9900011122',
      addressLine1: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'IN',
      isDefault: true,
    );

    test('list sends the session in the buyer header and parses every address, dropping malformed ones', () async {
      final g = gateway(200, {'success': true, 'data': {'addresses': [addressJson, 'not-an-address']}});
      final addresses = await g.api.list('session-token');
      expect(addresses, hasLength(1));
      expect(addresses.single.id, 'addr-1');
      expect(addresses.single.city, 'Bengaluru');
      final request = g.requests.single;
      expect(request.method, 'GET');
      expect(request.uri.toString(), 'https://gateway.test/v1/storefront/buyer/addresses');
      expect(request.headers['X-LetBuyy-Buyer-Session'], 'session-token');
    });

    test('list returns an empty list, not an error, for an unexpected shape', () async {
      final g = gateway(200, {'success': true, 'data': {'addresses': null}});
      expect(await g.api.list('session-token'), isEmpty);
    });

    test('create sends the address body and the session header, and returns what the gateway saved', () async {
      final g = gateway(201, {'success': true, 'data': {'address': addressJson}});
      final saved = await g.api.create('session-token', address);
      expect(saved.id, 'addr-1');
      final request = g.requests.single;
      expect(request.method, 'POST');
      expect(request.uri.toString(), 'https://gateway.test/v1/storefront/buyer/addresses');
      expect(request.data, address.toRequestBody());
      expect(request.headers['X-LetBuyy-Buyer-Session'], 'session-token');
    });

    test('update targets the given address id', () async {
      final g = gateway(200, {'success': true, 'data': {'address': addressJson}});
      await g.api.update('session-token', 'addr-1', address);
      final request = g.requests.single;
      expect(request.method, 'PATCH');
      expect(request.uri.toString(), 'https://gateway.test/v1/storefront/buyer/addresses/addr-1');
      expect(request.data, address.toRequestBody());
    });

    test('a create or update with no address in the response is an ApiException', () async {
      await expectLater(
        gateway(200, {'success': true, 'data': {'address': null}}).api.create('session-token', address),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'INVALID_RESPONSE')),
      );
      await expectLater(
        gateway(200, {'success': true, 'data': {'address': null}}).api.update('session-token', 'addr-1', address),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'INVALID_RESPONSE')),
      );
    });

    test('delete targets the given address id and sends the session header', () async {
      final g = gateway(200, {'success': true, 'data': {'deleted': true}});
      await g.api.delete('session-token', 'addr-1');
      final request = g.requests.single;
      expect(request.method, 'DELETE');
      expect(request.uri.toString(), 'https://gateway.test/v1/storefront/buyer/addresses/addr-1');
      expect(request.headers['X-LetBuyy-Buyer-Session'], 'session-token');
    });

    test('a 404 for another buyer\'s address is an ApiException, indistinguishable from a missing one', () async {
      await expectLater(
        gateway(404, {'success': false, 'error': {'code': 'NOT_FOUND', 'message': 'Address not found.'}}).api.delete('session-token', 'addr-999'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 404)),
      );
    });
  });
}
