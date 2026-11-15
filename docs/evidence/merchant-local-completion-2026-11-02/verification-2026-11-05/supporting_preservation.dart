import 'dart:io';
import 'dart:convert';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'coupon_preservation.dart' as parsed;

class Calls extends RecursiveAstVisitor<void> {
  final navigation = <String>[];
  final enumValues = <String>[];
  @override
  void visitMethodInvocation(MethodInvocation node) {
    if (node.target?.toSource() == 'Navigator' && node.methodName.name == 'pushReplacementNamed') {
      navigation.add(node.argumentList.toSource());
    }
    super.visitMethodInvocation(node);
  }
  @override
  void visitPrefixedIdentifier(PrefixedIdentifier node) {
    if (node.prefix.name == 'ImageSource') enumValues.add(node.toSource());
    super.visitPrefixedIdentifier(node);
  }
}
void main() {
  final root=Directory.current.path;
  final evidence='$root/docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05';
  final checks=<Map<String,Object>>[];
  void same(String name,Object? a,Object? b){
    final ok=a!=null&&a==b;checks.add({'owner':name,'unchanged':ok});
    if(!ok) throw StateError('Supporting preservation failed: $name');
  }
  const health='apps/merchant/mobile/lib/screens/store_health/store_health_screen.dart';
  final old=parsed.read('$evidence/supporting-preimages/$health'),now=parsed.read('$root/$health');
  for(final name in ['_intValue','_scoreLabel','_statusIcon']){
    same('Health.$name complete body',old.methods[name]?.body.toSource(),now.methods[name]?.body.toSource());
  }
  for(final name in ['_scoreColor','_statusColor']){
    List<String> conditions(parsed.Nodes owner)=>(owner.methods[name]!.body as BlockFunctionBody).block.statements.whereType<IfStatement>().map((i)=>i.expression.toSource()).toList();
    same('Health.$name original conditions; colors only now semantic',jsonEncode(conditions(old)),jsonEncode(conditions(now)));
  }
  CompilationUnit unit(String path)=>parseString(content:File(path).readAsStringSync(),path:path).unit;
  const image='apps/merchant/mobile/lib/widgets/shared/image_source_sheet.dart';
  final beforeImage=unit('$evidence/supporting-preimages/$image'),afterImage=unit('$root/$image');
  FunctionDeclaration function(CompilationUnit u)=>u.declarations.whereType<FunctionDeclaration>().singleWhere((f)=>f.name.lexeme=='showImageSourceSheet');
  same('Image source original public parameters',function(beforeImage).functionExpression.parameters!.toSource(),function(afterImage).functionExpression.parameters!.toSource());
  same('Image source original return type',function(beforeImage).returnType!.toSource(),function(afterImage).returnType!.toSource());
  final oldCalls=Calls(),newCalls=Calls();beforeImage.accept(oldCalls);afterImage.accept(newCalls);
  same('Image source original camera/gallery values',jsonEncode(oldCalls.enumValues),jsonEncode(newCalls.enumValues));
  const error='apps/merchant/mobile/lib/screens/auth/error_screen.dart';
  final beforeError=unit('$evidence/supporting-preimages/$error'),afterError=unit('$root/$error');
  String constructor(CompilationUnit u)=>u.declarations.whereType<ClassDeclaration>().singleWhere((c)=>c.name.lexeme=='ErrorScreen').members.whereType<ConstructorDeclaration>().single.parameters.toSource();
  same('ErrorScreen original public parameters',constructor(beforeError),constructor(afterError));
  final oldNav=Calls(),newNav=Calls();beforeError.accept(oldNav);afterError.accept(newNav);
  same('ErrorScreen original default login navigation args',jsonEncode(oldNav.navigation),jsonEncode(newNav.navigation));
  File('$evidence/supporting-parsed-preservation.json').writeAsStringSync(const JsonEncoder.withIndent('  ').convert({'basis':'Original helpers, thresholds, public parameters, enums and navigation arguments against saved preimages. Presentation scopes/host/container/colors intentionally changed; full protected bytes verified separately.','checks':checks})+'\n');
  stdout.writeln(checks.length.toString()+' supporting parsed preservation checks passed');
}
