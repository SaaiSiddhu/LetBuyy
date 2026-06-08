import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../services/return_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class ReturnsScreen extends StatefulWidget {
  const ReturnsScreen({super.key});

  @override
  State<ReturnsScreen> createState() => _ReturnsScreenState();
}

class _ReturnsScreenState extends State<ReturnsScreen> {
  bool _isLoading = true;
  bool _isMutating = false;
  String? _storeId;
  String? _error;
  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadReturns();
  }

  Future<void> _loadReturns() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      _storeId = store?.id;
      if (_storeId == null) {
        setState(() {
          _isLoading = false;
          _error = 'Select a store to manage returns.';
        });
        return;
      }
      await context.read<ReturnService>().fetchReturns(_storeId!);
      if (mounted) setState(() => _isLoading = false);
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _createReturn() async {
    final request = await _showCreateReturnDialog();
    if (request == null) return;

    setState(() => _isMutating = true);
    try {
      await context.read<ReturnService>().createReturn(
        orderId: request.orderId,
        reason: request.reason,
        restock: request.restock,
        refundMethod: request.refundMethod,
      );
      if (mounted) _showSnackBar('Return created');
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isMutating = false);
    }
  }

  Future<void> _updateStatus(MerchantReturn record, String status) async {
    setState(() => _isMutating = true);
    try {
      await context.read<ReturnService>().updateStatus(
        record.id,
        status: status,
      );
      if (mounted) _showSnackBar('Return ${_statusLabel(status)}');
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isMutating = false);
    }
  }

  Future<void> _completeRefund(MerchantReturn record) async {
    final providerRefundId = await _showRefundReferenceDialog(record);
    if (providerRefundId == null) return;

    setState(() => _isMutating = true);
    try {
      await context.read<ReturnService>().completeRefund(
        record.id,
        refundId: record.refundId.isEmpty ? null : record.refundId,
        providerRefundId: providerRefundId,
      );
      if (mounted) _showSnackBar('Refund completed');
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isMutating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    final records = context.watch<ReturnService>().returns;

    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        title: const Text('Returns'),
        backgroundColor: colors.card,
        foregroundColor: colors.textPrimary,
        actions: [
          IconButton(
            tooltip: 'Create return',
            onPressed: _isMutating ? null : _createReturn,
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _isMutating ? null : _createReturn,
        backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        icon: const Icon(Icons.assignment_return_outlined),
        label: const Text('New return'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadReturns,
        child: _buildBody(records),
      ),
    );
  }

  Widget _buildBody(List<MerchantReturn> records) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _stateCard(
            icon: Icons.error_outline,
            title: 'Returns unavailable',
            subtitle: 'Try again in a moment.',
          ),
        ],
      );
    }
    if (records.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _stateCard(
            icon: Icons.assignment_return_outlined,
            title: 'No returns yet',
            subtitle:
                'Create a return when a customer needs refund or restock support.',
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: records.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) => _returnCard(records[index]),
    );
  }

  Widget _returnCard(MerchantReturn record) {
    final status = _statusLabel(record.status);
    return Card(
      color: colors.card,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    record.orderNumber,
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                _statusPill(status),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              [
                if (record.customerEmail.isNotEmpty) record.customerEmail,
                if (record.reason.isNotEmpty) record.reason,
                _money(record.refundAmount, record.currency),
              ].join(' • '),
              style: TextStyle(color: colors.textSecondary),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (record.status == 'requested' || record.status == 'approved')
                  _actionChip(
                    'Received',
                    () => _updateStatus(record, 'received'),
                  ),
                if (record.status == 'received')
                  _actionChip(
                    'Inspected',
                    () => _updateStatus(record, 'inspected'),
                  ),
                if (record.status == 'inspected')
                  _actionChip(
                    'Approve',
                    () => _updateStatus(record, 'approved'),
                  ),
                if (record.status != 'refunded' && record.refundId.isNotEmpty)
                  _actionChip('Complete refund', () => _completeRefund(record)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _stateCard({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Card(
      color: colors.card,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(
              icon,
              size: 42,
              color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusPill(String status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
          alpha: 0.12,
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _actionChip(String label, VoidCallback onPressed) {
    return OutlinedButton(
      onPressed: _isMutating ? null : onPressed,
      child: Text(label),
    );
  }

  Future<_CreateReturnRequest?> _showCreateReturnDialog() async {
    final orderController = TextEditingController();
    final reasonController = TextEditingController();
    var restock = true;
    var refundMethod = 'original_payment';

    return showDialog<_CreateReturnRequest>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: colors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(
            'Create return',
            style: TextStyle(color: colors.textPrimary),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: orderController,
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    labelText: 'Order ID',
                    labelStyle: TextStyle(color: colors.textSecondary),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reasonController,
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    labelText: 'Reason',
                    labelStyle: TextStyle(color: colors.textSecondary),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: refundMethod,
                  dropdownColor: colors.card,
                  decoration: InputDecoration(
                    labelText: 'Refund method',
                    labelStyle: TextStyle(color: colors.textSecondary),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'original_payment',
                      child: Text('Original payment'),
                    ),
                    DropdownMenuItem(
                      value: 'gift_card',
                      child: Text('Gift card'),
                    ),
                    DropdownMenuItem(value: 'manual', child: Text('Manual')),
                  ],
                  onChanged: (value) {
                    if (value != null)
                      setDialogState(() => refundMethod = value);
                  },
                ),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  value: restock,
                  activeColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                  title: Text(
                    'Restock returned items',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                  onChanged: (value) => setDialogState(() => restock = value),
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
                final orderId = orderController.text.trim();
                if (orderId.isEmpty) return;
                Navigator.pop(
                  context,
                  _CreateReturnRequest(
                    orderId: orderId,
                    reason: reasonController.text.trim(),
                    refundMethod: refundMethod,
                    restock: restock,
                  ),
                );
              },
              child: Text(
                'Create',
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

  Future<String?> _showRefundReferenceDialog(MerchantReturn record) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Complete refund',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: TextField(
          controller: controller,
          style: TextStyle(color: colors.textPrimary),
          decoration: InputDecoration(
            labelText: 'Provider refund reference',
            labelStyle: TextStyle(color: colors.textSecondary),
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
            onPressed: () => Navigator.pop(context, controller.text.trim()),
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

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.success,
      ),
    );
  }

  String _money(double amount, String currency) {
    final value = NumberFormat.decimalPattern('en_IN').format(amount);
    return '$currency $value';
  }

  String _statusLabel(String value) {
    final normalized = value.replaceAll('_', ' ').trim();
    if (normalized.isEmpty) return 'Requested';
    return normalized
        .split(' ')
        .map(
          (part) => part.isEmpty
              ? part
              : '${part[0].toUpperCase()}${part.substring(1)}',
        )
        .join(' ');
  }
}

class _CreateReturnRequest {
  const _CreateReturnRequest({
    required this.orderId,
    required this.reason,
    required this.refundMethod,
    required this.restock,
  });

  final String orderId;
  final String reason;
  final String refundMethod;
  final bool restock;
}
