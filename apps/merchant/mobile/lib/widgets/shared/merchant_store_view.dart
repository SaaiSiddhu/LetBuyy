import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../app/store_context.dart';

/// Presentation lifetime only. Every API command still requires current server
/// authorization; this snapshot never supplies an authentication/permission proof.
typedef MerchantStoreView = ({Object? key, String storeId});

bool merchantStoreViewCurrent(BuildContext context, MerchantStoreView? view) {
  if (!context.mounted || view == null) return false;
  final stores = context.read<StoreContext>();
  return stores.requestContextKey == view.key &&
      stores.selectedStoreId == view.storeId;
}

Widget guardMerchantStoreView(
  MerchantStoreView? view,
  Widget child, {
  bool fullPage = false,
  bool sheet = false,
}) => Consumer<StoreContext>(
  builder: (context, stores, _) =>
      view != null &&
          stores.requestContextKey == view.key &&
          stores.selectedStoreId == view.storeId
      ? child
      : fullPage
      ? Scaffold(
          appBar: AppBar(title: const Text('Store access changed')),
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                const Text(
                  'Close this form and reopen it from the selected store.',
                ),
                TextButton(
                  onPressed: () => completeLetbuyySurface(context),
                  child: const Text('Close'),
                ),
              ],
            ),
          ),
        )
      : sheet
      ? LetbuyyFormSheet(
          title: 'Store access changed',
          child: const Text(
            'Close this form and reopen it from the selected store.',
          ),
        )
      : AlertDialog(
          title: const Text('Store access changed'),
          content: const Text(
            'Close this form and reopen it from the selected store.',
          ),
          actions: [
            TextButton(
              onPressed: () => completeLetbuyySurface(context),
              child: const Text('Close'),
            ),
          ],
        ),
);
