// lib/screens/admin/analytics/widgets/orders_chart.dart

import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'analytics_card.dart';

enum OrdersChartView { pie, bar, table }

class OrdersChart extends StatefulWidget {
  final Map<String, int> orderStats;
  final bool isDark;

  const OrdersChart({
    super.key,
    required this.orderStats,
    required this.isDark,
  });

  @override
  State<OrdersChart> createState() => _OrdersChartState();
}

class _OrdersChartState extends State<OrdersChart>
    with AutomaticKeepAliveClientMixin, SingleTickerProviderStateMixin {
  @override
  bool get wantKeepAlive => true;

  OrdersChartView currentView = OrdersChartView.pie;
  int? touchedIndex;

  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    )..forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  bool get isMobile => MediaQuery.of(context).size.width < 600;

  @override
  Widget build(BuildContext context) {
    super.build(context);

    final accentColor = widget.isDark ? AppColors.primaryLight : AppColors.primary;

    return AnalyticsCard(
      title: 'Order Distribution',
      icon: Icons.pie_chart_rounded,
      color: accentColor,
      isDark: widget.isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // View Selector
          _buildViewSelector(accentColor),
          const SizedBox(height: 24),

          // Content based on view
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 400),
            transitionBuilder: (child, animation) {
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.1, 0),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              );
            },
            child: _buildCurrentView(),
          ),
        ],
      ),
    );
  }

  Widget _buildViewSelector(Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: (widget.isDark
                ? AppColors.surfaceDarkVariant
                : AppColors.surface)
            .withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: widget.isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          _buildViewButton(
            OrdersChartView.pie,
            Icons.pie_chart_rounded,
            'Pie',
            accentColor,
          ),
          const SizedBox(width: 8),
          _buildViewButton(
            OrdersChartView.bar,
            Icons.bar_chart_rounded,
            'Bar',
            accentColor,
          ),
          const SizedBox(width: 8),
          _buildViewButton(
            OrdersChartView.table,
            Icons.table_chart_rounded,
            'Table',
            accentColor,
          ),
        ],
      ),
    );
  }

  Widget _buildViewButton(
    OrdersChartView view,
    IconData icon,
    String label,
    Color accentColor,
  ) {
    final isSelected = currentView == view;

    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (mounted) {
              setState(() {
                currentView = view;
                touchedIndex = null;
              });
            }
          },
          borderRadius: BorderRadius.circular(8),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              gradient: isSelected
                  ? LinearGradient(
                      colors: [
                        accentColor.withValues(alpha: 0.2),
                        accentColor.withValues(alpha: 0.1),
                      ],
                    )
                  : null,
              borderRadius: BorderRadius.circular(8),
              border: isSelected
                  ? Border.all(
                      color: accentColor.withValues(alpha: 0.6),
                      width: 2,
                    )
                  : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: isSelected
                      ? accentColor
                      : widget.isDark
                          ? AppColors.textLightSecondary
                          : AppColors.textSecondary,
                ),
                if (!isMobile) ...[
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                      color: isSelected
                          ? accentColor
                          : widget.isDark
                              ? AppColors.textLight
                              : AppColors.textPrimary,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentView() {
    switch (currentView) {
      case OrdersChartView.pie:
        return _buildPieChart();
      case OrdersChartView.bar:
        return _buildBarChart();
      case OrdersChartView.table:
        return _buildTableView();
    }
  }

  Widget _buildPieChart() {
    final sections = _createPieSections();

    if (sections.isEmpty) {
      return _buildEmptyState();
    }

    return SizedBox(
      height: 350,
      child: Row(
        children: [
          Expanded(
            flex: isMobile ? 3 : 2,
            child: AnimatedBuilder(
              animation: _animController,
              builder: (context, child) {
                return PieChart(
                  PieChartData(
                    sections: sections,
                    centerSpaceRadius: isMobile ? 50 : 70,
                    sectionsSpace: 3,
                    pieTouchData: PieTouchData(
                      enabled: true,
                      touchCallback: (event, response) {
                        if (!mounted) return;
                        
                        setState(() {
                          if (response?.touchedSection != null) {
                            touchedIndex = response!.touchedSection!.touchedSectionIndex;
                          } else {
                            touchedIndex = null;
                          }
                        });
                      },
                    ),
                  ),
                  swapAnimationDuration: const Duration(milliseconds: 350),
                  swapAnimationCurve: Curves.easeInOutCubic,
                );
              },
            ),
          ),
          const SizedBox(width: 24),
          Expanded(
            flex: isMobile ? 2 : 1,
            child: _buildLegend(),
          ),
        ],
      ),
    );
  }

  Widget _buildBarChart() {
    final data = _getOrderData();

    if (data.isEmpty) {
      return _buildEmptyState();
    }

    return SizedBox(
      height: 350,
      child: BarChart(
        BarChartData(
          alignment: BarChartAlignment.spaceAround,
          maxY: _getMaxOrderCount(data) * 1.2,
          barTouchData: BarTouchData(
            enabled: true,
            touchCallback: (event, response) {
              if (!mounted) return;
              
              setState(() {
                if (response?.spot != null) {
                  touchedIndex = response!.spot!.touchedBarGroupIndex;
                } else {
                  touchedIndex = null;
                }
              });
            },
            touchTooltipData: BarTouchTooltipData(
              getTooltipColor: (_) =>
                  widget.isDark ? AppColors.surfaceDarkContainer : AppColors.surface,
              tooltipRoundedRadius: 12,
              tooltipPadding: const EdgeInsets.all(12),
              getTooltipItem: (group, groupIndex, rod, rodIndex) {
                final status = data[groupIndex].status;
                final count = rod.toY.toInt();

                return BarTooltipItem(
                  '$status\n',
                  TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: widget.isDark ? AppColors.textLight : AppColors.textPrimary,
                  ),
                  children: [
                    TextSpan(
                      text: '$count orders',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: _getStatusColor(status),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
          titlesData: FlTitlesData(
            show: true,
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 40,
                getTitlesWidget: (value, meta) {
                  final index = value.toInt();
                  if (index < 0 || index >= data.length) {
                    return const SizedBox.shrink();
                  }

                  final status = data[index].status;
                  final label = _getStatusAbbreviation(status);

                  return Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: widget.isDark
                            ? AppColors.textLightSecondary
                            : AppColors.textSecondary,
                      ),
                    ),
                  );
                },
              ),
            ),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 40,
                getTitlesWidget: (value, meta) {
                  return Text(
                    value.toInt().toString(),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: widget.isDark
                          ? AppColors.textLightHint
                          : AppColors.textHint,
                    ),
                  );
                },
              ),
            ),
            topTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            rightTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
          ),
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: _getMaxOrderCount(data) / 5,
            getDrawingHorizontalLine: (value) => FlLine(
              color: (widget.isDark ? AppColors.borderDark : AppColors.border)
                  .withValues(alpha: 0.3),
              strokeWidth: 1,
              dashArray: [5, 5],
            ),
          ),
          borderData: FlBorderData(
            show: true,
            border: Border(
              left: BorderSide(
                color: (widget.isDark ? AppColors.borderDark : AppColors.border)
                    .withValues(alpha: 0.6),
                width: 2,
              ),
              bottom: BorderSide(
                color: (widget.isDark ? AppColors.borderDark : AppColors.border)
                    .withValues(alpha: 0.6),
                width: 2,
              ),
            ),
          ),
          barGroups: data.asMap().entries.map((entry) {
            final index = entry.key;
            final item = entry.value;
            final isTouched = touchedIndex == index;

            return BarChartGroupData(
              x: index,
              barRods: [
                BarChartRodData(
                  toY: item.count.toDouble(),
                  gradient: LinearGradient(
                    colors: [
                      _getStatusColor(item.status),
                      _getStatusColor(item.status).withValues(alpha: 0.7),
                    ],
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                  ),
                  width: isTouched ? 32 : 24,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(8),
                    topRight: Radius.circular(8),
                  ),
                  backDrawRodData: BackgroundBarChartRodData(
                    show: true,
                    toY: _getMaxOrderCount(data) * 1.2,
                    color: (widget.isDark
                            ? AppColors.surfaceDarkVariant
                            : AppColors.surface)
                        .withValues(alpha: 0.3),
                  ),
                ),
              ],
            );
          }).toList(),
        ),
        swapAnimationDuration: const Duration(milliseconds: 350),
        swapAnimationCurve: Curves.easeInOutCubic,
      ),
    );
  }

  Widget _buildTableView() {
    final data = _getOrderData();

    if (data.isEmpty) {
      return _buildEmptyState();
    }

    final total = data.fold<int>(0, (sum, item) => sum + item.count);

    return Column(
      children: [
        // Summary Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                (widget.isDark ? AppColors.primaryLight : AppColors.primary)
                    .withValues(alpha: 0.15),
                (widget.isDark ? AppColors.primaryLight : AppColors.primary)
                    .withValues(alpha: 0.05),
              ],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: (widget.isDark ? AppColors.primaryLight : AppColors.primary)
                  .withValues(alpha: 0.3),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.shopping_bag_rounded,
                size: 32,
                color: widget.isDark ? AppColors.primaryLight : AppColors.primary,
              ),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Total Orders',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: widget.isDark
                          ? AppColors.textLightSecondary
                          : AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    NumberFormat('#,###').format(total),
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      color: widget.isDark ? AppColors.primaryLight : AppColors.primary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Table
        Container(
          decoration: BoxDecoration(
            border: Border.all(
              color: widget.isDark ? AppColors.borderDark : AppColors.border,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Table(
              columnWidths: const {
                0: FlexColumnWidth(2),
                1: FlexColumnWidth(1),
                2: FlexColumnWidth(1),
              },
              children: [
                // Header
                TableRow(
                  decoration: BoxDecoration(
                    color: widget.isDark
                        ? AppColors.surfaceDarkVariant
                        : AppColors.surface,
                  ),
                  children: [
                    _buildTableHeader('Status'),
                    _buildTableHeader('Count'),
                    _buildTableHeader('Share'),
                  ],
                ),
                // Rows
                ...data.map((item) {
                  final percentage = (item.count / total * 100).toStringAsFixed(1);
                  return TableRow(
                    children: [
                      _buildTableCell(
                        Row(
                          children: [
                            Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: _getStatusColor(item.status),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                item.status,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: widget.isDark
                                      ? AppColors.textLight
                                      : AppColors.textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      _buildTableCell(
                        Text(
                          NumberFormat('#,###').format(item.count),
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: _getStatusColor(item.status),
                          ),
                        ),
                      ),
                      _buildTableCell(
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: _getStatusColor(item.status).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '$percentage%',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: _getStatusColor(item.status),
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                }),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTableHeader(String text) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          color: widget.isDark ? AppColors.textLight : AppColors.textPrimary,
        ),
      ),
    );
  }

  Widget _buildTableCell(Widget child) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: child,
    );
  }

  Widget _buildLegend() {
    final data = _getOrderData();
    final total = data.fold<int>(0, (sum, item) => sum + item.count);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: data.map((item) {
        final percentage = (item.count / total * 100).toStringAsFixed(1);

        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  color: _getStatusColor(item.status),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: _getStatusColor(item.status).withValues(alpha: 0.4),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.status,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: widget.isDark
                            ? AppColors.textLight
                            : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${item.count} ($percentage%)',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: widget.isDark
                            ? AppColors.textLightSecondary
                            : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      height: 300,
      alignment: Alignment.center,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.inbox_rounded,
            size: 64,
            color: widget.isDark
                ? AppColors.textLightHint
                : AppColors.textHint,
          ),
          const SizedBox(height: 16),
          Text(
            'No orders data available',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: widget.isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  List<PieChartSectionData> _createPieSections() {
    final data = _getOrderData();
    if (data.isEmpty) return [];

    final total = data.fold<int>(0, (sum, item) => sum + item.count);

    return data.asMap().entries.map((entry) {
      final index = entry.key;
      final item = entry.value;
      final isTouched = touchedIndex == index;
      final percentage = (item.count / total * 100);

      return PieChartSectionData(
        value: item.count.toDouble(),
        title: isTouched ? '${percentage.toStringAsFixed(1)}%' : '',
        radius: isTouched ? 80 : 70,
        titleStyle: TextStyle(
          fontSize: isTouched ? 16 : 14,
          fontWeight: FontWeight.w900,
          color: Colors.white,
          shadows: [
            Shadow(
              color: Colors.black.withValues(alpha: 0.5),
              blurRadius: 4,
            ),
          ],
        ),
        color: _getStatusColor(item.status),
        badgeWidget: isTouched
            ? Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: widget.isDark
                      ? AppColors.surfaceDark
                      : AppColors.surface,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 8,
                    ),
                  ],
                ),
                child: Text(
                  '${item.count}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: _getStatusColor(item.status),
                  ),
                ),
              )
            : null,
        badgePositionPercentageOffset: 1.3,
      );
    }).toList();
  }

  List<OrderData> _getOrderData() {
    return [
      OrderData('Pending', widget.orderStats['pending'] ?? 0),
      OrderData('Processing', widget.orderStats['processing'] ?? 0),
      OrderData('Shipped', widget.orderStats['shipped'] ?? 0),
      OrderData('Delivered', widget.orderStats['delivered'] ?? 0),
      OrderData('Cancelled', widget.orderStats['cancelled'] ?? 0),
    ].where((item) => item.count > 0).toList();
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return AppColors.warning;
      case 'processing':
        return AppColors.processing;
      case 'shipped':
        return AppColors.info;
      case 'delivered':
        return AppColors.success;
      case 'cancelled':
        return AppColors.error;
      default:
        return AppColors.textSecondary;
    }
  }

  String _getStatusAbbreviation(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'PND';
      case 'processing':
        return 'PRC';
      case 'shipped':
        return 'SHP';
      case 'delivered':
        return 'DLV';
      case 'cancelled':
        return 'CNC';
      default:
        return status.substring(0, 3).toUpperCase();
    }
  }

  double _getMaxOrderCount(List<OrderData> data) {
    if (data.isEmpty) return 100;
    return data.map((d) => d.count).reduce((a, b) => a > b ? a : b).toDouble();
  }
}

class OrderData {
  final String status;
  final int count;

  OrderData(this.status, this.count);
}
