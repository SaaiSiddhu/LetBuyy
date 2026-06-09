#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/generators/generate-mobile-tokens.mjs', '--check'], {
    cwd: process.cwd(),
    stdio: 'inherit',
});

process.exit(result.status ?? 1);
