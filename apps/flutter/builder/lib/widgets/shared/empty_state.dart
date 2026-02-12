import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Empty state placeholder widget
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 40,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onAction,
                icon: const Icon(Icons.add_rounded),
                label: Text(actionLabel!),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// No products empty state
class NoProductsEmptyState extends StatelessWidget {
  final VoidCallback? onAddProducts;

  const NoProductsEmptyState({super.key, this.onAddProducts});

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.inventory_2_outlined,
      title: 'No Products Yet',
      subtitle: 'Add products to your store to start selling',
      actionLabel: 'Add Products',
      onAction: onAddProducts,
    );
  }
}

/// No sections empty state
class NoSectionsEmptyState extends StatelessWidget {
  final VoidCallback? onAddSection;

  const NoSectionsEmptyState({super.key, this.onAddSection});

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.layers_outlined,
      title: 'No Sections Yet',
      subtitle: 'Add sections to customize your store layout',
      actionLabel: 'Add Section',
      onAction: onAddSection,
    );
  }
}
