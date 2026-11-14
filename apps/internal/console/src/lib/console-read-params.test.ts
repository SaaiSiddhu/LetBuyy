import assert from 'node:assert/strict';
import test from 'node:test';
import { readPageParam } from './console-api';
test('page parsing never forwards fractional, overflowing or unbounded page offsets',()=>{
    for(const value of ['0.5','-1','0','Infinity','1e308','10001','NaN'])assert.equal(readPageParam({page:value}),1,value);
    assert.equal(readPageParam({page:'2'}),2);assert.equal(readPageParam({page:['3','9']}),3);
});
