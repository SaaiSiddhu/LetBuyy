export const PERFORMANCE_BUDGETS = { lcpMs: 2500, tbtMs: 200, cls: 0.1 } as const

export interface PerformanceSample {
    target: string
    method: 'simulate' | 'devtools'
    repeat: number
    role: 'acceptance' | 'diagnostic'
    exitCode: number
    runtimeError: unknown
    lcpMs: number | null
    tbtMs: number | null
    cls: number | null
}

function median(values: number[]): number | null {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function meetsBudgets(sample: PerformanceSample): boolean {
    return sample.exitCode === 0 && !sample.runtimeError &&
        sample.lcpMs !== null && Number.isFinite(sample.lcpMs) && sample.lcpMs > 0 && sample.lcpMs <= PERFORMANCE_BUDGETS.lcpMs &&
        sample.tbtMs !== null && Number.isFinite(sample.tbtMs) && sample.tbtMs >= 0 && sample.tbtMs <= PERFORMANCE_BUDGETS.tbtMs &&
        sample.cls !== null && Number.isFinite(sample.cls) && sample.cls >= 0 && sample.cls <= PERFORMANCE_BUDGETS.cls
}

/** Keep model predictions, applied lab measurements and diagnostic experiments
 * separate. Passing observed runs must never erase a failed simulator lane. */
export function summarizePerformance(samples: PerformanceSample[], targets: string[]) {
    if (!targets.length || new Set(targets).size !== targets.length) throw new Error('Unique targets are required')
    const lanes = targets.flatMap(target => (['simulate', 'devtools'] as const).map(method => {
        const rows = samples.filter(row => row.role === 'acceptance' && row.target === target && row.method === method)
        const repeats = new Set(rows.map(row => row.repeat))
        const complete = rows.length >= 3 && repeats.size === rows.length &&
            rows.every(row => Number.isInteger(row.repeat) && row.repeat > 0)
        const measured = rows.map(row => row.lcpMs).filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
        return {
            target, method, samples: rows.length, complete,
            passedSamples: rows.filter(meetsBudgets).length,
            medianLcpMs: median(measured),
            status: !complete ? 'incomplete' as const : rows.every(meetsBudgets) ? 'pass' as const : 'fail' as const,
        }
    }))
    return {
        budgets: PERFORMANCE_BUDGETS,
        minimumRepeatsPerLane: 3,
        lanes,
        originalSimulatedTargetMet: lanes.filter(lane => lane.method === 'simulate').every(lane => lane.status === 'pass'),
        appliedLabTargetMet: lanes.filter(lane => lane.method === 'devtools').every(lane => lane.status === 'pass'),
        allRequiredLanesPass: lanes.every(lane => lane.status === 'pass'),
        diagnosticSamplesExcluded: samples.filter(row => row.role === 'diagnostic').length,
        fieldCoreWebVitalsMeasured: false,
    }
}
