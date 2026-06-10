import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const LOGISTICS_ADAPTER_SOURCE = 'packages/infrastructure/logistics-adapter/index.ts';
const ORDERS_ROUTE_SOURCE = 'services/api-gateway/src/routes/orders.ts';

function loadTypeScriptModule(sourcePath) {
  const source = readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      throw new Error(`Unexpected test require from ${sourcePath}: ${specifier}`);
    },
    Date,
    Math,
    Number,
    String,
    RegExp,
    JSON,
    Array,
    Object,
    encodeURIComponent,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });
  return module.exports;
}

const logistics = loadTypeScriptModule(LOGISTICS_ADAPTER_SOURCE);

test('Shiprocket scaffold creates fulfilment-ready label and tracking fields', async () => {
  const provider = logistics.createShiprocketLogisticsProvider({ mode: 'sandbox' });
  const label = await provider.createLabel({
    orderId: 'order_001',
    orderNumber: 'LBY-1001',
    idempotencyKey: 'fulfillment-order-001',
    destination: {
      name: 'Mumbai Buyer',
      phone: '+919999999999',
      email: 'buyer@example.com',
      line1: '42 Linking Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400050',
      country: 'IN',
    },
    parcels: [{ weightGrams: 750, lengthCm: 30, widthCm: 20, heightCm: 10 }],
  });

  assert.equal(label.provider, 'shiprocket');
  assert.equal(label.carrier, 'Shiprocket');
  assert.equal(label.status, 'label_created');
  assert.equal(label.testMode, true);
  assert.match(label.trackingNumber, /^SRLBY1001/);
  assert.match(label.labelUrl, /shiprocket\/labels\/shiprocket_ORDER001_750\.pdf$/);

  const fields = logistics.toFulfillmentTrackingFields(label);
  assert.equal(fields.carrier, 'Shiprocket');
  assert.equal(fields.tracking_number, label.trackingNumber);
  assert.equal(fields.tracking_url, label.trackingUrl);
});

test('Logistics provider scaffolds cover Delhivery and Pickrr tracking', async () => {
  const delhivery = logistics.createDelhiveryLogisticsProvider({ mode: 'sandbox', now: () => new Date('2026-06-01T00:00:00.000Z') });
  const pickrr = logistics.createPickrrLogisticsProvider({ mode: 'sandbox' });

  const delhiveryTracking = await delhivery.getTracking({ trackingNumber: 'DLVTEST001' });
  const pickrrLabel = await pickrr.createLabel({
    orderId: 'order_002',
    orderNumber: 'LBY-1002',
    idempotencyKey: 'fulfillment-order-002',
    destination: {
      name: 'Bengaluru Buyer',
      line1: '11 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'IN',
    },
    parcels: [{ weightGrams: 500 }],
  });

  assert.equal(delhiveryTracking.carrier, 'Delhivery');
  assert.equal(delhiveryTracking.events[0].occurredAt, '2026-06-01T00:00:00.000Z');
  assert.equal(pickrrLabel.carrier, 'Pickrr');
  assert.match(pickrrLabel.trackingUrl, /tracking_id=/);
});

test('Fulfilment route is wired to the logistics adapter before RPC fulfilment', () => {
  const source = readFileSync(ORDERS_ROUTE_SOURCE, 'utf8');

  assert.match(source, /createLogisticsProvider/);
  assert.match(source, /toFulfillmentTrackingFields/);
  assert.match(source, /applyLogisticsLabel/);
  assert.match(source, /service\.fulfillOrder\(orderId, tenant, fulfillmentInput\)/);
});
