import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/inventory_service.dart';
import '../../services/security_command_store.dart';
import 'merchant_store_view.dart';

/// Recovery is independent of list loading: a failed read must never hide an
/// unresolved warehouse request or invite a new request with different details.
class WarehouseCommandRecovery extends StatefulWidget {
  const WarehouseCommandRecovery({
    super.key,
    required this.view,
    required this.onReady,
    required this.onResolved,
  });
  final MerchantStoreView view;
  final ValueChanged<bool> onReady;
  final VoidCallback onResolved;
  @override
  State<WarehouseCommandRecovery> createState() =>
      _WarehouseCommandRecoveryState();
}

class _WarehouseCommandRecoveryState extends State<WarehouseCommandRecovery> {
  InventoryService? _service;
  PendingSecurityCommand? _pending;
  bool _reading = true, _busy = false, _protocolReady = false;
  String? _error;
  int _generation = 0;
  bool _current(MerchantStoreView view) =>
      mounted && widget.view == view && merchantStoreViewCurrent(context, view);
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final service = Provider.of<InventoryService>(context);
    if (identical(service, _service)) return;
    _service?.removeListener(_scheduleRead);
    _service = service..addListener(_scheduleRead);
    _scheduleRead();
  }

  @override
  void didUpdateWidget(covariant WarehouseCommandRecovery oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.view != oldWidget.view) {
      ++_generation;
      _pending = null;
      _reading = true;
      _protocolReady = false;
      _error = null;
      _scheduleRead();
    }
  }

  void _scheduleRead() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (mounted && !_busy) _read();
  });
  Future<void> _read() async {
    final view = widget.view, generation = ++_generation;
    if (!_current(view)) return;
    widget.onReady(false);
    setState(() {
      _reading = true;
      _protocolReady = false;
    });
    var readSaved = false;
    try {
      final pending = await _service!.pendingWarehouseCommand(view.storeId);
      if (!_current(view) || generation != _generation) return;
      readSaved = true;
      setState(() => _pending = pending);
      await _service!.verifyWarehouseProtocol(view.storeId);
      if (!_current(view) || generation != _generation) return;
      setState(() {
        _protocolReady = true;
        _reading = false;
        _error = null;
      });
      widget.onReady(pending == null);
    } catch (_) {
      if (!_current(view) || generation != _generation) return;
      setState(() {
        _reading = false;
        _protocolReady = false;
        _error = readSaved
            ? 'Warehouse actions are unavailable. Check your connection and current owner access, then check again. Saved requests are retained.'
            : 'The saved request could not be read. Check account access and secure storage, then try again.';
      });
    }
  }

  Future<void> _recover({required bool stop}) async {
    final view = widget.view;
    if (_busy ||
        _reading ||
        !_protocolReady ||
        _pending == null ||
        !_current(view) ||
        !isLetbuyySurfaceCurrent(context))
      return;
    if (stop) {
      final confirmed = await showLetbuyyConfirmation(
        context: context,
        title: 'Stop the original request?',
        message:
            'If it already applied, this confirms its outcome. '
            'Otherwise, it prevents that request from applying later. '
            'It does not undo an action that already happened.',
        confirmLabel: 'Confirm stop',
        cancelLabel: 'Back',
        destructive: true,
        guard: (_, confirmation) => guardMerchantStoreView(view, confirmation),
      );
      if (confirmed != true ||
          !_current(view) ||
          !_protocolReady ||
          !isLetbuyySurfaceCurrent(context))
        return;
    }
    widget.onReady(false);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final ack = stop
          ? await _service!.stopWarehouseCommand(view.storeId)
          : await _service!.retryWarehouseCommand(view.storeId);
      if (!_current(view)) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            ack.applied
                ? 'Original warehouse request confirmed. Refreshing current records.'
                : 'Original warehouse request stopped before it applied.',
          ),
        ),
      );
      widget.onResolved();
    } catch (_) {
      if (!_current(view)) return;
      setState(
        () => _error =
            'The outcome is still unconfirmed. The original request is saved. '
            'Check your connection and owner access, then retry or stop it.',
      );
    } finally {
      if (_current(view)) {
        setState(() => _busy = false);
        // Preserve the recovery error until the next explicit attempt.
        final error = _error;
        await _read();
        if (_current(view) && error != null) setState(() => _error = error);
      }
    }
  }

  @override
  void dispose() {
    ++_generation;
    _service?.removeListener(_scheduleRead);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_current(widget.view)) return const SizedBox.shrink();
    if (!_reading && _pending == null && _error == null)
      return const SizedBox.shrink();
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _reading
                  ? 'Checking saved warehouse requests…'
                  : _pending == null
                  ? 'Warehouse actions unavailable'
                  : 'Warehouse request awaiting confirmation',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            if (_pending != null)
              const Text(
                'Resolve the original request before starting another action.',
              ),
            if (_error != null) Text(_error!),
            if (!_reading && (_pending == null || !_protocolReady))
              TextButton(
                onPressed: _busy
                    ? null
                    : () {
                        if (_current(widget.view) &&
                            isLetbuyySurfaceCurrent(context))
                          _read();
                      },
                child: const Text('Check again'),
              ),
            if (_pending != null)
              Wrap(
                spacing: 8,
                children: [
                  FilledButton(
                    onPressed: _busy || _reading || !_protocolReady
                        ? null
                        : () => _recover(stop: false),
                    child: const Text('Retry original'),
                  ),
                  OutlinedButton(
                    onPressed: _busy || _reading || !_protocolReady
                        ? null
                        : () => _recover(stop: true),
                    child: const Text('Stop original'),
                  ),
                ],
              ),
            if (_busy) const LinearProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
