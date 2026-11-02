import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../app/routes.dart';
import '../../services/merchant_browser_auth.dart';
import '../../services/store_auth_service.dart';

/// All credential/checkpoint forms are hosted by Accounts in the OS browser.
class HostedAccountScreen extends StatefulWidget {
  const HostedAccountScreen({super.key, this.purpose, this.sessionNotice});
  final String? purpose, sessionNotice;
  @override
  State<HostedAccountScreen> createState() => _HostedAccountScreenState();
}

class _HostedAccountScreenState extends State<HostedAccountScreen> {
  StreamSubscription<AuthState>? _subscription;
  @override
  void initState() {
    super.initState();
    _subscription = context.read<StoreAuthService>().authStateChanges.listen((
      state,
    ) {
      if (!mounted || state.event != AuthChangeEvent.signedIn) return;
      Navigator.of(
        context,
      ).pushNamedAndRemoveUntil(AppRoutes.auth, (_) => false);
    });
  }

  @override
  void dispose() {
    unawaited(_subscription?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final flow = context.watch<MerchantBrowserAuth>(),
        auth = context.watch<StoreAuthService>();
    final creating = widget.purpose == 'create_store',
        security = widget.purpose == 'manage_security';
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SvgPicture.asset(
                    Theme.of(context).brightness == Brightness.dark
                        ? 'assets/images/letbuyy-logo-dark.svg'
                        : 'assets/images/letbuyy-logo-light.svg',
                    height: 56,
                    semanticsLabel: 'LetBuyy',
                  ),
                  const SizedBox(height: 24),
                  Text(
                    creating
                        ? 'Create your store'
                        : security
                        ? 'Manage your account'
                        : 'Welcome to LetBuyy',
                    style: Theme.of(context).textTheme.headlineMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    creating
                        ? 'Your account is ready. Create a draft store to start setting up your business.'
                        : security
                        ? 'Open Accounts to manage your sign-in, security and sessions.'
                        : 'Run your business with the LetBuyy Merchant app.',
                    textAlign: TextAlign.center,
                  ),
                  if (widget.sessionNotice != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Text(
                        widget.sessionNotice!,
                        textAlign: TextAlign.center,
                      ),
                    ),
                  if (flow.message != null || auth.verificationUnavailable)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Semantics(
                        liveRegion: true,
                        child: Text(
                          flow.message ??
                              'Unable to verify your account. Check your connection and retry.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  const SizedBox(height: 24),
                  if (flow.busy) ...[
                    const Center(child: CircularProgressIndicator()),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: flow.cancel,
                      child: const Text('Cancel and return'),
                    ),
                  ] else ...[
                    if (flow.status == BrowserAuthStatus.unavailable ||
                        auth.verificationUnavailable)
                      OutlinedButton(
                        onPressed: flow.retryVerification,
                        child: const Text('Retry account verification'),
                      ),
                    FilledButton(
                      onPressed: () => flow.begin(
                        widget.purpose ??
                            (auth.isSignedIn ? 'switch_account' : 'login'),
                      ),
                      child: Text(
                        creating
                            ? 'Create store'
                            : security
                            ? 'Open Accounts'
                            : 'Log in',
                      ),
                    ),
                    if (!creating && !security)
                      OutlinedButton(
                        onPressed: () => flow.begin('signup'),
                        child: const Text('Sign up'),
                      ),
                    if (auth.isSignedIn)
                      TextButton(
                        onPressed: auth.signOut,
                        child: const Text('Log out'),
                      ),
                  ],
                  const SizedBox(height: 16),
                  if (auth.lastLogoutRevocationConfirmed == false)
                    const Text(
                      'This device is signed out. Server sign-out could not be confirmed.',
                      textAlign: TextAlign.center,
                    ),
                  const Text(
                    'Secure sign-in opens inside the app. You’ll return automatically when finished.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
