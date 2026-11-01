import assert from 'node:assert/strict';
import test from 'node:test';
import { safeKycIndiaReviewRedirect } from './kyc-india-review-redirect';

const site = 'd7194463-3cdb-4e2a-850b-cb048986adad';
const receipt = '2c73a536-4dc4-4df1-92d4-89d0c8b51d99';
const base = `https://private-kyc-mumbai.s3.ap-south-1.amazonaws.com/kyc/${site}/business_pan/${receipt}`;
const query = '?versionId=version-1&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=key%2Fscope&X-Amz-Date=20261101T120000Z&X-Amz-Expires=30&X-Amz-SignedHeaders=host&X-Amz-Signature=' + 'a'.repeat(64);

test('only exact Mumbai S3 reviewer tickets pass the Console redirect boundary', () => {
    assert.equal(safeKycIndiaReviewRedirect(base + query, site), base + query);
    for (const bad of [
        base.replace('ap-south-1', 'us-east-1') + query,
        base.replace('amazonaws.com', 'amazonaws.com.evil.test') + query,
        base.replace(site, '11111111-1111-4111-8111-111111111111') + query,
        base.replace('https:', 'http:') + query,
        base + query.replace('version-1', 'null'),
        base + query + '&versionId=version-2',
        base + query.replace('Expires=30', 'Expires=3600'),
        base + query + '#fragment',
        'https://evil.test/redirect',
    ]) assert.equal(safeKycIndiaReviewRedirect(bad, site), null, bad);
});
