import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const directory = dirname(fileURLToPath(import.meta.url))
const inventory = join(directory, 'CONTROL_INVENTORY.csv')
const generator = join(directory, 'generate-control-inventory.mjs')

test('regeneration retains reviewed evidence despite a moved source line and inventories prop controls', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'letbuyy-control-inventory-'))
  try {
    const output = join(scratch, 'inventory.csv')
    copyFileSync(inventory, output)
    const original = readFileSync(output, 'utf8')
    const reviewed = original.split('\n').find(row => row.includes('run 7246c0d16ec8'))?.trimEnd()
    assert.ok(reviewed, 'fixture needs the prior free-checkout browser evidence')
    const reviewedCount = (original.match(/partially (?:browser )?verified/g) ?? []).length
    writeFileSync(output, original.replace(reviewed, reviewed.replace(/^(.*?),\d+,/, '$1,1,')))

    const run = spawnSync(process.execPath, [generator, output], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    assert.match(run.stdout, new RegExp(`preserved ${reviewedCount} reviewed statuses`))
    const regenerated = readFileSync(output, 'utf8')
    assert.match(regenerated, /CheckoutClient\.tsx,\d+,route\/workspace,Button,Recover pending checkout[^\n]*run 7246c0d16ec8/)
    assert.match(regenerated, /products\/new\/page\.tsx,\d+,route\/workspace,SaveBar\.onSave,/)
    assert.match(regenerated, /SaveBar\.onSave[^\n]*owned entitlement browser run d5d473893550/)
    assert.match(regenerated, /ThemeWorkspace\.tsx,\d+,shared component,Dropdown\.items\[1\],Manage themes,/)
    assert.match(regenerated, /ThemeLibraryCard\.tsx,\d+,shared component,Dropdown\.items\[3\],Publish,/)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('invalid previous inventory fails without overwriting reviewed data', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'letbuyy-control-inventory-'))
  try {
    const output = join(scratch, 'inventory.csv')
    writeFileSync(output, 'wrong,header\nreviewed,evidence\n')
    const run = spawnSync(process.execPath, [generator, output], { encoding: 'utf8' })
    assert.notEqual(run.status, 0)
    assert.equal(readFileSync(output, 'utf8'), 'wrong,header\nreviewed,evidence\n')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('a reviewed control removed from source requires manual evidence reconciliation', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'letbuyy-control-inventory-'))
  try {
    const output = join(scratch, 'inventory.csv')
    const original = readFileSync(inventory, 'utf8')
    const reviewed = original.split('\n').find(row => row.includes('run 7246c0d16ec8'))?.trimEnd()
    assert.ok(reviewed)
    const changed = original.replace(reviewed, reviewed.replace('CheckoutClient.tsx', 'DeletedCheckoutClient.tsx'))
    writeFileSync(output, changed)
    const run = spawnSync(process.execPath, [generator, output], { encoding: 'utf8' })
    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /reviewed inventory controls no longer match source/)
    assert.equal(readFileSync(output, 'utf8'), changed)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})
