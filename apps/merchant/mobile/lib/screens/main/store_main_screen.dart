import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../widgets/shared/ai_operator_sheet.dart';
import '../../widgets/shared/merchant_search_sheet.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../dashboard/home_screen.dart';
import '../orders/orders_screen.dart';
import '../products/products_screen.dart';
import '../customers/customers_screen.dart';
import '../settings/settings_screen.dart';

class StoreMainScreen extends StatefulWidget {
  const StoreMainScreen({super.key});
  static StoreMainScreenState? _instance;
  static void navigateToHome() => _instance?.goToHome();
  static void navigateToEditor() => _instance?.goToEditor();

  @override
  StoreMainScreenState createState() => StoreMainScreenState();
}

class StoreMainScreenState extends State<StoreMainScreen> {
  int _currentIndex = 0;
  Object? _renderedContext;
  bool _hasSelectedStore = false;
  int _surfaceGeneration = 0;
  final _visited = <int>{0};
  ({Object owner, int tab})? _pageActionOwner;

  late final _pages = <Widget>[
    const HomeScreen(),
    OrdersScreen(
      onPageActionsChanged: (owner, visible) => _pageActions(1, owner, visible),
      isSurfaceActive: () =>
          mounted &&
          _currentIndex == 1 &&
          (ModalRoute.of(context)?.isCurrent ?? true),
    ),
    ProductsScreen(
      onSelectionActionsChanged: (owner, visible) =>
          _pageActions(2, owner, visible),
      isSurfaceActive: () =>
          mounted &&
          _currentIndex == 2 &&
          (ModalRoute.of(context)?.isCurrent ?? true),
    ),
    const CustomersScreen(),
    const SettingsScreen(),
  ];

  void _pageActions(int tab, Object owner, bool visible) {
    if (!mounted) return;
    if (visible && !identical(_pageActionOwner?.owner, owner)) {
      setState(() => _pageActionOwner = (owner: owner, tab: tab));
    } else if (!visible && identical(_pageActionOwner?.owner, owner)) {
      setState(() => _pageActionOwner = null);
    }
  }

  static const _items = [
    CustomBottomNavItem(
      icon: Icons.home_outlined,
      activeIcon: Icons.home_rounded,
      label: 'Home',
    ),
    CustomBottomNavItem(
      icon: Icons.shopping_bag_outlined,
      activeIcon: Icons.shopping_bag_rounded,
      label: 'Orders',
    ),
    CustomBottomNavItem(
      icon: Icons.sell_outlined,
      activeIcon: Icons.sell_rounded,
      label: 'Products',
    ),
    CustomBottomNavItem(
      icon: Icons.people_outline,
      activeIcon: Icons.people_rounded,
      label: 'Customers',
    ),
    CustomBottomNavItem(
      icon: Icons.menu_rounded,
      activeIcon: Icons.menu_rounded,
      label: 'More',
    ),
  ];

  @override
  void initState() {
    super.initState();
    StoreMainScreen._instance = this;
  }

  @override
  void dispose() {
    if (StoreMainScreen._instance == this) StoreMainScreen._instance = null;
    super.dispose();
  }

  void switchToTab(int index) {
    if (index < 0 || index >= _pages.length || index == _currentIndex) return;
    HapticFeedback.selectionClick();
    setState(() {
      _visited.add(index);
      _currentIndex = index;
    });
  }

  void goToHome() => switchToTab(0);
  void goToEditor() => switchToTab(2);

  void _openSearch() {
    HapticFeedback.selectionClick();
    final stores = context.read<StoreContext>(), id = stores.selectedStoreId;
    final view = id == null
        ? null
        : (key: stores.requestContextKey, storeId: id);
    showLetbuyyFormSheet<void>(
      context: context,
      builder: (_) => view == null
          ? const LetbuyyFormSheet(
              title: 'Search store',
              child: Text(
                'Choose a store from the dashboard before searching.',
              ),
            )
          : guardMerchantStoreView(view, const MerchantSearchSheet()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context), scheme = theme.colorScheme;
    final storeContext = context.watch<StoreContext>();
    final selectedContext = storeContext.requestContextKey;
    if (_hasSelectedStore && _renderedContext != selectedContext) {
      _surfaceGeneration++;
      _pageActionOwner = null;
      _visited
        ..clear()
        ..add(_currentIndex);
    }
    _renderedContext = selectedContext;
    _hasSelectedStore = storeContext.selectedStoreId != null;
    final dark = theme.brightness == Brightness.dark;
    final activeRoute = ModalRoute.of(context)?.isCurrent ?? true;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: dark ? Brightness.light : Brightness.dark,
        systemNavigationBarColor: scheme.surface,
        systemNavigationBarIconBrightness: dark
            ? Brightness.light
            : Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: scheme.surface,
        body: IndexedStack(
          key: ValueKey(_surfaceGeneration),
          index: _currentIndex,
          children: [
            for (var i = 0; i < _pages.length; i++)
              TickerMode(
                enabled: i == _currentIndex && activeRoute,
                child: _visited.contains(i)
                    ? _pages[i]
                    : const SizedBox.shrink(),
              ),
          ],
        ),
        floatingActionButton: _pageActionOwner?.tab == _currentIndex
            ? null
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  FloatingActionButton.small(
                    heroTag: 'merchant-search',
                    tooltip: 'Search store',
                    onPressed: _openSearch,
                    child: const Icon(Icons.search),
                  ),
                  const SizedBox(width: LetbuyySpacingTokens.space8),
                  FloatingActionButton(
                    heroTag: 'merchant-ai-operator',
                    tooltip: 'AI store operator',
                    onPressed: () => showAiOperatorSheet(context),
                    child: const Icon(Icons.auto_awesome),
                  ),
                ],
              ),
        bottomNavigationBar: CustomBottomNav(
          currentIndex: _currentIndex,
          onTap: switchToTab,
          items: _items,
        ),
      ),
    );
  }
}
