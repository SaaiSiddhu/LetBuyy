// Pure projection and refusal parsing; complete authentication/DB behavior belongs to owned fixtures.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseConsoleCurrentOncall } from '../execution/console-current-oncall-execution.adapter';
import { AppError } from '../lib/errors';
const schedule = { id:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', team_name:'Synthetic ops', rotation_name:'Weekday', primary_employee_id:null, paging_adapter:'dry_run' };
const unavailable = (error: unknown) => error instanceof AppError && error.statusCode===503 && !/private-marker/.test(error.message);
test('only the five current rotation display fields are accepted',()=>{assert.deepEqual(parseConsoleCurrentOncall({accepted:true,schedule}),schedule);});
test('known null is an explicit successful empty result',()=>{assert.equal(parseConsoleCurrentOncall({accepted:true,schedule:null}),null);});
test('an absent or malformed schedule cannot become a successful empty state',()=>{for(const value of [{accepted:true},{accepted:true,schedule:[]},{accepted:true,schedule:''}])assert.throws(()=>parseConsoleCurrentOncall(value),unavailable);});
test('extra private schedule or envelope fields are refused rather than exposed',()=>{for(const value of [{accepted:true,schedule:{...schedule,metadata:{private:'private-marker'}}},{accepted:true,schedule,session_id:'private-marker'}])assert.throws(()=>parseConsoleCurrentOncall(value),unavailable);});
test('invalid identifiers, empty labels and invented provider modes are unavailable',()=>{for(const change of [{id:'private-marker'},{primary_employee_id:'private-marker'},{team_name:''},{paging_adapter:'delivered'}])assert.throws(()=>parseConsoleCurrentOncall({accepted:true,schedule:{...schedule,...change}}),unavailable);});
test('canonical refusal keeps its current authority status without accepting caller data',()=>{assert.throws(()=>parseConsoleCurrentOncall({accepted:false,code:'PERMISSION_CHANGED',schedule}),error=>error instanceof AppError&&error.statusCode===403&&error.code==='PERMISSION_CHANGED');});
