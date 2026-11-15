// Transport fixtures exercise client recovery only; owned Gateway/PG tests prove server receipts.
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/media_service.dart';

class Fixture {
  Fixture() {
    api = ApiClient(
      baseUrl: 'https://synthetic.invalid/v1',
      maxRetries: 0,
      contextVersionProvider: () => epoch,
    );
    api.dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, h) {
          calls.add(o);
          if (o.path.endsWith('/upload/recover')) {
            if (!receiptReady) {
              h.reject(
                DioException(
                  requestOptions: o,
                  response: Response(
                    requestOptions: o,
                    statusCode: 409,
                    data: {
                      'error': {'code': 'CONFLICT', 'message': 'Unconfirmed'},
                    },
                  ),
                  type: DioExceptionType.badResponse,
                ),
              );
              return;
            }
            h.resolve(
              Response(
                requestOptions: o,
                statusCode: 200,
                data: {
                  'data': {
                    'store_id': selected,
                    'url': inline
                        ? 'data:image/png;base64,AQID'
                        : 'https://synthetic.invalid/photo.png',
                    'key': 'public-media/synthetic/photo.png',
                    'size': 3,
                    'content_type': mimeType,
                  },
                },
              ),
            );
            return;
          }
          if (o.path.endsWith('/upload')) {
            uploads++;
            beforeUploadReturn?.call();
            if (loseUpload) {
              h.reject(
                DioException(
                  requestOptions: o,
                  type: DioExceptionType.receiveTimeout,
                ),
              );
              return;
            }
            h.resolve(
              Response(
                requestOptions: o,
                statusCode: 201,
                data: {
                  'data': {
                    'store_id': selected,
                    'url': inline
                        ? 'data:image/png;base64,AQID'
                        : 'https://synthetic.invalid/photo.png',
                    'key': 'public-media/synthetic/photo.png',
                    'size': 3,
                    'content_type': mimeType,
                  },
                },
              ),
            );
            return;
          }
          if (o.path.endsWith('/media') && o.method == 'POST') {
            final key = o.headers['X-Idempotency-Key'] as String;
            entries.putIfAbsent(
              key,
              () => Map<String, dynamic>.from(o.data as Map),
            );
            if (loseCreate) {
              h.reject(
                DioException(
                  requestOptions: o,
                  type: DioExceptionType.receiveTimeout,
                ),
              );
              return;
            }
            h.resolve(
              Response(
                requestOptions: o,
                statusCode: 201,
                data: {
                  'data': {
                    ...entries[key]!,
                    'id': 'media-one',
                    'media_type': 'image',
                  },
                },
              ),
            );
            return;
          }
          h.resolve(
            Response(
              requestOptions: o,
              statusCode: 200,
              data: {'data': <Object>[]},
            ),
          );
        },
      ),
    );
  }
  late ApiClient api;
  int epoch = 1, uploads = 0;
  String mimeType = 'image/png';
  String? actor = 'synthetic-owner', selected = 'site-a';
  bool loseUpload = false,
      loseCreate = true,
      receiptReady = false,
      inline = false;
  void Function()? beforeUploadReturn;
  final calls = <RequestOptions>[];
  final entries = <String, Map<String, dynamic>>{};
  MediaService service() => MediaService(
    api: api,
    actorIdProvider: () => actor,
    storeIdProvider: () => selected,
  );
  Future<MediaAssetContract> upload(MediaService s, File file) =>
      s.uploadAndCreate(
        storeId: 'site-a',
        file: file,
        altText: 'Original label',
        tags: ['original'],
      );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory dir;
  late File file;
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    dir = Directory.systemTemp.createTempSync('media-recovery-');
    file = File('${dir.path}/photo.png')..writeAsBytesSync([1, 2, 3]);
  });
  tearDown(() => dir.deleteSync(recursive: true));

  test(
    'lost create acknowledgement resumes original payload/key after service restart without the file',
    () async {
      final f = Fixture();
      addTearDown(f.api.close);
      final s = f.service();
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      expect(s.canResumeUpload, isTrue);
      expect(f.uploads, 1);
      final original = f.calls.last;
      final key = original.headers['X-Idempotency-Key'];
      final payload = Map<String, dynamic>.from(original.data as Map);
      s.dispose();
      file.deleteSync();
      final recovered = f.service();
      addTearDown(recovered.dispose);
      await recovered.fetchMedia('site-a');
      expect(recovered.canResumeUpload, isTrue);
      f.loseCreate = false;
      final result = await recovered.resumeUpload('site-a');
      expect(result.id, 'media-one');
      expect(f.calls.last.headers['X-Idempotency-Key'], key);
      expect(f.calls.last.data, payload);
      expect(f.entries, hasLength(1));
      expect(f.uploads, 1);
      expect(recovered.hasPendingUpload, isFalse);
      expect(await const FlutterSecureStorage().readAll(), isEmpty);
    },
  );

  test(
    'unknown storage response stays held through restart and never submits another file',
    () async {
      final f = Fixture()..loseUpload = true;
      addTearDown(f.api.close);
      final s = f.service();
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      expect(s.isUploadStored, isFalse);
      expect(s.canResumeUpload, isTrue);
      s.dispose();
      final recovered = f.service();
      addTearDown(recovered.dispose);
      await recovered.fetchMedia('site-a');
      expect(recovered.hasPendingUpload, isTrue);
      expect(recovered.uploadRecoveryMessage, contains('may have received'));
      await expectLater(
        f.upload(recovered, file),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'MEDIA_UPLOAD_NEEDS_REVIEW',
          ),
        ),
      );
      await expectLater(
        recovered.resumeUpload('site-a'),
        throwsA(isA<ApiException>()),
      );
      expect(f.uploads, 1);
      expect(f.entries, isEmpty);
      final saved =
          (await const FlutterSecureStorage().readAll()).values.single;
      expect(saved, contains('upload_pending'));
      expect(saved, contains('sha256'));
      expect(saved, isNot(contains(file.path)));
      expect(saved, isNot(contains('[1,2,3]')));
    },
  );

  test(
    'pending known create is explicit and cannot silently accept a newly picked file',
    () async {
      final f = Fixture();
      addTearDown(f.api.close);
      final s = f.service();
      addTearDown(s.dispose);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      file.writeAsBytesSync([7, 8, 9]);
      await expectLater(
        s.uploadAndCreate(storeId: 'site-a', file: file, altText: 'Changed'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'MEDIA_UPLOAD_NEEDS_REVIEW',
          ),
        ),
      );
      expect(f.uploads, 1);
      expect(f.entries, hasLength(1));
      expect(f.entries.values.single['alt_text'], 'Original label');
    },
  );

  test(
    'actor or store transition after storage response blocks follow-on creation',
    () async {
      for (final changeActor in [true, false]) {
        FlutterSecureStorage.setMockInitialValues({});
        final f = Fixture();
        final s = f.service();
        f.beforeUploadReturn = () {
          f.epoch++;
          if (changeActor) {
            f.actor = 'other-owner';
          } else {
            f.selected = 'site-b';
          }
        };
        await expectLater(
          f.upload(s, file),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'SESSION_CONTEXT_CHANGED',
            ),
          ),
        );
        expect(f.entries, isEmpty);
        expect(f.uploads, 1);
        expect(s.hasPendingUpload, isFalse);
        s.dispose();
        f.api.close();
      }
    },
  );

  test(
    'another actor cannot discover or resume the original saved command',
    () async {
      final f = Fixture();
      addTearDown(f.api.close);
      final s = f.service();
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      s.dispose();
      f.actor = 'other-owner';
      f.epoch++;
      final other = f.service();
      addTearDown(other.dispose);
      await other.fetchMedia('site-a');
      expect(other.hasPendingUpload, isFalse);
      await expectLater(
        other.resumeUpload('site-a'),
        throwsA(isA<ApiException>()),
      );
      expect(f.uploads, 1);
      expect(f.entries, hasLength(1));
    },
  );

  test(
    'lost upload response recovers its committed server receipt without the original file',
    () async {
      final f = Fixture()..loseUpload = true;
      addTearDown(f.api.close);
      final s = f.service();
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      final key = f.calls.single.headers['X-Idempotency-Key'];
      s.dispose();
      file.deleteSync();
      f.receiptReady = true;
      f.loseCreate = false;
      final recovered = f.service();
      addTearDown(recovered.dispose);
      await recovered.fetchMedia('site-a');
      final result = await recovered.resumeUpload('site-a');
      expect(result.id, 'media-one');
      expect(f.uploads, 1);
      final request = f.calls.singleWhere(
        (r) => r.path.endsWith('/upload/recover'),
      );
      expect((request.data as Map)['idempotency_key'], key);
      expect((request.data as Map)['sha256_hex'], hasLength(64));
      expect(recovered.hasPendingUpload, isFalse);
    },
  );

  test(
    'inline development file bytes never enter encrypted recovery metadata',
    () async {
      final f = Fixture()..inline = true;
      addTearDown(f.api.close);
      final s = f.service();
      addTearDown(s.dispose);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      expect(f.entries, isEmpty);
      final saved =
          (await const FlutterSecureStorage().readAll()).values.single;
      expect(saved, isNot(contains('data:image')));
      expect(saved, isNot(contains('AQID')));
      expect(saved, contains('upload_pending'));
    },
  );

  test(
    'missing actor blocks file effects and encrypted command creation',
    () async {
      final f = Fixture()..actor = null;
      addTearDown(f.api.close);
      final s = f.service();
      addTearDown(s.dispose);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      expect(f.calls, isEmpty);
      expect(await const FlutterSecureStorage().readAll(), isEmpty);
    },
  );
  test(
    'explicit original-file retry retains its key, filename and metadata after a new picker cache path',
    () async {
      final f = Fixture()..loseUpload = true;
      addTearDown(f.api.close);
      final s = f.service();
      addTearDown(s.dispose);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      final key = f.calls.single.headers['X-Idempotency-Key'];
      final chosen = File('${dir.path}/new-picker-cache-name.png')
        ..writeAsBytesSync([1, 2, 3]);
      f.loseUpload = false;
      f.loseCreate = false;
      await s.retryUploadWithOriginal('site-a', chosen);
      final uploadCalls = f.calls
          .where((r) => r.path.endsWith('/upload'))
          .toList();
      expect(uploadCalls, hasLength(2));
      expect(uploadCalls.last.headers['X-Idempotency-Key'], key);
      final form = uploadCalls.last.data as FormData;
      expect(form.files.single.value.filename, 'photo.png');
      expect(Map.fromEntries(form.fields)['sha256_hex'], hasLength(64));
      expect(f.entries.values.single['alt_text'], 'Original label');
      expect(s.hasPendingUpload, isFalse);
    },
  );
  test(
    'changed bytes or size cannot dispatch an original-file retry',
    () async {
      final f = Fixture()..loseUpload = true;
      addTearDown(f.api.close);
      final s = f.service();
      addTearDown(s.dispose);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      final calls = f.calls.length;
      for (final bytes in [
        [7, 8, 9],
        [1, 2, 3, 4],
      ]) {
        file.writeAsBytesSync(bytes);
        await expectLater(
          s.retryUploadWithOriginal('site-a', file),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'MEDIA_UPLOAD_INPUT_CHANGED',
            ),
          ),
        );
      }
      expect(f.calls, hasLength(calls));
      expect(s.hasPendingUpload, isTrue);
    },
  );
  test(
    'another actor cannot reselect bytes into the original encrypted operation',
    () async {
      final f = Fixture()..loseUpload = true;
      addTearDown(f.api.close);
      final s = f.service();
      addTearDown(s.dispose);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      f.actor = 'another-owner';
      f.epoch++;
      await expectLater(
        s.retryUploadWithOriginal('site-a', file),
        throwsA(isA<ApiException>()),
      );
      expect(f.uploads, 1);
      expect(f.entries, isEmpty);
    },
  );
}
