part of 'product_form_screen.dart';

/// Presentation draft only. The existing product command still owns permission,
/// version, inventory, idempotency and persistence on both web and mobile.
class _ProductOptionsDraft {
  _ProductOptionsDraft(this.options, this.rows);
  final List<ProductOptionContract> options;
  final List<_ProductVariantDraft> rows;

  String get signature => jsonEncode({
    'options': [
      for (final o in options) {'name': o.name, 'values': o.values},
    ],
    'rows': rows.map((r) => r.toJson()).toList(),
  });

  static void _name(String value) {
    if (value.trim().isEmpty ||
        value != value.trim() ||
        value.length > 100 ||
        value == '__proto__') {
      throw const _OptionProblem('Use a name between 1 and 100 characters.');
    }
  }

  static void _value(String value) {
    if (value.trim().isEmpty || value != value.trim() || value.length > 100) {
      throw const _OptionProblem('Use a value between 1 and 100 characters.');
    }
  }

  static ProductOptionContract _option(
    String name,
    List<String> values,
    int at,
  ) => ProductOptionContract.fromJson({
    'name': name,
    'position': at,
    'values': values,
  });

  void validate() {
    if (options.length > 3 || rows.length > 100) {
      throw const _OptionProblem('Use up to 3 options and 100 variants.');
    }
    if (options.map((o) => o.name.toLowerCase()).toSet().length !=
        options.length) {
      throw const _OptionProblem('Each option needs a distinct name.');
    }
    for (final o in options) {
      _name(o.name);
      if (o.values.isEmpty ||
          o.values.length > 100 ||
          o.values.toSet().length != o.values.length) {
        throw const _OptionProblem('Each option needs 1–100 distinct values.');
      }
      for (final v in o.values) {
        _value(v);
      }
    }
    final tuples = <String>{}, ids = <String>{};
    for (final row in rows) {
      if (row.id != null && !ids.add(row.id!.toLowerCase())) {
        throw const _OptionProblem(
          'Variant identities need review. Reload the product.',
        );
      }
      if (row.title.trim().isEmpty || row.title.length > 200) {
        throw const _OptionProblem(
          'The combined variant title must fit 200 characters.',
        );
      }
      final values = row.optionValues;
      if (values.length != options.length ||
          options.any((o) => !o.values.contains(values[o.name]))) {
        throw const _OptionProblem(
          'Review the existing option values before changing the matrix.',
        );
      }
      if (!tuples.add(jsonEncode([for (final o in options) values[o.name]]))) {
        throw const _OptionProblem(
          'This would combine variants. Remove the conflicting variants first.',
        );
      }
    }
  }

  _ProductOptionsDraft _checked(
    List<ProductOptionContract> next,
    List<_ProductVariantDraft> variants,
  ) {
    final result = _ProductOptionsDraft([
      for (var i = 0; i < next.length; i++)
        _option(next[i].name, next[i].values, i),
    ], variants);
    result.validate();
    return result;
  }

  String _title(Map<String, String> values, List<ProductOptionContract> axes) =>
      axes.map((o) => values[o.name]).whereType<String>().join(' / ');

  List<_ProductVariantDraft> _newRows(List<ProductOptionContract> axes) {
    var combinations = <Map<String, String>>[{}];
    for (final axis in axes) {
      if (combinations.length * axis.values.length > 100) {
        throw const _OptionProblem('This would exceed 100 variants.');
      }
      combinations = [
        for (final c in combinations)
          for (final value in axis.values) {...c, axis.name: value},
      ];
    }
    return [
      for (final values in combinations)
        _ProductVariantDraft(
          title: _title(values, axes),
          sku: '',
          barcode: '',
          price: null,
          writePrice: false,
          comparePrice: null,
          stock: 0,
          optionName: values.keys.firstOrNull ?? '',
          optionValue: values.values.firstOrNull ?? '',
          otherOptions: values,
        ),
    ];
  }

  _ProductOptionsDraft addAxis(String name, String value) {
    validate();
    _name(name);
    _value(value);
    final next = [
      ...options,
      _option(name, [value], options.length),
    ];
    // First value extends only the actual rows. Sparse matrices stay sparse;
    // UUIDs, optional prices, SKU, quantities and existing facts do not move.
    return _checked(
      next,
      rows.isEmpty
          ? _newRows(next)
          : [
              for (final row in rows)
                row.withOptions({
                  ...row.optionValues,
                  name: value,
                }, title: _title({...row.optionValues, name: value}, next)),
            ],
    );
  }

  _ProductOptionsDraft renameAxis(int at, String name) {
    validate();
    _name(name);
    final old = options[at].name;
    final next = [
      for (var i = 0; i < options.length; i++)
        _option(i == at ? name : options[i].name, options[i].values, i),
    ];
    return _checked(next, [
      for (final row in rows)
        row.withOptions({
          for (final o in options)
            (o.name == old ? name : o.name): row.optionValues[o.name]!,
        }),
    ]);
  }

  _ProductOptionsDraft addValue(int at, String value) {
    validate();
    _value(value);
    final axis = options[at];
    if (axis.values.contains(value)) {
      throw const _OptionProblem('This option already has that value.');
    }
    final next = [
      for (var i = 0; i < options.length; i++)
        _option(options[i].name, [...options[i].values, if (i == at) value], i),
    ];
    final additions = [
      for (var i = 0; i < options.length; i++)
        _option(options[i].name, i == at ? [value] : options[i].values, i),
    ];
    return _checked(
      next,
      rows.isEmpty ? _newRows(next) : [...rows, ..._newRows(additions)],
    );
  }

  _ProductOptionsDraft renameValue(int at, int valueAt, String value) {
    validate();
    _value(value);
    final axis = options[at], old = options[at].values[valueAt];
    if (axis.values.indexed.any((v) => v.$1 != valueAt && v.$2 == value)) {
      throw const _OptionProblem('This option already has that value.');
    }
    final next = [
      for (var i = 0; i < options.length; i++)
        _option(
          options[i].name,
          i == at
              ? [
                  for (var j = 0; j < axis.values.length; j++)
                    j == valueAt ? value : axis.values[j],
                ]
              : options[i].values,
          i,
        ),
    ];
    return _checked(next, [
      for (final row in rows)
        if (row.optionValues[axis.name] == old)
          row.withOptions({
            ...row.optionValues,
            axis.name: value,
          }, title: _title({...row.optionValues, axis.name: value}, next))
        else
          row,
    ]);
  }

  _ProductOptionsDraft removeValue(int at, int valueAt) {
    validate();
    final axis = options[at], value = options[at].values[valueAt];
    if (axis.values.length == 1) {
      throw const _OptionProblem('Remove the option to remove its last value.');
    }
    return _checked([
      for (var i = 0; i < options.length; i++)
        _option(
          options[i].name,
          i == at
              ? axis.values.where((v) => v != value).toList()
              : options[i].values,
          i,
        ),
    ], rows.where((r) => r.optionValues[axis.name] != value).toList());
  }

  _ProductOptionsDraft removeAxis(int at) {
    validate();
    final next = options.indexed
        .where((o) => o.$1 != at)
        .map((o) => o.$2)
        .toList();
    return _checked(next, [
      for (final row in rows)
        row.withOptions({
          for (final o in next) o.name: row.optionValues[o.name]!,
        }, title: next.isEmpty ? row.title : _title(row.optionValues, next)),
    ]);
  }

  _ProductOptionsDraft moveAxis(int at, int to) {
    validate();
    final next = List<ProductOptionContract>.of(options);
    next.insert(to, next.removeAt(at));
    return _checked(next, [
      for (final row in rows)
        row.withOptions({
          for (final o in next) o.name: row.optionValues[o.name]!,
        }, title: _title(row.optionValues, next)),
    ]);
  }
}

class _OptionProblem implements Exception {
  const _OptionProblem(this.message);
  final String message;
}

class _ProductOptionsEditor extends StatefulWidget {
  const _ProductOptionsEditor({
    required this.initial,
    required this.isCurrent,
    required this.guard,
  });
  final _ProductOptionsDraft initial;
  final bool Function() isCurrent;
  final Widget Function(Widget) guard;
  @override
  State<_ProductOptionsEditor> createState() => _ProductOptionsEditorState();
}

class _ProductOptionsEditorState extends State<_ProductOptionsEditor> {
  late _ProductOptionsDraft _draft = widget.initial;
  String? _error;
  bool get _current =>
      mounted && widget.isCurrent() && isLetbuyySurfaceCurrent(context);
  bool get _dirty => _draft.signature != widget.initial.signature;

  Future<void> _fields({
    required String title,
    required String label,
    String value = '',
    String? secondLabel,
    required _ProductOptionsDraft Function(String, String?) operation,
  }) async {
    if (!_current) return;
    final result = await Navigator.of(context).push<_ProductOptionsDraft>(
      MaterialPageRoute(
        builder: (_) => widget.guard(
          _ProductOptionFields(
            title: title,
            label: label,
            value: value,
            secondLabel: secondLabel,
            operation: operation,
            guard: widget.guard,
          ),
        ),
      ),
    );
    if (!_current || result == null) return;
    setState(() {
      _draft = result;
      _error = null;
    });
  }

  void _change(_ProductOptionsDraft Function() operation) {
    if (!_current) return;
    try {
      final next = operation();
      setState(() {
        _draft = next;
        _error = null;
      });
    } on _OptionProblem catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _remove({
    required String title,
    required _ProductOptionsDraft Function() operation,
  }) async {
    if (!_current) return;
    try {
      final next = operation();
      final removed = _draft.rows.length - next.rows.length;
      final accepted = await showLetbuyyConfirmation(
        context: context,
        title: title,
        message: removed > 0
            ? '$removed variants will also be removed from your draft. Saved variants may need to stay when stock or history depends on them. Save the product to apply these changes.'
            : 'The remaining variants keep their identities and quantities. Save the product to apply this option change.',
        confirmLabel: 'Remove from draft',
        destructive: true,
        guard: (_, child) => widget.guard(child),
      );
      if (_current && accepted)
        setState(() {
          _draft = next;
          _error = null;
        });
    } on _OptionProblem catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  void _apply() {
    if (!_current) return;
    try {
      _draft.validate();
      completeLetbuyySurface(context, _draft);
    } on _OptionProblem catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) => LetbuyyEditorScaffold(
    title: 'Product options',
    hasChanges: _dirty,
    currentHasChanges: () => _dirty,
    confirmationGuard: (_, child) => widget.guard(child),
    actions: SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: _apply,
        icon: const Icon(Icons.check),
        label: const Text('Apply options'),
      ),
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          '${_draft.rows.length} variants',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const Text(
          'Options belong to the whole product. New variants start with zero quantity. Changes are saved with the product.',
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Semantics(liveRegion: true, child: Text(_error!)),
          ),
        if (_draft.options.length < 3)
          OutlinedButton.icon(
            onPressed: () => _fields(
              title: 'Add product option',
              label: 'Option name',
              secondLabel: 'First value',
              operation: (name, value) => _draft.addAxis(name, value!),
            ),
            icon: const Icon(Icons.add),
            label: const Text('Add product option'),
          ),
        for (var at = 0; at < _draft.options.length; at++) _axis(at),
      ],
    ),
  );

  Widget _axis(int at) {
    final option = _draft.options[at];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(option.name, style: Theme.of(context).textTheme.titleMedium),
            Wrap(
              spacing: 8,
              children: [
                TextButton.icon(
                  onPressed: () => _fields(
                    title: 'Rename product option',
                    label: 'Option name',
                    value: option.name,
                    operation: (name, _) => _draft.renameAxis(at, name),
                  ),
                  icon: const Icon(Icons.edit_outlined),
                  label: Text('Rename ${option.name} option'),
                ),
                if (at > 0)
                  IconButton(
                    tooltip: 'Move ${option.name} option up',
                    onPressed: () => _change(() => _draft.moveAxis(at, at - 1)),
                    icon: const Icon(Icons.arrow_upward),
                  ),
                if (at + 1 < _draft.options.length)
                  IconButton(
                    tooltip: 'Move ${option.name} option down',
                    onPressed: () => _change(() => _draft.moveAxis(at, at + 1)),
                    icon: const Icon(Icons.arrow_downward),
                  ),
                TextButton.icon(
                  onPressed: () => _remove(
                    title: 'Remove ${option.name} option?',
                    operation: () => _draft.removeAxis(at),
                  ),
                  icon: const Icon(Icons.delete_outline),
                  label: Text('Remove ${option.name} option'),
                ),
              ],
            ),
            for (var v = 0; v < option.values.length; v++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  children: [
                    Text(option.values[v]),
                    TextButton(
                      onPressed: () => _fields(
                        title: 'Rename option value',
                        label: 'Option value',
                        value: option.values[v],
                        operation: (value, _) =>
                            _draft.renameValue(at, v, value),
                      ),
                      child: Text(
                        'Rename ${option.values[v]} in ${option.name}',
                      ),
                    ),
                    IconButton(
                      tooltip: 'Remove ${option.values[v]} from ${option.name}',
                      onPressed: () => _remove(
                        title:
                            'Remove ${option.values[v]} from ${option.name}?',
                        operation: () => _draft.removeValue(at, v),
                      ),
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                  ],
                ),
              ),
            TextButton.icon(
              onPressed: () => _fields(
                title: 'Add option value',
                label: 'Option value',
                operation: (value, _) => _draft.addValue(at, value),
              ),
              icon: const Icon(Icons.add),
              label: Text('Add value to ${option.name}'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductOptionFields extends StatefulWidget {
  const _ProductOptionFields({
    required this.title,
    required this.label,
    required this.value,
    this.secondLabel,
    required this.operation,
    required this.guard,
  });
  final String title, label, value;
  final String? secondLabel;
  final Widget Function(Widget) guard;
  final _ProductOptionsDraft Function(String, String?) operation;
  @override
  State<_ProductOptionFields> createState() => _ProductOptionFieldsState();
}

class _ProductOptionFieldsState extends State<_ProductOptionFields> {
  late final _first = TextEditingController(text: widget.value);
  final _second = TextEditingController();
  String? _error;
  bool get _dirty => _first.text != widget.value || _second.text.isNotEmpty;
  @override
  void initState() {
    super.initState();
    _first.addListener(_changed);
    _second.addListener(_changed);
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _first.dispose();
    _second.dispose();
    super.dispose();
  }

  void _save() {
    if (!isLetbuyySurfaceCurrent(context)) return;
    try {
      final result = widget.operation(
        _first.text.trim(),
        widget.secondLabel == null ? null : _second.text.trim(),
      );
      completeLetbuyySurface(context, result);
    } on _OptionProblem catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) => LetbuyyEditorScaffold(
    title: widget.title,
    hasChanges: _dirty,
    currentHasChanges: () => _dirty,
    confirmationGuard: (_, child) => widget.guard(child),
    actions: SizedBox(
      width: double.infinity,
      child: FilledButton(onPressed: _save, child: const Text('Apply change')),
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        CustomTextField(
          controller: _first,
          label: widget.label,
          maxLength: 100,
        ),
        if (widget.secondLabel != null) ...[
          const SizedBox(height: 16),
          CustomTextField(
            controller: _second,
            label: widget.secondLabel!,
            maxLength: 100,
          ),
        ],
        if (_error != null) Semantics(liveRegion: true, child: Text(_error!)),
      ],
    ),
  );
}
