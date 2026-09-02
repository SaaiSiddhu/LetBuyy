import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:flutter/material.dart';

class ProductTile extends StatelessWidget {
  const ProductTile({
    required this.variant,
    required this.onAdd,
    super.key,
  });

  final ProductVariant variant;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1.25,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.inventory_2_outlined),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              variant.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(variant.unitLabel),
            const Spacer(),
            Row(
              children: [
                Expanded(child: Text(variant.salePrice.toString())),
                OutlinedButton(
                  onPressed: variant.inStock ? onAdd : null,
                  child: Text(variant.inStock ? 'Add' : 'Out'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
