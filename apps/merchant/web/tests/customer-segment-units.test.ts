import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server'
import { createLetbuyyApiClient } from '@letbuyy/api-client'
import { CreateCustomerSegmentSchema, buildCustomerSummaries } from '@letbuyy/commerce-core'
import { buildFormState, formStateToRules } from '../src/lib/customers/segment-form'

test('segment create and edit retain the same rupee threshold as commerce customer totals', () => {
    const totals = buildCustomerSummaries([], [{
        id: 'order-one', customer_email: 'buyer@example.test', total: 150.75,
    }])
    assert.equal(totals[0]?.total_spent, 150.75)
    const form = buildFormState()
    form.name = 'Repeat buyers'
    form.minSpentRupees = '150.75'
    const input = CreateCustomerSegmentSchema.parse({
        store_id: 'a0000000-0000-4000-8000-000000000001', name: form.name,
        rules: formStateToRules(form),
    })
    assert.equal(input.rules.min_total_spent, totals[0]?.total_spent,
        'customer totals and segment minimum spend must use the same currency unit')
    const edited = buildFormState({ name: input.name, description: null, rules: input.rules })
    assert.equal(edited.minSpentRupees, '150.75')
    assert.deepEqual(formStateToRules(edited), input.rules)
})

test('segment forms preserve zero, fractional rupees, no-marketing consent, status and inclusive UTC dates', () => {
    for (const amount of [0, 0.01, 5000, 99999999.99]) {
        const form = buildFormState({ name: 'Saved', description: 'Details', rules: {
            status: 'disabled', accepts_marketing: false, tags_any: ['vip'], min_order_count: 0,
            min_total_spent: amount, last_order_after: '2026-10-01T00:00:00.000Z',
            last_order_before: '2026-10-30T23:59:59.999Z',
        } })
        const rules = formStateToRules(form)
        assert.equal(rules.min_total_spent, amount)
        assert.equal(rules.min_order_count, 0)
        assert.equal(rules.accepts_marketing, false)
        assert.equal(rules.status, 'disabled')
        assert.deepEqual(rules.tags_any, ['vip'])
        assert.equal(rules.last_order_after, '2026-10-01T00:00:00.000Z')
        assert.equal(rules.last_order_before, '2026-10-30T23:59:59.999Z')
    }
    assert.equal(formStateToRules(buildFormState()).min_total_spent, undefined)
})

test('the actual segment edit BFF binds an ID-addressed command to its resolved route store', async () => {
    const site = 'a0000000-0000-4000-8000-000000000001'
    const segmentId = 'b0000000-0000-4000-8000-000000000002'
    const calls: string[] = []
    const dependencies: Record<string, unknown> = {
        'next/server': { NextRequest, NextResponse },
        '@/lib/stores/resolve-owned-store': { resolveOwnedStoreId: async () => ({ storeId: site }) },
        '@/lib/api/client': {
            createMerchantApiClient: (storeId?: string) => createLetbuyyApiClient({ baseUrl: 'https://gateway.synthetic.invalid/v1', storeId, fetch: async (input, init) => {
                const request = new Request(input, init)
                calls.push(request.url)
                assert.equal(request.headers.get('X-Store-ID'), site, 'the route store must constrain the segment ID lookup')
                assert.deepEqual(await request.json(), { name: 'Edited' })
                return Response.json({ success: true, data: { id: segmentId, store_id: site, name: 'Edited', rules: { tags_any: [] } } })
            } }),
            merchantApiErrorResponse: () => NextResponse.json({ error: 'Unavailable' }, { status: 503 }),
        },
    }
    const source = readFileSync(new URL('../src/app/api/stores/[store]/customers/segments/[id]/route.ts', import.meta.url), 'utf8')
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
    const handlers = {} as { PATCH: (request: NextRequest, context: { params: Promise<{ store: string; id: string }> }) => Promise<Response> }
    new Function('require', 'exports', compiled)((name: string) => { assert.ok(dependencies[name], name); return dependencies[name] }, handlers)
    const response = await handlers.PATCH(new NextRequest('https://admin.synthetic.invalid/api/stores/a/customers/segments/' + segmentId, { method: 'PATCH', body: JSON.stringify({ name: 'Edited' }) }), { params: Promise.resolve({ store: 'a', id: segmentId }) })
    assert.equal(response.status, 200)
    assert.deepEqual(calls, ['https://gateway.synthetic.invalid/v1/customers/segments/' + segmentId])
})
