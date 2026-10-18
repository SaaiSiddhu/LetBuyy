// A disposable Next directory belongs to one verified client supervisor. The
// adjacent private receipt survives Next's build-directory replacement. No scan,
// cache glob, caller-provided path or reuse of an existing directory is allowed.
import { randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const apps = Object.freeze({
    'commerce-next':'apps/commerce/web', 'commerce-next-production':'apps/commerce/web',
    'identity-next':'apps/platform/identity', 'identity-next-production':'apps/platform/identity',
    'merchant-next':'apps/merchant/web', 'merchant-next-production':'apps/merchant/web',
    'console-next':'apps/internal/console',
});
const stat = path => { try { return lstatSync(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };

function paths(receipt) {
    if (!receipt || receipt.version !== 1 || !Object.hasOwn(apps, receipt.kind)
        || !/^[a-f0-9]{12,64}$/.test(receipt.runId || '')
        || !/^[a-f0-9]{64}$/.test(receipt.token || '')
        || ![receipt.supervisorPid, receipt.parentPid].every(pid => Number.isSafeInteger(pid) && pid > 1)
        || typeof receipt.root !== 'string' || realpathSync(receipt.root) !== receipt.root) {
        throw new Error('invalid owned Next directory receipt');
    }
    const app = join(receipt.root, apps[receipt.kind]);
    if (realpathSync(app) !== app) throw new Error('owned Next app directory must not be a symlink');
    const name = `.next-session-runtime-${receipt.supervisorPid}-${receipt.kind}`;
    const directory = join(app, name);
    return { name, directory, marker:`${directory}.owner.json` };
}

export function claimOwnedNextDirectory({ root, kind, runId, supervisorPid, parentPid }) {
    const receipt = Object.freeze({ version:1, root:realpathSync(root), kind, runId, supervisorPid, parentPid, token:randomBytes(32).toString('hex') });
    const { directory, marker } = paths(receipt);
    if (stat(directory)) throw new Error('refusing to reuse an existing owned Next directory');
    writeFileSync(marker, JSON.stringify(receipt), { flag:'wx', mode:0o600 });
    try {
        mkdirSync(directory, { mode:0o700 });
    } catch (error) {
        // We created only the marker. Never remove a directory that raced us.
        rmSync(marker);
        throw error;
    }
    return receipt;
}

export function ownedNextDirectoryName(receipt) { return paths(receipt).name; }

export function validateOwnedNextDirectoryReceipt(receipt, expected) {
    paths(receipt);
    if (receipt.root !== realpathSync(expected.root) || receipt.kind !== expected.kind
        || receipt.runId !== expected.runId || receipt.supervisorPid !== expected.supervisorPid
        || receipt.parentPid !== expected.parentPid) throw new Error('owned Next directory receipt does not match its registered supervisor');
    return Object.freeze({ ...receipt });
}

export function removeOwnedNextDirectory(receipt) {
    const { directory, marker } = paths(receipt);
    const markerStat = stat(marker), directoryStat = stat(directory);
    if (!markerStat && !directoryStat) return false; // Supervisor already cleaned up.
    if (!markerStat?.isFile() || markerStat.isSymbolicLink()
        || markerStat.uid !== process.getuid() || (markerStat.mode & 0o777) !== 0o600) {
        throw new Error('refusing Next cleanup without its private ownership marker');
    }
    const saved = JSON.parse(readFileSync(marker, 'utf8'));
    if (Object.keys(saved).length !== Object.keys(receipt).length
        || Object.keys(receipt).some(key => saved[key] !== receipt[key])) throw new Error('owned Next directory marker was replaced');
    if (directoryStat && (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())) throw new Error('refusing to follow a replaced Next directory');
    if (directoryStat) rmSync(directory, { recursive:true });
    rmSync(marker);
    return true;
}
