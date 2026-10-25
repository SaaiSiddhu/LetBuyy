import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../../../../',import.meta.url);
/** Old admissions stay immutable; exact locally reviewed corrections require a
 * new owned qualification. This is source admission, never runtime guard proof. */
export function assertReviewedSourceHash(path, observed, admitted) {
    if(observed===admitted)return;
    const review=JSON.parse(readFileSync(new URL('docs/evidence/consolidation-2026-10-25/SQL_SOURCE_CORRECTIONS.json',root),'utf8'));
    assert.equal(review.status,'REVIEWED_FOR_LOCAL_REQUALIFICATION');
    const row=review.sources.find(row=>row.path===path && row.prior_sha256===admitted);
    assert.ok(row,'unreviewed change to admitted SQL: '+path);
    assert.equal(observed,row.current_sha256,'reviewed SQL changed again: '+path);
}
