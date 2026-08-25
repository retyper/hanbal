/**
 * 기록 전부 삭제 (A4 wipeSave) — "삭제할 때 기록이 잘 안 지워진다"(형)의 재발 방지.
 * 범인은 pagehide의 '탭 이탈 시 저장'이 방금 지운 세이브를 부활시키는 경합이었다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// localStorage 스텁 — save.ts가 import 시점에 만지지 않으므로 먼저 세운다.
const store = new Map<string, string>()
;(globalThis as Record<string, unknown>)['localStorage'] = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}

const { defaultSave, loadSave, wipeSave, writeSave } = await import('../src/game/save.ts')

describe('기록 전부 삭제', () => {
  it('hanbal.* 전 키를 지우고, 지운 뒤의 저장(부활)은 봉인된다', () => {
    const d = defaultSave(Date.now())
    d.training = 42
    d.stats.str = 7
    writeSave(d)
    store.set('hanbal.audio.v1', '{"muted":true}')
    store.set('hanbal.tune.v1', '{}')
    store.set('other.site.key', 'keep')
    assert.ok(store.has('hanbal.save.v1'), '저장이 안 됐다')

    wipeSave()
    assert.equal(store.has('hanbal.save.v1'), false, '세이브가 남았다')
    assert.equal(store.has('hanbal.audio.v1'), false, '소리 설정이 남았다')
    assert.equal(store.has('hanbal.tune.v1'), false, '튜닝 저장값이 남았다')
    assert.ok(store.has('other.site.key'), '남의 키를 지웠다')

    // ★ 부활 경합 — pagehide의 saveNow()가 이 경로다. 봉인돼야 한다.
    writeSave(d)
    assert.equal(store.has('hanbal.save.v1'), false, '지운 뒤의 저장이 세이브를 부활시켰다')

    // 새로고침 후에는 백지에서 시작한다 (훈련치·스탯 최저값).
    const fresh = loadSave()
    assert.equal(fresh.training, 0)
    assert.equal(fresh.stats.str, 0)
    assert.equal(fresh.bestRunStage, 0)
  })
})
