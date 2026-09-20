// lib/screens/auth/seller_registration_screen.dart

import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';

// App Imports
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' hide LoadingOverlay;
import '../../app/routes.dart';
import '../../providers/seller_provider.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import '../../widgets/common/loading_overlay.dart';

// --- Enums & Constants ---

enum SellerRegistrationStep { account, business, tax }
enum BusinessType { individual, soleProprietorship, privateLimited }

const List<String> _indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Delhi"
];

class UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    return newValue.copyWith(text: newValue.text.toUpperCase());
  }
}

// --- Main Screen ---

class SellerRegistrationScreen extends StatefulWidget {
  const SellerRegistrationScreen({super.key});

  @override
  State<SellerRegistrationScreen> createState() => _SellerRegistrationScreenState();
}

class _SellerRegistrationScreenState extends State<SellerRegistrationScreen>
    with TickerProviderStateMixin {
  
  // ---------------------------------------------------------------------------
  // 1. STATE & CONTROLLERS
  // ---------------------------------------------------------------------------

  final _formKey = GlobalKey<FormState>();
  final _scrollController = ScrollController();

  // -- Controllers --
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _mobile = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();

  final _businessLegalName = TextEditingController();
  final _storeName = TextEditingController();
  final _businessAddress = TextEditingController();
  final _businessContact = TextEditingController();
  final _businessCity = TextEditingController();
  final _businessPincode = TextEditingController();
  final _businessState = TextEditingController();

  final _panNumber = TextEditingController();
  final _gstNumber = TextEditingController();

  // -- Animation Controllers --
  late final AnimationController _mainAnimController;
  late final AnimationController _shakeController;
  late final AnimationController _pulseAnimController;
  
  late final Animation<double> _fadeInAnim;
  late final Animation<Offset> _slideUpAnim;
  late final Animation<Offset> _shakeAnim;
  late final Animation<double> _pulseAnim;

  // -- State --
  SellerRegistrationStep _currentStep = SellerRegistrationStep.account;
  BusinessType _businessType = BusinessType.individual;
  
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _acceptTerms = false;
  bool _gstExempt = false;
  bool _isSubmitting = false;
  bool _isFetchingLocation = false;
  double _overallProgress = 0.0;

  // Validation Status
  bool _isAccountValid = false;
  bool _isBusinessValid = false;
  bool _isTaxValid = false;

  // ---------------------------------------------------------------------------
  // 2. LIFECYCLE
  // ---------------------------------------------------------------------------

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _setupListeners();
  }

  @override
  void dispose() {
    _disposeControllers();
    super.dispose();
  }

  void _disposeControllers() {
    _mainAnimController.dispose();
    _shakeController.dispose();
    _pulseAnimController.dispose();
    _scrollController.dispose();
    
    _fullName.dispose(); _email.dispose(); _mobile.dispose();
    _password.dispose(); _confirmPassword.dispose();
    _businessLegalName.dispose(); _storeName.dispose();
    _businessAddress.dispose(); _businessContact.dispose();
    _businessCity.dispose(); _businessPincode.dispose(); _businessState.dispose();
    _panNumber.dispose(); _gstNumber.dispose();
  }

  void _initAnimations() {
    _mainAnimController = AnimationController(
      vsync: this, 
      duration: const Duration(milliseconds: 1400)
    );
    
    _fadeInAnim = CurvedAnimation(
      parent: _mainAnimController, 
      curve: const Interval(0.3, 1.0, curve: Curves.easeIn)
    );
    
    _slideUpAnim = Tween<Offset>(
      begin: const Offset(0, 0.15), 
      end: Offset.zero
    ).animate(CurvedAnimation(
      parent: _mainAnimController, 
      curve: const Interval(0.3, 0.9, curve: Curves.easeOutCubic)
    ));

    _shakeController = AnimationController(
      vsync: this, 
      duration: const Duration(milliseconds: 500)
    );
    
    _shakeAnim = Tween<Offset>(
      begin: Offset.zero, 
      end: const Offset(0.02, 0)
    ).animate(CurvedAnimation(
      parent: _shakeController, 
      curve: Curves.elasticIn
    ));

    _pulseAnimController = AnimationController(
      vsync: this, 
      duration: const Duration(milliseconds: 2000)
    )..repeat(reverse: true);
    
    _pulseAnim = Tween<double>(begin: 1.0, end: 1.05).animate(
      CurvedAnimation(parent: _pulseAnimController, curve: Curves.easeInOut)
    );

    _mainAnimController.forward();
  }

  void _setupListeners() {
    final allControllers = [
      _fullName, _email, _mobile, _password, _confirmPassword,
      _businessLegalName, _storeName, _businessAddress, _businessContact,
      _businessCity, _businessPincode, _businessState,
      _panNumber, _gstNumber
    ];

    for (var c in allControllers) {
      c.addListener(() {
        _validateCurrentStep();
        _updateProgress();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. LOGIC & VALIDATION
  // ---------------------------------------------------------------------------

  void _validateCurrentStep() {
    setState(() {
      _isAccountValid = _fullName.text.isNotEmpty &&
          Validators.validateEmail(_email.text) == null &&
          _mobile.text.length == 10 &&
          _password.text.length >= 8 &&
          _confirmPassword.text == _password.text;

      _isBusinessValid = _businessLegalName.text.isNotEmpty &&
          _storeName.text.isNotEmpty &&
          _businessAddress.text.isNotEmpty &&
          _businessCity.text.isNotEmpty &&
          _businessPincode.text.length == 6 &&
          _businessState.text.isNotEmpty &&
          _businessContact.text.length == 10;

      bool gstValid = _gstExempt || (_gstNumber.text.length == 15);
      _isTaxValid = _panNumber.text.length == 10 && gstValid && _acceptTerms;
    });
  }

  void _updateProgress() {
    int filled = 0;
    if (_fullName.text.isNotEmpty) filled++;
    if (_email.text.isNotEmpty) filled++;
    if (_mobile.text.isNotEmpty) filled++;
    if (_password.text.isNotEmpty) filled++;
    if (_confirmPassword.text.isNotEmpty) filled++;
    
    if (_businessLegalName.text.isNotEmpty) filled++;
    if (_storeName.text.isNotEmpty) filled++;
    if (_businessAddress.text.isNotEmpty) filled++;
    if (_businessCity.text.isNotEmpty) filled++;
    if (_businessPincode.text.isNotEmpty) filled++;
    if (_businessState.text.isNotEmpty) filled++;
    
    if (_panNumber.text.isNotEmpty) filled++;
    if (_gstExempt || _gstNumber.text.isNotEmpty) filled++;
    
    setState(() => _overallProgress = filled / 13.0);
  }

  // ---------------------------------------------------------------------------
  // 4. ACTIONS
  // ---------------------------------------------------------------------------

  void _handleNext() {
    HapticFeedback.mediumImpact();
    
    if (_currentStep == SellerRegistrationStep.account) {
      if (_isAccountValid) {
        setState(() => _currentStep = SellerRegistrationStep.business);
        _scrollToTop();
        _mainAnimController.forward(from: 0);
      } else {
        _triggerErrorShake();
        _showSnackBar('Please complete all account fields correctly.', isError: true);
      }
    } else if (_currentStep == SellerRegistrationStep.business) {
      if (_isBusinessValid) {
        setState(() => _currentStep = SellerRegistrationStep.tax);
        _scrollToTop();
        _mainAnimController.forward(from: 0);
      } else {
        _triggerErrorShake();
        _showSnackBar('Please complete all business fields.', isError: true);
      }
    } else {
      if (_isTaxValid) {
        _submitForm();
      } else {
        _triggerErrorShake();
        _showSnackBar('Please fill tax details and accept terms.', isError: true);
      }
    }
  }

  void _handleBack() {
    HapticFeedback.lightImpact();
    if (_currentStep == SellerRegistrationStep.account) {
      Navigator.pop(context);
    } else {
      setState(() {
        _currentStep = SellerRegistrationStep.values[_currentStep.index - 1];
      });
      _scrollToTop();
      _mainAnimController.forward(from: 0);
    }
  }

  void _triggerErrorShake() {
    HapticFeedback.vibrate();
    _shakeController.forward(from: 0).then((_) => _shakeController.reverse());
  }

  void _scrollToTop() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0, 
        duration: const Duration(milliseconds: 300), 
        curve: Curves.easeOut
      );
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? Icons.error_outline_rounded : Icons.check_circle_rounded, 
              color: Colors.white, 
              size: 24
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message, 
                style: const TextStyle(
                  color: Colors.white, 
                  fontWeight: FontWeight.w500
                )
              )
            ),
          ],
        ),
        backgroundColor: isError ? AppColors.error : AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  Future<void> _fetchLocation() async {
    setState(() => _isFetchingLocation = true);
    HapticFeedback.lightImpact();
    
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) throw 'Location services are disabled.';

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw 'Location permission denied.';
        }
      }

      Position position = await Geolocator.getCurrentPosition();
      List<Placemark> placemarks = await placemarkFromCoordinates(
        position.latitude, 
        position.longitude
      );
      
      if (placemarks.isNotEmpty) {
        Placemark place = placemarks.first;
        setState(() {
          _businessAddress.text = "${place.street}, ${place.subLocality}";
          _businessCity.text = place.locality ?? "";
          _businessPincode.text = place.postalCode ?? "";
          _businessState.text = place.administrativeArea ?? "";
        });
        _validateCurrentStep();
        HapticFeedback.heavyImpact();
        _showSnackBar('Location fetched successfully!');
      }
    } catch (e) {
      _showSnackBar(e.toString(), isError: true);
    } finally {
      setState(() => _isFetchingLocation = false);
    }
  }

  Future<void> _submitForm() async {
    setState(() => _isSubmitting = true);
    HapticFeedback.heavyImpact();
    
    try {
      final success = await context.read<SellerProvider>().registerSeller(
        email: _email.text.trim(),
        password: _password.text,
        name: _fullName.text.trim(),
        phone: '+91${_mobile.text.trim()}',
        storeName: _storeName.text.trim(),
        businessLegalName: _businessLegalName.text.trim(),
        businessType: _businessType.toString().split('.').last,
        gstNumber: _gstExempt ? 'EXEMPT' : _gstNumber.text.trim(),
        panNumber: _panNumber.text.trim(),
        businessAddress: _businessAddress.text.trim(),
        businessContact: '+91${_businessContact.text.trim()}',
        businessCity: _businessCity.text.trim(),
        businessState: _businessState.text.trim(),
        businessPincode: _businessPincode.text.trim(),
      );

      if (success && mounted) {
        Navigator.pushNamedAndRemoveUntil(
          context, 
          AppRoutes.auth, 
          (route) => false
        );
        _showSnackBar('Registration Successful! Please login.');
      } else if (mounted) {
        _showSnackBar(
          context.read<SellerProvider>().error ?? 'Registration Failed', 
          isError: true
        );
      }
    } catch (e) {
      _showSnackBar('An error occurred: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  // ---------------------------------------------------------------------------
  // 5. BUILD UI
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return LoadingOverlay(
      isLoading: _isSubmitting,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.primary.withValues(alpha: 0.02),
                Colors.white,
                AppColors.primary.withValues(alpha: 0.01),
              ],
              stops: const [0.0, 0.5, 1.0],
            ),
          ),
          child: SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: SlideTransition(
                    position: _shakeAnim,
                    child: SingleChildScrollView(
                      controller: _scrollController,
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(24, 10, 24, 100),
                      child: FadeTransition(
                        opacity: _fadeInAnim,
                        child: SlideTransition(
                          position: _slideUpAnim,
                          child: Column(
                            children: [
                              _buildProgressHeader(),
                              const SizedBox(height: 32),
                              
                              AnimatedSwitcher(
                                duration: const Duration(milliseconds: 450),
                                switchInCurve: Curves.easeOutBack,
                                switchOutCurve: Curves.easeIn,
                                transitionBuilder: (child, animation) {
                                  return FadeTransition(
                                    opacity: animation,
                                    child: SlideTransition(
                                      position: Tween<Offset>(
                                        begin: const Offset(0.05, 0), 
                                        end: Offset.zero
                                      ).animate(animation),
                                      child: child,
                                    ),
                                  );
                                },
                                child: _buildCurrentStepForm(),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
        floatingActionButton: _buildFloatingFooter(),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: _handleBack,
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[200]!),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.arrow_back_rounded, 
                  size: 22, 
                  color: AppColors.textPrimary
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Seller Registration',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                    color: Colors.grey[900],
                  ),
                ),
                Text(
                  _getStepTitle(),
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.2),
                width: 1.5,
              ),
            ),
            child: Text(
              'Step ${_currentStep.index + 1}/3',
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getStepTitle() {
    switch (_currentStep) {
      case SellerRegistrationStep.account: return 'Create Account';
      case SellerRegistrationStep.business: return 'Business Details';
      case SellerRegistrationStep.tax: return 'Tax & Legal';
    }
  }

  Widget _buildProgressHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.analytics_rounded, 
                    size: 16, 
                    color: AppColors.primary
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Profile Completion',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[700],
                  ),
                ),
              ],
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '${(_overallProgress * 100).toInt()}%',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: _overallProgress,
            backgroundColor: Colors.grey[100],
            color: AppColors.primary,
            minHeight: 8,
          ),
        ),
      ],
    );
  }

  Widget _buildCurrentStepForm() {
    switch (_currentStep) {
      case SellerRegistrationStep.account:
        return _AccountStepForm(
          key: const ValueKey('Account'),
          fullName: _fullName,
          email: _email,
          mobile: _mobile,
          password: _password,
          confirmPassword: _confirmPassword,
          obscurePassword: _obscurePassword,
          obscureConfirmPassword: _obscureConfirmPassword,
          onTogglePassword: () => setState(() => _obscurePassword = !_obscurePassword),
          onToggleConfirm: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
          pulseAnim: _pulseAnim,
        );
      case SellerRegistrationStep.business:
        return _BusinessStepForm(
          key: const ValueKey('Business'),
          legalName: _businessLegalName,
          storeName: _storeName,
          address: _businessAddress,
          city: _businessCity,
          state: _businessState,
          pincode: _businessPincode,
          contact: _businessContact,
          businessType: _businessType,
          onTypeChanged: (val) => setState(() => _businessType = val),
          isFetchingLocation: _isFetchingLocation,
          onFetchLocation: _fetchLocation,
        );
      case SellerRegistrationStep.tax:
        return _TaxStepForm(
          key: const ValueKey('Tax'),
          pan: _panNumber,
          gst: _gstNumber,
          gstExempt: _gstExempt,
          acceptTerms: _acceptTerms,
          onGstToggle: (val) {
            setState(() {
              _gstExempt = val;
              if (val) _gstNumber.clear();
            });
            _validateCurrentStep();
          },
          onTermsToggle: (val) {
            setState(() => _acceptTerms = val ?? false);
            HapticFeedback.selectionClick();
            _validateCurrentStep();
          },
        );
    }
  }

  Widget _buildFloatingFooter() {
    final bool isLastStep = _currentStep == SellerRegistrationStep.tax;
    final bool canProceed = _currentStep == SellerRegistrationStep.account 
        ? _isAccountValid 
        : _currentStep == SellerRegistrationStep.business 
            ? _isBusinessValid 
            : _isTaxValid;
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey[200]!),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.15),
            blurRadius: 30,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Row(
            children: [
              if (_currentStep != SellerRegistrationStep.account) ...[
                Material(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    onTap: _handleBack,
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      child: const Icon(
                        Icons.arrow_back_rounded, 
                        size: 24,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              
              Expanded(
                child: Container(
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppColors.primary, 
                        AppColors.primary.withValues(alpha: 0.85)
                      ],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.4),
                        blurRadius: 24,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: _handleNext,
                      borderRadius: BorderRadius.circular(14),
                      child: Center(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              isLastStep ? 'Complete Registration' : 'Continue',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Icon(
                              isLastStep 
                                  ? Icons.rocket_launch_rounded 
                                  : Icons.arrow_forward_rounded,
                              color: Colors.white,
                              size: 22,
                            ),
                          ],
                        ),
                      ),
                    ),
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

// ---------------------------------------------------------------------------
// 6. SUB-WIDGETS (Private)
// ---------------------------------------------------------------------------

class _AccountStepForm extends StatelessWidget {
  final TextEditingController fullName, email, mobile, password, confirmPassword;
  final bool obscurePassword, obscureConfirmPassword;
  final VoidCallback onTogglePassword, onToggleConfirm;
  final Animation<double> pulseAnim;

  const _AccountStepForm({
    super.key,
    required this.fullName, required this.email, required this.mobile, 
    required this.password, required this.confirmPassword,
    required this.obscurePassword, required this.obscureConfirmPassword,
    required this.onTogglePassword, required this.onToggleConfirm,
    required this.pulseAnim,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.08),
            blurRadius: 30,
            offset: const Offset(0, 15),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            icon: Icons.person_rounded, 
            title: 'Account Information',
            pulseAnim: pulseAnim,
          ),
          const SizedBox(height: 24),
          
          CustomTextField(
            controller: fullName, 
            label: 'Full Name', 
            hint: 'John Doe',
            prefixIcon: Icons.person_outline_rounded, 
            textCapitalization: TextCapitalization.words,
            validator: Validators.validateName,
          ),
          const SizedBox(height: 20),
          
          CustomTextField(
            controller: email, 
            label: 'Email Address', 
            hint: 'store@business.com',
            prefixIcon: Icons.email_outlined, 
            keyboardType: TextInputType.emailAddress,
            validator: Validators.validateEmail,
          ),
          const SizedBox(height: 20),
          
          CustomTextField(
            controller: mobile, 
            label: 'Mobile Number', 
            hint: '9876543210',
            prefixIcon: Icons.phone_iphone_rounded, 
            keyboardType: TextInputType.phone,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly, 
              LengthLimitingTextInputFormatter(10)
            ],
          ),
          const SizedBox(height: 20),
          
          CustomTextField(
            controller: password, 
            label: 'Password', 
            hint: 'Minimum 8 characters',
            prefixIcon: Icons.lock_outline_rounded, 
            obscureText: obscurePassword,
            suffixIcon: IconButton(
              icon: Icon(
                obscurePassword 
                    ? Icons.visibility_off_outlined 
                    : Icons.visibility_outlined,
                color: Colors.grey[400],
              ), 
              onPressed: onTogglePassword
            ),
          ),
          const SizedBox(height: 20),
          
          CustomTextField(
            controller: confirmPassword, 
            label: 'Confirm Password', 
            hint: 'Re-enter password',
            prefixIcon: Icons.lock_reset_rounded, 
            obscureText: obscureConfirmPassword,
            suffixIcon: IconButton(
              icon: Icon(
                obscureConfirmPassword 
                    ? Icons.visibility_off_outlined 
                    : Icons.visibility_outlined,
                color: Colors.grey[400],
              ), 
              onPressed: onToggleConfirm
            ),
          ),
        ],
      ),
    );
  }
}

class _BusinessStepForm extends StatelessWidget {
  final TextEditingController legalName, storeName, address, city, state, pincode, contact;
  final BusinessType businessType;
  final Function(BusinessType) onTypeChanged;
  final bool isFetchingLocation;
  final VoidCallback onFetchLocation;

  const _BusinessStepForm({
    super.key,
    required this.legalName, required this.storeName, required this.address,
    required this.city, required this.state, required this.pincode, 
    required this.contact,
    required this.businessType, required this.onTypeChanged,
    required this.isFetchingLocation, required this.onFetchLocation,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.08),
            blurRadius: 30,
            offset: const Offset(0, 15),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Business Type',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey[200]!),
            ),
            child: Row(
              children: BusinessType.values.map((type) {
                final isSelected = businessType == type;
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      onTypeChanged(type);
                      HapticFeedback.selectionClick();
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: isSelected ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: isSelected 
                            ? [
                                BoxShadow(
                                  color: AppColors.primary.withValues(alpha: 0.15),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                )
                              ] 
                            : [],
                      ),
                      child: Center(
                        child: Text(
                          type == BusinessType.individual 
                              ? 'Individual' 
                              : type == BusinessType.soleProprietorship 
                                  ? 'Proprietor' 
                                  : 'Pvt Ltd',
                          style: TextStyle(
                            fontSize: 13, 
                            fontWeight: FontWeight.w700,
                            color: isSelected 
                                ? AppColors.primary 
                                : Colors.grey[600],
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          
          const SizedBox(height: 28),
          const Divider(height: 1),
          const SizedBox(height: 28),
          
          CustomTextField(
            controller: legalName, 
            label: 'Business Legal Name', 
            hint: 'As per registration',
            prefixIcon: Icons.gavel_outlined
          ),
          const SizedBox(height: 20),
          
          CustomTextField(
            controller: storeName, 
            label: 'Store Display Name', 
            hint: 'Public store name',
            prefixIcon: Icons.storefront_outlined
          ),
          const SizedBox(height: 20),
          
          CustomTextField(
            controller: contact, 
            label: 'Business Contact', 
            hint: '9876543210',
            prefixIcon: Icons.phone_rounded, 
            keyboardType: TextInputType.phone, 
            inputFormatters: [
              LengthLimitingTextInputFormatter(10), 
              FilteringTextInputFormatter.digitsOnly
            ]
          ),
          
          const SizedBox(height: 28),
          const Divider(height: 1),
          const SizedBox(height: 24),
          
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween, 
            children: [
              const Text(
                'Address Details', 
                style: TextStyle(
                  fontWeight: FontWeight.bold, 
                  fontSize: 15
                )
              ),
              TextButton.icon(
                onPressed: isFetchingLocation ? null : onFetchLocation,
                icon: isFetchingLocation 
                    ? const SizedBox(
                        width: 14, 
                        height: 14, 
                        child: CircularProgressIndicator(strokeWidth: 2)
                      ) 
                    : Icon(
                        Icons.my_location_rounded, 
                        size: 16, 
                        color: AppColors.primary
                      ),
                label: Text(
                  isFetchingLocation ? 'Locating...' : 'Auto-Fill',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero, 
                  visualDensity: VisualDensity.compact,
                  foregroundColor: AppColors.primary,
                ),
              ),
            ]
          ),
          const SizedBox(height: 12),
          
          CustomTextField(
            controller: address, 
            hint: 'Street Address', 
            prefixIcon: Icons.place_outlined, 
            maxLines: 2
          ),
          const SizedBox(height: 16),
          
          Row(
            children: [
              Expanded(
                child: CustomTextField(
                  controller: city, 
                  label: 'City', 
                  hint: 'City Name',
                  prefixIcon: Icons.location_city_outlined
                )
              ),
              const SizedBox(width: 12),
              Expanded(
                child: CustomTextField(
                  controller: pincode, 
                  label: 'Pincode', 
                  hint: '000000',
                  inputFormatters: [
                    LengthLimitingTextInputFormatter(6), 
                    FilteringTextInputFormatter.digitsOnly
                  ]
                )
              ),
            ]
          ),
          const SizedBox(height: 16),
          
          _buildStateDropdown(),
        ],
      ),
    );
  }

  Widget _buildStateDropdown() {
    return DropdownButtonFormField<String>(
      initialValue: _indianStates.contains(state.text) ? state.text : null,
      items: _indianStates.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
      onChanged: (val) {
        state.text = val ?? '';
        HapticFeedback.selectionClick();
      },
      decoration: InputDecoration(
        labelText: 'State',
        prefixIcon: const Icon(Icons.map_outlined, color: AppColors.textSecondary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        filled: true,
        fillColor: Colors.grey[50],
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      ),
      icon: const Icon(Icons.keyboard_arrow_down_rounded),
    );
  }
}

class _TaxStepForm extends StatelessWidget {
  final TextEditingController pan, gst;
  final bool gstExempt, acceptTerms;
  final Function(bool) onGstToggle;
  final Function(bool?) onTermsToggle;

  const _TaxStepForm({
    super.key,
    required this.pan, required this.gst, 
    required this.gstExempt, required this.acceptTerms,
    required this.onGstToggle, required this.onTermsToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.08),
            blurRadius: 30,
            offset: const Offset(0, 15),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.15),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.info_outline_rounded, 
                    color: AppColors.primary, 
                    size: 20
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Tax details are mandatory for seller verification',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey[700],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          CustomTextField(
            controller: pan, 
            label: 'PAN Number', 
            hint: 'ABCDE1234F',
            prefixIcon: Icons.badge_outlined, 
            inputFormatters: [
              UpperCaseTextFormatter(), 
              LengthLimitingTextInputFormatter(10)
            ]
          ),
          
          const SizedBox(height: 24),
          const Divider(height: 1),
          const SizedBox(height: 24),
          
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: gstExempt 
                  ? AppColors.primary.withValues(alpha: 0.05) 
                  : Colors.grey[50],
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: gstExempt 
                    ? AppColors.primary.withValues(alpha: 0.3) 
                    : Colors.grey[200]!,
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'GST Exemption', 
                        style: TextStyle(
                          fontWeight: FontWeight.bold, 
                          fontSize: 15
                        )
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Enable if annual turnover < ₹20L',
                        style: TextStyle(
                          fontSize: 12, 
                          color: Colors.grey[600]
                        ),
                      ),
                    ],
                  ),
                ),
                Transform.scale(
                  scale: 0.9,
                  child: Switch(
                    value: gstExempt,
                    onChanged: (val) {
                      onGstToggle(val);
                      HapticFeedback.selectionClick();
                    },
                    activeThumbColor: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          
          if (!gstExempt) ...[ const SizedBox(height: 20),
            CustomTextField(
              controller: gst, 
              label: 'GSTIN', 
              hint: '22ABCDE1234F1Z5',
              prefixIcon: Icons.receipt_long_outlined, 
              inputFormatters: [
                UpperCaseTextFormatter(), 
                LengthLimitingTextInputFormatter(15)
              ]
            ),
          ],

          const SizedBox(height: 32),
          const Divider(height: 1),
          const SizedBox(height: 24),
          
          InkWell(
            onTap: () => onTermsToggle(!acceptTerms),
            borderRadius: BorderRadius.circular(14),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: acceptTerms 
                    ? AppColors.primary.withValues(alpha: 0.06) 
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: acceptTerms 
                      ? AppColors.primary.withValues(alpha: 0.4) 
                      : Colors.grey[300]!,
                  width: 1.5,
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 24, 
                    height: 24,
                    decoration: BoxDecoration(
                      color: acceptTerms 
                          ? AppColors.primary 
                          : Colors.transparent,
                      border: Border.all(
                        color: acceptTerms 
                            ? AppColors.primary 
                            : Colors.grey[400]!,
                        width: 2,
                      ),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: acceptTerms 
                        ? const Icon(
                            Icons.check_rounded, 
                            size: 16, 
                            color: Colors.white
                          ) 
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      "I agree to the Seller Terms, Privacy Policy & Commission Structure.",
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Colors.grey[700],
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final Animation<double> pulseAnim;

  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.pulseAnim,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AnimatedBuilder(
          animation: pulseAnim,
          builder: (context, child) {
            return Transform.scale(
              scale: pulseAnim.value,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: AppColors.primary, size: 24),
              ),
            );
          },
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.3,
          ),
        ),
      ],
    );
  }
}
