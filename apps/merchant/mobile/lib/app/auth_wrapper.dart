import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'store_context.dart';
import '../services/store_auth_service.dart';
import '../services/staff_service.dart';
import '../screens/settings/accept_staff_invitation_screen.dart';
import '../services/theme_provider.dart';
import '../theme/app_theme_colors.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/error_screen.dart';
import '../screens/main/store_main_screen.dart';
import '../screens/wizard/create_store_wizard.dart';

enum _AuthState { loading, login, invitation, wizard, main, error }

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
  bool _identityRecovery = false;

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

    if (authService.hasSessionRecovery) {
      _showIdentityRecovery();
    } else if (context.read<StaffService>().pendingInvitation != null) {
      setState(() => _authState = _AuthState.invitation);
    } else if (authService.isSignedIn) {
      _checkUserState();
    } else {
      setState(() => _authState = _AuthState.login);
    }

    _authSub = authService.authStateChanges.listen((authState) {
      if (!mounted) return;

      final event = authState.event;
      final session = authState.session;

      if (event == AuthChangeEvent.sessionUnavailable) {
        _checkVersion++;
        _isChecking = false;
        _checkingActor = null;
        unawaited(context.read<StoreContext>().bindActor(null));
        _showIdentityRecovery();
      } else if (event == AuthChangeEvent.signedOut ||
          event == AuthChangeEvent.sessionExpired ||
          session == null) {
        _checkVersion++;
        _isChecking = false;
        _checkingActor = null;
        unawaited(context.read<StoreContext>().bindActor(null));
        setState(() {
          _identityRecovery = false;
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
        _identityRecovery = false;
        _checkUserState();
      }
    });
  }

  void _showIdentityRecovery() {
    setState(() {
      _identityRecovery = true;
      _authState = _AuthState.error;
      _errorTitle = 'Sign-in temporarily unavailable';
      _errorMessage =
          'Your saved sign-in is kept securely. Retry to confirm your account before opening your store.';
    });
  }

  Future<void> _retryIdentity() async {
    setState(() {
      _authState = _AuthState.loading;
      _loadingStatus = 'Confirming sign-in...';
    });
    try {
      await context.read<StoreAuthService>().refreshSession();
    } catch (_) {
      if (mounted) _showIdentityRecovery();
    }
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
      final store = await context
          .read<StoreContext>()
          .ensureSelectedStoreForActor(actor);

      if (!alive()) return;

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
        return LoginScreen(sessionNotice: _loginNotice);
      case _AuthState.invitation:
        return const AcceptStaffInvitationScreen();
      case _AuthState.wizard:
        return const CreateStoreWizard();
      case _AuthState.main:
        return const StoreMainScreen();
      case _AuthState.error:
        return ErrorScreen(
          title: _errorTitle ?? 'Error',
          message: _errorMessage ?? 'Something went wrong',
          onRetry: _identityRecovery ? _retryIdentity : null,
          onBackToLogin: _identityRecovery
              ? () async {
                  await context.read<StoreAuthService>().signOut();
                }
              : null,
        );
    }
  }
}
