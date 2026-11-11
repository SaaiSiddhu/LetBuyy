import 'dart:convert';

/// Lossless frontend projection of an installed portable Liquid document.
/// Rendering, package validation, tenancy and publication remain server-owned.
/// This adapter never converts niche section types to the legacy Flutter enum.
class LiquidThemeDocument {
  LiquidThemeDocument(Map<String, dynamic> config) : _config = _copy(config) {
    final bundle = _record(_config['liquidBundle']);
    if (_record(bundle['renderer'])['engine'] != 'liquid') {
      throw const FormatException('The installed Liquid theme is unavailable.');
    }
    if (_config['templates'] == null) {
      _config['templates'] = _copy(_record(bundle['templates']));
    }
    if (_record(_config['templates']).isEmpty) {
      throw const FormatException(
        'The installed theme templates are unavailable.',
      );
    }
  }

  final Map<String, dynamic> _config;
  static Map<String, dynamic> _copy(Map<String, dynamic> value) =>
      Map<String, dynamic>.from(jsonDecode(jsonEncode(value)) as Map);
  static Map<String, dynamic> _record(Object? value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  Map<String, dynamic> get bundle => _copy(_record(_config['liquidBundle']));
  Map<String, dynamic> get package =>
      _record(_record(_config['liquidBundle'])['package']);
  List<String> get templateKeys => _record(_config['templates']).keys
      .where((key) => key != 'header' && key != 'footer')
      .toList(growable: false);
  Map<String, dynamic> snapshot() => _copy(_config);

  String _groupKey(String templateKey, String group) {
    if (!templateKeys.contains(templateKey)) {
      throw const FormatException('This page is not installed in the theme.');
    }
    if (!const ['header', 'template', 'footer'].contains(group)) {
      throw const FormatException('The section group is unavailable.');
    }
    return group == 'template' ? templateKey : group;
  }

  Map<String, dynamic> _template(String templateKey, String group) {
    final key = _groupKey(templateKey, group);
    final templates = _config['templates'];
    if (templates is! Map || templates[key] is! Map) {
      throw const FormatException('This theme has no requested section group.');
    }
    return templates[key] as Map<String, dynamic>;
  }

  bool hasGroup(String templateKey, String group) =>
      _record(_config['templates']).containsKey(_groupKey(templateKey, group));

  List<Map<String, dynamic>> sections(String templateKey, String group) {
    if (!hasGroup(templateKey, group)) return const [];
    final template = _template(templateKey, group);
    final order = template['order'], records = template['sections'];
    if (order is! List || records is! Map) {
      throw const FormatException('The saved section order is unavailable.');
    }
    return order
        .map((id) {
          if (id is! String || records[id] is! Map) {
            throw const FormatException(
              'A saved section could not be confirmed.',
            );
          }
          return {..._copy(_record(records[id])), 'id': id};
        })
        .toList(growable: false);
  }

  Map<String, dynamic> _section(String templateKey, String group, String id) {
    final records = _template(templateKey, group)['sections'];
    if (records is! Map || records[id] is! Map) {
      throw const FormatException(
        'The selected section changed. Reload this page.',
      );
    }
    return records[id] as Map<String, dynamic>;
  }

  void setSectionSetting(
    String templateKey,
    String group,
    String id,
    String field,
    Object? value,
  ) {
    _setSetting(_section(templateKey, group, id), field, value);
  }

  void setBlockSetting(
    String templateKey,
    String group,
    String sectionId,
    List<String> blockPath,
    String field,
    Object? value,
  ) {
    var selected = _section(templateKey, group, sectionId);
    for (final id in blockPath) {
      final blocks = selected['blocks'];
      if (blocks is! Map || blocks[id] is! Map) {
        throw const FormatException(
          'The selected block changed. Reload this page.',
        );
      }
      selected = blocks[id] as Map<String, dynamic>;
    }
    if (blockPath.isEmpty)
      throw const FormatException('Select an installed block.');
    _setSetting(selected, field, value);
  }

  void _setSetting(Map<String, dynamic> target, String field, Object? value) {
    if (field.isEmpty)
      throw const FormatException('The setting is unavailable.');
    final settings = _record(target['settings']);
    // Clone only the value being edited. Unknown fields, blocks and package
    // metadata are retained verbatim for the canonical server validator.
    settings[field] = jsonDecode(jsonEncode(value));
    target['settings'] = settings;
  }

  void setVisible(String templateKey, String group, String id, bool visible) {
    final section = _section(templateKey, group, id);
    section['visible'] = visible;
    if (section.containsKey('disabled')) section['disabled'] = !visible;
  }

  void moveSection(String templateKey, String group, String id, int delta) {
    if (delta != -1 && delta != 1) throw ArgumentError.value(delta);
    final template = _template(templateKey, group), order = template['order'];
    if (order is! List)
      throw const FormatException('The section order is unavailable.');
    final index = order.indexOf(id), next = order.indexOf(id) + delta;
    if (index < 0) throw const FormatException('The selected section changed.');
    if (next < 0 || next >= order.length) return;
    final updated = List<dynamic>.from(order);
    updated.removeAt(index);
    updated.insert(next, id);
    template['order'] = updated;
  }

  Map<String, dynamic> get themeSettings {
    final bundleConfig = _record(_record(_config['liquidBundle'])['config']);
    return {
      ..._record(_record(bundleConfig['settings_data'])['current']),
      ..._record(
        _record(_record(_config['config'])['settings_data'])['current'],
      ),
      ..._record(_record(_config['settings_data'])['current']),
      ..._record(_config['themeSettings']),
    };
  }

  void setThemeSetting(String field, Object? value) {
    final settings = themeSettings;
    settings[field] = jsonDecode(jsonEncode(value));
    _config['themeSettings'] = settings;
    final config = _record(_config['config']);
    final rootData = _record(_config['settings_data']);
    final configData = _record(config['settings_data']);
    _config['settings_data'] = {...rootData, 'current': _copy(settings)};
    config['settings_data'] = {...configData, 'current': _copy(settings)};
    _config['config'] = config;
  }

  /// Maintain the existing API compatibility projection without losing the
  /// authoritative portable templates, group entries or nested block records.
  Map<String, dynamic> toConfig(String templateKey) {
    final result = snapshot();
    Map<String, dynamic> project(Map<String, dynamic> section, int order) => {
      ...section,
      'order': order,
      'visible': section['visible'] != false && section['disabled'] != true,
      'blocks': _projectBlocks(section),
    };
    final header = sections(templateKey, 'header'),
        footer = sections(templateKey, 'footer');
    final page = sections(templateKey, 'template');
    result['sections'] = {
      ..._record(result['sections']),
      'template': [
        for (var i = 0; i < page.length; i++) project(page[i], i + 1),
      ],
      if (header.isNotEmpty) 'header': project(header.first, 0),
      if (footer.isNotEmpty) 'footer': project(footer.first, page.length + 1),
    };
    return result;
  }

  static List<Map<String, dynamic>> _projectBlocks(
    Map<String, dynamic> parent,
  ) {
    final order = parent['block_order'], records = parent['blocks'];
    if (order == null && records == null) return const [];
    if (order is! List || records is! Map) {
      throw const FormatException('The installed block order is unavailable.');
    }
    return [
      for (var i = 0; i < order.length; i++)
        (() {
          final id = order[i], block = _record(records[id]);
          if (id is! String || block.isEmpty)
            throw const FormatException('An installed block is unavailable.');
          return {
            ..._copy(block),
            'id': id,
            'order': i,
            'visible': block['visible'] != false && block['disabled'] != true,
            'children': _projectBlocks(block),
          };
        })(),
    ];
  }
}
