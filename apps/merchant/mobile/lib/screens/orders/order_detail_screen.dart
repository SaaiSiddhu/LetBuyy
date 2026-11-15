import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../config/app_config.dart';
import '../../services/order_service.dart';
import '../../services/two_factor_service.dart';
import '../../services/api_client.dart';
import '../../app/store_context.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../../widgets/shared/provider_mode_badge.dart';
import '../security/two_factor_screen.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({
    super.key,
    required this.orderId,
    this.initialOrder,
  });

  final String orderId;
  final OrderContract? initialOrder;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  OrderContract? _order;
  bool _isLoading = true;
  bool _isMutating = false;
  String? _error;

  late AppThemeColors colors;
  late final Object? _readContext;
  MerchantStoreView? _view;
  bool _fresh = false, _reading = false, _openingAction = false;
  bool _waitingForInput = false;
  bool get _current =>
      mounted &&
      merchantStoreViewCurrent(context, _view) &&
      context.read<OrderService>().requestContext == _readContext;
  bool get _ready =>
      _current && _fresh && !_isLoading && !_isMutating && !_openingAction;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    context.watch<StoreContext>();
    if (!_current) {
      _order = null;
      _fresh = false;
      _isLoading = false;
      _isMutating = false;
      _openingAction = false;
      _waitingForInput = false;
      _error =
          'Account or store access changed. Reopen this order from the intended store.';
    }
  }

  @override
  void initState() {
    super.initState();
    final stores = context.read<StoreContext>(), id = stores.selectedStoreId;
    if (id != null) _view = (key: stores.requestContextKey, storeId: id);
    _readContext = context.read<OrderService>().requestContext;
    // The route argument is return context, not a current permission/read proof.
    // Admit the requested record only through the canonical live reader.
    _loadOrder();
  }

  Future<void> _loadOrder() async {
    if (!_current) {
      if (mounted)
        setState(() {
          _order = null;
          _fresh = false;
          _isLoading = false;
          _error = 'Choose the intended store and reopen this order.';
        });
      return;
    }
    if (_reading) return;
    if (widget.orderId.trim().isEmpty) {
      setState(() {
        _isLoading = false;
        _error = 'Order id is missing.';
      });
      return;
    }
    _reading = true;
    setState(() {
      _isLoading = true;
      _fresh = false;
      _error = null;
    });
    final service = context.read<OrderService>();
    try {
      final order = await service.fetchOrder(
        widget.orderId,
        expectedStoreId: _view!.storeId,
      );
      if (!_current) return;
      setState(() {
        _order = order;
        _fresh = service.hasFreshOrder(widget.orderId);
        if (!_fresh)
          _error =
              'Saved order · The latest read could not be confirmed. Reload successfully before changing this order.';
      });
    } catch (error) {
      if (!_current) return;
      setState(() {
        _fresh = false;
        if (error is FormatException ||
            error is ApiException &&
                (const [401, 403, 404].contains(error.statusCode) ||
                    error.code == 'SESSION_CONTEXT_CHANGED')) {
          _order = null;
          _error =
              'This order could not be confirmed for the selected store. Reopen it from the intended store.';
        } else {
          _error =
              'The order could not be refreshed. Previously shown details, if present, are unconfirmed. Reload before making changes.';
        }
      });
    } finally {
      _reading = false;
      if (_current) setState(() => _isLoading = false);
    }
  }

  Future<void> _runAction(Future<void> Function() action) async {
    if (!_ready) return;
    setState(() => _openingAction = true);
    try {
      await action();
    } finally {
      if (_current) setState(() => _openingAction = false);
    }
  }

  Future<T?> _showCurrentSheet<T>(Widget child) async {
    if (!_current) return null;
    setState(() => _waitingForInput = true);
    try {
      return await mobile_tokens.showLetbuyyFormSheet<T>(
        context: context,
        builder: (_) => guardMerchantStoreView(_view, child, sheet: true),
      );
    } finally {
      if (_current) setState(() => _waitingForInput = false);
    }
  }

  Future<T?> _showOrderEditor<T>({
    required String title,
    required List<TextEditingController> controllers,
    required bool Function() hasChanges,
    required Widget Function(BuildContext, StateSetter) bodyBuilder,
    required List<Widget> Function(BuildContext) actionsBuilder,
  }) async {
    final changes = Listenable.merge(controllers);
    try {
      if (!_current) return null;
      setState(() => _waitingForInput = true);
      // A prior operation notice belongs to the reading page. Do not carry it
      // over the next editor's pinned actions while the person retries input.
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      final route = MaterialPageRoute<T>(
        builder: (page) => guardMerchantStoreView(
          _view,
          StatefulBuilder(
            builder: (formContext, setFormState) => ListenableBuilder(
              listenable: changes,
              builder: (_, __) => mobile_tokens.LetbuyyEditorScaffold(
                title: title,
                hasChanges: hasChanges(),
                currentHasChanges: hasChanges,
                confirmationGuard: (_, child) =>
                    guardMerchantStoreView(_view, child),
                body: SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.all(16),
                  child: bodyBuilder(formContext, setFormState),
                ),
                actions: OverflowBar(
                  spacing: 12,
                  overflowSpacing: 12,
                  alignment: MainAxisAlignment.end,
                  children: actionsBuilder(page),
                ),
              ),
            ),
          ),
          fullPage: true,
        ),
      );
      final result = await Navigator.of(context).push<T>(route);
      // Popped routes still render their exit transition. Retire native editing
      // controllers only after that route has actually completed disposal.
      await route.completed;
      return result;
    } finally {
      for (final controller in controllers) {
        controller.dispose();
      }
      if (_current) setState(() => _waitingForInput = false);
    }
  }

  void _formError(BuildContext page, String message) {
    if (!_current || !page.mounted || ModalRoute.of(page)?.isCurrent != true)
      return;
    mobile_tokens.showLetbuyyOperationFeedback(
      page,
      message: message,
      isError: true,
    );
  }

  Future<void> _issueRefund() async {
    final order = _order;
    if (order == null || !_current || !_fresh || _isLoading || _isMutating)
      return;
    try {
      final captured = context.read<TwoFactorService>().capture();
      final pending = await context.read<OrderService>().pendingRefundRequest(
        order.id,
        captured,
      );
      if (!_current) return;
      context.read<TwoFactorService>().check(captured);
      final request = await _showRefundDialog(order, pending: pending);
      if (request == null || !_current) return;
      context.read<TwoFactorService>().check(captured);
      setState(() => _isMutating = true);
      final updated = await context.read<OrderService>().refundOrder(
        order.id,
        context: captured,
        lines: request.lines,
        reason: request.reason,
      );
      if (_current && context.read<TwoFactorService>().isCurrent(captured)) {
        setState(() => _order = updated);
        _showSnackBar(
          'Refund request saved. Payment completion is still required.',
        );
        await _loadOrder();
      }
    } catch (error) {
      if (_current) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _completeRefund() async {
    final order = _order;
    if (order == null || !_current || !_fresh || _isLoading || _isMutating)
      return;
    try {
      final captured = context.read<TwoFactorService>().capture();
      final pending = await context
          .read<OrderService>()
          .pendingRefundCompletion(order.id, captured);
      if (!_current) return;
      context.read<TwoFactorService>().check(captured);
      final request = await _showCompleteRefundDialog(pending: pending);
      if (request == null || !_current) return;
      context.read<TwoFactorService>().check(captured);
      MerchantStepUpProof? proof;
      setState(() => _waitingForInput = true);
      try {
        proof = await TwoFactorScreen.approve(context);
      } finally {
        if (_current) setState(() => _waitingForInput = false);
      }
      if (proof == null || !_current) return;
      context.read<TwoFactorService>().check(captured);
      if (proof.context != captured) throw TwoFactorService.changed();
      setState(() => _isMutating = true);
      final updated = await context.read<OrderService>().completeRefund(
        order.id,
        approval: proof,
        refundId: request.refundId,
        providerRefundId: request.providerRefundId,
        notes: request.notes,
      );
      if (_current && context.read<TwoFactorService>().isCurrent(captured)) {
        setState(() => _order = updated);
        _showSnackBar('Refund completed');
      }
    } catch (error) {
      if (_current) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _fulfillOrder() async {
    final order = _order;
    if (order == null || !_current || !_fresh || _isLoading || _isMutating)
      return;

    final request = await _showTrackingDialog();
    if (request == null || !_current) return;

    setState(() => _isMutating = true);
    try {
      String? trackingNumber = request.trackingNumber;
      String? carrier = request.carrier;
      Map<String, dynamic>? label;

      if (request.createShippingLabel) {
        final labelResponse = await context
            .read<OrderService>()
            .buyShippingLabel(
              order.id,
              provider: request.logisticsProvider ?? 'shiprocket',
              packageWeightGrams: request.packageWeightGrams ?? 500,
              packageLengthCm: request.packageLengthCm,
              packageWidthCm: request.packageWidthCm,
              packageHeightCm: request.packageHeightCm,
            );
        if (!_current) return;
        label = labelResponse['label'] is Map
            ? Map<String, dynamic>.from(labelResponse['label'] as Map)
            : labelResponse;
        trackingNumber = label['tracking_number']?.toString();
        carrier = label['carrier']?.toString();
      }

      final updated = await context.read<OrderService>().fulfillOrder(
        order.id,
        trackingNumber: trackingNumber,
        carrier: carrier,
        createShippingLabel: false,
      );
      if (!_current) return;
      if (label != null) await _shareLabelPdf(label);
      if (_current) {
        setState(() => _order = updated);
        _showSnackBar(
          request.createShippingLabel
              ? 'Shipping label created and order shipped'
              : 'Order marked shipped',
        );
      }
    } catch (error) {
      if (_current) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _shareLabelPdf(Map<String, dynamic> label) async {
    if (!_current) return;
    final raw = label['pdf_base64']?.toString();
    if (raw == null || raw.isEmpty) return;

    final bytes = base64Decode(raw);
    final tempDir = await getTemporaryDirectory();
    if (!_current) return;
    final file = File('${tempDir.path}/shipping-label-${label['id']}.pdf');
    await file.writeAsBytes(bytes, flush: true);
    if (!_current) return;
    await Share.shareXFiles([
      XFile(file.path, mimeType: 'application/pdf'),
    ], subject: 'Shipping label ${label['tracking_number'] ?? ''}');
  }

  Future<void> _editLineItems(OrderContract order) async {
    if (!_current || !_fresh || _isLoading || _isMutating) return;
    final request = await _showLineItemsDialog(order);
    if (request == null || request.lines.isEmpty || !_current) return;

    setState(() => _isMutating = true);
    try {
      final updated = await context.read<OrderService>().updateLineItems(
        order.id,
        lines: request.lines,
      );
      if (_current) {
        setState(() => _order = updated);
        _showSnackBar('Order line items updated');
      }
    } catch (error) {
      if (_current) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _cancelOrder() async {
    final order = _order;
    if (order == null || !_current || !_fresh || _isLoading || _isMutating)
      return;

    final reason = await _showCancelReasonDialog(order);
    if (reason == null || !_current) return;

    setState(() => _isMutating = true);
    try {
      final updated = await context.read<OrderService>().cancelOrder(
        order.id,
        reason: reason,
      );
      if (_current) {
        setState(() => _order = updated);
        _showSnackBar('Order cancelled');
      }
    } catch (error) {
      if (_current) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: mobile_tokens.CustomAppBar.responsive(
        context: context,
        title: 'Order detail',
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed:
                _current && !_isLoading && !_isMutating && !_openingAction
                ? _loadOrder
                : null,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            if (_isLoading ||
                _isMutating ||
                (_openingAction && !_waitingForInput))
              Semantics(
                liveRegion: true,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      const mobile_tokens.LoadingIndicator(),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _isMutating
                              ? 'Submitting order change…'
                              : _openingAction
                              ? 'Preparing order action…'
                              : 'Loading current order…',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Expanded(child: _buildBody()),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _order == null) return const SizedBox.shrink();
    final order = _order;
    if (order == null) return _buildErrorState();
    return RefreshIndicator(
      onRefresh: () async {
        if (!_isMutating && !_openingAction) await _loadOrder();
      },
      child: ListView(
        key: PageStorageKey((_view?.key, widget.orderId)),
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null) _buildInlineWarning(_error!),
          _buildSummary(order),
          const SizedBox(height: 12),
          _buildActionBar(order),
          if (_hasRiskSignal(order)) ...[
            const SizedBox(height: 12),
            _buildRiskSignal(order),
          ],
          const SizedBox(height: 12),
          _buildCustomer(order),
          const SizedBox(height: 12),
          _buildLineItems(order),
          const SizedBox(height: 12),
          _buildTotals(order),
          const SizedBox(height: 12),
          _buildTimeline(order),
        ],
      ),
    );
  }

  Widget _buildErrorState() => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      Icon(Icons.receipt_long_outlined, size: 48, color: colors.error),
      const SizedBox(height: 12),
      Text(
        'Could not load this order',
        style: Theme.of(context).textTheme.titleLarge,
      ),
      const SizedBox(height: 12),
      Text(_error ?? 'Try again from the orders list.'),
      const SizedBox(height: 16),
      FilledButton.icon(
        onPressed: _current && !_isLoading && !_isMutating && !_openingAction
            ? _loadOrder
            : null,
        icon: const Icon(Icons.refresh),
        label: const Text('Retry'),
      ),
    ],
  );

  Widget _buildInlineWarning(String message) =>
      mobile_tokens.LetbuyyInlineFeedback(
        title: 'Current order unconfirmed',
        message: message,
      );

  Widget _buildSummary(OrderContract order) {
    final status = _status(order.status);
    return _section(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SelectableText(
            _orderNumber(order),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                _displayOrderTotal(order),
                key: const ValueKey('order-detail-total'),
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              _chip(_statusLabel(status), _statusColor(status)),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip(
                'Payment ${_statusLabel(order.paymentStatus)}',
                _statusColor(order.paymentStatus),
              ),
              _chip(
                'Fulfillment ${_statusLabel(order.fulfillmentStatus)}',
                _statusColor(order.fulfillmentStatus),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _infoRow(
            Icons.calendar_today_outlined,
            'Placed (device time)',
            _formatDate(order),
          ),
          _infoRow(
            Icons.payments_outlined,
            'Payment',
            _nonEmpty(order['payment_method']) ??
                _nonEmpty(order['payment_provider']) ??
                'Unavailable',
          ),
          _infoRow(
            Icons.local_shipping_outlined,
            'Shipping',
            _nonEmpty(order['shipping_method']) ?? 'Unavailable',
          ),
        ],
      ),
    );
  }

  Widget _buildRiskSignal(OrderContract order) {
    final visual = mobile_tokens.LetbuyyStatusColors.of(
      context,
      _statusTone(_riskColor(order)),
    );
    final color = visual.foreground;
    final level = _riskLevel(order);
    final storedLevel = order.toJson()['risk_level'];
    final hasStoredLevel =
        storedLevel is String &&
        const [
          'low',
          'medium',
          'high',
        ].contains(storedLevel.trim().toLowerCase());
    final storedScore = order.toJson()['risk_score'];
    final hasStoredScore = storedScore is num && storedScore.isFinite;

    final details = _riskDetails(order);

    return _section(
      title: 'Risk signal',
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: visual.background,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.22)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 12,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Wrap(
                  spacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Icon(Icons.shield_outlined, color: color, size: 20),
                    Text(
                      hasStoredLevel
                          ? '${_statusLabel(level)} risk'
                          : 'Risk level unavailable',
                      style: Theme.of(
                        context,
                      ).textTheme.titleSmall?.copyWith(color: color),
                    ),
                  ],
                ),
                Text(
                  hasStoredScore
                      ? 'Score $storedScore/100'
                      : 'Score unavailable',
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(color: color),
                ),
              ],
            ),
            if (details.isNotEmpty) ...[
              const SizedBox(height: 10),
              ...details.map(
                (detail) => Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.circle, color: color, size: 6),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          detail,
                          style: TextStyle(
                            color: colors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCustomer(OrderContract order) {
    return _section(
      title: 'Customer',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _customerName(order),
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          _infoRow(
            Icons.email_outlined,
            'Email',
            _nonEmpty(order.customerEmail) ?? 'No email',
          ),
          _infoRow(
            Icons.call_outlined,
            'Phone',
            _nonEmpty(order.customerPhone) ?? 'No phone',
          ),
          const SizedBox(height: 10),
          _addressBlock('Shipping address', order.jsonMap('shipping_address')),
          const SizedBox(height: 10),
          _addressBlock('Billing address', order.jsonMap('billing_address')),
        ],
      ),
    );
  }

  List<LineItemContract> _presentedLineItems(OrderContract order) {
    if (order['line_items'] is List) return order.lineItems;
    // The existing API normalizer emits order_items/items with title. This
    // read-only view leaves the cached DTO and every command input unchanged.
    final raw = order['order_items'] ?? order['items'];
    if (raw is! List || raw.any((row) => row is! Map)) return const [];
    return raw
        .map((row) {
          final source = Map<String, dynamic>.from(row as Map);
          return LineItemContract.fromJson({
            ...source,
            if (source['name'] == null) 'name': source['title'],
            if (source['currency'] == null) 'currency': order['currency'] ?? '',
          });
        })
        .toList(growable: false);
  }

  Widget _buildLineItems(OrderContract order) {
    final items = _presentedLineItems(order);
    return _section(
      title: 'Line items',
      action: order.lineItems.isEmpty
          ? null
          : TextButton.icon(
              onPressed: _ready
                  ? () => _runAction(() => _editLineItems(order))
                  : null,
              icon: const Icon(Icons.edit_outlined, size: 16),
              label: const Text('Edit'),
            ),
      child: items.isEmpty
          ? Text(
              'No line items returned for this order.',
              style: TextStyle(color: colors.textSecondary),
            )
          : Column(
              children: [
                if (order['line_items'] is! List) ...[
                  const mobile_tokens.LetbuyyInlineFeedback(
                    title: 'Line changes unavailable',
                    message:
                        'The current order read does not include the line references needed for editing or item refunds. Reload to recheck.',
                  ),
                  const SizedBox(height: 12),
                ],
                for (final item in items) ...[
                  _lineItem(item),
                  if (item != items.last)
                    Divider(height: 20, color: colors.divider),
                ],
              ],
            ),
    );
  }

  Widget _lineItem(LineItemContract item) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        item.name.isEmpty ? 'Item' : item.name,
        style: Theme.of(context).textTheme.titleMedium,
      ),
      const SizedBox(height: 8),
      Wrap(
        spacing: 12,
        runSpacing: 8,
        children: [
          if (_nonEmpty(item.sku) != null) Text('SKU ${item.sku}'),
          Text(
            item['quantity'] == null
                ? 'Quantity unavailable'
                : 'Qty ${item.quantity}',
          ),
          Text(
            'Unit price ${_displayStoredMoney(item['unit_price'], item.currency)}',
          ),
          Text(
            'Line total ${_displayStoredMoney(item['total'], item.currency)}',
          ),
        ],
      ),
    ],
  );

  Widget _buildTotals(OrderContract order) {
    return _section(
      title: 'Totals',
      child: Column(
        children: [
          _totalRow(
            'Subtotal',
            order.subtotal,
            display: _displayStoredMoney(order['subtotal'], order.currency),
          ),
          _totalRow(
            'Discount',
            -order.discountAmount,
            display: _displayStoredMoney(
              order['discount_amount'],
              order.currency,
              negate: true,
            ),
          ),
          _totalRow(
            'Shipping',
            order.shippingAmount,
            display: _displayStoredMoney(
              order['shipping_amount'],
              order.currency,
            ),
          ),
          _totalRow(
            'Tax',
            order.taxAmount,
            display: _displayStoredMoney(order['tax_amount'], order.currency),
          ),
          Divider(height: 20, color: colors.divider),
          _totalRow(
            'Total',
            _orderTotal(order),
            display: _displayOrderTotal(order),
            isStrong: true,
          ),
        ],
      ),
    );
  }

  Widget _buildTimeline(OrderContract order) {
    final entries = _timelineEntries(order);
    return _section(
      title:
          order['timeline'] is List &&
              (order['timeline'] as List).whereType<Map>().isNotEmpty
          ? 'Timeline'
          : 'Current order summary',
      child: Column(
        children: [
          for (var index = 0; index < entries.length; index++)
            _timelineRow(entries[index], isLast: index == entries.length - 1),
        ],
      ),
    );
  }

  Widget _timelineRow(_TimelineEntry entry, {required bool isLast}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: entry.color,
                shape: BoxShape.circle,
              ),
            ),
            if (!isLast)
              Container(
                width: 1,
                height: 46,
                color: colors.divider,
                margin: const EdgeInsets.symmetric(vertical: 4),
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  entry.subtitle,
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActionBar(OrderContract order) {
    final status = _status(order.status);
    final canFulfill =
        status != 'shipped' &&
        status != 'delivered' &&
        status != 'cancelled' &&
        status != 'refunded';
    final canRefund = status != 'cancelled' && status != 'refunded';
    final canCancel =
        status != 'cancelled' && status != 'refunded' && status != 'delivered';

    return _section(
      title: 'Order actions',
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          if (canFulfill)
            _actionButton(
              icon: Icons.local_shipping_outlined,
              label: 'Fulfill',
              onPressed: _isMutating ? null : _fulfillOrder,
            ),
          if (canRefund)
            _actionButton(
              icon: Icons.currency_exchange_rounded,
              label: 'Refund',
              onPressed: _isMutating ? null : _issueRefund,
              isDestructive: true,
            ),
          if (canCancel)
            _actionButton(
              icon: Icons.cancel_outlined,
              label: 'Cancel',
              onPressed: _isMutating ? null : _cancelOrder,
              isDestructive: true,
            ),
          _actionButton(
            icon: Icons.done_all_rounded,
            label: 'Complete refund',
            onPressed: _isMutating ? null : _completeRefund,
          ),
        ],
      ),
    );
  }

  Widget _section({String? title, Widget? action, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                if (action != null) action,
              ],
            ),
            const SizedBox(height: 12),
          ],
          child,
        ],
      ),
    );
  }

  mobile_tokens.LetbuyyStatusTone _statusTone(Color color) =>
      color == colors.success
      ? mobile_tokens.LetbuyyStatusTone.success
      : color == colors.warning
      ? mobile_tokens.LetbuyyStatusTone.warning
      : color == colors.error
      ? mobile_tokens.LetbuyyStatusTone.danger
      : color == colors.accentBlue
      ? mobile_tokens.LetbuyyStatusTone.information
      : mobile_tokens.LetbuyyStatusTone.neutral;

  Widget _chip(String label, Color color) =>
      mobile_tokens.LetbuyyStatusBadge(label: label, tone: _statusTone(color));

  Widget _infoRow(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: colors.textSecondary, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(label, style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 4),
              SelectableText(value),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _addressBlock(String title, Map<String, dynamic> address) {
    final lines = [
      _nonEmpty(address['name']),
      _nonEmpty(address['line1']) ?? _nonEmpty(address['address_line1']),
      _nonEmpty(address['line2']) ?? _nonEmpty(address['address_line2']),
      [
        _nonEmpty(address['city']),
        _nonEmpty(address['state']),
        _nonEmpty(address['postal_code']) ?? _nonEmpty(address['pincode']),
      ].whereType<String>().join(', '),
      _nonEmpty(address['country']),
    ].whereType<String>().where((line) => line.isNotEmpty).toList();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            lines.isEmpty ? 'No address returned' : lines.join('\n'),
            style: TextStyle(color: colors.textPrimary, height: 1.35),
          ),
        ],
      ),
    );
  }

  Widget _totalRow(
    String label,
    double amount, {
    String? display,
    bool isStrong = false,
  }) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Wrap(
      spacing: 16,
      runSpacing: 8,
      alignment: WrapAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: isStrong
              ? Theme.of(context).textTheme.titleMedium
              : Theme.of(context).textTheme.bodyLarge,
        ),
        Text(
          display ?? _money(amount),
          style: isStrong
              ? Theme.of(context).textTheme.titleMedium
              : Theme.of(context).textTheme.bodyLarge,
        ),
      ],
    ),
  );

  Widget _actionButton({
    required IconData icon,
    required String label,
    required Future<void> Function()? onPressed,
    bool isDestructive = false,
  }) {
    final color = isDestructive
        ? Theme.of(context).colorScheme.error
        : Theme.of(context).colorScheme.primary;
    return OutlinedButton.icon(
      onPressed: _ready && onPressed != null
          ? () {
              if (_ready) _runAction(onPressed);
            }
          : null,
      icon: _isMutating && onPressed == null
          ? SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: color),
            )
          : Icon(icon, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        foregroundColor: color,
        side: BorderSide(color: color.withValues(alpha: 0.45)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Future<_RefundRequest?> _showRefundDialog(
    OrderContract order, {
    JsonMap? pending,
  }) async {
    final Iterable<JsonMap> savedLines = pending == null
        ? const []
        : asJsonList(pending['lines']).map(asJsonMap);
    final quantities = {
      for (final line in savedLines) line['order_item_id']: line['quantity'],
    };
    final controllers = <LineItemContract, TextEditingController>{
      for (final item in order.lineItems)
        if (item.id.isNotEmpty)
          item: TextEditingController(
            text: quantities[item.id]?.toString() ?? '0',
          ),
    };
    final reason = TextEditingController(text: pending?['reason']?.toString());
    bool returned = false;
    bool changed() =>
        controllers.entries.any(
          (entry) =>
              entry.value.text != (quantities[entry.key.id]?.toString() ?? '0'),
        ) ||
        reason.text != (pending?['reason']?.toString() ?? '');
    return _showOrderEditor<_RefundRequest>(
      title: 'Request item refund',
      controllers: [...controllers.values, reason],
      hasChanges: changed,
      bodyBuilder: (_, __) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Choose the quantity to return for each item. Refundable quantities and the final refund amount are checked by the server.',
          ),
          if (pending != null)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text(
                'A saved request is waiting. Retry its original quantities and reason.',
              ),
            ),
          if (controllers.isEmpty)
            const Text(
              'Order lines are unavailable. Reload this order before requesting a refund.',
            ),
          for (final entry in controllers.entries)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: mobile_tokens.CustomTextField(
                controller: entry.value,
                enabled: pending == null,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                label: 'Return quantity: ${entry.key.name}',
                helperText: 'Ordered: ${entry.key.quantity}',
              ),
            ),
          const SizedBox(height: 16),
          mobile_tokens.CustomTextField(
            controller: reason,
            enabled: pending == null,
            label: 'Reason',
          ),
        ],
      ),
      actionsBuilder: (dialogContext) => [
        TextButton(
          onPressed: () => mobile_tokens.dismissLetbuyySurface(dialogContext),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: controllers.isEmpty
              ? null
              : () {
                  if (!_current ||
                      returned ||
                      !mobile_tokens.isLetbuyySurfaceCurrent(dialogContext))
                    return;
                  final lines = <JsonMap>[];
                  for (final entry in controllers.entries) {
                    final quantity = int.tryParse(entry.value.text.trim());
                    if (quantity == null ||
                        quantity < 0 ||
                        quantity > entry.key.quantity) {
                      _formError(
                        dialogContext,
                        'Enter a return quantity between 0 and the ordered quantity.',
                      );
                      return;
                    }
                    if (quantity > 0)
                      lines.add({
                        'order_item_id': entry.key.id,
                        'quantity': quantity,
                      });
                  }
                  if (lines.isEmpty) {
                    _formError(
                      dialogContext,
                      'Choose at least one item to return.',
                    );
                    return;
                  }
                  returned = true;
                  mobile_tokens.completeLetbuyySurface(
                    dialogContext,
                    _RefundRequest(lines: lines, reason: reason.text.trim()),
                  );
                },
          child: Text(
            pending == null ? 'Request refund' : 'Retry original request',
          ),
        ),
      ],
    );
  }

  Future<String?> _showCancelReasonDialog(OrderContract order) =>
      _showCurrentSheet<String>(
        _DetailCancellationSheet(view: _view!, number: _orderNumber(order)),
      );

  Future<_CompleteRefundRequest?> _showCompleteRefundDialog({
    JsonMap? pending,
  }) => _showCurrentSheet<_CompleteRefundRequest>(
    _DetailRefundCompletionSheet(
      view: _view!,
      initialRefundId:
          pending?['refund_id']?.toString() ??
          _order?.toJson()['refund_id']?.toString(),
      initialProviderRefundId: pending?['provider_refund_id']?.toString(),
    ),
  );

  Future<_TrackingRequest?> _showTrackingDialog() async {
    final carrierController = TextEditingController();
    final trackingController = TextEditingController();
    final weightController = TextEditingController(text: '500');
    final lengthController = TextEditingController(text: '10');
    final widthController = TextEditingController(text: '10');
    final heightController = TextEditingController(text: '5');
    var createShippingLabel = false;
    var logisticsProvider = AppConfig.normalizedDefaultLogisticsProvider;
    Map<String, dynamic>? providerRead;
    bool providerPending = false;
    int providerGeneration = 0;
    bool bookingAvailable() {
      final capabilities = providerRead?['capabilities'];
      final mode = ProviderMode.parse(providerRead?['provider_mode']);
      return !providerPending &&
          mode != null &&
          capabilities is Map &&
          capabilities['carrier_booking_available'] == true &&
          ProviderMode.parse(capabilities['provider_mode']) == mode;
    }

    Future<void> checkProvider(BuildContext page, StateSetter update) async {
      if (!_current ||
          !mobile_tokens.isLetbuyySurfaceCurrent(page) ||
          providerPending)
        return;
      final generation = ++providerGeneration;
      update(() {
        providerPending = true;
        providerRead = null;
      });
      bool current() =>
          _current &&
          page.mounted &&
          mobile_tokens.isLetbuyySurfaceCurrent(page) &&
          createShippingLabel &&
          generation == providerGeneration;
      try {
        final result = await context
            .read<OrderService>()
            .fetchShippingProviderMode(_view!.storeId);
        if (current())
          update(() {
            providerRead = result;
            providerPending = false;
          });
      } catch (_) {
        if (current())
          update(() {
            providerRead = null;
            providerPending = false;
          });
      }
    }

    bool returned = false;
    return _showOrderEditor<_TrackingRequest>(
      title: 'Fulfill order',
      controllers: [
        carrierController,
        trackingController,
        weightController,
        lengthController,
        widthController,
        heightController,
      ],
      hasChanges: () =>
          createShippingLabel ||
          logisticsProvider != AppConfig.normalizedDefaultLogisticsProvider ||
          carrierController.text.isNotEmpty ||
          trackingController.text.isNotEmpty ||
          weightController.text != '500' ||
          lengthController.text != '10' ||
          widthController.text != '10' ||
          heightController.text != '5',
      bodyBuilder: (formContext, setFormState) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            value: createShippingLabel,
            title: const Text('Buy shipping label'),
            subtitle: const Text(
              'Use your configured carrier integration to request a label, then mark the order shipped.',
            ),
            onChanged: (value) {
              if (!_current ||
                  !mobile_tokens.isLetbuyySurfaceCurrent(formContext))
                return;
              setFormState(() {
                createShippingLabel = value;
                providerGeneration++;
                providerRead = null;
                providerPending = false;
              });
              if (value) checkProvider(formContext, setFormState);
            },
          ),
          if (createShippingLabel) ...[
            if (providerPending)
              const Row(
                children: [
                  mobile_tokens.LoadingIndicator(),
                  SizedBox(width: 12),
                  Expanded(child: Text('Checking provider status…')),
                ],
              )
            else if (ProviderMode.parse(providerRead?['provider_mode']) != null)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const Text('Provider mode'),
                  ProviderModeBadge(
                    mode: ProviderMode.parse(providerRead?['provider_mode']),
                  ),
                ],
              )
            else
              const Text('Provider status unavailable'),
            if (!providerPending && providerRead != null && !bookingAvailable())
              const Text(
                'Carrier booking unavailable. Use manual fulfillment or check your carrier setup.',
              ),
            if (ProviderMode.parse(providerRead?['provider_mode']) ==
                ProviderMode.sandbox)
              const Text('Sandbox labels do not book a real shipment.'),
            TextButton.icon(
              onPressed: providerPending
                  ? null
                  : () => checkProvider(formContext, setFormState),
              icon: const Icon(Icons.refresh),
              label: const Text('Recheck provider status'),
            ),
            const SizedBox(height: 16),
            mobile_tokens.LetbuyyChoiceField<String>(
              label: 'Carrier account',
              value: logisticsProvider,
              choices: const [
                mobile_tokens.LetbuyyChoice(
                  value: 'shiprocket',
                  label: 'Shiprocket',
                ),
                mobile_tokens.LetbuyyChoice(
                  value: 'delhivery',
                  label: 'Delhivery',
                ),
                mobile_tokens.LetbuyyChoice(value: 'pickrr', label: 'Pickrr'),
              ],
              onChanged: (value) =>
                  setFormState(() => logisticsProvider = value),
            ),
            const SizedBox(height: 16),
            mobile_tokens.CustomTextField(
              controller: weightController,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.next,
              label: 'Package weight (grams)',
            ),
            const SizedBox(height: 16),
            mobile_tokens.CustomTextField(
              controller: lengthController,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.next,
              label: 'Length (cm)',
            ),
            const SizedBox(height: 16),
            mobile_tokens.CustomTextField(
              controller: widthController,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.next,
              label: 'Width (cm)',
            ),
            const SizedBox(height: 16),
            mobile_tokens.CustomTextField(
              controller: heightController,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              label: 'Height (cm)',
            ),
          ] else ...[
            const SizedBox(height: 16),
            mobile_tokens.CustomTextField(
              controller: carrierController,
              label: 'Carrier',
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),
            mobile_tokens.CustomTextField(
              controller: trackingController,
              label: 'Tracking number',
              textInputAction: TextInputAction.done,
            ),
          ],
        ],
      ),
      actionsBuilder: (page) => [
        TextButton(
          onPressed: () => mobile_tokens.dismissLetbuyySurface(page),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: createShippingLabel && !bookingAvailable()
              ? null
              : () {
                  if (!_current ||
                      returned ||
                      !mobile_tokens.isLetbuyySurfaceCurrent(page))
                    return;
                  returned = true;
                  mobile_tokens.completeLetbuyySurface(
                    page,
                    _TrackingRequest(
                      carrier: carrierController.text.trim(),
                      trackingNumber: trackingController.text.trim(),
                      createShippingLabel: createShippingLabel,
                      logisticsProvider: createShippingLabel
                          ? logisticsProvider
                          : null,
                      packageWeightGrams: createShippingLabel
                          ? int.tryParse(weightController.text.trim())
                          : null,
                      packageLengthCm: createShippingLabel
                          ? double.tryParse(lengthController.text.trim())
                          : null,
                      packageWidthCm: createShippingLabel
                          ? double.tryParse(widthController.text.trim())
                          : null,
                      packageHeightCm: createShippingLabel
                          ? double.tryParse(heightController.text.trim())
                          : null,
                    ),
                  );
                },
          child: Text(createShippingLabel ? 'Buy label + ship' : 'Ship'),
        ),
      ],
    );
  }

  Future<_LineItemsRequest?> _showLineItemsDialog(OrderContract order) async {
    final controllers = <LineItemContract, TextEditingController>{
      for (final item in order.lineItems)
        if (item.id.isNotEmpty)
          item: TextEditingController(text: item.quantity.toString()),
    };
    bool returned = false;
    return _showOrderEditor<_LineItemsRequest>(
      title: 'Edit line items',
      controllers: controllers.values.toList(growable: false),
      hasChanges: () => controllers.entries.any(
        (entry) => entry.value.text != entry.key.quantity.toString(),
      ),
      bodyBuilder: (_, __) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Set quantity to 0 to remove a line. Totals are recalculated on the server.',
          ),
          for (final entry in controllers.entries)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: mobile_tokens.CustomTextField(
                controller: entry.value,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                label:
                    'Quantity: ${entry.key.name.isEmpty ? 'Item' : entry.key.name}',
                helperText: int.tryParse(entry.value.text.trim()) == null
                    ? 'This entry cannot be read. Saving keeps the current quantity of ${entry.key.quantity}.'
                    : 'Current quantity: ${entry.key.quantity}. Enter 0 to remove this line.',
              ),
            ),
        ],
      ),
      actionsBuilder: (page) => [
        TextButton(
          onPressed: () => mobile_tokens.dismissLetbuyySurface(page),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            if (!_current ||
                returned ||
                !mobile_tokens.isLetbuyySurfaceCurrent(page))
              return;
            final lines = controllers.entries
                .map((entry) {
                  return {
                    'order_item_id': entry.key.id,
                    'quantity':
                        int.tryParse(entry.value.text.trim()) ??
                        entry.key.quantity,
                  };
                })
                .toList(growable: false);
            returned = true;
            mobile_tokens.completeLetbuyySurface(
              page,
              _LineItemsRequest(lines: lines),
            );
          },
          child: const Text('Save'),
        ),
      ],
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!_current || ModalRoute.of(context)?.isCurrent != true) return;
    mobile_tokens.showLetbuyyOperationFeedback(
      context,
      message: message,
      isError: isError,
    );
  }

  List<_TimelineEntry> _timelineEntries(OrderContract order) {
    final rawTimeline = order['timeline'];
    if (rawTimeline is List) {
      final parsed = rawTimeline.whereType<Map>().map((entry) {
        final title =
            _nonEmpty(entry['title']) ??
            _nonEmpty(entry['event']) ??
            _nonEmpty(entry['status']) ??
            'Order update';
        final timestamp =
            _nonEmpty(entry['created_at']) ??
            _nonEmpty(entry['timestamp']) ??
            _nonEmpty(entry['time']);
        return _TimelineEntry(
          title: title,
          subtitle: timestamp == null
              ? 'Time unavailable'
              : _formatRawDate(timestamp),
          color: _statusColor(_nonEmpty(entry['status']) ?? order.status),
        );
      }).toList();
      if (parsed.isNotEmpty) return parsed;
    }

    final entries = <_TimelineEntry>[
      _TimelineEntry(
        title: 'Order placed',
        subtitle: _formatDate(order),
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
      _TimelineEntry(
        title: 'Payment ${_statusLabel(order.paymentStatus)}',
        subtitle: _nonEmpty(order['payment_id']) ?? 'Payment reference pending',
        color: _statusColor(order.paymentStatus),
      ),
      _TimelineEntry(
        title: 'Fulfillment ${_statusLabel(order.fulfillmentStatus)}',
        subtitle:
            _nonEmpty(order['tracking_number']) ??
            _nonEmpty(order['tracking_url']) ??
            'Tracking not added',
        color: _statusColor(order.fulfillmentStatus),
      ),
      _TimelineEntry(
        title: 'Current status ${_statusLabel(order.status)}',
        subtitle: _formatRawDate(
          _nonEmpty(order['updated_at']) ??
              _nonEmpty(order['created_at']) ??
              '',
        ),
        color: _statusColor(order.status),
      ),
    ];
    return entries;
  }

  String _orderNumber(OrderContract? order) {
    if (order == null) return 'Order';
    return order.orderNumber.isNotEmpty ? order.orderNumber : order.id;
  }

  String _customerName(OrderContract order) {
    final name = order.customerName?.trim();
    return name?.isNotEmpty == true ? name! : 'Customer';
  }

  String _status(String value) {
    final normalized = value.trim().toLowerCase();
    return normalized.isEmpty ? 'unknown' : normalized;
  }

  String _statusLabel(String status) {
    final normalized = _status(status).replaceAll('_', ' ');
    return normalized
        .split(' ')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  Color _statusColor(String status) {
    switch (_status(status)) {
      case 'paid':
      case 'delivered':
      case 'fulfilled':
      case 'complete':
      case 'completed':
        return colors.success;
      case 'pending':
      case 'processing':
      case 'unfulfilled':
      case 'authorized':
        return colors.warning;
      case 'cancelled':
      case 'canceled':
      case 'failed':
      case 'refunded':
        return colors.error;
      case 'shipped':
      case 'in_transit':
        return colors.accentBlue;
      default:
        return mobile_tokens.LetbuyyColorTokens.brandPrimary;
    }
  }

  bool _hasRiskSignal(OrderContract order) {
    final level = _riskLevel(order);
    return order.riskScore > 0 ||
        level == 'medium' ||
        level == 'high' ||
        _status(order.fulfillmentState ?? '') == 'hold' ||
        _status(order.codConfirmationStatus ?? '') == 'requested' ||
        _status(order.rtoStatus ?? '') == 'at_risk';
  }

  String _riskLevel(OrderContract order) {
    final level = _status(order.riskLevel);
    return (level == 'medium' || level == 'high') ? level : 'low';
  }

  Color _riskColor(OrderContract order) {
    switch (_riskLevel(order)) {
      case 'high':
        return colors.error;
      case 'medium':
        return colors.warning;
      default:
        return colors.accentBlue;
    }
  }

  List<String> _riskDetails(OrderContract order) {
    final details = <String>[];
    if (_status(order.fulfillmentState ?? '') == 'hold') {
      details.add('Fulfillment hold is active.');
    }
    if (_status(order.codConfirmationStatus ?? '') == 'requested') {
      details.add('COD confirmation requested.');
    }
    if (_status(order.rtoStatus ?? '') == 'at_risk') {
      details.add('RTO watchlist active.');
    }
    if (details.isEmpty) {
      details.add('Review this order before fulfillment.');
    }
    return details;
  }

  double _orderTotal(OrderContract order) {
    if (order.total > 0) return order.total;
    return order.lineItems.fold(0.0, (sum, item) => sum + item.total);
  }

  String _money(double amount) {
    final value = PriceFormatter.formatPrice(amount.abs());
    return amount < 0 ? '-$value' : value;
  }

  String _displayStoredMoney(
    Object? raw,
    String currency, {
    bool negate = false,
  }) {
    final value = raw is num
        ? raw.toDouble()
        : raw is String
        ? double.tryParse(raw)
        : null;
    if (value == null || !value.isFinite) return 'Unavailable';
    // Preserve an unfamiliar currency's original value rather than silently
    // relabelling it INR or applying an invented currency conversion.
    if (currency != 'INR') return '${negate ? '-' : ''}$currency $raw';
    return _money(negate ? -value : value);
  }

  String _displayOrderTotal(OrderContract order) {
    final raw = order['total'];
    final value = raw is num
        ? raw.toDouble()
        : raw is String
        ? double.tryParse(raw)
        : null;
    if (value == null || !value.isFinite) return 'Total unavailable';
    if (order.currency != 'INR')
      return _displayStoredMoney(raw, order.currency);
    // Keep the protected calculation unchanged. Its positive-total branch
    // agrees with the stored value; zero is displayed directly, never inferred
    // from a fallback line sum as an acknowledged order total.
    return _money(order.total > 0 ? _orderTotal(order) : value);
  }

  String _formatDate(OrderContract order) {
    final raw = _nonEmpty(order['created_at']) ?? _nonEmpty(order['createdAt']);
    return _formatRawDate(raw ?? '');
  }

  String _formatRawDate(String raw) {
    final date = DateTime.tryParse(raw);
    if (date == null) return raw.isEmpty ? 'Time unavailable' : raw;
    return DateFormat('MMM d, yyyy h:mm a').format(date.toLocal());
  }

  String? _nonEmpty(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }
}

class _TimelineEntry {
  const _TimelineEntry({
    required this.title,
    required this.subtitle,
    required this.color,
  });

  final String title;
  final String subtitle;
  final Color color;
}

class _RefundRequest {
  const _RefundRequest({required this.lines, required this.reason});

  final List<JsonMap> lines;
  final String reason;
}

class _CompleteRefundRequest {
  const _CompleteRefundRequest({
    required this.refundId,
    required this.providerRefundId,
    required this.notes,
  });

  final String refundId;
  final String providerRefundId;
  final String notes;
}

class _TrackingRequest {
  const _TrackingRequest({
    required this.carrier,
    required this.trackingNumber,
    this.createShippingLabel = false,
    this.logisticsProvider,
    this.packageWeightGrams,
    this.packageLengthCm,
    this.packageWidthCm,
    this.packageHeightCm,
  });

  final String carrier;
  final String trackingNumber;
  final bool createShippingLabel;
  final String? logisticsProvider;
  final int? packageWeightGrams;
  final double? packageLengthCm;
  final double? packageWidthCm;
  final double? packageHeightCm;
}

class _LineItemsRequest {
  const _LineItemsRequest({required this.lines});

  final List<Map<String, dynamic>> lines;
}

class _DetailCancellationSheet extends StatefulWidget {
  const _DetailCancellationSheet({required this.view, required this.number});
  final MerchantStoreView view;
  final String number;
  @override
  State<_DetailCancellationSheet> createState() =>
      _DetailCancellationSheetState();
}

class _DetailCancellationSheetState extends State<_DetailCancellationSheet> {
  final reasonController = TextEditingController();
  String reason = '';
  bool returned = false;
  bool get _current =>
      mounted && merchantStoreViewCurrent(context, widget.view);
  @override
  void dispose() {
    reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => mobile_tokens.LetbuyyFormSheet(
    title: 'Cancel ${widget.number}?',
    description: 'Add a cancellation reason for the order timeline.',
    actions: [
      TextButton(
        onPressed: () => mobile_tokens.completeLetbuyySurface(context),
        child: const Text('Keep order'),
      ),
      FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: Theme.of(context).colorScheme.error,
          foregroundColor: Theme.of(context).colorScheme.onError,
        ),
        onPressed: reason.isEmpty
            ? null
            : () {
                if (!_current ||
                    returned ||
                    !mobile_tokens.isLetbuyySurfaceCurrent(context))
                  return;
                returned = true;
                mobile_tokens.completeLetbuyySurface(context, reason);
              },
        child: const Text('Cancel order'),
      ),
    ],
    child: mobile_tokens.CustomTextField(
      controller: reasonController,
      label: 'Cancellation reason',
      autofocus: true,
      maxLines: 3,
      maxLength: 500,
      onChanged: (value) => setState(() => reason = value.trim()),
    ),
  );
}

class _DetailRefundCompletionSheet extends StatefulWidget {
  const _DetailRefundCompletionSheet({
    required this.view,
    this.initialRefundId,
    this.initialProviderRefundId,
  });
  final MerchantStoreView view;
  final String? initialRefundId, initialProviderRefundId;
  @override
  State<_DetailRefundCompletionSheet> createState() =>
      _DetailRefundCompletionSheetState();
}

class _DetailRefundCompletionSheetState
    extends State<_DetailRefundCompletionSheet> {
  late final refundIdController = TextEditingController(
    text: widget.initialRefundId,
  );
  late final providerRefundIdController = TextEditingController(
    text: widget.initialProviderRefundId,
  );
  final notesController = TextEditingController();
  bool returned = false;
  bool get _current =>
      mounted && merchantStoreViewCurrent(context, widget.view);
  @override
  void dispose() {
    refundIdController.dispose();
    providerRefundIdController.dispose();
    notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => mobile_tokens.LetbuyyFormSheet(
    title: 'Complete refund',
    description:
        'The existing security approval and server confirmation are required after these references are submitted.',
    actions: [
      TextButton(
        onPressed: () => mobile_tokens.completeLetbuyySurface(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          if (!_current ||
              returned ||
              !mobile_tokens.isLetbuyySurfaceCurrent(context))
            return;
          returned = true;
          mobile_tokens.completeLetbuyySurface(
            context,
            _CompleteRefundRequest(
              refundId: refundIdController.text.trim(),
              providerRefundId: providerRefundIdController.text.trim(),
              notes: notesController.text.trim(),
            ),
          );
        },
        child: const Text('Complete'),
      ),
    ],
    child: Column(
      children: [
        mobile_tokens.CustomTextField(
          controller: refundIdController,
          label: 'Refund ID',
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 16),
        mobile_tokens.CustomTextField(
          controller: providerRefundIdController,
          label: 'Provider refund ID',
          textInputAction: TextInputAction.done,
        ),
        const SizedBox(height: 16),
        mobile_tokens.CustomTextField(
          controller: notesController,
          readOnly: true,
          minLines: 2,
          maxLines: 3,
          label: 'Notes',
          helperText: 'Add completion notes on the return.',
        ),
      ],
    ),
  );
}
