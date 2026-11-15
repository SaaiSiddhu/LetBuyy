import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

import '../../app/store_context.dart';
import '../../services/api_client.dart' show ApiException;
import '../../services/store_service.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../../widgets/shared/warehouse_list_scaffold.dart';

class StoreHealthScreen extends StatefulWidget {
  const StoreHealthScreen({super.key});
  @override
  State<StoreHealthScreen> createState() => _StoreHealthScreenState();
}

class _StoreHealthScreenState extends State<StoreHealthScreen> {
  bool _loading = true;
  String? _error, _storeId;
  Map<String, dynamic>? _health;
  Object? _viewKey;
  int _generation = 0;
  MerchantStoreView? get _view =>
      _storeId == null ? null : (key: _viewKey, storeId: _storeId!);
  bool _matches(MerchantStoreView? view, int generation) =>
      mounted &&
      generation == _generation &&
      merchantStoreViewCurrent(context, view);

  @override
  void initState() {
    super.initState();
    _viewKey = context.read<StoreContext>().requestContextKey;
    _loadHealth();
  }

  Future<void> _loadHealth({bool retain = false}) async {
    if (!mounted) return;
    final keep = retain && merchantStoreViewCurrent(context, _view);
    final generation = ++_generation;
    final stores = context.read<StoreContext>();
    setState(() {
      _loading = true;
      _error = null;
      if (!keep) _health = null;
    });
    try {
      final store = await stores.ensureSelectedStore();
      if (!mounted ||
          generation != _generation ||
          _viewKey != stores.requestContextKey)
        return;
      if (store == null) {
        setState(() {
          _health = null;
          _storeId = null;
          _loading = false;
        });
        return;
      }
      _storeId = store.id;
      final view = _view;
      final health = await context.read<StoreService>().fetchStoreHealth(
        store.id,
      );
      if (!_matches(view, generation)) return;
      if (health['store_id'] != store.id) {
        throw const ApiException(
          message: 'Health assessment did not match the selected store.',
          statusCode: 403,
          code: 'HEALTH_SCOPE_MISMATCH',
        );
      }
      setState(() {
        _health = health;
        _loading = false;
      });
    } catch (error) {
      if (!mounted ||
          generation != _generation ||
          _viewKey != stores.requestContextKey)
        return;
      final denied =
          error is ApiException && [401, 403].contains(error.statusCode);
      setState(() {
        if (!keep || denied) _health = null;
        _error = 'Store health is unavailable right now.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    if (_viewKey != stores.requestContextKey) {
      _viewKey = stores.requestContextKey;
      ++_generation;
      _storeId = null;
      _health = null;
      _error = null;
      _loading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadHealth();
      });
    }
    final view = _view,
        generation = _generation,
        key = stores.requestContextKey;
    bool current() =>
        _matches(view, generation) && isLetbuyySurfaceCurrent(context);
    bool currentRead() =>
        mounted &&
        generation == _generation &&
        context.read<StoreContext>().requestContextKey == key &&
        isLetbuyySurfaceCurrent(context);
    final health = _health;
    final suppliedPillars = health?['pillars'];
    final pillars = (suppliedPillars is List ? suppliedPillars : const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
    return WarehouseListScaffold(
      title: 'Store Health',
      description: 'Setup and operating signals reported by your store.',
      refreshLabel: 'Refresh health',
      scrollIdentity: (_viewKey, _storeId),
      loading: _loading,
      onRefresh: _loading
          ? null
          : () async {
              if (currentRead() && !_loading) await _loadHealth(retain: true);
            },
      header: [
        if (_loading && health == null) const Text('Reading store health…'),
        if (_error != null) ...[
          const SizedBox(height: LetbuyySpacingTokens.space12),
          LetbuyyInlineFeedback(
            title: health == null
                ? 'Health unavailable'
                : 'Showing the last confirmed assessment. Refresh did not complete.',
            message: _error!,
            kind: LetbuyyFeedbackKind.error,
          ),
        ],
        if (health != null) ...[
          const SizedBox(height: LetbuyySpacingTokens.space16),
          _scorePanel(health),
          const SizedBox(height: LetbuyySpacingTokens.space12),
          Text(
            health['generated_at'] is String
                ? 'Assessment time: ${health['generated_at']}'
                : 'Assessment time unavailable.',
          ),
        ] else if (!_loading && _error == null)
          const Text('Select a store to view health signals.'),
      ],
      slivers: [
        if (health != null && pillars.isEmpty)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(LetbuyySpacingTokens.space16),
              child: Text(
                'No health signals were supplied in this assessment.',
              ),
            ),
          ),
        SliverPadding(
          padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
          sliver: SliverList.builder(
            itemCount: pillars.length,
            itemBuilder: (context, index) => _pillarTile(
              pillars[index],
              allowAction: !_loading && _error == null,
              current: current,
            ),
          ),
        ),
      ],
    );
  }

  bool _suppliedScore(Object? value) => value is num && value.isFinite;
  Widget _scorePanel(Map<String, dynamic> health) {
    final supplied = _suppliedScore(health['score']);
    final score = _intValue(supplied ? health['score'] : null);
    return StatTile(
      icon: Icons.health_and_safety_outlined,
      label: 'Overall score',
      value: supplied ? '$score/100' : 'Unavailable',
      supportingText: supplied ? _scoreLabel(score) : 'Score unavailable',
      color: supplied
          ? _scoreColor(score)
          : Theme.of(context).colorScheme.onSurfaceVariant,
    );
  }

  Widget _pillarTile(
    Map<String, dynamic> pillar, {
    required bool allowAction,
    required bool Function() current,
  }) {
    final score = _intValue(
      _suppliedScore(pillar['score']) ? pillar['score'] : null,
    );
    final status = (pillar['status'] ?? 'unknown').toString();
    final route = pillar['route']?.toString(),
        action = pillar['action_label']?.toString();
    final actionable = route != null && route.isNotEmpty && action != null;
    final supplied = status != 'unknown' && _suppliedScore(pillar['score']);
    final tone = switch (status) {
      'ready' => LetbuyyStatusTone.success,
      'attention' => LetbuyyStatusTone.warning,
      'blocked' => LetbuyyStatusTone.danger,
      _ => LetbuyyStatusTone.neutral,
    };
    return Card(
      margin: const EdgeInsets.only(bottom: LetbuyySpacingTokens.space12),
      child: Padding(
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Icon(
                    _statusIcon(status),
                    color: _statusColor(status, score),
                  ),
                ),
                const SizedBox(width: LetbuyySpacingTokens.space12),
                Expanded(
                  child: Text(
                    (pillar['label'] ?? 'Signal').toString(),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            Wrap(
              spacing: LetbuyySpacingTokens.space12,
              runSpacing: LetbuyySpacingTokens.space8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                LetbuyyStatusBadge(label: status, tone: tone),
                Text(supplied ? 'Score: $score/100' : 'Score unavailable'),
              ],
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            Text((pillar['summary'] ?? '').toString()),
            if (actionable)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton(
                  onPressed: !allowAction
                      ? null
                      : () {
                          if (current()) Navigator.pushNamed(context, route);
                        },
                  child: Text(action),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // Original score normalization, thresholds, labels and status-icon meaning.
  int _intValue(Object? value) {
    if (value is int) return value.clamp(0, 100);
    if (value is num) return value.round().clamp(0, 100);
    return 0;
  }

  Color _scoreColor(int score) {
    if (score >= 85)
      return LetbuyyStatusColors.of(
        context,
        LetbuyyStatusTone.success,
      ).foreground;
    if (score >= 50)
      return LetbuyyStatusColors.of(
        context,
        LetbuyyStatusTone.warning,
      ).foreground;
    return LetbuyyStatusColors.of(context, LetbuyyStatusTone.danger).foreground;
  }

  String _scoreLabel(int score) {
    if (score >= 85) return 'Ready';
    if (score >= 50) return 'Needs attention';
    return 'Action needed';
  }

  Color _statusColor(String status, int score) {
    if (status == 'unknown')
      return LetbuyyStatusColors.of(
        context,
        LetbuyyStatusTone.neutral,
      ).foreground;
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
