#!/usr/bin/env node
/** Local-only Veo submission ledger. Paths are relative to the invoking cwd.
 * node tools/veo/queue.mjs status|peek|claim|submitted|downloaded|review|cooldown [jobId]
 * --queue outputs/veo-production-queue.json --state outputs/veo-production-state.json
 * Never removes stale claims/locks, retries submissions, or operates a browser.
 */
import { readFileSync, existsSync, statSync, mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const phases = new Set(['claimed', 'submitted', 'downloaded', 'accepted', 'held'])
const terminal = new Set(['accepted', 'held'])
function check(ok, message) { if (!ok) throw new Error(message) }
function hash(path) {
  check(existsSync(path) && statSync(path).isFile() && statSync(path).size > 0, `Missing/empty file: ${path}`)
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
function parse(args) {
  const opts = {}; const pos = []
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) { pos.push(args[i]); continue }
    const key = args[i].slice(2)
    check(['queue', 'state', 'chat', 'file', 'verdict', 'note', 'account', 'until'].includes(key), `Unknown option: --${key}`)
    check(!Object.hasOwn(opts, key) && args[i + 1] && !args[i + 1].startsWith('--'), `Missing/duplicate --${key}`)
    opts[key] = args[++i]
  }
  check(pos.length <= 2, 'Expected command and optional jobId')
  return { opts, command: pos[0] ?? 'status', jobId: pos[1] }
}
function loadQueue(path) {
  const data = JSON.parse(readFileSync(path, 'utf8')); const jobs = Array.isArray(data) ? data : data.jobs
  check(Array.isArray(jobs), 'Queue must contain jobs[]')
  const ids = new Set()
  for (const j of jobs) {
    check(j && ['id', 'heroId', 'tier', 'inputPath', 'inputSha256', 'promptPath'].every(k => typeof j[k] === 'string' && j[k].length > 0), 'Invalid queue job')
    check(!ids.has(j.id), `Duplicate job: ${j.id}`); ids.add(j.id)
    check(/^[a-f0-9]{64}$/i.test(j.inputSha256), `Invalid inputSha256: ${j.id}`)
    check(Number.isFinite(j.priority), `Missing priority: ${j.id}`)
    check(j.framing === 'portrait-head-to-pelvis', `Required framing portrait-head-to-pelvis: ${j.id}`)
    check(j.aspectRatio === '9:16', `Portrait 9:16 framing required: ${j.id}`)
    check(j.replacesAttemptId == null || typeof j.replacesAttemptId === 'string', `Invalid replacement: ${j.id}`)
  }
  return jobs
}
function loadState(path) {
  if (!existsSync(path)) return { version: 1, attempts: [], claims: {}, accountCooldown: {} }
  const s = JSON.parse(readFileSync(path, 'utf8'))
  check(s.version === 1 && Array.isArray(s.attempts) && s.claims && typeof s.claims === 'object' && !Array.isArray(s.claims) && s.accountCooldown && typeof s.accountCooldown === 'object' && !Array.isArray(s.accountCooldown), 'Unknown state schema; manual reconciliation required')
  const ids = new Set()
  for (const a of s.attempts) {
    check(a && typeof a.id === 'string' && !ids.has(a.id) && typeof a.jobId === 'string' && typeof a.heroId === 'string' && typeof a.tier === 'string' && phases.has(a.status), 'Unknown/corrupt attempt; manual reconciliation required')
    check(/^[a-f0-9]{64}$/i.test(a.inputSha256 ?? '') && /^[a-f0-9]{64}$/i.test(a.promptSha256 ?? ''), 'Attempt hashes missing; manual reconciliation required')
    ids.add(a.id)
    if (!terminal.has(a.status)) check(s.claims[a.jobId] === a.id, `Missing active claim: ${a.id}`)
  }
  for (const [jobId, id] of Object.entries(s.claims)) check(s.attempts.some(a => a.id === id && a.jobId === jobId && !terminal.has(a.status)), `Orphan claim: ${jobId}`)
  for (const until of Object.values(s.accountCooldown)) check(typeof until === 'string' && Number.isFinite(Date.parse(until)), 'Unknown cooldown; manual reconciliation required')
  check(s.accountCooldownObservations === undefined || Array.isArray(s.accountCooldownObservations), 'Unknown cooldown observations; manual reconciliation required')
  return s
}
function fingerprints(job, attempt) {
  const inputSha256 = hash(resolve(job.inputPath)); const promptSha256 = hash(resolve(job.promptPath))
  check(inputSha256 === job.inputSha256.toLowerCase(), `Source hash changed: ${job.id}`)
  if (job.promptSha256 != null) check(promptSha256 === job.promptSha256.toLowerCase(), `Prompt hash changed: ${job.id}`)
  if (attempt) check(inputSha256 === attempt.inputSha256 && promptSha256 === attempt.promptSha256, `Claimed source/prompt changed: ${job.id}`)
  return { inputSha256, promptSha256 }
}
function eligible(job, state, account) {
  check(job.authorized === true, `Not authorized: ${job.id}`)
  check(!state.attempts.some(a => a.jobId === job.id), `Job already attempted: ${job.id}; create an explicit replacement job`)
  const previous = state.attempts.filter(a => a.heroId === job.heroId && a.tier === job.tier)
  if (previous.length) {
    const latest = previous.at(-1)
    check(job.replacesAttemptId === latest.id, `Duplicate hero/tier: ${job.heroId}/${job.tier}; replacesAttemptId must name latest attempt ${latest.id}`)
    check(terminal.has(latest.status), `Previous attempt still active: ${latest.id}; reconcile/review it first`)
  } else check(job.replacesAttemptId == null, `Replacement attempt does not exist: ${job.replacesAttemptId}`)
  const accountId = account ?? job.accountId ?? 'default'
  for (const until of [state.accountCooldown[accountId], state.accountCooldown['*']]) {
    check(!until || Date.parse(until) <= Date.now(), `Account cooldown: ${accountId} until ${until}`)
  }
  fingerprints(job)
  return accountId
}
function atomicSave(path, state) {
  const temp = `${path}.${process.pid}.tmp`; let fd
  try {
    fd = openSync(temp, 'wx'); writeFileSync(fd, `${JSON.stringify(state, null, 2)}\n`); fsyncSync(fd); closeSync(fd); fd = undefined
    renameSync(temp, path)
  } finally { if (fd !== undefined) closeSync(fd); if (existsSync(temp)) unlinkSync(temp) }
}
export function run(args) {
  const { opts, command, jobId } = parse(args)
  check(['status', 'peek', 'claim', 'submitted', 'downloaded', 'review', 'cooldown'].includes(command), `Unknown command: ${command}`)
  const queuePath = resolve(opts.queue ?? 'outputs/veo-production-queue.json')
  const statePath = resolve(opts.state ?? 'outputs/veo-production-state.json')
  check(queuePath !== statePath, 'Queue and state paths must differ')
  const mutate = !['status', 'peek'].includes(command)
  let lockFd; const lockPath = `${statePath}.lock`
  try {
    if (mutate) {
      mkdirSync(dirname(statePath), { recursive: true })
      try { lockFd = openSync(lockPath, 'wx'); writeFileSync(lockFd, `pid=${process.pid}\n`) }
      catch (e) { if (e.code === 'EEXIST') throw new Error(`Ledger locked: ${lockPath}; reconcile manually, never auto-unlock`); throw e }
    }
    const jobs = loadQueue(queuePath); const state = loadState(statePath)
    if (command === 'cooldown') {
      check(jobId === undefined, 'cooldown does not accept a jobId')
      check(typeof opts.account === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(opts.account), 'Valid --account required')
      check(typeof opts.until === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(opts.until)
        && Number.isFinite(Date.parse(opts.until)) && Date.parse(opts.until) > Date.now(), 'Future ISO --until required')
      check(typeof opts.note === 'string' && opts.note.trim().length > 0, '--note required')
      const until = new Date(opts.until).toISOString()
      const observation = { accountId: opts.account, until, note: opts.note.trim(), observedAt: new Date().toISOString() }
      state.accountCooldown[opts.account] = until
      state.accountCooldownObservations ??= []
      state.accountCooldownObservations.push(observation)
      atomicSave(statePath, state)
      return { cooldown: observation }
    }
    if (command === 'status') {
      const counts = Object.fromEntries([...phases].map(phase => [phase, state.attempts.filter(a => a.status === phase).length]))
      const active = state.attempts.filter(a => !terminal.has(a.status)).map(a => ({
        id: a.id, jobId: a.jobId, heroId: a.heroId, tier: a.tier, status: a.status, chatUrl: a.chatUrl,
      }))
      return { jobs: jobs.length, counts, active, accountCooldown: state.accountCooldown }
    }
    if (command === 'peek') {
      const blocked = []
      for (const job of [...jobs].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id, 'en'))) {
        try { eligible(job, state, opts.account); return { job, blocked } }
        catch (e) { blocked.push({ jobId: job.id, reason: e.message }) }
      }
      return { job: null, blocked }
    }
    check(jobId, 'Explicit jobId required')
    const job = jobs.find(j => j.id === jobId); check(job, `Unknown job: ${jobId}`)
    const now = new Date().toISOString(); let attempt
    if (command === 'claim') {
      const accountId = eligible(job, state, opts.account)
      const id = `${job.id}:${state.attempts.length + 1}`
      check(!state.attempts.some(a => a.id === id), 'Attempt id collision; reconcile manually')
      attempt = { id, jobId: job.id, heroId: job.heroId, tier: job.tier, status: 'claimed', inputPath: resolve(job.inputPath), promptPath: resolve(job.promptPath), ...fingerprints(job), accountId, replacesAttemptId: job.replacesAttemptId ?? null, createdAt: now, updatedAt: now }
      state.attempts.push(attempt); state.claims[job.id] = id
    } else {
      attempt = state.attempts.find(a => a.id === state.claims[job.id])
      check(attempt, `No active claim: ${jobId}; do not resubmit automatically`)
      check(attempt.heroId === job.heroId && attempt.tier === job.tier, 'Claim identity changed')
      fingerprints(job, attempt)
      if (command === 'submitted') {
        check(attempt.status === 'claimed', `Cannot submit from ${attempt.status}`)
        let url; try { url = new URL(opts.chat) } catch { throw new Error('Valid --chat URL required') }
        check(url.protocol === 'https:' && url.hostname === 'gemini.google.com', 'Expected HTTPS Gemini chat URL')
        attempt.chatUrl = url.href; attempt.status = 'submitted'
      } else if (command === 'downloaded') {
        check(attempt.status === 'submitted', `Cannot download from ${attempt.status}`)
        check(opts.file, '--file required'); const file = resolve(opts.file)
        attempt.fileSha256 = hash(file); attempt.filePath = file; attempt.status = 'downloaded'
      } else {
        check(['accepted', 'held'].includes(opts.verdict), '--verdict accepted|held required')
        check(typeof opts.note === 'string' && opts.note.trim().length > 0, '--note required')
        if (opts.verdict === 'accepted') {
          check(attempt.status === 'downloaded', 'Accept requires downloaded artifact')
          check(hash(attempt.filePath) === attempt.fileSha256, 'Downloaded artifact changed')
        }
        attempt.status = opts.verdict; attempt.reviewNote = opts.note; delete state.claims[job.id]
      }
      attempt.updatedAt = now
    }
    atomicSave(statePath, state)
    return { attempt }
  } finally {
    if (lockFd !== undefined) { closeSync(lockFd); unlinkSync(lockPath) }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(run(process.argv.slice(2)), null, 2)) }
  catch (e) { console.error(`Veo queue stopped: ${e.message}`); process.exitCode = 1 }
}
