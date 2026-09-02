// lib/widgets/web_layout_shell.dart
// 💎 Web Layout Shell - Provides consistent header/sidebar/footer for all web screens

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:provider/provider.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_marketplace/widgets/web_sidebar.dart';
import 'package:letbuyy_marketplace/screens/home/widgets/web_header.dart';
import 'package:letbuyy_marketplace/screens/home/widgets/web_footer.dart';

/// A layout wrapper that provides consistent header/sidebar/footer for web screens
/// 
/// Usage:
/// ```dart
/// WebLayoutShell(
///   activeRoute: AppRoutes.home,
///   child: YourScreenContent(),
/// )
/// ```
class WebLayoutShell extends StatefulWidget {
  final Widget child;
  final String? activeRoute;
  final bool showHeader;
  final bool showSidebar;
  final bool showFooter;
  final bool scrollable;

  const WebLayoutShell({
    super.key,
    required this.child,
    this.activeRoute,
    this.showHeader = true,
    this.showSidebar = true,
    this.showFooter = true,
    this.scrollable = true,
  });

  @override
  State<WebLayoutShell> createState() => _WebLayoutShellState();
}

class _WebLayoutShellState extends State<WebLayoutShell> {
  bool _sidebarExpanded = true;

  // Breakpoints
  static const double mobileBreakpoint = 768.0;
  static const double tabletBreakpoint = 1200.0;

  @override
  Widget build(BuildContext context) {
    // Only apply shell on web
    if (!kIsWeb) {
      return widget.child;
    }

    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final screenWidth = MediaQuery.of(context).size.width;

    // Determine layout type based on screen width
    final isMobile = screenWidth < mobileBreakpoint;
    final isTablet = screenWidth >= mobileBreakpoint && screenWidth < tabletBreakpoint;
    final isDesktop = screenWidth >= tabletBreakpoint;

    // For mobile web, collapse sidebar by default
    if (isMobile && _sidebarExpanded) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _sidebarExpanded = false);
      });
    }

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      drawer: isMobile && widget.showSidebar
          ? _buildMobileDrawer(isDark)
          : null,
      body: Column(
        children: [
          // Sticky Header
          if (widget.showHeader)
            const WebHeader(),

          // Main Content Area
          Expanded(
            child: Row(
              children: [
                // Sidebar (hidden on mobile, shown on tablet/desktop)
                if (widget.showSidebar && !isMobile)
                  WebSidebar(
                    activeRoute: widget.activeRoute,
                    isExpanded: isDesktop && _sidebarExpanded,
                    onToggle: () {
                      setState(() => _sidebarExpanded = !_sidebarExpanded);
                    },
                  ),

                // Page Content with Footer
                Expanded(
                  child: widget.scrollable
                      ? CustomScrollView(
                          slivers: [
                            // Main Content
                            SliverToBoxAdapter(
                              child: widget.child,
                            ),
                            // Footer
                            if (widget.showFooter)
                              const SliverToBoxAdapter(
                                child: WebFooter(),
                              ),
                          ],
                        )
                      : Column(
                          children: [
                            Expanded(child: widget.child),
                            if (widget.showFooter)
                              const WebFooter(),
                          ],
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileDrawer(bool isDark) {
    return Drawer(
      backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
      child: WebSidebar(
        activeRoute: widget.activeRoute,
        isExpanded: true,
        onToggle: () {
          Navigator.pop(context);
        },
      ),
    );
  }
}

/// Extension to easily wrap any widget with WebLayoutShell
extension WebLayoutShellExtension on Widget {
  Widget withWebLayout({
    String? activeRoute,
    bool showHeader = true,
    bool showSidebar = true,
    bool showFooter = true,
    bool scrollable = true,
  }) {
    return WebLayoutShell(
      activeRoute: activeRoute,
      showHeader: showHeader,
      showSidebar: showSidebar,
      showFooter: showFooter,
      scrollable: scrollable,
      child: this,
    );
  }
}
