import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:letbuyy_store/config/app_config.dart';

import 'support/resolved_staging_transport.dart';

/// Public, read-only diagnosis on the real staging transport. No credentials,
/// certificate overrides, proxy overrides, mutations or application login.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'staging DNS and public HTTPS transport',
    (tester) async {
      expect(AppConfig.environment, 'staging');
      final endpoint = Uri.parse(AppConfig.bffBaseUrl);
      expect(endpoint.scheme, 'https');
      expect(endpoint.host, 'bff-staging.letbuyy.com');
      final result = <String, Object?>{'environment': 'staging'};
      Object? failure;
      StackTrace? stack;
      await tester.runAsync(() async {
        final client = HttpClient()
          ..connectionTimeout = const Duration(seconds: 20);
        try {
          final addresses = await InternetAddress.lookup(
            endpoint.host,
          ).timeout(const Duration(seconds: 20));
          result['dnsAddresses'] = addresses.length;
          final request = await client
              .getUrl(endpoint.replace(path: '/health'))
              .timeout(const Duration(seconds: 25));
          final response = await request.close().timeout(
            const Duration(seconds: 25),
          );
          result['healthStatus'] = response.statusCode;
          await response.drain<void>();
          expect(response.statusCode, 200);
          result['status'] = 'passed-public-native-transport';
        } catch (error, trace) {
          // The only request is a public health GET without headers or query.
          result['errorType'] = error.runtimeType.toString();
          result['publicTransportError'] = error.toString();
          failure = error;
          stack = trace;
        } finally {
          client.close(force: true);
        }
      });
      binding.reportData = result;
      debugPrint('STAGING_TRANSPORT_RESULT ${jsonEncode(result)}');
      if (failure != null) Error.throwWithStackTrace(failure!, stack!);
    },
    timeout: const Timeout(Duration(minutes: 2)),
  );

  testWidgets(
    'host-resolved staging TLS retains hostname verification',
    (tester) async {
      expect(AppConfig.environment, 'staging');
      final fixture =
          jsonDecode(
                File(
                  '/data/user/0/com.letbuyy.store/files/staging-resolved-address.json',
                ).readAsStringSync(),
              )
              as Map<String, dynamic>;
      expect(fixture['hostname'], 'bff-staging.letbuyy.com');
      final ipv4 = fixture['ipv4'] as String;
      Object? failure;
      StackTrace? stack;
      final result = <String, Object?>{
        'environment': 'staging',
        'hostResolvedTestTransport': true,
        'nativeDnsAccepted': false,
      };
      await tester.runAsync(() async {
        final dio = resolvedStagingVerificationTransport(ipv4);
        try {
          final response = await dio
              .get<Object?>('https://bff-staging.letbuyy.com/health')
              .timeout(const Duration(seconds: 30));
          expect(response.statusCode, 200);
          result['healthStatus'] = response.statusCode;
          final raw = await Socket.connect(
            InternetAddress(ipv4),
            443,
            timeout: const Duration(seconds: 15),
          );
          var denied = false;
          try {
            final socket = await SecureSocket.secure(
              raw,
              host: 'mismatch.example.invalid',
            ).timeout(const Duration(seconds: 15));
            socket.destroy();
          } on HandshakeException {
            denied = true;
          } finally {
            raw.destroy();
          }
          expect(denied, isTrue, reason: 'A different TLS hostname must fail.');
          result['wrongTlsHostnameDenied'] = true;
          result['status'] = 'passed-bounded-host-resolved-native-tls';
        } catch (error, trace) {
          result['errorType'] = error.runtimeType.toString();
          result['publicTransportError'] = error.toString();
          failure = error;
          stack = trace;
        } finally {
          dio.close(force: true);
        }
      });
      binding.reportData = result;
      debugPrint('STAGING_TRANSPORT_RESULT ${jsonEncode(result)}');
      if (failure != null) Error.throwWithStackTrace(failure!, stack!);
    },
    timeout: const Timeout(Duration(minutes: 2)),
  );
}
