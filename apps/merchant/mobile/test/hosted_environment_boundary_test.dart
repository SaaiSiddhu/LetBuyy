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
}
