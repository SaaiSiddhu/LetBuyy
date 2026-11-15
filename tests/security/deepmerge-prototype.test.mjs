import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
// Published runtime distributions. index.js is upstream build input whose
// is-mergeable-object dependency is development-only, not an installed entry.
const implementations=[['CommonJS',require('deepmerge')],['UMD',require('deepmerge/dist/umd.js')]];
for(const [format,merge] of implementations) {
    test(format+': copying an own JSON __proto__ field cannot poison the returned prototype',()=>{
        const target=JSON.parse('{"__proto__":{"syntheticInherited":true},"retained":"target"}');
        const result=merge(target,{added:'source'});
        assert.equal(Object.getPrototypeOf(result),Object.prototype);
        assert.equal(result.syntheticInherited,undefined);
        assert.equal(result.retained,'target');assert.equal(result.added,'source');
        assert.equal(Object.hasOwn(result,'__proto__'),true);
        assert.deepEqual(Object.getOwnPropertyDescriptor(result,'__proto__').value,{syntheticInherited:true});
        assert.equal(({}).syntheticInherited,undefined);
    });
    test(format+': merging existing own prototype-shaped keys produces ordinary own data',()=>{
        const target=JSON.parse('{"__proto__":{"fromTarget":true}}');
        const source=JSON.parse('{"__proto__":{"fromSource":true}}');
        const result=merge(target,source);
        assert.equal(Object.getPrototypeOf(result),Object.prototype);
        assert.equal(result.fromTarget,undefined);assert.equal(result.fromSource,undefined);
        assert.deepEqual(Object.getOwnPropertyDescriptor(result,'__proto__').value,{fromTarget:true,fromSource:true});
    });
    test(format+': copied values cannot invoke an inherited destination setter',()=>{
        const name='letbuyySyntheticMergeSetter';
        const previous=Object.getOwnPropertyDescriptor(Object.prototype,name);let calls=0;
        Object.defineProperty(Object.prototype,name,{configurable:true,set(){calls++;}});
        try {
            const target=JSON.parse('{"letbuyySyntheticMergeSetter":"retained"}');
            const result=merge(target,{});
            assert.equal(calls,0);
            assert.equal(Object.hasOwn(result,name),true);
            assert.equal(result[name],'retained');
        } finally {
            if(previous)Object.defineProperty(Object.prototype,name,previous);
            else delete Object.prototype[name];
        }
    });
    test(format+': ordinary nested, array and custom merge behavior remains intact',()=>{
        const target={address:{city:'Synthetic city'},items:[{quantity:1}]};
        const source={address:{country:'IN'},items:[{quantity:2}]};
        const result=merge(target,source);
        assert.deepEqual(result,{address:{city:'Synthetic city',country:'IN'},items:[{quantity:1},{quantity:2}]});
        assert.notEqual(result.address,target.address);assert.notEqual(result.items[0],target.items[0]);
        assert.deepEqual(target,{address:{city:'Synthetic city'},items:[{quantity:1}]});
        assert.deepEqual(merge({items:[1]},{items:[2]},{arrayMerge:(_target,values)=>values}),{items:[2]});
    });
}
