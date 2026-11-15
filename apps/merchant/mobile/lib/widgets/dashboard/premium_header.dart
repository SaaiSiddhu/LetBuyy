import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import '../../app/routes.dart';
import '../../app/store_context.dart';
import '../../models/store_model.dart';
import '../../services/store_auth_service.dart';
import '../../theme/app_theme_colors.dart';
import '../shared/accessible_tap_region.dart';

// Retained only by the unused pre-migration row helpers below. Cleanup follows
// replacement native qualification; the active header uses ThemeData.
const _kPrimary = LetbuyyColorTokens.brandPrimary;

class PremiumHeader extends StatelessWidget {
  const PremiumHeader({
    super.key,
    required this.isDark,
    this.onStoreChanged,
    this.onNotificationTap,
  });
  final bool isDark; // Caller compatibility; ThemeData owns current appearance.
  final VoidCallback? onStoreChanged, onNotificationTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(
      horizontal: LetbuyySpacingTokens.space16,
      vertical: LetbuyySpacingTokens.space8,
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _ProfileAvatar(),
        const SizedBox(width: LetbuyySpacingTokens.space8),
        Expanded(child: _StorePill(onStoreChanged: onStoreChanged)),
        const SizedBox(width: LetbuyySpacingTokens.space8),
        _NotificationBell(onTap: onNotificationTap),
      ],
    ),
  );
}

class _ProfileAvatar extends StatefulWidget {
  const _ProfileAvatar();
  @override
  State<_ProfileAvatar> createState() => _ProfileAvatarState();
}

class _ProfileAvatarState extends State<_ProfileAvatar> {
  final _focus = FocusNode(debugLabel: 'Merchant account');
  bool _opening = false;
  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  Future<void> _openAccountSheet() async {
    if (_opening) return;
    final auth = context.read<StoreAuthService>(),
        stores = context.read<StoreContext>();
    if (auth.accountTransition) return;
    final viewKey = stores.requestContextKey, actorId = auth.currentUser?.id;
    setState(() => _opening = true);
    HapticFeedback.selectionClick();
    try {
      final action = await showLetbuyyFormSheet<_AccountAction>(
        context: context,
        builder: (_) => _AccountSheet(viewKey: viewKey, actorId: actorId),
      );
      if (!mounted ||
          stores.requestContextKey != viewKey ||
          auth.accountTransition ||
          auth.currentUser?.id != actorId)
        return;
      if (action == _AccountAction.add)
        Navigator.pushNamed(context, AppRoutes.login);
    } finally {
      if (mounted) {
        setState(() => _opening = false);
        if (ModalRoute.of(context)?.isCurrent ?? true) _focus.requestFocus();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<StoreAuthService>(), theme = Theme.of(context);
    final user = auth.currentUser;
    final name = user?.fullName?.trim();
    final parts = (name?.isNotEmpty == true ? name! : user?.email ?? '')
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    String initial(String value) =>
        String.fromCharCode(value.runes.first).toUpperCase();
    final initials = parts.isEmpty
        ? 'U'
        : parts.length > 1
        ? '${initial(parts[0])}${initial(parts[1])}'
        : initial(parts[0]);
    final action = _opening || auth.accountTransition
        ? null
        : _openAccountSheet;
    return AccessibleTapRegion(
      label: 'Account',
      hint: 'Open account menu',
      onTap: action,
      focusNode: _focus,
      excludeChildSemantics: true,
      child: IconButton(
        focusNode: _focus,
        onPressed: action,
        style: IconButton.styleFrom(
          minimumSize: const Size.square(LetbuyySpacingTokens.space48),
        ),
        icon: ExcludeSemantics(
          child: CircleAvatar(
            radius: 18,
            backgroundColor: theme.colorScheme.primary,
            foregroundColor: theme.colorScheme.onPrimary,
            child: MediaQuery.textScalerOf(context).scale(1) > 1.5
                ? const Icon(Icons.person_outline)
                : Text(
                    initials,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: theme.colorScheme.onPrimary,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

enum _AccountAction { add }

class _AccountSheet extends StatelessWidget {
  const _AccountSheet({required this.viewKey, required this.actorId});
  final Object viewKey;
  final String? actorId;
  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>(),
        auth = context.watch<StoreAuthService>();
    if (stores.requestContextKey != viewKey ||
        auth.accountTransition ||
        auth.currentUser?.id != actorId) {
      return const LetbuyyFormSheet(
        title: 'Store access changed',
        child: Text('Close this menu and reopen it from your current account.'),
      );
    }
    final user = auth.currentUser, theme = Theme.of(context);
    final name = user?.fullName?.isNotEmpty == true
        ? user!.fullName!
        : user?.email.split('@').first ?? 'Merchant';
    return LetbuyyFormSheet(
      title: 'Account',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(name, style: theme.textTheme.titleMedium),
          if (user?.email.isNotEmpty == true) ...[
            const SizedBox(height: LetbuyySpacingTokens.space8),
            Text(user!.email, style: theme.textTheme.bodyMedium),
          ],
          const SizedBox(height: LetbuyySpacingTokens.space16),
          AccessibleTapRegion(
            label: 'Add account',
            hint: 'Open Add account',
            onTap: () => Navigator.pop(context, _AccountAction.add),
            child: TextButton.icon(
              onPressed: () => Navigator.pop(context, _AccountAction.add),
              icon: const Icon(Icons.person_add_outlined),
              label: const ExcludeSemantics(child: Text('Add account')),
            ),
          ),
        ],
      ),
    );
  }
}

class _StorePill extends StatefulWidget {
  const _StorePill({this.onStoreChanged});
  final VoidCallback? onStoreChanged;
  @override
  State<_StorePill> createState() => _StorePillState();
}

class _StorePillState extends State<_StorePill> {
  final _focus = FocusNode(debugLabel: 'Merchant store selection');
  bool _opening = false;
  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  Future<void> _openStorePicker() async {
    if (_opening) return;
    final stores = context.read<StoreContext>(),
        auth = context.read<StoreAuthService>();
    if (auth.accountTransition) return;
    final viewKey = stores.requestContextKey,
        epoch = stores.requestContextVersion,
        actorId = auth.currentUser?.id;
    setState(() => _opening = true);
    HapticFeedback.selectionClick();
    try {
      final result = await showLetbuyyFormSheet<_StorePickerResult>(
        context: context,
        builder: (_) => _StorePickerSheet(viewKey: viewKey, actorId: actorId),
      );
      if (!mounted ||
          result == null ||
          auth.accountTransition ||
          auth.currentUser?.id != actorId ||
          stores.requestContextVersion != epoch)
        return;
      if (result.route != null) {
        if (stores.requestContextKey == viewKey)
          Navigator.pushNamed(context, result.route!);
      } else if (result.storeId != null &&
          stores.selectedStoreId == result.storeId) {
        widget.onStoreChanged?.call();
      }
    } finally {
      if (mounted) {
        setState(() => _opening = false);
        if (ModalRoute.of(context)?.isCurrent ?? true) _focus.requestFocus();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>(),
        auth = context.watch<StoreAuthService>();
    final store = stores.selectedStore;
    final action = _opening || auth.accountTransition ? null : _openStorePicker;
    return AccessibleTapRegion(
      label: store == null ? 'Select store' : 'Active store: ${store.name}',
      hint: 'Choose active store',
      onTap: action,
      focusNode: _focus,
      excludeChildSemantics: true,
      child: TextButton.icon(
        focusNode: _focus,
        onPressed: action,
        style: TextButton.styleFrom(
          minimumSize: const Size.square(LetbuyySpacingTokens.space48),
        ),
        icon: const Icon(Icons.storefront_outlined),
        label: ExcludeSemantics(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(child: Text(store?.name ?? 'Select Store')),
              const SizedBox(width: LetbuyySpacingTokens.space4),
              const Icon(Icons.expand_more),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationBell extends StatefulWidget {
  const _NotificationBell({this.onTap});
  final VoidCallback? onTap;
  @override
  State<_NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<_NotificationBell> {
  final _focus = FocusNode(debugLabel: 'Merchant notifications');
  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    void open() => widget.onTap != null
        ? widget.onTap!()
        : Navigator.pushNamed(context, AppRoutes.notifications);
    return AccessibleTapRegion(
      label: 'Notifications',
      hint: 'Open notifications',
      onTap: open,
      focusNode: _focus,
      excludeChildSemantics: true,
      child: IconButton(
        focusNode: _focus,
        onPressed: open,
        style: IconButton.styleFrom(
          minimumSize: const Size.square(LetbuyySpacingTokens.space48),
        ),
        icon: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}

class _StorePickerResult {
  const _StorePickerResult.selection(this.storeId) : route = null;
  const _StorePickerResult.destination(this.route) : storeId = null;
  final String? storeId, route;
}

class _StorePickerSheet extends StatefulWidget {
  const _StorePickerSheet({required this.viewKey, required this.actorId});
  final Object viewKey;
  final String? actorId;
  @override
  State<_StorePickerSheet> createState() => _StorePickerSheetState();
}

class _StorePickerSheetState extends State<_StorePickerSheet> {
  late final StoreContext _stores;
  late final int _epoch;
  Object? _ownFrame;
  String? _draft, _error;
  bool _saving = false;
  @override
  void initState() {
    super.initState();
    _stores = context.read<StoreContext>();
    _epoch = _stores.requestContextVersion;
    _draft = _stores.selectedStoreId;
  }

  bool get _sameActor {
    if (!mounted) return false;
    final auth = context.read<StoreAuthService>();
    return _stores.requestContextVersion == _epoch &&
        !auth.accountTransition &&
        auth.currentUser?.id == widget.actorId;
  }

  bool get _allowed =>
      _sameActor &&
      (_stores.requestContextKey == widget.viewKey ||
          (_ownFrame != null && _stores.requestContextKey == _ownFrame));
  Future<void> _apply() async {
    if (_saving || !_allowed || _draft == null) return;
    StoreModel? target;
    for (final store in _stores.stores) {
      if (store.id == _draft) {
        target = store;
        break;
      }
    }
    if (target == null) {
      setState(
        () => _error =
            'This store is no longer in the loaded choices. Close and refresh store access.',
      );
      return;
    }
    if (_ownFrame == null && target.id == _stores.selectedStoreId) {
      Navigator.pop(context);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final request = _stores.selectStore(target);
      _ownFrame = _stores.requestContextKey;
      await request;
      if (!mounted || !_allowed || _stores.selectedStoreId != target.id) return;
      Navigator.pop(context, _StorePickerResult.selection(target.id));
    } catch (_) {
      if (mounted && _allowed)
        setState(
          () => _error = _stores.selectedStoreId == target!.id
              ? 'The store is selected for this session, but saving its device preference could not be confirmed. Check the selected store before retrying.'
              : 'The store could not be selected. Close and refresh store access.',
        );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    context.watch<StoreAuthService>();
    if (!_allowed)
      return const LetbuyyFormSheet(
        title: 'Store access changed',
        child: Text(
          'Close this picker and reopen it from your current account.',
        ),
      );
    final choices = _stores.stores;
    return LetbuyyFormSheet(
      title: 'Choose store',
      description: 'Stores loaded for this account.',
      canDismiss: !_saving,
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving || _draft == null ? null : _apply,
          child: Text(_saving ? 'Applying…' : 'Apply selection'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (choices.isEmpty) const Text('No stores are loaded.'),
          RadioGroup<String>(
            groupValue: _draft,
            onChanged: (value) {
              if (!_saving && value != null) setState(() => _draft = value);
            },
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final store in choices)
                  RadioListTile<String>(
                    value: store.id,
                    enabled: !_saving,
                    title: Text(store.name),
                    subtitle: Text(store.publicUrl),
                  ),
              ],
            ),
          ),
          if (_error != null)
            Semantics(
              liveRegion: true,
              child: Text(
                _error!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
            ),
          const SizedBox(height: LetbuyySpacingTokens.space16),
          TextButton.icon(
            onPressed: _saving
                ? null
                : () => Navigator.pop(
                    context,
                    const _StorePickerResult.destination(AppRoutes.createStore),
                  ),
            icon: const Icon(Icons.add),
            label: const Text('Add store'),
          ),
          TextButton.icon(
            onPressed: _saving || _stores.selectedStoreId == null
                ? null
                : () => Navigator.pop(
                    context,
                    const _StorePickerResult.destination(
                      AppRoutes.storeDetails,
                    ),
                  ),
            icon: const Icon(Icons.edit_outlined),
            label: const Text('Edit stores'),
          ),
        ],
      ),
    );
  }
}

// Pre-migration private row helpers remain unreachable until the new header's
// native integration/cleanup gate is qualified. No active caller below.
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
                      widget.store.publicUrl.replaceFirst(
                        RegExp(r'^https?://'),
                        '',
                      ),
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
