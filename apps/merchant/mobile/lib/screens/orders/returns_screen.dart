import 'package:flutter/material.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../services/api_client.dart';
import '../../services/return_service.dart';
import '../../services/two_factor_service.dart';
import '../../widgets/shared/merchant_store_view.dart';
import '../security/two_factor_screen.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;

class ReturnsScreen extends StatefulWidget {
  const ReturnsScreen({super.key});
  @override
  State<ReturnsScreen> createState() => _ReturnsScreenState();
}

class _ReturnsScreenState extends State<ReturnsScreen> {
  bool _loading = true;
  String? _error;
  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare() async {
    final stores = context.read<StoreContext>(),
        epoch = context.read<StoreContext>().requestContextVersion;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await stores.ensureSelectedStore();
    } catch (_) {
      if (mounted && stores.requestContextVersion == epoch)
        setState(
          () => _error =
              'Store access could not be confirmed. Retry loading returns.',
        );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>(),
        id = context.watch<StoreContext>().selectedStoreId;
    if (_loading || _error != null || id == null) {
      return Scaffold(
        appBar: mobile_tokens.CustomAppBar.responsive(
          context: context,
          title: 'Returns',
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              if (_loading) const mobile_tokens.LoadingIndicator(),
              Text(
                _loading
                    ? 'Loading store access…'
                    : _error ??
                          'Choose a store from the dashboard to view returns.',
              ),
              if (_error != null)
                TextButton(onPressed: _prepare, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    return _ReturnsWorkspace(
      key: ValueKey(stores.requestContextKey),
      storeId: id,
    );
  }
}

class _ReturnsWorkspace extends StatefulWidget {
  const _ReturnsWorkspace({super.key, required this.storeId});
  final String storeId;
  @override
  State<_ReturnsWorkspace> createState() => _ReturnsWorkspaceState();
}

class _ReturnsWorkspaceState extends State<_ReturnsWorkspace> {
  late final MerchantStoreView _view;
  late final ReturnService _service;
  late final Object? _readContext;
  final _scroll = ScrollController();
  List<MerchantReturn> _rows = [];
  ReturnPagePresentation? _population;
  List<MerchantReturn>? _acceptedRows;
  int? _acceptedReadGeneration;
  String _status = 'all';
  int _page = 1;
  bool _isLoading = true,
      _reading = false,
      _fresh = false,
      _isMutating = false,
      _openingAction = false,
      _waitingForInput = false;
  String? _error, _notice;
  // In-memory presentation recovery only; no new storage or journal policy.
  ({String key, _CreateReturnRequest request})? _pendingCreate;
  bool get _current =>
      mounted &&
      merchantStoreViewCurrent(context, _view) &&
      _service.requestContext == _readContext;
  bool get _active => _current && ModalRoute.of(context)?.isCurrent == true;
  bool get _busy => _isLoading || _isMutating || _openingAction;
  bool get _mayPresent => _current && !_service.hasDeniedRead(widget.storeId);
  bool get _confirmed =>
      _fresh &&
      _acceptedRows != null &&
      _service.pageFor(_acceptedRows!) != null &&
      _acceptedReadGeneration == _service.readPageGeneration;
  bool get _ready => _active && _mayPresent && _confirmed && !_busy;
  bool get _canCreate =>
      _active &&
      _mayPresent &&
      !_busy &&
      (_confirmed || _pendingCreate != null);
  @override
  void initState() {
    super.initState();
    _view = (
      key: context.read<StoreContext>().requestContextKey,
      storeId: widget.storeId,
    );
    _service = context.read<ReturnService>();
    _readContext = _service.requestContext;
    Future<void>.microtask(() {
      if (_current) _loadReturns();
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadReturns({bool changedQuery = false}) async {
    if (!_current || _reading) return;
    _reading = true;
    final status = _status, page = _page;
    setState(() {
      _isLoading = true;
      _fresh = false;
      _error = null;
      if (changedQuery) {
        _rows = [];
        _population = null;
      }
    });
    try {
      final records = await _service.fetchReturns(
        widget.storeId,
        status: status,
        page: page,
        limit: 20,
      );
      if (!_current || _status != status || _page != page) return;
      final population = _service.pageFor(records);
      final generation = _service.readPageGeneration;
      if (population == null ||
          generation == null ||
          population.page != page ||
          population.limit != 20 ||
          population.storeId != widget.storeId ||
          population.status != status)
        throw const FormatException('The return page could not be confirmed.');
      setState(() {
        _rows = List.unmodifiable(records);
        _acceptedRows = records;
        _acceptedReadGeneration = generation;
        _population = population;
        _page = population.page;
        _fresh = true;
      });
    } catch (error) {
      if (!_current) return;
      setState(() {
        if (error is FormatException ||
            error is ApiException &&
                const [401, 403, 404].contains(error.statusCode)) {
          _rows = [];
          _population = null;
        }
        _error = _rows.isEmpty
            ? 'Returns could not be confirmed for this store. Retry the current page.'
            : 'Previously shown returns are unconfirmed. Reload successfully before making changes.';
      });
    } finally {
      _reading = false;
      if (_current) setState(() => _isLoading = false);
    }
  }

  Future<void> _query({String? status, int? page}) async {
    if (!_active || _busy) return;
    setState(() {
      _status = status ?? _status;
      _page = page ?? 1;
      _notice = null;
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
    await _loadReturns(changedQuery: true);
  }

  Future<void> _runAction(
    Future<void> Function() action, {
    bool recoverCreate = false,
  }) async {
    if (!(recoverCreate ? _canCreate : _ready)) return;
    setState(() => _openingAction = true);
    try {
      await action();
    } finally {
      if (_current) setState(() => _openingAction = false);
    }
  }

  Widget _guardRead(Widget child, {bool fullPage = false, bool sheet = false}) {
    final view = _view;
    return guardMerchantStoreView(
      view,
      Consumer<ReturnService>(
        builder: (page, service, _) {
          if (!service.hasDeniedRead(view.storeId)) return child;
          const message =
              'Close this form and refresh returns to confirm current access. An earlier request may still have been received.';
          if (fullPage)
            return Scaffold(
              appBar: mobile_tokens.CustomAppBar.responsive(
                context: page,
                title: 'Returns access changed',
                leading: IconButton(
                  tooltip: 'Close',
                  onPressed: () => mobile_tokens.completeLetbuyySurface(page),
                  icon: const Icon(Icons.close),
                ),
              ),
              body: const SafeArea(
                top: false,
                child: mobile_tokens.ErrorView(
                  title: 'Current read unconfirmed',
                  message: message,
                ),
              ),
            );
          return const mobile_tokens.LetbuyyFormSheet(
            title: 'Returns access changed',
            child: Text(message),
          );
        },
      ),
      fullPage: fullPage,
      sheet: sheet,
    );
  }

  Future<_CreateReturnRequest?> _showCreateReturnDialog() async {
    if (!_mayPresent) return null;
    setState(() => _waitingForInput = true);
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    final route = MaterialPageRoute<_CreateReturnRequest>(
      builder: (_) => _guardRead(
        _ReturnCreateEditor(
          view: _view,
          initial: _pendingCreate?.request,
          allowed: () => _mayPresent,
        ),
        fullPage: true,
      ),
    );
    try {
      final request = await Navigator.of(
        context,
      ).push<_CreateReturnRequest>(route);
      await route.completed;
      return request;
    } finally {
      if (_current) setState(() => _waitingForInput = false);
    }
  }

  Future<void> _createReturn() async {
    final request = await _showCreateReturnDialog();
    if (request == null || !_mayPresent) return;
    _pendingCreate ??= (
      key:
          'mobile-return-${request.orderId}-${DateTime.now().microsecondsSinceEpoch}',
      request: request,
    );
    final attempt = _pendingCreate!;
    setState(() {
      _isMutating = true;
      _fresh = false;
      _notice = null;
    });
    try {
      final created = await context.read<ReturnService>().createReturn(
        orderId: request.orderId,
        reason: request.reason,
        restock: request.restock,
        refundMethod: request.refundMethod,
        idempotencyKey: attempt.key,
      );
      if (!_mayPresent) return;
      if (created.id.isEmpty ||
          created.storeId != widget.storeId ||
          created.orderId.toLowerCase() != request.orderId.toLowerCase())
        throw const FormatException(
          'Return acknowledgement could not be confirmed.',
        );
      setState(() {
        _pendingCreate = null;
        _notice = 'Return created. The current list is being refreshed.';
      });
      await _loadReturns();
    } catch (_) {
      if (_current)
        setState(
          () => _notice =
              'The return request could not be confirmed. Reopen it to retry the original request. Closing this page does not cancel a request already received by the server.',
        );
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _updateStatus(MerchantReturn record, String status) async {
    if (!_mayPresent || record.storeId != widget.storeId) return;
    setState(() {
      _isMutating = true;
      _fresh = false;
    });
    try {
      final updated = await context.read<ReturnService>().updateStatus(
        record.id,
        status: status,
      );
      if (!_mayPresent) return;
      if (updated.id != record.id ||
          updated.storeId != widget.storeId ||
          updated.status != status)
        throw const FormatException('Return status could not be confirmed.');
      setState(
        () => _notice =
            'Return ${_statusLabel(status)}. Refreshing the current list.',
      );
      await _loadReturns();
    } catch (_) {
      if (_current)
        setState(
          () => _notice =
              'The status change could not be confirmed. Reload the current page before making another change.',
        );
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<void> _completeRefund(MerchantReturn record) async {
    if (_isMutating || !_mayPresent) return;
    try {
      final captured = context.read<TwoFactorService>().capture();
      final pending = await context
          .read<ReturnService>()
          .pendingRefundCompletion(record.id, captured);
      if (!_mayPresent) return;
      context.read<TwoFactorService>().check(captured);
      final reference = await _showRefundReferenceDialog(
        record,
        initial: pending?['provider_refund_id']?.toString(),
        recovering: pending != null,
      );
      if (reference == null || !_mayPresent) return;
      context.read<TwoFactorService>().check(captured);
      MerchantStepUpProof? proof;
      setState(() => _waitingForInput = true);
      try {
        proof = await TwoFactorScreen.approve(context);
      } finally {
        if (_current) setState(() => _waitingForInput = false);
      }
      if (proof == null || !_mayPresent) return;
      context.read<TwoFactorService>().check(captured);
      if (proof.context != captured) throw TwoFactorService.changed();
      setState(() {
        _isMutating = true;
        _fresh = false;
      });
      await context.read<ReturnService>().completeRefund(
        record.id,
        approval: proof,
        refundId:
            pending?['refund_id']?.toString() ??
            (record.refundId.isEmpty ? null : record.refundId),
        providerRefundId: reference,
        notes: pending?['notes']?.toString(),
      );
      if (_mayPresent && context.read<TwoFactorService>().isCurrent(captured)) {
        _showSnackBar('Refund completed');
        await _loadReturns();
      }
    } catch (error) {
      if (_current) _showSnackBar(error.toString(), isError: true);
    } finally {
      if (_current) setState(() => _isMutating = false);
    }
  }

  Future<String?> _showRefundReferenceDialog(
    MerchantReturn record, {
    String? initial,
    bool recovering = false,
  }) async {
    if (!_mayPresent) return null;
    setState(() => _waitingForInput = true);
    try {
      return await mobile_tokens.showLetbuyyFormSheet<String>(
        context: context,
        builder: (_) => _guardRead(
          _ReturnRefundReferenceSheet(
            view: _view,
            initial: initial,
            recovering: recovering,
            allowed: () => _mayPresent,
          ),
          sheet: true,
        ),
      );
    } finally {
      if (_current) setState(() => _waitingForInput = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    context.watch<ReturnService>();
    final current = _current,
        theme = Theme.of(context),
        population = _population;
    return Scaffold(
      appBar: mobile_tokens.CustomAppBar.responsive(
        context: context,
        title: 'Returns',
        actions: [
          IconButton(
            tooltip: 'Refresh returns',
            onPressed: current && !_busy
                ? () {
                    if (_active && !_busy) _loadReturns();
                  }
                : null,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            if ((_isLoading || _isMutating || _openingAction) &&
                !_waitingForInput &&
                current)
              Semantics(
                liveRegion: true,
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Row(
                    children: [
                      mobile_tokens.LoadingIndicator(),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Loading current returns or processing your request…',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Expanded(
              child: !current
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: const [
                        Text(
                          'Store access changed. Reopen returns from the intended store.',
                        ),
                      ],
                    )
                  : !_mayPresent
                  ? ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        mobile_tokens.ErrorView(
                          title: 'Current read unconfirmed',
                          message:
                              'Returns access could not be confirmed. Refresh successfully before reopening private records or an original request.',
                          onRetry: !_busy
                              ? () {
                                  if (_active && !_busy) _loadReturns();
                                }
                              : null,
                        ),
                      ],
                    )
                  : RefreshIndicator(
                      onRefresh: () async {
                        if (_active && !_busy) await _loadReturns();
                      },
                      child: ListView(
                        controller: _scroll,
                        key: PageStorageKey((
                          _view.key,
                          'returns',
                          _status,
                          _page,
                        )),
                        padding: const EdgeInsets.all(16),
                        children: [
                          Text(
                            'Returns and refunds',
                            style: theme.textTheme.headlineSmall,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Store: ${context.read<StoreContext>().selectedStore?.name ?? widget.storeId}',
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              SizedBox(
                                width: 240,
                                child: mobile_tokens.LetbuyyChoiceField<String>(
                                  label: 'Status',
                                  value: _status,
                                  onChanged: _busy
                                      ? null
                                      : (value) => _query(status: value),
                                  choices: const [
                                    mobile_tokens.LetbuyyChoice(
                                      value: 'all',
                                      label: 'All',
                                    ),
                                    mobile_tokens.LetbuyyChoice(
                                      value: 'requested',
                                      label: 'Requested',
                                    ),
                                    mobile_tokens.LetbuyyChoice(
                                      value: 'authorized',
                                      label: 'Authorized',
                                    ),
                                    mobile_tokens.LetbuyyChoice(
                                      value: 'closed',
                                      label: 'Closed',
                                    ),
                                    mobile_tokens.LetbuyyChoice(
                                      value: 'approved',
                                      label: 'Approved',
                                    ),
                                    mobile_tokens.LetbuyyChoice(
                                      value: 'received',
                                      label: 'Received',
                                    ),
                                    mobile_tokens.LetbuyyChoice(
                                      value: 'inspected',
                                      label: 'Inspected',
                                    ),
                                    mobile_tokens.LetbuyyChoice(
                                      value: 'refunded',
                                      label: 'Refunded',
                                    ),
                                    mobile_tokens.LetbuyyChoice(
                                      value: 'rejected',
                                      label: 'Rejected',
                                    ),
                                    mobile_tokens.LetbuyyChoice(
                                      value: 'cancelled',
                                      label: 'Cancelled',
                                    ),
                                  ],
                                ),
                              ),
                              FilledButton.icon(
                                onPressed: _canCreate
                                    ? () => _runAction(
                                        _createReturn,
                                        recoverCreate: true,
                                      )
                                    : null,
                                icon: const Icon(
                                  Icons.assignment_return_outlined,
                                ),
                                label: Text(
                                  _pendingCreate == null
                                      ? 'New return'
                                      : 'Retry original return',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Applied status: ${_statusLabel(_status)} · Page $_page',
                            style: theme.textTheme.labelLarge,
                          ),
                          if (population != null)
                            Text(
                              '${population.total} matching returns${_confirmed ? '' : ' · Previously confirmed population'}',
                            ),
                          if (_fresh && !_confirmed)
                            const mobile_tokens.LetbuyyInlineFeedback(
                              title: 'Previous return page',
                              message:
                                  'This earlier page is unconfirmed. Refresh it before making changes.',
                            ),
                          if (_error != null) _noticeCard(_error!, error: true),
                          if (_notice != null) _noticeCard(_notice!),
                          if (!_isLoading && _rows.isEmpty && _error == null)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 24),
                              child: mobile_tokens.EmptyState(
                                icon: Icons.assignment_return_outlined,
                                title: _status == 'all'
                                    ? 'No returns yet'
                                    : 'No returns on this page',
                                message:
                                    'The server returned no rows for the applied status and page.',
                              ),
                            ),
                          for (final record in _rows)
                            Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: _returnCard(record),
                            ),
                          if (population != null)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              child: Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  OutlinedButton(
                                    onPressed: !_busy && _page > 1
                                        ? () => _query(page: _page - 1)
                                        : null,
                                    child: const Text('Previous page'),
                                  ),
                                  OutlinedButton(
                                    onPressed:
                                        !_busy &&
                                            _confirmed &&
                                            population.page * population.limit <
                                                population.total
                                        ? () => _query(page: _page + 1)
                                        : null,
                                    child: const Text('Next page'),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _noticeCard(String message, {bool error = false}) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: mobile_tokens.LetbuyyInlineFeedback(
      title: error ? 'Current read unconfirmed' : 'Return request',
      message: message,
      kind: error
          ? mobile_tokens.LetbuyyFeedbackKind.error
          : mobile_tokens.LetbuyyFeedbackKind.information,
    ),
  );

  Widget _returnCard(MerchantReturn record) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SelectableText(
              record.orderNumber,
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text('Return: ${record.id}', style: theme.textTheme.bodySmall),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                mobile_tokens.LetbuyyStatusBadge(
                  label: 'Status: ${_statusLabel(record.status)}',
                ),
                if (record.refundStatus.isNotEmpty)
                  mobile_tokens.LetbuyyStatusBadge(
                    label: 'Refund: ${_statusLabel(record.refundStatus)}',
                  ),
              ],
            ),
            if (record.customerEmail.isNotEmpty)
              SelectableText(record.customerEmail),
            if (record.reason.isNotEmpty) Text(record.reason),
            const SizedBox(height: 8),
            Text(_refundAmount(record), style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (record.status == 'requested' || record.status == 'approved')
                  _actionChip(
                    'Received',
                    () => _updateStatus(record, 'received'),
                  ),
                if (record.status == 'received')
                  _actionChip(
                    'Inspected',
                    () => _updateStatus(record, 'inspected'),
                  ),
                if (record.status == 'inspected')
                  _actionChip(
                    'Approve',
                    () => _updateStatus(record, 'approved'),
                  ),
                if (record.status != 'refunded' && record.refundId.isNotEmpty)
                  _actionChip('Complete refund', () => _completeRefund(record)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _actionChip(String label, Future<void> Function() onPressed) =>
      OutlinedButton(
        onPressed: _ready ? () => _runAction(onPressed) : null,
        child: Text(label),
      );
  String _refundAmount(MerchantReturn record) {
    final raw = record.toJson()['refund_amount'];
    if (raw is! num || !raw.isFinite) return 'Refund amount unavailable';
    return record.currency.toUpperCase() == 'INR'
        ? PriceFormatter.formatPrice(raw.toDouble())
        : '${record.currency} $raw';
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!_active || !_mayPresent) return;
    mobile_tokens.showLetbuyyOperationFeedback(
      context,
      message: message,
      isError: isError,
    );
  }

  String _statusLabel(String value) {
    final normalized = value.replaceAll('_', ' ').trim();
    if (normalized.isEmpty) return 'Requested';
    return normalized
        .split(' ')
        .map(
          (part) => part.isEmpty
              ? part
              : '${part[0].toUpperCase()}${part.substring(1)}',
        )
        .join(' ');
  }
}

class _ReturnCreateEditor extends StatefulWidget {
  const _ReturnCreateEditor({
    required this.view,
    this.initial,
    required this.allowed,
  });
  final MerchantStoreView view;
  final _CreateReturnRequest? initial;
  final bool Function() allowed;
  @override
  State<_ReturnCreateEditor> createState() => _ReturnCreateEditorState();
}

class _ReturnCreateEditorState extends State<_ReturnCreateEditor> {
  late final orderController = TextEditingController(
    text: widget.initial?.orderId,
  );
  late final reasonController = TextEditingController(
    text: widget.initial?.reason,
  );
  late bool restock = widget.initial?.restock ?? true;
  late String refundMethod = widget.initial?.refundMethod ?? 'original_payment';
  bool returned = false;
  String? _error;
  bool get _current =>
      mounted &&
      widget.allowed() &&
      merchantStoreViewCurrent(context, widget.view) &&
      mobile_tokens.isLetbuyySurfaceCurrent(context);
  bool get _changed =>
      orderController.text.isNotEmpty ||
      reasonController.text.isNotEmpty ||
      !restock ||
      refundMethod != 'original_payment';
  @override
  void dispose() {
    orderController.dispose();
    reasonController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_current || returned) return;
    final orderId = orderController.text.trim();
    if (orderId.isEmpty) {
      setState(() => _error = 'Enter the existing order ID.');
      return;
    }
    returned = true;
    mobile_tokens.completeLetbuyySurface(
      context,
      _CreateReturnRequest(
        orderId: orderId,
        reason: reasonController.text.trim(),
        refundMethod: refundMethod,
        restock: restock,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([orderController, reasonController]),
    builder: (_, __) => mobile_tokens.LetbuyyEditorScaffold(
      title: 'Create return',
      hasChanges: widget.initial == null && _changed,
      currentHasChanges: () => widget.initial == null && _changed,
      confirmationGuard: (_, child) =>
          guardMerchantStoreView(widget.view, child),
      actions: OverflowBar(
        spacing: 12,
        overflowSpacing: 12,
        alignment: MainAxisAlignment.end,
        children: [
          TextButton(
            onPressed: () => mobile_tokens.dismissLetbuyySurface(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: _submit,
            child: Text(
              widget.initial == null ? 'Create' : 'Retry original request',
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Create a return for an existing order. The server determines eligible items, amounts and stock effects.',
            ),
            if (widget.initial != null)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text(
                  'This request is unconfirmed. Its original fields and key are retained in this open workspace only. Retry does not create a new request identity.',
                ),
              ),
            const SizedBox(height: 16),
            mobile_tokens.CustomTextField(
              controller: orderController,
              enabled: widget.initial == null,
              label: 'Order ID',
              onChanged: (value) {
                if (_current && _error != null && value.trim().isNotEmpty) {
                  setState(() => _error = null);
                }
              },
              textInputAction: TextInputAction.next,
              errorText: _error,
            ),
            const SizedBox(height: 16),
            mobile_tokens.CustomTextField(
              controller: reasonController,
              enabled: widget.initial == null,
              label: 'Reason',
              minLines: 2,
              maxLines: 4,
            ),
            const SizedBox(height: 16),
            mobile_tokens.LetbuyyChoiceField<String>(
              label: 'Refund method',
              value: refundMethod,
              onChanged: widget.initial == null
                  ? (value) => setState(() => refundMethod = value)
                  : null,
              choices: const [
                mobile_tokens.LetbuyyChoice(
                  value: 'original_payment',
                  label: 'Original payment',
                ),
                mobile_tokens.LetbuyyChoice(
                  value: 'gift_card',
                  label: 'Gift card',
                ),
                mobile_tokens.LetbuyyChoice(value: 'manual', label: 'Manual'),
              ],
            ),
            const SizedBox(height: 12),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              value: restock,
              title: const Text('Restock returned items'),
              onChanged: widget.initial == null
                  ? (value) => setState(() => restock = value)
                  : null,
            ),
          ],
        ),
      ),
    ),
  );
}

class _ReturnRefundReferenceSheet extends StatefulWidget {
  const _ReturnRefundReferenceSheet({
    required this.view,
    this.initial,
    required this.recovering,
    required this.allowed,
  });
  final MerchantStoreView view;
  final String? initial;
  final bool recovering;
  final bool Function() allowed;
  @override
  State<_ReturnRefundReferenceSheet> createState() =>
      _ReturnRefundReferenceSheetState();
}

class _ReturnRefundReferenceSheetState
    extends State<_ReturnRefundReferenceSheet> {
  late final controller = TextEditingController(text: widget.initial);
  bool returned = false;
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => mobile_tokens.LetbuyyFormSheet(
    title: 'Complete refund',
    description: widget.recovering
        ? 'Retry the original saved reference. Security approval and server confirmation are still required.'
        : 'Enter the provider refund reference. Security approval and server confirmation are still required.',
    actions: [
      TextButton(
        onPressed: () => mobile_tokens.completeLetbuyySurface(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          if (!mounted ||
              !widget.allowed() ||
              returned ||
              !merchantStoreViewCurrent(context, widget.view) ||
              !mobile_tokens.isLetbuyySurfaceCurrent(context))
            return;
          returned = true;
          mobile_tokens.completeLetbuyySurface(context, controller.text.trim());
        },
        child: const Text('Complete'),
      ),
    ],
    child: mobile_tokens.CustomTextField(
      controller: controller,
      readOnly: widget.recovering,
      label: 'Provider refund reference',
      textInputAction: TextInputAction.done,
    ),
  );
}

class _CreateReturnRequest {
  const _CreateReturnRequest({
    required this.orderId,
    required this.reason,
    required this.refundMethod,
    required this.restock,
  });

  final String orderId;
  final String reason;
  final String refundMethod;
  final bool restock;
}
