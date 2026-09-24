// lib/screens/products/widgets/smart_product_notification.dart
// Smart Product Notification Banner - Premium Professional Design

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';

/// Notification types for product alerts
enum ProductNotificationType {
  outOfStock,
  lowStock,
  winning,
}

/// Smart notification banner for product management
class SmartProductNotification extends StatefulWidget {
  final ProductNotificationType type;
  final int count;
  final String? productName;
  final VoidCallback? onTap;
  final VoidCallback? onDismissForToday;
  final VoidCallback? onClose;
  final bool isDark;
  final int currentIndex; // 0-based
  final int totalCount;

  const SmartProductNotification({
    super.key,
    required this.type,
    required this.count,
    this.productName,
    this.onTap,
    this.onDismissForToday,
    this.onClose,
    this.isDark = false,
    this.currentIndex = 0,
    this.totalCount = 1,
  });

  @override
  State<SmartProductNotification> createState() => _SmartProductNotificationState();

  static Future<bool> shouldShowToday() async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final dismissedDate = prefs.getString('product_notification_dismissed');
    return dismissedDate != today;
  }

  static Future<void> dismissForToday() async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await prefs.setString('product_notification_dismissed', today);
  }
}

class _SmartProductNotificationState extends State<SmartProductNotification>
    with TickerProviderStateMixin {
  late AnimationController _progressController;
  late AnimationController _glowController;
  late AnimationController _pulseController;
  bool _isVisible = true;
  double _dragOffset = 0;

  @override
  void initState() {
    super.initState();
    
    // Progress bar controller (5 seconds)
    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 5),
    )..forward();

    // Glow animation
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    // Pulse animation for icon
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);

    // Auto-dismiss after 5 seconds
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted && _isVisible) {
        _dismiss();
      }
    });

    // Haptic feedback on show
    HapticFeedback.mediumImpact();
  }

  @override
  void dispose() {
    _progressController.dispose();
    _glowController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  void _dismiss() {
    HapticFeedback.lightImpact();
    setState(() => _isVisible = false);
    Future.delayed(const Duration(milliseconds: 300), () {
      widget.onClose?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_isVisible) return const SizedBox.shrink();

    final config = _getConfig();
    final screenWidth = MediaQuery.of(context).size.width;

    return GestureDetector(
      onHorizontalDragUpdate: (details) {
        setState(() {
          _dragOffset += details.delta.dx;
        });
      },
      onHorizontalDragEnd: (details) {
        if (_dragOffset.abs() > 100) {
          _dismiss();
        } else {
          setState(() => _dragOffset = 0);
        }
      },
      child: AnimatedOpacity(
        opacity: _isVisible ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 300),
        child: Transform.translate(
          offset: Offset(_dragOffset, 0),
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Stack(
              children: [
                // Animated Glow Background
                AnimatedBuilder(
                  animation: _glowController,
                  builder: (context, child) {
                    return Container(
                      height: 170,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: config.color.withValues(alpha: 0.3 + (_glowController.value * 0.2)),
                            blurRadius: 20 + (_glowController.value * 10),
                            spreadRadius: 2,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                    );
                  },
                ),

                // Main Card
                ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            config.color.withValues(alpha: widget.isDark ? 0.25 : 0.12),
                            config.color.withValues(alpha: widget.isDark ? 0.15 : 0.06),
                            (widget.isDark ? Colors.black : Colors.white).withValues(alpha: 0.05),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: config.color.withValues(alpha: 0.5),
                          width: 1.5,
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
                            child: Column(
                              children: [
                                // Top Row: Queue indicator + Close
                                Row(
                                  children: [
                                    // Queue Indicator Pills
                                    if (widget.totalCount > 1) ...[
                                      _buildQueueIndicator(config.color),
                                      const SizedBox(width: 8),
                                    ],
                                    
                                    // Badge
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: config.color.withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(color: config.color.withValues(alpha: 0.4)),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(config.badgeIcon, color: config.color, size: 12),
                                          const SizedBox(width: 4),
                                          Text(
                                            config.badgeText,
                                            style: TextStyle(
                                              color: config.color,
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    
                                    const Spacer(),
                                    
                                    // Swipe hint
                                    Text(
                                      'Swipe to dismiss',
                                      style: TextStyle(
                                        fontSize: 9,
                                        color: widget.isDark ? Colors.white38 : Colors.black26,
                                      ),
                                    ),
                                    
                                    const SizedBox(width: 8),
                                    
                                    // Close Button
                                    _buildCloseButton(),
                                  ],
                                ),

                                const SizedBox(height: 12),

                                // Main Content Row
                                Row(
                                  children: [
                                    // Animated Icon
                                    _buildAnimatedIcon(config),
                                    
                                    const SizedBox(width: 14),

                                    // Title & Description
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            config.title,
                                            style: TextStyle(
                                              fontSize: 17,
                                              fontWeight: FontWeight.w700,
                                              color: widget.isDark ? Colors.white : Colors.black87,
                                              letterSpacing: -0.3,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            config.subtitle,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: widget.isDark ? Colors.white60 : Colors.black54,
                                              height: 1.3,
                                            ),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),

                                    // Count Badge (for stock alerts)
                                    if (widget.type != ProductNotificationType.winning)
                                      _buildCountBadge(config),
                                  ],
                                ),

                                const SizedBox(height: 14),

                                // Action Buttons
                                Row(
                                  children: [
                                    Expanded(
                                      flex: 2,
                                      child: _buildPrimaryButton(config),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: _buildSecondaryButton(),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),

                          // Progress Bar at Bottom
                          _buildProgressBar(config),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ).animate()
          .slideY(begin: -1, end: 0, duration: 500.ms, curve: Curves.easeOutBack)
          .fadeIn(duration: 300.ms)
          .scale(begin: const Offset(0.95, 0.95), end: const Offset(1, 1), duration: 400.ms),
    );
  }

  Widget _buildQueueIndicator(Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(widget.totalCount, (index) {
        final isActive = index == widget.currentIndex;
        return Container(
          width: isActive ? 16 : 6,
          height: 6,
          margin: const EdgeInsets.only(right: 4),
          decoration: BoxDecoration(
            color: isActive ? color : color.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(3),
          ),
        ).animate(target: isActive ? 1 : 0)
            .scaleX(begin: 0.6, end: 1, duration: 300.ms);
      }),
    );
  }

  Widget _buildCloseButton() {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          _dismiss();
        },
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: widget.isDark
                ? Colors.white.withValues(alpha: 0.1)
                : Colors.black.withValues(alpha: 0.05),
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.close_rounded,
            size: 16,
            color: widget.isDark ? Colors.white54 : Colors.black45,
          ),
        ),
      ),
    );
  }

  Widget _buildAnimatedIcon(_NotificationConfig config) {
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final scale = 1.0 + (_pulseController.value * 0.08);
        return Transform.scale(
          scale: scale,
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: RadialGradient(
                colors: [
                  config.color.withValues(alpha: 0.3),
                  config.color.withValues(alpha: 0.1),
                ],
              ),
              shape: BoxShape.circle,
              border: Border.all(
                color: config.color.withValues(alpha: 0.4),
                width: 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: config.color.withValues(alpha: 0.3),
                  blurRadius: 12,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: Icon(
              config.icon,
              color: config.color,
              size: 26,
            ),
          ),
        );
      },
    );
  }

  Widget _buildCountBadge(_NotificationConfig config) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [config.color, config.color.withValues(alpha: 0.8)],
        ),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: config.color.withValues(alpha: 0.4),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            '${widget.count}',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 20,
            ),
          ),
          Text(
            widget.count == 1 ? 'item' : 'items',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 9,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    ).animate(onPlay: (c) => c.repeat(reverse: true))
        .scale(begin: const Offset(1, 1), end: const Offset(1.05, 1.05), duration: 800.ms);
  }

  Widget _buildPrimaryButton(_NotificationConfig config) {
    return Material(
      color: config.color,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () {
          HapticFeedback.mediumImpact();
          widget.onTap?.call();
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(config.actionIcon, size: 16, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                config.actionLabel,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSecondaryButton() {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () {
          HapticFeedback.mediumImpact();
          SmartProductNotification.dismissForToday();
          widget.onDismissForToday?.call();
          _dismiss();
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: widget.isDark ? Colors.white24 : Colors.black12,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.notifications_off_outlined,
                size: 14,
                color: widget.isDark ? Colors.white54 : Colors.black45,
              ),
              const SizedBox(width: 4),
              Text(
                'Skip',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: widget.isDark ? Colors.white54 : Colors.black45,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProgressBar(_NotificationConfig config) {
    return AnimatedBuilder(
      animation: _progressController,
      builder: (context, child) {
        return Container(
          height: 4,
          decoration: BoxDecoration(
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: Stack(
            children: [
              // Background
              Container(
                color: config.color.withValues(alpha: 0.15),
              ),
              // Progress
              FractionallySizedBox(
                widthFactor: 1 - _progressController.value,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        config.color,
                        config.color.withValues(alpha: 0.7),
                      ],
                    ),
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(20),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  _NotificationConfig _getConfig() {
    switch (widget.type) {
      case ProductNotificationType.outOfStock:
        return _NotificationConfig(
          color: const Color(0xFFDC2626),
          icon: Icons.error_rounded,
          badgeIcon: Icons.priority_high_rounded,
          badgeText: 'URGENT',
          title: 'Out of Stock Alert!',
          subtitle: '${widget.count} product${widget.count > 1 ? 's need' : ' needs'} restocking immediately. Customers can\'t buy these!',
          actionLabel: 'Restock Now',
          actionIcon: Icons.inventory_2_outlined,
        );
      case ProductNotificationType.lowStock:
        return _NotificationConfig(
          color: const Color(0xFFF59E0B),
          icon: Icons.warning_rounded,
          badgeIcon: Icons.schedule_rounded,
          badgeText: 'WARNING',
          title: 'Low Stock Warning',
          subtitle: '${widget.count} product${widget.count > 1 ? 's are' : ' is'} running low. Restock soon to avoid missing sales.',
          actionLabel: 'View Products',
          actionIcon: Icons.inventory_outlined,
        );
      case ProductNotificationType.winning:
        return _NotificationConfig(
          color: const Color(0xFF10B981),
          icon: Icons.emoji_events_rounded,
          badgeIcon: Icons.star_rounded,
          badgeText: 'TOP SELLER',
          title: '🎉 Winning Product!',
          subtitle: widget.productName != null
              ? '"${widget.productName}" is crushing it with 20+ orders! Keep it stocked!'
              : 'You have a top-performing product! Celebrate this win!',
          actionLabel: 'View Analytics',
          actionIcon: Icons.trending_up_rounded,
        );
    }
  }
}

class _NotificationConfig {
  final Color color;
  final IconData icon;
  final IconData badgeIcon;
  final String badgeText;
  final String title;
  final String subtitle;
  final String actionLabel;
  final IconData actionIcon;

  _NotificationConfig({
    required this.color,
    required this.icon,
    required this.badgeIcon,
    required this.badgeText,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.actionIcon,
  });
}
