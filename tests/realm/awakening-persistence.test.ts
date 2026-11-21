/** These isolated KV fixtures use the real save writer/parser and checkpoint helper.
 * They fail on lost legacy power, merit bypass, double stat award, cosmetic power changes,
 * failed-checkpoint adoption, or registry/schema overwrite. No player's storage is touched. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startTutorial } from '../../src/realm/data/regions/tutorial.ts'
import { trialBlock, completeTrial } from '../../src/realm/awakening-trial.ts'
import { battleGrowth, ascendNeed, awardAwakening } from '../../src/realm/heroes.ts'
import { P, setParam } from '../../src/tune/params.ts'
import { personOf, sameIds, DEX_AWOKE, DEX_DEMON } from '../../src/realm/person.ts'
import { HERO_BUST } from '../../src/realm/data/hero-bust.ts'
import { migrate } from '../../src/realm/migrate.ts'
import { applyCampaignAwakening, awakeningVisible, campaignAwakeningProofs } from '../../src/realm/awakening.ts'
import { AWAKENING_KEY, mergeAwakeningProofs, readAwakeningProfile, readHeroAwakening, setHeroAwakeningAppearance, checkpointCampaignAwakening } from '../../src/ui/realm/awakening-store.ts'
import { makeSaveFile, writeSave, readSave, saveKey, serializeSave, parseSaveFile, type KV, type Saved } from '../../src/ui/realm/saves.ts'
import { generalSprite } from '../../src/realm/data/art.ts'

class Mem implements KV {
  data = new Map<string, string>(); fail = false
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { if (this.fail) throw new Error('quota'); this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}
const STATS = ['mu', 'tong', 'ryak', 'chi', 'deok'] as const
function fixture(): Saved {
  const realm = startTutorial(777), h = realm.heroes['tut-haebi']!
  h.faction = realm.player; h.status = 'free'
  return { v: 2, nation: realm.player, seed: realm.seed, realm, before: structuredClone(realm), report: null, log: [[]], at: '2026-11-21T00:00:00Z', custom: { keep: ['unknown', 7] } } as Saved
}
function roundTrip(kv: Mem, saved: Saved): Saved {
  const draft = { seed: saved.realm.seed, season: saved.realm.season, player: saved.realm.player, custom: ['keep'] }
  const file = makeSaveFile(saved, draft, 'fixture', '2026-11-21T00:00:01Z')
  assert.ok(writeSave(kv, 0, file).ok)
  const read = readSave(kv, 0); assert.ok(read.ok)
  assert.deepEqual(read.file.draft, draft)
  const parsed = parseSaveFile(serializeSave(read.file)); assert.ok(parsed.ok)
  assert.equal(parsed.file.game.v, 2); assert.equal(parsed.file.fv, 1)
  migrate(parsed.file.game.realm)
  return parsed.file.game
}

test('56-A product closes legacy Haebi trial and merit bypass for both old switches', () => {
  assert.equal(P.realm.legacyAwakeningOpen, 0)
  for (const oldSwitch of [0, 1]) {
    setParam('realm.ascendTrialOpen', oldSwitch)
    const saved = fixture(), r = saved.realm, h = r.heroes['tut-haebi']!
    h.trialReady = true
    assert.notEqual(trialBlock(r, h.id), null, 'legacy Haebi trial entry must be closed')
    assert.equal(completeTrial(r, h.id), null)
    for (let i = 0; i < ascendNeed(h) + 1; i++) battleGrowth(r, [h.id], [], [], [])
    assert.notEqual(h.ascended, true, 'merit cannot replace a palisade clear')
  }
})

test('fixture 1 old trial awakening: real save round trip preserves all data, no duplicate grant', () => {
  const kv = new Mem(), saved = fixture(), h = saved.realm.heroes['tut-haebi']!
  awardAwakening(h, []); h.trialCleared = true; h.awakeningLook = false
  const before = structuredClone(saved)
  kv.setItem('hanbal.realm.v2', JSON.stringify(saved))
  assert.deepEqual(readHeroAwakening(kv, h.id), { permanentAwake: true, appearanceAwake: false }, 'standalone boot sees old campaign without app import')
  assert.ok(mergeAwakeningProofs(kv, campaignAwakeningProofs(saved.realm)).ok)
  const applied = applyCampaignAwakening(saved.realm, readAwakeningProfile(kv))
  assert.equal(applied.changed, false); assert.equal(applied.lines.length, 0)
  const loaded = roundTrip(kv, saved)
  assert.deepEqual(loaded, before, 'realm, before, log, custom fields and all stats survive')
  assert.equal(readHeroAwakening(kv, h.id).appearanceAwake, false)
})

test('fixture 2 unawakened: full merit and DEX_AWOKE alone never grant power', () => {
  const kv = new Mem(), saved = fixture(), h = saved.realm.heroes['tut-haebi']!
  h.trialReady = true; h.flames = ascendNeed(h)
  kv.setItem('hanbal.realm.v2', JSON.stringify(saved)); kv.setItem('hanbal.realm.dex', JSON.stringify({ [h.id]: { f: DEX_AWOKE } }))
  assert.deepEqual(readHeroAwakening(kv, h.id), { permanentAwake: false, appearanceAwake: true })
  assert.ok(mergeAwakeningProofs(kv, campaignAwakeningProofs(saved.realm)).ok)
  assert.equal(applyCampaignAwakening(saved.realm, readAwakeningProfile(kv)).changed, false)
  assert.deepEqual(roundTrip(kv, saved), saved)
})

test('fixture 3 palisade clear: named person gets exactly one grant and survives real saves', () => {
  const kv = new Mem(), saved = fixture(), h = saved.realm.heroes['tut-haebi']!, old = structuredClone(h)
  kv.setItem('hanbal.raid.meta', JSON.stringify({ heroes: { [h.id]: ['forest', 'ford', 'palisade'] } }))
  assert.equal(readHeroAwakening(kv, h.id).permanentAwake, true)
  assert.ok(mergeAwakeningProofs(kv, []).ok)
  const result = checkpointCampaignAwakening(saved.realm, readAwakeningProfile(kv), next => { kv.setItem('hanbal.realm.v2', JSON.stringify({ ...saved, realm: next })); return null })
  assert.equal(result.changed, true); assert.notEqual(result.next, saved.realm)
  assert.equal(h.ascended, undefined, 'original is unchanged until adoption')
  for (const stat of STATS) assert.equal(result.next.heroes[h.id]![stat], old[stat] + P.realm.ascendBonus)
  const loaded = roundTrip(kv, { ...saved, realm: result.next })
  assert.equal(loaded.realm.heroes[h.id]!.ascended, true)
  assert.deepEqual(applyCampaignAwakening(loaded.realm, readAwakeningProfile(kv)).next, loaded.realm)
  assert.equal(applyCampaignAwakening(loaded.realm, readAwakeningProfile(kv)).lines.length, 0)
  for (const other of Object.values(loaded.realm.heroes)) if (other.id !== h.id) assert.equal(other.ascended, saved.realm.heroes[other.id]!.ascended)
})

test('checkpoint failure never adopts mutated campaign; retry grants once', () => {
  const kv = new Mem(), saved = fixture(), raw = JSON.stringify(saved), id = 'tut-haebi'
  kv.setItem('hanbal.realm.v2', raw)
  mergeAwakeningProofs(kv, [{ heroId: id, unlocked: true }])
  const failed = checkpointCampaignAwakening(saved.realm, readAwakeningProfile(kv), () => 'full')
  assert.equal(failed.next, saved.realm); assert.equal(failed.changed, false)
  assert.equal(JSON.stringify(saved), raw); assert.equal(kv.getItem('hanbal.realm.v2'), raw)
  const retry = checkpointCampaignAwakening(saved.realm, readAwakeningProfile(kv), () => null)
  assert.equal(retry.next.heroes[id]!.ascents, 1)
  assert.equal(applyCampaignAwakening(retry.next, readAwakeningProfile(kv)).lines.length, 0)
})

test('appearance off changes art only, persists across aliases and portable save', () => {
  const kv = new Mem(), saved = fixture(), id = 'tut-haebi', h = saved.realm.heroes[id]!
  awardAwakening(h, []); mergeAwakeningProofs(kv, campaignAwakeningProofs(saved.realm))
  const old = structuredClone(h), oldArt = generalSprite(h)
  assert.ok(setHeroAwakeningAppearance(kv, id, false).ok)
  const applied = applyCampaignAwakening(saved.realm, readAwakeningProfile(kv)).next, view = applied.heroes[id]!
  assert.equal(awakeningVisible(view), false); assert.equal(view.ascended, true)
  for (const stat of STATS) assert.equal(view[stat], old[stat])
  assert.equal(view.ascents, old.ascents); assert.notEqual(generalSprite(view), oldArt)
  const loaded = roundTrip(kv, { ...saved, realm: applied })
  const freshKV = new Mem(); mergeAwakeningProofs(freshKV, campaignAwakeningProofs(loaded.realm))
  assert.equal(readHeroAwakening(freshKV, id).appearanceAwake, false)
  const pair = Object.keys(HERO_BUST).map(id => sameIds(id)).find(ids => ids.length > 1)!
  mergeAwakeningProofs(kv, [{ heroId: pair[0]!, unlocked: true }]); setHeroAwakeningAppearance(kv, pair[0]!, false)
  assert.equal(readHeroAwakening(kv, pair[1]!).appearanceAwake, false)
  assert.equal(JSON.parse(kv.getItem(AWAKENING_KEY)!).people[personOf(pair[0]!)].unlocked, true)
})

test('registry wins over old file, unlocks are monotonic, unknown profile fields survive', () => {
  const kv = new Mem(), id = 'tut-haebi', key = personOf(id)
  kv.setItem(AWAKENING_KEY, JSON.stringify({ v: 1, custom: { keep: 7 }, people: { [key]: { unlocked: true, appearanceAwake: false, custom: 'keep' } } }))
  mergeAwakeningProofs(kv, [{ heroId: id, unlocked: false, appearanceAwake: true }, { heroId: id, unlocked: true, appearanceAwake: true }])
  const profile = readAwakeningProfile(kv)
  assert.equal(profile.people[key]!.appearanceAwake, false); assert.equal(profile.people[key]!.unlocked, true)
  assert.deepEqual(profile.custom, { keep: 7 }); assert.equal(profile.people[key]!.custom, 'keep')
  setHeroAwakeningAppearance(kv, id, true); assert.equal(readHeroAwakening(kv, id).appearanceAwake, true)
})

test('future/corrupt registry and failed writes preserve bytes; generated or borrowed IDs never leak globally', () => {
  const kv = new Mem(), id = 'tut-haebi', raw = '{"v":2,"future":[1,2]}'
  kv.setItem(AWAKENING_KEY, raw)
  assert.equal(mergeAwakeningProofs(kv, [{ heroId: id, unlocked: true }]).ok, false)
  assert.equal(kv.getItem(AWAKENING_KEY), raw)
  kv.data.delete(AWAKENING_KEY); mergeAwakeningProofs(kv, [{ heroId: id, unlocked: true }])
  const before = kv.getItem(AWAKENING_KEY); kv.fail = true
  assert.equal(setHeroAwakeningAppearance(kv, id, false).ok, false); assert.equal(kv.getItem(AWAKENING_KEY), before)
  kv.fail = false
  kv.setItem('hanbal.realm.dex', JSON.stringify({ 'kid-g-1': { f: DEX_DEMON }, 'tut-malgalgi': { f: DEX_AWOKE } }))
  kv.setItem('hanbal.realm.v2', JSON.stringify({ v: 2, realm: { player: 'us', heroes: { 'tut-malgalgi': { faction: 'us', ascended: true } } } }))
  mergeAwakeningProofs(kv, [{ heroId: 'kid-g-1', unlocked: true }])
  assert.equal(readHeroAwakening(kv, 'kid-g-1').permanentAwake, false)
  assert.equal(readHeroAwakening(kv, 'tut-malgalgi').permanentAwake, false)
  kv.setItem('hanbal.raid.meta', JSON.stringify({ heroes: { 'tut-malgalgi': ['palisade'] } }))
  assert.equal(readHeroAwakening(kv, 'tut-malgalgi').permanentAwake, true, 'a real palisade clear is valid even for the tutorial identity')
  assert.ok(kv.getItem(saveKey(0)) === null)
})

test('standalone boot reads previous campaign only when current is unreadable, and roster legacy proof', () => {
  const kv = new Mem(), saved = fixture(), h = saved.realm.heroes['tut-haebi']!
  awardAwakening(h, []); h.trialCleared = true
  kv.setItem('hanbal.realm.v2.prev', JSON.stringify(saved)); kv.setItem('hanbal.realm.v2', '{broken')
  assert.equal(readHeroAwakening(kv, h.id).permanentAwake, true)
  kv.setItem('hanbal.realm.v2', JSON.stringify(fixture()))
  assert.equal(readHeroAwakening(kv, h.id).permanentAwake, false, 'readable current game wins over a different old game')
  kv.setItem('hanbal.raid.roster', JSON.stringify([{ id: h.id, ascended: true, awakeningLook: false }]))
  assert.deepEqual(readHeroAwakening(kv, h.id), { permanentAwake: true, appearanceAwake: false })
})

test('profile readback mismatch restores the exact previous profile bytes', () => {
  const kv = new Mem(), id = 'tut-haebi'
  mergeAwakeningProofs(kv, [{ heroId: id, unlocked: true }])
  const before = kv.getItem(AWAKENING_KEY), original = kv.setItem.bind(kv)
  let corruptOnce = true
  kv.setItem = (key, value) => { original(key, key === AWAKENING_KEY && corruptOnce ? value + ' ' : value); corruptOnce = false }
  assert.equal(setHeroAwakeningAppearance(kv, id, false).ok, false)
  assert.equal(kv.getItem(AWAKENING_KEY), before)
})
