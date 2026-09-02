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
  });

  final String label;
  final String? hint;
  final VoidCallback? onTap;
  final Widget child;
  final bool excludeChildSemantics;
  final double minSize;
  final bool? selected;

  @override
  Widget build(BuildContext context) {
    final content = ConstrainedBox(
      constraints: BoxConstraints(minWidth: minSize, minHeight: minSize),
      child: child,
    );

    return Semantics(
      container: true,
      button: true,
      enabled: onTap != null,
      selected: selected,
      label: label,
      hint: hint,
      onTap: onTap,
      child: excludeChildSemantics ? ExcludeSemantics(child: content) : content,
    );
  }
}
