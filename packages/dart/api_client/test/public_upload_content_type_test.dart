import 'dart:io';
import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

void main() {
  for (final entry in {
    'PNG': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'glb': 'model/gltf-binary',
    'gltf': 'model/gltf+json',
  }.entries) {
    for (final resource in [false, true]) {
      test(
        '${resource ? 'resource' : 'legacy'} upload declares ${entry.value} for ${entry.key}',
        () async {
          final dir = await Directory.systemTemp.createTemp(
            'letbuyy-upload-mime-',
          );
          addTearDown(() => dir.delete(recursive: true));
          final file = await File(
            '${dir.path}/synthetic.${entry.key}',
          ).writeAsBytes([1, 2, 3]);
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
                      'data': {
                        'url': 'https://synthetic.invalid/image',
                        'key': 'public-media/synthetic',
                        'size': 3,
                        'content_type': entry.value,
                      },
                    },
                  ),
                );
              },
            ),
          );
          final options = const ApiRequestOptions(
            storeId: 'synthetic-site',
            idempotencyKey: 'original-upload-key',
          );
          if (resource) {
            await api.upload.file(
              file,
              storeId: 'synthetic-site',
              folder: 'media',
              options: options,
            );
          } else {
            await api.uploadFile(
              file,
              storeId: 'synthetic-site',
              folder: 'media',
              options: options,
            );
          }
          expect(calls, hasLength(1));
          final form = calls.single.data as FormData;
          final part = form.files.single.value;
          expect(part.filename, 'synthetic.${entry.key}');
          expect(
            part.contentType.toString(),
            entry.value,
            reason:
                'The real public upload API rejects application/octet-stream.',
          );
          expect(Map.fromEntries(form.fields)['store_id'], 'synthetic-site');
          expect(
            calls.single.headers['X-Idempotency-Key'],
            'original-upload-key',
          );
        },
      );
    }
  }
}
