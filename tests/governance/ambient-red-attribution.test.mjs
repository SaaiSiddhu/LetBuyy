// F-GATE-1 — every offender of a known-red validator must be classified, and the red must still exist.
//
// WHY. An inherited red is not neutral background. It can be load-bearing — `@letbuyy/infrastructure`'s
// familiar typecheck failure was cancelling sixteen packages, so the canonical backend was never
// typechecked at all — and it can ABSORB a new finding, which is what happened here:
// `17_remaining_migration_backlog.md` §7 classifies `environment-validator` as a pure Firebase false
// positive, and its offender list has since gained a Dart payment file nobody attributed.
//
// The same section also carried a bullet blaming `foundation-antifabrication-gate` on
// `firebase_bridge/src/commissionService.ts`. That tree was deleted; the gate passes. A register that
// only ever grows is a register nobody trusts, so this guard fails in BOTH directions: an
// unclassified offender fails, and a validator that has started passing fails too, with instructions
// to remove it.
//
// Paths are extracted by matching what a repository path LOOKS like, not by guessing where each
// validator's message ends. Parsing "everything after the last colon" would break the moment a
// validator worded its message differently — and every wrong sweep this session came from assuming a
// boundary instead of matching the thing itself.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Generated directories the real gate lane deletes before it runs. A path ending in one of these is
// a build artefact, not a repository fact.
const GENERATED = /(?:^|\/)(?:node_modules|\.turbo|\.next|dist|build|coverage|\.cache|\.dart_tool|\.wrangler|\.vercel|\.symlinks)(?:\/|$)/;

// Each known-red validator, with a rule that must account for EVERY offender it reports.
const KNOWN_REDS = [
    {
        validator: 'environment-validator',
        why: 'flags tracked files containing secret-like values',
        classify(path) {
            // Google's own documented public client identifiers (AIza…), classified NOT secrets in
            // docs/migration/repository_consolidation/00c_credential_exposure_and_rotation.md.
            if (/^apps\/customer_app\//.test(path)) {
                return 'firebase public client identifier (customer_app), not a secret';
            }
            // A Razorpay key ID is a public client identifier too, and this one is TEST mode. It is
            // NOT a credential exposure and carries no rotation obligation. It IS a latent
            // production-mode hazard: the file is exported from the package barrel, and an app that
            // picked it up would run checkout in Razorpay test mode, where payments appear to succeed
            // and settle nothing. Tracked in references/security.md §9; the fix is D-10 client work.
            if (path === 'packages/dart/marketplace_services/lib/src/custom_payment_service.dart') {
                return 'razorpay TEST-mode key id in exported donor code — latent production-mode hazard, not an exposure';
            }
            return null;
        },
    },
    {
        validator: 'stale-artifact-validator',
        why: 'flags generated artefacts present in the working tree',
        classify(path) {
            return GENERATED.test(path) ? 'generated directory the real gate lane deletes first' : null;
        },
    },
];

// Validators this register USED to carry and that now pass. Kept so the removal is deliberate rather
// than forgotten, and so the backlog's stale bullet cannot come back.
const RETIRED_REDS = {
    'foundation-antifabrication-gate': 'its sole offender was services/compatibility/firebase_bridge, deleted by FB-1; the gate now passes',
};

function runValidator(name) {
    try {
        const stdout = execFileSync('node', [`scripts/validators/${name}.mjs`], {
            cwd: repoRoot,
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
        });
        return { passed: true, output: stdout };
    } catch (error) {
        return { passed: false, output: `${error.stdout || ''}${error.stderr || ''}` };
    }
}

// Positive match on repository-path shape. Nothing here depends on the validator's phrasing.
function offenderPaths(output) {
    const pattern = /\b(?:apps|packages|services|scripts|config|database|tests|tools|docs|infra)\/[A-Za-z0-9_.@/-]+/g;
    return [...new Set(output.match(pattern) || [])].sort();
}

for (const red of KNOWN_REDS) {
    const { passed, output } = runValidator(red.validator);

    test(`${red.validator} still fails, so the register is not stale`, () => {
        // The direction that let the backlog keep a bullet for a tree that had been deleted.
        assert.equal(
            passed,
            false,
            `${red.validator} now PASSES — remove it from KNOWN_REDS and from the gate's inherited-red list, `
            + 'rather than leaving a register entry that describes a failure nobody has seen for months',
        );
    });

    const offenders = offenderPaths(output);

    test(`${red.validator} reports offenders this guard can actually see`, () => {
        // Non-vacuity: an extraction that found nothing would classify nothing and pass.
        assert.ok(offenders.length > 0, `no offender paths extracted from ${red.validator} — the guard would be inert`);
    });

    test(`every ${red.validator} offender is classified`, () => {
        const unclassified = offenders.filter((path) => !red.classify(path));
        assert.deepEqual(
            unclassified,
            [],
            `a NEW offender has joined a known red (${red.validator}, which ${red.why}). An inherited red `
            + 'absorbs new findings silently: attribute each of these and add it to the classifier, or fix it. '
            + 'Do not widen the classifier to make the red familiar again.',
        );
    });
}

for (const [name, reason] of Object.entries(RETIRED_REDS)) {
    test(`${name} is retired and stays green`, () => {
        const { passed, output } = runValidator(name);
        assert.ok(passed, `${name} is recorded as retired (${reason}) but is failing again:\n${output}`);
    });
}

test('the classifiers are specific, not catch-alls', () => {
    // A classifier that accepted anything would make the guard decorative. Each must reject a path
    // that is plainly not its concern.
    const environment = KNOWN_REDS.find((r) => r.validator === 'environment-validator');
    const stale = KNOWN_REDS.find((r) => r.validator === 'stale-artifact-validator');
    assert.equal(environment.classify('services/api-gateway/src/routes/payments.ts'), null);
    assert.equal(environment.classify('packages/dart/marketplace_services/lib/src/other_service.dart'), null);
    assert.equal(stale.classify('apps/customer_web/src/app/page.tsx'), null);
    // And each must still accept its own.
    assert.ok(environment.classify('apps/customer_app/lib/firebase_options.dart'));
    assert.ok(stale.classify('packages/auth-core/dist'));
});
