import assert from 'node:assert/strict';
import test from 'node:test';
import {parseCsv, productCsvInputs} from '../execution/product-csv-input';

const codec={parseCsv,productCsvInputs};
const store = '11111111-1111-4111-8111-111111111111';

test('quoted CSV records retain Unicode, embedded CR/LF, escaped quotes and field whitespace', () => {
    const csv = '\uFEFFname,description,price\r\n"東京, shop","  Line one\r\nLine two ""quote""  ",12.34\r\n';
    assert.deepEqual(codec.parseCsv(csv), [['name', 'description', 'price'], ['東京, shop', '  Line one\r\nLine two "quote"  ', '12.34']]);
    const input = codec.productCsvInputs(csv, store);
    assert.equal(input.length, 1);
    assert.equal(input[0].description, '  Line one\r\nLine two "quote"  ');
    assert.equal(input[0].price, 12.34);
});

test('CSV supports CR-only records and omits empty physical records', () => {
    assert.deepEqual(codec.parseCsv('\rname,price\r\rItem,10\r'), [['name', 'price'], ['Item', '10']]);
});

test('malformed quotes fail before a partially parsed file can be used', () => {
    for (const text of ['name\n"unclosed', 'name\na"b', 'name\n"ok" trailing', 'name\n"escaped""']) {
        assert.throws(() => codec.parseCsv(text), /quote/);
    }
});

test('CSV row budget counts logical records rather than description line breaks', () => {
    const record = '"Item","Line one\nLine two",10';
    assert.equal(codec.parseCsv('name,description,price\n' + Array(500).fill(record).join('\n')).length, 501);
    assert.throws(() => codec.parseCsv('name,description,price\n' + Array(501).fill(record).join('\n')), /500 rows/);
});

test('all product rows satisfy the canonical schema before a job is queued', () => {
    for (const text of [
        'name,price\nValid,10\nInvalid,3oops',
        'name,price\nInvalid,-1',
        'name,stock\nInvalid,1.5',
        'name,images\nInvalid,not-a-url',
        'name,description\nInvalid,' + 'x'.repeat(10001),
    ]) assert.throws(() => codec.productCsvInputs(text, store), /CSV row \d+ has an invalid/);
    assert.equal(codec.productCsvInputs('name,price,stock\nValid,10.50,3', store)[0].stock, 3);
});

test('ambiguous columns and excess fields are refused', () => {
    for (const text of ['name,NAME\nA,B', 'price\n10', 'name\nA,B']) assert.throws(() => codec.productCsvInputs(text, store), /column|fields/);
});

test('unsupported columns and missing names cannot silently lose source meaning',()=>{
    assert.throws(()=>codec.productCsvInputs('name,compare_price\nItem,99',store),/unsupported columns/);
    assert.throws(()=>codec.productCsvInputs('name,price\n,10',store),/invalid name/);
    assert.throws(()=>codec.productCsvInputs('name\nInvalid\u0000',store),/invalid text/);
    assert.throws(()=>codec.productCsvInputs('name\nInvalid\ud800',store),/invalid text/);
});
