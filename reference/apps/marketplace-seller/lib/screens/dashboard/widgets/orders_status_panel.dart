// lib/screens/dashboard/widgets/orders_status_panel.dart
// ============================================================
// 📦 PREMIUM ORDER ANALYTICS PANEL
// ✨ Professional Design with Funnel, Trends & Insights
// ============================================================

import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class OrdersStatusPanel extends StatefulWidget {
  final int pendingCount;
  final int packedCount;
  final int shippedCount;
  final int deliveredCount;
  final int cancelledCount;
  final int returnedCount;
  final Function(String) onStatusTap;
  final bool isLoading;
  
  // Advanced Analytics Data
  final double? totalRevenue;
  final double? averageOrderValue;
  final Map<String, int>? ordersByDay;
  final Map<String, double>? revenueByDay;

  const OrdersStatusPanel({
    super.key,
    required this.pendingCount,
    required this.packedCount,
    required this.shippedCount,
    required this.deliveredCount,
    required this.cancelledCount,
    required this.returnedCount,
    required this.onStatusTap,
    this.isLoading = false,
    this.totalRevenue,
    this.averageOrderValue,
    this.ordersByDay,
    this.revenueByDay,
  });

  @override
  State<OrdersStatusPanel> createState() => _OrdersStatusPanelState();
}

class _OrdersStatusPanelState extends State<OrdersStatusPanel> {
  final String _selectedPeriod = 'all';
  final _currencyFormatter = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  int get _totalOrders =>
      widget.pendingCount +
      widget.packedCount +
      widget.shippedCount +
      widget.deliveredCount +
      widget.cancelledCount +
      widget.returnedCount;

  int get _activeOrders => widget.pendingCount + widget.packedCount + widget.shippedCount;
  
  double get _fulfillmentRate => _totalOrders > 0 
      ? (widget.deliveredCount / _totalOrders) * 100 
      : 0;
  
  double get _cancellationRate => _totalOrders > 0 
      ? (widget.cancelledCount / _totalOrders) * 100 
      : 0;
  
  double get _returnRate => _totalOrders > 0 
      ? (widget.returnedCount / _totalOrders) * 100 
      : 0;

  double get _successRate => _totalOrders > 0 
      ? ((widget.deliveredCount) / (_totalOrders - widget.cancelledCount - widget.returnedCount).clamp(1, _totalOrders)) * 100 
      : 0;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark
                  ? [AppColors.surfaceDark.withValues(alpha: 0.9), AppColors.surfaceDarkVariant.withValues(alpha: 0.7)]
                  : [AppColors.surface.withValues(alpha: 0.95), AppColors.surfaceVariant.withValues(alpha: 0.9)],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark 
                  ? AppColors.primary.withValues(alpha: 0.2) 
                  : AppColors.border.withValues(alpha: 0.3),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: isDark 
                    ? Colors.black.withValues(alpha: 0.3) 
                    : AppColors.primary.withValues(alpha: 0.08),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildHeader(isDark),
              if (widget.isLoading)
                _buildLoadingState(isDark)
              else ...[
                // Order Pipeline / Funnel
                _buildOrderPipeline(isDark),
                _buildDivider(isDark),
                
                // Status Grid
                _buildStatusGrid(isDark),
                _buildDivider(isDark),
                
                // Performance Metrics
                _buildPerformanceMetrics(isDark),
                
                // Revenue Summary (if available)
                if (widget.totalRevenue != null && widget.totalRevenue! > 0) ...[
                  _buildDivider(isDark),
                  _buildRevenueSummary(isDark),
                ],
              ],
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).scale(
      begin: const Offset(0.97, 0.97),
      end: const Offset(1, 1),
      duration: 400.ms,
      curve: Curves.easeOutCubic,
    );
  }

  Widget _buildHeader(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppColors.border.withValues(alpha: 0.1) : AppColors.border.withValues(alpha: 0.15),
          ),
        ),
      ),
      child: Row(
        children: [
          // Gradient icon container
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary, AppColors.primary.withValues(alpha: 0.7)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(Icons.shopping_bag_rounded, color: Colors.white, size: 20),
          ),
          
          const SizedBox(width: 14),
          
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Order Analytics',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      '$_totalOrders total',
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? AppColors.textLight.withValues(alpha: 0.6) : AppColors.textSecondary,
                      ),
                    ),
                    Container(
                      width: 3,
                      height: 3,
                      margin: const EdgeInsets.symmetric(horizontal: 6),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white24 : Colors.grey[400],
                        shape: BoxShape.circle,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: _activeOrders > 0 
                            ? AppColors.warning.withValues(alpha: 0.1) 
                            : AppColors.success.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '$_activeOrders active',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: _activeOrders > 0 ? AppColors.warning : AppColors.success,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          // Urgent Alert Badge
          if (widget.pendingCount > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.25)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.priority_high_rounded, size: 14, color: const Color(0xFFF59E0B)),
                  const SizedBox(width: 4),
                  Text(
                    '${widget.pendingCount}',
                    style: const TextStyle(
                      color: Color(0xFFF59E0B),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ).animate().scale(duration: 300.ms, curve: Curves.easeOutBack),
        ],
      ),
    );
  }

  Widget _buildOrderPipeline(bool isDark) {
    // Pipeline: Pending → Processing → Shipped → Delivered
    final steps = [
      _PipelineStep('Pending', widget.pendingCount, const Color(0xFFF59E0B), Icons.hourglass_top_rounded),
      _PipelineStep('Processing', widget.packedCount, const Color(0xFF3B82F6), Icons.inventory_2_rounded),
      _PipelineStep('Shipped', widget.shippedCount, const Color(0xFF8B5CF6), Icons.local_shipping_rounded),
      _PipelineStep('Delivered', widget.deliveredCount, const Color(0xFF10B981), Icons.check_circle_rounded),
    ];

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.timeline_rounded, size: 14, color: isDark ? Colors.white38 : Colors.grey[400]),
              const SizedBox(width: 6),
              Text(
                'Order Pipeline',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white54 : Colors.grey[600],
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Pipeline visualization
          Row(
            children: steps.asMap().entries.map((entry) {
              final index = entry.key;
              final step = entry.value;
              final isLast = index == steps.length - 1;
              
              return Expanded(
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => widget.onStatusTap(step.label.toLowerCase()),
                        child: Column(
                          children: [
                            // Icon with count
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: step.count > 0 
                                    ? step.color.withValues(alpha: 0.15) 
                                    : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100]),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: step.count > 0 ? step.color.withValues(alpha: 0.3) : Colors.transparent,
                                  width: 2,
                                ),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(step.icon, size: 16, color: step.count > 0 ? step.color : (isDark ? Colors.white30 : Colors.grey[400])),
                                ],
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${step.count}',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: step.count > 0 ? step.color : (isDark ? Colors.white30 : Colors.grey[400]),
                              ),
                            ),
                            Text(
                              step.label,
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w500,
                                color: isDark ? Colors.white54 : Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      ).animate(delay: (index * 80).ms).fadeIn().slideY(begin: 0.2),
                    ),
                    // Arrow connector
                    if (!isLast)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 20),
                        child: Icon(
                          Icons.arrow_forward_rounded,
                          size: 16,
                          color: isDark ? Colors.white.withValues(alpha: 0.2) : Colors.grey[300],
                        ),
                      ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusGrid(bool isDark) {
    final statuses = [
      _StatusItem('Cancelled', widget.cancelledCount, const Color(0xFFEF4444), Icons.cancel_rounded, 'cancelled'),
      _StatusItem('Returned', widget.returnedCount, const Color(0xFFEC4899), Icons.replay_rounded, 'returned'),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: statuses.asMap().entries.map((entry) {
          final status = entry.value;
          final hasItems = status.count > 0;
          
          return Expanded(
            child: GestureDetector(
              onTap: () => widget.onStatusTap(status.filterKey),
              child: Container(
                margin: EdgeInsets.only(right: entry.key < statuses.length - 1 ? 10 : 0),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      status.color.withValues(alpha: hasItems ? 0.12 : 0.04),
                      status.color.withValues(alpha: hasItems ? 0.06 : 0.02),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: status.color.withValues(alpha: hasItems ? 0.25 : 0.1),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: status.color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(status.icon, size: 14, color: status.color),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${status.count}',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: status.color,
                            height: 1,
                          ),
                        ),
                        Text(
                          status.label,
                          style: TextStyle(
                            fontSize: 10,
                            color: isDark ? Colors.white54 : Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ).animate(delay: (entry.key * 60).ms).fadeIn().scale(
                  begin: const Offset(0.95, 0.95),
                  end: const Offset(1, 1),
                  duration: 200.ms,
                ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildPerformanceMetrics(bool isDark) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.insights_rounded, size: 14, color: isDark ? Colors.white38 : Colors.grey[400]),
              const SizedBox(width: 6),
              Text(
                'Performance Metrics',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white54 : Colors.grey[600],
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  '✅',
                  'Fulfillment',
                  '${_fulfillmentRate.toStringAsFixed(1)}%',
                  _fulfillmentRate >= 80 ? AppColors.success : (_fulfillmentRate >= 50 ? AppColors.warning : AppColors.error),
                  isDark,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricCard(
                  '❌',
                  'Cancellation',
                  '${_cancellationRate.toStringAsFixed(1)}%',
                  _cancellationRate <= 5 ? AppColors.success : (_cancellationRate <= 15 ? AppColors.warning : AppColors.error),
                  isDark,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricCard(
                  '🔄',
                  'Return Rate',
                  '${_returnRate.toStringAsFixed(1)}%',
                  _returnRate <= 3 ? AppColors.success : (_returnRate <= 8 ? AppColors.warning : AppColors.error),
                  isDark,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricCard(
                  '🎯',
                  'Success',
                  '${_successRate.toStringAsFixed(1)}%',
                  _successRate >= 90 ? AppColors.success : (_successRate >= 70 ? AppColors.warning : AppColors.error),
                  isDark,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(String emoji, String label, String value, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 14)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 8,
              fontWeight: FontWeight.w500,
              color: isDark ? Colors.white54 : Colors.grey[600],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildRevenueSummary(bool isDark) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          // Total Revenue
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.success.withValues(alpha: 0.1),
                    AppColors.success.withValues(alpha: 0.05),
                  ],
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.account_balance_wallet_rounded, size: 18, color: AppColors.success),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Total Revenue',
                          style: TextStyle(
                            fontSize: 10,
                            color: isDark ? Colors.white54 : Colors.grey[600],
                          ),
                        ),
                        Text(
                          _currencyFormatter.format(widget.totalRevenue ?? 0),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Average Order Value
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: 0.1),
                    AppColors.primary.withValues(alpha: 0.05),
                  ],
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.trending_up_rounded, size: 18, color: AppColors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Avg. Order Value',
                          style: TextStyle(
                            fontSize: 10,
                            color: isDark ? Colors.white54 : Colors.grey[600],
                          ),
                        ),
                        Text(
                          _currencyFormatter.format(widget.averageOrderValue ?? 0),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDivider(bool isDark) {
    return Container(
      height: 1,
      margin: const EdgeInsets.symmetric(horizontal: 16),
      color: isDark ? AppColors.border.withValues(alpha: 0.1) : AppColors.border.withValues(alpha: 0.15),
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return Padding(
      padding: const EdgeInsets.all(40),
      child: Center(
        child: Column(
          children: [
            SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Loading orders...',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.textLight.withValues(alpha: 0.5) : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusItem {
  final String label;
  final int count;
  final Color color;
  final IconData icon;
  final String filterKey;

  _StatusItem(this.label, this.count, this.color, this.icon, this.filterKey);
}

class _PipelineStep {
  final String label;
  final int count;
  final Color color;
  final IconData icon;

  _PipelineStep(this.label, this.count, this.color, this.icon);
}
