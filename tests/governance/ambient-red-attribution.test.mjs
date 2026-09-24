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

// governance-common.mjs resolves the repository from the working directory, so pin it before importing.
process.chdir(repoRoot);
const { collectStaleArtifactOffenders } = await import('../../scripts/validators/governance-common.mjs');
const { createTrackedPathPredicate, planGeneratedArtifactCleanup } = await import('../../scripts/governance/validator-orchestrator.mjs');

// Each known-red validator, with a rule that must account for EVERY offender it reports.
const KNOWN_REDS = [
    {
        validator: 'environment-validator',
        why: 'flags tracked files containing secret-like values',
        classify(path) {
            // APPID-P2 (2026-09-24): LetBuyy's own Firebase and Maps client keys are now reviewed,
            // value-bound exceptions (config/governance/secret-scan-exceptions.json), so they no longer
            // reach this list, and a whole-app prefix rule here would absorb the next real finding in the
            // same app. What remains is not a LetBuyy key at all: the Marketplace web service worker
            // initialises Agrimore's agrii-mate Firebase project. A genuine finding, recorded for the owner.
            if (path === 'apps/marketplace/mobile/web/firebase-messaging-sw.js') {
                return 'another product\'s Firebase project (agrii-mate) in the Marketplace web service worker: genuine finding, owner action';
            }
            return null;
        },
    },
];

// Validators this register USED to carry and that now pass. Kept so the removal is deliberate rather
// than forgotten, and so the backlog's stale bullet cannot come back. stale-artifact-validator sat here
// from 1e6cc4c3 until F-STALEMETHOD-1, on the premise that it flags only untracked, non-ignored files.
// It never did, and the entry failed in every installed worktree; it is classified by method below.
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
    const pattern = /\b(?:apps|packages|services|scripts|config|database|tests|tools|docs|infra|reference)\/[A-Za-z0-9_.@/-]+/g;
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

// F-STALEMETHOD-1 — stale-artifact-validator is red BY METHOD, so it is classified, not retired.
//
// Run alone, it flags every generated directory on disk (node_modules, .turbo, dist, …).
// listLocalArtifactDirectories() walks the filesystem and never consults .gitignore, and that is
// deliberate: scripts/validate-governance.mjs runs the generated-artifact cleanup immediately before
// this one validator, and the check is that cleanup's post-condition. So the red appears in every
// installed worktree and vanishes in an uninstalled one; neither "still fails" nor "stays green" holds.
//
// What must hold instead is that every offender is something the real lane deletes before the validator
// runs. The oracle is the orchestrator's own cleanup planner, not a pattern copied into this file. An
// untracked file, a workspace file, or a directory the planner refuses (tracked content, a symlink, too
// shallow) survives that cleanup and is a real finding. The offender set comes from the function the
// validator itself calls. Its printed list stops at 20, and a root-level offender does not look like a
// repository path, so parsing that output would miss both kinds.
function classifyStaleArtifactOffenders(found, cleanupTargets) {
    return {
        method: found.artifactDirectories.filter((dir) => cleanupTargets.has(dir)),
        genuine: [
            ...found.untrackedFiles,
            ...found.artifactDirectories.filter((dir) => !cleanupTargets.has(dir)),
            ...found.workspaceFiles,
        ],
    };
}

const staleFound = collectStaleArtifactOffenders();
const cleanupPlan = planGeneratedArtifactCleanup({
    repoRoot,
    startDirs: ['apps', 'packages', 'services'],
    isTracked: createTrackedPathPredicate(repoRoot),
});
const staleClassified = classifyStaleArtifactOffenders(
    staleFound,
    new Set(cleanupPlan.targets.map((target) => target.relPath)),
);

test('stale-artifact-validator: every offender is a generated directory the real lane deletes before it runs', () => {
    assert.deepEqual(
        staleClassified.genuine,
        [],
        'these would survive the gate lane\'s generated-artifact cleanup, so they are real findings, not the method: '
        + 'attribute each one or remove it. Do not widen the classification to make the red familiar again.',
    );
});

test("stale-artifact-validator's own verdict is exactly the offender set classified here", () => {
    // Ties the classification to the real validator run: the set above must be the set it judges.
    const { passed, output } = runValidator('stale-artifact-validator');
    const offenders = [...new Set([...staleFound.untrackedFiles, ...staleFound.artifactDirectories, ...staleFound.workspaceFiles])];
    assert.equal(passed, offenders.length === 0, `validator passed=${passed} but ${offenders.length} offenders were collected`);
    if (passed) return;
    const total = output.match(/\(showing \d+ of (\d+);/);
    if (total) {
        assert.equal(Number(total[1]), offenders.length, 'the validator reports a different total than the set classified here');
    } else {
        for (const offender of offenders) assert.ok(output.includes(offender), `the validator did not report ${offender}`);
    }
});

test('the by-method classification is specific, not a catch-all', () => {
    const { method, genuine } = classifyStaleArtifactOffenders({
        untrackedFiles: ['topology.txt'],
        artifactDirectories: ['packages/auth-core/dist', 'apps/internal/console/build'],
        workspaceFiles: ['apps/commerce/web/src/app/page.tsx.broken'],
    }, new Set(['packages/auth-core/dist']));
    assert.deepEqual(method, ['packages/auth-core/dist']);
    // A root-level scan file, a directory the cleanup would not delete, and a source backup are all genuine.
    assert.deepEqual(genuine, ['topology.txt', 'apps/internal/console/build', 'apps/commerce/web/src/app/page.tsx.broken']);
});

test('the classifiers are specific, not catch-alls', () => {
    // A classifier that accepted anything would make the guard decorative. Each must reject a path
    // that is plainly not its concern.
    const environment = KNOWN_REDS.find((r) => r.validator === 'environment-validator');
    assert.equal(environment.classify('services/api-gateway/src/routes/payments.ts'), null);
    assert.equal(environment.classify('packages/dart/marketplace_services/lib/src/other_service.dart'), null);
    // The app's reviewed Firebase config is an exception now; a new offender beside it is a finding.
    assert.equal(environment.classify('apps/marketplace/mobile/lib/firebase_options.dart'), null);
    // And each must still accept its own.
    assert.ok(environment.classify('apps/marketplace/mobile/web/firebase-messaging-sw.js'));
});
