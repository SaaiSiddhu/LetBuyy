import assert from 'node:assert/strict';
import { test } from 'node:test';
import { streamCsvToR2 } from '../routes/export';

function storage(failPart = false) {
    const writes: Uint8Array[] = [];
    let aborted = false, completed = false;
    const upload = {
        async uploadPart(partNumber: number, body: Uint8Array) {
            if (failPart) throw new Error('synthetic R2 failure');
            writes.push(body.slice());
            return {partNumber, etag:`part-${partNumber}`};
        },
        async complete() { completed = true; },
        async abort() { aborted = true; },
    };
    const bucket = { async put(_key: string, body: Uint8Array) { assert.ok(body instanceof Uint8Array); writes.push(body.slice()); return {} as R2Object; },
        async createMultipartUpload() { return upload; } } as unknown as R2Bucket;
    return {bucket,writes,state:()=>({aborted,completed})};
}
test('small CSV export uses a known-length R2 body and preserves UTF-8 bytes',async()=>{
    const s=storage();const count=await streamCsvToR2(s.bucket,'test','test.csv',async write=>{await write('name,quantity');await write('Synthetic ₹,2');return 1;});
    assert.equal(count,1);assert.equal(s.writes.length,1);
    assert.equal(new TextDecoder().decode(s.writes[0]),'name,quantity\nSynthetic ₹,2\n');
    assert.deepEqual(s.state(),{aborted:false,completed:false});
});
test('large CSV export bounds each multipart body and preserves all bytes',async()=>{
    const s=storage();const row='x'.repeat(5*1024*1024+30);
    await streamCsvToR2(s.bucket,'test','test.csv',async write=>{await write(row);return 1;});
    assert.deepEqual(s.writes.map(b=>b.length),[5*1024*1024,31]);
    assert.equal(Buffer.concat(s.writes).toString(),row+'\n');
    assert.deepEqual(s.state(),{aborted:false,completed:true});
});
test('failed R2 multipart upload aborts and never publishes a completed result',async()=>{
    const s=storage(true);
    await assert.rejects(streamCsvToR2(s.bucket,'test','test.csv',async write=>{await write('x'.repeat(5*1024*1024));return 1;}),/synthetic R2 failure/);
    assert.deepEqual(s.state(),{aborted:true,completed:false});
});
