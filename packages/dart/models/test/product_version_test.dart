import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/shared_contracts.dart';

void main() {
  test(
    'product revision and durable variant IDs survive a full contract roundtrip',
    () {
      final product = ProductContract.fromJson({
        'id': 'product',
        'store_id': 'store',
        'version': 19,
        'options': [
          {
            'name': 'Size',
            'position': 0,
            'values': ['M'],
          },
        ],
        'variants': [
          {
            'id': 'variant',
            'product_id': 'product',
            'title': 'M',
            'stock': 0,
            'inventory_quantity': 0,
            'options': {'Size': 'M', 'Colour': 'Blue'},
          },
        ],
      });
      final restored = ProductContract.fromJson(product.toJson());
      expect(restored.version, 19);
      expect(ProductContract.ownFields, contains('version'));
      expect(restored.variants.single.id, 'variant');
      expect(restored.variants.single.stock, 0);
      expect(restored.variants.single.options, {'Size': 'M', 'Colour': 'Blue'});
    },
  );

  test('missing or invalid revision remains unavailable for editing', () {
    for (final invalid in [null, 0, -1, 1.5, '7']) {
      final product = ProductContract.fromJson({'version': invalid});
      expect(product.version, isNull);
      expect(product.toJson()['version'], invalid);
    }
  });
}
