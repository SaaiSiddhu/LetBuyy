import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/theme_service.dart';

const store = '11111111-1111-4111-8111-111111111111';
const instance = '22222222-2222-4222-8222-222222222222';
const package = '33333333-3333-4333-8333-333333333333';
const versionId = '44444444-4444-4444-8444-444444444444';
const themeId = '55555555-5555-4555-8555-555555555555';

class _Api extends ApiClient {
  _Api() : super(baseUrl: 'https://owned.invalid');
  Object identity = ('actor-a', store);
  bool libraryUnavailable = false, wrongVersion = false;
  final calls = <({String path, ApiRequestOptions? options})>[];
  @override
  Object captureRequestContext() => identity;
  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    calls.add((path: path, options: options));
    if (path.endsWith('/resource-search'))
      return {
        'data': [
          {'id': 'resource-a', 'title': 'A real scoped result'},
        ],
        'meta': {'type': 'product', 'page': 2, 'has_more': true},
      };
    return {
      'data': [
        {
          'id': themeId,
          'slug': 'letbuyy-summit',
          'name': 'Kindred',
          'version': '2.0.0',
          'is_active': true,
          'letbuyy_pricing_type': 'free',
          'letbuyy_price_inr': 0,
        },
      ],
      'meta': {'total': 27, 'page': 2, 'has_next': true},
    };
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    calls.add((path: path, options: options));
    if (path.endsWith('/install'))
      return {
        'theme_instance_id': instance,
        'theme_package_id': package,
        'theme_package_version_id': versionId,
        'installed_version': wrongVersion ? '1.0.0' : '2.0.0',
        'already_installed': false,
        'theme': {
          'id': themeId,
          'slug': 'letbuyy-summit',
          'name': 'Kindred',
          'version': wrongVersion ? '1.0.0' : '2.0.0',
        },
      };
    if (path.endsWith('/library')) {
      if (libraryUnavailable)
        throw const ApiException(
          message: 'Synthetic offline',
          statusCode: 503,
          code: 'SYNTHETIC',
        );
      return {
        'themes': [
          {
            'instance_id': instance,
            'slug': 'letbuyy-summit',
            'name': 'Kindred',
            'version': '2.0.0',
            'theme_package_version_id': versionId,
            'instance_status': 'installed',
          },
        ],
      };
    }
    throw StateError('Unexpected controlled request');
  }
}

void main() {
  test(
    'catalog search, category, sort and pagination reach the server; metadata is retained',
    () async {
      final api = _Api();
      final actual = ThemeService(api: api);
      final result = await actual.fetchThemes(
        store,
        search: 'Gift',
        category: 'gifts',
        sort: 'name',
        page: 2,
        limit: 12,
      );
      expect(api.calls.single.options?.query, {
        'store_id': store,
        'search': 'Gift',
        'category': 'gifts',
        'sort': 'name',
        'page': 2,
        'limit': 12,
      });
      expect(result.page, 2);
      expect(result.total, 27);
      expect(result.hasMore, true);
      expect(result.themes.single.version, '2.0.0');
      expect(result.themes.single.priceInr, 0);
      expect(result.themes.single.catalogActive, true);
      actual.dispose();
    },
  );
  test(
    'Add pins the selected package and confirms the owned library',
    () async {
      final api = _Api();
      final actual = ThemeService(api: api);
      final receipt = await actual.installTheme(
        storeId: store,
        themeSlug: 'letbuyy-summit',
        expectedVersion: '2.0.0',
        expectedPackageId: package,
        expectedPackageVersionId: versionId,
      );
      expect(api.calls.map((c) => c.path), [
        '/themes/letbuyy-summit/install',
        '/themes/library',
      ]);
      expect(api.calls.first.options?.body, {
        'store_id': store,
        'config_overrides': <String, dynamic>{},
        'expected_version': '2.0.0',
        'expected_package_id': package,
        'expected_package_version_id': versionId,
      });
      expect(api.calls.last.options?.query, {'store_id': store});
      expect(receipt.instanceId, instance);
      actual.dispose();
    },
  );
  test(
    'an install receipt alone cannot report a confirmed library addition',
    () async {
      final api = _Api()..libraryUnavailable = true;
      await expectLater(
        ThemeService(api: api).installTheme(
          storeId: store,
          themeSlug: 'letbuyy-summit',
          expectedVersion: '2.0.0',
        ),
        throwsA(isA<ApiException>()),
      );
      expect(api.calls.length, 2);
    },
  );
  test(
    'another installed version is rejected without a library success read',
    () async {
      final api = _Api()..wrongVersion = true;
      await expectLater(
        ThemeService(api: api).installTheme(
          storeId: store,
          themeSlug: 'letbuyy-summit',
          expectedVersion: '2.0.0',
        ),
        throwsA(isA<FormatException>()),
      );
      expect(api.calls.length, 1);
    },
  );
  test(
    'resource search keeps data-array and pagination rather than unwrapping away metadata',
    () async {
      final api = _Api();
      final result = await ThemeService(api: api).searchThemeResources(
        storeId: store,
        type: 'product',
        query: 'cotton',
        page: 2,
      );
      expect((result['data'] as List).length, 1);
      expect((result['meta'] as Map)['has_more'], true);
      expect(api.calls.single.options?.query, {
        'store_id': store,
        'type': 'product',
        'q': 'cotton',
        'page': 2,
        'limit': 20,
      });
    },
  );
  test(
    'private preview identifies the requested page and content without overriding theme settings',
    () {
      final uri = Uri.parse(
        ThemeService.buildStorefrontPreviewUrl(
          subdomain: 'synthetic',
          previewToken: 'synthetic-token',
          templateKey: 'product',
          resourceId: 'product-a',
        ),
      );
      expect(uri.queryParameters['template'], 'product');
      expect(uri.queryParameters['resource_id'], 'product-a');
      expect(uri.queryParameters.containsKey('settings_data_b64'), false);
    },
  );
}
