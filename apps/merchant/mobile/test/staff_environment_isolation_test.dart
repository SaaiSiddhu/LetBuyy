import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/config/app_config.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/staff_service.dart';
import 'staff_scope_boundary_test.dart' as f;

const storage = FlutterSecureStorage();
const pending = 'letbuyy.staff.mutations.v1';
const invitationKey = 'letbuyy.staff.pending-invitation.v1';
final stagingProof = f.invitation.replaceFirst(
  RegExp(r'a{64}$'),
  List.filled(64, 'b').join(),
);
const input = StaffInviteInput(
  storeId: f.siteA,
  email: 'staff@example.invalid',
  role: 'viewer',
);
String get intent => jsonEncode(['create', f.siteA, input.toJson()]);
Map<String, String> hostedData() => {
  invitationKey: f.invitation,
  '$invitationKey.staging': stagingProof,
  pending: jsonEncode({intent: 'synthetic-production-original-key'}),
  '$pending.staging': jsonEncode({intent: 'synthetic-staging-original-key'}),
};

ApiClient unavailable(List<String> keys) {
  final dio = Dio();
  final api = ApiClient(
    baseUrl: 'https://gateway.test/v1',
    dio: dio,
    maxRetries: 0,
  );
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (r, h) {
        expect(r.method, 'POST');
        expect(r.path.endsWith('/employees'), isTrue);
        keys.add(r.headers['X-Idempotency-Key'] as String);
        h.resolve(
          Response(
            requestOptions: r,
            statusCode: 503,
            data: {
              'error': {
                'code': 'SYNTHETIC_UNAVAILABLE',
                'message': 'Synthetic unavailable',
              },
            },
          ),
        );
      },
    ),
  );
  addTearDown(api.close);
  return api;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues(hostedData()));
  for (final env in ['production', 'staging']) {
    test(
      'existing $env invitation proof keeps its exact key and bytes',
      () async {
        final service = StaffService(api: unavailable([]), environment: env);
        addTearDown(service.dispose);
        await service.restorePendingInvitation();
        expect(
          service.pendingInvitation,
          env == 'production' ? f.invitation : stagingProof,
        );
        expect(await storage.readAll(), hostedData());
      },
    );
    test(
      'existing $env mutation reuses its original key in its original bucket',
      () async {
        final keys = <String>[];
        final service = StaffService(api: unavailable(keys), environment: env);
        addTearDown(service.dispose);
        await expectLater(
          service.createStaff(input),
          throwsA(isA<ApiException>()),
        );
        expect(keys, [
          env == 'production'
              ? 'synthetic-production-original-key'
              : 'synthetic-staging-original-key',
        ]);
        expect(await storage.readAll(), hostedData());
      },
    );
  }
  for (final env in ['local', 'development']) {
    test('$env proof stays bound to its configured local issuer', () async {
      final own =
          '$invitationKey:${AppConfig.persistenceNamespace(environmentName: env)}';
      final other =
          '$invitationKey:${AppConfig.persistenceNamespace(environmentName: env, identityUrl: 'http://localhost:59998')}';
      expect(own, isNot(other));
      final initial = {...hostedData(), own: stagingProof, other: f.invitation};
      FlutterSecureStorage.setMockInitialValues(initial);
      final service = StaffService(api: unavailable([]), environment: env);
      addTearDown(service.dispose);
      await service.restorePendingInvitation();
      expect(service.pendingInvitation, stagingProof);
      await service.clearInvitation();
      expect(
        await storage.readAll(),
        Map<String, String>.from(initial)..remove(own),
      );
    });
    test('$env cannot restore or modify hosted invitation proof', () async {
      final service = StaffService(api: unavailable([]), environment: env);
      addTearDown(service.dispose);
      await service.restorePendingInvitation();
      expect(service.pendingInvitation, isNull);
      await service.rememberInvitation(f.invitation);
      final saved = await storage.readAll();
      for (final entry in hostedData().entries) {
        expect(
          saved[entry.key],
          entry.value,
          reason: 'Preserve existing hosted ${entry.key}',
        );
      }
      final own = saved.keys
          .where((key) => !hostedData().containsKey(key))
          .single;
      expect(
        own,
        contains(AppConfig.persistenceNamespace(environmentName: env)),
      );
      final restored = StaffService(api: unavailable([]), environment: env);
      addTearDown(restored.dispose);
      await restored.restorePendingInvitation();
      expect(restored.pendingInvitation, f.invitation);
      await restored.clearInvitation();
      expect(await storage.readAll(), hostedData());
    });
    test(
      '$env retries only its own persisted original command after restart',
      () async {
        final keys = <String>[], api = unavailable(keys);
        final first = StaffService(api: api, environment: env);
        addTearDown(first.dispose);
        await expectLater(
          first.createStaff(input),
          throwsA(isA<ApiException>()),
        );
        expect(keys, hasLength(1));
        expect(
          keys.single,
          isNot(
            anyOf(
              'synthetic-production-original-key',
              'synthetic-staging-original-key',
            ),
          ),
        );
        final saved = await storage.readAll();
        for (final entry in hostedData().entries)
          expect(saved[entry.key], entry.value);
        final own = saved.keys
            .where((key) => !hostedData().containsKey(key))
            .single;
        expect(
          own,
          contains(AppConfig.persistenceNamespace(environmentName: env)),
        );
        final restarted = StaffService(api: api, environment: env);
        addTearDown(restarted.dispose);
        await expectLater(
          restarted.createStaff(input),
          throwsA(isA<ApiException>()),
        );
        expect(keys, [keys.first, keys.first]);
        expect(await storage.readAll(), saved);
      },
    );
  }
}
