import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show ValueListenable;
import '../tokens/letbuyy_tokens.dart';
import 'confirmation_dialog.dart';
import 'custom_app_bar.dart';
import 'loading_indicator.dart';
import 'form_sheet.dart';

/// Full-page task container. Draft ownership, validation and command identity
/// stay with the existing form; this owns route dismissal and composed insets.
class LetbuyyEditorScaffold extends StatefulWidget {
  const LetbuyyEditorScaffold({
    super.key,
    required this.title,
    required this.body,
    required this.hasChanges,
    this.actions,
    this.isBusy = false,
    this.discardTitle = 'Discard changes?',
    this.discardMessage =
        'Your unsaved edits will be discarded. No new request is submitted by closing this editor.',
    this.discardLabel = 'Discard changes',
    this.keepEditingLabel = 'Cancel',
    this.confirmationGuard,
    this.currentHasChanges,
    this.currentIsBusy,
    this.headerActions,
    this.progressLabel,
    this.onClose,
  });
  final String title;
  final Widget body;
  final Widget? actions;
  final bool hasChanges, isBusy;

  /// Check the live presentation owner when input arrives before its next frame.
  final bool Function()? currentHasChanges, currentIsBusy;
  final List<Widget>? headerActions;

  /// Visible operation state belongs to the shell, independent of body scroll.
  final String? progressLabel;

  /// An operation owner may supply its existing dirty/recovery/result lifetime.
  /// Busy blocking remains owned by this container as well as that callback.
  final Future<void> Function()? onClose;
  final String discardTitle, discardMessage, discardLabel, keepEditingLabel;
  final Widget Function(BuildContext context, Widget confirmation)?
  confirmationGuard;

  @override
  State<LetbuyyEditorScaffold> createState() => _LetbuyyEditorScaffoldState();
}

class _LetbuyyEditorScaffoldState extends State<LetbuyyEditorScaffold> {
  bool _confirming = false;
  bool get _busy => widget.currentIsBusy?.call() ?? widget.isBusy;
  ModalRoute<Object?>? _route;
  // PopScope's configured bool updates on a frame. A supplied live reader also
  // guards a Back event arriving immediately after editing, before that frame.
  // The ordinary PopScope below keeps dismissal/confirmation ownership.
  late final _livePop = _LiveEditorPopEntry(
    () => !(widget.currentHasChanges?.call() ?? widget.hasChanges) && !_busy,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route != _route) {
      _route?.unregisterPopEntry(_livePop);
      _route = route;
      _route?.registerPopEntry(_livePop);
    }
  }

  @override
  void didUpdateWidget(covariant LetbuyyEditorScaffold oldWidget) {
    super.didUpdateWidget(oldWidget);
    _livePop.canPopNotifier.changed();
  }

  @override
  void dispose() {
    _route?.unregisterPopEntry(_livePop);
    _livePop.canPopNotifier.dispose();
    super.dispose();
  }

  Future<void> _close() async {
    if (_busy || _confirming) return;
    if (widget.onClose != null) {
      await widget.onClose!();
      return;
    }
    if (!(widget.currentHasChanges?.call() ?? widget.hasChanges)) {
      completeLetbuyySurface(context);
      return;
    }
    _confirming = true;
    final discard = await showLetbuyyConfirmation(
      context: context,
      title: widget.discardTitle,
      message: widget.discardMessage,
      confirmLabel: widget.discardLabel,
      cancelLabel: widget.keepEditingLabel,
      destructive: true,
      guard: widget.confirmationGuard,
    );
    _confirming = false;
    if (mounted && discard && !_busy) completeLetbuyySurface(context);
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !widget.hasChanges && !widget.isBusy,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) _close();
    },
    child: Scaffold(
      appBar: CustomAppBar.responsive(
        context: context,
        leading: IconButton(
          tooltip: 'Back',
          onPressed: widget.isBusy ? null : _close,
          icon: const BackButtonIcon(),
        ),
        title: widget.title,
        actions: widget.headerActions,
      ),
      // Scaffold must know the action area's geometry so floating feedback is
      // placed above it. The footer follows the keyboard once; the body keeps
      // Scaffold's normal resize behavior.
      bottomNavigationBar: widget.actions == null
          ? null
          : Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                  child: widget.actions!,
                ),
              ),
            ),
      body: SafeArea(
        top: false,
        bottom: widget.actions == null,
        child: Column(
          children: [
            if (widget.progressLabel != null)
              Semantics(
                liveRegion: true,
                child: Padding(
                  padding: const EdgeInsets.all(LetbuyySpacingTokens.space12),
                  child: Row(
                    children: [
                      const LoadingIndicator(),
                      const SizedBox(width: LetbuyySpacingTokens.space12),
                      Expanded(child: Text(widget.progressLabel!)),
                    ],
                  ),
                ),
              ),
            Expanded(child: widget.body),
          ],
        ),
      ),
    ),
  );
}

class _LiveEditorPopEntry extends PopEntry<Object?> {
  _LiveEditorPopEntry(bool Function() read)
    : canPopNotifier = _LiveCanPop(read);
  @override
  final _LiveCanPop canPopNotifier;
  @override
  void onPopInvokedWithResult(bool didPop, Object? result) {}
}

class _LiveCanPop extends ChangeNotifier implements ValueListenable<bool> {
  _LiveCanPop(this.read);
  final bool Function() read;
  @override
  bool get value => read();
  void changed() => notifyListeners();
}
