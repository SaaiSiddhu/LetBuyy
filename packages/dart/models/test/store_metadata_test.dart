import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/merchant_contracts.dart';

void main() {
  test(
    'observed store revisions survive cache/copy while absent or invalid revisions stay unknown',
    () {
      for (final invalid in [null, '1', 0, -1, 1.5]) {
        expect(
          StoreModel.fromJson({
            'id': 'synthetic-store',
            'version': invalid,
          }).version,
          isNull,
        );
      }
      expect(StoreModel.fromJson({'id': 'old-cache'}).version, isNull);
      final current = StoreModel.fromJson({
        'id': 'synthetic-store',
        'version': 7,
      });
      expect(current.copyWith(name: 'Renamed').version, 7);
      expect(StoreModel.fromJson(current.toJson()).version, 7);
    },
  );
  test(
    'store settings reads canonical sites metadata through cache and copies',
    () {
      final source = StoreModel.fromJson({
        'id': 'synthetic-store',
        'name': 'Synthetic store',
        'meta_title': 'Canonical database title',
        'meta_description': 'Canonical database description',
      });
      expect(source.seoTitle, 'Canonical database title');
      expect(source.seoDescription, 'Canonical database description');
      final restored = StoreModel.fromJson(
        source.copyWith(name: 'Renamed').toJson(),
      );
      expect(restored.seoTitle, source.seoTitle);
      expect(restored.seoDescription, source.seoDescription);
    },
  );
  test('canonical metadata clearing cannot revive a legacy alias', () {
    for (final cleared in ['', null]) {
      final source = StoreModel.fromJson({
        'id': 'synthetic-store',
        'meta_title': cleared,
        'meta_description': cleared,
        'seoTitle': 'Old title',
        'seo_title': 'Other old title',
        'seoDescription': 'Old description',
        'seo_description': 'Other old description',
      });
      expect(source.seoTitle, cleared);
      expect(source.seoDescription, cleared);
    }
  });
  test(
    'previous local caches without canonical keys still read existing aliases',
    () {
      for (final camel in [false, true]) {
        final source = StoreModel.fromJson({
          'id': 'synthetic-store',
          if (camel) 'seoTitle': 'Cache title' else 'seo_title': 'Cache title',
          if (camel)
            'seoDescription': 'Cache description'
          else
            'seo_description': 'Cache description',
        });
        expect(source.seoTitle, 'Cache title');
        expect(source.seoDescription, 'Cache description');
      }
    },
  );
}
