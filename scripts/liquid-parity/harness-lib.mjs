#!/usr/bin/env node
// Shared utilities for liquid-parity snapshot scripts.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EVIDENCE_DIR = join(REPO_ROOT, 'LAUNCH_READINESS_2026_06_12', 'evidence', 'e-liquid-parity');
const SNAPSHOTS_DIR = join(EVIDENCE_DIR, 'snapshots');

export const ALL_FROZEN_SECTIONS = [
  'about-section',
  'app-block-slot',
  'banner-carousel',
  'brand-marquee',
  'category-grid',
  'contact-form',
  'cta-section',
  'experience-timeline',
  'featured-products',
  'hero',
  'marquee',
  'newsletter',
  'portfolio-grid',
  'product-detail-section',
  'product-grid',
  'rich-content-section',
  'services-grid',
  'skills-section',
  'testimonials',
  'trust-badges',
];

export const VIEWPORTS = {
  desktop: {
    width: 1440,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  },
  mobile: {
    width: 390,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
};

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Required env var ${name} is not set`);
    process.exit(1);
  }
  return value;
}

export function snapshotPath(engine, viewport, section) {
  return join(SNAPSHOTS_DIR, engine, viewport, `${section}.html`);
}

export function diffPath(section, viewport) {
  return join(SNAPSHOTS_DIR, 'diff', `${section}-${viewport}.diff`);
}

export function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function writeSnapshot(engine, viewport, section, html) {
  const outPath = snapshotPath(engine, viewport, section);
  ensureDir(outPath);
  writeFileSync(outPath, html, 'utf8');
  return outPath;
}

export function readSnapshot(engine, viewport, section) {
  const snapPath = snapshotPath(engine, viewport, section);
  if (!existsSync(snapPath)) return null;
  return readFileSync(snapPath, 'utf8');
}

export async function fetchStorefrontPage(baseUrl, subdomain, viewport) {
  const url = `${baseUrl}/store/${subdomain}`;
  const headers = {
    'User-Agent': VIEWPORTS[viewport].userAgent,
    'Accept': 'text/html,application/xhtml+xml',
    'x-parity-probe': '1',
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Storefront fetch failed: HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

export function extractSectionHtml(fullHtml, sectionType) {
  // Extract <div data-section-id="..." data-renderer-key="<type>">...</div>
  // Matches the section wrapper added by composition-engine.tsx
  const pattern = new RegExp(
    `<div[^>]*data-renderer-key="${escapeRegex(sectionType)}"[^>]*>([\\s\\S]*?)</div>\\s*(?=<div[^>]*data-|$)`,
    'im',
  );
  const match = fullHtml.match(pattern);
  if (match) return match[0];

  // Fallback: check for liquid renderer wrapper
  if (fullHtml.includes('data-theme-renderer="liquid"')) {
    return fullHtml;
  }

  return null;
}

export function extractHeadMeta(fullHtml) {
  const headMatch = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return '';
  const head = headMatch[1];

  const tags = [];
  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) tags.push(`<title>${titleMatch[1].trim()}</title>`);

  const metaRe = /<meta\s+([^>]+)>/gi;
  let m;
  while ((m = metaRe.exec(head)) !== null) {
    const attrs = m[1];
    if (/name=["']description["']|property=["']og:/i.test(attrs)) {
      tags.push(`<meta ${attrs.trim()} />`);
    }
  }

  const canonicalMatch = head.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
  if (canonicalMatch) tags.push(canonicalMatch[0]);

  return tags.join('\n');
}

export function normalizeHtml(html) {
  return html
    // Remove data-section-id UUIDs (differ per render but aren't meaningful diffs)
    .replace(/data-section-id="[a-f0-9-]{36}"/g, 'data-section-id="__REDACTED__"')
    // Remove CSRF tokens and nonce values
    .replace(/nonce="[^"]+"/g, 'nonce="__REDACTED__"')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

export function structuralDiff(reactHtml, liquidHtml) {
  const rNorm = normalizeHtml(reactHtml);
  const lNorm = normalizeHtml(liquidHtml);
  if (rNorm === lNorm) return null;

  const rLines = rNorm.split(/(?=>)/);
  const lLines = lNorm.split(/(?=>)/);
  const diffs = [];

  const maxLen = Math.max(rLines.length, lLines.length);
  for (let i = 0; i < maxLen; i++) {
    const r = rLines[i] || '(missing)';
    const l = lLines[i] || '(missing)';
    if (r !== l) diffs.push({ pos: i, react: r.slice(0, 120), liquid: l.slice(0, 120) });
    if (diffs.length >= 20) { diffs.push({ pos: -1, react: '...truncated', liquid: '...truncated' }); break; }
  }

  return diffs;
}

export function writeDiff(section, viewport, diffs) {
  const outPath = diffPath(section, viewport);
  ensureDir(outPath);
  const content = diffs
    ? diffs.map(d => `@pos ${d.pos}\n- REACT:  ${d.react}\n+ LIQUID: ${d.liquid}`).join('\n\n')
    : 'MATCH — no structural diff';
  writeFileSync(outPath, content, 'utf8');
  return outPath;
}

export function writeMatrixResult(section, viewport, dimension, status, notes = '') {
  const rowPath = join(EVIDENCE_DIR, 'matrix-results.jsonl');
  const row = JSON.stringify({ section, viewport, dimension, status, notes, ts: new Date().toISOString() });
  mkdirSync(dirname(rowPath), { recursive: true });
  writeFileSync(rowPath, (existsSync(rowPath) ? readFileSync(rowPath, 'utf8') : '') + row + '\n', 'utf8');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
