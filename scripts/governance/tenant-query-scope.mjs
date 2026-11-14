import ts from 'typescript';

const literal = node => node && (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
const method = node => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : null;

function completeWriteType(checker, type, columns) {
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter)) return false;
  if (type.isUnion()) return type.types.every(part => completeWriteType(checker,part,columns));
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const element=checker.getIndexTypeOfType(type,ts.IndexKind.Number);
    return Boolean(element) && completeWriteType(checker,element,columns);
  }
  return columns.some(column => {
    const property=type.getProperty(column);
    return property && !(property.flags & ts.SymbolFlags.Optional);
  });
}

function writeHasScope(node,checker,columns) {
  if (!node) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.length>0 && node.elements.every(item=>writeHasScope(item,checker,columns));
  return completeWriteType(checker,checker.getTypeAtLocation(node),columns);
}

/** Inspect one actual expression chain; neighbouring queries and comments cannot lend it scope. */
export function directTenantQueries(sourceFile,checker,registry) {
  const queries=[];
  function visit(node) {
    if(method(node)==='from') {
      const base=node.expression.expression;
      const table=literal(node.arguments[0]);
      if(ts.isCallExpression(base) && ts.isIdentifier(base.expression) && base.expression.text==='getSupabaseAdmin' && registry.has(table)) {
        const entry=registry.get(table),columns=entry.scopeColumns;
        let current=node,readScoped=false,writeScoped;
        while(ts.isPropertyAccessExpression(current.parent) && current.parent.expression===current
          && ts.isCallExpression(current.parent.parent) && current.parent.parent.expression===current.parent) {
          current=current.parent.parent;
          const name=method(current),args=current.arguments;
          if((name==='eq'||name==='in') && columns.includes(literal(args[0])))readScoped=true;
          if(name==='insert'||name==='upsert')writeScoped=writeHasScope(args[0],checker,columns);
        }
        queries.push({table,scoped:writeScoped ?? readScoped,start:node.getStart(sourceFile),expression:current.getText(sourceFile)});
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(sourceFile);
  return queries;
}
