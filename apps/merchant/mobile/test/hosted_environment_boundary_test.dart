import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/config/app_config.dart';

void main() {
  Map<String, dynamic> profile(String name) =>
      jsonDecode(File('dart-defines/$name.json').readAsStringSync())
          as Map<String, dynamic>;

  String? check(Map<String, dynamic> value) =>
      AppConfig.endpointConfigurationError(
        environmentName: value['ENVIRONMENT'] as String,
        bffUrl: value['BFF_BASE_URL'] as String,
        apiUrl: value['API_BASE_URL'] as String,
        identityUrl: value['IDENTITY_BASE_URL'] as String,
        adminUrl: value['ADMIN_BASE_URL'] as String? ?? AppConfig.adminBaseUrl,
        storefrontUrl:
            value['STOREFRONT_BASE_URL'] as String? ??
            AppConfig.storefrontBaseUrl,
        challengeSdkUrl: value['LOCAL_CHALLENGE_SDK_URL'] as String? ?? '',
      );

  test('checked-in hosted profiles select coherent isolated destinations', () {
    expect(check(profile('staging')), isNull);
    expect(check(profile('production')), isNull);
  });

  for (final key in [
    'BFF_BASE_URL',
    'API_BASE_URL',
    'IDENTITY_BASE_URL',
    'ADMIN_BASE_URL',
  ]) {
    test('staging refuses production $key before session restoration', () {
      final staged = profile('staging');
      staged[key] = profile('production')[key] ?? AppConfig.adminBaseUrl;
      expect(check(staged), isNotNull);
    });
    test('production refuses staging $key', () {
      final production = profile('production');
      production[key] = profile('staging')[key];
      expect(check(production), isNotNull);
    });
  }

  for (final destination in [
    'http://bff-staging.letbuyy.com/v1',
    'https://bff-staging.letbuyy.com:8443/v1',
    'https://bff-staging.letbuyy.com.attacker.example/v1',
    'https://bff-staging.letbuyy.com@attacker.example/v1',
    'https://user@bff-staging.letbuyy.com/v1',
    'https://bff-staging.letbuyy.com/v1?target=production',
    'https://bff-staging.letbuyy.com/v1#other',
    'https://bff-staging.letbuyy.com/v1/../auth',
  ]) {
    test('refuses unqualified transport destination $destination', () {
      final staged = profile('staging');
      staged['BFF_BASE_URL'] = destination;
      staged['API_BASE_URL'] = destination;
      expect(check(staged), isNotNull);
    });
  }

  test('accepts the governed staging BFF alias only as one transport', () {
    final staged = profile('staging');
    staged['BFF_BASE_URL'] = 'https://bff.staging.letbuyy.com/v1';
    expect(check(staged), isNotNull);
    staged['API_BASE_URL'] = staged['BFF_BASE_URL'];
    expect(check(staged), isNull);
  });

  test('unknown environment labels cannot restore hosted sessions', () {
    final staged = profile('staging');
    staged['ENVIRONMENT'] = 'stagin';
    expect(check(staged), isNotNull);
  });

  test(
    'local profile declares every local service and keeps one API transport',
    () {
      final local = profile('local');
      expect(check(local), isNull);
      local['API_BASE_URL'] = 'http://10.0.2.2:9012/v1';
      expect(check(local), isNotNull);
    },
  );

  for (final key in [
    'BFF_BASE_URL',
    'API_BASE_URL',
    'IDENTITY_BASE_URL',
    'ADMIN_BASE_URL',
    'STOREFRONT_BASE_URL',
  ]) {
    test('local label cannot admit a hosted $key', () {
      final local = profile('local');
      local[key] = profile('production')[key];
      expect(check(local), isNotNull);
    });
  }
  for (final url in [
    'https://accounts.letbuyy.com',
    'http://attacker.localhost.example:9002',
    'http://10.0.2.2:9002?destination=hosted',
    'http://user@localhost:9002',
    'http://192.168.1.10:9002',
    'http://localhost',
    'ftp://localhost:9002',
  ]) {
    test('local identity refuses unowned destination $url', () {
      final local = profile('local');
      local['IDENTITY_BASE_URL'] = url;
      expect(check(local), isNotNull);
    });
  }
  test('local issuers have distinct persistent private state namespaces', () {
    final first = AppConfig.persistenceNamespace(
      environmentName: 'local',
      identityUrl: 'http://localhost:9002',
    );
    final second = AppConfig.persistenceNamespace(
      environmentName: 'local',
      identityUrl: 'http://localhost:9003',
    );
    expect(first, isNot(second));
    expect(
      first,
      isNot(AppConfig.persistenceNamespace(environmentName: 'production')),
    );
    expect(
      first,
      isNot(AppConfig.persistenceNamespace(environmentName: 'staging')),
    );
  });
  for (final hosted in ['staging', 'production']) {
    test('$hosted refuses an owned local challenge SDK define', () {
      final value = profile(hosted);
      value['LOCAL_CHALLENGE_SDK_URL'] =
          'http://localhost:9004/fixtures/turnstile/api.js';
      expect(check(value), isNotNull);
    });
  }
  for (final sdk in [
    '',
    'https://challenges.cloudflare.com/turnstile/v0/api.js',
    'http://localhost:9004/fixtures/turnstile/api.js?other=hosted',
    'http://user@localhost:9004/fixtures/turnstile/api.js',
    'http://localhost:9004/arbitrary.js',
  ]) {
    test('local verification requires the explicit owned SDK route: $sdk', () {
      final value = profile('local');
      value['LOCAL_CHALLENGE_SDK_URL'] = sdk;
      expect(check(value), isNotNull);
    });
  }
}
