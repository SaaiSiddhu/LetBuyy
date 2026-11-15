import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

const site = '11111111-1111-4111-8111-111111111111',
    id = '22222222-2222-4222-8222-222222222222';
void main() {
  test(
    'warehouse unit cost uses whole paise and rejects malformed input instead of zero',
    () {
      expect(parseWarehouseUnitCost('0.29'), 0.29);
      expect(parseWarehouseUnitCost('12.2'), 12.2);
      expect(parseWarehouseUnitCost('0'), 0);
      for (final value in [
        '',
        'abc',
        '-1',
        '1.001',
        '1e2',
        '1,000',
        '1000000',
        '999999.01',
      ])
        expect(
          () => parseWarehouseUnitCost(value),
          throwsFormatException,
          reason: value,
        );
    },
  );

  for (final supplier in [false, true])
    test(
      '${supplier ? 'supplier' : 'location'} canonical record requires real identity, address and observation facts',
      () {
        Map<String, dynamic> row() => {
          'id': id,
          supplier ? 'site_id' : 'store_id': site,
          'name': 'Synthetic',
          'status': 'active',
          'created_at': '2026-11-01T00:00:00Z',
          'address': <String, dynamic>{},
          if (supplier) ...{
            'contact_name': null,
            'email': null,
            'phone': null,
          } else
            'is_default': false,
        };
        Object parse(Map<String, dynamic> value) => supplier
            ? InventorySupplierContract.fromVerifiedJson(value)
            : InventoryLocationContract.fromVerifiedJson(value);
        expect(parse(row()), isNotNull);
        for (final key in [
          'id',
          supplier ? 'site_id' : 'store_id',
          'name',
          'status',
          'created_at',
          'address',
          supplier ? 'email' : 'is_default',
        ])
          expect(
            () => parse(row()..remove(key)),
            throwsFormatException,
            reason: key,
          );
        expect(
          () => parse(row()..['deleted_at'] = '2026-11-01T00:00:00Z'),
          throwsFormatException,
        );
      },
    );
  test(
    'an exact far page is valid while a missing current slice is unavailable',
    () {
      final meta = <String, dynamic>{
        'store_id': site,
        'page': 12,
        'per_page': 100,
        'total': 1005,
        'total_is_exact': true,
        'has_next': false,
      };
      expect(
        WarehousePageContract.fromJson(
          meta,
          storeId: site,
          page: 12,
          limit: 100,
          rowCount: 0,
        ).total,
        1005,
      );
      expect(
        () => WarehousePageContract.fromJson(
          {...meta, 'page': 11},
          storeId: site,
          page: 11,
          limit: 100,
          rowCount: 0,
        ),
        throwsFormatException,
      );
    },
  );
}
