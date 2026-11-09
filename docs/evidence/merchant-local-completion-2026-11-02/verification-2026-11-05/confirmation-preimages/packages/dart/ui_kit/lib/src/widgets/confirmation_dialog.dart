import 'package:flutter/material.dart';
import 'form_sheet.dart';

/// Brief consequential confirmation; forms belong in sheets or editors.
Future<bool> showLetbuyyConfirmation({
  required BuildContext context,
  required String title,
  required String message,
  required String confirmLabel,
  String cancelLabel = 'Cancel',
  bool destructive = false,
  Widget Function(BuildContext context, Widget confirmation)? guard,
}) async =>
    await showDialog<bool>(
      context: context,
      builder: (dialog) {
        final confirmation = LetbuyyConfirmation(
          title: title,
          message: message,
          confirmLabel: confirmLabel,
          cancelLabel: cancelLabel,
          destructive: destructive,
          onCancel: () => completeLetbuyySurface(dialog, false),
          onConfirm: () => completeLetbuyySurface(dialog, true),
        );
        return guard?.call(dialog, confirmation) ?? confirmation;
      },
    ) ??
    false;

/// Canonical brief confirmation frame. A task may keep this frame mounted
/// through submission/readback instead of dismissing before its command settles.
class LetbuyyConfirmation extends StatelessWidget {
  const LetbuyyConfirmation({
    super.key,
    required this.title,
    required this.message,
    required this.confirmLabel,
    required this.onConfirm,
    required this.onCancel,
    this.cancelLabel = 'Cancel',
    this.destructive = false,
    this.content,
    this.showConfirm = true,
  });
  final String title, message, confirmLabel, cancelLabel;
  final bool destructive, showConfirm;
  final VoidCallback? onConfirm, onCancel;
  final Widget? content;

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(title),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [Text(message), if (content != null) content!],
      ),
    ),
    actions: [
      TextButton(onPressed: onCancel, child: Text(cancelLabel)),
      if (showConfirm)
        FilledButton(
          style: destructive
              ? FilledButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.error,
                  foregroundColor: Theme.of(context).colorScheme.onError,
                )
              : null,
          onPressed: onConfirm,
          child: Text(confirmLabel),
        ),
    ],
  );
}
