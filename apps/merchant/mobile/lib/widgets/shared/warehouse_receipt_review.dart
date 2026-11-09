import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'merchant_store_view.dart';

typedef _LineChoice = ({
  String id,
  String label,
  String summary,
  int remaining,
});

Future<Map<String, int>?> reviewPurchaseOrderReceipt(
  BuildContext context,
  MerchantStoreView view,
  PurchaseOrderContract order,
) => _review(
  context,
  view,
  order.poNumber,
  order.lines
      .map(
        (line) => (
          id: line.id,
          label: [
            line.displayName,
            if (line.sku.isEmpty) line.productId,
            if (line.variantId.isNotEmpty && line.variantTitle.isEmpty)
              'Variant ${line.variantId}',
          ].join(' · '),
          summary:
              'Ordered: ${line.quantity} · Received: ${line.receivedQuantity} · Remaining: ${line.remainingQuantity}',
          remaining: line.remainingQuantity,
        ),
      )
      .toList(),
);

Future<Map<String, int>?> reviewTransferReceipt(
  BuildContext context,
  MerchantStoreView view,
  InventoryTransferContract transfer,
) => _review(
  context,
  view,
  transfer.transferNumber,
  transfer.lines
      .map(
        (line) => (
          id: line.id,
          label: [
            line.displayName,
            if (line.sku.isEmpty) line.productId,
            if (line.variantId.isNotEmpty && line.variantTitle.isEmpty)
              'Variant ${line.variantId}',
          ].join(' · '),
          summary:
              'Requested: ${line.quantity} · Shipped: ${line.shippedQuantity} · Received: ${line.receivedQuantity} · Remaining: ${line.shippedQuantity - line.receivedQuantity}',
          remaining: line.shippedQuantity - line.receivedQuantity,
        ),
      )
      .toList(),
);

Future<Map<String, int>?> _review(
  BuildContext context,
  MerchantStoreView view,
  String number,
  List<_LineChoice> lines,
) async {
  final choices = lines
      .where((line) => line.remaining > 0)
      .toList(growable: false);
  if (choices.isEmpty) return null;
  final controllers = {
    for (final line in choices)
      line.id: TextEditingController(text: line.remaining.toString()),
  };
  String? error;
  final route = MaterialPageRoute<Map<String, int>>(
    settings: const RouteSettings(name: '/inventory/receipt-review'),
    builder: (dialogContext) => guardMerchantStoreView(
      view,
      AnimatedBuilder(
        animation: Listenable.merge(controllers.values.toList()),
        builder: (_, _) => StatefulBuilder(
          builder: (context, setDialogState) => LetbuyyEditorScaffold(
            title: 'Review stock receipt',
            hasChanges: choices.any(
              (line) => controllers[line.id]!.text != line.remaining.toString(),
            ),
            currentHasChanges: () => choices.any(
              (line) => controllers[line.id]!.text != line.remaining.toString(),
            ),
            confirmationGuard: (_, confirmation) =>
                guardMerchantStoreView(view, confirmation),
            body: ListView(
              padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                if (number.isNotEmpty) Text(number),
                const Text(
                  'Enter whole units received now. Set a line to 0 to receive it later.',
                ),
                for (var i = 0; i < choices.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(choices[i].label),
                        Text(choices[i].summary),
                        const SizedBox(height: 12),
                        CustomTextField(
                          key: ValueKey('warehouse-receive-${choices[i].id}'),
                          controller: controllers[choices[i].id],
                          keyboardType: TextInputType.number,
                          label: 'Receive line ${i + 1}',
                          helperText: '0–${choices[i].remaining} units',
                        ),
                      ],
                    ),
                  ),
                if (error != null)
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
              ],
            ),
            actions: OverflowBar(
              spacing: 12,
              overflowSpacing: 12,
              children: [
                TextButton(
                  onPressed: () => dismissLetbuyySurface(dialogContext),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () {
                    if (!isLetbuyySurfaceCurrent(dialogContext) ||
                        !merchantStoreViewCurrent(dialogContext, view))
                      return;
                    final quantities = <String, int>{};
                    for (final line in choices) {
                      final text = controllers[line.id]!.text.trim(),
                          quantity = int.tryParse(text);
                      if (!RegExp(r'^\d+$').hasMatch(text) ||
                          quantity == null ||
                          quantity < 0 ||
                          quantity > line.remaining) {
                        setDialogState(
                          () => error =
                              'Enter whole units between 0 and the remaining quantity for each line.',
                        );
                        return;
                      }
                      if (quantity > 0) quantities[line.id] = quantity;
                    }
                    if (quantities.isEmpty) {
                      setDialogState(
                        () => error = 'Choose at least one unit to receive.',
                      );
                      return;
                    }
                    completeLetbuyySurface(dialogContext, quantities);
                  },
                  child: const Text('Confirm receipt'),
                ),
              ],
            ),
          ),
        ),
      ),
      fullPage: true,
    ),
  );
  try {
    return await Navigator.of(context, rootNavigator: true).push(route);
  } finally {
    await route.completed;
    for (final controller in controllers.values) {
      controller.dispose();
    }
  }
}

Future<bool> reviewTransferShipment(
  BuildContext context,
  MerchantStoreView view,
  InventoryTransferContract transfer,
) async {
  final result = await Navigator.of(context).push<bool>(
    MaterialPageRoute<bool>(
      settings: const RouteSettings(name: '/inventory/shipment-review'),
      builder: (dialogContext) => guardMerchantStoreView(
        view,
        LetbuyyEditorScaffold(
          title: 'Review stock shipment',
          hasChanges: false,
          body: ListView(
            padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
            children: [
              const Text(
                'Ship the reserved units to the destination location.',
              ),
              for (final line in transfer.lines)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    '${line.displayName} · ${line.productId}: ${line.quantity} units',
                  ),
                ),
            ],
          ),
          actions: OverflowBar(
            spacing: 12,
            overflowSpacing: 12,
            children: [
              TextButton(
                onPressed: () => completeLetbuyySurface(dialogContext, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () {
                  if (merchantStoreViewCurrent(dialogContext, view))
                    completeLetbuyySurface(dialogContext, true);
                },
                child: const Text('Ship stock'),
              ),
            ],
          ),
        ),
        fullPage: true,
      ),
    ),
  );
  return result == true &&
      context.mounted &&
      merchantStoreViewCurrent(context, view);
}
