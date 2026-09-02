// apps/marketplace/lib/screens/notifications/notification_screen.dart
// 🔔 PREMIUM NOTIFICATION CENTER FOR MARKETPLACE
// ✨ Glassmorphic, Unified Design - Same as Seller App

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import '../../providers/notification_provider.dart';
import '../../widgets/premium_scaffold.dart';

class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> with AutomaticKeepAliveClientMixin {
  
  // 🚀 WEB OPTIMIZATION: Keep state alive when switching tabs
  @override
  bool get wantKeepAlive => true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().initNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // 🚀 Required for AutomaticKeepAlive
    final isDark = context.watch<ThemeProvider>().isDarkMode;
    
    return PremiumScaffold(
      // backgroundColor handled by PremiumScaffold
      body: Stack(
        children: [
          // Background handled by PremiumScaffold
          
          // Main Content
          Padding(
            padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
            child: Column(
              children: [
                // Header
                _buildHeader(context, isDark),
                
                // Notifications List
                Expanded(
                  child: Consumer<NotificationProvider>(
                    builder: (context, provider, _) {
                      if (provider.isLoading) {
                        return const Center(
                          child: CircularProgressIndicator(),
                        );
                      }

                      if (provider.notifications.isEmpty) {
                        return _buildEmptyState(isDark);
                      }

                      return _buildGroupedList(provider.notifications, provider, isDark);
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Placeholder for internal methods if needed or removed _buildAnimatedBackground


  Widget _buildHeader(BuildContext context, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          // Back Button
          Container(
            decoration: BoxDecoration(
              color: (isDark ? AppColors.surfaceDark : AppColors.surface).withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: (isDark ? AppColors.borderDark : AppColors.border).withValues(alpha: 0.1),
              ),
            ),
            child: IconButton(
              icon: Icon(
                Icons.arrow_back_ios_new,
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                size: 20,
              ),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          const SizedBox(width: 16),
          
          // Title
          Expanded(
            child: Text(
              'Notifications',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
              ),
            ),
          ),
          
          // Actions
          Consumer<NotificationProvider>(
            builder: (context, provider, _) => Row(
              children: [
                if (provider.unreadCount > 0)
                  _buildGlassButton(
                    icon: Icons.done_all,
                    label: 'Mark all read',
                    isDark: isDark,
                    onTap: () => provider.markAllAsRead(),
                  ),
                const SizedBox(width: 8),
                _buildGlassButton(
                  icon: Icons.delete_outline,
                  label: '',
                  isDark: isDark,
                  onTap: () => _showClearConfirmation(context, isDark),
                ),
              ],
            ),
          ),
        ],
      ),
    );
    // 🚀 WEB OPTIMIZATION: Skip animations on web
    return kIsWeb ? widget : widget.animate().fadeIn(duration: 300.ms).slideY(begin: -0.2);
  }

  Widget _buildGlassButton({
    required IconData icon,
    required String label,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: label.isEmpty ? 12 : 16,
              vertical: 10,
            ),
            decoration: BoxDecoration(
              color: (isDark ? AppColors.surfaceDark : AppColors.textPrimary).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: (isDark ? AppColors.borderDark : AppColors.textPrimary).withValues(alpha: 0.1),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
                if (label.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGroupedList(
    List<NotificationModel> notifications,
    NotificationProvider provider,
    bool isDark,
  ) {
    // Group by date
    final Map<String, List<NotificationModel>> grouped = {};
    for (final n in notifications) {
      final key = _getDateKey(n.createdAt);
      grouped.putIfAbsent(key, () => []);
      grouped[key]!.add(n);
    }

    final sortedKeys = grouped.keys.toList();

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      itemCount: sortedKeys.length,
      itemBuilder: (context, sectionIndex) {
        final dateKey = sortedKeys[sectionIndex];
        final items = grouped[dateKey]!;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Date Header
            Padding(
              padding: const EdgeInsets.only(top: 20, bottom: 12),
              child: Text(
                dateKey,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            // 🚀 WEB OPTIMIZATION: Skip animations on web
            
            // Notifications for this date
            ...items.asMap().entries.map((entry) {
              final globalIndex = notifications.indexOf(entry.value);
              return _buildNotificationTile(entry.value, provider, isDark, globalIndex);
            }),
          ],
        );
      },
    );
  }

  Widget _buildNotificationTile(
    NotificationModel notification,
    NotificationProvider provider,
    bool isDark,
    int index,
  ) {
    final tile = Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            decoration: BoxDecoration(
              color: notification.read
                  ? (isDark ? AppColors.surfaceDark : AppColors.surface).withValues(alpha: 0.03)
                  : (isDark ? AppColors.primaryLight : AppColors.primary).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: notification.read
                    ? (isDark ? AppColors.borderDark : AppColors.border).withValues(alpha: 0.05)
                    : (isDark ? AppColors.primaryLight : AppColors.primary).withValues(alpha: 0.2),
                width: 1.5,
              ),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () {
                  provider.markAsRead(notification.id);
                  _handleNotificationTap(notification);
                },
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Icon
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: notification.iconColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          notification.iconData,
                          color: notification.iconColor,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      
                      // Content
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    notification.title,
                                    style: TextStyle(
                                      fontWeight: notification.read ? FontWeight.w500 : FontWeight.bold,
                                      fontSize: 15,
                                      color: isDark ? AppColors.textLight : AppColors.textPrimary,
                                    ),
                                  ),
                                ),
                                if (!notification.read)
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      color: AppColors.primary,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              notification.body,
                              style: TextStyle(
                                fontSize: 13,
                                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                                height: 1.4,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _formatTime(notification.createdAt),
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? AppColors.textLightHint : AppColors.textHint,
                              ),
                            ),
                          ],
                        ),
                      ),
                      
                      // Delete Button
                      IconButton(
                        icon: Icon(
                          Icons.close,
                          size: 18,
                          color: isDark ? AppColors.textLightHint : AppColors.textHint,
                        ),
                        onPressed: () => provider.deleteNotification(notification.id),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    
    // 🚀 WEB OPTIMIZATION: Skip animations on web
    if (kIsWeb) {
      return tile;
    }
    return tile.animate().fadeIn(delay: (index * 30).ms).slideX(begin: 0.05);
  }

  Widget _buildEmptyState(bool isDark) {
    final empty = Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: (isDark ? AppColors.surfaceDark : AppColors.surface).withValues(alpha: 0.05),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.notifications_off_outlined,
              size: 64,
              color: isDark ? AppColors.textLightHint : AppColors.textHint,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'No notifications yet',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'We\'ll notify you about orders,\nreturns, and special offers',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
    // 🚀 WEB OPTIMIZATION: Skip animations on web
    return kIsWeb ? empty : empty.animate().fadeIn().scale(begin: const Offset(0.9, 0.9));
  }

  String _getDateKey(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final notificationDate = DateTime(date.year, date.month, date.day);

    if (notificationDate == today) return 'Today';
    if (notificationDate == yesterday) return 'Yesterday';
    if (now.difference(date).inDays < 7) return DateFormat('EEEE').format(date);
    return DateFormat('MMM d, yyyy').format(date);
  }

  String _formatTime(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return DateFormat('h:mm a').format(date);
  }

  void _handleNotificationTap(NotificationModel notification) {
    // Navigate based on notification type
    final data = notification.data;
    if (data == null) return;

    final orderId = data['orderId'];
    final returnId = data['returnId'];

    if (returnId != null) {
      Navigator.pushNamed(context, '/return-tracking/$returnId');
    } else if (orderId != null) {
      Navigator.pushNamed(context, '/orders/$orderId');
    }
  }

  void _showClearConfirmation(BuildContext context, bool isDark) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Clear All Notifications?',
          style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary),
        ),
        content: Text(
          'This will permanently delete all your notifications.',
          style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Cancel',
              style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: AppColors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () {
              context.read<NotificationProvider>().clearAllNotifications();
              Navigator.pop(ctx);
            },
            child: const Text('Clear All'),
          ),
        ],
      ),
    );
  }
}
