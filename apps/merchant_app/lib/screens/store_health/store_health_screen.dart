import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class StoreHealthScreen extends StatefulWidget {
  const StoreHealthScreen({super.key});

  @override
  State<StoreHealthScreen> createState() => _StoreHealthScreenState();
}

class _StoreHealthScreenState extends State<StoreHealthScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _health;

  @override
  void initState() {
    super.initState();
    _loadHealth();
  }

  Future<void> _loadHealth() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store == null) {
        setState(() {
          _health = null;
          _loading = false;
        });
        return;
      }
      final health = await context.read<StoreService>().fetchStoreHealth(
        store.id,
      );
      if (!mounted) return;
      setState(() {
        _health = health;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Store health is unavailable right now.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(colors),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.lavender,
                        ),
                      )
                    : _body(colors),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(AppThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
            onPressed: () => Navigator.pop(context),
          ),
          Expanded(
            child: Text(
              'Store Health',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loadHealth,
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _body(AppThemeColors colors) {
    if (_error != null) {
      return _emptyState(colors, _error!, Icons.health_and_safety_outlined);
    }

    final health = _health;
    if (health == null) {
      return _emptyState(
        colors,
        'Select a store to view health signals.',
        Icons.storefront_outlined,
      );
    }

    final score = _intValue(health['score']);
    final pillars = (health['pillars'] as List? ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);

    return RefreshIndicator(
      onRefresh: _loadHealth,
      color: AppColors.lavender,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          _scorePanel(colors, score),
          const SizedBox(height: 16),
          if (pillars.isEmpty)
            _emptyState(
              colors,
              'Health signals will appear after store activity is available.',
              Icons.insights_outlined,
            )
          else
            for (final pillar in pillars) ...[
              _pillarTile(colors, pillar),
              const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }

  Widget _scorePanel(AppThemeColors colors, int score) {
    final color = _scoreColor(score);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.divider),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 86,
            height: 86,
            child: Stack(
              fit: StackFit.expand,
              children: [
                CircularProgressIndicator(
                  value: score / 100,
                  strokeWidth: 8,
                  backgroundColor: colors.surfaceVariant,
                  color: color,
                ),
                Center(
                  child: Text(
                    '$score',
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _scoreLabel(score),
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Based on live setup, catalog, order, domain, and review signals.',
                  style: TextStyle(color: colors.textSecondary, height: 1.35),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pillarTile(AppThemeColors colors, Map<String, dynamic> pillar) {
    final score = _intValue(pillar['score']);
    final status = (pillar['status'] ?? 'unknown').toString();
    final route = pillar['route']?.toString();
    final action = pillar['action_label']?.toString();
    final actionable = route != null && route.isNotEmpty && action != null;

    return InkWell(
      onTap: actionable ? () => Navigator.pushNamed(context, route) : null,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colors.divider),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _statusColor(status, score).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _statusIcon(status),
                color: _statusColor(status, score),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          (pillar['label'] ?? 'Signal').toString(),
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text(
                        status == 'unknown' ? '--' : '$score',
                        style: TextStyle(
                          color: colors.textSecondary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    (pillar['summary'] ?? '').toString(),
                    style: TextStyle(color: colors.textSecondary, height: 1.35),
                  ),
                  if (actionable) ...[
                    const SizedBox(height: 10),
                    Text(
                      action,
                      style: const TextStyle(
                        color: AppColors.lavender,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState(AppThemeColors colors, String message, IconData icon) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 42),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  int _intValue(Object? value) {
    if (value is int) return value.clamp(0, 100);
    if (value is num) return value.round().clamp(0, 100);
    return 0;
  }

  Color _scoreColor(int score) {
    if (score >= 85) return const Color(0xFF16A34A);
    if (score >= 50) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  String _scoreLabel(int score) {
    if (score >= 85) return 'Ready';
    if (score >= 50) return 'Needs attention';
    return 'Action needed';
  }

  Color _statusColor(String status, int score) {
    if (status == 'unknown') return const Color(0xFF64748B);
    return _scoreColor(score);
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'ready':
        return Icons.check_circle_outline_rounded;
      case 'attention':
        return Icons.error_outline_rounded;
      case 'blocked':
        return Icons.warning_amber_rounded;
      default:
        return Icons.help_outline_rounded;
    }
  }
}
