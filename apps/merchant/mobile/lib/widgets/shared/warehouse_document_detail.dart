import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../app/routes.dart';
import '../../services/api_client.dart' show ApiException;
import '../../services/inventory_service.dart';
import 'merchant_store_view.dart';
import 'warehouse_list_scaffold.dart';
import 'warehouse_status_chip.dart';

/// A current canonical document read, independent of command acknowledgements.
/// The existing service and models retain scope, status, quantity and cost rules.
class WarehouseDocumentDetail extends StatefulWidget {
  const WarehouseDocumentDetail({
    super.key,
    required this.view,
    required this.documentId,
    required this.transfer,
  });
  final MerchantStoreView view;
  final String documentId;
  final bool transfer;

  @override
  State<WarehouseDocumentDetail> createState() =>
      _WarehouseDocumentDetailState();
}

class _WarehouseDocumentDetailState extends State<WarehouseDocumentDetail> {
  PurchaseOrderContract? _order;
  InventoryTransferContract? _transfer;
  bool _loading = true;
  String? _error;
  int _generation = 0;

  bool get _matches =>
      mounted && merchantStoreViewCurrent(context, widget.view);
  bool get _hasData => _order != null || _transfer != null;
  bool get _current => _matches && isLetbuyySurfaceCurrent(context);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_matches) _load();
    });
  }

  @override
  void didUpdateWidget(covariant WarehouseDocumentDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.view != widget.view ||
        oldWidget.documentId != widget.documentId ||
        oldWidget.transfer != widget.transfer) {
      ++_generation;
      _order = null;
      _transfer = null;
      _error = null;
      _loading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_matches) _load();
      });
    }
  }

  Future<void> _load() async {
    if (!_matches) return;
    final generation = ++_generation;
    final view = widget.view, id = widget.documentId;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final service = context.read<InventoryService>();
      if (widget.transfer) {
        final document = await service.fetchTransfer(view.storeId, id);
        if (!_matches || generation != _generation) return;
        setState(() {
          _transfer = document;
          _loading = false;
        });
      } else {
        final document = await service.fetchPurchaseOrder(view.storeId, id);
        if (!_matches || generation != _generation) return;
        setState(() {
          _order = document;
          _loading = false;
        });
      }
    } catch (error) {
      if (!_matches || generation != _generation) return;
      final status = error is ApiException ? error.statusCode : null;
      setState(() {
        if ([401, 403, 404].contains(status)) {
          _order = null;
          _transfer = null;
        }
        _error = status == 404
            ? 'This document is no longer available in the selected store.'
            : status == 401 || status == 403
            ? 'Current account or store access could not be confirmed.'
            : 'The document could not be refreshed. Check your connection and current store access.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final generation = _generation;
    bool current() => _current && generation == _generation;
    return guardMerchantStoreView(
      widget.view,
      WarehouseListScaffold(
        title: widget.transfer ? 'Stock transfer' : 'Purchase order',
        description: 'Review saved locations, quantities, and document lines.',
        scrollIdentity: (widget.view, widget.documentId, widget.transfer),
        loading: _loading,
        refreshLabel: 'Refresh document',
        onRefresh: _loading
            ? null
            : () async {
                if (current() && !_loading) await _load();
              },
        headerActions: [
          IconButton(
            tooltip: 'View document receipts',
            onPressed: !_hasData || _loading
                ? null
                : () {
                    if (!current()) return;
                    Navigator.pushNamed(
                      context,
                      AppRoutes.inventoryReceipts,
                      arguments: {
                        widget.transfer ? 'transfer_id' : 'po_id':
                            widget.documentId,
                      },
                    );
                  },
            icon: const Icon(Icons.receipt_long_outlined),
          ),
        ],
        header: [
          if (_loading) const Text('Reading the current saved document…'),
          if (_error != null) ...[
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            if (_hasData)
              const Text(
                'Showing the last confirmed document. Refresh did not complete.',
              ),
          ],
          if (_order case final order?) ...[
            _heading(order.poNumber, order.id, order.status),
            Text('Supplier: ${order.supplierName}'),
            Text('Receiving location: ${order.locationLabel}'),
            Text(
              '${order.totalQuantity} ordered · ${order.remainingQuantity} not yet received',
            ),
            if (order.expectedAt.isNotEmpty)
              Text('Expected arrival: ${order.expectedAt}'),
            if (order.notes.isNotEmpty) _notes(order.notes),
            const Text('Lines in this document'),
          ],
          if (_transfer case final transfer?) ...[
            _heading(transfer.transferNumber, transfer.id, transfer.status),
            Text('From: ${transfer.sourceLocationLabel}'),
            Text('To: ${transfer.destinationLocationLabel}'),
            Text(
              '${transfer.totalQuantity} requested · ${transfer.remainingQuantity} not yet received',
            ),
            if (transfer.notes.isNotEmpty) _notes(transfer.notes),
            const Text('Lines in this document'),
          ],
        ],
        slivers: [
          if (_order case final order?)
            _lines(order.lines.length, (index) {
              final line = order.lines[index];
              return _line(
                line.id,
                line.displayName,
                line.productId,
                line.variantId,
                [
                  'Ordered: ${line.quantity} · Received: ${line.receivedQuantity} · Remaining: ${line.remainingQuantity}',
                  'Unit cost: INR ${line.unitCost.toStringAsFixed(2)}',
                ],
              );
            }),
          if (_transfer case final transfer?)
            _lines(transfer.lines.length, (index) {
              final line = transfer.lines[index];
              return _line(
                line.id,
                line.displayName,
                line.productId,
                line.variantId,
                [
                  'Requested: ${line.quantity} · Shipped: ${line.shippedQuantity} · Received: ${line.receivedQuantity}',
                  'Not yet received: ${line.remainingQuantity}',
                ],
              );
            }),
        ],
      ),
      fullPage: true,
    );
  }

  Widget _heading(String number, String id, String status) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(number, style: Theme.of(context).textTheme.titleLarge),
      SelectableText(
        'Document ID: $id',
        key: PageStorageKey((id, 'document-id')),
      ),
      Align(
        alignment: Alignment.centerLeft,
        child: WarehouseStatusChip(status: status),
      ),
    ],
  );

  Widget _notes(String notes) => SelectableText(
    'Notes: $notes',
    key: PageStorageKey((widget.documentId, 'document-notes')),
  );

  Widget _lines(int length, Widget Function(int) builder) => SliverPadding(
    padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
    sliver: SliverList.builder(
      itemCount: length,
      itemBuilder: (_, index) => builder(index),
    ),
  );

  Widget _line(
    String id,
    String name,
    String product,
    String variant,
    List<String> facts,
  ) => Card(
    key: ValueKey(id),
    // Selectable identifiers must not absorb their sibling saved line facts
    // into one platform accessibility node.
    semanticContainer: false,
    child: Padding(
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(name, style: Theme.of(context).textTheme.titleMedium),
          SelectableText(
            'Product ID: $product',
            key: PageStorageKey((id, 'line-product')),
          ),
          if (variant.isNotEmpty)
            SelectableText(
              'Variant ID: $variant',
              key: PageStorageKey((id, 'line-variant')),
            ),
          for (final fact in facts) Text(fact),
        ],
      ),
    ),
  );
}
