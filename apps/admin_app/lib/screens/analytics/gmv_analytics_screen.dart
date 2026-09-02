// GMV Analytics Screen
// Revenue metrics, category breakdown, and payment methods

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

class GMVAnalyticsScreen extends StatefulWidget {
  const GMVAnalyticsScreen({super.key});

  @override
  State<GMVAnalyticsScreen> createState() => _GMVAnalyticsScreenState();
}

class _GMVAnalyticsScreenState extends State<GMVAnalyticsScreen> {
  final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
  
  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        title: const Text('GMV Analytics', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('orders')
            .orderBy('createdAt', descending: true)
            .limit(1000)
            .snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final orders = snapshot.data!.docs;
          final now = DateTime.now();
          final todayStart = DateTime(now.year, now.month, now.day);
          final monthStart = DateTime(now.year, now.month, 1);

          double totalGMV = 0, todayGMV = 0, monthGMV = 0;
          int orderCount = 0;
          Map<String, double> categoryRevenue = {};
          Map<String, double> paymentMethods = {};

          for (var doc in orders) {
            final data = doc.data() as Map<String, dynamic>;
            final ts = data['createdAt'] as Timestamp?;
            if (ts == null) continue;
            final date = ts.toDate();
            final total = (data['total'] ?? 0).toDouble();
            final status = data['orderStatus']?.toString().toLowerCase() ?? '';
            final payment = data['paymentMethod']?.toString() ?? 'COD';

            if (status != 'cancelled' && status != 'returned') {
              totalGMV += total;
              orderCount++;
              paymentMethods[payment] = (paymentMethods[payment] ?? 0) + total;

              if (date.isAfter(todayStart)) todayGMV += total;
              if (date.isAfter(monthStart)) monthGMV += total;

              // Category revenue
              if (data['items'] is List) {
                for (var item in data['items']) {
                  final cat = item['category']?.toString() ?? 'Other';
                  final lineTotal = ((item['price'] ?? 0) * (item['quantity'] ?? 1)).toDouble();
                  categoryRevenue[cat] = (categoryRevenue[cat] ?? 0) + lineTotal;
                }
              }
            }
          }

          final aov = orderCount > 0 ? totalGMV / orderCount : 0.0;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Main Metrics
                _buildMainMetrics(isDark, totalGMV, todayGMV, monthGMV, aov),
                const SizedBox(height: 24),
                
                // Category Revenue
                _buildCategorySection(isDark, categoryRevenue),
                const SizedBox(height: 24),
                
                // Payment Methods
                _buildPaymentMethodsSection(isDark, paymentMethods),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildMainMetrics(bool isDark, double total, double today, double month, double aov) {
    return Row(
      children: [
        Expanded(child: _buildMetricCard('Total GMV', total, Icons.payments_rounded, AppColors.success, isDark)),
        const SizedBox(width: 16),
        Expanded(child: _buildMetricCard('Today', today, Icons.today_rounded, AppColors.primary, isDark)),
        const SizedBox(width: 16),
        Expanded(child: _buildMetricCard('This Month', month, Icons.calendar_month_rounded, AppColors.warning, isDark)),
        const SizedBox(width: 16),
        Expanded(child: _buildMetricCard('AOV', aov, Icons.trending_up_rounded, AppColors.accent, isDark)),
      ],
    );
  }

  Widget _buildMetricCard(String title, double value, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              const Spacer(),
            ],
          ),
          const SizedBox(height: 12),
          Text(title, style: TextStyle(color: isDark ? Colors.white60 : Colors.black54, fontSize: 12)),
          const SizedBox(height: 4),
          Text(currencyFormat.format(value), style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
        ],
      ),
    );
  }

  Widget _buildCategorySection(bool isDark, Map<String, double> data) {
    final sorted = data.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final total = data.values.fold(0.0, (a, b) => a + b);
    final colors = [AppColors.primary, AppColors.success, AppColors.warning, AppColors.accent, Colors.purple, Colors.pink];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Revenue by Category', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          ...sorted.take(6).toList().asMap().entries.map((entry) {
            final e = entry.value;
            final pct = total > 0 ? (e.value / total * 100) : 0.0;
            final color = colors[entry.key % colors.length];
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(e.key, style: TextStyle(fontWeight: FontWeight.w500, color: isDark ? Colors.white : Colors.black87)),
                      const Spacer(),
                      Text('${pct.toStringAsFixed(1)}%', style: TextStyle(color: color, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  LinearProgressIndicator(
                    value: pct / 100,
                    backgroundColor: isDark ? Colors.white12 : Colors.black12,
                    valueColor: AlwaysStoppedAnimation(color),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodsSection(bool isDark, Map<String, double> data) {
    final sorted = data.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final icons = {'UPI': Icons.qr_code_rounded, 'Card': Icons.credit_card_rounded, 'COD': Icons.money_rounded, 'Wallet': Icons.account_balance_wallet_rounded};

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Payment Methods', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: sorted.map((e) => Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Icon(icons[e.key] ?? Icons.payment_rounded, color: AppColors.primary),
                  const SizedBox(height: 8),
                  Text(e.key, style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                  Text(currencyFormat.format(e.value), style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : Colors.black54)),
                ],
              ),
            )).toList(),
          ),
        ],
      ),
    );
  }
}
