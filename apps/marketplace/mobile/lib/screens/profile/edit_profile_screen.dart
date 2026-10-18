// lib/screens/user/profile/edit_profile_screen.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import '../../auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/widgets/premium_scaffold.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen>
    with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late AnimationController _avatarController;
  late Animation<double> _avatarScale;

  bool _isLoading = false;
  bool _loadingAccount = true;
  String? _loadError;
  String? _activeToken;
  int _sessionGeneration = 0;
  late final BuyerSignInController _signIn;
  // Phase 1R corrective (C2): profile photo editing removed. It was entirely Firebase Storage-
  // backed (FirebaseStorage.instance) with no canonical successor -- BuyerAccountApi.updateProfile
  // only carries fullName/phone. Worse than just disconnected: _saveProfile() uploaded a picked
  // photo FIRST and aborted the whole save (including name/phone) if that failed, which it always
  // would have, silently blocking real profile edits. Avatar still displays (falls back to the
  // default icon, since there's never a photo URL now); there's just no way to change it.

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
      duration: const Duration(milliseconds: 600), // Matched profile
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOut),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.1), // Matched profile
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutCubic),
    );

    _avatarController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000), // Slightly faster
    );

    _avatarScale = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(
        parent: _avatarController,
        curve: Curves.elasticOut,
      ),
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

    _signIn = context.read<BuyerSignInController>();
    _signIn.addListener(_onSessionChanged);
    _onSessionChanged();
    _animationController.forward();
    Future.delayed(const Duration(milliseconds: 200), () {
      if (mounted) _avatarController.forward();
    });
  }

  bool _current(String token, int generation) => mounted &&
      _signIn.token == token && _activeToken == token && _sessionGeneration == generation;

  void _onSessionChanged() {
    final token = _signIn.token;
    if (!mounted || token == _activeToken) return;
    _sessionGeneration++;
    _toastTimer?.cancel();
    setState(() {
      _activeToken = token;
      _nameController.clear();
      _phoneController.clear();
      _isLoading = false;
      _loadingAccount = token != null;
      _loadError = null;
      _showToast = false;
    });
    if (token != null) _loadUserData();
  }

  // Phase 1R corrective (C2): was Provider.of<AuthProvider>(...).currentUser -- AuthProvider is
  // entirely FirebaseAuth-backed, and canonical "Sign in with LetBuyy" never touches FirebaseAuth,
  // so this always found no user and left the form blank, even for a signed-in canonical buyer
  // (this screen is only reachable from profile_screen.dart's signed-in-only menu). Fetches from
  // the canonical BuyerAccountApi instead.
  Future<void> _loadUserData() async {
    final token = _signIn.token;
    if (token == null) return;
    final generation = _sessionGeneration;
    setState(() { _loadingAccount = true; _loadError = null; });

    try {
      final account = await context.read<BuyerAccountApi>().account(token);
      if (!_current(token, generation)) return;
      setState(() {
        _nameController.text = account.fullName ?? '';
        _phoneController.text = account.phone ?? '';
        _loadingAccount = false;
      });
    } catch (_) {
      if (!_current(token, generation)) return;
      setState(() { _loadingAccount = false; _loadError = 'We couldn’t load your profile. Please try again.'; });
    }
  }

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

  @override
  void dispose() {
    _signIn.removeListener(_onSessionChanged);
    _nameController.dispose();
    _phoneController.dispose();
    _animationController.dispose();
    _avatarController.dispose();
    _toastAnimationController.dispose();
    _toastTimer?.cancel();
    super.dispose();
  }

  String? _validateName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Please enter your name';
    }
    if (value.trim().length < 3) {
      return 'Name must be at least 3 characters';
    }
    if (value.trim().length > 200) return 'Name must be 200 characters or fewer';
    return null;
  }

  String? _validatePhone(String? value) {
    // The canonical profile accepts an optional, unverified phone (max32),
    // not a required phone identity or an invented verification rule.
    if (value != null && value.trim().length > 32) return 'Phone must be 32 characters or fewer';
    return null;
  }

  Future<void> _saveProfile() async {
    if (_isLoading || _loadingAccount || _loadError != null) return;
    if (!_formKey.currentState!.validate()) {
      _showToastMessage('⚠️ Please fix the errors in the form', isSuccess: false);
      return;
    }

    setState(() => _isLoading = true);
    HapticFeedback.mediumImpact();

    // Phase 1R corrective (C2): was Provider.of<AuthProvider>(...).updateUserProfile(...),
    // preceded by a Firebase Storage photo upload that aborted this whole save if it failed
    // (which it always would have). Calls the canonical BuyerAccountApi directly; no photo field
    // to carry (see the field-removal note above).
    final token = _signIn.token;
    final generation = _sessionGeneration;
    if (token == null) {
      _showToastMessage('❌ Your session has ended. Please sign in again.', isSuccess: false);
      setState(() => _isLoading = false);
      return;
    }

    try {
      await context.read<BuyerAccountApi>().updateProfile(
            token,
            fullName: _nameController.text.trim(),
            phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
          );

      if (!_current(token, generation)) return;

      _showToastMessage('✅ Profile updated successfully!');
      Future.delayed(const Duration(milliseconds: 800), () {
        if (_current(token, generation)) {
          Navigator.pop(context);
        }
      });
    } catch (_) {
      if (_current(token, generation)) {
        _showToastMessage('We couldn’t save your profile. Please try again.', isSuccess: false);
        setState(() => _isLoading = false);
      }
    }
  }

  Widget _buildDefaultAvatar(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient( // ✅ Fixed
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [AppColors.primaryDark, AppColors.primaryDarker]
              : [AppColors.primary, AppColors.primaryLight],
        ),
      ),
      child: const Center(
        child: Icon(
          Icons.person_rounded,
          size: 60,
          color: AppColors.white, // ✅ Fixed
        ),
      ),
    );
  }

  // --- New Widgets matching Profile Screen ---

  Widget _buildCompactHeader(bool isDark) {
    final double topPadding = MediaQuery.of(context).padding.top;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 16 + topPadding, 16, 16),
      decoration: BoxDecoration(
        gradient: isDark ? AppColors.primaryGradientDark : AppColors.primaryGradient, // ✅ Fixed
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
                  if (!_isLoading) {
                    HapticFeedback.lightImpact();
                    Navigator.pop(context);
                  }
                },
                borderRadius: BorderRadius.circular(10),
                child: const Padding(
                  padding: EdgeInsets.all(10),
                  child: Icon(Icons.arrow_back_rounded, color: AppColors.white, size: 20), // ✅ Fixed
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          const Expanded(
            child: Text(
              'Edit Profile',
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

  Widget _buildAvatarSection(bool isDark) {
    // Phase 1R corrective (C2): the "edit" overlay (opened the Firebase Storage photo picker)
    // is gone -- see the field-removal note above -- so this always shows the default avatar now.
    return ScaleTransition(
      scale: _avatarScale,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20),
          child: Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: (isDark ? AppColors.primaryLight : AppColors.primary).withValues(alpha: 0.5), // ✅ Fixed
                width: 2
              ),
              boxShadow: [
                BoxShadow(
                  color: isDark ? AppColors.shadowDark : AppColors.shadowLight, // ✅ Fixed
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: ClipOval(child: _buildDefaultAvatar(isDark)),
          ),
        ),
      ),
    );
  }

  Widget _buildTextFormCard({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
    required bool isDark,
  }) {
    final tileColor = isDark ? AppColors.primaryLight : AppColors.primary; // ✅ Fixed

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border, // ✅ Fixed
        ),
        boxShadow: [
          BoxShadow(
            color: isDark ? AppColors.shadowDark : AppColors.shadowLight, // ✅ Fixed
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: tileColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: tileColor, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: TextFormField(
                controller: controller,
                keyboardType: keyboardType,
                validator: validator,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: isDark ? AppColors.textLight : AppColors.textPrimary, // ✅ Fixed
                ),
                decoration: InputDecoration(
                  labelText: label,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, // ✅ Fixed
                    fontWeight: FontWeight.w500,
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 4),
                  errorStyle: const TextStyle(height: 0.1, fontSize: 10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- End New Widgets ---

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final token = context.watch<BuyerSignInController>().token;
    if (token == null || _loadingAccount || _loadError != null || token != _activeToken) {
      return Scaffold(
        appBar: const CustomAppBar(title: 'Edit Profile', isGlass: false),
        body: token == null
            ? const EmptyState(icon: Icons.lock_outline, title: 'Sign in to edit your profile', message: 'Use Sign in with LetBuyy on the Profile tab.')
            : _loadingAccount || token != _activeToken
                ? const Center(child: CircularProgressIndicator())
                : ErrorView(message: _loadError!, onRetry: _loadUserData),
      );
    }

    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      body: Stack(
        children: [
          CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(child: _buildCompactHeader(isDark)),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 40),
                sliver: SliverList(
                  delegate: SliverChildListDelegate(
                    [
                      _buildAvatarSection(isDark),
                      const SizedBox(height: 24),
                      Form(
                        key: _formKey,
                        autovalidateMode: AutovalidateMode.onUserInteraction,
                        child: Column(
                          children: [
                            Text(
                              'Your Information',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: isDark
                                    ? AppColors.textLightSecondary
                                    : AppColors.textSecondary,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 10),
                            _buildTextFormCard(
                              controller: _nameController,
                              label: 'Full Name',
                              icon: Icons.person_outline_rounded,
                              validator: _validateName,
                              isDark: isDark,
                            ),
                            _buildTextFormCard(
                              controller: _phoneController,
                              label: 'Phone (optional, not verified)',
                              icon: Icons.phone_outlined,
                              keyboardType: TextInputType.phone,
                              validator: _validatePhone,
                              isDark: isDark,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 32),

                      // Save Button
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              (isDark
                                      ? AppColors.primaryLight
                                      : AppColors.primary)
                                  .withOpacity(_isLoading ? 0.7 : 1.0),
                              (isDark
                                      ? AppColors.primaryLight
                                      : AppColors.primary)
                                  .withOpacity(_isLoading ? 0.5 : 0.8),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: (isDark
                                      ? AppColors.primaryLight
                                      : AppColors.primary)
                                  .withValues(alpha: 0.25),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: _isLoading ? null : _saveProfile,
                                  borderRadius: BorderRadius.circular(14),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        if (_isLoading)
                                          const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white) // ✅ Fixed
                                          )
                                        else
                                          const Icon(Icons.check_circle_outline_rounded, color: AppColors.white, size: 18), // ✅ Fixed

                                        const SizedBox(width: 10),

                                        Text(
                                          _isLoading ? 'Saving...' : 'Save Changes',
                                          style: const TextStyle(
                                            color: AppColors.white, // ✅ Fixed
                                            fontSize: 15,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 24),
                          ],
                        ),
                      ),
                    ),

                ],
              ),

          // Enhanced Toast (from Profile Screen)
          if (_showToast)
            SafeArea(
              bottom: false,
              child: SlideTransition(
                position: _toastSlideAnimation,
                child: FadeTransition(
                  opacity: _toastFadeAnimation,
                  child: ScaleTransition(
                    scale: _toastScaleAnimation,
                    child: Container(
                      margin: const EdgeInsets.all(16),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [_toastColor, _toastColor.withValues(alpha: 0.9)],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: _toastColor.withValues(alpha: 0.4),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: AppColors.white.withValues(alpha: 0.2), // ✅ Fixed
                              shape: BoxShape.circle,
                            ),
                            child: Icon(_toastIcon, color: AppColors.white, size: 18), // ✅ Fixed
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _toastMessage,
                              style: const TextStyle(
                                color: AppColors.white, // ✅ Fixed
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
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
    );
  }
}
