import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Load the actual app-owned pure transport module without mounting Next.
const source = readFileSync(new URL('../src/lib/theme-draft-client.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const exported = {};
new Function('exports', js)(exported);
const { ThemeDraftClient, ThemeDraftConflictError, ThemeDraftValidationError } = exported;
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const ack = version => ({ version, currentVersion: version, replayed: false, savedAt: '2026-10-16T12:00:00Z' });
let sequence = 0;
const key = () => `owned-intent-${++sequence}`;
const config = heading => ({ themeSettings: {}, sections: { template: [{ id: 'owned', heading }] } });

test('publication and reopening a published theme can seed an identical draft for private preview', async () => {
    const snapshot = config('Published heading'), calls = [];
    const send = async intent => { calls.push(structuredClone(intent)); return ack(intent.baseVersion + 1); };
    const client = new ThemeDraftClient(1, send, snapshot, true, key);
    await client.publish(async () => ack(2));
    assert.equal(client.hasDraft, false);
    await client.save(snapshot, undefined, true);
    assert.equal(client.hasDraft, true);
    assert.equal(calls[0].baseVersion, 2);
    const reopened = new ThemeDraftClient(7, send, snapshot, false, key);
    await reopened.save(snapshot, undefined, true);
    assert.equal(reopened.hasDraft, true);
    assert.equal(calls[1].baseVersion, 7);
});

test('autosave and manual save serialize exact bases instead of conflicting with themselves', async () => {
    const calls = [], a = deferred(), b = deferred();
    const client = new ThemeDraftClient(0, intent => { calls.push(structuredClone(intent)); return calls.length === 1 ? a.promise : b.promise; }, config('initial'), false, key);
    const first = client.save(config('first')), second = client.save(config('second'));
    await tick(); assert.equal(calls.length, 1); assert.equal(calls[0].baseVersion, 0);
    a.resolve(ack(1)); await first; await tick();
    assert.equal(calls[1].baseVersion, 1); assert.notEqual(calls[0].idempotencyKey, calls[1].idempotencyKey);
    b.resolve(ack(2)); await second; assert.equal(client.version, 2);
});

test('response-loss retries the immutable old intent before sending newer local edits', async () => {
    const calls = []; let attempt = 0;
    const client = new ThemeDraftClient(0, async intent => {
        calls.push(structuredClone(intent)); if (++attempt === 1) throw new Error('Synthetic response loss');
        return ack(attempt - 1);
    }, config('initial'), false, key);
    const input = config('first'); const save = client.save(input); input.sections.template[0].heading = 'mutated';
    await assert.rejects(save, /response loss/);
    await client.save(config('newer'));
    assert.deepEqual(calls[0], calls[1]); assert.equal(calls[0].draftConfig.sections.template[0].heading, 'first');
    assert.equal(calls[2].baseVersion, 1); assert.notEqual(calls[1].idempotencyKey, calls[2].idempotencyKey);
    assert.equal(client.version, 2);
});

test('stale receipt pauses saves; explicit reviewed revision still conflicts if another session wins', async () => {
    const calls = [];
    let replacementConflicts = true;
    const client = new ThemeDraftClient(0, async intent => {
        calls.push(structuredClone(intent));
        if (calls.length === 1) return { ...ack(1), currentVersion: 2 };
        if (replacementConflicts) throw new ThemeDraftConflictError();
        return ack(intent.baseVersion + 1);
    }, config('initial'), false, key);
    await assert.rejects(client.save(config('local')), ThemeDraftConflictError);
    await assert.rejects(client.save(config('newer')), ThemeDraftConflictError); assert.equal(calls.length, 1);
    await assert.rejects(client.save(config('local'), 2), ThemeDraftConflictError); assert.equal(client.paused, true);
    replacementConflicts = false;
    await client.save(config('local'), 3); assert.equal(calls.at(-1).baseVersion, 3); assert.equal(client.version, 4);
});

test('publication recovery preserves the accepted key/base and cannot publish newer dirty edits', async () => {
    const saves = [], publications = [];
    const client = new ThemeDraftClient(0, async intent => { saves.push(structuredClone(intent)); return ack(intent.baseVersion + 1); }, config('initial'), false, key);
    const saved = config('saved'); await client.save(saved);
    let attempt = 0;
    const publish = async intent => { publications.push(structuredClone(intent)); if (++attempt === 1) throw new Error('Synthetic publish response loss'); return ack(2); };
    await assert.rejects(client.publish(publish), /response loss/);
    await assert.rejects(client.save(config('new dirty edits')), /previous publication/);
    await client.publish(async () => { throw new Error('Must reuse the accepted intent transport'); });
    assert.deepEqual(publications[0], publications[1]); assert.equal(publications[0].baseVersion, 1);
    assert.equal(saves.length, 1); assert.equal(client.hasDraft, false);
    await client.save(saved); assert.equal(saves.length, 1, 'unchanged published content must not recreate a draft');
    await client.save(config('new dirty edits')); assert.equal(saves[1].baseVersion, 2);
});

test('disposed editor cannot adopt a late acknowledgement or send queued work', async () => {
    const pending = deferred(), calls = [];
    const client = new ThemeDraftClient(0, intent => { calls.push(intent); return pending.promise; }, config('initial'), false, key);
    const first = client.save(config('old')), second = client.save(config('queued'));
    const oldResult = assert.rejects(first, /loaded editor changed/), queuedResult = assert.rejects(second, /loaded editor changed/);
    await tick(); client.dispose(); pending.resolve(ack(1)); await oldResult; await queuedResult;
    assert.equal(calls.length, 1); assert.equal(client.version, 0);
});

test('malformed/future acknowledgement cannot invent a confirmed save or discard its retry key', async () => {
    const calls = []; let valid = false;
    const client = new ThemeDraftClient(0, async intent => { calls.push(structuredClone(intent)); return valid ? ack(1) : ack(99); }, config('initial'), false, key);
    await assert.rejects(client.save(config('owned')), /No confirmed draft receipt/); assert.equal(client.version, 0);
    valid = true; await client.save(config('owned')); assert.deepEqual(calls[0], calls[1]);
});


test('a definitive validation rejection allows corrected local edits while ambiguous failures retain their intent', async () => {
    const calls = []; let attempt = 0;
    const client = new ThemeDraftClient(0, async intent => {
        calls.push(structuredClone(intent));
        if (++attempt === 1) throw new ThemeDraftValidationError('Correct the field');
        return ack(intent.baseVersion + 1);
    }, config('initial'), false, key);
    await assert.rejects(client.save(config('invalid')), ThemeDraftValidationError);
    assert.equal(client.version, 0);
    await client.save(config('corrected'));
    assert.equal(calls[1].baseVersion, 0); assert.notEqual(calls[0].idempotencyKey, calls[1].idempotencyKey);
    await assert.rejects(client.publish(async () => { throw new ThemeDraftValidationError('Correct saved values'); }), ThemeDraftValidationError);
    assert.equal(client.hasPendingPublication, false);
    await client.save(config('corrected again'));
    assert.equal(client.version, 2);
});


function recoveryStore() {
    const entries = new Map();
    return {entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key,value), removeItem: key => entries.delete(key)};
}
const recoveryClient = (version, store, actor = 'actor-a', scope = `${actor}:store-a:modern:index`) => new ThemeDraftClient(version, async intent => ack(intent.baseVersion + 1), config('canonical saved content'), true, key, actor, 'store-a', {scope, storage:store});

test('publication reload recovers exact metadata with a new transport and preserves newer canonical draft', async () => {
    const store=recoveryStore(), calls=[];
    const first=recoveryClient(1,store);
    await assert.rejects(first.publish(async intent=>{calls.push(structuredClone(intent));throw new Error('Reply lost after commit');}),/Reply lost/);
    assert.equal(store.entries.size,1);
    const raw=[...store.entries.values()][0];
    assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['actorId','baseVersion','idempotencyKey','scope','storeId','version']);
    assert.doesNotMatch(raw,/canonical saved content|draftConfig|cookie|token/);
    first.dispose();
    const restored=recoveryClient(3,store);
    assert.equal(restored.hasPendingPublication,true);
    await assert.rejects(restored.save(config('new local edit')),/previous publication/);
    const confirmed=await restored.publish(async intent=>{calls.push(structuredClone(intent));return {...ack(2),currentVersion:3,replayed:true};});
    assert.deepEqual(calls[1],calls[0]);assert.equal(confirmed.version,2);
    assert.equal(restored.version,3);assert.equal(restored.hasDraft,true);assert.equal(restored.paused,true);
    assert.equal(restored.hasPendingPublication,false);assert.equal(store.entries.size,0);
    await assert.rejects(restored.save(config('new local edit')),ThemeDraftConflictError);
});

test('publication metadata is actor/template scoped and authorization failures retain the original intent', async () => {
    const store=recoveryStore(), old=recoveryClient(1,store), calls=[];
    await assert.rejects(old.publish(async intent=>{calls.push(structuredClone(intent));throw new Error('403 account changed');}),/403/);
    const other=recoveryClient(1,store,'actor-b');assert.equal(other.hasPendingPublication,false);
    const otherTemplate=recoveryClient(1,store,'actor-a','actor-a:store-a:modern:product');assert.equal(otherTemplate.hasPendingPublication,false);
    const restored=recoveryClient(1,store);assert.equal(restored.hasPendingPublication,true);
    await restored.publish(async intent=>{calls.push(structuredClone(intent));return ack(2);});
    assert.deepEqual(calls[0],calls[1]);assert.equal(restored.hasDraft,false);
});

test('unavailable or malformed durable publication metadata prevents a new request', async () => {
    let calls=0;
    const unavailable={getItem:()=>null,setItem:()=>{throw new Error('Storage full');},removeItem:()=>{}};
    const client=recoveryClient(1,unavailable);
    await assert.rejects(client.publish(async()=>{calls++;return ack(2);}),/Storage full/);
    assert.equal(calls,0);
    const store=recoveryStore();store.entries.set('letbuyy:theme-publication:v1:actor-a:store-a:modern:index',JSON.stringify({baseVersion:1}));
    const invalid=recoveryClient(1,store);
    await assert.rejects(invalid.publish(async()=>{calls++;return ack(2);}),/metadata could not be confirmed/);
    assert.equal(calls,0);assert.equal(store.entries.size,1);
});

test('a future or regressed publication receipt retains its exact retry metadata across reload', async () => {
    const store=recoveryStore(), client=recoveryClient(3,store), calls=[];
    await assert.rejects(client.publish(async intent=>{calls.push(structuredClone(intent));return {...ack(9),currentVersion:9};}),/No confirmed publication receipt/);
    client.dispose();const restored=recoveryClient(3,store);assert.equal(restored.hasPendingPublication,true);
    await restored.publish(async intent=>{calls.push(structuredClone(intent));return ack(4);});
    assert.deepEqual(calls[0],calls[1]);assert.equal(store.entries.size,0);
});


test('the actual loaded editor scope and save guard agree while actor/store/template navigation remains pinned',()=>{
    const page=ts.createSourceFile('page.tsx',readFileSync(new URL('../src/app/[store]/online-store/themes/[themeId]/editor/page.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    let loadedScope, capturedScope, saveGuard;
    const walk=node=>{
        if(ts.isVariableDeclaration(node)&&node.name.getText(page)==='editorScope') loadedScope=node.initializer.getText(page);
        if(ts.isBinaryExpression(node)&&node.left.getText(page)==='draftClientScopeRef.current'&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken) capturedScope=node.right.getText(page);
        if(ts.isVariableDeclaration(node)&&node.name.getText(page)==='saveDraft') {
            const callback=node.initializer.arguments[0];
            saveGuard=callback.body.statements.find(statement=>ts.isIfStatement(statement)).expression.getText(page);
        }
        ts.forEachChild(node,walk);
    };walk(page);assert.ok(loadedScope&&capturedScope&&saveGuard);
    const context={loadedActorId:'actor-a',loadedStoreId:'store-a-uuid',store:'store-a-handle',themeId:'modern',nextTemplateKey:'index',selectedTemplateKey:'index'};
    const evaluate=(expression,bindings)=>new Function(...Object.keys(bindings),'return ('+expression+');')(...Object.values(bindings));
    const editorScope=evaluate(loadedScope,context);
    const ref={current:evaluate(capturedScope,{...context,editorScope})};
    const client={actorId:context.loadedActorId,storeId:context.loadedStoreId};
    const gate=bindings=>evaluate(saveGuard,{...context,client,draftClientScopeRef:ref,...bindings});
    assert.equal(gate({}),false,'a normally loaded matching editor can actually save');
    assert.equal(gate({store:'different-handle'}),true);assert.equal(gate({selectedTemplateKey:'product'}),true);
    assert.equal(gate({client:{...client,actorId:'actor-b'}}),true);assert.equal(gate({client:{...client,storeId:'other-store-uuid'}}),true);
});

test('the actual publish handler does not mark a replayed historical release current after a rollback',async()=>{
    const page=ts.createSourceFile('page.tsx',readFileSync(new URL('../src/app/[store]/online-store/themes/[themeId]/editor/page.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    let callback;const walk=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(page)==='handlePublish')callback=node.initializer.arguments[0].getText(page);ts.forEachChild(node,walk);};walk(page);assert.ok(callback);
    const snapshot={}, state={current:3,notifications:[]};let client;
    client={hasPendingPublication:true,actorId:'actor-a',storeId:'store-a',publish:send=>send({baseVersion:1,idempotencyKey:'original-publication-key'})};
    const bindings={store:'store-a-handle',themeId:'modern',isPublishing:false,isDirty:false,savedState:snapshot,selectedTemplateKey:'index',selectedTemplate:{label:'Homepage'},currentReleaseVersion:3,
        draftClientRef:{current:client},latestEditorState:{current:snapshot},setIsPublishing:()=>{},setDraftVersion:()=>{},setReplacementVersion:()=>{},setHasConflict:()=>{},setConflictSource:()=>{},setSavedAt:()=>{},setPreviewToken:()=>{},setIsDirty:()=>{},setHistory:()=>{},
        setCurrentReleaseVersion:value=>{state.current=value;},loadReleases:async()=>{},notify:value=>state.notifications.push(value),
        asRecord:value=>value&&typeof value==='object'?value:{},stringValue:(value,fallback)=>typeof value==='string'?value:fallback,ThemeDraftConflictError,ThemeDraftValidationError,
        fetch:async()=>Response.json({version:2,currentVersion:2,replayed:true,release:{release_id:'historical-release',release_version:2}})};
    const js=ts.transpileModule('const action = '+callback+'; return action;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const action=new Function(...Object.keys(bindings),js)(...Object.values(bindings));await action();
    assert.equal(state.current,3,'a historical receipt cannot overwrite the newer known current release');
    assert.equal(state.notifications.length,1);assert.doesNotMatch(state.notifications[0].description,/now included in the live|previously saved version is live/);
});


function actualReleaseReader() {
    const page=ts.createSourceFile('page.tsx',readFileSync(new URL('../src/app/[store]/online-store/themes/[themeId]/editor/page.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const helpers=[];let callback;
    const walk=node=>{
        if(ts.isFunctionDeclaration(node)&&['releaseVersion','currentReleaseVersionFromRows'].includes(node.name?.text))helpers.push(node.getText(page));
        if(ts.isVariableDeclaration(node)&&node.name.getText(page)==='loadReleases')callback=node.initializer.arguments[0].getText(page);
        ts.forEachChild(node,walk);
    };walk(page);assert.equal(helpers.length,2);assert.ok(callback);
    const javascript=ts.transpileModule(helpers.join('\n')+';return currentReleaseVersionFromRows;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const current=new Function(javascript)();
    const create=bindings=>new Function(...Object.keys(bindings),ts.transpileModule('const action = '+callback+';return action;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(bindings));
    return {current,create};
}
test('the actual current-release mapper uses one valid published current row and never guesses the highest revision',()=>{
    const {current}=actualReleaseReader();
    const row=(version,flag,status='published')=>({release_version:version,is_current:flag,release_status:status});
    assert.equal(current([row(2,false,'superseded'),row(3,true),row(9,false,'superseded')]),3);
    for(const rows of [[row(3,true),row(4,true)],[row(4,false)],[row(4,true,'superseded')],[row(0,true)],[row(2.5,true)],[{is_current:true,release_status:'published'}]])assert.equal(current(rows),null);
});
test('actual release reads cannot cross editor scope or overwrite a newer read, and a failed fresh read removes the current badge',async()=>{
    const {current,create}=actualReleaseReader(), first=deferred(), second=deferred(), state={rows:[],current:1};let requests=0;
    const scope={current:'actor-a:store-a'},generation={current:1},requestCounter={current:0};
    const bindings={store:'store-a',themeId:'modern',draftClientScopeRef:scope,loadRequestCounter:generation,releaseRequestCounter:requestCounter,
        fetch:()=>++requests===1?first.promise:second.promise,asRecord:value=>value&&typeof value==='object'?value:{},currentReleaseVersionFromRows:current,
        setReleases:value=>{state.rows=value;},setCurrentReleaseVersion:value=>{state.current=value;}};
    const action=create(bindings), older=action(), newer=action();
    second.resolve(Response.json({data:[{release_version:3,is_current:true,release_status:'published'}]}));await newer;
    first.resolve(Response.json({data:[{release_version:1,is_current:true,release_status:'published'}]}));await older;assert.equal(state.current,3);
    const late=deferred();bindings.fetch=()=>late.promise;const oldScope=create(bindings)();scope.current='actor-b:store-b';generation.current++;
    late.resolve(Response.json({data:[{release_version:99,is_current:true,release_status:'published'}]}));await oldScope;assert.equal(state.current,3);
    bindings.fetch=async()=>Response.json({error:'Unconfirmed current state'},{status:503});await create(bindings)();
    assert.deepEqual(state.rows,[]);assert.equal(state.current,null);
});


test('missing or impossible publication replay metadata retains the same recoverable intent',async()=>{
    const store=recoveryStore(), client=recoveryClient(1,store), calls=[];
    await assert.rejects(client.publish(async intent=>{calls.push(structuredClone(intent));return {...ack(2),replayed:undefined};}),/No confirmed publication receipt/);
    assert.equal(client.hasPendingPublication,true);assert.equal(store.entries.size,1);
    // In-memory recovery keeps the original transport, so fix the controlled
    // transport through a fresh editor instance using the exact durable key.
    client.dispose();const next=recoveryClient(1,store);
    await assert.rejects(next.publish(async intent=>{calls.push(structuredClone(intent));return {...ack(2),currentVersion:3,replayed:false};}),/No confirmed publication receipt/);
    next.dispose();const final=recoveryClient(3,store);
    await final.publish(async intent=>{calls.push(structuredClone(intent));return {...ack(2),currentVersion:3,replayed:true};});
    assert.deepEqual(calls[0],calls[1]);assert.deepEqual(calls[1],calls[2]);assert.equal(store.entries.size,0);assert.equal(final.hasDraft,true);
});
