// Real browser integration: exact current checksum worker and Merchant response
// policy, served only on an owned ephemeral loopback port. No commerce/auth
// server, external network, provider, file upload or synthetic success is used.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createContentSecurityPolicy } from '../../config/security/next-security-headers';

test('the real incremental worker hashes under unchanged production CSP without dynamic evaluation', { timeout: 60_000 }, async () => {
  const prior = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const bundle = await build({ entryPoints: ['apps/merchant/web/src/components/reels/client-file-sha256.worker.ts'],
    bundle: true, write: false, platform: 'browser', format: 'iife' });
  const next = (await import('../../apps/merchant/web/next.config')).default;
  const rules = await next.headers!();
  const merchantPolicy = rules.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy')!.value;
  const defaultPolicy = createContentSecurityPolicy();
  const runner = `window.result=(async()=>{
    let evalBlocked=false;try{new Function('return 1')()}catch{evalBlocked=true}
    const large=new URL(location.href).searchParams.has('large');
    const block=large?new Uint8Array(1024*1024).fill(0x5a):null;
    const file=new File(large?Array(100).fill(block):['abc'],'synthetic.mp4',{type:'video/mp4'});
    let ticks=0;const timer=setInterval(()=>ticks++,1);
    const result=await new Promise(resolve=>{const worker=new Worker('./worker.js');
      worker.onmessage=event=>{worker.terminate();resolve(event.data)};
      worker.onerror=()=>{worker.terminate();resolve({error:'WORKER_FAILED'})};
      worker.postMessage({requestId:'owned-digest',file,maxBytes:104857600});
    });clearInterval(timer);return {evalBlocked,result,ticks};})();`;
  const server = createServer((request, response) => {
    response.setHeader('Content-Security-Policy', request.url?.startsWith('/merchant/') ? merchantPolicy : defaultPolicy);
    if (request.url?.endsWith('/worker.js')) { response.setHeader('Content-Type', 'application/javascript'); response.end(bundle.outputFiles[0].contents); }
    else if (request.url?.endsWith('/runner.js')) { response.setHeader('Content-Type', 'application/javascript'); response.end(runner); }
    else { response.setHeader('Content-Type', 'text/html'); response.end('<script src="./runner.js"></script>'); }
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    for (const kind of ['default', 'merchant']) {
      await page.goto(`${origin}/${kind}/`);
      const observed = await page.evaluate(() => (window as unknown as { result: Promise<{ evalBlocked: boolean; result: { sha256?: string; bytes?: number; error?: string } }> }).result);
      assert.equal(observed.evalBlocked, true, `${kind}: dynamic JavaScript remains prohibited`);
      assert.equal(observed.result.error, undefined);
      assert.equal(observed.result.sha256, createHash('sha256').update('abc').digest('hex'));
      assert.equal(observed.result.bytes, 3);
      const policy = kind === 'merchant' ? merchantPolicy : defaultPolicy;
      assert.equal(policy.includes("'wasm-unsafe-eval'"), false);
    }
    await page.goto(`${origin}/merchant/?large=true`);
    const large = await page.evaluate(() => (window as unknown as { result: Promise<{ ticks: number; result: { sha256?: string; bytes?: number; error?: string } }> }).result);
    const expected = createHash('sha256'), block = Buffer.alloc(1024 * 1024, 0x5a);
    for (let i = 0; i < 100; i++) expected.update(block);
    assert.equal(large.result.error, undefined);
    assert.equal(large.result.sha256, expected.digest('hex'));
    assert.equal(large.result.bytes, 100 * 1024 * 1024);
    assert(large.ticks > 0, 'The main browser thread remains responsive during the 100MiB worker digest');
  } finally {
    await browser?.close(); server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (prior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prior;
  }
});
