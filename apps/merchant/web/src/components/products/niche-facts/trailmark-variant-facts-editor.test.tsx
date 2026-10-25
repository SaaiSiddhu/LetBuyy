import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { SportsFactsSchema, SportsVariantFactsSchema, resolveSportsMeasurements } from '@letbuyy/commerce-core';
import { TrailmarkVariantFactsEditor } from './trailmark-variant-facts-editor';
const requireUI=createRequire(new URL('../../../../../../../packages/typescript/ui/package.json',import.meta.url));
const {JSDOM}=requireUI('jsdom') as {JSDOM:new(html:string,options:{url:string})=>{window:Window&typeof globalThis}};
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
const common=SportsFactsSchema.parse({activity:'Badminton',equipmentType:'racket',length:{value:68,unit:'cm'},weight:{value:88,unit:'g'},dimensions:{length:72,width:24,unit:'cm'}});

async function mount(initial:unknown=null,commonFacts:unknown=common,disabled=false){
    const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://merchant.example.test/alpha/products/edit'});
    const names=['window','document','navigator','HTMLElement','Element','MutationObserver'] as const;
    const previous=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
    for(const name of names)Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name]});
    const {createRoot}=await import('react-dom/client');const container=dom.window.document.getElementById('root')!;const root=createRoot(container);
    let latest:unknown=initial;let changes=0;let submissions=0;
    function Harness({shared}:{shared:unknown}){const[value,setValue]=React.useState(initial);return <form onSubmit={event=>{event.preventDefault();submissions++;}}><TrailmarkVariantFactsEditor value={value} commonFacts={shared} disabled={disabled} onChange={next=>{latest=next;changes++;setValue(next);}}/></form>;}
    const renderCommon=async(shared:unknown)=>{await act(async()=>root.render(<Harness shared={shared}/>));};await renderCommon(commonFacts);
    const button=(label:string)=>{const found=[...container.querySelectorAll('button')].find(element=>element.textContent?.trim()===label);assert.ok(found,'Missing button: '+label);return found;};
    const control=(label:string)=>{const element=[...container.querySelectorAll('label')].find(element=>element.textContent?.trim()===label);assert.ok(element,'Missing label: '+label);const found=container.ownerDocument.getElementById(element.htmlFor);assert.ok(found);return found as HTMLInputElement|HTMLSelectElement;};
    const click=async(label:string)=>{await act(async()=>button(label).click());};
    const set=async(label:string,value:string)=>{const element=control(label);await act(async()=>{const prototype=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,value);element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
    const close=async()=>{await act(async()=>root.unmount());dom.window.close();for(const name of names){if(previous[name])Object.defineProperty(globalThis,name,previous[name]!);else Reflect.deleteProperty(globalThis,name);}};
    return{container,button,control,click,set,close,renderCommon,get value(){return latest;},get changes(){return changes;},get submissions(){return submissions;}};
}

test('absent overrides stay absent and common values are read-only; edited payload contains measurements only',async()=>{
    const h=await mount();try{
        assert.equal(h.value,null);assert.equal(h.changes,0);assert.equal(h.container.querySelectorAll('input,select').length,0);
        assert.match(h.container.textContent!,/Common product overall length: 68 cm/);assert.match(h.container.textContent!,/Common product dimensions: 72 × 24 cm/);
        await h.click('Override grip circumference');assert.deepEqual(h.value,{gripCircumference:{}});assert.equal(SportsVariantFactsSchema.safeParse(h.value).success,false);
        await h.set('Variant grip circumference value','84');await h.set('Variant grip circumference unit','mm');
        const facts=SportsVariantFactsSchema.parse(h.value);assert.deepEqual(facts,{gripCircumference:{value:84,unit:'mm'}});
        assert.deepEqual(resolveSportsMeasurements(common,facts),{length:common.length,weight:common.weight,gripCircumference:{value:84,unit:'mm'},dimensions:common.dimensions});
        assert.equal(Object.hasOwn(facts,'id'),false);assert.equal(Object.hasOwn(facts,'size'),false);assert.equal(h.submissions,0);
    }finally{await h.close();}
});

test('value and unit form one explicit override; partial numbers remain editable and last removal inherits common',async()=>{
    const h=await mount();try{
        await h.click('Override overall length');await h.set('Variant overall length value','-');
        assert.equal(h.control('Variant overall length value').value,'-');assert.equal(h.control('Variant overall length value').getAttribute('aria-invalid'),'true');
        const errorId=h.control('Variant overall length value').getAttribute('aria-describedby')!;assert.ok(h.container.ownerDocument.getElementById(errorId)?.textContent);
        await h.set('Variant overall length value','66');assert.equal(h.control('Variant overall length unit').value,'');assert.equal(SportsVariantFactsSchema.safeParse(h.value).success,false);
        await h.set('Variant overall length unit','in');
        assert.deepEqual(resolveSportsMeasurements(common,SportsVariantFactsSchema.parse(h.value)).length,{value:66,unit:'in'});
        await h.click('Use common overall length');assert.equal(h.value,null);assert.deepEqual(resolveSportsMeasurements(common).length,{value:68,unit:'cm'});
        assert.match(h.container.textContent!,/Common product overall length: 68 cm/);
    }finally{await h.close();}
});

test('dimensions replace the whole set and clearing optional height does not copy common dimensions',async()=>{
    const h=await mount({weight:{value:90,unit:'g'}});try{
        await h.click('Override dimensions');await h.set('Variant dimension length','70');await h.set('Variant dimension width','25');await h.set('Variant dimensions unit','cm');
        await h.set('Variant dimension height (optional)','4');await h.set('Variant dimension height (optional)','');
        assert.deepEqual(SportsVariantFactsSchema.parse(h.value),{weight:{value:90,unit:'g'},dimensions:{length:70,width:25,unit:'cm'}});
        await h.click('Use common weight');assert.deepEqual(h.value,{dimensions:{length:70,width:25,unit:'cm'}});
        await h.click('Use common dimensions');assert.equal(h.value,null);
    }finally{await h.close();}
});

test('empty namespace is invalid while absent is inheritance; common changes never overwrite a controlled override',async()=>{
    const h=await mount({});try{
        assert.match(h.container.querySelector('[role="alert"]')!.textContent!,/at least one equipment measurement/);
        await h.click('Override grip circumference');await h.set('Variant grip circumference value','84');await h.set('Variant grip circumference unit','mm');
        const before=structuredClone(h.value);const nextCommon=SportsFactsSchema.parse({...common,length:{value:70,unit:'cm'},weight:{value:92,unit:'g'}});
        await h.renderCommon(nextCommon);assert.deepEqual(h.value,before);assert.match(h.container.textContent!,/Common product overall length: 70 cm/);
        assert.equal(resolveSportsMeasurements(nextCommon,SportsVariantFactsSchema.parse(h.value)).length?.value,70);
        await h.click('Clear all measurement overrides');assert.equal(h.value,null);assert.equal(SportsVariantFactsSchema.safeParse(h.value).success,false);
        assert.equal(common.length?.value,68);assert.equal(nextCommon.length?.value,70);
    }finally{await h.close();}
});

test('disabled fields and buttons cannot emit edits; labels and button semantics remain correct',async()=>{
    const h=await mount({gripCircumference:{value:84,unit:'mm'},dimensions:{length:70,width:25,unit:'cm'}},common,true);try{
        const controls=[...h.container.querySelectorAll('input,select')];const ids=controls.map(element=>element.id);assert.equal(new Set(ids).size,ids.length);
        for(const element of [...controls,...h.container.querySelectorAll('button')])assert.equal(element.matches(':disabled'),true);
        for(const id of ids)assert.ok([...h.container.querySelectorAll('label')].some(label=>label.htmlFor===id));
        for(const button of h.container.querySelectorAll('button'))assert.equal(button.type,'button');
        await h.click('Use common grip circumference');await h.click('Clear all measurement overrides');await h.set('Variant grip circumference value','88');
        assert.equal(h.changes,0);assert.equal(h.submissions,0);assert.equal(h.container.querySelectorAll('form').length,1);
    }finally{await h.close();}
});

test('hostile invalid values stay text for correction; invalid common facts create no fabricated value',async()=>{
    const hostile='<img src=x onerror="bad()"><script>bad()</script>';
    const h=await mount({gripCircumference:{value:hostile,unit:'mm'}},{...common,length:{value:NaN,unit:'cm'}});try{
        assert.equal(h.control('Variant grip circumference value').value,hostile);assert.equal(h.container.querySelector('script,img'),null);
        assert.equal(SportsVariantFactsSchema.safeParse(h.value).success,false);assert.match(h.container.textContent!,/Common product overall length: Not supplied/);
        assert.match(h.container.textContent!,/Common product facts are incomplete or unsupported/);
        await h.set('Variant grip circumference value','84');assert.deepEqual(SportsVariantFactsSchema.parse(h.value),{gripCircumference:{value:84,unit:'mm'}});
    }finally{await h.close();}
});

test('unsupported historical shape and identity fields require deliberate removal; measurements never own a variant ID',async()=>{
    const malformed=await mount(['bad']);try{
        assert.match(malformed.container.textContent!,/unsupported shape/);assert.equal(malformed.container.querySelectorAll('input,select').length,0);
        await malformed.click('Clear all measurement overrides');assert.equal(malformed.value,null);
    }finally{await malformed.close();}
    const identity=await mount({id:'server-variant-id',gripCircumference:{value:84,unit:'mm'}});try{
        assert.equal(SportsVariantFactsSchema.safeParse(identity.value).success,false);assert.match(identity.container.querySelector('[role="alert"]')!.textContent!,/Unrecognized key/);
        await identity.click('Clear all measurement overrides');assert.equal(identity.value,null);
    }finally{await identity.close();}
});
