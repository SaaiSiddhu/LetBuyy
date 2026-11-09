import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

Map<String, dynamic> fixture() =>
    jsonDecode(
          File(
            '../../../tests/fixtures/collection-membership-contracts.json',
          ).readAsStringSync(),
        )
        as Map<String, dynamic>;
void main() {
  test(
    'canonical TS/Dart fixture retains complete ordered membership and explicit unavailable products',
    () {
      final s = CollectionMembershipSnapshot.fromJson(fixture()['snapshot']);
      expect(s.productIds.length, 2);
      expect(s.products.single.id, s.productIds.first);
      expect(s.unavailableIds.single, s.productIds.last);
      expect(s.products.single.isActive, false);
      expect(s.products.single.price, 129.75);
      expect(s.version, 7);
      expect(() => s.productIds.clear(), throwsUnsupportedError);
    },
  );
  test(
    'missing, overlapping, duplicated and foreign membership cannot become a valid snapshot',
    () {
      final original = fixture()['snapshot'] as Map<String, dynamic>;
      for (final patch in [
        {'products': []},
        {'unavailable_product_ids': []},
        {
          'unavailable_product_ids': [original['product_ids'][0]],
        },
        {
          'product_ids': [
            original['product_ids'][0],
            original['product_ids'][0],
          ],
        },
        {'product_ids': List.filled(501, original['product_ids'][0])},
        {'membership_version': 0},
        {'store_id': 'another-store'},
        {
          'products': [
            ...(original['products'] as List),
            ...(original['products'] as List),
          ],
        },
      ])
        expect(
          () => CollectionMembershipSnapshot.fromJson({...original, ...patch}),
          throwsFormatException,
        );
    },
  );
  test(
    'exact collection page confirms counts, version and arithmetic without using fallback totals',
    () {
      final p = fixture()['page'] as Map<String, dynamic>;
      final page = CollectionListPage.fromParts(p['data'], p['meta']);
      expect(page.rows.single.productCount, 2);
      expect(page.rows.single.membershipVersion, 7);
      expect(page.total, 1);
      expect(page.hasNext, false);
      for (final patch in [
        {'total': 0},
        {'total_pages': 2},
        {'has_next': true},
        {'per_page': 0},
      ]) {
        expect(
          () =>
              CollectionListPage.fromParts(p['data'], {...p['meta'], ...patch}),
          throwsFormatException,
        );
      }
      for (final key in ['product_count', 'membership_version']) {
        final row = Map<String, dynamic>.from(p['data'][0])..remove(key);
        expect(
          () => CollectionListPage.fromParts([row], p['meta']),
          throwsFormatException,
        );
      }
    },
  );
  test(
    'collection metadata does not invent a count and supports deliberate active-state changes',
    () {
      final metadata = ProductCollectionContract.fromJson({
        'id': 'synthetic',
        'store_id': 'synthetic',
        'title': 'Synthetic',
      });
      expect(metadata.productCount, isNull);
      expect(metadata.membershipVersion, isNull);
      expect(
        const ProductCollectionInput(
          storeId: 'synthetic',
          title: 'Synthetic',
          isActive: false,
        ).toUpdateJson()['is_active'],
        false,
      );
    },
  );
}
