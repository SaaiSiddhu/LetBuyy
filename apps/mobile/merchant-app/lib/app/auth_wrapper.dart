import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'store_context.dart';
import '../services/store_auth_service.dart';
import '../services/theme_provider.dart';
import '../theme/app_theme_colors.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/error_screen.dart';
import '../screens/main/store_main_screen.dart';
import '../screens/wizard/create_store_wizard.dart';

enum _AuthState { loading, login, wizard, main, error }

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

    if (authService.isSignedIn) {
      _checkUserState();
    } else {
      setState(() => _authState = _AuthState.login);
    }

    _authSub = authService.authStateChanges.listen((authState) {
      if (!mounted) return;

      final event = authState.event;
      final session = authState.session;

      if (event == AuthChangeEvent.signedOut ||
          event == AuthChangeEvent.sessionExpired ||
          session == null) {
        unawaited(context.read<StoreContext>().clearSelection());
        setState(() {
          _authState = _AuthState.login;
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
    if (_isChecking) return;
    _isChecking = true;

    try {
      setState(() => _loadingStatus = 'Loading store...');
      final store = await context.read<StoreContext>().ensureSelectedStore();

      if (!mounted) return;

      if (store != null) {
        setState(() => _authState = _AuthState.main);
      } else {
        setState(() => _authState = _AuthState.wizard);
      }
    } catch (e) {
      debugPrint('Error checking auth state: $e');
      if (mounted) {
        setState(() {
          _authState = _AuthState.error;
          _errorTitle = 'Error';
          _errorMessage = 'Something went wrong. Please try again.';
        });
      }
    }
    _isChecking = false;
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
      case _AuthState.wizard:
        return const CreateStoreWizard();
      case _AuthState.main:
        return const StoreMainScreen();
      case _AuthState.error:
        return ErrorScreen(
          title: _errorTitle ?? 'Error',
          message: _errorMessage ?? 'Something went wrong',
        );
    }
  }
}
