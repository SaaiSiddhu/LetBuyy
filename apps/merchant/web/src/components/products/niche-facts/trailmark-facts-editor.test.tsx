import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { SportsFactsSchema } from '@letbuyy/commerce-core';
import { TrailmarkFactsEditor } from './trailmark-facts-editor';
import { composeProductMetadata, updateProductFactsDraft } from '../../../lib/product-facts-draft';
const requireUI=createRequire(new URL('../../../../../../../packages/typescript/ui/package.json',import.meta.url));
const {JSDOM}=requireUI('jsdom') as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis };
};
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
const base={activity:'Badminton',equipmentType:'racket'};

async function mount(initial:unknown=null,disabled=false){
    const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://merchant.example.test/alpha/products/new'});
    const names=['window','document','navigator','HTMLElement','Element','MutationObserver'] as const;
    const previous=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
    for(const name of names)Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name]});
    const {createRoot}=await import('react-dom/client');
    const container=dom.window.document.getElementById('root')!;
    const root=createRoot(container);let latest:unknown=initial;let changes=0;let submissions=0;
    function Harness(){const[value,setValue]=React.useState(initial);return <form onSubmit={event=>{event.preventDefault();submissions++;}}><TrailmarkFactsEditor value={value} disabled={disabled} onChange={next=>{latest=next;changes++;setValue(next);}}/></form>;}
    await act(async()=>root.render(<Harness/>));
    const button=(label:string)=>{const found=[...container.querySelectorAll('button')].find(element=>element.textContent?.trim()===label);assert.ok(found,'Missing button: '+label);return found;};
    const control=(label:string)=>{const element=[...container.querySelectorAll('label')].find(element=>element.textContent?.trim()===label);assert.ok(element,'Missing label: '+label);const found=container.ownerDocument.getElementById(element.htmlFor);assert.ok(found);return found as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;};
    const click=async(label:string)=>{await act(async()=>button(label).click());};
    const set=async(label:string,value:string)=>{const element=control(label);await act(async()=>{const prototype=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:element.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,value);element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
    const close=async()=>{await act(async()=>root.unmount());dom.window.close();for(const name of names){if(previous[name])Object.defineProperty(globalThis,name,previous[name]!);else Reflect.deleteProperty(globalThis,name);}};
    return{container,button,control,click,set,close,get value(){return latest;},get changes(){return changes;},get submissions(){return submissions;}};
}

test('absent facts remain absent until a deliberate add; incomplete controlled draft is editable and validated',async()=>{
    const h=await mount();try{
        assert.equal(h.value,null);assert.equal(h.container.querySelectorAll('input,textarea,select').length,0);
        await h.click('Add equipment facts');assert.deepEqual(h.value,{});assert.equal(SportsFactsSchema.safeParse(h.value).success,false);
        await h.set('Activity','Badminton');await h.set('Equipment category','racket');assert.equal(SportsFactsSchema.safeParse(h.value).success,true);
        await h.click('Add overall length');await h.set('Overall length value','-');
        assert.equal(h.control('Overall length value').value,'-');assert.equal(SportsFactsSchema.safeParse(h.value).success,false);
        assert.equal(h.control('Overall length value').getAttribute('aria-invalid'),'true');
        const description=h.control('Overall length value').getAttribute('aria-describedby')!;
        assert.ok(h.container.ownerDocument.getElementById(description)?.textContent);
        await h.set('Overall length value','68');await h.set('Overall length unit','cm');
        assert.deepEqual(SportsFactsSchema.parse(h.value),{version:1,...base,length:{value:68,unit:'cm'}});
        assert.equal(h.submissions,0);assert.equal(h.container.querySelectorAll('form').length,1);
    }finally{await h.close();}
});

test('actual edited payload contains explicit equipment units, contents and referenced compatibility',async()=>{
    const h=await mount(base);try{
        await h.click('Add weight');await h.set('Weight value','88');await h.set('Weight unit','g');
        await h.click('Add grip circumference');await h.set('Grip circumference value','84');await h.set('Grip circumference unit','mm');
        await h.click('Add dimensions');await h.set('Dimension length','72');await h.set('Dimension width','24');await h.set('Dimensions unit','cm');
        await h.set('Material (optional)','Aluminium');await h.click('Add included item');await h.set('Included item 1','1 strung racket');
        await h.set('Use conditions (optional)','Dry court recreation');await h.set('Care instructions (optional)','Wipe dry');
        await h.set('Compatibility status','merchant-supplied');assert.equal(SportsFactsSchema.safeParse(h.value).success,false);
        assert.equal(h.control('Merchant compatibility reference').getAttribute('aria-invalid'),'true');
        await h.set('Merchant compatibility reference','Merchant specification sheet R68');
        assert.deepEqual(SportsFactsSchema.parse(h.value),{version:1,...base,weight:{value:88,unit:'g'},gripCircumference:{value:84,unit:'mm'},dimensions:{length:72,width:24,unit:'cm'},material:'Aluminium',contents:['1 strung racket'],conditions:'Dry court recreation',care:'Wipe dry',compatibility:{status:'merchant-supplied',reference:'Merchant specification sheet R68'}});
        assert.equal('size' in (h.value as Record<string,unknown>),false);
    }finally{await h.close();}
});

test('optional facts can be removed; unconfirmed compatibility drops a stale reference and clear emits null',async()=>{
    const h=await mount({...base,length:{value:68,unit:'cm'},weight:{value:88,unit:'g'},gripCircumference:{value:84,unit:'mm'},dimensions:{length:72,width:24,height:3,unit:'cm'},material:'Aluminium',contents:['1 racket'],conditions:'Dry use',care:'Wipe dry',compatibility:{status:'merchant-supplied',reference:'Old reference'}});try{
        await h.set('Compatibility status','unconfirmed');assert.deepEqual((h.value as Record<string,unknown>).compatibility,{status:'unconfirmed'});
        await h.set('Compatibility status','');
        for(const label of ['Clear overall length','Clear weight','Clear grip circumference','Clear dimensions','Remove included item 1'])await h.click(label);
        for(const label of ['Material (optional)','Use conditions (optional)','Care instructions (optional)'])await h.set(label,'');
        assert.deepEqual(h.value,base);assert.equal(SportsFactsSchema.safeParse(h.value).success,true);
        await h.click('Clear equipment facts');assert.equal(h.value,null);assert.ok(h.button('Add equipment facts'));assert.equal(h.submissions,0);
    }finally{await h.close();}
});

test('canonical errors retain bad values for correction; unknown dimensions and quantities are never zero-filled',async()=>{
    const h=await mount(base);try{
        await h.click('Add dimensions');await h.set('Dimension length','100001');await h.set('Dimension width','24');await h.set('Dimensions unit','cm');
        assert.equal(SportsFactsSchema.safeParse(h.value).success,false);assert.equal(h.control('Dimension length').getAttribute('aria-invalid'),'true');
        await h.set('Dimension length','72');await h.set('Dimension height (optional)','3');await h.set('Dimension height (optional)','');
        assert.deepEqual((h.value as Record<string,unknown>).dimensions,{length:72,width:24,unit:'cm'});
        await h.click('Add included item');assert.equal(SportsFactsSchema.safeParse(h.value).success,false);assert.equal(h.control('Included item 1').getAttribute('aria-invalid'),'true');
        await h.set('Included item 1','3 shuttles');assert.equal(SportsFactsSchema.safeParse(h.value).success,true);
    }finally{await h.close();}
});

test('disabled controls cannot mutate; all fields have unique explicit labels and buttons cannot submit',async()=>{
    const h=await mount({...base,length:{value:68,unit:'cm'},compatibility:{status:'unconfirmed'}},true);try{
        for(const element of h.container.querySelectorAll('input,textarea,select,button'))assert.equal(element.matches(':disabled'),true);
        for(const button of h.container.querySelectorAll('button'))assert.equal(button.type,'button');
        const ids=[...h.container.querySelectorAll('input,textarea,select')].map(element=>element.id);assert.equal(new Set(ids).size,ids.length);
        for(const id of ids)assert.ok([...h.container.querySelectorAll('label')].some(label=>label.htmlFor===id));
        await h.click('Clear equipment facts');await h.click('Clear overall length');await h.set('Overall length value','69');assert.equal(h.changes,0);assert.equal(h.submissions,0);
    }finally{await h.close();}
});

test('unsupported versions and oversized historical lists show canonical errors and explicit recovery',async()=>{
    const h=await mount({...base,version:2,contents:Array.from({length:31},(_,index)=>'Item '+index)});try{
        assert.match(h.container.textContent!,/unsupported version/);
        assert.equal(h.button('Add included item').disabled,true);
        assert.equal([...h.container.querySelectorAll('label')].filter(label=>label.textContent?.startsWith('Included item ')).length,30);
        await h.click('Clear included contents');assert.equal('contents' in (h.value as Record<string,unknown>),false);
        assert.equal(SportsFactsSchema.safeParse(h.value).success,false);
        await h.click('Clear equipment facts');assert.equal(h.value,null);await h.click('Add equipment facts');assert.deepEqual(h.value,{});
    }finally{await h.close();}
});

test('canonical parent composition removes a cleared namespace, preserves unrelated metadata and rejects incomplete facts',async()=>{
    const metadata={sports:base,privateSupplierNote:'Preserve the existing private field'};
    const h=await mount(base);try{
        await h.click('Clear equipment facts');
        const cleared=composeProductMetadata(metadata,'{}',updateProductFactsDraft('',metadata,'sports',h.value));
        assert.equal(Object.hasOwn(cleared,'sports'),false);
        assert.equal(cleared.privateSupplierNote,metadata.privateSupplierNote);
        await h.click('Add equipment facts');
        const incomplete=updateProductFactsDraft('',metadata,'sports',h.value);
        assert.throws(()=>composeProductMetadata(metadata,'{}',incomplete),/Check product facts/);
        assert.deepEqual(h.value,{});assert.deepEqual(metadata.sports,base);
    }finally{await h.close();}
});

test('hostile merchant strings remain text; unsupported historical shape requires deliberate clear',async()=>{
    const hostile='<img src=x onerror="window.claimed=true"><script>bad()</script>';
    const h=await mount(base);try{
        await h.set('Material (optional)',hostile);await h.set('Use conditions (optional)',hostile);
        assert.equal((h.value as Record<string,unknown>).material,hostile);assert.equal(SportsFactsSchema.safeParse(h.value).success,true);
        assert.equal(h.container.querySelector('script,img'),null);assert.equal(h.control('Material (optional)').value,hostile);
    }finally{await h.close();}
    const invalid=await mount(['not','facts']);try{
        assert.match(invalid.container.querySelector('[role="alert"]')!.textContent!,/unsupported shape/);
        assert.equal(invalid.container.querySelectorAll('input,textarea,select').length,0);
        await invalid.click('Clear equipment facts');assert.equal(invalid.value,null);
    }finally{await invalid.close();}
});
