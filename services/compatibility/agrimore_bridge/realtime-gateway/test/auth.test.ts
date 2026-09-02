import assert from 'node:assert/strict';
import test from 'node:test';

import { authorizeChannel } from '../src/realtime/auth';

test('authorizeChannel scopes user channels to the same user', () => {
  assert.equal(authorizeChannel('user.orders.u1', { userId: 'u1', roles: ['customer'], token: 't' }), true);
  assert.equal(authorizeChannel('user.orders.u2', { userId: 'u1', roles: ['customer'], token: 't' }), false);
});

test('authorizeChannel restricts ops city channels to admins', () => {
  assert.equal(authorizeChannel('ops.city.blr', { userId: 'u1', roles: ['customer'], token: 't' }), false);
  assert.equal(authorizeChannel('ops.city.blr', { userId: 'a1', roles: ['admin'], token: 't' }), true);
});
