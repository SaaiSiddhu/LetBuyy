import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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

Widget guardMerchantStoreView(MerchantStoreView? view, Widget child) =>
    Consumer<StoreContext>(
      builder: (context, stores, _) =>
          view != null &&
              stores.requestContextKey == view.key &&
              stores.selectedStoreId == view.storeId
          ? child
          : AlertDialog(
              title: const Text('Store access changed'),
              content: const Text(
                'Close this form and reopen it from the selected store.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Close'),
                ),
              ],
            ),
    );
