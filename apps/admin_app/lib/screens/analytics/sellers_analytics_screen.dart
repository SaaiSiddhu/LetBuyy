// Sellers Analytics Screen
// Seller metrics, tier distribution, and top performers

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class SellersAnalyticsScreen extends StatefulWidget {
  const SellersAnalyticsScreen({super.key});

  @override
  State<SellersAnalyticsScreen> createState() => _SellersAnalyticsScreenState();
}

class _SellersAnalyticsScreenState extends State<SellersAnalyticsScreen> {
  final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
  
  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        title: const Text('Sellers Analytics', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('sellers').snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final sellers = snapshot.data!.docs;
          int active = 0, pending = 0, inactive = 0;
          Map<String, int> tierCounts = {'newSeller': 0, 'standard': 0, 'verified': 0, 'premium': 0};
          List<Map<String, dynamic>> topSellers = [];

          for (var doc in sellers) {
            final data = doc.data() as Map<String, dynamic>;
            final isActive = data['isActive'] == true;
            final isVerified = data['isVerified'] == true;
            final tier = data['commission']?['tier']?.toString() ?? 'newSeller';

            if (isActive) {
              active++;
            } else if (!isVerified) pending++;
            else inactive++;

            if (tierCounts.containsKey(tier)) tierCounts[tier] = tierCounts[tier]! + 1;

            topSellers.add({
              'name': data['storeName'] ?? data['businessName'] ?? 'Unknown',
              'revenue': (data['totalRevenue'] ?? 0).toDouble(),
              'orders': (data['totalOrders'] ?? 0),
              'tier': tier,
            });
          }

          topSellers.sort((a, b) => (b['revenue'] as double).compareTo(a['revenue'] as double));

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSummaryCards(isDark, active, pending, inactive, sellers.length),
                const SizedBox(height: 24),
                _buildTierDistribution(isDark, tierCounts),
                const SizedBox(height: 24),
                _buildTopSellers(isDark, topSellers.take(10).toList()),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryCards(bool isDark, int active, int pending, int inactive, int total) {
    return Row(
      children: [
        Expanded(child: _buildCard('Total', total, Icons.storefront_rounded, AppColors.primary, isDark)),
        const SizedBox(width: 12),
        Expanded(child: _buildCard('Active', active, Icons.check_circle_rounded, AppColors.success, isDark)),
        const SizedBox(width: 12),
        Expanded(child: _buildCard('Pending', pending, Icons.pending_rounded, AppColors.warning, isDark)),
        const SizedBox(width: 12),
        Expanded(child: _buildCard('Inactive', inactive, Icons.cancel_rounded, Colors.red, isDark)),
      ],
    );
  }

  Widget _buildCard(String title, int count, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 8),
          Text('$count', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
          Text(title, style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : Colors.black54)),
        ],
      ),
    );
  }

  Widget _buildTierDistribution(bool isDark, Map<String, int> tiers) {
    final total = tiers.values.fold(0, (a, b) => a + b);
    final tierColors = {'premium': Colors.amber, 'verified': Colors.purple, 'standard': Colors.blue, 'newSeller': Colors.grey};
    final tierLabels = {'premium': 'Premium', 'verified': 'Verified', 'standard': 'Standard', 'newSeller': 'New'};

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Tier Distribution', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          ...tiers.entries.map((e) {
            final pct = total > 0 ? (e.value / total * 100) : 0.0;
            final color = tierColors[e.key] ?? Colors.grey;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                  const SizedBox(width: 12),
                  Text(tierLabels[e.key] ?? e.key, style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
                  const Spacer(),
                  Text('${e.value}', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                  const SizedBox(width: 8),
                  Text('(${pct.toStringAsFixed(1)}%)', style: TextStyle(color: isDark ? Colors.white60 : Colors.black54, fontSize: 12)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildTopSellers(bool isDark, List<Map<String, dynamic>> sellers) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Top Sellers by Revenue', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          ...sellers.asMap().entries.map((entry) {
            final s = entry.value;
            return Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: isDark ? Colors.white12 : Colors.black12)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                    child: Text('${entry.key + 1}', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 12)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(s['name'], style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87))),
                  Text(currencyFormat.format(s['revenue']), style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.success)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
