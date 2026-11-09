import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/kyc_service.dart';
import 'support/kyc_public_fixture.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final defect in [
    'sparse',
    'invalid-document',
    'private-field',
    'coerced-flag',
    'wrong-document-store',
    'duplicate-document',
    'invalid-date',
  ]) {
    test('KYC rejects $defect after a populated valid positive read', () async {
      var body = publicKycOverview(kycSiteA);
      final api = ApiClient(
        baseUrl: 'https://synthetic.invalid/v1',
        maxRetries: 0,
      );
      addTearDown(api.close);
      api.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) => h.resolve(
            Response(requestOptions: o, statusCode: 200, data: {'data': body}),
          ),
        ),
      );
      final service = KycService(api: api);
      addTearDown(service.dispose);
      await service.fetchOverview(kycSiteA);
      expect(service.documents, hasLength(1));
      final doc = publicKycDocument(kycSiteA);
      switch (defect) {
        case 'sparse':
          body = {'site_id': kycSiteA, 'documents': []};
        case 'invalid-document':
          body['documents'] = [doc, 'not a document'];
        case 'private-field':
          doc['private_object_key'] = 'synthetic/private/proof';
          body['documents'] = [doc];
        case 'coerced-flag':
          body['private_upload_available'] = 'true';
        case 'wrong-document-store':
          doc['site_id'] = kycSiteB;
          body['documents'] = [doc];
        case 'duplicate-document':
          body['documents'] = [doc, doc];
        case 'invalid-date':
          doc['updated_at'] = '2026-02-30T00:00:00Z';
          body['documents'] = [doc];
      }
      await expectLater(
        service.fetchOverview(kycSiteA),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'KYC_INVALID_RESPONSE',
          ),
        ),
      );
      expect(service.overview, isNull);
      expect(service.documents, isEmpty);
    });
  }
}
