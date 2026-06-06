import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
            existsSync(path(`apps/merchant-control-plane/src/components/theme-editor/${component}.tsx`)),
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
            existsSync(path(`apps/merchant-control-plane/src/hooks/${hook}.ts`)),
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
    const source = read('apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx');

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
