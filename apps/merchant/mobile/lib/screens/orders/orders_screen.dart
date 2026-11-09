import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../app/routes.dart';
import '../../app/store_context.dart';
import '../../services/api_client.dart';
import '../../services/order_service.dart';
import '../../services/product_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/accessible_tap_region.dart';
import '../../widgets/shared/merchant_export_share.dart';
import '../../widgets/shared/merchant_store_view.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({
    super.key,
    this.onPageActionsChanged,
    this.isSurfaceActive,
  });
  final void Function(Object owner, bool visible)? onPageActionsChanged;
  final bool Function()? isSurfaceActive;
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  bool _loading = true;
  String? _error;
  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare() async {
    final stores = context.read<StoreContext>();
    final epoch = stores.requestContextVersion;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await stores.ensureSelectedStore();
    } catch (_) {
      if (mounted && stores.requestContextVersion == epoch) {
        setState(
          () => _error =
              'Store access could not be confirmed. Retry loading orders.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>(), id = stores.selectedStoreId;
    if (_loading || _error != null || id == null) {
      return Scaffold(
        appBar: CustomAppBar.responsive(context: context, title: 'Orders'),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              if (_loading) const LoadingIndicator(),
              Text(
                _loading
                    ? 'Loading store access…'
                    : _error ??
                          'Choose a store from the dashboard to view orders.',
              ),
              if (_error != null)
                TextButton(onPressed: _prepare, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    return _OrdersWorkspace(
      key: ValueKey(stores.requestContextKey),
      storeId: id,
      onPageActionsChanged: widget.onPageActionsChanged,
      isSurfaceActive: widget.isSurfaceActive,
    );
  }
}

class _OrdersWorkspace extends StatefulWidget {
  const _OrdersWorkspace({
    super.key,
    required this.storeId,
    this.onPageActionsChanged,
    this.isSurfaceActive,
  });
  final String storeId;
  final void Function(Object owner, bool visible)? onPageActionsChanged;
  final bool Function()? isSurfaceActive;
  @override
  State<_OrdersWorkspace> createState() => _OrdersWorkspaceState();
}

class _OrdersWorkspaceState extends State<_OrdersWorkspace> {
  late final MerchantStoreView _view;
  late final OrderService _orderService;
  List<OrderContract> _orders = [];
  bool _isLoading = true, _busy = false, _fresh = false, _loaded = false;
  bool _denied = false, _needsReadback = false, _publishedActions = false;
  String? _error, _notice, _progress;
  Map<String, dynamic>? _exportJob;
  int _page = 1;
  String? _cursor, _nextCursor;
  final _previousCursors = <String?>[];
  bool _reading = false;
  String _searchQuery = '',
      _statusFilter = 'all',
      _sortBy = 'newest',
      _dateFilter = 'all';
  bool _isSelectionMode = false;
  Set<String> _selectedOrderIds = {};
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  AppThemeColors get colors => AppThemeColors.of(context);
  bool get _current => mounted && merchantStoreViewCurrent(context, _view);
  bool get _active =>
      _current &&
      (widget.isSurfaceActive?.call() ?? true) &&
      (ModalRoute.of(context)?.isCurrent ?? true);
  bool get _ready =>
      _active && !_isLoading && !_busy && !_denied && !_needsReadback && _fresh;
  @override
  void initState() {
    super.initState();
    _view = (
      key: context.read<StoreContext>().requestContextKey,
      storeId: widget.storeId,
    );
    _orderService = context.read<OrderService>();
    // The store-keyed workspace can mount while an existing provider rebuilds.
    // Its visible shell owns initial pending UI; notify that provider afterward.
    Future<void>.microtask(() {
      if (_current) _loadOrders();
    });
  }

  void _publishActions() {
    final visible = _isSelectionMode || _busy || _exportJob != null;
    if (_publishedActions == visible) return;
    _publishedActions = visible;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onPageActionsChanged?.call(this, visible);
    });
  }

  @override
  void dispose() {
    final notify = widget.onPageActionsChanged;
    if (_publishedActions)
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => notify?.call(this, false),
      );
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    if (!_current || _busy || _reading) return;
    _reading = true;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final orders = await _orderService.fetchOrders(
        widget.storeId,
        page: _page,
        cursor: _cursor,
      );
      if (!_current) return;
      setState(() {
        _orders = orders;
        _loaded = true;
        _fresh = _orderService.hasFreshOrders;
        _nextCursor = _orderService.ordersNextCursor;
        if (_fresh) {
          _needsReadback = false;
          _denied = false;
        }
        _selectedOrderIds.removeWhere((id) => !orders.any((o) => o.id == id));
      });
    } catch (e) {
      if (!_current) return;
      setState(() {
        _fresh = false;
        _denied =
            e is ApiException &&
            (const [401, 403, 404].contains(e.statusCode) ||
                e.code == 'SESSION_CONTEXT_CHANGED');
        if (_denied || e is FormatException) {
          _orders = [];
          _selectedOrderIds.clear();
        }
        _error = _denied
            ? 'Order access could not be confirmed. Reopen orders from the intended store.'
            : 'Orders could not be refreshed. Saved results, if shown, are unconfirmed.';
      });
    } finally {
      _reading = false;
      if (_current) setState(() => _isLoading = false);
    }
  }

  void _changePage(bool next) {
    if (!_active || _busy || _isLoading || _denied || !_fresh) return;
    if (next && (_nextCursor == null || _nextCursor!.isEmpty)) return;
    if (!next && _previousCursors.isEmpty) return;
    setState(() {
      if (next) {
        _previousCursors.add(_cursor);
        _cursor = _nextCursor;
        _page++;
      } else {
        _cursor = _previousCursors.removeLast();
        _page--;
      }
      _orders = [];
      _fresh = false;
      _loaded = false;
      _nextCursor = null;
      _selectedOrderIds.clear();
    });
    _loadOrders();
  }

  List<OrderContract> get _filteredOrders {
    var orders = List<OrderContract>.from(_orders);

    // Apply status filter
    if (_statusFilter != 'all') {
      orders = orders.where((o) => _orderStatus(o) == _statusFilter).toList();
    }

    // Apply date filter
    final now = DateTime.now();
    if (_dateFilter == 'today') {
      orders = orders
          .where(
            (o) =>
                _orderCreatedAt(o)?.day == now.day &&
                _orderCreatedAt(o)?.month == now.month &&
                _orderCreatedAt(o)?.year == now.year,
          )
          .toList();
    } else if (_dateFilter == 'week') {
      final weekAgo = now.subtract(const Duration(days: 7));
      orders = orders
          .where((o) => (_orderCreatedAt(o)?.isAfter(weekAgo) ?? false))
          .toList();
    } else if (_dateFilter == 'month') {
      final monthAgo = now.subtract(const Duration(days: 30));
      orders = orders
          .where((o) => (_orderCreatedAt(o)?.isAfter(monthAgo) ?? false))
          .toList();
    }

    // Apply search
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      orders = orders
          .where(
            (o) =>
                o.orderNumber.toLowerCase().contains(query) ||
                _orderCustomerName(o).toLowerCase().contains(query) ||
                _orderCustomerPhone(o).toLowerCase().contains(query) ||
                (o.customerEmail ?? '').toLowerCase().contains(query),
          )
          .toList();
    }

    // Apply sorting
    orders.sort((a, b) {
      switch (_sortBy) {
        case 'newest':
          return _compareDatesDesc(_orderCreatedAt(a), _orderCreatedAt(b));
        case 'oldest':
          return _compareDatesAsc(_orderCreatedAt(a), _orderCreatedAt(b));
        case 'amount_high':
          return _orderTotal(b).compareTo(_orderTotal(a));
        case 'amount_low':
          return _orderTotal(a).compareTo(_orderTotal(b));
        default:
          return 0;
      }
    });

    return orders;
  }

  int get _pendingCount => _countStatus('pending');
  int get _confirmedCount => _countStatus('confirmed');
  int get _shippedCount => _countStatus('shipped');
  int get _deliveredCount => _countStatus('delivered');

  double get _totalRevenue => _orders
      .where((o) => _orderStatus(o) == 'delivered')
      .fold(0.0, (sum, o) => sum + _orderTotal(o));

  int _countStatus(String status) =>
      _orders.where((o) => _orderStatus(o) == status).length;

  void _toggleSelectionMode() {
    if (!_ready) return;
    HapticFeedback.mediumImpact();
    setState(() {
      _isSelectionMode = !_isSelectionMode;
      if (!_isSelectionMode) _selectedOrderIds.clear();
    });
  }

  void _toggleOrderSelection(String orderId) {
    if (!_ready) return;
    HapticFeedback.selectionClick();
    setState(() {
      if (!_selectedOrderIds.add(orderId)) _selectedOrderIds.remove(orderId);
    });
  }

  void _selectAll() {
    if (!_ready) return;
    setState(
      () => _selectedOrderIds = _filteredOrders.map((o) => o.id).toSet(),
    );
  }

  Future<void> _mutation(Future<void> Function() command) async {
    if (!_ready) return;
    setState(() {
      _busy = true;
      _progress = 'Submitting order change…';
      _error = null;
      _notice = null;
    });
    try {
      await command();
    } catch (_) {
      if (_current)
        setState(() {
          _needsReadback = true;
          _error =
              'The outcome could not be confirmed. Refresh orders before making another change. Closing this screen does not cancel a submitted request.';
        });
    } finally {
      if (_current)
        setState(() {
          _busy = false;
          _progress = null;
        });
    }
    if (_current) await _loadOrders();
  }

  Future<void> _bulkUpdateStatus(String newStatus) async {
    if (!_ready || _selectedOrderIds.isEmpty) return;
    final selected = Set<String>.of(_selectedOrderIds);
    final confirm = await showLetbuyyConfirmation(
      context: context,
      title: 'Update ${selected.length} orders?',
      message:
          'Mark these selected orders as ${_statusLabel(newStatus)}? Each order is authorized by the server. A failed request can leave a partial result; refresh to review it.',
      confirmLabel: 'Update orders',
      guard: (_, child) => guardMerchantStoreView(_view, child),
    );
    if (!confirm || !_ready) return;
    await _mutation(() async {
      for (final orderId in selected) {
        if (!_current) return;
        await _orderService.updateOrderStatus(orderId, status: newStatus);
      }
      if (_current)
        setState(() {
          _selectedOrderIds.clear();
          _isSelectionMode = false;
          _notice = 'Order changes acknowledged. Refreshing saved status…';
        });
    });
  }

  Future<void> _handleStatusChange(
    OrderContract order,
    String newStatus,
  ) async {
    if (!_ready) return;
    Map<String, String>? result;
    String? reason;
    if (newStatus == 'shipped') {
      result = await _showTrackingDialog();
      if (result == null || !_ready) return;
    } else if (newStatus == 'cancelled') {
      reason = await _showCancelReasonDialog(order);
      if (reason == null || !_ready) return;
    }
    await _mutation(() async {
      if (newStatus == 'shipped') {
        await _orderService.fulfillOrder(
          order.id,
          trackingNumber: result!['number'],
          carrier: result['carrier'],
        );
      } else if (newStatus == 'cancelled') {
        await _orderService.cancelOrder(order.id, reason: reason!);
      } else {
        await _orderService.updateOrderStatus(order.id, status: newStatus);
      }
      if (_current)
        setState(
          () => _notice = 'Order change acknowledged. Refreshing saved status…',
        );
    });
  }

  Future<void> _exportOrders() async {
    if (!_ready) return;
    if (_exportJob != null) {
      await _checkExport();
      return;
    }
    final storeId = widget.storeId;
    final status = _statusFilter == 'all' ? null : _statusFilter;
    final format = await showLetbuyyFormSheet<String>(
      context: context,
      builder: (sheet) => guardMerchantStoreView(
        _view,
        LetbuyyFormSheet(
          title: 'Export orders',
          description:
              'CSV includes the server-authorized orders${status == null ? '' : ' with status ${_statusLabel(status)}'}. Loaded-page search, date and sort controls do not affect this export.',
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(sheet),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(sheet, 'csv'),
              child: const Text('Start CSV export'),
            ),
          ],
          child: const Text(
            'A queued job is not a completed download. Keep its status here and recheck the same job.',
          ),
        ),
        sheet: true,
      ),
    );
    if (format != 'csv' || !_ready) return;
    setState(() {
      _busy = true;
      _progress = 'Starting CSV export…';
      _error = null;
    });
    try {
      final result = await _orderService.exportOrders(storeId, status: status);
      if (!_current) return;
      final job = result['job'] is Map ? result['job'] as Map : const {};
      if (job['id'] == null || job['id'].toString().isEmpty)
        throw const FormatException('Export job identity unavailable.');
      setState(() => _exportJob = Map<String, dynamic>.from(job));
      await _pollExport();
    } catch (_) {
      if (_current)
        setState(
          () => _error =
              'Export acknowledgement is unavailable. A new job has not been automatically started.',
        );
    } finally {
      if (_current)
        setState(() {
          _busy = false;
          _progress = null;
        });
    }
  }

  Future<void> _pollExport() async {
    var latest = Map<String, dynamic>.from(_exportJob!);
    for (var attempt = 0; attempt < 5; attempt += 1) {
      if (latest['status'] == 'completed' || latest['status'] == 'failed')
        break;
      await Future<void>.delayed(const Duration(milliseconds: 350));
      if (!_current) return;
      final jobId = latest['id']?.toString();
      if (jobId == null || jobId.isEmpty) break;
      final detail = await _orderService.fetchExportJob(jobId);
      if (!_current) return;
      latest = detail['job'] is Map
          ? Map<String, dynamic>.from(detail['job'] as Map)
          : detail;
      setState(() => _exportJob = latest);
    }
    if (!_current) return;
    setState(() => _exportJob = latest);
  }

  Future<void> _checkExport() async {
    if (!_active || _busy || _isLoading || _denied || _exportJob == null)
      return;
    setState(() {
      _busy = true;
      _progress = 'Checking the existing export job…';
      _error = null;
    });
    try {
      final jobId = _exportJob!['id']?.toString();
      if (jobId == null || jobId.isEmpty)
        throw const FormatException('Export job identity unavailable.');
      final detail = await _orderService.fetchExportJob(jobId);
      if (!_current) return;
      setState(
        () => _exportJob = detail['job'] is Map
            ? Map<String, dynamic>.from(detail['job'] as Map)
            : detail,
      );
    } catch (_) {
      if (_current)
        setState(
          () => _error =
              'This export job could not be checked. Recheck the same job when access is available.',
        );
    } finally {
      if (_current)
        setState(() {
          _busy = false;
          _progress = null;
        });
    }
  }

  Future<void> _shareExport() async {
    if (!_active || _busy || _denied || _exportJob?['status'] != 'completed')
      return;
    final job = Map<String, dynamic>.from(_exportJob!);
    final api = context.read<ApiClient>();
    setState(() {
      _busy = true;
      _progress = 'Preparing the saved CSV…';
    });
    try {
      await shareMerchantExport(api: api, job: job, isCurrent: () => _active);
    } catch (_) {
      if (_current)
        setState(
          () => _error =
              'The completed export could not be shared. Recheck this job.',
        );
    } finally {
      if (_current)
        setState(() {
          _busy = false;
          _progress = null;
        });
    }
  }

  Future<void> _createDraftOrder() async {
    if (!_ready) return;
    setState(() {
      _busy = true;
      _progress = 'Loading products for a draft…';
      _error = null;
    });
    List<Map<String, dynamic>> products;
    try {
      products = await context.read<ProductService>().fetchProducts(
        widget.storeId,
        limit: 50,
      );
    } catch (_) {
      if (_current)
        setState(() => _error = 'Products could not be loaded for a draft.');
      return;
    } finally {
      if (_current)
        setState(() {
          _busy = false;
          _progress = null;
        });
    }
    if (!_ready) return;
    if (products.isEmpty) {
      setState(() => _error = 'Add a product before creating a draft order.');
      return;
    }
    final saved = await Navigator.of(context).push<_DraftOrderOutcome>(
      MaterialPageRoute(
        builder: (_) => guardMerchantStoreView(
          _view,
          _DraftOrderEditor(view: _view, products: products),
          fullPage: true,
        ),
      ),
    );
    if (_current && saved != null) {
      setState(
        () => _notice = saved.converted
            ? 'Order conversion acknowledged. Refreshing saved orders…'
            : 'Draft saved${saved.draftId == null ? '' : ' · ${saved.draftId}'}. Creating an order was not requested.',
      );
      await _loadOrders();
    }
  }

  Future<void> _printPackingSlip() async {
    if (!_ready) return;
    OrderContract? order;
    if (_selectedOrderIds.isNotEmpty) {
      for (final candidate in _orders) {
        if (candidate.id == _selectedOrderIds.first) {
          order = candidate;
          break;
        }
      }
    } else if (_orders.isNotEmpty) {
      order = _orders.first;
    }
    if (order == null) {
      setState(() => _error = 'Select an order to print.');
      return;
    }
    setState(() {
      _busy = true;
      _progress = 'Loading the saved packing slip…';
    });
    try {
      final slip = await _orderService.fetchPackingSlip(order.id);
      if (!_current) return;
      setState(() {
        _busy = false;
        _progress = null;
      });
      await _showPackingSlipDialog(slip);
    } catch (_) {
      if (_current)
        setState(() => _error = 'Packing slip could not be loaded.');
    } finally {
      if (_current)
        setState(() {
          _busy = false;
          _progress = null;
        });
    }
  }

  Future<void> _showPackingSlipDialog(Map<String, dynamic> slip) async {
    final title = (slip['order_number'] ?? 'Order').toString();
    final text = (slip['text'] ?? '').toString();
    final pdfBase64 = (slip['pdf_base64'] ?? '').toString();
    final filename = (slip['filename'] ?? 'packing-slip.pdf').toString();
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => guardMerchantStoreView(
          _view,
          _PackingSlipPage(
            view: _view,
            title: title,
            text: text,
            pdfBase64: pdfBase64,
            filename: filename,
          ),
          fullPage: true,
        ),
      ),
    );
  }

  Future<Map<String, String>?> _showTrackingDialog() =>
      showLetbuyyFormSheet<Map<String, String>>(
        context: context,
        builder: (_) =>
            guardMerchantStoreView(_view, const _TrackingSheet(), sheet: true),
      );
  Future<String?> _showCancelReasonDialog(OrderContract order) =>
      showLetbuyyFormSheet<String>(
        context: context,
        builder: (_) => guardMerchantStoreView(
          _view,
          _CancellationSheet(number: _orderNumber(order)),
          sheet: true,
        ),
      );
  void _openOrder(OrderContract order) {
    if (!_active || _busy || _denied) return;
    if (_isSelectionMode) {
      _toggleOrderSelection(order.id);
      return;
    }
    Navigator.pushNamed(
      context,
      AppRoutes.orderDetail,
      arguments: {'orderId': order.id, 'order': order},
    ).then((_) {
      if (_current) _loadOrders();
    });
  }

  List<String> _getStatusOptions(String currentStatus) {
    switch (currentStatus) {
      case 'pending':
        return ['confirmed', 'cancelled'];
      case 'confirmed':
        return ['shipped', 'cancelled'];
      case 'shipped':
        return ['delivered'];
      default:
        return [];
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'pending':
        return Icons.schedule_rounded;
      case 'confirmed':
        return Icons.check_circle_outline;
      case 'shipped':
        return Icons.local_shipping_outlined;
      case 'delivered':
        return Icons.inventory_2_outlined;
      case 'cancelled':
        return Icons.cancel_outlined;
      default:
        return Icons.help_outline_rounded;
    }
  }

  String _orderStatus(OrderContract order) {
    final status = order.status.trim().toLowerCase();
    return status.isEmpty ? 'unknown' : status;
  }

  bool _hasRiskSignal(OrderContract order) {
    final level = order.riskLevel.trim().toLowerCase();
    return order.riskScore > 0 ||
        level == 'medium' ||
        level == 'high' ||
        (order.fulfillmentState ?? '').trim().toLowerCase() == 'hold' ||
        (order.codConfirmationStatus ?? '').trim().toLowerCase() ==
            'requested' ||
        (order.rtoStatus ?? '').trim().toLowerCase() == 'at_risk';
  }

  String _riskLabel(OrderContract order) {
    final level = order.riskLevel.trim().toLowerCase();
    return switch (level) {
      'high' => 'High',
      'medium' => 'Medium',
      _ => 'Low',
    };
  }

  Color _riskColor(OrderContract order) {
    final level = order.riskLevel.trim().toLowerCase();
    if (level == 'high') return colors.error;
    if (level == 'medium') return colors.warning;
    return colors.accentBlue;
  }

  String _orderNumber(OrderContract order) {
    return order.orderNumber.isNotEmpty ? order.orderNumber : order.id;
  }

  String _orderCustomerName(OrderContract order) {
    return order.customerName?.trim().isNotEmpty == true
        ? order.customerName!.trim()
        : 'Customer';
  }

  String _orderCustomerPhone(OrderContract order) {
    final phone = order.customerPhone?.trim();
    return phone?.isNotEmpty == true ? phone! : 'No phone';
  }

  double _orderTotal(OrderContract order) {
    if (order.total > 0) return order.total;
    return order.lineItems.fold(0.0, (sum, line) => sum + line.total);
  }

  int _orderItemCount(OrderContract order) {
    final count = order.lineItems.fold(0, (sum, line) => sum + line.quantity);
    return count == 0 ? order.lineItems.length : count;
  }

  DateTime? _orderCreatedAt(OrderContract order) {
    final raw = order['created_at'] ?? order['createdAt'];
    if (raw is DateTime) return raw;
    return DateTime.tryParse(raw?.toString() ?? '');
  }

  String _formatOrderDate(OrderContract order) {
    final createdAt = _orderCreatedAt(order);
    return createdAt == null
        ? 'Date unavailable'
        : DateFormat('MMM d, h:mm a').format(createdAt);
  }

  int _compareDatesDesc(DateTime? a, DateTime? b) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return b.compareTo(a);
  }

  int _compareDatesAsc(DateTime? a, DateTime? b) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a.compareTo(b);
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'shipped':
        return 'Shipped';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.isEmpty ? 'Unknown' : status;
    }
  }

  Color _statusColor(String status) => switch (status) {
    'pending' => colors.warning,
    'confirmed' => colors.accentBlue,
    'shipped' => Theme.of(context).colorScheme.primary,
    'delivered' => colors.success,
    'cancelled' => colors.error,
    _ => colors.textSecondary,
  };

  @override
  Widget build(BuildContext context) {
    _publishActions();
    final scheme = Theme.of(context).colorScheme;
    final filtered = _filteredOrders;
    final storeName =
        context.watch<StoreContext>().selectedStore?.name ?? widget.storeId;
    return Scaffold(
      appBar: CustomAppBar.responsive(
        context: context,
        title: 'Orders',
        actions: [
          IconButton(
            tooltip: 'Returns',
            onPressed: _active && !_busy
                ? () => Navigator.pushNamed(context, AppRoutes.returns)
                : null,
            icon: const Icon(Icons.assignment_return_outlined),
          ),
          IconButton(
            tooltip: 'Refresh orders',
            onPressed: _active && !_busy && !_isLoading ? _loadOrders : null,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            if (_isLoading || _busy)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Semantics(
                  liveRegion: true,
                  child: Row(
                    children: [
                      const LoadingIndicator(),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _isLoading
                              ? (_loaded
                                    ? 'Refreshing orders…'
                                    : 'Loading orders…')
                              : _progress ?? 'Working…',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadOrders,
                child: CustomScrollView(
                  controller: _scrollController,
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.all(16),
                      sliver: SliverToBoxAdapter(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              storeName,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Loaded page $_page · ${_orders.length} orders. Search, status, date, sort and counts below apply only to this page. Each server page contains up to 20 orders.',
                            ),
                            if (_nextCursor != null)
                              const Text(
                                'More server orders are available using Next page.',
                              ),
                            Wrap(
                              spacing: 12,
                              runSpacing: 8,
                              children: [
                                OutlinedButton(
                                  onPressed:
                                      !_busy &&
                                          !_isLoading &&
                                          !_denied &&
                                          _fresh &&
                                          _previousCursors.isNotEmpty
                                      ? () => _changePage(false)
                                      : null,
                                  child: const Text('Previous page'),
                                ),
                                OutlinedButton(
                                  onPressed:
                                      !_busy &&
                                          !_isLoading &&
                                          !_denied &&
                                          _fresh &&
                                          _nextCursor != null
                                      ? () => _changePage(true)
                                      : null,
                                  child: const Text('Next page'),
                                ),
                              ],
                            ),
                            if (_loaded && !_fresh)
                              const _OrderNotice(
                                'Saved results · Not confirmed by the latest read. Refresh successfully before changing an order.',
                              ),
                            if (_error != null)
                              _OrderNotice(_error!, error: true),
                            if (_notice != null) _OrderNotice(_notice!),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                OutlinedButton.icon(
                                  onPressed: _ready ? _exportOrders : null,
                                  icon: const Icon(
                                    Icons.file_download_outlined,
                                  ),
                                  label: const Text('Export'),
                                ),
                                FilledButton.icon(
                                  onPressed: _ready ? _createDraftOrder : null,
                                  icon: const Icon(Icons.note_add_outlined),
                                  label: const Text('Draft'),
                                ),
                                OutlinedButton.icon(
                                  onPressed: _ready ? _printPackingSlip : null,
                                  icon: const Icon(Icons.print_outlined),
                                  label: const Text('Print'),
                                ),
                                OutlinedButton.icon(
                                  onPressed: _ready
                                      ? _toggleSelectionMode
                                      : null,
                                  icon: Icon(
                                    _isSelectionMode
                                        ? Icons.close
                                        : Icons.checklist,
                                  ),
                                  label: Text(
                                    _isSelectionMode
                                        ? 'Cancel selection'
                                        : 'Select',
                                  ),
                                ),
                              ],
                            ),
                            if (_exportJob != null) _exportStatus(),
                            const SizedBox(height: 16),
                            CustomTextField(
                              controller: _searchController,
                              label: 'Search loaded page',
                              prefixIcon: Icons.search,
                              enabled: !_busy && !_denied,
                              onChanged: (value) {
                                if (_current)
                                  setState(() => _searchQuery = value);
                              },
                              suffixIcon: IconButton(
                                tooltip: 'Clear search',
                                onPressed: _searchQuery.isEmpty || _busy
                                    ? null
                                    : () {
                                        _searchController.clear();
                                        setState(() => _searchQuery = '');
                                      },
                                icon: const Icon(Icons.close),
                              ),
                            ),
                            Wrap(
                              spacing: 12,
                              runSpacing: 4,
                              children: [
                                LetbuyyChoiceField<String>(
                                  compact: true,
                                  label: 'Page status',
                                  value: _statusFilter,
                                  choices: const [
                                    LetbuyyChoice(value: 'all', label: 'All'),
                                    LetbuyyChoice(
                                      value: 'pending',
                                      label: 'Pending',
                                    ),
                                    LetbuyyChoice(
                                      value: 'confirmed',
                                      label: 'Confirmed',
                                    ),
                                    LetbuyyChoice(
                                      value: 'shipped',
                                      label: 'Shipped',
                                    ),
                                    LetbuyyChoice(
                                      value: 'delivered',
                                      label: 'Delivered',
                                    ),
                                    LetbuyyChoice(
                                      value: 'cancelled',
                                      label: 'Cancelled',
                                    ),
                                  ],
                                  onChanged: !_busy && !_denied
                                      ? (value) => setState(
                                          () => _statusFilter = value,
                                        )
                                      : null,
                                ),
                                LetbuyyChoiceField<String>(
                                  compact: true,
                                  label: 'Page date',
                                  value: _dateFilter,
                                  choices: const [
                                    LetbuyyChoice(
                                      value: 'all',
                                      label: 'All dates',
                                    ),
                                    LetbuyyChoice(
                                      value: 'today',
                                      label: 'Today',
                                    ),
                                    LetbuyyChoice(
                                      value: 'week',
                                      label: 'Last 7 days',
                                    ),
                                    LetbuyyChoice(
                                      value: 'month',
                                      label: 'Last 30 days',
                                    ),
                                  ],
                                  onChanged: !_busy && !_denied
                                      ? (value) =>
                                            setState(() => _dateFilter = value)
                                      : null,
                                ),
                                LetbuyyChoiceField<String>(
                                  compact: true,
                                  label: 'Page sort',
                                  value: _sortBy,
                                  choices: const [
                                    LetbuyyChoice(
                                      value: 'newest',
                                      label: 'Newest',
                                    ),
                                    LetbuyyChoice(
                                      value: 'oldest',
                                      label: 'Oldest',
                                    ),
                                    LetbuyyChoice(
                                      value: 'amount_high',
                                      label: 'Amount: high to low',
                                    ),
                                    LetbuyyChoice(
                                      value: 'amount_low',
                                      label: 'Amount: low to high',
                                    ),
                                  ],
                                  onChanged: !_busy && !_denied
                                      ? (value) =>
                                            setState(() => _sortBy = value)
                                      : null,
                                ),
                              ],
                            ),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                Chip(label: Text('Pending $_pendingCount')),
                                Chip(label: Text('Confirmed $_confirmedCount')),
                                Chip(label: Text('Shipped $_shippedCount')),
                                Chip(label: Text('Delivered $_deliveredCount')),
                                if (_orders.isNotEmpty &&
                                    _orders.every(
                                      (o) => o.total > 0 && o.total.isFinite,
                                    ))
                                  Chip(
                                    label: Text(
                                      'Page delivered total ${PriceFormatter.formatPrice(_totalRevenue)}',
                                    ),
                                  ),
                              ],
                            ),
                            Text(
                              '${filtered.length} of ${_orders.length} loaded orders shown',
                              style: Theme.of(context).textTheme.labelLarge,
                            ),
                            if (_selectedOrderIds.isNotEmpty)
                              Text(
                                '${_selectedOrderIds.length} selected across the loaded page. Hidden selected orders remain selected on this page; changing pages clears selection.',
                              ),
                          ],
                        ),
                      ),
                    ),
                    if (!_isLoading && filtered.isEmpty)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            children: [
                              Icon(
                                _denied
                                    ? Icons.lock_outline
                                    : Icons.receipt_long_outlined,
                                size: 40,
                                color: scheme.onSurfaceVariant,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                _denied
                                    ? 'Order access unavailable'
                                    : _orders.isEmpty
                                    ? (_error != null
                                          ? 'Orders unavailable'
                                          : 'No orders on this loaded page')
                                    : 'No matches on this loaded page',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              TextButton(
                                onPressed: _busy ? null : _loadOrders,
                                child: const Text('Refresh orders'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                      sliver: SliverList.builder(
                        itemCount: filtered.length,
                        itemBuilder: (_, index) =>
                            _buildOrderCard(filtered[index]),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_isSelectionMode) _selectionActions(),
          ],
        ),
      ),
    );
  }

  Widget _exportStatus() {
    final status = _exportJob!['status']?.toString() ?? 'queued';
    return Card(
      semanticContainer: false,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'CSV export · $status',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            Text(
              'Job ${_exportJob!['id']}. Closing orders does not cancel this job. This status is retained only while this page remains open.',
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                TextButton(
                  onPressed: !_busy && !_isLoading && !_denied
                      ? _checkExport
                      : null,
                  child: const Text('Recheck same job'),
                ),
                if (status == 'completed')
                  FilledButton(
                    onPressed: !_busy && !_denied ? _shareExport : null,
                    child: const Text('Share CSV'),
                  ),
                if (const ['completed', 'failed'].contains(status))
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => setState(() => _exportJob = null),
                    child: const Text('Dismiss job status'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _selectionActions() => Container(
    color: Theme.of(context).colorScheme.surfaceContainer,
    padding: const EdgeInsets.all(12),
    child: OverflowBar(
      spacing: 8,
      overflowSpacing: 8,
      alignment: MainAxisAlignment.end,
      children: [
        AccessibleTapRegion(
          key: const ValueKey('orders-select-all-visible'),
          label: '${_selectedOrderIds.length} orders selected',
          hint: 'Select all visible orders',
          onTap: _ready ? _selectAll : null,
          excludeChildSemantics: true,
          child: TextButton(
            onPressed: _ready ? _selectAll : null,
            child: Text(
              '${_selectedOrderIds.length} selected · Select visible',
            ),
          ),
        ),
        OutlinedButton(
          onPressed: _ready && _selectedOrderIds.isNotEmpty
              ? () => _bulkUpdateStatus('confirmed')
              : null,
          child: const Text('Confirm'),
        ),
        FilledButton(
          onPressed: _ready && _selectedOrderIds.isNotEmpty
              ? () => _bulkUpdateStatus('shipped')
              : null,
          child: const Text('Ship'),
        ),
      ],
    ),
  );
  Widget _buildOrderCard(OrderContract order) {
    final status = _orderStatus(order),
        selected = _selectedOrderIds.contains(order.id);
    final total = _displayOrderTotal(order),
        itemCount = _displayOrderItemCount(order);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        semanticContainer: false,
        color: selected
            ? Theme.of(context).colorScheme.secondaryContainer
            : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AccessibleTapRegion(
              key: ValueKey('order-card-${order.id}'),
              label:
                  'Order ${_orderNumber(order)}, ${_statusLabel(status)}, Customer ${_orderCustomerName(order)}, Total $total, $itemCount',
              hint: _isSelectionMode
                  ? (selected ? 'Tap to deselect order' : 'Tap to select order')
                  : 'Opens order details',
              selected: _isSelectionMode ? selected : null,
              onTap: _active && !_busy && !_denied
                  ? () => _openOrder(order)
                  : null,
              excludeChildSemantics: true,
              child: InkWell(
                excludeFromSemantics: true,
                onTap: _active && !_busy && !_denied
                    ? () => _openOrder(order)
                    : null,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        _orderNumber(order),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 12,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            _statusLabel(status),
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(color: _statusColor(status)),
                          ),
                          Text(
                            total,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          Text(itemCount),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(_formatOrderDate(order)),
                      Text(_orderCustomerName(order)),
                      Text(_orderCustomerPhone(order)),
                      if (_hasRiskSignal(order))
                        Text(
                          '${_riskLabel(order)} risk',
                          style: TextStyle(color: _riskColor(order)),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            if (_isSelectionMode)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: CheckboxListTile(
                  key: ValueKey('order-select-${order.id}'),
                  value: selected,
                  title: Text('Select order ${_orderNumber(order)}'),
                  controlAffinity: ListTileControlAffinity.leading,
                  onChanged: _ready
                      ? (_) => _toggleOrderSelection(order.id)
                      : null,
                ),
              ),
            if (!_isSelectionMode && _getStatusOptions(status).isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final option in _getStatusOptions(status))
                      TextButton.icon(
                        onPressed: _ready
                            ? () => _handleStatusChange(order, option)
                            : null,
                        icon: Icon(_getStatusIcon(option)),
                        label: Text(_statusLabel(option)),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _displayOrderItemCount(OrderContract order) {
    final rawCount = order['item_count'];
    if (rawCount != null) {
      final count = rawCount is num
          ? rawCount
          : num.tryParse(rawCount.toString());
      if (count == null ||
          !count.isFinite ||
          count < 0 ||
          count != count.toInt()) {
        return 'Item count unavailable';
      }
      return '${count.toInt()} items';
    }
    final raw = order['line_items'];
    if (raw is! List) return 'Item count unavailable';
    for (final line in raw) {
      if (line is! Map) return 'Item count unavailable';
      final rawQuantity = line['quantity'];
      final quantity = rawQuantity is num
          ? rawQuantity
          : rawQuantity is String
          ? num.tryParse(rawQuantity)
          : null;
      if (quantity == null ||
          !quantity.isFinite ||
          quantity <= 0 ||
          quantity != quantity.truncateToDouble()) {
        return 'Item count unavailable';
      }
    }
    return '${_orderItemCount(order)} items';
  }

  String _displayOrderTotal(OrderContract order) {
    // Inspect the original response so absent/null is not the DTO's numeric zero.
    // This never changes _orderTotal, sorting, server totals or a command payload.
    final raw = order['total'];
    final value = raw is num
        ? raw.toDouble()
        : raw is String
        ? double.tryParse(raw)
        : null;
    if (value == null || !value.isFinite || order.currency != 'INR')
      return 'Total unavailable';
    return PriceFormatter.formatPrice(value);
  }
}

class _OrderNotice extends StatelessWidget {
  const _OrderNotice(this.message, {this.error = false});
  final String message;
  final bool error;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Text(
        message,
        style: TextStyle(
          color: error
              ? Theme.of(context).colorScheme.error
              : Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    ),
  );
}

class _TrackingSheet extends StatefulWidget {
  const _TrackingSheet();
  @override
  State<_TrackingSheet> createState() => _TrackingSheetState();
}

class _TrackingSheetState extends State<_TrackingSheet> {
  final numberController = TextEditingController(),
      carrierController = TextEditingController();
  @override
  void dispose() {
    numberController.dispose();
    carrierController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LetbuyyFormSheet(
    title: 'Add tracking information',
    description:
        'Shipping is confirmed by the existing order command. Carrier and tracking values are passed unchanged.',
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, {
          'number': numberController.text,
          'carrier': carrierController.text,
        }),
        child: const Text('Ship order'),
      ),
    ],
    child: Column(
      children: [
        CustomTextField(
          controller: carrierController,
          label: 'Carrier (e.g., Delhivery)',
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 12),
        CustomTextField(
          controller: numberController,
          label: 'Tracking number',
          textInputAction: TextInputAction.done,
        ),
      ],
    ),
  );
}

class _CancellationSheet extends StatefulWidget {
  const _CancellationSheet({required this.number});
  final String number;
  @override
  State<_CancellationSheet> createState() => _CancellationSheetState();
}

class _CancellationSheetState extends State<_CancellationSheet> {
  final reasonController = TextEditingController();
  String reason = '';
  @override
  void dispose() {
    reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LetbuyyFormSheet(
    title: 'Cancel ${widget.number}?',
    description: 'Add a cancellation reason for the order timeline.',
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Keep order'),
      ),
      FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: Theme.of(context).colorScheme.error,
          foregroundColor: Theme.of(context).colorScheme.onError,
        ),
        onPressed: reason.isEmpty ? null : () => Navigator.pop(context, reason),
        child: const Text('Cancel order'),
      ),
    ],
    child: CustomTextField(
      controller: reasonController,
      label: 'Cancellation reason',
      autofocus: true,
      maxLines: 3,
      maxLength: 500,
      onChanged: (value) => setState(() => reason = value.trim()),
    ),
  );
}

typedef _DraftOrderOutcome = ({bool converted, String? draftId});

class _DraftOrderEditor extends StatefulWidget {
  const _DraftOrderEditor({required this.view, required this.products});
  final MerchantStoreView view;
  final List<Map<String, dynamic>> products;
  @override
  State<_DraftOrderEditor> createState() => _DraftOrderEditorState();
}

class _DraftOrderEditorState extends State<_DraftOrderEditor> {
  final _scroll = ScrollController();
  final nameController = TextEditingController(),
      emailController = TextEditingController(),
      phoneController = TextEditingController(),
      notesController = TextEditingController();
  late String selectedProductId = widget.products.first['id'].toString();
  int quantity = 1;
  bool convertNow = false,
      _busy = false,
      _uncertain = false,
      _submitted = false;
  String? _error, _draftId;
  bool get _current =>
      mounted && merchantStoreViewCurrent(context, widget.view);
  bool get _dirty =>
      nameController.text.isNotEmpty ||
      emailController.text.isNotEmpty ||
      phoneController.text.isNotEmpty ||
      notesController.text.isNotEmpty ||
      quantity != 1 ||
      convertNow ||
      selectedProductId != widget.products.first['id'].toString();
  @override
  void initState() {
    super.initState();
    for (final c in [
      nameController,
      emailController,
      phoneController,
      notesController,
    ]) {
      c.addListener(_changed);
    }
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _scroll.dispose();
    for (final c in [
      nameController,
      emailController,
      phoneController,
      notesController,
    ]) {
      c.removeListener(_changed);
      c.dispose();
    }
    super.dispose();
  }

  String _productLabel(Map<String, dynamic> product) {
    final name = (product['name'] ?? product['title'] ?? 'Product').toString();
    final sku = product['sku']?.toString();
    return sku == null || sku.isEmpty ? name : '$name ($sku)';
  }

  Future<void> _save() async {
    if (!_current || _busy || _uncertain) return;
    final name = nameController.text.trim(),
        email = emailController.text.trim();
    setState(() => _submitted = true);
    if (name.isEmpty || email.isEmpty || !email.contains('@')) {
      _showResult();
      return;
    }
    final service = context.read<OrderService>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final draft = await service.createDraftOrder(
        storeId: widget.view.storeId,
        customerName: nameController.text,
        customerEmail: emailController.text,
        customerPhone: phoneController.text,
        notes: notesController.text,
        items: [
          {'product_id': selectedProductId, 'quantity': quantity},
        ],
      );
      if (!_current) return;
      _draftId = draft['id']?.toString();
      if (convertNow) {
        final draftId = draft['id']?.toString();
        if (draftId == null || draftId.isEmpty)
          throw StateError('Draft response did not include an id.');
        await service.convertDraftOrder(draftId);
        if (!_current) return;
      }
      if (_current) {
        Navigator.pop(context, (converted: convertNow, draftId: _draftId));
      }
    } catch (_) {
      if (_current)
        setState(() {
          _uncertain = true;
          _error = _draftId == null
              ? 'The draft outcome could not be confirmed. Your input is kept here. Review drafts on Merchant web before starting another request.'
              : 'Draft $_draftId was acknowledged; order conversion could not be confirmed. Review this draft on Merchant web. This editor will not repeat the request.';
        });
    } finally {
      if (_current) setState(() => _busy = false);
    }
    if (_current && _error != null) _showResult();
  }

  void _showResult() {
    FocusScope.of(context).unfocus();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_current && _scroll.hasClients) _scroll.jumpTo(0);
    });
  }

  @override
  Widget build(BuildContext context) => LetbuyyEditorScaffold(
    title: 'New draft order',
    hasChanges: _dirty,
    currentHasChanges: () => _dirty,
    isBusy: _busy,
    currentIsBusy: () => _busy,
    confirmationGuard: (_, child) => guardMerchantStoreView(widget.view, child),
    progressLabel: _busy
        ? 'Saving draft${convertNow ? ' and creating order' : ''}…'
        : null,
    body: ListView(
      controller: _scroll,
      padding: const EdgeInsets.all(16),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      children: [
        const Text(
          'Choose from the first 50 products returned by the store. Availability and totals are determined by the server when the draft is saved.',
        ),
        if (_error != null) _OrderNotice(_error!, error: true),
        const SizedBox(height: 16),
        CustomTextField(
          controller: nameController,
          label: 'Customer name',
          enabled: !_busy && !_uncertain,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.name],
          errorText: _submitted && nameController.text.trim().isEmpty
              ? 'Enter a customer name.'
              : null,
        ),
        const SizedBox(height: 16),
        CustomTextField(
          controller: emailController,
          label: 'Customer email',
          enabled: !_busy && !_uncertain,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.email],
          errorText:
              _submitted &&
                  (emailController.text.trim().isEmpty ||
                      !emailController.text.trim().contains('@'))
              ? 'Enter an email containing @.'
              : null,
        ),
        const SizedBox(height: 16),
        CustomTextField(
          controller: phoneController,
          label: 'Phone',
          enabled: !_busy && !_uncertain,
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.telephoneNumber],
        ),
        LetbuyyChoiceField<String>(
          label: 'Product',
          value: selectedProductId,
          choices: [
            for (final product in widget.products)
              LetbuyyChoice(
                value: product['id'].toString(),
                label: _productLabel(product),
              ),
          ],
          onChanged: !_busy && !_uncertain
              ? (v) => setState(() => selectedProductId = v)
              : null,
        ),
        Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text('Quantity: $quantity'),
            IconButton(
              tooltip: 'Decrease quantity',
              onPressed: !_busy && !_uncertain && quantity > 1
                  ? () => setState(() => quantity -= 1)
                  : null,
              icon: const Icon(Icons.remove_circle_outline),
            ),
            IconButton(
              tooltip: 'Increase quantity',
              onPressed: !_busy && !_uncertain && quantity < 999
                  ? () => setState(() => quantity += 1)
                  : null,
              icon: const Icon(Icons.add_circle_outline),
            ),
          ],
        ),
        const SizedBox(height: 16),
        CustomTextField(
          controller: notesController,
          label: 'Notes',
          enabled: !_busy && !_uncertain,
          maxLines: 2,
        ),
        SwitchListTile.adaptive(
          contentPadding: EdgeInsets.zero,
          title: const Text('Create order now'),
          subtitle: const Text(
            'Save the draft, then request conversion using the existing order workflow.',
          ),
          value: convertNow,
          onChanged: !_busy && !_uncertain
              ? (v) => setState(() => convertNow = v)
              : null,
        ),
      ],
    ),
    actions: OverflowBar(
      spacing: 12,
      overflowSpacing: 12,
      alignment: MainAxisAlignment.end,
      children: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.maybePop(context),
          child: const Text('Close'),
        ),
        FilledButton(
          onPressed: _busy || _uncertain ? null : _save,
          child: const Text('Save draft'),
        ),
      ],
    ),
  );
}

class _PackingSlipPage extends StatefulWidget {
  const _PackingSlipPage({
    required this.view,
    required this.title,
    required this.text,
    required this.pdfBase64,
    required this.filename,
  });
  final MerchantStoreView view;
  final String title, text, pdfBase64, filename;
  @override
  State<_PackingSlipPage> createState() => _PackingSlipPageState();
}

class _PackingSlipPageState extends State<_PackingSlipPage> {
  bool _busy = false;
  String? _notice;
  bool get _current =>
      mounted && merchantStoreViewCurrent(context, widget.view);
  Future<void> _copy() async {
    if (!_current || _busy) return;
    setState(() => _busy = true);
    try {
      await Clipboard.setData(ClipboardData(text: widget.text));
      if (_current) setState(() => _notice = 'Packing slip copied.');
    } catch (_) {
      if (_current)
        setState(() => _notice = 'Packing slip could not be copied.');
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  Future<void> _sharePackingSlipPdf(String pdfBase64, String filename) async {
    if (!_current || _busy) return;
    setState(() => _busy = true);
    try {
      final bytes = base64Decode(pdfBase64);
      final tempDir = await getTemporaryDirectory();
      if (!_current) return;
      final safeName = filename.endsWith('.pdf') ? filename : '$filename.pdf';
      final file = File('${tempDir.path}/$safeName');
      await file.writeAsBytes(bytes, flush: true);
      if (!_current) return;
      await Share.shareXFiles([
        XFile(file.path, mimeType: 'application/pdf'),
      ], subject: safeName);
    } catch (_) {
      if (_current)
        setState(() => _notice = 'Packing slip PDF could not be shared.');
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => LetbuyyEditorScaffold(
    title: 'Packing slip ${widget.title}',
    hasChanges: false,
    isBusy: _busy,
    currentIsBusy: () => _busy,
    progressLabel: _busy ? 'Preparing packing slip…' : null,
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_notice != null) _OrderNotice(_notice!),
        SelectableText(
          widget.text.isEmpty ? 'Packing slip unavailable.' : widget.text,
        ),
      ],
    ),
    actions: OverflowBar(
      spacing: 12,
      overflowSpacing: 12,
      children: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.pop(context),
          child: const Text('Close'),
        ),
        OutlinedButton.icon(
          onPressed: _busy || widget.text.isEmpty ? null : _copy,
          icon: const Icon(Icons.copy),
          label: const Text('Copy'),
        ),
        FilledButton.icon(
          onPressed: _busy || widget.pdfBase64.isEmpty
              ? null
              : () => _sharePackingSlipPdf(widget.pdfBase64, widget.filename),
          icon: const Icon(Icons.ios_share),
          label: const Text('Share PDF'),
        ),
      ],
    ),
  );
}
