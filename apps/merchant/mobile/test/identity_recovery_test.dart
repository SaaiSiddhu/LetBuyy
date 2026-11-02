// Real native auth service with controlled HTTP and encrypted-storage fixtures.
// These failure/race checks do not certify hosted password or CAPTCHA acceptance.
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/auth_wrapper.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/staff_service.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/theme_provider.dart';
import 'package:letbuyy_store/screens/auth/login_screen.dart';
import 'package:letbuyy_store/services/language_service.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

const originalToken = 'synthetic-original-session';
http.Response confirmed({String id = 'owner-a', String? rotated}) =>
    http.Response(
      jsonEncode({
        'authenticated': true,
        'user': {'id': id, 'email': '$id@example.invalid'},
      }),
      200,
      headers: rotated == null
          ? {}
          : {'set-cookie': 'lb_session=$rotated; Path=/'},
    );

({StoreAuthService auth, MemoryStorage storage, ApiClient api}) fixture(
  Future<http.Response> Function(http.Request) handler, {
  MemoryStorage? storage,
}) {
  final encrypted = storage ?? MemoryStorage();
  final api = ApiClient(baseUrl: 'https://bff.example.invalid/v1');
  final client = MockClient(handler);
  final auth = StoreAuthService(
    api: api,
    identityBaseUrl: 'https://accounts.example.invalid',
    secureStorage: encrypted,
    httpClient: client,
  );
  addTearDown(() {
    auth.dispose();
    api.close();
    client.close();
  });
  return (auth: auth, storage: encrypted, api: api);
}

http.Response loginResponse(http.Request request) =>
    request.url.path == '/login'
    ? http.Response(
        '',
        200,
        headers: {'set-cookie': 'letbuyy_csrf=synthetic-csrf; Path=/'},
      )
    : http.Response(
        '{}',
        200,
        headers: {'set-cookie': 'lb_session=$originalToken; Path=/'},
      );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test(
    'a protected password POST is unavailable, never a credential denial or a saved session',
    () async {
      final f = fixture(
        (r) async => r.url.path == '/login'
            ? loginResponse(r)
            : http.Response('<html>Vercel protection</html>', 401),
      );
      await expectLater(
        f.auth.signInWithPassword(
          'owner@example.invalid',
          'Synthetic-password-42',
          turnstileToken: 'synthetic-human',
        ),
        throwsA(isA<MerchantIdentityUnavailableException>()),
      );
      expect(f.auth.isSignedIn, isFalse);
      expect(f.auth.hasSessionRecovery, isFalse);
      expect(f.storage.data, isEmpty);
    },
  );

  test(
    'verified signup also waits for a real identity before declaring success',
    () async {
      final f = fixture(
        (r) async => r.url.path == '/api/auth/session'
            ? http.Response('{}', 503)
            : loginResponse(r),
      );
      await expectLater(
        f.auth.signUp(
          'owner@example.invalid',
          'Synthetic-password-42',
          otp: '123456',
        ),
        throwsA(isA<MerchantIdentityUnavailableException>()),
      );
      expect(f.auth.isSignedIn, isFalse);
      expect(f.auth.hasSessionRecovery, isTrue);
      expect(f.storage.data, {'lb_session': originalToken});
    },
  );

  testWidgets(
    'the named login route offers saved-session retry at large text scale',
    (tester) async {
      var reads = 0;
      final f = fixture((r) async {
        expect(r.url.path, '/api/auth/session');
        reads++;
        return http.Response('{}', 503);
      });
      f.storage.data['lb_session'] = originalToken;
      await f.auth.restoreSession();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<StoreAuthService>.value(value: f.auth),
            ChangeNotifierProvider(create: (_) => ThemeProvider()),
            ChangeNotifierProvider(create: (_) => LanguageService()),
          ],
          child: MaterialApp(
            theme: ThemeData.dark(),
            home: const MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(2)),
              child: LoginScreen(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Retry saved sign-in'), findsOneWidget);
      await tester.ensureVisible(find.text('Retry saved sign-in'));
      await tester.tap(find.text('Retry saved sign-in'));
      await tester.pumpAndSettle();
      expect(reads, 2);
      expect(tester.takeException(), isNull);
      expect(find.text('Sign-in temporarily unavailable'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  test(
    'issued token plus unavailable read never creates a blank signed-in account; restart retries the original token',
    () async {
      var unavailable = true, passwordPosts = 0;
      final f = fixture((r) async {
        if (r.url.path == '/api/auth/session')
          return unavailable ? http.Response('{}', 503) : confirmed();
        if (r.url.path == '/api/auth/login') passwordPosts++;
        return loginResponse(r);
      });
      final events = <AuthChangeEvent>[];
      final sub = f.auth.authStateChanges.listen(
        (state) => events.add(state.event),
      );
      addTearDown(sub.cancel);
      await expectLater(
        f.auth.signInWithPassword(
          'owner-a@example.invalid',
          'Synthetic-password-42',
          turnstileToken: 'synthetic-challenge',
        ),
        throwsA(isA<MerchantIdentityUnavailableException>()),
      );
      await Future<void>.delayed(Duration.zero);
      expect(f.auth.currentUser, isNull);
      expect(f.auth.accessToken, isNull);
      expect(f.auth.hasSessionRecovery, isTrue);
      expect(f.storage.data, {'lb_session': originalToken});
      expect(events, [AuthChangeEvent.sessionUnavailable]);
      unavailable = false;
      final restarted = fixture((r) async {
        expect(r.url.path, '/api/auth/session');
        expect(r.headers['Cookie'], 'lb_session=$originalToken');
        return confirmed();
      }, storage: f.storage);
      await restarted.auth.restoreSession();
      expect(restarted.auth.currentUser!.id, 'owner-a');
      expect(restarted.auth.hasSessionRecovery, isFalse);
      expect(passwordPosts, 1);
      expect(
        f.storage.data.values.any(
          (v) =>
              v.contains('Synthetic-password') ||
              v.contains('synthetic-challenge'),
        ),
        isFalse,
      );
    },
  );

  for (final response in [
    http.Response('<html>SSO</html>', 200),
    http.Response('', 302),
    http.Response('{}', 503),
    http.Response('{"error":{"code":"DEPLOYMENT_PROTECTED"}}', 401),
    http.Response(
      '{"authenticated":true,"user":{"id":"","email":"owner@example.invalid"}}',
      200,
    ),
  ]) {
    test(
      'non-authoritative response ${response.statusCode}/${response.body} preserves the token and hides cached identity',
      () async {
        final f = fixture((_) async => response);
        f.storage.data.addAll({
          'lb_session': originalToken,
          'lb_session_user':
              '{"id":"cached-owner","email":"cached@example.invalid"}',
        });
        await f.auth.restoreSession();
        expect(f.auth.isSignedIn, isFalse);
        expect(f.auth.hasSessionRecovery, isTrue);
        expect(f.storage.data['lb_session'], originalToken);
      },
    );
  }

  test(
    'transport failure remains recoverable; a later explicit denial retires the saved token',
    () async {
      var denied = false;
      final f = fixture((_) async {
        if (!denied)
          throw http.ClientException('synthetic network interruption');
        return http.Response('{"authenticated":false}', 401);
      });
      f.storage.data['lb_session'] = originalToken;
      await f.auth.restoreSession();
      expect(f.auth.hasSessionRecovery, isTrue);
      denied = true;
      expect(await f.auth.refreshSession(), isFalse);
      expect(f.auth.hasSessionRecovery, isFalse);
      expect(f.storage.data, isEmpty);
    },
  );

  test(
    'confirmed rotated cookie replaces the encrypted credential only after user validation',
    () async {
      final f = fixture(
        (_) async => confirmed(rotated: 'synthetic-rotated-token'),
      );
      f.storage.data['lb_session'] = originalToken;
      await f.auth.restoreSession();
      expect(f.auth.accessToken, 'synthetic-rotated-token');
      expect(f.storage.data['lb_session'], 'synthetic-rotated-token');
    },
  );

  test('late restore cannot restore an account after sign-out', () async {
    final entered = Completer<void>(), held = Completer<http.Response>();
    final f = fixture((r) async {
      if (r.url.path == '/api/auth/session') {
        entered.complete();
        return held.future;
      }
      return http.Response('{}', 200);
    });
    f.storage.data['lb_session'] = originalToken;
    final restoring = f.auth.restoreSession();
    await entered.future;
    await f.auth.signOut();
    held.complete(confirmed());
    await restoring;
    expect(f.auth.isSignedIn, isFalse);
    expect(f.auth.hasSessionRecovery, isFalse);
    expect(f.storage.data, isEmpty);
  });

  test(
    'late password response cannot persist or activate a retired attempt',
    () async {
      final entered = Completer<void>(), held = Completer<http.Response>();
      final f = fixture((r) async {
        if (r.url.path == '/api/auth/login') {
          entered.complete();
          return held.future;
        }
        return loginResponse(r);
      });
      final pending = expectLater(
        f.auth.signInWithPassword(
          'owner@example.invalid',
          'Synthetic-password-42',
          turnstileToken: 'synthetic-human',
        ),
        throwsA(isA<MerchantAuthSupersededException>()),
      );
      await entered.future;
      await f.auth.signOut();
      held.complete(
        http.Response(
          '{}',
          200,
          headers: {'set-cookie': 'lb_session=$originalToken'},
        ),
      );
      await pending;
      expect(f.auth.isSignedIn, isFalse);
      expect(f.storage.data, isEmpty);
    },
  );

  test(
    'sign-out orders its delete after an already running encrypted token write',
    () async {
      final storage = MemoryStorage(),
          hold = Completer<void>(),
          entered = Completer<void>();
      storage.holdWrite = hold;
      storage.writeEntered = entered;
      final f = fixture(
        (r) async =>
            r.url.path == '/api/auth/session' ? confirmed() : loginResponse(r),
        storage: storage,
      );
      final pending = expectLater(
        f.auth.signInWithPassword(
          'owner@example.invalid',
          'Synthetic-password-42',
          turnstileToken: 'synthetic-human',
        ),
        throwsA(isA<MerchantAuthSupersededException>()),
      );
      await entered.future;
      final signingOut = f.auth.signOut();
      await Future<void>.delayed(Duration.zero);
      storage.holdWrite = null;
      storage.writeEntered = null;
      hold.complete();
      await pending;
      await signingOut;
      expect(storage.data, isEmpty);
      expect(f.auth.isSignedIn, isFalse);
    },
  );

  testWidgets(
    'initial unavailable identity opens recovery; Retry rechecks the saved sign-in without a password or store fetch',
    (tester) async {
      var reads = 0;
      final f = fixture((r) async {
        expect(r.url.path, '/api/auth/session');
        reads++;
        return http.Response('{}', 503);
      });
      f.storage.data['lb_session'] = originalToken;
      await f.auth.restoreSession();
      final stores = StoreContext(storeService: StoreService(api: f.api));
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<StoreAuthService>.value(value: f.auth),
            ChangeNotifierProvider<StoreContext>.value(value: stores),
            Provider<StaffService>(create: (_) => StaffService(api: f.api)),
            ChangeNotifierProvider(create: (_) => ThemeProvider()),
          ],
          child: const MaterialApp(home: AuthWrapper()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Sign-in temporarily unavailable'), findsOneWidget);
      expect(find.text('Retry saved sign-in'), findsOneWidget);
      await tester.tap(find.text('Retry saved sign-in'));
      await tester.pumpAndSettle();
      expect(reads, 2);
      expect(find.text('Retry saved sign-in'), findsOneWidget);
      expect(stores.selectedStore, isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      stores.dispose();
    },
  );
}
