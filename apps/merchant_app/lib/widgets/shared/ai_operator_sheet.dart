import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../services/ai_studio_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;

Future<void> showAiOperatorSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const AiOperatorSheet(),
  );
}

class AiOperatorSheet extends StatefulWidget {
  const AiOperatorSheet({super.key});

  @override
  State<AiOperatorSheet> createState() => _AiOperatorSheetState();
}

class _AiOperatorSheetState extends State<AiOperatorSheet> {
  final TextEditingController _controller = TextEditingController();
  final List<AiOperatorResult> _results = [];
  bool _isRunning = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 12,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary
                    .withValues(alpha: 0.12),
                child: Icon(
                  Icons.auto_awesome_rounded,
                  color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'AI operator',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Close',
                onPressed: () => Navigator.maybePop(context),
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _suggestionChip('Sales this week'),
              _suggestionChip(
                'Create product "Cotton Tee" at INR 499 stock 20',
              ),
              _suggestionChip('Draft 10% coupon LAUNCH10'),
              _suggestionChip('Add homepage section "New arrivals"'),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            minLines: 2,
            maxLines: 4,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => _run(),
            decoration: InputDecoration(
              labelText: 'Ask or command',
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                tooltip: 'Run',
                onPressed: _isRunning ? null : _run,
                icon: _isRunning
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: TextStyle(color: colors.error)),
          ],
          if (_results.isNotEmpty) ...[
            const SizedBox(height: 12),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 280),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _results.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) =>
                    _resultCard(colors, _results[index]),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _suggestionChip(String label) {
    return ActionChip(
      label: Text(label, overflow: TextOverflow.ellipsis),
      onPressed: _isRunning
          ? null
          : () {
              _controller.text = label;
              _controller.selection = TextSelection.collapsed(
                offset: _controller.text.length,
              );
            },
    );
  }

  Widget _resultCard(AppThemeColors colors, AiOperatorResult result) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(result.message, style: TextStyle(color: colors.textPrimary)),
          const SizedBox(height: 8),
          ...result.toolCalls.map((call) => _toolRow(colors, call)),
        ],
      ),
    );
  }

  Widget _toolRow(AppThemeColors colors, AiOperatorToolCall call) {
    final icon = call.status == 'completed'
        ? Icons.check_circle_rounded
        : call.status == 'unavailable'
        ? Icons.info_outline_rounded
        : Icons.pending_actions_rounded;
    final color = call.status == 'completed'
        ? colors.success
        : call.status == 'unavailable'
        ? colors.warning
        : colors.textSecondary;
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              call.summary,
              style: TextStyle(color: colors.textSecondary, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _run() async {
    final message = _controller.text.trim();
    if (message.isEmpty || _isRunning) return;
    setState(() {
      _isRunning = true;
      _error = null;
    });

    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store == null) {
        if (mounted) {
          setState(() => _error = 'Select a store before using AI operator.');
        }
        return;
      }
      final result = await context.read<AiStudioService>().runOperatorCommand(
        storeId: store.id,
        message: message,
      );
      if (mounted) {
        setState(() {
          _results.insert(0, result);
          _controller.clear();
        });
      }
    } on AiOperatorUnavailableException catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'AI operator could not complete that request.');
      }
    } finally {
      if (mounted) setState(() => _isRunning = false);
    }
  }
}
