// Controlled transport tests. These are not device, database or provider proof.
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/two_factor_service.dart';

import 'support/loyalty_fixture.dart' show MemoryStorage, siteA;

class FactorTransport extends ApiClient {
  FactorTransport({required Object? Function() context})
    : super(
        baseUrl: 'https://gateway.example.invalid/v1',
        contextVersionProvider: context,
        maxRetries: 0,
      );
  Completer<JsonMap>? heldOverview;
  bool failRead = false, failMutation = false, enrolled = true;
  final calls = <({String path, ApiRequestOptions? options})>[];
  Completer<void>? mutationEntered, holdMutation;
  String get seed => 'SYNTHETICSEEDFORTESTONLY';
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async => PaginatedResponse(
    data: [
      {'id': siteA, 'name': 'Synthetic A', 'subdomain': 'synthetic-a'},
    ],
    page: 1,
    limit: 50,
    total: 1,
    hasMore: false,
  );
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    calls.add((path: path, options: options));
    if (path == '/2fa') {
      if (heldOverview != null) return heldOverview!.future;
      if (failRead)
        throw const ApiException(
          message: 'Synthetic status outage',
          statusCode: 503,
          code: 'SYNTHETIC_READ_OUTAGE',
        );
      return {
        'custom_user_id': 'actor-a',
        'mfa_enabled': enrolled,
        'factors': [
          if (enrolled)
            {'id': 'factor-a', 'status': 'active', 'factor_type': 'totp'},
        ],
        'sessions': [],
      };
    }
    mutationEntered?.complete();
    await holdMutation?.future;
    if (failMutation)
      throw const ApiException(
        message: 'Synthetic committed reply loss',
        statusCode: 503,
        code: 'SYNTHETIC_REPLY_LOSS',
      );
    if (path == '/2fa/totp/enroll')
      return {
        'factor': {
          'id': 'factor-a',
          'status': 'pending',
          'factor_type': 'totp',
        },
        'secret': seed,
      };
    if (path == '/security/step-up/challenges')
      return {
        'step_up_token': 'synthetic-approval',
        'verified_at': '2026-10-16T12:00:00Z',
      };
    if (path == '/2fa/disable')
      return {
        'factor': {
          'id': 'factor-a',
          'status': 'disabled',
          'factor_type': 'totp',
        },
      };
    if (path == '/2fa/totp/verify')
      return {
        'factor': {'id': 'factor-a', 'status': 'active', 'factor_type': 'totp'},
        'recovery_codes': ['synthetic-code-a', 'synthetic-code-b'],
      };
    throw StateError('Unexpected controlled path $path');
  }
}

void main() {
  recoveryChecks();
  test(
    'an overview completing after the account epoch changes cannot populate the new session',
    () async {
      var epoch = 1;
      final api = FactorTransport(context: () => epoch)
            ..heldOverview = Completer<JsonMap>(),
          service = TwoFactorService(
            api: api,
            actorIdProvider: () => 'actor-a',
            storeIdProvider: () => siteA,
            storage: MemoryStorage(),
          );
      final pending = service.fetchOverview();
      epoch++;
      api.heldOverview!.complete({
        'custom_user_id': 'actor-a',
        'mfa_enabled': true,
        'factors': [],
        'sessions': [],
      });
      await expectLater(
        pending,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      expect(service.overview, isNull);
      service.dispose();
      api.close();
    },
  );
  test(
    'activation result is not lost when a later overview read is unavailable',
    () async {
      final api = FactorTransport(context: () => 1)..failRead = true,
          service = TwoFactorService(
            api: api,
            actorIdProvider: () => 'actor-a',
            storeIdProvider: () => siteA,
            storage: MemoryStorage(),
          );
      final result = await service.verifyTotp(
        factorId: 'factor-a',
        code: '123456',
      );
      expect(result['recovery_codes'], [
        'synthetic-code-a',
        'synthetic-code-b',
      ]);
      service.dispose();
      api.close();
    },
  );
}

// Additional state/retry checks are kept in one group so the main reproductions
// above remain readable. Flutter invokes this helper from main below.
void recoveryChecks() {
  test(
    'uncertain activation preserves its original key across restart and stores no credential material',
    () async {
      final api = FactorTransport(context: () => 1)..failMutation = true,
          storage = MemoryStorage();
      TwoFactorService make() => TwoFactorService(
        api: api,
        actorIdProvider: () => 'actor-a',
        storeIdProvider: () => siteA,
        storage: storage,
      );
      await expectLater(
        make().verifyTotp(factorId: 'factor-a', code: '123456'),
        throwsA(isA<ApiException>()),
      );
      final original = api.calls.last.options!.idempotencyKey;
      expect(
        storage.data.values.any(
          (value) =>
              value.contains('123456') ||
              value.contains('synthetic-code') ||
              value.contains('synthetic-approval'),
        ),
        false,
      );
      api.failMutation = false;
      final restarted = make(), overview = await restarted.fetchOverview();
      expect(overview['pending_activation_factor_id'], 'factor-a');
      final result = await restarted.verifyTotp(
        factorId: 'factor-a',
        code: '654321',
      );
      expect(result['recovery_codes'], isNotEmpty);
      expect(api.calls.last.options!.idempotencyKey, original);
      await restarted.acknowledgeRecovery('factor-a', expectedContext: 1);
      expect(storage.data, isEmpty);
      restarted.dispose();
      api.close();
    },
  );
  test(
    'an account switch during encrypted command storage cannot dispatch under the replacement context',
    () async {
      var epoch = 1;
      final api = FactorTransport(context: () => epoch),
          storage = MemoryStorage()
            ..holdWrite = Completer<void>()
            ..writeEntered = Completer<void>(),
          service = TwoFactorService(
            api: api,
            actorIdProvider: () => 'actor-a',
            storeIdProvider: () => siteA,
            storage: storage,
          );
      final pending = expectLater(
        service.enrollTotp(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      await storage.writeEntered!.future;
      epoch++;
      storage.holdWrite!.complete();
      await pending;
      expect(api.calls, isEmpty);
      expect(storage.data.keys.single, contains('actor-a:$siteA'));
      service.dispose();
      api.close();
    },
  );
  test(
    'two queued activation retries share one logical request and source intent',
    () async {
      final api = FactorTransport(context: () => 1),
          storage = MemoryStorage(),
          service = TwoFactorService(
            api: api,
            actorIdProvider: () => 'actor-a',
            storeIdProvider: () => siteA,
            storage: storage,
          );
      await Future.wait([
        service.verifyTotp(factorId: 'factor-a', code: '123456'),
        service.verifyTotp(factorId: 'factor-a', code: '654321'),
      ]);
      expect(api.calls.length, 2);
      expect(
        api.calls[0].options!.idempotencyKey,
        api.calls[1].options!.idempotencyKey,
      );
      expect(api.calls[0].options!.expectedContextVersion, 1);
      service.dispose();
      api.close();
    },
  );
  test(
    'a completed challenge returning after disposal cannot expose its approval',
    () async {
      final api = FactorTransport(context: () => 1)
            ..mutationEntered = Completer<void>()
            ..holdMutation = Completer<void>(),
          service = TwoFactorService(
            api: api,
            actorIdProvider: () => 'actor-a',
            storeIdProvider: () => siteA,
            storage: MemoryStorage(),
          );
      final pending = expectLater(
        service.challenge(
          action: 'refund.approve',
          factorId: 'factor-a',
          code: '123456',
          idempotencyKey: 'synthetic-challenge-key',
          expectedContext: 1,
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      await api.mutationEntered!.future;
      service.dispose();
      api.holdMutation!.complete();
      await pending;
      api.close();
    },
  );
}
