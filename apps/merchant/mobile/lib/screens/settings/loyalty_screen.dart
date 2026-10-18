import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as tokens;
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../services/api_client.dart';
import '../../services/loyalty_service.dart';
import '../../widgets/dashboard/skeleton_loader.dart';

class LoyaltyScreen extends StatefulWidget {
  const LoyaltyScreen({super.key});
  @override
  State<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends State<LoyaltyScreen> {
  final _earn = TextEditingController(),
      _cap = TextEditingController(),
      _value = TextEditingController();
  JsonMap? _snapshot;
  PendingLoyaltySave? _pending;
  Object? _observed, _loadedContext;
  String? _storeId, _error, _notice;
  int _generation = 0;
  bool _loading = true,
      _saving = false,
      _active = false,
      _uncertain = false,
      _conflict = false,
      _blocked = false,
      _needsDiscard = false;

  Object _contextKey() => (
    context.read<StoreContext>().requestContextKey,
    context.read<LoyaltyService>().actorId,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Watch the context even when no form is visible. A route can stay mounted
    // while a different account signs in or the store picker changes.
    final stores = context.watch<StoreContext>();
    final key = (
      stores.requestContextKey,
      context.read<LoyaltyService>().actorId,
    );
    if (_observed == key) return;
    _observed = key;
    _generation++;
    _snapshot = null;
    _pending = null;
    _storeId = null;
    _loadedContext = null;
    _loading = true;
    _saving = false;
    _uncertain = false;
    _error = null;
    _notice = null;
    _earn.clear();
    _cap.clear();
    _value.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _observed == key) _load();
    });
  }

  bool _alive(int generation, Object key) =>
      mounted && generation == _generation && key == _contextKey();

  Future<void> _load({bool discardPending = false}) async {
    final generation = ++_generation;
    final stores = context.read<StoreContext>(),
        service = context.read<LoyaltyService>();
    final epoch = stores.requestContextVersion, actor = service.actorId;
    setState(() {
      _loading = true;
      _snapshot = null;
      _pending = null;
      _error = null;
      _notice = null;
      _blocked = false;
      _conflict = false;
      _uncertain = false;
      _needsDiscard = false;
    });
    Object key = _contextKey();
    try {
      final store = await stores.ensureSelectedStore();
      if (!mounted ||
          generation != _generation ||
          stores.requestContextVersion != epoch ||
          service.actorId != actor)
        return;
      key = _contextKey();
      _observed = key;
      _loadedContext = key;
      _storeId = store?.id;
      if (store == null) {
        setState(() {
          _loading = false;
          _error = 'Select a store before opening loyalty settings.';
        });
        return;
      }
      final loaded = await service.load(
        store.id,
        discardPending: discardPending,
        expectedContext: service.requestContext,
      );
      if (!_alive(generation, key)) return;
      final program = loaded.snapshot['program'] as Map?;
      final draft = loaded.pending?.intent ?? program;
      setState(() {
        _snapshot = loaded.snapshot;
        _pending = loaded.pending;
        _active = draft?['is_active'] == true;
        _earn.text = loyaltyBpsToPercentage(
          draft?['earn_rate_bps'] as int? ?? 0,
        );
        _cap.text = loyaltyBpsToPercentage(
          draft?['redeem_cap_bps'] as int? ?? 5000,
        );
        _value.text = draft?['point_value_minor'] as String? ?? '100';
        _loading = false;
      });
    } catch (error) {
      if (!_alive(generation, key)) return;
      setState(() {
        _loading = false;
        _error = _message(error);
        _blocked = _denied(error);
        _needsDiscard = error is FormatException;
      });
    }
  }

  static bool _denied(Object error) =>
      error is ApiException &&
      (error.code == 'SESSION_CONTEXT_CHANGED' ||
          [401, 403, 404].contains(error.statusCode));
  static String _message(Object error) {
    if (error is ApiException) return error.message;
    if (error is FormatException) return error.message;
    return 'Secure save storage or the connection is unavailable. Reload current settings before trying again.';
  }

  Future<void> _save() async {
    final snapshot = _snapshot, store = _storeId, key = _loadedContext;
    if (_saving ||
        _loading ||
        _blocked ||
        snapshot == null ||
        store == null ||
        key == null ||
        key != _contextKey())
      return;
    if (!_hasPending && (!_valid || !_dirty || _conflict)) return;
    final generation = _generation;
    final captured = context.read<LoyaltyService>().requestContext;
    final intent = <String, dynamic>{
      'expected_updated_at': (snapshot['program'] as Map?)?['updated_at'],
      'is_active': _active,
      'earn_rate_bps': loyaltyPercentageToBps(_earn.text),
      'redeem_cap_bps': loyaltyPercentageToBps(_cap.text),
      'point_value_minor': _value.text,
    };
    setState(() {
      _saving = true;
      _error = null;
      _notice = null;
    });
    try {
      await context.read<LoyaltyService>().save(
        store,
        intent,
        expectedContext: captured,
      );
      if (!_alive(generation, key)) return;
      await _load();
      if (mounted &&
          _contextKey() == key &&
          _snapshot != null &&
          _error == null)
        setState(() => _notice = 'Loyalty settings saved.');
    } catch (error) {
      if (!_alive(generation, key)) return;
      setState(() {
        _error = _message(error);
        _blocked = _denied(error);
        _conflict =
            error is FormatException ||
            (error is ApiException &&
                [400, 409, 422].contains(error.statusCode));
        _uncertain = !_blocked && !_conflict;
        if (_conflict) _pending = null;
        _needsDiscard = error is FormatException;
      });
    } finally {
      if (mounted && _contextKey() == key) setState(() => _saving = false);
    }
  }

  bool get _hasPending => _pending != null || _uncertain;
  bool get _decrease {
    final program = _snapshot?['program'] as Map?;
    return program != null &&
        validLoyaltyPointValue(_value.text) &&
        _snapshot?['value_decrease_allowed'] == false &&
        BigInt.parse(_value.text) <
            BigInt.parse(program['point_value_minor'] as String);
  }

  bool get _valid =>
      loyaltyPercentageToBps(_earn.text) != null &&
      loyaltyPercentageToBps(_cap.text) != null &&
      validLoyaltyPointValue(_value.text) &&
      !_decrease;
  bool get _dirty {
    final program = _snapshot?['program'] as Map?;
    return program == null ||
        _active != program['is_active'] ||
        loyaltyPercentageToBps(_earn.text) != program['earn_rate_bps'] ||
        loyaltyPercentageToBps(_cap.text) != program['redeem_cap_bps'] ||
        _value.text != program['point_value_minor'];
  }

  @override
  void dispose() {
    _generation++;
    _earn.dispose();
    _cap.dispose();
    _value.dispose();
    super.dispose();
  }

  Widget _card(BuildContext context, List<Widget> children) => Card(
    child: Padding(
      padding: const EdgeInsets.all(tokens.LetbuyySpacingTokens.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    ),
  );
  Widget _field(
    String label,
    String name,
    TextEditingController controller, {
    required bool enabled,
    required String helper,
    String? error,
    bool decimal = true,
  }) => Padding(
    padding: const EdgeInsets.only(top: tokens.LetbuyySpacingTokens.lg),
    child: TextField(
      key: ValueKey(name),
      controller: controller,
      enabled: enabled,
      keyboardType: TextInputType.numberWithOptions(decimal: decimal),
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(
        labelText: label,
        helperText: helper,
        helperMaxLines: 4,
        errorText: error,
        errorMaxLines: 3,
        border: const OutlineInputBorder(),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final snapshot = _snapshot, program = snapshot?['program'] as Map?;
    final editable =
        !_loading && !_saving && !_hasPending && !_conflict && !_blocked;
    final pointValid = validLoyaltyPointValue(_value.text);
    final children = <Widget>[
      Text(
        'Set the rewards your store funds for its customers.',
        style: Theme.of(context).textTheme.bodyLarge,
      ),
      const SizedBox(height: tokens.LetbuyySpacingTokens.md),
      if (_loading)
        Semantics(
          label: 'Loading loyalty settings',
          child: const SkeletonCard(height: tokens.LetbuyySpacingTokens.x7l),
        ),
      if (_error != null)
        Semantics(
          liveRegion: true,
          child: _card(context, [
            Text(
              _blocked
                  ? 'Account or store access changed'
                  : 'Loyalty settings need attention',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: tokens.LetbuyySpacingTokens.sm),
            Text(_error!),
          ]),
        ),
      if (_notice != null)
        Semantics(liveRegion: true, child: _card(context, [Text(_notice!)])),
      if (!_blocked && _hasPending)
        _card(context, [
          Text(
            'A previous save needs confirmation',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const Text(
            'Retry the same save to confirm its outcome. Restarting the app keeps that request available.',
          ),
        ]),
      if (!_blocked && snapshot != null) ...[
        _card(context, [
          Text(
            snapshot['enrolled'] == false
                ? 'Loyalty is not set up'
                : program?['is_active'] == true
                ? 'Programme active'
                : 'Programme paused',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: tokens.LetbuyySpacingTokens.sm),
          Text('Outstanding points: ${snapshot['outstanding_points']}'),
          if (program != null)
            Text(
              'Current reward value: ${loyaltyPaiseLabel(BigInt.parse(snapshot['outstanding_points'] as String) * BigInt.parse(program['point_value_minor'] as String))}',
            ),
          const SizedBox(height: tokens.LetbuyySpacingTokens.sm),
          const Text(
            'Point value cannot decrease while customers hold points. Allowed changes are recorded with their reward liability.',
          ),
        ]),
        _card(context, [
          Text(
            'Reward settings',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text('Allow customers to earn and use points'),
            subtitle: const Text(
              'Pausing keeps existing points and their history. Refunds can still restore spent points.',
            ),
            value: _active,
            onChanged: editable
                ? (value) => setState(() => _active = value)
                : null,
          ),
          _field(
            'Earn rate (%)',
            'loyalty-earn',
            _earn,
            enabled: editable,
            helper: 'At 10%, an eligible ₹1,000 order earns 100 whole points. Their value depends on your point value.',
            error: loyaltyPercentageToBps(_earn.text) == null
                ? 'Enter 0 to 100 with up to two decimal places.'
                : null,
          ),
          _field(
            'Maximum order value paid with points (%)',
            'loyalty-cap',
            _cap,
            enabled: editable,
            helper: 'This caps the share of an eligible order that points can pay for.',
            error: loyaltyPercentageToBps(_cap.text) == null
                ? 'Enter 0 to 100 with up to two decimal places.'
                : null,
          ),
          _field(
            'Value per point (paise)',
            'loyalty-value',
            _value,
            enabled: editable,
            decimal: false,
            helper: pointValid
                ? 'One point is worth ${loyaltyPaiseLabel(BigInt.parse(_value.text))}.'
                : '100 paise = ₹1.00.',
            error: !pointValid
                ? 'Enter a positive whole-paise value within the supported range.'
                : _decrease
                ? 'Point value cannot decrease while customers hold points.'
                : null,
          ),
          if (program != null &&
              pointValid &&
              _value.text != program['point_value_minor'])
            Padding(
              padding: const EdgeInsets.only(
                top: tokens.LetbuyySpacingTokens.md,
              ),
              child: Text(
                'Change in outstanding reward value: ${loyaltyPaiseLabel(BigInt.parse(snapshot['outstanding_points'] as String) * (BigInt.parse(_value.text) - BigInt.parse(program['point_value_minor'] as String)))}',
              ),
            ),
          const SizedBox(height: tokens.LetbuyySpacingTokens.lg),
          FilledButton(
            onPressed:
                !_saving &&
                    !_loading &&
                    (_hasPending || (_valid && _dirty && !_conflict))
                ? _save
                : null,
            child: Text(
              _saving
                  ? 'Saving loyalty…'
                  : _hasPending
                  ? 'Retry same save'
                  : 'Save loyalty',
            ),
          ),
          TextButton(
            onPressed: _saving || _loading
                ? null
                : () => _load(discardPending: true),
            child: Text(
              _hasPending || _needsDiscard
                  ? 'Discard pending save and reload'
                  : 'Reload current saved settings',
            ),
          ),
        ]),
      ],
      if (!_loading && (snapshot == null || _blocked))
        OutlinedButton(
          onPressed: () => _load(discardPending: _needsDiscard),
          child: Text(
            _needsDiscard
                ? 'Discard pending save and reload'
                : 'Retry loading loyalty',
          ),
        ),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Loyalty')),
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ListView(
              padding: const EdgeInsets.all(tokens.LetbuyySpacingTokens.lg),
              children: children,
            ),
          ),
        ),
      ),
    );
  }
}
