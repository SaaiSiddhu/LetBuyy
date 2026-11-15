import 'package:flutter/material.dart';
import '../tokens/letbuyy_tokens.dart';
import 'loading_indicator.dart';

/// A real blocking operation. Hidden controls lose input, focus and semantics;
/// callers keep ownership of the operation and its authoritative completion.
class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({
    super.key,
    required this.child,
    required this.isLoading,
    this.loadingText,
  });
  final Widget child;
  final bool isLoading;
  final String? loadingText;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context), scheme = theme.colorScheme;
    return Stack(
      children: [
        ExcludeFocus(
          excluding: isLoading,
          child: IgnorePointer(
            ignoring: isLoading,
            child: ExcludeSemantics(excluding: isLoading, child: child),
          ),
        ),
        if (isLoading) ...[
          Positioned.fill(
            child: ModalBarrier(
              color: scheme.scrim.withValues(alpha: .45),
              dismissible: false,
            ),
          ),
          Positioned.fill(
            child: SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(LetbuyySpacingTokens.space24),
                  child: Semantics(
                    liveRegion: true,
                    label: loadingText ?? 'Loading',
                    child: ExcludeSemantics(
                      child: Material(
                        color: scheme.surface,
                        borderRadius: BorderRadius.circular(16),
                        child: Padding(
                          padding: const EdgeInsets.all(
                            LetbuyySpacingTokens.space24,
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const LoadingIndicator(),
                              const SizedBox(
                                height: LetbuyySpacingTokens.space16,
                              ),
                              Text(
                                loadingText ?? 'Loading…',
                                textAlign: TextAlign.center,
                                style: theme.textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
