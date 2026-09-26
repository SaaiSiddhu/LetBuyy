// Address Selection Bottom Sheet - Flipkart Style
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';

class AddressSelectionSheet extends StatefulWidget {
  final Function(AddressModel)? onAddressSelected;
  
  const AddressSelectionSheet({
    super.key,
    this.onAddressSelected,
  });

  static Future<AddressModel?> show(BuildContext context) async {
    return showModalBottomSheet<AddressModel>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddressSelectionSheet(
        onAddressSelected: (address) {
          Navigator.pop(context, address);
        },
      ),
    );
  }

  @override
  State<AddressSelectionSheet> createState() => _AddressSelectionSheetState();
}

class _AddressSelectionSheetState extends State<AddressSelectionSheet>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _slideAnimation;
  
  final TextEditingController _searchController = TextEditingController();
  bool _isLoadingLocation = false;
  String _searchQuery = '';

  // C2 (canonical rewire): saved addresses now read through BuyerAddressApi, the same canonical
  // gateway letbuyy_account_screen.dart's tested address section already uses -- not the legacy
  // Firestore stream this widget used to build directly (see _buildAddressList's own history).
  bool _loadingAddresses = true;
  String? _addressLoadError;
  List<BuyerAddress> _addresses = const [];
  // The token _addresses currently reflects. Recorded win or lose, so a failed load for an
  // unchanged token doesn't retrigger itself forever on every rebuild -- a retry belongs to the
  // Retry button, never an automatic loop (same reasoning as letbuyy_account_screen.dart's
  // _tokenAtLastLoad).
  String? _loadedForToken;
  final Set<String> _mutatingAddressIds = {};

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _slideAnimation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOutCubic,
    );
    _animationController.forward();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAddresses());
  }

  @override
  void dispose() {
    _animationController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final screenHeight = MediaQuery.of(context).size.height;

    return AnimatedBuilder(
      animation: _slideAnimation,
      builder: (context, child) {
        return Container(
          height: screenHeight * 0.75,
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 20,
                offset: const Offset(0, -5),
              ),
            ],
          ),
          child: Column(
            children: [
              // Handle bar
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.grey[700] : Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              _buildHeader(isDark),

              // Search Bar
              _buildSearchBar(isDark),

              // Use Current Location
              _buildCurrentLocationOption(isDark),

              // Divider
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Divider(
                  color: isDark ? Colors.grey[800] : Colors.grey[200],
                  height: 1,
                ),
              ),

              // Saved Addresses Header
              _buildSavedAddressesHeader(isDark),

              // Address List
              Expanded(
                child: _buildAddressList(isDark),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHeader(bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 12, 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Select delivery address',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
          IconButton(
            onPressed: () {
              HapticFeedback.lightImpact();
              Navigator.pop(context);
            },
            icon: Icon(
              Icons.close_rounded,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[850] : Colors.grey[100],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
          ),
        ),
        child: Row(
          children: [
            const SizedBox(width: 14),
            Icon(
              Icons.search_rounded,
              color: isDark ? Colors.grey[500] : Colors.grey[600],
              size: 22,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => _searchQuery = value),
                style: TextStyle(
                  color: isDark ? Colors.white : AppColors.textPrimary,
                  fontSize: 14,
                ),
                decoration: InputDecoration(
                  hintText: 'Search by area, street name, pin code',
                  hintStyle: TextStyle(
                    color: isDark ? Colors.grey[600] : Colors.grey[500],
                    fontSize: 14,
                  ),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ),
            if (_searchQuery.isNotEmpty)
              IconButton(
                onPressed: () {
                  _searchController.clear();
                  setState(() => _searchQuery = '');
                },
                icon: Icon(
                  Icons.clear_rounded,
                  color: isDark ? Colors.grey[500] : Colors.grey[600],
                  size: 20,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentLocationOption(bool isDark) {
    return InkWell(
      onTap: _handleUseCurrentLocation,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: (isDark ? AppColors.primaryLight : AppColors.primary)
                    .withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: _isLoadingLocation
                  ? Padding(
                      padding: const EdgeInsets.all(10),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: isDark ? AppColors.primaryLight : AppColors.primary,
                      ),
                    )
                  : Icon(
                      Icons.my_location_rounded,
                      color: isDark ? AppColors.primaryLight : AppColors.primary,
                      size: 20,
                    ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                'Use my current location',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: isDark ? AppColors.primaryLight : AppColors.primary,
                ),
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: isDark ? Colors.grey[600] : Colors.grey[400],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSavedAddressesHeader(bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Saved addresses',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              letterSpacing: 0.3,
            ),
          ),
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.pop(context);
              // C2 (canonical rewire): was AppRoutes.addresses (SavedAddressesScreen), which C2
              // already disconnected to an unconditional "No Saved Addresses" empty state -- it
              // has no canonical successor wired in and cannot actually add an address. The real,
              // canonical address book is letbuyy_account_screen.dart.
              Navigator.pushNamed(context, AppRoutes.letbuyyAccount);
            },
            child: Row(
              children: [
                Icon(
                  Icons.add_rounded,
                  size: 18,
                  color: isDark ? AppColors.primaryLight : AppColors.primary,
                ),
                const SizedBox(width: 4),
                Text(
                  'Add New',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.primaryLight : AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// True while [token] is still the buyer this sheet is showing -- a response for a token that
  /// has since changed (sign-out, or a different buyer signed in) is dropped, never applied. Same
  /// reasoning as letbuyy_account_screen.dart's own _stillCurrent.
  bool _stillCurrent(String token) => mounted && context.read<BuyerSignInController>().token == token;

  Widget _buildAddressList(bool isDark) {
    final token = context.watch<BuyerSignInController>().token;

    // A sign-in/out while the sheet is already open (a concurrent flow, or a session check on
    // resume ending the session) -- reload for the buyer actually current now, rather than show
    // stale data left over from whoever _addresses was last fetched for.
    if (token != _loadedForToken && !_loadingAddresses) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadAddresses());
    }

    if (token == null) {
      return _buildEmptyState(isDark, isGuest: true);
    }

    if (_loadingAddresses) {
      return _buildLoadingState(isDark);
    }

    if (_addressLoadError != null) {
      return _buildErrorState(isDark, _addressLoadError!);
    }

    final addresses = _addresses.map(_addressModelFromBuyerAddress).toList();

    if (addresses.isEmpty) {
      return _buildEmptyState(isDark);
    }

    // Filter by search query
    final filteredAddresses = _searchQuery.isEmpty
        ? addresses
        : addresses.where((addr) {
            final query = _searchQuery.toLowerCase();
            return addr.name.toLowerCase().contains(query) ||
                addr.addressLine1.toLowerCase().contains(query) ||
                addr.city.toLowerCase().contains(query) ||
                addr.zipcode.contains(query);
          }).toList();

    if (filteredAddresses.isEmpty) {
      return _buildNoResultsState(isDark);
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: filteredAddresses.length,
      itemBuilder: (context, index) {
        return _buildAddressCard(filteredAddresses[index], isDark);
      },
    );
  }

  /// [BuyerAddress] has no photo/lat-long/type-icon concept of its own -- this is purely a display
  /// adapter onto the model _buildAddressCard already renders (also used by the current-location
  /// result below), never a second identity for the same address.
  AddressModel _addressModelFromBuyerAddress(BuyerAddress address) {
    return AddressModel(
      id: address.id,
      userId: '',
      name: address.fullName,
      phone: address.phone ?? '',
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? '',
      city: address.city,
      state: address.state,
      zipcode: address.postalCode,
      country: address.country,
      isDefault: address.isDefault,
      addressType: address.label,
      landmark: address.landmark,
    );
  }

  Future<void> _loadAddresses() async {
    final token = context.read<BuyerSignInController>().token;
    if (token == null) {
      if (mounted) {
        setState(() {
          _loadingAddresses = false;
          _addressLoadError = null;
          _addresses = const [];
          _loadedForToken = null;
        });
      }
      return;
    }
    setState(() {
      _loadingAddresses = true;
      _addressLoadError = null;
      _loadedForToken = token;
    });
    try {
      final addresses = await context.read<BuyerAddressApi>().list(token);
      if (!_stillCurrent(token)) return;
      setState(() {
        _addresses = addresses;
        _loadingAddresses = false;
      });
    } on ApiException catch (error) {
      if (!_stillCurrent(token)) return;
      setState(() {
        _loadingAddresses = false;
        _addressLoadError = (error.statusCode == 401 || error.statusCode == 403)
            ? 'Your LetBuyy sign-in has ended. Sign in again to see your addresses.'
            : (error.code == 'NETWORK_ERROR' || error.code == 'TIMEOUT')
                ? 'You seem to be offline. Check your connection and try again.'
                : 'We couldn’t load your addresses right now.';
      });
    } catch (_) {
      if (!_stillCurrent(token)) return;
      setState(() {
        _loadingAddresses = false;
        _addressLoadError = 'You seem to be offline. Check your connection and try again.';
      });
    }
  }

  Widget _buildAddressCard(AddressModel address, bool isDark) {
    final isDefault = address.isDefault;
    final typeIcon = _getAddressTypeIcon(address.addressType);

    return InkWell(
      onTap: () {
        HapticFeedback.mediumImpact();
        widget.onAddressSelected?.call(address);
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[850] : Colors.grey[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDefault
                ? (isDark ? AppColors.primaryLight : AppColors.primary).withValues(alpha: 0.5)
                : (isDark ? Colors.grey[700]! : Colors.grey[200]!),
            width: isDefault ? 1.5 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Address Type Icon
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: (isDark ? AppColors.primaryLight : AppColors.primary)
                    .withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                typeIcon,
                color: isDark ? AppColors.primaryLight : AppColors.primary,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),

            // Address Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        address.name,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : AppColors.textPrimary,
                        ),
                      ),
                      if (isDefault) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.success.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'DEFAULT',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              color: AppColors.success,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${address.addressLine1}, ${address.city}, ${address.state} ${address.zipcode}',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (address.phone.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(
                          Icons.phone_outlined,
                          size: 12,
                          color: isDark ? Colors.grey[500] : Colors.grey[500],
                        ),
                        const SizedBox(width: 4),
                        Text(
                          address.phone,
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? Colors.grey[500] : Colors.grey[500],
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            // More Options
            PopupMenuButton<String>(
              icon: Icon(
                Icons.more_vert_rounded,
                color: isDark ? Colors.grey[500] : Colors.grey[600],
                size: 20,
              ),
              onSelected: (value) => _handleAddressAction(value, address),
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'edit',
                  child: Row(
                    children: [
                      Icon(Icons.edit_outlined, size: 18, color: Colors.grey[600]),
                      const SizedBox(width: 8),
                      const Text('Edit'),
                    ],
                  ),
                ),
                if (!address.isDefault)
                  PopupMenuItem(
                    value: 'default',
                    child: Row(
                      children: [
                        Icon(Icons.check_circle_outline, size: 18, color: Colors.grey[600]),
                        const SizedBox(width: 8),
                        const Text('Set as default'),
                      ],
                    ),
                  ),
                PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      const Icon(Icons.delete_outline, size: 18, color: AppColors.error),
                      const SizedBox(width: 8),
                      const Text('Delete', style: TextStyle(color: AppColors.error)),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  IconData _getAddressTypeIcon(String? type) {
    switch (type?.toLowerCase()) {
      case 'home':
        return Icons.home_rounded;
      case 'work':
      case 'office':
        return Icons.business_rounded;
      default:
        return Icons.location_on_rounded;
    }
  }

  Widget _buildLoadingState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(
            color: isDark ? AppColors.primaryLight : AppColors.primary,
          ),
          const SizedBox(height: 16),
          Text(
            'Loading addresses...',
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark, {bool isGuest = false}) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            isGuest ? Icons.person_outline_rounded : Icons.location_off_rounded,
            size: 64,
            color: isDark ? Colors.grey[700] : Colors.grey[300],
          ),
          const SizedBox(height: 16),
          Text(
            isGuest ? 'Please login to see addresses' : 'No saved addresses',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            isGuest
                ? 'Login to manage your delivery addresses'
                : 'Add a new address to get started',
            style: TextStyle(
              fontSize: 13,
              color: isDark ? Colors.grey[600] : Colors.grey[500],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(context);
              if (isGuest) {
                // Phase 1R corrective (C2): was AppRoutes.auth (the legacy Firebase email/
                // password/Google sign-in screen). Routes to the canonical "Sign in with
                // LetBuyy" prompt (profile_screen.dart already shows it whenever not signed in)
                // instead.
                Navigator.pushNamed(context, AppRoutes.profile);
              } else {
                // C2 (canonical rewire): was AppRoutes.addresses -- see the "Add New" header
                // action's own comment above for why this now points at the real address book.
                Navigator.pushNamed(context, AppRoutes.letbuyyAccount);
              }
            },
            icon: Icon(isGuest ? Icons.login_rounded : Icons.add_rounded),
            label: Text(isGuest ? 'Login' : 'Add Address'),
            style: ElevatedButton.styleFrom(
              backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNoResultsState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.search_off_rounded,
            size: 64,
            color: isDark ? Colors.grey[700] : Colors.grey[300],
          ),
          const SizedBox(height: 16),
          Text(
            'No matching addresses',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Try a different search term',
            style: TextStyle(
              fontSize: 13,
              color: isDark ? Colors.grey[600] : Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(bool isDark, String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.error_outline_rounded,
            size: 64,
            color: isDark ? Colors.grey[700] : Colors.grey[300],
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ),
          const SizedBox(height: 20),
          OutlinedButton(
            onPressed: _loadAddresses,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleUseCurrentLocation() async {
    setState(() => _isLoadingLocation = true);
    HapticFeedback.mediumImpact();

    try {
      // Check permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _showError('Location permission denied');
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        _showError('Location permission permanently denied. Enable in settings.');
        return;
      }

      // Get current position
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      // Reverse geocode to get address
      final placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );

      if (placemarks.isNotEmpty) {
        final place = placemarks.first;
        
        // Create temporary address from location -- never persisted, so it carries no real
        // buyer/userId identity (this used to read safeFirebaseUserId(), always null under
        // canonical auth; AddressModel.userId is unused once this is only ever handed straight to
        // widget.onAddressSelected).
        final locationAddress = AddressModel(
          id: 'current_location',
          userId: '',
          name: 'Current Location',
          phone: '',
          addressLine1: '${place.street ?? ''} ${place.subLocality ?? ''}',
          addressLine2: place.locality ?? '',
          city: place.subAdministrativeArea ?? place.locality ?? '',
          state: place.administrativeArea ?? '',
          zipcode: place.postalCode ?? '',
          country: place.country ?? 'India',
          latitude: position.latitude,
          longitude: position.longitude,
          addressType: 'other',
        );

        widget.onAddressSelected?.call(locationAddress);
      }
    } catch (e) {
      debugPrint('Location error: $e');
      _showError('Could not get current location');
    } finally {
      if (mounted) {
        setState(() => _isLoadingLocation = false);
      }
    }
  }

  void _handleAddressAction(String action, AddressModel address) async {
    switch (action) {
      case 'edit':
        Navigator.pop(context);
        // C2 (canonical rewire): was AppRoutes.addresses -- editing an address is full-form work
        // this lightweight selection sheet doesn't duplicate; the real editor already lives in
        // letbuyy_account_screen.dart.
        Navigator.pushNamed(context, AppRoutes.letbuyyAccount);
        break;

      case 'default':
        HapticFeedback.mediumImpact();
        await _setDefaultAddress(address);
        break;

      case 'delete':
        final confirm = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Delete Address'),
            content: Text('Are you sure you want to delete "${address.name}"?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                style: TextButton.styleFrom(foregroundColor: AppColors.error),
                child: const Text('Delete'),
              ),
            ],
          ),
        );

        if (confirm == true) {
          await _deleteAddress(address);
        }
        break;
    }
  }

  /// [BuyerAddress] has no copyWith -- every mutation hand-constructs the next value from the
  /// current one, same as letbuyy_account_screen.dart's own _withDefault.
  BuyerAddress _withDefault(BuyerAddress a, bool isDefault) => BuyerAddress(
        id: a.id,
        label: a.label,
        fullName: a.fullName,
        phone: a.phone,
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2,
        city: a.city,
        state: a.state,
        postalCode: a.postalCode,
        country: a.country,
        landmark: a.landmark,
        isDefault: isDefault,
      );

  Future<void> _setDefaultAddress(AddressModel address) async {
    final token = context.read<BuyerSignInController>().token;
    if (token == null || address.isDefault || _mutatingAddressIds.contains(address.id)) return;
    BuyerAddress current;
    try {
      current = _addresses.firstWhere((a) => a.id == address.id);
    } catch (_) {
      return;
    }
    setState(() => _mutatingAddressIds.add(address.id));
    try {
      final saved = await context.read<BuyerAddressApi>().update(token, current.id, _withDefault(current, true));
      if (!_stillCurrent(token)) return;
      setState(() {
        _addresses = [
          for (final a in _addresses) a.id == saved.id ? saved : _withDefault(a, false),
        ];
        _mutatingAddressIds.remove(address.id);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Default address updated'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      );
    } catch (_) {
      if (!_stillCurrent(token)) return;
      setState(() => _mutatingAddressIds.remove(address.id));
      _showError('Could not update default address');
    }
  }

  Future<void> _deleteAddress(AddressModel address) async {
    final token = context.read<BuyerSignInController>().token;
    if (token == null || _mutatingAddressIds.contains(address.id)) return;
    setState(() => _mutatingAddressIds.add(address.id));
    try {
      await context.read<BuyerAddressApi>().delete(token, address.id);
      if (!_stillCurrent(token)) return;
      setState(() {
        _addresses = _addresses.where((a) => a.id != address.id).toList();
        _mutatingAddressIds.remove(address.id);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Address deleted'),
          backgroundColor: AppColors.warning,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      );
    } on ApiException catch (error) {
      if (!_stillCurrent(token)) return;
      setState(() => _mutatingAddressIds.remove(address.id));
      // A 404 means the address is already gone (this device or another already deleted it) --
      // reflect that locally rather than tell the buyer their own delete failed.
      if (error.statusCode == 404) {
        setState(() => _addresses = _addresses.where((a) => a.id != address.id).toList());
      } else {
        _showError('Could not delete address');
      }
    } catch (_) {
      if (!_stillCurrent(token)) return;
      setState(() => _mutatingAddressIds.remove(address.id));
      _showError('Could not delete address');
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    );
  }
}
