// Real local-development Console/Chromium/Gateway/PostgreSQL fixture. Operator
// accounts are pre-provisioned synthetic records; local links send no email.
// No positive credential injection, API double, MFA bypass or hosted access.
import { tmpdir as ownedTmpDir } from 'node:os';
import assert from 'node:assert/strict';
import {exportJWK} from 'jose';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { Gateway, gatewayEnv, newIdentityKeys,INTERNAL_SECRET,IDENTITY_ISSUER } from './gateway-harness';
import { startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedDatabase, type OwnedClientProcess } from './owned-db-support';

export interface ConsoleBrowserActor { id: string; email: string; factor: string; kind: 'lead' | 'super' | 'admin' }
function totp(secret: string) {
    const bits = [...secret].map(letter => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(letter).toString(2).padStart(5, '0')).join('');
    const key = Buffer.from(bits.match(/.{8}/g)!.map(byte => parseInt(byte, 2)));
    const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
    const hash = createHmac('sha1', key).update(counter).digest();
    return ((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}
async function port() {
    const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const value = (server.address() as { port: number }).port; await new Promise<void>(resolve => server.close(() => resolve())); return value;
}
export async function withConsoleBrowser(owned: OwnedDatabase, run: (fixture: {
    origin: string;identityOrigin:string;setIssuerAvailable:(available:boolean)=>Promise<void>;loseNextOperatorExchangeReply:()=>void; browser: Browser; actors: ConsoleBrowserActor[]; login: (actor: ConsoleBrowserActor,options?:{stopAtMfa?:boolean}) => Promise<{ context: BrowserContext; page: Page }>;
    rotateConfiguredFactor:(actor:ConsoleBrowserActor,factor:string)=>Promise<void>; loseNextMfaExecutionReply:()=>void;
    loseNextJobApprovalReply:()=>void;loseNextJobExecutionReply:()=>void;
    calls: { path: string; status: number }[]; loseNextApprovalReply: () => void; loseNextMoneyExecutionReply: () => void;
}) => Promise<void>, options: { makerRole?: 'lead' | 'admin' | 'super';targetRole?:'lead'|'admin'|'super'; kycPrivateBucket?: R2Bucket } = {}) {
    const actors: ConsoleBrowserActor[] = [options.makerRole || 'lead', 'super',...(options.targetRole?[options.targetRole]:[])].map((kind, index) => {
        const id = crypto.randomUUID(); return { id, email: `syn-browser-consent-${id}@example.invalid`, kind: kind as 'lead' | 'super' | 'admin',
            factor: ['JBSWY3DPEHPK3PXP','KRUGS4ZANFZSAYJA','NBSWY3DPO5XXE3DE'][index] };
    });
    for (const actor of actors) {
        owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor.id}','${actor.email}',true);`);
        if (actor.kind === 'super') owned.psql(`INSERT INTO super_admin_allowlist(user_id,email,full_name,is_active)
            VALUES('${actor.id}','${actor.email}','Synthetic browser approver',true);`);
        else owned.psql(`INSERT INTO employees(user_id,email,role,status,is_active,store_id)
            VALUES('${actor.id}','${actor.email}','${actor.kind === 'admin' ? 'admin' : 'manager'}','active',true,NULL);`);
    }
    const bridge = 'synthetic-consent-browser-bridge-' + crypto.randomUUID(), keys=await newIdentityKeys();
    const gateway = new Gateway(gatewayEnv(owned, keys, { PLATFORM_CONSOLE_API_TOKEN: bridge,
        ...(options.kycPrivateBucket ? { KYC_PRIVATE_BUCKET: options.kycPrivateBucket } : {}) }));
    let adapter: Server | undefined, app: OwnedClientProcess | undefined, identity:OwnedClientProcess|undefined, browser: Browser | undefined;
    const calls: { path: string; status: number }[] = [], diagnostics: string[] = [], pages: Page[] = [], errors: string[] = [];
    const browserTrace: Record<string, unknown>[] = [];
    let loseApprovalReply = false, loseMoneyExecutionReply = false,loseMfaReply=false,loseOperatorExchangeReply=false,loseJobApprovalReply=false,loseJobExecutionReply=false;
    try {
        adapter = createServer(async (request, response) => {
            const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
            const body = Buffer.concat(chunks).toString(), headers = new Headers();
            for (const [name, value] of Object.entries(request.headers)) if (typeof value === 'string'
                && !['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'].includes(name)) headers.set(name, value);
            try {
                const result = await gateway.request(request.url ?? '/', { method: request.method, headers, ...(body ? { body } : {}) });
                calls.push({ path: (request.url ?? '/').split('?')[0], status: result.status });
                // Named post-commit transport fault: the real worker has already
                // returned after its real transaction committed. Lose only this
                // reply, never synthesize a positive result or bypass a guard.
                if(loseOperatorExchangeReply&&request.method==='POST'&&request.url==='/v1/internal/identity/operator/exchange'&&result.status===200){
                    loseOperatorExchangeReply=false;response.writeHead(503,{'content-type':'application/json'});response.end(JSON.stringify({success:false,error:{code:'SYNTHETIC_EXCHANGE_REPLY_LOST',message:'The committed operator exchange reply was lost.'}}));
                } else if (loseApprovalReply && request.method === 'POST' && request.url === '/v1/internal/console/approvals' && result.status === 201) {
                    loseApprovalReply = false;
                    response.writeHead(503, { 'content-type': 'application/json' });
                    response.end(JSON.stringify({ success: false, error: { code: 'SYNTHETIC_REPLY_LOST', message: 'Could not confirm the saved approval. Retry the same form.' } }));
                } else if (loseMoneyExecutionReply && request.method === 'POST' && /^\/v1\/internal\/console\/money\/reconciliation\/[^/]+\/resolve$/.test(request.url || '') && result.status === 200) {
                    loseMoneyExecutionReply = false;
                    response.writeHead(503, { 'content-type': 'application/json' });
                    response.end(JSON.stringify({ success: false, error: { code: 'SYNTHETIC_EFFECT_REPLY_LOST', message: 'Could not confirm the saved action. Retry the same form.' } }));
                } else if(loseMfaReply && request.method==='POST' && /^\/v1\/internal\/console\/sessions\/mfa-reset\/[0-9a-f-]{36}$/.test(request.url||'') && result.status===200){
                    loseMfaReply=false;response.writeHead(503,{'content-type':'application/json'});response.end(JSON.stringify({success:false,error:{code:'SYNTHETIC_RESET_REPLY_LOST',message:'Could not confirm the saved reset. Retry the same form.'}}));
                } else if(loseJobApprovalReply&&request.method==='POST'&&/^\/v1\/internal\/console\/platform-jobs\/[0-9a-f-]{36}\/approvals$/.test(request.url||'')&&result.status===201){
                    loseJobApprovalReply=false;response.writeHead(503,{'content-type':'application/json'});
                    response.end(JSON.stringify({success:false,error:{code:'SYNTHETIC_JOB_REVIEW_REPLY_LOST',message:'Could not confirm the saved review. Retry the same form.'}}));
                } else if(loseJobExecutionReply&&request.method==='POST'&&/^\/v1\/internal\/console\/platform-jobs\/[0-9a-f-]{36}\/redrive$/.test(request.url||'')&&result.status===200){
                    loseJobExecutionReply=false;response.writeHead(503,{'content-type':'application/json'});
                    response.end(JSON.stringify({success:false,error:{code:'SYNTHETIC_JOB_EFFECT_REPLY_LOST',message:'Could not confirm the saved retry authorization. Retry the same form.'}}));
                } else { response.writeHead(result.status, Object.fromEntries(result.headers.entries())); response.end(result.text); }
            } catch { response.writeHead(500); response.end('{}'); }
        });
        await new Promise<void>(resolve => adapter!.listen(0, '127.0.0.1', resolve));
        const appPort = await port(), origin = `http://localhost:${appPort}`;
        const identityPort=await port(),identityOrigin=`http://localhost:${identityPort}`;
        const apiOrigin=`http://127.0.0.1:${(adapter.address() as {port:number}).port}/v1`;
        const identityEnv={LETBUYY_API_URL:apiOrigin,INTERNAL_API_SECRET:INTERNAL_SECRET,PLATFORM_CONSOLE_API_TOKEN:bridge,
            LETBUYY_IDENTITY_ISSUER:IDENTITY_ISSUER,LETBUYY_IDENTITY_PUBLIC_JWKS:keys.jwks,
            LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),
            PLATFORM_CONSOLE_ALLOWED_EMAILS:actors.map(actor=>actor.email).join(','),
            PLATFORM_CONSOLE_TOTP_SECRETS:JSON.stringify(Object.fromEntries(actors.map(actor=>[actor.email,actor.factor]))),LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'};
        const runtimeEnv={PLATFORM_CONSOLE_API_BASE_URL:apiOrigin,PLATFORM_CONSOLE_API_TOKEN:bridge,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,
            PLATFORM_CONSOLE_ALLOWED_EMAILS:identityEnv.PLATFORM_CONSOLE_ALLOWED_EMAILS,LETBUYY_IDENTITY_URL:identityOrigin,
            LETBUYY_IDENTITY_ISSUER:IDENTITY_ISSUER,LETBUYY_IDENTITY_PUBLIC_JWKS:keys.jwks,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'};
        async function startIdentity(){
            identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,env:identityEnv});
            for(const stream of [identity.stdout,identity.stderr])stream.on('data',data=>{diagnostics.push('Identity: '+data.toString().replace(/\?[^\s]+/g,'?redacted').slice(0,900));if(diagnostics.length>30)diagnostics.shift();});
            const until=Date.now()+120000;let ready=false;
            while(Date.now()<until){
                if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('Owned Identity stopped before readiness');
                try{const r=await fetch(identityOrigin+'/api/operator/console',{method:'POST',body:'{}',signal:AbortSignal.timeout(2500)});if(r.status===401){ready=true;break;}}catch{}
                await new Promise(resolve=>setTimeout(resolve,100));
            }
            assert.ok(ready,'actual Identity operator endpoint must be ready');
        }
        await startIdentity();
        const configuredPrivateJwk=identityEnv.LETBUYY_IDENTITY_PRIVATE_JWK;
        async function setIssuerAvailable(available:boolean){
            await stopOwnedClientRuntime(identity);identity=undefined;
            identityEnv.LETBUYY_IDENTITY_PRIVATE_JWK=available?configuredPrivateJwk:'';
            await startIdentity();
        }
        app = startOwnedClientRuntime(owned, 'console-next', { port: appPort, env: runtimeEnv });
        for (const stream of [app.stdout, app.stderr]) stream.on('data', data => {
            diagnostics.push(data.toString().replace(/\?[^\s]+/g, '?redacted').slice(0, 900));
            if (diagnostics.length > 30) diagnostics.shift();
        });
        let ready = false; const deadline = Date.now() + 120_000;
        while (Date.now() < deadline) {
            if (app.exitCode !== null || app.signalCode !== null) throw new Error('owned Console stopped before readiness');
            try { if ((await fetch(origin + '/login', { signal: AbortSignal.timeout(2500) })).status === 200) { ready = true; break; } } catch { /* initial compile */ }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.ok(ready, 'actual local Console must become ready');
        // Compile every journey route before opening a browser. Next dev's
        // on-demand shared-chunk rebuilds otherwise refresh existing tabs while
        // their ordinary form navigation is in flight. No credentials or
        // positive request are supplied during this compiler warmup.
        const warmPaths=['/merchants/' + crypto.randomUUID(), '/approvals',
            '/approvals/' + crypto.randomUUID(), '/api/approvals/request',
            '/api/approvals/decision', '/api/approvals/execute'];
        async function warmRoutes(){for(const path of warmPaths)
            await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(60_000)});
        }
        await warmRoutes();
        browser = await chromium.launch({ headless: true });
        async function login(actor: ConsoleBrowserActor,loginOptions:{stopAtMfa?:boolean}={}) {
            const context = await browser!.newContext(), page = await context.newPage(); pages.push(page); page.setDefaultTimeout(30_000);
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => {
                if (message.type() === 'error' || /Fast Refresh|\[HMR\]/.test(message.text())) browserTrace.push({ kind: 'browser-console', text: message.text().replace(/\?[^\s]+/g, '?redacted').slice(0, 1000) });
            });
            const navigation = await context.newCDPSession(page); await navigation.send('Page.enable');
            navigation.on('Page.frameRequestedNavigation', event => browserTrace.push({ kind: 'requested-navigation', reason: event.reason, path: new URL(event.url).pathname }));
            page.on('framenavigated', frame => { if (frame === page.mainFrame()) browserTrace.push({ kind: 'navigation', path: new URL(frame.url()).pathname }); });
            page.on('response', async response => {
                const path = new URL(response.url()).pathname;
                if (response.request().method() === 'POST' && /^\/(merchants|approvals|api\/approvals)\//.test(path)) {
                    const headers = await response.allHeaders();
                    browserTrace.push({ kind: 'server-action', path, status: response.status(),
                        actionRedirect: headers['x-action-redirect']?.split('?')[0], location: headers.location?.split('?')[0], contentType: headers['content-type'],
                        hasActionHeader: Boolean((await response.request().allHeaders())['next-action']), requestContentType: (await response.request().allHeaders())['content-type'] });
                }
            });
            await page.goto(origin + '/login'); await page.getByLabel('Email', { exact: true }).fill(actor.email);
            await page.getByRole('button', { name: 'Send magic link', exact: true }).click();
            await expect(page.getByText('Local development magic link generated. No email was sent.', { exact: true })).toBeVisible();
            await page.getByRole('link', { name: 'Open local development magic link', exact: true }).click();
            await page.waitForURL(url => url.pathname === '/mfa');
            if(loginOptions.stopAtMfa)return {context,page};
            // A new normal sign-in uses a NEW real clock code. Faster Identity
            // restarts can now finish inside the previous 30-second code window;
            // preserve the durable actor counter instead of weakening/resetting it.
            // Explicit replay/retired-factor denials stop at MFA and submit their
            // own code, so this wait never conceals an expected refusal.
            const last=Number(owned.psql(`SELECT coalesce((metadata->'console_mfa_guard'->>'last_counter')::bigint,-1) FROM principals WHERE realm='admin' AND legacy_user_id='${actor.id}' AND deleted_at IS NULL;`)||-1);
            const wait=Math.max(0,(last+1)*30000-Date.now()+50);
            assert.ok(wait<=31000,'a normal operator code wait is bounded by one real TOTP window');
            if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
            await page.getByLabel('Authenticator code', { exact: true }).fill(totp(actor.factor));
            await page.getByRole('button', { name: 'Verify', exact: true }).click();
            await page.waitForURL(url => url.pathname === '/dashboard');
            await expect(page.getByText(actor.email, { exact: true })).toBeVisible(); return { context, page };
        }
        async function rotateConfiguredFactor(actor:ConsoleBrowserActor,factor:string){
            assert.ok(actors.some(row=>row.id===actor.id));assert.match(factor,/^[A-Z2-7]{16,64}$/);
            // Controlled per-account configuration change in the owned local
            // process. No source, host profile or real secret is modified.
            for(const page of pages)if(!page.isClosed())await page.goto('about:blank');
            await stopOwnedClientRuntime(identity);identity=undefined;
            actor.factor=factor;identityEnv.PLATFORM_CONSOLE_TOTP_SECRETS=JSON.stringify(Object.fromEntries(actors.map(row=>[row.email,row.factor])));
            await startIdentity();
            await warmRoutes();
        }
        await run({ loseNextJobApprovalReply:()=>{loseJobApprovalReply=true;},loseNextJobExecutionReply:()=>{loseJobExecutionReply=true;},origin,identityOrigin,setIssuerAvailable,loseNextOperatorExchangeReply:()=>{loseOperatorExchangeReply=true;}, browser, actors, login, calls,rotateConfiguredFactor,loseNextMfaExecutionReply:()=>{loseMfaReply=true;}, loseNextApprovalReply: () => { loseApprovalReply = true; }, loseNextMoneyExecutionReply: () => { loseMoneyExecutionReply = true; } });
        assert.deepEqual(errors, [], 'normal protected-action UI has no uncaught page errors');
    } catch (error) {
        console.info('OWNED_CONSOLE_CONSENT_BROWSER_FAILURE ' + JSON.stringify({ calls: calls.slice(-18), diagnostics, errors, browserTrace: browserTrace.slice(-20),
            pages: await Promise.all(pages.map(async page => ({ path: new URL(page.url()).pathname,
                text: await page.locator('body').innerText().catch(() => '') }))) }));
        for (let index = 0; index < pages.length; index++) await pages[index].screenshot({ path: `${ownedTmpDir()}/letbuyy-consent-${owned.runId}-${index}.png` }).catch(() => undefined);
        throw error;
    } finally {
        await browser?.close(); await stopOwnedClientRuntime(app);await stopOwnedClientRuntime(identity); await gateway.settle();
        if (adapter) { adapter.closeAllConnections(); await new Promise<void>(resolve => adapter!.close(() => resolve())); }
    }
}

export {totp as consoleBrowserTotp};
