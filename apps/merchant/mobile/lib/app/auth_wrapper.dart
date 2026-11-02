import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'store_context.dart';
import '../services/store_auth_service.dart';
import '../services/staff_service.dart';
import '../screens/settings/accept_staff_invitation_screen.dart';
import '../services/theme_provider.dart';
import '../theme/app_theme_colors.dart';
import '../screens/auth/hosted_account_screen.dart';
import '../screens/main/store_main_screen.dart';

enum _AuthState { loading, login, invitation, wizard, select, main, error }

/// Auth Wrapper Widget
/// Unified auth flow: Login → Store Check → Wizard or Main
class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  _AuthState _authState = _AuthState.loading;
  bool _isChecking = false;
  int _checkVersion = 0;
  String? _checkingActor;
  String _loadingStatus = 'Initializing...';
  String? _errorTitle;
  String? _errorMessage;
  String? _loginNotice;

  StreamSubscription<AuthState>? _authSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initAuthCheck();
    });
  }

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }

  void _initAuthCheck() {
    final authService = context.read<StoreAuthService>();

    if (context.read<StaffService>().pendingInvitation != null) {
      setState(() => _authState = _AuthState.invitation);
    } else if (authService.isSignedIn && !authService.accountTransition) {
      _checkUserState();
    } else {
      setState(() => _authState = _AuthState.login);
    }

    _authSub = authService.authStateChanges.listen((authState) {
      if (!mounted) return;

      final event = authState.event;
      final session = authState.session;

      if (event == AuthChangeEvent.verificationUnavailable) {
        _checkVersion++;
        _isChecking = false;
        _checkingActor = null;
        setState(() {
          _authState = _AuthState.login;
          _loginNotice =
              'Unable to verify your account. Your sign-in is preserved; please retry.';
        });
        return;
      }

      if (event == AuthChangeEvent.signedOut ||
          event == AuthChangeEvent.sessionExpired ||
          session == null) {
        _checkVersion++;
        _isChecking = false;
        _checkingActor = null;
        unawaited(context.read<StoreContext>().bindActor(null));
        setState(() {
          _authState = context.read<StaffService>().pendingInvitation == null
              ? _AuthState.login
              : _AuthState.invitation;
          _loginNotice = event == AuthChangeEvent.sessionExpired
              ? 'Your session expired. Please sign in again.'
              : null;
        });
      } else if (event == AuthChangeEvent.signedIn ||
          event == AuthChangeEvent.tokenRefreshed ||
          event == AuthChangeEvent.initialSession) {
        _checkUserState();
      }
    });
  }

  Future<void> _checkUserState() async {
    final auth = context.read<StoreAuthService>(),
        actor = context.read<StoreAuthService>().currentUser?.id;
    if (_isChecking && _checkingActor == actor) return;
    final version = ++_checkVersion;
    _isChecking = true;
    _checkingActor = actor;
    bool alive() =>
        mounted && version == _checkVersion && auth.currentUser?.id == actor;

    try {
      if (context.read<StaffService>().pendingInvitation != null) {
        setState(() => _authState = _AuthState.invitation);
        return;
      }
      setState(() {
        _authState = _AuthState.loading;
        _loadingStatus = 'Loading store...';
      });
      if (actor == null) throw StateError('Sign in again');
      final stores = context.read<StoreContext>();
      var store = await stores.ensureSelectedStoreForActor(actor, force: true);

      if (!alive()) return;

      if (auth.preferredSiteId != null &&
          stores.stores.any((item) => item.id == auth.preferredSiteId)) {
        await stores.selectStoreById(auth.preferredSiteId!);
        store = stores.selectedStore;
        auth.needsStoreSelection = false;
      } else if (stores.stores.length > 1 && auth.needsStoreSelection) {
        setState(() => _authState = _AuthState.select);
        return;
      }

      if (store != null) {
        setState(() => _authState = _AuthState.main);
      } else {
        setState(() => _authState = _AuthState.wizard);
      }
    } catch (e) {
      debugPrint('Error checking auth state: $e');
      if (alive()) {
        setState(() {
          _authState = _AuthState.error;
          _errorTitle = 'Error';
          _errorMessage = 'Something went wrong. Please try again.';
        });
      }
    } finally {
      if (version == _checkVersion) {
        _isChecking = false;
        _checkingActor = null;
      }
    }
  }

  /// Force refresh auth state
  void refreshAuthState() {
    _checkUserState();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final isDark = themeProvider.isDarkMode(context);
    final colors = AppThemeColors.of(context);

    switch (_authState) {
      case _AuthState.loading:
        return Material(
          child: Container(
            decoration: colors.backgroundGradient,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 32,
                    height: 32,
                    child: CircularProgressIndicator(
                      strokeWidth: 3,
                      color: colors.accent,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    _loadingStatus,
                    style: TextStyle(color: colors.textSecondary, fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
        );
      case _AuthState.login:
        return HostedAccountScreen(sessionNotice: _loginNotice);
      case _AuthState.invitation:
        return const AcceptStaffInvitationScreen();
      case _AuthState.wizard:
        return const HostedAccountScreen(purpose: 'create_store');
      case _AuthState.main:
        return const StoreMainScreen();
      case _AuthState.select:
        final stores = context.watch<StoreContext>();
        return Scaffold(
          appBar: AppBar(title: const Text('Choose a store')),
          body: ListView(
            children: [
              for (final store in stores.stores)
                ListTile(
                  title: Text(store.name),
                  subtitle: Text(store.subdomain),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () async {
                    final auth = context.read<StoreAuthService>(),
                        actor = context
                            .read<StoreAuthService>()
                            .currentUser
                            ?.id;
                    await stores.selectStore(store);
                    if (mounted && actor == auth.currentUser?.id) {
                      auth.needsStoreSelection = false;
                      setState(() => _authState = _AuthState.main);
                    }
                  },
                ),
            ],
          ),
        );
      case _AuthState.error:
        return Scaffold(
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _errorTitle ?? 'Unable to load your stores',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    Text(
                      _errorMessage ??
                          'Your sign-in is preserved. Please retry.',
                      textAlign: TextAlign.center,
                    ),
                    FilledButton(
                      onPressed: _checkUserState,
                      child: const Text('Retry loading stores'),
                    ),
                    TextButton(
                      onPressed: context.read<StoreAuthService>().signOut,
                      child: const Text('Log out'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
    }
  }
}
