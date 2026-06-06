import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../services/inventory_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class InventoryTransfersScreen extends StatefulWidget {
  const InventoryTransfersScreen({super.key});

  @override
  State<InventoryTransfersScreen> createState() =>
      _InventoryTransfersScreenState();
}

class _InventoryTransfersScreenState extends State<InventoryTransfersScreen> {
  List<InventoryTransferContract> _transfers = const [];
  bool _isLoading = true;
  String? _storeId;
  String? _error;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _storeId ??=
          (await context.read<StoreContext>().ensureSelectedStore())?.id;
      if (_storeId == null) {
        setState(() {
          _transfers = const [];
          _isLoading = false;
        });
        return;
      }
      final rows = await context.read<InventoryService>().fetchTransfers(
        _storeId!,
      );
      if (mounted) {
        setState(() {
          _transfers = rows;
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

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _storeId == null ? null : _createTransfer,
        backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.swap_horiz_outlined),
        label: const Text('New transfer'),
      ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              Expanded(child: _isLoading ? _loading() : _body()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
            onPressed: () => Navigator.maybePop(context),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Transfers',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Move stock between locations and receive shipments',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh transfers',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load transfers',
        _error!,
      );
    }
    if (_transfers.isEmpty) {
      return _centerState(
        Icons.swap_horiz_outlined,
        'No transfers',
        'Move stock between locations when inventory needs balancing.',
      );
    }
    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        itemCount: _transfers.length,
        itemBuilder: (context, index) => _transferCard(_transfers[index]),
      ),
    );
  }

  Widget _transferCard(InventoryTransferContract transfer) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.swap_horiz_outlined,
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${transfer.sourceLocationId} -> ${transfer.destinationLocationId}',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _statusChip(transfer.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${transfer.totalQuantity} units • ${transfer.remainingQuantity} pending',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final line in transfer.lines.take(3))
                _lineChip(line.productName, line.quantity),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton.icon(
                onPressed: () => _ship(transfer),
                icon: const Icon(Icons.local_shipping_outlined, size: 18),
                label: const Text('Ship'),
                style: OutlinedButton.styleFrom(
                  foregroundColor:
                      mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: transfer.remainingQuantity == 0
                    ? null
                    : () => _receive(transfer),
                icon: const Icon(Icons.move_to_inbox_outlined, size: 18),
                label: const Text('Receive'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _lineChip(String label, int quantity) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '$label x $quantity',
        style: TextStyle(color: colors.textSecondary, fontSize: 12),
      ),
    );
  }

  Widget _statusChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: colors.warning,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Future<void> _createTransfer() async {
    final service = context.read<InventoryService>();
    final input = await showModalBottomSheet<InventoryTransferInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) =>
          _TransferForm(storeId: _storeId!, colors: colors, service: service),
    );
    if (input == null) return;

    try {
      await service.createTransfer(input);
      if (mounted) {
        _showSnackBar('Transfer created');
        _load();
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    }
  }

  Future<void> _ship(InventoryTransferContract transfer) async {
    try {
      final service = context.read<InventoryService>();
      await service.shipTransfer(
        transfer,
        idempotencyKey: service.makeIdempotencyKey('transfer-ship'),
      );
      if (mounted) {
        _showSnackBar('Transfer shipped');
        _load();
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    }
  }

  Future<void> _receive(InventoryTransferContract transfer) async {
    try {
      final service = context.read<InventoryService>();
      await service.receiveTransfer(
        transfer,
        idempotencyKey: service.makeIdempotencyKey('transfer-receive'),
      );
      if (mounted) {
        _showSnackBar('Transfer received');
        _load();
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    }
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _centerState(IconData icon, String title, String subtitle) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 48),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
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

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.success,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _TransferForm extends StatefulWidget {
  const _TransferForm({
    required this.storeId,
    required this.colors,
    required this.service,
  });

  final String storeId;
  final AppThemeColors colors;
  final InventoryService service;

  @override
  State<_TransferForm> createState() => _TransferFormState();
}

class _TransferFormState extends State<_TransferForm> {
  final _sourceId = TextEditingController();
  final _destinationId = TextEditingController();
  final _productId = TextEditingController();
  final _variantId = TextEditingController();
  final _quantity = TextEditingController(text: '1');
  final _notes = TextEditingController();

  @override
  void dispose() {
    _sourceId.dispose();
    _destinationId.dispose();
    _productId.dispose();
    _variantId.dispose();
    _quantity.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        18,
        18,
        18,
        MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'New transfer',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: _field(_sourceId, 'Source location ID')),
                const SizedBox(width: 10),
                Expanded(
                  child: _field(_destinationId, 'Destination location ID'),
                ),
              ],
            ),
            _field(
              _productId,
              'Product ID or scanned barcode',
              suffix: IconButton(
                tooltip: 'Scan barcode',
                icon: const Icon(Icons.qr_code_scanner_rounded),
                onPressed: _scanBarcode,
              ),
            ),
            _field(_variantId, 'Variant ID (optional)'),
            _field(_quantity, 'Quantity'),
            _field(_notes, 'Notes'),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _submit,
              icon: const Icon(Icons.save_outlined),
              label: const Text('Create transfer'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    Widget? suffix,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        style: TextStyle(color: widget.colors.textPrimary),
        decoration: InputDecoration(labelText: label, suffixIcon: suffix),
      ),
    );
  }

  Future<void> _scanBarcode() async {
    try {
      _productId.text = await widget.service.scanBarcode();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  void _submit() {
    final quantity = int.tryParse(_quantity.text.trim()) ?? 0;
    if (_sourceId.text.trim().isEmpty ||
        _destinationId.text.trim().isEmpty ||
        _productId.text.trim().isEmpty ||
        quantity <= 0) {
      return;
    }
    Navigator.pop(
      context,
      InventoryTransferInput(
        storeId: widget.storeId,
        sourceLocationId: _sourceId.text,
        destinationLocationId: _destinationId.text,
        notes: _notes.text,
        idempotencyKey: widget.service.makeIdempotencyKey('transfer-create'),
        lines: [
          InventoryLineInput(
            productId: _productId.text,
            variantId: _variantId.text,
            quantity: quantity,
          ),
        ],
      ),
    );
  }
}
