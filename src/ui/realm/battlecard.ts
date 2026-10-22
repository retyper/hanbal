/**
 * 싸움 카드 — 계절 보고에서 우리가 낀 싸움을 한 판씩 차례로 풀어 보인다
 * (형: "확률에 따라 답이 정해져있긴 하지만 진행되는걸 실시간으로 되는듯 하게 묘사됐음 좋겠는데" · "적장을 한번도 본적이 없네").
 *
 * 판정은 advance 에서 이미 났다. 여기서는 그 결과를 두 장수의 얼굴 · 다가선 길 · 기습 · 맞붙음 · 사람 수 · 장수의 운명 순으로
 * 한 줄씩 띄우고, 기세 막대가 흔들리다 결과에 멈춘다. 움직임은 CSS 애니메이션의 지연뿐이다 (rAF·타이머 없음 — 절대 규칙 4).
 * 카드를 누르면 바로 끝까지 보인다.
 */
import { BATTLE_AMBUSH, BATTLE_APPROACH, BATTLE_CLASH, endStory, fieldName, josa, roundStory, storyCtx } from '../../realm/data/prose.ts'
import { bustOf } from '../../realm/data/art.ts'
import { CMD_ICON, CMD_NAME, actRows, reliefBanner, warName } from './battlefield.ts'
import type { Army, Hero, Realm, ReportLine } from '../../realm/types.ts'

type Battle = Extract<ReportLine, { kind: 'battle' }>

/** 한 줄이 뜨는 사이 (초) */
const STEP_S = 0.7
/** 결과마다 공격하는 쪽의 기세 (0~100) — 막대가 멈추는 자리 */
const FINAL = { rout: 92, win: 70, draw: 50, lose: 30, routed: 8 } as const

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const men = (a: Army | undefined): number => {
  let n = 0
  if (a !== undefined) for (const v of Object.values(a.mix)) n += v ?? 0
  return n
}

/** 문자열 하나로 정해지는 흔들림 — 같은 싸움은 늘 같게 흔들린다 */
function wobble(key: string): [number, number, number] {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  const f = (k: number): number => (((h >>> (k * 8)) & 0xff) / 255) * 2 - 1
  return [f(0), f(1), f(2)]
}

function face(h: Hero | null, art: string): string {
  const file = h !== null ? bustOf(h.id) : undefined
  return file !== undefined ? `<img class="bkf" src="${art}bust/${file}.jpg" alt="">` : `<span class="bkf noface"></span>`
}

/**
 * 전장에서 합마다 싸운 판의 요약 — 전장에서 본 그대로 (싸움 이름 · 합마다 우리 명령 × 적 명령 · 이겼나 · 무슨 일이 있었나 ·
 * 사람 수 앞뒤 · 왜 무너졌나 · 결과). 옛 한 줄 이야기(battleCard)는 합이 없던 판에서만 쓴다 — 전장과 다른 글이 나오면 헷갈린다.
 */
function battleSummary(after: Realm, l: Battle, weAtk: boolean, art: string, viewer: string, result: string, good: boolean): string {
  const st = l.start!
  const rds = l.rounds!
  const last = rds[rds.length - 1]
  const fr = [last?.na ?? 1, last?.nd ?? 1]
  const [ui, fi] = weAtk ? [0, 1] : [1, 0]
  const heroOf = (i: number): Hero | null => {
    const id = st.heroes[i] ?? null
    return id !== null ? (after.heroes[id] ?? null) : null
  }
  const name = (i: number): string => heroOf(i)?.name ?? `${after.factions[i === 0 ? (l.atkFaction ?? '') : l.defender]?.name ?? ''} 군`
  const n0 = (i: number): number => st.men[i] ?? 0
  const n1 = (i: number): number => Math.round((st.men[i] ?? 0) * (fr[i] ?? 1))
  let h = `<div class="bk sum"><div class="bkh"><span class="bkp">${esc(warName(after, l))}</span></div>`
  h += `<div class="bkv"><div class="bks">${face(heroOf(ui), art)}<b>${esc(name(ui))}</b><span>우리 ${n0(ui).toLocaleString('ko-KR')} → ${n1(ui).toLocaleString('ko-KR')}</span></div><i>VS</i>`
  h += `<div class="bks">${face(heroOf(fi), art)}<b>${esc(name(fi))}</b><span>적 ${n0(fi).toLocaleString('ko-KR')} → ${n1(fi).toLocaleString('ko-KR')}</span></div></div>`
  // 합마다 — 우리 명령 × 적 명령, 상성을 이겼나(○)·졌나(✕)
  h += `<div class="bkr3">`
  for (const rd of rds) {
    const us = weAtk ? rd.a : rd.d
    const them = weAtk ? rd.d : rd.a
    const won = rd.beat === (weAtk ? 'a' : 'd')
    const lost = rd.beat !== null && !won
    h += `<span class="bkrd${won ? ' w' : lost ? ' l' : ''}"><img src="${art}icon/${CMD_ICON[us]}.png" alt="${CMD_NAME[us]}" title="${CMD_NAME[us]}"><i>${won ? '○' : lost ? '✕' : '·'}</i><img src="${art}icon/${CMD_ICON[them]}.png" alt="${CMD_NAME[them]}" title="${CMD_NAME[them]}"></span>`
  }
  h += `</div>`
  // 합마다 무슨 일이 있었나 — 전장의 이야기 그대로 (합마다 앞 두 줄) · 끝에 왜 무너졌나
  const ctx = storyCtx(after, l, viewer)
  if (ctx !== null) {
    rds.forEach((rd, i) => {
      const rows = actRows(rd.acts, weAtk ? 'a' : 'd', art, st.mix?.[0] ?? {}, st.mix?.[1] ?? {})
      const s = roundStory(rd, rds[i - 1], ctx).slice(0, rows !== '' ? 1 : 2)
      if (rows !== '' || s.length > 0 || rd.relief !== undefined) h += `<div class="bkl now bkst"><i>${i + 1}</i><div>${reliefBanner(rd, weAtk ? 'a' : 'd', art)}${rows}${s.length > 0 ? `<p class="bksm">${esc(s.join(' '))}</p>` : ''}</div></div>`
    })
    h += `<p class="bkl now bkwhy">${esc(endStory(l, ctx))}</p>`
  }
  if (l.captured !== null) h += `<p class="bkl now">${esc(josa(after.heroes[l.captured]?.name ?? '?', '을', '를'))} 사로잡았다!</p>`
  if (l.killed !== null) h += `<p class="bkl now">${esc(josa(after.heroes[l.killed]?.name ?? '?', '이', '가'))} 쓰러졌다.</p>`
  return h + `<div class="bkr now ${good ? 'good' : l.outcome === 'draw' ? '' : 'bad'}">${esc(result)}</div></div>`
}

/** 우리가 낀 싸움 하나의 카드. 우리가 안 꼈으면 '' */
export function battleCard(before: Realm, after: Realm, l: Battle, viewer: string, art: string, idx: number): string {
  if (l.rounds !== undefined && l.rounds.length > 0 && l.start !== undefined) {
    const weA = (l.atkFaction ?? before.armies[l.attacker]?.faction) === viewer
    if (!weA && l.defender !== viewer) return ''
    const fieldB = l.field === true && l.edge !== undefined
    const placeB = fieldB ? fieldName(after, l.edge!) : (after.nodes[l.node]?.name ?? l.node)
    const atkWonB = l.outcome === 'rout' || l.outcome === 'win'
    const goodB = weA === atkWonB && l.outcome !== 'draw'
    let res: string
    if (fieldB) res = l.outcome === 'draw' ? '둘 다 물러났다' : goodB ? '적을 물리치고 길을 간다' : '밀려서 돌아왔다'
    else if (l.outcome === 'draw') res = weA ? `${placeB}에서 물러났다` : `${josa(placeB, '을', '를')} 지켜 냈다`
    else if (weA) res = atkWonB ? `${josa(placeB, '을', '를')} 차지했다` : `${placeB}에서 물러났다`
    else res = atkWonB ? `${josa(placeB, '을', '를')} 빼앗겼다` : `${josa(placeB, '을', '를')} 지켜 냈다`
    if (l.outcome === 'rout' || l.outcome === 'routed') res = `${goodB ? '대승' : '대패'} — ${res}`
    return battleSummary(after, l, weA, art, viewer, res, goodB)
  }
  const lead = before.armies[l.attacker]
  if (lead === undefined) return ''
  const weAtk = lead.faction === viewer
  if (!weAtk && l.defender !== viewer) return ''
  const node = after.nodes[l.node]
  const field = l.field === true && l.edge !== undefined
  const place = field ? fieldName(after, l.edge!) : (node?.name ?? l.node)
  const fname = (id: string): string => after.factions[id]?.name ?? '?'

  const atkIds = [l.attacker, ...l.allies]
  // 들판이면 같은 길 위를 마주 오던 군대 (이번 계절에 떠났으면 아직 그 끝 고을에 있다)
  const defArmies = Object.values(before.armies).filter((a) => a.faction === l.defender && (field
    ? a.march?.edge === l.edge || (a.march === null && a.at === l.node)
    : a.at === l.node && a.march === null))
  const heroOf = (a: Army | undefined): Hero | null => {
    const h = a?.hero !== null && a?.hero !== undefined ? before.heroes[a.hero] : undefined
    return h !== undefined && h.status === 'free' ? h : null
  }
  const atkHero = atkIds.map((id) => heroOf(before.armies[id])).find((h) => h !== null) ?? null
  const defHero = defArmies.map(heroOf).find((h) => h !== null) ?? null
  const atkBefore = atkIds.reduce((s, id) => s + men(before.armies[id]), 0)
  const atkAfter = atkIds.reduce((s, id) => s + men(after.armies[id]), 0)
  const defBefore = defArmies.reduce((s, a) => s + men(a), 0)
  const defAfter = defArmies.reduce((s, a) => s + men(after.armies[a.id]), 0)

  const side = (hero: Hero | null, f: string, n: number, extra: string): string =>
    `<div class="bks">${face(hero, art)}<b>${esc(hero?.name ?? `${fname(f)} 군`)}</b><span>${esc(fname(f))} · ${n}명${extra}</span></div>`
  const atkSide = side(atkHero, lead.faction, atkBefore, l.allies.length > 0 ? ` · ${atkIds.length}군` : '')
  const defSide = side(defHero, l.defender, defBefore, l.militia > 0 ? ` + 장정 ${l.militia}` : '')

  // 차례로 뜰 줄들
  const steps: string[] = []
  // 이번 계절에 떠난 군대는 넘기기 전 판에 행군이 없다 — 떠난 고을과 싸운 고을을 잇는 길로 찾는다
  const edge = lead.march !== null
    ? before.edges[lead.march.edge]
    : Object.values(before.edges).find((e) => (e.a === lead.at && e.b === l.node) || (e.b === lead.at && e.a === l.node))
  const who = josa(atkHero?.name ?? `${fname(lead.faction)} 군`, '이', '가')
  if (edge !== undefined) steps.push(`${who} ${BATTLE_APPROACH[edge.kind]}`)
  steps.push(field ? '길 한가운데서 두 군대가 마주쳤다. 성도 장정도 없다.' : BATTLE_AMBUSH[l.ambush])
  if (l.ambush === 'success' && before.nodes[l.node]?.owner === l.defender) steps.push('장정이 모이지 못했다.')
  else if (l.militia > 0) steps.push(`마을 장정 ${l.militia}명이 함께 막아선다.`)
  if (l.pincer) steps.push('두 길에서 한꺼번에 들이친다.')
  const [c1, c2] = BATTLE_CLASH[l.outcome]
  steps.push(c1, c2)
  const ours = weAtk ? [atkBefore, atkAfter] : [defBefore, defAfter]
  const theirs = weAtk ? [defBefore, defAfter] : [atkBefore, atkAfter]
  steps.push(`우리 ${ours[0]}명 → ${ours[1]}명 · 적 ${theirs[0]}명 → ${theirs[1]}명`)
  if (l.captured !== null) steps.push(`${josa(after.heroes[l.captured]?.name ?? '?', '을', '를')} 사로잡았다!`)
  if (l.killed !== null) steps.push(`${josa(after.heroes[l.killed]?.name ?? '?', '이', '가')} 쓰러졌다.`)

  const atkWon = l.outcome === 'rout' || l.outcome === 'win'
  const good = weAtk === atkWon && l.outcome !== 'draw'
  let result: string
  if (field) result = l.outcome === 'draw' ? '둘 다 물러났다' : good ? '적을 물리치고 길을 간다' : '밀려서 돌아왔다'
  else if (l.outcome === 'draw') result = weAtk ? `${place}에서 물러났다` : `${josa(place, '을', '를')} 지켜 냈다`
  else if (weAtk) result = atkWon ? `${josa(place, '을', '를')} 차지했다` : `${place}에서 물러났다`
  else result = atkWon ? `${josa(place, '을', '를')} 빼앗겼다` : `${josa(place, '을', '를')} 지켜 냈다`

  // 기세 막대 — 우리 쪽이 왼쪽. 흔들리다 결과에 멈춘다
  const fin = weAtk ? FINAL[l.outcome] : 100 - FINAL[l.outcome]
  const [w1, w2, w3] = wobble(`${l.node}:${l.attacker}`)
  const total = (steps.length + 1) * STEP_S
  const anim = `bk${idx}`
  const keyf = `@keyframes ${anim}{0%{width:50%}30%{width:${50 + w1 * 18}%}55%{width:${50 + w2 * 22}%}80%{width:${(fin + 50 + w3 * 15) / 2}%}100%{width:${fin}%}}`

  let h = `<div class="bk" data-act="bk-fast"><style>${keyf}</style>`
  h += `<div class="bkh"><span class="bkp">${esc(place)} 싸움</span></div>`
  h += `<div class="bkv">${weAtk ? atkSide : defSide}<i>VS</i>${weAtk ? defSide : atkSide}</div>`
  h += `<div class="bkbar"><i style="animation:${anim} ${total}s ease-in-out calc(var(--t0, 0s) + var(--t, 0s)) both"></i></div>`
  steps.forEach((s, i) => {
    h += `<p class="bkl" style="--d:${(i + 1) * STEP_S}s">${esc(s)}</p>`
  })
  h += `<div class="bkr ${good ? 'good' : l.outcome === 'draw' ? '' : 'bad'}" style="--d:${total}s">${esc(result)}</div></div>`
  return h
}

export const BATTLE_CSS = `
.ap .bk { margin: 8px 0 12px; padding: 10px; border-radius: 14px; background: #201a16; border: 1px solid #4a4030; cursor: pointer; }
.ap .bkh { text-align: center; color: var(--gold); font-weight: 700; margin-bottom: 6px; }
.ap .bkv { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.ap .bkv > i { font-style: normal; font-weight: 800; color: #c8402a; font-size: 18px; }
.ap .bks { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 0; }
.ap .bks b { font-size: 14px; margin-top: 4px; } .ap .bks span { font-size: 12px; color: var(--mute); }
.ap .bkf { width: 74px; height: 74px; border-radius: 12px; object-fit: cover; border: 2px solid #6a5a3a; display: block; background: #3a2c1e; }
.ap .bkbar { position: relative; height: 10px; margin: 10px 0 6px; border-radius: 5px; background: #8a3a2a; overflow: hidden; }
.ap .bkbar i { position: absolute; left: 0; top: 0; bottom: 0; width: 50%; background: linear-gradient(90deg, #3f8f3a, #8fd07a); }
.ap .bkl { margin: 4px 0; font-size: 14.5px; opacity: 0; animation: bkin .35s ease-out calc(var(--t0, 0s) + var(--t, 0s) + var(--d)) both; }
.ap .bkr { margin-top: 8px; text-align: center; font-size: 19px; font-weight: 800; opacity: 0; animation: bkin .4s ease-out calc(var(--t0, 0s) + var(--t, 0s) + var(--d)) both; }
.ap .bkr.good { color: #8fd07a; } .ap .bkr.bad { color: #e08a74; }
@keyframes bkin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.ap .modal.fast .bkl, .ap .modal.fast .bkr, .ap .modal.fast .bkbar i { animation-delay: 0s !important; animation-duration: .01s !important; }
@media (prefers-reduced-motion: reduce) { .ap .bkl, .ap .bkr, .ap .bkbar i { animation-duration: .01s !important; animation-delay: 0s !important; } }

.ap .bk.sum .bkr3 { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; margin: 8px 0 4px; }
.ap .bkrd { display: inline-flex; align-items: center; gap: 2px; padding: 2px 6px; border-radius: 10px; background: #ffffff0a; border: 1px solid #54412a; }
.ap .bkrd img { width: 22px; height: 22px; } .ap .bkrd i { font-style: normal; font-weight: 800; width: 14px; text-align: center; color: var(--mute); }
.ap .bkrd.w { border-color: #6a9a5a; } .ap .bkrd.w i { color: #9fd18b; } .ap .bkrd.l { border-color: #9a4a3a; } .ap .bkrd.l i { color: #ff8a70; }
.ap .bk .now { opacity: 1; animation: none; }
.ap .bk .bkst { font-size: 13.5px; line-height: 1.5; display: flex; gap: 6px; align-items: flex-start; } .ap .bk .bkst > div { flex: 1; min-width: 0; }
.ap .bk .bksm { margin: 2px 0 0; font-size: 12.5px; color: #a89c84; } .ap .bk .bkst i { font-style: normal; display: inline-block; min-width: 18px; color: var(--gold); font-weight: 700; }
.ap .bk .bkwhy { font-size: 14px; color: #e8dcc0; text-align: center; }
`
