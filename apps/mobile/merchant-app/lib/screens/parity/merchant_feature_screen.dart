import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../services/api_client.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import 'merchant_feature_definitions.dart';

class MerchantFeatureScreen extends StatefulWidget {
  final MerchantFeatureDefinition feature;

  const MerchantFeatureScreen({super.key, required this.feature});

  @override
  State<MerchantFeatureScreen> createState() => _MerchantFeatureScreenState();
}

class _MerchantFeatureScreenState extends State<MerchantFeatureScreen> {
  bool _isLoading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      if (!widget.feature.hasEndpoint) {
        setState(() => _rows = const []);
        return;
      }

      final query = Map<String, String>.from(widget.feature.query);
      if (widget.feature.requiresStore) {
        final store = await context.read<StoreService>().getFirstStore();
        if (store == null) {
          setState(() {
            _rows = const [];
            _error = 'No authenticated store is available for this screen.';
          });
          return;
        }
        query['store_id'] = store.id;
      }
      query.putIfAbsent('limit', () => '20');

      final response = await context.read<ApiClient>().get(
        widget.feature.endpoint!,
        query: query,
      );
      setState(() => _rows = _extractRows(response));
    } catch (error) {
      setState(() {
        _rows = const [];
        _error = error.toString();
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<Map<String, dynamic>> _extractRows(Object? response) {
    if (response is List) {
      return response
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList(growable: false);
    }
    if (response is Map) {
      final data = response['data'];
      if (data is List) {
        return data
            .whereType<Map>()
            .map((row) => Map<String, dynamic>.from(row))
            .toList(growable: false);
      }
      if (data is Map) return [Map<String, dynamic>.from(data)];
      return [Map<String, dynamic>.from(response)];
    }
    return const [];
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(colors),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  child: _isLoading
                      ? ListView(
                          children: const [
                            SizedBox(height: 180),
                            Center(child: CircularProgressIndicator()),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                          children: [
                            _buildSummary(colors),
                            const SizedBox(height: 16),
                            if (_rows.isNotEmpty)
                              ..._rows.map(
                                (row) => _FeatureRowCard(
                                  row: row,
                                  feature: widget.feature,
                                ),
                              )
                            else
                              _FeaturePlaceholder(
                                feature: widget.feature,
                                error: _error,
                              ),
                          ],
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(AppThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back, color: colors.textPrimary),
            onPressed: () => Navigator.maybePop(context),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.feature.title,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  widget.feature.group,
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: _load,
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            tooltip: 'Refresh',
          ),
        ],
      ),
    );
  }

  Widget _buildSummary(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.divider),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(widget.feature.icon, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.feature.summary,
                  style: TextStyle(color: colors.textPrimary, fontSize: 13),
                ),
                const SizedBox(height: 8),
                Text(
                  widget.feature.hasEndpoint
                      ? '/v1/${widget.feature.endpoint}'
                      : '[SKIP - NEEDS BACKEND]',
                  style: TextStyle(
                    color: colors.textTertiary,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureRowCard extends StatelessWidget {
  final Map<String, dynamic> row;
  final MerchantFeatureDefinition feature;

  const _FeatureRowCard({required this.row, required this.feature});

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final title = _firstValue(feature.titleKeys) ?? 'Record';
    final subtitle = _firstValue(feature.subtitleKeys);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.divider),
      ),
      child: Row(
        children: [
          Icon(feature.icon, color: colors.textSecondary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String? _firstValue(List<String> keys) {
    for (final key in keys) {
      final value = row[key];
      if (value == null) continue;
      final text = value.toString();
      if (text.isNotEmpty) return text;
    }
    return null;
  }
}

class _FeaturePlaceholder extends StatelessWidget {
  final MerchantFeatureDefinition feature;
  final String? error;

  const _FeaturePlaceholder({required this.feature, this.error});

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final hasEndpoint = feature.hasEndpoint;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                hasEndpoint ? Icons.inbox_outlined : Icons.construction_rounded,
                color: hasEndpoint ? colors.textSecondary : colors.warning,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  hasEndpoint
                      ? 'No records available'
                      : '[SKIP - NEEDS BACKEND]',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            error ?? feature.backendRequirement,
            style: TextStyle(color: colors.textSecondary, fontSize: 13),
          ),
          if (hasEndpoint && error != null) ...[
            const SizedBox(height: 10),
            Text(
              feature.backendRequirement,
              style: TextStyle(color: colors.textTertiary, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}
