import 'package:flutter/material.dart';
import '../tokens/letbuyy_tokens.dart';

/// Native short-form route. The caller owns the draft and authoritative save;
/// this host owns safe areas, keyboard clearance, scrolling and theme geometry.
Future<T?> showLetbuyyFormSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool isDismissible = true,
}) => showModalBottomSheet<T>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  enableDrag: false,
  isDismissible: isDismissible,
  backgroundColor: Theme.of(context).colorScheme.surface,
  sheetAnimationStyle: MediaQuery.disableAnimationsOf(context)
      ? AnimationStyle.noAnimation
      : null,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(
      top: Radius.circular(LetbuyyRadiusTokens.xl * 1.0),
    ),
  ),
  builder: builder,
);

/// UI lifetime only. This does not prove permission or cancel a server command.
bool isLetbuyySurfaceCurrent(BuildContext context) =>
    context.mounted && ModalRoute.of(context)?.isCurrent == true;

/// Finish an explicit result or a confirmed dismissal on its originating route.
/// An outgoing callback must never pop the destination now behind that route.
bool completeLetbuyySurface<T>(BuildContext context, [T? result]) {
  if (!isLetbuyySurfaceCurrent(context)) return false;
  Navigator.pop<T>(context, result);
  return true;
}

/// Back/Close preserves the existing PopScope and unsaved-change behavior.
Future<bool> dismissLetbuyySurface<T>(BuildContext context, [T? result]) async {
  if (!isLetbuyySurfaceCurrent(context)) return false;
  return Navigator.maybePop<T>(context, result);
}

class LetbuyyFormSheet extends StatelessWidget {
  const LetbuyyFormSheet({
    super.key,
    required this.title,
    required this.child,
    this.description,
    this.actions = const [],
    this.canDismiss = true,
    this.onClose,
    this.onDismissAttempt,
    this.closeLabel = 'Close',
  });

  final String title;
  final String? description;
  final Widget child;
  final List<Widget> actions;
  final bool canDismiss;
  final VoidCallback? onClose;

  /// A draft owner may handle Back/Close while direct dismissal is disabled.
  /// Busy owners leave this null; this does not cancel an in-flight command.
  final VoidCallback? onDismissAttempt;
  final String closeLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // This is the only keyboard inset owner. Form bodies must not add it again.
    return PopScope(
      canPop: canDismiss,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) onDismissAttempt?.call();
      },
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.all(LetbuyySpacingTokens.space20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: Text(title, style: theme.textTheme.titleLarge),
                      ),
                    ),
                    IconButton(
                      tooltip: closeLabel,
                      onPressed: !canDismiss
                          ? onDismissAttempt
                          : onClose ?? () => dismissLetbuyySurface(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                if (description != null) ...[
                  Text(description!, style: theme.textTheme.bodyMedium),
                  const SizedBox(height: LetbuyySpacingTokens.space16),
                ],
                child,
                if (actions.isNotEmpty) ...[
                  const SizedBox(height: LetbuyySpacingTokens.space20),
                  OverflowBar(
                    alignment: MainAxisAlignment.end,
                    spacing: LetbuyySpacingTokens.space12,
                    overflowSpacing: LetbuyySpacingTokens.space12,
                    children: actions,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
