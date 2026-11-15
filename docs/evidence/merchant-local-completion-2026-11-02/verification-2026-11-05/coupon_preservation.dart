import 'dart:io';
import 'dart:convert';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';

class Nodes extends RecursiveAstVisitor<void> {
  final methods = <String, MethodDeclaration>{};
  final functions = <FunctionExpression>[];
  final variables = <VariableDeclaration>[];
  @override
  void visitMethodDeclaration(MethodDeclaration node) {
    methods[node.name.lexeme] = node;
    super.visitMethodDeclaration(node);
  }
  @override
  void visitFunctionExpression(FunctionExpression node) {
    functions.add(node);
    super.visitFunctionExpression(node);
  }
  @override
  void visitVariableDeclaration(VariableDeclaration node) {
    variables.add(node);
    super.visitVariableDeclaration(node);
  }
}
Nodes read(String path) {
  final result = parseString(content: File(path).readAsStringSync(), path: path);
  if (result.errors.any((e) => e.errorCode.errorSeverity.name == 'ERROR')) {
    throw StateError('Parse error: $path');
  }
  final visitor = Nodes(); result.unit.accept(visitor); return visitor;
}
void main() {
  final root = Directory.current.path;
  final evidence = '$root/docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05';
  Nodes original(String path) => read('$evidence/preimages/$path');
  Nodes current(String path) => read('$root/$path');
  final checks = <Map<String, Object>>[];
  void check(String name, Object? old, Object? now) {
    final equal = old != null && old == now;
    checks.add({'owner': name, 'unchanged': equal});
    if (!equal) throw StateError('Preservation failed: $name');
  }
  const service = 'apps/merchant/mobile/lib/services/coupon_service.dart';
  final oldService = original(service), newService = current(service);
  for (final name in ['createCoupon', 'updateCoupon', 'toggleCoupon', 'deleteCoupon', 'validateCoupon']) {
    check('CouponService.$name complete body',
      oldService.methods[name]?.body.toSource(), newService.methods[name]?.body.toSource());
  }
  const form = 'apps/merchant/mobile/lib/screens/discounts/coupon_form_screen.dart';
  final oldForm = original(form), newForm = current(form);
  for (final name in ['_numberOrNull', '_intOrNull', '_textOrNull']) {
    check('CouponForm.$name', oldForm.methods[name]?.body.toSource(), newForm.methods[name]?.body.toSource());
  }
  final oldValueValidator = oldForm.functions.singleWhere((f) => f.body.toSource().contains('Enter a valid discount value'));
  check('CouponForm original discount validator', oldValueValidator.body.toSource(), newForm.methods['_valueError']?.body.toSource());
  final oldCodeValidator = oldForm.functions.singleWhere((f) => f.body.toSource().contains('Code is required')).body as ExpressionFunctionBody;
  final newCodeValidator = newForm.methods['_codeError']!.body as ExpressionFunctionBody;
  check('CouponForm original code validator', oldCodeValidator.expression.toSource(), newCodeValidator.expression.toSource());
  final oldPayload = oldForm.variables.singleWhere((v) => v.name.lexeme == 'payload').initializer! as SetOrMapLiteral;
  final newPayload = newForm.variables.singleWhere((v) => v.name.lexeme == 'payload').initializer! as SetOrMapLiteral;
  final oldEntries = oldPayload.elements.map((e) => e.toSource()).toList();
  final newEntries = newPayload.elements.where((e) => !(e is MapLiteralEntry && e.key is SimpleStringLiteral && (e.key as SimpleStringLiteral).value == 'starts_at')).map((e) => e.toSource()).toList();
  check('CouponForm all original payload entries in original order', jsonEncode(oldEntries), jsonEncode(newEntries));
  IfStatement omit(Nodes owner) =>
      (owner.methods['_save']!.body as BlockFunctionBody).block.statements.whereType<TryStatement>().single.body.statements.whereType<IfStatement>().singleWhere((s) => s.toSource().contains('payload.removeWhere'));
  check('CouponForm original create omission versus patch null-clear', omit(oldForm).toSource(), omit(newForm).toSource());
  const list = 'apps/merchant/mobile/lib/screens/discounts/coupons_screen.dart';
  final oldList = original(list), newList = current(list);
  for (final name in ['_money', '_limitLabel', '_intValue', '_doubleValue', '_nonEmpty']) {
    check('CouponList.$name', oldList.methods[name]?.body.toSource(), newList.methods[name]?.body.toSource());
  }
  File('$evidence/coupon-parsed-preservation.json').writeAsStringSync(
    const JsonEncoder.withIndent('  ').convert({
      'basis': 'Parsed AST body equality against current-turn preserved preimages. Constructor/read/cache admission and presentation bodies deliberately changed; commands, payload parsers and original validators preserved. Added starts_at binding is the only new payload entry.',
      'checks': checks,
    }) + '\n');
  stdout.writeln(checks.length.toString() + ' parsed preservation checks passed');
}
