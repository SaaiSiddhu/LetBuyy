import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../services/api_client.dart';

import '../../app/store_context.dart';
import '../../config/app_config.dart';

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
import '../../widgets/settings/merchant_theme_selector.dart';
import '../../widgets/shared/merchant_product_usage.dart';
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
  PaymentConfigModel? _paymentConfig;
  bool _updatingPaymentMethods = false;
  String? _paymentMethodIntent;
  String? _paymentMethodRetryKey;
  bool _isLoading = true;
  int _loadVersion = 0;
  Object? _loadedKey;
  String? _loadError;
  StoreContext? _readOwner;
  Object? _requestedKey;
  bool _billingLoading = false, _paymentLoading = false;
  bool _reloadScheduled = false;

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  bool _staleSettings(StoreContext owner) =>
      _readOwner != null &&
      (!identical(_readOwner, owner) ||
          (_loadedKey ?? _requestedKey) != owner.requestContextKey ||
          (_store != null && _store!.id != owner.selectedStoreId));

  Future<void> _loadStore() async {
    if (!mounted) return;
    final version = ++_loadVersion;
    final owner = context.read<StoreContext>();
    final epoch = owner.requestContextVersion;
    final entryKey = owner.requestContextKey,
        entryStore = owner.selectedStoreId;
    bool owned() =>
        mounted &&
        version == _loadVersion &&
        identical(context.read<StoreContext>(), owner);
    bool current(Object key) => owned() && owner.requestContextKey == key;
    setState(() {
      _readOwner = owner;
      _requestedKey = entryKey;
      _isLoading = true;
      _billing = null;
      _paymentConfig = null;
      _store = null;
      _loadedKey = null;
      _loadError = null;
      _billingLoading = false;
      _paymentLoading = false;
    });
    Future<void> expire() async {
      if (!owned()) return;
      ++_loadVersion;
      final reset = owner.clearSelection();
      setState(() {
        _store = null;
        _billing = null;
        _paymentConfig = null;
        _loadedKey = null;
        _requestedKey = owner.requestContextKey;
        _loadError = 'Sign in again to load these settings.';
        _isLoading = false;
        _billingLoading = false;
        _paymentLoading = false;
      });
      await reset;
    }

    try {
      final store = await owner.ensureSelectedStore();
      if (!owned() ||
          epoch != owner.requestContextVersion ||
          owner.selectedStoreId != store?.id ||
          (entryStore != null && entryKey != owner.requestContextKey))
        return;
      final key = owner.requestContextKey;
      setState(() {
        _loadedKey = key;
        _requestedKey = key;
        _store = store;
        _isLoading = false;
        _billingLoading = store != null;
        _paymentLoading = store != null;
      });
      if (store == null) return;
      final service = context.read<SubscriptionService>();
      Future<void> billing() async {
        try {
          final value = await service.fetchBillingState(store.id);
          if (current(key)) setState(() => _billing = value);
        } catch (error) {
          if (current(key) && error is ApiException && error.statusCode == 401)
            await expire();
        } finally {
          if (current(key)) setState(() => _billingLoading = false);
        }
      }

      Future<void> payment() async {
        try {
          final value = await service.getPaymentConfigModel(store.id);
          if (current(key)) setState(() => _paymentConfig = value);
        } catch (error) {
          if (current(key) && error is ApiException && error.statusCode == 401)
            await expire();
        } finally {
          if (current(key)) setState(() => _paymentLoading = false);
        }
      }

      // Optional owner-only panels never block the current store's navigation.
      await Future.wait([billing(), payment()]);
    } catch (error) {
      if (!owned()) return;
      if (error is ApiException && error.statusCode == 401) {
        await expire();
      } else if (error is! ApiException ||
          error.code != 'SESSION_CONTEXT_CHANGED') {
        setState(() {
          _requestedKey = owner.requestContextKey;
          _loadError = 'Store details could not load. Try again.';
        });
      }
    } finally {
      if (mounted && version == _loadVersion) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _updatePaymentMethod(String field, bool enabled) async {
    final store = _store;
    final storeContext = context.read<StoreContext>();
    final key = storeContext.requestContextKey;
    if (store == null ||
        _paymentConfig == null ||
        _updatingPaymentMethods ||
        storeContext.selectedStoreId != store.id ||
        _loadedKey != key)
      return;
    setState(() => _updatingPaymentMethods = true);
    final intent =
        '$key:${store.id}:${_paymentConfig!.revision}:$field:$enabled';
    if (_paymentMethodIntent != intent) {
      _paymentMethodIntent = intent;
      _paymentMethodRetryKey = const Uuid().v4();
    }
    try {
      await context.read<StoreService>().updatePaymentSettings(
        store.id,
        {field: enabled},
        expectedRevision: _paymentConfig!.revision,
        idempotencyKey: _paymentMethodRetryKey,
      );
      if (!mounted ||
          storeContext.requestContextKey != key ||
          storeContext.selectedStoreId != store.id)
        return;
      _paymentMethodIntent = null;
      _paymentMethodRetryKey = null;
      await _loadStore();
      HapticFeedback.lightImpact();
    } catch (error) {
      if (mounted &&
          storeContext.requestContextKey == key &&
          storeContext.selectedStoreId == store.id) {
        if (error is ApiException && error.statusCode == 409) {
          _paymentMethodIntent = null;
          _paymentMethodRetryKey = null;
          await _loadStore();
          if (!mounted ||
              storeContext.requestContextKey != key ||
              storeContext.selectedStoreId != store.id)
            return;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Payment settings could not be confirmed. Reload before trying again.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _updatingPaymentMethods = false);
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
    final stale = _staleSettings(storeContext);
    if (stale && !_isLoading && !_reloadScheduled) {
      _reloadScheduled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _reloadScheduled = false;
        if (mounted &&
            !_isLoading &&
            _staleSettings(context.read<StoreContext>()))
          _loadStore();
      });
    }
    if (_isLoading || stale || _loadError != null) {
      return Scaffold(
        backgroundColor: colors.card,
        body: SafeArea(
          child: Column(
            children: [
              _buildHeader(colors),
              Expanded(
                child: Center(
                  child: _isLoading || stale
                      ? CircularProgressIndicator(color: colors.accent)
                      : Column(
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
            ],
          ),
        ),
      );
    }

    // Fresh same-store metadata is already authorized by StoreContext. Reflect
    // it without another billing/payment fetch or a second private read cache.
    final visibleStore = _store == null ? null : storeContext.selectedStore;
    final storeUrl = visibleStore == null
        ? ''
        : AppConfig.storefrontUrlFor(
            subdomain: visibleStore.subdomain,
            publicUrl: visibleStore.publicUrl,
          );

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
                  if (visibleStore != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8, bottom: 4),
                      child: GestureDetector(
                        onTap: () => Navigator.pushNamed(
                          context,
                          AppRoutes.storeDetails,
                        ),
                        child: StoreInfoCard(
                          storeName: visibleStore.name,
                          storeUrl: storeUrl,
                          logoUrl: visibleStore.logoUrl,
                          isPublished: visibleStore.isPublished,
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
                        trailing: const MerchantThemeSelector(),
                        trailingBelow: true,
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
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: colors.textTertiary,
                          size: 20,
                        ),
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
                        icon: Icons.verified_user_outlined,
                        title: 'Business verification',
                        subtitle: 'Private KYC documents and review status',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.kyc),
                      ),
                      SettingsTile(
                        icon: Icons.loyalty_outlined,
                        title: 'Loyalty',
                        subtitle: 'Customer points and reward settings',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.loyalty),
                      ),
                      SettingsTile(
                        icon: Icons.local_shipping_outlined,
                        title: 'Shipping',
                        subtitle: 'Delivery zones and rates',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.shipping),
                      ),
                      SettingsTile(
                        icon: Icons.receipt_long_outlined,
                        title: 'Taxes / GST',
                        subtitle: 'Tax rates and inclusive prices',
                        onTap: () =>
                            Navigator.pushNamed(context, AppRoutes.taxes),
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
                      if (_paymentConfig == null && !_paymentLoading)
                        TextButton(
                          onPressed: () {
                            if (isLetbuyySurfaceCurrent(context)) _loadStore();
                          },
                          child: const Text('Retry payment settings'),
                        ),
                      SettingsTile(
                        icon: Icons.local_shipping_outlined,
                        title: 'Cash on Delivery (COD)',
                        subtitle: _paymentConfig == null
                            ? _paymentLoading
                                  ? 'Loading payment settings…'
                                  : 'Payment settings unavailable'
                            : _paymentConfig!.codEnabled
                            ? 'Enabled'
                            : 'Disabled',
                        trailing: Switch(
                          value: _paymentConfig?.codEnabled ?? false,
                          activeColor: AppColors.lavender,
                          onChanged:
                              _paymentConfig == null || _updatingPaymentMethods
                              ? null
                              : (value) =>
                                    _updatePaymentMethod('cod_enabled', value),
                        ),
                        showArrow: false,
                      ),
                      SettingsTile(
                        icon: Icons.credit_card_outlined,
                        title: 'Online Payment (Razorpay)',
                        subtitle:
                            _paymentConfig?.statusText ??
                            (_paymentLoading
                                ? 'Checking payment readiness…'
                                : 'Payment readiness not confirmed'),
                        trailing: Switch(
                          value: _paymentConfig?.onlineRequested ?? false,
                          activeColor: AppColors.lavender,
                          onChanged:
                              _paymentConfig == null ||
                                  _updatingPaymentMethods ||
                                  !(_paymentConfig!.canEnableOnline ||
                                      _paymentConfig!.onlineRequested)
                              ? null
                              : (value) => _updatePaymentMethod(
                                  'online_payment_enabled',
                                  value,
                                ),
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
                      SettingsTile(
                        icon: Icons.account_balance_outlined,
                        title: 'Your Razorpay connection',
                        subtitle: _store?.isUsingOwnRazorpay == true
                            ? 'Review sandbox connection'
                            : 'Connect a verified sandbox account',
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
          Expanded(
            child: Align(
              alignment: Alignment.centerRight,
              child: StoreSwitcherButton(onChanged: _loadStore),
            ),
          ),
        ],
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
          ? _billingLoading
                ? 'Loading billing…'
                : 'Billing unavailable'
          : '${billing.planName} • ${billing.status.replaceAll('_', ' ')}',
      showArrow: false,
    );
  }

  /// Build product usage tile
  Widget _buildProductUsageTile(AppThemeColors colors) {
    final billing = context.watch<StoreContext>().selectedStoreId == _store?.id
        ? _billing
        : null;
    return SettingsTile(
      icon: Icons.inventory_2_outlined,
      title: 'Product Usage',
      trailing: MerchantProductUsage(billing: billing),
      trailingBelow: true,
      showArrow: false,
    );
  }
}
