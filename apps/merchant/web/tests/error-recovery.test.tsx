import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MerchantError from '../src/app/error'

Object.assign(globalThis, { React })

test('Try again requests a fresh document after a server read failure', () => {
    let reloads = 0, resets = 0
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { reload: () => { reloads += 1 } } } })
    try {
        const page = MerchantError({ error: new Error('private database error'), reset: () => { resets += 1 } })
        let retry: (() => void) | undefined
        const visit = (node: React.ReactNode): void => {
            if (!React.isValidElement<{ onClick?: () => void; children?: React.ReactNode }>(node)) return
            if (node.props.onClick) retry = node.props.onClick
            React.Children.forEach(node.props.children, visit)
        }
        visit(page)
        assert.ok(retry, 'the recovery screen must expose a retry action')
        retry()
        assert.equal(reloads, 1)
        assert.equal(resets, 0, 'replaying the cached failed server payload is not recovery')
        assert.doesNotMatch(renderToStaticMarkup(page), /private database error/)
    } finally {
        if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
        else Reflect.deleteProperty(globalThis, 'window')
    }
})
