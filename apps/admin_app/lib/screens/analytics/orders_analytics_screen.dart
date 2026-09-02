// Orders Analytics Screen
// Detailed view of order metrics, trends, and status breakdown

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class OrdersAnalyticsScreen extends StatefulWidget {
  const OrdersAnalyticsScreen({super.key});

  @override
  State<OrdersAnalyticsScreen> createState() => _OrdersAnalyticsScreenState();
}

class _OrdersAnalyticsScreenState extends State<OrdersAnalyticsScreen> {
  final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
  
  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        title: const Text('Orders Analytics', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('orders')
            .orderBy('createdAt', descending: true)
            .limit(500)
            .snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final orders = snapshot.data!.docs;
          final now = DateTime.now();
          final todayStart = DateTime(now.year, now.month, now.day);
          final weekStart = now.subtract(const Duration(days: 7));
          final monthStart = DateTime(now.year, now.month, 1);

          // Calculate metrics
          int todayOrders = 0, weekOrders = 0, monthOrders = 0;
          double todayGMV = 0, weekGMV = 0, monthGMV = 0;
          Map<String, int> statusCounts = {
            'pending': 0, 'confirmed': 0, 'processing': 0,
            'shipped': 0, 'delivered': 0, 'cancelled': 0,
          };
          Map<int, int> hourlyOrders = {};
          for (int i = 0; i < 24; i++) {
            hourlyOrders[i] = 0;
          }

          for (var doc in orders) {
            final data = doc.data() as Map<String, dynamic>;
            final ts = data['createdAt'] as Timestamp?;
            if (ts == null) continue;
            final date = ts.toDate();
            final total = (data['total'] ?? 0).toDouble();
            final status = (data['orderStatus'] ?? 'pending').toString().toLowerCase();

            if (statusCounts.containsKey(status)) {
              statusCounts[status] = statusCounts[status]! + 1;
            }

            if (date.isAfter(todayStart)) {
              todayOrders++;
              todayGMV += total;
              hourlyOrders[date.hour] = (hourlyOrders[date.hour] ?? 0) + 1;
            }
            if (date.isAfter(weekStart)) { weekOrders++; weekGMV += total; }
            if (date.isAfter(monthStart)) { monthOrders++; monthGMV += total; }
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Summary Cards
                _buildSummaryRow(isDark, todayOrders, weekOrders, monthOrders, todayGMV, weekGMV, monthGMV),
                const SizedBox(height: 24),
                
                // Status Breakdown
                _buildStatusSection(isDark, statusCounts),
                const SizedBox(height: 24),
                
                // Peak Hours
                _buildPeakHoursSection(isDark, hourlyOrders),
                const SizedBox(height: 24),
                
                // Recent Orders Table
                _buildRecentOrdersTable(isDark, orders.take(20).toList()),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryRow(bool isDark, int today, int week, int month, double todayGMV, double weekGMV, double monthGMV) {
    return Row(
      children: [
        Expanded(child: _buildSummaryCard('Today', today, todayGMV, AppColors.primary, isDark)),
        const SizedBox(width: 16),
        Expanded(child: _buildSummaryCard('This Week', week, weekGMV, AppColors.success, isDark)),
        const SizedBox(width: 16),
        Expanded(child: _buildSummaryCard('This Month', month, monthGMV, AppColors.warning, isDark)),
      ],
    );
  }

  Widget _buildSummaryCard(String title, int count, double gmv, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
        boxShadow: [BoxShadow(color: color.withValues(alpha: 0.1), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: isDark ? Colors.white60 : Colors.black54, fontSize: 13)),
          const SizedBox(height: 8),
          Text('$count', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 4),
          Text(currencyFormat.format(gmv), style: TextStyle(color: isDark ? Colors.white38 : Colors.black38, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildStatusSection(bool isDark, Map<String, int> counts) {
    final total = counts.values.fold(0, (a, b) => a + b);
    final colors = {
      'pending': Colors.orange, 'confirmed': Colors.blue, 'processing': Colors.purple,
      'shipped': Colors.teal, 'delivered': Colors.green, 'cancelled': Colors.red,
    };
    
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Status Breakdown', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: counts.entries.map((e) {
              final pct = total > 0 ? (e.value / total * 100).toStringAsFixed(1) : '0';
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: colors[e.key]!.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Text(e.key.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: colors[e.key])),
                    const SizedBox(height: 4),
                    Text('${e.value}', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: colors[e.key])),
                    Text('$pct%', style: TextStyle(fontSize: 10, color: colors[e.key]!.withValues(alpha: 0.7))),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildPeakHoursSection(bool isDark, Map<int, int> hourlyOrders) {
    final maxOrders = hourlyOrders.values.fold(0, (a, b) => a > b ? a : b);
    
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Peak Hours (Today)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          SizedBox(
            height: 60,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(24, (hour) {
                final count = hourlyOrders[hour] ?? 0;
                final height = maxOrders > 0 ? (count / maxOrders) * 50 : 0.0;
                return Expanded(
                  child: Tooltip(
                    message: '$hour:00 - $count orders',
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      height: height + 10,
                      decoration: BoxDecoration(
                        color: count > 0 ? AppColors.primary : (isDark ? Colors.white12 : Colors.black12),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('12AM', style: TextStyle(fontSize: 10, color: isDark ? Colors.white38 : Colors.black38)),
              Text('12PM', style: TextStyle(fontSize: 10, color: isDark ? Colors.white38 : Colors.black38)),
              Text('11PM', style: TextStyle(fontSize: 10, color: isDark ? Colors.white38 : Colors.black38)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRecentOrdersTable(bool isDark, List<QueryDocumentSnapshot> orders) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recent Orders', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          ...orders.map((doc) {
            final data = doc.data() as Map<String, dynamic>;
            final status = data['orderStatus'] ?? 'pending';
            final total = (data['total'] ?? 0).toDouble();
            final orderNumber = data['orderNumber'] ?? doc.id.substring(0, 8);
            
            return Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: isDark ? Colors.white12 : Colors.black12)),
              ),
              child: Row(
                children: [
                  Expanded(child: Text('#$orderNumber', style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor(status).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(status.toString().toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _getStatusColor(status))),
                  ),
                  const SizedBox(width: 16),
                  Text(currencyFormat.format(total), style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'delivered': return Colors.green;
      case 'shipped': return Colors.teal;
      case 'confirmed': return Colors.blue;
      case 'processing': return Colors.purple;
      case 'cancelled': return Colors.red;
      default: return Colors.orange;
    }
  }
}
