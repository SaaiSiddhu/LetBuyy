import 'dart:io';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../services/store_service.dart';
import '../../services/api_client.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../../widgets/shared/confirm_dialog.dart';
import '../../widgets/shared/image_source_sheet.dart';
import '../../widgets/shared/merchant_media_picker.dart';
import '../../widgets/shared/cached_merchant_image.dart';

import '../../models/store_model.dart';

/// Store details editing screen
class StoreDetailsScreen extends StatefulWidget {
  const StoreDetailsScreen({super.key});

  @override
  State<StoreDetailsScreen> createState() => _StoreDetailsScreenState();
}

class _StoreDetailsScreenState extends State<StoreDetailsScreen> {
  AppThemeColors get _colors => AppThemeColors.of(context);
  static final RegExp _gstinPattern = RegExp(
    r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$',
  );
  static final RegExp _gstStateCodePattern = RegExp(
    r'^(0[1-9]|[12][0-9]|3[0-8]|97)$',
  );
  static final RegExp _invoicePrefixPattern = RegExp(r'^[A-Z0-9-]{1,20}$');
  static final RegExp _indianPinPattern = RegExp(r'^[1-9][0-9]{5}$');
  static final RegExp _phonePattern = RegExp(r'^\+?[0-9][0-9\s-]{6,18}$');

  final _formKey = GlobalKey<FormState>();
  StoreModel? _store;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _hasChanges = false;
  bool _showValidationErrors = false;
  bool _saveUnconfirmed = false;
  bool _allowPop = false;
  String? _loadError;
  String? _readNotice;
  MerchantStoreView? _view;
  bool _contactChanged = false, _addressChanged = false;
  bool get _current => mounted && merchantStoreViewCurrent(context, _view);
  Widget _guard(Widget child) =>
      _view == null ? child : guardMerchantStoreView(_view, child);

  final _nameController = TextEditingController();
  final _taglineController = TextEditingController();
  final _contactEmailController = TextEditingController();
  final _contactPhoneController = TextEditingController();
  final _contactWebsiteController = TextEditingController();
  final _legalNameController = TextEditingController();
  final _gstinController = TextEditingController();
  final _gstStateCodeController = TextEditingController();
  final _invoicePrefixController = TextEditingController();
  final _invoiceFooterController = TextEditingController();
  final _invoiceLine1Controller = TextEditingController();
  final _invoiceLine2Controller = TextEditingController();
  final _invoiceCityController = TextEditingController();
  final _invoiceStateController = TextEditingController();
  final _invoiceZipController = TextEditingController();
  final _invoiceCountryController = TextEditingController(text: 'IN');
  final _invoicePhoneController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    if (!mounted || (_view != null && !_current)) return;
    setState(() {
      _isLoading = true;
      _loadError = null;
      _readNotice = null;
    });
    try {
      final stores = context.read<StoreContext>();
      final selected = await stores.ensureSelectedStore();
      if (!mounted || (_view != null && !_current)) return;
      if (selected == null) {
        setState(() => _loadError = 'Choose a store from the dashboard first.');
        return;
      }
      _view ??= (key: stores.requestContextKey, storeId: selected.id);
      if (!_current) return;
      final store = await stores.reloadSelectedStore(selected.id);
      if (!_current) return;
      setState(() {
        _store = store;
        _populateControllers(store);
        _hasChanges = false;
        _saveUnconfirmed = false;
        _showValidationErrors = false;
      });
    } catch (_) {
      if (!mounted || (_view != null && !_current)) return;
      setState(() {
        if (_store == null) {
          _populateControllers(null);
          _loadError = 'Could not load store details. Try again.';
        } else {
          _readNotice =
              'Could not reload current details. Your edits are still here.';
        }
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _reload() async {
    if (!_current || _isSaving) return;
    if (_hasChanges) {
      final discard = await ConfirmDialog.show(
        context,
        title: 'Reload store details?',
        message:
            'Your unsaved edits will be discarded after the current details load.',
        confirmLabel: 'Reload',
        cancelLabel: 'Keep editing',
      );
      if (!discard || !_current) return;
    }
    await _loadStore();
  }

  Future<void> _save() async {
    final store = _store;
    if (store == null || !_current || _isSaving || _saveUnconfirmed) return;
    setState(() => _showValidationErrors = true);
    if (!(_formKey.currentState?.validate() ?? false)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Check the highlighted fields.')),
      );
      return;
    }
    final stores = context.read<StoreContext>();
    final service = context.read<StoreService>();
    final fields = _buildStoreUpdatePayload();
    FocusScope.of(context).unfocus();
    setState(() => _isSaving = true);
    try {
      await service.updateStore(store.id, fields);
      if (!_current) return;
      final fresh = await stores.reloadSelectedStore(store.id);
      if (!_current) return;
      setState(() {
        _store = fresh;
        _populateControllers(fresh);
        _hasChanges = false;
        _saveUnconfirmed = false;
        _showValidationErrors = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Store details saved.')));
    } catch (error) {
      if (!_current) return;
      if (error is ApiException &&
          const {401, 403, 404}.contains(error.statusCode)) {
        await stores.clearSelection();
        return;
      }
      setState(() => _saveUnconfirmed = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'The save could not be confirmed. Reload current details before another change.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _confirmBack() async {
    if (!_current || _isSaving) return;
    final discard = await ConfirmDialog.show(
      context,
      title: 'Discard store edits?',
      message: 'The changes in this form have not been confirmed as saved.',
      confirmLabel: 'Discard edits',
      cancelLabel: 'Keep editing',
    );
    if (!discard || !_current) return;
    setState(() => _allowPop = true);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _taglineController.dispose();
    _contactEmailController.dispose();
    _contactPhoneController.dispose();
    _contactWebsiteController.dispose();
    _legalNameController.dispose();
    _gstinController.dispose();
    _gstStateCodeController.dispose();
    _invoicePrefixController.dispose();
    _invoiceFooterController.dispose();
    _invoiceLine1Controller.dispose();
    _invoiceLine2Controller.dispose();
    _invoiceCityController.dispose();
    _invoiceStateController.dispose();
    _invoiceZipController.dispose();
    _invoiceCountryController.dispose();
    _invoicePhoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return _guard(
        const Scaffold(body: Center(child: CircularProgressIndicator())),
      );
    }

    if (_loadError != null) {
      return _guard(
        Scaffold(
          appBar: AppBar(title: const Text('Store Details')),
          body: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_loadError!),
                TextButton(
                  onPressed: _loadStore,
                  child: const Text('Retry store details'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return _guard(
      PopScope(
        canPop: _allowPop || (!_hasChanges && !_isSaving),
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _confirmBack();
        },
        child: Scaffold(
          backgroundColor: _colors.bgStart,
          appBar: AppBar(
            title: const Text('Store Details'),
            backgroundColor: _colors.bgStart,
            surfaceTintColor: _colors.bgStart,
            actions: [
              IconButton(
                tooltip: 'Reload current store details',
                onPressed: _isSaving ? null : _reload,
                icon: const Icon(Icons.refresh_rounded),
              ),
              if (_hasChanges)
                TextButton.icon(
                  onPressed: _isSaving || _saveUnconfirmed ? null : _save,
                  icon: _isSaving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_rounded, size: 18),
                  label: const Text('Save'),
                ),
            ],
          ),
          body: Column(
            children: [
              if (_saveUnconfirmed || _readNotice != null)
                Semantics(
                  liveRegion: true,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: Text(
                      _saveUnconfirmed
                          ? 'The save is unconfirmed. Reload current details before another change.'
                          : _readNotice!,
                    ),
                  ),
                ),
              Expanded(
                child: Form(
                  key: _formKey,
                  autovalidateMode: _showValidationErrors
                      ? AutovalidateMode.always
                      : AutovalidateMode.disabled,
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      // Logo
                      _buildLogoSection(),
                      const SizedBox(height: 24),

                      // Basic Info
                      _buildSectionTitle('Basic Information'),
                      const SizedBox(height: 12),
                      _buildField(
                        label: 'Store Name',
                        hint: 'My Awesome Store',
                        controller: _nameController,
                        icon: Icons.store_rounded,
                        fieldKey: const ValueKey('store-details-name-field'),
                        validator: _validateStoreName,
                      ),
                      const SizedBox(height: 16),
                      _buildField(
                        label: 'Tagline',
                        hint: 'Your catchy tagline...',
                        controller: _taglineController,
                        icon: Icons.format_quote_rounded,
                        maxLines: 2,
                        validator: (value) => _validateOptionalLength(
                          value,
                          label: 'Tagline',
                          max: 200,
                        ),
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('Business Contact'),
                      const SizedBox(height: 12),
                      _buildField(
                        label: 'Contact email',
                        hint: 'business@example.com',
                        controller: _contactEmailController,
                        fieldKey: const ValueKey(
                          'store-details-contact-email-field',
                        ),
                        icon: Icons.email_outlined,
                        keyboardType: TextInputType.emailAddress,
                        validator: _validateContactEmail,
                      ),
                      const SizedBox(height: 16),
                      _buildField(
                        label: 'Contact phone',
                        hint: '+91 98765 43210',
                        controller: _contactPhoneController,
                        fieldKey: const ValueKey(
                          'store-details-contact-phone-field',
                        ),
                        icon: Icons.phone_outlined,
                        keyboardType: TextInputType.phone,
                        validator: _validatePhone,
                      ),
                      const SizedBox(height: 16),
                      _buildField(
                        label: 'Business website',
                        hint: 'https://example.com',
                        controller: _contactWebsiteController,
                        fieldKey: const ValueKey(
                          'store-details-contact-website-field',
                        ),
                        icon: Icons.language_rounded,
                        keyboardType: TextInputType.url,
                        validator: _validateContactWebsite,
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('Business Profile'),
                      const SizedBox(height: 12),
                      _buildField(
                        label: 'Legal Name',
                        fieldKey: const ValueKey(
                          'store-details-legal-name-field',
                        ),
                        hint: 'Registered business name',
                        controller: _legalNameController,
                        icon: Icons.business_center_rounded,
                        textCapitalization: TextCapitalization.words,
                        validator: (value) => _validateOptionalLength(
                          value,
                          label: 'Legal name',
                          max: 200,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildField(
                        label: 'GSTIN',
                        hint: '27ABCDE1234F1Z5',
                        controller: _gstinController,
                        icon: Icons.receipt_long_rounded,
                        fieldKey: const ValueKey('store-details-gstin-field'),
                        textCapitalization: TextCapitalization.characters,
                        helperText: 'Leave blank if GST is not registered yet.',
                        validator: _validateGstin,
                      ),
                      const SizedBox(height: 16),
                      _buildField(
                        label: 'GST State Code',
                        hint: '27',
                        controller: _gstStateCodeController,
                        icon: Icons.map_rounded,
                        fieldKey: const ValueKey(
                          'store-details-gst-state-field',
                        ),
                        keyboardType: TextInputType.number,
                        validator: _validateGstStateCode,
                      ),
                      const SizedBox(height: 16),
                      _buildField(
                        label: 'Invoice Prefix',
                        hint: 'LBY',
                        controller: _invoicePrefixController,
                        icon: Icons.tag_rounded,
                        fieldKey: const ValueKey(
                          'store-details-invoice-prefix-field',
                        ),
                        textCapitalization: TextCapitalization.characters,
                        validator: _validateInvoicePrefix,
                      ),
                      const SizedBox(height: 16),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.format_list_numbered_rounded),
                        title: const Text('Next Invoice Number'),
                        subtitle: Text(
                          _store?.invoiceNumberNext.toString() ?? 'Unavailable',
                        ),
                        trailing: const Text('Assigned by the server'),
                      ),
                      const SizedBox(height: 16),
                      _buildField(
                        label: 'Invoice Footer',
                        hint: 'Thank you for shopping with us.',
                        controller: _invoiceFooterController,
                        icon: Icons.notes_rounded,
                        maxLines: 2,
                        validator: (value) => _validateOptionalLength(
                          value,
                          label: 'Invoice footer',
                          max: 1000,
                        ),
                      ),
                      const SizedBox(height: 24),

                      _buildSectionTitle('Invoice Address'),
                      const SizedBox(height: 12),
                      _buildField(
                        label: 'Address Line 1',
                        hint: 'Street, building, area',
                        controller: _invoiceLine1Controller,
                        icon: Icons.location_on_rounded,
                        textCapitalization: TextCapitalization.words,
                        validator: (value) => _validateOptionalLength(
                          value,
                          label: 'Address line 1',
                          max: 200,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildField(
                        label: 'Address Line 2',
                        hint: 'Landmark or suite',
                        controller: _invoiceLine2Controller,
                        icon: Icons.add_location_alt_rounded,
                        textCapitalization: TextCapitalization.words,
                        validator: (value) => _validateOptionalLength(
                          value,
                          label: 'Address line 2',
                          max: 200,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: _buildField(
                              label: 'City',
                              hint: 'Bengaluru',
                              controller: _invoiceCityController,
                              icon: Icons.location_city_rounded,
                              textCapitalization: TextCapitalization.words,
                              validator: (value) => _validateOptionalLength(
                                value,
                                label: 'City',
                                max: 100,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildField(
                              label: 'State',
                              hint: 'Karnataka',
                              controller: _invoiceStateController,
                              icon: Icons.map_outlined,
                              textCapitalization: TextCapitalization.words,
                              validator: (value) => _validateOptionalLength(
                                value,
                                label: 'State',
                                max: 100,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: _buildField(
                              label: 'PIN Code',
                              hint: '560001',
                              controller: _invoiceZipController,
                              icon: Icons.pin_drop_rounded,
                              fieldKey: const ValueKey(
                                'store-details-pin-field',
                              ),
                              keyboardType: TextInputType.number,
                              validator: _validatePostalCode,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildField(
                              label: 'Country',
                              hint: 'IN',
                              controller: _invoiceCountryController,
                              icon: Icons.public_rounded,
                              fieldKey: const ValueKey(
                                'store-details-country-field',
                              ),
                              textCapitalization: TextCapitalization.characters,
                              validator: _validateCountry,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _buildField(
                        label: 'Phone',
                        hint: '+919876543210',
                        controller: _invoicePhoneController,
                        icon: Icons.phone_rounded,
                        fieldKey: const ValueKey('store-details-phone-field'),
                        keyboardType: TextInputType.phone,
                        validator: _validatePhone,
                      ),
                      const SizedBox(height: 24),

                      // Store URL info
                      _buildSectionTitle('Store URL'),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: _colors.card,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _colors.cardBorder),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.link_rounded,
                              color: _colors.textSecondary,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _store?.publicUrl.replaceFirst(
                                      RegExp(r'^https?://'),
                                      '',
                                    ) ??
                                    '',
                                style: TextStyle(
                                  fontFamily: 'monospace',
                                  color: _colors.textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Subdomain cannot be changed after creation',
                        style: TextStyle(
                          fontSize: 12,
                          color: _colors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLogoSection() {
    return Center(
      child: Column(
        children: [
          Semantics(
            label: 'Change store logo',
            button: true,
            enabled: !_isSaving && !_saveUnconfirmed,
            child: GestureDetector(
              key: const ValueKey('store-details-logo-picker'),
              onTap: _isSaving || _saveUnconfirmed ? null : _pickLogo,
              child: Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.3),
                    width: 2,
                  ),
                  image: _store?.logoUrl != null
                      ? DecorationImage(
                          image: cachedMerchantImageProvider(_store!.logoUrl!),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: _store?.logoUrl == null
                    ? Icon(
                        Icons.add_a_photo_rounded,
                        color: AppColors.primary,
                        size: 32,
                      )
                    : null,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Tap to change logo',
            style: TextStyle(color: _colors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: TextStyle(
        color: _colors.textPrimary,
        fontWeight: FontWeight.w600,
        fontSize: 16,
      ),
    );
  }

  Widget _buildField({
    required String label,
    required String hint,
    required TextEditingController controller,
    required IconData icon,
    Key? fieldKey,
    int maxLines = 1,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    String? helperText,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: _colors.textPrimary,
            fontWeight: FontWeight.w500,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          key: fieldKey,
          controller: controller,
          enabled: !_isSaving && !_saveUnconfirmed,
          style: TextStyle(color: _colors.textPrimary),
          maxLines: maxLines,
          keyboardType: keyboardType,
          textCapitalization: textCapitalization,
          validator: validator,
          decoration: InputDecoration(
            hintText: hint,
            helperText: helperText,
            helperStyle: TextStyle(color: _colors.textSecondary),
            filled: true,
            fillColor: _colors.card,
            prefixIcon: Icon(icon, size: 20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
          onChanged: (_) {
            setState(() {
              _hasChanges = true;
              if ({
                _contactEmailController,
                _contactPhoneController,
                _contactWebsiteController,
              }.contains(controller)) {
                _contactChanged = true;
              }
              if ({
                _invoiceLine1Controller,
                _invoiceLine2Controller,
                _invoiceCityController,
                _invoiceStateController,
                _invoiceZipController,
                _invoiceCountryController,
                _invoicePhoneController,
                _gstStateCodeController,
              }.contains(controller)) {
                _addressChanged = true;
              }
            });
            if (_showValidationErrors) _formKey.currentState?.validate();
          },
        ),
      ],
    );
  }

  Future<void> _pickLogo() async {
    final store = _store;
    if (store == null || !_current || _isSaving || _saveUnconfirmed) return;
    final service = context.read<StoreService>();
    final stores = context.read<StoreContext>();
    final picker = ImagePicker();
    final source = await showImageSourceSheet(context, title: 'Logo source');
    if (source == null || !_current) return;
    setState(() => _isSaving = true);
    var writing = false;
    try {
      final image = await pickMerchantMedia(
        context,
        source: source,
        pick: () => picker.pickImage(source: source, maxWidth: 1024),
      );
      if (!_current || image == null) return;
      final logoUrl = await service.uploadStoreAsset(
        File(image.path),
        folder: 'store-logos',
      );
      if (!_current) return;
      writing = true;
      await service.updateStore(store.id, {
        'logo_url': logoUrl,
        'version': store.version,
      });
      if (!_current) return;
      final fresh = await stores.reloadSelectedStore(store.id);
      if (!_current) return;
      // A logo update must not claim that unsaved text edits were saved too.
      setState(() => _store = fresh);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Logo updated.')));
    } catch (error) {
      if (!_current) return;
      if (error is ApiException &&
          const {401, 403, 404}.contains(error.statusCode)) {
        await stores.clearSelection();
        return;
      }
      if (writing) setState(() => _saveUnconfirmed = true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            writing
                ? 'The logo save could not be confirmed. Reload current details.'
                : 'Could not upload logo.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _populateControllers(StoreModel? store) {
    final businessProfile = store?.businessProfile ?? const {};
    final invoiceAddress = store?.invoiceAddress ?? const {};
    _nameController.text = store?.name ?? '';
    _taglineController.text = store?.tagline ?? '';
    _contactEmailController.text = _stringValue(businessProfile['email']);
    _contactPhoneController.text = _stringValue(businessProfile['phone']);
    _contactWebsiteController.text = _stringValue(businessProfile['website']);
    _contactChanged = false;
    _addressChanged = false;
    _legalNameController.text = store?.legalName ?? '';
    _gstinController.text = store?.gstin ?? '';
    _gstStateCodeController.text = store?.gstStateCode ?? '';
    _invoicePrefixController.text = store?.invoicePrefix ?? '';
    _invoiceFooterController.text = store?.invoiceFooter ?? '';
    _invoiceLine1Controller.text = _stringValue(invoiceAddress['line1']);
    _invoiceLine2Controller.text = _stringValue(invoiceAddress['line2']);
    _invoiceCityController.text = _stringValue(invoiceAddress['city']);
    _invoiceStateController.text = _stringValue(invoiceAddress['state']);
    _invoiceZipController.text = _stringValue(invoiceAddress['zip']);
    _invoiceCountryController.text =
        _stringValue(invoiceAddress['country']).isEmpty
        ? 'IN'
        : _stringValue(invoiceAddress['country']);
    _invoicePhoneController.text = _stringValue(invoiceAddress['phone']);
  }

  Map<String, dynamic> _buildStoreUpdatePayload() {
    final legalName = _nullableText(_legalNameController);
    final gstin = _nullableText(_gstinController)?.toUpperCase();
    final gstStateCode = _nullableText(_gstStateCodeController);
    final invoicePrefix = _nullableText(
      _invoicePrefixController,
    )?.toUpperCase();
    final invoiceAddress = <String, dynamic>{
      ...?_store?.invoiceAddress,
      if (_nullableText(_invoiceLine1Controller) != null)
        'line1': _nullableText(_invoiceLine1Controller),
      if (_nullableText(_invoiceLine2Controller) != null)
        'line2': _nullableText(_invoiceLine2Controller),
      if (_nullableText(_invoiceCityController) != null)
        'city': _nullableText(_invoiceCityController),
      if (_nullableText(_invoiceStateController) != null)
        'state': _nullableText(_invoiceStateController),
      if (gstStateCode != null) 'state_code': gstStateCode,
      if (_nullableText(_invoiceZipController) != null)
        'zip': _nullableText(_invoiceZipController),
      'country': (_nullableText(_invoiceCountryController) ?? 'IN')
          .toUpperCase(),
      if (_nullableText(_invoicePhoneController) != null)
        'phone': _normalizedPhone(_invoicePhoneController),
    };
    // Clearing a managed address key removes only that key. Retained metadata
    // is never reconstructed from the subset of fields this editor displays.
    for (final entry in {
      'line1': _invoiceLine1Controller,
      'line2': _invoiceLine2Controller,
      'city': _invoiceCityController,
      'state': _invoiceStateController,
      'zip': _invoiceZipController,
      'phone': _invoicePhoneController,
      'state_code': _gstStateCodeController,
    }.entries) {
      if (_nullableText(entry.value) == null) invoiceAddress.remove(entry.key);
    }
    final businessProfile = <String, dynamic>{
      for (final key in const [
        'trade_name',
        'entity_type',
        'pan_last4',
        'email',
        'phone',
        'website',
        'public_contact_enabled',
      ])
        if (_store!.businessProfile.containsKey(key))
          key: _store!.businessProfile[key],
    };
    for (final entry in {
      'email': _nullableText(_contactEmailController),
      'phone': _normalizedPhone(_contactPhoneController),
      'website': _nullableText(_contactWebsiteController),
    }.entries) {
      if (entry.value == null)
        businessProfile.remove(entry.key);
      else
        businessProfile[entry.key] = entry.value;
    }

    return {
      'version': _store?.version,
      'name': _nameController.text.trim(),
      'tagline': _taglineController.text.trim(),
      'legal_name': legalName,
      'gstin': gstin,
      'gst_state_code': gstStateCode,
      'invoice_prefix': invoicePrefix,
      'invoice_footer': _nullableText(_invoiceFooterController),
      if (_contactChanged) 'business_profile': businessProfile,
      if (_addressChanged) 'invoice_address': invoiceAddress,
    };
  }

  String? _nullableText(TextEditingController controller) {
    final value = controller.text.trim();
    return value.isEmpty ? null : value;
  }

  String? _validateContactEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return null;
    return email.length <= 254 &&
            RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)
        ? null
        : 'Enter a valid contact email.';
  }

  String? _validateContactWebsite(String? value) {
    final website = value?.trim() ?? '';
    if (website.isEmpty) return null;
    final uri = Uri.tryParse(website);
    return uri != null &&
            const {'https', 'http'}.contains(uri.scheme) &&
            uri.host.isNotEmpty &&
            uri.userInfo.isEmpty
        ? null
        : 'Use an http or https website address.';
  }

  String? _normalizedPhone(TextEditingController controller) {
    final value = _nullableText(controller);
    return value?.replaceAll(RegExp(r'[\s-]+'), '');
  }

  String? _validateStoreName(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return 'Enter a store name.';
    if (trimmed.length < 2) return 'Store name must be at least 2 characters.';
    if (trimmed.length > 100) {
      return 'Store name must be 100 characters or less.';
    }
    return null;
  }

  String? _validateOptionalLength(
    String? value, {
    required String label,
    required int max,
  }) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.length > max) return '$label must be $max characters or less.';
    return null;
  }

  String? _validateGstin(String? value) {
    final gstin = value?.trim().toUpperCase() ?? '';
    if (gstin.isEmpty) return null;
    if (!_gstinPattern.hasMatch(gstin)) {
      return 'Enter a valid 15-character GSTIN.';
    }
    return null;
  }

  String? _validateGstStateCode(String? value) {
    final stateCode = value?.trim() ?? '';
    final gstin = _gstinController.text.trim().toUpperCase();
    if (gstin.isNotEmpty && stateCode.isEmpty) {
      return 'Enter the GST state code.';
    }
    if (stateCode.isEmpty) return null;
    if (!_gstStateCodePattern.hasMatch(stateCode)) {
      return 'Enter a valid GST state code.';
    }
    if (gstin.isNotEmpty && _gstinPattern.hasMatch(gstin)) {
      final gstinStateCode = gstin.substring(0, 2);
      if (gstinStateCode != stateCode) {
        return 'GST state code must match GSTIN.';
      }
    }
    return null;
  }

  String? _validateInvoicePrefix(String? value) {
    final prefix = value?.trim().toUpperCase() ?? '';
    if (prefix.isEmpty) return null;
    if (!_invoicePrefixPattern.hasMatch(prefix)) {
      return 'Use letters, numbers, or hyphen only.';
    }
    return null;
  }

  String? _validatePostalCode(String? value) {
    final zip = value?.trim() ?? '';
    if (zip.isEmpty) return null;
    final country = (_nullableText(_invoiceCountryController) ?? 'IN')
        .toUpperCase();
    if (country == 'IN' && !_indianPinPattern.hasMatch(zip)) {
      return 'Enter a valid 6-digit PIN code.';
    }
    if (zip.length > 20) return 'Postal code must be 20 characters or less.';
    return null;
  }

  String? _validateCountry(String? value) {
    final country = value?.trim().toUpperCase() ?? '';
    if (country != 'IN') return 'LetBuyy stores must be based in India.';
    return null;
  }

  String? _validatePhone(String? value) {
    final phone = value?.trim() ?? '';
    if (phone.isEmpty) return null;
    if (!_phonePattern.hasMatch(phone)) return 'Enter a valid phone number.';
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 7 || digits.length > 15) {
      return 'Enter a valid phone number.';
    }
    return null;
  }

  String _stringValue(Object? value) => value == null ? '' : value.toString();
}
