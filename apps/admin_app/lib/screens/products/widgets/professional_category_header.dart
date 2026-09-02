// lib/screens/products/widgets/professional_category_header.dart
// Professional Category Management Header - Clean Mobile Design

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:ui';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class ProfessionalCategoryHeader extends StatelessWidget {
  final bool isDark;
  final bool isLiveRefreshEnabled;
  final bool isTableView;
  final int alertCount;
  final int totalCount;
  final int rootCount;
  final int activeCount;
  final int inactiveCount;
  final int withProductsCount;
  final int emptyCount;
  final VoidCallback onRefresh;
  final VoidCallback onToggleLiveRefresh;
  final VoidCallback? onViewToggle;
  final VoidCallback? onAlertsTapped;
  final VoidCallback? onAddCategory;
  final VoidCallback? onManageAttributes;

  const ProfessionalCategoryHeader({
    super.key,
    required this.isDark,
    required this.isLiveRefreshEnabled,
    this.isTableView = false,
    required this.alertCount,
    required this.totalCount,
    required this.rootCount,
    required this.activeCount,
    required this.inactiveCount,
    required this.withProductsCount,
    required this.emptyCount,
    required this.onRefresh,
    required this.onToggleLiveRefresh,
    this.onViewToggle,
    this.onAlertsTapped,
    this.onAddCategory,
    this.onManageAttributes,
  });

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 768;

    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 16,
            left: 16,
            right: 16,
            bottom: 16,
          ),
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF0F172A).withValues(alpha: 0.95)
                : Colors.white.withValues(alpha: 0.95),
            border: Border(
              bottom: BorderSide(
                color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade200,
              ),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Row 1: Title + Action Buttons
              Row(
                children: [
                  // Icon
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryDark],
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.category_rounded, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 14),
                  
                  // Title
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Categories',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontSize: isMobile ? 20 : 24,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Manage your product hierarchy',
                          style: TextStyle(
                            color: isDark ? Colors.grey[500] : Colors.grey[600],
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  // Action Buttons (Bell, Refresh, Add)
                  _buildAlertBell(),
                  const SizedBox(width: 8),
                  _buildRefreshButton(),
                  const SizedBox(width: 8),
                  if (onAddCategory != null) _buildAddButton(),
                ],
              ),
              
              const SizedBox(height: 16),
              
              // Row 2: Quick Actions (Live, View Toggle, Attributes)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildLiveToggle(),
                    const SizedBox(width: 10),
                    if (onViewToggle != null) ...[
                      _buildViewToggle(),
                      const SizedBox(width: 10),
                    ],
                    if (onManageAttributes != null)
                      _buildAttributesButton(),
                  ],
                ),
              ),
              
              const SizedBox(height: 14),
              
              // Row 3: Stats Chips with Labels
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildStatChip('Total', totalCount, AppColors.primary),
                    const SizedBox(width: 8),
                    _buildStatChip('Root', rootCount, const Color(0xFF6366F1)),
                    const SizedBox(width: 8),
                    _buildStatChip('Active', activeCount, const Color(0xFF10B981)),
                    const SizedBox(width: 8),
                    _buildStatChip('Inactive', inactiveCount, const Color(0xFF6B7280)),
                    const SizedBox(width: 8),
                    _buildStatChip('With Products', withProductsCount, const Color(0xFF14B8A6)),
                    const SizedBox(width: 8),
                    _buildStatChip('Empty', emptyCount, const Color(0xFFF59E0B)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 300.ms);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION BUTTONS (Right side of header)
  // ═══════════════════════════════════════════════════════════════════════════
  
  Widget _buildAlertBell() {
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        onAlertsTapped?.call();
      },
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: alertCount > 0
                  ? Colors.orange.withValues(alpha: 0.12)
                  : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade100),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              alertCount > 0 ? Icons.notifications_active_rounded : Icons.notifications_none_rounded,
              color: alertCount > 0 ? Colors.orange : (isDark ? Colors.grey[400] : Colors.grey[600]),
              size: 22,
            ),
          ),
          if (alertCount > 0)
            Positioned(
              top: -4,
              right: -4,
              child: Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: Colors.orange,
                  shape: BoxShape.circle,
                  border: Border.all(color: isDark ? const Color(0xFF0F172A) : Colors.white, width: 2),
                  boxShadow: [
                    BoxShadow(color: Colors.orange.withValues(alpha: 0.4), blurRadius: 6),
                  ],
                ),
                child: Text(
                  alertCount > 9 ? '9+' : '$alertCount',
                  style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800),
                ),
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
              .scale(begin: const Offset(1, 1), end: const Offset(1.15, 1.15), duration: 600.ms),
        ],
      ),
    );
  }

  Widget _buildRefreshButton() {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onRefresh();
      },
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          Icons.refresh_rounded,
          color: isDark ? Colors.grey[400] : Colors.grey[600],
          size: 22,
        ),
      ),
    );
  }

  Widget _buildAddButton() {
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        onAddCategory?.call();
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColors.primary, AppColors.primaryDark],
          ),
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 22),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUICK ACTION ROW
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildLiveToggle() {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onToggleLiveRefresh();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isLiveRefreshEnabled
              ? const Color(0xFF10B981).withValues(alpha: 0.12)
              : (isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.shade100),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isLiveRefreshEnabled
                ? const Color(0xFF10B981).withValues(alpha: 0.3)
                : (isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade300),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8, height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isLiveRefreshEnabled ? const Color(0xFF10B981) : Colors.grey,
                boxShadow: isLiveRefreshEnabled
                    ? [BoxShadow(color: const Color(0xFF10B981).withValues(alpha: 0.6), blurRadius: 6)]
                    : null,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              isLiveRefreshEnabled ? 'Live' : 'Paused',
              style: TextStyle(
                color: isLiveRefreshEnabled ? const Color(0xFF059669) : Colors.grey[600],
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildViewToggle() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade300,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildViewOption(Icons.account_tree_rounded, !isTableView, 'Tree'),
          const SizedBox(width: 4),
          _buildViewOption(Icons.view_list_rounded, isTableView, 'Table'),
        ],
      ),
    );
  }

  Widget _buildViewOption(IconData icon, bool isActive, String label) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onViewToggle?.call();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? (isDark ? AppColors.primary.withValues(alpha: 0.2) : AppColors.primary.withValues(alpha: 0.1))
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: isActive ? AppColors.primary : (isDark ? Colors.grey[500] : Colors.grey[600]),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isActive ? AppColors.primary : (isDark ? Colors.grey[500] : Colors.grey[600]),
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttributesButton() {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onManageAttributes?.call();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade300,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.tune_rounded,
              size: 16,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
            const SizedBox(width: 8),
            Text(
              'Attributes',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATS CHIPS
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildStatChip(String label, int count, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7, height: 7,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
          Text(
            '$count',
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
