import 'dart:async';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/media_service.dart';

Map<String, dynamic> asset(String id) => {
  'id': id,
  'store_id': 'site-a',
  'filename': '$id.png',
  'url': 'https://synthetic.invalid/$id.png',
  'mime_type': 'image/png',
  'media_type': 'image',
  'size_bytes': 9,
};

class LateUpload extends MediaService {
  LateUpload(ApiClient api, this.retire)
    : super(api: api, actorIdProvider: () => 'synthetic-owner');
  final void Function() retire;
  @override
  Future<FileUploadResultContract> uploadFile(
    File file, {
    String folder = 'media',
    String? storeId,
    String? idempotencyKey,
    String? sha256Hex,
    String? filename,
  }) async {
    retire();
    return FileUploadResultContract.fromJson({
      'url': 'https://synthetic.invalid/photo.png',
      'key': 'site-a/photo.png',
      'size': 9,
      'content_type': 'image/png',
    });
  }
}

void main() {
  test(
    'media population disappears immediately when account context retires',
    () async {
      var epoch = 1;
      final api = ApiClient(
        baseUrl: 'https://synthetic.invalid/v1',
        maxRetries: 0,
        contextVersionProvider: () => epoch,
      );
      addTearDown(api.close);
      api.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) => h.resolve(
            Response(
              requestOptions: o,
              statusCode: 200,
              data: {
                'data': [asset('one')],
                'meta': {'has_next': false},
              },
            ),
          ),
        ),
      );
      final service = MediaService(api: api);
      addTearDown(service.dispose);
      await service.fetchMedia('site-a');
      expect(service.assets.single.id, 'one');
      epoch++;
      expect(service.assets, isEmpty);
    },
  );
  test(
    'upload completion under a new account cannot dispatch media creation',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final dir = Directory.systemTemp.createTempSync('media-retired-');
      addTearDown(() => dir.deleteSync(recursive: true));
      final file = File('${dir.path}/photo.png')..writeAsBytesSync([1, 2, 3]);
      var epoch = 1, creates = 0;
      final api = ApiClient(
        baseUrl: 'https://synthetic.invalid/v1',
        maxRetries: 0,
        contextVersionProvider: () => epoch,
      );
      addTearDown(api.close);
      api.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            creates++;
            h.resolve(
              Response(
                requestOptions: o,
                statusCode: 200,
                data: {'data': asset('created')},
              ),
            );
          },
        ),
      );
      final service = LateUpload(api, () => epoch++);
      addTearDown(service.dispose);
      await expectLater(
        service.uploadAndCreate(storeId: 'site-a', file: file),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      expect(creates, 0);
    },
  );
  test('older media query cannot replace a newer search result', () async {
    final pending = <(RequestOptions, RequestInterceptorHandler)>[];
    final arrived = Completer<void>();
    final api = ApiClient(
      baseUrl: 'https://synthetic.invalid/v1',
      maxRetries: 0,
    );
    addTearDown(api.close);
    api.dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, h) {
          pending.add((o, h));
          if (pending.length == 2) arrived.complete();
        },
      ),
    );
    final service = MediaService(api: api);
    addTearDown(service.dispose);
    final old = service.fetchMedia('site-a', search: 'old');
    final rejection = expectLater(old, throwsA(isA<ApiException>()));
    final fresh = service.fetchMedia('site-a', search: 'new');
    await arrived.future;
    void reply(int i, String id) {
      final (o, h) = pending[i];
      h.resolve(
        Response(
          requestOptions: o,
          statusCode: 200,
          data: {
            'data': [asset(id)],
            'meta': {'has_next': false},
          },
        ),
      );
    }

    reply(1, 'new');
    await fresh;
    reply(0, 'old');
    await rejection;
    expect(service.assets.single.id, 'new');
  });
}
