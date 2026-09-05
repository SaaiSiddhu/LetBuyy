// gate.sh helper (GW-1). Packages that turbo had in scope, that OWN the task, and that never reported it — a failing task
// cancels its dependents, so a lane can show one failure while whole packages go unverified. A
// package that simply has no such script is not cancelled and must not be reported.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const log = readFileSync(process.argv[2], 'utf8');
const root = process.argv[3] || process.cwd();
const scope = /Packages in scope:\s*(.+)/.exec(log);
if (!scope) process.exit(0);
const inScope = new Set(scope[1].split(',').map((s) => s.trim()).filter(Boolean));
const entries = [...log.matchAll(/^(\S+?):([a-z][a-z-]*):?\s/gm)];
const ran = new Set(entries.map((m) => m[1]));
const task = entries.length ? entries[0][2] : null;
if (!task) process.exit(0);

// name -> scripts, by scanning the workspace's package.json files (bounded depth, skips node_modules).
const owns = new Set();
function scan(dir, depth) {
    if (depth > 4) return;
    let items; try { items = readdirSync(dir); } catch { return; }
    if (items.includes('package.json')) {
        try {
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            if (pkg.name && pkg.scripts && pkg.scripts[task]) owns.add(pkg.name);
        } catch { /* unreadable package.json is not evidence of anything */ }
    }
    for (const item of items) {
        if (item === 'node_modules' || item.startsWith('.')) continue;
        const full = join(dir, item);
        try { if (statSync(full).isDirectory()) scan(full, depth + 1); } catch { /* ignore */ }
    }
}
scan(root, 0);

const missing = [...inScope].filter((p) => !ran.has(p) && owns.has(p)).sort();
if (!missing.length) process.exit(0);
const shown = missing.slice(0, 5).join(' ');
process.stdout.write(missing.length > 5 ? `${shown} +${missing.length - 5}` : shown);
