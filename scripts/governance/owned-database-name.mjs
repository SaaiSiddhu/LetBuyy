import { basename } from 'node:path';

const PREFIX = 'letbuyy_exec_';
const MAX_SUFFIX_LENGTH = 63 - PREFIX.length;

/** Produce a PostgreSQL-safe, guard-accepted database identifier for one isolated suite. */
export function ownedDatabaseNameFor(suitePath) {
    const slug = basename(suitePath)
        .replace(/\.test\.(mjs|ts)$/, '')
        .replace(/[^a-z0-9]+/gi, '_')
        .toLowerCase();
    const suffix = slug.slice(-MAX_SUFFIX_LENGTH);
    if (!suffix) throw new Error('An owned database name requires a non-empty suite filename');
    return `${PREFIX}${suffix}`;
}

export function isOwnedDatabaseName(value) {
    if (typeof value !== 'string' || !value.startsWith(PREFIX)) return false;
    const suffix = value.slice(PREFIX.length);
    return suffix.length > 0
        && suffix.length <= MAX_SUFFIX_LENGTH
        && /^[a-z0-9_]+$/.test(suffix);
}
