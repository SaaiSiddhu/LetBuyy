// lib/widgets/premium_scaffold.dart
// Premium scaffold wrapper for consistent styling across the marketplace app

import 'package:flutter/material.dart';

/// A premium scaffold wrapper that provides consistent styling
/// and keyboard handling across the marketplace app.
class PremiumScaffold extends StatelessWidget {
  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;
  final Color? backgroundColor;
  final bool extendBody;
  final bool extendBodyBehindAppBar;
  final GlobalKey<ScaffoldState>? scaffoldKey;
  final Widget? endDrawer;
  final Widget? drawer;

  const PremiumScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
    this.backgroundColor,
    this.extendBody = false,
    this.extendBodyBehindAppBar = false,
    this.scaffoldKey,
    this.endDrawer,
    this.drawer,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: scaffoldKey,
      // Let browser API override handle keyboard (don't resize)
      resizeToAvoidBottomInset: true,
      backgroundColor: backgroundColor ?? Theme.of(context).scaffoldBackgroundColor,
      appBar: appBar,
      body: body,
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: floatingActionButtonLocation,
      extendBody: extendBody,
      extendBodyBehindAppBar: extendBodyBehindAppBar,
      endDrawer: endDrawer,
      drawer: drawer,
    );
  }
}
