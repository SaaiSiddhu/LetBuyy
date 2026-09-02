// lib/screens/admin/orders/widgets/admin_order_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart'; // ✅ ADDED: For strong typing
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart'; // ✅ ADDED: For theming

class AdminOrderCard extends StatelessWidget {
  final OrderModel order; // ✅ Changed from dynamic to OrderModel
  final VoidCallback onTap;

  const AdminOrderCard({
    super.key,
    required this.order,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // ✅ ADDED: Theme properties
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    
    final statusConfig = _getStatusConfig(order.orderStatus);
    final isPaid = order.paymentStatus.toLowerCase() == 'paid';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12), // ✅ Reduced margin
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border, width: 1), // ✅ Fixed
          boxShadow: [
            BoxShadow(
              color: isDark ? AppColors.shadowDark : AppColors.shadowLight, // ✅ Fixed
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
          // ✅ Removed gradient for solid color
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Column(
            children: [
              // Gradient Header Strip with motion feel
              Container(
                height: 6,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      statusConfig['color'].withValues(alpha: 0.9),
                      statusConfig['color'].withValues(alpha: 0.4),
                    ],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                ),
              ).animate().shimmer(duration: 1800.ms),

              Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ─── Header Row ──────────────────────────────
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Order Info
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Order #${order.orderNumber}",
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: isDark ? AppColors.textLight : AppColors.textPrimary, // ✅ Fixed
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              DateFormat('MMM dd, yyyy • hh:mm a')
                                  .format(order.createdAt),
                              style: TextStyle(
                                fontSize: 12.5,
                                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, // ✅ Fixed
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        _buildStatusChip(statusConfig),
                      ],
                    ),

                    const SizedBox(height: 16),
                    Divider(color: isDark ? AppColors.borderDark : AppColors.border, height: 1.2), // ✅ Fixed
                    const SizedBox(height: 16),

                    // ─── Customer + Items Row ───────────────────
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildInfoItem(
                          icon: Icons.person_outline_rounded,
                          title: "Customer",
                          value: order.deliveryAddress.name,
                          isDark: isDark, // ✅ Passed
                          accentColor: accentColor, // ✅ Passed
                        ),
                        _buildChip(
                          '${order.items.length} Items',
                          accentColor.withValues(alpha: 0.1),
                          accentColor,
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),
                    Divider(color: isDark ? AppColors.borderDark : AppColors.border, height: 1.2), // ✅ Fixed
                    const SizedBox(height: 16),

                    // ─── Total + Payment ────────────────────────
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildInfoItem(
                          icon: Icons.currency_rupee_rounded,
                          title: "Total Amount",
                          value: '₹${order.total.toStringAsFixed(2)}',
                          bold: true,
                          isDark: isDark, // ✅ Passed
                          accentColor: accentColor, // ✅ Passed
                        ),
                        Row(
                          children: [
                            AnimatedContainer(
                              duration: 300.ms,
                              curve: Curves.easeOut,
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isPaid
                                    ? AppColors.success.withValues(alpha: 0.15) // ✅ Fixed
                                    : AppColors.warning.withValues(alpha: 0.15), // ✅ Fixed
                              ),
                              child: Icon(
                                isPaid
                                    ? Icons.verified_rounded
                                    : Icons.pending_actions_rounded,
                                size: 18,
                                color: isPaid
                                    ? AppColors.successDark // ✅ Fixed
                                    : AppColors.warningDark, // ✅ Fixed
                              ),
                            ),
                            const SizedBox(width: 8),
                            _buildChip(
                              isPaid ? 'PAID' : 'PENDING',
                              isPaid
                                  ? AppColors.success.withValues(alpha: 0.12) // ✅ Fixed
                                  : AppColors.warning.withValues(alpha: 0.12), // ✅ Fixed
                              isPaid
                                  ? AppColors.successDark // ✅ Fixed
                                  : AppColors.warningDark, // ✅ Fixed
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: 16, end: 0, curve: Curves.easeOutCubic)
        .scale(begin: const Offset(0.96, 0.96), end: const Offset(1, 1));
  }

  // ───────────────────────────────
  // 🧩 Helper Widgets
  // ───────────────────────────────

  Widget _buildInfoItem({
    required IconData icon,
    required String title,
    required String value,
    required bool isDark, // ✅ ADDED
    required Color accentColor, // ✅ ADDED
    bool bold = false,
  }) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant, // ✅ Fixed
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: accentColor, size: 18),
        ),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, // ✅ Fixed
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              value,
              style: TextStyle(
                fontSize: bold ? 15 : 13.5,
                fontWeight:
                    bold ? FontWeight.w800 : FontWeight.w600,
                color: isDark ? AppColors.textLight : AppColors.textPrimary, // ✅ Fixed
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildChip(String text, Color bgColor, Color textColor) {
    return AnimatedContainer(
      duration: 300.ms,
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(50),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
          color: textColor,
        ),
      ),
    );
  }

  Widget _buildStatusChip(Map<String, dynamic> config) {
    return AnimatedContainer(
      duration: 300.ms,
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: config['color'].withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(50),
        border: Border.all(color: config['color'].withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
            color: config['color'].withValues(alpha: 0.15),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(config['icon'], size: 14, color: config['color']),
          const SizedBox(width: 6),
          Text(
            config['label'],
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              color: config['color'],
            ),
          ),
        ],
      ),
    );
  }

  // ───────────────────────────────
  // 🎨 Status Configuration
  // ───────────────────────────────
  Map<String, dynamic> _getStatusConfig(String status) {
    // ✅ MAPPED TO APPCOLORS
    switch (status.toLowerCase()) {
      case 'pending':
        return {
          'label': 'Pending',
          'color': AppColors.pending,
          'icon': Icons.schedule_rounded,
        };
      case 'confirmed':
        return {
          'label': 'Confirmed',
          'color': AppColors.confirmed,
          'icon': Icons.check_circle_outline_rounded,
        };
      case 'processing':
        return {
          'label': 'Processing',
          'color': AppColors.processing,
          'icon': Icons.autorenew_rounded,
        };
      case 'shipped':
        return {
          'label': 'Shipped',
          'color': AppColors.shipped,
          'icon': Icons.local_shipping_outlined,
        };
      case 'delivered':
      case 'completed': // Handle both
        return {
          'label': 'Delivered',
          'color': AppColors.delivered,
          'icon': Icons.check_circle_rounded,
        };
      case 'cancelled':
        return {
          'label': 'Cancelled',
          'color': AppColors.cancelled,
          'icon': Icons.cancel_outlined,
        };
      default:
        return {
          'label': status,
          'color': AppColors.grey,
          'icon': Icons.info_outline_rounded,
        };
    }
  }
}