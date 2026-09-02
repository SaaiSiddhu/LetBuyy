// Users Analytics Screen
// User metrics, growth, retention, and loyalty tiers

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

class UsersAnalyticsScreen extends StatelessWidget {
  const UsersAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        title: const Text('Users Analytics', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('users').snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final users = snapshot.data!.docs;
          final now = DateTime.now();
          final weekStart = now.subtract(const Duration(days: 7));
          final monthStart = DateTime(now.year, now.month, 1);

          int newThisWeek = 0, newThisMonth = 0;
          Map<String, int> loyaltyTiers = {'bronze': 0, 'silver': 0, 'gold': 0, 'platinum': 0};

          for (var doc in users) {
            final data = doc.data() as Map<String, dynamic>;
            final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
            final tier = data['loyaltyTier']?.toString().toLowerCase() ?? 'bronze';

            if (createdAt != null) {
              if (createdAt.isAfter(weekStart)) newThisWeek++;
              if (createdAt.isAfter(monthStart)) newThisMonth++;
            }

            if (loyaltyTiers.containsKey(tier)) {
              loyaltyTiers[tier] = loyaltyTiers[tier]! + 1;
            } else {
              loyaltyTiers['bronze'] = loyaltyTiers['bronze']! + 1;
            }
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSummaryCards(isDark, users.length, newThisWeek, newThisMonth),
                const SizedBox(height: 24),
                _buildLoyaltyTiers(isDark, loyaltyTiers),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryCards(bool isDark, int total, int newWeek, int newMonth) {
    return Row(
      children: [
        Expanded(child: _buildCard('Total Users', total, Icons.people_rounded, AppColors.primary, isDark)),
        const SizedBox(width: 16),
        Expanded(child: _buildCard('New This Week', newWeek, Icons.person_add_rounded, AppColors.success, isDark)),
        const SizedBox(width: 16),
        Expanded(child: _buildCard('New This Month', newMonth, Icons.trending_up_rounded, AppColors.warning, isDark)),
      ],
    );
  }

  Widget _buildCard(String title, int count, IconData icon, Color color, bool isDark) {
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
          Row(children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: color, size: 20),
            ),
          ]),
          const SizedBox(height: 12),
          Text('$count', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 4),
          Text(title, style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : Colors.black54)),
        ],
      ),
    );
  }

  Widget _buildLoyaltyTiers(bool isDark, Map<String, int> tiers) {
    final total = tiers.values.fold(0, (a, b) => a + b);
    final tierColors = {'platinum': Colors.purple, 'gold': Colors.amber, 'silver': Colors.grey, 'bronze': Colors.brown};
    final tierIcons = {'platinum': Icons.diamond_rounded, 'gold': Icons.star_rounded, 'silver': Icons.workspace_premium_rounded, 'bronze': Icons.verified_rounded};

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Loyalty Tiers', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          ...tiers.entries.toList().reversed.map((e) {
            final pct = total > 0 ? (e.value / total * 100) : 0.0;
            final color = tierColors[e.key] ?? Colors.grey;
            final icon = tierIcons[e.key] ?? Icons.star_rounded;
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: color.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(icon, color: color, size: 24),
                  const SizedBox(width: 12),
                  Expanded(child: Text(e.key.toUpperCase(), style: TextStyle(fontWeight: FontWeight.bold, color: color))),
                  Text('${e.value}', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                  const SizedBox(width: 8),
                  Text('(${pct.toStringAsFixed(1)}%)', style: TextStyle(color: isDark ? Colors.white60 : Colors.black54)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
