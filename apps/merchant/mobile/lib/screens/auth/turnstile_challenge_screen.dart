import 'dart:async';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../config/app_config.dart';
import '../../widgets/shared/merchant_turnstile_attempt.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class TurnstileChallengeScreen extends StatefulWidget {
  const TurnstileChallengeScreen({super.key});

  @override
  State<TurnstileChallengeScreen> createState() =>
      _TurnstileChallengeScreenState();
}

class _TurnstileChallengeScreenState extends State<TurnstileChallengeScreen> {
  WebViewController? _controller;
  bool _isReady = false;
  String? _error;
  final _attempt = MerchantTurnstileAttempt();

  bool get _hasConfiguredSiteKey => AppConfig.hasTurnstileSiteKey;

  /// True when retrying cannot help — the sitekey itself is absent.
  bool get _isUnrecoverable => !_hasConfiguredSiteKey;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The embedded document is themed, so it is built once the inherited
    // theme is available rather than in initState.
    if (_controller == null && _error == null) _loadChallenge();
  }

  void _loadChallenge() {
    if (!_hasConfiguredSiteKey) {
      setState(() {
        _error =
            'Verification is temporarily unavailable. Please try again later.';
      });
      return;
    }

    final isDark = AppThemeColors.of(context).isDark,
        generation = _attempt.begin();
    bool active() => mounted && _attempt.current(generation);
    void failed({bool expired = false}) {
      if (!active()) return;
      setState(() {
        if (expired) {
          _attempt.expire(generation);
        } else {
          _attempt.fail(generation);
        }
        _error = expired
            ? 'Verification expired. Please retry the security check.'
            : 'Verification could not be completed. Check your connection and retry.';
      });
    }

    setState(() {
      _error = null;
      _isReady = false;
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(Colors.transparent)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageFinished: (_) {
              if (active()) setState(() => _isReady = true);
            },
            onWebResourceError: (error) {
              if (error.isForMainFrame != false) failed();
            },
          ),
        )
        ..addJavaScriptChannel(
          'TurnstileToken',
          onMessageReceived: (message) {
            if (!active() || ModalRoute.of(context)?.isCurrent != true) return;
            _attempt.succeed(generation, message.message);
            final token = _attempt.takeToken();
            if (token != null) Navigator.pop(context, token);
          },
        )
        ..addJavaScriptChannel(
          'TurnstileError',
          onMessageReceived: (_) => failed(),
        )
        ..addJavaScriptChannel(
          'TurnstileExpired',
          onMessageReceived: (_) => failed(expired: true),
        );
      unawaited(
        _controller!
            .loadHtmlString(
              merchantTurnstileDocument(
                AppConfig.turnstileSiteKey,
                isDark: isDark,
                centered: true,
              ),
              baseUrl: AppConfig.identityBaseUrl,
            )
            .catchError((Object _) => failed()),
      );
    });
  }

  @override
  void dispose() {
    _attempt.invalidate();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        backgroundColor: colors.bgStart,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        title: const Text('Verify you are human'),
      ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(LetbuyySpacingTokens.x2l),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeader(colors),
                const SizedBox(height: LetbuyySpacingTokens.x2l),
                Expanded(
                  // The error state is sized to its content and centred, so a
                  // short message no longer sits inside a near-full-height box.
                  child: _error != null
                      ? Center(child: _buildErrorCard(colors, _error!))
                      : _buildChallengeCard(colors),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(AppThemeColors colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.verified_user_outlined,
          color: colors.accent,
          size: LetbuyySpacingTokens.x3l,
        ),
        const SizedBox(height: LetbuyySpacingTokens.md),
        Text(
          'Security check',
          style: TextStyle(
            color: colors.textPrimary,
            fontSize: LetbuyyTypographyTokens.h2.toDouble(),
            fontWeight: LetbuyyTypographyTokens.bold,
          ),
        ),
        const SizedBox(height: LetbuyySpacingTokens.sm),
        Text(
          'Complete the Cloudflare challenge to continue.',
          style: TextStyle(
            color: colors.textSecondary,
            fontSize: LetbuyyTypographyTokens.body.toDouble(),
            height: 1.4,
          ),
        ),
      ],
    );
  }

  Widget _buildChallengeCard(AppThemeColors colors) {
    final controller = _controller;
    return ClipRRect(
      borderRadius: BorderRadius.circular(LetbuyyRadiusTokens.xl.toDouble()),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.card,
          border: Border.all(color: colors.cardBorder),
        ),
        child: Stack(
          children: [
            if (controller != null) WebViewWidget(controller: controller),
            if (!_isReady)
              Center(child: CircularProgressIndicator(color: colors.accent)),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorCard(AppThemeColors colors, String message) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(LetbuyyRadiusTokens.xl.toDouble()),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.card,
          border: Border.all(color: colors.cardBorder),
        ),
        child: Padding(
          padding: const EdgeInsets.all(LetbuyySpacingTokens.x2l),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.warning_amber_rounded,
                color: colors.warning,
                size: LetbuyySpacingTokens.x3l,
              ),
              const SizedBox(height: LetbuyySpacingTokens.lg),
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: LetbuyyTypographyTokens.body.toDouble(),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: LetbuyySpacingTokens.xl),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Back'),
                  ),
                  if (!_isUnrecoverable) ...[
                    const SizedBox(width: LetbuyySpacingTokens.md),
                    FilledButton(
                      onPressed: _loadChallenge,
                      child: const Text('Try again'),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
