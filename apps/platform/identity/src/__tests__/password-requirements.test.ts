import assert from 'node:assert/strict'
import test from 'node:test'
import { PasswordUpdateSchema } from '@letbuyy/auth-core'
import { validatePasswordStrength } from '../lib/auth/password'

test('password form validity matches canonical server policy at every rule boundary', () => {
    for (const password of ['', 'Ab1!', 'abcdefgh1!', 'ABCDEFGH1!', 'Abcdefghij!', 'Abcdefghij1', 'Synthetic!Password42', 'A1!' + 'a'.repeat(125), 'A1!' + 'a'.repeat(126)]) {
        const actual = validatePasswordStrength(password)
        assert.equal(actual.isValid, PasswordUpdateSchema.safeParse({ password }).success)
        assert.equal(actual.isValid, Object.values(actual.rules).every(Boolean))
    }
})
