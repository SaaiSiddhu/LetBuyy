import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../services/native_media_selection.dart';

/// A saved selection is announced without revealing filenames/private contents.
/// Reviewing never submits a file or injects it into a different form.
class NativeMediaRecoveryNotice extends StatelessWidget {
  const NativeMediaRecoveryNotice({
    super.key,
    required this.openContext,
    required this.routeForPurpose,
  });
  final BuildContext? Function() openContext;
  final String? Function(String purpose) routeForPurpose;
  @override
  Widget build(BuildContext context) {
    final selection = context.watch<NativeMediaSelection?>();
    if (selection == null ||
        selection.busy ||
        (!selection.hasSelection && selection.error == null))
      return const SizedBox.shrink();
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainer,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: LetbuyySpacingTokens.lg,
            vertical: LetbuyySpacingTokens.sm,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(Icons.restore),
                  const SizedBox(width: LetbuyySpacingTokens.md),
                  Expanded(
                    child: Text(
                      selection.error == null
                          ? 'A previous file selection needs review.'
                          : 'File selection recovery is unavailable.',
                    ),
                  ),
                ],
              ),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton(
                  onPressed: () => _review(selection),
                  child: const Text('Review selection'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _review(NativeMediaSelection selection) async {
    final context = openContext();
    if (context == null || !context.mounted || selection.busy) return;
    final owner = selection.belongsToCurrentOwner;
    final purpose = selection.purpose ?? '';
    final destination = owner ? routeForPurpose(purpose) : null;
    final action = await showLetbuyyFormSheet<String>(
      context: context,
      builder: (sheetContext) => LetbuyyFormSheet(
        title: 'Saved file selection',
        actions: [
          TextButton(
            onPressed: () => completeLetbuyySurface(sheetContext),
            child: const Text('Keep for later'),
          ),
          if (owner || selection.unclaimed)
            TextButton(
              onPressed: () => completeLetbuyySurface(sheetContext, 'discard'),
              child: const Text('Discard selection'),
            ),
          if (selection.error != null)
            FilledButton(
              onPressed: () => completeLetbuyySurface(sheetContext, 'retry'),
              child: const Text('Retry recovery'),
            ),
          if (destination != null)
            FilledButton(
              onPressed: () => completeLetbuyySurface(sheetContext, 'open'),
              child: const Text('Open original area'),
            ),
        ],
        child: Text(
          selection.error ??
              (selection.unclaimed
                  ? 'An interrupted selection has no confirmed account or purpose. It cannot be uploaded. Discard this local selection, then choose the original file again.'
                  : !owner
                  ? 'Return to the account and store that started the selection. No file contents are shown in this account.'
                  : purpose.startsWith('theme-')
                  ? 'Reopen the original theme image field and choose its image source to review this saved selection. No theme change has been submitted.'
                  : purpose.startsWith('private-kyc-')
                  ? 'Reopen the original verification document type and choose its photo to review this private selection. It will not enter public Media.'
                  : 'Open the original area, then choose the same upload purpose to review and use the file. No file is uploaded by this notice.'),
        ),
      ),
    );
    if (!context.mounted) return;
    try {
      if (action == 'discard') await selection.discard();
      if (action == 'retry') await selection.retryInitialization();
      if (action == 'open' &&
          destination != null &&
          isLetbuyySurfaceCurrent(context) &&
          selection.belongsToCurrentOwner) {
        await Navigator.of(context).pushNamed(destination);
      }
    } catch (_) {
      if (context.mounted)
        showLetbuyyOperationFeedback(
          context,
          message:
              'The saved selection is retained. Reload the original account and store before continuing.',
          kind: LetbuyyFeedbackKind.error,
        );
    }
  }
}
