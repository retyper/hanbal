import { it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const cli = resolve('tools/veo/queue.mjs')
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'veo-queue-'))
  const inputPath = join(dir, 'source.png'); const promptPath = join(dir, 'prompt.txt')
  writeFileSync(inputPath, 'fixture image'); writeFileSync(promptPath, 'Portrait head to pelvis; seamless loop.')
  const job = { id: 'bear-base', heroId: 'bear', tier: 'base', inputPath, promptPath,
    inputSha256: createHash('sha256').update('fixture image').digest('hex'), priority: 20,
    framing: 'portrait-head-to-pelvis', aspectRatio: '9:16', authorized: true, replacesAttemptId: null as string | null }
  const queue = join(dir, 'queue.json'); const state = join(dir, 'state.json')
  const saveQueue = (jobs = [job]) => writeFileSync(queue, JSON.stringify({ jobs }))
  saveQueue()
  const call = (...args: string[]) => {
    const r = spawnSync(process.execPath, [cli, ...args, '--queue', queue, '--state', state], { encoding: 'utf8' })
    return { code: r.status, error: r.stderr, data: r.status === 0 ? JSON.parse(r.stdout) : null }
  }
  const read = () => JSON.parse(readFileSync(state, 'utf8'))
  return { dir, job, queue, state, saveQueue, call, read, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

it('Veo CLI defers repaired-source identities, including newly added jobs, without blocking another tier', () => {
  const f = fixture()
  try {
    const future = { ...f.job, id: 'future-job' }
    writeFileSync(f.queue, JSON.stringify({ jobs: [f.job, future], sourceRepairDeferrals: [
      { portraitId: f.job.heroId, tier: f.job.tier, reason: 'User requested corrected fingers first' },
    ] }))
    assert.equal(f.call('peek').data.job, null)
    assert.equal(f.call('peek').data.blocked.length, 2)
    assert.match(f.call('claim', future.id).error, /Source portrait repair pending/)
    assert.equal(existsSync(f.state), false)
    writeFileSync(f.queue, JSON.stringify({ jobs: [future], sourceRepairDeferrals: [
      { portraitId: f.job.heroId, tier: 'different-tier', reason: 'Another image stage' },
    ] }))
    assert.equal(f.call('claim', future.id).code, 0)
  } finally { f.cleanup() }
})

it('Veo CLI records an observed account cooldown and blocks peek/claim without disturbing attempts', () => {
  const f = fixture()
  try {
    const until = new Date(Date.now() + 3_600_000).toISOString()
    const result = f.call('cooldown', '--account', 'jay-u4', '--until', until, '--note', 'Gemini UI observed quota')
    assert.equal(result.code, 0)
    assert.equal(result.data.cooldown.until, until)
    assert.equal(f.call('status').data.accountCooldown['jay-u4'], until)
    const peek = f.call('peek', '--account', 'jay-u4')
    assert.equal(peek.data.job, null)
    assert.match(peek.data.blocked[0].reason, /Account cooldown/)
    assert.match(f.call('claim', f.job.id, '--account', 'jay-u4').error, /Account cooldown/)
    assert.equal(f.call('claim', f.job.id, '--account', 'other-account').code, 0)
    const before = f.read()
    assert.equal(f.call('cooldown', '--account', 'jay-u4', '--until', until, '--note', 'UI rechecked').code, 0)
    assert.deepEqual(f.read().attempts, before.attempts)
    assert.deepEqual(f.read().claims, before.claims)
    assert.equal(f.read().accountCooldownObservations.length, 2)
  } finally { f.cleanup() }
})

it('Veo CLI rejects invalid cooldown arguments without mutating the ledger', () => {
  const f = fixture()
  try {
    f.call('claim', f.job.id)
    const before = readFileSync(f.state, 'utf8')
    const future = new Date(Date.now() + 3_600_000).toISOString()
    for (const until of ['tomorrow', '2000-01-01T00:00:00Z', '2999-01-01']) {
      assert.match(f.call('cooldown', '--account', 'jay-u4', '--until', until, '--note', 'observed').error, /Future ISO/)
      assert.equal(readFileSync(f.state, 'utf8'), before)
    }
    assert.equal(f.call('cooldown', '--account', '__proto__', '--until', future, '--note', 'observed').code, 1)
    assert.equal(f.call('cooldown', '--account', 'jay-u4', '--until', future, '--note', ' ').code, 1)
    assert.equal(f.call('cooldown', f.job.id, '--account', 'jay-u4', '--until', future, '--note', 'observed').code, 1)
    assert.equal(readFileSync(f.state, 'utf8'), before)
    assert.equal(existsSync(`${f.state}.lock`), false)
  } finally { f.cleanup() }
})

it('Veo CLI completes a locally recorded lifecycle and blocks repeat/replacement without explicit provenance', () => {
  const f = fixture()
  try {
    assert.equal(f.call('peek').data.job.id, f.job.id)
    assert.equal(existsSync(f.state), false)
    const id = f.call('claim', f.job.id).data.attempt.id
    assert.equal(f.call('claim', f.job.id).code, 1)
    const replacement = { ...f.job, id: 'bear-retry', replacesAttemptId: id }
    f.saveQueue([f.job, replacement])
    assert.match(f.call('claim', replacement.id).error, /still active/)
    assert.equal(f.call('submitted', f.job.id, '--chat', 'https://gemini.google.com/u/4/app/example').code, 0)
    assert.equal(f.call('submitted', f.job.id, '--chat', 'https://gemini.google.com/u/4/app/example').code, 1)
    assert.equal(f.call('review', f.job.id, '--verdict', 'accepted', '--note', 'loop checked').code, 1)
    const file = join(f.dir, 'result.mp4'); writeFileSync(file, 'fixture video')
    assert.equal(f.call('downloaded', f.job.id, '--file', file).code, 0)
    assert.equal(f.call('review', f.job.id, '--verdict', 'accepted', '--note', 'loop and smile checked').code, 0)
    assert.deepEqual(f.read().claims, {})
    f.saveQueue([f.job, { ...replacement, replacesAttemptId: null }])
    assert.match(f.call('claim', replacement.id).error, /Duplicate hero\/tier/)
    f.saveQueue([f.job, replacement])
    assert.equal(f.call('claim', replacement.id).code, 0)
    assert.equal(f.read().attempts.length, 2)
  } finally { f.cleanup() }
})

it('Veo CLI pins source and prompt at claim and never clears a stale claim', () => {
  const f = fixture()
  try {
    assert.equal(f.call('claim', f.job.id).code, 0)
    const before = readFileSync(f.state, 'utf8')
    writeFileSync(f.job.promptPath, 'changed prompt')
    assert.match(f.call('submitted', f.job.id, '--chat', 'https://gemini.google.com/app/example').error, /source\/prompt changed/)
    assert.equal(readFileSync(f.state, 'utf8'), before)
    assert.equal(f.call('peek').data.job, null)
    const status = f.call('status').data
    assert.equal(status.active[0].id, f.read().attempts[0].id)
    assert.equal(status.active[0].jobId, f.job.id)
    assert.equal(status.counts.claimed, 1)
    assert.equal(status.claims, undefined)
    assert.equal(status.attempts, undefined)
  } finally { f.cleanup() }
})

it('Veo CLI rejects a changed source before creating a ledger', () => {
  const f = fixture()
  try {
    writeFileSync(f.job.inputPath, 'different image')
    assert.match(f.call('claim', f.job.id).error, /Source hash changed/)
    assert.equal(existsSync(f.state), false)
    assert.equal(existsSync(`${f.state}.lock`), false)
  } finally { f.cleanup() }
})

it('Veo CLI preserves an existing exclusive lock and ledger', () => {
  const f = fixture()
  try {
    writeFileSync(`${f.state}.lock`, 'another worker or crashed worker')
    assert.match(f.call('claim', f.job.id).error, /Ledger locked/)
    assert.equal(readFileSync(`${f.state}.lock`, 'utf8'), 'another worker or crashed worker')
    assert.equal(existsSync(f.state), false)
  } finally { f.cleanup() }
})

it('Veo CLI blocks unknown/corrupt state and active account cooldowns', () => {
  const f = fixture()
  try {
    writeFileSync(f.state, '{broken')
    assert.equal(f.call('claim', f.job.id).code, 1)
    const s = { version: 1, attempts: [], claims: {}, accountCooldown: { '*': '2999-01-01T00:00:00Z', default: '2000-01-01T00:00:00Z' } }
    writeFileSync(f.state, JSON.stringify(s))
    assert.match(f.call('claim', f.job.id).error, /cooldown/)
    assert.equal(f.read().attempts.length, 0)
    s.accountCooldown = {} as typeof s.accountCooldown
    writeFileSync(f.state, JSON.stringify(s))
    assert.equal(f.call('claim', f.job.id).code, 0)
    const unknown = f.read(); unknown.attempts[0].status = 'unknown'
    writeFileSync(f.state, JSON.stringify(unknown))
    assert.match(f.call('peek').error, /Unknown\/corrupt/)
  } finally { f.cleanup() }
})

it('Veo CLI enforces authorization and framing, and verifies the reviewed artifact', () => {
  const f = fixture()
  try {
    f.saveQueue([{ ...f.job, authorized: false }])
    assert.match(f.call('claim', f.job.id).error, /Not authorized/)
    f.saveQueue([{ ...f.job, aspectRatio: '1:1' }])
    assert.match(f.call('claim', f.job.id).error, /Portrait 9:16 framing required/)
    f.saveQueue([{ ...f.job, aspectRatio: '16:9' }])
    assert.match(f.call('claim', f.job.id).error, /Portrait 9:16 framing required/)
    f.saveQueue(); f.call('claim', f.job.id)
    assert.equal(f.call('submitted', f.job.id, '--chat', 'https://example.com').code, 1)
    f.call('submitted', f.job.id, '--chat', 'https://gemini.google.com/app/example')
    const file = join(f.dir, 'result.mp4'); writeFileSync(file, 'video')
    f.call('downloaded', f.job.id, '--file', file)
    writeFileSync(file, 'modified video')
    assert.match(f.call('review', f.job.id, '--verdict', 'accepted', '--note', 'checked').error, /artifact changed/)
    assert.equal(f.call('review', f.job.id, '--verdict', 'held', '--note', 'artifact changed; manual review required').code, 0)
    assert.equal(f.read().attempts[0].status, 'held')
  } finally { f.cleanup() }
})
