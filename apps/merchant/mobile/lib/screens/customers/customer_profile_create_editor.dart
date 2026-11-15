import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../services/customer_service.dart';
import '../../widgets/shared/merchant_store_view.dart';

/// Presentation only; the existing service retains command and cache authority.
class CustomerProfileCreateEditor extends StatefulWidget {
  const CustomerProfileCreateEditor({
    super.key,
    required this.view,
    this.onUnconfirmed,
  });
  final MerchantStoreView view;
  final VoidCallback? onUnconfirmed;
  @override
  State<CustomerProfileCreateEditor> createState() =>
      _CustomerProfileCreateEditorState();
}

class _CustomerProfileCreateEditorState
    extends State<CustomerProfileCreateEditor> {
  final nameController = TextEditingController();
  final emailController = TextEditingController();
  final phoneController = TextEditingController();
  final tagsController = TextEditingController();
  late final Object? _apiContext;
  bool acceptsMarketing = false;
  bool _saving = false, _uncertain = false, _denied = false;
  String? _error;
  CustomerContract? _saved;
  bool get _ownerCurrent =>
      mounted &&
      merchantStoreViewCurrent(context, widget.view) &&
      context.read<ApiClient>().captureRequestContext() == _apiContext &&
      !_denied &&
      !context.read<CustomerService>().hasDeniedRead(widget.view.storeId);
  bool get _active =>
      _ownerCurrent && mobile_tokens.isLetbuyySurfaceCurrent(context);
  bool get _changed =>
      nameController.text.isNotEmpty ||
      emailController.text.isNotEmpty ||
      phoneController.text.isNotEmpty ||
      tagsController.text.isNotEmpty ||
      acceptsMarketing;

  @override
  void initState() {
    super.initState();
    _apiContext = context.read<ApiClient>().captureRequestContext();
  }

  @override
  void dispose() {
    nameController.dispose();
    emailController.dispose();
    phoneController.dispose();
    tagsController.dispose();
    super.dispose();
  }

  // Existing create form parsers and validation, unchanged.
  List<String> splitName(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    return [
      parts.isEmpty ? '' : parts.first,
      parts.length <= 1 ? '' : parts.skip(1).join(' '),
    ];
  }

  List<String> parseTags() => tagsController.text
      .split(',')
      .map((tag) => tag.trim())
      .where((tag) => tag.isNotEmpty)
      .toList(growable: false);

  bool canSave() =>
      nameController.text.trim().isNotEmpty &&
      emailController.text.trim().contains('@');

  Future<void> _save() async {
    if (!_active ||
        _saving ||
        _uncertain ||
        _denied ||
        _saved != null ||
        !canSave())
      return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final service = context.read<CustomerService>();
    try {
      final nameParts = splitName(nameController.text);
      final customer = await service.createCustomer(
        storeId: widget.view.storeId,
        email: emailController.text,
        firstName: nameParts[0],
        lastName: nameParts[1],
        phone: phoneController.text,
        tags: parseTags(),
        acceptsMarketing: acceptsMarketing,
      );
      if (!_ownerCurrent) return;
      if (customer.storeId != widget.view.storeId ||
          customer.email?.trim().toLowerCase() !=
              emailController.text.trim().toLowerCase()) {
        throw const FormatException('Customer acknowledgement mismatch.');
      }
      setState(() => _saved = customer);
      if (_active) mobile_tokens.completeLetbuyySurface(context, customer);
    } catch (error) {
      if (!_ownerCurrent) return;
      setState(() {
        _denied =
            error is ApiException &&
            (error.statusCode == 401 ||
                error.statusCode == 403 ||
                error.code == 'CUSTOMER_SCOPE_MISMATCH');
        // The existing validation middleware returns this exact response
        // before the Customer handler. Other failures remain unconfirmed.
        final rejected =
            error is ApiException &&
            error.statusCode == 400 &&
            error.code == 'VALIDATION_ERROR';
        _uncertain = !rejected;
        _error = rejected
            ? 'The customer input was rejected before saving. Review the fields and submit the corrected profile.'
            : 'The save outcome could not be confirmed. This form will not submit another request. Close it and review the customer list before starting a new change. Closing does not cancel a request already received by the server.';
      });
      if (_uncertain) widget.onUnconfirmed?.call();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _edited(String _) {
    if (_active && !_saving && !_uncertain && _error != null) {
      setState(() => _error = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (context.watch<CustomerService>().hasDeniedRead(widget.view.storeId)) {
      if (!_denied && _saving && _saved == null && !_uncertain) {
        _uncertain = true;
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => widget.onUnconfirmed?.call(),
        );
      }
      _denied = true;
    }
    if (!_ownerCurrent || _denied) {
      return Scaffold(
        appBar: mobile_tokens.CustomAppBar.responsive(
          context: context,
          title: 'Customer access changed',
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const mobile_tokens.LetbuyyInlineFeedback(
                title: 'Customer access unconfirmed',
                message:
                    'Close this editor and reload customers from the intended store. No new request is submitted by closing it.',
              ),
              if (_uncertain)
                const Text(
                  'A save already sent may still complete. Closing does not cancel server work. Review customers after access is restored.',
                ),
              TextButton(
                onPressed: () => mobile_tokens.completeLetbuyySurface(context),
                child: const Text('Close editor'),
              ),
            ],
          ),
        ),
      );
    }
    return ListenableBuilder(
      listenable: Listenable.merge([
        nameController,
        emailController,
        phoneController,
        tagsController,
      ]),
      builder: (_, __) => mobile_tokens.LetbuyyEditorScaffold(
        title: 'Add customer',
        hasChanges: _changed && _saved == null,
        currentHasChanges: () => _changed && _saved == null,
        isBusy: _saving,
        currentIsBusy: () => _saving,
        progressLabel: _saving ? 'Saving customer…' : null,
        discardTitle: _uncertain
            ? 'Leave unconfirmed save?'
            : 'Discard changes?',
        discardMessage: _uncertain
            ? 'The server may have received the save. Closing does not cancel it. These fields are kept only in this editor. Review the customer list before starting another change.'
            : 'Your unsaved edits will be discarded. No new request is submitted by closing this editor.',
        discardLabel: _uncertain ? 'Leave and review' : 'Discard changes',
        confirmationGuard: (_, child) =>
            guardMerchantStoreView(widget.view, child),
        actions: OverflowBar(
          spacing: 12,
          overflowSpacing: 12,
          alignment: MainAxisAlignment.end,
          children: [
            TextButton(
              onPressed: _saving
                  ? null
                  : () => _saved != null
                        ? mobile_tokens.completeLetbuyySurface(context, _saved)
                        : mobile_tokens.dismissLetbuyySurface(context),
              child: Text(
                _saved != null
                    ? 'Done'
                    : _uncertain
                    ? 'Close and review'
                    : 'Cancel',
              ),
            ),
            if (!_uncertain && _saved == null)
              FilledButton.icon(
                onPressed: _saving || !canSave() ? null : _save,
                icon: const Icon(Icons.person_add_alt_1_outlined),
                label: const Text('Save customer'),
              ),
          ],
        ),
        body: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.all(16),
          child: AutofillGroup(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Create a customer profile for the selected store. Marketing preferences are saved with the profile.',
                ),
                if (_saved != null) ...[
                  const SizedBox(height: 16),
                  const mobile_tokens.LetbuyyInlineFeedback(
                    title: 'Customer saved',
                    message: 'Close this editor to reload the customer list.',
                    kind: mobile_tokens.LetbuyyFeedbackKind.success,
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  mobile_tokens.LetbuyyInlineFeedback(
                    title: _uncertain ? 'Save unconfirmed' : 'Input rejected',
                    message: _error!,
                  ),
                ],
                const SizedBox(height: 16),
                mobile_tokens.CustomTextField(
                  key: const Key('customer-name-field'),
                  controller: nameController,
                  onChanged: _edited,
                  label: 'Full name',
                  hint: 'Customer full name',
                  enabled: !_saving && !_uncertain && _saved == null,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                mobile_tokens.CustomTextField(
                  key: const Key('customer-email-field'),
                  controller: emailController,
                  onChanged: _edited,
                  label: 'Email',
                  hint: 'customer@example.com',
                  enabled: !_saving && !_uncertain && _saved == null,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  autofillHints: const [AutofillHints.email],
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                mobile_tokens.CustomTextField(
                  key: const Key('customer-phone-field'),
                  controller: phoneController,
                  onChanged: _edited,
                  label: 'Phone',
                  enabled: !_saving && !_uncertain && _saved == null,
                  keyboardType: TextInputType.phone,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                mobile_tokens.CustomTextField(
                  key: const Key('customer-tags-field'),
                  controller: tagsController,
                  onChanged: _edited,
                  label: 'Tags',
                  helperText: 'Separate tags with commas.',
                  enabled: !_saving && !_uncertain && _saved == null,
                  textInputAction: TextInputAction.done,
                ),
                const SizedBox(height: 16),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  value: acceptsMarketing,
                  onChanged: _saving || _uncertain || _saved != null
                      ? null
                      : (value) {
                          if (_active) setState(() => acceptsMarketing = value);
                        },
                  title: const Text('Accepts marketing'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
