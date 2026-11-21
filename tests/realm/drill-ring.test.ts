/**
 * 단련터 얼굴 링 (58-B · src/ui/realm/drill.ts · hero-ring.ts) — 목록 카드 대신 데려갈 장수와 같은 고리
 *
 *  - 고리 위 한 줄: 필터 · 정렬 · 공 남은 장수만 (눌린 채 남는다) · 찾기는 필터 판 안에
 *  - 고리는 거른 사람만 · 정렬을 따른다 · 앞에 선 장수를 「단련하기」가 편다
 *  - 펼치면 고리 자리에 능력 · 유물 판 (+ 단추 그대로) · ◀ ▶ 로 옆 사람 · 「목록으로」면 그 사람이 고리 앞에
 *  - 화면 글만 바꾼다 — 단련 기록(저장 칸)은 읽기만 한다
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { dexCatalog } from '../../src/realm/dex.ts'
import * as yard from '../../src/ui/realm/drill.ts'

const cat = dexCatalog().filter((x) => !x.ruler).slice(0, 4)
const ids = cat.map((x) => x.id)
// 둘은 공이 남고 둘은 공이 없다 · 단련은 0 · 3 · 1 · 5 (단련 단계는 올린 칸의 합으로 다시 센다 · loadDrill)
const LV = [0, 3, 1, 5]
const store = { v: 1, h: Object.fromEntries(ids.map((id, i) => [id, { points: i % 2 === 0 ? 20 : 0, add: { deok: LV[i] }, runs: 1 }])), paid: {}, order: [] }

function memory(values: Record<string, unknown>) {
  const m = new Map(Object.entries(values).map(([k, v]) => [k, JSON.stringify(v)]))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, snapshot: () => JSON.stringify([...m]) }
}
const kv = memory({ 'hanbal.realm.drill': store })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: kv })

const kit: yard.DrillKit = {
  esc: (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`),
  bust: () => null,
  bodyOf: (id) => cat.find((x) => x.id === id)?.hero,
  meta: (id) => ({ nation: cat.find((x) => x.id === id)?.nationName ?? '', grade: null, awake: false }),
  relic: { art: '/realm/', esc: (s) => s, nameOf: (id) => id },
  art: '/realm/',
  looks: () => () => false,
  voice: () => undefined,
}
const opts = { ids: null, gain: {}, fell: [], anim: false, last: null, from: 'title' as const }
const html = (): string => yard.yardHtml(kit, opts)
/** 고리 칸 수 — 장수가 열 명 이하면 고리에 선 장수 수와 같다 */
const slots = (h: string): number => (h.match(/class="hrg-slot"/g) ?? []).length

describe('단련터 — 얼굴 링', () => {
  beforeEach(() => yard.yardReset())

  it('고리 · 고리 위 필터 · 정렬 · 공 남음 · 아래 붙박이 단추', () => {
    const h = html()
    assert.match(h, /class="hrg[ "]/)
    assert.equal(slots(h), 4)
    assert.match(h, /class="hrg-head"/)
    assert.match(h, /data-act="dy-pop" data-v="filter"/)
    assert.match(h, /data-act="dy-pop" data-v="sort"/)
    assert.match(h, /data-act="dy-fs" data-g="state" data-v="ready"/)
    assert.match(h, /<div class="hrg-go">/)
    assert.match(h, /data-act="dy-hero"/)
    assert.match(h, /data-act="dy-next"/)
    assert.doesNotMatch(h, /class="dyrow/, '옛 카드 목록은 없다')
  })

  it('공 남은 장수만 — 고리가 그 사람들로 · 다시 누르면 풀린다', () => {
    assert.equal(yard.yardAct('dy-fs', { g: 'state', v: 'ready' }), true)
    assert.equal(slots(html()), 2)
    yard.yardAct('dy-fs', { g: 'state', v: 'ready' })
    assert.equal(slots(html()), 4)
  })

  it('정렬 — 단련 높은 순이면 단련 5 인 장수가 앞에 선다 · 정렬 판은 떴다 닫힌다', () => {
    yard.yardAct('dy-pop', { v: 'sort' })
    assert.match(html(), /data-act="dy-sort" data-v="level"/)
    yard.yardAct('dy-sort', { v: 'level' })
    const h = html()
    assert.doesNotMatch(h, /data-act="dy-sort"/, '고르면 판이 닫힌다')
    assert.match(h, /✓ 정렬/)
    // 앞 장수의 정보(처음 그림) — 단련 5
    assert.match(h, /<span class="hrg-lv">단련 5<\/span>/)
  })

  it('찾기는 필터 판 안 — 맞는 수만 센다 (다시 그리지 않는다)', () => {
    yard.yardAct('dy-pop', { v: 'filter' })
    assert.match(html(), /class="dysearch"/)
    const shown: string[] = []
    const root = { querySelector: () => ({ set textContent(v: string) { shown.push(v) } }) } as unknown as HTMLElement
    yard.yardSearch(root, cat[0]!.name)
    assert.equal(shown.at(-1), '1명 보기')
    yard.yardAct('dy-pop', { v: '' })
    assert.equal(slots(html()), 1)
  })

  it('「단련하기」 — 앞 장수를 편다 · 고리 자리에 능력 판 · ◀ ▶ · 목록으로 돌아오면 그 사람이 앞에', () => {
    html()
    assert.equal(yard.yardAct('dy-hero', {}), true, '아래 단추는 id 없이 고리 앞 장수를')
    let h = html()
    assert.match(h, /class="hrg-wheel hrg-panel"/)
    assert.match(h, /class="dyst2/)
    assert.match(h, /data-act="dy-hback"/)
    assert.equal((h.match(/class="btn dystep"/g) ?? []).length, 2)
    assert.doesNotMatch(h, /class="hrg-slot"/, '펼치면 고리가 없다')
    // 공이 남은 장수 — + 단추가 산다
    yard.yardAct('dy-hero', { id: ids[0]! })
    h = html()
    assert.match(h, new RegExp(`data-act="dy-up" data-id="${ids[0]}"`))
    yard.yardAct('dy-hback', {})
    h = html()
    assert.equal(slots(h), 4)
    // 기본 순서는 단련 높은 이부터 — 펼쳤던 장수(단련 0)가 네 번째 자리에서 고리 앞에 선다
    assert.match(h, /<div class="hrg-count"><b>4<\/b> \/ 4<\/div>/)
  })

  it('저장 칸은 읽기만 한다', () => {
    const before = kv.snapshot()
    html()
    yard.yardAct('dy-hero', {})
    html()
    assert.equal(kv.snapshot(), before)
  })
})
