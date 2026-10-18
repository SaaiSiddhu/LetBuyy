// Controlled application/transport proof. Canonical ledger effects require owned
// Gateway/database/device evidence and are not asserted by these fixtures.
import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/two_factor_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'package:letbuyy_store/services/return_service.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage, siteA;

class FinancialTransport extends ApiClient {
  FinancialTransport({required Object? Function() context})
    : super(
        baseUrl: 'https://gateway.example.invalid/v1',
        contextVersionProvider: context,
        maxRetries: 0,
      );
  final calls = <({String path, ApiRequestOptions options})>[];
  bool loseReply = false, wrongOrder = false, unconfirmed = false;
  Completer<void>? hold, entered;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    calls.add((path: path, options: options!));
    if (path == '/security/step-up/challenges')
      return {
        'step_up_token': 'synthetic-approval',
        'verified_at': '2026-10-16T12:00:00Z',
      };
    if (path.endsWith('/refund/complete')) {
      entered?.complete();
      await hold?.future;
      if (loseReply)
        throw const ApiException(
          message: 'Synthetic committed reply loss',
          statusCode: 503,
          code: 'SYNTHETIC_REPLY_LOSS',
        );
      if (path.startsWith('/returns'))
        return {
          'id': 'return-a',
          'site_id': siteA,
          'order_id': 'order-a',
          'refund_id': 'refund-a',
          'refund_status': unconfirmed ? 'pending' : 'succeeded',
        };
      return {
        'order': {
          'id': wrongOrder ? 'wrong-order' : 'order-a',
          'store_id': siteA,
          'payment_status': 'refunded',
          'status': 'refunded',
          'total': 10,
        },
        'refund': {
          'id': 'refund-a',
          'status': unconfirmed ? 'pending' : 'succeeded',
        },
      };
    }
    if (path.endsWith('/refund'))
      return {
        'order': {
          'id': 'order-a',
          'store_id': siteA,
          'status': 'delivered',
          'payment_status': 'paid',
        },
        'return_id': 'return-a',
        'refund_id': 'refund-a',
        'amount': 10,
        'status': 'pending',
      };
    throw StateError('Unexpected controlled path $path');
  }
}

void main() {
  Future<MerchantStepUpProof> approval(
    FinancialTransport api,
    int epoch,
  ) async {
    final security = TwoFactorService(
      api: api,
      actorIdProvider: () => 'actor-a',
      storeIdProvider: () => siteA,
      storage: MemoryStorage(),
    );
    final proof = await security.challenge(
      action: 'refund.approve',
      factorId: 'factor-a',
      code: '123456',
      idempotencyKey: 'synthetic-challenge-key',
      expectedContext: epoch,
    );
    security.dispose();
    return proof;
  }

  test(
    'order completion reads the nested canonical order and keeps its original request across a service restart',
    () async {
      final api = FinancialTransport(context: () => 1)..loseReply = true,
          storage = MemoryStorage(),
          proof = await approval(api, 1);
      OrderService service() => OrderService(
        api: api,
        securityCommands: SecurityCommandStore(storage: storage),
      );
      await expectLater(
        service().completeRefund(
          'order-a',
          approval: proof,
          refundId: 'refund-a',
          providerRefundId: 'syn-refund',
        ),
        throwsA(isA<ApiException>()),
      );
      final original = api.calls.last.options;
      expect(original.headers!['X-Step-Up-Token'], 'synthetic-approval');
      expect(original.expectedContextVersion, 1);
      expect(
        storage.data.values.any(
          (value) => value.contains('synthetic-approval'),
        ),
        false,
      );
      expect(
        (await service().pendingRefundCompletion(
          'order-a',
          proof.context,
        ))!['provider_refund_id'],
        'syn-refund',
      );
      api.loseReply = false;
      final result = await service().completeRefund(
        'order-a',
        approval: proof,
        refundId: 'refund-a',
        providerRefundId: 'syn-refund',
      );
      expect(result.id, 'order-a');
      expect(result.paymentStatus, 'refunded');
      expect(api.calls.last.options.idempotencyKey, original.idempotencyKey);
      expect(api.calls.last.options.body, original.body);
      expect(storage.data, isEmpty);
      api.close();
    },
  );
  test(
    'an unresolved completion cannot be rebound to another source or provider reference',
    () async {
      final api = FinancialTransport(context: () => 1)..loseReply = true,
          storage = MemoryStorage(),
          proof = await approval(api, 1),
          service = OrderService(
            api: api,
            securityCommands: SecurityCommandStore(storage: storage),
          );
      await expectLater(
        service.completeRefund(
          'order-a',
          approval: proof,
          refundId: 'refund-a',
          providerRefundId: 'syn-original',
        ),
        throwsA(isA<ApiException>()),
      );
      final count = api.calls.length;
      await expectLater(
        service.completeRefund(
          'order-a',
          approval: proof,
          refundId: 'refund-a',
          providerRefundId: 'syn-changed',
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'PENDING_SECURITY_COMMAND',
          ),
        ),
      );
      expect(api.calls.length, count);
      api.close();
    },
  );
  test(
    'a proof captured under an old session cannot dispatch or persist a command',
    () async {
      var epoch = 1;
      final api = FinancialTransport(context: () => epoch),
          storage = MemoryStorage(),
          proof = await approval(api, 1),
          service = OrderService(
            api: api,
            securityCommands: SecurityCommandStore(storage: storage),
          );
      epoch++;
      expect(
        () => service.completeRefund(
          'order-a',
          approval: proof,
          refundId: 'refund-a',
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      expect(storage.data, isEmpty);
      expect(api.calls.length, 1);
      api.close();
    },
  );
  test(
    'late return completion under a replacement session does not populate its return list',
    () async {
      var epoch = 1;
      final api = FinancialTransport(context: () => epoch)
            ..entered = Completer<void>()
            ..hold = Completer<void>(),
          proof = await approval(api, 1),
          service = ReturnService(
            api: api,
            securityCommands: SecurityCommandStore(storage: MemoryStorage()),
          );
      final result = expectLater(
        service.completeRefund(
          'return-a',
          approval: proof,
          refundId: 'refund-a',
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      await api.entered!.future;
      epoch++;
      api.hold!.complete();
      await result;
      expect(service.returns, isEmpty);
      api.close();
    },
  );
  for (final kind in ['order', 'return'])
    test(
      '$kind incomplete financial acknowledgments retain the original request',
      () async {
        final api = FinancialTransport(context: () => 1)..unconfirmed = true,
            storage = MemoryStorage(),
            proof = await approval(api, 1);
        final result = kind == 'order'
            ? OrderService(
                api: api,
                securityCommands: SecurityCommandStore(storage: storage),
              ).completeRefund('order-a', approval: proof, refundId: 'refund-a')
            : ReturnService(
                api: api,
                securityCommands: SecurityCommandStore(storage: storage),
              ).completeRefund(
                'return-a',
                approval: proof,
                refundId: 'refund-a',
              );
        await expectLater(result, throwsFormatException);
        expect(storage.data, isNotEmpty);
        api.close();
      },
    );
  test(
    'partial intent uses selected canonical line quantities and consumes the nested source order',
    () async {
      final api = FinancialTransport(context: () => 1),
          proof = await approval(api, 1),
          service = OrderService(
            api: api,
            securityCommands: SecurityCommandStore(storage: MemoryStorage()),
          );
      final lines = [
        {'order_item_id': 'line-a', 'quantity': 1},
      ];
      final order = await service.refundOrder(
        'order-a',
        context: proof.context,
        lines: lines,
        reason: 'Synthetic partial return',
      );
      expect(order.id, 'order-a');
      expect(order.toJson()['refund_id'], 'refund-a');
      final body = asJsonMap(api.calls.last.options.body);
      expect(body['lines'], lines);
      expect(body.containsKey('amount'), false);
      expect(body.containsKey('amount_minor'), false);
      expect(body['idempotency_key'], api.calls.last.options.idempotencyKey);
      api.close();
    },
  );
  test(
    'nested refund quantities are captured before queued storage work',
    () async {
      final api = FinancialTransport(context: () => 1),
          proof = await approval(api, 1),
          service = OrderService(
            api: api,
            securityCommands: SecurityCommandStore(storage: MemoryStorage()),
          );
      final lines = <JsonMap>[
        {'order_item_id': 'line-a', 'quantity': 1},
      ];
      final request = service.refundOrder(
        'order-a',
        context: proof.context,
        lines: lines,
      );
      lines[0]['quantity'] = 2;
      await request;
      expect(asJsonMap(api.calls.last.options.body)['lines'], [
        {'order_item_id': 'line-a', 'quantity': 1},
      ]);
      api.close();
    },
  );
}
