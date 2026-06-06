import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/inventory_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class InventorySuppliersScreen extends StatefulWidget {
  const InventorySuppliersScreen({super.key});

  @override
  State<InventorySuppliersScreen> createState() =>
      _InventorySuppliersScreenState();
}

class _InventorySuppliersScreenState extends State<InventorySuppliersScreen> {
  List<InventorySupplierContract> _suppliers = const [];
  bool _isLoading = true;
  String? _storeId;
  String? _error;

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
        setState(() {
          _suppliers = const [];
          _isLoading = false;
        });
        return;
      }
      final rows = await context.read<InventoryService>().fetchSuppliers(
        _storeId!,
      );
      if (mounted) {
        setState(() {
          _suppliers = rows;
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _storeId == null ? null : _createSupplier,
        backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.person_add_alt_1_outlined),
        label: const Text('New supplier'),
      ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
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
                  'Suppliers',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Vendors used for replenishment and purchase orders',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh suppliers',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load suppliers',
        _error!,
      );
    }
    if (_suppliers.isEmpty) {
      return _centerState(
        Icons.handshake_outlined,
        'No suppliers yet',
        'Add suppliers before creating purchase orders.',
      );
    }
    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        itemCount: _suppliers.length,
        itemBuilder: (context, index) {
          final supplier = _suppliers[index];
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
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
                    Icon(
                      Icons.handshake_outlined,
                      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        supplier.name,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 10,
                  runSpacing: 6,
                  children: [
                    _meta(Icons.person_outline, supplier.contactName),
                    _meta(Icons.alternate_email_outlined, supplier.email),
                    _meta(Icons.phone_outlined, supplier.phone),
                  ].where((item) => item != null).cast<Widget>().toList(),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget? _meta(IconData icon, String value) {
    if (value.trim().isEmpty) return null;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: colors.textTertiary),
        const SizedBox(width: 4),
        Text(
          value,
          style: TextStyle(color: colors.textSecondary, fontSize: 12),
        ),
      ],
    );
  }

  Future<void> _createSupplier() async {
    final input = await showModalBottomSheet<InventorySupplierInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => _SupplierForm(storeId: _storeId!, colors: colors),
    );
    if (input == null) return;

    try {
      await context.read<InventoryService>().createSupplier(input);
      if (mounted) {
        _showSnackBar('Supplier created');
        _load();
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    }
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _centerState(IconData icon, String title, String subtitle) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 48),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.success,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _SupplierForm extends StatefulWidget {
  const _SupplierForm({required this.storeId, required this.colors});

  final String storeId;
  final AppThemeColors colors;

  @override
  State<_SupplierForm> createState() => _SupplierFormState();
}

class _SupplierFormState extends State<_SupplierForm> {
  final _name = TextEditingController();
  final _contact = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _contact.dispose();
    _email.dispose();
    _phone.dispose();
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        18,
        18,
        18,
        MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'New supplier',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 14),
            _field(_name, 'Supplier name'),
            _field(_contact, 'Contact name'),
            _field(_email, 'Email'),
            _field(_phone, 'Phone'),
            _field(_address, 'Address'),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: () {
                if (_name.text.trim().isEmpty) return;
                Navigator.pop(
                  context,
                  InventorySupplierInput(
                    storeId: widget.storeId,
                    name: _name.text,
                    contactName: _contact.text,
                    email: _email.text,
                    phone: _phone.text,
                    address: _address.text,
                  ),
                );
              },
              icon: const Icon(Icons.save_outlined),
              label: const Text('Create supplier'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController controller, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        style: TextStyle(color: widget.colors.textPrimary),
        decoration: InputDecoration(labelText: label),
      ),
    );
  }
}
