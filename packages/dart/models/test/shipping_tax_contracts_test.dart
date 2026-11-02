import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

void main() {
  test(
    'handling charges preserve paise and reject rounding, exponent and invalid ranges',
    () {
      final examples = <String, int?>{
        '0': 0,
        '0.01': 1,
        '129.75': 12975,
        '1000000': 100000000,
        '1000000.01': null,
        '0.001': null,
        '01': null,
        '1e2': null,
        ' 10': null,
        '10 ': null,
        '-1': null,
        'NaN': null,
        'Infinity': null,
      };
      for (final entry in examples.entries) {
        expect(
          parseShippingHandlingFeeMinor(entry.key),
          entry.value,
          reason: entry.key,
        );
      }
    },
  );
  test(
    'profile revision retains microseconds and unknown COD stays unknown',
    () {
      final profile = ShippingProfileContract.fromJson({
        'id': '00000000-0000-4000-8000-000000000001',
        'site_id': '00000000-0000-4000-8000-000000000002',
        'name': 'Standard',
        'is_default': true,
        'cod_enabled': false,
        'handling_fee_minor': 12975,
        'updated_at': '2026-10-30T09:12:20.123456Z',
      });
      expect(
        ShippingProfilePatch(
          expectedRevision: profile.revision,
          codEnabled: true,
        ).toJson(),
        {
          'expected_revision': '2026-10-30T09:12:20.123456Z',
          'cod_enabled': true,
        },
      );
      expect(ShippingZoneContract.fromJson({'id': 'zone'}).codEnabled, isNull);
      expect(ShippingRateContract.fromJson({'id': 'rate'}).codEnabled, isNull);
    },
  );
  test(
    'editing a zone preserves profile assignment unless explicitly changed',
    () {
      const unchanged = ShippingZoneInput(
        storeId: 'site',
        name: 'Zone',
        countries: ['IN'],
      );
      const cleared = ShippingZoneInput(
        storeId: 'site',
        name: 'Zone',
        countries: ['IN'],
        profileChanged: true,
      );
      expect(
        unchanged.toJson(includeStoreId: false).containsKey('profile_id'),
        false,
      );
      expect(
        cleared.toJson(includeStoreId: false).containsKey('profile_id'),
        true,
      );
      expect(cleared.toJson(includeStoreId: false)['profile_id'], isNull);
    },
  );
  test(
    'editing rates and tax can clear optional bounds and state without changing their owner',
    () {
      const rate = ShippingRateInput(
        zoneId: 'zone',
        name: 'Delivery',
        type: 'flat',
        price: 20,
      );
      expect(rate.toJson().containsKey('min_order_amount'), false);
      expect(rate.toJson(forUpdate: true)['min_order_amount'], isNull);
      expect(rate.toJson(forUpdate: true).containsKey('zone_id'), false);
      const tax = TaxRateInput(storeId: 'site', name: 'GST', rate: 18);
      expect(tax.toJson(includeStoreId: true).containsKey('state'), false);
      expect(tax.toJson(includeStoreId: false).containsKey('state'), true);
      expect(tax.toJson(includeStoreId: false)['state'], isNull);
    },
  );
}
