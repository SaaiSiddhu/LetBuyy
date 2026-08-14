// lib/screens/main/store_main_screen.dart
// MAIN SCREEN — LetBuyy v2 floating nav redesign
// Layout: [Search○] [≡≡ Home | Orders | Products | Theme | Settings ≡≡]
// Exact identity web-app bg colors · matches login / otp design language

import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../services/theme_provider.dart';
import '../../theme/app_theme_colors.dart';
import '../dashboard/home_screen.dart';
import '../orders/orders_screen.dart';
import '../products/products_screen.dart';
import '../customize/theme_screen.dart';
import '../settings/settings_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — same as login_screen.dart / identity web app
// ─────────────────────────────────────────────────────────────────────────────
const _kPrimary       = Color(0xFF6C47FF);
const _kPrimaryLight  = Color(0xFF8B6AFF);

const _kDarkBg        = Color(0xFF0A0912); // identity --bg dark
const _kDarkNav       = Color(0xFF15131F); // identity --bg-secondary dark  rgb(21,19,31)
const _kDarkBorder    = Color(0x2E8B5CF6); // rgba(139,92,246,0.18)

const _kLightBg       = Color(0xFFFAF9FF); // identity --bg light
const _kLightNav      = Color(0xFFFFFFFF); // white pill on light bg
const _kLightBorder   = Color(0xFFE0D8F8); // identity --border light

// Floating nav height (pill + padding + safe area space)
const double _kNavReservedHeight = 88.0;

// ─────────────────────────────────────────────────────────────────────────────

class StoreMainScreen extends StatefulWidget {
  const StoreMainScreen({super.key});

  static StoreMainScreenState? _instance;
  static void navigateToHome()   => _instance?.goToHome();
  static void navigateToEditor() => _instance?.goToEditor();

  @override
  StoreMainScreenState createState() => StoreMainScreenState();
}

class StoreMainScreenState extends State<StoreMainScreen>
    with TickerProviderStateMixin {
  int _currentIndex = 0;

  late final AnimationController _entryCtrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 550),
  );

  @override
  void initState() {
    super.initState();
    StoreMainScreen._instance = this;
    _entryCtrl.forward();
  }

  @override
  void dispose() {
    if (StoreMainScreen._instance == this) StoreMainScreen._instance = null;
    _entryCtrl.dispose();
    super.dispose();
  }

  void switchToTab(int index) {
    if (index < 0 || index >= 5 || index == _currentIndex) return;
    HapticFeedback.lightImpact();
    setState(() => _currentIndex = index);
  }

  void goToHome()   => switchToTab(0);
  void goToEditor() => switchToTab(3); // Theme editor is tab 3

  void _openSearch() {
    HapticFeedback.lightImpact();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SearchSheet(isDark: isDark),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final isDark = themeProvider.isDarkMode(context);
    final colors = AppThemeColors.of(context);

    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
      systemNavigationBarColor: isDark ? _kDarkBg : _kLightBg,
    ));

    return Scaffold(
      backgroundColor: isDark ? _kDarkBg : _kLightBg,
      extendBody: true,
      body: IndexedStack(
        index: _currentIndex,
        children: const [
          HomeScreen(),
          OrdersScreen(),
          ProductsScreen(),
          ThemeScreen(),
          SettingsScreen(),
        ],
      ),
      // The bottomNavigationBar slot reserves space so content isn't hidden
      bottomNavigationBar: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 1.4),
          end: Offset.zero,
        ).animate(
          CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOutCubic),
        ),
        child: _FloatingNav(
          currentIndex: _currentIndex,
          isDark: isDark,
          colors: colors,
          onTabChanged: switchToTab,
          onSearch: _openSearch,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating nav — fully flat icons over a live blur backdrop
// ─────────────────────────────────────────────────────────────────────────────

class _FloatingNav extends StatelessWidget {
  const _FloatingNav({
    required this.currentIndex,
    required this.isDark,
    required this.colors,
    required this.onTabChanged,
    required this.onSearch,
  });

  final int currentIndex;
  final bool isDark;
  final AppThemeColors colors;
  final ValueChanged<int> onTabChanged;
  final VoidCallback onSearch;

  static const _items = [
    _NavDef(icon: Icons.home_outlined,         activeIcon: Icons.home_rounded,          label: 'Home'),
    _NavDef(icon: Icons.shopping_bag_outlined, activeIcon: Icons.shopping_bag_rounded,  label: 'Orders'),
    _NavDef(icon: Icons.sell_outlined,         activeIcon: Icons.sell_rounded,          label: 'Products'),
    _NavDef(icon: Icons.brush_outlined,        activeIcon: Icons.brush_rounded,         label: 'Theme'),
    _NavDef(icon: Icons.menu_rounded,          activeIcon: Icons.menu_rounded,          label: 'Settings'),
  ];

  @override
  Widget build(BuildContext context) {
    final bgColor = isDark ? _kDarkBg : _kLightBg;
    final cardColor = isDark ? _kDarkNav : _kLightNav;
    final borderColor = isDark ? _kDarkBorder : _kLightBorder;

    return Stack(
      children: [
        // ── Live blur backdrop — blurs scrolling content behind nav ───────
        Positioned.fill(
          child: ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 28, sigmaY: 28),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      bgColor.withValues(alpha: 0.0),
                      bgColor.withValues(alpha: 0.68),
                      bgColor.withValues(alpha: 0.94),
                    ],
                    stops: const [0.0, 0.35, 1.0],
                  ),
                ),
              ),
            ),
          ),
        ),

        // ── Two floating cards over the blur ─────────────────────────────
        SafeArea(
          top: false,
          child: SizedBox(
            height: _kNavReservedHeight,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
              child: Row(
                children: [
                  // LEFT CARD — search circle
                  _SearchCard(
                    onTap: onSearch,
                    isDark: isDark,
                    cardColor: cardColor,
                    borderColor: borderColor,
                  ),
                  const SizedBox(width: 10),
                  // RIGHT CARD — nav pill with 5 icons
                  Expanded(
                    child: _NavCard(
                      items: _items,
                      currentIndex: currentIndex,
                      isDark: isDark,
                      cardColor: cardColor,
                      borderColor: borderColor,
                      onTap: onTabChanged,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search card — left floating circle card
// ─────────────────────────────────────────────────────────────────────────────

class _SearchCard extends StatefulWidget {
  const _SearchCard({
    required this.onTap,
    required this.isDark,
    required this.cardColor,
    required this.borderColor,
  });
  final VoidCallback onTap;
  final bool isDark;
  final Color cardColor;
  final Color borderColor;

  @override
  State<_SearchCard> createState() => _SearchCardState();
}

class _SearchCardState extends State<_SearchCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) { setState(() => _pressed = false); widget.onTap(); },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.90 : 1.0,
        duration: const Duration(milliseconds: 130),
        curve: Curves.easeOut,
        child: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: widget.cardColor,
            shape: BoxShape.circle,
            border: Border.all(color: widget.borderColor, width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: widget.isDark ? 0.38 : 0.07),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Center(
            child: Icon(
              Icons.search_rounded,
              size: 21,
              color: widget.isDark
                  ? Colors.white.withValues(alpha: 0.65)
                  : Colors.black.withValues(alpha: 0.55),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav card — right floating pill card with 5 icon items
// ─────────────────────────────────────────────────────────────────────────────

class _NavCard extends StatelessWidget {
  const _NavCard({
    required this.items,
    required this.currentIndex,
    required this.isDark,
    required this.cardColor,
    required this.borderColor,
    required this.onTap,
  });

  final List<_NavDef> items;
  final int currentIndex;
  final bool isDark;
  final Color cardColor;
  final Color borderColor;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: double.infinity,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor, width: 1),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.40)
                : Colors.black.withValues(alpha: 0.07),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: _kPrimary.withValues(alpha: isDark ? 0.10 : 0.05),
            blurRadius: 14,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: List.generate(items.length, (i) {
          return Expanded(
            child: _NavCardItem(
              item: items[i],
              isActive: currentIndex == i,
              isDark: isDark,
              onTap: () => onTap(i),
            ),
          );
        }),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav card item — icon inside pill, active gets purple circle bg
// ─────────────────────────────────────────────────────────────────────────────

class _NavCardItem extends StatefulWidget {
  const _NavCardItem({
    required this.item,
    required this.isActive,
    required this.isDark,
    required this.onTap,
  });
  final _NavDef item;
  final bool isActive;
  final bool isDark;
  final VoidCallback onTap;

  @override
  State<_NavCardItem> createState() => _NavCardItemState();
}

class _NavCardItemState extends State<_NavCardItem>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 200),
  );
  late final Animation<double> _scale = Tween<double>(begin: 1.0, end: 0.86)
      .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: widget.isActive,
      label: '${widget.item.label} tab',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _ctrl.forward(),
        onTapUp: (_) { _ctrl.reverse(); widget.onTap(); },
        onTapCancel: () => _ctrl.reverse(),
        child: ScaleTransition(
          scale: _scale,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 7),
            decoration: widget.isActive
                ? BoxDecoration(
                    color: _kPrimary,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [
                      BoxShadow(
                        color: _kPrimary.withValues(alpha: 0.38),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  )
                : const BoxDecoration(),
            child: Center(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                child: Icon(
                  widget.isActive ? widget.item.activeIcon : widget.item.icon,
                  key: ValueKey(widget.isActive),
                  size: 21,
                  color: widget.isActive
                      ? Colors.white
                      : widget.isDark
                          ? Colors.white.withValues(alpha: 0.45)
                          : Colors.black.withValues(alpha: 0.40),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search sheet (placeholder)
// ─────────────────────────────────────────────────────────────────────────────

class _SearchSheet extends StatefulWidget {
  const _SearchSheet({required this.isDark});
  final bool isDark;

  @override
  State<_SearchSheet> createState() => _SearchSheetState();
}

class _SearchSheetState extends State<_SearchSheet> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 120), () {
      if (mounted) _focus.requestFocus();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final isDark = widget.isDark;

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.5,
      maxChildSize: 0.96,
      builder: (_, scrollCtrl) => Container(
        decoration: BoxDecoration(
          color: isDark ? _kDarkNav : _kLightNav,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(
              color: isDark ? _kDarkBorder : _kLightBorder),
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 16),
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.15)
                    : Colors.black.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Search field
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.04)
                      : Colors.black.withValues(alpha: 0.025),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.10)
                        : Colors.black.withValues(alpha: 0.09),
                  ),
                ),
                child: TextField(
                  controller: _ctrl,
                  focusNode: _focus,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Search orders, products…',
                    hintStyle: TextStyle(
                        color: colors.textHint, fontSize: 15),
                    prefixIcon: Icon(Icons.search_rounded,
                        color: isDark
                            ? Colors.white38
                            : Colors.black38,
                        size: 20),
                    border: InputBorder.none,
                    contentPadding:
                        const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Placeholder
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.search_rounded,
                        size: 48,
                        color: isDark
                            ? Colors.white12
                            : Colors.black12),
                    const SizedBox(height: 12),
                    Text(
                      'Search coming soon',
                      style: TextStyle(
                        color: colors.textTertiary,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

class _NavDef {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const _NavDef({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}
