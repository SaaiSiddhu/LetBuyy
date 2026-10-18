import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/theme_service.dart';

class _Api extends ApiClient {
  _Api() : super(baseUrl: 'https://owned.invalid');
  Object identity = ('actor-a', 'store-a');
  final calls = <Map<String, dynamic>>[];
  late Future<JsonMap> Function(String, ApiRequestOptions?) respond;
  @override
  Object captureRequestContext() => identity;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) {
    calls.add({
      'path': path,
      'body': jsonDecode(jsonEncode(options?.body)),
      'key': options?.idempotencyKey,
      'query': options?.query,
      'headers': options?.headers,
      'method': options?.method,
      'context': options?.expectedContextVersion,
    });
    return respond(path, options);
  }

  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async =>
      throw StateError(
        'No catalog read fixture; confirmed writes remain confirmed.',
      );
}

JsonMap receipt(int version, {int? current}) => {
  'version': version,
  'current_version': current ?? version,
  'replayed': false,
  'saved_at': '2026-10-16T12:00:00Z',
  'draft': {'id': 'owned-draft', 'version': version},
};
const config = <String, dynamic>{
  'themeId': 'modern',
  'sections': {'template': []},
};

void main() {
  test(
    'lost response reuses immutable intent/key before newer local edits can save',
    () async {
      final api = _Api();
      var attempts = 0;
      api.respond = (_, __) async {
        if (++attempts == 1)
          throw const ApiException(
            message: 'Synthetic response lost',
            statusCode: 503,
            code: 'SYNTHETIC_RESPONSE_LOSS',
          );
        return receipt(attempts - 1);
      };
      final service = ThemeService(api: api);
      final input = <String, dynamic>{
        ...config,
        'themeSettings': {'primaryColor': '#102030'},
      };
      await expectLater(
        service.saveDraft(
          storeId: 'store-a',
          themeSlug: 'modern',
          templateConfig: input,
          baseVersion: 0,
        ),
        throwsA(isA<ApiException>()),
      );
      final original = jsonEncode(api.calls.single['body']);
      (input['themeSettings'] as Map)['primaryColor'] = '#403020';
      await expectLater(
        service.saveDraft(
          storeId: 'store-a',
          themeSlug: 'modern',
          templateConfig: input,
          baseVersion: 0,
        ),
        throwsA(isA<ThemeDraftRetryRequiredException>()),
      );
      expect(api.calls, hasLength(1));
      expect(
        (await service.retryPendingSave(
          storeId: 'store-a',
          themeSlug: 'modern',
        )).version,
        1,
      );
      expect(jsonEncode(api.calls[1]['body']), original);
      expect(api.calls[1]['key'], api.calls[0]['key']);
      expect(
        (await service.saveDraft(
          storeId: 'store-a',
          themeSlug: 'modern',
          templateConfig: input,
          baseVersion: 1,
        )).version,
        2,
      );
      expect(api.calls[2]['key'], isNot(api.calls[0]['key']));
    },
  );

  test('overlapping identical saves share one in-flight transport', () async {
    final api = _Api(), completion = Completer<JsonMap>();
    api.respond = (_, __) => completion.future;
    final service = ThemeService(api: api);
    final a = service.saveDraft(
      storeId: 'store-a',
      themeSlug: 'modern',
      templateConfig: config,
      baseVersion: 0,
    );
    final b = service.saveDraft(
      storeId: 'store-a',
      themeSlug: 'modern',
      templateConfig: config,
      baseVersion: 0,
    );
    expect(api.calls, hasLength(1));
    completion.complete(receipt(1));
    expect((await a).version, 1);
    expect((await b).version, 1);
  });

  test('late actor-A completion cannot clear actor-B pending intent', () async {
    final api = _Api(), old = Completer<JsonMap>();
    api.respond = (_, __) => old.future;
    final service = ThemeService(api: api);
    final a = service.saveDraft(
      storeId: 'store-a',
      themeSlug: 'modern',
      templateConfig: config,
      baseVersion: 0,
    );
    final denied = expectLater(a, throwsA(isA<StateError>()));
    api.identity = ('actor-b', 'store-a');
    api.respond = (_, __) async => throw const ApiException(
      message: 'Synthetic B response lost',
      statusCode: 503,
      code: 'SYNTHETIC_RESPONSE_LOSS',
    );
    await expectLater(
      service.saveDraft(
        storeId: 'store-a',
        themeSlug: 'modern',
        templateConfig: config,
        baseVersion: 0,
      ),
      throwsA(isA<ApiException>()),
    );
    old.complete(receipt(1));
    await denied;
    expect(service.hasPendingSave('store-a', 'modern'), isTrue);
    expect(api.calls[0]['context'], ('actor-a', 'store-a'));
    expect(api.calls[1]['context'], ('actor-b', 'store-a'));
  });

  test(
    'receipt from an older revision surfaces a conflict instead of pretending to be current',
    () async {
      final api = _Api();
      api.respond = (_, __) async => receipt(1, current: 2);
      final service = ThemeService(api: api);
      await expectLater(
        service.saveDraft(
          storeId: 'store-a',
          themeSlug: 'modern',
          templateConfig: config,
          baseVersion: 0,
        ),
        throwsA(isA<ThemeDraftConflictException>()),
      );
      expect(service.hasPendingSave('store-a', 'modern'), isFalse);
    },
  );

  test(
    'missing editor/save versions cannot fabricate a successful native draft',
    () async {
      final api = _Api();
      api.respond = (_, __) async => {};
      final service = ThemeService(api: api);
      await expectLater(
        service.loadEditor(storeId: 'store-a', themeSlug: 'modern'),
        throwsA(isA<FormatException>()),
      );
      await expectLater(
        service.saveDraft(
          storeId: 'store-a',
          themeSlug: 'modern',
          templateConfig: config,
        ),
        throwsA(isA<ArgumentError>()),
      );
      await expectLater(
        service.saveDraft(
          storeId: 'store-a',
          themeSlug: 'modern',
          templateConfig: config,
          baseVersion: 0,
        ),
        throwsA(isA<FormatException>()),
      );
    },
  );

  test(
    'publish response-loss retry does not create a second draft or publish intent',
    () async {
      final api = _Api();
      var publishes = 0;
      api.respond = (path, _) async {
        if (path.endsWith('/editor/draft')) return receipt(1);
        if (path.endsWith('/publish')) {
          if (++publishes == 1)
            throw const ApiException(
              message: 'Synthetic publish response lost',
              statusCode: 503,
              code: 'SYNTHETIC_RESPONSE_LOSS',
            );
          return {
            'version': 2,
            'current_version': 2,
            'replayed': true,
            'release': {'release_id': 'owned-release'},
          };
        }
        throw StateError('Unexpected request');
      };
      final service = ThemeService(api: api);
      Future<void> publish() => service.publish(
        storeId: 'store-a',
        themeSlug: 'modern',
        templateConfig: config,
        baseVersion: 0,
      );
      await expectLater(publish(), throwsA(isA<ApiException>()));
      await publish();
      final saves = api.calls.where(
        (c) => (c['path'] as String).endsWith('/editor/draft'),
      );
      final posts = api.calls
          .where((c) => (c['path'] as String).endsWith('/publish'))
          .toList();
      expect(saves, hasLength(1));
      expect(posts, hasLength(2));
      expect(posts[0]['key'], posts[1]['key']);
      expect(posts[0]['body'], posts[1]['body']);
      expect((posts[0]['body'] as Map)['base_version'], 1);
      expect((posts[0]['body'] as Map).containsKey('template_config'), isFalse);
    },
  );
  test(
    'discard requires a real receipt and retries the same version/key after response loss',
    () async {
      final api = _Api();
      var attempts = 0;
      api.respond = (path, options) async {
        if (path.endsWith('/editor'))
          return {
            'version': 4,
            'store': {'id': 'store-a'},
            'theme': {'slug': 'modern'},
            'template_config': config,
            'draft': {'exists': true},
          };
        if (++attempts == 1)
          throw const ApiException(
            message: 'Synthetic lost discard response',
            statusCode: 503,
            code: 'SYNTHETIC_RESPONSE_LOSS',
          );
        return {
          'deleted': true,
          'version': 5,
          'current_version': 5,
          'replayed': true,
        };
      };
      final service = ThemeService(api: api);
      await service.loadEditor(storeId: 'store-a', themeSlug: 'modern');
      await expectLater(
        service.discardDraft(storeId: 'store-a', themeSlug: 'modern'),
        throwsA(isA<ApiException>()),
      );
      expect(service.editorPayload?.version, 4);
      await service.discardDraft(storeId: 'store-a', themeSlug: 'modern');
      expect(api.calls[1]['query'], api.calls[2]['query']);
      expect(api.calls[1]['key'], api.calls[2]['key']);
      expect((api.calls[2]['query'] as Map)['base_version'], 4);
      expect(service.editorPayload, isNull);
      // Exercise the actual SDK merge seam as well as its ThemeService caller.
      const transportKey = 'owned-discard-transport-key';
      await api.themes.deleteDraft(
        'modern',
        'store-a',
        options: const ApiRequestOptions(
          query: {
            'store_id': 'other-store',
            'base_version': 9,
            'idempotency_key': transportKey,
          },
          headers: {'X-Owned-Theme': 'preserved'},
          idempotencyKey: transportKey,
          expectedContextVersion: ('actor-a', 'store-a'),
        ),
      );
      expect(api.calls.last['query'], {
        'store_id': 'store-a',
        'base_version': 9,
        'idempotency_key': transportKey,
      });
      expect(api.calls.last['headers'], {'X-Owned-Theme': 'preserved'});
      expect(api.calls.last['key'], transportKey);
      expect(api.calls.last['context'], ('actor-a', 'store-a'));
      expect(api.calls.last['method'], HttpMethod.delete);
    },
  );
  test(
    'future save receipt cannot advance native revision or discard the retry intent',
    () async {
      final api = _Api();
      api.respond = (_, __) async => receipt(9);
      final service = ThemeService(api: api);
      await expectLater(
        service.saveDraft(
          storeId: 'store-a',
          themeSlug: 'modern',
          templateConfig: config,
          baseVersion: 0,
        ),
        throwsA(isA<FormatException>()),
      );
      expect(service.hasPendingSave('store-a', 'modern'), isTrue);
    },
  );
  test(
    'definitive validation rejection permits corrected edits and does not trap publication recovery',
    () async {
      final api = _Api();
      var rejected = false;
      api.respond = (path, options) async {
        if (path.endsWith('/publish'))
          throw const ApiException(
            message: 'Correct saved values',
            statusCode: 400,
            code: 'VALIDATION_ERROR',
          );
        if (!rejected) {
          rejected = true;
          throw const ApiException(
            message: 'Correct the field',
            statusCode: 400,
            code: 'VALIDATION_ERROR',
          );
        }
        final body = options!.body as Map;
        return receipt((body['base_version'] as int) + 1);
      };
      final service = ThemeService(api: api);
      await expectLater(
        service.saveDraft(
          storeId: 'store-a',
          themeSlug: 'modern',
          templateConfig: config,
          baseVersion: 0,
        ),
        throwsA(isA<ApiException>()),
      );
      expect(service.hasPendingSave('store-a', 'modern'), isFalse);
      await service.saveDraft(
        storeId: 'store-a',
        themeSlug: 'modern',
        templateConfig: {...config, 'corrected': true},
        baseVersion: 0,
      );
      expect(api.calls[0]['key'], isNot(api.calls[1]['key']));
      expect((api.calls[1]['body'] as Map)['base_version'], 0);
      await expectLater(
        service.publish(
          storeId: 'store-a',
          themeSlug: 'modern',
          baseVersion: 1,
        ),
        throwsA(isA<ApiException>()),
      );
      expect(service.hasPendingPublication('store-a', 'modern'), isFalse);
      await service.saveDraft(
        storeId: 'store-a',
        themeSlug: 'modern',
        templateConfig: {...config, 'correctedAgain': true},
        baseVersion: 1,
      );
      expect((api.calls.last['body'] as Map)['base_version'], 1);
    },
  );
}
