import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/loyalty_service.dart';

import 'support/loyalty_fixture.dart';

void main() {
  test('ambiguous saves survive a service restart with exact intent, timestamp and key', () async {
    final storage = MemoryStorage(),
        api = LoyaltyTransport(context: () => 1)..writeFailure = unavailable;
    LoyaltyService service() => LoyaltyService(
      api: api,
      actorIdProvider: () => 'actor-a',
      storeIdProvider: () => siteA,
      storage: storage,
    );
    await expectLater(
      service().save(siteA, form(), expectedContext: 1),
      throwsA(isA<ApiException>()),
    );
    final loaded = await service().load(siteA);
    expect(loaded.pending, isNotNull);
    expect(loaded.pending!.intent['expected_updated_at'], initialVersion);
    api.writeFailure = null;
    await service().save(siteA, form(value: '999'), expectedContext: 1);
    expect(api.writes[1].body, api.writes[0].body);
    expect(api.writes[1].idempotencyKey, api.writes[0].idempotencyKey);
    expect(storage.data, isEmpty);
    await service().save(siteA, form(value: '200'), expectedContext: 1);
    expect(
      api.writes.last.idempotencyKey,
      isNot(api.writes.first.idempotencyKey),
    );
    api.close();
  });
  test('pending commands remain scoped to their actor and store', () async {
    var actor = 'actor-a', store = siteA, epoch = 1;
    final storage = MemoryStorage(),
        api = LoyaltyTransport(context: () => epoch)
          ..writeFailure = unavailable;
    final service = LoyaltyService(
      api: api,
      actorIdProvider: () => actor,
      storeIdProvider: () => store,
      storage: storage,
    );
    await expectLater(
      service.save(siteA, form(), expectedContext: epoch),
      throwsA(isA<ApiException>()),
    );
    final aKey = api.writes.single.idempotencyKey;
    actor = 'actor-b';
    store = siteB;
    epoch++;
    expect((await service.load(siteB)).pending, isNull);
    api.writeFailure = null;
    await service.save(siteB, form(value: '200'), expectedContext: epoch);
    expect(api.writes.last.idempotencyKey, isNot(aKey));
    actor = 'actor-a';
    store = siteA;
    epoch++;
    expect((await service.load(siteA)).pending!.key, aKey);
    api.close();
  });
  test('context captured before encrypted storage and queued work cannot dispatch under a replacement account', () async {
    var actor = 'actor-a', store = siteA, epoch = 1;
    final storage = MemoryStorage()
      ..holdWrite = Completer<void>()
      ..writeEntered = Completer<void>();
    final api = LoyaltyTransport(context: () => epoch),
        service = LoyaltyService(
          api: api,
          actorIdProvider: () => actor,
          storeIdProvider: () => store,
          storage: storage,
        );
    final first = expectLater(
      service.save(siteA, form(), expectedContext: 1),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          'SESSION_CONTEXT_CHANGED',
        ),
      ),
    );
    await storage.writeEntered!.future;
    final queued = expectLater(
      service.save(siteA, form(value: '200'), expectedContext: 1),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          'SESSION_CONTEXT_CHANGED',
        ),
      ),
    );
    actor = 'actor-b';
    store = siteB;
    epoch++;
    storage.holdWrite!.complete();
    await first;
    await queued;
    expect(api.writes, isEmpty);
    expect(storage.data.keys.single, contains('actor-a:$siteA'));
    api.close();
  });
  test('failed storage or invalid new intents cannot dispatch or persist an unsafe command', () async {
    final storage = MemoryStorage()..failWrite = true,
        api = LoyaltyTransport(context: () => 1);
    final service = LoyaltyService(
      api: api,
      actorIdProvider: () => 'actor-a',
      storeIdProvider: () => siteA,
      storage: storage,
    );
    await expectLater(
      service.save(siteA, form(), expectedContext: 1),
      throwsStateError,
    );
    expect(api.writes, isEmpty);
    storage.failWrite = false;
    await expectLater(
      service.save(siteA, {
        ...form(),
        'point_value_minor': 100,
      }, expectedContext: 1),
      throwsFormatException,
    );
    await expectLater(
      service.save(siteA, {
        ...form(),
        'expected_updated_at': '2026-10-16',
      }, expectedContext: 1),
      throwsFormatException,
    );
    expect(api.writes, isEmpty);
    expect(storage.data, isEmpty);
    api.close();
  });
  test('discard requires a successful current read and recovers corrupt pending storage explicitly', () async {
    final storage = MemoryStorage(),
        api = LoyaltyTransport(context: () => 1)..readFailure = unavailable;
    storage.data['letbuyy.loyalty.pending.v1:actor-a:$siteA'] = 'corrupt';
    final service = LoyaltyService(
      api: api,
      actorIdProvider: () => 'actor-a',
      storeIdProvider: () => siteA,
      storage: storage,
    );
    await expectLater(
      service.load(siteA, discardPending: true),
      throwsA(isA<ApiException>()),
    );
    expect(storage.data, isNotEmpty);
    api.readFailure = null;
    await expectLater(service.load(siteA), throwsFormatException);
    expect((await service.load(siteA, discardPending: true)).pending, isNull);
    expect(storage.data, isEmpty);
    api.close();
  });
  test('definite conflicts clear a request while denials and invalid acknowledgments preserve it', () async {
    for (final failure in [
      const ApiException(
        message: 'conflict',
        statusCode: 409,
        code: 'VERSION_CONFLICT',
      ),
      const ApiException(message: 'denied', statusCode: 403, code: 'FORBIDDEN'),
      null,
    ]) {
      final storage = MemoryStorage(),
          api = LoyaltyTransport(context: () => 1)
            ..writeFailure = failure
            ..malformedReply = failure == null;
      final service = LoyaltyService(
        api: api,
        actorIdProvider: () => 'actor-a',
        storeIdProvider: () => siteA,
        storage: storage,
      );
      await expectLater(
        service.save(siteA, form(), expectedContext: 1),
        throwsA(isA<ApiException>()),
      );
      expect(storage.data.isEmpty, failure?.statusCode == 409);
      api.close();
    }
  });
  test(
    'a completed request cannot remove a replacement pending command',
    () async {
      final storage = MemoryStorage(),
          api = LoyaltyTransport(context: () => 1)
            ..holdSave = Completer<void>()
            ..saveEntered = Completer<void>();
      final service = LoyaltyService(
        api: api,
        actorIdProvider: () => 'actor-a',
        storeIdProvider: () => siteA,
        storage: storage,
      );
      final result = service.save(siteA, form(), expectedContext: 1);
      await api.saveEntered!.future;
      final key = storage.data.keys.single;
      final replacement = jsonDecode(storage.data[key]!) as Map;
      replacement['key'] = 'replacement-request-key';
      storage.data[key] = jsonEncode(replacement);
      api.holdSave!.complete();
      await result;
      expect(jsonDecode(storage.data[key]!)['key'], 'replacement-request-key');
      api.close();
    },
  );
  test(
    'percent and money helpers retain precision and reject unsupported input',
    () {
      expect(loyaltyPercentageToBps('12.34'), 1234);
      expect(loyaltyPercentageToBps('100.00'), 10000);
      for (final value in ['1e2', '-1', '100.01', '0.001', ' 1', 'NaN'])
        expect(loyaltyPercentageToBps(value), isNull);
      expect(
        loyaltyPaiseLabel(BigInt.parse('9007199254740993')),
        '₹9,00,71,99,25,47,409.93',
      );
      expect(loyaltyPaiseLabel(BigInt.from(-6150)), '-₹61.50');
      expect(validLoyaltyPointValue('9223372036854775808'), false);
    },
  );
}
