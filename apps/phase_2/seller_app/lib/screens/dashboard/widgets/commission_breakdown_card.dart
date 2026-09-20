// Commission Breakdown Widget
// Shows seller their current commission rate, tier, and formula

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

class CommissionBreakdownCard extends StatelessWidget {
  final String sellerId;
  final VoidCallback? onTapDetails;

  const CommissionBreakdownCard({
    super.key,
    required this.sellerId,
    this.onTapDetails,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('sellers')
          .doc(sellerId)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return _buildLoadingCard(isDark);
        }

        final sellerData = snapshot.data!.data() as Map<String, dynamic>?;
        if (sellerData == null) return const SizedBox.shrink();

        final commission = SellerCommission.fromMap(
          sellerData['commission'] as Map<String, dynamic>?,
        );

        return _buildCard(context, isDark, commission);
      },
    );
  }

  Widget _buildLoadingCard(bool isDark) {
    return Container(
      height: 140,
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      ),
    );
  }

  Widget _buildCard(BuildContext context, bool isDark, SellerCommission commission) {
    return GestureDetector(
      onTap: onTapDetails,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppColors.primary.withValues(alpha: 0.1),
              AppColors.secondary.withValues(alpha: 0.05),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.primary.withValues(alpha: 0.2),
            width: 1.5,
          ),
        ),
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: AppColors.primary.withValues(alpha: 0.1),
                  ),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.percent_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Your Commission Rate',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Per order deduction',
                          style: TextStyle(
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (onTapDetails != null)
                    Icon(
                      Icons.arrow_forward_ios_rounded,
                      color: AppColors.primary,
                      size: 16,
                    ),
                ],
              ),
            ),

            // Content
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  // Tier Badge
                  _buildTierBadge(commission),
                  const SizedBox(width: 16),

                  // Commission Details
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Modifier Row
                        Row(
                          children: [
                            Text(
                              'Tier Modifier: ',
                              style: TextStyle(
                                color: isDark ? Colors.grey[400] : Colors.grey[600],
                                fontSize: 12,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: commission.tierModifier > 0
                                    ? Colors.red.withValues(alpha: 0.1)
                                    : commission.tierModifier < 0
                                        ? AppColors.success.withValues(alpha: 0.1)
                                        : Colors.grey.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '${commission.tierModifier >= 0 ? '+' : ''}${commission.tierModifier}%',
                                style: TextStyle(
                                  color: commission.tierModifier > 0
                                      ? Colors.red
                                      : commission.tierModifier < 0
                                          ? AppColors.success
                                          : Colors.grey,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),

                        // Override or Formula
                        if (commission.hasCustomOverride)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.warning.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: AppColors.warning.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.admin_panel_settings_rounded,
                                  size: 14,
                                  color: AppColors.warning,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'Fixed Rate: ${commission.customOverride}%',
                                  style: TextStyle(
                                    color: AppColors.warning,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else
                          Text(
                            'Category Base + Tier = Your Rate',
                            style: TextStyle(
                              color: isDark ? Colors.grey[500] : Colors.grey[600],
                              fontSize: 11,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Ad Order Bonus Info
            Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.accent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.ads_click_rounded,
                    size: 14,
                    color: AppColors.accent,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Orders from ads get extra commission discount!',
                      style: TextStyle(
                        color: AppColors.accent,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn().slideY(begin: 0.05);
  }

  Widget _buildTierBadge(SellerCommission commission) {
    Color tierColor;
    IconData tierIcon;

    switch (commission.tier) {
      case SellerTier.newSeller:
        tierColor = Colors.orange;
        tierIcon = Icons.fiber_new_rounded;
        break;
      case SellerTier.standard:
        tierColor = Colors.blue;
        tierIcon = Icons.verified_user_outlined;
        break;
      case SellerTier.verified:
        tierColor = AppColors.success;
        tierIcon = Icons.verified_rounded;
        break;
      case SellerTier.premium:
        tierColor = Colors.purple;
        tierIcon = Icons.workspace_premium_rounded;
        break;
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tierColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: tierColor.withValues(alpha: 0.3),
          width: 2,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(tierIcon, color: tierColor, size: 28),
          const SizedBox(height: 4),
          Text(
            commission.tierDisplayName,
            style: TextStyle(
              color: tierColor,
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

/// Widget to show commission breakdown for a specific order
class OrderCommissionBreakdown extends StatelessWidget {
  final double orderTotal;
  final Map<String, dynamic>? commissionSnapshot;

  const OrderCommissionBreakdown({
    super.key,
    required this.orderTotal,
    this.commissionSnapshot,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (commissionSnapshot == null) {
      return const SizedBox.shrink();
    }

    final categoryPercent = (commissionSnapshot!['categoryPercent'] as num?)?.toDouble() ?? 0;
    final tierModifier = (commissionSnapshot!['tierModifier'] as num?)?.toDouble() ?? 0;
    final adDiscount = (commissionSnapshot!['adDiscount'] as num?)?.toDouble() ?? 0;
    final finalPercent = (commissionSnapshot!['finalPercent'] as num?)?.toDouble() ?? 0;
    final commissionAmount = (commissionSnapshot!['commissionAmount'] as num?)?.toDouble() ?? 0;
    final sellerEarnings = (commissionSnapshot!['sellerEarnings'] as num?)?.toDouble() ?? 0;
    final isAdOrder = commissionSnapshot!['isAdOrder'] == true;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.receipt_long_rounded, color: AppColors.primary, size: 18),
              const SizedBox(width: 8),
              Text(
                'Commission Breakdown',
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (isAdOrder) ...[
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.accent.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.ads_click, size: 12, color: AppColors.accent),
                      const SizedBox(width: 4),
                      Text(
                        'Ad Order',
                        style: TextStyle(
                          color: AppColors.accent,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),

          // Formula breakdown
          _buildRow('Category Base', '$categoryPercent%', isDark),
          _buildRow(
            'Tier Modifier',
            '${tierModifier >= 0 ? '+' : ''}$tierModifier%',
            isDark,
            valueColor: tierModifier > 0 ? Colors.red : tierModifier < 0 ? AppColors.success : null,
          ),
          if (isAdOrder)
            _buildRow(
              'Ad Discount',
              '-$adDiscount%',
              isDark,
              valueColor: AppColors.success,
            ),
          const Divider(height: 24),
          _buildRow(
            'Final Rate',
            '$finalPercent%',
            isDark,
            isBold: true,
          ),
          const SizedBox(height: 8),

          // Amount breakdown
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Order Total',
                        style: TextStyle(
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                          fontSize: 11,
                        ),
                      ),
                      Text(
                        '₹${orderTotal.toStringAsFixed(0)}',
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    children: [
                      Text(
                        'Commission',
                        style: TextStyle(
                          color: Colors.red,
                          fontSize: 10,
                        ),
                      ),
                      Text(
                        '-₹${commissionAmount.toStringAsFixed(0)}',
                        style: const TextStyle(
                          color: Colors.red,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    children: [
                      Text(
                        'You Earn',
                        style: TextStyle(
                          color: AppColors.success,
                          fontSize: 10,
                        ),
                      ),
                      Text(
                        '₹${sellerEarnings.toStringAsFixed(0)}',
                        style: TextStyle(
                          color: AppColors.success,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, bool isDark, {Color? valueColor, bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              fontSize: 13,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: valueColor ?? (isDark ? Colors.white : Colors.black87),
              fontSize: 13,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
