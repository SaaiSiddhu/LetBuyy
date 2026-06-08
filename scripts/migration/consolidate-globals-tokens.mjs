#!/usr/bin/env node
'use strict';

/**
 * Value-verified globals.css consolidation.
 *
 * Converts hand-authored legacy theme variables to `var(--lb-*)` references —
 * but ONLY when the legacy raw value is byte-for-byte equal (after colour
 * normalisation) to the canonical token's value. This guarantees ZERO rendered
 * change: a line is only rewritten when it already resolves to the same colour.
 * Everything else (app-specific values, dark-first overrides, `--lb-*`
 * redefinitions) is left untouched and reported as skipped.
 *
 *   node scripts/migration/consolidate-globals-tokens.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dry = process.argv.includes('--dry');

// Canonical token LIGHT values (from packages/typescript/ui/src/tokens.ts).
const tokenValue = {
    '--lb-color-primary': '#8b5cf6',
    '--lb-color-primary-hover': '#7c3aed',
    '--lb-color-primary-active': '#6d28d9',
    '--lb-color-primary-subtle': 'rgba(139,92,246,0.12)',
    '--lb-color-success': '#22c55e',
    '--lb-color-warning': '#f59e0b',
    '--lb-color-critical': '#ef4444',
    '--lb-color-info': '#3b82f6',
    '--lb-color-bg': '#f6f7f9',
    '--lb-color-border': '#e5e7eb',
    '--lb-color-border-subtle': '#e5e7eb',
    '--lb-color-text': '#111827',
    '--lb-color-text-subdued': '#6b7280',
    '--lb-color-text-muted': '#6b7280',
};

// Legacy variable name -> canonical token.
const legacyToToken = {
    '--primary': '--lb-color-primary',
    '--primary-hover': '--lb-color-primary-hover',
    '--primary-active': '--lb-color-primary-active',
    '--primary-dark': '--lb-color-primary-active',
    '--primary-subtle': '--lb-color-primary-subtle',
    '--primary-soft': '--lb-color-primary-subtle',
    '--success': '--lb-color-success',
    '--warning': '--lb-color-warning',
    '--error': '--lb-color-critical',
    '--accent-blue': '--lb-color-info',
    '--text-primary': '--lb-color-text',
    '--text-secondary': '--lb-color-text-subdued',
    '--text-muted': '--lb-color-text-muted',
    '--foreground': '--lb-color-text',
    '--background': '--lb-color-bg',
    '--border': '--lb-color-border',
    '--border-light': '--lb-color-border-subtle',
};

function normalize(raw) {
    let v = raw.trim().toLowerCase().replace(/\s+/g, '');
    const rgb = v.match(/^rgb\((\d+),?(\d+),?(\d+)\)$/) || v.match(/^rgb\((\d+)(\d+)(\d+)\)$/);
    // handle "rgb(139 92 246)" -> spaces already stripped -> "rgb(13992246)" is ambiguous; parse before stripping
    return v;
}

function toHex(raw) {
    const s = raw.trim().toLowerCase();
    let m = s.match(/^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/);
    if (m) return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    m = s.match(/^rgba\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)[\s,]+([\d.]+)\s*\)$/);
    if (m) return `rgba(${m[1]},${m[2]},${m[3]},${m[4]})`;
    m = s.match(/^#([0-9a-f]{6})$/);
    if (m) return '#' + m[1];
    m = s.match(/^#([0-9a-f]{3})$/);
    if (m) return '#' + m[1].split('').map((c) => c + c).join('');
    return s;
}

const files = readdirSync(join(root, 'apps')).flatMap((app) => {
    const p = join(root, 'apps', app, 'src', 'app', 'globals.css');
    try { readFileSync(p); return [p]; } catch { return []; }
});
function join(...p) { return resolve(...p); }

let totalConverted = 0;
const skips = {};
for (const file of files) {
    const src = readFileSync(file, 'utf8');
    let converted = 0;
    const out = src.replace(/^(\s*)(--[a-z0-9-]+)(:\s*)([^;]+)(;)/gim, (full, indent, name, sep, value, semi) => {
        const token = legacyToToken[name];
        if (!token) return full;
        if (name.startsWith('--lb-')) return full;
        const want = tokenValue[token];
        if (toHex(value) === want) {
            converted += 1;
            totalConverted += 1;
            return `${indent}${name}${sep}var(${token})${semi}`;
        }
        skips[name] = (skips[name] || 0) + 1;
        return full;
    });
    if (converted > 0) {
        if (!dry) writeFileSync(file, out);
        process.stdout.write(`${dry ? 'would convert' : 'converted'} ${converted} in ${file.replace(root + '/', '')}\n`);
    }
}
process.stdout.write(`\nTotal ${dry ? 'convertible' : 'converted'}: ${totalConverted} definition(s) to var(--lb-*). Value-mismatched/app-specific left for review.\n`);
