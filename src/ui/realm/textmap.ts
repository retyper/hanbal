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
import { movesOf } from '../../realm/estimate.ts'
import { alertRange, visibleRange } from '../../realm/intel.ts'
import { advance, forceOf, militiaOf, neighbors, seasonOf } from '../../realm/season.ts'
import {
  BLOCKED_LINE, EDGE_NAME, NODE_KIND_NAME, OUTCOME_NAME, SEASON_NAME, TAG_LINE, UNIT_NAME, reportText, seasonLabel,
} from '../../realm/data/prose.ts'
import type { Order, Realm, Report } from '../../realm/types.ts'
import type { UnitKind } from '../../realm/battle.ts'

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
.rm select { font: inherit; background: #1c2129; color: #e2dbcd; border: 1px solid #4a5260; padding: 3px; }
@media (max-width: 600px) { .rm { padding: 16px 12px; } .rm table { font-size: 13px; } }
`

function mixLine(mix: Partial<Record<UnitKind, number>>): string {
  return (Object.entries(mix) as Array<[UnitKind, number]>)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${UNIT_NAME[k]} ${n}`)
    .join(' · ')
}

export function mountTextMap(root: HTMLElement, host: TextMapHost): { show(r: Realm, before: Realm | null, report: Report | null): void } {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  root.classList.add('rm')

  let realm: Realm
  /** 군대마다 고른 길 (없으면 머문다) · 기습 여부 */
  const pick: Record<string, { edge: string; ambush: boolean } | undefined> = {}
  let scout = ''

  function ordersNow(): Order[] {
    const out: Order[] = []
    for (const [army, p] of Object.entries(pick)) if (p !== undefined) out.push({ kind: 'march', army, edge: p.edge, ambush: p.ambush })
    if (scout !== '') out.push({ kind: 'scout', faction: ME, node: scout, hero: null })
    return out
  }

  function render(before: Realm | null, report: Report | null): void {
    const r = realm
    const season = seasonOf(r.season)
    const mine = Object.values(r.nodes).filter((n) => n.owner === ME)
    const known = r.intel[ME] ?? {}
    let h = `<h1>칠십팔국 — 시험판 <span class="sub">(글자 지도 · R1)</span></h1>`
    h += `<div class="sub">${esc(seasonLabel(r.season))} · 우리 땅 ${mine.length}곳 · 지금은 ${SEASON_NAME[season]} — `
    h += season === 'winter' ? '강이 언다. 고개는 막힌다.' : season === 'summer' ? '장마. 나루가 막히고 길이 느리다.' : season === 'autumn' ? '전쟁철.' : '파종.'
    h += `</div>`

    if (report !== null && before !== null) {
      const lines = report.lines.map((l) => reportText(before, r, l, ME)).filter((x): x is string => x !== null)
      h += `<h2>지난 계절 (${esc(seasonLabel(report.season))})</h2><div class="card rep">`
      h += lines.length === 0 ? '<p class="rumor">조용히 지나갔다.</p>' : lines.map((t) => `<p class="${t.startsWith('소문') ? 'rumor' : ''}">${esc(t)}</p>`).join('')
      h += `</div>`
    }

    // 우리 군대
    h += `<h2>우리 군대</h2>`
    const armies = Object.values(r.armies).filter((a) => a.faction === ME).sort((x, y) => (x.id < y.id ? -1 : 1))
    if (armies.length === 0) h += `<div class="card">군대가 없다.</div>`
    for (const a of armies) {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      h += `<div class="card"><b>${esc(hero?.name ?? '장수 없는 군대')}</b> · ${esc(r.nodes[a.at]?.name ?? '?')} · `
      h += `${headcount(forceOf(r, a))}명 <span class="tag">(${esc(mixLine(a.mix))})</span>`
      if (a.march !== null) {
        h += `<div>→ ${esc(r.nodes[a.march.to]?.name ?? '?')} 가는 길 — ${a.march.left}계절 남음${a.march.ambush ? ' · 기습' : ''}</div></div>`
        continue
      }
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
      h += `<td>${esc(n.owner === null ? '—' : (r.factions[n.owner]?.name ?? '?'))}</td><td>${force}</td><td>${alert}</td></tr>`
    }
    h += `</table>`

    // 포로
    const captives = Object.values(r.heroes).filter((x) => x.status === 'captive' && x.captor === ME)
    if (captives.length > 0) h += `<h2>사로잡은 장수</h2><div class="card">${captives.map((x) => esc(`${x.name} (무${x.mu} 략${x.ryak} 치${x.chi} 덕${x.deok})`)).join('<br>')}</div>`

    h += `<p style="margin-top:24px"><button id="rm-next">다음 계절 →</button> <button class="ghost" id="rm-new">새 판</button></p>`
    h += `<p class="sub">결과 칸: ${Object.values(OUTCOME_NAME).join(' · ')}. 승률은 아는 만큼 범위로 보인다 — 정찰로 좁힌다.</p>`
    root.innerHTML = h

    for (const a of armies) {
      for (const el of root.querySelectorAll<HTMLInputElement>(`input[name="mv-${a.id}"]`)) {
        el.addEventListener('change', () => {
          const amb = root.querySelector<HTMLInputElement>(`input[data-amb="${a.id}:${el.value}"]`)
          pick[a.id] = el.value === '' ? undefined : { edge: el.value, ambush: amb?.checked ?? false }
        })
      }
    }
    for (const el of root.querySelectorAll<HTMLInputElement>('input[data-amb]')) {
      el.addEventListener('change', () => {
        const [army, edge] = el.dataset['amb']!.split(':') as [string, string]
        const p = pick[army]
        if (p !== undefined && p.edge === edge) p.ambush = el.checked
      })
    }
    root.querySelector<HTMLSelectElement>('#rm-scout')!.addEventListener('change', (ev) => {
      scout = (ev.target as HTMLSelectElement).value
    })
    root.querySelector('#rm-next')!.addEventListener('click', () => {
      const mineOrders = ordersNow()
      const all = [...mineOrders, ...aiOrders(realm)]
      const prev = realm
      const { next, report: rep } = advance(prev, all)
      for (const k of Object.keys(pick)) delete pick[k]
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
