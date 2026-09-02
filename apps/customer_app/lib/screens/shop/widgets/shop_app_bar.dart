// lib/screens/user/shop/widgets/shop_app_bar.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import '../../profile/saved_addresses_screen.dart';
import 'sort_bottom_sheet.dart';

const double kAppBarHeight = 172; // Adjusted height for 3 rows

class ShopAppBar extends StatefulWidget implements PreferredSizeWidget {
  final VoidCallback onViewToggle;
  final bool isGridView;
  final String title;
  final String sortBy;
  final Function(String) onSortChanged;
  final int activeFiltersCount;
  final VoidCallback onFilterTap;
  final Function(String)? onSearchChanged;
  final TextEditingController? searchController;

  const ShopAppBar({
    super.key,
    required this.onViewToggle,
    required this.isGridView,
    this.title = 'Shop',
    this.sortBy = 'newest',
    required this.onSortChanged,
    this.activeFiltersCount = 0,
    required this.onFilterTap,
    this.onSearchChanged,
    this.searchController,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kAppBarHeight);

  @override
  State<ShopAppBar> createState() => _ShopAppBarState();
}

class _ShopAppBarState extends State<ShopAppBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  String _currentLocationText = 'Fetching location...';
  bool _isLoadingLocation = false;

  bool _isMounted = true;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _getCurrentLocationAddress();
  }

  void _setupAnimations() {
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );

    _slideAnimation = Tween<Offset>(
            begin: const Offset(0, 0.15), end: Offset.zero)
        .animate(
            CurvedAnimation(parent: _animationController, curve: Curves.easeOut));
  }

  void _safeSyncState(VoidCallback callback) {
    if (_isMounted && mounted) {
      try {
        setState(callback);
      } catch (e) {
        debugPrint('⚠️ Error in setState: $e');
      }
    }
  }

  Future<void> _getCurrentLocationAddress() async {
    if (!_isMounted) return;

    try {
      _safeSyncState(() => _isLoadingLocation = true);
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _safeSyncState(() {
          _currentLocationText = 'Location disabled';
          _isLoadingLocation = false;
        });
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        _safeSyncState(() {
          _currentLocationText = 'Location denied';
          _isLoadingLocation = false;
        });
        return;
      }
      if (!_isMounted) return;

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
        timeLimit: const Duration(seconds: 4),
      );

      if (!_isMounted) return;

      final placemarks =
          await placemarkFromCoordinates(pos.latitude, pos.longitude);
      if (placemarks.isNotEmpty && _isMounted) {
        final city = placemarks.first.locality ??
            placemarks.first.administrativeArea ??
            '';
        final pin = placemarks.first.postalCode ?? '';
        _safeSyncState(() {
          _currentLocationText = pin.isEmpty ? city : '$city, $pin';
          _isLoadingLocation = false;
        });
      }
    } catch (_) {
      if (_isMounted) {
        _safeSyncState(() {
          _currentLocationText = 'Set delivery location';
          _isLoadingLocation = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _isMounted = false;
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    return SlideTransition(
      position: _slideAnimation,
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isDark
                  ? [
                      // Use theme-defined dark gradient colors
                      AppColors.backgroundDark,
                      AppColors.surfaceDark,
                      AppColors.surfaceDarkVariant,
                    ]
                  : [
                      AppColors.primaryDark,
                      AppColors.primary,
                      AppColors.primaryLight,
                    ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              stops: const [0.0, 0.5, 1.0],
            ),
            boxShadow: [
              BoxShadow(
                // Use theme-defined shadow colors
                color: isDark
                    ? AppColors.shadowDarkTheme
                    : AppColors.primaryDark.withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: SafeArea(
            bottom: false,
            child: Stack(
              children: [
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                      child: Column(
                        children: [
                          // Row 1: Title, Icons
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Expanded(
                                child: Text(
                                  widget.title,
                                  style: const TextStyle(
                                    color: AppColors.white, // Use AppColors.white
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.3,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  _buildIconButton(
                                    context,
                                    // --- LOGIC CORRECTED HERE ---
                                    // Show the *other* view icon to switch to
                                    icon: widget.isGridView
                                        ? Icons.view_list_rounded
                                        : Icons.grid_view_rounded,
                                    badge: 0,
                                    isDark: isDark,
                                    onTap: () {
                                      HapticFeedback.lightImpact();
                                      widget.onViewToggle();
                                    },
                                  ),
                                  const SizedBox(width: 8),
                                  _buildIconButton(
                                    context,
                                    icon: Icons.tune_rounded,
                                    badge: widget.activeFiltersCount,
                                    isDark: isDark,
                                    onTap: () {
                                      HapticFeedback.lightImpact();
                                      widget.onFilterTap();
                                    },
                                  ),
                                  const SizedBox(width: 8),
                                  _buildIconButton(
                                    context,
                                    icon: Icons.sort_rounded,
                                    badge: 0,
                                    isDark: isDark,
                                    onTap: () {
                                      HapticFeedback.lightImpact();
                                      showModalBottomSheet(
                                        context: context,
                                        backgroundColor: Colors.transparent,
                                        isScrollControlled: true,
                                        builder: (context) => SortBottomSheet(
                                          currentSort: widget.sortBy,
                                          onSort: widget.onSortChanged,
                                        ),
                                      );
                                    },
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          _buildSearchBar(isDark),
                          const SizedBox(height: 8),
                          _buildLocationLine(context, isDark),
                          const SizedBox(height: 10), // Bottom padding
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBar(bool isDark) {
    return Container(
      height: 45,
      decoration: BoxDecoration(
        // Use theme-defined surface colors
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(
            // Use theme-defined shadow colors
            color: isDark ? AppColors.shadowDark : AppColors.shadowMedium,
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Icon(
              Icons.search_rounded,
              color: isDark ? AppColors.primaryLight : AppColors.primaryDark,
              size: 20,
            ),
          ),
          Expanded(
            child: TextField(
              controller: widget.searchController,
              onChanged: widget.onSearchChanged,
              textInputAction: TextInputAction.search,
              style: TextStyle(
                // Use theme-defined text colors
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
              decoration: InputDecoration(
                hintText: 'Search for products, brands...',
                hintStyle: TextStyle(
                  // Use theme-defined hint colors
                  color: isDark ? AppColors.textLightHint : AppColors.textHint,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
                border: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: (widget.searchController?.text.isNotEmpty ?? false)
                ? Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        widget.searchController?.clear();
                        widget.onSearchChanged?.call("");
                        HapticFeedback.selectionClick();
                      },
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        child: Icon(
                          Icons.close_rounded,
                          // Use theme-defined tertiary text colors
                          color: isDark
                              ? AppColors.textLightTertiary
                              : AppColors.textTertiary,
                          size: 18,
                        ),
                      ),
                    ),
                  )
                : const SizedBox(width: 30),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationLine(BuildContext context, bool isDark) {
    return Consumer<AddressProvider>(
      builder: (context, addressProvider, _) {
        final address = addressProvider.addresses.isNotEmpty
            ? addressProvider.addresses.firstWhere(
                (a) => a.isDefault,
                orElse: () => addressProvider.addresses.first,
              )
            : null;
        final displayLoc = address != null
            ? '${address.city}, ${address.state}'
            : _currentLocationText;

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: isDark
                ? AppColors.white.withValues(alpha: 0.08)
                : AppColors.white.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: AppColors.white.withValues(alpha: isDark ? 0.15 : 0.25),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                // Use theme-defined shadow colors
                color: isDark ? AppColors.shadowMedium : AppColors.shadowLight,
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Icon(
                Icons.location_on_outlined,
                size: 12,
                // Use theme-defined warning colors
                color: isDark ? AppColors.warning : AppColors.warningLight,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  _isLoadingLocation
                      ? 'Fetching location...'
                      : 'Deliver to: ${displayLoc.isEmpty ? 'Set Location' : displayLoc}',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.white.withValues(alpha: isDark ? 0.9 : 0.85),
                    fontWeight: FontWeight.w500,
                    height: 1.3,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 6),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (context) => const SavedAddressesScreen()),
                    ).then((result) {
                      if (result == true) {
                        addressProvider.loadAddresses();
                      }
                    });
                  },
                  borderRadius: BorderRadius.circular(4),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: (isDark
                              ? AppColors.primaryLight
                              : AppColors.primaryDark)
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'Change',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        color: isDark
                            ? AppColors.primaryLight
                            : AppColors.primaryDark,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildIconButton(
    BuildContext context, {
    required IconData icon,
    required int badge,
    required bool isDark,
    required VoidCallback onTap,
    // Use theme-defined notification/error color
    Color badgeColor = AppColors.notification,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.white.withValues(alpha: isDark ? 0.15 : 0.2),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AppColors.white.withValues(alpha: isDark ? 0.2 : 0.3),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      // Use theme-defined shadow colors
                      color: isDark
                          ? AppColors.shadowMedium
                          : AppColors.shadowLight,
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Icon(icon, color: AppColors.white, size: 20),
              ),
              if (badge > 0)
                Positioned(
                  right: -8,
                  top: -8,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [badgeColor.withValues(alpha: 0.9), badgeColor],
                      ),
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: badgeColor.withValues(alpha: 0.7),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    constraints:
                        const BoxConstraints(minWidth: 20, minHeight: 20),
                    child: Text(
                      badge > 99 ? '99+' : badge.toString(),
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        height: 1.1,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class PremiumPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.white.withValues(alpha: 0.1) // Use AppColors.white
      ..strokeWidth = 1;

    for (int i = 0; i < size.width; i += 40) {
      canvas.drawLine(
        Offset(i.toDouble(), 0),
        Offset(i.toDouble(), size.height),
        paint,
      );
    }

    for (int i = 0; i < size.height; i += 40) {
      canvas.drawLine(
        Offset(0, i.toDouble()),
        Offset(size.width, i.toDouble()),
        paint,
      );
    }

    final circlePaint = Paint()
      ..color = AppColors.white.withValues(alpha: 0.08) // Use AppColors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    for (int i = 0; i < 3; i++) {
      canvas.drawCircle(
        Offset(size.width * (0.25 + i * 0.3), size.height * 0.5),
        60 + i * 15,
        circlePaint,
      );
    }

    final accentPaint = Paint()
      ..color = AppColors.white.withValues(alpha: 0.05) // Use AppColors.white
      ..strokeWidth = 1;

    for (int i = 0; i < (size.width + size.height); i += 80) {
      canvas.drawLine(
        Offset(i.toDouble(), 0),
        Offset(i.toDouble() - size.height, size.height),
        accentPaint,
      );
    }
  }

  @override
  bool shouldRepaint(PremiumPatternPainter oldDelegate) => false;
}