// Products Analytics Screen
// Inventory stats, category breakdown, and stock alerts

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class ProductsAnalyticsScreen extends StatelessWidget {
  const ProductsAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        title: const Text('Products Analytics', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('products').snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final products = snapshot.data!.docs;
          int live = 0, draft = 0, outOfStock = 0, lowStock = 0;
          Map<String, int> categoryCount = {};
          List<Map<String, dynamic>> lowStockItems = [];

          for (var doc in products) {
            final data = doc.data() as Map<String, dynamic>;
            final isActive = data['isActive'] == true;
            final stock = (data['stock'] ?? data['quantity'] ?? 0) as int;
            final category = data['category']?.toString() ?? 'Other';

            if (isActive) {
              live++;
            } else {
              draft++;
            }
            if (stock == 0) {
              outOfStock++;
            } else if (stock < 10) {
              lowStock++;
              lowStockItems.add({
                'name': data['name'] ?? 'Unknown',
                'stock': stock,
                'price': (data['price'] ?? 0).toDouble(),
              });
            }

            categoryCount[category] = (categoryCount[category] ?? 0) + 1;
          }

          lowStockItems.sort((a, b) => (a['stock'] as int).compareTo(b['stock'] as int));

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSummaryCards(isDark, live, draft, outOfStock, lowStock),
                const SizedBox(height: 24),
                _buildCategoryBreakdown(isDark, categoryCount),
                const SizedBox(height: 24),
                _buildStockAlerts(isDark, lowStockItems, outOfStock, currencyFormat),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryCards(bool isDark, int live, int draft, int oos, int low) {
    return Row(
      children: [
        Expanded(child: _buildCard('Live', live, Icons.check_circle_rounded, AppColors.success, isDark)),
        const SizedBox(width: 12),
        Expanded(child: _buildCard('Draft', draft, Icons.edit_rounded, Colors.grey, isDark)),
        const SizedBox(width: 12),
        Expanded(child: _buildCard('Out of Stock', oos, Icons.error_rounded, Colors.red, isDark)),
        const SizedBox(width: 12),
        Expanded(child: _buildCard('Low Stock', low, Icons.warning_rounded, AppColors.warning, isDark)),
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
          Text(title, style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : Colors.black54)),
        ],
      ),
    );
  }

  Widget _buildCategoryBreakdown(bool isDark, Map<String, int> data) {
    final sorted = data.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final total = data.values.fold(0, (a, b) => a + b);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Products by Category', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          ...sorted.take(8).map((e) {
            final pct = total > 0 ? (e.value / total * 100) : 0.0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Expanded(flex: 2, child: Text(e.key, style: TextStyle(color: isDark ? Colors.white : Colors.black87))),
                  Expanded(
                    flex: 3,
                    child: LinearProgressIndicator(
                      value: pct / 100,
                      backgroundColor: isDark ? Colors.white12 : Colors.black12,
                      valueColor: AlwaysStoppedAnimation(AppColors.primary),
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(width: 40, child: Text('${e.value}', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87))),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildStockAlerts(bool isDark, List<Map<String, dynamic>> items, int oos, NumberFormat fmt) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Stock Alerts', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
                child: Text('$oos Out of Stock', style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (items.isEmpty)
            Center(child: Text('No low stock items', style: TextStyle(color: isDark ? Colors.white60 : Colors.black54)))
          else
            ...items.take(5).map((item) => Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: isDark ? Colors.white12 : Colors.black12))),
              child: Row(
                children: [
                  Expanded(child: Text(item['name'], style: TextStyle(color: isDark ? Colors.white : Colors.black87))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
                    child: Text('${item['stock']} left', style: TextStyle(color: AppColors.warning, fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  Text(fmt.format(item['price']), style: TextStyle(color: isDark ? Colors.white60 : Colors.black54, fontSize: 12)),
                ],
              ),
            )),
        ],
      ),
    );
  }
}
