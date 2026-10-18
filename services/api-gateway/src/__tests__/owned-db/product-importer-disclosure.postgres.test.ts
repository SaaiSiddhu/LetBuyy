// The importer disclosure is optional public product data. Prove the storage boundary against the
// isolated, fully migrated owned database, including the database-enforced payload limit.
import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const { psql } = requireOwnedDatabase();
const site = newSyntheticTenant('imp-disclosure');

before(() => seedSyntheticTenant(psql, site));

test('products accept nullable importer details up to 1000 characters and reject longer values', () => {
    const productId = crypto.randomUUID();
    psql(`INSERT INTO products (id,store_id,name,price,is_active,status,importer_details) VALUES ('${productId}','${site.siteId}','Synthetic importer disclosure',120,true,'active','Example Imports, Mumbai');`);
    assert.equal(psql(`SELECT importer_details FROM products WHERE id='${productId}';`), 'Example Imports, Mumbai');

    const maxLengthProductId = crypto.randomUUID();
    psql(`INSERT INTO products (id,store_id,name,price,is_active,status,importer_details) VALUES ('${maxLengthProductId}','${site.siteId}','Maximum importer disclosure',120,true,'active',repeat('x',1000));`);
    assert.equal(psql(`SELECT char_length(importer_details)::text FROM products WHERE id='${maxLengthProductId}';`), '1000');

    const tooLongProductId = crypto.randomUUID();
    psql(`DO $check$ BEGIN
      INSERT INTO products (id,store_id,name,price,is_active,status,importer_details)
      VALUES ('${tooLongProductId}','${site.siteId}','Oversized importer disclosure',120,true,'active',repeat('x',1001));
      RAISE EXCEPTION 'oversized importer disclosure was accepted';
    EXCEPTION WHEN check_violation THEN
      NULL;
    END $check$;`);
    assert.equal(psql(`SELECT count(*)::text FROM products WHERE id='${tooLongProductId}';`), '0');
});
