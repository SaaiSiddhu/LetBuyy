import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as ui;
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../services/api_client.dart';
import '../../services/customer_service.dart';
import '../../services/whatsapp_service.dart';
import '../../widgets/shared/merchant_store_view.dart';

enum CustomerDetailTaskKind {
  profile,
  address,
  note,
  tags,
  email,
  whatsApp,
  merge,
  deleteAddress,
  redact,
}

/// A route result, not a durable operation receipt or a permission grant.
class CustomerDetailTaskResult {
  const CustomerDetailTaskResult({this.mergedInto, this.redacted = false});
  final String? mergedInto;
  final bool redacted;
}

enum _Phase { editing, submitting, accepted, verifying, verified, uncertain }

/// Customer-specific draft/operation presentation. Existing services/SDKs own
/// all commands, idempotency, cache and provider behavior. No draft is persisted.
class CustomerDetailTask extends StatefulWidget {
  const CustomerDetailTask({
    super.key,
    required this.kind,
    required this.view,
    required this.customer,
    required this.ownerCurrent,
    required this.canStart,
    this.address,
    this.firstName = '',
    this.lastName = '',
    this.whatsAppVariables = const {},
    this.onSubmitted,
  });
  final CustomerDetailTaskKind kind;
  final MerchantStoreView view;
  final CustomerContract customer;
  final CustomerAddressContract? address;
  final String firstName, lastName;
  final Map<String, dynamic> whatsAppVariables;
  final bool Function() ownerCurrent, canStart;

  /// Volatile parent readback marker, never an operation receipt or permission.
  final VoidCallback? onSubmitted;

  bool get isSheet => const {
    CustomerDetailTaskKind.note,
    CustomerDetailTaskKind.tags,
    CustomerDetailTaskKind.merge,
  }.contains(kind);
  bool get isConfirmation => const {
    CustomerDetailTaskKind.deleteAddress,
    CustomerDetailTaskKind.redact,
  }.contains(kind);

  @override
  State<CustomerDetailTask> createState() => _CustomerDetailTaskState();
}

class _CustomerDetailTaskState extends State<CustomerDetailTask> {
  final _form = GlobalKey<FormState>();
  final _fields = <String, TextEditingController>{};
  final _initial = <String, String>{};
  late final CustomerService _service;
  late final StoreContext _stores;
  late final Object? _apiContext;
  late final String _email;
  bool? _marketing, _initialMarketing;
  bool? _defaultAddress = false, _initialDefault = false;
  String _template = 'custom_message';
  _Phase _phase = _Phase.editing;
  bool _retired = false, _confirming = false, _sent = false;
  String? _error, _ackId, _mergedInto;
  Map<String, dynamic>? _submitted;
  CustomerDetailTaskResult? _result;

  bool get _busy => _phase == _Phase.submitting || _phase == _Phase.verifying;
  bool get _owner =>
      mounted &&
      !_retired &&
      merchantStoreViewCurrent(context, widget.view) &&
      _service.requestContext == _apiContext &&
      !_service.hasDeniedRead(widget.view.storeId) &&
      widget.ownerCurrent();
  bool get _active => _owner && ui.isLetbuyySurfaceCurrent(context);
  bool get _editable => _owner && _phase == _Phase.editing;
  bool get _changed =>
      _fields.entries.any((e) => e.value.text != _initial[e.key]) ||
      _marketing != _initialMarketing ||
      _defaultAddress != _initialDefault ||
      _template != 'custom_message';
  bool get _needsLeaveCheck =>
      _phase == _Phase.uncertain || (_phase == _Phase.editing && _changed);
  String _text(String key) => _fields[key]!.text.trim();
  bool _edited(String key) => _fields[key]!.text != _initial[key];
  String? _actual(Object? value) =>
      value is String && value.trim().isNotEmpty ? value.trim() : null;

  String get _title => switch (widget.kind) {
    CustomerDetailTaskKind.profile => 'Edit customer',
    CustomerDetailTaskKind.address =>
      widget.address == null ? 'Add address' : 'Edit address',
    CustomerDetailTaskKind.note => 'Add note',
    CustomerDetailTaskKind.tags => 'Edit tags',
    CustomerDetailTaskKind.email => 'Email customer',
    CustomerDetailTaskKind.whatsApp => 'WhatsApp customer',
    CustomerDetailTaskKind.merge => 'Merge customer',
    CustomerDetailTaskKind.deleteAddress => 'Delete address?',
    CustomerDetailTaskKind.redact => 'Delete customer?',
  };
  String get _submitLabel => switch (widget.kind) {
    CustomerDetailTaskKind.email || CustomerDetailTaskKind.whatsApp => 'Send',
    CustomerDetailTaskKind.merge => 'Merge',
    CustomerDetailTaskKind.deleteAddress ||
    CustomerDetailTaskKind.redact => 'Delete',
    _ => 'Save',
  };
  String get _description => switch (widget.kind) {
    CustomerDetailTaskKind.merge =>
      'Orders, addresses, notes, and tags move to the target customer. The source profile is closed.',
    CustomerDetailTaskKind.deleteAddress =>
      'This removes the saved customer address.',
    CustomerDetailTaskKind.redact =>
      'This redacts the customer profile and removes saved addresses. Existing order records follow the server’s retention policy.',
    CustomerDetailTaskKind.email =>
      'Send an email to this customer. Provider acceptance does not confirm inbox delivery.',
    CustomerDetailTaskKind.whatsApp =>
      'Send a customer message using the existing WhatsApp provider. Availability does not confirm consent or delivery.',
    _ => 'Changes apply only to this customer in the selected store.',
  };

  void _initField(String key, Object? value) {
    final text = value is String ? value : '';
    _initial[key] = text;
    _fields[key] = TextEditingController(text: text);
  }

  @override
  void initState() {
    super.initState();
    _service = context.read<CustomerService>();
    _stores = context.read<StoreContext>();
    _apiContext = _service.requestContext;
    _email = widget.customer.email?.trim().toLowerCase() ?? '';
    _retired =
        _email.isEmpty ||
        widget.customer.storeId != widget.view.storeId ||
        !widget.canStart();
    final customer = widget.customer, address = widget.address;
    switch (widget.kind) {
      case CustomerDetailTaskKind.profile:
        _initField('first_name', widget.firstName);
        _initField('last_name', widget.lastName);
        _initField('phone', customer.phone);
        _initField('notes', customer['notes']);
        _marketing = customer['accepts_marketing'] is bool
            ? customer['accepts_marketing'] as bool
            : null;
        _initialMarketing = _marketing;
      case CustomerDetailTaskKind.address:
        for (final key in [
          'full_name',
          'address_line1',
          'address_line2',
          'city',
          'state',
          'postal_code',
          'label',
          'landmark',
        ]) {
          _initField(key, address?[key]);
        }
        _initField(
          'customer_phone',
          address?['customer_phone'] ?? address?.phone,
        );
        // A new address uses the existing schema's IN default. An unknown
        // country on an existing address remains an empty, required input.
        _initField('country', address == null ? 'IN' : address['country']);
        _defaultAddress = address == null
            ? false
            : address['is_default'] is bool
            ? address['is_default'] as bool
            : null;
        _initialDefault = _defaultAddress;
      case CustomerDetailTaskKind.note:
        _initField('note', '');
      case CustomerDetailTaskKind.tags:
        final tags = customer['tags'];
        _initField(
          'tags',
          tags is List
              ? tags
                    .map((tag) => tag.toString().trim())
                    .where((tag) => tag.isNotEmpty)
                    .join(', ')
              : '',
        );
      case CustomerDetailTaskKind.email:
        _initField('subject', '');
        _initField('message', '');
      case CustomerDetailTaskKind.whatsApp:
        // Do not prefill an invented claim that an order update is ready.
        _initField('message', '');
      case CustomerDetailTaskKind.merge:
        _initField('target_email', '');
      case CustomerDetailTaskKind.deleteAddress ||
          CustomerDetailTaskKind.redact:
        break;
    }
    if (address != null &&
        (address.id.isEmpty ||
            address.storeId != widget.view.storeId ||
            _actual(address['customer_email'])?.toLowerCase() != _email)) {
      _retired = true;
    }
    _service.addListener(_observeOwner);
    _stores.addListener(_observeOwner);
  }

  void _observeOwner() {
    if (!mounted) return;
    // Latch observed retirement immediately, even if a fresh read later clears
    // the service's visible denial before the next frame.
    if (!_owner || (!_sent && !widget.canStart())) _retired = true;
    setState(() {});
  }

  @override
  void dispose() {
    _service.removeListener(_observeOwner);
    _stores.removeListener(_observeOwner);
    for (final controller in _fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  List<String> _tags() => _fields['tags']!.text
      .split(',')
      .map((tag) => tag.trim())
      .where((tag) => tag.isNotEmpty)
      .toSet()
      .toList(growable: false);

  Map<String, dynamic> _input() => switch (widget.kind) {
    CustomerDetailTaskKind.profile => {
      if (widget.firstName.isNotEmpty || _edited('first_name'))
        'first_name': _text('first_name'),
      if (widget.lastName.isNotEmpty || _edited('last_name'))
        'last_name': _text('last_name'),
      if (widget.customer['phone'] is String || _edited('phone'))
        'phone': _text('phone'),
      if (widget.customer['notes'] is String || _edited('notes'))
        'notes': _text('notes'),
      if (_marketing != null) 'accepts_marketing': _marketing,
    },
    CustomerDetailTaskKind.address => {
      if (widget.address == null) 'store_id': widget.view.storeId,
      if (widget.address == null) 'customer_phone': _text('customer_phone'),
      for (final key in [
        'full_name',
        'address_line1',
        'city',
        'state',
        'postal_code',
      ])
        key: _text(key),
      for (final key in ['address_line2', 'label', 'landmark'])
        if (widget.address == null ||
            widget.address![key] is String ||
            _edited(key))
          key: _text(key),
      'country': _text('country').toUpperCase(),
      if (_defaultAddress != null) 'is_default': _defaultAddress,
    },
    CustomerDetailTaskKind.note => {'note': _text('note')},
    CustomerDetailTaskKind.tags => {'tags': _tags()},
    CustomerDetailTaskKind.email => {
      'subject': _text('subject'),
      'message': _text('message'),
    },
    CustomerDetailTaskKind.whatsApp => {
      'template': _template,
      if (_text('message').isNotEmpty) 'message': _text('message'),
    },
    CustomerDetailTaskKind.merge => {'target_email': _text('target_email')},
    _ => {},
  };

  String? _templateUnavailable(String template) {
    final values = widget.whatsAppVariables;
    final required = switch (template) {
      'order_update' => ['order_number', 'status'],
      'shipping_update' => ['order_number', 'carrier', 'tracking_number'],
      'abandoned_cart' => ['store_name', 'checkout_url'],
      _ => <String>[],
    };
    if (required.any((key) => _actual(values[key]) == null)) {
      return template == 'abandoned_cart'
          ? 'This customer view does not include a checkout link for an abandoned cart.'
          : 'Order or tracking details needed by this template are unavailable.';
    }
    return null;
  }

  Future<void> _submit() async {
    if (!_owner) {
      if (mounted) _observeOwner();
      return;
    }
    if (!_active || !_editable || _sent) return;
    if (!widget.canStart()) {
      _observeOwner();
      return;
    }
    if (!widget.isConfirmation && !(_form.currentState?.validate() ?? false))
      return;
    if (widget.kind == CustomerDetailTaskKind.whatsApp &&
        _templateUnavailable(_template) != null)
      return;
    if (widget.kind == CustomerDetailTaskKind.profile && _input().isEmpty)
      return;
    final input = _input();
    setState(() {
      _phase = _Phase.submitting;
      _sent = true;
      _error = null;
      _submitted = input;
    });
    try {
      widget.onSubmitted?.call();
      switch (widget.kind) {
        case CustomerDetailTaskKind.profile:
          final row = await _service.updateCustomer(
            _email,
            input,
            storeId: widget.view.storeId,
          );
          _checkProfile(row, _email);
        case CustomerDetailTaskKind.address:
          final address = widget.address;
          final row = address == null
              ? await _service.createAddress(_email, input)
              : await _service.updateAddress(_email, address.id, input);
          _checkAddress(row);
          if (address != null && row.id != address.id)
            throw const FormatException('Address acknowledgement mismatch');
          _ackId = row.id;
        case CustomerDetailTaskKind.note:
          final row = await _service.addNote(
            _email,
            storeId: widget.view.storeId,
            note: input['note'] as String,
          );
          if (row['store_id'] != widget.view.storeId ||
              _actual(row['customer_email'])?.toLowerCase() != _email) {
            throw const FormatException('Note acknowledgement mismatch');
          }
          _ackId = _actual(row['id']);
        case CustomerDetailTaskKind.tags:
          final row = await _service.updateTags(
            _email,
            storeId: widget.view.storeId,
            tags: input['tags'] as List<String>,
          );
          _checkProfile(row, _email);
        case CustomerDetailTaskKind.email:
          await _service.emailCustomer(
            _email,
            storeId: widget.view.storeId,
            subject: input['subject'] as String,
            message: input['message'] as String,
          );
        case CustomerDetailTaskKind.whatsApp:
          final response = await context.read<WhatsAppService>().sendTemplate(
            storeId: widget.view.storeId,
            customerEmail: widget.customer.email,
            customerPhone: widget.customer.phone!.trim(),
            template: input['template'] as String,
            message: input['message'] as String?,
            variables: widget.whatsAppVariables,
          );
          final row = response['message'];
          if (row is! Map ||
              row['store_id'] != widget.view.storeId ||
              _actual(row['customer_email'])?.toLowerCase() != _email) {
            throw const FormatException('Message acknowledgement mismatch');
          }
          _ackId = _actual(row['id']);
        case CustomerDetailTaskKind.merge:
          final row = await _service.mergeCustomer(
            _email,
            storeId: widget.view.storeId,
            targetEmail: input['target_email'] as String,
          );
          _checkProfile(row, (input['target_email'] as String).toLowerCase());
          _mergedInto = row.email;
        case CustomerDetailTaskKind.deleteAddress:
          await _service.deleteAddress(_email, widget.address!.id);
        case CustomerDetailTaskKind.redact:
          await _service.deleteCustomer(_email, storeId: widget.view.storeId);
      }
      if (!_owner) return;
      setState(() {
        _phase = _Phase.accepted;
        _result = CustomerDetailTaskResult(
          mergedInto: _mergedInto,
          redacted: widget.kind == CustomerDetailTaskKind.redact,
        );
      });
      if (_hasReadback && _active) await _verify();
    } catch (error) {
      if (!_owner) return;
      final rejected =
          error is ApiException &&
          error.statusCode == 400 &&
          error.code == 'VALIDATION_ERROR' &&
          widget.kind != CustomerDetailTaskKind.deleteAddress &&
          widget.kind != CustomerDetailTaskKind.redact;
      setState(() {
        if (error is ApiException &&
            (error.statusCode == 401 || error.statusCode == 403))
          _retired = true;
        _phase = rejected ? _Phase.editing : _Phase.uncertain;
        _sent = !rejected;
        _error = rejected
            ? 'Your changes were rejected before saving. Review the fields and submit the corrected input.'
            : 'We could not confirm whether your request finished. It will not be sent again from this task. Closing does not cancel a request already in progress. Review the latest customer details before making another change.';
      });
    } finally {
      if (mounted && _phase == _Phase.submitting)
        setState(() => _phase = _Phase.uncertain);
    }
  }

  void _checkProfile(CustomerContract row, String email) {
    if (row.storeId != widget.view.storeId ||
        row.email?.trim().toLowerCase() != email) {
      throw const FormatException('Customer acknowledgement mismatch');
    }
  }

  void _checkAddress(CustomerAddressContract row) {
    if (row.id.isEmpty ||
        row.storeId != widget.view.storeId ||
        _actual(row['customer_email'])?.toLowerCase() != _email) {
      throw const FormatException('Address acknowledgement mismatch');
    }
  }

  bool get _hasReadback =>
      widget.kind != CustomerDetailTaskKind.email &&
      widget.kind != CustomerDetailTaskKind.redact;
  bool _matches(Map<String, dynamic> actual, Map<String, dynamic> expected) =>
      expected.entries.every((entry) {
        if (entry.key == 'store_id') return actual[entry.key] == entry.value;
        final value = actual[entry.key];
        if (entry.value is List)
          return value is List &&
              value.length == (entry.value as List).length &&
              List.generate(
                value.length,
                (i) => value[i] == (entry.value as List)[i],
              ).every((v) => v);
        // Existing profile backend normalizes explicitly cleared phone/notes to
        // null. No other missing field is treated as a match or a zero value.
        if (widget.kind == CustomerDetailTaskKind.profile &&
            const {'phone', 'notes'}.contains(entry.key) &&
            entry.value == '')
          return value == null || value == '';
        return value == entry.value;
      });

  Future<void> _verify() async {
    if (!_active ||
        !_hasReadback ||
        _busy ||
        _result == null ||
        (_phase != _Phase.accepted && _phase != _Phase.verified))
      return;
    setState(() {
      _phase = _Phase.verifying;
      _error = null;
    });
    try {
      final kind = widget.kind;
      if (kind == CustomerDetailTaskKind.profile ||
          kind == CustomerDetailTaskKind.tags ||
          kind == CustomerDetailTaskKind.merge) {
        final email = _mergedInto?.trim().toLowerCase() ?? _email;
        final row = await _service.fetchCustomerByEmail(
          email,
          storeId: widget.view.storeId,
        );
        _checkProfile(row, email);
        if (!_service.hasFreshCustomer(row))
          throw const FormatException('Stored profile is not fresh readback');
        if (kind != CustomerDetailTaskKind.merge &&
            !_matches(row.toJson(), _submitted!)) {
          throw const FormatException('Saved fields not confirmed');
        }
      } else if (kind == CustomerDetailTaskKind.address ||
          kind == CustomerDetailTaskKind.deleteAddress) {
        final rows = await _service.fetchAddresses(
          _email,
          storeId: widget.view.storeId,
        );
        if (kind == CustomerDetailTaskKind.deleteAddress) {
          if (rows.any((row) => row.id == widget.address!.id))
            throw const FormatException('Address still present');
        } else {
          if (_ackId == null)
            throw const FormatException('Address identity unavailable');
          final matches = rows
              .where((row) => row.id == _ackId)
              .toList(growable: false);
          if (matches.length != 1 ||
              !_matches(matches.single.toJson(), _submitted!))
            throw const FormatException('Saved address not confirmed');
          _checkAddress(matches.single);
        }
      } else if (kind == CustomerDetailTaskKind.note) {
        final rows = await _service.fetchNotes(
          _email,
          storeId: widget.view.storeId,
        );
        if (_ackId == null ||
            !rows.any(
              (row) =>
                  row['id'] == _ackId && row['note'] == _submitted!['note'],
            )) {
          throw const FormatException(
            'Note absent from bounded recent history',
          );
        }
      } else if (kind == CustomerDetailTaskKind.whatsApp) {
        final rows = await context.read<WhatsAppService>().fetchTimeline(
          widget.view.storeId,
          customerEmail: widget.customer.email,
          customerPhone: widget.customer.phone!.trim(),
        );
        if (_ackId == null ||
            !rows.any(
              (row) =>
                  row['id'] == _ackId &&
                  row['store_id'] == widget.view.storeId &&
                  _actual(row['customer_email'])?.toLowerCase() == _email,
            )) {
          throw const FormatException('Message absent from bounded timeline');
        }
      }
      if (_owner) setState(() => _phase = _Phase.verified);
    } catch (_) {
      if (_owner)
        setState(() {
          _phase = _Phase.accepted;
          _error =
              'Your request was accepted, but we could not check the latest customer details. Check saved changes again; this will not send another request.';
        });
    } finally {
      if (mounted && _phase == _Phase.verifying)
        setState(() => _phase = _Phase.accepted);
    }
  }

  void _finish() {
    if (!ui.isLetbuyySurfaceCurrent(context) || _busy) return;
    // Retired owners may close, but never return a previous owner's private ID.
    ui.completeLetbuyySurface(
      context,
      _owner && _sent ? _result ?? const CustomerDetailTaskResult() : null,
    );
  }

  Future<void> _close() async {
    if (_busy || _confirming || !ui.isLetbuyySurfaceCurrent(context)) return;
    if (!_owner || !_needsLeaveCheck) {
      _finish();
      return;
    }
    _confirming = true;
    final leave = await ui.showLetbuyyConfirmation(
      context: context,
      title: _phase == _Phase.uncertain
          ? 'Leave unconfirmed request?'
          : 'Discard changes?',
      message: _phase == _Phase.uncertain
          ? 'The request may still complete. Closing does not cancel it. These fields are kept only in this task. Review fresh customer data before starting another change.'
          : 'Your unsaved edits will be discarded. No request is submitted by closing this task.',
      confirmLabel: _phase == _Phase.uncertain
          ? 'Leave and review'
          : 'Discard changes',
      destructive: true,
      guard: _guardConfirmation,
    );
    _confirming = false;
    if (mounted && leave && !_busy) _finish();
  }

  Widget _guardConfirmation(
    BuildContext confirmationContext,
    Widget child,
  ) => Consumer2<StoreContext, CustomerService>(
    builder: (_, __, ___, ____) => _owner
        ? child
        : ui.LetbuyyConfirmation(
            title: 'Customer access changed',
            message:
                'Close this confirmation and reopen the customer from the intended store.',
            confirmLabel: 'Close',
            showConfirm: false,
            onConfirm: null,
            cancelLabel: 'Close',
            onCancel: () =>
                ui.completeLetbuyySurface(confirmationContext, false),
          ),
  );

  Widget _field(
    String key,
    String label, {
    bool required = false,
    int? limit,
    int min = 0,
    int lines = 1,
    TextInputType? keyboard,
    String? helper,
    Iterable<String>? autofill,
    bool readOnly = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: ui.CustomTextField(
      key: Key('customer-task-$key'),
      controller: _fields[key],
      label: label,
      helperText: helper,
      enabled: _editable,
      readOnly: readOnly,
      keyboardType: keyboard,
      maxLines: lines,
      autofillHints: autofill,
      textInputAction: lines > 1
          ? TextInputAction.newline
          : TextInputAction.next,
      autocorrect:
          keyboard != TextInputType.emailAddress &&
          keyboard != TextInputType.phone,
      validator: (value) {
        if (readOnly) return null;
        final text = value?.trim() ?? '';
        if (required && text.isEmpty) return '$label is required';
        if (text.isNotEmpty && text.length < min)
          return '$label must contain at least $min characters';
        if (limit != null && text.length > limit)
          return '$label must contain at most $limit characters';
        if (key == 'first_name' && _edited(key) && text.isEmpty)
          return 'First name is required when changing the name';
        if (key == 'target_email' && text.toLowerCase() == _email)
          return 'Choose a different target customer';
        if (key == 'target_email' && !text.contains('@'))
          return 'Enter the target customer email';
        if (key == 'tags' &&
            (_tags().length > 20 || _tags().any((tag) => tag.length > 50)))
          return 'Use at most 20 tags, with at most 50 characters per tag';
        if (key == 'country' && text.length != 2)
          return 'Use the two-letter country code';
        return null;
      },
      onChanged: (_) {
        if (_active && _editable) setState(() => _error = null);
      },
    ),
  );

  List<Widget> _inputs() => switch (widget.kind) {
    CustomerDetailTaskKind.profile => [
      _field(
        'first_name',
        'First name',
        limit: 100,
        autofill: const [AutofillHints.givenName],
      ),
      _field(
        'last_name',
        'Last name',
        limit: 100,
        autofill: const [AutofillHints.familyName],
      ),
      _field(
        'phone',
        'Phone',
        limit: 20,
        keyboard: TextInputType.phone,
        autofill: const [AutofillHints.telephoneNumber],
      ),
      _field('notes', 'Notes', limit: 1000, lines: 4),
      if (_marketing == null) ...[
        const Text(
          'The current marketing preference is unavailable. Leave it unchanged or explicitly choose a preference.',
        ),
        DropdownButtonFormField<bool>(
          initialValue: _marketing,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Marketing preference'),
          items: const [
            DropdownMenuItem(value: true, child: Text('Accepts marketing')),
            DropdownMenuItem(
              value: false,
              child: Text('Does not accept marketing'),
            ),
          ],
          onChanged: !_editable
              ? null
              : (value) {
                  if (_active) setState(() => _marketing = value);
                },
        ),
      ] else
        SwitchListTile.adaptive(
          contentPadding: EdgeInsets.zero,
          title: const Text('Accepts marketing'),
          value: _marketing!,
          onChanged: !_editable
              ? null
              : (value) {
                  if (_active) setState(() => _marketing = value);
                },
        ),
    ],
    CustomerDetailTaskKind.address => [
      _field(
        'full_name',
        'Full name',
        required: true,
        limit: 200,
        autofill: const [AutofillHints.name],
      ),
      _field(
        'customer_phone',
        'Phone',
        limit: 20,
        keyboard: TextInputType.phone,
        readOnly: widget.address != null,
        helper: widget.address == null
            ? null
            : 'Phone changes are not available for saved addresses.',
      ),
      _field(
        'address_line1',
        'Address line 1',
        required: true,
        limit: 500,
        autofill: const [AutofillHints.streetAddressLine1],
      ),
      _field(
        'address_line2',
        'Address line 2',
        limit: 500,
        autofill: const [AutofillHints.streetAddressLine2],
      ),
      _field(
        'city',
        'City',
        required: true,
        limit: 100,
        autofill: const [AutofillHints.addressCity],
      ),
      _field(
        'state',
        'State',
        required: true,
        limit: 100,
        autofill: const [AutofillHints.addressState],
      ),
      _field(
        'postal_code',
        'Postal code',
        required: true,
        min: 3,
        limit: 20,
        autofill: const [AutofillHints.postalCode],
      ),
      _field(
        'country',
        'Country code',
        required: true,
        helper: 'Two-letter country code, for example IN.',
      ),
      _field('landmark', 'Landmark', limit: 255),
      _field('label', 'Label', limit: 50),
      if (_defaultAddress == null) ...[
        const Text(
          'The saved default-address preference is unavailable. Leave it unchanged or explicitly choose a preference.',
        ),
        DropdownButtonFormField<bool>(
          initialValue: _defaultAddress,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Default address'),
          items: const [
            DropdownMenuItem(value: true, child: Text('Use as default')),
            DropdownMenuItem(
              value: false,
              child: Text('Do not use as default'),
            ),
          ],
          onChanged: !_editable
              ? null
              : (value) {
                  if (_active) setState(() => _defaultAddress = value);
                },
        ),
      ] else
        SwitchListTile.adaptive(
          contentPadding: EdgeInsets.zero,
          title: const Text('Default address'),
          value: _defaultAddress!,
          onChanged: !_editable
              ? null
              : (value) {
                  if (_active) setState(() => _defaultAddress = value);
                },
        ),
    ],
    CustomerDetailTaskKind.note => [
      _field('note', 'Note', required: true, limit: 2000, lines: 5),
    ],
    CustomerDetailTaskKind.tags => [
      _field(
        'tags',
        'Tags separated by commas',
        helper: 'Up to 20 tags. Repeated tags are included once.',
      ),
    ],
    CustomerDetailTaskKind.email => [
      _field('subject', 'Subject', required: true, limit: 180),
      _field('message', 'Message', required: true, limit: 5000, lines: 8),
    ],
    CustomerDetailTaskKind.whatsApp => [
      DropdownButtonFormField<String>(
        initialValue: _template,
        isExpanded: true,
        decoration: const InputDecoration(labelText: 'Template'),
        items:
            const {
                  'custom_message': 'Custom message',
                  'order_update': 'Order update',
                  'shipping_update': 'Shipping update',
                  'abandoned_cart': 'Abandoned cart',
                }.entries
                .map(
                  (entry) => DropdownMenuItem(
                    value: entry.key,
                    child: Text(entry.value),
                  ),
                )
                .toList(growable: false),
        onChanged: !_editable
            ? null
            : (value) {
                if (_active && value != null) setState(() => _template = value);
              },
      ),
      const SizedBox(height: 16),
      if (_template == 'custom_message')
        _field('message', 'Message', required: true, limit: 1200, lines: 8)
      else if (_templateUnavailable(_template) case final String reason)
        ui.LetbuyyInlineFeedback(title: 'Template unavailable', message: reason)
      else
        const Text(
          'This template uses the fresh order details loaded for this customer. A saved custom message is used only when Custom message is selected.',
        ),
    ],
    CustomerDetailTaskKind.merge => [
      _field(
        'target_email',
        'Target email',
        required: true,
        keyboard: TextInputType.emailAddress,
        autofill: const [AutofillHints.email],
      ),
    ],
    _ => [],
  };

  Widget _status() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (_busy && (widget.isSheet || widget.isConfirmation))
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Row(
            children: [
              const ui.LoadingIndicator(),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  _phase == _Phase.submitting
                      ? 'Submitting request…'
                      : 'Checking saved changes…',
                ),
              ),
            ],
          ),
        ),
      if (_phase == _Phase.accepted || _phase == _Phase.verified)
        ui.LetbuyyInlineFeedback(
          title: widget.kind == CustomerDetailTaskKind.email
              ? 'Email request accepted'
              : widget.kind == CustomerDetailTaskKind.redact
              ? 'Redaction request acknowledged'
              : _phase == _Phase.verified
              ? 'Changes confirmed'
              : 'Request acknowledged',
          message: widget.kind == CustomerDetailTaskKind.email
              ? 'The provider accepted the request. Inbox delivery has not been verified.'
              : widget.kind == CustomerDetailTaskKind.redact
              ? 'The deletion request was accepted. Removal from connected services and completion of privacy requests are not verified here.'
              : widget.kind == CustomerDetailTaskKind.whatsApp
              ? 'The message was recorded. Check the timeline for delivery updates.'
              : widget.kind == CustomerDetailTaskKind.merge
              ? 'The merge was accepted. Check the target customer for the latest details. This source view will close.'
              : _phase == _Phase.verified
              ? 'Your change appears in the latest details for this customer.'
              : 'Your request was accepted. Check saved changes to confirm the latest details. Your request will not be sent again.',
          kind: _phase == _Phase.verified
              ? ui.LetbuyyFeedbackKind.success
              : ui.LetbuyyFeedbackKind.information,
        ),
      if (_error != null)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: ui.LetbuyyInlineFeedback(
            title: _phase == _Phase.uncertain
                ? 'Outcome unconfirmed'
                : _phase == _Phase.editing
                ? 'Input rejected'
                : 'Latest details unavailable',
            message: _error!,
            kind: ui.LetbuyyFeedbackKind.error,
          ),
        ),
    ],
  );
  List<Widget> _actions() => [
    TextButton(
      onPressed: _busy ? null : _close,
      child: Text(
        _result != null
            ? 'Done'
            : _phase == _Phase.uncertain
            ? 'Close and review'
            : 'Cancel',
      ),
    ),
    if (_phase == _Phase.editing)
      FilledButton(
        onPressed:
            !_editable ||
                (!widget.isConfirmation && !_changed) ||
                (widget.kind == CustomerDetailTaskKind.whatsApp &&
                    _templateUnavailable(_template) != null)
            ? null
            : _submit,
        child: Text(_submitLabel),
      ),
    if (_phase == _Phase.accepted && _hasReadback)
      FilledButton(
        onPressed: _verify,
        child: const Text('Check saved changes'),
      ),
  ];

  @override
  Widget build(BuildContext context) {
    if (!_owner || (!_sent && !widget.canStart())) _retired = true;
    if (_retired) {
      final body = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const ui.LetbuyyInlineFeedback(
            title: 'Customer access unconfirmed',
            message:
                'Close this task and reload the customer from the intended store. No new request is submitted by closing.',
          ),
          if (_sent)
            const Text(
              'A request already sent may still complete. Closing does not cancel server work. Review fresh data after access is restored.',
            ),
          TextButton(
            onPressed: _busy ? null : _finish,
            child: const Text('Close task'),
          ),
        ],
      );
      if (widget.isConfirmation)
        return ui.LetbuyyConfirmation(
          title: 'Customer access changed',
          message: 'The previous customer is hidden.',
          content: body,
          confirmLabel: 'Close',
          showConfirm: false,
          onConfirm: null,
          onCancel: null,
          cancelLabel: 'Cancel',
        );
      if (widget.isSheet)
        return ui.LetbuyyFormSheet(
          title: 'Customer access changed',
          canDismiss: !_busy,
          onClose: _finish,
          child: body,
        );
      return ui.LetbuyyEditorScaffold(
        title: 'Customer access changed',
        hasChanges: false,
        isBusy: _busy,
        body: ListView(padding: const EdgeInsets.all(16), children: [body]),
      );
    }
    final status = _status();
    if (widget.isConfirmation)
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _close();
        },
        child: ui.LetbuyyConfirmation(
          title: _title,
          message: _description,
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Customer: $_email'),
              if (widget.address != null)
                Text(
                  '${widget.address!.fullName}\n${widget.address!.addressLine1}',
                ),
              const SizedBox(height: 16),
              status,
            ],
          ),
          destructive: true,
          confirmLabel: _phase == _Phase.accepted
              ? 'Check saved changes'
              : _submitLabel,
          onConfirm: _phase == _Phase.accepted && _hasReadback
              ? _verify
              : _phase == _Phase.editing
              ? _submit
              : null,
          showConfirm:
              _phase == _Phase.editing ||
              (_phase == _Phase.accepted && _hasReadback),
          cancelLabel: _result != null
              ? 'Done'
              : _phase == _Phase.uncertain
              ? 'Close and review'
              : 'Cancel',
          onCancel: _busy ? null : _close,
        ),
      );
    final form = Form(
      key: _form,
      child: AutofillGroup(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Customer: $_email'),
            const SizedBox(height: 16),
            if (!widget.isSheet) ...[
              Text(_description),
              const SizedBox(height: 16),
            ],
            status,
            if (_phase != _Phase.editing || _error != null)
              const SizedBox(height: ui.LetbuyySpacingTokens.space16),
            ..._inputs(),
          ],
        ),
      ),
    );
    if (widget.isSheet)
      return ui.LetbuyyFormSheet(
        title: _title,
        description: _description,
        canDismiss: false,
        onClose: _close,
        onDismissAttempt: _busy ? null : _close,
        actions: _actions(),
        child: form,
      );
    return ui.LetbuyyEditorScaffold(
      title: _title,
      onClose: _close,
      hasChanges: _needsLeaveCheck,
      currentHasChanges: () => _needsLeaveCheck,
      isBusy: _busy,
      currentIsBusy: () => _busy,
      progressLabel: _busy
          ? (_phase == _Phase.submitting
                ? 'Submitting request…'
                : 'Checking saved changes…')
          : null,
      discardTitle: _phase == _Phase.uncertain
          ? 'Leave unconfirmed request?'
          : 'Discard changes?',
      discardMessage: _phase == _Phase.uncertain
          ? 'The request may still complete. Closing does not cancel it. These fields are kept only in this editor. Review fresh customer data before starting another change.'
          : 'Your unsaved edits will be discarded. No request is submitted by closing this task.',
      discardLabel: _phase == _Phase.uncertain
          ? 'Leave and review'
          : 'Discard changes',
      confirmationGuard: _guardConfirmation,
      actions: OverflowBar(
        alignment: MainAxisAlignment.end,
        spacing: 12,
        overflowSpacing: 12,
        children: _actions(),
      ),
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(16),
        child: form,
      ),
    );
  }
}
