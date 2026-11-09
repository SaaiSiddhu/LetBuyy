import 'dart:io';
import 'dart:convert';
import 'package:analyzer/dart/ast/ast.dart';
import 'coupon_preservation.dart' as parsed;

void main() {
  final root = Directory.current.path;
  final e = '$root/docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05';
  const path = 'apps/merchant/mobile/lib/screens/security/two_factor_screen.dart';
  final old = parsed.read('$e/security-preimages/$path'), now = parsed.read('$root/$path');
  final checks = <Map<String,Object>>[];
  void same(String name, String? a, String? b) {
    final ok = a != null && a == b;
    checks.add({'owner':name,'unchanged':ok});
    if (!ok) throw StateError('Security presentation preservation failed: $name');
  }
  for (final name in ['approve','_enroll','_activate','_acknowledge','_disableFactor','_approve','dispose']) {
    same('TwoFactorScreen.$name complete body', old.methods[name]?.body.toSource(), now.methods[name]?.body.toSource());
  }
  ArgumentList arguments(parsed.Nodes owner) {
    final expression = (owner.methods['_input']!.body as ExpressionFunctionBody).expression;
    if (expression is MethodInvocation) return expression.argumentList;
    if (expression is InstanceCreationExpression) return expression.argumentList;
    throw StateError('Unexpected native input expression');
  }
  final before = {for (final a in arguments(old).arguments.whereType<NamedExpression>()) a.name.label.name:a.expression.toSource()};
  final after = {for (final a in arguments(now).arguments.whereType<NamedExpression>()) a.name.label.name:a.expression.toSource()};
  for (final name in ['controller','obscureText','autocorrect','enableSuggestions','keyboardType','inputFormatters','autofillHints']) {
    same('Security input original $name', before[name], after[name]);
  }
  File('$e/security-parsed-preservation.json').writeAsStringSync(
    const JsonEncoder.withIndent('  ').convert({'basis':'Current preimages; presentation dispatch/settlement guards deliberately changed, original action bodies/native input arguments unchanged. Service, proof, SDK, command storage and route-policy bytes verified separately.','checks':checks})+'\n');
  stdout.writeln(checks.length.toString()+' security parsed preservation checks passed');
}
