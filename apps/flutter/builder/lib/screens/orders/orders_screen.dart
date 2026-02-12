// ============================================================
// ORDERS SCREEN v2
// Enhanced order management with toolbar, filters, and bulk actions
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import '../../models/order_model.dart';
import '../../services/order_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:intl/intl.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  // Services
  late final OrderService _orderService;
  String? _storeId;
  
  // Data State
  List<OrderModel> _orders = [];
  bool _isLoading = true;
  
  // Search & Filter State
  String _searchQuery = '';
  String _statusFilter = 'all'; // all, pending, confirmed, shipped, delivered, cancelled
  String _sortBy = 'newest'; // newest, oldest, amount_high, amount_low
  String _dateFilter = 'all'; // all, today, week, month
  
  // Selection State
  bool _isSelectionMode = false;
  Set<String> _selectedOrderIds = {};
  
  // Controllers
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  
  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    // Lazily init service + storeId
    _orderService = context.read<OrderService>();
    if (_storeId == null) {
      final store = await context.read<StoreService>().getFirstStore();
      _storeId = store?.id;
    }
    if (_storeId == null) return;

    setState(() => _isLoading = true);
    try {
      final orders = await _orderService.fetchOrders(_storeId!);
      if (mounted) {
        setState(() {
          _orders = orders;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading orders: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ============================================
  // COMPUTED PROPERTIES
  // ============================================
  
  List<OrderModel> get _filteredOrders {
    var orders = List<OrderModel>.from(_orders);
    
    // Apply status filter
    if (_statusFilter != 'all') {
      final status = OrderStatus.values.firstWhere(
        (s) => s.name == _statusFilter,
        orElse: () => OrderStatus.pending,
      );
      orders = orders.where((o) => o.status == status).toList();
    }
    
    // Apply date filter
    final now = DateTime.now();
    if (_dateFilter == 'today') {
      orders = orders.where((o) => 
        o.createdAt.day == now.day && 
        o.createdAt.month == now.month && 
        o.createdAt.year == now.year
      ).toList();
    } else if (_dateFilter == 'week') {
      final weekAgo = now.subtract(const Duration(days: 7));
      orders = orders.where((o) => o.createdAt.isAfter(weekAgo)).toList();
    } else if (_dateFilter == 'month') {
      final monthAgo = now.subtract(const Duration(days: 30));
      orders = orders.where((o) => o.createdAt.isAfter(monthAgo)).toList();
    }
    
    // Apply search
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      orders = orders.where((o) =>
        o.orderNumber.toLowerCase().contains(query) ||
        o.customer.name.toLowerCase().contains(query) ||
        o.customer.phone.contains(query)
      ).toList();
    }
    
    // Apply sorting
    orders.sort((a, b) {
      switch (_sortBy) {
        case 'newest':
          return b.createdAt.compareTo(a.createdAt);
        case 'oldest':
          return a.createdAt.compareTo(b.createdAt);
        case 'amount_high':
          return b.pricing.total.compareTo(a.pricing.total);
        case 'amount_low':
          return a.pricing.total.compareTo(b.pricing.total);
        default:
          return 0;
      }
    });
    
    return orders;
  }

  int get _pendingCount => _orders.where((o) => o.status == OrderStatus.pending).length;
  int get _confirmedCount => _orders.where((o) => o.status == OrderStatus.confirmed).length;
  int get _shippedCount => _orders.where((o) => o.status == OrderStatus.shipped).length;
  int get _deliveredCount => _orders.where((o) => o.status == OrderStatus.delivered).length;
  
  double get _totalRevenue => _orders
    .where((o) => o.status == OrderStatus.delivered)
    .fold(0.0, (sum, o) => sum + o.pricing.total);

  // ============================================
  // ACTIONS
  // ============================================

  void _toggleSelectionMode() {
    HapticFeedback.mediumImpact();
    setState(() {
      _isSelectionMode = !_isSelectionMode;
      if (!_isSelectionMode) _selectedOrderIds.clear();
    });
  }

  void _toggleOrderSelection(String orderId) {
    HapticFeedback.selectionClick();
    setState(() {
      if (_selectedOrderIds.contains(orderId)) {
        _selectedOrderIds.remove(orderId);
      } else {
        _selectedOrderIds.add(orderId);
      }
    });
  }

  void _selectAll() {
    setState(() {
      _selectedOrderIds = _filteredOrders.map((o) => o.id).toSet();
    });
  }

  void _clearSelection() {
    setState(() => _selectedOrderIds.clear());
  }

  Future<void> _bulkUpdateStatus(OrderStatus newStatus) async {
    if (_selectedOrderIds.isEmpty) return;
    
    final confirm = await _showConfirmDialog(
      title: 'Update ${_selectedOrderIds.length} Orders?',
      message: 'Mark all selected orders as ${newStatus.displayName}?',
      confirmText: 'Update',
      confirmColor: Color(int.parse(newStatus.color.replaceFirst('#', '0xFF'))),
    );
    
    if (confirm != true) return;
    
    try {
      for (final orderId in _selectedOrderIds) {
        await _orderService.updateOrderStatus(orderId, status: newStatus.name);
      }
      
      HapticFeedback.mediumImpact();
      _showSnackBar('${_selectedOrderIds.length} orders updated to ${newStatus.displayName}');
      _clearSelection();
      _toggleSelectionMode();
      _loadOrders();
    } catch (e) {
      _showSnackBar('Error: $e', isError: true);
    }
  }

  void _handleStatusChange(OrderModel order, OrderStatus newStatus) async {
    try {
      if (newStatus == OrderStatus.shipped) {
        final result = await _showTrackingDialog();
        if (result != null) {
          await _orderService.fulfillOrder(
            order.id,
            trackingNumber: result['number'],
            carrier: result['carrier'],
          );
        } else {
          return;
        }
      } else {
        await _orderService.updateOrderStatus(order.id, status: newStatus.name);
      }
      if (mounted) {
        _showSnackBar('Order ${order.orderNumber} → ${newStatus.displayName}');
        _loadOrders();
      }
    } catch (e) {
      if (mounted) {
        _showSnackBar('Error: $e', isError: true);
      }
    }
  }

  void _exportOrders() async {
    final format = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Export Orders', style: TextStyle(
              fontSize: 18, fontWeight: FontWeight.bold, color: colors.textPrimary,
            )),
            const SizedBox(height: 16),
            _buildExportOption(
              icon: Icons.table_chart_rounded,
              title: 'Export as CSV',
              subtitle: 'Spreadsheet format',
              onTap: () => Navigator.pop(context, 'csv'),
            ),
            const SizedBox(height: 12),
            _buildExportOption(
              icon: Icons.picture_as_pdf_rounded,
              title: 'Export as PDF',
              subtitle: 'Print-ready report',
              onTap: () => Navigator.pop(context, 'pdf'),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
    
    if (format != null) {
      _showSnackBar('Export to $format coming soon!');
    }
  }

  Widget _buildExportOption({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colors.divider),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.lavender.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: AppColors.lavender, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(
                    color: colors.textPrimary, fontWeight: FontWeight.w600,
                  )),
                  Text(subtitle, style: TextStyle(
                    color: colors.textSecondary, fontSize: 12,
                  )),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: colors.textTertiary),
          ],
        ),
      ),
    );
  }

  Future<Map<String, String>?> _showTrackingDialog() async {
    final numberController = TextEditingController();
    final carrierController = TextEditingController();

    return showDialog<Map<String, String>>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Add Tracking Info', style: TextStyle(color: colors.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: carrierController,
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                labelText: 'Carrier (e.g., Delhivery)',
                labelStyle: TextStyle(color: colors.textSecondary),
                hintText: 'Enter shipping carrier',
                hintStyle: TextStyle(color: colors.textTertiary),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: numberController,
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                labelText: 'Tracking Number',
                labelStyle: TextStyle(color: colors.textSecondary),
                hintText: 'Enter tracking number',
                hintStyle: TextStyle(color: colors.textTertiary),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: colors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context, {
                'number': numberController.text,
                'carrier': carrierController.text,
              });
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.lavender,
            ),
            child: const Text('Ship Order'),
          ),
        ],
      ),
    );
  }

  Future<bool?> _showConfirmDialog({
    required String title,
    required String message,
    required String confirmText,
    Color confirmColor = Colors.redAccent,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title, style: TextStyle(color: colors.textPrimary)),
        content: Text(message, style: TextStyle(color: colors.textSecondary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: TextStyle(color: colors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(confirmText, style: TextStyle(color: confirmColor)),
          ),
        ],
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : Colors.green,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  // ============================================
  // BUILD
  // ============================================

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    
    if (_storeId == null && _isLoading == false) {
      return Scaffold(
        backgroundColor: colors.bgStart,
        body: Center(
          child: Text('Please login to view orders', 
            style: TextStyle(color: colors.textSecondary)),
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              _buildHeader(),
              _buildActionToolbar(),
              _buildStatsRow(),
              _buildFilterSortBar(),
              Expanded(child: _isLoading ? _buildLoading() : _buildOrdersList()),
              if (_isSelectionMode && _selectedOrderIds.isNotEmpty)
                _buildBulkActionsBar(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoading() {
    return const Center(
      child: CircularProgressIndicator(color: AppColors.lavender),
    );
  }

  // ============================================
  // HEADER
  // ============================================

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 12, 0),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Orders', style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.bold, color: colors.textPrimary,
                )),
                Text('Manage your store orders', style: TextStyle(
                  fontSize: 12, color: colors.textSecondary,
                )),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _loadOrders,
            tooltip: 'Refresh',
          ),
          PopupMenuButton<String>(
            icon: Icon(Icons.more_vert, color: colors.textSecondary),
            color: colors.card,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            itemBuilder: (context) => [
              PopupMenuItem(value: 'settings', child: Row(
                children: [
                  Icon(Icons.settings_rounded, size: 20, color: colors.textSecondary),
                  const SizedBox(width: 12),
                  Text('Settings', style: TextStyle(color: colors.textPrimary)),
                ],
              )),
            ],
            onSelected: (value) {},
          ),
        ],
      ),
    );
  }

  // ============================================
  // ACTION TOOLBAR
  // ============================================

  Widget _buildActionToolbar() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.divider),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildToolbarButton(
            icon: Icons.upload_rounded,
            label: 'Export',
            onTap: _exportOrders,
          ),
          _buildToolbarDivider(),
          _buildToolbarButton(
            icon: Icons.print_rounded,
            label: 'Print',
            onTap: () => _showSnackBar('Print coming soon!'),
          ),
          _buildToolbarDivider(),
          _buildToolbarButton(
            icon: _isSelectionMode ? Icons.close_rounded : Icons.checklist_rounded,
            label: _isSelectionMode ? 'Cancel' : 'Select',
            onTap: _toggleSelectionMode,
            isActive: _isSelectionMode,
          ),
        ],
      ),
    );
  }

  Widget _buildToolbarButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isPrimary = false,
    bool isActive = false,
  }) {
    final color = isPrimary ? AppColors.lavender : 
                  isActive ? AppColors.lavender : colors.textSecondary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w500,
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildToolbarDivider() {
    return Container(height: 30, width: 1, color: colors.divider);
  }

  // ============================================
  // STATS ROW
  // ============================================

  Widget _buildStatsRow() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildStatChip('Total', '${_orders.length}', AppColors.lavender),
            const SizedBox(width: 8),
            _buildStatChip('Pending', '$_pendingCount', const Color(0xFFF59E0B)),
            const SizedBox(width: 8),
            _buildStatChip('Confirmed', '$_confirmedCount', const Color(0xFF3B82F6)),
            const SizedBox(width: 8),
            _buildStatChip('Shipped', '$_shippedCount', const Color(0xFF8B5CF6)),
            const SizedBox(width: 8),
            _buildStatChip('Delivered', '$_deliveredCount', const Color(0xFF10B981)),
          ],
        ),
      ),
    );
  }

  Widget _buildStatChip(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6, height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text('$value $label', style: TextStyle(
            color: color, fontSize: 11, fontWeight: FontWeight.w600,
          )),
        ],
      ),
    );
  }

  // ============================================
  // FILTER & SORT BAR
  // ============================================

  Widget _buildFilterSortBar() {
    return Column(
      children: [
        // Status filter chips
        Container(
          height: 44,
          margin: const EdgeInsets.only(top: 12),
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _buildFilterChip('All', 'all'),
              _buildFilterChip('Pending', 'pending'),
              _buildFilterChip('Confirmed', 'confirmed'),
              _buildFilterChip('Shipped', 'shipped'),
              _buildFilterChip('Delivered', 'delivered'),
              _buildFilterChip('Cancelled', 'cancelled'),
            ],
          ),
        ),
        // Sort + Date + Search row
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: Row(
            children: [
              // Sort dropdown
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colors.divider),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _sortBy,
                    isDense: true,
                    dropdownColor: colors.card,
                    style: TextStyle(color: colors.textPrimary, fontSize: 12),
                    icon: Icon(Icons.keyboard_arrow_down, color: colors.textSecondary, size: 18),
                    items: const [
                      DropdownMenuItem(value: 'newest', child: Text('Newest')),
                      DropdownMenuItem(value: 'oldest', child: Text('Oldest')),
                      DropdownMenuItem(value: 'amount_high', child: Text('Amount ↓')),
                      DropdownMenuItem(value: 'amount_low', child: Text('Amount ↑')),
                    ],
                    onChanged: (value) {
                      if (value != null) setState(() => _sortBy = value);
                    },
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Date dropdown
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colors.divider),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _dateFilter,
                    isDense: true,
                    dropdownColor: colors.card,
                    style: TextStyle(color: colors.textPrimary, fontSize: 12),
                    icon: Icon(Icons.keyboard_arrow_down, color: colors.textSecondary, size: 18),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('All Time')),
                      DropdownMenuItem(value: 'today', child: Text('Today')),
                      DropdownMenuItem(value: 'week', child: Text('This Week')),
                      DropdownMenuItem(value: 'month', child: Text('This Month')),
                    ],
                    onChanged: (value) {
                      if (value != null) setState(() => _dateFilter = value);
                    },
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Search field
              Expanded(
                child: Container(
                  height: 36,
                  decoration: BoxDecoration(
                    color: colors.surfaceVariant,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: colors.divider),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (v) => setState(() => _searchQuery = v),
                    style: TextStyle(color: colors.textPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Search...',
                      hintStyle: TextStyle(color: colors.textTertiary, fontSize: 13),
                      prefixIcon: Icon(Icons.search, color: colors.textTertiary, size: 18),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: Icon(Icons.close, color: colors.textTertiary, size: 16),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isActive = _statusFilter == value;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _statusFilter = value);
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppColors.lavender : colors.surfaceVariant,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? AppColors.lavender : colors.divider,
          ),
        ),
        child: Text(label, style: TextStyle(
          color: isActive ? Colors.white : colors.textSecondary,
          fontSize: 12,
          fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
        )),
      ),
    );
  }

  // ============================================
  // ORDERS LIST
  // ============================================

  Widget _buildOrdersList() {
    if (_orders.isEmpty) {
      return _buildEmptyState();
    }

    if (_filteredOrders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: colors.textTertiary),
            const SizedBox(height: 16),
            Text('No orders match your filters', 
              style: TextStyle(color: colors.textSecondary)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => setState(() {
                _statusFilter = 'all';
                _dateFilter = 'all';
                _searchQuery = '';
                _searchController.clear();
              }),
              child: Text('Clear Filters', style: TextStyle(color: AppColors.lavender)),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadOrders,
      child: ListView.builder(
        controller: _scrollController,
        padding: EdgeInsets.fromLTRB(16, 0, 16, _isSelectionMode ? 100 : 24),
        itemCount: _filteredOrders.length,
        itemBuilder: (context, index) {
          final order = _filteredOrders[index];
          return _buildOrderCard(order);
        },
      ),
    );
  }

  Widget _buildOrderCard(OrderModel order) {
    final statusColor = Color(int.parse(order.status.color.replaceFirst('#', '0xFF')));
    final isSelected = _selectedOrderIds.contains(order.id);

    return GestureDetector(
      onTap: () {
        if (_isSelectionMode) {
          _toggleOrderSelection(order.id);
        } else {
          // TODO: Navigate to order details
        }
      },
      onLongPress: () {
        if (!_isSelectionMode) {
          _toggleSelectionMode();
          _toggleOrderSelection(order.id);
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? AppColors.lavender : colors.cardBorder,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected ? [
            BoxShadow(
              color: AppColors.lavender.withValues(alpha: 0.2),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ] : null,
        ),
        child: Column(
          children: [
            // Header row
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  // Selection checkbox
                  if (_isSelectionMode) ...[
                    GestureDetector(
                      onTap: () => _toggleOrderSelection(order.id),
                      child: Container(
                        width: 22, height: 22,
                        margin: const EdgeInsets.only(right: 12),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.lavender : Colors.transparent,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isSelected ? AppColors.lavender : colors.divider,
                            width: 2,
                          ),
                        ),
                        child: isSelected
                            ? const Icon(Icons.check, color: Colors.white, size: 14)
                            : null,
                      ),
                    ),
                  ],
                  // Order info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(order.orderNumber, style: TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 14, color: colors.textPrimary,
                            )),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(order.status.displayName, style: TextStyle(
                                color: statusColor, fontSize: 10, fontWeight: FontWeight.w600,
                              )),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          DateFormat('MMM d, h:mm a').format(order.createdAt),
                          style: TextStyle(color: colors.textSecondary, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  // Total
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('₹${order.pricing.total.toStringAsFixed(0)}', style: TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.lavender,
                      )),
                      Text('${order.itemCount} items', style: TextStyle(
                        color: colors.textSecondary, fontSize: 10,
                      )),
                    ],
                  ),
                ],
              ),
            ),
            
            // Customer + Actions row
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: colors.surfaceVariant.withValues(alpha: 0.5),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(13)),
              ),
              child: Row(
                children: [
                  Icon(Icons.person_outline, size: 16, color: colors.textSecondary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${order.customer.name} • ${order.customer.phone}',
                      style: TextStyle(color: colors.textSecondary, fontSize: 12),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  // Quick action
                  if (!_isSelectionMode && order.status != OrderStatus.delivered && order.status != OrderStatus.cancelled)
                    PopupMenuButton<OrderStatus>(
                      icon: Icon(Icons.more_horiz, color: colors.textSecondary, size: 20),
                      padding: EdgeInsets.zero,
                      itemBuilder: (context) => _getStatusOptions(order.status)
                          .map((status) => PopupMenuItem(
                                value: status,
                                child: Row(
                                  children: [
                                    Icon(_getStatusIcon(status), size: 18,
                                      color: Color(int.parse(status.color.replaceFirst('#', '0xFF')))),
                                    const SizedBox(width: 8),
                                    Text(status.displayName),
                                  ],
                                ),
                              ))
                          .toList(),
                      onSelected: (status) => _handleStatusChange(order, status),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<OrderStatus> _getStatusOptions(OrderStatus currentStatus) {
    switch (currentStatus) {
      case OrderStatus.pending:
        return [OrderStatus.confirmed, OrderStatus.cancelled];
      case OrderStatus.confirmed:
        return [OrderStatus.shipped, OrderStatus.cancelled];
      case OrderStatus.shipped:
        return [OrderStatus.delivered];
      default:
        return [];
    }
  }

  IconData _getStatusIcon(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return Icons.schedule_rounded;
      case OrderStatus.confirmed:
        return Icons.check_circle_outline;
      case OrderStatus.shipped:
        return Icons.local_shipping_outlined;
      case OrderStatus.delivered:
        return Icons.inventory_2_outlined;
      case OrderStatus.cancelled:
        return Icons.cancel_outlined;
    }
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.lavender.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.inbox_outlined, size: 56, color: AppColors.lavender),
            ),
            const SizedBox(height: 20),
            Text('No Orders Yet', style: TextStyle(
              fontSize: 18, fontWeight: FontWeight.bold, color: colors.textPrimary,
            )),
            const SizedBox(height: 8),
            Text('Orders will appear here once customers place them',
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================
  // BULK ACTIONS BAR
  // ============================================

  Widget _buildBulkActionsBar() {
    return Container(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 16,
        bottom: MediaQuery.of(context).padding.bottom + 16,
      ),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Selection info
          GestureDetector(
            onTap: _selectAll,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.lavender.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${_selectedOrderIds.length} selected',
                style: TextStyle(
                  color: AppColors.lavender,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ),
          const Spacer(),
          // Action buttons
          _buildBulkButton(Icons.check_circle_outline, 'Confirm', 
            () => _bulkUpdateStatus(OrderStatus.confirmed),
            color: const Color(0xFF3B82F6)),
          const SizedBox(width: 8),
          _buildBulkButton(Icons.local_shipping_outlined, 'Ship', 
            () => _bulkUpdateStatus(OrderStatus.shipped),
            color: const Color(0xFF8B5CF6)),
          const SizedBox(width: 8),
          _buildBulkButton(Icons.more_horiz, 'More', () {
            _showSnackBar('More actions coming soon');
          }),
        ],
      ),
    );
  }

  Widget _buildBulkButton(IconData icon, String label, VoidCallback onTap, {Color? color}) {
    final buttonColor = color ?? colors.textSecondary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: buttonColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: buttonColor),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(
              color: buttonColor, fontSize: 12, fontWeight: FontWeight.w500,
            )),
          ],
        ),
      ),
    );
  }
}
