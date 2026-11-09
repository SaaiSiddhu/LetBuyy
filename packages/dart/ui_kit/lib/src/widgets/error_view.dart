import 'package:flutter/material.dart';
import '../tokens/letbuyy_tokens.dart';

class ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final String title;
  final String retryLabel;

  const ErrorView({
    super.key,
    required this.message,
    this.onRetry,
    this.title = 'Something went wrong',
    this.retryLabel = 'Try Again',
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
                Icons.error_outline,
                size: LetbuyySpacingTokens.space48,
                color: theme.colorScheme.error,
              ),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space16),
            Semantics(
              header: true,
              child: Text(
                title,
                style: theme.textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            Text(
              message,
              style: theme.textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: LetbuyySpacingTokens.space24),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: Text(retryLabel),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
