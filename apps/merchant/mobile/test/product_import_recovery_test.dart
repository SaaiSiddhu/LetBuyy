import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

const site = '11111111-1111-4111-8111-111111111111',
    actorA = '22222222-2222-4222-8222-222222222222',
    actorB = '33333333-3333-4333-8333-333333333333';
const jobId = '44444444-4444-4444-8444-444444444444',
    csv = 'name,price\nSynthetic shirt,10.50';
JsonMap job(String key, String hash, {String actor = actorA}) => {
  'id': jobId,
  'type': 'product_import',
  'contract_version': 2,
  'store_id': site,
  'actor_id': actor,
  'idempotency_key': key,
  'source_sha256': hash,
  'status': 'queued',
  'total_rows': 1,
  'row_count': 0,
  'failed_rows': 0,
  'pending_rows': 1,
  'stopped_rows': 0,
  'resumable': true,
  'error_code': null,
  'created_at': '2026-11-01T00:00:00Z',
  'updated_at': '2026-11-01T00:00:00Z',
  'started_at': null,
  'completed_at': null,
  'download_url': null,
};

class Harness {
  Harness() {
    api = ApiClient(
      baseUrl: 'https://gateway.synthetic.invalid/v1',
      dio: dio,
      maxRetries: 0,
      contextVersionProvider: () => epoch,
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (r, h) async {
          if (r.path.endsWith('/capabilities')) {
            entered?.complete();
            entered = null;
            await hold?.future;
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 200,
                data: {
                  'data': {
                    'store_id': site,
                    'actor_id': actor,
                    'contract_version': legacy ? 1 : 2,
                    'max_rows': 500,
                    'max_bytes': 1048576,
                    'durable_registration': true,
                    'durable_rows': true,
                    'async_recovery': true,
                  },
                },
              ),
            );
            return;
          }
          if (r.method == 'GET' && r.path.contains('/by-key/')) {
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 200,
                data: {
                  'data': {
                    'job':
                        registered?['idempotency_key'] == r.path.split('/').last
                        ? registered
                        : null,
                  },
                },
              ),
            );
            return;
          }
          if (r.method == 'POST') {
            writes.add(r);
            final body = asJsonMap(r.data);
            expect(r.headers['X-Idempotency-Key'], body['idempotency_key']);
            if (r.path.endsWith('/stop-registration')) {
              final original = registered;
              registered = {
                ...(original ??
                    job(body['idempotency_key'], body['source_sha256'])),
                'status': 'stopped',
                'total_rows': original?['total_rows'] ?? 0,
                'pending_rows': 0,
                'failed_rows': 0,
                'stopped_rows': original?['total_rows'] ?? 0,
                'resumable': false,
                'error_code': 'PRODUCT_IMPORT_STOPPED',
                'completed_at': '2026-11-01T00:00:01Z',
              };
              if (loseStopAck) {
                h.reject(
                  DioException(
                    requestOptions: r,
                    type: DioExceptionType.connectionTimeout,
                  ),
                );
                return;
              }
              h.resolve(
                Response(
                  requestOptions: r,
                  statusCode: 200,
                  data: {
                    'data': {'job': unconfirmedStop ? original : registered},
                  },
                ),
              );
              return;
            }
            expect(
              r.path.endsWith('/export/imports/register'),
              isTrue,
              reason:
                  'A v2 client must never enter the old import-products handler.',
            );
            if (invalid) {
              h.resolve(
                Response(
                  requestOptions: r,
                  statusCode: 400,
                  data: {
                    'error': {
                      'code': 'INVALID_CSV',
                      'message': 'CSV contains an unclosed quote.',
                    },
                  },
                ),
              );
              return;
            }
            registered = job(
              body['idempotency_key'],
              productImportSourceSha256(body['csv']),
              actor: forged ? actorB : actor,
            );
            if (!commitRegistration && lost) registered = null;
            if (lost) {
              h.reject(
                DioException(
                  requestOptions: r,
                  type: DioExceptionType.connectionTimeout,
                ),
              );
              return;
            }
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 202,
                data: {
                  'data': {'job': registered},
                },
              ),
            );
            return;
          }
          h.reject(
            DioException(
              requestOptions: r,
              error: StateError('Unexpected synthetic request'),
            ),
          );
        },
      ),
    );
    service = fresh();
  }
  final dio = Dio(), storage = MemoryStorage();
  late ApiClient api;
  late ProductService service;
  String actor = actorA;
  int epoch = 1;
  bool legacy = false, lost = false, forged = false, invalid = false;
  bool commitRegistration = true, loseStopAck = false, unconfirmedStop = false;
  JsonMap? registered;
  final writes = <RequestOptions>[];
  Completer<void>? entered, hold;
  ProductService fresh() => ProductService(
    api: api,
    actorIdProvider: () => actor,
    storeIdProvider: () => site,
    commands: SecurityCommandStore(storage: storage, environment: 'staging'),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'lost registration ack survives service restart and recovers the original job without another POST',
    () async {
      final h = Harness()..lost = true;
      await expectLater(
        h.service.importProductCsv(site, csv),
        throwsA(isA<ApiException>()),
      );
      final pending = await h.service.pendingCsvImport(site);
      expect(pending, isNotNull);
      expect(h.storage.data.values.single, isNot(contains(csv)));
      expect(h.writes.length, 1);
      final recovered = await h.fresh().recoverCsvRegistration(site);
      expect(recovered?.id, jobId);
      expect(recovered?.key, pending!.key);
      expect(h.writes.length, 1);
      expect(h.storage.data, isEmpty);
    },
  );
  test(
    'changed source cannot replace an uncertain original registration or mint a second write',
    () async {
      final h = Harness()..lost = true;
      await expectLater(
        h.service.importProductCsv(site, csv),
        throwsA(isA<ApiException>()),
      );
      await expectLater(
        h.fresh().importProductCsv(site, '$csv\nOther,20'),
        throwsA(isA<ApiException>()),
      );
      expect(h.writes.length, 1);
      expect(h.storage.data.length, 1);
    },
  );
  test(
    'forged actor acknowledgement stays unresolved and retains original encrypted intent',
    () async {
      final h = Harness()..forged = true;
      await expectLater(
        h.service.importProductCsv(site, csv),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'PRODUCT_IMPORT_UNCONFIRMED',
          ),
        ),
      );
      expect(h.storage.data.length, 1);
      await expectLater(
        h.fresh().recoverCsvRegistration(site),
        throwsA(isA<ApiException>()),
      );
      expect(h.storage.data.length, 1);
    },
  );
  test(
    'old backend and failed encrypted storage prevent submission before the POST',
    () async {
      final old = Harness()..legacy = true;
      await expectLater(
        old.service.importProductCsv(site, csv),
        throwsA(isA<FormatException>()),
      );
      expect(old.writes, isEmpty);
      expect(old.storage.data, isEmpty);
      final failed = Harness();
      failed.storage.failWrite = true;
      await expectLater(
        failed.service.importProductCsv(site, csv),
        throwsA(isA<StateError>()),
      );
      expect(failed.writes, isEmpty);
    },
  );
  test(
    'an actor change while capability lookup is pending retires the old attempt before storage or write',
    () async {
      final h = Harness()
        ..entered = Completer<void>()
        ..hold = Completer<void>();
      final operation = h.service.importProductCsv(site, csv);
      final denied = expectLater(
        operation,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      await h.entered!.future;
      h.actor = actorB;
      h.epoch++;
      h.hold!.complete();
      await denied;
      expect(h.writes, isEmpty);
      expect(h.storage.data, isEmpty);
    },
  );
  test(
    'pre-registration parser refusal clears the unsent identity while unknown failures retain it',
    () async {
      final h = Harness()..invalid = true;
      await expectLater(
        h.service.importProductCsv(site, csv),
        throwsA(isA<ApiException>()),
      );
      expect(h.storage.data, isEmpty);
    },
  );
  test(
    'source decoding preserves BOM and rejects malformed UTF8 and multibyte overflow before transport',
    () async {
      final bytes = [239, 187, 191, ...utf8.encode(csv)];
      expect(decodeProductImportBytes(bytes), '\uFEFF$csv');
      expect(
        productImportSourceSha256(decodeProductImportBytes(bytes)),
        isNot(productImportSourceSha256(csv)),
      );
      expect(() => decodeProductImportBytes([255]), throwsFormatException);
      final h = Harness();
      await expectLater(
        h.service.importProductCsv(site, 'அ' * 350000),
        throwsFormatException,
      );
      expect(h.writes, isEmpty);
      expect(h.storage.data, isEmpty);
    },
  );
  test(
    'escaped request overflow is refused before retaining or sending a native command',
    () async {
      final h = Harness();
      final quoted = '"' * 530000;
      expect(utf8.encode(quoted).length, lessThan(1048576));
      await expectLater(
        h.service.importProductCsv(site, quoted),
        throwsFormatException,
      );
      expect(h.writes, isEmpty);
      expect(h.storage.data, isEmpty);
    },
  );
  test(
    'a pending registration that never committed can be durably stopped without its CSV',
    () async {
      final h = Harness()
        ..lost = true
        ..commitRegistration = false;
      await expectLater(
        h.service.importProductCsv(site, csv),
        throwsA(isA<ApiException>()),
      );
      final original = await h.service.pendingCsvImport(site);
      expect(await h.fresh().recoverCsvRegistration(site), isNull);
      expect(h.storage.data.length, 1);
      final stopped = await h.fresh().stopCsvRegistration(site);
      expect(stopped?.key, original!.key);
      expect(stopped?.status, 'stopped');
      expect(stopped?.totalRows, 0);
      expect(h.writes.length, 2);
      expect(h.writes.last.data['csv'], isNull);
      expect(h.storage.data, isEmpty);
    },
  );
  test(
    'lost stop acknowledgement retains the original identity until readback confirms the stop',
    () async {
      final h = Harness()
        ..lost = true
        ..commitRegistration = false
        ..loseStopAck = true;
      await expectLater(
        h.service.importProductCsv(site, csv),
        throwsA(isA<ApiException>()),
      );
      await expectLater(
        h.fresh().stopCsvRegistration(site),
        throwsA(isA<ApiException>()),
      );
      expect(h.storage.data.length, 1);
      final recovered = await h.fresh().recoverCsvRegistration(site);
      expect(recovered?.status, 'stopped');
      expect(recovered?.totalRows, 0);
      expect(h.storage.data, isEmpty);
      expect(h.writes.length, 2);
    },
  );
  test(
    'a nonterminal stop acknowledgement never clears an uncertain original request',
    () async {
      final h = Harness()
        ..lost = true
        ..unconfirmedStop = true;
      await expectLater(
        h.service.importProductCsv(site, csv),
        throwsA(isA<ApiException>()),
      );
      await expectLater(
        h.fresh().stopCsvRegistration(site),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'PRODUCT_IMPORT_UNCONFIRMED',
          ),
        ),
      );
      expect(h.storage.data.length, 1);
    },
  );
  test(
    'shared contract rejects fabricated progress, missing receipts and download URLs',
    () {
      final record = job(jobId, 'a' * 64);
      expect(
        ProductImportJob.fromJson({
          ...record,
          'total_rows': 1.0,
          'row_count': 0.0,
          'pending_rows': 1.0,
        }).pendingRows,
        1,
      );
      expect(
        () => ProductImportJob.fromJson({...record, 'row_count': 1}),
        throwsFormatException,
      );
      expect(
        () => ProductImportJob.fromJson({
          ...record,
          'download_url': 'https://example.invalid/private',
        }),
        throwsFormatException,
      );
      final row = {
        'id': jobId,
        'store_id': site,
        'job_id': jobId,
        'ordinal': 1,
        'status': 'completed',
        'product_id': null,
        'error_code': null,
        'attempt_count': 1,
      };
      expect(() => ProductImportRow.fromJson(row), throwsFormatException);
    },
  );
}
