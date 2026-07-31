/**
 * Repo-root + artifact path resolution. Deterministic: walks up from a start dir
 * looking for the workspace marker. No environment guessing beyond the filesystem.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Walk up from `start` (default cwd) to the repo root (the dir containing pnpm-workspace.yaml). */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 16; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('lcis-core: could not locate repo root (no pnpm-workspace.yaml found above ' + start + ')');
}

/** The graphify-out directory (artifact source of truth). */
export function graphifyOutDir(repoRoot: string = findRepoRoot()): string {
  return join(repoRoot, 'graphify-out');
}
