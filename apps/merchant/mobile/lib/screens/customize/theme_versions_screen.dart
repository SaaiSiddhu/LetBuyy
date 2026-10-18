import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../services/theme_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class ThemeVersionsScreen extends StatefulWidget {
  const ThemeVersionsScreen({
    super.key,
    required this.storeId,
    required this.themeSlug,
    required this.themeName,
  });

  final String storeId;
  final String themeSlug;
  final String themeName;

  @override
  State<ThemeVersionsScreen> createState() => _ThemeVersionsScreenState();
}

class _ThemeVersionsScreenState extends State<ThemeVersionsScreen> {
  List<_ThemeReleaseView> _releases = const [];
  bool _isLoading = true;
  bool _isRollingBack = false;
  bool _changed = false;
  Object? _loadedContext;
  bool _hasLoadedContext = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadReleases();
  }

  Future<void> _loadReleases() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final service = context.read<ThemeService>();
      final captured = service.captureContext();
      final rows = await service.fetchReleases(
        storeId: widget.storeId,
        themeSlug: widget.themeSlug,
      );
      final releases =
          rows
              .map(_ThemeReleaseView.fromJson)
              .where((release) => release.id.isNotEmpty)
              .toList()
            ..sort((a, b) {
              if (a.version != b.version) return b.version.compareTo(a.version);
              final aDate = a.publishedAt;
              final bDate = b.publishedAt;
              if (aDate == null && bDate == null) return 0;
              if (aDate == null) return 1;
              if (bDate == null) return -1;
              return bDate.compareTo(aDate);
            });

      if (!mounted) return;
      if (service.captureContext() != captured)
        throw StateError(
          'The active account or store changed. Reload releases.',
        );
      setState(() {
        _releases = releases;
        _loadedContext = captured;
        _hasLoadedContext = true;
      });
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error =
            'Unable to load theme versions. Pull to refresh or try again.',
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _rollbackRelease(_ThemeReleaseView release) async {
    final service = context.read<ThemeService>();
    final captured = _loadedContext;
    if (!_hasLoadedContext || service.captureContext() != captured) {
      _showMessage(
        'The active account or store changed. Reload releases.',
        isError: true,
      );
      return;
    }
    final pending = service.pendingRollbackTarget(
      widget.storeId,
      widget.themeSlug,
    );
    if (pending != null && pending != release.id) {
      _showMessage(
        'Recover the previous rollback before restoring another release.',
        isError: true,
      );
      return;
    }
    if (pending != null) {
      await _recoverPendingRollback();
      return;
    }
    final current = _releases.where((item) => item.isCurrent).toList();
    if (pending == null && (current.length != 1 || release.isCurrent)) {
      _showMessage(
        'Refresh and review a previous release before restoring.',
        isError: true,
      );
      return;
    }
    final confirmed = await _confirmRollback(release);
    if (confirmed != true || _isRollingBack || !mounted) return;
    setState(() => _isRollingBack = true);
    try {
      if (service.captureContext() != captured)
        throw StateError(
          'The active account or store changed. Reload releases.',
        );
      final result = await service.rollbackRelease(
        storeId: widget.storeId,
        themeSlug: widget.themeSlug,
        releaseId: release.id,
        expectedCurrentReleaseId: current.single.id,
        expectedContext: captured,
        rollbackMessage: 'Rolled back from mobile theme versions',
      );
      if (service.captureContext() != captured)
        throw StateError(
          'The active account or store changed. Reload releases.',
        );
      _changed = true;
      await _loadReleases();
      if (!mounted || service.captureContext() != captured) return;
      final committed = result['rollback'] as Map;
      _showMessage(
        result['current_release_id'] == committed['release_id']
            ? 'Theme rolled back to v${release.version}'
            : 'Rollback confirmed; a newer release is now live.',
        isSuccess: true,
      );
    } catch (error) {
      if (mounted && service.captureContext() == captured)
        _showMessage(
          'Rollback was not confirmed. Recover the same request before trying another release.',
          isError: true,
        );
    } finally {
      if (mounted) setState(() => _isRollingBack = false);
    }
  }

  Future<void> _recoverPendingRollback() async {
    final service = context.read<ThemeService>(), captured = _loadedContext;
    if (!_hasLoadedContext ||
        _isRollingBack ||
        service.captureContext() != captured ||
        service.pendingRollbackTarget(widget.storeId, widget.themeSlug) == null)
      return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Recover rollback?'),
        content: const Text(
          'Recover the saved request for your earlier rollback.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Recover rollback'),
          ),
        ],
      ),
    );
    if (confirmed != true ||
        !mounted ||
        service.captureContext() != captured ||
        _isRollingBack)
      return;
    setState(() => _isRollingBack = true);
    try {
      final result = await service.recoverRollback(
        storeId: widget.storeId,
        themeSlug: widget.themeSlug,
      );
      if (!mounted || service.captureContext() != captured) return;
      _changed = true;
      await _loadReleases();
      if (!mounted || service.captureContext() != captured) return;
      final committed = result['rollback'] as Map;
      _showMessage(
        result['current_release_id'] == committed['release_id']
            ? 'Rollback confirmed.'
            : 'Rollback confirmed; a newer release is now live.',
        isSuccess: true,
      );
    } catch (_) {
      if (mounted && service.captureContext() == captured)
        _showMessage(
          'Rollback was not confirmed. Recover the same request before restoring another release.',
          isError: true,
        );
    } finally {
      if (mounted) setState(() => _isRollingBack = false);
    }
  }

  Future<bool?> _confirmRollback(_ThemeReleaseView release) {
    final colors = AppThemeColors.of(context);
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(
          'Roll back theme?',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Text(
          'Publish version ${release.version} as the live storefront theme.',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Roll back'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _loadReleases,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
              children: [
                _buildHeader(colors),
                const SizedBox(height: 16),
                if (!_isLoading &&
                    _error == null &&
                    context.read<ThemeService>().pendingRollbackTarget(
                          widget.storeId,
                          widget.themeSlug,
                        ) !=
                        null &&
                    !_releases.any(
                      (release) =>
                          release.id ==
                          context.read<ThemeService>().pendingRollbackTarget(
                            widget.storeId,
                            widget.themeSlug,
                          ),
                    ))
                  TextButton.icon(
                    onPressed: _isRollingBack ? null : _recoverPendingRollback,
                    icon: const Icon(Icons.restore_rounded),
                    label: const Text('Recover rollback'),
                  ),
                if (_isLoading)
                  _buildLoading(colors)
                else if (_error != null)
                  _buildError(colors)
                else if (_releases.isEmpty)
                  _buildEmpty(colors)
                else
                  ..._releases.map((release) => _buildReleaseCard(release)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(AppThemeColors colors) {
    return Row(
      children: [
        IconButton(
          onPressed: () => Navigator.pop(context, _changed),
          icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
          tooltip: 'Back',
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Theme versions',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                widget.themeName,
                style: TextStyle(color: colors.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: _isLoading || _isRollingBack ? null : _loadReleases,
          icon: Icon(Icons.refresh_rounded, color: colors.textPrimary),
          tooltip: 'Refresh versions',
        ),
      ],
    );
  }

  Widget _buildLoading(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: _panelDecoration(colors),
      child: const Center(child: CircularProgressIndicator()),
    );
  }

  Widget _buildError(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _panelDecoration(colors),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline_rounded, color: colors.error),
          const SizedBox(height: 10),
          Text(
            _error!,
            style: TextStyle(color: colors.textPrimary, fontSize: 13),
          ),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: _loadReleases,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _panelDecoration(colors),
      child: Column(
        children: [
          Icon(Icons.history_rounded, color: colors.textSecondary, size: 32),
          const SizedBox(height: 8),
          Text(
            'No versions yet',
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Published theme releases will appear here for mobile rollback.',
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildReleaseCard(_ThemeReleaseView release) {
    final colors = AppThemeColors.of(context);
    final recovering =
        context.read<ThemeService>().pendingRollbackTarget(
          widget.storeId,
          widget.themeSlug,
        ) ==
        release.id;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(colors),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Version ${release.version}',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              _StatusPill(
                text: release.statusLabel,
                color: release.statusColor(colors),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            release.dateLabel,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
          if (release.message.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              release.message,
              style: TextStyle(color: colors.textSecondary, fontSize: 13),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  release.id,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textTertiary, fontSize: 11),
                ),
              ),
              TextButton.icon(
                onPressed: _isRollingBack || (release.isCurrent && !recovering)
                    ? null
                    : () => _rollbackRelease(release),
                icon: const Icon(Icons.restore_rounded, size: 16),
                label: Text(recovering ? 'Recover rollback' : 'Roll back'),
                style: TextButton.styleFrom(
                  foregroundColor: LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  BoxDecoration _panelDecoration(AppThemeColors colors) {
    return BoxDecoration(
      color: colors.card,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: colors.divider),
    );
  }

  void _showMessage(
    String message, {
    bool isSuccess = false,
    bool isError = false,
  }) {
    if (!mounted) return;
    final colors = AppThemeColors.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? colors.error
            : (isSuccess ? colors.success : colors.card),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

class _ThemeReleaseView {
  const _ThemeReleaseView({
    required this.id,
    required this.version,
    required this.status,
    required this.isCurrent,
    required this.publishedAt,
    required this.message,
  });

  final String id;
  final int version;
  final String status;
  final bool isCurrent;
  final DateTime? publishedAt;
  final String message;

  factory _ThemeReleaseView.fromJson(Map<String, dynamic> json) {
    final manifest = json['release_manifest'] is Map
        ? Map<String, dynamic>.from(json['release_manifest'] as Map)
        : const <String, dynamic>{};
    final rawDate =
        json['published_at']?.toString() ??
        json['released_at']?.toString() ??
        json['created_at']?.toString();
    final rawStatus =
        json['release_status']?.toString() ??
        json['status']?.toString() ??
        'published';

    return _ThemeReleaseView(
      id:
          json['id']?.toString() ??
          json['release_id']?.toString() ??
          json['theme_release_id']?.toString() ??
          '',
      version:
          (json['release_version'] as num?)?.toInt() ??
          (json['version'] as num?)?.toInt() ??
          0,
      status: rawStatus,
      isCurrent: json['is_current'] == true || rawStatus == 'current',
      publishedAt: rawDate == null ? null : DateTime.tryParse(rawDate),
      message:
          json['rollback_message']?.toString() ??
          json['message']?.toString() ??
          manifest['message']?.toString() ??
          '',
    );
  }

  String get statusLabel {
    final normalized = status.trim().replaceAll('_', ' ');
    if (normalized.isEmpty) return 'Published';
    return normalized
        .split(' ')
        .where((part) => part.isNotEmpty)
        .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
        .join(' ');
  }

  String get dateLabel {
    if (publishedAt == null) return 'Published date unavailable';
    return 'Published ${DateFormat('MMM d, yyyy h:mm a').format(publishedAt!.toLocal())}';
  }

  Color statusColor(AppThemeColors colors) {
    switch (status.toLowerCase()) {
      case 'rolled_back':
      case 'rollback':
        return colors.warning;
      case 'failed':
        return colors.error;
      default:
        return colors.success;
    }
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
