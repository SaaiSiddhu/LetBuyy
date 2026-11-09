import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../widgets/shared/merchant_store_view.dart';

import '../../models/store_model.dart';
import '../../services/shipping_tax_service.dart';
import '../../services/api_client.dart' show ApiException;
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class ShippingScreen extends StatefulWidget {
  const ShippingScreen({super.key});
  @override
  State<ShippingScreen> createState() => _ShippingShellState();
}

class _ShippingShellState extends State<ShippingScreen> {
  bool _hadSelection = false;
  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    _hadSelection = _hadSelection || stores.selectedStoreId != null;
    return _ShippingWorkspace(
      key: ValueKey(stores.requestContextKey),
      discoverStore: !_hadSelection,
    );
  }
}

class _ShippingWorkspace extends StatefulWidget {
  const _ShippingWorkspace({super.key, required this.discoverStore});
  final bool discoverStore;

  @override
  State<_ShippingWorkspace> createState() => _ShippingScreenState();
}

class _ShippingScreenState extends State<_ShippingWorkspace> {
  static const _rateTypes = ['flat', 'free', 'price_based', 'weight_based'];

  StoreModel? _store;
  late final Object? _openedKey;
  int _readGeneration = 0;
  Widget _guard(Widget child) => guardMerchantStoreView(
    _store == null ? null : (key: _openedKey, storeId: _store!.id),
    child,
  );
  List<ShippingZoneContract> _zones = const [];
  List<ShippingRateContract> _rates = const [];
  bool _showRates = false;
  bool _isLoading = true;
  bool _isBusy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _openedKey = context.read<StoreContext>().requestContextKey;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadShipping());
  }

  Future<void> _loadShipping() async {
    if (!mounted) return;
    final generation = ++_readGeneration;
    setState(() {
      _isLoading = true;
      _error = null;
      _store = null;
      _zones = [];
      _rates = [];
    });

    try {
      final stores = context.read<StoreContext>();
      final store = widget.discoverStore
          ? await stores.ensureSelectedStore()
          : stores.selectedStore;
      if (store == null) {
        if (!mounted || generation != _readGeneration) return;
        setState(() {
          _store = null;
          _zones = const [];
          _rates = const [];
        });
        return;
      }

      final summary = await context.read<ShippingTaxService>().fetchShipping(
        store.id,
      );
      if (!mounted ||
          generation != _readGeneration ||
          context.read<StoreContext>().selectedStoreId != store.id)
        return;
      setState(() {
        _store = store;
        _zones = summary.zones;
        _rates = summary.rates;
      });
    } catch (error) {
      if (!mounted || generation != _readGeneration) return;
      setState(
        () => _error =
            'Shipping settings could not load. Check your connection and store access, then retry.',
      );
    } finally {
      if (mounted && generation == _readGeneration)
        setState(() => _isLoading = false);
    }
  }

  Future<void> _openZoneEditor(ShippingZoneContract? zone) async {
    final store = _store;
    if (store == null || _isBusy) return;
    final result = await _showZoneEditor(store.id, zone);
    if (result == null || !mounted) return;

    await _runAction(() async {
      if (zone == null) {
        await context.read<ShippingTaxService>().createZone(result);
        _showMessage('Shipping zone created', isSuccess: true);
      } else {
        await context.read<ShippingTaxService>().updateZone(zone.id, result);
        _showMessage('Shipping zone updated', isSuccess: true);
      }
      await _loadShipping();
    });
  }

  Future<ShippingZoneInput?> _showZoneEditor(
    String storeId,
    ShippingZoneContract? zone,
  ) async {
    final colors = AppThemeColors.of(context);
    final nameController = TextEditingController(text: zone?.name ?? '');
    final countriesController = TextEditingController(
      text: zone?.countries.join(', ') ?? 'IN',
    );
    final statesController = TextEditingController(
      text: zone?.states.join(', ') ?? '',
    );
    final zipController = TextEditingController(
      text: zone?.zipCodes.join(', ') ?? '',
    );
    String? dialogError;

    final route = DialogRoute<ShippingZoneInput>(
      context: context,
      builder: (dialogContext) => _guard(
        StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            backgroundColor: colors.card,
            title: Text(
              zone == null ? 'New shipping zone' : 'Edit shipping zone',
              style: TextStyle(color: colors.textPrimary),
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(labelText: 'Zone name'),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: countriesController,
                    decoration: const InputDecoration(
                      labelText: 'Countries',
                      hintText: 'IN, US',
                    ),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: statesController,
                    decoration: const InputDecoration(
                      labelText: 'States',
                      hintText: 'Karnataka, Maharashtra',
                    ),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: zipController,
                    decoration: const InputDecoration(
                      labelText: 'PIN/ZIP codes',
                      hintText: '560001, 110001',
                    ),
                    textInputAction: TextInputAction.done,
                  ),
                  if (dialogError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        dialogError!,
                        style: TextStyle(color: colors.error, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () {
                  final name = nameController.text.trim();
                  final countries = _splitList(countriesController.text);
                  if (name.isEmpty || countries.isEmpty) {
                    setDialogState(() {
                      dialogError =
                          'Zone name and at least one country are required';
                    });
                    return;
                  }
                  Navigator.pop(
                    dialogContext,
                    ShippingZoneInput(
                      storeId: storeId,
                      name: name,
                      countries: countries,
                      states: _splitList(statesController.text),
                      zipCodes: _splitList(zipController.text),
                    ),
                  );
                },
                child: Text(zone == null ? 'Create' : 'Save'),
              ),
            ],
          ),
        ),
      ),
    );

    final result = await Navigator.of(context, rootNavigator: true).push(route);
    // The popped future precedes the exit transition; keep controllers alive until removal.
    await route.completed;
    nameController.dispose();
    countriesController.dispose();
    statesController.dispose();
    zipController.dispose();
    return result;
  }

  Future<void> _deleteZone(ShippingZoneContract zone) async {
    final confirmed = await _confirm(
      title: 'Delete zone?',
      message: 'Delete "${zone.name}" and its shipping rates.',
      action: 'Delete',
    );
    if (confirmed != true || !mounted) return;

    await _runAction(() async {
      await context.read<ShippingTaxService>().deleteZone(zone.id);
      _showMessage('Shipping zone deleted', isSuccess: true);
      await _loadShipping();
    });
  }

  Future<void> _openRateEditor(ShippingRateContract? rate) async {
    if (_zones.isEmpty || _isBusy) return;
    final result = await _showRateEditor(rate);
    if (result == null || !mounted) return;

    await _runAction(() async {
      if (rate == null) {
        await context.read<ShippingTaxService>().createRate(result);
        _showMessage('Shipping rate created', isSuccess: true);
      } else {
        await context.read<ShippingTaxService>().updateRate(rate.id, result);
        _showMessage('Shipping rate updated', isSuccess: true);
      }
      await _loadShipping();
    });
  }

  Future<ShippingRateInput?> _showRateEditor(ShippingRateContract? rate) async {
    final colors = AppThemeColors.of(context);
    var zoneId = rate?.zoneId ?? _zones.first.id;
    var type = rate?.type ?? 'flat';
    var isActive = rate?.isActive ?? true;
    final nameController = TextEditingController(text: rate?.name ?? '');
    final priceController = TextEditingController(
      text: rate == null ? '0' : _numberText(rate.price),
    );
    final minOrderController = TextEditingController(
      text: rate?.minOrderAmount == null
          ? ''
          : _numberText(rate!.minOrderAmount!),
    );
    final maxOrderController = TextEditingController(
      text: rate?.maxOrderAmount == null
          ? ''
          : _numberText(rate!.maxOrderAmount!),
    );
    final etaMinController = TextEditingController(
      text: rate?.estimatedDaysMin?.toString() ?? '',
    );
    final etaMaxController = TextEditingController(
      text: rate?.estimatedDaysMax?.toString() ?? '',
    );
    String? dialogError;

    final route = DialogRoute<ShippingRateInput>(
      context: context,
      builder: (dialogContext) => _guard(
        StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            backgroundColor: colors.card,
            title: Text(
              rate == null ? 'New shipping rate' : 'Edit shipping rate',
              style: TextStyle(color: colors.textPrimary),
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    value: zoneId,
                    decoration: const InputDecoration(labelText: 'Zone'),
                    items: _zones
                        .map(
                          (zone) => DropdownMenuItem(
                            value: zone.id,
                            child: Text(zone.name),
                          ),
                        )
                        .toList(growable: false),
                    onChanged: (value) {
                      setDialogState(() => zoneId = value ?? zoneId);
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(labelText: 'Rate name'),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _rateTypes.contains(type) ? type : 'flat',
                    decoration: const InputDecoration(labelText: 'Type'),
                    items: _rateTypes
                        .map(
                          (item) => DropdownMenuItem(
                            value: item,
                            child: Text(_sentenceCase(item)),
                          ),
                        )
                        .toList(growable: false),
                    onChanged: (value) {
                      setDialogState(() => type = value ?? 'flat');
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: priceController,
                    decoration: const InputDecoration(labelText: 'Price'),
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: minOrderController,
                          decoration: const InputDecoration(
                            labelText: 'Min order',
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: maxOrderController,
                          decoration: const InputDecoration(
                            labelText: 'Max order',
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: etaMinController,
                          decoration: const InputDecoration(
                            labelText: 'ETA min days',
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: etaMaxController,
                          decoration: const InputDecoration(
                            labelText: 'ETA max days',
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: isActive,
                    title: Text(
                      'Active',
                      style: TextStyle(color: colors.textPrimary),
                    ),
                    onChanged: (value) {
                      setDialogState(() => isActive = value);
                    },
                  ),
                  if (dialogError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        dialogError!,
                        style: TextStyle(color: colors.error, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () {
                  final name = nameController.text.trim();
                  final price = double.tryParse(priceController.text.trim());
                  if (name.isEmpty || price == null) {
                    setDialogState(() {
                      dialogError = 'Rate name and numeric price are required';
                    });
                    return;
                  }
                  Navigator.pop(
                    dialogContext,
                    ShippingRateInput(
                      zoneId: zoneId,
                      name: name,
                      type: type,
                      price: price,
                      minOrderAmount: _optionalDouble(minOrderController.text),
                      maxOrderAmount: _optionalDouble(maxOrderController.text),
                      estimatedDaysMin: _optionalInt(etaMinController.text),
                      estimatedDaysMax: _optionalInt(etaMaxController.text),
                      isActive: isActive,
                    ),
                  );
                },
                child: Text(rate == null ? 'Create' : 'Save'),
              ),
            ],
          ),
        ),
      ),
    );

    final result = await Navigator.of(context, rootNavigator: true).push(route);
    // The popped future precedes the exit transition; keep controllers alive until removal.
    await route.completed;
    nameController.dispose();
    priceController.dispose();
    minOrderController.dispose();
    maxOrderController.dispose();
    etaMinController.dispose();
    etaMaxController.dispose();
    return result;
  }

  Future<void> _deleteRate(ShippingRateContract rate) async {
    final confirmed = await _confirm(
      title: 'Delete rate?',
      message: 'Delete "${rate.name}" from this zone.',
      action: 'Delete',
    );
    if (confirmed != true || !mounted) return;

    await _runAction(() async {
      await context.read<ShippingTaxService>().deleteRate(rate.id);
      _showMessage('Shipping rate deleted', isSuccess: true);
      await _loadShipping();
    });
  }

  Future<bool?> _confirm({
    required String title,
    required String message,
    required String action,
  }) {
    final colors = AppThemeColors.of(context);
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => _guard(
        AlertDialog(
          backgroundColor: colors.card,
          title: Text(title, style: TextStyle(color: colors.textPrimary)),
          content: Text(message, style: TextStyle(color: colors.textSecondary)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(action),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _runAction(Future<void> Function() action) async {
    if (!mounted ||
        _isBusy ||
        _store == null ||
        context.read<StoreContext>().selectedStoreId != _store!.id)
      return;
    setState(() => _isBusy = true);
    try {
      await action();
    } catch (error) {
      if (mounted) {
        if (error is ApiException &&
            [401, 403, 404].contains(error.statusCode)) {
          setState(() {
            _store = null;
            _zones = [];
            _rates = [];
            _error =
                'Shipping settings are unavailable for this account. Reload settings.';
          });
        }
        _showMessage(
          'The shipping change could not be confirmed. Reload settings before retrying.',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final selectedStoreId = context.watch<StoreContext>().selectedStoreId;
    final storeChanged = _store != null && selectedStoreId != _store!.id;
    return Scaffold(
      backgroundColor: colors.bgStart,
      floatingActionButton: _store == null || storeChanged
          ? null
          : FloatingActionButton.extended(
              onPressed: _isBusy
                  ? null
                  : () => _showRates
                        ? _openRateEditor(null)
                        : _openZoneEditor(null),
              backgroundColor: LetbuyyColorTokens.brandPrimary,
              foregroundColor: LetbuyyColorTokens.white,
              icon: const Icon(Icons.add_rounded),
              label: Text(_showRates ? 'New rate' : 'New zone'),
            ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeader(colors),
                const SizedBox(height: 14),
                _buildModeSwitch(colors),
                const SizedBox(height: 14),
                Expanded(child: _buildBody(colors)),
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
                'Shipping',
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
          onPressed: _isLoading || _isBusy ? null : _loadShipping,
          icon: Icon(Icons.refresh_rounded, color: colors.textPrimary),
          tooltip: 'Refresh shipping',
        ),
      ],
    );
  }

  Widget _buildModeSwitch(AppThemeColors colors) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        ChoiceChip(
          label: const Text('Zones'),
          selected: !_showRates,
          onSelected: (_) => setState(() => _showRates = false),
          selectedColor: LetbuyyColorTokens.brandPrimary.withValues(
            alpha: 0.18,
          ),
          labelStyle: TextStyle(
            color: !_showRates
                ? LetbuyyColorTokens.brandPrimary
                : colors.textSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
        ChoiceChip(
          label: const Text('Rates'),
          selected: _showRates,
          onSelected: (_) => setState(() => _showRates = true),
          selectedColor: LetbuyyColorTokens.brandPrimary.withValues(
            alpha: 0.18,
          ),
          labelStyle: TextStyle(
            color: _showRates
                ? LetbuyyColorTokens.brandPrimary
                : colors.textSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (!_isLoading && _error == null && _store != null)
          Text(
            '${_zones.length} zones • ${_rates.length} rates',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
      ],
    );
  }

  Widget _buildBody(AppThemeColors colors) {
    if (_store != null &&
        context.read<StoreContext>().selectedStoreId != _store!.id) {
      return _buildMessage(
        colors,
        'The selected store changed. Refresh shipping before editing.',
        Icons.sync_problem_outlined,
      );
    }
    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(
          color: LetbuyyColorTokens.brandPrimary,
        ),
      );
    }
    if (_error != null) return _buildMessage(colors, _error!, Icons.error);
    if (_store == null) {
      return _buildMessage(
        colors,
        'Create or select a store before configuring shipping.',
        Icons.storefront_outlined,
      );
    }
    if (_showRates) {
      if (_rates.isEmpty) {
        return _buildMessage(
          colors,
          _zones.isEmpty
              ? 'Create a zone before adding shipping rates.'
              : 'Add the first shipping rate for this store.',
          Icons.local_shipping_outlined,
        );
      }
      return ListView(
        padding: const EdgeInsets.only(bottom: 96),
        children: _rates.map((rate) => _buildRateCard(rate, colors)).toList(),
      );
    }
    if (_zones.isEmpty) {
      return _buildMessage(
        colors,
        'Create the first region where you ship orders.',
        Icons.public_rounded,
      );
    }
    return ListView(
      padding: const EdgeInsets.only(bottom: 96),
      children: _zones.map((zone) => _buildZoneCard(zone, colors)).toList(),
    );
  }

  Widget _buildZoneCard(ShippingZoneContract zone, AppThemeColors colors) {
    final rateCount = _rates.where((rate) => rate.zoneId == zone.id).length;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  zone.name,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Edit zone',
                icon: Icon(Icons.edit_rounded, color: colors.textSecondary),
                onPressed: _isBusy ? null : () => _openZoneEditor(zone),
              ),
              IconButton(
                tooltip: 'Delete zone',
                icon: Icon(Icons.delete_outline_rounded, color: colors.error),
                onPressed: _isBusy ? null : () => _deleteZone(zone),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _detailLine(colors, 'Countries', zone.countries.join(', ')),
          if (zone.states.isNotEmpty)
            _detailLine(colors, 'States', zone.states.join(', ')),
          if (zone.zipCodes.isNotEmpty)
            _detailLine(colors, 'PIN/ZIP', zone.zipCodes.join(', ')),
          const SizedBox(height: 8),
          Row(
            children: [
              _pill(colors, '$rateCount rates'),
              const Spacer(),
              TextButton.icon(
                onPressed: _isBusy ? null : () => _openRateEditor(null),
                icon: const Icon(Icons.add_rounded),
                label: const Text('Add rate'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRateCard(ShippingRateContract rate, AppThemeColors colors) {
    final zoneName = _zoneName(rate.zoneId);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  rate.name,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Edit rate',
                icon: Icon(Icons.edit_rounded, color: colors.textSecondary),
                onPressed: _isBusy ? null : () => _openRateEditor(rate),
              ),
              IconButton(
                tooltip: 'Delete rate',
                icon: Icon(Icons.delete_outline_rounded, color: colors.error),
                onPressed: _isBusy ? null : () => _deleteRate(rate),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _pill(colors, _sentenceCase(rate.type)),
              _pill(colors, rate.isActive ? 'Active' : 'Inactive'),
              if (zoneName != null) _pill(colors, zoneName),
            ],
          ),
          const SizedBox(height: 10),
          _detailLine(colors, 'Price', '₹${_numberText(rate.price)}'),
          if (rate.minOrderAmount != null || rate.maxOrderAmount != null)
            _detailLine(
              colors,
              'Order range',
              '${_moneyOrAny(rate.minOrderAmount)} - ${_moneyOrAny(rate.maxOrderAmount)}',
            ),
          if (rate.estimatedDaysMin != null || rate.estimatedDaysMax != null)
            _detailLine(
              colors,
              'Delivery',
              '${rate.estimatedDaysMin ?? 0}-${rate.estimatedDaysMax ?? rate.estimatedDaysMin ?? 0} days',
            ),
        ],
      ),
    );
  }

  Widget _detailLine(AppThemeColors colors, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(
              label,
              style: TextStyle(color: colors.textTertiary, fontSize: 12),
            ),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? 'Any' : value,
              style: TextStyle(color: colors.textSecondary, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill(AppThemeColors colors, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildMessage(AppThemeColors colors, String text, IconData icon) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: colors.textTertiary, size: 40),
          const SizedBox(height: 12),
          Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }

  void _showMessage(
    String message, {
    bool isError = false,
    bool isSuccess = false,
  }) {
    final colors = AppThemeColors.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? colors.error
            : isSuccess
            ? colors.success
            : colors.snackbarBackground,
      ),
    );
  }

  static List<String> _splitList(String value) {
    return value
        .split(',')
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }

  static double? _optionalDouble(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : double.tryParse(trimmed);
  }

  static int? _optionalInt(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : int.tryParse(trimmed);
  }

  static String _numberText(double value) {
    if (value == value.roundToDouble()) return value.toInt().toString();
    return value.toStringAsFixed(2);
  }

  static String _moneyOrAny(double? value) {
    return value == null ? 'Any' : '₹${_numberText(value)}';
  }

  static String _sentenceCase(String value) {
    final normalized = value.replaceAll('-', ' ').replaceAll('_', ' ').trim();
    if (normalized.isEmpty) return value;
    return '${normalized[0].toUpperCase()}${normalized.substring(1)}';
  }

  String? _zoneName(String zoneId) {
    for (final zone in _zones) {
      if (zone.id == zoneId) return zone.name;
    }
    return null;
  }
}
