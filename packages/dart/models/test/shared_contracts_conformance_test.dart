import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/shared_contracts.dart';

void main() {
  final sharedTypes = File(_sharedTypesPath()).readAsStringSync();

  group('shared-types conformance', () {
    test('Dart canonical contracts expose the same top-level fields', () {
      final cases = <_SchemaCase>[
        _SchemaCase(
          'Address interface',
          _interfaceFields(sharedTypes, 'Address'),
          AddressContract.schemaFields,
        ),
        _SchemaCase(
          'CustomerAddressSchema',
          _schemaOwnFields(sharedTypes, 'CustomerAddressSchema'),
          CustomerAddressContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: CustomerAddressContract.schemaFields,
        ),
        _SchemaCase(
          'ProductOptionSchema',
          _schemaOwnFields(sharedTypes, 'ProductOptionSchema'),
          ProductOptionContract.schemaFields,
        ),
        _SchemaCase(
          'VariantSchema',
          _schemaOwnFields(sharedTypes, 'VariantSchema'),
          ProductVariantContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: ProductVariantContract.schemaFields,
        ),
        _SchemaCase(
          'ProductSchema',
          _schemaOwnFields(sharedTypes, 'ProductSchema'),
          ProductContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: ProductContract.schemaFields,
        ),
        _SchemaCase(
          'CollectionRuleSchema',
          _schemaOwnFields(sharedTypes, 'CollectionRuleSchema'),
          CollectionRuleContract.schemaFields,
        ),
        _SchemaCase(
          'CollectionSchema',
          _schemaOwnFields(sharedTypes, 'CollectionSchema'),
          CollectionContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: CollectionContract.schemaFields,
        ),
        _SchemaCase(
          'CustomerSchema',
          _schemaOwnFields(sharedTypes, 'CustomerSchema'),
          CustomerContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: CustomerContract.schemaFields,
        ),
        _SchemaCase(
          'CartLineSchema',
          _schemaOwnFields(sharedTypes, 'CartLineSchema'),
          CartLineContract.schemaFields,
        ),
        _SchemaCase(
          'CartSchema',
          _schemaOwnFields(sharedTypes, 'CartSchema'),
          CartContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: CartContract.schemaFields,
        ),
        _SchemaCase(
          'LineItemSchema',
          _schemaOwnFields(sharedTypes, 'LineItemSchema'),
          LineItemContract.schemaFields,
        ),
        _SchemaCase(
          'OrderSchema',
          _schemaOwnFields(sharedTypes, 'OrderSchema'),
          OrderContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: OrderContract.schemaFields,
        ),
        _SchemaCase(
          'PaymentSchema',
          _schemaOwnFields(sharedTypes, 'PaymentSchema'),
          PaymentContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: PaymentContract.schemaFields,
        ),
        _SchemaCase(
          'CouponSchema',
          _schemaOwnFields(sharedTypes, 'CouponSchema'),
          CouponContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: CouponContract.schemaFields,
        ),
        _SchemaCase(
          'PageSchema',
          _schemaOwnFields(sharedTypes, 'PageSchema'),
          PageContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: PageContract.schemaFields,
        ),
        _SchemaCase(
          'ThemeSettingFieldSchema',
          _schemaOwnFields(sharedTypes, 'ThemeSettingFieldSchema'),
          ThemeSettingFieldContract.schemaFields,
        ),
        _SchemaCase(
          'ThemeSettingsSchema',
          _schemaOwnFields(sharedTypes, 'ThemeSettingsSchema'),
          ThemeSettingsContract.schemaFields,
        ),
        _SchemaCase(
          'ThemeBlockSchema',
          _schemaOwnFields(sharedTypes, 'ThemeBlockSchema'),
          ThemeBlockContract.schemaFields,
        ),
        _SchemaCase(
          'ThemeSectionSchema',
          _schemaOwnFields(sharedTypes, 'ThemeSectionSchema'),
          ThemeSectionContract.schemaFields,
        ),
        _SchemaCase(
          'ThemeTemplateSchema',
          _schemaOwnFields(sharedTypes, 'ThemeTemplateSchema'),
          ThemeTemplateContract.schemaFields,
        ),
        _SchemaCase(
          'ThemeBundleSchema',
          _schemaOwnFields(sharedTypes, 'ThemeBundleSchema'),
          ThemeBundleContract.schemaFields,
        ),
        _SchemaCase(
          'ThemeSchema',
          _schemaOwnFields(sharedTypes, 'ThemeSchema'),
          ThemeContract.ownFields,
          inheritedFields: ContractFieldSets.audited,
          completeFields: ThemeContract.schemaFields,
        ),
      ];

      for (final schemaCase in cases) {
        expect(
          schemaCase.dartFields,
          schemaCase.sourceFields,
          reason:
              '${schemaCase.name} changed in shared-types without a Dart mirror update.',
        );

        if (schemaCase.completeFields != null) {
          expect(
            schemaCase.completeFields,
            <String>[...schemaCase.inheritedFields, ...schemaCase.sourceFields],
            reason:
                '${schemaCase.name} complete field manifest does not include inherited fields.',
          );
        }
      }
    });

    test('canonical model wrappers preserve gateway JSON shape', () {
      final product = ProductContract.fromJson({
        'id': 'product-1',
        'store_id': 'store-1',
        'name': 'Catalog Tee',
        'slug': 'catalog-tee',
        'status': 'active',
        'price': 499.0,
        'currency': 'INR',
        'stock': 12,
        'images': ['https://cdn.example.test/tee.png'],
        'tags': ['apparel'],
        'variants': [
          {
            'id': 'variant-1',
            'product_id': 'product-1',
            'title': 'Black / M',
            'price': 499.0,
            'stock': 7,
            'inventory_quantity': 7,
            'options': {'Color': 'Black', 'Size': 'M'},
          },
        ],
      });

      expect(product.storeId, 'store-1');
      expect(product.variants.single.title, 'Black / M');
      expect(product.toJson()['store_id'], 'store-1');

      final order = OrderContract.fromJson({
        'id': 'order-1',
        'store_id': 'store-1',
        'order_number': 'LB-1001',
        'status': 'confirmed',
        'payment_status': 'paid',
        'fulfillment_status': 'unfulfilled',
        'currency': 'INR',
        'total': 499.0,
        'line_items': [
          {
            'name': 'Catalog Tee',
            'quantity': 1,
            'unit_price': 499.0,
            'total': 499.0,
            'currency': 'INR',
          },
        ],
      });

      expect(order.orderNumber, 'LB-1001');
      expect(order.lineItems.single.total, 499.0);
      expect(order.toJson()['line_items'], isA<List<dynamic>>());

      final theme = ThemeContract.fromJson({
        'id': 'theme-1',
        'slug': 'minimal-modern',
        'name': 'Minimal Modern',
        'category': 'store',
        'pricing_type': 'free',
        'price_inr': 0,
        'version': '1.0.0',
        'bundle': {
          'schema_version': '2026-05',
          'theme_id': 'minimal-modern',
          'version': '1.0.0',
          'settings_schema': [
            {'id': 'primaryColor', 'type': 'color', 'label': 'Primary'},
          ],
          'settings_data': {'primaryColor': '#8B5CF6'},
          'templates': {},
        },
      });

      expect(theme.bundle?.settingsData['primaryColor'], '#8B5CF6');
      expect(theme.toJson()['bundle'], isA<Map<String, dynamic>>());
    });
  });
}

String _sharedTypesPath() {
  const candidates = <String>[
    '../../../packages/shared-types/src/index.ts',
    'packages/shared-types/src/index.ts',
  ];

  for (final candidate in candidates) {
    if (File(candidate).existsSync()) return candidate;
  }

  throw StateError('Could not locate packages/shared-types/src/index.ts.');
}

class _SchemaCase {
  const _SchemaCase(
    this.name,
    this.sourceFields,
    this.dartFields, {
    this.inheritedFields = const [],
    this.completeFields,
  });

  final String name;
  final List<String> sourceFields;
  final List<String> dartFields;
  final List<String> inheritedFields;
  final List<String>? completeFields;
}

List<String> _schemaOwnFields(String source, String schemaName) {
  final marker = 'export const $schemaName';
  final start = source.indexOf(marker);
  if (start < 0) {
    throw StateError('Could not find $schemaName in shared-types.');
  }
  final openBrace = source.indexOf('{', start);
  if (openBrace < 0) {
    throw StateError('Could not find opening object for $schemaName.');
  }
  return _topLevelKeys(_objectBody(source, openBrace));
}

List<String> _interfaceFields(String source, String interfaceName) {
  final marker = 'export interface $interfaceName';
  final start = source.indexOf(marker);
  if (start < 0) {
    throw StateError(
      'Could not find $interfaceName interface in shared-types.',
    );
  }
  final openBrace = source.indexOf('{', start);
  if (openBrace < 0) {
    throw StateError('Could not find opening interface for $interfaceName.');
  }
  final body = _objectBody(source, openBrace);
  final fields = <String>[];
  for (final line in body.split('\n')) {
    final match = RegExp(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\??:').firstMatch(line);
    if (match != null) fields.add(match.group(1)!);
  }
  return fields;
}

String _objectBody(String source, int openBrace) {
  var depth = 0;
  for (var index = openBrace; index < source.length; index += 1) {
    final char = source[index];
    if (char == '{') depth += 1;
    if (char == '}') {
      depth -= 1;
      if (depth == 0) {
        return source.substring(openBrace + 1, index);
      }
    }
  }
  throw StateError('Unbalanced object literal in shared-types.');
}

List<String> _topLevelKeys(String body) {
  var depth = 1;
  final fields = <String>[];

  for (final line in body.split('\n')) {
    if (depth == 1) {
      final match = RegExp(r'^\s*([A-Za-z_][A-Za-z0-9_]*):').firstMatch(line);
      if (match != null) fields.add(match.group(1)!);
    }

    for (final rune in line.runes) {
      final char = String.fromCharCode(rune);
      if (char == '{') depth += 1;
      if (char == '}') depth -= 1;
    }
  }

  return fields;
}
