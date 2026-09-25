// SUSTAINED-L -- the signed-in buyer's canonical, cross-store profile and address book.
//
// Reached from the "LetBuyy account" card (LETBUYY_BUYER_SIGN_IN only) once signed in. This is
// deliberately a NEW, separate screen, not a change to edit_profile_screen.dart / saved_addresses_
// screen.dart: those read and write the Firebase-era, per-store account (store_customers /
// customer_addresses), a completely different, already-complete realm (D-ONE-BUYER) this screen
// must never touch or conflate with the canonical buyer_accounts / buyer_addresses this screen owns.
//
// Every read/write goes through BuyerAccountApi / BuyerAddressApi (letbuyy_api_client), which in
// turn call the gateway's requireBuyerSession-gated /storefront/buyer/{profile,addresses[/:id]}
// routes -- this screen never talks to a fake, a local database, or an unsupported backend shape.
//
// Session-safety: every async call captures the token it was made with, and every response is
// discarded (never applied to state) unless that token is still the controller's CURRENT token when
// the response arrives -- so a late response for a buyer who has since signed out, or a different
// buyer who has since signed in on the same device, can never populate this screen with someone
// else's data. A ValueKey per address id, plus a per-address in-flight guard, blocks a duplicate tap
// on the same mutation while it is still running.

import 'package:flutter/material.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../auth/buyer_sign_in_controller.dart';

/// ApiClient never lets a connection failure reach a screen as a bare exception -- it always wraps
/// it as an ApiException first (code NETWORK_ERROR/TIMEOUT, statusCode 0/408), the same convention
/// BuyerAccountApi.linkFirebase's own error mapping already relies on.
bool _isNetworkFailure(ApiException error) => error.code == 'NETWORK_ERROR' || error.code == 'TIMEOUT';

class LetBuyyAccountScreen extends StatefulWidget {
  const LetBuyyAccountScreen({super.key});

  @override
  State<LetBuyyAccountScreen> createState() => _LetBuyyAccountScreenState();
}

class _LetBuyyAccountScreenState extends State<LetBuyyAccountScreen> {
  bool _loading = true;
  String? _loadError;
  BuyerAccount? _account;
  List<BuyerAddress> _addresses = const [];

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  bool _savingProfile = false;
  String? _profileError;

  final Set<String> _mutatingAddressIds = {};

  String? _tokenAtLastLoad;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  BuyerSignInController get _controller => context.read<BuyerSignInController>();
  BuyerAddressApi get _addressApi => context.read<BuyerAddressApi>();

  /// True while [token] is still the buyer this screen is showing -- a stale response for a token
  /// that has since changed (sign-out, or a different buyer signed in) is dropped, never applied.
  bool _stillCurrent(String token) => mounted && context.read<BuyerSignInController>().token == token;

  Future<void> _load() async {
    final token = _controller.token;
    if (token == null) {
      setState(() {
        _loading = false;
        _loadError = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _loadError = null;
      // Recorded now, win or lose: this stops the "a different buyer than last loaded" check in
      // build() from re-triggering _load() forever on every rebuild after a FAILED load for this
      // same, unchanged token -- a retry belongs to the user (pull-to-refresh, the error view's
      // Retry button), never an automatic loop.
      _tokenAtLastLoad = token;
    });
    try {
      // eagerError: false -- both requests always run to completion even when one fails, so a
      // rejection on the other is always observed here rather than left unhandled.
      final results = await Future.wait([
        context.read<BuyerAccountApi>().account(token),
        _addressApi.list(token),
      ], eagerError: false);
      if (!_stillCurrent(token)) {
        // A different buyer is current now (switch or sign-out): this response belongs to nobody
        // on screen any more. Still clear _loading -- otherwise build()'s own "buyer changed, load
        // again" check (`!_loading`) can never fire, and the screen is stuck spinning forever for
        // whoever is actually signed in now.
        setState(() => _loading = false);
        return;
      }
      final account = results[0] as BuyerAccount;
      setState(() {
        _account = account;
        _addresses = results[1] as List<BuyerAddress>;
        _nameController.text = account.fullName ?? '';
        _phoneController.text = account.phone ?? '';
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!_stillCurrent(token)) {
        setState(() => _loading = false);
        return;
      }
      setState(() {
        _loading = false;
        _loadError = (error.statusCode == 401 || error.statusCode == 403)
            ? 'Your LetBuyy sign-in has ended. Sign in again to continue.'
            : _isNetworkFailure(error)
                ? 'You seem to be offline. Check your connection and try again.'
                : 'We couldn’t load your account right now.';
      });
    } catch (_) {
      if (!_stillCurrent(token)) {
        setState(() => _loading = false);
        return;
      }
      setState(() {
        _loading = false;
        _loadError = 'You seem to be offline. Check your connection and try again.';
      });
    }
  }

  Future<void> _saveProfile() async {
    final token = _controller.token;
    if (token == null || _savingProfile) return;
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    if (name.length > 200) {
      setState(() => _profileError = 'Name must be 200 characters or fewer.');
      return;
    }
    if (phone.isNotEmpty && !RegExp(r'^[0-9+][0-9 ]{6,19}$').hasMatch(phone)) {
      setState(() => _profileError = 'Enter a valid phone number.');
      return;
    }
    setState(() {
      _savingProfile = true;
      _profileError = null;
    });
    try {
      final updated = await context.read<BuyerAccountApi>().updateProfile(
            token,
            fullName: name.isEmpty ? null : name,
            phone: phone.isEmpty ? null : phone,
          );
      if (!_stillCurrent(token)) return;
      setState(() {
        _account = updated;
        _savingProfile = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated.')));
      }
    } on ApiException catch (error) {
      if (!_stillCurrent(token)) return;
      setState(() {
        _savingProfile = false;
        // Preserve what the buyer typed -- a recoverable failure never discards their input.
        _profileError = (error.statusCode == 401 || error.statusCode == 403)
            ? 'Your LetBuyy sign-in has ended. Sign in again to save changes.'
            : 'We couldn’t save your profile just now. Your changes are still here -- try again.';
      });
    } catch (_) {
      if (!_stillCurrent(token)) return;
      setState(() {
        _savingProfile = false;
        _profileError = 'You seem to be offline. Your changes are still here -- try again.';
      });
    }
  }

  Future<void> _deleteAddress(BuyerAddress address) async {
    final token = _controller.token;
    if (token == null || _mutatingAddressIds.contains(address.id)) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove this address?'),
        content: Text('${address.fullName}, ${address.addressLine1} will be removed from your saved addresses.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Remove')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _mutatingAddressIds.add(address.id));
    try {
      await _addressApi.delete(token, address.id);
      if (!_stillCurrent(token)) return;
      setState(() {
        _addresses = _addresses.where((a) => a.id != address.id).toList();
        _mutatingAddressIds.remove(address.id);
      });
    } on ApiException catch (error) {
      if (!_stillCurrent(token)) return;
      setState(() => _mutatingAddressIds.remove(address.id));
      _showAddressFailure(error.statusCode == 404
          ? 'That address was already removed.'
          : 'We couldn’t remove that address just now.');
      if (error.statusCode == 404) setState(() => _addresses = _addresses.where((a) => a.id != address.id).toList());
    } catch (_) {
      if (!_stillCurrent(token)) return;
      setState(() => _mutatingAddressIds.remove(address.id));
      _showAddressFailure('You seem to be offline. Try again.');
    }
  }

  Future<void> _setDefault(BuyerAddress address) async {
    final token = _controller.token;
    if (token == null || address.isDefault || _mutatingAddressIds.contains(address.id)) return;
    setState(() => _mutatingAddressIds.add(address.id));
    try {
      final saved = await _addressApi.update(token, address.id, _withDefault(address, true));
      if (!_stillCurrent(token)) return;
      setState(() {
        _addresses = [
          for (final a in _addresses) a.id == saved.id ? saved : _withDefault(a, false),
        ];
        _mutatingAddressIds.remove(address.id);
      });
    } on ApiException {
      if (!_stillCurrent(token)) return;
      setState(() => _mutatingAddressIds.remove(address.id));
      _showAddressFailure('We couldn’t set that as your default address just now.');
    } catch (_) {
      if (!_stillCurrent(token)) return;
      setState(() => _mutatingAddressIds.remove(address.id));
      _showAddressFailure('You seem to be offline. Try again.');
    }
  }

  BuyerAddress _withDefault(BuyerAddress a, bool isDefault) => BuyerAddress(
        id: a.id, label: a.label, fullName: a.fullName, phone: a.phone, addressLine1: a.addressLine1,
        addressLine2: a.addressLine2, city: a.city, state: a.state, postalCode: a.postalCode,
        country: a.country, landmark: a.landmark, isDefault: isDefault,
      );

  void _showAddressFailure(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _openAddressEditor({BuyerAddress? existing}) async {
    final token = _controller.token;
    if (token == null) return;
    final saved = await showModalBottomSheet<BuyerAddress>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _AddressEditorSheet(existing: existing, token: token, api: _addressApi),
    );
    if (saved == null || !mounted || !_stillCurrent(token)) return;
    setState(() {
      if (existing == null) {
        _addresses = [
          if (saved.isDefault) ..._addresses.map((a) => _withDefault(a, false)) else ..._addresses,
          saved,
        ];
      } else {
        _addresses = [
          for (final a in _addresses)
            a.id == saved.id ? saved : (saved.isDefault ? _withDefault(a, false) : a),
        ];
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Rebuilds this screen the instant the controller's token changes (sign-out, or a resume-time
    // session check that ends the session) -- the buyer never keeps looking at a stale account.
    return Consumer<BuyerSignInController>(
      builder: (context, controller, _) {
        if (controller.token == null) {
          return Scaffold(
            appBar: const CustomAppBar(title: 'LetBuyy account', isGlass: false),
            body: const EmptyState(
              icon: Icons.lock_outline,
              title: 'You’re signed out of LetBuyy',
              message: 'Sign in with LetBuyy on the Profile tab to manage your account.',
            ),
          );
        }
        if (controller.token != _tokenAtLastLoad && !_loading) {
          // A different buyer session than the one this screen last loaded (a sign-in after a
          // sign-out while this screen was open) -- reload rather than show the previous buyer's data.
          WidgetsBinding.instance.addPostFrameCallback((_) => _load());
        }
        return Scaffold(
          appBar: const CustomAppBar(title: 'LetBuyy account', isGlass: false),
          body: LoadingOverlay(
            isLoading: _savingProfile,
            loadingText: 'Saving…',
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _loadError != null
                    ? ErrorView(message: _loadError!, onRetry: _load)
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            _profileSection(),
                            const SizedBox(height: 24),
                            _addressesSection(),
                          ],
                        ),
                      ),
          ),
        );
      },
    );
  }

  Widget _profileSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Your profile', style: AppTextStyles.headlineSmall),
            const SizedBox(height: 4),
            Text(_account?.email ?? '', style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            CustomTextField(
              controller: _nameController,
              label: 'Full name',
              hint: 'Your name',
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 12),
            CustomTextField(
              controller: _phoneController,
              label: 'Phone (not verified)',
              hint: 'e.g. +91 98765 43210',
              keyboardType: TextInputType.phone,
              helperText: 'This number has not been verified and cannot be used to sign in.',
            ),
            if (_profileError != null) ...[
              const SizedBox(height: 8),
              Text(_profileError!, style: AppTextStyles.bodySmall.copyWith(color: AppColors.error)),
            ],
            const SizedBox(height: 16),
            CustomButton(text: 'Save profile', isLoading: _savingProfile, onPressed: _saveProfile),
          ],
        ),
      ),
    );
  }

  Widget _addressesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Your addresses', style: AppTextStyles.headlineSmall),
            TextButton.icon(
              onPressed: () => _openAddressEditor(),
              icon: const Icon(Icons.add),
              label: const Text('Add'),
            ),
          ],
        ),
        if (_addresses.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: EmptyState(
              icon: Icons.location_off_outlined,
              title: 'No saved addresses yet',
              message: 'Add an address to use it at checkout, at any LetBuyy store.',
            ),
          )
        else
          for (final address in _addresses)
            Card(
              key: ValueKey('address-${address.id}'),
              margin: const EdgeInsets.only(top: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(_labelText(address.label), style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
                        if (address.isDefault) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                            child: Text('Default', style: AppTextStyles.bodySmall.copyWith(color: AppColors.primary)),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(address.fullName, style: AppTextStyles.bodyMedium),
                    Text(
                      [address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode]
                          .where((s) => s != null && s.isNotEmpty)
                          .join(', '),
                      style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        if (!address.isDefault)
                          TextButton(
                            onPressed: _mutatingAddressIds.contains(address.id) ? null : () => _setDefault(address),
                            child: const Text('Set as default'),
                          ),
                        TextButton(
                          onPressed: _mutatingAddressIds.contains(address.id) ? null : () => _openAddressEditor(existing: address),
                          child: const Text('Edit'),
                        ),
                        TextButton(
                          onPressed: _mutatingAddressIds.contains(address.id) ? null : () => _deleteAddress(address),
                          style: TextButton.styleFrom(foregroundColor: AppColors.error),
                          child: _mutatingAddressIds.contains(address.id)
                              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Text('Remove'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }

  static String _labelText(String label) => switch (label) {
        'home' => 'Home',
        'work' => 'Work',
        _ => 'Other',
      };
}

/// A form for a new or existing address, as a bottom sheet -- one place both "Add" and "Edit" open,
/// so the two never drift into two different sets of fields or validation.
class _AddressEditorSheet extends StatefulWidget {
  const _AddressEditorSheet({required this.existing, required this.token, required this.api});

  final BuyerAddress? existing;
  final String token;
  final BuyerAddressApi api;

  @override
  State<_AddressEditorSheet> createState() => _AddressEditorSheetState();
}

class _AddressEditorSheetState extends State<_AddressEditorSheet> {
  late final TextEditingController _fullName = TextEditingController(text: widget.existing?.fullName ?? '');
  late final TextEditingController _phone = TextEditingController(text: widget.existing?.phone ?? '');
  late final TextEditingController _line1 = TextEditingController(text: widget.existing?.addressLine1 ?? '');
  late final TextEditingController _line2 = TextEditingController(text: widget.existing?.addressLine2 ?? '');
  late final TextEditingController _city = TextEditingController(text: widget.existing?.city ?? '');
  late final TextEditingController _state = TextEditingController(text: widget.existing?.state ?? '');
  late final TextEditingController _postalCode = TextEditingController(text: widget.existing?.postalCode ?? '');
  String _label = 'home';
  bool _isDefault = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _label = widget.existing?.label ?? 'home';
    _isDefault = widget.existing?.isDefault ?? false;
  }

  @override
  void dispose() {
    for (final c in [_fullName, _phone, _line1, _line2, _city, _state, _postalCode]) c.dispose();
    super.dispose();
  }

  String? _validate() {
    if (_fullName.text.trim().isEmpty) return 'Enter a name for this address.';
    if (_line1.text.trim().isEmpty) return 'Enter the address.';
    if (_city.text.trim().isEmpty) return 'Enter a city.';
    if (_state.text.trim().isEmpty) return 'Enter a state.';
    if (!RegExp(r'^[0-9]{6}$').hasMatch(_postalCode.text.trim())) return 'Enter a valid 6-digit PIN code.';
    return null;
  }

  Future<void> _save() async {
    if (_saving) return;
    final validation = _validate();
    if (validation != null) {
      setState(() => _error = validation);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final address = BuyerAddress(
      id: widget.existing?.id ?? '',
      label: _label,
      fullName: _fullName.text.trim(),
      phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
      addressLine1: _line1.text.trim(),
      addressLine2: _line2.text.trim().isEmpty ? null : _line2.text.trim(),
      city: _city.text.trim(),
      state: _state.text.trim(),
      postalCode: _postalCode.text.trim(),
      country: 'IN',
      isDefault: _isDefault,
    );
    try {
      final saved = widget.existing == null
          ? await widget.api.create(widget.token, address)
          : await widget.api.update(widget.token, widget.existing!.id, address);
      if (mounted) Navigator.pop(context, saved);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.statusCode == 404
            ? 'That address no longer exists.'
            : 'We couldn’t save that address just now. Your entries are still here -- try again.';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = 'You seem to be offline. Your entries are still here -- try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.existing == null ? 'Add address' : 'Edit address', style: AppTextStyles.headlineSmall),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              children: [
                for (final option in const ['home', 'work', 'other'])
                  ChoiceChip(
                    label: Text(_LetBuyyAccountScreenState._labelText(option)),
                    selected: _label == option,
                    onSelected: (_) => setState(() => _label = option),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            CustomTextField(controller: _fullName, label: 'Full name', textCapitalization: TextCapitalization.words),
            const SizedBox(height: 12),
            CustomTextField(controller: _phone, label: 'Phone (optional)', keyboardType: TextInputType.phone),
            const SizedBox(height: 12),
            CustomTextField(controller: _line1, label: 'Address line 1'),
            const SizedBox(height: 12),
            CustomTextField(controller: _line2, label: 'Address line 2 (optional)'),
            const SizedBox(height: 12),
            CustomTextField(controller: _city, label: 'City'),
            const SizedBox(height: 12),
            CustomTextField(controller: _state, label: 'State'),
            const SizedBox(height: 12),
            CustomTextField(
              controller: _postalCode,
              label: 'PIN code',
              keyboardType: TextInputType.number,
              maxLength: 6,
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Set as default address'),
              value: _isDefault,
              onChanged: (v) => setState(() => _isDefault = v),
            ),
            if (_error != null) ...[
              Text(_error!, style: AppTextStyles.bodySmall.copyWith(color: AppColors.error)),
              const SizedBox(height: 8),
            ],
            CustomButton(text: 'Save address', isLoading: _saving, onPressed: _save),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
