import 'package:flutter/material.dart';

class EtaBadge extends StatelessWidget {
  const EtaBadge({required this.etaSeconds, super.key});

  final int etaSeconds;

  @override
  Widget build(BuildContext context) {
    final minutes = (etaSeconds / 60).ceil().clamp(1, 999);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.timer_outlined, size: 14),
            const SizedBox(width: 4),
            Text('$minutes min'),
          ],
        ),
      ),
    );
  }
}
