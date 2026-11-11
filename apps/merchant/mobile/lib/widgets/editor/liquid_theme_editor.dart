import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../models/store_model.dart';
import '../../models/theme_editor_models.dart';
import '../../screens/customize/theme_versions_screen.dart';
import '../../screens/preview/live_preview_screen.dart';
import '../../services/theme_service.dart';
import '../../theme/app_theme_colors.dart';
import 'theme_schema_fields.dart';

/// The native editing surface for the installed Liquid document. Commerce
/// remains its only renderer and the existing theme API owns save/publication.
class LiquidThemeEditor extends StatefulWidget {
  const LiquidThemeEditor({
    super.key,
    required this.store,
    required this.slug,
    required this.payload,
    required this.ownedContext,
    required this.onExit,
  });
  final StoreModel store;
  final String slug;
  final ThemeEditorPayload payload;
  final Object? ownedContext;
  final VoidCallback onExit;
  @override
  State<LiquidThemeEditor> createState() => _LiquidThemeEditorState();
}

class _LiquidThemeEditorState extends State<LiquidThemeEditor> {
  late ThemeEditorPayload _payload;
  late LiquidThemeDocument _document;
  late String _template;
  late int _version;
  late bool _draft;
  bool _dirty = false, _busy = false, _conflict = false, _allowPop = false;
  String? _error;
  ThemeService get _service => context.read<ThemeService>();
  bool get _owns => _service.captureContext() == widget.ownedContext;
  bool get _pendingSave => _service.hasPendingSave(
    widget.store.id,
    widget.slug,
    templateKey: _template,
  );
  bool get _pendingPublish => _service.hasPendingPublication(
    widget.store.id,
    widget.slug,
    templateKey: _template,
  );
  bool get _editable =>
      _owns && !_busy && !_conflict && !_pendingSave && !_pendingPublish;
  Map<String, dynamic> _record(Object? v) =>
      v is Map ? Map<String, dynamic>.from(v) : {};

  @override
  void initState() {
    super.initState();
    _accept(widget.payload);
  }

  void _accept(ThemeEditorPayload payload) {
    if (payload.store['id'] != widget.store.id ||
        payload.theme['slug'] != widget.slug ||
        payload.theme['theme_instance_id'] !=
            widget.payload.theme['theme_instance_id'] ||
        payload.theme['theme_package_version_id'] !=
            widget.payload.theme['theme_package_version_id']) {
      throw StateError('The owned theme changed. Return to its library.');
    }
    final document = LiquidThemeDocument(payload.templateConfig);
    // Validate every group before presenting mutable controls.
    for (final key in document.templateKeys) {
      for (final group in const ['header', 'template', 'footer']) {
        document.sections(key, group);
      }
    }
    if (!document.templateKeys.contains(payload.templateKey)) {
      throw const FormatException('The requested theme page is unavailable.');
    }
    _payload = payload;
    _document = document;
    _template = payload.templateKey;
    _version = payload.version;
    _draft = payload.hasDraft;
    _dirty = false;
    _conflict = false;
    _error = null;
  }

  Future<bool> _confirm(String title, String message, String action) async =>
      await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: Text(action),
            ),
          ],
        ),
      ) ==
      true;

  void _failure(Object error, String fallback) {
    if (!mounted || !_owns) return;
    setState(() {
      _conflict = error is ThemeDraftConflictException;
      _error = _conflict
          ? 'This theme changed elsewhere. Your edits are retained here. Reload and review the latest draft before making another change.'
          : fallback;
    });
  }

  Future<bool> _save() async {
    if (!_owns || _busy || _conflict || _pendingPublish) return false;
    setState(() => _busy = true);
    try {
      final recovering = _pendingSave;
      final result = recovering
          ? await _service.retryPendingSave(
              storeId: widget.store.id,
              themeSlug: widget.slug,
              templateKey: _template,
            )
          : await _service.saveDraft(
              storeId: widget.store.id,
              themeSlug: widget.slug,
              templateKey: _template,
              templateConfig: _document.toConfig(_template),
              baseVersion: _version,
            );
      if (!mounted || !_owns) return false;
      setState(() {
        _version = result.version;
        _draft = true;
        _dirty = false;
        _error = null;
      });
      if (recovering) {
        try {
          final latest = await _service.loadEditor(
            storeId: widget.store.id,
            themeSlug: widget.slug,
            templateKey: _template,
          );
          if (!mounted || !_owns) return false;
          setState(() => _accept(latest));
        } catch (_) {
          if (mounted && _owns)
            setState(() {
              _conflict = true;
              _error =
                  'The save was confirmed. Reload the latest saved theme before editing again.';
            });
          return false;
        }
      }
      return true;
    } catch (error) {
      _failure(
        error,
        'The save could not be confirmed. Your edits are retained. Retry the same save before continuing.',
      );
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reload({String? template}) async {
    if (!_owns || _busy || _pendingSave || _pendingPublish) return;
    if (_dirty &&
        !await _confirm(
          'Reload theme?',
          'Unsaved edits on this page will be replaced by the latest saved document.',
          'Reload',
        ))
      return;
    if (!mounted || !_owns) return;
    setState(() => _busy = true);
    try {
      final payload = await _service.loadEditor(
        storeId: widget.store.id,
        themeSlug: widget.slug,
        templateKey: template ?? _template,
      );
      if (!mounted || !_owns) return;
      setState(() => _accept(payload));
    } catch (error) {
      _failure(
        error,
        'The latest saved theme could not load. Your existing edits are retained.',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _publish() async {
    if (!_owns || _busy || _conflict || _dirty || _pendingSave) return;
    bool makeLive = false;
    if (!_pendingPublish) {
      if (!_draft) return;
      final approved = await showDialog<bool>(
        context: context,
        builder: (dialog) => StatefulBuilder(
          builder: (dialog, update) => AlertDialog(
            title: const Text('Publish saved design?'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Publish the saved ${_payload.theme['name'] ?? widget.slug} design for ${widget.store.name}. Existing customers will see this release.',
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Make storefront live'),
                  subtitle: const Text(
                    'Also enable the storefront if it is currently closed.',
                  ),
                  value: makeLive,
                  onChanged: (v) => update(() => makeLive = v == true),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialog, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialog, true),
                child: const Text('Publish'),
              ),
            ],
          ),
        ),
      );
      if (approved != true || !mounted || !_owns) return;
    }
    setState(() => _busy = true);
    try {
      if (_pendingPublish) {
        await _service.recoverPublication(
          storeId: widget.store.id,
          themeSlug: widget.slug,
          templateKey: _template,
        );
      } else {
        await _service.publish(
          storeId: widget.store.id,
          themeSlug: widget.slug,
          templateKey: _template,
          baseVersion: _version,
          makeStoreLive: makeLive,
        );
      }
      if (!mounted || !_owns) return;
      // A confirmed release stays confirmed if the subsequent read is offline.
      setState(() {
        _draft = false;
        _error = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Publication confirmed. Reloading the saved theme.'),
        ),
      );
      try {
        final payload = await _service.loadEditor(
          storeId: widget.store.id,
          themeSlug: widget.slug,
          templateKey: _template,
        );
        if (mounted && _owns) setState(() => _accept(payload));
      } catch (_) {
        if (mounted && _owns)
          setState(() {
            _conflict = true;
            _error =
                'Publication was confirmed. Reload the latest theme before editing again.';
          });
      }
    } catch (error) {
      _failure(
        error,
        'Publication could not be confirmed. Recover the same request before publishing another design.',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _preview() async {
    if (!_editable) return;
    if (_dirty || !_draft) {
      if (!await _confirm(
        'Save before preview?',
        'Preview opens the saved design with your store content.',
        'Save and preview',
      ))
        return;
      if (!mounted || !await _save()) return;
    }
    if (!mounted || !_owns) return;
    final base = _template.split('.').first;
    final type = base == 'article'
        ? 'blog'
        : const ['product', 'collection', 'page'].contains(base)
        ? base
        : null;
    String? resource;
    if (type != null) {
      resource = await showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => FractionallySizedBox(
          heightFactor: .85,
          child: ThemeResourcePicker(
            storeId: widget.store.id,
            type: type,
            title: 'Choose preview content',
          ),
        ),
      );
      if (resource == null || !mounted || !_owns) return;
    }
    if (widget.store.subdomain.isEmpty) {
      setState(
        () => _error =
            'Set up this store’s storefront address before previewing.',
      );
      return;
    }
    setState(() => _busy = true);
    try {
      final session = await _service.createPreviewSession(
        storeId: widget.store.id,
        themeSlug: widget.slug,
        templateKey: _template,
      );
      final token = session['preview_token'];
      if (token is! String || token.isEmpty)
        throw const FormatException('Preview unavailable');
      if (!mounted || !_owns) return;
      final url = ThemeService.buildStorefrontPreviewUrl(
        subdomain: widget.store.subdomain,
        previewToken: token,
        templateKey: _template,
        resourceId: resource,
      );
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => LivePreviewScreen(
            storeUrl: url,
            expectedThemeContext: widget.ownedContext,
            storeName: '${_payload.theme['name'] ?? widget.slug} · Preview',
            notice:
                'Private preview of your saved design. This does not publish the theme.',
          ),
        ),
      );
    } catch (error) {
      _failure(
        error,
        'The saved design preview is unavailable. Retry without changing your published store.',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _leave() async {
    if (_busy) return;
    if (_dirty &&
        !await _confirm(
          'Leave editor?',
          'Your unsaved edits will be discarded. Save the design first to keep them.',
          'Discard edits',
        ))
      return;
    if (!mounted) return;
    if (Navigator.canPop(context)) {
      setState(() => _allowPop = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.pop(context);
      });
    } else {
      widget.onExit();
    }
  }

  Future<void> _fields(
    String title,
    Map<String, dynamic> fields,
    Map<String, dynamic> settings,
    String purpose,
    void Function(String, Object?) apply,
  ) async {
    if (!_editable) return;
    final changes = await ThemeSchemaFields.show(
      context,
      title: title,
      fields: fields,
      settings: settings,
      storeId: widget.store.id,
      recoveryPurpose: '${widget.slug}:$_template:$purpose',
    );
    if (!mounted || !_editable || changes == null || changes.isEmpty) return;
    setState(() {
      for (final entry in changes.entries) {
        apply(entry.key, entry.value);
      }
      _dirty = true;
      _error = null;
    });
  }

  Widget _section(
    String group,
    Map<String, dynamic> section,
    int index,
    int count,
  ) {
    final id = section['id'] as String,
        type = section['type']?.toString() ?? '';
    final schema = _record(_payload.sectionSchemas[type]);
    final fields = _record(schema['settings_schema']);
    final visible = section['visible'] != false && section['disabled'] != true;
    return Card(
      key: ValueKey('liquid-section:$group:$id'),
      child: ExpansionTile(
        title: Text(schema['name']?.toString() ?? type),
        subtitle: Text(visible ? 'Visible' : 'Hidden'),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: _editable && fields.isNotEmpty
                    ? () => _fields(
                        schema['name']?.toString() ?? type,
                        fields,
                        _record(section['settings']),
                        '$group:$id',
                        (field, value) => _document.setSectionSetting(
                          _template,
                          group,
                          id,
                          field,
                          value,
                        ),
                      )
                    : null,
                icon: const Icon(Icons.tune),
                label: const Text('Edit settings'),
              ),
              IconButton(
                tooltip: visible ? 'Hide section' : 'Show section',
                onPressed: _editable
                    ? () => setState(() {
                        _document.setVisible(_template, group, id, !visible);
                        _dirty = true;
                      })
                    : null,
                icon: Icon(visible ? Icons.visibility : Icons.visibility_off),
              ),
              IconButton(
                tooltip: 'Move section up',
                onPressed: _editable && index > 0
                    ? () => setState(() {
                        _document.moveSection(_template, group, id, -1);
                        _dirty = true;
                      })
                    : null,
                icon: const Icon(Icons.arrow_upward),
              ),
              IconButton(
                tooltip: 'Move section down',
                onPressed: _editable && index < count - 1
                    ? () => setState(() {
                        _document.moveSection(_template, group, id, 1);
                        _dirty = true;
                      })
                    : null,
                icon: const Icon(Icons.arrow_downward),
              ),
            ],
          ),
          if (schema.isEmpty)
            const Text(
              'This section is preserved. Its settings are unavailable for editing.',
            ),
          ..._blocks(
            group,
            id,
            section,
            const [],
            _record(schema['blocks_schema']),
          ),
        ],
      ),
    );
  }

  List<Widget> _blocks(
    String group,
    String sectionId,
    Map<String, dynamic> parent,
    List<String> path,
    Map<String, dynamic> schemas,
  ) {
    final order = parent['block_order'], records = _record(parent['blocks']);
    if (order is! List) return const [];
    return [
      for (final rawId in order)
        if (rawId is String && records[rawId] is Map)
          Builder(
            builder: (context) {
              final block = _record(records[rawId]),
                  type = block['type']?.toString() ?? '';
              final schema = _record(
                schemas[type] ?? _payload.blockSchemas[type],
              );
              final fields = _record(schema['fields']);
              final next = [...path, rawId];
              return Padding(
                padding: const EdgeInsets.only(left: 8),
                child: ExpansionTile(
                  title: Text(schema['name']?.toString() ?? type),
                  leading: const Icon(Icons.widgets_outlined),
                  children: [
                    if (fields.isNotEmpty)
                      TextButton.icon(
                        onPressed: _editable
                            ? () => _fields(
                                schema['name']?.toString() ?? type,
                                fields,
                                _record(block['settings']),
                                '$group:$sectionId:${next.join('/')}',
                                (field, value) => _document.setBlockSetting(
                                  _template,
                                  group,
                                  sectionId,
                                  next,
                                  field,
                                  value,
                                ),
                              )
                            : null,
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Edit block'),
                      ),
                    ..._blocks(
                      group,
                      sectionId,
                      block,
                      next,
                      _payload.blockSchemas,
                    ),
                  ],
                ),
              );
            },
          ),
    ];
  }

  Future<void> _history() async {
    if (!_editable) return;
    if (_dirty &&
        !await _confirm(
          'Open version history?',
          'Save your edits before restoring a different published release. Opening history keeps these edits here.',
          'Open history',
        ))
      return;
    if (!mounted || !_owns) return;
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => ThemeVersionsScreen(
          storeId: widget.store.id,
          themeSlug: widget.slug,
          themeName: _payload.theme['name']?.toString() ?? widget.slug,
        ),
      ),
    );
    if (changed == true && mounted && _owns) {
      setState(() {
        _conflict = true;
        _error =
            'A published release was restored. Reload and review it before editing.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    final colors = AppThemeColors.of(context);
    if (!_owns)
      return Scaffold(
        appBar: AppBar(title: const Text('Theme editor')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'The active account or store changed. Return to its theme library before editing.',
            ),
          ),
        ),
      );
    final settings = _record(_payload.settingsSchema['settings']);
    return PopScope(
      canPop: _allowPop,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _leave();
      },
      child: Scaffold(
        backgroundColor: colors.bgStart,
        appBar: AppBar(
          leading: BackButton(onPressed: _leave),
          title: Text(_payload.theme['name']?.toString() ?? widget.slug),
          actions: [
            IconButton(
              tooltip: 'Reload saved theme',
              onPressed: !_busy && !_pendingSave && !_pendingPublish
                  ? () => _reload()
                  : null,
              icon: const Icon(Icons.refresh),
            ),
            IconButton(
              tooltip: 'Version history',
              onPressed: _editable ? _history : null,
              icon: const Icon(Icons.history),
            ),
          ],
        ),
        body: Column(
          children: [
            if (_busy) const LinearProgressIndicator(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    _dirty
                        ? 'Unsaved changes'
                        : _draft
                        ? 'Saved draft · revision $_version'
                        : _payload.release != null
                        ? 'Published design · revision $_version'
                        : 'Installed design · revision $_version',
                    style: TextStyle(color: colors.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    key: ValueKey('liquid-page:$_template'),
                    initialValue: _template,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Store page'),
                    items: _document.templateKeys
                        .map(
                          (key) =>
                              DropdownMenuItem(value: key, child: Text(key)),
                        )
                        .toList(),
                    onChanged:
                        _owns && !_busy && !_pendingSave && !_pendingPublish
                        ? (key) {
                            if (key != null && key != _template)
                              _reload(template: key);
                          }
                        : null,
                  ),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        _error!,
                        key: const ValueKey('liquid-editor-error'),
                        style: TextStyle(color: colors.error),
                      ),
                    ),
                  if (_pendingSave)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        'Recover the previous save before editing or switching pages.',
                      ),
                    ),
                  if (_pendingPublish)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        'A publication needs confirmation. Recover the same request before continuing.',
                      ),
                    ),
                  for (final group in const [
                    'header',
                    'template',
                    'footer',
                  ]) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 20, bottom: 8),
                      child: Text(
                        group == 'template'
                            ? 'Page sections'
                            : group == 'header'
                            ? 'Header'
                            : 'Footer',
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (_document.sections(_template, group).isEmpty)
                      const Text('No sections in this group.'),
                    for (final (index, section)
                        in _document.sections(_template, group).indexed)
                      _section(
                        group,
                        section,
                        index,
                        _document.sections(_template, group).length,
                      ),
                  ],
                  if (settings.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 24, bottom: 8),
                      child: Text(
                        'Theme settings',
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  for (final entry in settings.entries)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        _record(entry.value)['label']?.toString() ?? entry.key,
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: _editable
                          ? () => _fields(
                              _record(entry.value)['label']?.toString() ??
                                  entry.key,
                              _record(_record(entry.value)['fields']),
                              _document.themeSettings,
                              'theme:${entry.key}',
                              _document.setThemeSetting,
                            )
                          : null,
                    ),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _editable ? _preview : null,
                      icon: const Icon(Icons.visibility_outlined),
                      label: const Text('Preview'),
                    ),
                    FilledButton(
                      onPressed:
                          _owns &&
                              !_busy &&
                              !_conflict &&
                              !_pendingPublish &&
                              (_dirty || _pendingSave)
                          ? _save
                          : null,
                      child: Text(_pendingSave ? 'Retry save' : 'Save draft'),
                    ),
                    OutlinedButton(
                      onPressed:
                          _owns &&
                              !_busy &&
                              !_dirty &&
                              !_conflict &&
                              !_pendingSave &&
                              (_draft || _pendingPublish)
                          ? _publish
                          : null,
                      child: Text(
                        _pendingPublish ? 'Recover publication' : 'Publish',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
