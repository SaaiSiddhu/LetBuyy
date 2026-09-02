import 'package:flutter/material.dart';

class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    required this.quantity,
    required this.onChanged,
    this.pending = false,
    super.key,
  });

  final int quantity;
  final bool pending;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<int>(
      segments: [
        ButtonSegment(
          value: quantity - 1,
          icon: const Icon(Icons.remove, size: 16),
        ),
        ButtonSegment(
          value: quantity,
          label: pending
              ? const SizedBox.square(
                  dimension: 12,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text('$quantity'),
        ),
        ButtonSegment(
          value: quantity + 1,
          icon: const Icon(Icons.add, size: 16),
        ),
      ],
      selected: {quantity},
      onSelectionChanged: pending
          ? null
          : (values) {
              final next = values.first;
              if (next >= 0 && next != quantity) {
                onChanged(next);
              }
            },
      showSelectedIcon: false,
    );
  }
}
