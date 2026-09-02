// Ads Analytics Screen
// Ad revenue metrics, campaign types, and performance

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

class AdsAnalyticsScreen extends StatelessWidget {
  const AdsAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        title: const Text('Ads Analytics', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('adCampaigns').snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final campaigns = snapshot.data!.docs;
          double totalRevenue = 0;
          int activeCampaigns = 0, totalImpressions = 0, totalClicks = 0;
          Map<String, double> typeRevenue = {'sponsored': 0, 'banner': 0, 'product_boost': 0};

          for (var doc in campaigns) {
            final data = doc.data() as Map<String, dynamic>;
            final isActive = data['isActive'] == true;
            final spent = (data['spent'] ?? data['budget'] ?? 0).toDouble();
            final impressions = (data['impressions'] ?? 0) as int;
            final clicks = (data['clicks'] ?? 0) as int;
            final type = data['type']?.toString() ?? 'sponsored';

            totalRevenue += spent;
            totalImpressions += impressions;
            totalClicks += clicks;
            if (isActive) activeCampaigns++;

            if (typeRevenue.containsKey(type)) {
              typeRevenue[type] = typeRevenue[type]! + spent;
            } else {
              typeRevenue['sponsored'] = typeRevenue['sponsored']! + spent;
            }
          }

          final ctr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0.0;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildMetricsRow(isDark, totalRevenue, activeCampaigns, ctr, totalImpressions, currencyFormat),
                const SizedBox(height: 24),
                _buildRevenueByType(isDark, typeRevenue, totalRevenue, currencyFormat),
                const SizedBox(height: 24),
                _buildCampaignsList(isDark, campaigns.take(10).toList(), currencyFormat),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildMetricsRow(bool isDark, double revenue, int active, double ctr, int impressions, NumberFormat fmt) {
    return Row(
      children: [
        Expanded(child: _buildMetricCard('Total Revenue', fmt.format(revenue), Icons.payments_rounded, Colors.pink, isDark)),
        const SizedBox(width: 12),
        Expanded(child: _buildMetricCard('Active Campaigns', '$active', Icons.campaign_rounded, AppColors.success, isDark)),
        const SizedBox(width: 12),
        Expanded(child: _buildMetricCard('CTR', '${ctr.toStringAsFixed(2)}%', Icons.ads_click_rounded, AppColors.primary, isDark)),
        const SizedBox(width: 12),
        Expanded(child: _buildMetricCard('Impressions', NumberFormat.compact().format(impressions), Icons.visibility_rounded, AppColors.warning, isDark)),
      ],
    );
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 12),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 4),
          Text(title, style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : Colors.black54)),
        ],
      ),
    );
  }

  Widget _buildRevenueByType(bool isDark, Map<String, double> data, double total, NumberFormat fmt) {
    final labels = {'sponsored': 'Sponsored', 'banner': 'Banners', 'product_boost': 'Product Boost'};
    final colors = {'sponsored': Colors.pink, 'banner': AppColors.primary, 'product_boost': AppColors.success};

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Revenue by Ad Type', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          ...data.entries.map((e) {
            final pct = total > 0 ? (e.value / total * 100) : 0.0;
            final color = colors[e.key] ?? Colors.grey;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(width: 12, height: 12, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
                      const SizedBox(width: 10),
                      Text(labels[e.key] ?? e.key, style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
                      const Spacer(),
                      Text(fmt.format(e.value), style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                      const SizedBox(width: 8),
                      Text('(${pct.toStringAsFixed(1)}%)', style: TextStyle(color: color, fontSize: 12)),
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

  Widget _buildCampaignsList(bool isDark, List<QueryDocumentSnapshot> campaigns, NumberFormat fmt) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recent Campaigns', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          if (campaigns.isEmpty)
            Center(child: Text('No campaigns yet', style: TextStyle(color: isDark ? Colors.white60 : Colors.black54)))
          else
            ...campaigns.map((doc) {
              final data = doc.data() as Map<String, dynamic>;
              final name = data['name'] ?? data['title'] ?? 'Untitled';
              final isActive = data['isActive'] == true;
              final spent = (data['spent'] ?? data['budget'] ?? 0).toDouble();

              return Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: isDark ? Colors.white12 : Colors.black12))),
                child: Row(
                  children: [
                    Container(
                      width: 8, height: 8,
                      decoration: BoxDecoration(
                        color: isActive ? AppColors.success : Colors.grey,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(name, style: TextStyle(color: isDark ? Colors.white : Colors.black87))),
                    Text(fmt.format(spent), style: TextStyle(fontWeight: FontWeight.bold, color: Colors.pink)),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
