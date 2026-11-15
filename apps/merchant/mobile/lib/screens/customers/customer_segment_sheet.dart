import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../app/store_context.dart';
import '../../services/api_client.dart';
import '../../services/customer_service.dart';
import '../../widgets/shared/merchant_store_view.dart';

/// Native editor for the existing CustomerSegmentRules contract. Customer spend
/// and its threshold are rupee-valued commerce amounts, not ledger minor units.
class CustomerSegmentSheet extends StatefulWidget {
  const CustomerSegmentSheet({super.key, required this.storeId, this.segment});
  final String storeId;
  final CustomerSegmentContract? segment;
  @override
  State<CustomerSegmentSheet> createState() => _CustomerSegmentSheetState();
}

class _CustomerSegmentSheetState extends State<CustomerSegmentSheet> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name,
      _description,
      _tags,
      _orders,
      _spend,
      _after,
      _before;
  late final Object _contextKey;
  String _status = '', _marketing = '';
  int _revision = 0;
  int? _preview;
  String? _error, _savedId, _commandKey;
  bool _saving = false, _previewing = false;
  bool _apiBound = false, _readDenied = false;
  Object? _apiContext;
  Map<String, dynamic>? _pending;

  bool get _current =>
      mounted &&
      context.read<StoreContext>().requestContextKey == _contextKey &&
      context.read<StoreContext>().selectedStoreId == widget.storeId &&
      _apiBound &&
      _apiContext == context.read<CustomerService>().requestContext &&
      !_readDenied &&
      !context.read<CustomerService>().hasDeniedRead(widget.storeId);

  @override
  void initState() {
    super.initState();
    _contextKey = context.read<StoreContext>().requestContextKey;
    final segment = widget.segment,
        rules = segment?.rules ?? <String, dynamic>{};
    _name = TextEditingController(text: segment?.name);
    _description = TextEditingController(text: segment?.description);
    _tags = TextEditingController(text: segment?.tagsAny.join(', '));
    _orders = TextEditingController(
      text: rules['min_order_count']?.toString() ?? '',
    );
    _spend = TextEditingController(
      text: rules['min_total_spent']?.toString() ?? '',
    );
    _after = TextEditingController(text: _day(rules['last_order_after']));
    _before = TextEditingController(text: _day(rules['last_order_before']));
    _status = rules['status']?.toString() ?? '';
    _marketing = rules['accepts_marketing'] is bool
        ? (rules['accepts_marketing'] == true ? 'yes' : 'no')
        : '';
  }

  String _day(Object? value) =>
      DateTime.tryParse(
        value?.toString() ?? '',
      )?.toUtc().toIso8601String().substring(0, 10) ??
      '';
  DateTime? _date(String value) {
    if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) return null;
    final parsed = DateTime.tryParse('${value}T00:00:00.000Z');
    return parsed?.toIso8601String().startsWith(value) == true ? parsed : null;
  }

  @override
  void dispose() {
    for (final controller in [
      _name,
      _description,
      _tags,
      _orders,
      _spend,
      _after,
      _before,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _edited(String _) {
    setState(() {
      ++_revision;
      _preview = null;
      _error = null;
    });
  }

  List<String> get _tagValues => _tags.text
      .split(',')
      .map((value) => value.trim())
      .where((value) => value.isNotEmpty)
      .toSet()
      .toList();
  Map<String, dynamic> _rules() => {
    if (_status.isNotEmpty) 'status': _status,
    if (_marketing.isNotEmpty) 'accepts_marketing': _marketing == 'yes',
    'tags_any': _tagValues,
    if (_orders.text.trim().isNotEmpty)
      'min_order_count': int.parse(_orders.text.trim()),
    if (_spend.text.trim().isNotEmpty)
      'min_total_spent': double.parse(_spend.text.trim()),
    if (_after.text.isNotEmpty)
      'last_order_after': _date(_after.text)!.toIso8601String(),
    if (_before.text.isNotEmpty)
      'last_order_before': _date(_before.text)!
          .add(const Duration(days: 1))
          .subtract(const Duration(milliseconds: 1))
          .toIso8601String(),
  };

  Future<void> _previewRules() async {
    if (!_current || _previewing || !(_form.currentState?.validate() ?? false))
      return;
    final revision = _revision;
    setState(() {
      _previewing = true;
      _error = null;
      _preview = null;
    });
    try {
      final result = await context.read<CustomerService>().previewSegment(
        storeId: widget.storeId,
        rules: _rules(),
      );
      if (!_current || revision != _revision) return;
      if (result['store_id'] != widget.storeId ||
          result['customer_count'] is! int)
        throw const FormatException('Unconfirmed segment preview');
      setState(() => _preview = result['customer_count'] as int);
    } catch (_) {
      if (_current && revision == _revision)
        setState(() => _error = 'Preview could not be loaded. Please retry.');
    } finally {
      if (_current) setState(() => _previewing = false);
    }
  }

  Future<void> _save() async {
    if (!_current || _saving || !(_form.currentState?.validate() ?? false))
      return;
    _pending ??= {
      'name': _name.text.trim(),
      'description': _description.text.trim().isEmpty
          ? null
          : _description.text.trim(),
      'rules': _rules(),
    };
    _commandKey ??= 'mobile-segment-${const Uuid().v4()}';
    final input = _pending!, service = context.read<CustomerService>();
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      if (_savedId == null) {
        final options = ApiRequestOptions(
          idempotencyKey: _commandKey,
          expectedContextVersion: _contextKey,
          storeId: widget.storeId,
        );
        final saved = widget.segment == null
            ? await service.createSegment(
                storeId: widget.storeId,
                name: input['name'] as String,
                description: input['description'] as String?,
                rules: input['rules'] as Map<String, dynamic>,
                options: options,
              )
            : await service.updateSegment(
                widget.segment!,
                name: input['name'] as String,
                description: input['description'] as String?,
                rules: input['rules'] as Map<String, dynamic>,
                options: options,
              );
        if (!_current) return;
        _savedId = saved.id;
      }
      final rows = await service.fetchSegments(widget.storeId);
      if (!_current) return;
      final confirmed = rows.where((row) => row.id == _savedId).firstOrNull;
      final rules = input['rules'] as Map<String, dynamic>;
      const scalarKeys = [
        'status',
        'accepts_marketing',
        'min_order_count',
        'min_total_spent',
        'last_order_after',
        'last_order_before',
      ];
      if (confirmed == null ||
          confirmed.name != input['name'] ||
          confirmed.description != input['description'] ||
          !scalarKeys.every((key) => confirmed.rules[key] == rules[key]) ||
          !listEquals(confirmed.tagsAny, rules['tags_any'] as List<String>))
        throw const FormatException('Saved segment not confirmed');
      Navigator.pop(context, confirmed);
    } catch (_) {
      if (_current)
        setState(
          () => _error = _savedId == null
              ? 'Save could not be confirmed. Retry the same saved intent, or close and refresh segments before creating another.'
              : 'The saved segment could not be confirmed. Retry confirmation or close and refresh segments.',
        );
    } finally {
      if (_current) setState(() => _saving = false);
    }
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    String? Function(String?)? validator,
    TextInputType? keyboardType,
    int maxLines = 1,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: LetbuyySpacingTokens.space16),
    child: CustomTextField(
      key: ValueKey('segment-$label'),
      controller: controller,
      enabled: _pending == null && !_saving,
      onChanged: _edited,
      keyboardType: keyboardType,
      maxLines: maxLines,
      validator: validator,
      label: label,
    ),
  );

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    final service = context.watch<CustomerService>();
    if (!_apiBound) {
      _apiBound = true;
      _apiContext = service.requestContext;
    }
    if (service.hasDeniedRead(widget.storeId)) _readDenied = true;
    if (!_current ||
        (widget.segment != null && widget.segment!.storeId != widget.storeId)) {
      return LetbuyyEditorScaffold(
        title: 'Segment unavailable',
        hasChanges: false,
        body: ListView(
          padding: const EdgeInsets.all(LetbuyySpacingTokens.space24),
          children: [
            const Text(
              'Store access changed. Close this form and reload the selected store.',
            ),
            if (_pending != null)
              const Text(
                'A saved request may already have completed. Closing does not cancel server work and loses this editor’s retry state. Review segments after access is restored.',
              ),
          ],
        ),
        actions: TextButton(
          onPressed: () => completeLetbuyySurface(context),
          child: const Text('Close'),
        ),
      );
    }
    final enabled = _pending == null && !_saving;
    return LetbuyyEditorScaffold(
      title: widget.segment == null ? 'Create segment' : 'Edit segment',
      hasChanges: _revision > 0 || _pending != null,
      isBusy: _saving,
      discardMessage: _pending == null
          ? 'Your unsaved segment rules will be discarded.'
          : 'This request may already have completed. Closing loses this editor’s retry state. Refresh segments before creating another.',
      confirmationGuard: (_, confirmation) => guardMerchantStoreView((
        key: _contextKey,
        storeId: widget.storeId,
      ), confirmation),
      body: Form(
        key: _form,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(LetbuyySpacingTokens.space20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _field(
                _name,
                'Segment name',
                validator: (v) =>
                    v == null || v.trim().isEmpty || v.trim().length > 100
                    ? 'Enter a name of up to 100 characters.'
                    : null,
              ),
              _field(
                _description,
                'Description',
                maxLines: 2,
                validator: (v) =>
                    (v?.length ?? 0) > 500 ? 'Use up to 500 characters.' : null,
              ),
              LetbuyyChoiceField<String>(
                label: 'Customer status',
                value: _status,
                choices: const [
                  LetbuyyChoice(value: '', label: 'Any status'),
                  LetbuyyChoice(value: 'active', label: 'Active'),
                  LetbuyyChoice(value: 'disabled', label: 'Disabled'),
                  LetbuyyChoice(value: 'invited', label: 'Invited'),
                ],
                onChanged: enabled
                    ? (v) {
                        setState(() => _status = v);
                        _edited('');
                      }
                    : null,
              ),
              LetbuyyChoiceField<String>(
                label: 'Marketing consent',
                value: _marketing,
                choices: const [
                  LetbuyyChoice(value: '', label: 'Any consent'),
                  LetbuyyChoice(value: 'yes', label: 'Accepts marketing'),
                  LetbuyyChoice(
                    value: 'no',
                    label: 'Does not accept marketing',
                  ),
                ],
                onChanged: enabled
                    ? (v) {
                        setState(() => _marketing = v);
                        _edited('');
                      }
                    : null,
              ),
              _field(
                _tags,
                'Tags (any)',
                validator: (_) =>
                    _tagValues.length > 20 ||
                        _tagValues.any((tag) => tag.length > 50)
                    ? 'Use up to 20 tags, each up to 50 characters.'
                    : null,
              ),
              _field(
                _orders,
                'Minimum orders',
                keyboardType: TextInputType.number,
                validator: (v) =>
                    v == null ||
                        v.trim().isEmpty ||
                        (int.tryParse(v.trim()) != null &&
                            int.parse(v.trim()) >= 0)
                    ? null
                    : 'Enter a non-negative whole number.',
              ),
              _field(
                _spend,
                'Minimum spend (INR)',
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
                  final value = double.tryParse(v.trim());
                  return value != null &&
                          value.isFinite &&
                          value >= 0 &&
                          value <= 99999999.99 &&
                          RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(v.trim())
                      ? null
                      : 'Enter a rupee amount with up to two decimal places.';
                },
              ),
              _field(
                _after,
                'Last order from (YYYY-MM-DD)',
                keyboardType: TextInputType.datetime,
                validator: (v) => v == null || v.isEmpty || _date(v) != null
                    ? null
                    : 'Enter a valid date as YYYY-MM-DD.',
              ),
              _field(
                _before,
                'Last order through (YYYY-MM-DD)',
                keyboardType: TextInputType.datetime,
                validator: (v) {
                  if (v == null || v.isEmpty) return null;
                  final date = _date(v), after = _date(_after.text);
                  return date == null
                      ? 'Enter a valid date as YYYY-MM-DD.'
                      : after != null && date.isBefore(after)
                      ? 'End date must follow the start date.'
                      : null;
                },
              ),
              const SizedBox(height: 12),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: LetbuyySpacingTokens.space12,
                children: [
                  TextButton.icon(
                    onPressed: enabled && !_previewing ? _previewRules : null,
                    icon: const Icon(Icons.visibility_outlined),
                    label: Text(_previewing ? 'Loading preview…' : 'Preview'),
                  ),
                  if (_preview != null) Text('$_preview customers'),
                ],
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: OverflowBar(
        alignment: MainAxisAlignment.end,
        spacing: LetbuyySpacingTokens.space12,
        children: [
          TextButton(
            onPressed: _saving ? null : () => Navigator.maybePop(context),
            child: const Text('Close'),
          ),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(
              _saving
                  ? 'Confirming…'
                  : _savedId != null
                  ? 'Retry confirmation'
                  : _pending != null
                  ? 'Retry save'
                  : 'Save segment',
            ),
          ),
        ],
      ),
    );
  }
}
