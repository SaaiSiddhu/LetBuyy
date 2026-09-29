#!/usr/bin/env node
// The root behavioral gate: every `tests/<dir>/*.test.mjs` suite, each in the environment it needs,
// with one aggregate result that cannot read green when any part is red.
//
// HISTORY
// SUSTAINED-J wrapped `node --test --test-concurrency=1 tests/*/*.test.mjs` so the four
// destructive-guard suites got the dedicated container their guard asks for. It left fifty-three
// other Postgres suites sharing one long-lived cluster (`letbuyy-executable-pg`), where cluster-global
// roles and half-dropped databases from an earlier suite, an earlier run or another session decide a
// later suite's result, and where two concurrent invocations race (recorded as a candidate phase in
// docs/evidence/appid-2026-09-24/SUSTAINED_J.md, workstream 2d). This version is that phase.
//
// WHAT RUNS WHERE (classification: scripts/governance/test-suite-catalog.mjs)
//   pure + live   `node --test --test-concurrency=1`, no database. The live suite (theme tenant
//                 isolation) reads an already-running Supabase database and reports its own suite-level
//                 skip when there is none; this wrapper surfaces that skip instead of hiding it.
//   postgres      scripts/governance/run-executable-suites.mjs: owned, disposable clusters, one suite
//                 at a time inside each, several clusters in parallel. The shared container is not used.
//   contracts     `pnpm run test:contracts` (tsx), only with --with-contracts (the root `test` script).
// Every group always runs: a failure in one never stops or hides another (the old `a && b` root script
// never ran the contract tests once the first part failed).
//
// Exit code: 0 only when every group is green by the rule in tap-summary.mjs.
//
// Usage: node scripts/governance/test-behavioral.mjs [--with-contracts] [--report <file.json>]

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSuites } from './test-suite-catalog.mjs';
import { consumeTapLine, groupStatus, isHealthy, newStats, totalOf } from './tap-summary.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const withContracts = args.includes('--with-contracts');
const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : null;

// An outer `node --test` sets NODE_TEST_CONTEXT; inherited by a nested runner it switches off the TAP
// summary and makes failing tests exit 0, which reads as a pass. Children never inherit it.
function childEnv() {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return env;
}

// Streams the child's output unchanged while reading its TAP summary, so the console looks exactly
// as it always did and the aggregate needs no second pass over a multi-megabyte log.
function runTapGroup(label, suites, command, commandArgs) {
    return new Promise((resolve) => {
        const stats = newStats(label, suites);
        const child = spawn(command, commandArgs, { cwd: repoRoot, env: childEnv() });
        let pending = '';
        const forward = (sink) => (chunk) => {
            sink.write(chunk);
            pending += chunk;
            for (let newline = pending.indexOf('\n'); newline >= 0; newline = pending.indexOf('\n')) {
                consumeTapLine(stats, pending.slice(0, newline));
                pending = pending.slice(newline + 1);
            }
        };
        child.stdout.on('data', forward(process.stdout));
        child.stderr.on('data', forward(process.stderr));
        child.on('error', (error) => { process.stderr.write(`test-behavioral: ${label}: ${error.message}\n`); });
        child.on('close', (code, signal) => {
            if (pending) consumeTapLine(stats, pending);
            stats.code = code ?? (signal ? 128 : 1);
            resolve(stats);
        });
    });
}

function runPostgresGroup(suites) {
    return new Promise((resolve) => {
        const stats = newStats('postgres (owned clusters)', suites.length);
        const jsonOut = join(mkdtempSync(join(tmpdir(), 'letbuyy-pg-group-')), 'runner.json');
        const child = spawn('node', ['scripts/governance/run-executable-suites.mjs', '--json-out', jsonOut], { cwd: repoRoot, env: childEnv(), stdio: 'inherit' });
        child.on('close', (code, signal) => {
            stats.code = code ?? (signal ? 128 : 1);
            try {
                const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
                stats.hasSummary = true;
                stats.suites = report.suites;
                for (const key of ['tests', 'cancelled', 'skipped', 'todo']) stats[key] = report[key];
                stats.pass = report.assertionsPassed;
                stats.fail = report.assertionsFailed;
                for (const result of report.results) {
                    for (const title of result.failures) stats.failing.push(`${result.path} :: ${title.replace(/^not ok \d+ - /, '')}`);
                    for (const title of result.skips) stats.skips.push(`${result.path} :: ${title.replace(/^ok \d+ - /, '')}`);
                    if (result.code !== 0 && result.failures.length === 0) {
                        stats.failing.push(`${result.path} :: exited ${result.code}${result.hasSummary ? '' : ' with no TAP summary'} without a failing test line`);
                    }
                }
            } catch {
                stats.hasSummary = false;
            }
            resolve(stats);
        });
    });
}

const { pure, postgres, live } = discoverSuites(repoRoot);
console.log(
    `test-behavioral: ${pure.length + postgres.length + live.length} suites -- ${pure.length} pure, ` +
    `${live.length} live-external (self-skipping), ${postgres.length} postgres (owned clusters)` +
    `${withContracts ? ', + tests/contracts' : ''}`,
);

const groups = [];
groups.push(await runTapGroup('pure + live', pure.length + live.length, 'node', ['--test', '--test-concurrency=1', ...pure, ...live]));
groups.push(await runPostgresGroup(postgres));
if (withContracts) groups.push(await runTapGroup('contracts', null, 'pnpm', ['run', 'test:contracts']));

const total = totalOf(groups);
const cell = (value, width) => String(value ?? '-').padStart(width);
console.log('\n=== test-behavioral summary ===');
console.log(`${'group'.padEnd(28)}${cell('suites', 8)}${cell('tests', 8)}${cell('pass', 8)}${cell('fail', 6)}${cell('cancel', 8)}${cell('skip', 6)}${cell('todo', 6)}  status`);
for (const group of [...groups, total]) {
    const status = group === total ? '' : groupStatus(group);
    console.log(`${group.label.padEnd(28)}${cell(group.suites, 8)}${cell(group.tests, 8)}${cell(group.pass, 8)}${cell(group.fail, 6)}${cell(group.cancelled, 8)}${cell(group.skipped, 6)}${cell(group.todo, 6)}  ${status}`);
}
if (total.failing.length > 0) {
    console.log(`\nFAILING (${total.failing.length}):`);
    for (const title of total.failing) console.log(`  ${title}`);
}
if (total.todos.length > 0) console.log(`\nTODO (${total.todos.length}):\n${total.todos.map((title) => `  ${title}`).join('\n')}`);
if (total.skips.length > 0) console.log(`\nSKIPPED (${total.skips.length}):\n${total.skips.map((title) => `  ${title}`).join('\n')}`);
if (live.length > 0) {
    console.log(`\nNOTE: live-external suite(s) ${live.join(', ')} self-skip at SUITE level when their database is absent; Node counts that under suites, not under "skip" above. Look for "# SKIP" in the pure + live output.`);
}

const healthy = isHealthy(groups);
if (reportPath) writeFileSync(reportPath, JSON.stringify({ healthy, groups, total }, null, 2));
console.log(`\ntest-behavioral: ${healthy ? 'PASS' : 'FAIL'}`);
process.exit(healthy ? 0 : 1);
