import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

// Phase 1R corrective (C2): CouponProvider was entirely FirebaseFirestore-backed with no
// canonical successor. Its coupon-entry affordance here (manual code entry, "View Available
// Coupons", remove-applied-coupon) was already fully non-functional -- fetchAvailableCoupons()/
// applyCouponByCode() always fail with Firestore unreachable -- and each was a tap-time
// ProviderNotFoundException risk once the provider is deregistered (context.read<CouponProvider>()
// inside onTap handlers, not build()). Dropped the whole affordance rather than offer a broken
// action; the price breakdown itself never depended on the provider (subtotal/discount/total/
// couponCode are all parent-passed values) and is unchanged.
class CartSummary extends StatelessWidget {
  final double subtotal;
  final double discount;
  final double deliveryCharge;
  final double tax;
  final double total;
  final String? couponCode;

  const CartSummary({
    super.key,
    required this.subtotal,
    this.discount = 0.0,
    this.deliveryCharge = 0.0,
    this.tax = 0.0,
    required this.total,
    this.couponCode,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildHeader(),
          _buildPriceBreakdown(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Row(
        children: [
          const Icon(Icons.receipt_long, color: AppColors.primary),
          const SizedBox(width: 8),
          Text('Price Summary',
              style: AppTextStyles.titleMedium.copyWith(
                fontWeight: FontWeight.bold,
              )),
        ],
      ),
    );
  }

  Widget _buildPriceBreakdown() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildRow('Subtotal', subtotal),
          if (discount > 0)
            _buildRow('Discount', -discount, color: AppColors.success),
          _buildRow('Delivery', 0.0),
          _buildRow('Tax', 0.0),
          const Divider(thickness: 1),
          _buildRow('Total', total, bold: true, color: AppColors.primary),
        ],
      ),
    );
  }

  Widget _buildRow(String label, double value, {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: bold
                  ? AppTextStyles.titleMedium.copyWith(fontWeight: FontWeight.bold)
                  : AppTextStyles.bodyMedium),
          Text(
            '₹${value.toStringAsFixed(2)}',
            style: TextStyle(
              fontWeight: bold ? FontWeight.bold : FontWeight.normal,
              color: color ?? AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
