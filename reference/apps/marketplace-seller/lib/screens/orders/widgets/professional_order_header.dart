// lib/screens/orders/widgets/professional_order_header.dart
// Professional Order Header with Live Refresh, Date Range, and Alert Badges

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

/// Date range options for filtering
enum DateRange {
  today('Today'),
  yesterday('Yesterday'),
  thisWeek('This Week'),
  thisMonth('This Month'),
  last30Days('Last 30 Days'),
  custom('Custom');

  final String label;
  const DateRange(this.label);
}

// Note: QuickFilter is defined in smart_order_search.dart

// ═══════════════════════════════════════════════════════════════════════════
// PROFESSIONAL ORDER HEADER
// ═══════════════════════════════════════════════════════════════════════════

class ProfessionalOrderHeader extends StatelessWidget {
  final bool isDark;
  final bool isLiveRefreshEnabled;
  final DateRange selectedDateRange;
  final int alertCount;
  final int pendingCount;
  final int processingCount;
  final int shippedCount;
  final int rtoCount;
  final VoidCallback onRefresh;
  final VoidCallback onToggleLiveRefresh;
  final Function(DateRange) onDateRangeChanged;
  final VoidCallback onAlertsTapped;

  const ProfessionalOrderHeader({
    super.key,
    required this.isDark,
    required this.isLiveRefreshEnabled,
    required this.selectedDateRange,
    required this.alertCount,
    required this.pendingCount,
    required this.processingCount,
    required this.shippedCount,
    required this.rtoCount,
    required this.onRefresh,
    required this.onToggleLiveRefresh,
    required this.onDateRangeChanged,
    required this.onAlertsTapped,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 8,
        left: 16,
        right: 16,
        bottom: 12,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
              : [AppColors.primary, AppColors.primaryDark],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Title + Live Toggle + Alerts
          Row(
            children: [
              // Title
              Text(
                'Orders',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 10),
              // Live Badge
              _buildLiveBadge(),
              const Spacer(),
              // Date Range Dropdown
              _buildDateRangeChip(context),
              const SizedBox(width: 8),
              // Alerts Button
              _buildAlertsButton(),
              const SizedBox(width: 8),
              // Refresh Button
              _buildRefreshButton(),
            ],
          ),
          const SizedBox(height: 12),
          // Quick Stats Row
          _buildQuickStats(),
        ],
      ),
    );
  }

  Widget _buildLiveBadge() {
    return GestureDetector(
      onTap: onToggleLiveRefresh,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isLiveRefreshEnabled
              ? Colors.green.withValues(alpha: 0.2)
              : Colors.grey.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isLiveRefreshEnabled
                ? Colors.green.withValues(alpha: 0.5)
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
                color: isLiveRefreshEnabled ? Colors.green : Colors.grey,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              'Live',
              style: TextStyle(
                color: isLiveRefreshEnabled ? Colors.green : Colors.grey,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDateRangeChip(BuildContext context) {
    return PopupMenuButton<DateRange>(
      onSelected: onDateRangeChanged,
      initialValue: selectedDateRange,
      offset: const Offset(0, 40),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.calendar_today_rounded, size: 14, color: Colors.white),
            const SizedBox(width: 6),
            Text(
              selectedDateRange.label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Colors.white70),
          ],
        ),
      ),
      itemBuilder: (context) => DateRange.values.map((range) {
        return PopupMenuItem<DateRange>(
          value: range,
          child: Row(
            children: [
              if (range == selectedDateRange)
                const Icon(Icons.check, size: 16, color: AppColors.primary)
              else
                const SizedBox(width: 16),
              const SizedBox(width: 8),
              Text(range.label),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildAlertsButton() {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onAlertsTapped();
      },
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.notifications_outlined, color: Colors.white, size: 20),
          ),
          if (alertCount > 0)
            Positioned(
              top: -4,
              right: -4,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: Colors.red,
                  shape: BoxShape.circle,
                ),
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                child: Text(
                  alertCount > 9 ? '9+' : '$alertCount',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
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
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Icon(Icons.refresh_rounded, color: Colors.white, size: 20),
      ),
    );
  }

  Widget _buildQuickStats() {
    return Row(
      children: [
        _buildStatChip('Pending', pendingCount, const Color(0xFFFBBF24)),
        const SizedBox(width: 8),
        _buildStatChip('Processing', processingCount, const Color(0xFF3B82F6)),
        const SizedBox(width: 8),
        _buildStatChip('Shipped', shippedCount, const Color(0xFF8B5CF6)),
        const SizedBox(width: 8),
        _buildStatChip('RTO', rtoCount, const Color(0xFFEF4444)),
      ],
    );
  }

  Widget _buildStatChip(String label, int count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7),
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
