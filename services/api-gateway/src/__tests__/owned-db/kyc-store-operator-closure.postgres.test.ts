import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { gatewayEnv, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import {
    createLetbuyyPlatformSessionToken,
    operatorIdentityKeys,
    TrustedOperatorGateway,
} from './operator-identity-fixture';

const owned = requireOwnedDatabase();
let gateway: TrustedOperatorGateway;
after(async () => { await gateway?.settle(); });

test('a persisted platform operator closes a store and atomically queues its private KYC object', async () => {
    const tenant = newSyntheticTenant('operator-kyc-close');
    seedSyntheticTenant(owned.psql, tenant);
    const operator = randomUUID(), merchant = randomUUID(), receipt = randomUUID();
    const operatorEmail = `syn-operator-${operator}@example.invalid`;
    const merchantEmail = `syn-merchant-${merchant}@example.invalid`;
    const key = `kyc/${tenant.siteId}/business_pan/${receipt}`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES
      ('${operator}','${operatorEmail}',true,'Synthetic operator'),
      ('${merchant}','${merchantEmail}',true,'Synthetic merchant');
      INSERT INTO super_admin_allowlist(user_id,email,full_name,is_active) VALUES
      ('${operator}','${operatorEmail}','Synthetic operator',true);
      UPDATE sites SET custom_user_id='${merchant}' WHERE id='${tenant.siteId}';
      INSERT INTO kyc_private_object_cleanup_jobs
      (id,site_id,object_key,purpose,storage_provider,document_type,expected_sha256_hex,
       expected_bytes,expected_content_type,reference_last4,upload_idempotency_key,
       created_at,intent_expires_at,next_attempt_at,object_version_id,head_verified_at,
       status,outcome,completed_at,created_by,updated_by)
      VALUES ('${receipt}','${tenant.siteId}','${key}','upload_reservation',
       'aws_s3_mumbai','business_pan','${'a'.repeat(64)}',1234,'application/pdf','1234',
       '${randomUUID()}',now()-interval '10 minutes',now()-interval '7 minutes',
       now()+interval '1 hour','synthetic-version',now()-interval '5 minutes',
       'completed','retained',now()-interval '4 minutes','${merchant}','${merchant}');
      INSERT INTO merchant_kyc_documents(site_id,document_type,status,provider,provider_mode,
       document_number_last4,submitted_at,metadata)
      VALUES ('${tenant.siteId}','business_pan','submitted','letbuyy_sandbox_kyc','sandbox',
       '1234',now(),'{"private_storage_provider":"aws_s3_mumbai",
         "private_object_key":"${key}","private_upload_receipt_id":"${receipt}",
         "private_object_version_id":"synthetic-version","sha256":"${'a'.repeat(64)}",
         "byte_size":1234,"content_type":"application/pdf","malware_scan_status":"pending"}'::jsonb);`);

    const secret = 'synthetic-operator-kyc-closure-secret';
    const bridge = `synthetic-operator-kyc-${randomUUID()}`;
    gateway = new TrustedOperatorGateway(gatewayEnv(owned, await operatorIdentityKeys(secret), {
        PLATFORM_CONSOLE_API_TOKEN: bridge,
        PLATFORM_CONSOLE_SESSION_SECRET: secret,
    }));
    const merchantHeaders = await signedIdentityHeaders(merchant, merchantEmail, tenant.siteId);
    const denied = await gateway.request(`/v1/admin/stores/${tenant.siteId}`, {
        method: 'DELETE', headers: { ...merchantHeaders, 'X-Idempotency-Key': randomUUID() },
    });
    assert.equal(denied.status, 403, denied.text);
    assert.equal(owned.psql(`SELECT deleted_at IS NULL FROM sites WHERE id='${tenant.siteId}';`), 't');

    const token = await createLetbuyyPlatformSessionToken({
        email: operatorEmail, userId: operator, mfaVerified: false,
    }, secret);
    const headers = {
        Authorization: `Bearer ${bridge}`,
        'X-Platform-Console-Session': token,
        'X-Idempotency-Key': randomUUID(),
        'Content-Type': 'application/json',
    };
    const registered = await gateway.request('/v1/internal/console/sessions/register', {
        method: 'POST', headers, body: '{}',
    });
    assert.equal(registered.status, 200, registered.text);
    const consoleOnly = await gateway.request(`/v1/admin/stores/${tenant.siteId}`, {
        method: 'DELETE', headers: { ...headers, 'X-Idempotency-Key': randomUUID() },
    });
    assert.equal(consoleOnly.status, 401, consoleOnly.text);
    const operatorHeaders = await signedIdentityHeaders(operator, operatorEmail);
    const close = await gateway.request(`/v1/admin/stores/${tenant.siteId}`, {
        method: 'DELETE', headers: { ...operatorHeaders, 'X-Idempotency-Key': randomUUID() },
    });
    assert.equal(close.status, 200, close.text);
    assert.equal(close.json?.data.closed, true);
    assert.equal(owned.psql(`SELECT status||':'||published::text||':'||(deleted_at IS NOT NULL)::text
      FROM sites WHERE id='${tenant.siteId}';`), 'suspended:false:true');
    assert.equal(owned.psql(`SELECT count(*) FROM merchant_kyc_documents
      WHERE site_id='${tenant.siteId}' AND metadata->>'private_object_key' IS NOT NULL;`), '0');
    assert.equal(owned.psql(`SELECT purpose||':'||status||':'||(closure_requested_at IS NOT NULL)::text
      FROM kyc_private_object_cleanup_jobs WHERE id='${receipt}';`), 'replaced_object:pending:true');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs
      WHERE actor_id='${operator}' AND action='store_closed' AND resource_id='${tenant.siteId}';`), '1');
});
