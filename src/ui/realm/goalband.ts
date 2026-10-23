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
      // 무엇을 하라는지 또렷이 — 동맹이든 조공이든 (형 10-23: "따르게 하기는 뭐임? 조공 바치게 하란 거야 점령하란 거야")
      const names = g.factions.map((f) => r.factions[f]?.name ?? f).join(' · ')
      return g.how === 'ally' ? `${josa(names, '과', '와')} 동맹 맺기` : g.how === 'tribute' ? `${names}에게 조공 받기` : `${josa(names, '과', '와')} 동맹 맺기 또는 조공 받기`
    }
    case 'fell': return `${josa(r.heroes[g.hero]?.name ?? g.hero, '을', '를')} 쓰러뜨리기`
    case 'event': return g.id
    case 'survive': return `${g.seasons}계절 버티기`
  }
}

/**
 * 접으면 장 이름과 이룬 수(◆◆◇)만 (형 10-23: "좌상단에 목표는 너무 큰데 좀 열고 닫을 수 있게") — 머리를 누르면 열고 닫는다.
 * 접었는지는 이 기기에만 기억한다 (app.ts goal-fold)
 */
export function goalBandHtml(r: Realm, esc: (s: string) => string, folded = false): string {
  const ch = chapterOfRegion(r.region ?? 'byeonhan-mini')
  const sc = r.scenario ?? ch?.scenario // 옛 배우는 판 저장엔 장이 안 얹혀 있다
  if (ch === undefined || sc === undefined) return ''
  const done = r.outcome?.kind === 'win'
  const states = sc.win.map((g) => done || goalState({ ...r, scenario: sc }, g).done)
  const marks = states.map((ok) => (ok ? '◆' : '◇')).join('')
  let h = `<button class="gbh" data-act="goal-fold" aria-expanded="${folded ? 'false' : 'true'}"><small>${ch.n}장</small><b>${esc(ch.name)}</b><span class="gmk">${folded ? marks : ''}</span><i class="gfold">${folded ? '▸' : '▾'}</i></button>`
  if (folded) return h
  for (const g of sc.win) {
    const st = goalState({ ...r, scenario: sc }, g)
    const ok = st.done || done
    const bar = ok ? '' : `<i class="gbar"><i style="width:${Math.round((st.have / Math.max(1, st.need)) * 100)}%"></i></i>`
    const tip = g.kind === 'submit' ? ' data-tip="외교에서 사신을 보내 화친 → 동맹을 맺거나, 싸워서 이긴 뒤 조공을 요구한다 — 그 나라를 빼앗지 않아도 된다"' : ''
    h += `<div class="gbr${ok ? ' ok' : ''}"${tip}><span class="gck">${ok ? '✓' : '◇'}</span><span>${esc(goalLabel(r, g))}${bar}</span></div>`
  }
  const left = seasonsLeft({ ...r, scenario: sc })
  if (left !== null && !done) h += `<div class="gbr gleft${left <= 2 ? ' warn' : ''}"><span class="gck">⧗</span><span>${left}계절 남았다</span></div>`
  return h
}

export const GOAL_CSS = `
.ap .goalb { position: absolute; left: 12px; top: calc(var(--toph) + var(--legh) + 50px); z-index: 5; max-width: min(260px, 60vw);
  border: 10px solid transparent; border-image: url(__ART__ui/card.png?v=1) 24 fill / 10px stretch; padding: 0 4px 2px; filter: drop-shadow(0 4px 10px #000a); }
.ap .goalb:empty { display: none; }
.ap .goalb .gbh { display: flex; align-items: baseline; gap: 6px; margin: 0 0 3px; padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; width: 100%; text-align: left; }
.ap .goalb .gbh .gmk { color: #e8c070; font-size: 11px; letter-spacing: 1px; } .ap .goalb .gbh .gfold { margin-left: auto; font-style: normal; color: #c9b88e; font-size: 12px; }
.ap .goalb.folded .gbh { margin: 0; }
.ap .goalb .gbh small { font-size: 11px; color: #c9b88e; letter-spacing: .08em; } .ap .goalb .gbh b { font-family: var(--serif); font-size: 14px; color: #f3d48a; }
.ap .goalb .gbr { display: flex; gap: 6px; font-size: 12.5px; color: #e9e2d4; line-height: 1.35; margin: 2px 0; }
.ap .goalb .gbr .gck { flex: none; width: 14px; text-align: center; color: #c9a45a; }
.ap .goalb .gbr.ok { color: #b9d9a6; } .ap .goalb .gbr.ok .gck { color: #8fd07a; }
.ap .goalb .gbr.gleft { color: #c8bea8; } .ap .goalb .gbr.gleft.warn { color: #f0a080; }
.ap .goalb .gbar { display: block; height: 4px; margin-top: 3px; border-radius: 2px; background: #0007; overflow: hidden; }
.ap .goalb .gbar > i { display: block; height: 100%; background: linear-gradient(90deg, #8a6a3a, #e8c070); }
.ap.choosing .goalb { display: none; }
`
