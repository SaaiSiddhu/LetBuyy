// lib/screens/wallet/widgets/earnings_chart_widget.dart
// 📊 Weekly Earnings Chart Widget

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class EarningsChartWidget extends StatefulWidget {
  final String sellerId;
  final bool isDark;

  const EarningsChartWidget({
    super.key,
    required this.sellerId,
    required this.isDark,
  });

  @override
  State<EarningsChartWidget> createState() => _EarningsChartWidgetState();
}

class _EarningsChartWidgetState extends State<EarningsChartWidget> {
  List<double> _earnings = [0, 0, 0, 0, 0, 0, 0];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchWeeklyEarnings();
  }

  Future<void> _fetchWeeklyEarnings() async {
    if (widget.sellerId.isEmpty) {
      setState(() {
        _isLoading = false;
        _error = 'No seller ID';
      });
      return;
    }

    final now = DateTime.now();
    // Start of week (Monday at 00:00:00)
    final monday = DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
    
    final List<double> earnings = [0, 0, 0, 0, 0, 0, 0];
    
    try {
      // Query all orders for this seller
      final ordersSnap = await FirebaseFirestore.instance
          .collection('orders')
          .where('sellerId', isEqualTo: widget.sellerId)
          .get();

      for (final doc in ordersSnap.docs) {
        final data = doc.data();
        
        // Get the order date
        final date = (data['createdAt'] as Timestamp?)?.toDate();
        if (date == null) continue;
        
        // Check if order is within this week
        if (date.isBefore(monday)) continue;
        
        // Calculate day index (0=Mon, 1=Tue, ..., 6=Sun)
        final dayIndex = date.weekday - 1;
        if (dayIndex < 0 || dayIndex > 6) continue;
        
        // Get order total
        final orderTotal = (data['total'] ?? 
                           data['totalAmount'] ?? 
                           data['grandTotal'] ?? 
                           data['subTotal'] ?? 0).toDouble();
        
        if (orderTotal > 0) {
          earnings[dayIndex] += orderTotal * 0.9528; // After fees estimate
        }
      }

      if (mounted) {
        setState(() {
          _earnings = earnings;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('📊 Chart error: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final maxEarning = _earnings.reduce((a, b) => a > b ? a : b);
    final total = _earnings.reduce((a, b) => a + b);
    final isDark = widget.isDark;
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark 
              ? [AppColors.backgroundDark, AppColors.surfaceDark]
              : [AppColors.background, AppColors.surface],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: isDark ? null : Border.all(color: AppColors.border.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Weekly Earnings',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: textColor,
                ),
              ),
              if (_isLoading)
                SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '₹${_formatAmount(total)}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.success,
                      fontSize: 14,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // Chart
          if (_isLoading)
            Center(child: Text('Loading...', style: TextStyle(color: textColor.withValues(alpha: 0.5))))
          else if (_error != null)
            Center(child: Text('Unable to load', style: TextStyle(color: textColor.withValues(alpha: 0.5), fontSize: 12)))
          else
            SizedBox(
              height: 120,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: List.generate(7, (i) {
                  final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                  final height = maxEarning > 0 ? (_earnings[i] / maxEarning) * 80 : 4.0;
                  final isToday = DateTime.now().weekday - 1 == i;

                  return Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      if (_earnings[i] > 0)
                        Text(
                          '₹${_formatAmount(_earnings[i])}',
                          style: TextStyle(
                            fontSize: 9,
                            color: textColor.withValues(alpha: 0.6),
                          ),
                        ),
                      const SizedBox(height: 4),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 500),
                        width: 28,
                        height: height.clamp(4.0, 80.0),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: isToday
                                ? [AppColors.primary, AppColors.primaryLight]
                                : [AppColors.primary.withValues(alpha: 0.5), AppColors.primary.withValues(alpha: 0.3)],
                          ),
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        days[i],
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
                          color: isToday 
                              ? AppColors.primary 
                              : textColor.withValues(alpha: 0.5),
                        ),
                      ),
                    ],
                  );
                }),
              ),
            ),
        ],
      ),
    );
  }

  String _formatAmount(double amount) {
    if (amount >= 1000) {
      return '${(amount / 1000).toStringAsFixed(1)}K';
    }
    return amount.toStringAsFixed(0);
  }
}
