import assert from 'node:assert/strict';
import test from 'node:test';
import {requireOwnedDatabase}from './owned-db-support';
const owned=requireOwnedDatabase();
test('owned PostgreSQL Unicode casing capability is explicit and agrees with ECMAScript edge cases',()=>{
 const profile=JSON.parse(owned.psql("SELECT coalesce(jsonb_agg(jsonb_build_object('name',collname,'provider',collprovider,'version',collversion,'deterministic',collisdeterministic)),'[]')FROM pg_collation WHERE collname='und-x-icu'AND collnamespace='pg_catalog'::regnamespace"));
 console.info('OWNED_COLLECTION_UNICODE '+JSON.stringify(profile));assert.equal(profile.length,1);assert.equal(profile[0].provider,'i');assert.equal(profile[0].deterministic,true);
 const cases=['İSTANBUL ΣΟΣ ΟΣ ΟΣΑ','Tamil தமிழ்','Σ','AΣ','ΣA','AΣ\u0301','\u0130','Straße ẞ'];
 for(const value of cases){const sql="SELECT lower('"+value.replaceAll("'","''")+"' COLLATE pg_catalog.\"und-x-icu\")";assert.equal(owned.psql(sql),value.toLowerCase());}
});
