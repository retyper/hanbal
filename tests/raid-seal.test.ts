// 열전의 시작과 판 안 각성 자격 (11-19 형: 「시작은 평타만」 · 각성 v2 가7 「판 안 각성은 도깨비 도장 뒤에만」)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_TREE as T, HAEBI_ULT as U, HAEBI_VANGUARD as V, HAEBI_AWAKEN as A, HAEBI_RUN as C } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, xpNeeded, spawnMob, gaugeNeed, awakenedLook, ultOpen, KITS, type HaebiRun, type Kit } from '../src/raid/haebi.ts'
import { replay } from '../src/raid/haebi-replay.ts'
import { DEMON_STAGE, DEX_KEY, META_KEY, demonSealed, hasDemonSeal } from '../src/raid/link.ts'
import { DEX_AWOKE, DEX_DEMON, sameIds } from '../src/realm/person.ts'
import { HERO_BUST } from '../src/realm/data/hero-bust.ts'

const KIT7 = Object.keys(KITS) as Kit[]
const idle = { x: 0, y: 0 }
const DT = 1 / 120
/** 적이 저절로 안 나오는 판 */
function quiet(s: HaebiRun) { s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9; return s }

test('판은 평타(주 무기)만으로 시작한다 — 보조 공격 0 · 비기 잠김 · 시련도 같다', () => {
  for (const mode of ['stage', 'trial'] as const) for (const kit of KIT7) {
    const s = createHaebi(7, mode, kit), k = KITS[kit]
    assert.equal(s.ranks[k.primary], T.startPrimary, `${mode}/${kit} 주 무기`)
    assert.equal(s.ranks[k.secondary], T.startSecondary, `${mode}/${kit} 보조`)
    assert.equal(T.startSecondary, 0, '보조는 레벨업 카드로 얻는다')
    assert.equal(ultOpen(s), false, `${mode}/${kit} 비기는 잠김`)
  }
})

test('선봉은 갖춘 채로 선다 — 보조 공격·조합·비기가 처음부터', () => {
  for (const kit of KIT7) {
    const s = createHaebi(7, 'vanguard', kit)
    assert.equal(s.level, V.startLevel); assert.ok(s.ranks[KITS[kit].secondary] > 0, kit); assert.ok(ultOpen(s), kit)
  }
})

test('첫 레벨업 전엔 보조 공격이 안 나가고, 첫 카드의 맨 앞이 보조 공격 · 고르면 나간다 · 비기도 그때 열린다', () => {
  const s = quiet(createHaebi(7, 'stage', 'sword')); s.cool.sword = 1e9   // 칼질은 쉬게 하고 검기만 본다
  spawnMob(s); Object.assign(s.enemies[0]!, { x: s.x + 160, y: s.y, hp: 1e6, max: 1e6 })
  for (let i = 0; i < 240; i++) stepHaebi(s, idle, DT)
  assert.equal(s.shots.filter(m => m.kind === 'wave').length, 0, '검기 없이 시작')
  s.xp = xpNeeded(s); stepHaebi(s, idle, DT)
  assert.equal(s.offers[0], KITS.sword.secondary, '첫 카드 맨 앞 = 보조 공격')
  assert.ok(choose(s, 'wave')); assert.equal(s.ranks.wave, 1); assert.equal(s.level, U.unlockLevel); assert.ok(ultOpen(s))
  let waves = 0
  for (let i = 0; i < 240; i++) { stepHaebi(s, idle, DT); waves = Math.max(waves, s.shots.filter(m => m.kind === 'wave').length) }
  assert.ok(waves > 0, '고른 뒤엔 검기가 나간다')
})

/** 같은 사람의 id 둘 (초상을 같이 쓰는 쌍) */
function pair(): [string, string] {
  for (const id of Object.keys(HERO_BUST)) { const ids = sameIds(id); if (ids.length > 1) return [ids[0]!, ids[1]!] }
  throw new Error('같은 사람 쌍이 없다')
}

test('도깨비 도장: 영웅전 비트 32 를 사람으로 묶어 읽고, 표로 안 옮긴 목책 깸도 친다 · 본편 도장만으로는 아니다', () => {
  const [a, b] = pair()
  assert.equal(hasDemonSeal({}, {}, a), false, '도장 없음')
  assert.equal(hasDemonSeal({ [a]: { f: DEX_AWOKE } }, {}, a), false, '본편 도장(16)만으로는 안 된다')
  assert.equal(hasDemonSeal({ [a]: { f: DEX_DEMON } }, {}, a), true)
  assert.equal(hasDemonSeal({ [a]: { f: DEX_DEMON } }, {}, b), true, '같은 사람이면 다른 id 로 잡은 도장도')
  assert.equal(hasDemonSeal({}, { [b]: ['forest', DEMON_STAGE] }, a), true, '열전 기록의 목책 깸 (아라처럼 먼저 깬 장수)')
  assert.equal(hasDemonSeal({}, { [a]: ['forest', 'ford'] }, a), false, '목책 전까지는 아니다')
  assert.equal(hasDemonSeal({}, { 'y-kid-1': [DEMON_STAGE] }, 'y-kid-1'), false, '초상이 없는 id(판마다 새로 나는 자녀)는 기록이 겹쳐 안 센다')
})

test('도깨비 도장 읽기: 저장소의 영웅전 표에서 읽고, 표가 없거나 깨져도 도장 없음으로 선다', () => {
  const [a] = pair(), store = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } }
  try {
    assert.equal(demonSealed(a, {}), false, '표가 없음')
    store.set(DEX_KEY, '[1,2'); assert.equal(demonSealed(a, {}), false, '깨진 표')
    store.set(DEX_KEY, JSON.stringify({ [a]: { f: DEX_DEMON | 1 } })); assert.equal(demonSealed(a, {}), true)
    store.delete(DEX_KEY); store.set(META_KEY, '{}'); assert.equal(demonSealed(a, { [a]: [DEMON_STAGE] }), true, '화면이 넘긴 열전 기록')
  } finally { delete (globalThis as { localStorage?: unknown }).localStorage }
  assert.equal(demonSealed(a, {}), false, '저장소가 없는 곳(사생활 창 등)')
})

/** 막대를 채우고 단추를 누른다 */
function wakeAt(s: HaebiRun) { s.level = C.maxLevel; s.gauge = gaugeNeed(s); stepHaebi(s, { ...idle, wake: true }, DT); return s }

test('도장 없음 = 막대가 차면 투지(보호막) · 도장 있음 = 각성 (각성 띠가 없는 장수도 판의 셈은 같다)', () => {
  for (const kit of ['sword', 'axe', 'magic'] as Kit[]) {
    const [a] = pair()
    const none = wakeAt(quiet(createHaebi(7, 'stage', kit, { awaken: hasDemonSeal({}, {}, a) })))
    assert.equal(none.form, 'grit', kit); assert.ok(none.ward > 0); assert.equal(awakenedLook(none), false)
    const sealed = wakeAt(quiet(createHaebi(7, 'stage', kit, { awaken: hasDemonSeal({ [a]: { f: DEX_DEMON } }, {}, a) })))
    assert.equal(sealed.cast?.kind, 'wake', kit)
    for (let t = 0; t < A.cast + .1; t += DT) stepHaebi(sealed, idle, DT)
    assert.equal(sealed.form, 'awake', kit); assert.ok(awakenedLook(sealed))
  }
})

test('같은 씨앗·같은 자격이면 같은 판 · 자격이 다르면 각성(투지)한 판이 갈린다', () => {
  for (const kit of ['bow', 'sling'] as Kit[]) {
    const a = replay(13, 300, 'storm', undefined, kit, { awaken: true }), b = replay(13, 300, 'storm', undefined, kit, { awaken: true })
    assert.deepEqual(a, b, kit)
    const g = replay(13, 300, 'storm', undefined, kit, { awaken: false }), h = replay(13, 300, 'storm', undefined, kit, { awaken: false })
    assert.deepEqual(g, h, kit)
    assert.equal(a.canAwaken, true); assert.equal(g.canAwaken, false)
    if (a.wakes > 0) assert.notDeepEqual(a, g, `${kit} 각성과 투지는 다른 판`)
  }
})
