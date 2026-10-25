import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/merchant_contracts.dart';

void main() {
  test(
    'store reads preserve portable section maps through cache and copies',
    () {
      final config = {
        'sections': {
          'hero': {
            'type': 'hero',
            'settings': {'title': 'Database title'},
          },
        },
        'section_order': ['hero'],
        'renderer': {'engine': 'liquid'},
      };
      final store = StoreModel.fromJson({
        'id': 'store',
        'name': 'Database store',
        'template_config': config,
      });
      expect(store.templateConfig, isNull);
      expect(store.portableTemplateConfig, config);
      final restored = StoreModel.fromJson(
        store.copyWith(name: 'Renamed').toJson(),
      );
      expect(restored.name, 'Renamed');
      expect(restored.portableTemplateConfig, config);
      expect(restored.toJson()['template_config'], config);
    },
  );

  test('list-based and absent template configurations still parse', () {
    final store = StoreModel.fromJson({
      'id': 'store',
      'template_config': {'sections': []},
    });
    expect(store.templateConfig!.sections, isEmpty);
    expect(store.portableTemplateConfig, isNull);
    expect(StoreModel.fromJson({'id': 'store'}).templateConfig, isNull);
  });
}
