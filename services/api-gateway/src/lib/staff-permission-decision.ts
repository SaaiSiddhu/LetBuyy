// Pure decision primitive, extracted from middleware/staff-permission.ts (auth hardening mandate,
// Section 7: "the current modules import each other" -- staff-permission.ts imported
// compareStaffPermissionDecision from identity-foundation/shadow-permission-comparison.ts, which in
// turn imported evaluateStaffPermission from staff-permission.ts, a real circular import between the
// enforcement module and the module comparing against it). This file has no imports and no I/O, so
// both staff-permission.ts (the real enforcement) and every shadow comparator (legacy-translated or
// target-backed) can depend on it without depending on each other. Behavior is unchanged: this is a
// straight relocation, not a rewrite -- see the callers' own tests for regression proof.

export type StaffPermissionKey =
    | 'products:read'
    | 'products:write'
    | 'orders:read'
    | 'orders:write'
    | 'customers:read'
    | 'customers:write'
    | 'marketing:write'
    | 'shipping:write'
    | 'returns:write'
    | 'settings:write'
    | 'content:write';

/**
 * Owners always pass. Otherwise the required key must be present in `granted`
 * directly, via the `*` super-grant, via a `prefix:*` wildcard, or via the matching
 * `<resource>:write` grant when the requirement is `<resource>:read` (see below).
 */
export function evaluateStaffPermission(input: {
    isOwner: boolean;
    granted: string[];
    requiredKey: string;
}): { allowed: boolean; reason: string } {
    const { isOwner, granted, requiredKey } = input;
    if (isOwner) return { allowed: true, reason: 'owner' };
    if (!Array.isArray(granted) || granted.length === 0) {
        return { allowed: false, reason: 'no-grants' };
    }
    // Phase 2 / F2.5: every "write" role in the staff role catalog (merchant-web's roles.ts --
    // manager, editor, fulfillment, marketing, support) grants <resource>:write WITHOUT the
    // matching <resource>:read, on the evident assumption that write access includes the ability
    // to view what you can edit -- only the read-only "viewer" role lists :read keys explicitly.
    // Reproduced live: a real Manager, added through the real product UI, was refused reading the
    // product list (products:read required) despite holding products:write. This widens ONLY a
    // `:read` requirement to also accept the matching `:write` grant -- a `:write` requirement is
    // never satisfied by a `:read` grant, and no other implication is added.
    const impliedByWrite = requiredKey.endsWith(':read') ? `${requiredKey.slice(0, -':read'.length)}:write` : null;
    for (const g of granted) {
        if (g === '*' || g === requiredKey) return { allowed: true, reason: `grant:${g}` };
        if (g.endsWith(':*') && requiredKey.startsWith(g.slice(0, -1))) {
            return { allowed: true, reason: `grant:${g}` };
        }
        if (impliedByWrite && g === impliedByWrite) {
            return { allowed: true, reason: `grant:${g}` };
        }
    }
    return { allowed: false, reason: `missing:${requiredKey}` };
}
