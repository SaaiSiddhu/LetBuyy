import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'tailwindcss';
import { expect, it } from 'vitest';

it('compiles shared colour utilities against the current surface tokens', async () => {
    const source = readFileSync(resolve(process.cwd(), '../../../config/tailwind/letbuyy-tokens.css'), 'utf8');
    const compiler = await compile(source + '\n@tailwind utilities;');
    const css = compiler.build(['text-primary', 'text-default', 'bg-surface', 'border-line', 'sm:grid-cols-2']);
    for (const [utility, property, token] of [
        ['text-primary', 'color', '--lb-color-primary'],
        ['text-default', 'color', '--lb-color-text'],
        ['bg-surface', 'background-color', '--lb-color-surface'],
        ['border-line', 'border-color', '--lb-color-border'],
    ]) {
        expect(css).toMatch(new RegExp('\\.' + utility + '\\s*\\{\\s*' + property + ': var\\(' + token + '\\)'));
    }
    expect(css).toContain('width >= 640px');
});
