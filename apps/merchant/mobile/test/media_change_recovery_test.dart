import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/media_service.dart';

class ChangeFixture {
  ChangeFixture() {
    api = ApiClient(
      baseUrl: 'https://synthetic.invalid/v1',
      maxRetries: 0,
      contextVersionProvider: () => epoch,
    );
    api.dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (request, handler) {
          if (request.method == 'GET') {
            handler.resolve(
              Response(
                requestOptions: request,
                statusCode: 200,
                data: {
                  'data': row == null ? [] : [row],
                  'meta': {'has_next': false},
                },
              ),
            );
            return;
          }
          writes.add(request);
          if (request.method == 'PATCH') {
            row = {...?row, ...Map<String, dynamic>.from(request.data as Map)};
          } else {
            row = null;
          }
          if (loseReply) {
            handler.reject(
              DioException(
                requestOptions: request,
                type: DioExceptionType.connectionError,
                error: 'Synthetic response lost after server effect',
              ),
            );
          } else {
            handler.resolve(
              Response(
                requestOptions: request,
                statusCode: 200,
                data: {
                  'data': request.method == 'PATCH'
                      ? {...?row, if (wrongReply) 'alt_text': 'Wrong receipt'}
                      : {'deleted': true},
                },
              ),
            );
          }
        },
      ),
    );
  }

  late final ApiClient api;
  var epoch = 1;
  var actor = 'synthetic-owner';
  var store = '7a4a8a1d-b283-433d-b752-b5ce0e612749';
  var loseReply = true;
  var wrongReply = false;
  final writes = <RequestOptions>[];
  Map<String, dynamic>? row = {
    'id': 'd1f4fa69-9a80-4a4e-8644-f094b27cfd66',
    'store_id': '7a4a8a1d-b283-433d-b752-b5ce0e612749',
    'filename': 'synthetic-image.png',
    'url': 'https://synthetic.invalid/image.png',
    'mime_type': 'image/png',
    'media_type': 'image',
    'size_bytes': 75,
    'alt_text': 'Original label',
  };
  MediaService service() => MediaService(
    api: api,
    actorIdProvider: () => actor,
    storeIdProvider: () => store,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  for (final removing in [false, true]) {
    test(
      'lost ${removing ? 'delete' : 'metadata'} acknowledgement retains original encrypted request',
      () async {
        final f = ChangeFixture();
        final media = f.service();
        addTearDown(media.dispose);
        addTearDown(f.api.close);
        final asset = (await media.fetchMedia(f.store)).single;
        await expectLater(
          removing
              ? media.deleteMedia(asset)
              : media.updateMedia(
                  asset.id,
                  const MediaUpdateInput(altText: 'New label'),
                ),
          throwsA(isA<ApiException>()),
        );
        final saved = await const FlutterSecureStorage().readAll();
        expect(
          saved.values
              .map((value) => jsonDecode(value))
              .whereType<Map>()
              .any((value) => value['command'] == 'media-change'),
          isTrue,
          reason:
              'An uncertain effect needs its original key after process restart.',
        );
        expect(f.writes, hasLength(1));
      },
    );
  }

  for (final removing in [false, true]) {
    test(
      'restart recovers original ${removing ? 'delete' : 'metadata'} key even when its row is already changed',
      () async {
        final f = ChangeFixture();
        var media = f.service();
        addTearDown(() => media.dispose());
        addTearDown(f.api.close);
        final asset = (await media.fetchMedia(f.store)).single;
        await expectLater(
          removing
              ? media.deleteMedia(asset)
              : media.updateMedia(
                  asset.id,
                  const MediaUpdateInput(altText: 'Retained label'),
                ),
          throwsA(isA<ApiException>()),
        );
        final key = f.writes.single.headers['X-Idempotency-Key'];
        final body = jsonEncode(f.writes.single.data);
        media.dispose();
        media = f.service();
        final rows = await media.fetchMedia(f.store);
        expect(media.hasPendingChange, isTrue);
        expect(rows.length, removing ? 0 : 1);
        f.loseReply = false;
        await media.resumeChange(f.store);
        expect(f.writes, hasLength(2));
        expect(f.writes.last.headers['X-Idempotency-Key'], key);
        expect(jsonEncode(f.writes.last.data), body);
        expect(media.hasPendingChange, isFalse);
        expect(await const FlutterSecureStorage().readAll(), isEmpty);
        expect(
          removing
              ? media.assets.isEmpty
              : media.assets.single.altText == 'Retained label',
          isTrue,
        );
      },
    );
  }

  test(
    'a different edit or deletion cannot replace the uncertain original',
    () async {
      final f = ChangeFixture();
      final media = f.service();
      addTearDown(media.dispose);
      addTearDown(f.api.close);
      final asset = (await media.fetchMedia(f.store)).single;
      final tags = ['original'];
      final first = media.updateMedia(
        asset.id,
        MediaUpdateInput(altText: 'Retained', tags: tags),
      );
      tags.add('caller mutation');
      await expectLater(first, throwsA(isA<ApiException>()));
      expect((f.writes.single.data as Map)['tags'], ['original']);
      final storageBefore = await const FlutterSecureStorage().readAll();
      await expectLater(
        media.updateMedia(
          asset.id,
          const MediaUpdateInput(altText: 'Different'),
        ),
        throwsA(isA<ApiException>()),
      );
      await expectLater(media.deleteMedia(asset), throwsA(isA<ApiException>()));
      expect(f.writes, hasLength(1));
      expect(await const FlutterSecureStorage().readAll(), storageBefore);
      f.loseReply = false;
      await media.resumeChange(f.store);
      expect((f.writes.last.data as Map)['alt_text'], 'Retained');
      expect((f.writes.last.data as Map)['tags'], ['original']);
    },
  );

  for (final switchActor in [false, true]) {
    test(
      'saved change cannot replay after ${switchActor ? 'actor' : 'store'} retirement',
      () async {
        final f = ChangeFixture();
        final media = f.service();
        addTearDown(media.dispose);
        addTearDown(f.api.close);
        final asset = (await media.fetchMedia(f.store)).single;
        await expectLater(
          media.deleteMedia(asset),
          throwsA(isA<ApiException>()),
        );
        final retained = await const FlutterSecureStorage().readAll();
        if (switchActor) {
          f.actor = 'another-owner';
        } else {
          f.store = 'another-store';
        }
        f.epoch++;
        expect(media.hasPendingChange, isFalse);
        await expectLater(
          media.resumeChange(f.store),
          throwsA(isA<ApiException>()),
        );
        expect(f.writes, hasLength(1));
        expect(await const FlutterSecureStorage().readAll(), retained);
      },
    );
  }

  test(
    'a same-row receipt with different metadata cannot clear recovery',
    () async {
      final f = ChangeFixture();
      final media = f.service();
      addTearDown(media.dispose);
      addTearDown(f.api.close);
      final asset = (await media.fetchMedia(f.store)).single;
      await expectLater(
        media.updateMedia(
          asset.id,
          const MediaUpdateInput(altText: 'Retained label'),
        ),
        throwsA(isA<ApiException>()),
      );
      final original = await const FlutterSecureStorage().readAll();
      f.loseReply = false;
      f.wrongReply = true;
      await expectLater(
        media.resumeChange(f.store),
        throwsA(isA<ApiException>()),
      );
      expect(await const FlutterSecureStorage().readAll(), original);
      f.wrongReply = false;
      await media.resumeChange(f.store);
      expect(await const FlutterSecureStorage().readAll(), isEmpty);
      expect(
        f.writes.map((r) => r.headers['X-Idempotency-Key']).toSet(),
        hasLength(1),
      );
    },
  );

  test('missing actor and forged metadata fail before any mutation', () async {
    final f = ChangeFixture();
    final media = MediaService(api: f.api, storeIdProvider: () => f.store);
    addTearDown(media.dispose);
    addTearDown(f.api.close);
    final asset = (await media.fetchMedia(f.store)).single;
    await expectLater(
      media.updateMedia(asset.id, const MediaUpdateInput(altText: 'Label')),
      throwsA(isA<ApiException>()),
    );
    expect(f.writes, isEmpty);
    expect(
      () => MediaUpdateInput.validateJson({'store_id': f.store}),
      throwsFormatException,
    );
    expect(
      () => MediaUpdateInput.validateJson({
        'tags': ['x' * 51],
      }),
      throwsFormatException,
    );
    expect(
      () => MediaUpdateInput.validateJson({'alt_text': 12}),
      throwsFormatException,
    );
    expect(await const FlutterSecureStorage().readAll(), isEmpty);
  });
}
