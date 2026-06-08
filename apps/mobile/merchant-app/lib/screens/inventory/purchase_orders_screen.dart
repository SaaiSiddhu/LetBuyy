import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../services/inventory_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;
import '../../widgets/shared/barcode_scanner_sheet.dart';

class PurchaseOrdersScreen extends StatefulWidget {
  const PurchaseOrdersScreen({super.key});

  @override
  State<PurchaseOrdersScreen> createState() => _PurchaseOrdersScreenState();
}

class _PurchaseOrdersScreenState extends State<PurchaseOrdersScreen> {
  List<PurchaseOrderContract> _orders = const [];
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
          _orders = const [];
          _isLoading = false;
        });
        return;
      }
      final rows = await context.read<InventoryService>().fetchPurchaseOrders(
        _storeId!,
      );
      if (mounted) {
        setState(() {
          _orders = rows;
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
        onPressed: _storeId == null ? null : _createPurchaseOrder,
        backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_box_outlined),
        label: const Text('New PO'),
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
                  'Purchase orders',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Create inbound stock orders and receive inventory',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh purchase orders',
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
        'Could not load purchase orders',
        _error!,
      );
    }
    if (_orders.isEmpty) {
      return _centerState(
        Icons.add_box_outlined,
        'No purchase orders',
        'Create an inbound order to track supplier replenishment.',
      );
    }
    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        itemCount: _orders.length,
        itemBuilder: (context, index) => _orderCard(_orders[index]),
      ),
    );
  }

  Widget _orderCard(PurchaseOrderContract order) {
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
                Icons.inventory_outlined,
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  order.supplierName,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _statusChip(order.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${order.totalQuantity} units • ${order.remainingQuantity} pending • location ${order.locationId.ifEmpty ?? 'not set'}',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final line in order.lines.take(3))
                _lineChip(line.productName, line.quantity),
            ],
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton.icon(
              onPressed: order.remainingQuantity == 0
                  ? null
                  : () => _receive(order),
              icon: const Icon(Icons.move_to_inbox_outlined, size: 18),
              label: const Text('Receive'),
              style: OutlinedButton.styleFrom(
                foregroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
            ),
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
        color: colors.success.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: colors.success,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Future<void> _createPurchaseOrder() async {
    final service = context.read<InventoryService>();
    final input = await showModalBottomSheet<PurchaseOrderInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => _PurchaseOrderForm(
        storeId: _storeId!,
        colors: colors,
        service: service,
      ),
    );
    if (input == null) return;

    try {
      await service.createPurchaseOrder(input);
      if (mounted) {
        _showSnackBar('Purchase order created');
        _load();
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    }
  }

  Future<void> _receive(PurchaseOrderContract order) async {
    try {
      final service = context.read<InventoryService>();
      await service.receivePurchaseOrder(
        order,
        idempotencyKey: service.makeIdempotencyKey('po-receive'),
      );
      if (mounted) {
        _showSnackBar('Purchase order received');
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

class _PurchaseOrderForm extends StatefulWidget {
  const _PurchaseOrderForm({
    required this.storeId,
    required this.colors,
    required this.service,
  });

  final String storeId;
  final AppThemeColors colors;
  final InventoryService service;

  @override
  State<_PurchaseOrderForm> createState() => _PurchaseOrderFormState();
}

class _PurchaseOrderFormState extends State<_PurchaseOrderForm> {
  final _supplierId = TextEditingController();
  final _locationId = TextEditingController();
  final _productId = TextEditingController();
  final _variantId = TextEditingController();
  final _quantity = TextEditingController(text: '1');
  final _unitCost = TextEditingController(text: '0');
  final _notes = TextEditingController();

  @override
  void dispose() {
    _supplierId.dispose();
    _locationId.dispose();
    _productId.dispose();
    _variantId.dispose();
    _quantity.dispose();
    _unitCost.dispose();
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
              'New purchase order',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 14),
            _field(_supplierId, 'Supplier ID (optional)'),
            _field(_locationId, 'Receiving location ID'),
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
            Row(
              children: [
                Expanded(child: _field(_quantity, 'Quantity')),
                const SizedBox(width: 10),
                Expanded(child: _field(_unitCost, 'Unit cost')),
              ],
            ),
            _field(_notes, 'Notes'),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _submit,
              icon: const Icon(Icons.save_outlined),
              label: const Text('Create purchase order'),
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
      final barcode = await showBarcodeScannerSheet(context);
      if (!mounted || barcode == null || barcode.trim().isEmpty) return;
      final lookup = await widget.service.lookupBarcode(
        storeId: widget.storeId,
        barcode: barcode,
      );
      if (!mounted) return;
      if (lookup == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No product found for that barcode.')),
        );
        return;
      }
      _productId.text = lookup.productId;
      if (lookup.variantId.isNotEmpty) _variantId.text = lookup.variantId;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Matched ${lookup.label}')));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Barcode lookup failed.')));
    }
  }

  void _submit() {
    final quantity = int.tryParse(_quantity.text.trim()) ?? 0;
    final unitCost = num.tryParse(_unitCost.text.trim()) ?? 0;
    if (_locationId.text.trim().isEmpty ||
        _productId.text.trim().isEmpty ||
        quantity <= 0) {
      return;
    }
    Navigator.pop(
      context,
      PurchaseOrderInput(
        storeId: widget.storeId,
        supplierId: _supplierId.text,
        locationId: _locationId.text,
        notes: _notes.text,
        idempotencyKey: widget.service.makeIdempotencyKey('po-create'),
        lines: [
          InventoryLineInput(
            productId: _productId.text,
            variantId: _variantId.text,
            quantity: quantity,
            unitCost: unitCost,
          ),
        ],
      ),
    );
  }
}

extension on String {
  String? get ifEmpty => isEmpty ? null : this;
}
