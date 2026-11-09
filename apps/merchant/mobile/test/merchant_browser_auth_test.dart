import 'package:letbuyy_store/config/app_config.dart';
import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/screens/auth/hosted_account_screen.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:letbuyy_store/services/authentication_browser.dart';
import 'package:letbuyy_store/services/merchant_browser_auth.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

const requestId = 'd244c82d-151a-4b01-96ab-e5c6d24843a8';
const oldActor = '784f2da9-70ad-4625-a946-332cb2ad110b';
const newActor = '5dd4d65c-ea03-405e-9129-af744cb7fc7c';
final oldToken = 'o' * 64, newToken = 'n' * 64, code = 'c' * 43;

class FakeBrowser implements AuthenticationBrowser {
  final events = StreamController<String?>.broadcast();
  Uri? opened;
  String? initial;
  int opens = 0, closes = 0;
  @override
  Stream<String?> get callbacks => events.stream;
  @override
  Future<String?> initialCallback() async => initial;
  @override
  Future<void> open(Uri url, String scheme) async {
    opened = url;
    opens++;
  }

  @override
  Future<void> close() async {
    closes++;
  }
}

class Journey {
  final MemoryStorage storage;
  final browser = FakeBrowser();
  final requests = <({String origin, String path, bool bearer})>[];
  late final StoreAuthService auth;
  late final MerchantBrowserAuth flow;
  late final http.Client httpClient;
  Map<String, dynamic>? initiation, redemption;
  int exchanges = 0, cancellations = 0;
  bool unavailable = false;
  Completer<void>? exchangeHold, validationHold;
  Completer<void>? logoutHold, logoutEntered;
  Completer<void>? exchangeEntered, validationEntered;
  Journey({
    String identityOrigin = 'https://accounts.letbuyy.com',
    String environment = 'production',
    MemoryStorage? sharedStorage,
  }) : storage = sharedStorage ?? MemoryStorage() {
    httpClient = MockClient((request) async {
      requests.add((
        origin: request.url.origin,
        path: request.url.path,
        bearer: request.headers.containsKey('authorization'),
      ));
      if (request.url.path.endsWith('/requests')) {
        initiation = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({
            'requestId': requestId,
            'authorizationUrl':
                '$identityOrigin/mobile/authorize#request=$requestId&launch=${'l' * 43}',
            'managementProof': 'm' * 43,
            'expiresAt': DateTime.now()
                .add(const Duration(minutes: 15))
                .toIso8601String(),
          }),
          201,
        );
      }
      if (request.url.path.endsWith('/exchange')) {
        exchanges++;
        redemption = jsonDecode(request.body) as Map<String, dynamic>;
        exchangeEntered?.complete();
        await exchangeHold?.future;
        expect(
          MerchantBrowserAuth.challenge(redemption!['verifier'] as String),
          initiation!['challenge'],
        );
        expect(redemption!['state'], initiation!['state']);
        return http.Response(
          jsonEncode({
            'token': newToken,
            'userId': newActor,
            'expiresAt': '2030-01-01T00:00:00Z',
          }),
          200,
        );
      }
      if (request.url.path.endsWith('/cancel')) {
        cancellations++;
        return http.Response('{"cancelled":true}', 200);
      }
      if (request.url.path.endsWith('/session')) {
        validationEntered?.complete();
        await validationHold?.future;
        if (unavailable)
          return http.Response('{"code":"SESSION_UNAVAILABLE"}', 503);
        final actor = request.headers['authorization'] == 'Bearer $oldToken'
            ? oldActor
            : newActor;
        expect(
          request.headers.containsKey('cookie'),
          false,
          reason: 'native session inspection uses bearer transport',
        );
        return http.Response(
          jsonEncode({
            'authenticated': true,
            'user': {'id': actor, 'email': 'synthetic@example.invalid'},
            'expires_at': '2030-01-01T00:00:00Z',
          }),
          200,
        );
      }
      if (request.url.path.endsWith('/logout')) {
        logoutEntered?.complete();
        await logoutHold?.future;
        return http.Response('{}', 503);
      }
      return http.Response('{}', 200);
    });
    auth = StoreAuthService(
      api: ApiClient(baseUrl: 'https://bff.example.invalid/v1', maxRetries: 0),
      identityBaseUrl: identityOrigin,
      storageNamespace: AppConfig.persistenceNamespace(
        environmentName: environment,
        identityUrl: identityOrigin,
      ),
      sessionCookieName: environment == 'staging'
          ? 'lb_session_staging'
          : 'lb_session',
      csrfCookieName: environment == 'staging'
          ? 'letbuyy_csrf_staging'
          : 'letbuyy_csrf',
      secureStorage: storage,
      httpClient: httpClient,
    );
    flow = MerchantBrowserAuth(
      auth: auth,
      identityBaseUrl: identityOrigin,
      environment: environment,
      clientId: 'merchant_android',
      browser: browser,
      storage: storage,
      httpClient: httpClient,
    );
  }
  String get callback =>
      '${flow.callback}?request=$requestId&state=${initiation!['state']}&code=$code';
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final closeFirst in [true, false]) {
    test(
      'browser return close signal does not cancel a valid callback (closeFirst=$closeFirst)',
      () async {
        final j = Journey();
        await j.flow.initialize();
        await j.flow.begin('login');
        j.exchangeHold = Completer();
        j.exchangeEntered = Completer();
        if (closeFirst) j.browser.events.add(null);
        j.browser.events.add(j.callback);
        await j.exchangeEntered!.future.timeout(const Duration(seconds: 2));
        if (!closeFirst) j.browser.events.add(null);
        await Future<void>.delayed(const Duration(milliseconds: 400));
        expect(
          j.cancellations,
          0,
          reason:
              'A browser returning its callback is not an explicit account-action cancellation.',
        );
        j.exchangeHold!.complete();
        for (var i = 0; i < 100 && j.auth.currentUser?.id != newActor; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 10));
        }
        expect(j.auth.currentUser?.id, newActor);
        expect(j.exchanges, 1);
        j.flow.dispose();
      },
    );
  }
  test(
    'browser close without a callback cancels once and preserves the original actor',
    () async {
      final j = Journey();
      await j.auth.acceptHostedSession(
        token: oldToken,
        expectedUserId: oldActor,
      );
      await j.flow.initialize();
      await j.flow.begin('switch_account');
      j.browser.events.add(null);
      j.browser.events.add(null);
      for (var i = 0; i < 100 && j.auth.accountTransition; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }
      expect(j.cancellations, 1);
      expect(j.exchanges, 0);
      expect(j.auth.currentUser?.id, oldActor);
      expect(j.auth.accountTransition, false);
      expect(j.storage.data.containsKey(MerchantBrowserAuth.pendingKey), false);
      j.flow.dispose();
    },
  );
  for (final scope in [
    (environment: 'staging', origin: 'https://accounts-staging.letbuyy.com'),
    (environment: 'development', origin: 'http://localhost:9002'),
    (environment: 'development', origin: 'http://localhost:9003'),
  ])
    test(
      'browser candidate cannot cross into ${scope.environment} ${scope.origin}',
      () async {
        final production = Journey();
        await production.flow.begin('login');
        production.unavailable = true;
        await production.flow.handleCallback(production.callback);
        final retained =
            production.storage.data[MerchantBrowserAuth.candidateKey];
        expect(
          retained,
          isNotNull,
          reason: 'Populated production candidate is mandatory.',
        );
        final other = Journey(
          identityOrigin: scope.origin,
          environment: scope.environment,
          sharedStorage: production.storage,
        );
        await other.flow.initialize();
        expect(
          other.requests.where((request) => request.bearer),
          isEmpty,
          reason:
              'A different environment must not transmit a sealed production bearer.',
        );
        expect(other.auth.isSignedIn, false);
        await other.flow.cancel();
        expect(
          production.storage.data[MerchantBrowserAuth.candidateKey] == retained,
          true,
          reason:
              'Unrelated profile cancellation preserves the original candidate.',
        );
        other.flow.dispose();
        other.auth.dispose();
        production.flow.dispose();
        production.auth.dispose();
      },
    );

  test(
    'development candidate stays bound to its original local issuer',
    () async {
      const origin = 'http://localhost:9002';
      final original = Journey(
        identityOrigin: origin,
        environment: 'development',
      );
      await original.flow.begin('login');
      original.unavailable = true;
      await original.flow.handleCallback(original.callback);
      final key =
          AppConfig.persistenceNamespace(
            environmentName: 'development',
            identityUrl: origin,
          ) +
          MerchantBrowserAuth.candidateKey;
      final retained = original.storage.data[key];
      expect(retained, isNotNull);
      final other = Journey(
        identityOrigin: 'http://localhost:9003',
        environment: 'development',
        sharedStorage: original.storage,
      );
      await other.flow.initialize();
      expect(other.requests.where((request) => request.bearer), isEmpty);
      await other.flow.cancel();
      expect(original.storage.data[key] == retained, true);
      other.flow.dispose();
      other.auth.dispose();
      original.flow.dispose();
      original.auth.dispose();
    },
  );
  test(
    'local logout clears access before an unavailable revocation reply',
    () async {
      final j = Journey();
      await j.auth.acceptHostedSession(
        token: oldToken,
        expectedUserId: oldActor,
      );
      j.logoutHold = Completer();
      j.logoutEntered = Completer();
      final pending = j.auth.signOut();
      await j.logoutEntered!.future;
      expect(j.auth.currentUser, null);
      expect(j.auth.accessToken, null);
      expect(j.storage.data['lb_session'], null);
      j.logoutHold!.complete();
      await pending;
      expect(j.auth.lastLogoutRevocationConfirmed, false);
    },
  );
  test(
    'an in-flight session read cannot restore access after logout',
    () async {
      final j = Journey();
      await j.auth.acceptHostedSession(
        token: oldToken,
        expectedUserId: oldActor,
      );
      j.validationHold = Completer();
      j.validationEntered = Completer();
      final restoring = j.auth.restoreSession();
      await j.validationEntered!.future;
      await j.auth.signOut();
      j.validationHold!.complete();
      await restoring;
      expect(j.auth.currentUser, null);
      expect(j.storage.data['lb_session'], null);
    },
  );
  testWidgets(
    'signed-out entry has two working hosted actions and no credential form',
    (tester) async {
      final j = Journey();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: j.auth),
            ChangeNotifierProvider.value(value: j.flow),
          ],
          child: const MaterialApp(home: HostedAccountScreen()),
        ),
      );
      expect(find.byType(TextField), findsNothing);
      expect(find.text('Log in'), findsOneWidget);
      expect(find.text('Sign up'), findsOneWidget);
      await tester.tap(find.text('Log in'));
      await tester.pump();
      await tester.pump();
      expect(j.browser.opens, 1);
      expect(j.initiation!['purpose'], 'login');
      await j.flow.cancel();
      await tester.pump();
      await tester.tap(find.text('Sign up'));
      await tester.pump();
      await tester.pump();
      expect(j.browser.opens, 2);
      expect(j.initiation!['purpose'], 'signup');
      await j.flow.cancel();
      await tester.pumpWidget(const SizedBox());
    },
  );
  test('RFC 7636 S256 reference vector is shared with Accounts', () {
    expect(
      MerchantBrowserAuth.challenge(
        'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      ),
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
  test(
    'two entry taps open one system browser and return through one validated native session',
    () async {
      final j = Journey();
      await j.flow.initialize();
      await Future.wait([j.flow.begin('login'), j.flow.begin('login')]);
      expect(j.browser.opens, 1);
      expect(j.auth.isSignedIn, false);
      expect(j.initiation!.keys, isNot(contains('password')));
      expect(j.storage.data.containsKey(MerchantBrowserAuth.pendingKey), true);
      await Future.wait([
        j.flow.handleCallback(j.callback),
        j.flow.handleCallback(j.callback),
      ]);
      expect(j.exchanges, 1);
      expect(j.auth.currentUser?.id, newActor);
      expect(j.auth.accessToken, newToken);
      expect(j.flow.status, BrowserAuthStatus.idle);
      expect(j.storage.data.containsKey(MerchantBrowserAuth.pendingKey), false);
      expect(
        j.storage.data.containsKey(MerchantBrowserAuth.candidateKey),
        false,
      );
      await j.flow.handleCallback(j.callback);
      expect(j.exchanges, 1);
    },
  );
  test(
    'wrong host, state, path, fragment, credential URL and duplicate query fields never exchange',
    () async {
      final j = Journey();
      await j.flow.begin('login');
      final invalid = [
        j.callback.replaceFirst('accounts.letbuyy.com', 'evil.example'),
        j.callback.replaceFirst('/callback?', '/%63allback?'),
        j.callback.replaceFirst('state=', 'state=x'),
        '${j.callback}&code=$code',
        '${j.callback}#extra',
        j.callback.replaceFirst('https://', 'https://user@'),
        '${j.callback}&target=anything',
      ];
      for (final url in invalid) {
        await j.flow.handleCallback(url);
      }
      expect(j.exchanges, 0);
      expect(j.auth.isSignedIn, false);
      await j.flow.handleCallback(j.callback);
      expect(j.auth.currentUser?.id, newActor);
    },
  );
  test(
    'cancel preserves the original actor and a stale callback cannot replace it',
    () async {
      final j = Journey();
      await j.auth.acceptHostedSession(
        token: oldToken,
        expectedUserId: oldActor,
      );
      await j.flow.begin('switch_account');
      expect(j.auth.currentUser?.id, oldActor);
      expect(
        j.auth.accessToken,
        null,
        reason: 'private writes are fenced during account change',
      );
      await j.flow.cancel();
      await j.flow.handleCallback(j.callback);
      expect(j.auth.currentUser?.id, oldActor);
      expect(j.auth.accessToken, oldToken);
      expect(j.exchanges, 0);
      expect(j.cancellations, 1);
    },
  );
  test(
    'cancel while exchange is in flight fences the reply and restores the original actor',
    () async {
      final j = Journey();
      await j.auth.acceptHostedSession(
        token: oldToken,
        expectedUserId: oldActor,
      );
      await j.flow.begin('switch_account');
      j.exchangeHold = Completer();
      j.exchangeEntered = Completer();
      final pending = j.flow.handleCallback(j.callback);
      await j.exchangeEntered!.future;
      await j.flow.cancel();
      j.exchangeHold!.complete();
      await pending;
      expect(j.auth.currentUser?.id, oldActor);
      expect(j.auth.accessToken, oldToken);
    },
  );
  test(
    'cancel during authoritative verification cannot commit the new actor',
    () async {
      final j = Journey();
      await j.auth.acceptHostedSession(
        token: oldToken,
        expectedUserId: oldActor,
      );
      await j.flow.begin('switch_account');
      j.validationHold = Completer();
      j.validationEntered = Completer();
      final pending = j.flow.handleCallback(j.callback);
      await j.validationEntered!.future;
      await j.flow.cancel();
      j.validationHold!.complete();
      await pending;
      expect(j.auth.currentUser?.id, oldActor);
      expect(j.auth.accessToken, oldToken);
    },
  );
  test(
    'verification outage retains a sealed candidate; retry never redeems a used code',
    () async {
      final j = Journey();
      await j.flow.begin('login');
      j.unavailable = true;
      await j.flow.handleCallback(j.callback);
      expect(j.auth.isSignedIn, false);
      expect(j.flow.status, BrowserAuthStatus.unavailable);
      expect(
        j.storage.data.containsKey(MerchantBrowserAuth.candidateKey),
        true,
      );
      j.unavailable = false;
      await j.flow.retryVerification();
      expect(j.auth.currentUser?.id, newActor);
      expect(j.exchanges, 1);
    },
  );
  test(
    'cold-start callback resumes only with the protected request and PKCE verifier',
    () async {
      final j = Journey();
      await j.flow.begin('login');
      final browser = FakeBrowser()..initial = j.callback;
      final resumed = MerchantBrowserAuth(
        auth: j.auth,
        identityBaseUrl: 'https://accounts.letbuyy.com',
        environment: 'production',
        clientId: 'merchant_android',
        browser: browser,
        storage: j.storage,
        httpClient: j.httpClient,
      );
      await resumed.initialize();
      expect(j.auth.currentUser?.id, newActor);
      expect(j.exchanges, 1);
    },
  );
  test(
    'missing or expired cold-start state never grants a native session',
    () async {
      final j = Journey();
      await j.flow.begin('login');
      final callback = j.callback;
      await j.flow.cancel();
      final browser = FakeBrowser()..initial = callback;
      final resumed = MerchantBrowserAuth(
        auth: j.auth,
        identityBaseUrl: 'https://accounts.letbuyy.com',
        environment: 'production',
        clientId: 'merchant_android',
        browser: browser,
        storage: j.storage,
        httpClient: j.httpClient,
      );
      await resumed.initialize();
      expect(j.auth.isSignedIn, false);
      expect(j.exchanges, 0);
    },
  );
  test(
    'process death during exchange retains only orphan cancellation proof',
    () async {
      final j = Journey();
      await j.flow.begin('login');
      j.exchangeHold = Completer();
      j.exchangeEntered = Completer();
      final pending = j.flow.handleCallback(j.callback);
      await j.exchangeEntered!.future;
      final protected =
          jsonDecode(j.storage.data[MerchantBrowserAuth.pendingKey]!) as Map;
      expect(protected.containsKey('verifier'), false);
      final resumed = MerchantBrowserAuth(
        auth: j.auth,
        identityBaseUrl: 'https://accounts.letbuyy.com',
        environment: 'production',
        clientId: 'merchant_android',
        browser: FakeBrowser(),
        storage: j.storage,
        httpClient: j.httpClient,
      );
      await resumed.initialize();
      expect(j.cancellations, 1);
      expect(j.auth.isSignedIn, false);
      await j.flow.cancel();
      j.exchangeHold!.complete();
      await pending;
      expect(j.auth.isSignedIn, false);
    },
  );
  test(
    'startup outage keeps a credential sealed and never invents a user',
    () async {
      final j = Journey();
      await j.auth.acceptHostedSession(
        token: oldToken,
        expectedUserId: oldActor,
      );
      j.unavailable = true;
      await j.auth.restoreSession();
      expect(j.auth.currentUser, null);
      expect(j.auth.verificationUnavailable, true);
      expect(j.storage.data['lb_session'], oldToken);
      j.unavailable = false;
      await j.auth.restoreSession();
      expect(j.auth.currentUser?.id, oldActor);
    },
  );
}
