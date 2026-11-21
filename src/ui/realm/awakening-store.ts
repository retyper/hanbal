/** 56-A storage boundary. KV is injected so tests never touch a player's localStorage. */
import type { KV } from './saves.ts'
import type { Realm, ReportLine } from '../../realm/types.ts'
import { personOf, DEX_DEMON } from '../../realm/person.ts'
import { applyCampaignAwakening, awakeningPersonAllowed, campaignAwakeningProofs, mergeAwakeningProfile, type AwakeningProfile, type AwakeningProof } from '../../realm/awakening.ts'

export const AWAKENING_KEY = 'hanbal.realm.awakening.v1'
export type AwakeningWrite = { ok: boolean; changed: boolean; why?: string }
const empty = (): AwakeningProfile => ({ v: 1, people: {} })
const obj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
const parse = (raw: string | null): unknown => { try { return raw === null ? null : JSON.parse(raw) as unknown } catch { return undefined } }
const get = (kv: KV, key: string): string | null => { try { return kv.getItem(key) } catch { return null } }
function valid(x: unknown): x is AwakeningProfile {
  return obj(x) && x['v'] === 1 && obj(x['people'])
    && Object.values(x['people']).every(e => obj(e) && e['unlocked'] === true && (e['appearanceAwake'] === undefined || typeof e['appearanceAwake'] === 'boolean'))
}

/** Standalone raids can recover old campaign/trial unlocks without importing the campaign app.
 * DEX_AWOKE alone is deliberately excluded: old borrowed tutorial records are ambiguous. */
export function storedAwakeningProofs(kv: KV): AwakeningProof[] {
  const out: AwakeningProof[] = []
  const current = parse(get(kv, 'hanbal.realm.v2'))
  const saved = obj(current) && current['v'] === 2 && obj(current['realm']) ? current : parse(get(kv, 'hanbal.realm.v2.prev'))
  if (obj(saved) && saved['v'] === 2 && obj(saved['realm'])) {
    const r = saved['realm']
    if (typeof r['player'] === 'string' && obj(r['heroes'])) for (const [id, value] of Object.entries(r['heroes'])) {
      if (obj(value) && value['faction'] === r['player'] && value['ascended'] === true && (id !== 'tut-malgalgi' || value['trialCleared'] === true))
        out.push({ heroId: id, unlocked: true, ...(typeof value['awakeningLook'] === 'boolean' ? { appearanceAwake: value['awakeningLook'] } : {}) })
    }
  }
  const roster = parse(get(kv, 'hanbal.raid.roster'))
  if (Array.isArray(roster)) for (const h of roster) if (obj(h) && typeof h['id'] === 'string' && h['ascended'] === true && (h['id'] !== 'tut-malgalgi' || h['trialCleared'] === true))
    out.push({ heroId: h['id'], unlocked: true, ...(typeof h['awakeningLook'] === 'boolean' ? { appearanceAwake: h['awakeningLook'] } : {}) })
  const meta = parse(get(kv, 'hanbal.raid.meta'))
  if (obj(meta) && obj(meta['heroes'])) for (const [id, stages] of Object.entries(meta['heroes']))
    if (Array.isArray(stages) && stages.includes('palisade')) out.push({ heroId: id, unlocked: true })
  const dex = parse(get(kv, 'hanbal.realm.dex'))
  if (obj(dex)) for (const [id, e] of Object.entries(dex))
    if (obj(e) && typeof e['f'] === 'number' && (e['f'] & DEX_DEMON) !== 0) out.push({ heroId: id, unlocked: true })
  return out
}

/** Read-only effective profile, including legacy proofs. Never overwrites malformed/future data. */
export function readAwakeningProfile(kv: KV): AwakeningProfile {
  const raw = parse(get(kv, AWAKENING_KEY))
  return mergeAwakeningProfile(valid(raw) ? raw : empty(), storedAwakeningProofs(kv))
}
export function readHeroAwakening(kv: KV, id: string): { permanentAwake: boolean; appearanceAwake: boolean } {
  const entry = awakeningPersonAllowed(id) ? readAwakeningProfile(kv).people[personOf(id)] : undefined
  return { permanentAwake: entry?.unlocked === true, appearanceAwake: entry?.appearanceAwake !== false }
}

function write(kv: KV, before: string | null, profile: AwakeningProfile): AwakeningWrite {
  const json = JSON.stringify(profile)
  if (json === before) return { ok: true, changed: false }
  try {
    kv.setItem(AWAKENING_KEY, json)
    if (kv.getItem(AWAKENING_KEY) !== json) throw new Error('readback')
    return { ok: true, changed: true }
  } catch {
    try { if (before === null) kv.removeItem(AWAKENING_KEY); else kv.setItem(AWAKENING_KEY, before) } catch { /* best effort, keep prior entitlement */ }
    return { ok: false, changed: false, why: '각성 기록을 저장하지 못했습니다. 저장 공간을 확인해 주세요.' }
  }
}
function writable(kv: KV): { before: string | null; profile: AwakeningProfile } | null {
  let before: string | null
  try { before = kv.getItem(AWAKENING_KEY) } catch { return null }
  const raw = parse(before)
  return before === null ? { before, profile: empty() } : valid(raw) ? { before, profile: raw } : null
}
export function mergeAwakeningProofs(kv: KV, proofs: readonly AwakeningProof[]): AwakeningWrite {
  const old = writable(kv)
  if (old === null) return { ok: false, changed: false, why: '현재 각성 기록 형식을 읽을 수 없어 보존했습니다.' }
  return write(kv, old.before, mergeAwakeningProfile(old.profile, [...proofs, ...storedAwakeningProofs(kv)]))
}
export function setHeroAwakeningAppearance(kv: KV, id: string, on: boolean): AwakeningWrite {
  const old = writable(kv)
  if (old === null) return { ok: false, changed: false, why: '현재 각성 기록 형식을 읽을 수 없어 보존했습니다.' }
  const profile = mergeAwakeningProfile(old.profile, storedAwakeningProofs(kv)), key = personOf(id), entry = profile.people[key]
  if (!awakeningPersonAllowed(id) || entry?.unlocked !== true) return { ok: false, changed: false, why: '각성한 장수의 모습만 바꿀 수 있습니다.' }
  return write(kv, old.before, { ...profile, people: { ...profile.people, [key]: { ...entry, appearanceAwake: on } } })
}
/** Actual checkpoint boundary shared with tests. Failed saves never adopt the candidate. */
export function checkpointCampaignAwakening(realm: Realm, profile: AwakeningProfile, checkpoint: (next: Realm) => string | null): { next: Realm; changed: boolean; lines: ReportLine[]; why: string | null } {
  const candidate = applyCampaignAwakening(realm, profile)
  if (!candidate.changed) return { ...candidate, why: null }
  const why = checkpoint(candidate.next)
  return why ? { next: realm, changed: false, lines: [], why } : { ...candidate, why: null }
}
export { campaignAwakeningProofs }
