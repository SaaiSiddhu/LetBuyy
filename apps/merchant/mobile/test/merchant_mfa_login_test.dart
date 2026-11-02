// Canonical Identity HTTP protocol through the real native auth service;
// controlled HTTP replies, not password, issuer, device or provider verification.
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

void main() {
  test(
    'MFA-required password response creates no session and a retry sends the current code only to Identity',
    () async {
      final requests = <Map<String, dynamic>>[],
          storage = MemoryStorage(),
          api = ApiClient(
            baseUrl: 'https://gateway.example.invalid/v1',
            maxRetries: 0,
          );
      final client = MockClient((request) async {
        if (request.method == 'GET' &&
            request.url.path == '/api/auth/session') {
          return http.Response(
            jsonEncode({
              'authenticated': true,
              'user': {'id': 'actor-a', 'email': 'synthetic@example.invalid'},
              'expiresAt': '2030-01-01T00:00:00Z',
            }),
            200,
          );
        }
        if (request.method == 'GET' && request.url.path == '/login')
          return http.Response(
            '',
            200,
            headers: {'set-cookie': 'letbuyy_csrf=synthetic-csrf; Path=/'},
          );
        if (request.method == 'POST' && request.url.path == '/api/auth/login') {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          requests.add(body);
          if (body['mfaCode'] == null)
            return http.Response(
              jsonEncode({
                'error': 'Enter your authenticator code',
                'mfaRequired': true,
              }),
              403,
            );
          return http.Response(
            jsonEncode({
              'user': {'id': 'actor-a', 'email': 'synthetic@example.invalid'},
              'expiresAt': '2030-01-01T00:00:00Z',
            }),
            200,
            headers: {
              'set-cookie':
                  'lb_session=synthetic-session-token-32-characters; Path=/',
            },
          );
        }
        return http.Response('{}', 503);
      });
      final service = StoreAuthService(
        api: api,
        identityBaseUrl: 'https://identity.example.invalid',
        httpClient: client,
        secureStorage: storage,
      );
      await expectLater(
        service.signInWithPassword(
          'synthetic@example.invalid',
          'Synthetic-password-42',
          turnstileToken: 'synthetic-human-1',
        ),
        throwsA(isA<MerchantMfaRequiredException>()),
      );
      expect(service.currentUser, isNull);
      expect(storage.data, isEmpty);
      await service.signInWithPassword(
        'synthetic@example.invalid',
        'Synthetic-password-42',
        turnstileToken: 'synthetic-human-2',
        mfaCode: '123456',
      );
      expect(requests.last['mfaCode'], '123456');
      expect(requests.first.containsKey('mfaCode'), false);
      expect(requests.last['turnstileToken'], 'synthetic-human-2');
      expect(
        storage.data.values.any((value) => value.contains('123456')),
        false,
      );
      service.dispose();
      api.close();
      client.close();
    },
  );
}
