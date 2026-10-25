// Explicit manual acceptance entry point, intentionally outside *.test discovery.
// Reuses the canonical fixture and fails closed without both opt-in and ownership.
import { after, test } from 'node:test';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { holdThreadlineBrowserFixture } from './threadline-browser-fixture';

if (process.env.LETBUYY_THEME_EDITOR_BROWSER_HOLD !== '1') throw new Error('Manual editor fixture requires explicit opt-in');
const owned = requireOwnedDatabase();
let proxy: OwnedPooledSqlProxy | undefined;
after(async () => { await closePooledSqlClients(); await proxy?.stop(); });
test('manual common editor acceptance uses fresh owned origins and canonical authentication', async () => {
    proxy = await startOwnedPooledSqlProxy(owned);
    await holdThreadlineBrowserFixture(owned, proxy.env());
});
