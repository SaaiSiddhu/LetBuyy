import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../services/theme_service.dart';
import '../../theme/app_theme_colors.dart';
import '../shared/image_picker_widget.dart';

/// Native controls over the installed package's field descriptors. This edits
/// values only; schemas, unknown values and renderer source stay unchanged.
class ThemeSchemaFields extends StatefulWidget {
  const ThemeSchemaFields({
    super.key,
    required this.title,
    required this.fields,
    required this.settings,
    required this.storeId,
    required this.recoveryPurpose,
  });
  final String title, storeId, recoveryPurpose;
  final Map<String, dynamic> fields, settings;

  static Future<Map<String, dynamic>?> show(
    BuildContext context, {
    required String title,
    required Map<String, dynamic> fields,
    required Map<String, dynamic> settings,
    required String storeId,
    required String recoveryPurpose,
  }) {
    final editor = ThemeSchemaFields(
      title: title,
      fields: fields,
      settings: settings,
      storeId: storeId,
      recoveryPurpose: recoveryPurpose,
    );
    // Longer settings forms keep a durable route and a full keyboard viewport.
    if (fields.length > 6)
      return Navigator.push<Map<String, dynamic>>(
        context,
        MaterialPageRoute(builder: (_) => editor),
      );
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => FractionallySizedBox(heightFactor: .9, child: editor),
    );
  }

  @override
  State<ThemeSchemaFields> createState() => _ThemeSchemaFieldsState();
}

class _ThemeSchemaFieldsState extends State<ThemeSchemaFields> {
  final _form = GlobalKey<FormState>();
  final _changes = <String, dynamic>{};
  late final Object? _ownedContext;
  @override
  void initState() {
    super.initState();
    _ownedContext = context.read<ThemeService>().captureContext();
  }

  Map<String, dynamic> _record(Object? v) =>
      v is Map ? Map<String, dynamic>.from(v) : {};
  Object? _value(String id, Map<String, dynamic> field) =>
      _changes.containsKey(id)
      ? _changes[id]
      : widget.settings.containsKey(id)
      ? widget.settings[id]
      : field['default'];
  bool get _owns =>
      context.read<ThemeService>().captureContext() == _ownedContext;
  void _change(String id, Object? value) {
    if (_owns) setState(() => _changes[id] = value);
  }

  bool _visible(Map<String, dynamic> field) {
    final rule = _record(field['visible_if']);
    if (rule['field'] is! String || !rule.containsKey('value')) return true;
    final id = rule['field'] as String;
    return jsonEncode(_value(id, _record(widget.fields[id]))) ==
        jsonEncode(rule['value']);
  }

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          TextButton(
            onPressed: !_owns
                ? null
                : () {
                    if (_form.currentState?.validate() ?? false) {
                      // Only fields explicitly changed by the merchant are returned. Hidden
                      // defaults or future settings cannot be written accidentally.
                      Navigator.pop(
                        context,
                        Map<String, dynamic>.from(_changes),
                      );
                    }
                  },
            child: const Text('Apply'),
          ),
        ],
      ),
      body: !_owns
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'The active account or store changed. Close these settings and reload the theme.',
                ),
              ),
            )
          : Form(
              key: _form,
              child: ListView(
                padding: EdgeInsets.fromLTRB(
                  20,
                  16,
                  20,
                  24 + MediaQuery.viewInsetsOf(context).bottom,
                ),
                children: [
                  for (final entry in widget.fields.entries)
                    if (_visible(_record(entry.value)))
                      Padding(
                        key: ValueKey('theme-field:${entry.key}'),
                        padding: const EdgeInsets.only(bottom: 20),
                        child: _field(entry.key, _record(entry.value), colors),
                      ),
                ],
              ),
            ),
    );
  }

  Widget _field(String id, Map<String, dynamic> field, AppThemeColors colors) {
    final rawType = field['type']?.toString() ?? '',
        type = rawType == 'font' ? 'font_picker' : rawType;
    final label = field['label']?.toString() ?? id, value = _value(id, field);
    final help = (field['info'] ?? field['help_text'] ?? field['description'])
        ?.toString();
    if (type == 'header')
      return Text(
        label,
        style: TextStyle(
          color: colors.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      );
    if (type == 'paragraph')
      return Text(help ?? label, style: TextStyle(color: colors.textSecondary));
    if (const ['toggle', 'checkbox'].contains(type) &&
        (value == null || value is bool)) {
      return SwitchListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(label),
        subtitle: help == null ? null : Text(help),
        value: value == true,
        onChanged: (v) => _change(id, v),
      );
    }
    if (type == 'image' && (value == null || value is String)) {
      final purpose =
          'theme-image:${sha256.convert(utf8.encode('${widget.recoveryPurpose}:$id'))}';
      return ImagePickerWidget(
        label: label,
        initialUrl: value as String?,
        recoveryPurpose: purpose,
        onChanged: (v) => _change(id, v ?? ''),
      );
    }
    if (const [
          'product',
          'collection',
          'page',
          'blog',
          'menu',
        ].contains(type) &&
        (value == null || value is String)) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value is String && value.isNotEmpty
                ? 'Current selection: $value'
                : 'No resource selected',
            style: TextStyle(color: colors.textSecondary),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            children: [
              OutlinedButton.icon(
                onPressed: () async {
                  final selected = await showModalBottomSheet<String>(
                    context: context,
                    isScrollControlled: true,
                    useSafeArea: true,
                    builder: (_) => FractionallySizedBox(
                      heightFactor: .85,
                      child: ThemeResourcePicker(
                        storeId: widget.storeId,
                        type: type,
                        title: label,
                      ),
                    ),
                  );
                  if (mounted && selected != null) _change(id, selected);
                },
                icon: const Icon(Icons.search),
                label: const Text('Choose'),
              ),
              TextButton(
                onPressed: value is String && value.isNotEmpty
                    ? () => _change(id, '')
                    : null,
                child: const Text('Clear'),
              ),
            ],
          ),
          if (help != null)
            Text(
              help,
              style: TextStyle(color: colors.textSecondary, fontSize: 12),
            ),
        ],
      );
    }
    if (const [
          'select',
          'radio',
          'font_picker',
          'color_scheme',
        ].contains(type) &&
        field['options'] is List) {
      final options = <Object, String>{};
      for (final option in field['options'] as List) {
        if (option is String)
          options[option] = option;
        else if (option is Map &&
            option['value'] != null &&
            option['label'] is String &&
            (option['value'] is String ||
                option['value'] is num ||
                option['value'] is bool)) {
          options[option['value'] as Object] = option['label'] as String;
        }
      }
      if (value != null && !options.containsKey(value))
        return _preserved(
          label,
          value,
          colors,
          'Its saved option is not listed for this field.',
        );
      return DropdownButtonFormField<Object>(
        initialValue: value,
        isExpanded: true,
        decoration: InputDecoration(labelText: label, helperText: help),
        items: options.entries
            .map(
              (e) => DropdownMenuItem(
                value: e.key,
                child: Text(e.value, overflow: TextOverflow.ellipsis),
              ),
            )
            .toList(),
        onChanged: (v) => _change(id, v),
        validator: (v) =>
            field['required'] == true && v == null ? 'Choose $label' : null,
      );
    }
    if (const ['range', 'number'].contains(type) &&
        (value == null || value is num || value is String)) {
      return TextFormField(
        initialValue: value?.toString() ?? '',
        keyboardType: const TextInputType.numberWithOptions(
          decimal: true,
          signed: true,
        ),
        decoration: InputDecoration(
          labelText: label,
          helperText: help,
          suffixText: field['unit']?.toString(),
        ),
        onChanged: (v) => _change(id, num.tryParse(v) ?? v),
        validator: (v) {
          if ((v ?? '').isEmpty)
            return field['required'] == true || _changes.containsKey(id)
                ? 'Enter $label'
                : null;
          final parsed = num.tryParse(v!);
          if (parsed == null || !parsed.isFinite) return 'Enter a valid number';
          if (field['min'] is num && parsed < (field['min'] as num))
            return 'Minimum ${field['min']}';
          if (field['max'] is num && parsed > (field['max'] as num))
            return 'Maximum ${field['max']}';
          return null;
        },
      );
    }
    if (const [
          'text',
          'textarea',
          'richtext',
          'url',
          'color',
          'color_background',
          'video_url',
          'video',
          'html',
        ].contains(type) &&
        (value == null || value is String)) {
      return TextFormField(
        initialValue: value as String? ?? '',
        minLines: const ['textarea', 'richtext', 'html'].contains(type) ? 3 : 1,
        maxLines: const ['textarea', 'richtext', 'html'].contains(type) ? 8 : 1,
        keyboardType: const ['url', 'video_url', 'video'].contains(type)
            ? TextInputType.url
            : TextInputType.text,
        decoration: InputDecoration(
          labelText: label,
          helperText: help,
          helperMaxLines: 3,
        ),
        onChanged: (v) => _change(id, v),
        validator: (v) {
          final text = v ?? '';
          if (field['required'] == true && text.trim().isEmpty)
            return 'Enter $label';
          final max = field['maxLength'] ?? field['max_length'];
          if (max is num && text.length > max)
            return 'Use at most $max characters';
          if (type == 'color' &&
              text.isNotEmpty &&
              !RegExp(r'^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$').hasMatch(text))
            return 'Use a hex color such as #123456';
          if (const ['url', 'video_url', 'video'].contains(type) &&
              text.isNotEmpty) {
            final uri = Uri.tryParse(text);
            if (uri == null ||
                uri.userInfo.isNotEmpty ||
                !(text.startsWith('/') && !text.startsWith('//') ||
                    const [
                      'https',
                      'http',
                      'mailto',
                      'tel',
                    ].contains(uri.scheme)))
              return 'Enter a valid link';
          }
          return null;
        },
      );
    }
    return _preserved(
      label,
      value,
      colors,
      'This setting is retained without conversion.',
    );
  }

  Widget _preserved(
    String label,
    Object? value,
    AppThemeColors colors,
    String reason,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: TextStyle(
          color: colors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
      const SizedBox(height: 6),
      Text(
        '$reason Its saved value will be preserved.',
        style: TextStyle(color: colors.textSecondary),
      ),
    ],
  );
}

class ThemeResourcePicker extends StatefulWidget {
  const ThemeResourcePicker({
    super.key,
    required this.storeId,
    required this.type,
    required this.title,
  });
  final String storeId, type, title;
  @override
  State<ThemeResourcePicker> createState() => _ThemeResourcePickerState();
}

class _ThemeResourcePickerState extends State<ThemeResourcePicker> {
  final _query = TextEditingController();
  List<Map<String, dynamic>> _items = const [];
  Object? _ownedContext;
  int _page = 1, _generation = 0;
  bool _loading = true, _hasMore = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _generation++;
    _query.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final service = context.read<ThemeService>(),
        captured = service.captureContext();
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await service.searchThemeResources(
        storeId: widget.storeId,
        type: widget.type,
        query: _query.text,
        page: _page,
      );
      if (!mounted ||
          generation != _generation ||
          service.captureContext() != captured)
        return;
      final rows = (result['data'] as List)
          .map((row) => Map<String, dynamic>.from(row as Map))
          .toList();
      if (rows.any(
        (row) =>
            row['id'] is! String ||
            (row['id'] as String).isEmpty ||
            row['title'] is! String,
      ))
        throw const FormatException('Resource identities unavailable');
      setState(() {
        _items = rows;
        _ownedContext = captured;
        _hasMore = (result['meta'] as Map)['has_more'] == true;
        _loading = false;
      });
    } catch (_) {
      if (mounted && generation == _generation)
        setState(() {
          _error =
              'These resources could not load. Your existing selection is preserved.';
          _loading = false;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    final retired =
        _ownedContext != null &&
        _ownedContext != context.read<ThemeService>().captureContext();
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _query,
              maxLength: 200,
              decoration: const InputDecoration(
                labelText: 'Search resources',
                prefixIcon: Icon(Icons.search),
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: (_) {
                _page = 1;
                _load();
              },
            ),
          ),
          if (retired)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'The active account or store changed. Close this picker.',
              ),
            )
          else if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (_error != null)
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!),
                      const SizedBox(height: 12),
                      OutlinedButton(
                        onPressed: _load,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            Expanded(
              child: _items.isEmpty
                  ? const Center(child: Text('No resources match this search.'))
                  : ListView.builder(
                      itemCount: _items.length,
                      itemBuilder: (context, index) {
                        final item = _items[index];
                        return ListTile(
                          title: Text(item['title'] as String),
                          subtitle: item['handle'] == null
                              ? null
                              : Text(item['handle'].toString()),
                          onTap: () {
                            if (_ownedContext ==
                                context.read<ThemeService>().captureContext())
                              Navigator.pop(context, item['id'] as String);
                          },
                        );
                      },
                    ),
            ),
          if (!retired &&
              !_loading &&
              _error == null &&
              (_page > 1 || _hasMore))
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    OutlinedButton(
                      onPressed: _page > 1
                          ? () {
                              _page--;
                              _load();
                            }
                          : null,
                      child: const Text('Previous'),
                    ),
                    Text('Page $_page'),
                    OutlinedButton(
                      onPressed: _hasMore
                          ? () {
                              _page++;
                              _load();
                            }
                          : null,
                      child: const Text('Next'),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
