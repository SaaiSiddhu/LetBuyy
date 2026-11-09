import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../services/store_auth_service.dart';
import '../../services/native_media_selection.dart';
import 'native_media_recovery_notice.dart';

/// This lives inside the page route's semantics scope. A notice beside the
/// Navigator is painted but excluded by the route's BlockSemantics boundary.
class NativeMediaRecoveryFrame extends StatelessWidget {
  const NativeMediaRecoveryFrame({
    super.key,
    required this.child,
    required this.routeForPurpose,
  });
  final Widget child;
  final String? Function(String purpose) routeForPurpose;
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<StoreAuthService?>();
    context.watch<StoreContext?>();
    final selection = context.watch<NativeMediaSelection?>();
    final enabled =
        auth?.currentUser != null && !(auth?.accountTransition ?? false);
    final visible =
        enabled &&
        selection != null &&
        !selection.busy &&
        (selection.hasSelection || selection.error != null);
    // Keep the page's element/lifetime stable as recovery state changes.
    return Column(
      children: [
        if (enabled)
          NativeMediaRecoveryNotice(
            openContext: () => context,
            routeForPurpose: routeForPurpose,
          ),
        Expanded(
          child: MediaQuery.removePadding(
            context: context,
            removeTop: visible,
            child: child,
          ),
        ),
      ],
    );
  }
}
