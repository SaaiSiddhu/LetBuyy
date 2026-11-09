import 'package:flutter/material.dart';
import '../tokens/letbuyy_tokens.dart';

class EmptyState extends StatelessWidget {
  final String title;
  final String? message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.inbox,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ExcludeSemantics(
              child: Icon(
                icon,
                size: LetbuyySpacingTokens.space48,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space16),
            Semantics(
              header: true,
              child: Text(
                title,
                textAlign: TextAlign.center,
                style: theme.textTheme.titleLarge,
              ),
            ),
            if (message != null) ...[
              const SizedBox(height: LetbuyySpacingTokens.space8),
              Text(
                message!,
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: LetbuyySpacingTokens.space24),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
