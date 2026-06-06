import 'package:flutter/material.dart';
import 'package:letbuyy_store/theme/letbuyy_color_tokens.dart' as mobile_tokens;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../services/store_service.dart';
import '../../services/store_auth_service.dart';
import '../../services/subscription_service.dart';
import '../../services/theme_provider.dart';
import '../../models/store_model.dart';
import '../../app/routes.dart';
import '../parity/merchant_feature_definitions.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/settings/store_info_card.dart';
import '../../widgets/settings/settings_tile.dart';
import '../../widgets/shared/confirm_dialog.dart';
import '../main/store_main_screen.dart';

/// Settings Screen - Clean Simple Design
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  StoreModel? _store;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    setState(() => _isLoading = true);
    try {
      final storeService = context.read<StoreService>();
      final store = await storeService.getFirstStore();
      setState(() => _store = store);
    } catch (e) {
      debugPrint('Error loading store: $e');
    } finally {
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

    if (_isLoading) {
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

    final storeUrl = '${_store?.subdomain ?? 'your-store'}.letbuyy.store';

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
                        icon: Icons.bar_chart_outlined,
                        title: 'Analytics',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.analytics),
                      ),
                    ],
                  ),

                  _buildFeatureSection(
                    title: 'Commerce',
                    features: MerchantFeatureDefinitions.commerce,
                  ),

                  _buildFeatureSection(
                    title: 'Online Store',
                    features: MerchantFeatureDefinitions.onlineStore,
                  ),

                  _buildFeatureSection(
                    title: 'Apps',
                    features: MerchantFeatureDefinitions.apps,
                  ),

                  _buildFeatureSection(
                    title: 'Settings Hub',
                    features: MerchantFeatureDefinitions.settingsHub,
                  ),

                  _buildFeatureSection(
                    title: 'Forms & Analytics',
                    features: MerchantFeatureDefinitions.other,
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
                        icon: Icons.rocket_launch_outlined,
                        title: 'View All Plans',
                        subtitle: 'Compare features & upgrade',
                        iconColor:
                            mobile_tokens.LetbuyyColorTokens.brandPrimary,
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.pricing),
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
                        onTap: () {
                          // TODO: Open terms/privacy page
                        },
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
        ],
      ),
    );
  }

  Widget _buildFeatureSection({
    required String title,
    required List<MerchantFeatureDefinition> features,
  }) {
    return SettingsSection(
      title: title,
      children: features
          .map(
            (feature) => SettingsTile(
              icon: feature.icon,
              title: feature.title,
              iconColor: AppColors.primary,
              onTap: () => Navigator.pushNamed(context, feature.route),
            ),
          )
          .toList(growable: false),
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
    final plan = _store?.subscriptionPlan ?? SubscriptionPlan.trial;
    final planInfo = SubscriptionService.getPlanInfo(plan);
    final color = Color(planInfo['color'] as int);
    final isTrial = plan == SubscriptionPlan.trial;
    final daysLeft = _store?.daysLeftInTrial ?? 0;

    return SettingsTile(
      icon: Icons.diamond_outlined,
      iconColor: color,
      title: 'Current Plan',
      subtitle: isTrial && daysLeft > 0
          ? '${planInfo['name']} • $daysLeft days left'
          : planInfo['name'] as String,
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          planInfo['badge'] as String,
          style: TextStyle(color: color, fontSize: 14),
        ),
      ),
      showArrow: false,
    );
  }

  /// Build product usage tile
  Widget _buildProductUsageTile(AppThemeColors colors) {
    final limit = _store?.effectiveProductLimit ?? 50;
    final used = _store?.currentProductCount ?? 0;
    final percent = limit == -1 ? 0.0 : (used / limit * 100).clamp(0.0, 100.0);
    final isUnlimited = limit == -1;

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
      subtitle: isUnlimited
          ? '$used products (Unlimited)'
          : '$used / $limit products',
      trailing: SizedBox(
        width: 60,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              isUnlimited ? '∞' : '${percent.toInt()}%',
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
