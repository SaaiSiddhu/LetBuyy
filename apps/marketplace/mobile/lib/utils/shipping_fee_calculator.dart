import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

/// Extracted from `mobile_cart_screen.dart`'s former private `_calculateShippingFees` (found
/// during Phase 1R C5 device testing: checkout's own total silently dropped the shipping fee
/// entirely, because this calculation lived only in the cart screen's State, unreachable from
/// checkout_screen.dart / payment_method_screen.dart). Both cart and checkout now call this same
/// function over the same cart items + product cache, so their totals are structurally guaranteed
/// to agree rather than coincidentally matching two independently-written formulas.
class ShippingFeeInfo {
  final double standardFee;
  final List<String> standardProducts;
  final Map<String, double> specialFees;
  final List<String> freeDeliveryProducts;
  final double? expressDeliveryFee;
  final List<String> expressAvailableProducts;
  final Map<String, String> productDeliveryDays;

  ShippingFeeInfo({
    required this.standardFee,
    required this.standardProducts,
    required this.specialFees,
    required this.freeDeliveryProducts,
    this.expressDeliveryFee,
    required this.expressAvailableProducts,
    required this.productDeliveryDays,
  });

  double get totalShippingFee {
    double total = standardProducts.isNotEmpty ? standardFee : 0;
    total += specialFees.values.fold(0.0, (sum, fee) => sum + fee);
    return total;
  }

  bool get hasMixedDelivery =>
      freeDeliveryProducts.isNotEmpty && (standardProducts.isNotEmpty || specialFees.isNotEmpty);
}

ShippingFeeInfo calculateShippingFees(
  List<CartItemModel> items,
  Map<String, ProductModel> productCache,
) {
  final standardFeeProducts = <String>[];
  final specialFees = <String, double>{};
  final freeDeliveryProducts = <String>[];
  final expressAvailableProducts = <String>[];
  final productDeliveryDays = <String, String>{};

  double? commonStandardFee;
  double? expressDeliveryFee;

  for (final item in items) {
    if (item.isFreeItem) continue;

    final product = productCache[item.productId];
    if (product == null) continue;

    final shippingDays = product.shippingDays ?? '2-3';
    productDeliveryDays[item.productName] = shippingDays;

    final isFreeDelivery = product.isFreeDelivery ?? false;
    if (isFreeDelivery) {
      freeDeliveryProducts.add(item.productName);
      continue;
    }

    final hasExpressDelivery = product.expressDelivery ?? false;
    if (hasExpressDelivery) {
      expressAvailableProducts.add(item.productName);
      expressDeliveryFee ??= (product.shippingPrice?.toDouble() ?? 40.0) + 9.0;
    }

    final shippingPrice = product.shippingPrice?.toDouble() ?? 40.0;

    if (commonStandardFee == null) {
      commonStandardFee = shippingPrice;
      standardFeeProducts.add(item.productName);
    } else if (shippingPrice == commonStandardFee) {
      standardFeeProducts.add(item.productName);
    } else if (shippingPrice > commonStandardFee) {
      specialFees[item.productName] = shippingPrice;
    } else {
      standardFeeProducts.add(item.productName);
    }
  }

  return ShippingFeeInfo(
    standardFee: commonStandardFee ?? 0,
    standardProducts: standardFeeProducts,
    specialFees: specialFees,
    freeDeliveryProducts: freeDeliveryProducts,
    expressDeliveryFee: expressDeliveryFee,
    expressAvailableProducts: expressAvailableProducts,
    productDeliveryDays: productDeliveryDays,
  );
}
