import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const exportRoute = read('services/api-gateway/src/routes/export.ts');
const importProxy = read('apps/merchant/web/src/app/api/stores/[store]/products/import/route.ts');
const exportPage = read('apps/merchant/web/src/app/[store]/export/page.tsx');

test('gateway CSV export routes enqueue async R2-backed jobs', () => {
  for (const fragment of [
    'c.executionCtx.waitUntil(processProductsExport(c, job.id))',
    'c.executionCtx.waitUntil(processOrdersExport(c, job.id))',
    'streamCsvToR2',
    'bucket.createMultipartUpload(key, { httpMetadata })',
    'signedDownloadUrl',
    "router.get('/jobs/:id/download'",
    'R2_BUCKET',
  ]) {
    assert.ok(exportRoute.includes(fragment), fragment);
  }
});

test('gateway CSV export no longer performs unbounded select star or in-memory CSV joins', () => {
  assert.doesNotMatch(exportRoute, /\.select\('\*'\)/);
  assert.doesNotMatch(exportRoute, /rows\.join\('\\n'\)/);
  assert.match(exportRoute, /PRODUCT_EXPORT_SELECT/);
  assert.match(exportRoute, /ORDER_EXPORT_SELECT/);
  assert.match(exportRoute, /\.range\(from, from \+ EXPORT_BATCH_SIZE - 1\)/);
});

test('product CSV import is capped and processed as an async job', () => {
  const contract = read('packages/shared-types/src/product-import.ts');
  const csv = read('services/api-gateway/src/execution/product-csv-input.ts');
  assert.match(contract, /PRODUCT_IMPORT_MAX_ROWS = 500/);
  assert.match(csv, /PRODUCT_IMPORT_MAX_ROWS/);
  assert.match(csv, /IMPORT_TOO_LARGE/);
  assert.match(exportRoute, /c\.executionCtx\.waitUntil\(service\.process\(jobId\)/);
  assert.match(importProxy, /status:202/);
  assert.match(exportPage, /products\/import/);
  assert.match(exportPage, /Open CSV imports/);
  assert.doesNotMatch(exportPage, /Successfully imported/);
});
