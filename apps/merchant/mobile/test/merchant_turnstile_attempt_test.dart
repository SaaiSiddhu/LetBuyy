import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/widgets/shared/merchant_turnstile_attempt.dart';

void main() {
  test('an empty later callback cannot preserve a previous proof', () {
    final attempt = MerchantTurnstileAttempt(), generation = attempt.begin();
    attempt.succeed(generation, 'previous');
    attempt.succeed(generation, ' ');
    expect(attempt.token, isNull);
    expect(attempt.error, isTrue);
    expect(attempt.takeToken(), isNull);
  });
  test(
    'a proof is consumed once before either a failed or successful auth response',
    () {
      final attempt = MerchantTurnstileAttempt(), generation = 0;
      expect(attempt.takeToken(), isNull);
      expect(attempt.current(generation), isTrue);
      final active = attempt.begin();
      attempt.succeed(active, ' synthetic-proof ');
      expect(attempt.takeToken(), 'synthetic-proof');
      expect(attempt.token, isNull);
      expect(attempt.expired, isTrue);
      // A failed password/MFA/reset response does not put the consumed proof back.
      expect(attempt.takeToken(), isNull);
      attempt.succeed(active, 'late-consumed-proof');
      expect(attempt.takeToken(), isNull);
      final retry = attempt.begin();
      attempt.succeed(retry, 'fresh-proof');
      expect(attempt.takeToken(), 'fresh-proof');
    },
  );
  test(
    'retry retires every old token, failure, expiry and page-ready callback',
    () {
      final attempt = MerchantTurnstileAttempt(),
          old = attempt.begin(),
          current = attempt.begin();
      attempt.succeed(current, 'current-proof');
      attempt.succeed(old, 'old-proof');
      attempt.fail(old);
      attempt.expire(old);
      attempt.pageReady(old);
      expect(attempt.token, 'current-proof');
      expect(attempt.error, isFalse);
      expect(attempt.expired, isFalse);
    },
  );
  test(
    'an unrelated subframe probe does not fail a pending or completed challenge',
    () {
      final attempt = MerchantTurnstileAttempt(), generation = attempt.begin();
      expect(
        attempt.resourceFailure(generation, isForMainFrame: false),
        isFalse,
      );
      expect(attempt.error, isFalse);
      attempt.succeed(generation, 'synthetic-proof');
      expect(
        attempt.resourceFailure(generation, isForMainFrame: false),
        isFalse,
      );
      expect(attempt.takeToken(), 'synthetic-proof');
    },
  );
  for (final frame in [true, null])
    test('a main or unknown frame failure clears prior proof ($frame)', () {
      final attempt = MerchantTurnstileAttempt(), generation = attempt.begin();
      attempt.succeed(generation, 'synthetic-proof');
      expect(
        attempt.resourceFailure(generation, isForMainFrame: frame),
        isTrue,
      );
      expect(attempt.error, isTrue);
      expect(attempt.takeToken(), isNull);
    });
  test(
    'actual widget failure and expiry clear proof; provider recovery is a fresh token',
    () {
      final attempt = MerchantTurnstileAttempt(), generation = attempt.begin();
      attempt.succeed(generation, 'old');
      attempt.fail(generation);
      expect(attempt.token, isNull);
      expect(attempt.takeToken(), isNull);
      attempt.succeed(generation, 'recovered');
      expect(attempt.error, isFalse);
      attempt.expire(generation);
      expect(attempt.takeToken(), isNull);
      expect(attempt.expired, isTrue);
      attempt.succeed(generation, 'fresh-after-expiry');
      expect(attempt.takeToken(), 'fresh-after-expiry');
    },
  );
  test(
    'disposing or leaving a verification route prevents a second proof-driven pop',
    () {
      final attempt = MerchantTurnstileAttempt(), generation = attempt.begin();
      var pops = 0;
      void callback(String token) {
        if (!attempt.current(generation)) return;
        attempt.succeed(generation, token);
        if (attempt.takeToken() != null) pops++;
      }

      callback('first');
      callback('duplicate');
      expect(pops, 1);
      attempt.invalidate();
      callback('after-close');
      expect(pops, 1);
    },
  );
  test('empty callback cannot create a completed proof', () {
    final attempt = MerchantTurnstileAttempt(), generation = attempt.begin();
    attempt.succeed(generation, '  ');
    expect(attempt.takeToken(), isNull);
  });
  for (final dark in [false, true])
    test(
      'the shared $dark document executes the supported widget and exact bridge channels',
      () {
        final key =
            'synthetic-key</script><script>throw new Error("injected")</script>';
        final html = merchantTurnstileDocument(
          key,
          isDark: dark,
          centered: true,
        );
        expect(
          html,
          contains(
            'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
          ),
        );
        expect(html, contains('justify-content:center'));
        expect(html, contains("size:'normal'"));
        expect(html, isNot(contains(key)));
        final script = RegExp(
          r'<script>([\s\S]*?)</script>',
        ).firstMatch(html)!.group(1)!;
        final run = Process.runSync('node', [
          '-e',
          r'''
const vm=require('node:vm'),assert=require('node:assert/strict');
const input=JSON.parse(process.argv[1]),events=[];let options;
const context={window:{turnstile:{render:(target,value)=>{assert.equal(target,'#ts');options=value;}}},
 TurnstileToken:{postMessage:value=>events.push(['token',value])},TurnstileError:{postMessage:value=>events.push(['error',value])},TurnstileExpired:{postMessage:value=>events.push(['expired',value])}};
vm.runInNewContext(input.script,context,{timeout:1000});assert.equal(options.sitekey,input.key);assert.equal(options.theme,input.dark?'dark':'light');
assert.equal(options.size,'normal');options.callback('synthetic-proof');assert.equal(options['error-callback']('600010'),true);options['expired-callback']();
assert.deepEqual(events,[['token','synthetic-proof'],['error','challenge-failed'],['expired','expired']]);
context.window={};vm.runInNewContext(input.script,context,{timeout:1000});assert.deepEqual(events.at(-1),['error','script-unavailable']);
''',
          jsonEncode({'script': script, 'key': key, 'dark': dark}),
        ]);
        expect(run.exitCode, 0, reason: run.stderr.toString());
      },
    );
}
