/**
 * 이 장의 목표 띠 — 캠페인 판에서 지도 왼쪽 위에 (CAMPAIGN.md §3). 목표마다 이뤘으면 ✓, 아니면 막대 (숫자 대신 감).
 * 판을 읽기만 한다.
 */
import { chapterOfRegion } from '../../realm/data/campaign.ts'
import { josa } from '../../realm/data/prose.ts'
import { goalState, seasonsLeft } from '../../realm/scenario.ts'
import type { Goal, Realm } from '../../realm/types.ts'

function goalLabel(r: Realm, g: Goal): string {
  switch (g.kind) {
    case 'hold': return `${g.nodes.map((id) => r.nodes[id]?.name ?? id).join(' · ')} 쥐기`
    case 'submit': {
      const names = g.factions.map((f) => r.factions[f]?.name ?? f).join(' · ')
      return `${josa(names, '이', '가')} 따르게 하기`
    }
    case 'fell': return `${josa(r.heroes[g.hero]?.name ?? g.hero, '을', '를')} 쓰러뜨리기`
    case 'event': return g.id
    case 'survive': return `${g.seasons}계절 버티기`
  }
}

export function goalBandHtml(r: Realm, esc: (s: string) => string): string {
  const ch = chapterOfRegion(r.region ?? 'byeonhan-mini')
  const sc = r.scenario ?? ch?.scenario // 옛 배우는 판 저장엔 장이 안 얹혀 있다
  if (ch === undefined || sc === undefined) return ''
  const done = r.outcome?.kind === 'win'
  let h = `<div class="gbh"><small>${ch.n}장</small><b>${esc(ch.name)}</b></div>`
  for (const g of sc.win) {
    const st = goalState({ ...r, scenario: sc }, g)
    const ok = st.done || done
    const bar = ok ? '' : `<i class="gbar"><i style="width:${Math.round((st.have / Math.max(1, st.need)) * 100)}%"></i></i>`
    h += `<div class="gbr${ok ? ' ok' : ''}"><span class="gck">${ok ? '✓' : '◇'}</span><span>${esc(goalLabel(r, g))}${bar}</span></div>`
  }
  const left = seasonsLeft({ ...r, scenario: sc })
  if (left !== null && !done) h += `<div class="gbr gleft${left <= 2 ? ' warn' : ''}"><span class="gck">⧗</span><span>${left}계절 남았다</span></div>`
  return h
}

export const GOAL_CSS = `
.ap .goalb { position: absolute; left: 12px; top: calc(var(--toph) + var(--legh) + 50px); z-index: 5; max-width: min(260px, 60vw); pointer-events: none;
  border: 10px solid transparent; border-image: url(__ART__ui/card.png?v=1) 24 fill / 10px stretch; padding: 0 4px 2px; filter: drop-shadow(0 4px 10px #000a); }
.ap .goalb:empty { display: none; }
.ap .goalb .gbh { display: flex; align-items: baseline; gap: 6px; margin-bottom: 3px; }
.ap .goalb .gbh small { font-size: 11px; color: #c9b88e; letter-spacing: .08em; } .ap .goalb .gbh b { font-family: var(--serif); font-size: 14px; color: #f3d48a; }
.ap .goalb .gbr { display: flex; gap: 6px; font-size: 12.5px; color: #e9e2d4; line-height: 1.35; margin: 2px 0; }
.ap .goalb .gbr .gck { flex: none; width: 14px; text-align: center; color: #c9a45a; }
.ap .goalb .gbr.ok { color: #b9d9a6; } .ap .goalb .gbr.ok .gck { color: #8fd07a; }
.ap .goalb .gbr.gleft { color: #c8bea8; } .ap .goalb .gbr.gleft.warn { color: #f0a080; }
.ap .goalb .gbar { display: block; height: 4px; margin-top: 3px; border-radius: 2px; background: #0007; overflow: hidden; }
.ap .goalb .gbar > i { display: block; height: 100%; background: linear-gradient(90deg, #8a6a3a, #e8c070); }
.ap.choosing .goalb { display: none; }
`
