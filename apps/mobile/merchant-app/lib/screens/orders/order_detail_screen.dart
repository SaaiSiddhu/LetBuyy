import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../config/app_config.dart';
import '../../services/order_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import '../../widgets/shared/provider_mode_badge.dart';

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

  @override
  void initState() {
    super.initState();
    _order = widget.initialOrder;
    _loadOrder(preferCached: true);
  }

  Future<void> _loadOrder({bool preferCached = false}) async {
    if (widget.orderId.trim().isEmpty) {
      setState(() {
        _isLoading = false;
        _error = 'Order id is missing.';
      });
      return;
    }

    final service = context.read<OrderService>();
    if (preferCached) {
      final cached = _order ?? service.cachedOrder(widget.orderId);
      if (cached != null) {
        setState(() {
          _order = cached;
          _isLoading = false;
          _error = null;
        });
        return;
      }
    }

    setState(() {
      _isLoading = _order == null;
      _error = null;
    });

    try {
      final order = await service.fetchOrder(widget.orderId);
      if (mounted) {
        setState(() {
          _order = order;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _issueRefund() async {
    final order = _order;
    if (order == null) return;

    final request = await _showRefundDialog(order);
    if (request == null) return;

    setState(() => _isMutating = true);
    try {
      final updated = await context.read<OrderService>().refundOrder(
        order.id,
        amount: request.amount,
        reason: request.reason,
      );
      if (mounted) {
        setState(() => _order = updated);
        _showSnackBar('Refund requested for ${_money(request.amount)}');
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isMutating = false);
    }
  }

  Future<void> _completeRefund() async {
    final order = _order;
    if (order == null) return;

    final request = await _showCompleteRefundDialog();
    if (request == null) return;

    setState(() => _isMutating = true);
    try {
      final updated = await context.read<OrderService>().completeRefund(
        order.id,
        refundId: request.refundId,
        providerRefundId: request.providerRefundId,
        notes: request.notes,
      );
      if (mounted) {
        setState(() => _order = updated);
        _showSnackBar('Refund completed');
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isMutating = false);
    }
  }

  Future<void> _fulfillOrder() async {
    final order = _order;
    if (order == null) return;

    final request = await _showTrackingDialog();
    if (request == null) return;

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
      if (label != null) await _shareLabelPdf(label);
      if (mounted) {
        setState(() => _order = updated);
        _showSnackBar(
          request.createShippingLabel
              ? 'Shipping label created and order shipped'
              : 'Order marked shipped',
        );
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isMutating = false);
    }
  }

  Future<void> _shareLabelPdf(Map<String, dynamic> label) async {
    final raw = label['pdf_base64']?.toString();
    if (raw == null || raw.isEmpty) return;

    final bytes = base64Decode(raw);
    final tempDir = await getTemporaryDirectory();
    final file = File('${tempDir.path}/shipping-label-${label['id']}.pdf');
    await file.writeAsBytes(bytes, flush: true);
    await Share.shareXFiles([
      XFile(file.path, mimeType: 'application/pdf'),
    ], subject: 'Shipping label ${label['tracking_number'] ?? ''}');
  }

  Future<void> _editLineItems(OrderContract order) async {
    final request = await _showLineItemsDialog(order);
    if (request == null || request.lines.isEmpty) return;

    setState(() => _isMutating = true);
    try {
      final updated = await context.read<OrderService>().updateLineItems(
        order.id,
        lines: request.lines,
      );
      if (mounted) {
        setState(() => _order = updated);
        _showSnackBar('Order line items updated');
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isMutating = false);
    }
  }

  Future<void> _cancelOrder() async {
    final order = _order;
    if (order == null) return;

    final reason = await _showCancelReasonDialog(order);
    if (reason == null) return;

    setState(() => _isMutating = true);
    try {
      final updated = await context.read<OrderService>().cancelOrder(
        order.id,
        reason: reason,
      );
      if (mounted) {
        setState(() => _order = updated);
        _showSnackBar('Order cancelled');
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isMutating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(child: _buildBody()),
              if (_order != null) _buildActionBar(_order!),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
            tooltip: 'Back',
            onPressed: () => Navigator.pop(context),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _orderNumber(_order),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  'Order detail',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            tooltip: 'Refresh',
            onPressed: _loadOrder,
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _order == null) {
      return Center(
        child: CircularProgressIndicator(
          color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        ),
      );
    }

    final order = _order;
    if (order == null) {
      return _buildErrorState();
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _loadOrder,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          if (_error != null) _buildInlineWarning(_error!),
          _buildSummary(order),
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

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.receipt_long_outlined, size: 48, color: colors.error),
            const SizedBox(height: 12),
            Text(
              'Could not load this order',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? 'Try again from the orders list.',
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loadOrder,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInlineWarning(String message) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.warning.withValues(alpha: 0.24)),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline_rounded, color: colors.warning, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: colors.textSecondary, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummary(OrderContract order) {
    final status = _status(order.status);
    return _section(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _money(_orderTotal(order)),
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
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
          const SizedBox(height: 14),
          _infoRow(Icons.calendar_today_outlined, 'Placed', _formatDate(order)),
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
            _nonEmpty(order['shipping_method']) ?? 'Not selected',
          ),
        ],
      ),
    );
  }

  Widget _buildRiskSignal(OrderContract order) {
    final color = _riskColor(order);
    final level = _riskLevel(order);
    final details = _riskDetails(order);

    return _section(
      title: 'Risk signal',
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.22)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.shield_outlined, color: color, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${_statusLabel(level)} risk',
                    style: TextStyle(
                      color: color,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Text(
                  'Score ${order.riskScore}/100',
                  style: TextStyle(
                    color: color,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
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

  Widget _buildLineItems(OrderContract order) {
    final items = order.lineItems;
    return _section(
      title: 'Line items',
      action: items.isEmpty
          ? null
          : TextButton.icon(
              onPressed: _isMutating ? null : () => _editLineItems(order),
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
                for (final item in items) ...[
                  _lineItem(item),
                  if (item != items.last)
                    Divider(height: 20, color: colors.divider),
                ],
              ],
            ),
    );
  }

  Widget _lineItem(LineItemContract item) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: colors.divider),
          ),
          child: Icon(
            Icons.inventory_2_outlined,
            color: colors.textSecondary,
            size: 20,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.name.isEmpty ? 'Item' : item.name,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                [
                  if (_nonEmpty(item.sku) != null) 'SKU ${item.sku}',
                  'Qty ${item.quantity}',
                  _money(item.unitPrice),
                ].join(' | '),
                style: TextStyle(color: colors.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text(
          _money(item.total),
          style: TextStyle(
            color: colors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  Widget _buildTotals(OrderContract order) {
    return _section(
      title: 'Totals',
      child: Column(
        children: [
          _totalRow('Subtotal', order.subtotal),
          _totalRow('Discount', -order.discountAmount),
          _totalRow('Shipping', order.shippingAmount),
          _totalRow('Tax', order.taxAmount),
          Divider(height: 20, color: colors.divider),
          _totalRow('Total', _orderTotal(order), isStrong: true),
        ],
      ),
    );
  }

  Widget _buildTimeline(OrderContract order) {
    final entries = _timelineEntries(order);
    return _section(
      title: 'Timeline',
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

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border(top: BorderSide(color: colors.divider)),
      ),
      child: SafeArea(
        top: false,
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

  Widget _chip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.24)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: colors.textTertiary, size: 16),
          const SizedBox(width: 8),
          SizedBox(
            width: 82,
            child: Text(
              label,
              style: TextStyle(color: colors.textSecondary, fontSize: 12),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

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

  Widget _totalRow(String label, double amount, {bool isStrong = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: isStrong ? colors.textPrimary : colors.textSecondary,
                fontWeight: isStrong ? FontWeight.w800 : FontWeight.w500,
              ),
            ),
          ),
          Text(
            _money(amount),
            style: TextStyle(
              color: isStrong ? colors.textPrimary : colors.textSecondary,
              fontWeight: isStrong ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionButton({
    required IconData icon,
    required String label,
    required VoidCallback? onPressed,
    bool isDestructive = false,
  }) {
    final color = isDestructive
        ? colors.error
        : mobile_tokens.LetbuyyColorTokens.brandPrimary;
    return SizedBox(
      height: 44,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: _isMutating && onPressed == null
            ? SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: color),
              )
            : Icon(icon, size: 18),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: BorderSide(color: color.withValues(alpha: 0.45)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
    );
  }

  Future<_RefundRequest?> _showRefundDialog(OrderContract order) async {
    final amountController = TextEditingController(
      text: _orderTotal(order).toStringAsFixed(0),
    );
    final reasonController = TextEditingController();

    return showDialog<_RefundRequest>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Issue refund',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amountController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                labelText: 'Amount',
                prefixText: 'INR ',
                labelStyle: TextStyle(color: colors.textSecondary),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              minLines: 2,
              maxLines: 3,
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                labelText: 'Reason',
                hintText: 'Customer request, damaged item, duplicate order...',
                labelStyle: TextStyle(color: colors.textSecondary),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Cancel',
              style: TextStyle(color: colors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () {
              final amount = double.tryParse(amountController.text.trim());
              if (amount == null || amount <= 0) {
                _showSnackBar('Enter a valid refund amount', isError: true);
                return;
              }
              Navigator.pop(
                context,
                _RefundRequest(
                  amount: amount,
                  reason: reasonController.text.trim(),
                ),
              );
            },
            child: Text('Refund', style: TextStyle(color: colors.error)),
          ),
        ],
      ),
    );
  }

  Future<String?> _showCancelReasonDialog(OrderContract order) {
    final reasonController = TextEditingController();
    final orderNumber = _orderNumber(order);
    return showDialog<String>(
      context: context,
      builder: (context) {
        var reason = '';
        return StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            backgroundColor: colors.card,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: Text(
              'Cancel $orderNumber?',
              style: TextStyle(color: colors.textPrimary),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Add a cancellation reason for the order timeline.',
                  style: TextStyle(color: colors.textSecondary),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reasonController,
                  autofocus: true,
                  maxLines: 3,
                  maxLength: 500,
                  onChanged: (value) =>
                      setDialogState(() => reason = value.trim()),
                  decoration: InputDecoration(
                    labelText: 'Cancellation reason',
                    hintText: 'Customer requested cancellation',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  'Keep order',
                  style: TextStyle(color: colors.textSecondary),
                ),
              ),
              TextButton(
                onPressed: reason.isEmpty
                    ? null
                    : () => Navigator.pop(context, reason),
                child: Text(
                  'Cancel order',
                  style: TextStyle(color: colors.error),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<_CompleteRefundRequest?> _showCompleteRefundDialog() async {
    final refundIdController = TextEditingController();
    final providerRefundIdController = TextEditingController();
    final notesController = TextEditingController();

    return showDialog<_CompleteRefundRequest>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Complete refund',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: refundIdController,
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                labelText: 'Refund ID',
                labelStyle: TextStyle(color: colors.textSecondary),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: providerRefundIdController,
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                labelText: 'Provider refund ID',
                labelStyle: TextStyle(color: colors.textSecondary),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notesController,
              minLines: 2,
              maxLines: 3,
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                labelText: 'Notes',
                labelStyle: TextStyle(color: colors.textSecondary),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Cancel',
              style: TextStyle(color: colors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(
              context,
              _CompleteRefundRequest(
                refundId: refundIdController.text.trim(),
                providerRefundId: providerRefundIdController.text.trim(),
                notes: notesController.text.trim(),
              ),
            ),
            child: Text(
              'Complete',
              style: TextStyle(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<_TrackingRequest?> _showTrackingDialog() async {
    final carrierController = TextEditingController();
    final trackingController = TextEditingController();
    final weightController = TextEditingController(text: '500');
    final lengthController = TextEditingController(text: '10');
    final widthController = TextEditingController(text: '10');
    final heightController = TextEditingController(text: '5');
    var createShippingLabel = false;
    var logisticsProvider = AppConfig.normalizedDefaultLogisticsProvider;

    return showDialog<_TrackingRequest>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: colors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(
            'Fulfill order',
            style: TextStyle(color: colors.textPrimary),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  value: createShippingLabel,
                  activeColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                  title: Text(
                    'Buy shipping label',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                  subtitle: Text(
                    'Creates a sandbox label unless live carrier credentials are configured.',
                    style: TextStyle(color: colors.textSecondary),
                  ),
                  onChanged: (value) =>
                      setDialogState(() => createShippingLabel = value),
                ),
                if (createShippingLabel) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Text(
                        'Carrier provider',
                        style: TextStyle(
                          color: colors.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const ProviderModeBadge(
                        mode: ProviderMode.sandbox,
                        compact: true,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: logisticsProvider,
                    dropdownColor: colors.card,
                    decoration: InputDecoration(
                      labelText: 'Carrier account',
                      labelStyle: TextStyle(color: colors.textSecondary),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'shiprocket',
                        child: Text('Shiprocket'),
                      ),
                      DropdownMenuItem(
                        value: 'delhivery',
                        child: Text('Delhivery'),
                      ),
                      DropdownMenuItem(value: 'pickrr', child: Text('Pickrr')),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setDialogState(() => logisticsProvider = value);
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: weightController,
                    keyboardType: TextInputType.number,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Package weight (grams)',
                      labelStyle: TextStyle(color: colors.textSecondary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: lengthController,
                          keyboardType: TextInputType.number,
                          style: TextStyle(color: colors.textPrimary),
                          decoration: InputDecoration(
                            labelText: 'L cm',
                            labelStyle: TextStyle(color: colors.textSecondary),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: widthController,
                          keyboardType: TextInputType.number,
                          style: TextStyle(color: colors.textPrimary),
                          decoration: InputDecoration(
                            labelText: 'W cm',
                            labelStyle: TextStyle(color: colors.textSecondary),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: heightController,
                          keyboardType: TextInputType.number,
                          style: TextStyle(color: colors.textPrimary),
                          decoration: InputDecoration(
                            labelText: 'H cm',
                            labelStyle: TextStyle(color: colors.textSecondary),
                          ),
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: carrierController,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Carrier',
                      labelStyle: TextStyle(color: colors.textSecondary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: trackingController,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Tracking number',
                      labelStyle: TextStyle(color: colors.textSecondary),
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Cancel',
                style: TextStyle(color: colors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.pop(
                context,
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
              ),
              child: Text(
                createShippingLabel ? 'Buy label + ship' : 'Ship',
                style: TextStyle(
                  color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<_LineItemsRequest?> _showLineItemsDialog(OrderContract order) async {
    final controllers = <LineItemContract, TextEditingController>{
      for (final item in order.lineItems)
        if (item.id.isNotEmpty)
          item: TextEditingController(text: item.quantity.toString()),
    };

    return showDialog<_LineItemsRequest>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Edit line items',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final entry in controllers.entries) ...[
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        entry.key.name.isEmpty ? 'Item' : entry.key.name,
                        style: TextStyle(color: colors.textPrimary),
                      ),
                    ),
                    const SizedBox(width: 12),
                    SizedBox(
                      width: 84,
                      child: TextField(
                        controller: entry.value,
                        keyboardType: TextInputType.number,
                        style: TextStyle(color: colors.textPrimary),
                        decoration: InputDecoration(
                          labelText: 'Qty',
                          labelStyle: TextStyle(color: colors.textSecondary),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              Text(
                'Set quantity to 0 to remove a line. Totals are recalculated on the server.',
                style: TextStyle(color: colors.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Cancel',
              style: TextStyle(color: colors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () {
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
              Navigator.pop(context, _LineItemsRequest(lines: lines));
            },
            child: Text(
              'Save',
              style: TextStyle(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.success,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
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
    final value = NumberFormat.decimalPattern('en_IN').format(amount.abs());
    return amount < 0 ? '-INR $value' : 'INR $value';
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
  const _RefundRequest({required this.amount, required this.reason});

  final double amount;
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
