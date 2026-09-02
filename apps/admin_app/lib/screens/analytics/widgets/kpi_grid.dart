// lib/screens/admin/analytics/widgets/kpi_grid.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class KPIGrid extends StatefulWidget {
  final Map<String, dynamic> kpiData;
  final bool isDark;

  const KPIGrid({
    super.key,
    required this.kpiData,
    required this.isDark,
  });

  @override
  State<KPIGrid> createState() => _KPIGridState();
}

class _KPIGridState extends State<KPIGrid>
    with AutomaticKeepAliveClientMixin, TickerProviderStateMixin {
  @override
  bool get wantKeepAlive => true;

  late List<AnimationController> _controllers;
  int? selectedIndex;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      8,
      (index) => AnimationController(
        duration: Duration(milliseconds: 800 + (index * 100)),
        vsync: this,
      )..forward(),
    );
  }

  @override
  void dispose() {
    for (var controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  bool get isMobile => MediaQuery.of(context).size.width < 600;
  bool get isTablet =>
      MediaQuery.of(context).size.width >= 600 &&
      MediaQuery.of(context).size.width < 1200;

  int get crossAxisCount {
    if (isMobile) return 2;
    if (isTablet) return 3;
    return 4;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    final kpis = _generateKPIList();

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 1.3,
      ),
      itemCount: kpis.length,
      itemBuilder: (context, index) {
        return _buildKPICard(kpis[index], index);
      },
    );
  }

  Widget _buildKPICard(KPIItem kpi, int index) {
    final isSelected = selectedIndex == index;

    return AnimatedBuilder(
      animation: _controllers[index],
      builder: (context, child) {
        return Transform.scale(
          scale: 0.5 + (_controllers[index].value * 0.5),
          child: Opacity(
            opacity: _controllers[index].value,
            child: child,
          ),
        );
      },
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (mounted) {
              setState(() {
                selectedIndex = isSelected ? null : index;
              });
            }
          },
          borderRadius: BorderRadius.circular(20),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isSelected
                    ? [
                        kpi.color.withValues(alpha: 0.3),
                        kpi.color.withValues(alpha: 0.1),
                      ]
                    : [
                        kpi.color.withValues(alpha: 0.15),
                        kpi.color.withValues(alpha: 0.05),
                      ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isSelected
                    ? kpi.color.withValues(alpha: 0.8)
                    : kpi.color.withValues(alpha: 0.4),
                width: isSelected ? 3 : 2,
              ),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: kpi.color.withValues(alpha: 0.3),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ]
                  : [
                      BoxShadow(
                        color: kpi.color.withValues(alpha: 0.15),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            kpi.color,
                            kpi.color.withValues(alpha: 0.7),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: kpi.color.withValues(alpha: 0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Icon(
                        kpi.icon,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                    if (kpi.trend != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: (kpi.trend! >= 0
                                  ? AppColors.success
                                  : AppColors.error)
                              .withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: (kpi.trend! >= 0
                                    ? AppColors.success
                                    : AppColors.error)
                                .withValues(alpha: 0.5),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              kpi.trend! >= 0
                                  ? Icons.trending_up_rounded
                                  : Icons.trending_down_rounded,
                              size: 14,
                              color: kpi.trend! >= 0
                                  ? AppColors.success
                                  : AppColors.error,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${kpi.trend!.abs().toStringAsFixed(1)}%',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: kpi.trend! >= 0
                                    ? AppColors.success
                                    : AppColors.error,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const Spacer(),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      kpi.label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: widget.isDark
                            ? AppColors.textLightSecondary
                            : AppColors.textSecondary,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      kpi.value,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: kpi.color,
                        height: 1.1,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (kpi.subtitle != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        kpi.subtitle!,
                        style: TextStyle(
                          fontSize: 11,
                          color: widget.isDark
                              ? AppColors.textLightHint
                              : AppColors.textHint,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<KPIItem> _generateKPIList() {
    final cf = NumberFormat.compactCurrency(symbol: '₹', decimalDigits: 0);
    final nf = NumberFormat.compact();

    return [
      KPIItem(
        label: 'Conversion Rate',
        value:
            '${(widget.kpiData['conversionRate'] ?? 0.0).toStringAsFixed(2)}%',
        icon: Icons.trending_up_rounded,
        color: AppColors.success,
        trend: 5.2,
        subtitle: '+0.8% from last week',
      ),
      KPIItem(
        label: 'Avg Order Value',
        value: cf.format(widget.kpiData['avgOrderValue'] ?? 0),
        icon: Icons.shopping_cart_rounded,
        color: AppColors.info,
        trend: 3.5,
        subtitle: 'Per transaction',
      ),
      KPIItem(
        label: 'Customer LTV',
        value: cf.format(widget.kpiData['customerLTV'] ?? 0),
        icon: Icons.people_rounded,
        color: AppColors.warning,
        trend: 12.4,
        subtitle: 'Lifetime value',
      ),
      KPIItem(
        label: 'Cart Abandonment',
        value:
            '${(widget.kpiData['cartAbandonment'] ?? 0.0).toStringAsFixed(1)}%',
        icon: Icons.remove_shopping_cart_rounded,
        color: AppColors.error,
        trend: -2.1,
        subtitle: 'Improvement',
      ),
      KPIItem(
        label: 'Active Users',
        value: nf.format(widget.kpiData['activeUsers'] ?? 0),
        icon: Icons.person_rounded,
        color: AppColors.processing,
        trend: 8.7,
        subtitle: 'Last 30 days',
      ),
      KPIItem(
        label: 'Return Rate',
        value: '${(widget.kpiData['returnRate'] ?? 0.0).toStringAsFixed(1)}%',
        icon: Icons.undo_rounded,
        color: const Color(0xFFFF6B6B),
        trend: -1.2,
        subtitle: 'Of all orders',
      ),
      KPIItem(
        label: 'Repeat Customers',
        value: '${(widget.kpiData['repeatRate'] ?? 0.0).toStringAsFixed(1)}%',
        icon: Icons.repeat_rounded,
        color: const Color(0xFF4ECDC4),
        trend: 6.3,
        subtitle: 'Coming back',
      ),
      KPIItem(
        label: 'Revenue/Customer',
        value: cf.format(widget.kpiData['revenuePerCustomer'] ?? 0),
        icon: Icons.account_balance_wallet_rounded,
        color: const Color(0xFF95E1D3),
        trend: 4.8,
        subtitle: 'Average spend',
      ),
    ];
  }
}

class KPIItem {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final double? trend;
  final String? subtitle;

  KPIItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.trend,
    this.subtitle,
  });
}
