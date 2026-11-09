import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as kit;

/// Compatibility facade: existing call sites keep their message/input contract.
/// Rendering, focus, motion, blocking and semantics have one shared owner.
class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({
    super.key,
    this.message,
    required this.isLoading,
    required this.child,
  });
  final String? message;
  final bool isLoading;
  final Widget child;

  @override
  Widget build(BuildContext context) => kit.LoadingOverlay(
    isLoading: isLoading,
    loadingText: message,
    child: child,
  );
}

class LoadingIndicator extends StatelessWidget {
  const LoadingIndicator({super.key, this.size = 24, this.color});
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) =>
      kit.LoadingIndicator(size: size, color: color);
}
