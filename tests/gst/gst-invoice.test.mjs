import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const { z } = createRequire(new URL('../../packages/checkout-core/package.json',import.meta.url))('zod');

const CHECKOUT_CORE_SOURCE = 'packages/checkout-core/src/index.ts';

function createSchema(parseFn = (value) => ({ success: true, data: value })) {
  const schema = function schema() {};
  const chain = new Proxy(schema, {
    get(target, property) {
      if (property === 'safeParse') return parseFn;
      if (property === 'parse') {
        return (value) => {
          const result = parseFn(value);
          if (!result.success) throw result.error || new Error('Schema parse failed');
          return result.data;
        };
      }
      if (property === 'optional' || property === 'nullable' || property === 'default' || property === 'passthrough' || property === 'strict') {
        return () => chain;
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return chain;
}

function createRegexSchema(regex, normalize = (value) => String(value)) {
  return createSchema((value) => {
    const data = normalize(value);
    if (regex.test(data)) return { success: true, data };
    return { success: false, error: new Error(`Value does not match ${regex}`) };
  });
}

function createZodStub() {
  const generic = createSchema();
  const z = {
    string: () => generic,
    number: () => generic,
    boolean: () => generic,
    unknown: () => generic,
    date: () => generic,
    enum: () => generic,
    literal: () => generic,
    union: () => generic,
    array: () => generic,
    record: () => generic,
    object: () => generic,
    coerce: {
      number: () => generic,
      date: () => generic,
    },
  };

  return { z };
}

function loadCheckoutCore() {
  const source = readFileSync(CHECKOUT_CORE_SOURCE, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const amounts = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync('packages/shared-types/src/gst-amounts.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: amounts, exports: amounts.exports, Math });
  const module = { exports: {} };
  const generic = createSchema();
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier === 'zod') return { z };
      if (specifier === '@letbuyy/shared-types') {
        return {
          calculateGstAmounts: amounts.exports.calculateGstAmounts,
          AddressSchema: generic,
          CurrencySchema: generic,
          DraftOrderStatusSchema: generic,
          EmailSchema: generic,
          MoneySchema: generic,
          PaginationQuery: generic,
          UuidSchema: generic,
          GstinSchema: createRegexSchema(
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
            (value) => String(value).trim().toUpperCase(),
          ),
          HsnCodeSchema: createRegexSchema(/^\d{4,8}$/, (value) => String(value).trim()),
          IndianStateCodeSchema: createRegexSchema(/^(0[1-9]|[12][0-9]|3[0-8]|97)$/, (value) => String(value).trim().padStart(2, '0')),
        };
      }
      if (specifier === '@letbuyy/commerce-core') return {
        PersonalizationCartDraftSchema: generic,
        readProductFactSnapshot() { throw new Error('Order snapshot execution is outside this GST arithmetic unit.'); },
      };
      throw new Error(`Unexpected test require from ${CHECKOUT_CORE_SOURCE}: ${specifier}`);
    },
    Date,
    Math,
    Number,
    String,
    RegExp,
    JSON,
    Array,
    Object,
    console,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: CHECKOUT_CORE_SOURCE });
  return module.exports;
}

const checkoutCore = loadCheckoutCore();

const baseInvoiceInput = {
  order_id: 'order_gst_001',
  order_number: 'LBY-1001',
  invoice_date: '2026-06-01T00:00:00.000Z',
  currency: 'INR',
  supplier: {
    name: 'LetBuyy Demo Seller',
    gstin: '29ABCDE1234F1Z5',
    state: 'Karnataka',
  },
  lines: [
    {
      id: 'line_001',
      product_id: null,
      variant_id: null,
      description: 'Leather sneakers',
      sku: 'SNKR-KA-001',
      hsn_code: '640399',
      quantity: 1,
      unit_amount_minor: 100000,
      discount_amount_minor: 0,
      gst_rate_bps: 1800,
      tax_inclusive: false,
    },
  ],
};

test('GST invoice generation splits same-state tax into CGST and SGST', () => {
  const invoice = checkoutCore.generateGstInvoice({
    ...baseInvoiceInput,
    recipient: {
      name: 'Bengaluru Buyer',
      gstin: '29ABCDE1234F2Z4',
      state: 'Karnataka',
    },
  });

  assert.equal(invoice.invoice_number, 'LBY-20260601-LBY-1001');
  assert.equal(invoice.supply_type, 'intra_state');
  assert.equal(invoice.place_of_supply_state_code, '29');
  assert.equal(invoice.taxable_amount_minor, 100000);
  assert.equal(invoice.cgst_amount_minor, 9000);
  assert.equal(invoice.sgst_amount_minor, 9000);
  assert.equal(invoice.igst_amount_minor, 0);
  assert.equal(invoice.tax_amount_minor, 18000);
  assert.equal(invoice.total_amount_minor, 118000);
  assert.equal(invoice.lines[0].hsn_code, '640399');
});

test('GST invoice generation assigns inter-state tax to IGST', () => {
  const invoice = checkoutCore.generateGstInvoice({
    ...baseInvoiceInput,
    recipient: {
      name: 'Mumbai Buyer',
      gstin: '27ABCDE1234F1Z5',
      state: 'Maharashtra',
    },
  });

  assert.equal(invoice.supply_type, 'inter_state');
  assert.equal(invoice.place_of_supply_state_code, '27');
  assert.equal(invoice.cgst_amount_minor, 0);
  assert.equal(invoice.sgst_amount_minor, 0);
  assert.equal(invoice.igst_amount_minor, 18000);
  assert.equal(invoice.tax_amount_minor, 18000);
  assert.equal(invoice.total_amount_minor, 118000);
});
