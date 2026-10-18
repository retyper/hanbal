/**
 * 글자 지도 — R1 종이 시험의 화면 (docs/realm/BUILD.md §5 · §6)
 *
 * 일부러 **그림이 없다.** "결정이 재미없으면 그림이 구해 주지 않는다." 형이 이 화면으로 10계절을 해 보고
 * 결정이 재미있는지 말하는 것이 R1 의 완료 기준이다.
 *
 * 화면은 상태를 읽기만 하고, 바꾸는 것은 명령을 모아 advance 에 넘기는 일 하나다.
 * 계산은 realm/estimate.ts (AI 와 같은 셈) · 글은 realm/data/prose.ts.
 * 루프·타이머가 없다 — 버튼을 눌러야 판이 움직인다 (절대 규칙 4).
 */
import { aiOrders } from '../../realm/ai.ts'
import { headcount } from '../../realm/battle.ts'
import { jointWin, movesOf, type Move } from '../../realm/estimate.ts'
import { alertRange, visibleRange } from '../../realm/intel.ts'
import { advance, forceOf, militiaOf, neighbors, newArmyId, planned, seasonOf } from '../../realm/season.ts'
import { P } from '../../tune/params.ts'
import {
  BLOCKED_LINE, EDGE_NAME, NODE_KIND_NAME, OUTCOME_NAME, SEASON_NAME, TAG_LINE, UNIT_NAME, reportText, seasonLabel,
} from '../../realm/data/prose.ts'
import { FACTION_ART, HERO_BUST, SEASON_ICON, UNIT_ICON } from '../../realm/data/art.ts'
import type { Army, Hero, Order, Realm, Report } from '../../realm/types.ts'
import type { UnitKind } from '../../realm/battle.ts'
import { MAP_CSS, mapHtml, type MapMarch } from './mapview.ts'

/** public/realm/ — 그림은 tools/realm-plate.ps1 이 굽는다. 빌드가 주입하는 BASE_URL 만이 진실이다 */
const ART: string = (import.meta.env?.BASE_URL ?? '/') + 'realm/'
const icon = (name: string, cls = 'ic'): string => `<img class="${cls}" src="${ART}icon/${name}.png" alt="">`
const bust = (h: Hero, cls = 'face'): string =>
  HERO_BUST[h.id] !== undefined ? `<img class="${cls}" src="${ART}bust/${HERO_BUST[h.id]}.jpg" alt="${h.name}">` : ''
const emblem = (faction: string | null): string =>
  faction !== null && FACTION_ART[faction] !== undefined ? icon(FACTION_ART[faction].emblem, 'em') : ''

export interface TextMapHost {
  /** 계절을 넘긴 뒤 — 저장은 바깥이 한다 */
  onAdvance(next: Realm, report: Report, orders: readonly Order[]): void
  onNewGame(): void
}

const ME = 'us'

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const pct = (x: number): string => `${Math.round(x * 100)}%`
const range = (lo: number, hi: number, f: (x: number) => string): string => (f(lo) === f(hi) ? f(lo) : `${f(lo)}~${f(hi)}`)

const CSS = `
.rm { max-width: 860px; margin: 0 auto; padding: 16px; font: 15px/1.6 system-ui, 'Noto Sans KR', sans-serif; color: #e2dbcd; }
.rm h1 { font-size: 20px; margin: 0 0 4px; } .rm h2 { font-size: 16px; margin: 20px 0 6px; color: #d9b36a; }
.rm .sub { color: #9a9284; font-size: 13px; }
.rm .card { background: #252b35; border: 1px solid #343c49; border-radius: 6px; padding: 10px 12px; margin: 8px 0; }
.rm label.mv { display: block; padding: 3px 0; cursor: pointer; } .rm label.mv.off { color: #6d675d; cursor: default; }
.rm .amb { margin-left: 22px; font-size: 13px; color: #b9b0a0; }
.rm table { border-collapse: collapse; width: 100%; font-size: 14px; } .rm td, .rm th { padding: 4px 6px; border-bottom: 1px solid #343c49; text-align: left; vertical-align: top; }
.rm .ours { color: #9fd18b; } .rm .tag { color: #9a9284; font-size: 13px; }
.rm button { font: inherit; padding: 8px 18px; border-radius: 6px; border: 1px solid #d9b36a; background: #3a3122; color: #f3e3bd; cursor: pointer; }
.rm button.ghost { border-color: #4a5260; background: transparent; color: #9a9284; padding: 4px 10px; font-size: 13px; }
.rm .rep p { margin: 2px 0; } .rm .rep .rumor { color: #8d8678; font-size: 13px; }
.rm .split { margin: 4px 0 6px; font-size: 13px; color: #b9b0a0; } .rm .split input[type=number] { width: 4em; font: inherit; background: #1c2129; color: #e2dbcd; border: 1px solid #4a5260; padding: 1px 3px; }
.rm .note { border-color: #8a5a3a; color: #e8c3a0; }
.rm select { font: inherit; background: #1c2129; color: #e2dbcd; border: 1px solid #4a5260; padding: 3px; }
.rm img.ic { width: 22px; height: 22px; vertical-align: -6px; margin-right: 2px; }
.rm img.em { width: 20px; height: 20px; vertical-align: -5px; margin-right: 3px; }
.rm img.season { width: 34px; height: 34px; vertical-align: -10px; margin-right: 4px; }
.rm .card.army { display: flow-root; }
.rm img.face { float: left; width: 72px; height: 72px; border-radius: 6px; border: 1px solid #4a5260; margin: 0 10px 4px 0; object-fit: cover; }
.rm .scene { display: flex; gap: 12px; align-items: flex-end; margin: 8px 0; }
.rm .scene img.ev { width: min(100%, 420px); border-radius: 6px; border: 1px solid #4a5260; }
.rm .scene img.who { width: 120px; height: 120px; border-radius: 6px; border: 2px solid #d9b36a; object-fit: cover; }
.rm .brag { font-size: 18px; font-weight: 700; color: #f3d38a; margin: 2px 0 8px; }
.rm .captive { display: inline-block; text-align: center; margin: 4px 10px 4px 0; font-size: 13px; }
.rm .captive img { display: block; width: 96px; height: 96px; border-radius: 6px; border: 1px solid #8a5a3a; object-fit: cover; margin-bottom: 2px; }
@media (max-width: 600px) { .rm { padding: 16px 12px; } .rm table { font-size: 13px; } }
`

function mixLine(mix: Partial<Record<UnitKind, number>>): string {
  return (Object.entries(mix) as Array<[UnitKind, number]>)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${icon(UNIT_ICON[k])}${UNIT_NAME[k]} ${n}`)
    .join(' · ')
}

/**
 * 지난 계절의 한 장면 — 우리에게 가장 큰 일 하나를 그림으로 (SYSTEMS §13 "자랑할 순간은 보고 맨 위에 크게").
 * 사로잡음 > 적장 사살 > 기습 성공 > 우리 장수를 잃음. 없으면 그림 없이 줄만.
 */
function sceneOf(before: Realm, after: Realm, report: Report): string {
  type Pick = { ev: string; hero: Hero | null; line: string }
  let best: Pick | null = null
  let rank = 0
  for (const l of report.lines) {
    if (l.kind !== 'battle') continue
    const weAtk = before.armies[l.attacker]?.faction === ME
    const weDef = l.defender === ME
    if (!weAtk && !weDef) continue
    const cap = l.captured !== null ? after.heroes[l.captured] : undefined
    const dead = l.killed !== null ? after.heroes[l.killed] : undefined
    const node = after.nodes[l.node]?.name ?? '?'
    const cands: Array<[number, Pick]> = []
    if (cap !== undefined && cap.captor === ME) cands.push([4, { ev: 'event-capture', hero: cap, line: `${cap.name}을(를) 사로잡았다 — ${node}` }])
    if (dead !== undefined && dead.faction !== ME) cands.push([3, { ev: 'event-sniped-commander', hero: dead, line: `${dead.name}이(가) 쓰러졌다 — ${node}` }])
    if (weAtk && l.ambush === 'success') cands.push([2, { ev: 'event-night-raid', hero: null, line: `기습이 먹혔다 — ${node}` }])
    if ((cap !== undefined && cap.faction === ME) || (dead !== undefined && dead.faction === ME)) {
      const h = (cap ?? dead)!
      cands.push([1, { ev: 'event-sniped-commander', hero: h, line: `${h.name}을(를) 잃었다 — ${node}` }])
    }
    for (const [k, p] of cands) if (k > rank) { rank = k; best = p }
  }
  if (best === null) return ''
  return `<div class="scene"><img class="ev" src="${ART}event/${best.ev}.jpg" alt="">`
    + `${best.hero !== null ? bust(best.hero, 'who') : ''}</div><div class="brag">${esc(best.line)}</div>`
}

export function mountTextMap(root: HTMLElement, host: TextMapHost): { show(r: Realm, before: Realm | null, report: Report | null): void } {
  const style = document.createElement('style')
  style.textContent = CSS + MAP_CSS
  document.head.appendChild(style)
  root.classList.add('rm')

  let realm: Realm
  let shownBefore: Realm | null = null
  let shownReport: Report | null = null
  /** 이번 계절의 나누기·모으기 (SYSTEMS §4-5) — 화면은 이것을 먼저 해 본 판(planned)을 보여 준다 */
  let armyOrders: Order[] = []
  /** 군대마다 고른 길 (없으면 머문다) · 기습 여부 */
  const pick: Record<string, { edge: string; ambush: boolean } | undefined> = {}
  let scout = ''
  /** 안 된 나누기·모으기의 까닭 — 한 번 보이고 사라진다 */
  let note = ''

  const plan = (): Realm => planned(realm, armyOrders)

  /** 판에 넘길 명령 — 나누기·모으기가 먼저, 그다음 출정, 정찰 */
  function ordersNow(): Order[] {
    const p = plan()
    const out: Order[] = [...armyOrders]
    for (const [army, c] of Object.entries(pick)) {
      const a = p.armies[army]
      if (c !== undefined && a !== undefined && a.march === null) out.push({ kind: 'march', army, edge: c.edge, ambush: c.ambush })
    }
    if (scout !== '') out.push({ kind: 'scout', faction: ME, node: scout, hero: null })
    return out
  }

  function armyLabel(r: Realm, a: Army): string {
    const hero = a.hero !== null ? r.heroes[a.hero] : undefined
    return hero?.name ?? `장수 없는 군대(${headcount(forceOf(r, a))}명)`
  }

  /** 이번 계절 출정 — 고른 길을 고을마다 묶고, 같은 계절에 닿는 둘 이상이면 협공의 합친 승률 */
  function sortieSummary(r: Realm): string {
    const byTo = new Map<string, Array<{ army: Army; move: Move }>>()
    for (const [army, c] of Object.entries(pick)) {
      const a = r.armies[army]
      if (c === undefined || a === undefined || a.march !== null) continue
      const m = movesOf(r, ME, a).find((x) => x.edge.id === c.edge)
      if (m === undefined || m.blocked !== null) continue
      const list = byTo.get(m.to) ?? []
      list.push({ army: a, move: m })
      byTo.set(m.to, list)
    }
    if (byTo.size === 0) return ''
    let h = `<h2>이번 계절 출정</h2><div class="card">`
    for (const [to, legs] of [...byTo].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
      h += `<div>→ <b>${esc(r.nodes[to]!.name)}</b>: ${legs.map((x) => esc(`${armyLabel(r, x.army)} (${EDGE_NAME[x.move.edge.kind]})`)).join(' · ')}`
      if (legs.length >= 2 && legs[0]!.move.hostile) {
        if (new Set(legs.map((x) => x.move.seasons)).size > 1) {
          h += ` <span class="tag">— 닿는 계절이 달라 따로따로 싸운다</span>`
        } else {
          const w = jointWin(r, ME, legs.map((x) => ({ army: x.army, edge: x.move.edge })), to)
          const roads = new Set(legs.map((x) => x.move.edge.id)).size >= 2 ? ` · 두 길 ×${P.realm.pincer}` : ''
          h += ` — 협공: 합친 승률 <b>${w === null ? '모름' : range(w[0], w[1], pct)}</b><span class="tag">${roads}</span>`
        }
      }
      h += `</div>`
    }
    return h + `</div>`
  }

  function rerender(): void {
    render(shownBefore, shownReport)
  }

  function render(before: Realm | null, report: Report | null): void {
    shownBefore = before
    shownReport = report
    const r = plan()
    const season = seasonOf(r.season)
    const mine = Object.values(r.nodes).filter((n) => n.owner === ME)
    const known = r.intel[ME] ?? {}
    let h = `<h1>칠십팔국 — 시험판 <span class="sub">(R1)</span></h1>`
    h += `<div class="sub">${icon(SEASON_ICON[season], 'season')}${esc(seasonLabel(r.season))} · 우리 땅 ${mine.length}곳 · 지금은 ${SEASON_NAME[season]} — `
    h += season === 'winter' ? '강이 언다. 고개는 막힌다.' : season === 'summer' ? '장마. 나루가 막히고 길이 느리다.' : season === 'autumn' ? '전쟁철.' : '파종.'
    h += `</div>`

    // 그린 지도 — 길 위의 우리 군대와 이번 계절 고른 출정
    const marches: MapMarch[] = []
    for (const a of Object.values(r.armies)) {
      if (a.faction !== ME) continue
      if (a.march !== null) marches.push({ from: a.march.from, to: a.march.to, left: a.march.left })
      const c = pick[a.id]
      const ed = c !== undefined && a.march === null ? r.edges[c.edge] : undefined
      if (ed !== undefined) marches.push({ from: a.at, to: ed.a === a.at ? ed.b : ed.a, left: null })
    }
    h += mapHtml(r, ME, ART, marches, scout)

    if (report !== null && before !== null) {
      const lines = report.lines.map((l) => reportText(before, r, l, ME)).filter((x): x is string => x !== null)
      h += `<h2>지난 계절 (${esc(seasonLabel(report.season))})</h2>${sceneOf(before, r, report)}<div class="card rep">`
      h += lines.length === 0 ? '<p class="rumor">조용히 지나갔다.</p>' : lines.map((t) => `<p class="${t.startsWith('소문') ? 'rumor' : ''}">${esc(t)}</p>`).join('')
      h += `</div>`
    }

    // 우리 군대
    h += `<h2>우리 군대</h2>`
    const armies = Object.values(r.armies).filter((a) => a.faction === ME).sort((x, y) => (x.id < y.id ? -1 : 1))
    if (armies.length === 0) h += `<div class="card">군대가 없다.</div>`
    if (note !== '') h += `<div class="card note">${esc(note)}</div>`
    note = ''
    for (const a of armies) {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      h += `<div class="card army">${hero !== undefined ? bust(hero) : ''}<b>${esc(armyLabel(r, a))}</b> · ${esc(r.nodes[a.at]?.name ?? '?')} · `
      h += `${headcount(forceOf(r, a))}명 <span class="tag">(${mixLine(a.mix)})</span>`
      if (realm.armies[a.id] === undefined) h += ` <span class="tag">— 이번 계절에 떼어 냄</span>`
      if (a.march !== null) {
        h += `<div>→ ${esc(r.nodes[a.march.to]?.name ?? '?')} 가는 길 — ${a.march.left}계절 남음${a.march.ambush ? ' · 기습' : ''}</div></div>`
        continue
      }
      // 나누기 · 모으기 (SYSTEMS §4-5)
      h += `<div class="split"><span class="tag">나누기:</span> `
      for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) {
        if (n <= 0) continue
        h += `<label>${UNIT_NAME[k]} <input type="number" min="0" max="${n}" value="0" data-split="${a.id}" data-kind="${k}"></label> `
      }
      if (a.hero !== null) h += `<label><input type="checkbox" data-split-hero="${a.id}"> 장수가 별동대를 이끈다</label> `
      h += `<button class="ghost" data-split-go="${a.id}">떼어 낸다</button>`
      for (const b of armies) {
        if (b.id === a.id || b.at !== a.at || b.march !== null) continue
        h += ` <button class="ghost" data-merge="${a.id}" data-into="${b.id}">${esc(armyLabel(r, b))}에 합친다</button>`
      }
      h += `</div>`
      const chosen = pick[a.id]
      h += `<label class="mv"><input type="radio" name="mv-${a.id}" value="" ${chosen === undefined ? 'checked' : ''}> 머문다</label>`
      for (const m of movesOf(r, ME, a)) {
        const node = r.nodes[m.to]!
        const owner = node.owner === null ? '주인 없음' : node.owner === ME ? '우리 땅' : (r.factions[node.owner]?.name ?? '?')
        let txt = `→ ${node.name} <span class="tag">[${NODE_KIND_NAME[node.kind]} · ${owner}]</span> · ${EDGE_NAME[m.edge.kind]} ${m.seasons}계절`
        if (m.blocked !== null) txt += ` — ${BLOCKED_LINE[m.blocked]}`
        else if (m.hostile) txt += m.win !== null ? ` · 승률 <b>${range(m.win[0], m.win[1], pct)}</b>` : ' · 승률 모름 (못 봤다)'
        const off = m.blocked !== null
        const on = chosen?.edge === m.edge.id
        h += `<label class="mv${off ? ' off' : ''}"><input type="radio" name="mv-${a.id}" value="${m.edge.id}" ${on ? 'checked' : ''} ${off ? 'disabled' : ''}> ${txt}</label>`
        if (m.hostile && !off) {
          h += `<div class="amb"><label><input type="checkbox" data-amb="${a.id}:${m.edge.id}" ${on && chosen?.ambush ? 'checked' : ''}> 기습으로 (성공 ${pct(m.ambushP)} 안팎 — 성공 ×1.5 · 들키면 ×0.85)</label></div>`
        }
      }
      h += `</div>`
    }

    if (armyOrders.length > 0) h += `<p><button class="ghost" id="rm-undo">나누기·합치기 되돌리기</button></p>`
    h += sortieSummary(r)

    // 정찰
    const scoutable = [...new Set(mine.flatMap((n) => neighbors(r, n.id)))].filter((id) => r.nodes[id]?.owner !== ME).sort()
    h += `<h2>정찰 <span class="sub">(한 계절에 척후 하나 — 그 고을의 땅과 군세를 이번 계절 것으로)</span></h2><div class="card">`
    h += `<select id="rm-scout"><option value="">보내지 않는다</option>`
    for (const id of scoutable) h += `<option value="${id}" ${scout === id ? 'selected' : ''}>${esc(r.nodes[id]!.name)}</option>`
    h += `</select></div>`

    // 아는 땅
    h += `<h2>아는 땅</h2><table><tr><th>고을</th><th>주인</th><th>군세</th><th>경계</th></tr>`
    for (const n of Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))) {
      const k = known[n.id]
      if (k === undefined && n.owner !== ME) continue
      const ours = n.owner === ME
      let force = '—'
      let alert = '—'
      if (ours) {
        const men = Object.values(r.armies).filter((a) => a.at === n.id && a.faction === ME && a.march === null).reduce((s, a) => s + headcount(forceOf(r, a)), 0)
        const mil = militiaOf(r, n.id)
        force = `${men}명${mil !== null ? ` <span class="tag">+ 장정 ${headcount(forceOf(r, mil))}</span>` : ''}`
      } else if (k?.force) {
        const age = r.season - k.force.season
        const v = visibleRange({ f0: k.force.f0, src: k.force.src, u: k.force.u }, age)
        force = v === null ? '모름 (너무 낡았다)' : `${range(v[0], v[1], (x) => String(Math.round(x)))} <span class="tag">(${age === 0 ? '이번 계절' : `${age}계절 전`})</span>`
      } else force = '모름'
      if (!ours && k?.alert) {
        const v = alertRange(k.alert.v, r.season - k.alert.season)
        alert = v === null ? '모름' : range(v[0], v[1], pct)
      }
      const roads = neighbors(r, n.id).map((id) => {
        const ed = Object.values(r.edges).find((e) => (e.a === n.id && e.b === id) || (e.b === n.id && e.a === id))!
        return `${EDGE_NAME[ed.kind]}→${r.nodes[id]!.name}`
      }).join(', ')
      const tags = k?.land || ours ? n.tags.map((t) => TAG_LINE[t]).join(' ') : ''
      h += `<tr><td class="${ours ? 'ours' : ''}">${esc(n.name)} <span class="tag">${NODE_KIND_NAME[n.kind]}</span>`
      h += `${tags !== '' ? `<div class="tag">${esc(tags)}</div>` : ''}<div class="tag">길: ${esc(roads)}</div></td>`
      h += `<td>${emblem(n.owner)}${esc(n.owner === null ? '—' : (r.factions[n.owner]?.name ?? '?'))}</td><td>${force}</td><td>${alert}</td></tr>`
    }
    h += `</table>`

    // 포로
    const captives = Object.values(r.heroes).filter((x) => x.status === 'captive' && x.captor === ME)
    if (captives.length > 0) {
      h += `<h2>사로잡은 장수</h2><div class="card">`
      h += captives.map((x) => `<span class="captive">${bust(x, '')}${esc(x.name)}<br><span class="tag">무${x.mu} 략${x.ryak} 치${x.chi} 덕${x.deok}</span></span>`).join('')
      h += `</div>`
    }

    h += `<p style="margin-top:24px"><button id="rm-next">다음 계절 →</button> <button class="ghost" id="rm-new">새 판</button></p>`
    h += `<p class="sub">결과 칸: ${Object.values(OUTCOME_NAME).join(' · ')}. 승률은 아는 만큼 범위로 보인다 — 정찰로 좁힌다.</p>`
    root.innerHTML = h

    for (const a of armies) {
      for (const el of root.querySelectorAll<HTMLInputElement>(`input[name="mv-${a.id}"]`)) {
        el.addEventListener('change', () => {
          const amb = root.querySelector<HTMLInputElement>(`input[data-amb="${a.id}:${el.value}"]`)
          pick[a.id] = el.value === '' ? undefined : { edge: el.value, ambush: amb?.checked ?? false }
          rerender() // 출정 묶음(협공)이 바뀐다
        })
      }
    }
    for (const el of root.querySelectorAll<HTMLButtonElement>('button[data-split-go]')) {
      el.addEventListener('click', () => {
        const army = el.dataset['splitGo']!
        const take: Partial<Record<UnitKind, number>> = {}
        for (const inp of root.querySelectorAll<HTMLInputElement>(`input[data-split="${army}"]`)) {
          const n = Math.floor(Number(inp.value))
          if (n > 0) take[inp.dataset['kind'] as UnitKind] = n
        }
        const hero = root.querySelector<HTMLInputElement>(`input[data-split-hero="${army}"]`)?.checked ?? false
        const id = newArmyId(r, ME)
        const o: Order = { kind: 'split', army, id, take, hero }
        // 규칙의 판정은 판이 한다 — 해 보고 안 되면 되돌린다
        if (planned(r, [o]).armies[id] === undefined) {
          note = `나눌 수 없다 — 양쪽 다 ${P.realm.splitMin}명 이상이어야 하고, 군대는 ${P.realm.armyMax}개까지다.`
        } else armyOrders = [...armyOrders, o]
        rerender()
      })
    }
    for (const el of root.querySelectorAll<HTMLButtonElement>('button[data-merge]')) {
      el.addEventListener('click', () => {
        const army = el.dataset['merge']!
        const o: Order = { kind: 'merge', army, into: el.dataset['into']! }
        if (planned(r, [o]).armies[army] !== undefined) {
          note = '합칠 수 없다 — 장수 둘이 한 군대를 함께 이끌지는 못한다.'
        } else {
          armyOrders = [...armyOrders, o]
          delete pick[army]
        }
        rerender()
      })
    }
    root.querySelector('#rm-undo')?.addEventListener('click', () => {
      armyOrders = []
      for (const k of Object.keys(pick)) if (realm.armies[k] === undefined) delete pick[k]
      rerender()
    })
    for (const el of root.querySelectorAll<HTMLInputElement>('input[data-amb]')) {
      el.addEventListener('change', () => {
        const [army, edge] = el.dataset['amb']!.split(':') as [string, string]
        const p = pick[army]
        if (p !== undefined && p.edge === edge) p.ambush = el.checked
      })
    }
    root.querySelector<HTMLSelectElement>('#rm-scout')!.addEventListener('change', (ev) => {
      scout = (ev.target as HTMLSelectElement).value
      rerender()
    })
    // 지도의 고을을 누르면 정찰할 곳으로 — 정찰할 수 있는 곳일 때만 (다시 누르면 거둔다)
    for (const el of root.querySelectorAll<HTMLElement>('.map .nd')) {
      el.addEventListener('click', () => {
        const id = el.dataset['node']!
        if (!scoutable.includes(id)) return
        scout = scout === id ? '' : id
        rerender()
      })
    }
    root.querySelector('#rm-next')!.addEventListener('click', () => {
      const mineOrders = ordersNow()
      const all = [...mineOrders, ...aiOrders(realm)]
      const prev = realm
      const { next, report: rep } = advance(prev, all)
      for (const k of Object.keys(pick)) delete pick[k]
      armyOrders = []
      scout = ''
      host.onAdvance(next, rep, all)
      realm = next
      render(prev, rep)
      window.scrollTo(0, 0)
    })
    root.querySelector('#rm-new')!.addEventListener('click', () => host.onNewGame())
  }

  return {
    show(r, before, report) {
      realm = r
      render(before, report)
    },
  }
}
