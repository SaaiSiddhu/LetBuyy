// lib/screens/seller/orders/seller_order_management_screen.dart
// Advanced Seller Order Management Screen with Professional Features
// Features: Real-time updates, Analytics, Bulk Actions, Export, Advanced Filtering

import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../providers/seller_provider.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'seller_order_details_screen.dart';
import 'widgets/enhanced_order_card.dart';
import 'widgets/bulk_action_bar.dart';
import 'widgets/advanced_filter_sheet.dart';
import 'widgets/professional_order_header.dart';
import 'widgets/smart_order_search.dart';
import 'widgets/action_tabs_widget.dart';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

enum OrderSortOption {
  dateNewest('Newest', 'createdAt', true),
  dateOldest('Oldest', 'createdAt', false),
  amountHighest('High → Low', 'total', true),
  amountLowest('Low → High', 'total', false),
  statusAsc('A → Z', 'orderStatus', false),
  statusDesc('Z → A', 'orderStatus', true);

  final String label;
  final String field;
  final bool descending;
  const OrderSortOption(this.label, this.field, this.descending);
}

enum DateRangeFilter {
  all('All Time'),
  today('Today'),
  yesterday('Yesterday'),
  thisWeek('This Week'),
  lastWeek('Last Week'),
  thisMonth('This Month'),
  lastMonth('Last Month'),
  last30Days('Last 30 Days'),
  last90Days('Last 90 Days'),
  custom('Custom Range');

  final String label;
  const DateRangeFilter(this.label);
}

enum BulkAction {
  markProcessing('Mark Processing', Icons.hourglass_empty_rounded),
  markShipped('Mark Shipped', Icons.local_shipping_rounded),
  markDelivered('Mark Delivered', Icons.check_circle_rounded),
  printLabels('Print Labels', Icons.print_rounded),
  exportSelected('Export Selected', Icons.download_rounded),
  cancelOrders('Cancel Orders', Icons.cancel_rounded);

  final String label;
  final IconData icon;
  const BulkAction(this.label, this.icon);
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDER ANALYTICS MODEL
// ═══════════════════════════════════════════════════════════════════════════

class OrderAnalytics {
  final int totalOrders;
  final int pendingCount;
  final int processingCount;
  final int shippedCount;
  final int deliveredCount;
  final int cancelledCount;
  final double totalRevenue;
  final double averageOrderValue;
  final Map<String, int> ordersByDay;
  final Map<String, double> revenueByDay;

  OrderAnalytics({
    required this.totalOrders,
    required this.pendingCount,
    required this.processingCount,
    required this.shippedCount,
    required this.deliveredCount,
    required this.cancelledCount,
    required this.totalRevenue,
    required this.averageOrderValue,
    required this.ordersByDay,
    required this.revenueByDay,
  });

  factory OrderAnalytics.empty() => OrderAnalytics(
        totalOrders: 0,
        pendingCount: 0,
        processingCount: 0,
        shippedCount: 0,
        deliveredCount: 0,
        cancelledCount: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        ordersByDay: {},
        revenueByDay: {},
      );

  factory OrderAnalytics.fromOrders(List<OrderModel> orders) {
    if (orders.isEmpty) return OrderAnalytics.empty();

    int pending = 0, processing = 0, shipped = 0, delivered = 0, cancelled = 0;
    double revenue = 0;
    final Map<String, int> byDay = {};
    final Map<String, double> revenueDay = {};
    final dateFormat = DateFormat('MM/dd');

    for (final order in orders) {
      final status = order.orderStatus.toLowerCase();
      switch (status) {
        case 'pending':
          pending++;
          break;
        case 'processing':
          processing++;
          break;
        case 'shipped':
          shipped++;
          break;
        case 'delivered':
          delivered++;
          revenue += order.total;
          break;
        case 'cancelled':
          cancelled++;
          break;
      }

      // Track daily metrics
      final dayKey = dateFormat.format(order.createdAt);
      byDay[dayKey] = (byDay[dayKey] ?? 0) + 1;
      if (status == 'delivered') {
        revenueDay[dayKey] = (revenueDay[dayKey] ?? 0) + order.total;
      }
    }

    return OrderAnalytics(
      totalOrders: orders.length,
      pendingCount: pending,
      processingCount: processing,
      shippedCount: shipped,
      deliveredCount: delivered,
      cancelledCount: cancelled,
      totalRevenue: revenue,
      averageOrderValue: orders.isNotEmpty ? revenue / delivered.clamp(1, orders.length) : 0,
      ordersByDay: byDay,
      revenueByDay: revenueDay,
    );
  }

  double get fulfillmentRate =>
      totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 0;

  double get cancellationRate =>
      totalOrders > 0 ? (cancelledCount / totalOrders) * 100 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN WIDGET
// ═══════════════════════════════════════════════════════════════════════════

class SellerOrderManagementScreen extends StatefulWidget {
  const SellerOrderManagementScreen({super.key});

  @override
  State<SellerOrderManagementScreen> createState() =>
      _SellerOrderManagementScreenState();
}

class _SellerOrderManagementScreenState
    extends State<SellerOrderManagementScreen>
    with TickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  // ═══════════════════════════════════════════════════════════════════════
  // CONTROLLERS & STATE
  // ═══════════════════════════════════════════════════════════════════════

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final ReturnService _returnService = ReturnService();
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  late TabController _tabController;
  // Animation Controllers
  late AnimationController _bgAnimController;
  late AnimationController _floatController;


  // Search & Filter State
  String _searchQuery = '';
  int _statusFilterIndex = 0;
  OrderSortOption _sortOption = OrderSortOption.dateNewest;
  final DateRangeFilter _dateFilter = DateRangeFilter.all;
  DateTimeRange? _customDateRange;
  final RangeValues _priceRange = const RangeValues(0, 100000);
  final bool _showOnlyUrgent = false;

  // UI State
  final bool _isGridView = false;
  final bool _showAnalytics = false;
  bool _isSelectionMode = false;
  final Set<String> _selectedOrderIds = {};
  bool _isExporting = false;
  bool _isRefreshing = false;
  
  // Enhanced Features State
  final CardDensity _cardDensity = CardDensity.normal;
  OrderFilters _advancedFilters = OrderFilters.empty();
  int _overdueCount = 0;
  
  // Professional Header State
  bool _isLiveRefreshEnabled = true;
  DateRange _selectedDateRange = DateRange.today;
  final Set<QuickFilter> _activeQuickFilters = {};
  int _alertCount = 0;
  TabCounts _tabCounts = const TabCounts();


  // Analytics Cache
  OrderAnalytics? _cachedAnalytics;
  DateTime? _analyticsLastUpdated;

  // Pagination
  static const int _pageSize = 20;
  DocumentSnapshot? _lastDocument;
  bool _hasMoreData = true;
  bool _isLoadingMore = false;
  final List<OrderModel> _loadedOrders = [];

  // Real-time Subscription
  StreamSubscription<QuerySnapshot>? _ordersSubscription;
  
  // Cached Stream for performance (prevents excessive rebuilds)
  Stream<QuerySnapshot>? _cachedOrdersStream;
  List<DocumentSnapshot>? _cachedOrderDocs;
  String? _currentSellerId;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _tabController = TabController(length: 7, vsync: this);
    _tabController.addListener(_onTabChanged);
    _scrollController.addListener(_onScroll);
    _initializeData();
  }

  void _initAnimations() {
    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 25),
    )..repeat();

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _floatController.dispose();
    _searchController.dispose();
    _scrollController.dispose();
    _tabController.dispose();
    _ordersSubscription?.cancel();
    super.dispose();
  }

  void _initializeData() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId;
      if (sellerId != null) {
        _subscribeToOrders(sellerId);
      }
    });
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) {
      // All tabs now show orders inline, including RTO (index 6)
      setState(() {
        _statusFilterIndex = _tabController.index;
        _resetPagination();
      });
    }
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_isLoadingMore &&
        _hasMoreData) {
      _loadMoreOrders();
    }
  }

  void _resetPagination() {
    _lastDocument = null;
    _hasMoreData = true;
    _loadedOrders.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DATA LAYER
  // ═══════════════════════════════════════════════════════════════════════

  void _subscribeToOrders(String sellerId) {
    if (_currentSellerId == sellerId && _cachedOrdersStream != null) {
      return; // Already subscribed to this seller
    }
    
    _ordersSubscription?.cancel();
    _currentSellerId = sellerId;
    _cachedOrdersStream = _buildOrdersQuery(sellerId).snapshots();
    
    _ordersSubscription = _cachedOrdersStream!.listen(
      (snapshot) {
        // Always update cache when we have data
        if (snapshot.docs.isNotEmpty) {
          debugPrint('📦 Orders cached: ${snapshot.docs.length} orders for analytics');
          setState(() {
            _cachedOrderDocs = snapshot.docs;
          });
          _updateAnalyticsCache(snapshot.docs);
          _updateTabCounts(); // Update tab counts when data changes
        }
      },
      onError: (error) {
        debugPrint('❌ Orders subscription error: $error');
      },
    );
  }
  
  // Get cached stream for StreamBuilder (creates only once)
  Stream<QuerySnapshot> _getOrdersStream(String sellerId) {
    if (_cachedOrdersStream == null || _currentSellerId != sellerId) {
      _currentSellerId = sellerId;
      _cachedOrdersStream = _buildOrdersQuery(sellerId).snapshots();
    }
    return _cachedOrdersStream!;
  }

  Query<Map<String, dynamic>> _buildOrdersQuery(String sellerId) {
    Query<Map<String, dynamic>> query = _firestore
        .collection('orders')
        .where('sellerId', isEqualTo: sellerId);

    // Apply date filter
    final dateRange = _getDateRange();
    if (dateRange != null) {
      query = query
          .where('createdAt', isGreaterThanOrEqualTo: Timestamp.fromDate(dateRange.start))
          .where('createdAt', isLessThanOrEqualTo: Timestamp.fromDate(dateRange.end));
    }

    // Apply sorting
    query = query.orderBy(_sortOption.field, descending: _sortOption.descending);

    return query;
  }

  DateTimeRange? _getDateRange() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    switch (_dateFilter) {
      case DateRangeFilter.all:
        return null;
      case DateRangeFilter.today:
        return DateTimeRange(start: today, end: now);
      case DateRangeFilter.yesterday:
        final yesterday = today.subtract(const Duration(days: 1));
        return DateTimeRange(start: yesterday, end: today);
      case DateRangeFilter.thisWeek:
        final startOfWeek = today.subtract(Duration(days: today.weekday - 1));
        return DateTimeRange(start: startOfWeek, end: now);
      case DateRangeFilter.lastWeek:
        final startOfLastWeek =
            today.subtract(Duration(days: today.weekday + 6));
        final endOfLastWeek = today.subtract(Duration(days: today.weekday));
        return DateTimeRange(start: startOfLastWeek, end: endOfLastWeek);
      case DateRangeFilter.thisMonth:
        return DateTimeRange(
            start: DateTime(now.year, now.month, 1), end: now);
      case DateRangeFilter.lastMonth:
        final lastMonth = DateTime(now.year, now.month - 1, 1);
        final endOfLastMonth = DateTime(now.year, now.month, 0);
        return DateTimeRange(start: lastMonth, end: endOfLastMonth);
      case DateRangeFilter.last30Days:
        return DateTimeRange(
            start: now.subtract(const Duration(days: 30)), end: now);
      case DateRangeFilter.last90Days:
        return DateTimeRange(
            start: now.subtract(const Duration(days: 90)), end: now);
      case DateRangeFilter.custom:
        return _customDateRange;
    }
  }

  void _updateAnalyticsCache(List<DocumentSnapshot> docs) {
    final orders = docs
        .map((doc) => OrderModel.fromMap(
            doc.data() as Map<String, dynamic>, doc.id))
        .toList();
    _cachedAnalytics = OrderAnalytics.fromOrders(orders);
    _analyticsLastUpdated = DateTime.now();
  }

  Future<void> _loadMoreOrders() async {
    if (_isLoadingMore || !_hasMoreData) return;

    setState(() => _isLoadingMore = true);

    try {
      final sellerId =
          Provider.of<SellerProvider>(context, listen: false).sellerId;
      if (sellerId == null) return;

      var query = _buildOrdersQuery(sellerId).limit(_pageSize);

      if (_lastDocument != null) {
        query = query.startAfterDocument(_lastDocument!);
      }

      final snapshot = await query.get();

      if (snapshot.docs.isEmpty) {
        _hasMoreData = false;
      } else {
        _lastDocument = snapshot.docs.last;
        final newOrders = snapshot.docs
            .map((doc) => OrderModel.fromMap(
                doc.data(), doc.id))
            .toList();
        _loadedOrders.addAll(newOrders);
      }
    } catch (e) {
      debugPrint('❌ Error loading more orders: $e');
    } finally {
      setState(() => _isLoadingMore = false);
    }
  }

  Future<void> _refreshOrders() async {
    setState(() {
      _isRefreshing = true;
      _cachedOrderDocs = null; // Clear cache to force refresh of analytics too
    });
    _resetPagination();
    await Future.delayed(const Duration(milliseconds: 500));
    setState(() => _isRefreshing = false);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FILTERING LOGIC
  // ═══════════════════════════════════════════════════════════════════════

  List<DocumentSnapshot> _applyFilters(List<DocumentSnapshot> orders) {
    var filtered = orders;

    // Status filter (from tab)
    if (_statusFilterIndex > 0) {
      // Index 6 is RTO - includes all return and exchange statuses
      if (_statusFilterIndex == 6) {
        // RTO includes: all return flow + exchange flow statuses
        filtered = filtered.where((doc) {
          final data = doc.data() as Map<String, dynamic>;
          final status = (data['orderStatus'] ?? '').toString().toLowerCase();
          // Check for hasReturnRequest flag OR matching status
          final hasReturn = data['hasReturnRequest'] == true;
          final hasExchange = data['hasExchangeRequest'] == true;
          
          // Match any return/exchange status
          final returnStatuses = {
            'rto', 'return', 'returned', 'failed', 'refused', 'refunded',
            // New return flow statuses
            'return_requested', 'return_approved', 
            'pickup_pending', 'pickup_completed', 
            'refund_initiated',
            // New exchange flow statuses  
            'exchange_requested', 'exchange_approved',
            'exchange_shipped', 'exchanged',
          };
          
          return hasReturn || hasExchange ||
                 returnStatuses.any((s) => status.contains(s));
        }).toList();
      } else {
        final statusMap = {
          1: 'pending',
          2: 'processing',
          3: 'shipped',
          4: 'delivered',
          5: 'cancelled',
        };
        final targetStatus = statusMap[_statusFilterIndex];
        filtered = filtered.where((doc) {
          final data = doc.data() as Map<String, dynamic>;
          return (data['orderStatus'] ?? '').toString().toLowerCase() ==
              targetStatus;
        }).toList();
      }
    }

    // Search filter
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      filtered = filtered.where((doc) {
        final data = doc.data() as Map<String, dynamic>;
        final orderNumber =
            (data['orderNumber'] ?? '').toString().toLowerCase();
        final orderId = doc.id.toLowerCase();
        final customerName =
            (data['deliveryAddress']?['name'] ?? '').toString().toLowerCase();
        final phone = (data['deliveryAddress']?['phone'] ?? '').toString();
        final email = (data['deliveryAddress']?['email'] ?? '').toString().toLowerCase();

        return orderNumber.contains(query) ||
            orderId.contains(query) ||
            customerName.contains(query) ||
            phone.contains(query) ||
            email.contains(query);
      }).toList();
    }

    // Date filter
    if (_dateFilter != DateRangeFilter.all) {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      
      filtered = filtered.where((doc) {
        final data = doc.data() as Map<String, dynamic>;
        final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
        if (createdAt == null) return false;
        
        switch (_dateFilter) {
          case DateRangeFilter.all:
            return true;
          case DateRangeFilter.today:
            return createdAt.isAfter(today);
          case DateRangeFilter.yesterday:
            final yesterday = today.subtract(const Duration(days: 1));
            return createdAt.isAfter(yesterday) && createdAt.isBefore(today);
          case DateRangeFilter.thisWeek:
            final startOfWeek = today.subtract(Duration(days: today.weekday - 1));
            return createdAt.isAfter(startOfWeek);
          case DateRangeFilter.lastWeek:
            final startOfThisWeek = today.subtract(Duration(days: today.weekday - 1));
            final startOfLastWeek = startOfThisWeek.subtract(const Duration(days: 7));
            return createdAt.isAfter(startOfLastWeek) && createdAt.isBefore(startOfThisWeek);
          case DateRangeFilter.thisMonth:
            final startOfMonth = DateTime(now.year, now.month, 1);
            return createdAt.isAfter(startOfMonth);
          case DateRangeFilter.lastMonth:
            final startOfThisMonth = DateTime(now.year, now.month, 1);
            final startOfLastMonth = DateTime(now.year, now.month - 1, 1);
            return createdAt.isAfter(startOfLastMonth) && createdAt.isBefore(startOfThisMonth);
          case DateRangeFilter.last30Days:
            final thirtyDaysAgo = today.subtract(const Duration(days: 30));
            return createdAt.isAfter(thirtyDaysAgo);
          case DateRangeFilter.last90Days:
            final ninetyDaysAgo = today.subtract(const Duration(days: 90));
            return createdAt.isAfter(ninetyDaysAgo);
          case DateRangeFilter.custom:
            if (_customDateRange != null) {
              return createdAt.isAfter(_customDateRange!.start) && 
                     createdAt.isBefore(_customDateRange!.end.add(const Duration(days: 1)));
            }
            return true;
        }
      }).toList();
    }

    // Price range filter
    filtered = filtered.where((doc) {
      final data = doc.data() as Map<String, dynamic>;
      final amount = (data['total'] as num?)?.toDouble() ?? 0;
      return amount >= _priceRange.start && amount <= _priceRange.end;
    }).toList();

    // Urgent orders filter
    if (_showOnlyUrgent) {
      filtered = filtered.where((doc) {
        final data = doc.data() as Map<String, dynamic>;
        final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
        if (createdAt == null) return false;
        final hoursSinceCreated =
            DateTime.now().difference(createdAt).inHours;
        final status = (data['orderStatus'] ?? '').toString().toLowerCase();
        return status == 'pending' && hoursSinceCreated > 24;
      }).toList();
    }

    // Quick Filter Logic (from SmartOrderSearch chips)
    if (_activeQuickFilters.isNotEmpty) {
      filtered = filtered.where((doc) {
        final data = doc.data() as Map<String, dynamic>;
        final paymentMethod = (data['paymentMethod'] ?? '').toString().toLowerCase();
        final status = (data['orderStatus'] ?? '').toString().toLowerCase();
        final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        
        for (final filter in _activeQuickFilters) {
          switch (filter) {
            case QuickFilter.paid:
              if (paymentMethod != 'prepaid' && paymentMethod != 'online' && paymentMethod != 'card') {
                return false;
              }
              break;
            case QuickFilter.cod:
              if (paymentMethod != 'cod' && paymentMethod != 'cash') {
                return false;
              }
              break;
            case QuickFilter.shipToday:
              if (createdAt == null || createdAt.isBefore(today) || status != 'pending') {
                return false;
              }
              break;
            case QuickFilter.delayed:
              if (createdAt == null || status != 'pending') return false;
              if (now.difference(createdAt).inHours < 24) return false;
              break;
            case QuickFilter.rto:
              if (!['rto', 'returned', 'failed', 'return'].contains(status)) {
                return false;
              }
              break;
          }
        }
        return true;
      }).toList();
    }

    // Advanced Filter Logic (from AdvancedFilterSheet)
    if (_advancedFilters.hasActiveFilters) {
      filtered = filtered.where((doc) {
        final data = doc.data() as Map<String, dynamic>;
        final paymentMethod = (data['paymentMethod'] ?? '').toString().toLowerCase();
        final total = (data['total'] as num?)?.toDouble() ?? 0;
        final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
        final status = (data['orderStatus'] ?? '').toString().toLowerCase();
        final now = DateTime.now();

        // Payment type filter
        if (_advancedFilters.paymentTypes.isNotEmpty) {
          bool matchesPayment = false;
          for (final type in _advancedFilters.paymentTypes) {
            if (type == 'cod' && (paymentMethod == 'cod' || paymentMethod == 'cash')) {
              matchesPayment = true;
            } else if (type == 'prepaid' && (paymentMethod == 'prepaid' || paymentMethod == 'online' || paymentMethod == 'card')) {
              matchesPayment = true;
            }
          }
          if (!matchesPayment) return false;
        }

        // High value only
        if (_advancedFilters.showHighValueOnly && total < 5000) {
          return false;
        }

        // Overdue only
        if (_advancedFilters.showOverdueOnly) {
          if (status != 'pending' || createdAt == null || now.difference(createdAt).inHours < 24) {
            return false;
          }
        }

        // Price range
        if (total < _advancedFilters.priceRange.start || total > _advancedFilters.priceRange.end) {
          return false;
        }

        return true;
      }).toList();
    }

    // Apply sorting
    filtered.sort((a, b) {
      final dataA = a.data() as Map<String, dynamic>;
      final dataB = b.data() as Map<String, dynamic>;
      
      switch (_sortOption) {
        case OrderSortOption.dateNewest:
          final dateA = (dataA['createdAt'] as Timestamp?)?.toDate() ?? DateTime(2000);
          final dateB = (dataB['createdAt'] as Timestamp?)?.toDate() ?? DateTime(2000);
          return dateB.compareTo(dateA);
        case OrderSortOption.dateOldest:
          final dateA = (dataA['createdAt'] as Timestamp?)?.toDate() ?? DateTime(2000);
          final dateB = (dataB['createdAt'] as Timestamp?)?.toDate() ?? DateTime(2000);
          return dateA.compareTo(dateB);
        case OrderSortOption.amountHighest:
          final amountA = (dataA['total'] as num?)?.toDouble() ?? 0;
          final amountB = (dataB['total'] as num?)?.toDouble() ?? 0;
          return amountB.compareTo(amountA);
        case OrderSortOption.amountLowest:
          final amountA = (dataA['total'] as num?)?.toDouble() ?? 0;
          final amountB = (dataB['total'] as num?)?.toDouble() ?? 0;
          return amountA.compareTo(amountB);
        case OrderSortOption.statusAsc:
          final statusA = (dataA['orderStatus'] ?? '').toString();
          final statusB = (dataB['orderStatus'] ?? '').toString();
          return statusA.compareTo(statusB);
        case OrderSortOption.statusDesc:
          final statusA = (dataA['orderStatus'] ?? '').toString();
          final statusB = (dataB['orderStatus'] ?? '').toString();
          return statusB.compareTo(statusA);
      }
    });

    return filtered;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BULK ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  Future<void> _executeBulkAction(BulkAction action) async {
    if (_selectedOrderIds.isEmpty) {
      _showSnackBar('No orders selected', isError: true);
      return;
    }

    switch (action) {
      case BulkAction.markProcessing:
        await _updateOrdersStatus('processing');
        break;
      case BulkAction.markShipped:
        await _updateOrdersStatus('shipped');
        break;
      case BulkAction.markDelivered:
        await _updateOrdersStatus('delivered');
        break;
      case BulkAction.printLabels:
        await _printShippingLabels();
        break;
      case BulkAction.exportSelected:
        await _exportSelectedOrders();
        break;
      case BulkAction.cancelOrders:
        await _cancelSelectedOrders();
        break;
    }
  }

  Future<void> _updateOrdersStatus(String newStatus) async {
    final confirmed = await _showConfirmDialog(
      'Update Status',
      'Update ${_selectedOrderIds.length} order(s) to "$newStatus"?',
    );

    if (!confirmed) return;

    try {
      final batch = _firestore.batch();
      for (final orderId in _selectedOrderIds) {
        batch.update(
          _firestore.collection('orders').doc(orderId),
          {
            'orderStatus': newStatus,
            'updatedAt': FieldValue.serverTimestamp(),
            'statusHistory': FieldValue.arrayUnion([
              {
                'status': newStatus,
                'timestamp': Timestamp.now(),
                'updatedBy': 'seller',
              }
            ]),
          },
        );
      }
      await batch.commit();

      _showSnackBar('${_selectedOrderIds.length} orders updated successfully');
      _clearSelection();
    } catch (e) {
      _showSnackBar('Failed to update orders: $e', isError: true);
    }
  }

  Future<void> _cancelSelectedOrders() async {
    final confirmed = await _showConfirmDialog(
      'Cancel Orders',
      'Are you sure you want to cancel ${_selectedOrderIds.length} order(s)? This action cannot be undone.',
      isDangerous: true,
    );

    if (!confirmed) return;

    try {
      final batch = _firestore.batch();
      for (final orderId in _selectedOrderIds) {
        batch.update(
          _firestore.collection('orders').doc(orderId),
          {
            'orderStatus': 'cancelled',
            'cancelledAt': FieldValue.serverTimestamp(),
            'cancelReason': 'Cancelled by seller',
            'updatedAt': FieldValue.serverTimestamp(),
          },
        );
      }
      await batch.commit();

      _showSnackBar('${_selectedOrderIds.length} orders cancelled');
      _clearSelection();
    } catch (e) {
      _showSnackBar('Failed to cancel orders: $e', isError: true);
    }
  }

  Future<void> _printShippingLabels() async {
    _showSnackBar('Generating shipping labels for ${_selectedOrderIds.length} orders...');
    // Implement actual label generation logic
    await Future.delayed(const Duration(seconds: 2));
    _showSnackBar('Shipping labels ready for printing');
  }

  Future<void> _exportSelectedOrders() async {
    await _exportOrders(selectedOnly: true);
  }

  void _clearSelection() {
    setState(() {
      _selectedOrderIds.clear();
      _isSelectionMode = false;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EXPORT FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════════════════

  Future<void> _exportOrders({bool selectedOnly = false}) async {
    setState(() => _isExporting = true);

    try {
      final sellerId =
          Provider.of<SellerProvider>(context, listen: false).sellerId;
      if (sellerId == null) return;

      // Get orders to export
      final snapshot = await _buildOrdersQuery(sellerId).get();
      var orders = snapshot.docs;

      if (selectedOnly) {
        orders = orders
            .where((doc) => _selectedOrderIds.contains(doc.id))
            .toList();
      }

      // Generate CSV
      final csvContent = _generateCSV(orders);

      // Save to file
      final directory = await getApplicationDocumentsDirectory();
      final timestamp = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
      final file = File('${directory.path}/orders_export_$timestamp.csv');
      await file.writeAsString(csvContent);

      // Share file
      await Share.shareXFiles(
        [XFile(file.path)],
        subject: 'Orders Export - $timestamp',
      );

      _showSnackBar('Exported ${orders.length} orders successfully');
    } catch (e) {
      _showSnackBar('Export failed: $e', isError: true);
    } finally {
      setState(() => _isExporting = false);
    }
  }

  String _generateCSV(List<DocumentSnapshot> orders) {
    final buffer = StringBuffer();

    // Headers
    buffer.writeln(
      'Order ID,Order Number,Customer Name,Phone,Email,Status,Total Amount,Items,Created At,Updated At',
    );

    // Data rows
    for (final doc in orders) {
      final data = doc.data() as Map<String, dynamic>;
      final address = data['deliveryAddress'] as Map<String, dynamic>? ?? {};
      final items = data['items'] as List? ?? [];
      final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
      final updatedAt = (data['updatedAt'] as Timestamp?)?.toDate();

      buffer.writeln([
        doc.id,
        data['orderNumber'] ?? '',
        '"${address['name'] ?? ''}"',
        address['phone'] ?? '',
        address['email'] ?? '',
        data['orderStatus'] ?? '',
        data['total'] ?? 0,
        items.length,
        createdAt?.toIso8601String() ?? '',
        updatedAt?.toIso8601String() ?? '',
      ].join(','));
    }

    return buffer.toString();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.error : AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  Future<bool> _showConfirmDialog(
    String title,
    String message, {
    bool isDangerous = false,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) {
        final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
        return AlertDialog(
          backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(
            title,
            style: TextStyle(
              color: isDangerous
                  ? AppColors.error
                  : (isDark ? AppColors.textLight : AppColors.textPrimary),
              fontWeight: FontWeight.bold,
            ),
          ),
          content: Text(
            message,
            style: TextStyle(
              color: isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(
                'Cancel',
                style: TextStyle(
                  color: isDark
                      ? AppColors.textLightSecondary
                      : AppColors.textSecondary,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    isDangerous ? AppColors.error : AppColors.primary,
                foregroundColor: AppColors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Confirm'),
            ),
          ],
        );
      },
    );
    return result ?? false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD METHOD
  // ═══════════════════════════════════════════════════════════════════════

  @override
    // ═══════════════════════════════════════════════════════════════════════
  // BUILD UI
  // ═══════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final theme = Theme.of(context);
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width > 900;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      body: Stack(
        children: [
          // 1. Animated Background
          _buildAnimatedBackground(isDark),
          
          // 2. Floating Orbs (Desktop decoration)
          if (isDesktop) ..._buildFloatingOrbs(isDark, size),

          // 3. Main Content with Professional Header
          Column(
            children: [
              // Professional Header (replaces AppBar)
              ProfessionalOrderHeader(
                isDark: isDark,
                isLiveRefreshEnabled: _isLiveRefreshEnabled,
                selectedDateRange: _selectedDateRange,
                alertCount: _alertCount,
                pendingCount: _tabCounts.pending,
                processingCount: _tabCounts.processing,
                shippedCount: _tabCounts.shipped,
                rtoCount: _tabCounts.rto,
                onRefresh: _refreshOrders,
                onToggleLiveRefresh: () => setState(() => _isLiveRefreshEnabled = !_isLiveRefreshEnabled),
                onDateRangeChanged: (range) {
                  setState(() => _selectedDateRange = range);
                  _refreshOrders();
                },
                onAlertsTapped: () => _showAlertsSheet(context, isDark),
              ),
              
              // Body Content
              Expanded(
                child: SafeArea(
                  top: false,
                  child: NestedScrollView(
                    headerSliverBuilder: (context, innerBoxIsScrolled) {
                      return [
                        SliverToBoxAdapter(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Smart Search Bar (with padding)
                              Padding(
                                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                                child: SmartOrderSearch(
                                  isDark: isDark,
                                  sellerId: Provider.of<SellerProvider>(context, listen: false).sellerId,
                                  activeFilters: _activeQuickFilters,
                                  onSearchChanged: (val) => setState(() => _searchQuery = val),
                                  onSearchSubmitted: (val) {
                                    setState(() => _searchQuery = val);
                                    _refreshOrders();
                                  },
                                  onFilterToggled: _toggleQuickFilter,
                                  onAdvancedFilterTap: _showAdvancedFilters,
                                  // Sort dropdown props
                                  currentSortLabel: _sortOption.label,
                                  onSortChanged: (index) {
                                    setState(() => _sortOption = OrderSortOption.values[index]);
                                    _refreshOrders();
                                  },
                                  // Advanced filter props
                                  advancedFilterCount: _advancedFilters.activeFilterCount,
                                  onClearAdvancedFilters: () {
                                    setState(() => _advancedFilters = OrderFilters.empty());
                                    _refreshOrders();
                                  },
                                ),
                              ),
                              
                              // Action Tabs (edge-to-edge, no horizontal padding)
                              OrderStatusTabBar(
                                tabController: _tabController,
                                isDark: isDark,
                                counts: _tabCounts,
                                overdueCount: _overdueCount,
                              ),
                              const SizedBox(height: 8),
                            ],
                          ),
                        ),
                      ];
                    },
                    body: CustomScrollView(
                      slivers: [
                        _buildOrdersList(isDark, isDesktop),
                        // Add bottom padding for bulk action bar
                        if (_isSelectionMode)
                          const SliverToBoxAdapter(
                            child: SizedBox(height: 100),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          
          // 4. Bulk Action Bar (floating at bottom when in selection mode)
          if (_isSelectionMode && _selectedOrderIds.isNotEmpty)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: BulkActionBar(
                selectedCount: _selectedOrderIds.length,
                onBulkAccept: () => _executeBulkAction(BulkAction.markProcessing),
                onBulkPack: () => _showSnackBar('Pack action coming soon'),
                onBulkShip: () => _executeBulkAction(BulkAction.markShipped),
                onBulkPrint: () => _executeBulkAction(BulkAction.printLabels),
                onBulkCancel: () => _executeBulkAction(BulkAction.cancelOrders),
                onClearSelection: _clearSelection,
                onSelectAll: _selectAllVisible,
                isDark: isDark,
              ),
            ),
        ],
      ),
      // FAB removed - card density toggle no longer needed
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // THEME WIDGETS
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark 
                  ? [const Color(0xFF0F2027), const Color(0xFF203A43), const Color(0xFF2C5364)]
                  : [const Color(0xFFF0F4F8), const Color(0xFFFFFFFF), const Color(0xFFE6E9F0)],
              stops: const [0.0, 0.5, 1.0],
              transform: GradientRotation(_bgAnimController.value * 2 * math.pi),
            ),
          ),
          child: CustomPaint(
            size: Size.infinite,
            painter: _GridPatternPainter(isDark: isDark, opacity: isDark ? 0.05 : 0.03),
          ),
        );
      },
    );
  }

  List<Widget> _buildFloatingOrbs(bool isDark, Size size) {
    return [
      Positioned(
        top: size.height * 0.1,
        right: size.width * 0.1,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) => Transform.translate(
            offset: Offset(0, _floatController.value * 20),
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: 0.15),
                    Colors.transparent
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPONENTS
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildTabs(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.black26 : Colors.white.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.white.withValues(alpha: 0.5)),
      ),
      padding: const EdgeInsets.all(4),
      child: TabBar(
        controller: _tabController,
        isScrollable: true,
        dividerColor: Colors.transparent,
        labelColor: isDark ? AppColors.primaryLight : AppColors.primary,
        unselectedLabelColor: isDark ? Colors.grey[400] : Colors.grey[600],
        indicator: BoxDecoration(
          color: isDark ? AppColors.primary.withValues(alpha: 0.2) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: isDark ? [] : [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        tabs: [
          const Tab(text: 'All Orders'),
          const Tab(text: 'Pending'),
          const Tab(text: 'Processing'),
          const Tab(text: 'Shipped'),
          const Tab(text: 'Delivered'),
          const Tab(text: 'Cancelled'),
          // Returns Tab with Badge
          Tab(
            child: _buildReturnsTabWithBadge(isDark),
          ),
        ],
      ),
    );
  }

  Widget _buildReturnsTabWithBadge(bool isDark) {
    final sellerProvider = Provider.of<SellerProvider>(context, listen: false);
    final sellerId = sellerProvider.currentSeller?.sellerId;

    if (sellerId == null) {
      return const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.assignment_return_rounded, size: 16),
          SizedBox(width: 4),
          Text('Returns'),
        ],
      );
    }

    return FutureBuilder<Map<String, dynamic>>(
      future: ReturnService().getSellerReturnStats(sellerId),
      builder: (context, snapshot) {
        final pending = snapshot.data?['pending'] ?? 0;

        // RTO tab content - no redirect, let TabController handle it
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.assignment_return_rounded, size: 16),
            const SizedBox(width: 4),
            const Text('RTO'),
            if (pending > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.red,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$pending',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _buildAnalyticsSummary(OrderAnalytics analytics, bool isDark, bool isDesktop) {
    return SizedBox(
      height: 140, // Height for the cards
      child: ListView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        children: [
          _buildStatCard('Total Revenue', '₹${analytics.totalRevenue.toInt()}', Icons.attach_money_rounded, Colors.greenAccent, isDark),
          _buildStatCard('Total Orders', '${analytics.totalOrders}', Icons.shopping_bag_rounded, Colors.blueAccent, isDark),
          _buildStatCard('Pending', '${analytics.pendingCount}', Icons.hourglass_top_rounded, Colors.orangeAccent, isDark),
          _buildStatCard('Fulfilled', '${analytics.fulfillmentRate.toStringAsFixed(1)}%', Icons.check_circle_rounded, Colors.purpleAccent, isDark),
        ],
      ),
    ).animate().fadeIn().slideX();
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color, bool isDark) {
    return Container(
      width: 160,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.white),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSearchAndFilters(bool isDark) {
    return Row(
      children: [
        Expanded(
          child: Container(
            height: 50,
            decoration: BoxDecoration(
              color: isDark ? Colors.black26 : Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2)),
            ),
            child: TextField(
              controller: _searchController,
              style: TextStyle(color: isDark ? Colors.white : Colors.black),
              decoration: InputDecoration(
                hintText: 'Search orders...',
                hintStyle: TextStyle(color: isDark ? Colors.grey[500] : Colors.grey[400]),
                prefixIcon: Icon(Icons.search, color: isDark ? Colors.grey[500] : Colors.grey[400]),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onChanged: (val) {
                setState(() => _searchQuery = val);
              },
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Sort Button
        Container(
          height: 50,
          width: 50,
          decoration: BoxDecoration(
            color: isDark ? Colors.black26 : Colors.white.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2)),
          ),
          child: PopupMenuButton<OrderSortOption>(
            icon: Icon(Icons.sort_rounded, color: isDark ? Colors.white : Colors.grey[800]),
            onSelected: (val) => setState(() => _sortOption = val),
            itemBuilder: (context) => OrderSortOption.values.map((opt) => PopupMenuItem(
              value: opt,
              child: Text(opt.label),
            )).toList(),
          ),
        ),
        const SizedBox(width: 8),
        // Advanced Filter Button
        Stack(
          children: [
            Container(
              height: 50,
              width: 50,
              decoration: BoxDecoration(
                color: _advancedFilters.hasActiveFilters
                    ? AppColors.primary.withValues(alpha: 0.1)
                    : (isDark ? Colors.black26 : Colors.white.withValues(alpha: 0.8)),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _advancedFilters.hasActiveFilters
                      ? AppColors.primary
                      : (isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2)),
                ),
              ),
              child: IconButton(
                icon: Icon(
                  Icons.filter_list_rounded,
                  color: _advancedFilters.hasActiveFilters
                      ? AppColors.primary
                      : (isDark ? Colors.white : Colors.grey[800]),
                ),
                onPressed: _showAdvancedFilters,
                tooltip: 'Advanced Filters',
              ),
            ),
            if (_advancedFilters.hasActiveFilters)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    '${_advancedFilters.activeFilterCount}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }


  Widget _buildOrdersList(bool isDark, bool isDesktop) {
    final sellerId = Provider.of<SellerProvider>(context).sellerId;
    if (sellerId == null) return const SliverToBoxAdapter(child: SizedBox());

    return StreamBuilder<QuerySnapshot>(
      stream: _getOrdersStream(sellerId),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return SliverFillRemaining(
            child: Center(
              child: Text('Error: ${snapshot.error}', style: const TextStyle(color: Colors.redAccent)),
            ),
          );
        }

        bool isLoading = snapshot.connectionState == ConnectionState.waiting && _cachedOrderDocs == null;
        if (isLoading) {
           return SliverFillRemaining(
            child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
          );
        }

        // Use cached docs if stream is waiting (to prevent flicker)
        var docs = snapshot.hasData ? snapshot.data!.docs : (_cachedOrderDocs ?? []);
        var filteredDocs = _applyFilters(docs);

        if (filteredDocs.isEmpty) {
          return SliverFillRemaining(
            child: _buildEmptyState(isDark),
          );
        }

        return SliverPadding(
          padding: EdgeInsets.all(isDesktop ? 24 : 16),
          sliver: isDesktop ? _buildGridView(filteredDocs, isDark) : _buildListView(filteredDocs, isDark),
        );
      },
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.inbox_outlined, size: 64, color: isDark ? Colors.white10 : Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            'No orders found',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white60 : Colors.grey[600],
            ),
          ),
          if (_searchQuery.isNotEmpty || _statusFilterIndex > 0)
            TextButton(
              onPressed: () {
                setState(() {
                  _searchQuery = '';
                  _searchController.clear();
                  _tabController.animateTo(0);
                });
              },
              child: const Text('Clear filters'),
            ),
        ],
      ).animate().fadeIn().scale(),
    );
  }

  Widget _buildListView(List<DocumentSnapshot> docs, bool isDark) {
    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final doc = docs[index];
          final order = OrderModel.fromMap(doc.data() as Map<String, dynamic>, doc.id);
          final isSelected = _selectedOrderIds.contains(order.id);

          return EnhancedOrderCard(
            order: order,
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => SellerOrderDetailsScreen(orderId: order.id)),
            ),
            isSelected: isSelected,
            isSelectionMode: _isSelectionMode,
            onToggleSelect: () => _toggleSelection(order.id),
            density: _cardDensity,
            onStatusChanged: _refreshOrders,
          ).animate().fadeIn(delay: (index * 40).ms).slideX(begin: 0.05);
        },
        childCount: docs.length,
      ),
    );
  }


  Widget _buildGridView(List<DocumentSnapshot> docs, bool isDark) {
    return SliverGrid(
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 420,
        mainAxisSpacing: 16,
        crossAxisSpacing: 16,
        childAspectRatio: 1.4,
      ),
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final doc = docs[index];
          final order = OrderModel.fromMap(doc.data() as Map<String, dynamic>, doc.id);
          final isSelected = _selectedOrderIds.contains(order.id);

          return EnhancedOrderCard(
            order: order,
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => SellerOrderDetailsScreen(orderId: order.id)),
            ),
            isSelected: isSelected,
            isSelectionMode: _isSelectionMode,
            onToggleSelect: () => _toggleSelection(order.id),
            density: CardDensity.compact, // Use compact for grid
            onStatusChanged: _refreshOrders,
          ).animate().fadeIn(delay: (index * 40).ms).scale(begin: const Offset(0.95, 0.95));
        },
        childCount: docs.length,
      ),
    );
  }


  void _toggleSelection(String orderId) {
    setState(() {
      if (_selectedOrderIds.contains(orderId)) {
        _selectedOrderIds.remove(orderId);
        if (_selectedOrderIds.isEmpty) _isSelectionMode = false;
      } else {
        _selectedOrderIds.add(orderId);
        _isSelectionMode = true;
      }
    });
  }

  void _selectAllVisible() {
    if (_cachedOrderDocs == null) return;
    setState(() {
      for (final doc in _cachedOrderDocs!) {
        _selectedOrderIds.add(doc.id);
      }
      _isSelectionMode = true;
    });
  }

  // _buildDensityToggleFab removed - card density toggle no longer needed


  Future<void> _showAdvancedFilters() async {
    final result = await AdvancedFilterSheet.show(
      context,
      initialFilters: _advancedFilters,
    );
    
    if (result != null) {
      setState(() {
        _advancedFilters = result;
      });
      _refreshOrders();
    }
  }

  void _toggleQuickFilter(QuickFilter filter) {
    setState(() {
      if (_activeQuickFilters.contains(filter)) {
        _activeQuickFilters.remove(filter);
      } else {
        _activeQuickFilters.add(filter);
      }
    });
    _refreshOrders();
  }

  void _showSortOptions(BuildContext context, bool isDark) {
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1A1A2E) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sort Orders',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 16),
            ...OrderSortOption.values.map((opt) {
              final isSelected = _sortOption == opt;
              return ListTile(
                leading: Icon(
                  isSelected ? Icons.check_circle : Icons.circle_outlined,
                  color: isSelected ? AppColors.primary : Colors.grey,
                ),
                title: Text(
                  opt.label,
                  style: TextStyle(
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                onTap: () {
                  setState(() => _sortOption = opt);
                  Navigator.pop(context);
                  _refreshOrders();
                },
              );
            }),
          ],
        ),
      ),
    );
  }

  void _showAlertsSheet(BuildContext context, bool isDark) {
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1A1A2E) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.notifications_active_rounded, color: Colors.red[400]),
                const SizedBox(width: 12),
                Text(
                  'Order Alerts',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_overdueCount > 0)
              _buildAlertItem(
                Icons.schedule_rounded,
                'Overdue Orders',
                '$_overdueCount orders pending > 24 hours',
                Colors.red,
                () {
                  Navigator.pop(context);
                  _tabController.animateTo(1); // Go to pending tab
                },
              ),
            if (_tabCounts.rto > 0)
              _buildAlertItem(
                Icons.undo_rounded,
                'RTO Orders',
                '${_tabCounts.rto} orders returned/failed',
                Colors.pink,
                () {
                  Navigator.pop(context);
                  _tabController.animateTo(6); // Go to RTO tab
                },
              ),
            if (_overdueCount == 0 && _tabCounts.rto == 0)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(Icons.check_circle_rounded, size: 48, color: Colors.green[400]),
                      const SizedBox(height: 12),
                      Text(
                        'No alerts!',
                        style: TextStyle(
                          fontSize: 16,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAlertItem(IconData icon, String title, String subtitle, Color color, VoidCallback onTap) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: color, size: 20),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    );
  }

  void _updateTabCounts() async {
    if (_cachedOrderDocs == null) return;

    int all = 0, pending = 0, processing = 0, shipped = 0, delivered = 0, cancelled = 0;
    int overdue = 0;
    final now = DateTime.now();

    for (final doc in _cachedOrderDocs!) {
      all++;
      final data = doc.data() as Map<String, dynamic>;
      final status = (data['orderStatus'] as String? ?? '').toLowerCase();
      final createdAt = (data['createdAt'] as Timestamp?)?.toDate();

      switch (status) {
        case 'pending':
          pending++;
          if (createdAt != null && now.difference(createdAt).inHours > 24) {
            overdue++;
          }
          break;
        case 'processing':
          processing++;
          break;
        case 'shipped':
          shipped++;
          break;
        case 'delivered':
          delivered++;
          break;
        case 'cancelled':
          cancelled++;
          break;
      }
    }

    // Fetch RTO count from ReturnService (returns are in separate collection)
    int rto = 0;
    try {
      final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId;
      if (sellerId != null) {
        final stats = await _returnService.getSellerReturnStats(sellerId);
        rto = (stats['pending'] ?? 0) + (stats['approved'] ?? 0);
      }
    } catch (e) {
      // Ignore errors, use 0
    }

    int alerts = overdue + rto;

    if (mounted) {
      setState(() {
        _tabCounts = TabCounts(
          all: all,
          pending: pending,
          processing: processing,
          shipped: shipped,
          delivered: delivered,
          cancelled: cancelled,
          rto: rto,
        );
        _overdueCount = overdue;
        _alertCount = alerts;
      });
    }
  }
}



// 🖌️ GRID PATTERN PAINTER (Matched to Wallet Screen)
class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;

  _GridPatternPainter({this.isDark = false, this.opacity = 0.05});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.grey).withValues(alpha: opacity)
      ..strokeWidth = 1;

    const spacing = 40.0;
    
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
