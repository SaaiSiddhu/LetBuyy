import test from 'node:test';
import assert from 'node:assert/strict';
import {formatRecordedMinor} from './console-minor';
test('recorded minor amounts retain exact cents above the safe integer range',()=>{
 assert.equal(formatRecordedMinor('900719925474099399','INR'),'₹9,00,71,99,25,47,40,993.99');
 assert.equal(formatRecordedMinor('19900','INR'),'₹199.00');
});
test('missing or malformed monetary evidence is unavailable',()=>{
 for(const value of [null,'1.5','-1','Infinity',''])assert.equal(formatRecordedMinor(value,'INR'),'Unavailable');
});
