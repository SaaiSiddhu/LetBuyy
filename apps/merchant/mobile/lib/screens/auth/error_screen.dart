import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../app/routes.dart';

/// Saved-sign-in recovery presentation; the supplied owner retains auth policy.
class ErrorScreen extends StatefulWidget {
  const ErrorScreen({
    super.key,
    required this.title,
    required this.message,
    this.onRetry,
    this.onBackToLogin,
  });
  final String title, message;
  final VoidCallback? onRetry, onBackToLogin;
  @override
  State<ErrorScreen> createState() => _ErrorScreenState();
}

class _ErrorScreenState extends State<ErrorScreen> {
  int _generation = 0;
  bool _dispatching = false;
  @override
  void didUpdateWidget(covariant ErrorScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    ++_generation;
    _dispatching = false;
  }

  void _dispatch(int generation, VoidCallback action) {
    if (!mounted ||
        generation != _generation ||
        _dispatching ||
        !isLetbuyySurfaceCurrent(context))
      return;
    setState(() => _dispatching = true);
    try {
      action();
    } finally {
      // VoidCallback completion belongs to the original auth owner. This latch
      // only prevents two dispatches in one frame; it is not an auth operation.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && generation == _generation) {
          setState(() => _dispatching = false);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final generation = _generation, retry = widget.onRetry;
    return Scaffold(
      body: SafeArea(
        child: ErrorView(
          title: widget.title,
          message: widget.message,
          retryLabel: 'Retry saved sign-in',
          onRetry: retry == null || _dispatching
              ? null
              : () => _dispatch(generation, retry),
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(LetbuyySpacingTokens.space24),
          child: FilledButton.icon(
            onPressed: _dispatching
                ? null
                : () => _dispatch(generation, () {
                    if (widget.onBackToLogin != null) {
                      widget.onBackToLogin!();
                      return;
                    }
                    Navigator.pushReplacementNamed(context, AppRoutes.login);
                  }),
            icon: const Icon(Icons.login_rounded),
            label: const Text('Back to Login'),
          ),
        ),
      ),
    );
  }
}
