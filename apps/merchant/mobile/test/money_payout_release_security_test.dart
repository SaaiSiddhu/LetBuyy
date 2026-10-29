import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/money_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/two_factor_service.dart';

import 'support/loyalty_fixture.dart' show MemoryStorage;

class PayoutTransport extends ApiClient {
  PayoutTransport({required Object? Function() context})
    : super(
        baseUrl: 'https://gateway.test/v1',
        contextVersionProvider: context,
      );

  final List<ApiRequestOptions> releases = [];
  bool loseReply = false;
  bool wrongSite = false;

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (path == '/security/step-up/challenges') {
      return {
        'step_up_token': 'synthetic-step-up',
        'verified_at': '2026-10-30T00:00:00Z',
      };
    }
    if (path == '/payouts/payout-a/settle') {
      releases.add(options!);
      if (loseReply) {
        throw const ApiException(
          message: 'Synthetic lost reply',
          statusCode: 503,
          code: 'SYNTHETIC_REPLY_LOSS',
        );
      }
      return {
        'id': 'payout-a',
        'site_id': wrongSite ? 'store-b' : 'store-a',
        'status': 'released',
      };
    }
    if (path == '/payouts') {
      return {'payouts': <JsonMap>[], 'summary': <String, dynamic>{}};
    }
    if (path == '/wallet') return <String, dynamic>{};
    throw StateError('Unexpected request $path');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'payout release requires current payout step-up and retries with one key',
    () async {
      Object? context = 'session-a';
      final api = PayoutTransport(context: () => context);
      final storage = MemoryStorage();
      final security = TwoFactorService(
        api: api,
        actorIdProvider: () => 'merchant-a',
        storeIdProvider: () => 'store-a',
        storage: storage,
      );
      final money = MoneyService(
        api: api,
        securityCommands: SecurityCommandStore(storage: storage),
      );
      final wrongAction = await security.challenge(
        action: 'refund.approve',
        factorId: 'factor-a',
        code: '123456',
        idempotencyKey: 'challenge-refund',
        expectedContext: context,
      );
      await expectLater(
        money.settlePayout('payout-a', 'store-a', approval: wrongAction),
        throwsA(isA<ApiException>()),
      );
      expect(api.releases, isEmpty);

      final proof = await security.challenge(
        action: 'payout.release',
        factorId: 'factor-a',
        code: '123456',
        idempotencyKey: 'challenge-payout',
        expectedContext: context,
      );
      api.loseReply = true;
      await expectLater(
        money.settlePayout('payout-a', 'store-a', approval: proof),
        throwsA(isA<ApiException>()),
      );
      final first = api.releases.single;
      expect(first.headers!['X-Step-Up-Token'], 'synthetic-step-up');
      expect(first.headers!['X-Step-Up-Verified-At'], '2026-10-30T00:00:00Z');
      expect(first.idempotencyKey, isNotEmpty);
      expect(
        storage.data.values.any((value) => value.contains('synthetic-step-up')),
        isFalse,
      );

      api.wrongSite = true;
      api.loseReply = false;
      await expectLater(
        money.settlePayout('payout-a', 'store-a', approval: proof),
        throwsFormatException,
      );
      expect(api.releases.last.idempotencyKey, first.idempotencyKey);
      expect(storage.data, isNotEmpty);

      api.wrongSite = false;
      final result = await money.settlePayout(
        'payout-a',
        'store-a',
        approval: proof,
      );
      expect(result['status'], 'released');
      expect(api.releases.last.idempotencyKey, first.idempotencyKey);
      expect(storage.data, isEmpty);

      context = 'session-b';
      await expectLater(
        money.settlePayout('payout-a', 'store-a', approval: proof),
        throwsA(isA<ApiException>()),
      );
      expect(api.releases, hasLength(3));
      security.dispose();
      money.dispose();
      api.close();
    },
  );
}
