// Non-emitting compiler inspection only. Never executes the probe or Worker.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo='/Volumes/Projects/LetBuyy',root='/private/tmp/letbuyy-circuit-performance-native-source-20261025-01';
const ts=require(repo+'/node_modules/typescript');
const closure=JSON.parse(fs.readFileSync(path.join(__dirname,'SOURCE_CLOSURE.json'),'utf8'));
const output=path.join(__dirname,'SOURCE_TYPES.json');if(fs.existsSync(output))throw Error('Preserve old type results');
const names=[closure.suitePath,closure.probePath,'services/api-gateway/src/__tests__/owned-db/plan-parser.ts'];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pins=()=>names.map(name=>({path:name,sha256:sha(root+'/'+name)}));const before=pins();
const configPath=root+'/services/api-gateway/tsconfig.json',config=ts.readConfigFile(configPath,ts.sys.readFile);if(config.error)throw Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,path.dirname(configPath));
const nodeTypes=closure.installedVendorPackages.find(pkg=>pkg.name==='@types/node');if(!nodeTypes)throw Error('Actual Node type library not captured');
const options={...parsed.options,noEmit:true,incremental:false,composite:false,strict:true,skipLibCheck:true,types:[...new Set([...(parsed.options.types||[]),'node'])],typeRoots:[path.dirname(nodeTypes.root),root+'/services/api-gateway/node_modules',root+'/node_modules',root+'/node_modules/.pnpm/node_modules']};
const host=ts.createCompilerHost(options);host.writeFile=()=>{throw Error('Emission forbidden');};
const program=ts.createProgram(names.map(name=>root+'/'+name),options,host),all=ts.getPreEmitDiagnostics(program),scoped=all.filter(d=>!d.file||names.includes(path.relative(root,d.file.fileName)));
const details=list=>list.map(d=>({file:d.file?.fileName,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
const syntax=[];for(const name of names){const r=ts.transpileModule(fs.readFileSync(root+'/'+name,'utf8'),{fileName:name,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});syntax.push(...details(r.diagnostics||[]));}
const after=pins();require('node:assert/strict').deepEqual(before,after);
const report={recordedAt:new Date().toISOString(),status:scoped.length||syntax.length?'SOURCE_TYPE_CHECK_FAILED':'STRICT_SOURCE_LEAVES_AND_SYNTAX_PASS_NOT_NATIVE_PROBE',sourceRoot:root,roots:names,inputPinsBefore:before,inputPinsAfter:after,compilerVersion:ts.version,programSourceFiles:program.getSourceFiles().length,scopedDiagnostics:details(scoped),otherDependencyDiagnostics:all.length-scoped.length,otherDependencyDiagnosticSample:details(all.filter(d=>d.file&&!names.includes(path.relative(root,d.file.fileName))).slice(0,3)),syntaxDiagnostics:syntax,sourceFilesInspectedNotExecuted:true,nativeDockerDatabaseModuleProbeBuildBrowserProviderActions:0};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({status:report.status,sourceFiles:report.programSourceFiles,scopedDiagnostics:report.scopedDiagnostics,otherDependencyDiagnostics:report.otherDependencyDiagnostics,syntaxDiagnostics:syntax,nativeExecuted:false})+'\n');if(scoped.length||syntax.length)process.exitCode=1;
