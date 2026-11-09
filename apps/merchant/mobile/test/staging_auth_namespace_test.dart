import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/config/app_config.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

void main() {
  test(
    'a local issuer cannot restore or clear hosted session credentials',
    () async {
      final storage = MemoryStorage();
      storage.data.addAll({
        'lb_session': 'p' * 32,
        'lb_session_staging': 's' * 32,
      });
      var requests = 0;
      final api = ApiClient(baseUrl: 'http://localhost:9011/v1');
      final client = MockClient((_) async {
        requests++;
        return http.Response('{}', 500);
      });
      final service = StoreAuthService(
        api: api,
        identityBaseUrl: 'http://localhost:9002',
        storageNamespace: AppConfig.persistenceNamespace(
          environmentName: 'local',
          identityUrl: 'http://localhost:9002',
        ),
        secureStorage: storage,
        httpClient: client,
      );
      await service.restoreSession();
      await service.signOut();
      expect(requests, 0);
      expect(service.currentUser, isNull);
      expect(storage.data, {
        'lb_session': 'p' * 32,
        'lb_session_staging': 's' * 32,
      });
      service.dispose();
      api.close();
      client.close();
    },
  );
  test(
    'staging never restores a production session from shared secure storage',
    () async {
      final storage = MemoryStorage();
      storage.data['lb_session'] = 'p' * 32;
      var requests = 0;
      final api = ApiClient(baseUrl: 'https://stage.invalid/v1');
      final client = MockClient((_) async {
        requests++;
        return http.Response('{}', 500);
      });
      final service = StoreAuthService(
        api: api,
        identityBaseUrl: 'https://stage.invalid',
        secureStorage: storage,
        httpClient: client,
        sessionCookieName: 'lb_session_staging',
        csrfCookieName: 'letbuyy_csrf_staging',
      );
      await service.restoreSession();
      expect(service.currentUser, isNull);
      expect(requests, 0);
      expect(storage.data['lb_session'], 'p' * 32);
      service.dispose();
      api.close();
      client.close();
    },
  );

  test(
    'staging sign-in uses its CSRF/session names without overwriting production storage',
    () async {
      final storage = MemoryStorage();
      storage.data['lb_session'] = 'p' * 32;
      final api = ApiClient(baseUrl: 'https://stage.invalid/v1');
      final client = MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/login') {
          return http.Response(
            '',
            200,
            headers: {
              'set-cookie': 'letbuyy_csrf_staging=synthetic-stage-csrf; Path=/',
            },
          );
        }
        if (request.method == 'GET' &&
            request.url.path == '/api/auth/session') {
          expect(request.headers['Authorization'], 'Bearer ${'s' * 32}');
          expect(request.headers['Cookie'], isNull);
          return http.Response(
            jsonEncode({
              'authenticated': true,
              'user': {'id': 'actor-a', 'email': 'stage@example.invalid'},
            }),
            200,
          );
        }
        expect(request.url.path, '/api/auth/login');
        expect(request.headers['X-CSRF-Token'], 'synthetic-stage-csrf');
        expect(request.headers['Cookie'], contains('letbuyy_csrf_staging='));
        expect(request.headers['Cookie'], isNot(contains('lb_session=')));
        return http.Response(
          jsonEncode({
            'user': {'id': 'actor-a', 'email': 'stage@example.invalid'},
          }),
          200,
          headers: {'set-cookie': 'lb_session_staging=${'s' * 32}; Path=/'},
        );
      });
      final service = StoreAuthService(
        api: api,
        identityBaseUrl: 'https://stage.invalid',
        secureStorage: storage,
        httpClient: client,
        sessionCookieName: 'lb_session_staging',
        csrfCookieName: 'letbuyy_csrf_staging',
      );
      await service.signInWithPassword(
        'stage@example.invalid',
        'Synthetic-password-42',
        turnstileToken: 'synthetic-challenge',
      );
      expect(service.accessToken, 's' * 32);
      expect(storage.data['lb_session'], 'p' * 32);
      expect(storage.data['lb_session_staging'], 's' * 32);
      service.dispose();
      api.close();
      client.close();
    },
  );

  test(
    'identical actor/store commands in staging cannot consume production recovery intent',
    () async {
      final storage = MemoryStorage();
      final production = SecurityCommandStore(
        storage: storage,
        environment: 'production',
      );
      final staging = SecurityCommandStore(
        storage: storage,
        environment: 'staging',
      );
      const scope = (actorId: 'actor-a', storeId: 'site-a', version: null);
      final original = await production.prepare(
        scope,
        'location.create',
        {'name': 'Production draft'},
        check: () {},
        proposedKey: 'production-command-key',
      );
      expect(
        await staging.read(scope, 'location.create', check: () {}),
        isNull,
      );
      await staging.prepare(
        scope,
        'location.create',
        {'name': 'Staging draft'},
        check: () {},
        proposedKey: 'staging-command-key',
      );
      expect(
        (await production.read(scope, 'location.create', check: () {}))!.key,
        original.key,
      );
      expect(
        (await staging.read(scope, 'location.create', check: () {}))!.key,
        'staging-command-key',
      );
      expect(
        storage.data.containsKey(
          'letbuyy.security.command.v1:actor-a:site-a:location.create',
        ),
        isTrue,
      );
    },
  );
}
