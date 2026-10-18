import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.createSourceFile('panel.tsx',readFileSync(new URL('../src/components/theme-editor/ThemeUpdatePanel.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const helper=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='parseRollbackIntent');assert.ok(helper);
const js=ts.transpileModule(helper.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const parse=new Function(js+';return parseRollbackIntent;')();
const metadata={actorId:'actor-a',storeId:'store-a',themeSlug:'modern',targetReleaseId:'11111111-1111-4111-8111-111111111111',targetVersion:3,expectedCurrentReleaseId:'22222222-2222-4222-8222-222222222222',idempotencyKey:'33333333-3333-4333-8333-333333333333'};
const read=value=>parse(JSON.stringify(value),'actor-a','store-a','modern');
test('actual rollback recovery parser retains only exact frozen reviewed intent metadata',()=>{
    const restored=read(metadata);assert.deepEqual(restored,metadata);assert.equal(Object.isFrozen(restored),true);assert.equal(parse(null,'actor-a','store-a','modern'),null);
});
test('unreadable or mismatched rollback metadata blocks a replacement intent',()=>{
    assert.throws(()=>parse('{broken','actor-a','store-a','modern'));
    for(const value of [null,[],{}, {...metadata,actorId:'actor-b'}, {...metadata,storeId:'store-b'}, {...metadata,themeSlug:'different'}, {...metadata,targetReleaseId:metadata.expectedCurrentReleaseId}, {...metadata,idempotencyKey:'------------------------------------'}, {...metadata,targetVersion:0}, {...metadata,targetVersion:3.5}, {...metadata,sessionToken:'must not persist'}, {...metadata,draftConfig:{raw:'content'}}]) assert.throws(()=>read(value));
});
