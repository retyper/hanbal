/** 다국어 틀 (docs/realm/I18N.md) — 한국어 출력이 그대로인지 · 영어 빠진 키 · 말 고르기 · 조사/복수 */
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ko } from '../src/i18n/ko.ts'
import { en, PENDING_EN } from '../src/i18n/en.ts'
import { forceLang, pickLang, t, tIn } from '../src/i18n/index.ts'
import { seasonLabel, turnsLabel, turnWord } from '../src/realm/data/prose.ts'
import type { Clocked } from '../src/realm/calendar.ts'
import { chapterTag } from '../src/realm/data/campaign.ts'
import { TUT_STEPS, tutBandHtml, tutCss } from '../src/ui/realm/tutorial.ts'
import { FIRSTS } from '../src/ui/realm/firsts.ts'
import { BOARDS, boardHtml, slotsHtml, titleHtml, type FrontKit } from '../src/ui/realm/front.ts'

const kit: FrontKit = {
  art: '/a/', esc: (s) => s, icon: () => '', emblem: () => '', face: () => '', nations: () => [],
}

afterEach(() => forceLang(null))

describe('i18n 키', () => {
  it('한국어 키는 영어에 있거나 PENDING_EN 에 적혀 있다', () => {
    const missing = (Object.keys(ko) as (keyof typeof ko)[]).filter((k) => en[k] === undefined && !PENDING_EN.includes(k))
    assert.deepEqual(missing, [])
  })
  it('영어에 한국어에 없는 키가 없다', () => {
    assert.deepEqual(Object.keys(en).filter((k) => !(k in ko)), [])
  })
  it('같은 자리표를 쓴다 (영어가 {name} 을 빠뜨리지 않는다)', () => {
    const vars = (s: string): string[] => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]!).sort()
    for (const k of Object.keys(en) as (keyof typeof ko)[]) assert.deepEqual(vars(en[k]!), vars(ko[k]), k)
  })
  it('영어 글에 긴 줄표가 없다', () => {
    for (const v of [...Object.values(en), ...Object.values(ko)]) assert.ok(!String(v).includes('\u2014'))
  })
})

describe('말 고르기', () => {
  it('주소 > 저장 > 브라우저 > 한국어', () => {
    assert.equal(pickLang('?lang=en', 'ko', 'ko-KR'), 'en')
    assert.equal(pickLang('', 'en', 'ko-KR'), 'en')
    assert.equal(pickLang('', null, 'en-US'), 'en')
    assert.equal(pickLang('', null, 'ja-JP'), 'ko')
    assert.equal(pickLang('?lang=xx', 'zz', null), 'ko')
  })
})

describe('t()', () => {
  it('조사는 한국어에서만 붙고, 영어는 하나/여럿', () => {
    assert.equal(tIn('ko', 'title.new'), '새 게임')
    assert.equal(tIn('en', 'ago.min', { n: 1 }), '1 minute ago')
    assert.equal(tIn('en', 'ago.min', { n: 5 }), '5 minutes ago')
    assert.equal(tIn('ko', 'ago.min', { n: 5 }), '5분 전')
  })
  it('빈 영어는 한국어로 나가고 자리표 규칙은 한국어 것', () => {
    const k = 'title.new' as const
    const saved = en[k]
    delete en[k]
    try { assert.equal(tIn('en', k), '새 게임') } finally { en[k] = saved! }
  })
  it('기본은 한국어 (노드 시험)', () => {
    assert.equal(t('title.learnFirst'), '처음이면, 배우는 판부터')
  })
})

describe('첫 화면 한국어 출력은 그대로', () => {
  it('처음 켠 사람의 첫 화면', () => {
    const h = titleHtml(kit, null, null, '', true, '', '')
    assert.ok(h.includes('<img class="ltitle" src="/a/logo/title.png" alt="열국군웅전">'))
    assert.ok(h.includes('<button class="btn pri big" data-act="fr-tutorial">처음이면, 배우는 판부터</button><button class="btn big" data-act="fr-new">새 게임</button></div>'))
  })
  it('불러온 판 목록', () => {
    const h = slotsHtml(kit, [{ seed: 7, nation: 'baekje', name: '백제', region: 'tutorial', season: 0, at: new Date().toISOString() }], 7)
    assert.ok(h.includes('<small class="slh">끝나지 않은 판</small>'))
    assert.ok(h.includes('aria-label="이 판 지우기">한 번 더 누르면 지운다</button>'))
    assert.ok(h.includes('· 방금</small>'))
  })
  it('판 고르기 머리', () => {
    const h = boardHtml(kit, true, new Set(BOARDS.map((b) => b.id)))
    assert.ok(h.includes('data-act="fr-back">‹ 처음으로</button><h2>어느 이야기로 시작할까</h2>'))
    assert.ok(h.includes('<p class="fine">새 게임을 시작하면 지금 판은 끝난 판으로 기록된다.</p>'))
  })
  it('영어로는 갈아입는다', () => {
    forceLang('en')
    const h = titleHtml(kit, null, null, '', true, '', '')
    assert.ok(h.includes('New Game') && h.includes('alt="First Realms"'))
    assert.ok(!/[가-힣]/.test(h))
  })
})

describe('껍데기: 날짜 · 탭 · 배우는 판 · 처음 알림', () => {
  const mo = { season: 14, clock: 'month' } as unknown as Clocked
  const old = { season: 5 } as unknown as Clocked
  it('한국어 출력은 그대로', () => {
    assert.equal(seasonLabel(old), '2년 여름')
    assert.equal(turnsLabel(mo, 3), '3달')
    assert.equal(turnsLabel(old, 3), '3계절')
    assert.equal(turnWord(old), '계절')
    assert.equal(chapterTag(2), '2장')
    assert.equal(chapterTag(0), '튜토리얼')
    assert.equal(TUT_STEPS[0]!.name, '우리 땅')
    assert.equal(TUT_STEPS[1]!.text, '갈대울의 우리 군대 말(장수 얼굴)을 누르고, 밝아진 갯골 마을을 누르세요. 그리로 갑니다.')
    assert.ok(tutBandHtml(99, (x) => x).includes('<b>다 배웠습니다</b>'))
    assert.ok(tutCss().includes("content: '먼저 소식을 읽고 「확인」을 누르세요';"))
    assert.equal(FIRSTS[0]!.title, '고을지기')
    assert.equal(tIn('ko', 'tab.locked', { name: '외교', turns: '2달' }), '외교: 2달 뒤에 열립니다')
    assert.equal(tIn('ko', 'legend.war', { name: '백제' }), '백제와 싸우는 중')
    assert.equal(tIn('ko', 'legend.war', { name: '신라' }), '신라와 싸우는 중')
  })
  it('영어로는 갈아입는다', () => {
    forceLang('en')
    assert.equal(seasonLabel(old), 'Year 2, Summer')
    assert.equal(turnsLabel(old, 1), '1 season')
    assert.equal(turnsLabel(old, 3), '3 seasons')
    assert.equal(chapterTag(2), 'Ch. 2')
    assert.equal(TUT_STEPS[0]!.name, 'Our Land')
    assert.equal(FIRSTS[0]!.title, 'Town Warden')
    assert.equal(tIn('en', 'tab.locked', { name: 'Diplomacy', turns: '2 months' }), 'Diplomacy: opens in 2 months')
    assert.equal(tIn('en', 'date.monthSeason', { y: 13, m: 3, s: 'Spring' }), 'Year 13, Month 3 · Spring')
    assert.ok(tutBandHtml(0, (x) => x).includes('1/14'))
  })
})

describe('이름표 표 (tn)', () => {
  it('영어 이름표가 한국어 표의 키를 다 덮고, 한국어는 옛 표 그대로', async () => {
    const P = await import('../src/realm/data/prose.ts')
    const { nameTable, enName } = await import('../src/i18n/names.ts')
    const B = await import('../src/ui/realm/battlefield.ts')
    const sets = [['good', P.GOOD_NAME], ['build', P.BUILD_NAME], ['unit', P.UNIT_NAME], ['ask', P.ASK_NAME], ['askKind', P.ASK_KIND_NAME], ['plot', P.PLOT_NAME], ['approach', B.APPROACH_NAME]] as const
    for (const [ns, tab] of sets) {
      const tb = tab as Record<string, string>
      for (const k of Object.keys(tb)) {
        assert.ok(enName(ns, k), `${ns}.${k}`)
        forceLang('ko'); assert.equal(nameTable(ns, tb)[k], tb[k])
        forceLang('en'); assert.equal(nameTable(ns, tb)[k], enName(ns, k))
      }
    }
  })
})
