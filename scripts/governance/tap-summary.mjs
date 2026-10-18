// Reading a `node --test` TAP stream into counts, and the one rule for calling a group green.
//
// Green requires all four of: the process exited 0, a TAP summary was seen, no test failed, no test
// was cancelled. Any one alone is not enough: a nested runner can exit 0 while tests fail (see
// NODE_TEST_CONTEXT in test-behavioral.mjs), and a crash can exit non-zero with a clean-looking
// summary line from an earlier file.

const SUMMARY = /^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$/;

export function newStats(label, suites) {
    return {
        label, suites, code: null, hasSummary: false,
        tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0,
        failing: [], skips: [], todos: [],
    };
}

export function consumeTapLine(stats, line) {
    const summary = SUMMARY.exec(line);
    if (summary) {
        if (summary[1] !== 'suites') stats[summary[1]] = Number(summary[2]);
        stats.hasSummary = true;
        return;
    }
    const todo = /^(?:not )?ok \d+ - (.*?) # TODO/.exec(line);
    if (todo) { stats.todos.push(todo[1]); return; }
    const skip = /^ok \d+ - (.*?) # SKIP\s*(.*)$/.exec(line);
    if (skip) { stats.skips.push(skip[2] ? `${skip[1]} (${skip[2]})` : skip[1]); return; }
    const failure = /^not ok \d+ - (.*)$/.exec(line);
    if (failure) stats.failing.push(failure[1].replace(/ \([0-9.]+ms\)$/, ''));
}

export function parseTap(text, label = 'tap') {
    const stats = newStats(label, null);
    for (const line of text.split('\n')) consumeTapLine(stats, line);
    return stats;
}

export function groupFailed(group) {
    return group.code !== 0 || !group.hasSummary || group.fail > 0 || group.cancelled > 0;
}

export function groupStatus(group) {
    if (!groupFailed(group)) return 'ok';
    return group.hasSummary ? 'FAIL' : 'FAIL (no summary)';
}

export function totalOf(groups) {
    const total = newStats('TOTAL', null);
    for (const group of groups) {
        for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) total[key] += group[key];
        total.failing.push(...group.failing.map((title) => `[${group.label}] ${title}`));
        total.skips.push(...group.skips.map((title) => `[${group.label}] ${title}`));
        total.todos.push(...group.todos.map((title) => `[${group.label}] ${title}`));
    }
    return total;
}

export function isHealthy(groups) {
    return groups.length > 0 && groups.every((group) => !groupFailed(group));
}
