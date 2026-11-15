import 'package:flutter/material.dart';

/// Adds button semantics and a minimum mobile tap target to custom tap regions.
class AccessibleTapRegion extends StatelessWidget {
  const AccessibleTapRegion({
    super.key,
    required this.label,
    required this.child,
    this.hint,
    this.onTap,
    this.excludeChildSemantics = false,
    this.minSize = 48,
    this.selected,
    this.focusNode,
  });

  final String label;
  final String? hint;
  final VoidCallback? onTap;
  final Widget child;
  final bool excludeChildSemantics;
  final double minSize;
  final bool? selected;

  /// Optional input focus owned by the native child. This wrapper forwards
  /// semantics focus to that same node; it never creates a second focus owner.
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    final content = ConstrainedBox(
      constraints: BoxConstraints(minWidth: minSize, minHeight: minSize),
      child: child,
    );

    Widget semantics() => Semantics(
      container: true,
      button: true,
      enabled: onTap != null,
      selected: selected,
      label: label,
      hint: hint,
      onTap: onTap,
      focusable: focusNode == null
          ? null
          : onTap != null && focusNode!.canRequestFocus,
      focused: focusNode?.hasFocus,
      onFocus: focusNode == null || onTap == null
          ? null
          : focusNode!.requestFocus,
      child: excludeChildSemantics ? ExcludeSemantics(child: content) : content,
    );
    return focusNode == null
        ? semantics()
        : ListenableBuilder(
            listenable: focusNode!,
            builder: (_, _) => semantics(),
          );
  }
}
