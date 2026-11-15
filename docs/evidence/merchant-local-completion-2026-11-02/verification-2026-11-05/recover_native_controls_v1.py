"""Recover task controller TEXT from this chat; never execute historical code.
A bounded AST interpreter permits literal/string/virtual-file construction only.
It cannot run shell commands, import modules from history, or read actual files.
Recovered controls are candidates for a new run, never old acceptance evidence.
"""
from pathlib import Path, PurePosixPath
import ast,json,re,operator,hashlib
E=Path(__file__).resolve().parent
SESSION=Path('/Users/saai_mithra/.codex/sessions/2026/10/29/rollout-2026-10-29T23-57-05-01a188ea-66d5-7141-ae2a-832ccdec4603.jsonl')
PREFIX='/private/tmp/letbuyy-merchant-local-20261102-br1jhgh8/'
files={};missing=set();unsupported={};commands=0

class Unknown(Exception): pass
class VP:
    def __init__(self,p): self.p=str(p)
    def __str__(self): return self.p
    def __truediv__(self,s): return VP(self.p.rstrip('/')+'/'+str(s))
class Bound:
    def __init__(self,value,name):self.value=value;self.name=name
class FN:
    def __init__(self,name):self.name=name
def bind(target,value,env):
    if isinstance(target,ast.Name):env[target.id]=value
    elif isinstance(target,(ast.Tuple,ast.List)):
        if len(target.elts)!=len(value):raise Unknown()
        for t,v in zip(target.elts,value):bind(t,v,env)
    elif isinstance(target,ast.Subscript):expr(target.value,env)[expr(target.slice,env)]=value
    else:raise Unknown()
def invoke(fn,args,kwargs):
    if isinstance(fn,FN):
        if fn.name=='Path':return VP(args[0])
        if fn.name in ('str','len','list','dict','tuple','range','enumerate','sorted','int','bool'):
            funcs={'str':str,'len':len,'list':list,'dict':dict,'tuple':tuple,'range':range,'enumerate':enumerate,'sorted':sorted,'int':int,'bool':bool}
            value=funcs[fn.name](*args,**kwargs)
            if isinstance(value,range)and len(value)>1000:raise Unknown()
            return value
        if fn.name in ('print','compile'):return None
        if fn.name=='json.loads':return json.loads(*args,**kwargs)
        if fn.name=='json.dumps':return json.dumps(*args,**kwargs)
        if fn.name=='Path.cwd':return VP('/virtual-repository')
        raise Unknown()
    if not isinstance(fn,Bound):raise Unknown()
    obj,name=fn.value,fn.name
    if isinstance(obj,VP):
        p=obj.p
        if name in ('mkdir','chmod','resolve','absolute'):
            return obj if name in ('resolve','absolute') else None
        if not p.startswith(PREFIX):raise Unknown()
        if name=='read_text':
            if p not in files:missing.add(p);raise Unknown()
            return files[p]
        if name=='read_bytes':
            if p not in files:missing.add(p);raise Unknown()
            return files[p].encode()
        if name=='write_text':
            if not isinstance(args[0],str)or len(args[0])>2_000_000:raise Unknown()
            files[p]=args[0];return len(args[0])
        if name=='write_bytes':
            if not isinstance(args[0],bytes):raise Unknown()
            files[p]=args[0].decode();return len(args[0])
        if name=='exists':return p in files
        if name=='unlink':files.pop(p,None);return None
        raise Unknown()
    allowed={str:{'replace','index','find','count','split','splitlines','join','strip','lstrip','rstrip','startswith','endswith','format','encode'},
             bytes:{'decode'},list:{'append','extend','insert','copy'},dict:{'get','items','keys','values','copy','update'}}
    if type(obj)not in allowed or name not in allowed[type(obj)]:raise Unknown()
    return getattr(obj,name)(*args,**kwargs)
def expr(node,env):
    if isinstance(node,ast.Constant):return node.value
    if isinstance(node,ast.Name):
        if node.id not in env:raise Unknown()
        return env[node.id]
    if isinstance(node,ast.List):return [expr(x,env)for x in node.elts]
    if isinstance(node,ast.Tuple):return tuple(expr(x,env)for x in node.elts)
    if isinstance(node,ast.Dict):
        out={}
        for k,v in zip(node.keys,node.values):
            if k is None:out.update(expr(v,env))
            else:out[expr(k,env)]=expr(v,env)
        return out
    if isinstance(node,ast.Attribute):
        if node.attr.startswith('_'):raise Unknown()
        obj=expr(node.value,env)
        if isinstance(obj,FN):
            if obj.name=='json'and node.attr in ('loads','dumps'):return FN('json.'+node.attr)
            if obj.name=='Path'and node.attr=='cwd':return FN('Path.cwd')
            raise Unknown()
        if isinstance(obj,VP):
            if node.attr=='parent':return VP(str(PurePosixPath(obj.p).parent))
            if node.attr=='name':return PurePosixPath(obj.p).name
        return Bound(obj,node.attr)
    if isinstance(node,ast.Call):
        if any(isinstance(a,ast.Starred)for a in node.args)or any(k.arg is None for k in node.keywords):raise Unknown()
        return invoke(expr(node.func,env),[expr(a,env)for a in node.args],{k.arg:expr(k.value,env)for k in node.keywords})
    if isinstance(node,ast.Subscript):return expr(node.value,env)[expr(node.slice,env)]
    if isinstance(node,ast.Slice):return slice(expr(node.lower,env)if node.lower else None,expr(node.upper,env)if node.upper else None,expr(node.step,env)if node.step else None)
    if isinstance(node,ast.BinOp):
        a,b=expr(node.left,env),expr(node.right,env)
        fn={ast.Add:operator.add,ast.Mult:operator.mul,ast.Div:operator.truediv,ast.Mod:operator.mod,ast.Sub:operator.sub}.get(type(node.op))
        if fn is None:raise Unknown()
        if isinstance(node.op,ast.Mult)and isinstance(b,int)and abs(b)>10000:raise Unknown()
        return fn(a,b)
    if isinstance(node,ast.UnaryOp):
        v=expr(node.operand,env)
        if isinstance(node.op,ast.Not):return not v
        if isinstance(node.op,ast.USub):return -v
        raise Unknown()
    if isinstance(node,ast.Compare):
        a=expr(node.left,env)
        funcs={ast.Eq:operator.eq,ast.NotEq:operator.ne,ast.Lt:operator.lt,ast.Gt:operator.gt,ast.LtE:operator.le,ast.GtE:operator.ge,
               ast.In:lambda a,b:a in b,ast.NotIn:lambda a,b:a not in b,ast.Is:operator.is_,ast.IsNot:operator.is_not}
        for op,v in zip(node.ops,node.comparators):
            b=expr(v,env)
            if type(op)not in funcs or not funcs[type(op)](a,b):return False
            a=b
        return True
    if isinstance(node,ast.BoolOp):
        if isinstance(node.op,ast.And):
            for value in node.values:
                out=expr(value,env)
                if not out:return out
        else:
            for value in node.values:
                out=expr(value,env)
                if out:return out
        return out
    if isinstance(node,ast.IfExp):return expr(node.body if expr(node.test,env)else node.orelse,env)
    if isinstance(node,ast.JoinedStr):
        parts=[]
        for v in node.values:
            if isinstance(v,ast.Constant):parts.append(v.value)
            elif isinstance(v,ast.FormattedValue)and v.format_spec is None:parts.append(str(expr(v.value,env)))
            else:raise Unknown()
        return ''.join(parts)
    raise Unknown()
def statements(nodes,env):
    for node in nodes:
        try:
            if isinstance(node,(ast.Import,ast.ImportFrom,ast.FunctionDef,ast.ClassDef)):continue
            if isinstance(node,ast.Assign):
                value=expr(node.value,env)
                for target in node.targets:bind(target,value,env)
            elif isinstance(node,ast.AugAssign):
                value=expr(node.target,env)+expr(node.value,env);bind(node.target,value,env)
            elif isinstance(node,ast.Expr):expr(node.value,env)
            elif isinstance(node,ast.If):statements(node.body if expr(node.test,env)else node.orelse,env)
            elif isinstance(node,ast.For):
                values=list(expr(node.iter,env))
                if len(values)>1000:raise Unknown()
                for value in values:bind(node.target,value,env);statements(node.body,env)
            elif isinstance(node,ast.Assert):
                if not expr(node.test,env):return
            else:raise Unknown()
        except Exception:
            if isinstance(node,ast.Assign):
                for target in node.targets:
                    if isinstance(target,ast.Name):env.pop(target.id,None)
def process(command):
    global commands
    commands+=1;lines=command.splitlines(keepends=True);i=0
    while i<len(lines):
        match=re.fullmatch(r"(python3 -|cat\s+(>>|>)\s+(\S+))\s+<<'?(\w+)'?\s*\n?",lines[i])
        if not match:i+=1;continue
        delimiter=match.group(4);start=i+1;i=start
        while i<len(lines)and lines[i].strip()!=delimiter:i+=1
        body=''.join(lines[start:i]);i+=1
        if match.group(1)=='python3 -':
            env={name:FN(name)for name in ['Path','json','str','len','list','dict','tuple','range','enumerate','sorted','int','bool','print','compile']}
            try:statements(ast.parse(body).body,env)
            except Exception:pass
        else:
            p=match.group(3).strip("'\"")
            if p.startswith(PREFIX):
                files[p]=(files.get(p,'')if match.group(2)=='>>'else'')+body
for line in SESSION.open():
    if PREFIX not in line or '"custom_tool_call"'not in line:continue
    try:payload=json.loads(line)['payload']
    except Exception:continue
    if payload.get('type')!='custom_tool_call':continue
    for m in re.finditer(r'\bcmd\s*:\s*("(?:\\.|[^"\\])*")',payload.get('input','')):
        try:command=json.loads(m.group(1))
        except Exception:continue
        if PREFIX in command:process(command)
targets=['android-native-auto-v15.py','android-warehouse-auto-v31.py','android-warehouse-auto-v38.py','run-warehouse-v38.py']
out=E/'recovered-native-controls';out.mkdir(exist_ok=True)
report={'scope':'Statically reconstructed candidate controller text only; no historical code execution, no restored credentials/receipts and no native acceptance. Requires fresh ownership, inspection and input pinning before use.','commands_parsed':commands,'recovered':[],'missing':[]}
for name in targets:
    content=files.get(PREFIX+name)
    if content is None:report['missing'].append(name);continue
    if '@gmail.com'in content or 'Saai@'in content:raise RuntimeError('Private account literal must not be exported')
    try:compile(content,name,'exec')
    except SyntaxError:report['missing'].append(name+' (incomplete syntax)');continue
    (out/name).write_text(content)
    report['recovered'].append({'name':name,'bytes':len(content.encode()),'sha256':hashlib.sha256(content.encode()).hexdigest()})
report['unresolved_script_inputs']=sorted({Path(p).name for p in missing if p.endswith('.py')})[:40]
(E/'native-control-recovery.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
