import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='/private/tmp/letbuyy-original210-restore-bootstrap-prep-20261025-01';
const runner=readFileSync(root+'/scripts/governance/run-executable-suites.mjs','utf8');
const test=readFileSync(root+'/tests/governance/owned-preserved-restore-bootstrap.test.mjs','utf8');
function actual(source,name){const match=source.match(new RegExp('^(?:export )?(?:async )?function '+name+'\\([^]*?^\\}','m'));assert(match);return match[0].replace(/^export /,'');}
const reportFn=actual(test,'reportWorld');
const context=vm.createContext({assert,Buffer,Date,Set,Promise,dirname,resolve,join,vm,actual,runner,run:'abcdef123456',database:'letbuyy_exec_theme_completion_razorpay_browser_manual_ts',saved:{capsule:{application:{fixtureId:'49ada80bc494'}}}});
vm.runInContext(reportFn+'\nglobalThis.world=reportWorld;',context);
const w=context.world({suiteFailure:true,logWriteFailure:true,checkpointFailure:true});
const terminal=await w.run(),r=w.report();
assert.equal(terminal,71);assert(w.calls.includes('suite-spawn'));assert(w.calls.includes('checkpoint'));
assert.equal(r.results[0].primaryFailure.code,'ENOSPC');assert.equal(r.results[0].execution.suite,'PROCESS_COMPLETED');
assert.equal(r.results[0].tests,0);
const result={status:'ACTUAL_FUNCTION_RECORDING_COUNTEREXAMPLE_SUITE_PRIMARY_AND_TAP_ACCOUNTING_MASKED_BY_LOG_WRITE_FAILURE',runnerSourceSha256:createHash('sha256').update(runner).digest('hex'),input:{suiteProcessCode:1,logWriteFailure:'ENOSPC',checkpointFailure:'COMPLETE_DATA_WITNESS'},observed:{terminal,primaryFailure:r.results[0].primaryFailure,logFailure:r.results[0].logFailure,checkpointFailure:r.results[0].checkpointFailure,execution:r.results[0].execution,tests:r.results[0].tests,notExecutedSuites:r.notExecutedSuites},expected:'Retain PRESERVED_SUITE_FAILED as primary and original actual TAP accounting; record separate suite-log ENOSPC + checkpoint failure without discarding completed suite observations.',actualProcessesResourcesDbPrivateInputs:0};
writeFileSync('/private/tmp/themes-restore-diagnostics-counterexample01.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
