import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../services/notification_settings_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  NotificationSettings? _settings;
  bool _isLoading = true;
  bool _isSaving = false;
  String? _storeId;
  String? _error;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _storeId ??=
          (await context.read<StoreContext>().ensureSelectedStore())?.id;
      if (_storeId == null) {
        if (mounted) {
          setState(() {
            _settings = null;
            _isLoading = false;
          });
        }
        return;
      }

      final settings = await context
          .read<NotificationSettingsService>()
          .fetchSettings(_storeId!);
      if (mounted) {
        setState(() {
          _settings = settings;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _update(NotificationSettings settings) async {
    setState(() {
      _settings = settings;
      _isSaving = true;
    });

    try {
      final updated = await context
          .read<NotificationSettingsService>()
          .updateSettings(settings);
      if (mounted) {
        setState(() => _settings = updated);
        _showSnackBar('Notification settings saved');
      }
    } catch (error) {
      if (mounted) {
        _showSnackBar(error.toString(), isError: true);
        _loadSettings();
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              Expanded(child: _isLoading ? _loading() : _body()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Notifications',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  _isSaving ? 'Saving...' : 'Channels and merchant alerts',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh notification settings',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _loadSettings,
          ),
        ],
      ),
    );
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        icon: Icons.error_outline_rounded,
        title: 'Could not load settings',
        subtitle: _error!,
        action: TextButton.icon(
          onPressed: _loadSettings,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
        ),
      );
    }

    final settings = _settings;
    if (settings == null) {
      return _centerState(
        icon: Icons.notifications_off_outlined,
        title: 'No store selected',
        subtitle: 'Open a store before changing notification settings.',
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _loadSettings,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          _section(
            title: 'Channels',
            child: Column(
              children: [
                _toggle(
                  icon: Icons.email_outlined,
                  title: 'Email',
                  subtitle: 'Send operational alerts to merchant email',
                  value: settings.emailEnabled,
                  onChanged: (value) =>
                      _update(settings.copyWith(emailEnabled: value)),
                ),
                _toggle(
                  icon: Icons.sms_outlined,
                  title: 'SMS',
                  subtitle: 'Send urgent alerts by SMS when configured',
                  value: settings.smsEnabled,
                  onChanged: (value) =>
                      _update(settings.copyWith(smsEnabled: value)),
                ),
                _toggle(
                  icon: Icons.phone_iphone_outlined,
                  title: 'Push',
                  subtitle: 'Send mobile push alerts to registered devices',
                  value: settings.pushEnabled,
                  onChanged: (value) =>
                      _update(settings.copyWith(pushEnabled: value)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _section(
            title: 'Events',
            child: Column(
              children: [
                _toggle(
                  icon: Icons.receipt_long_outlined,
                  title: 'New orders',
                  subtitle: 'Alert when a customer places an order',
                  value: settings.orderCreated,
                  onChanged: (value) =>
                      _update(settings.copyWith(orderCreated: value)),
                ),
                _toggle(
                  icon: Icons.payments_outlined,
                  title: 'Payments',
                  subtitle: 'Alert when payment status changes',
                  value: settings.orderPaid,
                  onChanged: (value) =>
                      _update(settings.copyWith(orderPaid: value)),
                ),
                _toggle(
                  icon: Icons.warning_amber_rounded,
                  title: 'Low stock',
                  subtitle: 'Alert when inventory falls below threshold',
                  value: settings.lowStock,
                  onChanged: (value) =>
                      _update(settings.copyWith(lowStock: value)),
                ),
                _toggle(
                  icon: Icons.currency_exchange_rounded,
                  title: 'Refunds',
                  subtitle: 'Alert when refunds are requested or completed',
                  value: settings.refunds,
                  onChanged: (value) =>
                      _update(settings.copyWith(refunds: value)),
                ),
                _toggle(
                  icon: Icons.person_add_alt_1_outlined,
                  title: 'Customer signups',
                  subtitle: 'Alert when shoppers create accounts',
                  value: settings.customerSignup,
                  onChanged: (value) =>
                      _update(settings.copyWith(customerSignup: value)),
                ),
                _toggle(
                  icon: Icons.campaign_outlined,
                  title: 'Marketing',
                  subtitle: 'Campaign and promotion updates',
                  value: settings.marketing,
                  onChanged: (value) =>
                      _update(settings.copyWith(marketing: value)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _section({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _toggle({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile.adaptive(
      value: value,
      onChanged: _isSaving ? null : onChanged,
      contentPadding: EdgeInsets.zero,
      secondary: Icon(
        icon,
        color: value
            ? mobile_tokens.LetbuyyColorTokens.brandPrimary
            : colors.textTertiary,
      ),
      title: Text(
        title,
        style: TextStyle(
          color: colors.textPrimary,
          fontWeight: FontWeight.w700,
        ),
      ),
      subtitle: Text(subtitle, style: TextStyle(color: colors.textSecondary)),
      activeThumbColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
    );
  }

  Widget _centerState({
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? action,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 48),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
            if (action != null) ...[const SizedBox(height: 14), action],
          ],
        ),
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.success,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
