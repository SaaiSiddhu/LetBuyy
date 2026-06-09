#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  deriveTenantTablesFromMigrations,
  registryPath,
  registrySource,
  root,
} from '../governance/tenant-registry-common.mjs';

const entries = deriveTenantTablesFromMigrations();
const outputPath = path.join(root, registryPath);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, registrySource(entries), 'utf8');
console.log(`Generated ${registryPath} with ${entries.length} tenant-owned tables.`);
