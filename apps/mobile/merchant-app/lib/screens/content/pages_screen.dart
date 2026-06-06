import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';

import '../../models/store_model.dart';
import '../../services/cms_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart';
import 'page_editor_screen.dart';

class PagesScreen extends StatefulWidget {
  const PagesScreen({super.key});

  @override
  State<PagesScreen> createState() => _PagesScreenState();
}

class _PagesScreenState extends State<PagesScreen> {
  static const _statusFilters = ['all', 'draft', 'published', 'archived'];

  StoreModel? _store;
  List<PageContract> _pages = const [];
  String _status = 'all';
  bool _isLoading = true;
  bool _isBusy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPages();
  }

  Future<void> _loadPages() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final store = await context.read<StoreService>().getFirstStore();
      if (store == null) {
        if (!mounted) return;
        setState(() {
          _store = null;
          _pages = const [];
        });
        return;
      }

      final pages = await context.read<CmsService>().fetchPages(
        store.id,
        status: _status,
      );
      if (!mounted) return;
      setState(() {
        _store = store;
        _pages = pages;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Unable to load pages: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _openEditor(PageContract? page) async {
    final store = _store;
    if (store == null || _isBusy) return;
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => PageEditorScreen(storeId: store.id, page: page),
      ),
    );
    if (changed == true) await _loadPages();
  }

  Future<void> _togglePublished(PageContract page) async {
    final nextStatus = page.status == 'published' ? 'draft' : 'published';
    await _runAction(() async {
      await context.read<CmsService>().updatePageStatus(page, nextStatus);
      _showMessage(
        nextStatus == 'published' ? 'Page published' : 'Page moved to draft',
        isSuccess: true,
      );
      await _loadPages();
    });
  }

  Future<void> _archivePage(PageContract page) async {
    final confirmed = await _confirmArchive(page);
    if (confirmed != true) return;
    await _runAction(() async {
      await context.read<CmsService>().deletePage(page.id);
      _showMessage('Page archived', isSuccess: true);
      await _loadPages();
    });
  }

  Future<void> _runAction(Future<void> Function() action) async {
    if (_isBusy) return;
    setState(() => _isBusy = true);
    try {
      await action();
    } catch (error) {
      if (mounted) _showMessage('$error', isError: true);
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<bool?> _confirmArchive(PageContract page) {
    final colors = AppThemeColors.of(context);
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(
          'Archive page?',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Text(
          'Archive "${page.title}" and remove it from storefront navigation.',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Archive'),
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
      floatingActionButton: _store == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _isBusy ? null : () => _openEditor(null),
              backgroundColor: LetbuyyColorTokens.brandPrimary,
              foregroundColor: LetbuyyColorTokens.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text('New page'),
            ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _loadPages,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
              children: [
                _buildHeader(colors),
                const SizedBox(height: 14),
                _buildFilters(colors),
                const SizedBox(height: 16),
                if (_isLoading)
                  _buildLoading(colors)
                else if (_error != null)
                  _buildError(colors)
                else if (_store == null)
                  _buildNoStore(colors)
                else if (_pages.isEmpty)
                  _buildEmpty(colors)
                else
                  ..._pages.map((page) => _buildPageCard(page)),
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
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Pages',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                _store?.name ?? 'Select a store',
                style: TextStyle(color: colors.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: _isLoading || _isBusy ? null : _loadPages,
          icon: Icon(Icons.refresh_rounded, color: colors.textPrimary),
          tooltip: 'Refresh pages',
        ),
      ],
    );
  }

  Widget _buildFilters(AppThemeColors colors) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _statusFilters.map((status) {
          final selected = status == _status;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              selected: selected,
              label: Text(_statusLabel(status)),
              onSelected: _isBusy
                  ? null
                  : (_) async {
                      setState(() => _status = status);
                      await _loadPages();
                    },
              selectedColor: LetbuyyColorTokens.brandPrimary.withValues(
                alpha: 0.18,
              ),
              backgroundColor: colors.surfaceVariant,
              labelStyle: TextStyle(
                color: selected
                    ? LetbuyyColorTokens.brandPrimary
                    : colors.textSecondary,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
              side: BorderSide(
                color: selected
                    ? LetbuyyColorTokens.brandPrimary
                    : colors.divider,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildPageCard(PageContract page) {
    final colors = AppThemeColors.of(context);
    final bodyPreview = _pageBody(page).trim();
    final isPublished = page.status == 'published';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(colors),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: LetbuyyColorTokens.brandPrimary.withValues(
                    alpha: 0.14,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.article_outlined,
                  color: LetbuyyColorTokens.brandPrimary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      page.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '/${page.slug.isEmpty ? 'untitled' : page.slug}',
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
              _StatusPill(
                text: _statusLabel(page.status),
                color: _statusColor(page.status, colors),
              ),
            ],
          ),
          if (bodyPreview.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              bodyPreview,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: colors.textSecondary, fontSize: 13),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  _pageMeta(page),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textTertiary, fontSize: 11),
                ),
              ),
              IconButton(
                onPressed: _isBusy ? null : () => _openEditor(page),
                icon: const Icon(Icons.edit_outlined, size: 18),
                color: colors.textPrimary,
                tooltip: 'Edit page',
              ),
              IconButton(
                onPressed: _isBusy ? null : () => _togglePublished(page),
                icon: Icon(
                  isPublished
                      ? Icons.unpublished_outlined
                      : Icons.cloud_upload_outlined,
                  size: 18,
                ),
                color: LetbuyyColorTokens.brandPrimary,
                tooltip: isPublished ? 'Move to draft' : 'Publish page',
              ),
              IconButton(
                onPressed: _isBusy ? null : () => _archivePage(page),
                icon: const Icon(Icons.archive_outlined, size: 18),
                color: colors.error,
                tooltip: 'Archive page',
              ),
            ],
          ),
        ],
      ),
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
            onPressed: _loadPages,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildNoStore(AppThemeColors colors) {
    return _buildMessagePanel(
      colors,
      icon: Icons.store_mall_directory_outlined,
      title: 'No store selected',
      message: 'Create or select a store before editing storefront pages.',
    );
  }

  Widget _buildEmpty(AppThemeColors colors) {
    return _buildMessagePanel(
      colors,
      icon: Icons.article_outlined,
      title: 'No pages yet',
      message: 'Create policy, landing, or about pages for your storefront.',
    );
  }

  Widget _buildMessagePanel(
    AppThemeColors colors, {
    required IconData icon,
    required String title,
    required String message,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _panelDecoration(colors),
      child: Column(
        children: [
          Icon(icon, color: colors.textSecondary, size: 32),
          const SizedBox(height: 8),
          Text(
            title,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
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

  String _pageBody(PageContract page) {
    final direct = page.stringValue('body');
    if (direct.isNotEmpty) return direct;
    final content = page.jsonMap('content');
    return content['body']?.toString() ?? content['html']?.toString() ?? '';
  }

  String _pageMeta(PageContract page) {
    final pageType = page.stringValue('page_type', fallback: 'custom');
    final updated = _formatDate(
      page.optionalString('updated_at') ?? page.optionalString('published_at'),
    );
    return updated == null ? pageType : '$pageType • $updated';
  }

  String? _formatDate(String? raw) {
    final parsed = raw == null ? null : DateTime.tryParse(raw);
    if (parsed == null) return null;
    return DateFormat('MMM d, yyyy').format(parsed.toLocal());
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'all':
        return 'All';
      case 'draft':
        return 'Draft';
      case 'published':
        return 'Published';
      case 'archived':
        return 'Archived';
      default:
        return status;
    }
  }

  Color _statusColor(String status, AppThemeColors colors) {
    switch (status) {
      case 'published':
        return colors.success;
      case 'archived':
        return colors.textTertiary;
      case 'draft':
        return colors.warning;
      default:
        return LetbuyyColorTokens.brandPrimary;
    }
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
