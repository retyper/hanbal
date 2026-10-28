/**
 * 판의 앞과 끝 (front.ts — 형 2026-10-19: "게임 시작과 자동저장과 종료도 시스테믹하게")
 *
 *  - 첫 화면: 판이 있으면 "이어 하기"(나라 · 계절 · 도읍) · 끝난 판이면 이어 하기가 없다
 *  - 판 고르기: 넷 · 이기는 도음 수가 checkOutcome 과 같다
 *  - 서막 세 장 · 끝 화면의 연대기는 우리 일만 (남의 도읍 빼앗기는 안 적는다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { NATIONS } from '../../src/realm/data/nations.ts'
import { YEONGNAM_NATIONS } from '../../src/realm/data/nations-yeongnam.ts'
import { SOUTH_NATIONS } from '../../src/realm/data/nations-south.ts'
import { WORLD_NATIONS } from '../../src/realm/data/nations-world.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { josa } from '../../src/realm/data/prose.ts'
import { checkOutcome } from '../../src/realm/season.ts'
import type { RegionId } from '../../src/realm/types.ts'
import { BOARDS, PROLOGUE_STEPS, boardHtml, endingHtml, prologueHtml, titleHtml, winNeed, type FrontKit } from '../../src/ui/realm/front.ts'

const KIT: FrontKit = {
  art: '/', esc: (s) => s, icon: (n) => `[${n}]`, emblem: (f) => `{${f}}`, face: (f) => `(${f})`,
  nations: (r: RegionId) => (r === 'yeongnam' ? YEONGNAM_NATIONS : r === 'south' ? SOUTH_NATIONS : r === 'world' ? WORLD_NATIONS : NATIONS),
}

describe('판의 앞과 끝', () => {
  it('첫 화면 — 판이 있으면 이어 하기, 끝난 판이면 새 판만', () => {
    const r = startYeongnam(1, 'saro')
    const h = titleHtml(KIT, r, new Date().toISOString())
    assert.ok(h.includes('data-act="continue"') && h.includes('사로국') && h.includes('1년 봄') && h.includes(`도읍 1/${winNeed('yeongnam')}`))
    assert.ok(h.includes('최근 저장 · 방금'))
    assert.ok(!titleHtml(KIT, null, null).includes('continue'))
    r.outcome = { kind: 'lose', season: 3 }
    assert.ok(!titleHtml(KIT, r, null).includes('continue'))
  })

  it('판 고르기 다섯(배우는 판이 맨 위) · 이기는 도읍 수는 판정과 같은 값', () => {
    assert.equal(BOARDS.length, 5)
    assert.equal(BOARDS[0]!.id, 'tutorial')
    const h = boardHtml(KIT, false)
    for (const b of BOARDS) assert.ok(h.includes(`data-v="${b.id}"`) && (b.id === 'tutorial' || h.includes(`도읍 ${winNeed(b.id)}곳`)))
    // 도읍을 winNeed 만큼 쥐면 checkOutcome 이 이김
    const r = startYeongnam(2, 'saro')
    const caps = Object.values(r.factions).map((f) => f.capital).filter((c) => c !== r.factions['saro']!.capital)
    for (const c of caps.slice(0, winNeed('yeongnam') - 1)) r.nodes[c]!.owner = 'saro'
    assert.equal(checkOutcome(r), 'win')
  })

  it('서막 세 장 — 시대 · 우리 나라(군장) · 할 일', () => {
    const r = startYeongnam(1, 'saro')
    assert.equal(PROLOGUE_STEPS, 3)
    assert.ok(prologueHtml(KIT, r, 0).includes('기원 2세기'))
    const you = prologueHtml(KIT, r, 1)
    assert.ok(you.includes('사로국') && you.includes(r.heroes[r.factions['saro']!.ruler!]!.name))
    const goal = prologueHtml(KIT, r, 2)
    assert.ok(goal.includes(`<b>${winNeed('yeongnam')}</b>곳`) && goal.includes('첫 봄을 연다'))
  })

  it('끝 화면 — 연대기는 우리 일만 · 이긴 싸움을 센다', () => {
    const r = startYeongnam(1, 'saro')
    const cap = r.factions['guya']!.capital
    r.outcome = { kind: 'win', season: 9 }
    const h = endingHtml(KIT, r, [
      { s: 2, lines: [{ kind: 'take', faction: 'saro', node: cap }, { kind: 'take', faction: 'guya', node: 'x' }] },
      { s: 4, lines: [{ kind: 'relation', a: 'saro', b: 'dabeol', state: 'ally' }] },
    ])
    assert.ok(h.includes(`${josa(r.nodes[cap]!.name, '을', '를')} 쥐었다`), '조사는 받침 따라 — 「을(를)」 둘 다 적기 없이')
    assert.ok(!h.includes('을(를)'))
    assert.ok(h.includes('동맹을 맺었다'))
    assert.ok(h.includes('data-act="fr-again"') && h.includes('data-act="fr-look"'))
    // 새 게임이 맨 앞 · 무한 모드는 곁길 (형 10-24)
    const btns = h.slice(h.indexOf('class="btns'))
    assert.ok(btns.indexOf('data-act="fr-new"') < btns.indexOf('data-act="fr-endless"'), '새 게임이 무한 모드보다 앞')
    assert.ok(/class="btn pri" data-act="fr-new"/.test(btns) && !/class="btn pri" data-act="fr-endless"/.test(btns), '눈에 띄는 단추는 새 게임')
    assert.ok(!h.includes('x를 쥐었다'), '남이 쥔 것은 우리 연대기에 없다')
    assert.ok(h.includes('으로 다시') && !/국로 다시/.test(h), '「○○국으로 다시」 — 「골포국로」가 아니다')
  })
})
