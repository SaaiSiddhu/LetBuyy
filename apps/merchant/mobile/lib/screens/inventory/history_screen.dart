import 'package:flutter/material.dart';
import 'records_screen.dart';

/// Compatibility entry point; all registers share one private view lifetime.
class InventoryHistoryScreen extends StatelessWidget {
  const InventoryHistoryScreen({super.key, this.productId, this.productName});
  final String? productId, productName;
  @override
  Widget build(BuildContext context) => InventoryRecordsScreen(
    kind: InventoryRecordKind.history,
    productId: productId,
    productName: productName,
  );
}
