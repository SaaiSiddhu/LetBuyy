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
  IconData? icon,
  Color? confirmColor,
  Widget Function(BuildContext context, Widget confirmation)? guard,
}) async {
  if (!isLetbuyySurfaceCurrent(context)) return false;
  return await showDialog<bool>(
        context: context,
        builder: (dialog) {
          final confirmation = LetbuyyConfirmation(
            title: title,
            message: message,
            confirmLabel: confirmLabel,
            cancelLabel: cancelLabel,
            destructive: destructive,
            icon: icon,
            confirmColor: confirmColor,
            onCancel: () => completeLetbuyySurface(dialog, false),
            onConfirm: () => completeLetbuyySurface(dialog, true),
          );
          return guard?.call(dialog, confirmation) ?? confirmation;
        },
      ) ??
      false;
}

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
    this.icon,
    this.confirmColor,
  });
  final String title, message, confirmLabel, cancelLabel;
  final bool destructive, showConfirm;
  final VoidCallback? onConfirm, onCancel;
  final Widget? content;
  final IconData? icon;
  final Color? confirmColor;

  @override
  Widget build(BuildContext context) => AlertDialog(
    scrollable: true,
    icon: icon == null
        ? null
        : Icon(
            icon,
            color:
                confirmColor ??
                (destructive
                    ? Theme.of(context).colorScheme.error
                    : Theme.of(context).colorScheme.primary),
          ),
    title: Text(title),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [Text(message), if (content != null) content!],
    ),
    actions: [
      TextButton(onPressed: onCancel, child: Text(cancelLabel)),
      if (showConfirm)
        FilledButton(
          style: confirmColor != null || destructive
              ? FilledButton.styleFrom(
                  backgroundColor:
                      confirmColor ?? Theme.of(context).colorScheme.error,
                  foregroundColor: confirmColor == null
                      ? Theme.of(context).colorScheme.onError
                      : _contrastOn(confirmColor!),
                )
              : null,
          onPressed: onConfirm,
          child: Text(confirmLabel),
        ),
    ],
  );
}

Color _contrastOn(Color background) {
  final luminance = background.computeLuminance();
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
      ? Colors.black
      : Colors.white;
}
