// lib/screens/orders/widgets/advanced_filter_sheet.dart
// Advanced Filter Bottom Sheet for Order Management

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Advanced filter options for orders
class OrderFilters {
  final DateTimeRange? dateRange;
  final String? datePreset;
  final List<String> paymentTypes;
  final String? courierFilter;
  final bool showOverdueOnly;
  final bool showHighValueOnly;
  final String? customerType;
  final RangeValues priceRange;

  const OrderFilters({
    this.dateRange,
    this.datePreset,
    this.paymentTypes = const [],
    this.courierFilter,
    this.showOverdueOnly = false,
    this.showHighValueOnly = false,
    this.customerType,
    this.priceRange = const RangeValues(0, 100000),
  });

  OrderFilters copyWith({
    DateTimeRange? dateRange,
    String? datePreset,
    List<String>? paymentTypes,
    String? courierFilter,
    bool? showOverdueOnly,
    bool? showHighValueOnly,
    String? customerType,
    RangeValues? priceRange,
  }) {
    return OrderFilters(
      dateRange: dateRange ?? this.dateRange,
      datePreset: datePreset ?? this.datePreset,
      paymentTypes: paymentTypes ?? this.paymentTypes,
      courierFilter: courierFilter ?? this.courierFilter,
      showOverdueOnly: showOverdueOnly ?? this.showOverdueOnly,
      showHighValueOnly: showHighValueOnly ?? this.showHighValueOnly,
      customerType: customerType ?? this.customerType,
      priceRange: priceRange ?? this.priceRange,
    );
  }

  int get activeFilterCount {
    int count = 0;
    if (datePreset != null && datePreset != 'all') count++;
    if (paymentTypes.isNotEmpty) count++;
    if (courierFilter != null) count++;
    if (showOverdueOnly) count++;
    if (showHighValueOnly) count++;
    if (customerType != null) count++;
    if (priceRange.start > 0 || priceRange.end < 100000) count++;
    return count;
  }

  bool get hasActiveFilters => activeFilterCount > 0;

  static OrderFilters empty() => const OrderFilters();
}

/// Advanced Filter Bottom Sheet
class AdvancedFilterSheet extends StatefulWidget {
  final OrderFilters initialFilters;
  final Function(OrderFilters) onApply;

  const AdvancedFilterSheet({
    super.key,
    required this.initialFilters,
    required this.onApply,
  });

  static Future<OrderFilters?> show(
    BuildContext context, {
    required OrderFilters initialFilters,
  }) {
    return showModalBottomSheet<OrderFilters>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AdvancedFilterSheet(
        initialFilters: initialFilters,
        onApply: (filters) => Navigator.pop(context, filters),
      ),
    );
  }

  @override
  State<AdvancedFilterSheet> createState() => _AdvancedFilterSheetState();
}

class _AdvancedFilterSheetState extends State<AdvancedFilterSheet> {
  late OrderFilters _filters;

  @override
  void initState() {
    super.initState();
    _filters = widget.initialFilters;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottomPadding = MediaQuery.viewInsetsOf(context).bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A2E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          
          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(
                  Icons.filter_list_rounded,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 12),
                Text(
                  'Advanced Filters',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                if (_filters.hasActiveFilters) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${_filters.activeFilterCount}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(
                    Icons.close_rounded,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          
          const Divider(height: 1),
          
          // Filter Content
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding + 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDateFilter(isDark),
                  const SizedBox(height: 24),
                  _buildPaymentTypeFilter(isDark),
                  const SizedBox(height: 24),
                  _buildCourierFilter(isDark),
                  const SizedBox(height: 24),
                  _buildToggleFilters(isDark),
                  const SizedBox(height: 24),
                  _buildCustomerTypeFilter(isDark),
                  const SizedBox(height: 24),
                  _buildPriceRangeFilter(isDark),
                  const SizedBox(height: 32),
                  _buildActionButtons(isDark),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, IconData icon, bool isDark) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
      ],
    );
  }

  Widget _buildDateFilter(bool isDark) {
    final presets = [
      ('all', 'All Time'),
      ('today', 'Today'),
      ('7days', 'Last 7 Days'),
      ('30days', 'Last 30 Days'),
      ('custom', 'Custom'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Date Range', Icons.calendar_today_rounded, isDark),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: presets.map((preset) {
            final isSelected = _filters.datePreset == preset.$1;
            return _buildChip(
              label: preset.$2,
              isSelected: isSelected,
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() {
                  _filters = _filters.copyWith(datePreset: preset.$1);
                });
                if (preset.$1 == 'custom') {
                  _showDateRangePicker();
                }
              },
              isDark: isDark,
            );
          }).toList(),
        ),
        if (_filters.datePreset == 'custom' && _filters.dateRange != null) ...[
          const SizedBox(height: 8),
          Text(
            '${_formatDate(_filters.dateRange!.start)} - ${_formatDate(_filters.dateRange!.end)}',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.primary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPaymentTypeFilter(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Payment Type', Icons.payment_rounded, isDark),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildChip(
              label: 'COD',
              isSelected: _filters.paymentTypes.contains('cod'),
              onTap: () => _togglePaymentType('cod'),
              isDark: isDark,
              color: Colors.purple,
            ),
            const SizedBox(width: 8),
            _buildChip(
              label: 'Prepaid',
              isSelected: _filters.paymentTypes.contains('prepaid'),
              onTap: () => _togglePaymentType('prepaid'),
              isDark: isDark,
              color: Colors.green,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCourierFilter(bool isDark) {
    final couriers = [
      (null, 'All'),
      ('unassigned', 'Unassigned'),
      ('shiprocket', 'Shiprocket'),
      ('delhivery', 'Delhivery'),
      ('self', 'Self Delivery'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Courier', Icons.local_shipping_rounded, isDark),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.3),
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String?>(
              value: _filters.courierFilter,
              isExpanded: true,
              icon: Icon(Icons.keyboard_arrow_down, color: isDark ? Colors.grey[400] : Colors.grey[600]),
              dropdownColor: isDark ? const Color(0xFF2A2A3E) : Colors.white,
              items: couriers.map((c) => DropdownMenuItem(
                value: c.$1,
                child: Text(
                  c.$2,
                  style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                ),
              )).toList(),
              onChanged: (value) {
                setState(() {
                  _filters = _filters.copyWith(courierFilter: value);
                });
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildToggleFilters(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Show Only', Icons.filter_alt_rounded, isDark),
        const SizedBox(height: 12),
        _buildToggleRow(
          icon: Icons.warning_rounded,
          label: 'Overdue Orders',
          subtitle: 'Orders past SLA deadline',
          value: _filters.showOverdueOnly,
          onChanged: (v) => setState(() => _filters = _filters.copyWith(showOverdueOnly: v)),
          isDark: isDark,
          color: Colors.red,
        ),
        const SizedBox(height: 12),
        _buildToggleRow(
          icon: Icons.local_fire_department_rounded,
          label: 'High Value Orders',
          subtitle: 'Orders above ₹5,000',
          value: _filters.showHighValueOnly,
          onChanged: (v) => setState(() => _filters = _filters.copyWith(showHighValueOnly: v)),
          isDark: isDark,
          color: Colors.orange,
        ),
      ],
    );
  }

  Widget _buildCustomerTypeFilter(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Customer Type', Icons.person_rounded, isDark),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildChip(
              label: 'All',
              isSelected: _filters.customerType == null,
              onTap: () => setState(() => _filters = _filters.copyWith(customerType: null)),
              isDark: isDark,
            ),
            const SizedBox(width: 8),
            _buildChip(
              label: 'New',
              isSelected: _filters.customerType == 'new',
              onTap: () => setState(() => _filters = _filters.copyWith(customerType: 'new')),
              isDark: isDark,
              color: Colors.blue,
            ),
            const SizedBox(width: 8),
            _buildChip(
              label: 'Repeat',
              isSelected: _filters.customerType == 'repeat',
              onTap: () => setState(() => _filters = _filters.copyWith(customerType: 'repeat')),
              isDark: isDark,
              color: Colors.green,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPriceRangeFilter(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _buildSectionTitle('Price Range', Icons.currency_rupee_rounded, isDark),
            const Spacer(),
            Text(
              '₹${_filters.priceRange.start.toInt()} - ₹${_filters.priceRange.end.toInt()}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        RangeSlider(
          values: _filters.priceRange,
          min: 0,
          max: 100000,
          divisions: 100,
          activeColor: AppColors.primary,
          inactiveColor: isDark ? Colors.grey[700] : Colors.grey[300],
          labels: RangeLabels(
            '₹${_filters.priceRange.start.toInt()}',
            '₹${_filters.priceRange.end.toInt()}',
          ),
          onChanged: (values) {
            setState(() {
              _filters = _filters.copyWith(priceRange: values);
            });
          },
        ),
      ],
    );
  }

  Widget _buildActionButtons(bool isDark) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: () {
              setState(() {
                _filters = OrderFilters.empty();
              });
            },
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              side: BorderSide(color: Colors.grey.withValues(alpha: 0.5)),
            ),
            child: Text(
              'Reset Filters',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 2,
          child: ElevatedButton(
            onPressed: () {
              HapticFeedback.mediumImpact();
              widget.onApply(_filters);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_rounded, size: 18),
                const SizedBox(width: 8),
                Text(
                  _filters.hasActiveFilters 
                      ? 'Apply ${_filters.activeFilterCount} Filters'
                      : 'Apply Filters',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
    required bool isDark,
    Color? color,
  }) {
    final chipColor = color ?? AppColors.primary;
    
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected 
              ? chipColor.withValues(alpha: 0.15)
              : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected 
                ? chipColor
                : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            color: isSelected 
                ? chipColor
                : (isDark ? Colors.grey[400] : Colors.grey[600]),
          ),
        ),
      ),
    );
  }

  Widget _buildToggleRow({
    required IconData icon,
    required String label,
    required String subtitle,
    required bool value,
    required Function(bool) onChanged,
    required bool isDark,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: value 
            ? color.withValues(alpha: 0.1)
            : (isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[50]),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: value ? color.withValues(alpha: 0.3) : Colors.transparent,
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: value ? color : Colors.grey),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: value ? color : (isDark ? Colors.white : Colors.black87),
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey[500],
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: color,
          ),
        ],
      ),
    );
  }

  void _togglePaymentType(String type) {
    HapticFeedback.selectionClick();
    final types = List<String>.from(_filters.paymentTypes);
    if (types.contains(type)) {
      types.remove(type);
    } else {
      types.add(type);
    }
    setState(() {
      _filters = _filters.copyWith(paymentTypes: types);
    });
  }

  Future<void> _showDateRangePicker() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
      initialDateRange: _filters.dateRange,
    );
    if (picked != null) {
      setState(() {
        _filters = _filters.copyWith(dateRange: picked);
      });
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}
