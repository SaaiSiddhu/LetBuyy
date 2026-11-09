import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../letbuyy_ui_kit.dart';

class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final Widget? leading;
  final bool centerTitle;
  final bool isGlass;
  final Color? backgroundColor;
  final double toolbarHeight;
  final bool automaticallyImplyLeading;

  const CustomAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
    this.centerTitle = true,
    this.isGlass = true,
    this.backgroundColor,
    this.toolbarHeight = kToolbarHeight,
    this.automaticallyImplyLeading = true,
  });

  /// Flowing title geometry for operational pages. Native icon actions each
  /// reserve one 48dp target; wide text actions belong in the page body.
  factory CustomAppBar.responsive({
    required BuildContext context,
    required String title,
    List<Widget>? actions,
    Widget? leading,
    bool automaticallyImplyLeading = true,
  }) {
    final media = MediaQuery.of(context);
    final hasLeading =
        leading != null ||
        (automaticallyImplyLeading &&
            (Navigator.maybeOf(context)?.canPop() ?? false));
    final available = math.max(
      1.0,
      media.size.width -
          media.padding.horizontal -
          (hasLeading ? kToolbarHeight : 0) -
          (actions?.length ?? 0) * 48 -
          32,
    );
    final painter = TextPainter(
      text: TextSpan(
        text: title,
        style: Theme.of(context).textTheme.titleLarge,
      ),
      textDirection: Directionality.of(context),
      textScaler: media.textScaler,
    )..layout(maxWidth: available);
    final height = math.max(kToolbarHeight, painter.height + 24);
    painter.dispose();
    return CustomAppBar(
      title: title,
      actions: actions,
      leading: leading,
      centerTitle: false,
      isGlass: false,
      automaticallyImplyLeading: automaticallyImplyLeading,
      toolbarHeight: height,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (isGlass) {
      return GlassContainer(
        borderRadius: BorderRadius.zero,
        blur: 10,
        opacity: 0.1,
        border: Border(
          bottom: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: AppBar(
          title: Text(title, style: AppTextStyles.appBarTitle),
          centerTitle: centerTitle,
          actions: actions,
          leading: leading,
          toolbarHeight: toolbarHeight,
          automaticallyImplyLeading: automaticallyImplyLeading,
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
        ),
      );
    }

    return AppBar(
      title: Text(title, style: Theme.of(context).textTheme.titleLarge),
      centerTitle: centerTitle,
      actions: actions,
      leading: leading,
      toolbarHeight: toolbarHeight,
      automaticallyImplyLeading: automaticallyImplyLeading,
      backgroundColor: backgroundColor ?? Theme.of(context).colorScheme.surface,
      foregroundColor: Theme.of(context).colorScheme.onSurface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 2,
    );
  }

  @override
  Size get preferredSize => Size.fromHeight(toolbarHeight);
}
