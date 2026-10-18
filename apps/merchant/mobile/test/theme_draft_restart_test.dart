import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/screens/customize/theme_versions_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/theme_service.dart';

const store = '11111111-1111-4111-8111-111111111111';
const otherStore = '22222222-2222-4222-8222-222222222222';
const target = '33333333-3333-4333-8333-333333333333';
const current = '44444444-4444-4444-8444-444444444444';
const restored = '55555555-5555-4555-8555-555555555555';
const config = <String, dynamic>{
  'themeId': 'modern',
  'sections': {'template': []},
  'privateThemeText': 'never persist this theme document',
};

class _Api extends ApiClient {
  _Api({this.actor = 'actor-a', this.epoch = 'opaque-process-one'})
    : super(baseUrl: 'https://owned.invalid');
  String? actor;
  Object epoch;
  List<JsonMap> releaseRows = [
    {
      'id': target,
      'release_version': 1,
      'release_status': 'superseded',
      'is_current': false,
    },
    {
      'id': restored,
      'release_version': 3,
      'release_status': 'published',
      'is_current': true,
    },
  ];
  final calls = <Map<String, dynamic>>[];
  late Future<JsonMap> Function(String, ApiRequestOptions?) respond;
  @override
  Object captureRequestContext() => epoch;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) {
    calls.add({
      'path': path,
      'body': jsonDecode(jsonEncode(options?.body)),
      'key': options?.idempotencyKey,
      'context': options?.expectedContextVersion,
    });
    return respond(path, options);
  }

  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    if (path.endsWith('/releases')) return {'data': releaseRows};
    throw StateError(
      'Catalog refresh unavailable; confirmed mutations stay confirmed.',
    );
  }
}

class _Preferences extends Fake implements SharedPreferences {
  final values = <String, String>{};
  bool write = true, retire = true;
  @override
  String? getString(String key) => values[key];
  @override
  Future<bool> setString(String key, String value) async {
    if (!write) return false;
    values[key] = value;
    return true;
  }

  @override
  Future<bool> remove(String key) async {
    if (!retire) return false;
    values.remove(key);
    return true;
  }
}

ThemeService service(_Api api, SharedPreferences preferences) => ThemeService(
  api: api,
  actorIdProvider: () => api.actor,
  recoveryPreferences: () async => preferences,
);
const lost = ApiException(
  message: 'Synthetic committed reply lost',
  statusCode: 503,
  code: 'SYNTHETIC_RESPONSE_LOSS',
);
JsonMap publication(
  int version, {
  int? currentVersion,
  bool replayed = false,
}) => {
  'version': version,
  'current_version': currentVersion ?? version,
  'replayed': replayed,
  'release': {'release_id': restored},
};
JsonMap rollback({bool replayed = false}) => {
  'rollback': {'release_id': restored, 'release_version': 3},
  'restored_release': {'id': target, 'version': 1},
  'replayed': replayed,
  'current_release_id': restored,
  'current_release_version': 3,
};
JsonMap editor(int version) => {
  'version': version,
  'store': {'id': store},
  'theme': {'slug': 'modern'},
  'template_config': config,
  'draft': {'exists': true},
};
void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'publication metadata survives service recreation and recovers the exact key/base without storing theme content or old request context',
    () async {
      final preferences = await SharedPreferences.getInstance(), a = _Api();
      a.respond = (path, options) async {
        if (path.endsWith('/editor/draft'))
          return {
            'version': 1,
            'current_version': 1,
            'replayed': false,
            'saved_at': '2026-10-18T00:00:00Z',
            'draft': {'id': 'draft-one', 'version': 1},
          };
        throw lost;
      };
      final first = service(a, preferences);
      await expectLater(
        first.publish(
          storeId: store,
          themeSlug: 'modern',
          baseVersion: 0,
          templateConfig: config,
        ),
        throwsA(isA<ApiException>()),
      );
      final key = preferences.getKeys().single,
          raw = preferences.getString(preferences.getKeys().single)!;
      final metadata = jsonDecode(raw) as Map;
      expect(metadata.keys.toSet(), {
        'version',
        'kind',
        'actorId',
        'storeId',
        'themeSlug',
        'key',
        'baseVersion',
        'makeStoreLive',
      });
      expect(metadata['baseVersion'], 1);
      expect(raw, isNot(contains('privateThemeText')));
      expect(raw, isNot(contains('never persist')));
      expect(raw, isNot(contains('opaque-process')));
      final old = a.calls.last;
      expect((old['body'] as Map)['idempotency_key'], metadata['key']);
      await preferences.reload();
      final b = _Api(epoch: 'opaque-new-process');
      b.respond = (path, _) async => path.endsWith('/editor')
          ? editor(3)
          : publication(2, currentVersion: 3, replayed: true);
      final next = service(b, preferences);
      // Load through the maintained service itself; the previous service's memory is not reused.
      final loadedNext = await next.loadEditor(
        storeId: store,
        themeSlug: 'modern',
      );
      expect(loadedNext.version, 3);
      expect(next.hasPendingPublication(store, 'modern'), true);
      await expectLater(
        next.publish(storeId: store, themeSlug: 'modern', baseVersion: 3),
        throwsA(isA<ThemeDraftRetryRequiredException>()),
      );
      final result = await next.recoverPublication(
        storeId: store,
        themeSlug: 'modern',
      );
      expect(result['current_version'], 3);
      final replay = b.calls
          .where((call) => (call['path'] as String).endsWith('/publish'))
          .single;
      expect(replay['body'], old['body']);
      expect(replay['key'], old['key']);
      expect(replay['context'], 'opaque-new-process');
      expect(next.editorPayload, same(loadedNext));
      expect(next.editorPayload?.version, 3);
      expect(next.editorPayload?.hasDraft, true);
      expect(preferences.containsKey(key), false);
      expect(next.hasPendingPublication(store, 'modern'), false);
    },
  );
  test(
    'rollback metadata restores reviewed target/current and exact protocol options after service recreation',
    () async {
      final preferences = await SharedPreferences.getInstance(), a = _Api();
      a.respond = (_, __) async => throw lost;
      final first = service(a, preferences);
      await expectLater(
        first.rollbackRelease(
          storeId: store,
          themeSlug: 'modern',
          releaseId: target,
          expectedCurrentReleaseId: current,
          rollbackMessage: 'Reviewed mobile rollback',
        ),
        throwsA(isA<ApiException>()),
      );
      final original = a.calls.single;
      expect(
        (jsonDecode(preferences.getString(preferences.getKeys().single)!)
            as Map)['expectedCurrentReleaseId'],
        current,
      );
      await preferences.reload();
      final b = _Api(epoch: 'fresh-context');
      b.respond = (_, __) async => rollback(replayed: true);
      final next = service(b, preferences);
      await next.fetchReleases(storeId: store, themeSlug: 'modern');
      expect(next.pendingRollbackTarget(store, 'modern'), target);
      await expectLater(
        next.rollbackRelease(
          storeId: store,
          themeSlug: 'modern',
          releaseId: current,
          expectedCurrentReleaseId: restored,
        ),
        throwsA(isA<StateError>()),
      );
      expect(b.calls, isEmpty);
      await next.recoverRollback(storeId: store, themeSlug: 'modern');
      expect(b.calls.single['body'], original['body']);
      expect(b.calls.single['key'], original['key']);
      expect(b.calls.single['context'], 'fresh-context');
      expect(preferences.getKeys(), isEmpty);
      expect(next.pendingRollbackTarget(store, 'modern'), isNull);
    },
  );
  test(
    'actor, store and theme namespaces cannot adopt or retire another pending publication',
    () async {
      final preferences = await SharedPreferences.getInstance(), a = _Api();
      a.respond = (_, __) async => throw lost;
      await expectLater(
        service(
          a,
          preferences,
        ).publish(storeId: store, themeSlug: 'modern', baseVersion: 1),
        throwsA(isA<ApiException>()),
      );
      final oldKey = preferences.getKeys().single,
          original = preferences.getString(preferences.getKeys().single),
          intentKey = a.calls.single['key'];
      for (final scope in [
        ('actor-b', store, 'modern'),
        ('actor-a', otherStore, 'modern'),
        ('actor-a', store, 'other-theme'),
      ]) {
        final b = _Api(actor: scope.$1, epoch: 'other-context');
        b.respond = (_, __) async => publication(2);
        await service(
          b,
          preferences,
        ).publish(storeId: scope.$2, themeSlug: scope.$3, baseVersion: 1);
        expect(b.calls.single['key'], isNot(intentKey));
        expect(preferences.getKeys(), {oldKey});
        expect(preferences.getString(oldKey), original);
      }
      final returned = _Api(epoch: 'actor-a-returned');
      returned.respond = (_, __) async => publication(2, replayed: true);
      await service(
        returned,
        preferences,
      ).recoverPublication(storeId: store, themeSlug: 'modern');
      expect(returned.calls.single['key'], intentKey);
      expect(preferences.getKeys(), isEmpty);
    },
  );
  test(
    'malformed, mismatched or overbroad stored metadata blocks new publication before HTTP',
    () async {
      final preferences = await SharedPreferences.getInstance(), seed = _Api();
      seed.respond = (_, __) async => throw lost;
      await expectLater(
        service(
          seed,
          preferences,
        ).publish(storeId: store, themeSlug: 'modern', baseVersion: 1),
        throwsA(isA<ApiException>()),
      );
      final key = preferences.getKeys().single,
          original =
              jsonDecode(preferences.getString(preferences.getKeys().single)!)
                  as Map<String, dynamic>;
      for (final raw in [
        'not json',
        jsonEncode({...original, 'actorId': 'actor-b'}),
        jsonEncode({...original, 'draftConfig': config}),
        jsonEncode({...original, 'baseVersion': 0}),
        jsonEncode({...original, 'kind': 'rollback'}),
      ]) {
        await preferences.setString(key, raw);
        final api = _Api();
        api.respond = (_, __) async => publication(2);
        await expectLater(
          service(
            api,
            preferences,
          ).publish(storeId: store, themeSlug: 'modern', baseVersion: 1),
          throwsA(isA<FormatException>()),
        );
        expect(api.calls, isEmpty);
        expect(preferences.getString(key), raw);
      }
    },
  );
  test(
    'durable write failure and signed-out actor prevent effects; changing actor during preference load cannot capture a request',
    () async {
      final preferences = _Preferences()..write = false, api = _Api();
      api.respond = (_, __) async => publication(2);
      await expectLater(
        service(
          api,
          preferences,
        ).publish(storeId: store, themeSlug: 'modern', baseVersion: 1),
        throwsA(isA<StateError>()),
      );
      expect(api.calls, isEmpty);
      final signedOut = _Api(actor: null);
      signedOut.respond = (_, __) async => publication(2);
      await expectLater(
        service(
          signedOut,
          preferences,
        ).publish(storeId: store, themeSlug: 'modern', baseVersion: 1),
        throwsA(isA<StateError>()),
      );
      expect(signedOut.calls, isEmpty);
      final loading = Completer<SharedPreferences>(),
          started = Completer<void>(),
          switching = _Api();
      switching.respond = (_, __) async => publication(2);
      final next = ThemeService(
        api: switching,
        actorIdProvider: () => switching.actor,
        recoveryPreferences: () {
          started.complete();
          return loading.future;
        },
      );
      final operation = next.publish(
        storeId: store,
        themeSlug: 'modern',
        baseVersion: 1,
      );
      final denied = expectLater(operation, throwsA(isA<StateError>()));
      // Test the captured actor independently of the opaque transport context.
      await started.future;
      switching.actor = 'actor-b';
      loading.complete(preferences);
      await denied;
      expect(switching.calls, isEmpty);
      expect(preferences.values, isEmpty);
    },
  );
  test(
    'confirmed publication with failed local retirement remains recoverable and cannot start a newer publication',
    () async {
      final preferences = _Preferences()..retire = false, api = _Api();
      api.respond = (_, __) async => publication(2, replayed: true);
      final first = service(api, preferences);
      final result = await first.publish(
        storeId: store,
        themeSlug: 'modern',
        baseVersion: 1,
      );
      expect(result['version'], 2);
      expect(first.hasPendingPublication(store, 'modern'), true);
      final key = api.calls.single['key'];
      final after = _Api(epoch: 'new-context');
      after.respond = (_, __) async => publication(2, replayed: true);
      final next = service(after, preferences);
      await expectLater(
        next.publish(storeId: store, themeSlug: 'modern', baseVersion: 2),
        throwsA(isA<ThemeDraftRetryRequiredException>()),
      );
      expect(after.calls, isEmpty);
      preferences.retire = true;
      await next.recoverPublication(storeId: store, themeSlug: 'modern');
      expect(after.calls.single['key'], key);
      expect(preferences.values, isEmpty);
    },
  );
  test(
    'independent services share the durable publication intent instead of overwriting each other with a new key',
    () async {
      final preferences = _Preferences(),
          a = _Api(),
          b = _Api(epoch: 'other-service');
      a.respond = (_, __) async => throw lost;
      b.respond = (_, __) async => throw lost;
      final first = service(a, preferences), second = service(b, preferences);
      Future<Object?> attempt(ThemeService instance) async {
        try {
          return await instance.publish(
            storeId: store,
            themeSlug: 'modern',
            baseVersion: 1,
          );
        } catch (error) {
          return error;
        }
      }

      await Future.wait([attempt(first), attempt(second)]);
      expect(preferences.values, hasLength(1));
      final key = (jsonDecode(preferences.values.values.single) as Map)['key'];
      expect(
        [...a.calls, ...b.calls].every((call) => call['key'] == key),
        true,
      );
      expect(a.calls, hasLength(1));
      b.respond = (_, __) async => publication(2, replayed: true);
      await second.recoverPublication(storeId: store, themeSlug: 'modern');
      expect(b.calls.last['key'], key);
      expect(preferences.values, isEmpty);
    },
  );
  test(
    'stable actor callback fences in-memory recovery even if an opaque transport context is unchanged',
    () async {
      final preferences = await SharedPreferences.getInstance(), api = _Api();
      api.respond = (_, __) async => throw lost;
      final instance = service(api, preferences);
      await expectLater(
        instance.publish(storeId: store, themeSlug: 'modern', baseVersion: 1),
        throwsA(isA<ApiException>()),
      );
      await expectLater(
        instance.rollbackRelease(
          storeId: store,
          themeSlug: 'modern',
          releaseId: target,
          expectedCurrentReleaseId: current,
        ),
        throwsA(isA<ApiException>()),
      );
      final old = api.calls.map((call) => call['key']).toList();
      expect(api.calls, hasLength(2));
      api.actor = 'actor-b';
      expect(instance.hasPendingPublication(store, 'modern'), false);
      expect(instance.pendingRollbackTarget(store, 'modern'), isNull);
      await expectLater(
        instance.recoverPublication(storeId: store, themeSlug: 'modern'),
        throwsA(isA<StateError>()),
      );
      await expectLater(
        instance.recoverRollback(storeId: store, themeSlug: 'modern'),
        throwsA(isA<StateError>()),
      );
      expect(api.calls, hasLength(2));
      expect(preferences.getKeys(), hasLength(2));
      api.actor = 'actor-a';
      api.respond = (path, _) async => path.endsWith('/publish')
          ? publication(2, replayed: true)
          : rollback(replayed: true);
      await instance.recoverPublication(storeId: store, themeSlug: 'modern');
      await instance.recoverRollback(storeId: store, themeSlug: 'modern');
      expect(api.calls[2]['key'], old[0]);
      expect(api.calls[3]['key'], old[1]);
      expect(preferences.getKeys(), isEmpty);
    },
  );
  for (final missingTarget in [false, true]) {
    testWidgets(
      'maintained versions screen recovers persisted rollback${missingTarget ? ' when the target is outside the returned list' : ''}',
      (tester) async {
        final preferences = await SharedPreferences.getInstance(), old = _Api();
        old.respond = (_, __) async => throw lost;
        await expectLater(
          service(old, preferences).rollbackRelease(
            storeId: store,
            themeSlug: 'modern',
            releaseId: target,
            expectedCurrentReleaseId: current,
          ),
          throwsA(isA<ApiException>()),
        );
        final prior = old.calls.single;
        final api = _Api(epoch: 'recreated-screen');
        if (missingTarget)
          api.releaseRows = api.releaseRows
              .where((row) => row['id'] != target)
              .toList();
        api.respond = (_, __) async => rollback(replayed: true);
        final next = service(api, preferences);
        await tester.pumpWidget(
          ChangeNotifierProvider<ThemeService>.value(
            value: next,
            child: const MaterialApp(
              home: ThemeVersionsScreen(
                storeId: store,
                themeSlug: 'modern',
                themeName: 'Modern',
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.text('Version 1'),
          missingTarget ? findsNothing : findsOneWidget,
        );
        expect(find.text('Version 3'), findsOneWidget);
        final recovery = find.widgetWithText(TextButton, 'Recover rollback');
        expect(recovery, findsOneWidget);
        await tester.tap(recovery);
        await tester.pumpAndSettle();
        expect(find.text('Recover rollback?'), findsOneWidget);
        await tester.tap(find.widgetWithText(FilledButton, 'Recover rollback'));
        await tester.pumpAndSettle();
        expect(api.calls, hasLength(1));
        expect(api.calls.single['body'], prior['body']);
        expect(api.calls.single['key'], prior['key']);
        expect(preferences.getKeys(), isEmpty);
        expect(find.text('Rollback confirmed.'), findsOneWidget);
      },
    );
  }
  testWidgets(
    'account change during recovery confirmation sends no request and retains the original actor journal',
    (tester) async {
      final preferences = await SharedPreferences.getInstance(), old = _Api();
      old.respond = (_, __) async => throw lost;
      await expectLater(
        service(old, preferences).rollbackRelease(
          storeId: store,
          themeSlug: 'modern',
          releaseId: target,
          expectedCurrentReleaseId: current,
        ),
        throwsA(isA<ApiException>()),
      );
      final key = preferences.getKeys().single,
          raw = preferences.getString(preferences.getKeys().single);
      final api = _Api(epoch: 'screen-a');
      api.respond = (_, __) async => rollback(replayed: true);
      final next = service(api, preferences);
      await tester.pumpWidget(
        ChangeNotifierProvider<ThemeService>.value(
          value: next,
          child: const MaterialApp(
            home: ThemeVersionsScreen(
              storeId: store,
              themeSlug: 'modern',
              themeName: 'Modern',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Recover rollback'));
      await tester.pumpAndSettle();
      api.actor = 'actor-b';
      api.epoch = 'screen-b';
      await tester.tap(find.widgetWithText(FilledButton, 'Recover rollback'));
      await tester.pumpAndSettle();
      expect(api.calls, isEmpty);
      expect(preferences.getString(key), raw);
      expect(find.text('Rollback confirmed.'), findsNothing);
    },
  );
}
