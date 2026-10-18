import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import '../../services/store_service.dart';
import '../../services/store_auth_service.dart';
import '../../services/subscription_service.dart';
import '../../services/theme_provider.dart';
import '../../models/store_model.dart';
import '../../app/routes.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/settings/store_info_card.dart';
import '../../widgets/settings/settings_tile.dart';
import '../../widgets/shared/confirm_dialog.dart';
import '../../widgets/store/store_switcher_button.dart';
import '../main/store_main_screen.dart';

/// Settings Screen - Clean Simple Design
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  StoreModel? _store;
  MerchantBillingState? _billing;
  bool _isLoading = true;
  int _loadVersion = 0;
  int? _loadedEpoch;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    final version = ++_loadVersion;
    final storeContext = context.read<StoreContext>(),
        epoch = storeContext.requestContextVersion;
    setState(() {
      _isLoading = true;
      _billing = null;
      _store = null;
      _loadedEpoch = null;
      _loadError = null;
    });
    try {
      final store = await storeContext.ensureSelectedStore();
      MerchantBillingState? billing;
      if (store != null) {
        try {
          billing = await context.read<SubscriptionService>().fetchBillingState(
            store.id,
          );
        } catch (_) {}
      }
      if (!mounted || version != _loadVersion) return;
      if (epoch != storeContext.requestContextVersion ||
          storeContext.selectedStoreId != store?.id)
        throw StateError('Store changed');
      setState(() {
        _loadedEpoch = epoch;
        _store = store;
        _billing = billing;
      });
    } catch (e) {
      debugPrint('Error loading store: $e');
      if (mounted && version == _loadVersion)
        setState(() => _loadError = 'Store details could not load. Try again.');
    } finally {
      if (mounted && version == _loadVersion)
        setState(() => _isLoading = false);
    }
  }

  Future<void> _logout() async {
    final confirm = await ConfirmDialog.show(
      context,
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmLabel: 'Logout',
      isDestructive: true,
    );

    if (confirm == true && mounted) {
      final authService = context.read<StoreAuthService>();
      await authService.signOut();
      if (mounted) {
        Navigator.pushNamedAndRemoveUntil(
          context,
          AppRoutes.login,
          (route) => false,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final themeProvider = context.watch<ThemeProvider>();
    final storeContext = context.watch<StoreContext>();
    if (_loadError != null)
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_loadError!),
                FilledButton(
                  onPressed: _loadStore,
                  child: const Text('Retry store details'),
                ),
              ],
            ),
          ),
        ),
      );
    final stale =
        _loadedEpoch != null &&
        (_loadedEpoch != storeContext.requestContextVersion ||
            _store?.id != storeContext.selectedStoreId);
    if (stale && !_isLoading)
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_isLoading) _loadStore();
      });

    if (_isLoading || stale) {
      return Scaffold(
        backgroundColor: colors.bgStart,
        body: Container(
          decoration: colors.backgroundGradient,
          child: Center(
            child: CircularProgressIndicator(color: AppColors.lavender),
          ),
        ),
      );
    }

    final storeUrl = '${_store?.subdomain ?? 'your-store'}.letbuyy.com';

    return Scaffold(
      backgroundColor: colors.card,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            _buildHeader(colors),

            // Content
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  // Store Profile Card
                  if (_store != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8, bottom: 4),
                      child: GestureDetector(
                        onTap: () => Navigator.pushNamed(
                          context,
                          AppRoutes.storeDetails,
                        ),
                        child: StoreInfoCard(
                          storeName: _store!.name,
                          storeUrl: 'https://$storeUrl',
                          logoUrl: _store!.logoUrl,
                          isPublished: _store!.isPublished,
                          onEdit: () => Navigator.pushNamed(
                            context,
                            AppRoutes.storeDetails,
                          ),
                        ),
                      ),
                    ),

                  // Appearance Section (NEW - Theme Toggle)
                  SettingsSection(
                    title: 'Appearance',
                    children: [
                      SettingsTile(
                        icon: themeProvider.themeMode == ThemeMode.dark
                            ? Icons.dark_mode_outlined
                            : themeProvider.themeMode == ThemeMode.light
                            ? Icons.light_mode_outlined
                            : Icons.brightness_auto_outlined,
                        title: 'Theme',
                        iconColor:
                            mobile_tokens.LetbuyyColorTokens.brandPrimary,
                        trailing: _buildThemeSelector(themeProvider, colors),
                        showArrow: false,
                      ),
                    ],
                  ),

                  SettingsSection(
                    title: 'Account security',
                    children: [
                      SettingsTile(
                        icon: Icons.security_outlined,
                        title: 'Authenticator',
                        subtitle:
                            'Two-factor authentication and recovery codes',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.twoFactor),
                      ),
                    ],
                  ),

                  // Store Settings Section
                  SettingsSection(
                    title: 'Store Settings',
                    children: [
                      SettingsTile(
                        icon: Icons.storefront_outlined,
                        title: 'Store Details',
                        onTap: () => Navigator.pushNamed(
                          context,
                          AppRoutes.storeDetails,
                        ),
                      ),
                      SettingsTile(
                        icon: Icons.loyalty_outlined,
                        title: 'Loyalty',
                        subtitle: 'Customer points and reward settings',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.loyalty),
                      ),
                      SettingsTile(
                        icon: Icons.group_outlined,
                        title: 'Users & Permissions',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.staff),
                      ),
                      SettingsTile(
                        icon: Icons.health_and_safety_outlined,
                        title: 'Store Health',
                        subtitle: 'Launch, catalog, orders, domain, reviews',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.storeHealth),
                      ),
                      SettingsTile(
                        icon: Icons.link_outlined,
                        title: 'Domain Settings',
                        onTap: () => Navigator.pushNamed(
                          context,
                          AppRoutes.domainSettings,
                        ),
                      ),
                      SettingsTile(
                        icon: Icons.search_outlined,
                        title: 'SEO Settings',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.seoSettings),
                      ),
                      SettingsTile(
                        icon: Icons.public_outlined,
                        title: 'Localization & Markets',
                        subtitle: 'Locales, currencies, markets, translations',
                        onTap: () => Navigator.pushNamed(
                          context,
                          AppRoutes.localizationMarkets,
                        ),
                      ),
                      SettingsTile(
                        icon: Icons.bar_chart_outlined,
                        title: 'Analytics',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.analytics),
                      ),
                    ],
                  ),

                  // Payment Options Section
                  SettingsSection(
                    title: 'Payment Options',
                    children: [
                      SettingsTile(
                        icon: Icons.local_shipping_outlined,
                        title: 'Cash on Delivery (COD)',
                        subtitle: _store?.codEnabled == true
                            ? 'Enabled'
                            : 'Disabled',
                        trailing: Switch(
                          value: _store?.codEnabled ?? true,
                          activeColor: AppColors.lavender,
                          onChanged: (value) async {
                            final storeService = context.read<StoreService>();
                            await storeService.updatePaymentSettings(
                              _store!.id,
                              {'cod_enabled': value},
                            );
                            await _loadStore();
                            HapticFeedback.lightImpact();
                          },
                        ),
                        showArrow: false,
                      ),
                      SettingsTile(
                        icon: Icons.credit_card_outlined,
                        title: 'Online Payment (Razorpay)',
                        subtitle: _store?.onlinePaymentEnabled == true
                            ? 'Enabled'
                            : 'Disabled',
                        trailing: Switch(
                          value: _store?.onlinePaymentEnabled ?? true,
                          activeColor: AppColors.lavender,
                          onChanged: (value) async {
                            final storeService = context.read<StoreService>();
                            await storeService.updatePaymentSettings(
                              _store!.id,
                              {'online_payment_enabled': value},
                            );
                            await _loadStore();
                            HapticFeedback.lightImpact();
                          },
                        ),
                        showArrow: false,
                      ),
                    ],
                  ),

                  // Plan Section
                  SettingsSection(
                    title: 'Plan & Billing',
                    children: [
                      _buildCurrentPlanTile(),
                      _buildProductUsageTile(colors),
                      SettingsTile(
                        icon: Icons.receipt_long_outlined,
                        title: 'Billing and invoices',
                        onTap: () async {
                          await Navigator.pushNamed(context, AppRoutes.billing);
                          if (mounted) await _loadStore();
                        },
                      ),
                      SettingsTile(
                        icon: Icons.rocket_launch_outlined,
                        title: 'View All Plans',
                        subtitle: 'Compare features & upgrade',
                        iconColor:
                            mobile_tokens.LetbuyyColorTokens.brandPrimary,
                        onTap: () async {
                          await Navigator.pushNamed(context, AppRoutes.pricing);
                          if (mounted) await _loadStore();
                        },
                      ),
                      if (_store?.subscriptionPlan ==
                          SubscriptionPlan.professional)
                        SettingsTile(
                          icon: Icons.account_balance_outlined,
                          title: 'Connect Your Razorpay',
                          subtitle: _store?.isUsingOwnRazorpay == true
                              ? 'Connected - 0% commission'
                              : 'Get 0% platform fee',
                          iconColor: const Color(0xFF2563EB),
                          onTap: () => Navigator.pushNamed(
                            context,
                            AppRoutes.connectRazorpay,
                          ),
                        ),
                    ],
                  ),

                  // Support Section
                  SettingsSection(
                    title: 'Support',
                    children: [
                      SettingsTile(
                        icon: Icons.help_outline_rounded,
                        title: 'Help & Support',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.help),
                      ),
                      SettingsTile(
                        icon: Icons.description_outlined,
                        title: 'Terms & Privacy',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.help),
                      ),
                    ],
                  ),

                  // Other Information
                  SettingsSection(
                    title: 'Other Information',
                    children: [
                      SettingsTile(
                        icon: Icons.info_outline_rounded,
                        title: 'App Version',
                        subtitle: '1.0.0',
                        showArrow: false,
                      ),
                      SettingsTile(
                        icon: Icons.logout_rounded,
                        title: 'Logout',
                        isDestructive: true,
                        showArrow: false,
                        onTap: _logout,
                      ),
                    ],
                  ),

                  const SizedBox(height: 50),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      child: Row(
        children: [
          // Back Button
          IconButton(
            icon: Icon(Icons.arrow_back, color: colors.textPrimary),
            onPressed: () => StoreMainScreen.navigateToHome(),
          ),
          const SizedBox(width: 8),

          // Title
          Text(
            'Settings',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              color: colors.textPrimary,
            ),
          ),
          const Spacer(),
          StoreSwitcherButton(onChanged: _loadStore),
        ],
      ),
    );
  }

  /// Build theme selector dropdown
  Widget _buildThemeSelector(ThemeProvider provider, AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: colors.glassMedium,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.glassMediumBorder),
      ),
      child: DropdownButton<ThemeMode>(
        value: provider.themeMode,
        underline: const SizedBox(),
        isDense: true,
        dropdownColor: colors.card,
        borderRadius: BorderRadius.circular(12),
        icon: Icon(
          Icons.keyboard_arrow_down_rounded,
          color: colors.textSecondary,
          size: 18,
        ),
        style: TextStyle(
          color: colors.textPrimary,
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
        items: [
          DropdownMenuItem(
            value: ThemeMode.system,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.brightness_auto_outlined,
                  size: 16,
                  color: colors.textSecondary,
                ),
                const SizedBox(width: 6),
                Text('System', style: TextStyle(color: colors.textPrimary)),
              ],
            ),
          ),
          DropdownMenuItem(
            value: ThemeMode.light,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.light_mode_outlined,
                  size: 16,
                  color: colors.textSecondary,
                ),
                const SizedBox(width: 6),
                Text('Light', style: TextStyle(color: colors.textPrimary)),
              ],
            ),
          ),
          DropdownMenuItem(
            value: ThemeMode.dark,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.dark_mode_outlined,
                  size: 16,
                  color: colors.textSecondary,
                ),
                const SizedBox(width: 6),
                Text('Dark', style: TextStyle(color: colors.textPrimary)),
              ],
            ),
          ),
        ],
        onChanged: (mode) {
          if (mode != null) {
            HapticFeedback.selectionClick();
            provider.setThemeMode(mode);
          }
        },
      ),
    );
  }

  /// Build current plan tile with subscription info
  Widget _buildCurrentPlanTile() {
    final color = AppThemeColors.of(context).accent;
    final billing = context.watch<StoreContext>().selectedStoreId == _store?.id
        ? _billing
        : null;
    return SettingsTile(
      icon: Icons.diamond_outlined,
      iconColor: color,
      title: 'Current Plan',
      subtitle: billing == null
          ? 'Billing unavailable'
          : '${billing.planName} • ${billing.status.replaceAll('_', ' ')}',
      showArrow: false,
    );
  }

  /// Build product usage tile
  Widget _buildProductUsageTile(AppThemeColors colors) {
    final billing = context.watch<StoreContext>().selectedStoreId == _store?.id
        ? _billing
        : null;
    final percent = (billing?.productUsageFraction ?? 0) * 100;
    final isUnlimited =
        billing?.productLimitKnown == true && billing?.productLimit == null;

    Color progressColor;
    if (isUnlimited) {
      progressColor = const Color(0xFF10B981);
    } else if (percent >= 90) {
      progressColor = const Color(0xFFEF4444);
    } else if (percent >= 75) {
      progressColor = const Color(0xFFF59E0B);
    } else {
      progressColor = const Color(0xFF10B981);
    }

    return SettingsTile(
      icon: Icons.inventory_2_outlined,
      title: 'Product Usage',
      subtitle: billing?.productUsageLabel ?? 'Product usage unavailable',
      trailing: SizedBox(
        width: 60,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              billing?.productUsageFraction == null
                  ? '—'
                  : isUnlimited
                  ? '∞'
                  : '${percent.toInt()}%',
              style: TextStyle(
                color: progressColor,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: LinearProgressIndicator(
                value: isUnlimited ? 0.1 : percent / 100,
                backgroundColor: colors.glassMedium,
                valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                minHeight: 3,
              ),
            ),
          ],
        ),
      ),
      showArrow: false,
    );
  }
}
