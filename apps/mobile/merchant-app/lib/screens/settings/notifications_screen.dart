import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../services/notification_settings_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  NotificationSettings? _settings;
  List<MerchantNotification> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = true;
  bool _isSaving = false;
  String? _storeId;
  String? _error;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
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
            _notifications = [];
            _unreadCount = 0;
            _isLoading = false;
          });
        }
        return;
      }

      final service = context.read<NotificationSettingsService>();
      final results = await Future.wait<Object>([
        service.fetchSettings(_storeId!),
        service.fetchInbox(limit: 20),
        service.fetchUnreadCount(),
      ]);
      final settings = results[0] as NotificationSettings;
      final notifications = results[1] as List<MerchantNotification>;
      final unreadCount = results[2] as int;
      if (mounted) {
        setState(() {
          _settings = settings;
          _notifications = notifications;
          _unreadCount = unreadCount;
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
        _loadNotifications();
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _markNotificationRead(MerchantNotification notification) async {
    if (notification.isRead) return;
    try {
      await context.read<NotificationSettingsService>().markRead(
        notification.id,
      );
      if (mounted) {
        setState(() {
          _notifications = _notifications
              .map(
                (item) => item.id == notification.id
                    ? item.copyWith(isRead: true)
                    : item,
              )
              .toList(growable: false);
          _unreadCount = _notifications.where((item) => !item.isRead).length;
        });
      }
    } catch (_) {
      if (mounted) {
        _showSnackBar('Notification could not be updated.', isError: true);
      }
    }
  }

  Future<void> _markAllRead() async {
    if (_notifications.isEmpty || _unreadCount == 0) return;
    try {
      await context.read<NotificationSettingsService>().markAllRead();
      if (mounted) {
        setState(() {
          _notifications = _notifications
              .map((item) => item.copyWith(isRead: true))
              .toList(growable: false);
          _unreadCount = 0;
        });
      }
    } catch (_) {
      if (mounted) {
        _showSnackBar('Notifications could not be updated.', isError: true);
      }
    }
  }

  Future<void> _deleteNotification(MerchantNotification notification) async {
    try {
      await context.read<NotificationSettingsService>().deleteNotification(
        notification.id,
      );
      if (mounted) {
        setState(() {
          _notifications = _notifications
              .where((item) => item.id != notification.id)
              .toList(growable: false);
          _unreadCount = _notifications.where((item) => !item.isRead).length;
        });
        _showSnackBar('Notification deleted');
      }
    } catch (_) {
      if (mounted) {
        _showSnackBar('Notification could not be deleted.', isError: true);
      }
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
                  _isSaving
                      ? 'Saving...'
                      : _unreadCount == 0
                      ? 'Inbox and merchant alerts'
                      : '$_unreadCount unread merchant alerts',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh notifications',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _loadNotifications,
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
        title: 'Could not load notifications',
        subtitle: _error!,
        action: TextButton.icon(
          onPressed: _loadNotifications,
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
      onRefresh: _loadNotifications,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          _section(
            title: 'Inbox',
            action: _unreadCount == 0
                ? null
                : TextButton(
                    onPressed: _markAllRead,
                    child: const Text('Mark all read'),
                  ),
            child: _inboxList(),
          ),
          const SizedBox(height: 12),
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

  Widget _inboxList() {
    if (_notifications.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Column(
          children: [
            Icon(
              Icons.notifications_none_rounded,
              color: colors.textTertiary,
              size: 36,
            ),
            const SizedBox(height: 8),
            Text(
              'No notifications yet',
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'New order, customer, payout, and store alerts will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary, fontSize: 12),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        for (final notification in _notifications) ...[
          _notificationTile(notification),
          if (notification != _notifications.last)
            Divider(height: 18, color: colors.divider),
        ],
      ],
    );
  }

  Widget _notificationTile(MerchantNotification notification) {
    final unread = !notification.isRead;
    return InkWell(
      onTap: () => _markNotificationRead(notification),
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color:
                    (unread
                            ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                            : colors.textTertiary)
                        .withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                _notificationIcon(notification.type),
                color: unread
                    ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                    : colors.textTertiary,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontSize: 14,
                            fontWeight: unread
                                ? FontWeight.w800
                                : FontWeight.w600,
                          ),
                        ),
                      ),
                      if (unread)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color:
                                mobile_tokens.LetbuyyColorTokens.brandPrimary,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  if (notification.message != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      notification.message!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    DateFormat(
                      'MMM d, h:mm a',
                    ).format(notification.createdAt.toLocal()),
                    style: TextStyle(color: colors.textTertiary, fontSize: 11),
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              tooltip: 'Notification actions',
              icon: Icon(Icons.more_vert_rounded, color: colors.textTertiary),
              onSelected: (value) {
                if (value == 'read') {
                  _markNotificationRead(notification);
                } else if (value == 'delete') {
                  _deleteNotification(notification);
                }
              },
              itemBuilder: (context) => [
                if (unread)
                  const PopupMenuItem(
                    value: 'read',
                    child: Text('Mark as read'),
                  ),
                const PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            ),
          ],
        ),
      ),
    );
  }

  IconData _notificationIcon(String type) {
    return switch (type) {
      'order_placed' ||
      'order_shipped' ||
      'order_delivered' => Icons.receipt_long_outlined,
      'new_lead' || 'new_contact' => Icons.person_add_alt_1_outlined,
      'plan_upgraded' => Icons.workspace_premium_outlined,
      'store_published' => Icons.storefront_outlined,
      'theme_purchased' || 'theme_review' => Icons.palette_outlined,
      'app_installed' ||
      'app_uninstalled' ||
      'app_review' => Icons.extension_outlined,
      _ => Icons.notifications_outlined,
    };
  }

  Widget _section({
    required String title,
    required Widget child,
    Widget? action,
  }) {
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
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (action != null) action,
            ],
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
