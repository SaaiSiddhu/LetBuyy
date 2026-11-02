import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';

class UploadTransport extends ApiClient {
  UploadTransport() : super(baseUrl: 'https://gateway.test/v1');
  Object version = 1;
  bool retire = false;
  ApiRequestOptions? sent;
  String? target, location;
  @override
  Object? captureRequestContext() => version;
  @override
  Future<String> uploadFile(
    File file, {
    String folder = 'uploads',
    String? storeId,
    ApiRequestOptions? options,
  }) async {
    sent = options;
    target = storeId;
    location = folder;
    if (retire) version = 2;
    return 'https://media.example.invalid/synthetic-product.png';
  }
}

void main() {
  test(
    'product media upload freezes the selected site and pre-file-read context',
    () async {
      final api = UploadTransport();
      addTearDown(api.close);
      final url = await ProductService(
        api: api,
      ).uploadProductImage(File('/synthetic/photo.jpg'), storeId: 'site-a');
      expect(url, contains('synthetic-product.png'));
      expect(api.location, 'products');
      expect(api.target, 'site-a');
      expect(api.sent?.storeId, 'site-a');
      expect(api.sent?.expectedContextVersion, 1);
    },
  );
  test(
    'media upload completion after context retirement cannot become a current draft image',
    () async {
      final api = UploadTransport()..retire = true;
      addTearDown(api.close);
      await expectLater(
        ProductService(
          api: api,
        ).uploadProductImage(File('/synthetic/photo.jpg'), storeId: 'site-a'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      expect(api.sent?.expectedContextVersion, 1);
      expect(api.target, 'site-a');
    },
  );
}
