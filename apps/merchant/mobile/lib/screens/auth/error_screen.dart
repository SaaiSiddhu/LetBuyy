import 'package:flutter/material.dart';
import '../../app/routes.dart';
import '../../theme/app_theme_colors.dart';

/// Error Screen for non-sellers or no KYC
class ErrorScreen extends StatelessWidget {
  final String title;
  final String message;
  final VoidCallback? onRetry;
  final VoidCallback? onBackToLogin;

  const ErrorScreen({
    super.key,
    required this.title,
    required this.message,
    this.onRetry,
    this.onBackToLogin,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Error icon
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: colors.accent.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.error_outline_rounded,
                      size: 60,
                      color: colors.accent,
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Title
                  Text(
                    title,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colors.textPrimary,
                    ),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: 16),

                  // Message
                  Text(
                    message,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: colors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: 48),

                  // Actions
                  if (onRetry != null) ...[
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: onRetry,
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('Retry saved sign-in'),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        if (onBackToLogin != null) {
                          onBackToLogin!();
                          return;
                        }
                        Navigator.pushReplacementNamed(
                          context,
                          AppRoutes.login,
                        );
                      },
                      icon: const Icon(Icons.login_rounded),
                      label: const Text('Back to Login'),
                    ),
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
