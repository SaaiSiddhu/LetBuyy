import 'package:flutter/material.dart';
import '../../letbuyy_ui_kit.dart';

class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final Widget? leading;
  final bool centerTitle;
  final bool isGlass;
  final Color? backgroundColor;

  const CustomAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
    this.centerTitle = true,
    this.isGlass = true,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    if (isGlass) {
      return GlassContainer(
        borderRadius: BorderRadius.zero,
        blur: 10,
        opacity: 0.1,
        border: Border(bottom: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
        child: AppBar(
          title: Text(title, style: AppTextStyles.appBarTitle),
          centerTitle: centerTitle,
          actions: actions,
          leading: leading,
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
        ),
      );
    }

    return AppBar(
      title: Text(title, style: AppTextStyles.appBarTitle),
      centerTitle: centerTitle,
      actions: actions,
      leading: leading,
      backgroundColor: backgroundColor ?? AppColors.surface,
      elevation: 0,
      scrolledUnderElevation: 2,
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
