import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Estimated results card showing projected performance
/// Based on budget, CPC, and category competition
class EstimatedResultsCard extends StatelessWidget {
  final double dailyBudget;
  final double cpc;
  final String? categoryId;

  const EstimatedResultsCard({
    super.key,
    required this.dailyBudget,
    required this.cpc,
    this.categoryId,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Calculate estimates
    final estClicks = cpc > 0 ? (dailyBudget / cpc).floor() : 0;
    final estImpressions = (estClicks * 25).clamp(0, 10000); // ~4% CTR assumption
    final estOrders = (estClicks * 0.03).floor(); // ~3% conversion
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary.withValues(alpha: 0.1),
            AppColors.primaryLight.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.insights_rounded,
                  size: 20,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Estimated Daily Results',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : const Color(0xFF111827),
                      ),
                    ),
                    Text(
                      'Based on your budget & CPC',
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.grey[500] : Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          
          // Metrics grid
          Row(
            children: [
              Expanded(child: _buildMetric('Clicks', estClicks.toString(), Icons.touch_app_rounded, isDark)),
              Container(width: 1, height: 40, color: AppColors.primary.withValues(alpha: 0.2)),
              Expanded(child: _buildMetric('Impressions', _formatNumber(estImpressions), Icons.visibility_rounded, isDark)),
              Container(width: 1, height: 40, color: AppColors.primary.withValues(alpha: 0.2)),
              Expanded(child: _buildMetric('Orders', '~$estOrders', Icons.shopping_cart_rounded, isDark)),
            ],
          ),
          
          const SizedBox(height: 16),
          
          // Tips
          if (estClicks < 10)
            _buildTip('💡 Increase budget or lower CPC to get more clicks', Colors.amber, isDark)
          else if (cpc < 3)
            _buildTip('⚡ Low CPC may reduce visibility in competitive categories', Colors.orange, isDark)
          else
            _buildTip('✅ Good budget allocation for estimated reach', Colors.green, isDark),
        ],
      ),
    );
  }

  Widget _buildMetric(String label, String value, IconData icon, bool isDark) {
    return Column(
      children: [
        Icon(icon, size: 20, color: AppColors.primary),
        const SizedBox(height: 6),
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: isDark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: isDark ? Colors.grey[500] : Colors.grey[600],
          ),
        ),
      ],
    );
  }

  Widget _buildTip(String text, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12,
                color: color.withValues(alpha: 0.9),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatNumber(int num) {
    if (num >= 1000) {
      return '${(num / 1000).toStringAsFixed(1)}K';
    }
    return num.toString();
  }
}
