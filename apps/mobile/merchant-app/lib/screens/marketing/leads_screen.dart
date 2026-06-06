import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/form_submission_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class LeadsScreen extends StatefulWidget {
  const LeadsScreen({super.key});

  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  static const _types = ['all', 'contact', 'lead'];
  static const _statuses = [
    'all',
    'new',
    'read',
    'contacted',
    'converted',
    'archived',
    'spam',
  ];

  List<FormSubmissionContract> _submissions = const [];
  String _type = 'all';
  String _status = 'all';
  String? _storeId;
  String? _error;
  bool _isLoading = true;

  late AppThemeColors colors;

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
      _storeId ??= (await context.read<StoreService>().getFirstStore())?.id;
      if (_storeId == null) {
        if (mounted) {
          setState(() {
            _submissions = const [];
            _isLoading = false;
          });
        }
        return;
      }

      final submissions = await context
          .read<FormSubmissionService>()
          .fetchSubmissions(_storeId!, type: _type, status: _status);
      if (mounted) {
        setState(() {
          _submissions = submissions;
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
              _typeFilters(),
              _statusFilters(),
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
          IconButton(
            tooltip: 'Back',
            icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
            onPressed: () => Navigator.maybePop(context),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Leads',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Storefront forms and follow-up status',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh leads',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _typeFilters() {
    return SizedBox(
      height: 48,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final type = _types[index];
          return _filterChip(
            label: _titleCase(type),
            selected: _type == type,
            onSelected: () {
              setState(() => _type = type);
              _load();
            },
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: _types.length,
      ),
    );
  }

  Widget _statusFilters() {
    final counts = <String, int>{'all': _submissions.length};
    for (final submission in _submissions) {
      counts[submission.status] = (counts[submission.status] ?? 0) + 1;
    }

    return SizedBox(
      height: 48,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final status = _statuses[index];
          return _filterChip(
            label: '${_titleCase(status)} ${counts[status] ?? 0}',
            selected: _status == status,
            onSelected: () {
              setState(() => _status = status);
              _load();
            },
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: _statuses.length,
      ),
    );
  }

  Widget _filterChip({
    required String label,
    required bool selected,
    required VoidCallback onSelected,
  }) {
    return ChoiceChip(
      selected: selected,
      onSelected: (_) => onSelected(),
      label: Text(label),
      backgroundColor: colors.card,
      selectedColor: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
        alpha: 0.16,
      ),
      side: BorderSide(
        color: selected
            ? mobile_tokens.LetbuyyColorTokens.brandPrimary
            : colors.cardBorder,
      ),
      labelStyle: TextStyle(
        color: selected
            ? mobile_tokens.LetbuyyColorTokens.brandPrimary
            : colors.textPrimary,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load leads',
        _error!,
      );
    }
    if (_submissions.isEmpty) {
      return RefreshIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 80, 24, 24),
          children: [
            _centerState(
              Icons.inbox_outlined,
              'No submissions',
              'Storefront contact forms and leads will appear here.',
              compact: true,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        itemCount: _submissions.length,
        itemBuilder: (context, index) => _submissionCard(_submissions[index]),
      ),
    );
  }

  Widget _submissionCard(FormSubmissionContract submission) {
    final statusColor = _statusColor(submission.status);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
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
              CircleAvatar(
                backgroundColor: statusColor.withValues(alpha: 0.12),
                child: Icon(Icons.person_search_outlined, color: statusColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      submission.fullName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      submission.contactLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _statusChip(_titleCase(submission.status), statusColor),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _metaChip(submission.typeLabel, Icons.dynamic_form_outlined),
              _metaChip(submission.formName, Icons.view_agenda_outlined),
              if (submission.source.isNotEmpty)
                _metaChip(submission.source, Icons.link_outlined),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            submission.subject,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          if (submission.message.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              submission.message,
              style: TextStyle(color: colors.textSecondary, height: 1.4),
            ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (submission.status == 'new')
                _actionButton(
                  'Mark read',
                  Icons.mark_email_read_outlined,
                  () => _updateStatus(submission, 'read'),
                ),
              if (submission.status != 'contacted')
                _actionButton(
                  'Contacted',
                  Icons.call_outlined,
                  () => _updateStatus(submission, 'contacted'),
                ),
              if (submission.status != 'converted')
                _actionButton(
                  'Converted',
                  Icons.check_circle_outline,
                  () => _updateStatus(submission, 'converted'),
                ),
              if (submission.status != 'archived')
                _actionButton(
                  'Archive',
                  Icons.archive_outlined,
                  () => _updateStatus(submission, 'archived'),
                ),
              _actionButton(
                'Spam',
                Icons.report_gmailerrorred_outlined,
                () => _updateStatus(submission, 'spam'),
                destructive: true,
              ),
              _actionButton(
                'Delete',
                Icons.delete_outline,
                () => _delete(submission),
                destructive: true,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _actionButton(
    String label,
    IconData icon,
    VoidCallback onPressed, {
    bool destructive = false,
  }) {
    final tone = destructive ? colors.error : colors.textPrimary;
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: tone,
        side: BorderSide(color: colors.cardBorder),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Widget _statusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _metaChip(String label, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.textSecondary),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
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

  Widget _centerState(
    IconData icon,
    String title,
    String message, {
    bool compact = false,
  }) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(compact ? 0 : 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 42),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
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

  Future<void> _updateStatus(
    FormSubmissionContract submission,
    String status,
  ) async {
    try {
      final updated = await context.read<FormSubmissionService>().updateStatus(
        submission,
        status,
      );
      setState(() {
        _submissions = _submissions
            .map((item) => item.id == updated.id ? updated : item)
            .toList(growable: false);
      });
      _showSnack('Submission marked ${_titleCase(status)}.');
    } catch (error) {
      _showSnack('Could not update submission: $error');
    }
  }

  Future<void> _delete(FormSubmissionContract submission) async {
    try {
      await context.read<FormSubmissionService>().deleteSubmission(submission);
      setState(() {
        _submissions = _submissions
            .where((item) => item.id != submission.id)
            .toList();
      });
      _showSnack('Submission deleted.');
    } catch (error) {
      _showSnack('Could not delete submission: $error');
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: colors.snackbarBackground,
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'converted':
        return colors.success;
      case 'contacted':
      case 'read':
      case 'replied':
        return mobile_tokens.LetbuyyColorTokens.info;
      case 'archived':
        return colors.textTertiary;
      case 'spam':
        return colors.error;
      case 'new':
        return colors.warning;
      default:
        return mobile_tokens.LetbuyyColorTokens.brandPrimary;
    }
  }

  String _titleCase(String value) {
    if (value.isEmpty) return value;
    return '${value[0].toUpperCase()}${value.substring(1)}';
  }
}
