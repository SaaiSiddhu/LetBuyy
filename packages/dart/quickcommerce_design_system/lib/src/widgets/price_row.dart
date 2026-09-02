import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:flutter/material.dart';

class PriceRow extends StatelessWidget {
  const PriceRow({
    required this.label,
    required this.amount,
    this.emphasized = false,
    super.key,
  });

  final String label;
  final Money amount;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final style = emphasized
        ? Theme.of(context).textTheme.titleMedium
        : Theme.of(context).textTheme.bodyMedium;
    return Row(
      children: [
        Expanded(child: Text(label, style: style)),
        Text(amount.toString(), style: style),
      ],
    );
  }
}
