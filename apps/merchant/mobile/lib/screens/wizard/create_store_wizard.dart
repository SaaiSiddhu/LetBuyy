import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../../models/store_model.dart';
import '../../app/store_context.dart';
import '../../widgets/wizard/wizard_container.dart';
import '../../services/store_service.dart';
import '../../services/store_auth_service.dart';

import '../../services/theme_provider.dart';
import '../../services/language_service.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../theme/app_theme_colors.dart';
import '../../models/store_theme_model.dart';
import '../../app/routes.dart';

enum _SubdomainErrorKind { tooShort, invalidCharacters, taken, checkFailed }

/// Unified Store Creation Wizard - 7-step flow
/// Combines onboarding (steps 1-4) and store setup (steps 5-7)
/// Dark background with white floating cards
class CreateStoreWizard extends StatefulWidget {
  const CreateStoreWizard({super.key});

  @override
  State<CreateStoreWizard> createState() => _CreateStoreWizardState();
}

class _CreateStoreWizardState extends State<CreateStoreWizard> {
  late PageController _pageController;
  int _currentStep = 1; // Start at step 1 (unified wizard)
  bool _isLoading = false;
  bool _isInitialized = false;

  // Step 1: Business Type (from onboarding)
  String? _businessType;

  // Step 2: Sales Channels (from onboarding)
  final Set<String> _selectedChannels = {};

  // Step 3: Product Type (from onboarding)
  String? _productType;

  // Step 4: Store Category (from onboarding)
  String? _category;

  // Step 5: Store Name
  final _nameController = TextEditingController();
  final _nameFocusNode = FocusNode();

  // Step 6: Subdomain
  final _subdomainController = TextEditingController();
  final _subdomainFocusNode = FocusNode();
  bool _isSubdomainAvailable = false;
  bool _isCheckingSubdomain = false;
  _SubdomainErrorKind? _subdomainError;
  int _subdomainCheckGeneration = 0;

  // Step 7: Theme
  String _selectedThemeId = 'minimal_modern';
  StoreModel? _createdDraft;

  static const _storeCreationPreferencePrefix =
      'letbuyy.pending_mobile_store_creation';

  String get _storeCreationPreferenceScope =>
      context.read<StoreAuthService>().currentUser?.id ?? 'signed-out';
  String get _storeCreationKeyPreference =>
      '$_storeCreationPreferencePrefix.$_storeCreationPreferenceScope.key';
  String get _storeCreationFingerprintPreference =>
      '$_storeCreationPreferencePrefix.$_storeCreationPreferenceScope.fingerprint';
  String get _storeCreationRequestPreference =>
      '$_storeCreationPreferencePrefix.$_storeCreationPreferenceScope.request';

  static const int _totalSteps = 7;

  @override
  void initState() {
    super.initState();
    // Start at step 1 (0-indexed = 0) - unified 7-step wizard
    _pageController = PageController(initialPage: 0);
    _currentStep = 1;
    _restorePendingStoreCreation();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _nameController.dispose();
    _nameFocusNode.dispose();
    _subdomainController.dispose();
    _subdomainFocusNode.dispose();
    super.dispose();
  }

  // Theme helpers for content
  bool get _isDark => context.watch<ThemeProvider>().isDarkMode(context);
  Color get _textPrimary => _isDark ? Colors.white : Colors.black87;
  Color get _textSecondary =>
      _isDark ? Colors.white.withValues(alpha: 0.6) : Colors.black54;
  Color get _borderColor =>
      _isDark ? Colors.white.withValues(alpha: 0.15) : Colors.grey.shade300;
  Color get _inputBg =>
      _isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade100;

  // Language helper
  LanguageService get _lang => context.watch<LanguageService>();

  Future<void> _nextStep() async {
    if (_currentStep < _totalSteps) {
      // Save onboarding data after step 4 before moving to step 5
      if (_currentStep == 4) {
        await _saveOnboardingData();
      }

      final nextStep = _currentStep + 1;
      setState(() => _currentStep = nextStep);

      _pageController.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );

      // Auto-focus text fields after page animation completes
      if (nextStep == 5) {
        Future.delayed(const Duration(milliseconds: 400), () {
          _nameFocusNode.requestFocus();
        });
      } else if (nextStep == 6) {
        Future.delayed(const Duration(milliseconds: 400), () {
          _subdomainFocusNode.requestFocus();
        });
      }
    }
  }

  void _previousStep() {
    if (_currentStep <= 1) {
      // At step 1, show logout confirmation dialog (no back button)
      _showLogoutConfirmation();
      return;
    }

    // Go back normally
    final prevStep = _currentStep - 1;
    setState(() => _currentStep = prevStep);
    _pageController.previousPage(
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
    );

    // Auto-focus text fields when going back to Steps 5 or 6
    if (prevStep == 5) {
      Future.delayed(const Duration(milliseconds: 400), () {
        _nameFocusNode.requestFocus();
      });
    } else if (prevStep == 6) {
      Future.delayed(const Duration(milliseconds: 400), () {
        _subdomainFocusNode.requestFocus();
      });
    }
  }

  Future<void> _showLogoutConfirmation() async {
    Widget buildDialogAction({
      required BuildContext context,
      required String key,
      required String label,
      required Color backgroundColor,
      required Color foregroundColor,
      required bool shouldLogout,
    }) {
      void dismiss() => Navigator.pop(context, shouldLogout);

      return Semantics(
        key: ValueKey(key),
        container: true,
        excludeSemantics: true,
        button: true,
        enabled: true,
        label: label,
        onTap: dismiss,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: dismiss,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Ink(
                decoration: BoxDecoration(
                  color: backgroundColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Text(
                      label,
                      style: TextStyle(
                        color: foregroundColor,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    final result = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 320),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: _isDark ? const Color(0xFF1E293B) : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: _isDark
                  ? Colors.white.withValues(alpha: 0.1)
                  : Colors.grey.withValues(alpha: 0.1),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Logout icon
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: LetbuyyColorTokens.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.logout_rounded,
                  color: LetbuyyColorTokens.error,
                  size: 28,
                ),
              ),
              const SizedBox(height: 20),

              // Title
              Text(
                _lang.logoutTitle,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: _textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),

              // Message
              Text(
                _lang.logoutMessage,
                style: TextStyle(fontSize: 14, color: _textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),

              // Buttons
              Row(
                children: [
                  // Cancel button
                  Expanded(
                    child: buildDialogAction(
                      context: context,
                      key: 'wizard-logout-cancel',
                      label: _lang.cancel,
                      backgroundColor: _isDark
                          ? Colors.white.withValues(alpha: 0.08)
                          : Colors.grey.withValues(alpha: 0.1),
                      foregroundColor: _textPrimary,
                      shouldLogout: false,
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Logout button
                  Expanded(
                    child: buildDialogAction(
                      context: context,
                      key: 'wizard-logout-confirm',
                      label: _lang.logout,
                      backgroundColor: LetbuyyColorTokens.error,
                      foregroundColor: Colors.white,
                      shouldLogout: true,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (result == true && mounted) {
      final authService = context.read<StoreAuthService>();
      await authService.signOut();
      if (mounted) {
        Navigator.pushReplacementNamed(context, AppRoutes.login);
      }
    }
  }

  Future<void> _saveOnboardingData() async {
    try {
      if (_businessType == null || _productType == null || _category == null) {
        return;
      }

      await context.read<StoreService>().saveMobileOnboardingProgress(
        businessType: _businessType!,
        channels: _selectedChannels,
        productType: _productType!,
        category: _category!,
      );
    } catch (e) {
      debugPrint('Error saving onboarding: $e');
    }
  }

  Map<String, dynamic> _onboardingTemplateConfig() {
    return {
      'onboarding': {
        if (_businessType != null) 'business_type': _businessType,
        'channels': _selectedChannels.toList(growable: false),
        if (_productType != null) 'product_type': _productType,
        if (_category != null) 'category': _category,
        'source': 'mobile-merchant-app',
      },
    };
  }

  Map<String, dynamic> _storeCreationRequest() => {
    'name': _nameController.text.trim(),
    'subdomain': _subdomainController.text.trim().toLowerCase(),
    'site_type': 'store',
    'tagline': '',
    'theme_id': _selectedThemeId,
    'template_config': _onboardingTemplateConfig(),
  };

  Future<void> _restorePendingStoreCreation() async {
    String? restoredSubdomain;
    final keyPreference = _storeCreationKeyPreference;
    final fingerprintPreference = _storeCreationFingerprintPreference;
    final requestPreference = _storeCreationRequestPreference;
    try {
      final preferences = await SharedPreferences.getInstance();
      final key = preferences.getString(keyPreference);
      final fingerprint = preferences.getString(fingerprintPreference);
      final encodedRequest = preferences.getString(requestPreference);
      if (key != null && fingerprint != null && encodedRequest != null) {
        final request = Map<String, dynamic>.from(
          jsonDecode(encodedRequest) as Map,
        );
        if (jsonEncode(request) == fingerprint &&
            request['name'] is String &&
            request['subdomain'] is String &&
            request['theme_id'] is String &&
            request['template_config'] is Map) {
          _nameController.text = request['name'] as String;
          restoredSubdomain = request['subdomain'] as String;
          _subdomainController.text = restoredSubdomain;
          _selectedThemeId = request['theme_id'] as String;
          final config = Map<String, dynamic>.from(
            request['template_config'] as Map,
          );
          final onboarding = config['onboarding'];
          if (onboarding is Map) {
            final values = Map<String, dynamic>.from(onboarding);
            _businessType = values['business_type'] as String?;
            _productType = values['product_type'] as String?;
            _category = values['category'] as String?;
            final channels = values['channels'];
            if (channels is List) {
              _selectedChannels.addAll(channels.whereType<String>());
            }
          }
          _currentStep = _totalSteps;
          _pageController.dispose();
          _pageController = PageController(initialPage: _totalSteps - 1);
        }
      }
    } catch (_) {
      // A malformed local draft must not stop a merchant from starting over.
    }

    if (!mounted) return;
    setState(() => _isInitialized = true);
    if (restoredSubdomain != null) {
      await _checkSubdomainAvailability(restoredSubdomain);
    }
  }

  Future<String> _storeCreationIdempotencyKey(
    Map<String, dynamic> request,
  ) async {
    final keyPreference = _storeCreationKeyPreference;
    final fingerprintPreference = _storeCreationFingerprintPreference;
    final requestPreference = _storeCreationRequestPreference;
    final fingerprint = jsonEncode(request);
    final preferences = await SharedPreferences.getInstance();
    final previousKey = preferences.getString(keyPreference);
    if (previousKey != null &&
        preferences.getString(fingerprintPreference) == fingerprint) {
      final requestSaved = await preferences.setString(
        requestPreference,
        fingerprint,
      );
      if (!requestSaved) {
        throw StateError('Store retry details could not be saved.');
      }
      return previousKey;
    }

    final key = const Uuid().v4();
    final keySaved = await preferences.setString(keyPreference, key);
    final fingerprintSaved = await preferences.setString(
      fingerprintPreference,
      fingerprint,
    );
    final requestSaved = await preferences.setString(
      requestPreference,
      fingerprint,
    );
    if (!keySaved || !fingerprintSaved || !requestSaved) {
      throw StateError('Store retry details could not be saved.');
    }
    return key;
  }

  Future<void> _clearStoreCreationIdempotencyKey() async {
    final keyPreference = _storeCreationKeyPreference;
    final fingerprintPreference = _storeCreationFingerprintPreference;
    final requestPreference = _storeCreationRequestPreference;
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(keyPreference);
    await preferences.remove(fingerprintPreference);
    await preferences.remove(requestPreference);
  }

  Future<void> _checkSubdomainAvailability(String subdomain) async {
    final generation = ++_subdomainCheckGeneration;
    if (subdomain.length < 3) {
      setState(() {
        _isCheckingSubdomain = false;
        _subdomainError = subdomain.isEmpty
            ? null
            : _SubdomainErrorKind.tooShort;
        _isSubdomainAvailable = false;
      });
      return;
    }

    final validPattern = RegExp(r'^[a-z0-9-]+$');
    if (!validPattern.hasMatch(subdomain)) {
      setState(() {
        _isCheckingSubdomain = false;
        _subdomainError = _SubdomainErrorKind.invalidCharacters;
        _isSubdomainAvailable = false;
      });
      return;
    }

    setState(() {
      _isCheckingSubdomain = true;
      _isSubdomainAvailable = false;
      _subdomainError = null;
    });

    bool available;
    try {
      final storeService = context.read<StoreService>();
      available = await storeService.isSubdomainAvailable(subdomain);
    } catch (_) {
      if (!mounted || generation != _subdomainCheckGeneration) return;
      setState(() {
        _isCheckingSubdomain = false;
        _isSubdomainAvailable = false;
        _subdomainError = _SubdomainErrorKind.checkFailed;
      });
      return;
    }

    if (!mounted || generation != _subdomainCheckGeneration) return;

    setState(() {
      _isCheckingSubdomain = false;
      _isSubdomainAvailable = available;
      _subdomainError = available ? null : _SubdomainErrorKind.taken;
    });
  }

  String _subdomainErrorMessage() => switch (_subdomainError) {
    _SubdomainErrorKind.tooShort => _lang.subdomainTooShort,
    _SubdomainErrorKind.invalidCharacters => _lang.subdomainInvalidCharacters,
    _SubdomainErrorKind.taken =>
      '${_lang.subdomainTaken}\n${_lang.subdomainChooseAnother}',
    _SubdomainErrorKind.checkFailed => _lang.subdomainCheckFailed,
    null => '',
  };

  Future<void> _createStore() async {
    if (_nameController.text.isEmpty ||
        _subdomainController.text.isEmpty ||
        !_isSubdomainAvailable) {
      return;
    }

    setState(() => _isLoading = true);

    try {
      final storeService = context.read<StoreService>();
      final request = _storeCreationRequest();
      final idempotencyKey = await _storeCreationIdempotencyKey(request);

      final store = _createdDraft ??= await storeService.createStore(
        name: request['name'] as String,
        tagline: request['tagline'] as String,
        subdomain: request['subdomain'] as String,
        idempotencyKey: idempotencyKey,
        themeId: request['theme_id'] as String,
        templateConfig: request['template_config'] as Map<String, dynamic>,
      );

      final publishedStore = await storeService.publishStore(store.id);
      await context.read<StoreContext>().adoptCreatedStore(publishedStore);
      await _clearStoreCreationIdempotencyKey();

      if (!mounted) return;

      Navigator.pushReplacementNamed(
        context,
        AppRoutes.storePublished,
        arguments: {
          'storeId': store.id,
          'storeName': store.name,
          'subdomain': store.subdomain,
        },
      );
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Show loading while initializing
    if (!_isInitialized) {
      final themeProvider = context.watch<ThemeProvider>();
      final isDark = themeProvider.isDarkMode(context);
      final colors = AppThemeColors.of(context);
      return Container(
        decoration: colors.backgroundGradient,
        child: Center(
          child: CircularProgressIndicator(
            color: isDark
                ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                : colors.accent,
          ),
        ),
      );
    }

    // Wrap with PopScope to intercept Android back button
    return PopScope(
      canPop: false, // Prevent default back navigation
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        // Call our custom back handler
        _previousStep();
      },
      child: Scaffold(
        bottomNavigationBar: _currentStep == 1
            ? SafeArea(
                child: TextButton(
                  onPressed: () => Navigator.pushNamed(
                    context,
                    AppRoutes.acceptStaffInvitation,
                  ),
                  child: const Text('Join a store with a staff invitation'),
                ),
              )
            : null,
        body: PageView(
          controller: _pageController,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            _buildStep1BusinessType(),
            _buildStep2SalesChannels(),
            _buildStep3ProductType(),
            _buildStep4Category(),
            _buildStep5StoreName(),
            _buildStep6Subdomain(),
            _buildStep7Theme(),
          ],
        ),
      ),
    );
  }

  // ============================================
  // STEP 1: Business Type
  // ============================================
  Widget _buildStep1BusinessType() {
    return WizardContainer(
      currentStep: 1,
      totalSteps: _totalSteps,
      showBack: true,
      onBack: _showLogoutConfirmation,
      backIcon: Icons.logout_rounded, // Logout icon on Step 1
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _lang.wizardSetupStore,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: _textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _lang.wizardNewOrExisting,
            style: TextStyle(fontSize: 14, color: _textSecondary),
          ),
          const SizedBox(height: 20),

          WizardOptionCard(
            icon: Icons.rocket_launch_rounded,
            title: _lang.wizardNewBusiness,
            subtitle: _lang.wizardJustStarting,
            isSelected: _businessType == 'new',
            onTap: () {
              setState(() => _businessType = 'new');
              Future.delayed(const Duration(milliseconds: 200), _nextStep);
            },
          ),
          const SizedBox(height: 10),
          WizardOptionCard(
            icon: Icons.business_rounded,
            title: _lang.wizardExistingBusiness,
            subtitle: _lang.wizardAlreadyHaveBusiness,
            isSelected: _businessType == 'existing',
            onTap: () {
              setState(() => _businessType = 'existing');
              Future.delayed(const Duration(milliseconds: 200), _nextStep);
            },
          ),
        ],
      ),
    );
  }

  // ============================================
  // STEP 2: Sales Channels
  // ============================================
  Widget _buildStep2SalesChannels() {
    final channels = [
      {
        'id': 'online',
        'title': _lang.onlineStore,
        'icon': Icons.public_rounded,
      },
      {
        'id': 'retail',
        'title': _lang.retailStore,
        'icon': Icons.point_of_sale_rounded,
      },
      {
        'id': 'social',
        'title': _lang.socialMedia,
        'icon': Icons.chat_bubble_rounded,
      },
      {
        'id': 'marketplace',
        'title': _lang.marketplaces,
        'icon': Icons.grid_view_rounded,
      },
      {
        'id': 'events',
        'title': _lang.eventsPopups,
        'icon': Icons.location_on_rounded,
      },
    ];

    return WizardContainer(
      currentStep: 2,
      totalSteps: _totalSteps,
      onBack: _previousStep,
      onSkip: _nextStep,
      skipText: _lang.skipStep,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _lang.wizardWhereToSell,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: _textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _lang.wizardWhereToSellSubtitle,
            style: TextStyle(fontSize: 14, color: _textSecondary),
          ),
          const SizedBox(height: 20),

          ...channels.map(
            (channel) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: WizardOptionCard(
                icon: channel['icon'] as IconData,
                title: channel['title'] as String,
                isSelected: _selectedChannels.contains(channel['id']),
                onTap: () {
                  setState(() {
                    if (_selectedChannels.contains(channel['id'])) {
                      _selectedChannels.remove(channel['id']);
                    } else {
                      _selectedChannels.add(channel['id'] as String);
                    }
                  });
                },
              ),
            ),
          ),

          const SizedBox(height: 16),
          WizardPrimaryButton(
            text: _lang.next,
            onPressed: _selectedChannels.isNotEmpty ? _nextStep : null,
          ),
        ],
      ),
    );
  }

  // ============================================
  // STEP 3: Product Type
  // ============================================
  Widget _buildStep3ProductType() {
    final productTypes = [
      {
        'id': 'physical',
        'title': _lang.physicalProducts,
        'subtitle': _lang.physicalProductsSubtitle,
        'icon': Icons.inventory_2_rounded,
      },
      {
        'id': 'digital',
        'title': _lang.digitalProducts,
        'subtitle': _lang.digitalProductsSubtitle,
        'icon': Icons.cloud_download_rounded,
      },
      {
        'id': 'dropship',
        'title': _lang.dropshipping,
        'subtitle': _lang.dropshippingSubtitle,
        'icon': Icons.local_shipping_rounded,
      },
      {
        'id': 'services',
        'title': _lang.services,
        'subtitle': _lang.servicesSubtitle,
        'icon': Icons.build_circle_rounded,
      },
      {
        'id': 'pod',
        'title': _lang.printOnDemand,
        'subtitle': _lang.printOnDemandSubtitle,
        'icon': Icons.print_rounded,
      },
      {
        'id': 'later',
        'title': _lang.decideLater,
        'subtitle': _lang.decideLaterSubtitle,
        'icon': Icons.schedule_rounded,
      },
    ];

    return WizardContainer(
      currentStep: 3,
      totalSteps: _totalSteps,
      onBack: _previousStep,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _lang.wizardWhatToSell,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: _textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _lang.wizardWhatToSellSubtitle,
            style: TextStyle(fontSize: 14, color: _textSecondary),
          ),
          const SizedBox(height: 20),

          ...productTypes.map(
            (type) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: WizardOptionCard(
                icon: type['icon'] as IconData,
                title: type['title'] as String,
                subtitle: type['subtitle'] as String?,
                isSelected: _productType == type['id'],
                onTap: () {
                  setState(() => _productType = type['id'] as String);
                  Future.delayed(const Duration(milliseconds: 200), _nextStep);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ============================================
  // STEP 4: Store Category
  // ============================================
  Widget _buildStep4Category() {
    final categories = [
      {
        'id': 'fashion',
        'title': _lang.fashionApparel,
        'icon': Icons.checkroom_rounded,
      },
      {
        'id': 'electronics',
        'title': _lang.electronics,
        'icon': Icons.devices_rounded,
      },
      {
        'id': 'beauty',
        'title': _lang.beautyCosmetics,
        'icon': Icons.spa_rounded,
      },
      {'id': 'home', 'title': _lang.homeDecor, 'icon': Icons.home_rounded},
      {
        'id': 'food',
        'title': _lang.foodBeverages,
        'icon': Icons.restaurant_rounded,
      },
      {
        'id': 'sports',
        'title': _lang.sportsFitness,
        'icon': Icons.fitness_center_rounded,
      },
      {
        'id': 'books',
        'title': _lang.booksStationery,
        'icon': Icons.menu_book_rounded,
      },
      {'id': 'other', 'title': _lang.other, 'icon': Icons.category_rounded},
    ];

    return WizardContainer(
      currentStep: 4,
      totalSteps: _totalSteps,
      onBack: _previousStep,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _lang.wizardCategory,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: _textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _lang.wizardCategorySubtitle,
            style: TextStyle(fontSize: 14, color: _textSecondary),
          ),
          const SizedBox(height: 20),

          // 2-column grid layout
          for (int i = 0; i < categories.length; i += 2) ...[
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _buildCompactCategoryChip(
                      id: categories[i]['id'] as String,
                      title: categories[i]['title'] as String,
                      icon: categories[i]['icon'] as IconData,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: i + 1 < categories.length
                        ? _buildCompactCategoryChip(
                            id: categories[i + 1]['id'] as String,
                            title: categories[i + 1]['title'] as String,
                            icon: categories[i + 1]['icon'] as IconData,
                          )
                        : const SizedBox(),
                  ),
                ],
              ),
            ),
            if (i + 2 < categories.length) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }

  // Compact chip for 2-column category grid
  Widget _buildCompactCategoryChip({
    required String id,
    required String title,
    required IconData icon,
  }) {
    final isSelected = _category == id;
    void selectCategory() {
      HapticFeedback.lightImpact();
      setState(() => _category = id);
      Future.delayed(const Duration(milliseconds: 200), _nextStep);
    }

    return Semantics(
      key: ValueKey('wizard-category-$id'),
      container: true,
      excludeSemantics: true,
      button: true,
      enabled: true,
      selected: isSelected,
      label: title,
      onTap: selectCategory,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: selectCategory,
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            decoration: BoxDecoration(
              color: isSelected
                  ? (_isDark
                        ? Colors.white.withValues(alpha: 0.1)
                        : mobile_tokens.LetbuyyColorTokens.brandPrimary
                              .withValues(alpha: 0.1))
                  : (_isDark
                        ? Colors.white.withValues(alpha: 0.04)
                        : Colors.grey.withValues(alpha: 0.05)),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isSelected
                    ? LetbuyyColorTokens.brandPrimary
                    : (_isDark
                          ? Colors.white.withValues(alpha: 0.08)
                          : Colors.grey.withValues(alpha: 0.2)),
                width: isSelected ? 1.5 : 1,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Smaller Icon
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: isSelected
                          ? [
                              LetbuyyColorTokens.brandPrimary,
                              LetbuyyColorTokens.accentPink,
                            ]
                          : (_isDark
                                ? [
                                    Colors.white.withValues(alpha: 0.12),
                                    Colors.white.withValues(alpha: 0.06),
                                  ]
                                : [
                                    Colors.grey.withValues(alpha: 0.12),
                                    Colors.grey.withValues(alpha: 0.06),
                                  ]),
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    icon,
                    size: 14,
                    color: isSelected ? Colors.white : _textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                // Smaller Title
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: _textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildWizardBackAction(String key) {
    return Semantics(
      key: ValueKey(key),
      container: true,
      excludeSemantics: true,
      button: true,
      enabled: true,
      label: _lang.back,
      onTap: _previousStep,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: _previousStep,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            child: Ink(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Center(
                child: Text(
                  _lang.back,
                  style: TextStyle(color: _textSecondary),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ============================================
  // STEP 5: Store Name
  // ============================================
  Widget _buildStoreNameFeedback({
    required String key,
    required String message,
    required Color color,
    required IconData icon,
  }) {
    return Semantics(
      key: ValueKey(key),
      container: true,
      excludeSemantics: true,
      liveRegion: true,
      label: message,
      child: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Row(
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                message,
                style: TextStyle(color: color, fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep5StoreName() {
    return WizardContainer(
      currentStep: _currentStep,
      totalSteps: _totalSteps,
      onBack: _previousStep,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _lang.wizardStoreName,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: _textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _lang.wizardStoreNameSubtitle,
            style: TextStyle(fontSize: 14, color: _textSecondary),
          ),
          const SizedBox(height: 20),

          // Animated text input container with focus tracking
          Focus(
            onFocusChange: (hasFocus) => setState(() {}),
            child: Builder(
              builder: (context) {
                final hasFocus = Focus.of(context).hasFocus;
                final text = _nameController.text.trim();
                final isValid = text.length >= 4;
                final showError = text.isNotEmpty && !isValid;

                return Container(
                  decoration: BoxDecoration(
                    color: _inputBg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: showError
                          ? LetbuyyColorTokens.error
                          : (isValid
                                ? LetbuyyColorTokens.successStrong
                                : (hasFocus
                                      ? LetbuyyColorTokens.brandPrimary
                                      : _borderColor)),
                      width: hasFocus || text.isNotEmpty ? 1.5 : 1,
                    ),
                  ),
                  child: TextField(
                    controller: _nameController,
                    focusNode: _nameFocusNode,
                    cursorColor: LetbuyyColorTokens.brandPrimary,
                    style: TextStyle(
                      color: _textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                    decoration: InputDecoration(
                      hintText: _lang.wizardEnterStoreName,
                      hintStyle: TextStyle(color: _textSecondary, fontSize: 16),
                      filled: true,
                      fillColor: Colors.transparent,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                    ),
                    onChanged: (value) => setState(() {}),
                  ),
                );
              },
            ),
          ),

          // Validation helper text
          if (_nameController.text.isNotEmpty &&
              _nameController.text.trim().length < 4)
            _buildStoreNameFeedback(
              key: 'wizard-store-name-too-short',
              message: _lang.wizardStoreNameTooShort,
              color: LetbuyyColorTokens.error,
              icon: Icons.info_outline_rounded,
            )
          else if (_nameController.text.trim().length >= 4)
            _buildStoreNameFeedback(
              key: 'wizard-store-name-meets-minimum',
              message: _lang.wizardStoreNameMeetsMinimum,
              color: LetbuyyColorTokens.successStrong,
              icon: Icons.check_circle_rounded,
            ),

          const SizedBox(height: 20),

          Row(
            children: [
              _buildWizardBackAction('wizard-store-name-back'),
              const Spacer(),
              SizedBox(
                width: 120,
                child: WizardPrimaryButton(
                  text: _lang.next,
                  onPressed: _nameController.text.trim().length >= 4
                      ? _nextStep
                      : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ============================================
  // STEP 6: Subdomain
  // ============================================
  Widget _buildStep6Subdomain() {
    return WizardContainer(
      currentStep: _currentStep,
      totalSteps: _totalSteps,
      onBack: _previousStep,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _lang.wizardSubdomain,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: _textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _lang.wizardSubdomainSubtitle,
            style: TextStyle(fontSize: 14, color: _textSecondary),
          ),
          const SizedBox(height: 20),

          // Clean subdomain input
          Focus(
            onFocusChange: (hasFocus) => setState(() {}),
            child: Builder(
              builder: (context) {
                final hasFocus = Focus.of(context).hasFocus;
                return Container(
                  decoration: BoxDecoration(
                    color: _inputBg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _isSubdomainAvailable
                          ? LetbuyyColorTokens.successStrong
                          : (_subdomainError != null
                                ? LetbuyyColorTokens.error
                                : (hasFocus
                                      ? LetbuyyColorTokens.brandPrimary
                                      : _borderColor)),
                      width: hasFocus || _isSubdomainAvailable ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      // Input
                      Expanded(
                        child: TextField(
                          controller: _subdomainController,
                          focusNode: _subdomainFocusNode,
                          cursorColor: LetbuyyColorTokens.brandPrimary,
                          style: TextStyle(
                            color: _textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                          decoration: InputDecoration(
                            hintText: 'yourstore',
                            hintStyle: TextStyle(
                              color: _textSecondary,
                              fontSize: 16,
                            ),
                            filled: true,
                            fillColor: Colors.transparent,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 14,
                            ),
                          ),
                          onChanged: (value) => _checkSubdomainAvailability(
                            value.toLowerCase().trim(),
                          ),
                        ),
                      ),
                      // Simple suffix
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 14,
                        ),
                        decoration: BoxDecoration(
                          color: _isDark
                              ? Colors.white.withValues(alpha: 0.05)
                              : Colors.grey.withValues(alpha: 0.08),
                          borderRadius: const BorderRadius.horizontal(
                            right: Radius.circular(13),
                          ),
                        ),
                        child: Text(
                          '.${StoreModel.storefrontRootDomain}',
                          style: TextStyle(
                            color: LetbuyyColorTokens.brandPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          // Status indicator
          if (_isCheckingSubdomain)
            Semantics(
              key: const ValueKey('wizard-subdomain-status-checking'),
              container: true,
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Row(
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          LetbuyyColorTokens.brandPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _lang.checkingAvailability,
                      style: TextStyle(color: _textSecondary),
                    ),
                  ],
                ),
              ),
            )
          else if (_isSubdomainAvailable &&
              _subdomainController.text.length >= 3)
            Semantics(
              key: const ValueKey('wizard-subdomain-status-available'),
              container: true,
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: LetbuyyColorTokens.successStrong.withValues(
                      alpha: 0.15,
                    ),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: LetbuyyColorTokens.successStrong.withValues(
                        alpha: 0.3,
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.check_circle_rounded,
                        color: LetbuyyColorTokens.successStrong,
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          '${_lang.subdomainAvailable}\n${StoreModel.generateStoreUrl(_subdomainController.text)}',
                          style: TextStyle(
                            color: LetbuyyColorTokens.successStrong,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else if (_subdomainError != null &&
              _subdomainController.text.isNotEmpty)
            Semantics(
              key: ValueKey('wizard-subdomain-status-${_subdomainError!.name}'),
              container: true,
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: LetbuyyColorTokens.error.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: LetbuyyColorTokens.error.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.error_rounded,
                        color: LetbuyyColorTokens.error,
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _subdomainErrorMessage(),
                          style: TextStyle(
                            color: LetbuyyColorTokens.error,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          const SizedBox(height: 24),

          Row(
            children: [
              _buildWizardBackAction('wizard-subdomain-back'),
              const Spacer(),
              SizedBox(
                width: 120,
                child: WizardPrimaryButton(
                  text: _lang.next,
                  onPressed: _isSubdomainAvailable ? _nextStep : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ============================================
  // STEP 7: Theme Selection - Enhanced Grid
  // ============================================
  Widget _buildStep7Theme() {
    // Show only 6 popular themes for compact view
    final allThemes = StoreThemeModel.defaultThemes;
    final themes = [
      allThemes[1], // Vibrant Bold (Recommended)
      allThemes[0], // Minimal Modern
      allThemes[3], // Tech Elite
      allThemes[7], // Midnight Purple
      allThemes[4], // Luxury Premium
      allThemes[8], // Fresh Mint
    ];

    return WizardContainer(
      currentStep: _currentStep,
      totalSteps: _totalSteps,
      onBack: _previousStep,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _lang.wizardTheme,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: _textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _lang.wizardThemeSubtitle,
            style: TextStyle(fontSize: 13, color: _textSecondary),
          ),
          const SizedBox(height: 16),

          // 2-column grid of theme cards (same as before but 6 themes)
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.4,
            ),
            itemCount: themes.length,
            itemBuilder: (context, index) {
              final theme = themes[index];
              final isRecommended = theme.id == 'vibrant_bold';
              return _buildEnhancedThemeCard(
                theme,
                isRecommended: isRecommended,
              );
            },
          ),

          const SizedBox(height: 16),

          WizardPrimaryButton(
            text: _createdDraft == null
                ? _lang.createStore
                : _lang.retryPublishStore,
            isLoading: _isLoading,
            onPressed: _createStore,
          ),
        ],
      ),
    );
  }

  Widget _buildCompactThemeCard(StoreThemeModel theme, bool isRecommended) {
    final isSelected = _selectedThemeId == theme.id;
    final primary = theme.primaryColorValue;
    final secondary = theme.secondaryColorValue;
    final accent = theme.accentColorValue;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _selectedThemeId = theme.id);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 80,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: isSelected
              ? Border.all(color: LetbuyyColorTokens.brandPrimary, width: 2)
              : Border.all(color: _borderColor, width: 1),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: primary.withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(11),
          child: Stack(
            children: [
              // Gradient background
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [primary, secondary, accent],
                    stops: const [0.0, 0.5, 1.0],
                  ),
                ),
              ),

              // Glass effect overlay
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.white.withValues(alpha: 0.1),
                        Colors.transparent,
                        Colors.black.withValues(alpha: 0.4),
                      ],
                    ),
                  ),
                ),
              ),

              // Recommended badge
              if (isRecommended)
                Positioned(
                  top: 4,
                  left: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 5,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.2),
                          blurRadius: 4,
                        ),
                      ],
                    ),
                    child: const Text(
                      '★',
                      style: TextStyle(
                        color: Color(0xFFFF6B6B),
                        fontSize: 8,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),

              // Theme name at bottom
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Colors.black.withValues(alpha: 0.7),
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          theme.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 9,
                            shadows: [
                              Shadow(color: Colors.black54, blurRadius: 4),
                            ],
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (isSelected)
                        Container(
                          width: 14,
                          height: 14,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.check_rounded,
                            size: 10,
                            color: Colors.black,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEnhancedThemeCard(
    StoreThemeModel theme, {
    bool isRecommended = false,
  }) {
    final isSelected = _selectedThemeId == theme.id;
    final primary = theme.primaryColorValue;
    final secondary = theme.secondaryColorValue;
    final accent = theme.accentColorValue;

    void selectTheme() {
      HapticFeedback.lightImpact();
      setState(() => _selectedThemeId = theme.id);
    }

    return Semantics(
      key: ValueKey('wizard-theme-${theme.id}'),
      label: theme.name,
      button: true,
      enabled: true,
      selected: isSelected,
      onTap: selectTheme,
      child: InkWell(
        onTap: selectTheme,
        child: ExcludeSemantics(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: isSelected
                  ? Border.all(
                      color: LetbuyyColorTokens.brandPrimary,
                      width: 2.5,
                    )
                  : Border.all(color: _borderColor, width: 1),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: primary.withValues(alpha: 0.4),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ]
                  : null,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: Stack(
                children: [
                  // Gradient background
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [primary, secondary, accent],
                        stops: const [0.0, 0.5, 1.0],
                      ),
                    ),
                  ),

                  // Glass effect overlay
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.white.withValues(alpha: 0.15),
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.3),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Recommended badge
                  if (isRecommended)
                    Positioned(
                      top: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.2),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star_rounded, size: 10, color: primary),
                            const SizedBox(width: 2),
                            Text(
                              'Recommended',
                              style: TextStyle(
                                color: primary,
                                fontSize: 8,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                  // Theme name and selection indicator
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.6),
                          ],
                        ),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              theme.name,
                              style: TextStyle(
                                color: _textPrimary,
                                fontWeight: isSelected
                                    ? FontWeight.bold
                                    : FontWeight.w600,
                                fontSize: 12,
                                shadows: [
                                  const Shadow(
                                    color: Colors.black54,
                                    blurRadius: 4,
                                  ),
                                ],
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isSelected)
                            Container(
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                color: _textPrimary,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.3),
                                    blurRadius: 4,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.check_rounded,
                                size: 14,
                                color: Colors.black,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),

                  // Color palette preview dots
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Row(
                      children: [
                        _buildColorDot(primary),
                        const SizedBox(width: 4),
                        _buildColorDot(secondary),
                        const SizedBox(width: 4),
                        _buildColorDot(accent),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildColorDot(Color color) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(
          color: _isDark
              ? Colors.white.withValues(alpha: 0.5)
              : Colors.black.withValues(alpha: 0.15),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 2),
        ],
      ),
    );
  }

  Widget _buildThemePreviewCard(StoreThemeModel theme) {
    final isSelected = _selectedThemeId == theme.id;
    final primary = theme.primaryColorValue;
    final secondary = theme.secondaryColorValue;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _selectedThemeId = theme.id);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 100,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [primary, secondary],
          ),
          borderRadius: BorderRadius.circular(12),
          border: isSelected
              ? Border.all(color: LetbuyyColorTokens.brandPrimary, width: 2.5)
              : Border.all(color: _borderColor, width: 1),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: primary.withValues(alpha: 0.4),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              theme.name,
              style: TextStyle(
                color: _textPrimary,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 11,
                shadows: [const Shadow(color: Colors.black54, blurRadius: 4)],
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            if (isSelected)
              Container(
                margin: const EdgeInsets.only(top: 4),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: _textPrimary,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Icon(Icons.check, size: 10, color: Colors.black),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildThemeCard({
    required String id,
    required String name,
    required Color color,
  }) {
    final isSelected = _selectedThemeId == id;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _selectedThemeId = id);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? color.withValues(alpha: 0.08)
              : LetbuyyColorTokens.slate50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? color : LetbuyyColorTokens.slate200,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                name,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: _textPrimary,
                ),
              ),
            ),
            if (isSelected)
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                child: const Icon(Icons.check, size: 16, color: Colors.white),
              ),
          ],
        ),
      ),
    );
  }
}
