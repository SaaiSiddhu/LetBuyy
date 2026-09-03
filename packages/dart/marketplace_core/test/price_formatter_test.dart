import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';

void main() {
  group('PriceFormatter.formatPrice (en_IN lakh/crore grouping)', () {
    // Expected strings are derived from the well-known Indian numbering
    // convention (groups of 2 digits after the initial group of 3 from the
    // right) -- not obtained by running the formatter and copying its
    // output. 1 lakh = 1,00,000; 1 crore = 1,00,00,000.
    test('groups a value under 1,000 with no separator', () {
      expect(PriceFormatter.formatPrice(999), '₹999.00');
    });

    test('groups a value in the thousands like a Western thousands separator', () {
      expect(PriceFormatter.formatPrice(1234.5), '₹1,234.50');
    });

    test('groups exactly 1 lakh as 1,00,000', () {
      expect(PriceFormatter.formatPrice(100000), '₹1,00,000.00');
    });

    test('groups exactly 1 crore as 1,00,00,000', () {
      expect(PriceFormatter.formatPrice(10000000), '₹1,00,00,000.00');
    });
  });

  group('PriceFormatter.formatPriceCompact', () {
    test('formats crore-scale amounts with Cr suffix', () {
      expect(PriceFormatter.formatPriceCompact(15000000), '₹1.50Cr');
    });

    test('formats lakh-scale amounts with L suffix', () {
      expect(PriceFormatter.formatPriceCompact(250000), '₹2.50L');
    });

    test('formats thousand-scale amounts with K suffix', () {
      expect(PriceFormatter.formatPriceCompact(5000), '₹5.0K');
    });

    test('falls back to plain integer formatting below 1,000', () {
      expect(PriceFormatter.formatPriceCompact(500), '₹500');
    });

    test('the boundary at exactly 1,000 uses K, not the plain fallback', () {
      expect(PriceFormatter.formatPriceCompact(1000), '₹1.0K');
    });
  });

  group('PriceFormatter discount math', () {
    test('calculateDiscountPercentage computes a round percentage', () {
      expect(PriceFormatter.calculateDiscountPercentage(1000, 750), 25);
    });

    test('calculateDiscountPercentage guards against a zero original price', () {
      expect(PriceFormatter.calculateDiscountPercentage(0, 100), 0);
    });

    test(
      'calculateDiscountPercentage returns a negative number when the sale '
      'price is HIGHER than the original -- it does not clamp to zero',
      () {
        expect(PriceFormatter.calculateDiscountPercentage(100, 133), -33);
      },
    );

    test('formatDiscount composes the percentage into an OFF label', () {
      expect(PriceFormatter.formatDiscount(1000, 750), '25% OFF');
    });

    test('applyDiscount reduces the price by the given percentage', () {
      expect(PriceFormatter.applyDiscount(1000, 20), 800.0);
    });

    test('applyDiscount at 0% leaves the price unchanged', () {
      expect(PriceFormatter.applyDiscount(1000, 0), 1000.0);
    });
  });

  group('PriceFormatter GST/tax math', () {
    test('calculateTax computes 18% GST correctly', () {
      expect(PriceFormatter.calculateTax(1000, 18), 180.0);
    });

    test('calculatePriceWithTax adds the tax to the base price', () {
      expect(PriceFormatter.calculatePriceWithTax(1000, 18), 1180.0);
    });
  });

  group('PriceFormatter totals and averages', () {
    test('calculateTotal sums a list of line-item prices', () {
      expect(PriceFormatter.calculateTotal([100, 200, 300]), 600.0);
    });

    test('calculateTotal of an empty cart is zero, not an error', () {
      expect(PriceFormatter.calculateTotal([]), 0.0);
    });

    test('calculateAverage divides the total by the item count', () {
      expect(PriceFormatter.calculateAverage([100, 200, 300]), 200.0);
    });

    test('calculateAverage of an empty list is zero, not a division error', () {
      expect(PriceFormatter.calculateAverage([]), 0.0);
    });
  });

  group('PriceFormatter.isValidPrice', () {
    test('a negative price is invalid', () {
      expect(PriceFormatter.isValidPrice(-0.01), isFalse);
    });

    test('zero is a valid price (e.g. a fully-discounted item)', () {
      expect(PriceFormatter.isValidPrice(0), isTrue);
    });
  });

  group('PriceFormatter rounding', () {
    test('roundPrice rounds to the nearest whole rupee', () {
      expect(PriceFormatter.roundPrice(1234.4), 1234.0);
      expect(PriceFormatter.roundPrice(1234.6), 1235.0);
    });

    test('roundPriceUp always rounds toward positive infinity', () {
      expect(PriceFormatter.roundPriceUp(1234.01), 1235.0);
    });

    test('roundPriceDown always rounds toward zero for a positive price', () {
      expect(PriceFormatter.roundPriceDown(1234.99), 1234.0);
    });
  });

  group('PriceFormatter.parsePrice', () {
    test('strips the currency symbol and thousands commas', () {
      expect(PriceFormatter.parsePrice('₹1,23,456.78'), 123456.78);
    });

    test('returns null for unparseable input instead of throwing', () {
      expect(PriceFormatter.parsePrice('not a price'), isNull);
    });
  });

  group('PriceFormatter.calculatePricePerUnit', () {
    test('divides the total by the quantity', () {
      expect(PriceFormatter.calculatePricePerUnit(100, 4), 25.0);
    });

    test('guards against a zero or negative quantity instead of dividing by zero', () {
      expect(PriceFormatter.calculatePricePerUnit(100, 0), 0.0);
      expect(PriceFormatter.calculatePricePerUnit(100, -1), 0.0);
    });
  });

  group('PriceFormatter.calculateCheckoutTotal', () {
    test('subtracts the discount and adds delivery and tax', () {
      expect(
        PriceFormatter.calculateCheckoutTotal(
          subtotal: 1000,
          discount: 100,
          deliveryCharge: 50,
          tax: 18,
        ),
        968.0,
      );
    });

    test('tax defaults to zero when omitted', () {
      expect(
        PriceFormatter.calculateCheckoutTotal(
          subtotal: 1000,
          discount: 0,
          deliveryCharge: 0,
        ),
        1000.0,
      );
    });
  });

  group('PriceFormatter.formatCheckoutBreakdown', () {
    test('formats every line and a total that reflects them all', () {
      final breakdown = PriceFormatter.formatCheckoutBreakdown(
        subtotal: 1000,
        discount: 100,
        deliveryCharge: 50,
        tax: 18,
      );

      expect(breakdown['subtotal'], '₹1,000.00');
      expect(breakdown['discount'], '₹100.00');
      expect(breakdown['deliveryCharge'], '₹50.00');
      expect(breakdown['tax'], '₹18.00');
      expect(breakdown['total'], '₹968.00');
    });
  });

  group('PriceFormatter free-delivery threshold', () {
    test('the threshold amount itself already qualifies (inclusive)', () {
      expect(PriceFormatter.isFreeDelivery(500, 500), isTrue);
    });

    test('one rupee under the threshold does not qualify', () {
      expect(PriceFormatter.isFreeDelivery(499, 500), isFalse);
    });

    test('amountNeededForFreeDelivery computes the shortfall', () {
      expect(PriceFormatter.amountNeededForFreeDelivery(300, 500), 200.0);
    });

    test('amountNeededForFreeDelivery clamps to zero once qualified, never negative', () {
      expect(PriceFormatter.amountNeededForFreeDelivery(600, 500), 0);
    });

    test('formatFreeDeliveryMessage reports the shortfall when not yet free', () {
      expect(
        PriceFormatter.formatFreeDeliveryMessage(300, 500),
        'Add ₹200.00 more for free delivery',
      );
    });

    test('formatFreeDeliveryMessage congratulates once qualified', () {
      expect(
        PriceFormatter.formatFreeDeliveryMessage(600, 500),
        'You have free delivery!',
      );
    });
  });
}
