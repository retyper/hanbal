/**
 * 적이 온다 예고 (FIRST-HOUR-20261122 TOP 1) — 이번 달 끝에 우리 고을을 칠 적 하나를 지도 위에 크게.
 * 누가 · 몇 명쯤(범위) · 어디를 · 지킬 가망(범위 %) · 누르면 바로 하는 답 하나(이번 달 안에 닿는 우리 군대를 보낸다 · 없으면 그 고을 보기).
 * 저절로 걷히고(threatWarnMs + 글 길이) 카드를 누르면 걷힌다 (메모리: 알림은 반드시 걷힌다). 판의 셈은 realm/warn.ts — 여기는 그리기만.
 */
import type { Threat } from '../../realm/warn.ts'
import { t as tr } from '../../i18n/index.ts'
import { holdFeel } from './feel.ts'
import { outMen } from './lookword.ts'

export interface WarnKit {
  readonly esc: (s: string) => string
  /** 나라 깃발 그림 */
  readonly emblem: (f: string) => string
  /** 그 군대를 이끄는 장수의 얼굴 (없으면 '') */
  readonly face: (army: string) => string
  readonly nodeName: (id: string) => string
  readonly foeName: (f: string) => string
  readonly armyName: (army: string) => string
}

/** 저들의 군사 — 바깥으로 둥글린 범위 (`430~530`) · 한 값이면 그 값 */
function menText(x: readonly [number, number]): string {
  const [lo, hi] = outMen(x)
  return lo === hi ? `${lo}` : `${lo}~${hi}`
}

/** 예고 카드 — 머리(⚔ 깃발 · 누가 어디를) · 지킬 가망 · 답 단추 하나 */
export function threatHtml(th: Threat, k: WarnKit): string {
  const head = tr('thw.head', { foe: k.foeName(th.foe), men: menText(th.men), to: k.nodeName(th.to) })
  const hold = `<div class="thwr"><span class="thwk">${tr('thw.hold')}</span>${holdFeel(th.hold[0], th.hold[1])}</div>`
  const btn = th.send !== null
    ? `<button class="btn pri thwgo" data-act="thw-send" data-army="${k.esc(th.send.army)}" data-edge="${k.esc(th.send.edge)}" data-node="${k.esc(th.to)}">${k.face(th.send.army)}<b>${k.esc(tr('thw.send', { name: k.armyName(th.send.army) }))}</b>${holdFeel(th.send.hold[0], th.send.hold[1])}</button>`
    : `<button class="btn thwgo" data-act="thw-look" data-node="${k.esc(th.to)}"><b>${k.esc(tr('thw.look', { to: k.nodeName(th.to) }))}</b></button>`
  return `<div class="thwh"><i class="thwx" aria-hidden="true">⚔</i>${k.emblem(th.foe)}<b>${k.esc(head)}</b><small>${tr('thw.when')}</small></div>${hold}${btn}`
}

export const THREAT_CSS = `
.ap .thw { position: absolute; left: 50%; top: calc(var(--toph) + var(--legh) + 10px); z-index: 82; transform: translateX(-50%); box-sizing: border-box; width: min(calc(100vw - 16px), 380px);
  padding: 9px 12px 11px; border-radius: 14px; background: #2a110cf5; border: 2px solid #e0604a; box-shadow: 0 8px 22px #000c, 0 0 18px #d0301c66; color: #f3e6c8; cursor: pointer;
  display: flex; flex-direction: column; gap: 7px; animation: thwin .32s cubic-bezier(.2, 1.4, .4, 1) both; }
.ap .thw.out { opacity: 0; transition: opacity .3s ease; pointer-events: none; }
.ap .thw .thwh { display: flex; align-items: center; gap: 7px; min-width: 0; line-height: 1.3; }
.ap .thw .thwh b { flex: 1 1 auto; min-width: 0; font-size: 15px; color: #fff2dc; word-break: keep-all; overflow-wrap: anywhere; }
.ap .thw .thwh small { flex: none; padding: 1px 8px; border-radius: 999px; background: #7a1a10; border: 1px solid #e0604a; color: #fff; font-size: 12px; font-weight: 700; }
.ap .thw .thwh img { width: 26px; height: 26px; flex: none; }
.ap .thw .thwx { flex: none; font-style: normal; font-size: 20px; line-height: 1; animation: strk .8s ease-in-out infinite alternate; }
.ap .thw .thwr { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.ap .thw .thwk { color: #e8cfa8; }
.ap .thw .thwgo { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 44px; padding: 6px 10px; font-size: 14px; }
.ap .thw .thwgo b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap .thw .thwgo .face { width: 30px; height: 30px; flex: none; border-radius: 50%; }
@keyframes thwin { from { opacity: 0; transform: translate(-50%, -14px) scale(.92); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
/* 낮은 가로 화면(폰 눕힘) — 위아래로 쌓으면 카드가 지도 가운데(노리는 우리 고을)를 덮었다 · 넓고 낮게: 머리 한 줄 · 가망과 단추는 한 줄에 (가로 화면 점검 11-22) */
@media (orientation: landscape) and (max-height: 520px) {
  .ap .thw { left: calc(50% - var(--rail, 0px) / 2); width: min(calc(100vw - var(--rail, 0px) - 24px), 600px); display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 6px 12px; padding: 7px 12px 9px; }
  .ap .thw .thwh { grid-column: 1 / -1; }
  .ap .thw .thwgo { min-height: 40px; }
}
@media (prefers-reduced-motion: reduce) { .ap .thw, .ap .thw .thwx { animation: none; } }
`
