import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

Map<String, dynamic> fixture() => jsonDecode(
  File(
    '../../../tests/fixtures/product-category-contracts.json',
  ).readAsStringSync(),
);
void main() {
  test(
    'canonical category fixture preserves observed revision, hierarchy and complete counts',
    () {
      final f = fixture(),
          row = ProductCategoryContract.fromJson(f['row']),
          page = ProductCategoryPage.fromParts(
            f['page']['data'],
            f['page']['meta'],
          ),
          receipt = ProductCategoryReceipt.fromJson(f['receipt']);
      expect(row.version, 3);
      expect(row.productsCount, 2);
      expect(row.parentId, isNull);
      expect(page.total, 1);
      expect(receipt.affectedProducts, 2);
      expect(receipt.category.toJson(), row.toJson());
      expect(() => page.rows.clear(), throwsUnsupportedError);
    },
  );
  test(
    'missing category counts, invalid revisions and fabricated page arithmetic fail closed',
    () {
      final f = fixture(), original = Map<String, dynamic>.from(f['row']);
      for (final key in ['products_count', 'children_count', 'version']) {
        final row = Map<String, dynamic>.of(original)..remove(key);
        expect(
          () => ProductCategoryContract.fromJson(row),
          throwsFormatException,
        );
      }
      for (final patch in [
        {'version': 0},
        {'display_order': -1},
        {'is_visible': 'true'},
        {'image_url': 'javascript:alert(1)'},
        {'created_at': '2026-11-03'},
        {'slug': 'Mixed Slug'},
      ]) {
        expect(
          () => ProductCategoryContract.fromJson({...original, ...patch}),
          throwsFormatException,
        );
      }
      for (final patch in [
        {'total': 0},
        {'total_pages': 2},
        {'has_next': true},
      ]) {
        expect(
          () => ProductCategoryPage.fromParts(f['page']['data'], {
            ...f['page']['meta'],
            ...patch,
          }),
          throwsFormatException,
        );
      }
      expect(
        () => ProductCategoryReceipt.fromJson({
          ...f['receipt'],
          'operation': 'delete',
        }),
        throwsFormatException,
      );
    },
  );
  test(
    'category commands require explicit original identity and update version without create defaults',
    () {
      final row = fixture()['row'],
          base = {
            'store_id': row['store_id'],
            'idempotency_key': fixture()['receipt']['idempotency_key'],
          };
      final create = validateProductCategoryCommand('create', {
        ...base,
        'name': ' Synthetic category ',
      });
      expect(create['name'], 'Synthetic category');
      expect(create['is_visible'], true);
      final update = validateProductCategoryCommand('update', {
        ...base,
        'version': 3,
        'description': null,
      });
      expect(update.containsKey('is_visible'), false);
      expect(update['description'], isNull);
      for (final command in [
        {...base, 'description': 'missing version'},
        {...base, 'version': 3},
        {...base, 'version': 3, 'unknown': true},
      ]) {
        expect(
          () => validateProductCategoryCommand('update', command),
          throwsFormatException,
        );
      }
    },
  );
}
