import 'support/kyc_public_fixture.dart';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/kyc_service.dart';

const site = 'd7194463-3cdb-4e2a-850b-cb048986adad';
const receipt = '2c73a536-4dc4-4df1-92d4-89d0c8b51d99';

Map<String, dynamic> overview() => {
  'site_id': site,
  'overall_status': 'in_progress',
  'provider_mode': 'sandbox',
  'private_upload_available': false,
  'india_direct_upload_available': true,
  'documents': <Object>[],
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test(
    'mobile India photo uses same receipt key across intent, direct POST and completion',
    () async {
      final calls = <RequestOptions>[];
      final dio = Dio();
      final api = ApiClient(
        baseUrl: 'https://synthetic.invalid/v1',
        dio: dio,
        maxRetries: 0,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            calls.add(options);
            final path = options.uri.path;
            final data = path.endsWith('/upload-intent')
                ? {
                    'receipt_id': receipt,
                    'method': 'POST',
                    'url': 'https://privatekyc.s3.ap-south-1.amazonaws.com/',
                    'fields': {'key': 'kyc/$site/bank_proof/$receipt'},
                    'maximum_object_bytes': 5242880,
                    'expires_at': DateTime.now()
                        .add(const Duration(minutes: 2))
                        .toIso8601String(),
                  }
                : path.endsWith('/upload-complete')
                ? {
                    'receipt_id': receipt,
                    'document_status': 'submitted',
                    'evidence_scan_status': 'pending',
                  }
                : overview();
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': data},
              ),
            );
          },
        ),
      );
      var posts = 0;
      final service = KycService(
        api: api,
        actorIdProvider: () => 'synthetic-actor',
        storeIdProvider: () => site,
        postIndiaObject: (url, fields, bytes, filename) async {
          posts++;
          expect(url.host, 'privatekyc.s3.ap-south-1.amazonaws.com');
          expect(fields['key'], 'kyc/$site/bank_proof/$receipt');
          expect(bytes.take(8), [
            0x89,
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a,
          ]);
          expect(filename, 'proof.png');
          return 'synthetic-version+1';
        },
      );
      final dir = await Directory.systemTemp.createTemp('kyc-india-mobile-');
      addTearDown(() async {
        service.dispose();
        await dir.delete(recursive: true);
      });
      final file = File('${dir.path}/proof.png');
      await file.writeAsBytes([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        1,
        2,
        3,
      ]);
      await service.fetchOverview(site);
      final result = await service.uploadDocument(
        storeId: site,
        documentType: 'bank_proof',
        documentNumberLast4: '1234',
        file: file,
      );
      expect(result['evidence_scan_status'], 'pending');
      expect(posts, 1);
      final intent = calls.singleWhere(
        (item) => item.uri.path.endsWith('/upload-intent'),
      );
      final completion = calls.singleWhere(
        (item) => item.uri.path.endsWith('/upload-complete'),
      );
      Object? idempotency(RequestOptions request) => request.headers.entries
          .where((entry) => entry.key.toLowerCase() == 'x-idempotency-key')
          .map((entry) => entry.value)
          .firstOrNull;
      expect(idempotency(intent), isA<String>());
      expect(idempotency(intent), idempotency(completion));
      expect((intent.data as Map)['store_id'], site);
      expect((completion.data as Map)['version_id'], 'synthetic-version+1');
      expect(calls.where((item) => item.uri.path.endsWith('/upload')), isEmpty);
    },
  );

  test(
    'foreign object key in a ticket is refused before bytes leave the device',
    () async {
      final dio = Dio();
      final api = ApiClient(
        baseUrl: 'https://synthetic.invalid/v1',
        dio: dio,
        maxRetries: 0,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            final data = options.uri.path.endsWith('/upload-intent')
                ? {
                    'receipt_id': receipt,
                    'method': 'POST',
                    'url': 'https://privatekyc.s3.ap-south-1.amazonaws.com/',
                    'fields': {'key': 'kyc/foreign/bank_proof/$receipt'},
                    'maximum_object_bytes': 5242880,
                    'expires_at': DateTime.now()
                        .add(const Duration(minutes: 2))
                        .toIso8601String(),
                  }
                : overview();
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': data},
              ),
            );
          },
        ),
      );
      var posts = 0;
      final service = KycService(
        api: api,
        actorIdProvider: () => 'synthetic-actor',
        storeIdProvider: () => site,
        postIndiaObject: (_, _, _, _) async {
          posts++;
          return 'version';
        },
      );
      final dir = await Directory.systemTemp.createTemp(
        'kyc-india-mobile-denial-',
      );
      addTearDown(() async {
        service.dispose();
        await dir.delete(recursive: true);
      });
      final file = File('${dir.path}/proof.png');
      await file.writeAsBytes([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        1,
      ]);
      await service.fetchOverview(site);
      await expectLater(
        service.uploadDocument(
          storeId: site,
          documentType: 'bank_proof',
          documentNumberLast4: '1234',
          file: file,
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'KYC_INDIA_TICKET_SCOPE_MISMATCH',
          ),
        ),
      );
      expect(posts, 0);
    },
  );

  test(
    'account switch after direct POST cannot complete an old store upload',
    () async {
      var epoch = 1, completions = 0;
      final dio = Dio();
      final api = ApiClient(
        baseUrl: 'https://synthetic.invalid/v1',
        dio: dio,
        maxRetries: 0,
        contextVersionProvider: () => epoch,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.uri.path.endsWith('/upload-complete')) completions++;
            final data = options.uri.path.endsWith('/upload-intent')
                ? {
                    'receipt_id': receipt,
                    'method': 'POST',
                    'url': 'https://privatekyc.s3.ap-south-1.amazonaws.com/',
                    'fields': {'key': 'kyc/$site/bank_proof/$receipt'},
                    'maximum_object_bytes': 5242880,
                    'expires_at': DateTime.now()
                        .add(const Duration(minutes: 2))
                        .toIso8601String(),
                  }
                : overview();
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': data},
              ),
            );
          },
        ),
      );
      final service = KycService(
        api: api,
        actorIdProvider: () => 'synthetic-actor',
        storeIdProvider: () => site,
        postIndiaObject: (_, _, _, _) async {
          epoch++;
          return 'synthetic-version+1';
        },
      );
      final dir = await Directory.systemTemp.createTemp(
        'kyc-india-mobile-switch-',
      );
      addTearDown(() async {
        service.dispose();
        await dir.delete(recursive: true);
      });
      final file = File('${dir.path}/proof.png');
      await file.writeAsBytes([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        1,
      ]);
      await service.fetchOverview(site);
      await expectLater(
        service.uploadDocument(
          storeId: site,
          documentType: 'bank_proof',
          documentNumberLast4: '1234',
          file: file,
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      expect(completions, 0);
      expect(service.overview, isNull);
    },
  );

  test(
    'unavailable India upload is refused before the device reads or sends a file',
    () async {
      final calls = <String>[];
      final dio = Dio();
      final api = ApiClient(
        baseUrl: 'https://synthetic.invalid/v1',
        dio: dio,
        maxRetries: 0,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            calls.add(options.uri.path);
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': {
                    ...overview(),
                    'india_direct_upload_available': false,
                  },
                },
              ),
            );
          },
        ),
      );
      var posts = 0;
      final service = KycService(
        api: api,
        actorIdProvider: () => 'synthetic-actor',
        storeIdProvider: () => site,
        postIndiaObject: (_, _, _, _) async {
          posts++;
          return 'unexpected-version';
        },
      );
      addTearDown(service.dispose);
      await service.fetchOverview(site);
      await expectLater(
        service.uploadDocument(
          storeId: site,
          documentType: 'bank_proof',
          documentNumberLast4: '1234',
          file: File(
            '${Directory.systemTemp.path}/letbuyy-kyc-must-not-read-${DateTime.now().microsecondsSinceEpoch}.png',
          ),
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'KYC_UPLOAD_UNAVAILABLE',
          ),
        ),
      );
      expect(
        calls,
        hasLength(1),
        reason: 'only the explicit overview read may reach the API',
      );
      expect(calls.single, endsWith('/kyc'));
      expect(posts, 0);
      expect(service.isLoading, false);
    },
  );

  test(
    'unconfirmed Mumbai POST holds original request and keeps old status',
    () async {
      const firstReceipt = '7b1714db-932e-4e19-985d-710266796aba';
      var intents = 0, posts = 0;
      final calls = <RequestOptions>[];
      Map<String, dynamic> currentOverview(String last4) => {
        ...overview(),
        'documents': [
          {...publicKycDocument(site), 'document_number_last4': last4},
        ],
      };
      final dio = Dio();
      final api = ApiClient(
        baseUrl: 'https://synthetic.invalid/v1',
        dio: dio,
        maxRetries: 0,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            calls.add(options);
            final path = options.uri.path;
            late final Map<String, dynamic> data;
            if (path.endsWith('/upload-intent')) {
              final issuedReceipt = ++intents == 1 ? firstReceipt : receipt;
              data = {
                'receipt_id': issuedReceipt,
                'method': 'POST',
                'url': 'https://privatekyc.s3.ap-south-1.amazonaws.com/',
                'fields': {'key': 'kyc/$site/bank_proof/$issuedReceipt'},
                'maximum_object_bytes': 5242880,
                'expires_at': DateTime.now()
                    .add(const Duration(minutes: 2))
                    .toIso8601String(),
              };
            } else if (path.endsWith('/upload-complete')) {
              data = {
                'site_id': site,
                'receipt_id': receipt,
                'document_status': 'submitted',
                'evidence_scan_status': 'pending',
                'overview': currentOverview('2222'),
              };
            } else {
              data = currentOverview('1111');
            }
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': data},
              ),
            );
          },
        ),
      );
      final service = KycService(
        api: api,
        actorIdProvider: () => 'synthetic-actor',
        storeIdProvider: () => site,
        postIndiaObject: (_, fields, bytes, _) async {
          posts++;
          expect(
            fields['key'],
            'kyc/$site/bank_proof/${posts == 1 ? firstReceipt : receipt}',
          );
          expect(bytes.length, 9);
          if (posts == 1) {
            throw const ApiException(
              message: 'Private storage unavailable. Retry upload.',
              statusCode: 503,
              code: 'KYC_INDIA_OBJECT_UNCONFIRMED',
            );
          }
          return 'synthetic-version-2';
        },
      );
      final dir = await Directory.systemTemp.createTemp(
        'kyc-india-mobile-retry-',
      );
      addTearDown(() async {
        service.dispose();
        await dir.delete(recursive: true);
      });
      final file = File('${dir.path}/proof.png');
      await file.writeAsBytes([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        1,
      ]);
      await service.fetchOverview(site);
      expect(service.documents.single['document_number_last4'], '1111');
      Future<Map<String, dynamic>> attempt() => service.uploadDocument(
        storeId: site,
        documentType: 'bank_proof',
        documentNumberLast4: '2222',
        file: file,
      );
      await expectLater(
        attempt(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'KYC_INDIA_OBJECT_UNCONFIRMED',
          ),
        ),
      );
      expect(service.documents.single['document_number_last4'], '1111');
      expect(
        calls.where((item) => item.uri.path.endsWith('/upload-complete')),
        isEmpty,
      );
      expect(service.isLoading, false);

      await expectLater(
        attempt(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'KYC_UPLOAD_NEEDS_REVIEW',
          ),
        ),
      );
      expect(service.documents.single['document_number_last4'], '1111');
      expect(intents, 1);
      expect(posts, 1);
      expect(
        calls.where((item) => item.uri.path.endsWith('/upload-complete')),
        isEmpty,
      );
      expect(service.uploadRecoveryMessage, contains('needs review'));
      expect(calls.where((item) => item.uri.path.endsWith('/upload')), isEmpty);
    },
  );
}
