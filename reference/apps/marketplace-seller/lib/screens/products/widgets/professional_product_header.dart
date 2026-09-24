// lib/screens/products/widgets/professional_product_header.dart
// Professional Product Management Header with Live Status, Filters, Alerts

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:ui';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';


/// Professional Product Header Widget
class ProfessionalProductHeader extends StatelessWidget {
  final bool isDark;
  final bool isLiveRefreshEnabled;
  final bool isTableView;
  final int alertCount;
  final int totalCount;
  final int activeCount;
  final int inactiveCount;
  final int lowStockCount;
  final int pendingCount;
  final VoidCallback onRefresh;
  final VoidCallback onToggleLiveRefresh;
  final VoidCallback? onViewToggle;
  final VoidCallback? onAlertsTapped;
  final VoidCallback? onAddProduct;

  const ProfessionalProductHeader({
    super.key,
    required this.isDark,
    required this.isLiveRefreshEnabled,
    this.isTableView = false,
    required this.alertCount,
    required this.totalCount,
    required this.activeCount,
    required this.inactiveCount,
    required this.lowStockCount,
    required this.pendingCount,
    required this.onRefresh,
    required this.onToggleLiveRefresh,
    this.onViewToggle,
    this.onAlertsTapped,
    this.onAddProduct,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 8,
            left: 16,
            right: 16,
            bottom: 12,
          ),
          decoration: BoxDecoration(
            color: isDark
                ? Colors.black.withValues(alpha: 0.6)
                : Colors.white.withValues(alpha: 0.8),
            border: Border(
              bottom: BorderSide(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.1)
                    : Colors.grey.withValues(alpha: 0.2),
              ),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Main Header Row
              Row(
                children: [
                  // Title with icon
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.inventory_2_rounded,
                      color: AppColors.primary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Products',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3,
                          ),
                        ),
                        Text(
                          'Inventory Control',
                          style: TextStyle(
                            color: isDark ? Colors.grey[500] : Colors.grey[600],
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  // Live Refresh Toggle
                  _buildLiveIndicator(),
                  const SizedBox(width: 8),
                  
                  // Alerts Badge
                  _buildAlertsBadge(),
                  const SizedBox(width: 8),
                  
                  // View Toggle (Card/Table)
                  if (onViewToggle != null) _buildViewToggle(),
                  const SizedBox(width: 4),
                  
                  // Refresh Button
                  IconButton(
                    onPressed: onRefresh,
                    icon: Icon(
                      Icons.refresh_rounded,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                    tooltip: 'Refresh products',
                  ),
                  
                  // Add Product Button
                  if (onAddProduct != null)
                    Container(
                      margin: const EdgeInsets.only(left: 4),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.primary, AppColors.primaryDark],
                        ),
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: IconButton(
                        onPressed: onAddProduct,
                        icon: const Icon(
                          Icons.add_rounded,
                          color: Colors.white,
                        ),
                        tooltip: 'Add new product',
                      ),
                    ),
                ],
              ),
              
              // Quick Stats Row
              const SizedBox(height: 12),
              _buildQuickStats(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLiveIndicator() {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onToggleLiveRefresh();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isLiveRefreshEnabled
              ? Colors.green.withValues(alpha: 0.15)
              : Colors.grey.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isLiveRefreshEnabled
                ? Colors.green.withValues(alpha: 0.4)
                : Colors.grey.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isLiveRefreshEnabled ? Colors.green : Colors.grey,
              ),
            ).animate(
              onPlay: (c) => isLiveRefreshEnabled ? c.repeat() : c.stop(),
            ).fadeIn().then().fadeOut(duration: 800.ms).then().fadeIn(duration: 800.ms),
            const SizedBox(width: 6),
            Text(
              isLiveRefreshEnabled ? 'Live' : 'Paused',
              style: TextStyle(
                color: isLiveRefreshEnabled ? Colors.green[700] : Colors.grey[600],
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAlertsBadge() {
    if (alertCount == 0) {
      return IconButton(
        onPressed: onAlertsTapped,
        icon: Icon(
          Icons.notifications_none_rounded,
          color: isDark ? Colors.grey[500] : Colors.grey[600],
        ),
      );
    }

    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        onAlertsTapped?.call();
      },
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.red.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.notifications_active_rounded,
              color: Colors.red[400],
              size: 22,
            ),
          ).animate(onPlay: (c) => c.repeat(reverse: true))
              .scale(begin: const Offset(1, 1), end: const Offset(1.1, 1.1), duration: 600.ms),
          Positioned(
            top: -4,
            right: -4,
            child: Container(
              padding: const EdgeInsets.all(5),
              decoration: const BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
              child: Text(
                alertCount > 9 ? '9+' : '$alertCount',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickStats() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _buildStatChip('Total', totalCount, AppColors.primary),
          const SizedBox(width: 8),
          _buildStatChip('Active', activeCount, Colors.green),
          const SizedBox(width: 8),
          _buildStatChip('Inactive', inactiveCount, Colors.grey),
          const SizedBox(width: 8),
          _buildStatChip('Low Stock', lowStockCount, Colors.orange),
          const SizedBox(width: 8),
          _buildStatChip('Pending', pendingCount, Colors.amber),
        ],
      ),
    );
  }

  Widget _buildStatChip(String label, int count, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '$label: $count',
            style: TextStyle(
              color: color.withValues(alpha: 0.9),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildViewToggle() {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildViewButton(
            icon: Icons.grid_view_rounded,
            isActive: !isTableView,
            tooltip: 'Card View',
          ),
          _buildViewButton(
            icon: Icons.table_rows_rounded,
            isActive: isTableView,
            tooltip: 'Table View',
          ),
        ],
      ),
    );
  }

  Widget _buildViewButton({
    required IconData icon,
    required bool isActive,
    required String tooltip,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onViewToggle?.call();
      },
      child: Tooltip(
        message: tooltip,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: isActive
                ? (isDark ? Colors.white.withValues(alpha: 0.15) : Colors.white)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          child: Icon(
            icon,
            size: 18,
            color: isActive
                ? (isDark ? Colors.white : AppColors.primary)
                : (isDark ? Colors.grey[500] : Colors.grey[600]),
          ),
        ),
      ),
    );
  }
}
