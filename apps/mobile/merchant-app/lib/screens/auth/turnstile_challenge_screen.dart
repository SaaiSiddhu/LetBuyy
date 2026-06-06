import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../config/app_config.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart';

class TurnstileChallengeScreen extends StatefulWidget {
  const TurnstileChallengeScreen({super.key});

  @override
  State<TurnstileChallengeScreen> createState() =>
      _TurnstileChallengeScreenState();
}

class _TurnstileChallengeScreenState extends State<TurnstileChallengeScreen> {
  late final WebViewController _controller;
  bool _isReady = false;
  String? _error;

  bool get _hasConfiguredSiteKey =>
      AppConfig.turnstileSiteKey.isNotEmpty &&
      !AppConfig.turnstileSiteKey.startsWith('SKIP_NEEDS_HUMAN_');

  @override
  void initState() {
    super.initState();
    if (!_hasConfiguredSiteKey) {
      _error =
          'SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_SITE_KEY: configure TURNSTILE_SITE_KEY to render the mobile challenge.';
      return;
    }

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _isReady = true);
          },
          onWebResourceError: (error) {
            if (!mounted) return;
            setState(() {
              _error = error.description;
            });
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
          setState(() => _error = message.message);
        },
      )
      ..loadHtmlString(
        _turnstileHtml(AppConfig.turnstileSiteKey),
        baseUrl: AppConfig.identityBaseUrl,
      );
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
            padding: const EdgeInsets.all(LetbuyySpacingTokens.space24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeader(colors),
                const SizedBox(height: LetbuyySpacingTokens.space24),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: colors.card,
                        border: Border.all(color: colors.cardBorder),
                      ),
                      child: _error != null
                          ? _buildError(colors, _error!)
                          : Stack(
                              children: [
                                WebViewWidget(controller: _controller),
                                if (!_isReady)
                                  Center(
                                    child: CircularProgressIndicator(
                                      color: colors.accent,
                                    ),
                                  ),
                              ],
                            ),
                    ),
                  ),
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
        Icon(Icons.verified_user_outlined, color: colors.accent, size: 32),
        const SizedBox(height: LetbuyySpacingTokens.space12),
        Text(
          'Security check',
          style: TextStyle(
            color: colors.textPrimary,
            fontSize: 24,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: LetbuyySpacingTokens.space8),
        Text(
          'Complete the Cloudflare challenge to continue.',
          style: TextStyle(color: colors.textSecondary, height: 1.4),
        ),
      ],
    );
  }

  Widget _buildError(AppThemeColors colors, String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.warning_amber_rounded, color: colors.warning, size: 34),
            const SizedBox(height: LetbuyySpacingTokens.space16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textPrimary, height: 1.4),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space20),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Back'),
            ),
          ],
        ),
      ),
    );
  }
}

String _turnstileHtml(String siteKey) {
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
      color: #0f172a;
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
      color: #64748b;
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
