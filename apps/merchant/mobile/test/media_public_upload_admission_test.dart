import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'media_interrupted_upload_recovery_test.dart' as recovery;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    directory = Directory.systemTemp.createTempSync(
      'merchant-public-admission-',
    );
  });
  tearDown(() => directory.deleteSync(recursive: true));

  for (final extension in ['usdz', 'pdf', 'svg', 'm4v']) {
    test(
      'unsupported $extension creates no public upload or saved command',
      () async {
        final f = recovery.Fixture()..loseUpload = true;
        addTearDown(f.api.close);
        final service = f.service();
        addTearDown(service.dispose);
        final file = File('${directory.path}/synthetic.$extension')
          ..writeAsBytesSync([1, 2, 3]);
        await expectLater(f.upload(service, file), throwsA(anything));
        expect(f.uploads, 0);
        expect(await const FlutterSecureStorage().readAll(), isEmpty);
        expect(service.hasPendingUpload, isFalse);
      },
    );
  }

  test(
    'oversized model starts no bytes and retains no fresh command',
    () async {
      final f = recovery.Fixture()..loseUpload = true;
      addTearDown(f.api.close);
      final service = f.service();
      addTearDown(service.dispose);
      final file = File('${directory.path}/oversized.glb');
      final handle = file.openSync(mode: FileMode.write);
      handle.truncateSync(50 * 1024 * 1024 + 1);
      handle.closeSync();
      await expectLater(f.upload(service, file), throwsA(anything));
      expect(f.uploads, 0);
      expect(await const FlutterSecureStorage().readAll(), isEmpty);
    },
  );

  for (final ext in ['glb', 'gltf', 'mp4', 'mov', 'webm']) {
    test(
      'original $ext retry preserves MIME key and filename across a new picker path',
      () async {
        final f = recovery.Fixture()..loseUpload = true;
        f.mimeType = {
          'glb': 'model/gltf-binary',
          'gltf': 'model/gltf+json',
          'mp4': 'video/mp4',
          'mov': 'video/quicktime',
          'webm': 'video/webm',
        }[ext]!;
        addTearDown(f.api.close);
        final initial = f.service();
        addTearDown(initial.dispose);
        final file = File('${directory.path}/original.$ext')
          ..writeAsBytesSync([1, 2, 3]);
        await expectLater(f.upload(initial, file), throwsA(anything));
        final key = f.calls.single.headers['X-Idempotency-Key'];
        final restarted = f.service();
        addTearDown(restarted.dispose);
        await restarted.fetchMedia('site-a');
        expect(restarted.canReselectOriginal, isTrue);
        f.loseUpload = false;
        f.loseCreate = false;
        final reselected = File('${directory.path}/new-provider-cache.bin')
          ..writeAsBytesSync([1, 2, 3]);
        await restarted.retryUploadWithOriginal('site-a', reselected);
        final uploads = f.calls
            .where((call) => call.path.endsWith('/upload'))
            .toList();
        expect(uploads, hasLength(2));
        expect(uploads.last.headers['X-Idempotency-Key'], key);
        final part = (uploads.last.data as FormData).files.single.value;
        expect(part.filename, 'original.$ext');
        expect(part.contentType.toString(), f.mimeType);
        expect(f.entries.values.single['filename'], 'original.$ext');
        expect(f.entries.values.single['mime_type'], f.mimeType);
        expect(restarted.hasPendingUpload, isFalse);
      },
    );
  }

  test(
    'a retained interrupted GLTF upload permits original-file reselection',
    () async {
      final f = recovery.Fixture();
      addTearDown(f.api.close);
      await SecurityCommandStore().prepare(
        (actorId: 'synthetic-owner', storeId: 'site-a', version: f.epoch),
        'media-upload',
        {
          'stage': 'upload_pending',
          'input': {
            'store_id': 'site-a',
            'filename': 'synthetic.gltf',
            'folder': 'media',
            'content_type': 'model/gltf+json',
            'sha256': 'a' * 64,
            'size_bytes': 3,
          },
        },
        check: () {},
      );
      final service = f.service();
      addTearDown(service.dispose);
      await service.fetchMedia('site-a');
      expect(service.hasPendingUpload, isTrue);
      expect(service.canReselectOriginal, isTrue);
      expect(f.uploads, 0);
    },
  );
}
