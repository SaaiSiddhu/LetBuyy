import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MaterialIcon, PageHeader, getPageIconName } from '@letbuyy/ui'
import { SettingsPane } from './SettingsPane'
import { SETTINGS_NAV_ITEMS } from './settings-navigation'

// tsx compiles the workspace packages that sit outside this app's tsconfig `include` with esbuild's classic JSX transform,
// which reads a global `React`. Next's own compiler uses the automatic runtime, so this exists only for this test runner.
Object.assign(globalThis, { React })

function renderPane(title: string, iconName?: React.ComponentProps<typeof MaterialIcon>['name']) {
    return renderToStaticMarkup(
        <SettingsPane title={title} description="d" store="snaz" iconName={iconName}>
            <p>child</p>
        </SettingsPane>,
    )
}

/** What PageHeader put inside its icon slot. The slot's content is an <svg> with no nested span, so the first close ends it. */
function headerIconMarkup(html: string): string {
    const slot = /<span data-lb-page-header-icon="true"[^>]*>([\s\S]*?)<\/span>/.exec(html)
    assert.ok(slot, 'the page header renders an icon slot')
    return slot[1]
}

/** SettingsPane called as a function (it has no hooks), so the element it hands PageHeader can be inspected. */
function headerIconElement(title: string): React.ReactNode {
    const page = SettingsPane({ title, description: 'd', store: 'snaz', children: null })
    const children = React.Children.toArray((page.props as { children: React.ReactNode }).children)
    const header = children.find((child) => React.isValidElement(child) && child.type === PageHeader)
    assert.ok(header && React.isValidElement(header), 'SettingsPane renders a PageHeader')
    return (header.props as { icon?: React.ReactNode }).icon
}

test('every settings page shows, in its header, the icon its sidebar row shows', () => {
    // SettingsShell renders each row as <item.Icon className="letbuyy-icon" aria-hidden="true" />; the header must be that same markup.
    assert.ok(SETTINGS_NAV_ITEMS.length >= 10, 'the navigation the header looks its icon up in is not empty')
    const distinct = new Set<string>()
    for (const item of SETTINGS_NAV_ITEMS) {
        const sidebarRow = renderToStaticMarkup(<item.Icon className="letbuyy-icon" aria-hidden="true" />)
        assert.match(sidebarRow, /^<svg/, `${item.label}: the sidebar icon is a real svg`)
        assert.equal(headerIconMarkup(renderPane(item.label)), sidebarRow, `${item.label}: header icon differs from its sidebar row`)
        distinct.add(sidebarRow)
    }
    // A header that fell back to PageHeader's title guess would draw one generic icon for many pages; this many distinct icons
    // means the comparison above can tell the two apart.
    assert.ok(distinct.size >= 5, `the navigation uses ${distinct.size} distinct icons`)
})

test('the sidebar icon wins over an iconName passed for a title the navigation knows', () => {
    const [item] = SETTINGS_NAV_ITEMS
    const sidebarRow = renderToStaticMarkup(<item.Icon className="letbuyy-icon" aria-hidden="true" />)
    assert.notEqual(sidebarRow, renderToStaticMarkup(<MaterialIcon name="orders" />), 'the iconName below is one the sidebar icon is told apart from')
    assert.equal(headerIconMarkup(renderPane(item.label, 'orders')), sidebarRow)
})

test('a title outside the settings navigation keeps the icon PageHeader would pick: the given iconName, else the title guess', () => {
    const outside = 'Not a settings page'
    assert.ok(!SETTINGS_NAV_ITEMS.some((item) => item.label === outside))

    const named = headerIconMarkup(renderPane(outside, 'orders'))
    assert.equal(named, renderToStaticMarkup(<MaterialIcon name="orders" />))

    const guessed = headerIconMarkup(renderPane(outside))
    assert.equal(guessed, renderToStaticMarkup(<MaterialIcon name={getPageIconName(outside)} />))

    assert.notEqual(named, guessed, 'the two fallbacks are told apart')
})

test('the header icon element keeps its type from one render to the next, so React never remounts it', () => {
    for (const item of SETTINGS_NAV_ITEMS) {
        const first = headerIconElement(item.label)
        const second = headerIconElement(item.label)
        assert.ok(React.isValidElement(first) && React.isValidElement(second), `${item.label}: the header icon is an element`)
        assert.equal(first.type, second.type, `${item.label}: a component created while rendering has a new type every time`)
    }
})

test('SettingsPane forwards save safety and explicit header metadata without interpreting persistence', () => {
    const onSave = async () => {}, onDiscard = () => {}
    const bar = { state: 'unsaved' as const, onSave, onDiscard, saveDisabled: true, discardDisabled: true, protectNavigation: false }
    const pane = SettingsPane({ title: 'Translated name', navigationKey: 'general', description: 'd', store: 'snaz', children: null, saveBar: bar, header: { titleAdornment: <span>Draft</span>, showDescription: true } })
    const children = React.Children.toArray((pane.props as { children: React.ReactNode }).children).filter(React.isValidElement)
    const header = children.find(c => c.type === PageHeader)!
    assert.equal((header.props as { recipe: string }).recipe, 'settings')
    assert.ok((header.props as { icon: React.ReactNode }).icon)
    const save = children.find(c => (c.props as { state?: string }).state === 'unsaved')!
    assert.equal((save.props as typeof bar).onSave, onSave)
    assert.equal((save.props as typeof bar).discardDisabled, true)
    assert.equal((save.props as typeof bar).saveDisabled, true)
    assert.equal((save.props as typeof bar).protectNavigation, false)
})
