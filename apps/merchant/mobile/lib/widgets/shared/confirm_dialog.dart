import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Public compatibility adapter; the shared UI kit owns confirmation presentation.
class ConfirmDialog extends StatelessWidget {
  final String title;
  final String message;
  final String confirmLabel;
  final String cancelLabel;
  final IconData? icon;
  final Color? confirmColor;
  final bool isDestructive;

  const ConfirmDialog({
    super.key,
    required this.title,
    required this.message,
    this.confirmLabel = 'Confirm',
    this.cancelLabel = 'Cancel',
    this.icon,
    this.confirmColor,
    this.isDestructive = false,
  });

  static Future<bool> show(
    BuildContext context, {
    required String title,
    required String message,
    String confirmLabel = 'Confirm',
    String cancelLabel = 'Cancel',
    IconData? icon,
    Color? confirmColor,
    bool isDestructive = false,
  }) => showLetbuyyConfirmation(
    context: context,
    title: title,
    message: message,
    confirmLabel: confirmLabel,
    cancelLabel: cancelLabel,
    icon: icon,
    confirmColor: confirmColor,
    destructive: isDestructive,
  );

  @override
  Widget build(BuildContext context) => LetbuyyConfirmation(
    title: title,
    message: message,
    confirmLabel: confirmLabel,
    cancelLabel: cancelLabel,
    icon: icon,
    confirmColor: confirmColor,
    destructive: isDestructive,
    onCancel: () => completeLetbuyySurface(context, false),
    onConfirm: () => completeLetbuyySurface(context, true),
  );
}
