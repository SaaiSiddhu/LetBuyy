// lib/widgets/dashboard/premium_header.dart
// Premium header — profile | store pill | bell
// Design language: identity app dark/light palette, clean sheets

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../app/routes.dart';
import '../../app/store_context.dart';
import '../../models/store_model.dart';
import '../../services/store_auth_service.dart';
import '../../theme/app_theme_colors.dart';
import '../shared/accessible_tap_region.dart';

// ─── Brand colors (match identity-platform globals.css) ───────────────────────
const _kPrimary = Color(0xFF8B5CF6);
const _kDarkBg = Color(0xFF0A0912);
const _kLightBg = Color(0xFFFAF9FF);

// ─────────────────────────────────────────────────────────────────────────────
// Public widget: drop-in replacement for the old _buildHeader row
// ─────────────────────────────────────────────────────────────────────────────

class PremiumHeader extends StatelessWidget {
  const PremiumHeader({
    super.key,
    required this.isDark,
    this.onStoreChanged,
    this.onNotificationTap,
  });

  final bool isDark;
  final VoidCallback? onStoreChanged;
  final VoidCallback? onNotificationTap;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<StoreAuthService>();
    final storeCtx = context.watch<StoreContext>();
    final colors = AppThemeColors.of(context);
    final store = storeCtx.selectedStore;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: Row(
        children: [
          // LEFT — profile avatar
          _ProfileAvatar(auth: auth, isDark: isDark, colors: colors),

          // CENTER — store pill (fills remaining space)
          Expanded(
            child: Center(
              child: _StorePill(
                store: store,
                isDark: isDark,
                colors: colors,
                onStoreChanged: onStoreChanged,
              ),
            ),
          ),

          // RIGHT — notification bell
          _NotificationBell(
            isDark: isDark,
            colors: colors,
            onTap: onNotificationTap,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile avatar — purple circle with initials, taps → account sheet
// ─────────────────────────────────────────────────────────────────────────────

class _ProfileAvatar extends StatefulWidget {
  const _ProfileAvatar({
    required this.auth,
    required this.isDark,
    required this.colors,
  });
  final StoreAuthService auth;
  final bool isDark;
  final AppThemeColors colors;

  @override
  State<_ProfileAvatar> createState() => _ProfileAvatarState();
}

class _ProfileAvatarState extends State<_ProfileAvatar> {
  bool _pressed = false;

  String get _initials {
    final fullName = widget.auth.currentUser?.fullName?.trim();
    if (fullName != null && fullName.isNotEmpty) {
      final parts = fullName.split(RegExp(r'\s+'));
      if (parts.length >= 2) {
        return '${parts.first[0]}${parts[1][0]}'.toUpperCase();
      }
      return fullName[0].toUpperCase();
    }
    final email = widget.auth.currentUser?.email ?? '';
    return email.isNotEmpty ? email[0].toUpperCase() : 'U';
  }

  void _openAccountSheet() {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      isScrollControlled: true,
      builder: (_) => _AccountSheet(
        auth: widget.auth,
        isDark: widget.isDark,
        colors: widget.colors,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AccessibleTapRegion(
      label: 'Account',
      hint: 'Open account menu',
      onTap: _openAccountSheet,
      excludeChildSemantics: true,
      child: InkWell(
        excludeFromSemantics: true,
        onTap: _openAccountSheet,
        onHighlightChanged: (highlighted) {
          if (_pressed != highlighted) {
            setState(() => _pressed = highlighted);
          }
        },
        customBorder: const CircleBorder(),
        child: AnimatedScale(
          scale: _pressed ? 0.90 : 1.0,
          duration: const Duration(milliseconds: 130),
          curve: Curves.easeOut,
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: _kPrimary.withValues(alpha: 0.35),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Center(
              child: Text(
                _initials,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store pill — store logo + name + chevron, taps → store picker sheet
// ─────────────────────────────────────────────────────────────────────────────

class _StorePill extends StatefulWidget {
  const _StorePill({
    required this.store,
    required this.isDark,
    required this.colors,
    this.onStoreChanged,
  });
  final StoreModel? store;
  final bool isDark;
  final AppThemeColors colors;
  final VoidCallback? onStoreChanged;

  @override
  State<_StorePill> createState() => _StorePillState();
}

class _StorePillState extends State<_StorePill> {
  bool _pressed = false;

  /// Generate a unique, stable color from the store name
  static Color _storeColor(String name) {
    final hash = name.codeUnits.fold(0, (prev, c) => prev + c * 31);
    final hue = (hash % 360).abs().toDouble();
    return HSLColor.fromAHSL(1.0, hue, 0.65, 0.48).toColor();
  }

  String _storeInitials(String name) {
    final words = name.trim().split(RegExp(r'\s+'));
    if (words.length >= 2) return '${words[0][0]}${words[1][0]}'.toUpperCase();
    return name.substring(0, math.min(2, name.length)).toUpperCase();
  }

  void _openStorePicker() {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      isScrollControlled: true,
      builder: (_) => _StorePickerSheet(
        isDark: widget.isDark,
        colors: widget.colors,
        onStoreChanged: widget.onStoreChanged,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final name = store?.name ?? 'Select Store';
    final color = store != null ? _storeColor(name) : _kPrimary;

    return AccessibleTapRegion(
      label: store == null ? 'Select store' : 'Active store: $name',
      hint: 'Choose active store',
      onTap: _openStorePicker,
      excludeChildSemantics: true,
      child: InkWell(
        excludeFromSemantics: true,
        onTap: _openStorePicker,
        onHighlightChanged: (highlighted) {
          if (_pressed != highlighted) {
            setState(() => _pressed = highlighted);
          }
        },
        borderRadius: BorderRadius.circular(12),
        child: AnimatedScale(
          scale: _pressed ? 0.95 : 1.0,
          duration: const Duration(milliseconds: 130),
          curve: Curves.easeOut,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: widget.isDark
                  ? Colors.white.withValues(alpha: 0.06)
                  : Colors.black.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: widget.isDark
                    ? Colors.white.withValues(alpha: 0.10)
                    : Colors.black.withValues(alpha: 0.08),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Store logo square
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Center(
                    child: Text(
                      store != null ? _storeInitials(name) : '?',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Store name
                Flexible(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 120),
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: widget.colors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                Icon(
                  Icons.keyboard_arrow_down_rounded,
                  size: 16,
                  color: widget.colors.textSecondary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification bell
// ─────────────────────────────────────────────────────────────────────────────

class _NotificationBell extends StatefulWidget {
  const _NotificationBell({
    required this.isDark,
    required this.colors,
    this.onTap,
  });
  final bool isDark;
  final AppThemeColors colors;
  final VoidCallback? onTap;

  @override
  State<_NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<_NotificationBell> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    void openNotifications() {
      if (widget.onTap != null) {
        widget.onTap!();
      } else {
        Navigator.pushNamed(context, AppRoutes.notifications);
      }
    }

    return AccessibleTapRegion(
      label: 'Notifications',
      hint: 'Open notifications',
      onTap: openNotifications,
      child: InkWell(
        excludeFromSemantics: true,
        onTap: openNotifications,
        onHighlightChanged: (highlighted) {
          if (_pressed != highlighted) {
            setState(() => _pressed = highlighted);
          }
        },
        customBorder: const CircleBorder(),
        child: AnimatedScale(
          scale: _pressed ? 0.88 : 1.0,
          duration: const Duration(milliseconds: 130),
          curve: Curves.easeOut,
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: widget.isDark
                  ? Colors.white.withValues(alpha: 0.06)
                  : Colors.black.withValues(alpha: 0.04),
              shape: BoxShape.circle,
              border: Border.all(
                color: widget.isDark
                    ? Colors.white.withValues(alpha: 0.10)
                    : Colors.black.withValues(alpha: 0.08),
              ),
            ),
            child: Icon(
              Icons.notifications_outlined,
              size: 19,
              color: widget.colors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Account bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

class _AccountSheet extends StatelessWidget {
  const _AccountSheet({
    required this.auth,
    required this.isDark,
    required this.colors,
  });
  final StoreAuthService auth;
  final bool isDark;
  final AppThemeColors colors;

  String get _fullName => auth.currentUser?.fullName?.isNotEmpty == true
      ? auth.currentUser!.fullName!
      : auth.currentUser?.email?.split('@').first ?? 'Merchant';

  String get _email => auth.currentUser?.email ?? '';

  String get _initials {
    final name = _fullName.trim();
    final parts = name.split(RegExp(r'\s+'));
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : 'U';
  }

  @override
  Widget build(BuildContext context) {
    final sheetBg = isDark ? const Color(0xFF13111F) : Colors.white;
    final divider = isDark
        ? Colors.white.withValues(alpha: 0.08)
        : Colors.black.withValues(alpha: 0.06);

    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(
          color: sheetBg,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.5 : 0.12),
              blurRadius: 40,
              offset: const Offset(0, -8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.15)
                    : Colors.black.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Account card
            Container(
              margin: const EdgeInsets.fromLTRB(12, 12, 12, 4),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.05)
                    : Colors.black.withValues(alpha: 0.03),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : Colors.black.withValues(alpha: 0.06),
                ),
              ),
              child: Row(
                children: [
                  // Avatar
                  Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        _initials,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Name + email
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _fullName,
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _email,
                          style: TextStyle(
                            color: colors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // More button
                  Icon(
                    Icons.more_horiz_rounded,
                    color: colors.textTertiary,
                    size: 22,
                  ),
                ],
              ),
            ),

            Divider(height: 24, indent: 16, endIndent: 16, color: divider),

            // Add account
            _SheetAction(
              icon: Icons.add_circle_outline_rounded,
              label: 'Add account',
              isDark: isDark,
              colors: colors,
              onTap: () {
                Navigator.pop(context);
                // Navigate to login to add another account
                Navigator.pushNamed(context, AppRoutes.login);
              },
            ),

            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store picker bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

class _StorePickerSheet extends StatelessWidget {
  const _StorePickerSheet({
    required this.isDark,
    required this.colors,
    this.onStoreChanged,
  });
  final bool isDark;
  final AppThemeColors colors;
  final VoidCallback? onStoreChanged;

  static Color _storeColor(String name) {
    final hash = name.codeUnits.fold(0, (prev, c) => prev + c * 31);
    final hue = (hash % 360).abs().toDouble();
    return HSLColor.fromAHSL(1.0, hue, 0.65, 0.48).toColor();
  }

  String _storeInitials(String name) {
    final words = name.trim().split(RegExp(r'\s+'));
    if (words.length >= 2) return '${words[0][0]}${words[1][0]}'.toUpperCase();
    return name.substring(0, math.min(2, name.length)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final storeCtx = context.watch<StoreContext>();
    final stores = storeCtx.stores;
    final selected = storeCtx.selectedStore;
    final sheetBg = isDark ? const Color(0xFF13111F) : Colors.white;
    final divider = isDark
        ? Colors.white.withValues(alpha: 0.08)
        : Colors.black.withValues(alpha: 0.06);

    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(
          color: sheetBg,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.5 : 0.12),
              blurRadius: 40,
              offset: const Offset(0, -8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.15)
                    : Colors.black.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Store list
            if (stores.isEmpty)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'No stores found',
                  style: TextStyle(color: colors.textSecondary, fontSize: 15),
                ),
              )
            else
              for (final store in stores) ...[
                _StoreRow(
                  store: store,
                  isActive: store.id == selected?.id,
                  storeColor: _storeColor(store.name),
                  initials: _storeInitials(store.name),
                  isDark: isDark,
                  colors: colors,
                  onTap: () async {
                    await storeCtx.selectStore(store);
                    if (context.mounted) {
                      Navigator.pop(context);
                      onStoreChanged?.call();
                    }
                  },
                ),
              ],

            Divider(height: 24, indent: 16, endIndent: 16, color: divider),

            // Add store
            _SheetAction(
              icon: Icons.add_circle_outline_rounded,
              label: 'Add store',
              isDark: isDark,
              colors: colors,
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, AppRoutes.createStore);
              },
            ),

            const SizedBox(height: 6),

            // Edit stores
            _SheetAction(
              icon: Icons.edit_outlined,
              label: 'Edit stores',
              isDark: isDark,
              colors: colors,
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, AppRoutes.storeDetails);
              },
            ),

            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store row inside picker
// ─────────────────────────────────────────────────────────────────────────────

class _StoreRow extends StatefulWidget {
  const _StoreRow({
    required this.store,
    required this.isActive,
    required this.storeColor,
    required this.initials,
    required this.isDark,
    required this.colors,
    required this.onTap,
  });
  final StoreModel store;
  final bool isActive;
  final Color storeColor;
  final String initials;
  final bool isDark;
  final AppThemeColors colors;
  final VoidCallback onTap;

  @override
  State<_StoreRow> createState() => _StoreRowState();
}

class _StoreRowState extends State<_StoreRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return AccessibleTapRegion(
      label: widget.store.name,
      hint: widget.isActive
          ? 'Current store'
          : 'Switch to ${widget.store.name}',
      onTap: widget.onTap,
      selected: widget.isActive,
      excludeChildSemantics: true,
      child: InkWell(
        excludeFromSemantics: true,
        onTap: widget.onTap,
        onHighlightChanged: (highlighted) {
          if (_pressed != highlighted) {
            setState(() => _pressed = highlighted);
          }
        },
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          margin: const EdgeInsets.fromLTRB(12, 4, 12, 0),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: _pressed
                ? (widget.isDark
                      ? Colors.white.withValues(alpha: 0.07)
                      : Colors.black.withValues(alpha: 0.04))
                : (widget.isActive
                      ? (widget.isDark
                            ? Colors.white.withValues(alpha: 0.05)
                            : Colors.black.withValues(alpha: 0.03))
                      : Colors.transparent),
            borderRadius: BorderRadius.circular(14),
            border: widget.isActive
                ? Border.all(
                    color: widget.isDark
                        ? Colors.white.withValues(alpha: 0.08)
                        : Colors.black.withValues(alpha: 0.06),
                  )
                : null,
          ),
          child: Row(
            children: [
              // Store logo
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: widget.storeColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    widget.initials,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Name + url
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.store.name,
                      style: TextStyle(
                        color: widget.colors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${widget.store.subdomain}.letbuyy.com',
                      style: TextStyle(
                        color: widget.colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (widget.isActive)
                Container(
                  width: 20,
                  height: 20,
                  decoration: const BoxDecoration(
                    color: _kPrimary,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    color: Colors.white,
                    size: 13,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable sheet action row
// ─────────────────────────────────────────────────────────────────────────────

class _SheetAction extends StatefulWidget {
  const _SheetAction({
    required this.icon,
    required this.label,
    required this.isDark,
    required this.colors,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool isDark;
  final AppThemeColors colors;
  final VoidCallback onTap;

  @override
  State<_SheetAction> createState() => _SheetActionState();
}

class _SheetActionState extends State<_SheetAction> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return AccessibleTapRegion(
      label: widget.label,
      hint: 'Open ${widget.label}',
      onTap: widget.onTap,
      excludeChildSemantics: true,
      child: InkWell(
        excludeFromSemantics: true,
        onTap: widget.onTap,
        onHighlightChanged: (highlighted) {
          if (_pressed != highlighted) {
            setState(() => _pressed = highlighted);
          }
        },
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 130),
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(
            color: _pressed
                ? (widget.isDark
                      ? Colors.white.withValues(alpha: 0.06)
                      : Colors.black.withValues(alpha: 0.04))
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(widget.icon, size: 22, color: widget.colors.textPrimary),
              const SizedBox(width: 14),
              Text(
                widget.label,
                style: TextStyle(
                  color: widget.colors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
