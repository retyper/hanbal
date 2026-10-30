/**
 * 장수 그림 (src/realm/data/art.ts generalSprite · docs/realm/GENERAL-SPRITES.md · 형 10-30: "전투할 때 장수 유닛도 추가해 줘")
 *
 *  - 명궁이면 활 · 여인은 창 · 통솔이 가장 높고 7 이상인 남자는 말 · 무예가 가장 높으면 언월도 · 그 밖은 환두대도 · 장수가 없으면 환두대도
 *  - 제 그림(GEN_OWN)이 있으면 그것이 먼저
 *  - GEN_ANIM 의 결마다 띠 그림이 있고 · 고른 결은 언제나 그릴 수 있는 결로 돌아온다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { GEN_ANIM, GEN_OWN, genArtOf, generalSprite } from '../../src/realm/data/art.ts'

const h = (o: Partial<{ id: string; look: 'g' | 'w'; traits: string[]; mu: number; tong: number; ryak: number; chi: number; deok: number }>) =>
  ({ look: 'g' as const, traits: [] as string[], mu: 5, tong: 5, ryak: 5, chi: 5, deok: 5, ...o })

describe('장수 그림 고르기', () => {
  it('특성·능력치로 결이 정해진다', () => {
    assert.equal(generalSprite(null), 'g-sword')
    assert.equal(generalSprite(h({ traits: ['archer'] })), 'g-bow')
    assert.equal(generalSprite(h({ look: 'w', traits: ['archer'] })), 'w-bow')
    assert.equal(generalSprite(h({ look: 'w', tong: 9 })), 'w-spear')
    assert.equal(generalSprite(h({ tong: 8, mu: 6 })), 'mount')
    assert.equal(generalSprite(h({ tong: 6, mu: 5 })), 'g-sword') // 통솔이 가장 높아도 7 밑이면 말이 아니다
    assert.equal(generalSprite(h({ mu: 8 })), 'g-spear')
    assert.equal(generalSprite(h({ ryak: 8 })), 'g-sword')
  })
  it('제 그림이 있으면 그것', () => {
    for (const [id, k] of Object.entries(GEN_OWN)) assert.equal(generalSprite(h({ id, traits: ['archer'] })), k)
  })
  it('결마다 띠 그림이 있고 고른 결은 그릴 수 있다', () => {
    for (const k of Object.keys(GEN_ANIM)) assert.ok(existsSync(`public/realm/anim2/gen-${k}.png`), k)
    for (const k of ['g-sword', 'g-bow', 'g-spear', 'w-spear', 'w-bow', 'mount', 'nope', ...Object.values(GEN_OWN)]) assert.ok(GEN_ANIM[genArtOf(k).kind] !== undefined, k)
  })
})
