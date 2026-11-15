import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import '../../services/inventory_service.dart';
import '../../services/product_service.dart';
import '../../theme/app_theme_colors.dart';
import 'merchant_store_view.dart';
import 'barcode_scanner_sheet.dart';
import 'merchant_option_picker.dart';

class _DraftLine {
  final quantity = TextEditingController(text: '1'),
      cost = TextEditingController(text: '0');
  ProductContract? product;
  ProductVariantContract? variant;
  void dispose() {
    quantity.dispose();
    cost.dispose();
  }
}

/// Presentation only. Shared input/intent contracts and server commands own effects.
class WarehouseCreateForm extends StatefulWidget {
  const WarehouseCreateForm({
    super.key,
    required this.view,
    required this.service,
    required this.transfer,
  });
  final MerchantStoreView view;
  final InventoryService service;
  final bool transfer;
  @override
  State<WarehouseCreateForm> createState() => _WarehouseCreateFormState();
}

class _WarehouseCreateFormState extends State<WarehouseCreateForm> {
  final _lines = [_DraftLine()], _notes = TextEditingController();
  final _removedLines = <_DraftLine>[];
  InventoryLocationContract? _location, _destination;
  InventorySupplierContract? _supplier;
  DateTime? _expected;
  bool _busy = false, _readingProduct = false;
  String? _error;
  bool get _current =>
      mounted && merchantStoreViewCurrent(context, widget.view);
  bool get _hasChanges =>
      _location != null ||
      _destination != null ||
      _supplier != null ||
      _expected != null ||
      _notes.text.isNotEmpty ||
      _lines.length != 1 ||
      _lines.any(
        (line) =>
            line.product != null ||
            line.variant != null ||
            line.quantity.text != '1' ||
            line.cost.text != '0',
      );

  @override
  void dispose() {
    for (final line in [..._lines, ..._removedLines]) line.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _locationChoice({bool destination = false}) async {
    if (_busy || !_current) return;
    setState(() => _busy = true);
    try {
      final result = await chooseMerchantOption<InventoryLocationContract>(
        context,
        widget.view,
        'Locations',
        (page, query) => widget.service.readLocationsPage(
          widget.view.storeId,
          page: page,
          search: query,
        ),
        (row) => '${row.name}${row.isDefault ? ' (default)' : ''}',
      );
      if (!mounted || !_current || result == null) return;
      setState(() {
        if (destination)
          _destination = result;
        else
          _location = result;
        _error = null;
      });
    } finally {
      if (mounted && _current) setState(() => _busy = false);
    }
  }

  Future<void> _supplierChoice() async {
    if (_busy || !_current) return;
    setState(() => _busy = true);
    try {
      final result = await chooseMerchantOption<InventorySupplierContract>(
        context,
        widget.view,
        'Suppliers',
        (page, query) => widget.service.readSuppliersPage(
          widget.view.storeId,
          page: page,
          search: query,
        ),
        (row) => row.name,
      );
      if (mounted && _current && result != null)
        setState(() => _supplier = result);
    } finally {
      if (mounted && _current) setState(() => _busy = false);
    }
  }

  Future<void> _productChoice(_DraftLine line, {bool scan = false}) async {
    if (_busy || !_current) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final products = context.read<ProductService>();
    try {
      String? id, variantId;
      if (scan) {
        final barcode = await showBarcodeScannerSheet(context);
        if (!mounted || !_current || barcode == null) return;
        final match = await widget.service.lookupBarcode(
          storeId: widget.view.storeId,
          barcode: barcode,
        );
        if (!mounted || !_current) return;
        if (match == null) {
          setState(() => _error = 'No current product matched that barcode.');
          return;
        }
        id = match.productId;
        variantId = match.variantId;
      } else {
        final choice = await chooseMerchantOption<ProductContract>(
          context,
          widget.view,
          'Products',
          (page, query) => products.readWarehouseProducts(
            widget.view.storeId,
            page: page,
            search: query,
          ),
          (row) => '${row.name}${row.sku == null ? '' : ' · ${row.sku}'}',
        );
        if (!mounted || !_current || choice == null) return;
        id = choice.id;
      }
      setState(() {
        _readingProduct = true;
        _error = null;
      });
      final product = await products.readWarehouseProduct(
        id,
        widget.view.storeId,
      );
      if (!mounted || !_current || !_lines.contains(line)) return;
      ProductVariantContract? variant;
      if (variantId != null && variantId.isNotEmpty) {
        final matches = product.variants
            .where((v) => v.id == variantId)
            .toList();
        if (matches.length != 1) throw const FormatException();
        variant = matches.single;
      }
      setState(() {
        line.product = product;
        line.variant = variant;
      });
    } catch (_) {
      if (mounted && _current)
        setState(
          () => _error =
              'The current product or its variants could not be confirmed. Select it again.',
        );
    } finally {
      if (mounted && _current)
        setState(() {
          _busy = false;
          _readingProduct = false;
        });
    }
  }

  Future<void> _arrival() async {
    final now = DateTime.now(),
        date = await showDatePicker(
          context: context,
          initialDate: _expected ?? now,
          firstDate: DateTime(now.year - 1),
          lastDate: DateTime(now.year + 5),
        );
    if (mounted && _current && date != null) setState(() => _expected = date);
  }

  Future<void> _submit() async {
    if (_busy || !_current || !isLetbuyySurfaceCurrent(context)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_location == null ||
          widget.transfer &&
              (_destination == null || _destination!.id == _location!.id))
        throw const FormatException();
      final lines = _lines
          .map((line) {
            final product = line.product,
                quantity = int.tryParse(line.quantity.text.trim());
            if (product == null ||
                quantity == null ||
                quantity < 1 ||
                product.variants.isNotEmpty && line.variant == null)
              throw const FormatException();
            return InventoryLineInput(
              productId: product.id,
              variantId: line.variant?.id,
              quantity: quantity,
              unitCost: widget.transfer
                  ? 0
                  : parseWarehouseUnitCost(line.cost.text),
            );
          })
          .toList(growable: false);
      final key = widget.service.makeIdempotencyKey(
        widget.transfer ? 'transfer-create' : 'po-create',
      );
      final input = widget.transfer
          ? InventoryTransferInput(
              storeId: widget.view.storeId,
              sourceLocationId: _location!.id,
              destinationLocationId: _destination!.id,
              notes: _notes.text,
              idempotencyKey: key,
              lines: lines,
            )
          : PurchaseOrderInput(
              storeId: widget.view.storeId,
              locationId: _location!.id,
              supplierId: _supplier?.id,
              notes: _notes.text,
              idempotencyKey: key,
              lines: lines,
              expectedAt: _expected == null
                  ? null
                  : DateTime.utc(
                      _expected!.year,
                      _expected!.month,
                      _expected!.day,
                    ).toIso8601String(),
            );
      if (input is PurchaseOrderInput)
        WarehouseCommandIntent.purchaseOrder(input);
      else
        WarehouseCommandIntent.transfer(input as InventoryTransferInput);
      final review = await Navigator.of(context).push<bool>(
        MaterialPageRoute<bool>(
          settings: RouteSettings(
            name: widget.transfer
                ? '/inventory/transfer-create-review'
                : '/inventory/purchase-order-create-review',
          ),
          builder: (reviewContext) => guardMerchantStoreView(
            widget.view,
            LetbuyyEditorScaffold(
              title: widget.transfer
                  ? 'Review transfer'
                  : 'Review purchase order',
              hasChanges: false,
              body: ListView(
                padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                children: [
                  Text(
                    widget.transfer
                        ? '${_location!.name} → ${_destination!.name}'
                        : 'Receive at ${_location!.name}',
                  ),
                  if (!widget.transfer)
                    Text('Supplier: ${_supplier?.name ?? 'No supplier'}'),
                  for (var i = 0; i < lines.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        '${_lines[i].product!.name}${_lines[i].variant == null ? '' : ' / ${_lines[i].variant!.title}'}\n${lines[i].quantity} units${widget.transfer ? '' : ' · ₹${lines[i].unitCost.toStringAsFixed(2)} each'}',
                      ),
                    ),
                ],
              ),
              actions: OverflowBar(
                spacing: 12,
                overflowSpacing: 12,
                children: [
                  TextButton(
                    onPressed: () =>
                        completeLetbuyySurface(reviewContext, false),
                    child: const Text('Back to draft'),
                  ),
                  FilledButton(
                    onPressed: () {
                      if (_current) completeLetbuyySurface(reviewContext, true);
                    },
                    child: const Text('Confirm creation'),
                  ),
                ],
              ),
            ),
            fullPage: true,
          ),
        ),
      );
      if (mounted && _current && review == true)
        completeLetbuyySurface(context, input);
    } on FormatException {
      if (mounted && _current)
        setState(
          () => _error =
              'Choose the current locations, products and variants. Use positive whole quantities and INR costs with at most two decimals. Each product/variant may appear once.',
        );
    } finally {
      if (mounted && _current) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return AnimatedBuilder(
      animation: Listenable.merge([
        _notes,
        for (final line in _lines) ...[line.quantity, line.cost],
      ]),
      builder: (context, _) => LetbuyyEditorScaffold(
        title: widget.transfer ? 'New transfer' : 'New purchase order',
        hasChanges: _hasChanges,
        currentHasChanges: () => _hasChanges,
        currentIsBusy: () => _busy,
        isBusy: _busy,
        body: Column(
          children: [
            if (_readingProduct)
              const LinearProgressIndicator(
                semanticsLabel: 'Loading current product',
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Text(
                        _error!,
                        style: TextStyle(color: colors.error),
                      ),
                    ),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _locationChoice(),
                    icon: const Icon(Icons.warehouse_outlined),
                    label: Text(
                      _location?.name ??
                          (widget.transfer
                              ? 'Choose source location'
                              : 'Choose receiving location'),
                    ),
                  ),
                  if (widget.transfer)
                    OutlinedButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _locationChoice(destination: true),
                      icon: const Icon(Icons.local_shipping_outlined),
                      label: Text(
                        _destination?.name ?? 'Choose destination location',
                      ),
                    ),
                  if (!widget.transfer) ...[
                    OutlinedButton(
                      onPressed: _busy ? null : _supplierChoice,
                      child: Text(
                        _supplier?.name ?? 'Choose supplier (optional)',
                      ),
                    ),
                    if (_supplier != null)
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() => _supplier = null),
                        child: const Text('Use no supplier'),
                      ),
                    OutlinedButton(
                      onPressed: _busy ? null : _arrival,
                      child: Text(
                        _expected == null
                            ? 'Expected arrival (optional)'
                            : 'Expected ${_expected!.day}/${_expected!.month}/${_expected!.year}',
                      ),
                    ),
                    if (_expected != null)
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() => _expected = null),
                        child: const Text('Clear expected arrival'),
                      ),
                  ],
                  for (var i = 0; i < _lines.length; i++)
                    _lineCard(_lines[i], i, colors),
                  if (_lines.length < 100)
                    OutlinedButton.icon(
                      onPressed: _busy
                          ? null
                          : () => setState(() => _lines.add(_DraftLine())),
                      icon: const Icon(Icons.add),
                      label: const Text('Add product line'),
                    ),
                  TextField(
                    controller: _notes,
                    maxLength: 2000,
                    enabled: !_busy,
                    decoration: const InputDecoration(labelText: 'Notes'),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _busy ? null : _submit,
            icon: const Icon(Icons.fact_check_outlined),
            label: Text(
              widget.transfer ? 'Create transfer' : 'Create purchase order',
            ),
          ),
        ),
      ),
    );
  }

  Widget _lineCard(_DraftLine line, int index, AppThemeColors colors) => Card(
    // Editable quantities, product selection and scanner are distinct controls.
    // Merging them reports the full card as the quantity's Android focus rect.
    semanticContainer: false,
    key: ObjectKey(line),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Line ${index + 1}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              if (_lines.length > 1)
                IconButton(
                  tooltip: 'Remove line ${index + 1}',
                  onPressed: _busy
                      ? null
                      : () {
                          setState(() {
                            _lines.remove(line);
                            _removedLines.add(line);
                          });
                        },
                  icon: const Icon(Icons.remove_circle_outline),
                ),
            ],
          ),
          OutlinedButton(
            onPressed: _busy ? null : () => _productChoice(line),
            child: Text(
              line.product?.name ?? 'Choose product for line ${index + 1}',
            ),
          ),
          TextButton.icon(
            onPressed: _busy ? null : () => _productChoice(line, scan: true),
            icon: const Icon(Icons.qr_code_scanner),
            label: Text('Scan barcode for line ${index + 1}'),
          ),
          if (line.product != null && line.product!.variants.isNotEmpty)
            LetbuyyChoiceField<String>(
              key: ValueKey(
                'variant-$index-${line.product!.id}-${line.variant?.id}',
              ),
              value: line.variant?.id,
              label: 'Variant (required)',
              choices: [
                for (final v in line.product!.variants)
                  LetbuyyChoice(
                    value: v.id,
                    label: '${v.title}${v.sku == null ? '' : ' · ${v.sku}'}',
                  ),
              ],
              onChanged: _busy
                  ? null
                  : (id) => setState(
                      () => line.variant = line.product!.variants.firstWhere(
                        (v) => v.id == id,
                      ),
                    ),
            ),
          Semantics(
            container: true,
            child: TextField(
              key: ValueKey('warehouse-quantity-$index'),
              controller: line.quantity,
              enabled: !_busy,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Quantity'),
            ),
          ),
          if (!widget.transfer)
            Semantics(
              container: true,
              child: TextField(
                key: ValueKey('warehouse-cost-$index'),
                controller: line.cost,
                enabled: !_busy,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(labelText: 'Unit cost (INR)'),
              ),
            ),
        ],
      ),
    ),
  );
}
