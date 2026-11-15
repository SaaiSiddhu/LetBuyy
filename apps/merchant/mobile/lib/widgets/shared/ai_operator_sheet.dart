import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../services/ai_studio_service.dart';

Future<void> showAiOperatorSheet(BuildContext context) async {
  await showLetbuyyFormSheet<void>(
    context: context,
    builder: (_) => const AiOperatorSheet(),
  );
}

class AiOperatorSheet extends StatefulWidget {
  const AiOperatorSheet({super.key});

  @override
  State<AiOperatorSheet> createState() => _AiOperatorSheetState();
}

class _AiOperatorSheetState extends State<AiOperatorSheet> {
  final _controller = TextEditingController();
  final _inputFocus = FocusNode();
  final _suggestions = ExpansibleController();
  final List<AiOperatorResult> _results = [];
  late final Object _view;
  bool _retired = false;
  bool _isRunning = false;
  String? _error;

  bool get _current =>
      mounted &&
      !_retired &&
      context.read<StoreContext>().requestContextKey == _view;

  @override
  void initState() {
    super.initState();
    _view = context.read<StoreContext>().requestContextKey;
  }

  @override
  void dispose() {
    _controller.dispose();
    _inputFocus.dispose();
    _suggestions.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    if (_retired || stores.requestContextKey != _view) {
      _retired = true;
      return const LetbuyyFormSheet(
        title: 'Store access changed',
        child: Text(
          'Close AI operator and reopen it from the selected store. '
          'A request already sent may still have completed. Refresh affected records before repeating it.',
        ),
      );
    }
    final theme = Theme.of(context);
    return LetbuyyFormSheet(
      title: 'AI operator',
      description:
          'Commands apply to the selected store. Review each returned result.',
      canDismiss: !_isRunning,
      actions: [
        TextButton(
          onPressed: _isRunning ? null : () => Navigator.maybePop(context),
          child: const Text('Close'),
        ),
        FilledButton.icon(
          onPressed: _isRunning ? null : _run,
          icon: const Icon(Icons.send_rounded),
          label: Text(_isRunning ? 'Running…' : 'Run command'),
        ),
      ],
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ExpansionTile(
            controller: _suggestions,
            expansionAnimationStyle: MediaQuery.disableAnimationsOf(context)
                ? AnimationStyle.noAnimation
                : null,
            tilePadding: EdgeInsets.zero,
            title: const Text('Suggested commands'),
            children: [
              Wrap(
                spacing: LetbuyySpacingTokens.space8,
                runSpacing: LetbuyySpacingTokens.space8,
                children: [
                  _suggestionChip('Sales this week'),
                  _suggestionChip(
                    'Create product "Cotton Tee" at INR 499 stock 20',
                  ),
                  _suggestionChip('Draft 10% coupon LAUNCH10'),
                  _suggestionChip('Add homepage section "New arrivals"'),
                ],
              ),
            ],
          ),
          const SizedBox(height: LetbuyySpacingTokens.space16),
          CustomTextField(
            controller: _controller,
            focusNode: _inputFocus,
            enabled: !_isRunning,
            maxLines: 4,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => _run(),
            label: 'Ask or command',
          ),
          if (_isRunning) ...[
            const SizedBox(height: LetbuyySpacingTokens.space16),
            const LinearProgressIndicator(semanticsLabel: 'Running AI command'),
          ],
          if (_error != null) ...[
            const SizedBox(height: LetbuyySpacingTokens.space16),
            Semantics(
              liveRegion: true,
              child: Text(
                _error!,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
            ),
          ],
          for (final result in _results) ...[
            const SizedBox(height: LetbuyySpacingTokens.space16),
            _resultCard(result),
          ],
        ],
      ),
    );
  }

  Widget _suggestionChip(String label) => ActionChip(
    label: Text(label),
    onPressed: _isRunning
        ? null
        : () {
            _controller.value = TextEditingValue(
              text: label,
              selection: TextSelection.collapsed(offset: label.length),
            );
            _suggestions.collapse();
            _inputFocus.requestFocus();
          },
  );

  Widget _resultCard(AiOperatorResult result) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(result.message, style: theme.textTheme.bodyLarge),
            for (final call in result.toolCalls)
              Padding(
                padding: const EdgeInsets.only(
                  top: LetbuyySpacingTokens.space8,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      call.status == 'completed'
                          ? Icons.check_circle_outline
                          : call.status == 'unavailable'
                          ? Icons.info_outline
                          : Icons.pending_actions_outlined,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: LetbuyySpacingTokens.space8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(call.status, style: theme.textTheme.labelMedium),
                          Text(call.summary, style: theme.textTheme.bodyMedium),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _run() async {
    final message = _controller.text.trim();
    if (message.isEmpty || _isRunning || !_current) return;
    final stores = context.read<StoreContext>();
    final operator = context.read<AiStudioService>();
    setState(() {
      _isRunning = true;
      _error = null;
    });
    try {
      final store = await stores.ensureSelectedStore();
      if (!_current) return;
      if (store == null) {
        setState(() => _error = 'Select a store before using AI operator.');
        return;
      }
      final result = await operator.runOperatorCommand(
        storeId: store.id,
        message: message,
      );
      if (!_current) return;
      if (result.storeId != store.id) {
        setState(
          () => _error =
              'The result could not be confirmed for this store. '
              'Refresh affected records before repeating the command.',
        );
        return;
      }
      setState(() {
        _results.insert(0, result);
        _controller.clear();
      });
    } on AiOperatorUnavailableException catch (error) {
      if (_current) setState(() => _error = error.toString());
    } catch (_) {
      if (_current)
        setState(
          () => _error =
              'The result could not be confirmed. '
              'The command may have completed. Refresh affected records before repeating it.',
        );
    } finally {
      if (_current) setState(() => _isRunning = false);
    }
  }
}
