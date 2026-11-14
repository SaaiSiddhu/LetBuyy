/** Read-only local performance verification. Requires Node >=22.19, the
 * installed Playwright browser and an explicitly supplied Lighthouse CLI.
 * Both original simulation and applied-throttling lanes retain their results.
 * A passing diagnostic/observed result cannot waive the simulator budget.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { access, mkdir, mkdtemp, readFile, writeFile, open } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { summarizePerformance } from './performance-results.mts'

const require = createRequire(import.meta.url)
const options = new Map()
for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index]
    const value = process.argv[index + 1]
    if (!['--origin', '--output', '--lighthouse', '--chrome', '--repeats', '--locale'].includes(key) || !value || options.has(key)) {
        throw new Error('Use --origin, --output and --lighthouse; optional: --chrome, --repeats and --locale')
    }
    options.set(key, value)
}

async function main() {
    const origin = new URL(options.get('--origin') ?? 'http://127.0.0.1:9006')
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || !['http:', 'https:'].includes(origin.protocol) ||
        origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
        throw new Error('Only a loopback origin without credentials, path or query is supported')
    }
    const locale = options.get('--locale') ?? 'in'
    if (!['in', 'in-hi', 'in-ta'].includes(locale)) throw new Error('Use a configured marketing locale')
    const repeats = Number(options.get('--repeats') ?? 3)
    if (!Number.isInteger(repeats) || repeats < 3 || repeats > 5) throw new Error('Use three to five repetitions')
    if (!options.has('--lighthouse') || !options.has('--output')) throw new Error('--lighthouse and --output are required; no dependencies are downloaded')
    const lighthouse = resolve(options.get('--lighthouse'))
    const chrome = options.has('--chrome') ? resolve(options.get('--chrome')) : require('@playwright/test').chromium.executablePath()
    await Promise.all([access(lighthouse), access(chrome)])
    const output = resolve(options.get('--output'))
    await mkdir(output, { recursive: true })
    const directory = await mkdtemp(join(output, 'run-'))
    const targets = [`/${locale}/pricing`, `/${locale}/resources/platform/building-first-letbuyy-store`]
    const samples = []
    const settings = []
    let lastSummary
    for (let repeat = 1; repeat <= repeats; repeat++) {
        for (const method of ['simulate', 'devtools']) {
            for (const [index, target] of targets.entries()) {
                const name = `${index === 0 ? 'pricing' : 'guide'}-${method}-${repeat}`
                const file = join(directory, `${name}.json`)
                const log = await open(join(directory, `${name}.log`), 'w')
                const args = [lighthouse, new URL(target, origin).href, '--chrome-flags=--headless --no-first-run',
                    `--throttling-method=${method}`, '--only-categories=performance', '--output=json', `--output-path=${file}`, '--quiet', '--save-assets']
                let timer
                let exitCode
                try {
                    const child = spawn(process.execPath, args, { env: { ...process.env, CHROME_PATH: chrome }, stdio: ['ignore', log.fd, log.fd] })
                    exitCode = await new Promise((done, reject) => {
                        timer = setTimeout(() => child.kill('SIGTERM'), 180_000)
                        child.once('error', reject)
                        child.once('close', code => done(code ?? 1))
                    })
                } finally {
                    clearTimeout(timer)
                    await log.close()
                }
                let report
                try { report = JSON.parse(await readFile(file, 'utf8')) } catch { report = {} }
                const audits = report.audits ?? {}
                const sample = {
                    target, method, repeat, role: 'acceptance', exitCode,
                    runtimeError: report.runtimeError ?? (report.audits ? null : 'No usable Lighthouse report'),
                    lcpMs: audits['largest-contentful-paint']?.numericValue ?? null,
                    tbtMs: audits['total-blocking-time']?.numericValue ?? null,
                    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
                }
                samples.push(sample)
                settings.push({ name, lighthouseVersion: report.lighthouseVersion ?? null,
                    userAgent: report.environment?.hostUserAgent ?? report.userAgent ?? null, settings: report.configSettings ?? null })
                lastSummary = { capturedAt: new Date().toISOString(), origin: origin.origin, samples, settings,
                    ...summarizePerformance(samples, targets) }
                await writeFile(join(directory, 'summary.json'), `${JSON.stringify(lastSummary, null, 2)}\n`)
                process.stdout.write(`${name}: LCP=${sample.lcpMs}ms TBT=${sample.tbtMs}ms CLS=${sample.cls}\n`)
            }
        }
    }
    process.stdout.write(`${JSON.stringify({ directory, originalSimulatedTargetMet: lastSummary.originalSimulatedTargetMet,
        appliedLabTargetMet: lastSummary.appliedLabTargetMet, allRequiredLanesPass: lastSummary.allRequiredLanesPass })}\n`)
    process.exitCode = lastSummary.allRequiredLanesPass ? 0 : 1
}

main().catch(error => {
    process.stderr.write(`Performance verification did not complete: ${error.message}\n`)
    process.exitCode = 1
})
