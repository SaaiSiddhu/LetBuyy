import 'package:flutter/material.dart';
import '../tokens/letbuyy_tokens.dart';

enum LetbuyyFeedbackKind { success, information, error }

/// Persistent, scrollable feedback for a task with a remaining recovery action.
/// Transient acknowledgements continue to use showLetbuyyOperationFeedback.
class LetbuyyInlineFeedback extends StatelessWidget {
  const LetbuyyInlineFeedback({
    super.key,
    required this.title,
    required this.message,
    this.kind = LetbuyyFeedbackKind.information,
  });
  final String title, message;
  final LetbuyyFeedbackKind kind;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context), scheme = theme.colorScheme;
    final (background, foreground, icon) = switch (kind) {
      LetbuyyFeedbackKind.error => (
        scheme.errorContainer,
        scheme.onErrorContainer,
        Icons.error_outline,
      ),
      LetbuyyFeedbackKind.success => (
        scheme.primaryContainer,
        scheme.onPrimaryContainer,
        Icons.check_circle_outline,
      ),
      LetbuyyFeedbackKind.information => (
        scheme.secondaryContainer,
        scheme.onSecondaryContainer,
        Icons.info_outline,
      ),
    };
    return Semantics(
      liveRegion: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(LetbuyyRadiusTokens.md * 1.0),
        ),
        child: Padding(
          padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ExcludeSemantics(child: Icon(icon, color: foreground)),
              const SizedBox(width: LetbuyySpacingTokens.space12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: foreground,
                      ),
                    ),
                    const SizedBox(height: LetbuyySpacingTokens.space8),
                    Text(
                      message,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: foreground,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Uses the host's paired snackbar surface/foreground. Operation status is
/// conveyed by its icon and spoken label, rather than a low-contrast fill.
void showLetbuyyOperationFeedback(
  BuildContext context, {
  required String message,
  bool isError = false,
  LetbuyyFeedbackKind? kind,
}) {
  final resolved =
      kind ??
      (isError ? LetbuyyFeedbackKind.error : LetbuyyFeedbackKind.success);
  final label = switch (resolved) {
    LetbuyyFeedbackKind.success => 'Success',
    LetbuyyFeedbackKind.information => 'Update',
    LetbuyyFeedbackKind.error => 'Error',
  };
  final icon = switch (resolved) {
    LetbuyyFeedbackKind.success => Icons.check_circle_outline,
    LetbuyyFeedbackKind.information => Icons.info_outline,
    LetbuyyFeedbackKind.error => Icons.error_outline,
  };
  final theme = Theme.of(context);
  final snackbar = theme.snackBarTheme;
  final foreground =
      snackbar.contentTextStyle?.color ?? theme.colorScheme.onInverseSurface;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      backgroundColor:
          snackbar.backgroundColor ?? theme.colorScheme.inverseSurface,
      content: Semantics(
        label: '$label: $message',
        excludeSemantics: true,
        child: Row(
          children: [
            Icon(icon, color: foreground, size: LetbuyySpacingTokens.space20),
            const SizedBox(width: LetbuyySpacingTokens.space12),
            Expanded(
              child: Text(
                message,
                style:
                    snackbar.contentTextStyle?.copyWith(color: foreground) ??
                    TextStyle(color: foreground),
              ),
            ),
          ],
        ),
      ),
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.all(LetbuyySpacingTokens.space16),
    ),
  );
}
