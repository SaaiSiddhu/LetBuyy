// Client recovery with explicit synthetic responses. SQL/provider acceptance is
// deliberately owned by the separate PostgreSQL/browser/device cohorts.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/collection_metadata_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

JsonMap fixture() => jsonDecode(
  File(
    '../../../tests/fixtures/collection-metadata-contracts.json',
  ).readAsStringSync(),
);

class Transport extends ApiClient {
  Transport(this.f)
    : super(baseUrl: 'https://gateway.synthetic.invalid/v1', maxRetries: 0);
  final JsonMap f;
  final writes = <ApiRequestOptions>[], receipts = <String, JsonMap>{};
  int effects = 0;
  bool lose = false, mismatch = false, deny = false, reject = false;
  ApiException? failure;
  Completer<void>? entered, release;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (options?.method == null || options?.method == HttpMethod.get)
      return {...asJsonMap(f['smart']), 'version': 7};
    writes.add(options!);
    entered?.complete();
    if (release != null) await release!.future;
    if (failure != null) throw failure!;
    if (deny)
      throw const ApiException(
        message: 'Synthetic access revoked',
        statusCode: 403,
        code: 'FORBIDDEN',
      );
    if (reject)
      throw const ApiException(
        message: 'Synthetic newer collection',
        statusCode: 409,
        code: 'COLLECTION_VERSION_CONFLICT',
      );
    final body = asJsonMap(options.body), key = options.idempotencyKey!;
    final payload = {
      'collection_type': 'smart',
      for (final e in body.entries)
        if (!const ['store_id', 'version'].contains(e.key))
          e.key == 'name' ? 'title' : e.key: e.value,
    };
    final receipt = receipts.putIfAbsent(key, () {
      effects++;
      return {
        ...asJsonMap(f['row']),
        ...payload,
        'version': (body['version'] as num? ?? 0) + 1,
        'actor_id': f['actor'],
        'idempotency_key': key,
        'operation': options.method == HttpMethod.post
            ? 'create'
            : options.method == HttpMethod.delete
            ? 'delete'
            : 'update',
        'expected_version': body['version'],
        'request': payload,
        if (options.method == HttpMethod.delete) ...{
          'is_active': false,
          'deleted_at': '2026-11-03T00:00:00Z',
        },
      };
    });
    if (lose) {
      lose = false;
      throw const ApiException(
        message: 'Synthetic committed reply loss',
        statusCode: 503,
        code: 'SYN_REPLY_LOST',
      );
    }
    return {...receipt, if (mismatch) 'actor_id': f['command']['store_id']};
  }
}

void main() {
  test(
    'smart create and delete require current versions and explicit visibility with confirmed receipts',
    () async {
      final f = fixture(),
          api = Transport(f),
          commands = SecurityCommandStore(storage: MemoryStorage());
      final service = CollectionMetadataService(
        api: api,
        actorIdProvider: () => f['actor'],
        storeIdProvider: () => f['command']['store_id'],
        commands: commands,
      );
      final created = await service.save(f['command']['store_id'], 'create', {
        'collection_type': 'smart',
        'title': 'Synthetic created collection',
        'slug': 'synthetic-created',
        'conditions': [],
        'match_type': 'all',
        'is_active': false,
      });
      expect(created.collection.version, 1);
      expect(created.collection.published, false);
      final removed = await service.save(f['command']['store_id'], 'delete', {
        'collection_type': 'smart',
        'version': 1,
      }, id: created.collection.id);
      expect(removed.collection.version, 2);
      expect(removed.collection.isDeleted, true);
      expect(api.effects, 2);
      expect(
        (api.writes.first.body as Map)['name'],
        'Synthetic created collection',
      );
      expect(api.writes.last.body, {'version': 1});
      expect(await service.pending(f['command']['store_id']), isNull);
    },
  );

  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'a canonical missing-target rejection stays recoverable without trapping future collection work',
    () async {
      final f = fixture(),
          api = Transport(f)
            ..failure = const ApiException(
              message: 'The collection is no longer available.',
              statusCode: 404,
              code: 'COLLECTION_NOT_FOUND',
            ),
          commands = SecurityCommandStore(storage: MemoryStorage());
      final service = CollectionMetadataService(
        api: api,
        actorIdProvider: () => f['actor'],
        storeIdProvider: () => f['command']['store_id'],
        commands: commands,
      );
      await expectLater(
        service.save(f['command']['store_id'], 'update', {
          'collection_type': 'smart',
          'version': 7,
          'description': 'Synthetic deleted-target draft',
        }, id: f['row']['id']),
        throwsA(isA<ApiException>()),
      );
      expect(
        (await service.pending(f['command']['store_id']))!.intent['outcome'],
        'missing',
      );
      expect(api.effects, 0);
      final original = api.writes.single;
      // A replacement service reads the retained encrypted request; explicit
      // discard reconciles the exact same command before releasing the slot.
      final restarted = CollectionMetadataService(
        api: api,
        actorIdProvider: () => f['actor'],
        storeIdProvider: () => f['command']['store_id'],
        commands: commands,
      );
      expect(await restarted.discardMissing(f['command']['store_id']), isNull);
      expect(await restarted.pending(f['command']['store_id']), isNull);
      expect(api.writes.last.body, original.body);
      expect(api.writes.last.idempotencyKey, original.idempotencyKey);
      expect(api.effects, 0);
      api.failure = null;
      await restarted.save(f['command']['store_id'], 'update', {
        'collection_type': 'smart',
        'version': 7,
        'description': 'Synthetic subsequent draft',
      }, id: f['row']['id']);
      expect(api.effects, 1);
    },
  );
  for (final failure in [
    const ApiException(
      message: 'Synthetic route missing',
      statusCode: 404,
      code: 'NOT_FOUND',
    ),
    const ApiException(
      message: 'Synthetic outage',
      statusCode: 503,
      code: 'UNAVAILABLE',
    ),
    const ApiException(
      message: 'Synthetic revocation',
      statusCode: 403,
      code: 'FORBIDDEN',
    ),
  ]) {
    test(
      'missing-target discard retains original intent after ${failure.code}',
      () async {
        final f = fixture(),
            api = Transport(f)
              ..failure = const ApiException(
                message: 'Synthetic canonical missing',
                statusCode: 404,
                code: 'COLLECTION_NOT_FOUND',
              ),
            commands = SecurityCommandStore(storage: MemoryStorage());
        final service = CollectionMetadataService(
          api: api,
          actorIdProvider: () => f['actor'],
          storeIdProvider: () => f['command']['store_id'],
          commands: commands,
        );
        await expectLater(
          service.save(f['command']['store_id'], 'delete', {
            'collection_type': 'smart',
            'version': 7,
          }, id: f['row']['id']),
          throwsA(isA<ApiException>()),
        );
        final retained = await service.pending(f['command']['store_id']);
        api.failure = failure;
        await expectLater(
          service.discardMissing(f['command']['store_id']),
          throwsA(isA<ApiException>()),
        );
        expect(
          (await service.pending(f['command']['store_id']))!.encoded,
          retained!.encoded,
        );
        expect(api.writes.last.body, api.writes.first.body);
        expect(api.writes.last.idempotencyKey, api.writes.first.idempotencyKey);
        expect(api.effects, 0);
      },
    );
  }
  test(
    'discard reconciliation confirms a valid original receipt instead of reporting a discarded command',
    () async {
      final f = fixture(),
          api = Transport(f)
            ..failure = const ApiException(
              message: 'Synthetic canonical missing',
              statusCode: 404,
              code: 'COLLECTION_NOT_FOUND',
            ),
          commands = SecurityCommandStore(storage: MemoryStorage());
      final service = CollectionMetadataService(
        api: api,
        actorIdProvider: () => f['actor'],
        storeIdProvider: () => f['command']['store_id'],
        commands: commands,
      );
      await expectLater(
        service.save(f['command']['store_id'], 'update', {
          'collection_type': 'smart',
          'version': 7,
          'description': 'Synthetic original draft',
        }, id: f['row']['id']),
        throwsA(isA<ApiException>()),
      );
      api.failure = null;
      final confirmed = await service.discardMissing(f['command']['store_id']);
      expect(confirmed!.collection.version, 8);
      expect(await service.pending(f['command']['store_id']), isNull);
      expect(api.effects, 1);
    },
  );
  test(
    'committed reply loss survives service restart and retries one exact key/body',
    () async {
      final f = fixture(),
          api = Transport(f)..lose = true,
          commands = SecurityCommandStore(storage: MemoryStorage());
      CollectionMetadataService service() => CollectionMetadataService(
        api: api,
        actorIdProvider: () => f['actor'],
        storeIdProvider: () => f['command']['store_id'],
        commands: commands,
      );
      final fields = {...asJsonMap(f['command'])}
        ..remove('store_id')
        ..remove('idempotency_key');
      await expectLater(
        service().save(
          f['command']['store_id'],
          'update',
          fields,
          id: f['row']['id'],
        ),
        throwsA(isA<ApiException>()),
      );
      expect(api.effects, 1);
      expect(await service().pending(f['command']['store_id']), isNotNull);
      final receipt = await service().retry(f['command']['store_id']);
      expect(receipt.collection.version, 8);
      expect(api.effects, 1);
      expect(api.writes.length, 2);
      expect(api.writes.first.idempotencyKey, api.writes.last.idempotencyKey);
      expect(api.writes.first.body, api.writes.last.body);
      expect(await service().pending(f['command']['store_id']), isNull);
    },
  );
  test(
    'a wrong receipt actor stays encrypted until its original acknowledgement is confirmed',
    () async {
      final f = fixture(),
          api = Transport(f)..mismatch = true,
          commands = SecurityCommandStore(storage: MemoryStorage());
      final service = CollectionMetadataService(
        api: api,
        actorIdProvider: () => f['actor'],
        storeIdProvider: () => f['command']['store_id'],
        commands: commands,
      );
      await expectLater(
        service.save(f['command']['store_id'], 'update', {
          'collection_type': 'smart',
          'version': 7,
          'description': 'Synthetic kept draft',
        }, id: f['row']['id']),
        throwsFormatException,
      );
      expect(api.effects, 1);
      expect(await service.pending(f['command']['store_id']), isNotNull);
      api.mismatch = false;
      await service.retry(f['command']['store_id']);
      expect(api.effects, 1);
      expect(await service.pending(f['command']['store_id']), isNull);
    },
  );
  test(
    'a queued command freezes nested rules and cannot adopt a replacement account',
    () async {
      final f = fixture(),
          api = Transport(f),
          commands = SecurityCommandStore(storage: MemoryStorage());
      var actor = f['actor'] as String;
      final service = CollectionMetadataService(
        api: api,
        actorIdProvider: () => actor,
        storeIdProvider: () => f['command']['store_id'],
        commands: commands,
      );
      final held = Completer<void>(), entered = Completer<void>();
      final blocker = commands.serialized(() async {
        entered.complete();
        await held.future;
      });
      await entered.future;
      final fields = {
        'collection_type': 'smart',
        'version': 7,
        'conditions': [
          {
            'field': 'title',
            'op': 'contains',
            'value': 'Original nested draft',
          },
        ],
      };
      final save = service.save(
        f['command']['store_id'],
        'update',
        fields,
        id: f['row']['id'],
      );
      (fields['conditions'] as List).first['value'] = 'Changed after enqueue';
      held.complete();
      await blocker;
      await save;
      expect(
        (api.writes.single.body as Map)['conditions'][0]['value'],
        'Original nested draft',
      );
      final held2 = Completer<void>(), entered2 = Completer<void>();
      final blocker2 = commands.serialized(() async {
        entered2.complete();
        await held2.future;
      });
      await entered2.future;
      final old = service.save(f['command']['store_id'], 'update', {
        'collection_type': 'smart',
        'version': 8,
        'description': 'Old actor action',
      }, id: f['row']['id']);
      actor = f['command']['store_id'];
      final failure = expectLater(
        old,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      held2.complete();
      await blocker2;
      await failure;
      expect(api.writes.length, 1);
    },
  );
  test(
    'late old-account success cannot clear recovery or leak a replacement receipt',
    () async {
      final f = fixture(),
          api = Transport(f)
            ..entered = Completer<void>()
            ..release = Completer<void>(),
          commands = SecurityCommandStore(storage: MemoryStorage());
      var actor = f['actor'] as String;
      final service = CollectionMetadataService(
        api: api,
        actorIdProvider: () => actor,
        storeIdProvider: () => f['command']['store_id'],
        commands: commands,
      );
      final save = service.save(f['command']['store_id'], 'update', {
        'collection_type': 'smart',
        'version': 7,
        'description': 'Synthetic kept draft',
      }, id: f['row']['id']);
      await api.entered!.future;
      actor = f['command']['store_id'];
      final failure = expectLater(save, throwsA(isA<ApiException>()));
      api.release!.complete();
      await failure;
      actor = f['actor'];
      expect(await service.pending(f['command']['store_id']), isNotNull);
      api.entered = null;
      api.release = null;
      await service.retry(f['command']['store_id']);
      expect(api.effects, 1);
      expect(await service.pending(f['command']['store_id']), isNull);
    },
  );
  test(
    'an uncertain request cannot be discarded; definite stale-version review reads current state first',
    () async {
      final f = fixture(),
          api = Transport(f)..lose = true,
          commands = SecurityCommandStore(storage: MemoryStorage());
      final service = CollectionMetadataService(
        api: api,
        actorIdProvider: () => f['actor'],
        storeIdProvider: () => f['command']['store_id'],
        commands: commands,
      );
      await expectLater(
        service.save(f['command']['store_id'], 'update', {
          'collection_type': 'smart',
          'version': 7,
          'description': 'Synthetic kept draft',
        }, id: f['row']['id']),
        throwsA(isA<ApiException>()),
      );
      await expectLater(
        service.review(f['command']['store_id']),
        throwsFormatException,
      );
      expect(await service.pending(f['command']['store_id']), isNotNull);
      await service.retry(f['command']['store_id']);
      api.reject = true;
      await expectLater(
        service.save(f['command']['store_id'], 'update', {
          'collection_type': 'smart',
          'version': 7,
          'description': 'Synthetic rejected draft',
        }, id: f['row']['id']),
        throwsA(isA<ApiException>()),
      );
      expect(
        (await service.pending(f['command']['store_id']))!.intent['outcome'],
        'rejected',
      );
      final current = await service.review(f['command']['store_id']);
      expect(current.$2!.version, 7);
      expect(await service.pending(f['command']['store_id']), isNull);
    },
  );
}
