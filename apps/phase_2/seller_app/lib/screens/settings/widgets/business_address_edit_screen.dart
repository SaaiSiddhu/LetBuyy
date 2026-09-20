// lib/screens/seller/settings/widgets/business_address_edit_screen.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../../../providers/seller_provider.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

class BusinessAddressEditScreen extends StatefulWidget {
  const BusinessAddressEditScreen({super.key});

  @override
  State<BusinessAddressEditScreen> createState() => _BusinessAddressEditScreenState();
}

class _BusinessAddressEditScreenState extends State<BusinessAddressEditScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _addressController;
  late TextEditingController _address2Controller;
  late TextEditingController _cityController;
  late TextEditingController _pincodeController;
  late TextEditingController _landmarkController;
  
  bool _isLoading = false;
  bool _isFetchingLocation = false;

  String? _selectedState;
  String? _selectedDistrict;
  
  List<String> _filteredStates = [];
  List<String> _filteredDistricts = [];

  bool _isManualStateEntry = false;
  bool _isManualDistrictEntry = false;

  final _manualStateController = TextEditingController();
  final _manualDistrictController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _filteredStates = IndiaLocations.allStates;
    final seller = context.read<SellerProvider>().currentSeller;
    _addressController = TextEditingController(text: seller?.businessAddress ?? '');
    _address2Controller = TextEditingController(text: seller?.businessAddress2 ?? '');
    _cityController = TextEditingController(text: seller?.businessCity ?? '');
    _pincodeController = TextEditingController(text: seller?.businessPincode ?? '');
    _landmarkController = TextEditingController(text: seller?.businessLandmark ?? '');
    
    // Load state
    if (seller?.businessState != null) {
      if (IndiaLocations.allStates.contains(seller!.businessState)) {
        _selectedState = seller.businessState;
        _filteredDistricts = IndiaLocations.getDistricts(_selectedState!);
      } else {
        _isManualStateEntry = true;
        _manualStateController.text = seller.businessState;
      }
    }
  }

  @override
  void dispose() {
    _addressController.dispose();
    _address2Controller.dispose();
    _cityController.dispose();
    _pincodeController.dispose();
    _landmarkController.dispose();
    _manualStateController.dispose();
    _manualDistrictController.dispose();
    super.dispose();
  }

  Future<void> _getCurrentLocation() async {
    try {
      setState(() => _isFetchingLocation = true);

      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _showError('Location services are disabled');
        setState(() => _isFetchingLocation = false);
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _showError('Location permission denied');
          setState(() => _isFetchingLocation = false);
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        _showError('Location permission permanently denied');
        setState(() => _isFetchingLocation = false);
        return;
      }

      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      List<Placemark> placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );

      if (placemarks.isEmpty) {
        _showError('No address found for this location');
        setState(() => _isFetchingLocation = false);
        return;
      }

      Placemark place = placemarks[0];
      
      bool? confirmed = await _showAddressConfirmationDialog(place);

      if (confirmed == true && mounted) {
        _fillAddressFields(place);
        HapticFeedback.mediumImpact();
        SnackbarHelper.showSuccess(context, 'Address detected! Please review');
      }

      setState(() => _isFetchingLocation = false);
    } catch (e) {
      debugPrint('Error getting location: $e');
      _showError('Failed to get location. Please try again');
      setState(() => _isFetchingLocation = false);
    }
  }

  Future<bool?> _showAddressConfirmationDialog(Placemark place) async {
    final isDark = context.read<ThemeProvider>().isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    String street = (place.street ?? place.name ?? '').trim();
    String subLocality = (place.subLocality ?? '').trim();
    String locality = (place.locality ?? '').trim();
    String subAdministrativeArea = (place.subAdministrativeArea ?? '').trim();
    String state = (place.administrativeArea ?? '').trim();
    String pincode = (place.postalCode ?? '').trim();

    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: cardColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: EdgeInsets.zero,
        content: Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.9,
            maxHeight: MediaQuery.of(context).size.height * 0.7,
          ),
          padding: const EdgeInsets.all(24),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [accentColor, accentColor.withValues(alpha: 0.7)],
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: accentColor.withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.business_rounded, color: Colors.white, size: 32),
                ),
                const SizedBox(height: 20),
                Text(
                  'Confirm Business Location',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Is this your business address?',
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[850] : Colors.grey[50],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: accentColor.withValues(alpha: 0.3),
                      width: 1.5,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (street.isNotEmpty) ...[
                        _buildDialogRow(Icons.home_rounded, street, isDark),
                        const SizedBox(height: 8),
                      ],
                      if (subLocality.isNotEmpty) ...[
                        _buildDialogRow(Icons.location_city_rounded, subLocality, isDark),
                        const SizedBox(height: 8),
                      ],
                      if (locality.isNotEmpty) ...[
                        _buildDialogRow(Icons.location_on_rounded, locality, isDark),
                        const SizedBox(height: 8),
                      ],
                      if (subAdministrativeArea.isNotEmpty) ...[
                        _buildDialogRow(Icons.map_rounded, subAdministrativeArea, isDark),
                        const SizedBox(height: 8),
                      ],
                      if (state.isNotEmpty || pincode.isNotEmpty)
                        _buildDialogRow(
                          Icons.place_rounded,
                          '${state.isNotEmpty ? state : 'Unknown'}${pincode.isNotEmpty ? ' - $pincode' : ''}',
                          isDark,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context, false),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: BorderSide(
                            color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(context, true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: accentColor,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: const Text('Use Address'),
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

  Widget _buildDialogRow(IconData icon, String text, bool isDark) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: isDark ? Colors.grey[500] : Colors.grey[600]),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.grey[300] : Colors.grey[700],
            ),
          ),
        ),
      ],
    );
  }

  void _fillAddressFields(Placemark place) {
    String street = (place.street ?? place.name ?? '').trim();
    String subLocality = (place.subLocality ?? '').trim();
    String thoroughfare = (place.thoroughfare ?? '').trim();
    String locality = (place.locality ?? '').trim();
    String subAdministrativeArea = (place.subAdministrativeArea ?? '').trim();
    String state = (place.administrativeArea ?? '').trim();
    String pincode = (place.postalCode ?? '').trim();

    setState(() {
      // Address Line 1
      if (street.isNotEmpty && !street.toLowerCase().contains('unnamed')) {
        _addressController.text = street;
      } else if (thoroughfare.isNotEmpty) {
        _addressController.text = thoroughfare;
      }

      // Address Line 2
      if (subLocality.isNotEmpty && subLocality != street) {
        _address2Controller.text = subLocality;
      }

      // City
      if (locality.isNotEmpty) {
        _cityController.text = locality;
      }

      // Pincode
      if (pincode.length == 6 && RegExp(r'^[0-9]{6}$').hasMatch(pincode)) {
        _pincodeController.text = pincode;
      }

      // State matching
      if (state.isNotEmpty) {
        bool stateMatched = false;
        
        for (String s in IndiaLocations.allStates) {
          if (s.toLowerCase() == state.toLowerCase() ||
              s.toLowerCase().contains(state.toLowerCase()) ||
              state.toLowerCase().contains(s.toLowerCase())) {
            _selectedState = s;
            _filteredDistricts = IndiaLocations.getDistricts(s);
            _isManualStateEntry = false;
            stateMatched = true;
            break;
          }
        }

        if (!stateMatched) {
          _isManualStateEntry = true;
          _manualStateController.text = state;
        }
      }

      // District matching
      if (_selectedState != null) {
        String districtCandidate = subAdministrativeArea.isNotEmpty 
            ? subAdministrativeArea 
            : locality;

        if (districtCandidate.isNotEmpty) {
          bool districtMatched = false;

          for (String district in _filteredDistricts) {
            if (district.toLowerCase() == districtCandidate.toLowerCase() ||
                district.toLowerCase().contains(districtCandidate.toLowerCase()) ||
                districtCandidate.toLowerCase().contains(district.toLowerCase())) {
              _selectedDistrict = district;
              _isManualDistrictEntry = false;
              districtMatched = true;
              break;
            }
          }

          if (!districtMatched) {
            _isManualDistrictEntry = true;
            _manualDistrictController.text = districtCandidate;
          }
        }
      }
    });
  }

  Future<void> _saveChanges() async {
    if (!_formKey.currentState!.validate()) return;

    String finalState, finalDistrict;

    if (_isManualStateEntry) {
      if (_manualStateController.text.trim().isEmpty) {
        _showError('Please enter state');
        return;
      }
      finalState = _manualStateController.text.trim();
    } else {
      if (_selectedState == null) {
        _showError('Please select state');
        return;
      }
      finalState = _selectedState!;
    }

    if (_isManualDistrictEntry) {
      finalDistrict = _manualDistrictController.text.trim();
    } else {
      finalDistrict = _selectedDistrict ?? '';
    }

    setState(() => _isLoading = true);

    final sellerProvider = context.read<SellerProvider>();
    
    final success = await sellerProvider.updateSellerProfile(
      businessAddress: _addressController.text.trim(),
      businessAddress2: _address2Controller.text.trim(),
      businessCity: _cityController.text.trim(),
      businessPincode: _pincodeController.text.trim(),
      businessState: finalState,
      businessDistrict: finalDistrict,
      businessLandmark: _landmarkController.text.trim(),
    );

    setState(() => _isLoading = false);

    if (!mounted) return;

    if (success) {
      HapticFeedback.heavyImpact();
      SnackbarHelper.showSuccess(context, 'Business address updated successfully');
      Navigator.pop(context);
    } else {
      _showError(sellerProvider.error ?? 'Failed to update business address');
    }
  }

  void _showError(String message) {
    SnackbarHelper.showError(context, message);
  }

  void _showStateSelector() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _LocationSelector(
        title: 'Select State',
        items: _filteredStates,
        selectedItem: _selectedState,
        onSelected: (state) {
          setState(() {
            _selectedState = state;
            _selectedDistrict = null;
            _filteredDistricts = IndiaLocations.getDistricts(state);
            _isManualStateEntry = false;
          });
          Navigator.pop(context);
        },
        onManualEntry: () {
          setState(() => _isManualStateEntry = true);
          Navigator.pop(context);
        },
      ),
    );
  }

  void _showDistrictSelector() {
    if (_selectedState == null) {
      _showError('Please select state first');
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _LocationSelector(
        title: 'Select District',
        items: _filteredDistricts,
        selectedItem: _selectedDistrict,
        onSelected: (district) {
          setState(() {
            _selectedDistrict = district;
            _isManualDistrictEntry = false;
          });
          Navigator.pop(context);
        },
        onManualEntry: () {
          setState(() => _isManualDistrictEntry = true);
          Navigator.pop(context);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        elevation: 0,
        title: Text(
          'Business Address',
          style: TextStyle(
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_rounded,
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
          ),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildInfoCard(isDark),
            const SizedBox(height: 16),
            _buildLocationButton(isDark, accentColor),
            const SizedBox(height: 24),
            _buildAddressField(isDark),
            const SizedBox(height: 16),
            _buildAddress2Field(isDark),
            const SizedBox(height: 16),
            _buildLandmarkField(isDark),
            const SizedBox(height: 20),
            
            Row(
              children: [
                Icon(Icons.location_city_rounded, color: accentColor, size: 18),
                const SizedBox(width: 8),
                Text(
                  'Location Details',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            
            // State
            _isManualStateEntry
                ? _buildTextField(
                    controller: _manualStateController,
                    label: 'State *',
                    icon: Icons.map_outlined,
                    isDark: isDark,
                    suffix: IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: () {
                        setState(() {
                          _isManualStateEntry = false;
                          _manualStateController.clear();
                        });
                      },
                    ),
                    validator: (value) =>
                        value?.trim().isEmpty ?? true ? 'Required' : null,
                  )
                : _buildLocationSelector(
                    label: 'State *',
                    value: _selectedState,
                    icon: Icons.map_outlined,
                    onTap: _showStateSelector,
                    isDark: isDark,
                    accentColor: accentColor,
                  ),
            const SizedBox(height: 12),
            
            // District
            _isManualDistrictEntry
                ? _buildTextField(
                    controller: _manualDistrictController,
                    label: 'District (Optional)',
                    icon: Icons.location_city_outlined,
                    isDark: isDark,
                    suffix: IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: () {
                        setState(() {
                          _isManualDistrictEntry = false;
                          _manualDistrictController.clear();
                        });
                      },
                    ),
                  )
                : _buildLocationSelector(
                    label: 'District (Optional)',
                    value: _selectedDistrict,
                    icon: Icons.location_city_outlined,
                    onTap: _showDistrictSelector,
                    isDark: isDark,
                    accentColor: accentColor,
                  ),
            const SizedBox(height: 16),
            
            Row(
              children: [
                Expanded(child: _buildCityField(isDark)),
                const SizedBox(width: 12),
                Expanded(child: _buildPincodeField(isDark)),
              ],
            ),
            const SizedBox(height: 32),
            _buildSaveButton(isDark),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline_rounded, color: AppColors.warning, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Accurate business address helps with shipping and KYC verification',
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationButton(bool isDark, Color accentColor) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: _isFetchingLocation ? null : _getCurrentLocation,
        icon: _isFetchingLocation
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: isDark ? Colors.black : Colors.white,
                ),
              )
            : Icon(Icons.my_location_rounded, size: 20),
        label: Text(
          _isFetchingLocation ? 'Fetching Location...' : 'Use Current Location',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: accentColor,
          foregroundColor: isDark ? Colors.black : Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 2,
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required bool isDark,
    Widget? suffix,
    String? Function(String?)? validator,
    int maxLines = 1,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      style: TextStyle(
        color: isDark ? AppColors.textLight : AppColors.textPrimary,
        fontWeight: FontWeight.w600,
      ),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(
          icon,
          color: isDark ? AppColors.primaryLight : AppColors.primary,
        ),
        suffixIcon: suffix,
        filled: true,
        fillColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? AppColors.primaryLight : AppColors.primary,
            width: 2,
          ),
        ),
      ),
      validator: validator,
    );
  }

  Widget _buildLocationSelector({
    required String label,
    required String? value,
    required IconData icon,
    required VoidCallback onTap,
    required bool isDark,
    required Color accentColor,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: value != null
                ? accentColor
                : (isDark ? AppColors.borderDark : AppColors.border),
            width: value != null ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: value != null
                  ? accentColor
                  : (isDark ? Colors.grey[500] : Colors.grey[400]),
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value ?? 'Tap to select',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: value != null
                          ? (isDark ? Colors.white : Colors.black87)
                          : (isDark ? Colors.grey[600] : Colors.grey[500]),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 14,
              color: isDark ? Colors.grey[600] : Colors.grey[400],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAddressField(bool isDark) {
    return _buildTextField(
      controller: _addressController,
      label: 'Building, Street Address *',
      icon: Icons.home_outlined,
      isDark: isDark,
      maxLines: 2,
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Address is required';
        }
        if (value.trim().length < 5) {
          return 'Please enter complete address';
        }
        return null;
      },
    );
  }

  Widget _buildAddress2Field(bool isDark) {
    return _buildTextField(
      controller: _address2Controller,
      label: 'Area, Colony, Locality *',
      icon: Icons.location_city_outlined,
      isDark: isDark,
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Area is required';
        }
        return null;
      },
    );
  }

  Widget _buildLandmarkField(bool isDark) {
    return _buildTextField(
      controller: _landmarkController,
      label: 'Landmark (Optional)',
      icon: Icons.place_outlined,
      isDark: isDark,
    );
  }

  Widget _buildCityField(bool isDark) {
    return _buildTextField(
      controller: _cityController,
      label: 'City *',
      icon: Icons.location_on_outlined,
      isDark: isDark,
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'City required';
        }
        return null;
      },
    );
  }

  Widget _buildPincodeField(bool isDark) {
    return TextFormField(
      controller: _pincodeController,
      keyboardType: TextInputType.number,
      maxLength: 6,
      style: TextStyle(
        color: isDark ? AppColors.textLight : AppColors.textPrimary,
        fontWeight: FontWeight.w600,
      ),
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(6),
      ],
      decoration: InputDecoration(
        labelText: 'Pincode *',
        counterText: '',
        prefixIcon: Icon(
          Icons.pin_drop_outlined,
          color: isDark ? AppColors.primaryLight : AppColors.primary,
        ),
        filled: true,
        fillColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? AppColors.primaryLight : AppColors.primary,
            width: 2,
          ),
        ),
      ),
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Required';
        }
        if (value.trim().length != 6) {
          return 'Invalid';
        }
        return null;
      },
    );
  }

  Widget _buildSaveButton(bool isDark) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _saveChanges,
        style: ElevatedButton.styleFrom(
          backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
          foregroundColor: isDark ? AppColors.textPrimary : AppColors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 2,
        ),
        child: _isLoading
            ? SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: isDark ? AppColors.textPrimary : AppColors.white,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_rounded, size: 20),
                  const SizedBox(width: 10),
                  Text(
                    'Save Changes',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

// Location Selector Bottom Sheet
class _LocationSelector extends StatefulWidget {
  final String title;
  final List<String> items;
  final String? selectedItem;
  final Function(String) onSelected;
  final VoidCallback onManualEntry;

  const _LocationSelector({
    required this.title,
    required this.items,
    required this.selectedItem,
    required this.onSelected,
    required this.onManualEntry,
  });

  @override
  State<_LocationSelector> createState() => _LocationSelectorState();
}

class _LocationSelectorState extends State<_LocationSelector> {
  late List<String> _filteredItems;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _filteredItems = widget.items;
  }

  void _filterItems(String query) {
    setState(() {
      if (query.isEmpty) {
        _filteredItems = widget.items;
      } else {
        _filteredItems = widget.items
            .where((item) => item.toLowerCase().contains(query.toLowerCase()))
            .toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.watch<ThemeProvider>().isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[700] : Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.title,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _searchController,
                  onChanged: _filterItems,
                  decoration: InputDecoration(
                    hintText: 'Search...',
                    prefixIcon: Icon(Icons.search_rounded),
                    filled: true,
                    fillColor: isDark ? Colors.grey[850] : Colors.grey[100],
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: widget.onManualEntry,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: accentColor),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.edit_rounded, color: accentColor, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Enter manually',
                          style: TextStyle(
                            color: accentColor,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _filteredItems.length,
              itemBuilder: (context, index) {
                final item = _filteredItems[index];
                final isSelected = item == widget.selectedItem;
                return InkWell(
                  onTap: () => widget.onSelected(item),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isSelected ? accentColor.withValues(alpha: 0.1) : null,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            item,
                            style: TextStyle(
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                              color: isSelected ? accentColor : null,
                            ),
                          ),
                        ),
                        if (isSelected)
                          Icon(Icons.check_circle_rounded, color: accentColor, size: 20),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
