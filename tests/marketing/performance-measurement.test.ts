import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizePerformance, type PerformanceSample } from '../../scripts/marketing/performance-results.mts'

const targets = ['/pricing', '/guide']
function completeSamples(): PerformanceSample[] {
    return targets.flatMap(target => (['simulate', 'devtools'] as const).flatMap(method =>
        [1, 2, 3].map(repeat => ({ target, method, repeat, role: 'acceptance' as const,
            exitCode: 0, runtimeError: null, lcpMs: 2000, tbtMs: 0, cls: 0 }))))
}

test('passing applied measurements never hide a failed original simulation lane', () => {
    const rows = completeSamples().map(row => row.method === 'simulate' ? { ...row, lcpMs: 3450 } : row)
    const result = summarizePerformance(rows, targets)
    assert.equal(result.appliedLabTargetMet, true)
    assert.equal(result.originalSimulatedTargetMet, false)
    assert.equal(result.allRequiredLanesPass, false)
})

test('one passing run or duplicated sample IDs cannot establish repeatability', () => {
    const rows = completeSamples()
    assert.equal(summarizePerformance(rows.filter(row => row.repeat === 1), targets).allRequiredLanesPass, false)
    assert.equal(summarizePerformance(rows.map(row => ({ ...row, repeat: 1 })), targets).allRequiredLanesPass, false)
    assert.equal(summarizePerformance(rows, targets).allRequiredLanesPass, true)
})

test('a diagnostic that changes delivery cannot satisfy site acceptance', () => {
    const result = summarizePerformance(completeSamples().map(row => ({ ...row, role: 'diagnostic' })), targets)
    assert.equal(result.diagnosticSamplesExcluded, 12)
    assert.equal(result.allRequiredLanesPass, false)
})

test('outliers, absent measurements and tool errors remain failures', () => {
    for (const change of [{ lcpMs: 2501 }, { tbtMs: 201 }, { cls: 0.101 }, { lcpMs: null },
        { lcpMs: Number.NaN }, { lcpMs: 0 }, { exitCode: 1 }, { runtimeError: { code: 'NO_LCP' } }]) {
        const rows = completeSamples()
        rows[0] = { ...rows[0], ...change }
        assert.equal(summarizePerformance(rows, targets).allRequiredLanesPass, false)
    }
})
