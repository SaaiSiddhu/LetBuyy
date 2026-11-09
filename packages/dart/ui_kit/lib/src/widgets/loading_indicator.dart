import 'package:flutter/material.dart';

/// Inline progress using the active theme and the device's motion preference.
class LoadingIndicator extends StatelessWidget {
  const LoadingIndicator({super.key, this.size = 24, this.color});
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Loading',
    child: ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: MediaQuery.disableAnimationsOf(context)
            ? Icon(
                Icons.hourglass_top,
                size: size,
                color: color ?? Theme.of(context).colorScheme.primary,
              )
            : CircularProgressIndicator(strokeWidth: 2, color: color),
      ),
    ),
  );
}
