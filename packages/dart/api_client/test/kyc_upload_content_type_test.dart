import 'dart:io';
import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

void main() {
  for (final row in [
    ('proof.jpg', [137, 80, 78, 71, 13, 10, 26, 10, 1], 'image/png'),
    ('proof.png', [255, 216, 255, 224, 1], 'image/jpeg'),
    ('proof.bin', [37, 80, 68, 70, 45, 49], 'application/pdf'),
  ]) {
    test(
      'private KYC declares byte type ${row.$3} despite filename ${row.$1}',
      () async {
        final dir = await Directory.systemTemp.createTemp('kyc-mime-');
        addTearDown(() => dir.delete(recursive: true));
        final file = await File('${dir.path}/${row.$1}').writeAsBytes(row.$2);
        final calls = <RequestOptions>[];
        final api = ApiClient(
          baseUrl: 'https://synthetic.invalid/v1',
          maxRetries: 0,
        );
        addTearDown(api.close);
        api.dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (o, h) {
              calls.add(o);
              h.resolve(
                Response(
                  requestOptions: o,
                  statusCode: 201,
                  data: {
                    'data': {'ok': true},
                  },
                ),
              );
            },
          ),
        );
        await api.kyc.uploadDocument(
          storeId: 'synthetic-site',
          documentType: 'bank_proof',
          documentNumberLast4: '1234',
          file: file,
          options: const ApiRequestOptions(
            storeId: 'synthetic-site',
            idempotencyKey: 'original-private-upload-key',
          ),
        );
        expect(calls, hasLength(1));
        final part = (calls.single.data as FormData).files.single.value;
        expect(part.contentType.toString(), row.$3);
        expect(await part.finalize().expand((x) => x).toList(), row.$2);
        expect(
          calls.single.headers['X-Idempotency-Key'],
          'original-private-upload-key',
        );
      },
    );
  }
  for (final kind in ['empty', 'unsupported', 'oversized']) {
    test('private KYC rejects $kind bytes before transport', () async {
      final dir = await Directory.systemTemp.createTemp('kyc-mime-denial-');
      addTearDown(() => dir.delete(recursive: true));
      final file = await File('${dir.path}/proof.png').writeAsBytes(
        kind == 'empty'
            ? []
            : kind == 'unsupported'
            ? [1, 2, 3]
            : List<int>.filled(5 * 1024 * 1024 + 1, 0),
      );
      var requests = 0;
      final api = ApiClient(
        baseUrl: 'https://synthetic.invalid/v1',
        maxRetries: 0,
      );
      addTearDown(api.close);
      api.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            requests++;
            h.reject(DioException(requestOptions: o));
          },
        ),
      );
      await expectLater(
        api.kyc.uploadDocument(
          storeId: 'synthetic-site',
          documentType: 'bank_proof',
          documentNumberLast4: '1234',
          file: file,
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            kind == 'oversized' ? 'KYC_FILE_TOO_LARGE' : 'KYC_UNSUPPORTED_FILE',
          ),
        ),
      );
      expect(requests, 0);
    });
  }
}
