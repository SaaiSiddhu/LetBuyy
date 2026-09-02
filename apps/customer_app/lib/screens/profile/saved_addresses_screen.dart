// lib/screens/user/profile/saved_addresses_screen.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart'; // ✅ ADDED: For maps functionality
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart'; // ✅ ADDED: For type safety
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/widgets/premium_scaffold.dart';
import '../checkout/add_address_screen.dart';

class SavedAddressesScreen extends StatefulWidget {
  const SavedAddressesScreen({super.key});

  @override
  State<SavedAddressesScreen> createState() => _SavedAddressesScreenState();
}

class _SavedAddressesScreenState extends State<SavedAddressesScreen>
    with TickerProviderStateMixin {
  // ============================================
  // ANIMATIONS
  // ============================================
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  // --- Toast ---
  bool _showToast = false;
  String _toastMessage = '';
  IconData _toastIcon = Icons.check_circle;
  Color _toastColor = AppColors.success; // ✅ Fixed
  Timer? _toastTimer;
  late AnimationController _toastAnimationController;
  late Animation<Offset> _toastSlideAnimation;
  late Animation<double> _toastFadeAnimation;
  late Animation<double> _toastScaleAnimation;
  // --- End Toast ---

  @override
  void initState() {
    super.initState();

    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOut),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutCubic),
    );

    // --- Toast Animations ---
    _toastAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    _toastSlideAnimation = Tween<Offset>(
      begin: const Offset(0, -1.5),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _toastAnimationController,
        curve: Curves.easeOutCubic,
      ),
    );

    _toastFadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _toastAnimationController, curve: Curves.easeOut),
    );

    _toastScaleAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _toastAnimationController, curve: Curves.elasticOut),
    );
    // --- End Toast Animations ---

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AddressProvider>().loadAddresses();
      _animationController.forward();
    });
  }

  @override
  void dispose() {
    _animationController.dispose();
    _toastAnimationController.dispose();
    _toastTimer?.cancel();
    super.dispose();
  }

  // ============================================
  // SHOW TOAST MESSAGE
  // ============================================
  void _showToastMessage(String message, {bool isSuccess = true}) {
    if (!mounted) return;
    _toastTimer?.cancel();

    setState(() {
      _toastMessage = message;
      _toastIcon = isSuccess ? Icons.check_circle_rounded : Icons.error_rounded;
      _toastColor = isSuccess ? AppColors.success : AppColors.error; // ✅ Fixed
      _showToast = true;
    });

    _toastAnimationController.forward();

    _toastTimer = Timer(const Duration(milliseconds: 2800), () {
      if (mounted) {
        _toastAnimationController.reverse().then((_) {
          if (mounted) setState(() => _showToast = false);
        });
      }
    });
  }

  // ============================================
  // OPEN IN MAPS (from payment_method_screen.dart)
  // ============================================
  Future<void> _openInMaps(AddressModel addr) async {
    if (addr.latitude != null && addr.longitude != null) {
      final String googleMapsUrl =
          'https://www.google.com/maps/search/?api=1&query=${addr.latitude},${addr.longitude}';

      final Uri uri = Uri.parse(googleMapsUrl);

      try {
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else {
          _showToastMessage('Could not open maps', isSuccess: false); // ✅ Fixed
        }
      } catch (e) {
        debugPrint('Error opening maps: $e');
        _showToastMessage('Error opening maps', isSuccess: false); // ✅ Fixed
      }
    } else {
      _showToastMessage('Location coordinates not available',
          isSuccess: false); // ✅ Fixed
    }
  }

  // ============================================
  // DELETE ADDRESS WITH THEME-AWARE DIALOG
  // ============================================
  Future<void> _deleteAddress(String addressId, bool isDark) async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          margin: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: isDark
                    ? AppColors.shadowDarkTheme
                    : AppColors.shadowMedium, // ✅ Fixed
                blurRadius: 30,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ✅ HEADER
              Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.1), // ✅ Fixed
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.delete_outline_rounded,
                        size: 30,
                        color: AppColors.error, // ✅ Fixed
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Delete Address?',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: isDark
                            ? AppColors.textLight
                            : AppColors.textPrimary, // ✅ Fixed
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'This action cannot be undone and will be permanently deleted.',
                      style: TextStyle(
                        color: isDark
                            ? AppColors.textLightSecondary
                            : AppColors.textSecondary, // ✅ Fixed
                        fontSize: 14,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              // ✅ ACTIONS
              Container(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context, false),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          side: BorderSide(
                            color: isDark
                                ? AppColors.borderDark
                                : AppColors.border, // ✅ Fixed
                          ),
                        ),
                        child: Text(
                          'Cancel',
                          style: TextStyle(
                            color: isDark
                                ? AppColors.textLight
                                : AppColors.textPrimary, // ✅ Fixed
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(context, true),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          backgroundColor: AppColors.error, // ✅ Fixed
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          'Delete',
                          style: TextStyle(
                            color: AppColors.white, // ✅ Fixed
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed == true && mounted) {
      final success =
          await context.read<AddressProvider>().deleteAddress(addressId);

      if (mounted) {
        _showToastMessage(
          success ? '✅ Address deleted successfully' : '❌ Failed to delete address',
          isSuccess: success,
        );
      }
    }
  }

  // ============================================
  // COMPACT HEADER
  // ============================================
  Widget _buildCompactHeader(bool isDark) {
    final double topPadding = MediaQuery.of(context).padding.top;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 16 + topPadding, 16, 16),
      decoration: BoxDecoration(
        gradient:
            isDark ? AppColors.primaryGradientDark : AppColors.primaryGradient, // ✅ Fixed
      ),
      child: Row(
        children: [
          Container(
            decoration: BoxDecoration(
              color: AppColors.white.withValues(alpha: 0.2), // ✅ Fixed
              borderRadius: BorderRadius.circular(10),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {
                  HapticFeedback.lightImpact();
                  Navigator.pop(context);
                },
                borderRadius: BorderRadius.circular(10),
                child: const Padding(
                  padding: EdgeInsets.all(10),
                  child: Icon(Icons.arrow_back_rounded,
                      color: AppColors.white, size: 20), // ✅ Fixed
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          const Expanded(
            child: Text(
              'Saved Addresses',
              style: TextStyle(
                color: AppColors.white, // ✅ Fixed
                fontSize: 19,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }


  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      body: Stack(
        children: [
          CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              // ============================================
              // COMPACT HEADER
              // ============================================
              SliverToBoxAdapter(child: _buildCompactHeader(isDark)),

              // ============================================
              // CONTENT
              // ============================================
              Consumer<AddressProvider>(
                builder: (context, addressProvider, child) {
                  if (addressProvider.isLoading &&
                      addressProvider.addresses.isEmpty) {
                    return SliverFillRemaining(
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            CircularProgressIndicator(
                              color: isDark
                                  ? AppColors.primaryLight
                                  : AppColors.primary, // ✅ Fixed
                              strokeWidth: 3,
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'Loading addresses...',
                              style: TextStyle(
                                color: isDark
                                    ? AppColors.textLightSecondary
                                    : AppColors.textSecondary, // ✅ Fixed
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  if (addressProvider.addresses.isEmpty) {
                    return SliverFillRemaining(
                        hasScrollBody: false,
                        child: _buildEmptyState(isDark: isDark));
                  }

                  return SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final address = addressProvider.addresses[index];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12.0),
                            child: _buildAddressCard(
                              address: address,
                              isDark: isDark,
                              onDelete: () =>
                                  _deleteAddress(address.id, isDark),
                              onSetDefault: () async {
                                HapticFeedback.selectionClick();
                                final success = await addressProvider
                                    .setDefaultAddress(address.id);
                                if (mounted) {
                                  _showToastMessage(
                                      success
                                          ? '✅ Default address updated'
                                          : '❌ Failed to update',
                                      isSuccess: success);
                                }
                              },
                            ),
                          );
                        },
                        childCount: addressProvider.addresses.length,
                      ),
                    ),
                  );
                },
              ),
            ],
          ),

          // ============================================
          // TOAST NOTIFICATION
          // ============================================
          if (_showToast)
            Positioned(
              top: MediaQuery.of(context).padding.top + 10,
              left: 16,
              right: 16,
              child: SlideTransition(
                  position: _toastSlideAnimation,
                  child: FadeTransition(
                      opacity: _toastFadeAnimation,
                      child: ScaleTransition(
                          scale: _toastScaleAnimation,
                          child: Container(
                            margin: const EdgeInsets.all(16),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 14),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  _toastColor,
                                  _toastColor.withValues(alpha: 0.9)
                                ],
                              ),
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: _toastColor.withValues(alpha: 0.4),
                                  blurRadius: 16,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.2),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(_toastIcon,
                                      color: Colors.white, size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    _toastMessage,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          )))),
            ),
        ],
      ),

      // ============================================
      // THEME-AWARE FLOATING ACTION BUTTON
      // ============================================
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          HapticFeedback.mediumImpact();
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const AddAddressScreen(),
            ),
          ).then((result) {
            if (result == true && mounted) {
              context.read<AddressProvider>().loadAddresses();
              _showToastMessage('✅ Address added successfully');
            }
          });
        },
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('Add Address',
            style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor:
            isDark ? AppColors.primaryLight : AppColors.primary, // ✅ Fixed
        foregroundColor: isDark ? AppColors.textPrimary : AppColors.white, // ✅ Fixed
        elevation: 8,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }

  // ===================================================================
  // ✅ START: NEW ADDRESS CARD (from payment_method_screen.dart)
  // ===================================================================

  Widget _buildAddressCard({
    required AddressModel address, // ✅ Changed type to AddressModel
    required VoidCallback onDelete,
    required VoidCallback onSetDefault,
    required bool isDark,
  }) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final addr = address; // Use 'addr' to match copied code

    return Container(
      decoration: BoxDecoration(
        gradient: address.isDefault
            ? LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  accentColor.withValues(alpha: 0.1),
                  accentColor.withValues(alpha: 0.05),
                ],
              )
            : null,
        color: address.isDefault
            ? null
            : (isDark ? AppColors.surfaceDark : AppColors.surface), // ✅ Fixed
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: address.isDefault
              ? accentColor.withValues(alpha: 0.3)
              : (isDark
                  ? AppColors.borderDark
                  : AppColors.border), // ✅ Fixed
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: address.isDefault
                ? accentColor.withValues(alpha: 0.1)
                : (isDark
                    ? AppColors.shadowDark
                    : AppColors.shadowLight), // ✅ Fixed
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ✅ HEADER (Merged from both files)
            Row(
              children: [
                // Address Type Badge (from old card, new styling)
                if (address.addressType != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color:
                          _getAddressTypeColor(addr.addressType!).withValues(alpha: 0.15), // ✅ Fixed
                      border: Border.all(
                        color: _getAddressTypeColor(addr.addressType!)
                            .withValues(alpha: 0.3), // ✅ Fixed
                      ),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _getAddressTypeIcon(addr.addressType!), // ✅ Fixed
                          size: 14,
                          color: _getAddressTypeColor(addr.addressType!), // ✅ Fixed
                        ),
                        const SizedBox(width: 6),
                        Text(
                          address.addressType!.toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: _getAddressTypeColor(addr.addressType!), // ✅ Fixed
                          ),
                        ),
                      ],
                    ),
                  ),
                const Spacer(),
                // Default Badge (from old card)
                if (address.isDefault)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: accentColor,
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: accentColor.withValues(alpha: 0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.check_circle_rounded,
                          size: 12,
                          color: AppColors.white, // ✅ Fixed
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'DEFAULT',
                          style: TextStyle(
                            color: isDark
                                ? AppColors.textPrimary
                                : AppColors.white, // ✅ Fixed
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                // Maps Button (from new card)
                if (addr.latitude != null && addr.longitude != null) ...[
                  if (address.isDefault) const SizedBox(width: 8),
                  IconButton(
                    onPressed: () => _openInMaps(addr),
                    icon: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        Icons.map_outlined,
                        color: accentColor,
                        size: 18,
                      ),
                    ),
                    tooltip: 'Open in Maps',
                  ),
                ]
              ],
            ),

            const SizedBox(height: 14),

            // ✅ NAME (from new card)
            Row(
              children: [
                Icon(
                  Icons.person_outline_rounded,
                  size: 16,
                  color:
                      isDark ? AppColors.textLightHint : AppColors.textHint, // ✅ Fixed
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    addr.name,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: isDark
                          ? AppColors.textLight
                          : AppColors.textPrimary, // ✅ Fixed
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // ✅ PHONE (from new card)
            Row(
              children: [
                Icon(
                  Icons.phone_outlined,
                  size: 16,
                  color:
                      isDark ? AppColors.textLightHint : AppColors.textHint, // ✅ Fixed
                ),
                const SizedBox(width: 8),
                Text(
                  addr.phone,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppColors.textLightSecondary
                        : AppColors.textSecondary, // ✅ Fixed
                  ),
                ),
              ],
            ),

            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Divider(
                color: isDark ? AppColors.borderDark : AppColors.border, // ✅ Fixed
                height: 1,
              ),
            ),

            // ✅ ADDRESS DETAILS (from new card)
            _buildAddressRow(
              icon: Icons.home_outlined,
              value: addr.addressLine1,
              isDark: isDark,
            ),
            if (addr.addressLine2.isNotEmpty) ...[
              const SizedBox(height: 8),
              _buildAddressRow(
                icon: Icons.location_city_outlined,
                value: addr.addressLine2,
                isDark: isDark,
                isSecondary: true,
              ),
            ],
            if (addr.landmark != null && addr.landmark!.isNotEmpty) ...[
              const SizedBox(height: 8),
              _buildAddressRow(
                icon: Icons.place_outlined,
                value: 'Near ${addr.landmark}',
                isDark: isDark,
              ),
            ],
            const SizedBox(height: 12),

            // ✅ LOCATION CHIPS (from new card)
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildLocationChip(
                  icon: Icons.location_city,
                  label: addr.city,
                  isDark: isDark,
                ),
                _buildLocationChip(
                  icon: Icons.map_outlined,
                  label: addr.state,
                  isDark: isDark,
                ),
                _buildLocationChip(
                  icon: Icons.pin_drop_outlined,
                  label: addr.zipcode,
                  isDark: isDark,
                ),
                if (addr.country.isNotEmpty && addr.country != 'India')
                  _buildLocationChip(
                    icon: Icons.flag_outlined,
                    label: addr.country,
                    isDark: isDark,
                  ),
              ],
            ),

            const SizedBox(height: 18),

            // ✅ ACTION BUTTONS (from old card)
            Row(
              children: [
                if (!address.isDefault)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onSetDefault,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 11),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        side: BorderSide(
                          color: accentColor.withValues(alpha: 0.5),
                          width: 1.5,
                        ),
                      ),
                      child: Text(
                        'Set Default',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: accentColor,
                        ),
                      ),
                    ),
                  ),
                if (!address.isDefault) const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: onDelete,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      side: BorderSide(
                        color: AppColors.error.withValues(alpha: 0.5), // ✅ Fixed
                        width: 1.5,
                      ),
                    ),
                    child: const Text(
                      'Delete',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: AppColors.error, // ✅ Fixed
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // --- Address Card Helpers (from payment_method_screen.dart) ---

  Widget _buildAddressRow({
    required IconData icon,
    required String value,
    required bool isDark,
    bool isSecondary = false,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!isSecondary)
          Icon(
            icon,
            size: 16,
            color: isDark ? AppColors.textLightHint : AppColors.textHint, // ✅ Fixed
          ),
        if (!isSecondary) const SizedBox(width: 8),
        if (isSecondary) const SizedBox(width: 24),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary, // ✅ Fixed
              height: 1.5,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLocationChip({
    required IconData icon,
    required String label,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.surfaceDarkVariant
            : AppColors.surfaceVariant, // ✅ Fixed
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border, // ✅ Fixed
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 12,
            color: isDark ? AppColors.textLightHint : AppColors.textHint, // ✅ Fixed
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary, // ✅ Fixed
            ),
          ),
        ],
      ),
    );
  }

  IconData _getAddressTypeIcon(String type) {
    switch (type.toLowerCase()) {
      case 'home':
        return Icons.home_rounded;
      case 'office':
      case 'work':
        return Icons.work_rounded;
      default:
        return Icons.location_on_rounded;
    }
  }

  Color _getAddressTypeColor(String type) {
    switch (type.toLowerCase()) {
      case 'home':
        return AppColors.primary; // ✅ Fixed
      case 'office':
      case 'work':
        return AppColors.warning; // ✅ Fixed
      default:
        return AppColors.processing; // ✅ Fixed
    }
  }

  // ============================================
  // EMPTY STATE
  // ============================================
  Widget _buildEmptyState({required bool isDark}) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary; // ✅ Fixed

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: 32,
        vertical: 40,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Icon
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  accentColor.withValues(alpha: 0.1),
                  accentColor.withValues(alpha: 0.05),
                ],
              ),
              shape: BoxShape.circle,
              border: Border.all(
                color: accentColor.withValues(alpha: 0.2),
                width: 2,
              ),
            ),
            child: Icon(
              Icons.location_off_outlined,
              size: 50,
              color: accentColor,
            ),
          ),

          const SizedBox(height: 32),

          // Title
          Text(
            'No Saved Addresses',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 20,
              color:
                  isDark ? AppColors.textLight : AppColors.textPrimary, // ✅ Fixed
            ),
          ),

          const SizedBox(height: 12),

          // Description
          Text(
            'Add your first delivery address to get started with faster checkout.',
            style: TextStyle(
              color: isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary, // ✅ Fixed
              height: 1.5,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(
              height: 100), // Pushes content up, leaves room for FAB
        ],
      ),
    );
  }
}