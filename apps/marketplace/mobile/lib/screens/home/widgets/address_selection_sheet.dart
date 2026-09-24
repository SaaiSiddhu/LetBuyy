// Address Selection Bottom Sheet - Flipkart Style
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

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
              Navigator.pushNamed(context, AppRoutes.addresses);
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

  Widget _buildAddressList(bool isDark) {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    
    if (userId == null) {
      return _buildEmptyState(isDark, isGuest: true);
    }

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('addresses')
          .where('userId', isEqualTo: userId)
          .orderBy('isDefault', descending: true)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return _buildLoadingState(isDark);
        }

        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return _buildEmptyState(isDark);
        }

        final addresses = snapshot.data!.docs
            .map((doc) => AddressModel.fromFirestore(doc))
            .toList();

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
      },
    );
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
                Navigator.pushNamed(context, AppRoutes.auth);
              } else {
                Navigator.pushNamed(context, AppRoutes.addresses);
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
        
        // Create temporary address from location
        final locationAddress = AddressModel(
          id: 'current_location',
          userId: FirebaseAuth.instance.currentUser?.uid ?? '',
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
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) return;

    switch (action) {
      case 'edit':
        Navigator.pop(context);
        Navigator.pushNamed(context, AppRoutes.addresses);
        break;

      case 'default':
        HapticFeedback.mediumImpact();
        try {
          final batch = FirebaseFirestore.instance.batch();
          
          // Remove default from all user's addresses
          final addresses = await FirebaseFirestore.instance
              .collection('addresses')
              .where('userId', isEqualTo: userId)
              .get();
          
          for (final doc in addresses.docs) {
            batch.update(doc.reference, {'isDefault': false});
          }
          
          // Set new default
          batch.update(
            FirebaseFirestore.instance
                .collection('addresses')
                .doc(address.id),
            {'isDefault': true},
          );
          
          await batch.commit();
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Text('Default address updated'),
                backgroundColor: AppColors.success,
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            );
          }
        } catch (e) {
          _showError('Could not update default address');
        }
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
          try {
            await FirebaseFirestore.instance
                .collection('addresses')
                .doc(address.id)
                .delete();
            
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text('Address deleted'),
                  backgroundColor: AppColors.warning,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              );
            }
          } catch (e) {
            _showError('Could not delete address');
          }
        }
        break;
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
