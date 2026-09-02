// lib/screens/admin/orders/order_management_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart'; 
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'widgets/admin_order_card.dart';

class OrderManagementScreen extends StatefulWidget {
  const OrderManagementScreen({super.key});

  @override
  State<OrderManagementScreen> createState() => _OrderManagementScreenState();
}

class _OrderManagementScreenState extends State<OrderManagementScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  // ✅ UPDATED: Added 'Cancelled'
  int _filterIndex = 0; // 0=All, 1=Pending, 2=Processing, 3=Shipped, 4=Delivered, 5=Cancelled
  bool _selectionMode = false;
  final Set<String> _selectedOrderIds = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        // ✅✅✅ FIXED: Was loadOrders()
        Provider.of<OrderProvider>(context, listen: false).loadAllOrders();
      }
    });
  }

  void _enterSelectionMode(String id) {
    setState(() {
      _selectionMode = true;
      _selectedOrderIds.add(id);
    });
  }

  void _toggleSelect(String id) {
    setState(() {
      _selectedOrderIds.contains(id)
          ? _selectedOrderIds.remove(id)
          : _selectedOrderIds.add(id);
      if (_selectedOrderIds.isEmpty) _selectionMode = false;
    });
  }

  void _clearSelection() {
    setState(() {
      _selectionMode = false;
      _selectedOrderIds.clear();
    });
  }

  Future<void> _bulkCancelOrders(OrderProvider provider) async {
    if (_selectedOrderIds.isEmpty) return;
    
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        // ✅ ADDED: Theming
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        title: Text(
          'Cancel selected orders',
          style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary),
        ),
        content: Text(
          'Are you sure you want to cancel ${_selectedOrderIds.length} order(s)?',
          style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(
              'No',
              style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error), // ✅ Fixed
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      for (final id in _selectedOrderIds) {
        await provider.cancelOrder(id, 'Cancelled by admin');
      }

      _clearSelection();
      // ✅✅✅ FIXED: Was loadOrders()
      provider.loadAllOrders();

      if (mounted) {
        SnackbarHelper.showSuccess(
          context,
          'Cancelled ${_selectedOrderIds.length} order(s)',
        );
      }
    } catch (e) {
      if (mounted) {
        SnackbarHelper.showError(context, 'Failed to cancel selected orders');
      }
    }
  }

  List<OrderModel> _filterOrders(List<OrderModel> orders) {
    var filtered = orders;

    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      filtered = filtered.where((o) {
        final orderNumber = o.orderNumber.toLowerCase() ?? '';
        final id = o.id.toLowerCase();
        final name = o.deliveryAddress.name.toLowerCase() ?? '';
        final phone = o.deliveryAddress.phone ?? '';
        return orderNumber.contains(query) ||
            id.contains(query) ||
            name.contains(query) ||
            phone.contains(query);
      }).toList();
    }

    // ✅ UPDATED: Filter logic
    switch (_filterIndex) {
      case 1:
        filtered = filtered.where((o) => o.orderStatus.toLowerCase() == 'pending').toList();
        break;
      case 2:
        filtered = filtered.where((o) => o.orderStatus.toLowerCase() == 'processing').toList();
        break;
      case 3:
        filtered = filtered.where((o) => o.orderStatus.toLowerCase() == 'shipped').toList();
        break;
      case 4:
        filtered = filtered.where((o) => o.orderStatus.toLowerCase() == 'delivered').toList();
        break;
      case 5:
        filtered = filtered.where((o) => o.orderStatus.toLowerCase() == 'cancelled').toList();
        break;
    }

    filtered.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode; // ✅ ADDED
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary; // ✅ ADDED

    return Consumer<OrderProvider>(
      builder: (context, provider, _) {
        final allOrders = provider.orders;
        final filtered = _filterOrders(allOrders);

        // ✅ UPDATED: Stats calculation
        final total = allOrders.length;
        final pending = allOrders.where((o) => o.orderStatus.toLowerCase() == 'pending').length;
        final processing =
            allOrders.where((o) => o.orderStatus.toLowerCase() == 'processing').length;
        final shipped = allOrders.where((o) => o.orderStatus.toLowerCase() == 'shipped').length;
        final delivered =
            allOrders.where((o) => o.orderStatus.toLowerCase() == 'delivered').length;
        final cancelled =
            allOrders.where((o) => o.orderStatus.toLowerCase() == 'cancelled').length;

        return Scaffold(
          backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background, // ✅ Fixed
          appBar: AppBar(
            backgroundColor: accentColor, // ✅ Fixed
            foregroundColor: isDark ? AppColors.textPrimary : AppColors.white, // ✅ Fixed
            title: _selectionMode
                ? Text('${_selectedOrderIds.length} selected')
                : const Text('Order Management'),
            actions: _selectionMode
                ? [
                    IconButton(
                      icon: const Icon(Icons.cancel_schedule_send_outlined),
                      tooltip: 'Cancel Orders',
                      onPressed: () => _bulkCancelOrders(provider),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      tooltip: 'Cancel Selection',
                      onPressed: _clearSelection,
                    ),
                  ]
                : [
                    IconButton(
                      icon: const Icon(Icons.refresh_rounded),
                      tooltip: 'Refresh',
                      // ✅✅✅ FIXED: Was loadOrders
                      onPressed: provider.loadAllOrders,
                    ),
                  ],
          ),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _buildSearchAndFilters(isDark, accentColor),
                  const SizedBox(height: 12),
                  _buildStatsGrid(isDark, total, pending, processing, shipped, delivered, cancelled),
                  const SizedBox(height: 12),
                  Expanded(child: _buildContent(provider, filtered, isDark, accentColor)),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildSearchAndFilters(bool isDark, Color accentColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _searchController,
          onChanged: (value) => setState(() => _searchQuery = value.trim()),
          style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary), // ✅ Fixed
          decoration: InputDecoration(
            hintText: 'Search orders by ID, name, or phone...',
            hintStyle: TextStyle(color: isDark ? AppColors.textLightHint : AppColors.textHint), // ✅ Fixed
            prefixIcon: Icon(Icons.search, color: isDark ? AppColors.textLightHint : AppColors.textHint), // ✅ Fixed
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: Icon(Icons.clear, color: isDark ? AppColors.textLightHint : AppColors.textHint), // ✅ Fixed
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _searchQuery = '');
                    },
                  )
                : null,
            filled: true,
            fillColor: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border), // ✅ Fixed
            ),
             enabledBorder: OutlineInputBorder( // ✅ ADDED
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border),
            ),
          ),
        ),
        const SizedBox(height: 8),
        // ✅ Replaced Wrap with SingleChildScrollView
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: [
              _filterChip(0, 'All', isDark, accentColor),
              _filterChip(1, 'Pending', isDark, accentColor),
              _filterChip(2, 'Processing', isDark, accentColor),
              _filterChip(3, 'Shipped', isDark, accentColor),
              _filterChip(4, 'Delivered', isDark, accentColor), // ✅ Fixed label
              _filterChip(5, 'Cancelled', isDark, accentColor), // ✅ Added
            ],
          ),
        ),
      ],
    );
  }

  Widget _filterChip(int index, String label, bool isDark, Color accentColor) {
    final selected = _filterIndex == index;
    return Padding(
      padding: const EdgeInsets.only(right: 8.0),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => setState(() => _filterIndex = index),
        selectedColor: accentColor,
        backgroundColor: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant, // ✅ Fixed
        labelStyle: TextStyle(
          color: selected ? (isDark ? AppColors.textPrimary : AppColors.white) : (isDark ? AppColors.textLightSecondary : AppColors.textSecondary), // ✅ Fixed
          fontWeight: FontWeight.w600,
        ),
        side: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border), // ✅ Fixed
      ),
    );
  }

  Widget _buildStatsGrid(
      bool isDark, int total, int pending, int processing, int shipped, int delivered, int cancelled) {
    final stats = [
      {'title': 'Total', 'value': total, 'icon': Icons.list_alt_rounded, 'color': AppColors.primary},
      {'title': 'Pending', 'value': pending, 'icon': Icons.pending_actions_rounded, 'color': AppColors.pending},
      {'title': 'Processing', 'value': processing, 'icon': Icons.sync_rounded, 'color': AppColors.processing},
      {'title': 'Shipped', 'value': shipped, 'icon': Icons.local_shipping_rounded, 'color': AppColors.shipped},
      {'title': 'Delivered', 'value': delivered, 'icon': Icons.check_circle_rounded, 'color': AppColors.delivered},
      {'title': 'Cancelled', 'value': cancelled, 'icon': Icons.cancel_rounded, 'color': AppColors.cancelled},
    ];

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: stats.map((s) {
        return AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: isDark ? AppColors.shadowDark : AppColors.shadowLight, // ✅ Fixed
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(s['icon'] as IconData, color: s['color'] as Color, size: 20),
              const SizedBox(width: 6),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    s['title'].toString(),
                    style: TextStyle(fontSize: 12, color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary), // ✅ Fixed
                  ),
                  Text(
                    s['value'].toString(),
                    style: TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 14, color: isDark ? AppColors.textLight : AppColors.textPrimary), // ✅ Fixed
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildContent(OrderProvider provider, List<OrderModel> orders, bool isDark, Color accentColor) {
    if (provider.isLoading && orders.isEmpty) {
      return _buildShimmerList(isDark); // ✅ ENHANCED: Shimmer loading
    }

    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inbox_outlined, size: 80, color: isDark ? AppColors.textLightDisabled : AppColors.textDisabled), // ✅ Fixed
            const SizedBox(height: 10),
            Text(
              _searchQuery.isNotEmpty
                  ? 'No orders match your search'
                  : 'No orders found',
              style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, fontSize: 16), // ✅ Fixed
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: accentColor,
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
      onRefresh: () async {
        // ✅✅✅ FIXED: Was loadOrders()
        provider.loadAllOrders();
      },
      child: ListView.separated(
        padding: const EdgeInsets.only(top: 4, bottom: 16), // Added padding
        itemCount: orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (ctx, i) {
          final order = orders[i];
          final isSelected = _selectedOrderIds.contains(order.id);

          // ✅ ENHANCED: Added animated container for selection feedback
          return AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              color: isSelected ? accentColor.withValues(alpha: 0.1) : Colors.transparent,
              borderRadius: BorderRadius.circular(16), // Match card
              border: Border.all(
                color: isSelected ? accentColor.withValues(alpha: 0.8) : Colors.transparent,
                width: 2,
              )
            ),
            child: GestureDetector(
              onLongPress: () => _enterSelectionMode(order.id),
              onTap: () {
                if (_selectionMode) {
                  _toggleSelect(order.id);
                } else {
                  // Use go_router for URL-based navigation
                  context.go('/orders/${order.id}');
                }
              },
              child: Stack(
                children: [
                  AdminOrderCard(
                    order: order,
                    onTap: () { // This tap is now handled by the parent GestureDetector
                      if (_selectionMode) {
                         _toggleSelect(order.id);
                      } else {
                        // Use go_router for URL-based navigation
                        context.go('/orders/${order.id}');
                      }
                    },
                  ),
                  if (_selectionMode)
                    Positioned(
                      left: 8,
                      top: 8,
                      child: IgnorePointer( // Ignore pointer so tap goes to card
                        child: Checkbox(
                          value: isSelected,
                          onChanged: (_) {}, // Handled by parent
                          activeColor: accentColor,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ✅ ADDED: Shimmer loading widget
  Widget _buildShimmerList(bool isDark) {
    return Shimmer.fromColors(
      baseColor: isDark ? AppColors.surfaceDarkVariant : AppColors.shimmerBase, // ✅ Fixed
      highlightColor: isDark ? AppColors.surfaceDarkContainer : AppColors.shimmerHighlight, // ✅ Fixed
      child: ListView.builder(
        itemCount: 6,
        itemBuilder: (_, __) => Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surface,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(width: 150, height: 16, color: Colors.white),
              const SizedBox(height: 8),
              Container(width: 200, height: 14, color: Colors.white),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(width: 80, height: 30, color: Colors.white),
                  Container(width: 100, height: 16, color: Colors.white),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}