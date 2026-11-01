/**
 * 장수 기술 장면 (src/ui/realm/skillfx.ts · docs/realm/SKILL-FX.md · 형 11-01)
 * 기술마다 장면이 있고 · 걷히기 전에 끝나고 · 안 구운 그림은 빠지고 · 문서의 그림 목록과 코드가 맞는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { SKILL_SEQ, markSkillReady, skillAssets, skillCues, skillCutHtml, type SkillId } from '../../src/ui/realm/skillfx.ts'
import { P } from '../../src/tune/params.ts'

const ARTS = ['snipe', 'rite', 'sway', 'stand', 'ambush', 'vanguard', 'feint', 'order', 'shout'] as const

describe('장수 기술 장면', () => {
  it('비기 아홉과 겨루기·사로잡기·물러나기에 저마다 장면 · 걷히기 전에 끝난다', () => {
    for (const id of [...ARTS, 'duel', 'capture', 'retreat'] as SkillId[]) {
      const q = SKILL_SEQ[id]
      assert.ok(q.sprites.length > 0, id)
      for (const s of q.sprites) assert.ok(s.t + (s.dt ?? 0) * ((s.n ?? 1) - 1) + s.d <= P.realm.warSkEndMs, `${id} ${s.src}`)
      for (const [t] of skillCues(id)) assert.ok(t * 1000 <= P.realm.warSkEndMs, id)
    }
    // 첫 깃발 연출 전에 걷힌다
    assert.ok(P.realm.warSkEndMs * P.realm.warSkSpeed <= P.realm.warBeatCut * 1000)
  })
  it('기술마다 제 그림이 하나는 있다 (같은 장면을 돌려 쓰지 않는다)', () => {
    for (const id of [...ARTS, 'duel', 'capture', 'retreat'] as SkillId[]) {
      const own = SKILL_SEQ[id].sprites.filter((s) => s.src.startsWith(`skill/${id}/`))
      if (id !== 'shout') assert.ok(own.length > 0, id)
    }
  })
  it('안 구운 그림은 빠진다 · 구운 그림만 얹는다 · 초상과 이름은 늘', () => {
    const h0 = skillCutHtml('/', 'snipe', 'g-01', '을음', '명궁의 한 발')
    assert.ok(!h0.includes('skill/snipe/bow-draw.png'))
    assert.ok(h0.includes('bust/g-01.jpg') && h0.includes('명궁의 한 발') && h0.includes('을음'))
    markSkillReady(['skill/snipe/bow-draw.png'])
    const h1 = skillCutHtml('/', 'snipe', 'g-01', '을음', '명궁의 한 발')
    assert.ok(h1.includes('/fx/skill/snipe/bow-draw.png'))
    assert.ok(!h1.includes('arrow-streak'))
  })
  it('문서(SKILL-FX.md)에 그림마다 구울 말이 있다', () => {
    const doc = readFileSync(new URL('../../docs/realm/SKILL-FX.md', import.meta.url), 'utf8')
    for (const src of skillAssets()) {
      if (!src.startsWith('skill/')) assert.ok(doc.includes(`fx/${src}`), src)
      else assert.ok(doc.includes(src), src)
    }
  })
})
