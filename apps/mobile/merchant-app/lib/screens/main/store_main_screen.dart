import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_theme_colors.dart';
import '../dashboard/home_screen.dart';
import '../editor/section_editor_screen.dart';
import '../customize/theme_screen.dart';
import '../products/products_screen.dart';
import '../settings/settings_screen.dart';

/// Main screen with 5-tab bottom navigation
/// Tabs: Home, Editor, Theme, Products, Settings
class StoreMainScreen extends StatefulWidget {
  const StoreMainScreen({super.key});
  
  /// Static instance for navigation from child widgets
  static StoreMainScreenState? _instance;
  
  /// Navigate to home tab from anywhere
  static void navigateToHome() {
    _instance?.goToHome();
  }

  @override
  StoreMainScreenState createState() => StoreMainScreenState();
}

class StoreMainScreenState extends State<StoreMainScreen> {
  int _currentIndex = 0;
  
  // Global keys for child screens
  final GlobalKey<SectionEditorScreenState> _editorKey = GlobalKey<SectionEditorScreenState>();
  
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
      // Reload editor data when switching to editor tab
      if (index == 1) {
        _editorKey.currentState?.reloadStore();
      }
    }
  }
  
  /// Navigate to home tab (convenience method)
  void goToHome() => switchToTab(0);

  final List<_NavItem> _navItems = const [
    _NavItem(icon: Icons.home_rounded, activeIcon: Icons.home_rounded, label: 'Home'),
    _NavItem(icon: Icons.layers_outlined, activeIcon: Icons.layers_rounded, label: 'Editor'),
    _NavItem(icon: Icons.palette_outlined, activeIcon: Icons.palette_rounded, label: 'Theme'),
    _NavItem(icon: Icons.inventory_2_outlined, activeIcon: Icons.inventory_2_rounded, label: 'Products'),
    _NavItem(icon: Icons.settings_outlined, activeIcon: Icons.settings_rounded, label: 'Settings'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          const HomeScreen(),
          SectionEditorScreen(key: _editorKey),
          const ThemeScreen(),
          const ProductsScreen(),
          const SettingsScreen(),
        ],
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
          top: BorderSide(
            color: colors.bottomNavBorder,
            width: 1,
          ),
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
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        switchToTab(index);
      },
      behavior: HitTestBehavior.opaque,
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
              color: isSelected ? colors.bottomNavSelected : colors.bottomNavUnselected,
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

