// apps/marketplace/lib/screens/returns/widgets/return_eligibility_widget.dart
// ✅ RETURN ELIGIBILITY WIDGET
// Shows if product is eligible for return/exchange

import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class ReturnEligibilityWidget extends StatelessWidget {
  final bool isReturnable;
  final int returnWindowDays;
  final DateTime? orderDeliveryDate;
  final bool isCompact;

  const ReturnEligibilityWidget({
    super.key,
    this.isReturnable = true,
    this.returnWindowDays = 7,
    this.orderDeliveryDate,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (isCompact) {
      return _buildCompact(isDark);
    }
    return _buildFull(isDark);
  }

  Widget _buildCompact(bool isDark) {
    if (!isReturnable) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.block, size: 14, color: AppColors.errorLight),
          const SizedBox(width: 4),
          Text(
            'Non-returnable',
            style: TextStyle(
              color: AppColors.errorLight,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      );
    }

    final daysRemaining = _getDaysRemaining();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.refresh, size: 14, color: AppColors.success),
        const SizedBox(width: 4),
        Text(
          daysRemaining != null
              ? '$daysRemaining days left to return'
              : '$returnWindowDays-day return',
          style: TextStyle(
            color: AppColors.success,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildFull(bool isDark) {
    if (!isReturnable) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.block, size: 16, color: AppColors.error),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Non-returnable Item',
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    'This item cannot be returned or exchanged',
                    style: TextStyle(
                      color: isDark ? Colors.white54 : Colors.grey[600],
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final daysRemaining = _getDaysRemaining();
    final isExpired = daysRemaining != null && daysRemaining <= 0;

    if (isExpired) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.grey.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.timer_off, size: 16, color: Colors.grey),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Return Window Expired',
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    'The $returnWindowDays-day return window has passed',
                    style: TextStyle(
                      color: isDark ? Colors.white54 : Colors.grey[600],
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.refresh, size: 16, color: AppColors.success),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '$returnWindowDays-Day Return/Exchange',
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    const Spacer(),
                    if (daysRemaining != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: daysRemaining <= 2
                              ? AppColors.warning.withValues(alpha: 0.2)
                              : AppColors.success.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '$daysRemaining days left',
                          style: TextStyle(
                            color: daysRemaining <= 2
                                ? AppColors.warning
                                : AppColors.success,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'Easy returns & exchanges with doorstep pickup',
                  style: TextStyle(
                    color: isDark ? Colors.white54 : Colors.grey[600],
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  int? _getDaysRemaining() {
    if (orderDeliveryDate == null) return null;
    final deadline = orderDeliveryDate!.add(Duration(days: returnWindowDays));
    final remaining = deadline.difference(DateTime.now()).inDays;
    return remaining;
  }
}

/// Button to initiate return/exchange
class ReturnExchangeButton extends StatelessWidget {
  final bool isEnabled;
  final String? disabledReason;
  final VoidCallback? onPressed;

  const ReturnExchangeButton({
    super.key,
    this.isEnabled = true,
    this.disabledReason,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ElevatedButton.icon(
          onPressed: isEnabled ? onPressed : null,
          icon: const Icon(Icons.assignment_return, size: 18),
          label: const Text('Return or Exchange'),
          style: ElevatedButton.styleFrom(
            backgroundColor: isEnabled
                ? AppColors.primary
                : (isDark ? Colors.grey[800] : Colors.grey[300]),
            foregroundColor: isEnabled
                ? Colors.white
                : (isDark ? Colors.grey[500] : Colors.grey),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        if (!isEnabled && disabledReason != null) ...[
          const SizedBox(height: 8),
          Text(
            disabledReason!,
            style: TextStyle(
              color: isDark ? Colors.white38 : Colors.grey,
              fontSize: 12,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }
}
