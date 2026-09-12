import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// F-ARCHIVEPATH-1. The `docs/archive/dead-code/merchant-control-plane` segment below is PROVENANCE, not a
// current app path: it records which runtime this dead code was cut from at the time it was cut.
// Phase M Stage 6's commit af492f21 rewrote these strings to a post-rename app name while renaming
// no archive file, and this guard pointed at a directory that has never existed from then until
// F-ARCHIVEPATH-1. Do not 'fix' these paths in a rename sweep — assert against the archive as it is.

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

const archivedComponents = [
    'EditorHeader',
    'ThemeSettingsPanel',
    'RightSidebar',
    'LeftSidebar',
    'SectionItem',
    'AddSectionModal',
    'IconRail',
];

const archivedHooks = [
    'useEditorUrl',
    'useEditorHistory',
];

function path(relativePath: string): string {
    return join(repoRoot, relativePath);
}

function read(relativePath: string): string {
    const absolutePath = path(relativePath);
    assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
    return readFileSync(absolutePath, 'utf8');
}

test('unused theme editor shell modules are archived outside active source', () => {
    for (const component of archivedComponents) {
        assert.equal(
            existsSync(path(`apps/merchant_web/src/components/theme-editor/${component}.tsx`)),
            false,
            `${component}.tsx must not exist under active theme-editor components`,
        );
        assert.equal(
            existsSync(path(`docs/archive/dead-code/merchant-control-plane/theme-editor/components/${component}.tsx`)),
            true,
            `${component}.tsx must be preserved in the dead-code archive`,
        );
    }

    for (const hook of archivedHooks) {
        assert.equal(
            existsSync(path(`apps/merchant_web/src/hooks/${hook}.ts`)),
            false,
            `${hook}.ts must not exist under active merchant hooks`,
        );
        assert.equal(
            existsSync(path(`docs/archive/dead-code/merchant-control-plane/theme-editor/hooks/${hook}.ts`)),
            true,
            `${hook}.ts must be preserved in the dead-code archive`,
        );
    }
});

test('live theme editor page keeps the active preview and schema renderer', () => {
    const source = read('apps/merchant_web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx');

    assert.match(source, /@\/components\/theme-editor\/CenterPanel/);
    assert.match(source, /@\/components\/theme-editor\/SchemaFormRenderer/);

    for (const component of archivedComponents) {
        assert.doesNotMatch(source, new RegExp(`@/components/theme-editor/${component}`));
    }
    for (const hook of archivedHooks) {
        assert.doesNotMatch(source, new RegExp(`@/hooks/${hook}`));
    }
});

test('theme editor dead shell validator is wired into governance', () => {
    const validator = read('scripts/validators/theme-editor-dead-shell-validator.mjs');
    const governanceRunner = read('scripts/validate-governance.mjs');

    assert.match(validator, /theme-editor dead shell modules/);
    assert.match(validator, /CenterPanel/);
    assert.match(validator, /SchemaFormRenderer/);
    assert.match(governanceRunner, /theme-editor-dead-shell-validator\.mjs/);
});
