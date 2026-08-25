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
