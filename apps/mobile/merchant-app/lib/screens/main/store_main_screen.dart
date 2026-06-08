import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_theme_colors.dart';
import '../dashboard/home_screen.dart';
import '../orders/orders_screen.dart';
import '../products/products_screen.dart';
import '../customers/customers_screen.dart';
import '../settings/settings_screen.dart';
import '../../widgets/shared/ai_operator_sheet.dart';

/// Main screen with 5-tab bottom navigation
/// Tabs: Home, Orders, Products, Customers, More
class StoreMainScreen extends StatefulWidget {
  const StoreMainScreen({super.key});

  /// Static instance for navigation from child widgets
  static StoreMainScreenState? _instance;

  /// Navigate to home tab from anywhere
  static void navigateToHome() {
    _instance?.goToHome();
  }

  /// Navigate to editor tab from anywhere
  static void navigateToEditor() {
    _instance?.goToEditor();
  }

  @override
  StoreMainScreenState createState() => StoreMainScreenState();
}

class StoreMainScreenState extends State<StoreMainScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    StoreMainScreen._instance = this;
  }

  @override
  void dispose() {
    if (StoreMainScreen._instance == this) {
      StoreMainScreen._instance = null;
    }
    super.dispose();
  }

  /// Switch to a specific tab
  void switchToTab(int index) {
    if (index >= 0 && index < 5) {
      setState(() => _currentIndex = index);
    }
  }

  /// Navigate to home tab (convenience method)
  void goToHome() => switchToTab(0);

  /// Navigate to editor tab (convenience method)
  void goToEditor() => switchToTab(4);

  final List<_NavItem> _navItems = const [
    _NavItem(
      icon: Icons.home_rounded,
      activeIcon: Icons.home_rounded,
      label: 'Home',
    ),
    _NavItem(
      icon: Icons.receipt_long_outlined,
      activeIcon: Icons.receipt_long_rounded,
      label: 'Orders',
    ),
    _NavItem(
      icon: Icons.inventory_2_outlined,
      activeIcon: Icons.inventory_2_rounded,
      label: 'Products',
    ),
    _NavItem(
      icon: Icons.people_outline_rounded,
      activeIcon: Icons.people_rounded,
      label: 'Customers',
    ),
    _NavItem(
      icon: Icons.more_horiz_rounded,
      activeIcon: Icons.more_horiz_rounded,
      label: 'More',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          const HomeScreen(),
          const OrdersScreen(),
          const ProductsScreen(),
          const CustomersScreen(),
          const SettingsScreen(),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: 'AI store operator',
        onPressed: () => showAiOperatorSheet(context),
        child: const Icon(Icons.auto_awesome_rounded),
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildBottomNav() {
    final colors = AppThemeColors.of(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.bottomNavBackground,
        border: Border(
          top: BorderSide(color: colors.bottomNavBorder, width: 1),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(
              _navItems.length,
              (index) => _buildNavItem(index, colors),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, AppThemeColors colors) {
    final isSelected = _currentIndex == index;
    final item = _navItems[index];

    return Semantics(
      button: true,
      selected: isSelected,
      label: '${item.label} tab',
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          switchToTab(index);
        },
        behavior: HitTestBehavior.opaque,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            padding: EdgeInsets.symmetric(
              horizontal: isSelected ? 16 : 12,
              vertical: 10,
            ),
            decoration: BoxDecoration(
              color: isSelected
                  ? colors.bottomNavSelectedBg
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isSelected ? item.activeIcon : item.icon,
                  color: isSelected
                      ? colors.bottomNavSelected
                      : colors.bottomNavUnselected,
                  size: 24,
                ),
                AnimatedSize(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeInOut,
                  child: isSelected
                      ? Padding(
                          padding: const EdgeInsets.only(left: 8),
                          child: Text(
                            item.label,
                            style: TextStyle(
                              color: colors.bottomNavSelected,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}
