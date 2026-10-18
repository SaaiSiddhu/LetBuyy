import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

void main() {
  test('ProductContract deserializes canonical gateway fields', () {
    final product = ProductContract.fromJson({
      'id': 'prod_123',
      'store_id': 'site_123',
      'name': 'Urban Runner',
      'slug': 'urban-runner',
      'description': 'Lightweight shoe',
      'price': 1299,
      'compare_price': 1599,
      'currency': 'INR',
      'sku': 'UR-1',
      'stock': 11,
      'is_active': true,
      'is_featured': false,
      'images': ['https://cdn.letbuyy.com/products/urban-runner.jpg'],
      'country_of_origin': 'Japan',
      'importer_details': 'Example Imports, Mumbai',
      'tags': ['shoes'],
      'metadata': {
        'specifications': {'material': 'mesh'},
      },
    });

    expect(product.id, 'prod_123');
    expect(product.storeId, 'site_123');
    expect(product.price, 1299);
    expect(product.comparePrice, 1599);
    expect(product.stock, 11);
    expect(product.isActive, isTrue);
    expect(product.countryOfOrigin, 'Japan');
    expect(product.importerDetails, 'Example Imports, Mumbai');
    expect(product.toJson()['importer_details'], 'Example Imports, Mumbai');
    expect(product.toJson().containsKey('salePrice'), isFalse);
  });
}
