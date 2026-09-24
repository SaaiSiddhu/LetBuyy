// apps/seller/lib/screens/notifications/notifications_screen.dart
// 🔔 PREMIUM NOTIFICATION CENTER
// ✨ Glassmorphic, Single Channel, Unified Design

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../providers/notification_provider.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().loadNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final provider = context.watch<NotificationProvider>();
    final notifications = provider.notifications;
    final unreadCount = provider.unreadCount;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      body: Stack(
        children: [
          // Background Elements
          Positioned.fill(
            child: Container(
              color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
            ),
          ),
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withValues(alpha: 0.05),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.05),
                    blurRadius: 100,
                    spreadRadius: 20,
                  ),
                ],
              ),
            ),
          ),
          
          CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              // Glass AppBar
              SliverAppBar(
                expandedHeight: 120,
                floating: true,
                pinned: true,
                backgroundColor: Colors.transparent,
                flexibleSpace: ClipRRect(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
                    child: Container(
                      color: (isDark ? const Color(0xFF0F172A) : Colors.white).withValues(alpha: 0.85),
                      child: FlexibleSpaceBar(
                        background: SafeArea(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Notifications',
                                          style: TextStyle(
                                            color: isDark ? Colors.white : const Color(0xFF111827),
                                            fontSize: 28,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: -0.5,
                                          ),
                                        ),
                                        if (unreadCount > 0)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 4),
                                            child: Text(
                                              '$unreadCount unread notifications',
                                              style: TextStyle(
                                                color: AppColors.primary,
                                                fontSize: 14,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    _buildHeaderActions(context, provider, isDark),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // Content
              if (provider.isLoading && notifications.isEmpty)
                const SliverFillRemaining(
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (notifications.isEmpty)
                 SliverFillRemaining(child: _buildEmptyState(isDark))
              else
                _buildGroupedList(notifications, provider, isDark),
              
              const SliverPadding(padding: EdgeInsets.only(bottom: 24)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderActions(BuildContext context, NotificationProvider provider, bool isDark) {
    return Row(
      children: [
        if (provider.unreadCount > 0)
          GestureDetector(
            onTap: () => provider.markAllAsRead(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.done_all_rounded, color: AppColors.primary, size: 20),
            ),
          ),
        const SizedBox(width: 8),
        PopupMenuButton<String>(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.more_horiz_rounded, color: isDark ? Colors.white : Colors.black),
          ),
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          elevation: 4,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          onSelected: (value) {
            if (value == 'clear') _showClearConfirmation(context, isDark);
          },
          itemBuilder: (context) => [
            PopupMenuItem(
              value: 'clear',
              child: Row(
                children: [
                  Icon(Icons.delete_sweep_rounded, size: 20, color: const Color(0xFFEF4444)),
                  const SizedBox(width: 12),
                  Text('Clear All', style: TextStyle(color: const Color(0xFFEF4444))),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildGroupedList(List<NotificationModel> notifications, NotificationProvider provider, bool isDark) {
    // Group notifications by date
    final grouped = <String, List<NotificationModel>>{};
    for (final notification in notifications) {
      final dateKey = _getDateKey(notification.createdAt);
      grouped.putIfAbsent(dateKey, () => []).add(notification);
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final dateKey = grouped.keys.elementAt(index);
          final items = grouped[dateKey]!;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
                child: Text(
                  dateKey,
                  style: TextStyle(
                    color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              ...items.asMap().entries.map((entry) => 
                _buildNotificationTile(entry.value, provider, isDark, entry.key)),
            ],
          );
        },
        childCount: grouped.keys.length,
      ),
    );
  }

  Widget _buildNotificationTile(NotificationModel notification, NotificationProvider provider, bool isDark, int index) {
    final iconData = _getNotificationIcon(notification.type);
    final iconColor = _getNotificationColor(notification.type);
    
    return Dismissible(
      key: Key(notification.id),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => provider.deleteNotification(notification.id),
      background: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        color: const Color(0xFFEF4444),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 24),
        child: const Icon(Icons.delete_outline_rounded, color: Colors.white, size: 28),
      ),
      child: GestureDetector(
        onTap: () {
          if (!notification.read) provider.markAsRead(notification.id);
          _handleNotificationTap(notification);
        },
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: notification.read ? 0.03 : 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: notification.read 
                  ? Colors.transparent 
                  : AppColors.primary.withValues(alpha: 0.3),
              width: 1,
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Icon
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: iconColor.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(iconData, color: iconColor, size: 20),
                    ),
                    const SizedBox(width: 16),
                    // Content
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  notification.title,
                                  style: TextStyle(
                                    color: isDark ? Colors.white : const Color(0xFF111827),
                                    fontSize: 15,
                                    fontWeight: notification.read ? FontWeight.w600 : FontWeight.w800,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Text(
                                _formatTime(notification.createdAt),
                                style: TextStyle(
                                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.4),
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            notification.body,
                            style: TextStyle(
                              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.7),
                              fontSize: 13,
                              height: 1.4,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    // Read Status
                    if (!notification.read)
                      Container(
                        margin: const EdgeInsets.only(left: 12, top: 4),
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(color: AppColors.primary.withValues(alpha: 0.4), blurRadius: 4, spreadRadius: 1),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ).animate().fadeIn(delay: (index * 50).ms).slideX(begin: 0.1, curve: Curves.easeOut);
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.notifications_none_rounded,
              size: 48,
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.2),
            ),
          ).animate().scale(duration: 500.ms, curve: Curves.elasticOut),
          const SizedBox(height: 24),
          Text(
            'All caught up!',
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'No new notifications at the moment.',
            style: TextStyle(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  String _getDateKey(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final inputDate = DateTime(date.year, date.month, date.day);

    if (inputDate == today) return 'Today';
    if (inputDate == yesterday) return 'Yesterday';
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

  IconData _getNotificationIcon(String? type) {
    switch (type) {
      case 'new_order': return Icons.shopping_bag_rounded;
      case 'payment': return Icons.account_balance_wallet_rounded;
      case 'kyc': return Icons.verified_user_rounded;
      case 'login': return Icons.security_rounded;
      case 'alert': return Icons.warning_amber_rounded;
      default: return Icons.notifications_rounded;
    }
  }

  Color _getNotificationColor(String? type) {
    switch (type) {
      case 'new_order': return const Color(0xFF3B82F6);
      case 'payment': return const Color(0xFF10B981);
      case 'kyc': return const Color(0xFF8B5CF6);
      case 'login': return const Color(0xFFF59E0B);
      case 'alert': return const Color(0xFFEF4444);
      default: return const Color(0xFF6366F1);
    }
  }

  void _handleNotificationTap(NotificationModel notification) {
    // Navigate based on type
    // Note: Add logic here based on your routes
  }

  void _showClearConfirmation(BuildContext context, bool isDark) {
    showDialog(
      context: context,
      builder: (context) {
        return BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
          child: AlertDialog(
            backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Text(
              'Clear All?',
              style: TextStyle(
                color: isDark ? Colors.white : const Color(0xFF111827),
                fontWeight: FontWeight.bold,
              ),
            ),
            content: Text(
              'This will remove all notifications permanently.',
              style: TextStyle(
                color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.7),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text('Cancel', style: TextStyle(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.6))),
              ),
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.read<NotificationProvider>().clearAllNotifications();
                },
                child: const Text('Clear All', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      },
    );
  }
}
