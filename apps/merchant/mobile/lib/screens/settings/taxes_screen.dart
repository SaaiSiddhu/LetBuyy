import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../models/store_model.dart';
import '../../services/shipping_tax_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class TaxesScreen extends StatefulWidget {
  const TaxesScreen({super.key});

  @override
  State<TaxesScreen> createState() => _TaxesScreenState();
}

class _TaxesScreenState extends State<TaxesScreen> {
  static const _appliesToOptions = ['all', 'products', 'shipping'];

  StoreModel? _store;
  List<TaxRateContract> _taxRates = const [];
  bool _taxInclusive = false;
  bool _isLoading = true;
  bool _isBusy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTaxes();
  }

  Future<void> _loadTaxes() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store == null) {
        if (!mounted) return;
        setState(() {
          _store = null;
          _taxRates = const [];
          _taxInclusive = false;
        });
        return;
      }

      final rates = await context.read<ShippingTaxService>().fetchTaxes(
        store.id,
      );
      if (!mounted || context.read<StoreContext>().selectedStoreId != store.id)
        return;
      setState(() {
        _store = store;
        _taxRates = rates;
        _taxInclusive = store.taxInclusive;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Tax settings could not load.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _setTaxInclusive(bool value) async {
    final store = _store;
    if (store == null ||
        _isBusy ||
        context.read<StoreContext>().selectedStoreId != store.id)
      return;
    setState(() {
      _isBusy = true;
      _taxInclusive = value;
    });
    try {
      final updated = await context.read<StoreService>().updateStore(store.id, {
        'tax_inclusive': value,
      });
      if (!mounted || context.read<StoreContext>().selectedStoreId != store.id)
        return;
      setState(() {
        _store = updated;
        _taxInclusive = updated.taxInclusive;
      });
      _showMessage('Tax-inclusive setting saved', isSuccess: true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _taxInclusive = store.taxInclusive);
      _showMessage('Tax settings could not be saved.', isError: true);
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _openTaxEditor(TaxRateContract? rate) async {
    final store = _store;
    if (store == null || _isBusy) return;
    final result = await _showTaxEditor(store.id, rate);
    if (result == null) return;

    await _runAction(() async {
      if (rate == null) {
        await context.read<ShippingTaxService>().createTaxRate(result);
        _showMessage('Tax rate created', isSuccess: true);
      } else {
        await context.read<ShippingTaxService>().updateTaxRate(rate.id, result);
        _showMessage('Tax rate updated', isSuccess: true);
      }
      await _loadTaxes();
    });
  }

  Future<TaxRateInput?> _showTaxEditor(
    String storeId,
    TaxRateContract? rate,
  ) async {
    final colors = AppThemeColors.of(context);
    final nameController = TextEditingController(text: rate?.name ?? '');
    final rateController = TextEditingController(
      text: rate == null ? '18' : _numberText(rate.rate),
    );
    final countryController = TextEditingController(
      text: rate?.country ?? 'IN',
    );
    final stateController = TextEditingController(text: rate?.state ?? '');
    final hsnController = TextEditingController(text: rate?.hsnCode ?? '');
    final priorityController = TextEditingController(
      text: (rate?.priority ?? 0).toString(),
    );
    var appliesTo = rate?.appliesTo ?? 'all';
    var isCompound = rate?.isCompound ?? false;
    var isShipping = rate?.isShipping ?? false;
    var isActive = rate?.isActive ?? true;
    String? dialogError;

    final result = await showDialog<TaxRateInput>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: colors.card,
          title: Text(
            rate == null ? 'New tax rate' : 'Edit tax rate',
            style: TextStyle(color: colors.textPrimary),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Tax name'),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: rateController,
                  decoration: const InputDecoration(labelText: 'Rate %'),
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
                        controller: countryController,
                        decoration: const InputDecoration(labelText: 'Country'),
                        textCapitalization: TextCapitalization.characters,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: stateController,
                        decoration: const InputDecoration(labelText: 'State'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: hsnController,
                  decoration: const InputDecoration(labelText: 'HSN code'),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _appliesToOptions.contains(appliesTo)
                      ? appliesTo
                      : 'all',
                  decoration: const InputDecoration(labelText: 'Applies to'),
                  items: _appliesToOptions
                      .map(
                        (item) => DropdownMenuItem(
                          value: item,
                          child: Text(_sentenceCase(item)),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (value) {
                    setDialogState(() => appliesTo = value ?? 'all');
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: priorityController,
                  decoration: const InputDecoration(labelText: 'Priority'),
                  keyboardType: TextInputType.number,
                ),
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
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: isShipping,
                  title: Text(
                    'Applies to shipping',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                  onChanged: (value) {
                    setDialogState(() => isShipping = value);
                  },
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: isCompound,
                  title: Text(
                    'Compound tax',
                    style: TextStyle(color: colors.textPrimary),
                  ),
                  onChanged: (value) {
                    setDialogState(() => isCompound = value);
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
                final parsedRate = double.tryParse(rateController.text.trim());
                final country = countryController.text.trim().toUpperCase();
                if (name.isEmpty || parsedRate == null || country.length != 2) {
                  setDialogState(() {
                    dialogError =
                        'Tax name, numeric rate, and 2-letter country are required';
                  });
                  return;
                }
                Navigator.pop(
                  dialogContext,
                  TaxRateInput(
                    storeId: storeId,
                    name: name,
                    rate: parsedRate,
                    country: country,
                    state: stateController.text,
                    hsnCode: hsnController.text,
                    appliesTo: appliesTo,
                    isCompound: isCompound,
                    isShipping: isShipping,
                    priority: int.tryParse(priorityController.text) ?? 0,
                    isActive: isActive,
                  ),
                );
              },
              child: Text(rate == null ? 'Create' : 'Save'),
            ),
          ],
        ),
      ),
    );

    nameController.dispose();
    rateController.dispose();
    countryController.dispose();
    stateController.dispose();
    hsnController.dispose();
    priorityController.dispose();
    return result;
  }

  Future<void> _deleteTaxRate(TaxRateContract rate) async {
    final confirmed = await _confirmDelete(rate);
    if (confirmed != true) return;

    await _runAction(() async {
      await context.read<ShippingTaxService>().deleteTaxRate(rate.id);
      _showMessage('Tax rate deleted', isSuccess: true);
      await _loadTaxes();
    });
  }

  Future<bool?> _confirmDelete(TaxRateContract rate) {
    final colors = AppThemeColors.of(context);
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(
          'Delete tax rate?',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Text(
          'Delete "${rate.name}" from tax calculations.',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  Future<void> _runAction(Future<void> Function() action) async {
    if (_isBusy ||
        _store == null ||
        context.read<StoreContext>().selectedStoreId != _store!.id)
      return;
    setState(() => _isBusy = true);
    try {
      await action();
    } catch (error) {
      if (mounted) {
        _showMessage('Tax update could not be completed.', isError: true);
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
              onPressed: _isBusy ? null : () => _openTaxEditor(null),
              backgroundColor: LetbuyyColorTokens.brandPrimary,
              foregroundColor: LetbuyyColorTokens.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text('New tax'),
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
                _buildInclusiveCard(colors),
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
                'Taxes / GST',
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
          onPressed: _isLoading || _isBusy ? null : _loadTaxes,
          icon: Icon(Icons.refresh_rounded, color: colors.textPrimary),
          tooltip: 'Refresh taxes',
        ),
      ],
    );
  }

  Widget _buildInclusiveCard(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.cardBorder),
      ),
      // The tile needs its own Material ancestor: it paints ink splashes on the
      // nearest Material, and the decorated Container above would hide them.
      child: Material(
        type: MaterialType.transparency,
        child: SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _taxInclusive,
          onChanged:
              _store == null ||
                  _isBusy ||
                  context.read<StoreContext>().selectedStoreId != _store!.id
              ? null
              : _setTaxInclusive,
          title: Text(
            'All prices include tax',
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          subtitle: Text(
            _taxInclusive
                ? 'Checkout treats displayed product prices as tax inclusive.'
                : 'Checkout adds configured taxes on top of product prices.',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(AppThemeColors colors) {
    if (_store != null &&
        context.read<StoreContext>().selectedStoreId != _store!.id) {
      return _buildMessage(
        colors,
        'The selected store changed. Refresh taxes before editing.',
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
        'Create or select a store before configuring taxes.',
        Icons.storefront_outlined,
      );
    }
    if (_taxRates.isEmpty) {
      return _buildMessage(
        colors,
        'Add a GST or regional tax rate for checkout.',
        Icons.request_quote_outlined,
      );
    }
    return ListView(
      padding: const EdgeInsets.only(bottom: 96),
      children: _taxRates.map((rate) => _buildTaxCard(rate, colors)).toList(),
    );
  }

  Widget _buildTaxCard(TaxRateContract rate, AppThemeColors colors) {
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
                tooltip: 'Edit tax rate',
                icon: Icon(Icons.edit_rounded, color: colors.textSecondary),
                onPressed: _isBusy ? null : () => _openTaxEditor(rate),
              ),
              IconButton(
                tooltip: 'Delete tax rate',
                icon: Icon(Icons.delete_outline_rounded, color: colors.error),
                onPressed: _isBusy ? null : () => _deleteTaxRate(rate),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _pill(colors, '${_numberText(rate.rate)}%'),
              _pill(colors, rate.country),
              if (rate.state != null) _pill(colors, rate.state!),
              _pill(colors, _sentenceCase(rate.appliesTo)),
              _pill(colors, rate.isActive ? 'Active' : 'Inactive'),
              if (rate.hsnCode != null) _pill(colors, 'HSN ${rate.hsnCode}'),
            ],
          ),
          const SizedBox(height: 10),
          _detailLine(colors, 'Priority', rate.priority.toString()),
          _detailLine(
            colors,
            'Flags',
            [
              if (rate.isShipping) 'shipping',
              if (rate.isCompound) 'compound',
              if (!rate.isShipping && !rate.isCompound) 'standard',
            ].join(', '),
          ),
        ],
      ),
    );
  }

  Widget _detailLine(AppThemeColors colors, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: TextStyle(color: colors.textTertiary, fontSize: 12),
            ),
          ),
          Expanded(
            child: Text(
              value,
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

  static String _numberText(double value) {
    if (value == value.roundToDouble()) return value.toInt().toString();
    return value.toStringAsFixed(2);
  }

  static String _sentenceCase(String value) {
    final normalized = value.replaceAll('-', ' ').replaceAll('_', ' ').trim();
    if (normalized.isEmpty) return value;
    return '${normalized[0].toUpperCase()}${normalized.substring(1)}';
  }
}
