import assert from 'node:assert/strict';
import test from 'node:test';
import { consoleCsvCell } from './console-csv';
test('CSV preserves values, quotes delimiters and prevents spreadsheet formulas',()=>{
    assert.equal(consoleCsvCell('a,b'), '"a,b"');
    assert.equal(consoleCsvCell('one\n"two"'), '"one\n""two"""');
    assert.equal(consoleCsvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(consoleCsvCell('\t+cmd'), "'\t+cmd");
    assert.equal(consoleCsvCell(null), '');assert.equal(consoleCsvCell(0), '0');assert.equal(consoleCsvCell(-500), '-500');
});
