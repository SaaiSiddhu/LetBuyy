#!/usr/bin/env node
// pnpm graph:update — rebuild the Graphify code graph (LLM-free AST extraction).
// Finds the graphify binary (PATH or ~/.local/bin) and runs `graphify update .`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

function findGraphify() {
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['graphify'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim().split('\n')[0];
  const fallback = join(homedir(), '.local', 'bin', 'graphify');
  if (existsSync(fallback)) return fallback;
  return null;
}

const bin = findGraphify();
if (!bin) {
  console.error('[graph:update] graphify not found. Install (isolated):  uv tool install graphifyy');
  process.exit(1);
}
console.log(`[graph:update] ${bin} update .`);
const r = spawnSync(bin, ['update', '.'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
