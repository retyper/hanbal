/** 다국어 틀 (docs/realm/I18N.md) — 한국어 출력이 그대로인지 · 영어 빠진 키 · 말 고르기 · 조사/복수 */
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ko } from '../src/i18n/ko.ts'
import { en, PENDING_EN } from '../src/i18n/en.ts'
import { forceLang, pickLang, t, tIn } from '../src/i18n/index.ts'
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
    assert.ok(h.includes('<img class="ltitle" src="/a/logo/title.png" alt="삼한열전">'))
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
    assert.ok(h.includes('New Game') && h.includes('alt="Samhan Chronicles"'))
    assert.ok(!/[가-힣]/.test(h))
  })
})
