/**
 * 이 장의 목표 띠 — 캠페인 판에서 지도 왼쪽 위에 (CAMPAIGN.md §3). 목표마다 이뤘으면 ✓, 아니면 막대 (숫자 대신 감).
 * 판을 읽기만 한다.
 */
import { chapterOfRegion } from '../../realm/data/campaign.ts'
import { josa } from '../../realm/data/prose.ts'
import { goalState, seasonsLeft } from '../../realm/scenario.ts'
import type { Goal, Realm } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'

function goalLabel(r: Realm, g: Goal): string {
  switch (g.kind) {
    case 'hold': return `${g.nodes.map((id) => r.nodes[id]?.name ?? id).join(' · ')} 쥐기`
    case 'submit': {
      // 무엇을 하라는지 또렷이 — 동맹이든 조공이든 (형 10-23: "따르게 하기는 뭐임? 조공 바치게 하란 거야 점령하란 거야")
      const names = g.factions.map((f) => r.factions[f]?.name ?? f).join(' · ')
      return g.how === 'ally' ? `${josa(names, '과', '와')} 동맹 맺기` : g.how === 'tribute' ? `${josa(names, '을', '를')} 속국 삼기` : `${josa(names, '과', '와')} 동맹 맺기 또는 속국 삼기`
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
  return h + goalRowsHtml(r, esc)
}

/** 장의 목표 줄들 — 좌상단 띠와 나라 판의 「이 장의 승리 조건」이 같이 쓴다 */
export function goalRowsHtml(r: Realm, esc: (s: string) => string): string {
  const ch = chapterOfRegion(r.region ?? 'byeonhan-mini')
  const sc = r.scenario ?? ch?.scenario
  if (sc === undefined) return ''
  const done = r.outcome?.kind === 'win'
  let h = ''
  for (const g of sc.win) {
    const st = goalState({ ...r, scenario: sc }, g)
    const ok = st.done || done
    const bar = ok ? '' : `<i class="gbar"><i style="width:${Math.round((st.have / Math.max(1, st.need)) * 100)}%"></i></i>`
    const tip = g.kind === 'submit' ? ' data-tip="외교에서 사신을 보내 화친 → 동맹을 맺거나, 싸워서 이긴 뒤 속국으로 삼는다. 그 나라를 빼앗지 않아도 된다"' : ''
    h += `<div class="gbr${ok ? ' ok' : ''}"${tip}><span class="gck">${ok ? '✓' : '◇'}</span><span>${esc(goalLabel(r, g))}${bar}</span></div>`
  }
  // 2장 동부여 추격군 — 처음 몇 계절 (ai.pursuing)
  // 3장 — 칼을 덜 뽑는 장. 규칙은 늘 보이게 (메모리: 규칙은 지도에 보이게)
  if (sc.id === 'seorabeol' && !done) h += `<div class="gbr gleft warn" data-tip="마을 하나를 칠 때마다 다른 다섯 마을이 우리를 덜 믿는다 — 사신·선물로 모으고, 왜인을 막아 주면 마음이 기운다"><span class="gck">⚔</span><span>마을을 치면 다른 마을들의 마음이 식는다</span></div>`
  if (sc.id === 'jumong' && !done && r.season < P.realm.pursuitSeasons) h += `<div class="gbr gleft warn" data-tip="대소의 추격대가 북쪽 동부여 진영에서 엄리 나루로 내려올 수 있다 — 나루를 지키거나 군대를 모아 둔다"><span class="gck">⚠</span><span>동부여 추격군 — ${P.realm.pursuitSeasons - r.season}계절 동안 쫓아온다</span></div>`
  const left = seasonsLeft({ ...r, scenario: sc })
  if (left !== null && !done) h += `<div class="gbr gleft${left <= 2 ? ' warn' : ''}"><span class="gck">⏳</span><span>${left}계절 남았다</span></div>`
  return h
}

export const GOAL_CSS = `
/* 장의 겨루기 단추 (app.contestHtml) — 목표 띠 밑 */
.ap .goalb .gcontest { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%; box-sizing: border-box; margin-top: 6px; padding: 7px 10px; border-radius: 10px; border: 1.5px solid #ffd27a; background: linear-gradient(#5a3a14, #2a1a0a); color: #ffe7b0; font: inherit; font-weight: 800; font-size: 13.5px; text-align: left; cursor: pointer; box-shadow: 0 0 12px #ffd27a66; animation: gcpulse 1.4s ease-in-out infinite alternate; }
.ap .goalb .gcontest small { font-weight: 500; font-size: 11px; color: #e8d4a8; }
.ap .goalb .gcontest.done { cursor: default; animation: none; box-shadow: none; border-color: #8a7050; background: #2a1d10; } .ap .goalb .gcontest.done.won { border-color: #9fd18b; color: #d8ffc8; }
@keyframes gcpulse { to { box-shadow: 0 0 22px #ffd27acc; } }
@media (prefers-reduced-motion: reduce) { .ap .goalb .gcontest { animation: none; } }
.ap .goalb { position: absolute; left: 12px; top: calc(var(--toph) + var(--legh) + 8px); z-index: 5; max-width: min(260px, 60vw);
  border: 10px solid transparent; border-image: url(__ART__ui/card.png?v=1) 24 fill / 10px stretch; padding: 0 4px 2px; filter: drop-shadow(0 4px 10px #000a); }
.ap .goalb:empty { display: none; }
/* 낱말 가운데서 끊지 않는다 (형 10-23: "목표 부분에 줄바꿈 제대로 안 돼서 텍스트가 이상하게 줄바꿈") */
.ap .goalb { word-break: keep-all; overflow-wrap: anywhere; }
.ap .goalb .gbh { display: flex; align-items: baseline; gap: 6px; margin: 0 0 3px; padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; width: 100%; text-align: left; }
.ap .goalb .gbh .gmk { color: #e8c070; font-size: 11px; letter-spacing: 1px; } .ap .goalb .gbh .gfold { margin-left: auto; font-style: normal; color: #c9b88e; font-size: 12px; }
.ap .goalb.folded .gbh { margin: 0; }
.ap .goalb .gbh small { font-size: 11px; color: #c9b88e; letter-spacing: .08em; } .ap .goalb .gbh b { font-family: var(--serif); font-size: 14px; color: #f3d48a; }
.ap :is(.goalb, .chapg) .gbr { display: flex; gap: 6px; font-size: 12.5px; color: #e9e2d4; line-height: 1.35; margin: 2px 0; }
.ap :is(.goalb, .chapg) .gbr .gck { flex: none; width: 14px; text-align: center; color: #c9a45a; }
.ap :is(.goalb, .chapg) .gbr.ok { color: #b9d9a6; } .ap :is(.goalb, .chapg) .gbr.ok .gck { color: #8fd07a; }
.ap :is(.goalb, .chapg) .gbr.gleft { color: #c8bea8; } .ap :is(.goalb, .chapg) .gbr.gleft.warn { color: #f0a080; }
.ap :is(.goalb, .chapg) .gbar { display: block; height: 4px; margin-top: 3px; border-radius: 2px; background: #0007; overflow: hidden; }
.ap :is(.goalb, .chapg) .gbar > i { display: block; height: 100%; background: linear-gradient(90deg, #8a6a3a, #e8c070); }
.ap.choosing .goalb { display: none; }
`
