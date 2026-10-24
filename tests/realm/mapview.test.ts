/**
 * 지도 겉모습 (형 2026-10-19: "마을이나 강조 영역이나 이런게 너무 짜침 … 기존게임들중에 이런거 잘한것들 … 갖다써" — docs/GAP.md M1~M5)
 *  - 고을 배너: 이름 · 주인 깃발 · 나라 색 띠가 한 덩어리 · 도읍은 k-cap · 우리 고을은 me · 깃대는 따로 없다
 *  - 나라 땅: 안쪽 띠(그 나라 땅으로 잘라 낸 굵은 둘레)
 *  - 군대를 고르면 갈 수 없는 고을은 흐리고(far), 갈 길은 빛난다(mvglow)
 *  - 우리 고을로 오는 적: 그 고을은 threat · 그 화살은 깜빡(thrarrow)
 *  - 길 위의 말은 가는 쪽(dir)과 병력 막대(hp)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRealm } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { nodeSpecials } from '../../src/realm/economy.ts'
import { mapHtml, routeSign, visibleNodes, type MapTarget, type MapToken } from '../../src/ui/realm/mapview.ts'

describe('지도 겉모습', () => {
  it('고을 배너 — 깃발과 나라 색이 이름과 한 덩어리 · 도읍과 우리 고을이 구별된다', () => {
    const r = startYeongnam(1, 'saro')
    const h = mapHtml(r, 'saro', '/', [], '')
    const cap = r.factions['saro']!.capital
    const lb = new RegExp(`<span class="lb([^"]*)" data-n="${cap}"[^>]*--c:[^>]*><img class="lbe"`)
    const m = lb.exec(h)
    assert.ok(m !== null, '우리 도읍 배너에 깃발')
    assert.ok(m[1]!.includes('k-cap') && m[1]!.includes(' me'))
    assert.ok(!h.includes('class="flag'), '깃대는 배너로 옮겼다')
    assert.ok(h.includes('clip-path="url(#rm-own-saro)"'), '우리 땅의 안쪽 띠')
  })

  it('군대를 고르면 갈 곳만 또렷 · 갈 길이 빛난다', () => {
    const r = startYeongnam(1, 'saro')
    const a = Object.values(r.armies).find((x) => x.faction === 'saro')!
    const ed = Object.values(r.edges).find((e) => e.a === a.at || e.b === a.at)!
    const to = ed.a === a.at ? ed.b : ed.a
    const targets: MapTarget[] = [{ node: to, edge: ed.id, chip: '', off: false, on: false }, { node: a.at, edge: '', chip: '', off: false, on: true }]
    const h = mapHtml(r, 'saro', '/', [], '', null, [], targets)
    assert.ok(h.includes('class="mvglow"'))
    const far = Object.values(r.nodes).find((n) => n.id !== to && n.id !== a.at)!
    assert.ok(new RegExp(`class="nd[^"]* far[^"]*"[^>]*data-node="${far.id}"`).test(h))
    assert.ok(!new RegExp(`class="nd[^"]* far[^"]*"[^>]*data-node="${to}"`).test(h))
  })

  it('우리 고을로 오는 적 — 고을에 붉은 고리 · 화살이 깜빡', () => {
    const r = startYeongnam(1, 'saro')
    const cap = r.factions['saro']!.capital
    const from = Object.values(r.edges).map((e) => (e.a === cap ? e.b : e.b === cap ? e.a : null)).find((x) => x !== null)!
    const h = mapHtml(r, 'saro', '/', [{ from, to: cap, left: 1, foe: true }], '')
    assert.ok(new RegExp(`class="nd[^"]* threat[^"]*"[^>]*data-node="${cap}"`).test(h))
    assert.ok(h.includes('class="thrarrow"'))
  })

  it('길 위의 말 — 가는 쪽과 병력 막대', () => {
    const r = startYeongnam(1, 'saro')
    const cap = r.factions['saro']!.capital
    const ed = Object.values(r.edges).find((e) => e.a === cap || e.b === cap)!
    const to = ed.a === cap ? ed.b : ed.a
    const toks: MapToken[] = [
      { army: 'x', node: cap, men: 100, img: '/a.png', sel: false, going: false, march: { from: cap, to, left: 1 } },
      { army: 'y', node: cap, men: 400, img: '/b.png', sel: false, going: false },
    ]
    const h = mapHtml(r, 'saro', '/', [], '', null, toks)
    assert.ok(/<i class="dir" style="--a:-?\d+deg"><\/i>/.test(h))
    assert.ok(h.includes('이동 중 · 다음 계절 도착'), '길 위의 군대에 언제 닿나 꼬리표')
    assert.ok(h.includes('class="hp" style="--p:0.25"') && h.includes('class="hp" style="--p:1.00"'))
  })

  // 형 2026-10-20: "오 이게 구현이 되어있네. 오 이게 의도한대로 진행이 되네" — 규칙이 바뀌면 그림도 바뀐다
  it('길 기호 — 겨울 고개는 눈길 · 여름 나루는 뗏목 · 소도로 드는 길은 솟대', () => {
    const r = startYeongnam(1, 'saro')
    const pass = Object.values(r.edges).find((e) => e.kind === 'pass' && !['sodo', 'fort'].some((k) => r.nodes[e.a]!.kind === k || r.nodes[e.b]!.kind === k))!
    assert.equal(routeSign(r, pass, 'spring', false), 'cairn')
    assert.equal(routeSign(r, pass, 'winter', false), 'snowpass')
    const ford = Object.values(r.edges).find((e) => e.kind === 'ford' && r.nodes[e.a]!.kind !== 'sodo' && r.nodes[e.b]!.kind !== 'sodo')!
    assert.equal(routeSign(r, ford, 'autumn', true), 'ferry')
    assert.equal(routeSign(r, ford, 'summer', true), 'raft')
    const sodo = Object.values(r.edges).find((e) => e.kind !== 'sea' && (r.nodes[e.a]!.kind === 'sodo' || r.nodes[e.b]!.kind === 'sodo'))
    if (sodo !== undefined) assert.equal(routeSign(r, sodo, 'spring', false), 'sotdae')
    r.season = 3 // 겨울 — 지도에 눈길 그림이 뜬다
    assert.ok(mapHtml(r, 'saro', '/', [], '').includes('route-snowpass.png'))
  })

  it('특산 — 고을마다 나는 것이 이름표 옆 칸에 그림으로 · 빈땅은 흐리게 (일구면 난다)', () => {
    const r = startYeongnam(1, 'saro')
    const h = mapHtml(r, 'saro', '/', [], '')
    // 영남 판은 처음엔 이웃만 보인다 — 보이는 고을 가운데서
    const vis = visibleNodes(r, 'saro')
    for (const n of Object.values(r.nodes)) if (n.kind === 'ironMine' && !vis.has(n.id)) r.known!['saro']!.push(n.owner ?? '')
    const mine = Object.values(r.nodes).find((n) => n.kind === 'ironMine' && visibleNodes(r, 'saro').has(n.id))!
    assert.ok(nodeSpecials(r, mine.id).includes('iron'))
    assert.ok(new RegExp(`data-n="${mine.id}"[^>]*>.*?<span class="lbg[^"]*"><img src="/icon/treasure-iron-ingots.png"`).test(h))
    const wild = Object.values(r.nodes).find((n) => n.kind === 'wild' && n.owner === null && nodeSpecials(r, n.id).length > 0 && visibleNodes(r, 'saro').has(n.id))
    if (wild !== undefined) assert.ok(new RegExp(`data-n="${wild.id}"[^>]*>.*?<span class="lbg idle">`).test(h))
    assert.deepEqual(nodeSpecials(r, Object.values(r.nodes).find((n) => n.kind === 'sodo')?.id ?? ''), [])
  })

  it('계절따라 걸리는 규칙 — 봄·가을 안개 고을엔 김이 서리고 · 겨울 해자엔 ❄', () => {
    const r = startRealm(1, 'our')
    const at = (season: number): string => {
      r.season = season
      return mapHtml(r, 'our', '/', [], '')
    }
    const fogNode = /data-node="our-north"[^>]*>(?:(?!<\/div>).)*class="mist"/
    assert.ok(fogNode.test(at(0)), '봄 — 안개골에 안개')
    assert.ok(!fogNode.test(at(1)), '여름 — 안개 없음')
    assert.ok(fogNode.test(at(2)), '가을 — 안개')
    const ice = /data-node="miri-cap"[^>]*>(?:(?!<\/div>).)*class="ice"/
    assert.ok(ice.test(at(3)), '겨울 — 추화 해자가 얼었다')
    assert.ok(!ice.test(at(0)))
  })

  it('출정 화살촉은 닿는 쪽을 향한다 — 끝 바로 앞 잔 점이 촉을 뒤집지 않는다 (형: "가지산소도에서 곰골로 … 화살표가 반대방향")', () => {
    const r = startYeongnam(7, 'saro')
    delete r.known
    const reversed: string[] = []
    for (const e of Object.values(r.edges)) {
      for (const [f, t] of [[e.a, e.b], [e.b, e.a]] as const) {
        const h = mapHtml(r, 'saro', '/', [{ from: f, to: t, left: null }], '')
        const d = /ly-marches[sS]*? d="([^"]+)"/.exec(h)?.[1]
        if (d === undefined) continue
        const n = (d.match(/-?d+(.d+)?/g) ?? []).map(Number)
        const pts: Array<[number, number]> = []
        for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i]!, n[i + 1]!])
        const end = pts[pts.length - 1]!
        let k = pts.length - 2
        while (k > 0 && Math.hypot(pts[k]![0] - end[0], pts[k]![1] - end[1]) < 0.05) k--
        const tan = [end[0] - pts[k]![0], end[1] - pts[k]![1]]
        const chord = [end[0] - pts[0]![0], end[1] - pts[0]![1]]
        if (tan[0]! * chord[0]! + tan[1]! * chord[1]! < 0) reversed.push(`${e.id} ${f}→${t}`)
      }
    }
    // y22 (가락 철산 → 추화 도읍) 는 길 자체가 산을 끼고 고리처럼 돌아 들어간다 — 촉이 아니라 길 모양
    assert.deepEqual(reversed.filter((x) => !x.startsWith('y22 ')), [])
  })
})
