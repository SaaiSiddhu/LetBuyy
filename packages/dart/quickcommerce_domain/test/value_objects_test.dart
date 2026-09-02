import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:test/test.dart';

void main() {
  group('EntityId', () {
    test('normalizes valid UUIDs', () {
      final id = EntityId('00000000-0000-4000-8000-000000000001');
      expect(id.value, '00000000-0000-4000-8000-000000000001');
    });

    test('rejects invalid UUIDs', () {
      expect(() => EntityId('bad-id'), throwsArgumentError);
    });
  });

  group('Money', () {
    test('uses paise precision and currency-safe addition', () {
      final total = const Money(paise: 1000) + const Money(paise: 250);
      expect(total.paise, 1250);
      expect(total.currency, 'INR');
    });

    test('rejects currency-mismatched operations', () {
      expect(
        () =>
            const Money(paise: 1000, currency: 'INR') +
            const Money(paise: 1000, currency: 'USD'),
        throwsStateError,
      );
    });

    test('supports signed ledger amounts', () {
      const debit = Money(paise: -500);
      expect(debit.isNegative, isTrue);
    });
  });

  group('GeoPoint', () {
    test('validates coordinate ranges', () {
      expect(() => GeoPoint(latitude: 91, longitude: 0), throwsArgumentError);
      expect(() => GeoPoint(latitude: 0, longitude: 181), throwsArgumentError);
    });

    test('computes approximate distance', () {
      final a = GeoPoint(latitude: 28.6139, longitude: 77.2090);
      final b = GeoPoint(latitude: 28.6149, longitude: 77.2090);
      expect(a.distanceToMeters(b), greaterThan(100));
    });
  });

  test('DateRange requires end after start', () {
    final now = DateTime.utc(2026, 1, 1);
    expect(() => DateRange(startsAt: now, endsAt: now), throwsArgumentError);
  });
}
