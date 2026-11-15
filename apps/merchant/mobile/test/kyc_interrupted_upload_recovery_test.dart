import 'dart:io';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/kyc_service.dart';

const site = 'd7194463-3cdb-4e2a-850b-cb048986adad';
const receipt = '2c73a536-4dc4-4df1-92d4-89d0c8b51d99';

class ReceiptClient extends http.BaseClient {
  ReceiptClient({
    this.version = 'synthetic-version+1',
    this.status = 201,
    this.stalled = false,
  });
  final bool stalled;
  final body = StreamController<List<int>>();
  final int status;
  final String version;
  int closes = 0;
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    expect(request.url.host, 'privatekyc.s3.ap-south-1.amazonaws.com');
    expect(request.followRedirects, isFalse);
    expect(
      request.headers.keys.map((k) => k.toLowerCase()),
      isNot(anyOf(contains('authorization'), contains('cookie'))),
    );
    await request.finalize().drain<void>();
    return http.StreamedResponse(
      stalled
          ? body.stream
          : Stream<List<int>>.error(
              const SocketException(
                'Synthetic response body interrupted after stored receipt',
              ),
            ),
      status,
      headers: {'x-amz-version-id': version},
    );
  }

  @override
  void close() {
    closes++;
    if (stalled) unawaited(body.close());
  }
}

class Fixture {
  Fixture() {
    api = ApiClient(
      baseUrl: 'https://synthetic.invalid/v1',
      dio: dio,
      maxRetries: 0,
      contextVersionProvider: () => epoch,
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, h) {
          calls.add(o);
          Object data = overview;
          if (o.path.endsWith('/upload-intent')) {
            if (loseIntent) {
              loseIntent = false;
              h.reject(
                DioException(
                  requestOptions: o,
                  type: DioExceptionType.receiveTimeout,
                ),
              );
              return;
            }
            data = {
              'receipt_id': receipt,
              'method': 'POST',
              'url': 'https://privatekyc.s3.ap-south-1.amazonaws.com/',
              'fields': {'key': 'kyc/$site/bank_proof/$receipt'},
              'maximum_object_bytes': 5242880,
              'expires_at': DateTime.now()
                  .add(const Duration(minutes: 2))
                  .toIso8601String(),
            };
          } else if (o.path.endsWith('/upload-complete') ||
              o.path.endsWith('/upload')) {
            if (loseCompletion) {
              loseCompletion = false;
              h.reject(
                DioException(
                  requestOptions: o,
                  type: DioExceptionType.receiveTimeout,
                ),
              );
              return;
            }
            data = {
              'receipt_id': receipt,
              'document_status': completionStatus,
              'evidence_scan_status': scanStatus,
              'overview': overview,
            };
          }
          h.resolve(
            Response(requestOptions: o, statusCode: 200, data: {'data': data}),
          );
        },
      ),
    );
  }
  final Dio dio = Dio();
  late final ApiClient api;
  int epoch = 1, posts = 0;
  Object completionStatus = 'submitted', scanStatus = 'pending';
  bool loseCompletion = true,
      loseObject = false,
      loseIntent = false,
      privateMode = false;
  String? actor = 'synthetic-actor', selected = site;
  void Function()? beforeObjectReturn;
  final calls = <RequestOptions>[];
  Map<String, dynamic> get overview => {
    'site_id': site,
    'overall_status': 'in_progress',
    'provider_mode': 'sandbox',
    'documents': <Object>[],
    'private_upload_available': privateMode,
    'india_direct_upload_available': !privateMode,
  };
  KycService service() => KycService(
    api: api,
    actorIdProvider: () => actor,
    storeIdProvider: () => selected,
    postIndiaObject: (_, _, _, _) async {
      posts++;
      if (loseObject)
        throw const SocketException('Synthetic lost object response');
      beforeObjectReturn?.call();
      return 'synthetic-version+1';
    },
  );
  Future<void> upload(KycService s, File file) async {
    await s.uploadDocument(
      storeId: site,
      documentType: 'bank_proof',
      documentNumberLast4: '1234',
      file: file,
    );
  }

  List<RequestOptions> get completions =>
      calls.where((c) => c.path.endsWith('/upload-complete')).toList();
  Object? key(RequestOptions o) => o.headers.entries
      .firstWhere((e) => e.key.toLowerCase() == 'x-idempotency-key')
      .value;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory dir;
  late File file;
  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    dir = await Directory.systemTemp.createTemp('letbuyy-kyc-recovery-');
    file = await File(
      '${dir.path}/proof.png',
    ).writeAsBytes([137, 80, 78, 71, 13, 10, 26, 10, 1]);
  });
  tearDown(() => dir.delete(recursive: true));
  test('known storage version survives an interrupted response body', () async {
    final f = Fixture()..loseCompletion = false;
    final client = ReceiptClient();
    final service = KycService(
      api: f.api,
      actorIdProvider: () => f.actor,
      storeIdProvider: () => f.selected,
      indiaClientFactory: () => client,
    );
    addTearDown(service.dispose);
    await service.fetchOverview(site);
    await f.upload(service, file);
    expect(f.completions, hasLength(1));
    expect(f.completions.single.data['version_id'], 'synthetic-version+1');
    expect(service.hasPendingUpload, isFalse);
    expect(client.closes, 1);
  });
  test(
    'known version confirmation is bounded when the response body never ends',
    () async {
      final f = Fixture()..loseCompletion = false;
      final client = ReceiptClient(stalled: true);
      final service = KycService(
        api: f.api,
        actorIdProvider: () => f.actor,
        storeIdProvider: () => f.selected,
        indiaClientFactory: () => client,
      );
      addTearDown(service.dispose);
      await service.fetchOverview(site);
      await f.upload(service, file);
      expect(f.completions, hasLength(1));
      expect(f.completions.single.data['version_id'], 'synthetic-version+1');
      expect(service.hasPendingUpload, isFalse);
      expect(client.closes, 1);
      expect(client.body.isClosed, isTrue);
    },
    timeout: const Timeout(Duration(seconds: 20)),
  );
  for (final invalid in ['version', 'status']) {
    test(
      'interrupted body cannot substitute for a valid storage $invalid',
      () async {
        final f = Fixture()..loseCompletion = false;
        final client = ReceiptClient(
          version: invalid == 'version' ? 'null' : 'synthetic-version+1',
          status: invalid == 'status' ? 400 : 201,
        );
        final service = KycService(
          api: f.api,
          actorIdProvider: () => f.actor,
          storeIdProvider: () => f.selected,
          indiaClientFactory: () => client,
        );
        addTearDown(service.dispose);
        await service.fetchOverview(site);
        await expectLater(
          f.upload(service, file),
          throwsA(isA<ApiException>()),
        );
        expect(f.completions, isEmpty);
        expect(service.uploadRecoveryMessage, contains('needs review'));
        expect(client.closes, 1);
      },
    );
  }
  test(
    'lost completion retains original key/version after service restart without reposting bytes',
    () async {
      final f = Fixture();
      var s = f.service();
      await s.fetchOverview(site);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      s.dispose();
      s = f.service();
      addTearDown(s.dispose);
      await s.fetchOverview(site);
      await f.upload(s, file);
      expect(
        f.posts,
        1,
        reason: 'Completion retry must never POST another object.',
      );
      expect(f.completions, hasLength(2));
      expect(f.key(f.completions[1]), f.key(f.completions[0]));
      expect(f.completions[1].data, f.completions[0].data);
      expect(
        f.calls.where((c) => c.path.endsWith('/upload-intent')),
        hasLength(1),
      );
    },
  );
  test(
    'lost object response cannot allocate a new intent or post again',
    () async {
      final f = Fixture()..loseObject = true;
      var s = f.service();
      await s.fetchOverview(site);
      await expectLater(f.upload(s, file), throwsA(anything));
      s.dispose();
      s = f.service();
      addTearDown(s.dispose);
      await s.fetchOverview(site);
      await expectLater(f.upload(s, file), throwsA(anything));
      expect(
        f.posts,
        1,
        reason: 'Unknown storage version requires reconciliation.',
      );
      expect(
        f.calls.where((c) => c.path.endsWith('/upload-intent')),
        hasLength(1),
      );
      expect(f.completions, isEmpty);
    },
  );
  test(
    'known version resumes without selecting or retaining the original photo',
    () async {
      final f = Fixture();
      var s = f.service();
      await s.fetchOverview(site);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      s.dispose();
      await file.delete();
      s = f.service();
      addTearDown(s.dispose);
      await s.fetchOverview(site);
      expect(s.canResumeUpload, isTrue);
      await s.resumeUpload(site);
      expect(f.posts, 1);
      expect(f.completions, hasLength(2));
      expect(f.key(f.completions.first), f.key(f.completions.last));
      expect(s.hasPendingUpload, isFalse);
    },
  );
  test(
    'lost intent retries the saved key after restart before one object POST',
    () async {
      final f = Fixture()
        ..loseIntent = true
        ..loseCompletion = false;
      var s = f.service();
      await s.fetchOverview(site);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      s.dispose();
      s = f.service();
      addTearDown(s.dispose);
      await s.fetchOverview(site);
      await f.upload(s, file);
      final intents = f.calls
          .where((c) => c.path.endsWith('/upload-intent'))
          .toList();
      expect(intents, hasLength(2));
      expect(f.key(intents.first), f.key(intents.last));
      expect(f.posts, 1);
      expect(s.hasPendingUpload, isFalse);
    },
  );
  test(
    'changed file is refused before a pending confirmation is dispatched',
    () async {
      final f = Fixture();
      final s = f.service();
      addTearDown(s.dispose);
      await s.fetchOverview(site);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      final count = f.calls.length;
      await file.writeAsBytes([137, 80, 78, 71, 13, 10, 26, 10, 2]);
      await expectLater(
        f.upload(s, file),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'PENDING_SECURITY_COMMAND',
          ),
        ),
      );
      expect(f.calls.length, count);
      expect(f.posts, 1);
    },
  );
  for (final missing in ['actor', 'store', 'wrong-store']) {
    test('$missing authority refuses file I/O and HTTP', () async {
      final f = Fixture();
      final s = f.service();
      addTearDown(s.dispose);
      await s.fetchOverview(site);
      if (missing == 'actor') f.actor = null;
      if (missing == 'store') f.selected = null;
      if (missing == 'wrong-store') f.selected = 'foreign';
      final count = f.calls.length;
      await expectLater(
        f.upload(s, File('/missing-private-file')),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      expect(f.calls.length, count);
      expect(f.posts, 0);
    });
  }
  test(
    'actor switch after object POST leaves held original command and no completion',
    () async {
      final f = Fixture();
      final s = f.service();
      addTearDown(s.dispose);
      await s.fetchOverview(site);
      f.beforeObjectReturn = () {
        f.actor = 'another-actor';
        f.epoch++;
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
      expect(f.completions, isEmpty);
      expect(s.hasPendingUpload, isFalse);
      f.actor = 'synthetic-actor';
      f.epoch++;
      await s.fetchOverview(site);
      expect(s.canResumeUpload, isFalse);
      expect(s.uploadRecoveryMessage, contains('needs review'));
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      expect(f.posts, 1);
    },
  );
  test(
    'private multipart retries the same request key and keeps no file or ticket secrets',
    () async {
      final f = Fixture()..privateMode = true;
      var s = f.service();
      await s.fetchOverview(site);
      await expectLater(f.upload(s, file), throwsA(isA<ApiException>()));
      final retained = await const FlutterSecureStorage().readAll();
      expect(retained, hasLength(1));
      final raw = retained.values.single;
      expect(raw, isNot(contains(file.path)));
      expect(raw, isNot(contains('proof.png')));
      expect(raw, isNot(contains('amazonaws.com')));
      expect(raw, contains('sha256_hex'));
      s.dispose();
      s = f.service();
      addTearDown(s.dispose);
      await s.fetchOverview(site);
      await f.upload(s, file);
      final writes = f.calls.where((c) => c.path.endsWith('/upload')).toList();
      expect(writes, hasLength(2));
      expect(f.key(writes.first), f.key(writes.last));
      expect(f.posts, 0);
      expect(await const FlutterSecureStorage().readAll(), isEmpty);
    },
  );
  for (final bad in [
    ('status', 'unrecognized'),
    ('status', true),
    ('scan', 'unrecognized'),
    ('scan', true),
  ]) {
    test(
      'malformed ${bad.$1} acknowledgement retains the known version for no-file confirmation',
      () async {
        FlutterSecureStorage.setMockInitialValues({});
        final f = Fixture()..loseCompletion = false;
        if (bad.$1 == 'status') {
          f.completionStatus = bad.$2;
        } else {
          f.scanStatus = bad.$2;
        }
        final s = f.service();
        addTearDown(s.dispose);
        addTearDown(f.api.close);
        final dir = Directory.systemTemp.createTempSync('kyc-bad-confirm-');
        addTearDown(() => dir.deleteSync(recursive: true));
        final file = File('${dir.path}/proof.png')
          ..writeAsBytesSync([137, 80, 78, 71, 13, 10, 26, 10, 1]);
        await s.fetchOverview(site);
        await expectLater(
          f.upload(s, file),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'KYC_UPLOAD_CONFIRMATION_INVALID',
            ),
          ),
        );
        expect(s.canResumeUpload, isTrue);
        expect(f.posts, 1);
        final key = f.key(f.completions.first);
        file.deleteSync();
        f.completionStatus = 'submitted';
        f.scanStatus = 'pending';
        await s.resumeUpload(site);
        expect(s.hasPendingUpload, isFalse);
        expect(f.posts, 1);
        expect(f.key(f.completions.last), key);
      },
    );
  }
}
