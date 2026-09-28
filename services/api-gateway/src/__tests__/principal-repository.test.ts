// Phase 2 / D03 approved local slice (Mandate 7, Section 10) -- tests for the REAL
// PrincipalRepository against a fake PostgREST. Not wired into any live route; exists to be
// exercised by the shadow evaluator and tested on its own here.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabasePrincipalRepository, type PrincipalRepositoryDb } from '../identity-foundation/principal-repository';

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>): PrincipalRepositoryDb {
  function filterable(rows: Row[]): ReturnType<PrincipalRepositoryDb['from']>['select'] extends (...a: never[]) => infer R ? R : never {
    let filtered = rows;
    const api = {
      eq(column: string, value: string) {
        filtered = filtered.filter((r) => String(r[column]) === value);
        return api;
      },
      is(column: string, value: null) {
        filtered = filtered.filter((r) => r[column] === value);
        return api;
      },
      async maybeSingle() {
        if (filtered.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
        return { data: filtered[0] ?? null, error: null };
      },
    };
    return api as never;
  }

  return {
    from(table: string) {
      return {
        select() {
          return filterable(tables[table] ?? []) as never;
        },
        insert(row: Row) {
          return {
            select: () => ({
              async single() {
                const list = tables[table] ?? (tables[table] = []);
                const id = row.id ?? `generated-${list.length + 1}`;
                if (table === 'account_links' && !row.principal_id) {
                  return { data: null, error: { code: '23503', message: 'foreign key violation' } };
                }
                const stored = { linked_at: new Date().toISOString(), ...row, id };
                list.push(stored);
                return { data: stored, error: null };
              },
            }),
          };
        },
      };
    },
  };
}

function principalRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'principal-1', realm: 'merchant', actor_type: 'merchant',
    legacy_user_id: null, legacy_customer_id: null, legacy_employee_id: 'emp-1',
    email: 'owner@shop.test', phone: null, display_name: 'Owner',
    status: 'pending_migration', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null,
    ...overrides,
  };
}

test('findById returns a mapped Principal for an existing, non-deleted row', async () => {
  const repo = createSupabasePrincipalRepository(fakeDb({ principals: [principalRow()] }));
  const principal = await repo.findById('principal-1');
  assert.equal(principal?.id, 'principal-1');
  assert.equal(principal?.legacyEmployeeId, 'emp-1');
  assert.equal(principal?.legacyUserId, undefined, 'a null DB column must map to undefined, not null, on the TS side');
});

test('findById returns null for a non-existent id, never throws', async () => {
  const repo = createSupabasePrincipalRepository(fakeDb({ principals: [] }));
  const principal = await repo.findById('nonexistent');
  assert.equal(principal, null);
});

test('findById never returns a soft-deleted row', async () => {
  const repo = createSupabasePrincipalRepository(fakeDb({ principals: [principalRow({ id: 'p2', deleted_at: '2026-02-01T00:00:00Z' })] }));
  const principal = await repo.findById('p2');
  assert.equal(principal, null);
});

test('findByLegacyRef matches by legacyEmployeeId within the given realm', async () => {
  const repo = createSupabasePrincipalRepository(fakeDb({ principals: [principalRow()] }));
  const principal = await repo.findByLegacyRef({ realm: 'merchant', legacyEmployeeId: 'emp-1' });
  assert.equal(principal?.id, 'principal-1');
});

test('findByLegacyRef with a ref naming NO legacy id fields returns null -- fail closed, never a wildcard match', async () => {
  const repo = createSupabasePrincipalRepository(fakeDb({ principals: [principalRow()] }));
  const principal = await repo.findByLegacyRef({ realm: 'merchant' });
  assert.equal(principal, null);
});

test('findByLegacyRef scopes by realm -- the same legacyEmployeeId in a different realm does not match', async () => {
  const repo = createSupabasePrincipalRepository(fakeDb({ principals: [principalRow()] }));
  const principal = await repo.findByLegacyRef({ realm: 'customer', legacyEmployeeId: 'emp-1' });
  assert.equal(principal, null);
});

test('linkAccount inserts and returns the mapped AccountLink', async () => {
  const repo = createSupabasePrincipalRepository(fakeDb({ principals: [principalRow()] }));
  const link = await repo.linkAccount({
    id: 'link-1', principalId: 'principal-1', provider: 'employees', providerSubject: 'emp-1', realm: 'merchant', linkedAt: new Date().toISOString(),
  });
  assert.equal(link.principalId, 'principal-1');
  assert.equal(link.provider, 'employees');
});

test('linkAccount surfaces a database failure by throwing, never by returning a fabricated success', async () => {
  const repo = createSupabasePrincipalRepository(fakeDb({}));
  await assert.rejects(() => repo.linkAccount({
    id: 'link-2', principalId: '', provider: 'employees', providerSubject: 'emp-2', realm: 'merchant', linkedAt: new Date().toISOString(),
  }));
});
