/** Static inventory for audit triage. Dynamic controls and shared consumers still need runtime tracing. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const appRoot = join(root, 'apps/merchant/web/src/app/[store]')
const componentsRoot = join(root, 'apps/merchant/web/src/components')
const output = resolve(process.argv[2] ?? join(root, 'docs/implementation/merchant-canonical-ui-2026-10-30/CONTROL_INVENTORY.csv'))
const unverified = 'unverified: inspect render conditions, grant, action, and persisted readback'
const header = [
  'source_file', 'line', 'scope', 'control', 'literal_text', 'aria_label', 'href',
  'on_click', 'type', 'audit_status',
]
const tags = new Set([
  'button', 'a', 'input', 'select', 'textarea', 'Button', 'Link', 'MerchantNavigationLink',
  'Input', 'Select', 'Switch', 'Checkbox', 'Radio', 'Tabs', 'Combobox', 'ChoiceList',
])

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === '__tests__') return []
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return filesUnder(path)
    return entry.name.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(entry.name) ? [path] : []
  })
}

function csv(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function attribute(node, name, source) {
  const item = node.attributes?.properties.find(property =>
    ts.isJsxAttribute(property) && property.name.text === name)
  if (!item || !ts.isJsxAttribute(item) || !item.initializer) return ''
  if (ts.isStringLiteral(item.initializer)) return item.initializer.text
  return item.initializer.getText(source).slice(0, 160)
}

function textChildren(node) {
  if (!node || !ts.isJsxElement(node)) return ''
  return node.children.filter(ts.isJsxText).map(child => child.getText()).join(' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

function parseCsv(input) {
  const records = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted && char === '"' && input[i + 1] === '"') { field += '"'; i++; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (!quoted && (char === ',' || char === '\n')) {
      row.push(field.replace(/\r$/, ''))
      field = ''
      if (char === '\n') { records.push(row); row = [] }
      continue
    }
    field += char
  }
  if (quoted) throw new Error('Unclosed quoted CSV field')
  if (field || row.length) { row.push(field); records.push(row) }
  return records
}

function key(row) {
  return [0, 3, 4, 5, 6, 7, 8].map(index => row[index]).join('\u0000')
}

function objectProperty(object, name, source) {
  const property = object.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(source) === name)
  return property && ts.isPropertyAssignment(property) ? property.initializer.getText(source).slice(0, 160) : ''
}

function expression(attributeNode) {
  return attributeNode?.initializer && ts.isJsxExpression(attributeNode.initializer)
    ? attributeNode.initializer.expression : undefined
}

function attributeNode(node, name) {
  return node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.text === name)
}

function hasControlJsx(node) {
  let found = false
  function visit(child) {
    if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
      if (tags.has(child.tagName.getText())) found = true
    }
    if (!found) ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

function jsxValue(node) {
  const value = ts.isParenthesizedExpression(node) ? node.expression : node
  return ts.isJsxElement(value) || ts.isJsxSelfClosingElement(value) || ts.isJsxFragment(value)
}

const rows = [header]

for (const path of [...filesUnder(appRoot), ...filesUnder(componentsRoot)].sort()) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const scope = path.startsWith(appRoot) ? 'route/workspace' : 'shared component'
  const declarations = new Map()
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const values = declarations.get(node.name.text) ?? []
      values.push(node.initializer)
      declarations.set(node.name.text, values)
    }
    ts.forEachChild(node, collect)
  }
  collect(source)
  function resolveLocal(node, depth = 0) {
    if (depth > 3) return node
    if (ts.isParenthesizedExpression(node)) return resolveLocal(node.expression, depth + 1)
    if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node)) return resolveLocal(node.expression, depth + 1)
    if (ts.isIdentifier(node)) {
      const values = declarations.get(node.text)
      return values?.length === 1 ? resolveLocal(values[0], depth + 1) : node
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useMemo') {
      const callback = node.arguments[0]
      if (callback && ts.isArrowFunction(callback) && !ts.isBlock(callback.body)) return resolveLocal(callback.body, depth + 1)
    }
    return node
  }
  function expandActions(node, depth = 0) {
    const resolved = resolveLocal(node)
    if (depth > 5) return [resolved]
    if (ts.isSpreadElement(resolved)) return expandActions(resolved.expression, depth + 1)
    if (ts.isArrayLiteralExpression(resolved)) return resolved.elements.flatMap(item => expandActions(item, depth + 1))
    if (ts.isConditionalExpression(resolved)) return [
      ...expandActions(resolved.whenTrue, depth + 1),
      ...expandActions(resolved.whenFalse, depth + 1),
    ]
    return [resolved]
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      if (tags.has(tag)) {
        const parent = ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent) ? node.parent : null
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
        rows.push([
          relative(root, path), line, scope, tag, textChildren(parent),
          attribute(node, 'aria-label', source), attribute(node, 'href', source),
          attribute(node, 'onClick', source), attribute(node, 'type', source),
          unverified,
        ])
      }
      // These components render controls from props; no JSX Button exists at the call site.
      const propControls = tag === 'SaveBar' ? ['onSave', 'onDiscard']
        : tag === 'PageHeader' || tag === 'SettingsPane' ? ['primaryAction', 'secondaryActions', 'overflowAction']
          : tag === 'EmptyState' || tag === 'MerchantEmptyState' ? ['primaryAction', 'secondaryAction']
            : tag === 'Dropdown' || tag === 'Tabs' ? ['items']
              : tag === 'Modal' || tag === 'Dialog' ? ['footer']
                : tag === 'Banner' ? ['action']
            : []
      for (const prop of propControls) {
        const item = attributeNode(node, prop)
        const value = item && expression(item)
        if (!value) continue
        const line = source.getLineAndCharacterOfPosition(item.getStart(source)).line + 1
        const candidates = expandActions(value).filter(candidate =>
          !['undefined', 'null', 'false'].includes(candidate.getText(source)) &&
          !hasControlJsx(candidate) && !jsxValue(candidate))
        for (const [index, candidate] of candidates.entries()) {
          const object = ts.isObjectLiteralExpression(candidate) ? candidate : undefined
          rows.push([
            relative(root, path), line, scope, `${tag}.${prop}${candidates.length > 1 ? `[${index + 1}]` : ''}`,
            object ? objectProperty(object, 'label', source).replace(/^['"]|['"]$/g, '') : candidate.getText(source).slice(0, 160),
            '', object ? objectProperty(object, 'href', source) : '',
            object ? objectProperty(object, 'onClick', source) || objectProperty(object, 'onSelect', source) : candidate.getText(source).slice(0, 160),
            object ? 'action-object' : 'prop-driven', unverified,
          ])
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

let preserved = 0
if (existsSync(output)) {
  const oldRows = parseCsv(readFileSync(output, 'utf8'))
  if (oldRows[0]?.join('\u0000') !== header.join('\u0000')) throw new Error('Inventory header changed; migrate statuses explicitly')
  const byKey = new Map()
  for (const row of oldRows.slice(1)) {
    if (row.length !== header.length) throw new Error(`Malformed inventory row in ${output}`)
    if (row[9] === unverified) continue
    const bucket = byKey.get(key(row)) ?? []
    bucket.push(row)
    byKey.set(key(row), bucket)
  }
  for (const bucket of byKey.values()) bucket.sort((a, b) => Number(a[1]) - Number(b[1]))
  for (const row of rows.slice(1)) {
    const bucket = byKey.get(key(row))
    if (!bucket?.length) continue
    const exact = bucket.findIndex(previous => previous[1] === String(row[1]))
    const match = bucket.splice(exact >= 0 ? exact : bucket.reduce((best, previous, index) =>
      Math.abs(Number(previous[1]) - Number(row[1])) < Math.abs(Number(bucket[best][1]) - Number(row[1])) ? index : best, 0), 1)[0]
    row[9] = match[9]
    preserved++
  }
  const missing = [...byKey.values()].flat()
  if (missing.length) throw new Error(`${missing.length} reviewed inventory controls no longer match source; reconcile them before regenerating`)
}
writeFileSync(output, `${rows.map(row => row.map(csv).join(',')).join('\n')}\n`)
console.log(`Wrote ${rows.length - 1} control sites to ${relative(root, output)}; preserved ${preserved} reviewed statuses`)
