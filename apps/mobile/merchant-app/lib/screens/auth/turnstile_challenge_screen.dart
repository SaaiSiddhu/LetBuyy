import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../config/app_config.dart';
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

  bool get _hasConfiguredSiteKey => AppConfig.hasTurnstileSiteKey;

  /// True when retrying cannot help — the sitekey itself is absent.
  bool get _isUnrecoverable => !_hasConfiguredSiteKey;

  String _formatTurnstileError(String raw) {
    if (raw.contains('300030') || raw.contains('100000') || raw.contains('domain')) {
      return 'Verification challenge is unavailable for this domain. Please check network or site configuration.';
    }
    return raw.replaceAll('Exception: ', '');
  }

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

    final isDark = AppThemeColors.of(context).isDark;

    setState(() {
      _error = null;
      _isReady = false;
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(Colors.transparent)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageFinished: (_) {
              if (mounted) setState(() => _isReady = true);
            },
            onWebResourceError: (error) {
              if (!mounted) return;
              setState(() => _error = _formatTurnstileError(error.description));
            },
          ),
        )
        ..addJavaScriptChannel(
          'TurnstileToken',
          onMessageReceived: (message) {
            final token = message.message.trim();
            if (token.isEmpty || !mounted) return;
            Navigator.pop(context, token);
          },
        )
        ..addJavaScriptChannel(
          'TurnstileError',
          onMessageReceived: (message) {
            if (!mounted) return;
            setState(() => _error = _formatTurnstileError(message.message));
          },
        )
        ..loadHtmlString(
          _turnstileHtml(AppConfig.turnstileSiteKey, isDark: isDark),
          baseUrl: AppConfig.identityBaseUrl,
        );
    });
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

String _turnstileHtml(String siteKey, {required bool isDark}) {
  // The document is injected into a themed card, so its own palette has to
  // follow the app theme — light-on-dark was previously unreadable.
  final textColor = isDark ? '#e2e8f0' : '#0f172a';
  final hintColor = isDark ? '#94a3b8' : '#64748b';
  final widgetTheme = isDark ? 'dark' : 'light';

  return '''
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
  <style>
    html, body {
      margin: 0;
      height: 100%;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
      color: $textColor;
    }
    .wrap {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .panel {
      width: 100%;
      max-width: 360px;
      text-align: center;
    }
    #turnstile {
      display: inline-block;
      min-height: 70px;
    }
    .hint {
      margin-top: 16px;
      color: $hintColor;
      font-size: 14px;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="panel">
      <div id="turnstile"></div>
      <div class="hint">This token is sent only to the LetBuyy identity platform.</div>
    </div>
  </div>
  <script>
    function renderTurnstile() {
      if (!window.turnstile) {
        window.setTimeout(renderTurnstile, 100);
        return;
      }
      window.turnstile.render('#turnstile', {
        sitekey: '$siteKey',
        theme: '$widgetTheme',
        callback: function(token) {
          TurnstileToken.postMessage(token);
        },
        'error-callback': function(code) {
          TurnstileError.postMessage('Turnstile failed: ' + code);
        },
        'expired-callback': function() {
          TurnstileError.postMessage('Turnstile token expired. Please reopen the challenge.');
        }
      });
    }
    renderTurnstile();
  </script>
</body>
</html>
''';
}
