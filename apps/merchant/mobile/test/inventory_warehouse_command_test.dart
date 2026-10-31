import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;
import 'support/warehouse_fixture.dart';

class Harness {
  Harness() {
    api = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      dio: dio,
      maxRetries: 0,
      contextVersionProvider: () => version,
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (r, h) async {
          if (r.path.endsWith('/command-capabilities')) {
            capabilityReads++;
            final status = deny ? 403 : capabilityStatus;
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: status,
                data: status == 200
                    ? {
                        'data':
                            capabilityOverride ??
                            warehouseCapabilities(actor: actor, site: site),
                      }
                    : {
                        'error': {
                          'code': status == 404 ? 'NOT_FOUND' : 'FORBIDDEN',
                          'message': 'Synthetic capability refusal',
                        },
                      },
              ),
            );
            return;
          }
          final body = Map<String, dynamic>.from(r.data as Map),
              key = body['idempotency_key'] as String;
          requests.add(r);
          bodies.add(jsonDecode(jsonEncode(body)) as JsonMap);
          entered?.complete();
          entered = null;
          final hold = holdResponse;
          holdResponse = null;
          if (hold != null) await hold.future;
          if (deny) {
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 403,
                data: {
                  'error': {'code': 'FORBIDDEN', 'message': 'Denied'},
                },
              ),
            );
            return;
          }
          if (failBefore) {
            failBefore = false;
            h.reject(
              DioException(
                requestOptions: r,
                type: DioExceptionType.connectionError,
              ),
            );
            return;
          }
          final stop = r.path.endsWith('/commands/stop');
          var ack = receipts[key];
          if (ack == null) {
            final op = stop
                ? body['operation'] as String
                : r.path.endsWith('/purchase-orders')
                ? 'purchase_order.create'
                : r.path.contains('/purchase-orders/')
                ? 'purchase_order.receive'
                : r.path.endsWith('/transfers')
                ? 'transfer.create'
                : r.path.endsWith('/ship')
                ? 'transfer.ship'
                : 'transfer.receive';
            final normalized = stop
                ? WarehouseCommandIntent.fromJson({
                    'operation': op,
                    'target_id': body['target_id'],
                    'command': body['command'],
                  })
                : op == 'purchase_order.create'
                ? WarehouseCommandIntent.fromJson({
                    'operation': op,
                    'target_id': null,
                    'command': {
                      'location_id': body['location_id'],
                      'supplier_id': body['supplier_id'],
                      'expected_at': body['expected_at'],
                      'notes': body['notes'],
                      'lines': body['lines'],
                    },
                  })
                : op == 'transfer.create'
                ? WarehouseCommandIntent.fromJson({
                    'operation': op,
                    'target_id': null,
                    'command': {
                      'source_location_id': body['source_location_id'],
                      'destination_location_id':
                          body['destination_location_id'],
                      'notes': body['notes'],
                      'lines': body['lines'],
                    },
                  })
                : WarehouseCommandIntent.fromJson({
                    'operation': op,
                    'target_id': warehouseTarget,
                    'command': op == 'transfer.ship'
                        ? <String, dynamic>{}
                        : {'lines': body['lines']},
                  });
            if (!stop) effects++;
            final received = op.endsWith('.receive')
                ? (normalized.command['lines'] as List).fold<int>(
                    0,
                    (n, l) => n + (l['quantity'] as int),
                  )
                : 0;
            ack = warehouseAck(
              normalized,
              key,
              applied: !stop,
              received: received,
              shipped: op.startsWith('transfer.') && op != 'transfer.create'
                  ? 4
                  : 0,
            );
            receipts[key] = ack;
          }
          if (!stop &&
              (ack['command_receipt'] as Map)['outcome'] == 'cancelled') {
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 409,
                data: {
                  'error': {
                    'code': 'WAREHOUSE_REQUEST_STOPPED',
                    'message': 'Stopped',
                  },
                },
              ),
            );
            return;
          }
          if (failAfter) {
            failAfter = false;
            h.reject(
              DioException(
                requestOptions: r,
                type: DioExceptionType.connectionError,
              ),
            );
            return;
          }
          final response = jsonDecode(jsonEncode(ack)) as JsonMap;
          corrupt?.call(response);
          h.resolve(
            Response(
              requestOptions: r,
              statusCode: 200,
              data: {'data': response},
            ),
          );
        },
      ),
    );
    addTearDown(api.close);
  }
  final dio = Dio(), storage = MemoryStorage();
  late final ApiClient api;
  String actor = warehouseActor, site = warehouseSite;
  Object version = 'session-A';
  int effects = 0;
  int capabilityReads = 0, capabilityStatus = 200;
  JsonMap? capabilityOverride;
  bool failBefore = false, failAfter = false, deny = false;
  Completer<void>? holdResponse, entered;
  void Function(JsonMap)? corrupt;
  final requests = <RequestOptions>[],
      bodies = <JsonMap>[],
      receipts = <String, JsonMap>{};
  InventoryService service() => InventoryService(
    api: api,
    actorIdProvider: () => actor,
    storeIdProvider: () => site,
    commands: SecurityCommandStore(storage: storage),
  );
}

void main() {
  test(
    'restart after a lost committed reply retries the frozen request with one effect',
    () async {
      final h = Harness()..failAfter = true, first = h.service();
      await expectLater(
        first.createPurchaseOrder(warehousePo()),
        throwsA(isA<ApiException>()),
      );
      final restarted = h.service(),
          saved = await restarted.pendingWarehouseCommand(warehouseSite);
      expect(saved!.key, 'original-po-create');
      expect(
        saved.intent,
        WarehouseCommandIntent.purchaseOrder(warehousePo()).toJson(),
      );
      await expectLater(
        restarted.createPurchaseOrder(
          warehousePo(quantity: 5, key: 'new-tap-key'),
        ),
        throwsA(isA<ApiException>()),
      );
      final ack = await restarted.retryWarehouseCommand(warehouseSite);
      expect(ack.applied, isTrue);
      expect(h.effects, 1);
      expect(h.bodies.length, 2);
      expect(h.bodies[0], h.bodies[1]);
      expect(
        h.requests.every(
          (r) => r.headers['X-LetBuyy-Warehouse-Protocol'] == '1',
        ),
        isTrue,
      );
      expect(
        h.requests.every(
          (r) => r.headers['X-Idempotency-Key'] == 'original-po-create',
        ),
        isTrue,
      );
      expect(
        h.requests.every((r) => r.headers['X-Store-ID'] == warehouseSite),
        isTrue,
      );
      expect(await restarted.pendingWarehouseCommand(warehouseSite), isNull);
      expect(
        restarted.purchaseOrders,
        isEmpty,
        reason: 'Historical acknowledgements do not repopulate current reads',
      );
    },
  );
  test(
    'same-intent concurrent taps share one in-flight key and response',
    () async {
      final h = Harness(), s = h.service(), hold = Completer<void>();
      h.holdResponse = hold;
      h.entered = Completer<void>();
      final entered = h.entered!.future;
      final first = s.createPurchaseOrder(warehousePo());
      await entered;
      final second = s.createPurchaseOrder(warehousePo(key: 'second-tap-key'));
      expect(
        () => s.submitWarehouseCommand(
          warehouseSite,
          WarehouseCommandIntent.purchaseOrder(warehousePo(quantity: 5)),
        ),
        throwsA(isA<ApiException>()),
      );
      hold.complete();
      final results = await Future.wait([first, second]);
      expect(results[0].id, results[1].id);
      expect(h.effects, 1);
      expect(h.requests.length, 1);
    },
  );
  test(
    'stop before apply confirms cancellation and clears only the matching journal',
    () async {
      final h = Harness()..failBefore = true, s = h.service();
      await expectLater(
        s.createPurchaseOrder(warehousePo()),
        throwsA(isA<ApiException>()),
      );
      final ack = await s.stopWarehouseCommand(warehouseSite);
      expect(ack.applied, isFalse);
      expect(h.effects, 0);
      expect(h.requests.last.path, endsWith('/commands/stop'));
      expect(await s.pendingWarehouseCommand(warehouseSite), isNull);
      expect(
        h.bodies.last['command'],
        WarehouseCommandIntent.purchaseOrder(warehousePo()).command,
      );
    },
  );
  test(
    'stop after apply recovers the applied outcome without claiming to reverse it',
    () async {
      final h = Harness()..failAfter = true, s = h.service();
      await expectLater(
        s.createTransfer(warehouseTransfer()),
        throwsA(isA<ApiException>()),
      );
      final ack = await s.stopWarehouseCommand(warehouseSite);
      expect(ack.applied, isTrue);
      expect(ack.transfer!.id, warehouseTarget);
      expect(h.effects, 1);
      expect(await s.pendingWarehouseCommand(warehouseSite), isNull);
    },
  );
  test(
    'a previously stopped apply recovers the authoritative cancellation',
    () async {
      final h = Harness()..failBefore = true, s = h.service();
      await expectLater(
        s.createPurchaseOrder(warehousePo()),
        throwsA(isA<ApiException>()),
      );
      h.receipts['original-po-create'] = warehouseAck(
        WarehouseCommandIntent.purchaseOrder(warehousePo()),
        'original-po-create',
        applied: false,
      );
      final ack = await s.retryWarehouseCommand(warehouseSite);
      expect(ack.applied, isFalse);
      expect(await s.pendingWarehouseCommand(warehouseSite), isNull);
      expect(h.requests.last.path, endsWith('/commands/stop'));
      expect(h.effects, 0);
    },
  );
  for (final fault in [
    'actor',
    'site',
    'key',
    'intent',
    'target',
    'state',
    'quantity',
    'missing-receipt',
  ]) {
    test(
      'unconfirmed $fault acknowledgement retains the original encrypted intent',
      () async {
        final h = Harness(), s = h.service();
        h.corrupt = (ack) {
          final receipt = ack['command_receipt'] as Map;
          switch (fault) {
            case 'actor':
              receipt['actor_id'] = warehouseDestination;
            case 'site':
              receipt['site_id'] = warehouseDestination;
            case 'key':
              receipt['key'] = 'different-receipt-key';
            case 'intent':
              (receipt['command'] as Map)['notes'] = 'Changed intent';
            case 'target':
              receipt['target_id'] = warehouseDestination;
            case 'state':
              (ack['purchase_order'] as Map)['status'] = 'invented';
            case 'quantity':
              (ack['lines'] as List).single['quantity_received'] = 100;
            case 'missing-receipt':
              ack.remove('command_receipt');
          }
        };
        await expectLater(
          s.createPurchaseOrder(warehousePo()),
          throwsA(anything),
        );
        expect(
          (await s.pendingWarehouseCommand(warehouseSite))!.key,
          'original-po-create',
        );
        h.corrupt = null;
        expect((await s.retryWarehouseCommand(warehouseSite)).applied, isTrue);
        expect(h.effects, 1);
      },
    );
  }
  test(
    'secure storage failure sends no request and never falls back to memory',
    () async {
      final h = Harness()..storage.failWrite = true, s = h.service();
      await expectLater(
        s.createPurchaseOrder(warehousePo()),
        throwsA(anything),
      );
      expect(h.requests, isEmpty);
    },
  );
  test(
    'a late response after account/store/session changes cannot clear the original request',
    () async {
      final h = Harness(), s = h.service(), hold = Completer<void>();
      h.holdResponse = hold;
      h.entered = Completer<void>();
      final entered = h.entered!.future;
      final outcome = expectLater(
        s.createPurchaseOrder(warehousePo()),
        throwsA(isA<ApiException>()),
      );
      await entered;
      h.actor = warehouseDestination;
      h.site = warehouseDestination;
      h.version = 'session-B';
      hold.complete();
      await outcome;
      expect(
        await h.service().pendingWarehouseCommand(warehouseDestination),
        isNull,
      );
      h.actor = warehouseActor;
      h.site = warehouseSite;
      h.version = 'session-A-restored';
      expect(
        (await s.pendingWarehouseCommand(warehouseSite))!.key,
        'original-po-create',
      );
      expect((await s.retryWarehouseCommand(warehouseSite)).applied, isTrue);
      expect(h.effects, 1);
    },
  );
  test(
    'PO and transfer lifecycle commands carry explicit scoped partial receipt lines',
    () async {
      final h = Harness(), s = h.service();
      final po = await s.createPurchaseOrder(warehousePo());
      final partial = await s.receivePurchaseOrder(
        po,
        idempotencyKey: 'po-partial-receive',
        quantities: {warehouseLine: 2},
      );
      expect(partial.remainingQuantity, 2);
      expect(h.bodies.last['lines'], [
        {'purchase_order_line_id': warehouseLine, 'quantity': 2},
      ]);
      final transfer = await s.createTransfer(warehouseTransfer());
      final shipped = await s.shipTransfer(
        transfer,
        idempotencyKey: 'transfer-ship-original',
      );
      expect(shipped.lines.single.shippedQuantity, 4);
      final received = await s.receiveTransfer(
        shipped,
        idempotencyKey: 'transfer-receive-original',
      );
      expect(received.remainingQuantity, 0);
      expect(h.effects, 5);
      expect(await s.pendingWarehouseCommand(warehouseSite), isNull);
    },
  );
  test(
    'revoked owner denial retains the request for authorized resolution',
    () async {
      final h = Harness()..failAfter = true, s = h.service();
      await expectLater(
        s.createPurchaseOrder(warehousePo()),
        throwsA(isA<ApiException>()),
      );
      h.deny = true;
      await expectLater(
        s.stopWarehouseCommand(warehouseSite),
        throwsA(isA<ApiException>()),
      );
      expect(
        (await s.pendingWarehouseCommand(warehouseSite))!.key,
        'original-po-create',
      );
      expect(h.effects, 1);
    },
  );
  test(
    'older or mismatched server capability blocks before prepare and dispatch',
    () async {
      for (final fault in [
        'missing',
        'actor',
        'site',
        'version',
        'policy',
        'stop',
      ]) {
        final h = Harness(), s = h.service();
        if (fault == 'missing')
          h.capabilityStatus = 404;
        else {
          h.capabilityOverride = warehouseCapabilities();
          switch (fault) {
            case 'actor':
              h.capabilityOverride!['actor_id'] = warehouseDestination;
            case 'site':
              h.capabilityOverride!['store_id'] = warehouseDestination;
            case 'version':
              h.capabilityOverride!['protocol_version'] = '0';
            case 'policy':
              h.capabilityOverride!['effect_policy'] = 'legacy';
            case 'stop':
              h.capabilityOverride!['stop_supported'] = false;
          }
        }
        await expectLater(
          s.createPurchaseOrder(warehousePo()),
          throwsA(isA<ApiException>()),
        );
        expect(h.requests, isEmpty, reason: fault);
        expect(h.storage.data, isEmpty, reason: fault);
        expect(h.effects, 0);
      }
    },
  );
  test(
    'an existing pending request survives an unavailable server preflight',
    () async {
      final h = Harness()..failAfter = true, s = h.service();
      await expectLater(
        s.createPurchaseOrder(warehousePo()),
        throwsA(isA<ApiException>()),
      );
      h.capabilityStatus = 404;
      await expectLater(
        s.retryWarehouseCommand(warehouseSite),
        throwsA(isA<ApiException>()),
      );
      await expectLater(
        s.stopWarehouseCommand(warehouseSite),
        throwsA(isA<ApiException>()),
      );
      expect(h.requests.length, 1);
      expect(
        (await s.pendingWarehouseCommand(warehouseSite))!.key,
        'original-po-create',
      );
      h.capabilityStatus = 200;
      expect((await s.retryWarehouseCommand(warehouseSite)).applied, isTrue);
      expect(h.effects, 1);
    },
  );
}
