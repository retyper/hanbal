/**
 * 자기 최고 시간 (docs/MEGAHIT.md §8-④) — 세이브 계층의 계약.
 *
 * 이 기능의 전부는 **갱신하는 순간**이다. 그래서 여기서 지키는 것은 하나다:
 * **못 깨는 기록이 박히지 않는다.** 0초·음수·NaN이 한 번이라도 들어가면
 * 그 판의 갱신은 그 사람에게서 영원히 사라진다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const store = new Map<string, string>()
;(globalThis as Record<string, unknown>)['localStorage'] = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}

const { defaultSave, loadSave, writeSave, SCHEMA_VERSION } = await import('../src/game/save.ts')
const KEY = 'hanbal.save.v1'

/** 날것을 그대로 넣고 다시 읽는다 — 정화·마이그레이션 경로를 통과시키는 유일한 길. */
function roundTrip(raw: unknown): ReturnType<typeof loadSave> {
  store.set(KEY, JSON.stringify(raw))
  return loadSave()
}

describe('자기 최고 시간', () => {
  it('새 세이브는 기록이 비어 있다 (0초가 아니라 없음)', () => {
    assert.deepEqual(defaultSave(0).bestTime, {})
  })

  it('소수를 지킨다 — 정수로 자르면 동점이 되어 갱신이 사라진다', () => {
    const s = roundTrip({ ...defaultSave(0), bestTime: { '1-1': 12.34, '1-2': 9.876 } })
    assert.equal(s.bestTime['1-1'], 12.34)
    assert.equal(s.bestTime['1-2'], 9.88, '0.01초 단위로 남아야 한다')
  })

  it('0초·음수·NaN·문자열은 버린다 (한 번 박히면 영원히 못 깬다)', () => {
    const s = roundTrip({
      ...defaultSave(0),
      bestTime: { a: 0, b: -3, c: Number.NaN, d: 'x', e: 4.2 },
    })
    for (const k of ['a', 'b', 'c', 'd']) {
      assert.equal(s.bestTime[k], undefined, `${k} 가 기록으로 들어갔다`)
    }
    assert.equal(s.bestTime['e'], 4.2)
  })

  it('옛 세이브(v7)는 기록 없이 올라온다 — 0으로 채우지 않는다', () => {
    const old = { ...defaultSave(0), v: 7 } as Record<string, unknown>
    delete old['bestTime']
    const s = roundTrip(old)
    assert.equal(s.v, SCHEMA_VERSION)
    assert.deepEqual(s.bestTime, {}, '옛 세이브에 0초 기록이 박혔다')
  })

  it('기록은 저장을 오간다', () => {
    const d = defaultSave(0)
    d.bestTime['3-4'] = 7.77
    writeSave(d)
    assert.equal(loadSave().bestTime['3-4'], 7.77)
  })
})

describe('여정 요약', () => {
  it('새 세이브는 요약이 0이다', () => {
    const s = defaultSave(0)
    assert.equal(s.runTraining, 0)
    assert.equal(s.runStars, 0)
    assert.equal(s.runBestJung, 0)
  })

  it('옛 세이브(v8)는 요약 0으로 올라온다 — 거짓 숫자보다 0이 낫다', () => {
    const old = { ...defaultSave(0), v: 8 } as Record<string, unknown>
    delete old['runTraining']
    delete old['runStars']
    delete old['runBestJung']
    const s = roundTrip(old)
    assert.equal(s.v, SCHEMA_VERSION)
    assert.equal(s.runTraining, 0)
    assert.equal(s.runStars, 0)
    assert.equal(s.runBestJung, 0)
  })

  it('요약은 저장을 오간다', () => {
    const d = defaultSave(0)
    d.runTraining = 37
    d.runStars = 4
    d.runBestJung = 6
    writeSave(d)
    const s = loadSave()
    assert.equal(s.runTraining, 37)
    assert.equal(s.runStars, 4)
    assert.equal(s.runBestJung, 6)
  })
})

describe('칭호 장착 (2026-08-26, 형: "장착하거나 그런거 전혀없고")', () => {
  it('새 세이브는 아직 아무것도 안 골랐다', () => {
    assert.equal(defaultSave(0).equippedTitle, '')
  })

  it('옛 세이브(v9)는 빈 문자열로 올라온다 — 화면은 옛 규칙(가장 어려운 칭호)으로 채운다', () => {
    const old = { ...defaultSave(0), v: 9 } as Record<string, unknown>
    delete old['equippedTitle']
    const s = roundTrip(old)
    assert.equal(s.v, SCHEMA_VERSION)
    assert.equal(s.equippedTitle, '')
  })

  it('고른 칭호는 저장을 오간다', () => {
    const d = defaultSave(0)
    d.equippedTitle = 'title.hawk'
    writeSave(d)
    assert.equal(loadSave().equippedTitle, 'title.hawk')
  })

  it('너무 긴 값·문자열이 아닌 값은 버린다 (A4: 손상된 값으로 크래시하지 않는다)', () => {
    const s1 = roundTrip({ ...defaultSave(0), equippedTitle: 'x'.repeat(65) })
    assert.equal(s1.equippedTitle, '')
    const s2 = roundTrip({ ...defaultSave(0), equippedTitle: 42 })
    assert.equal(s2.equippedTitle, '')
  })
})

describe('몰기 설명 (2026-08-26, 형: "몰기가 뭔지도 모르겠다")', () => {
  it('새 세이브는 아직 설명을 못 봤다', () => {
    assert.equal(defaultSave(0).seenMolgi, false)
  })

  it('옛 세이브(v10)도 못 본 것으로 올라온다 — 오래 한 사람도 설명을 받은 적이 없다', () => {
    const old = { ...defaultSave(0), v: 10 } as Record<string, unknown>
    delete old['seenMolgi']
    const s = roundTrip(old)
    assert.equal(s.v, SCHEMA_VERSION)
    assert.equal(s.seenMolgi, false)
  })

  it('한 번 봤다는 기록은 저장을 오간다', () => {
    const d = defaultSave(0)
    d.seenMolgi = true
    writeSave(d)
    assert.equal(loadSave().seenMolgi, true)
  })
})
