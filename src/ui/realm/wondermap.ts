/**
 * 지도 위 큰 공사 (wonders.ts · 위원회 11-08 ⑦ · loop L2 「비계가 단마다 올라간다」) —
 *  - 다 선 공사: 그 고을 곁에 공사 그림 (우리 땅이면 금빛 테)
 *  - 짓는 중: 그 공사의 반쯤 지은 그림(비계·사다리) · 쌓은 단만큼 커진다 (우리 것 · 우리가 아는 나라의 것)
 * 판을 읽기만 한다 (절대 규칙 2) · 글 없이 그림으로 (메모리 show-not-read).
 */
import { P } from '../../tune/params.ts'
import { knows } from '../../realm/discovery.ts'
import { WONDERS } from '../../realm/wonders.ts'
import type { Realm, RNode } from '../../realm/types.ts'

/** 그 고을의 큰 공사 표 — 없으면 '' */
export function wonderMark(r: Realm, me: string, n: RNode, art: string): string {
  if (n.wonder !== undefined) return `<i class="wondm${n.owner === me ? ' ours' : ''}"><img src="${art}icon/${WONDERS[n.wonder].icon}.png" alt=""></i>`
  const w = (r.wonderWorks ?? []).find((x) => x.node === n.id && (x.faction === me || knows(r, me, x.faction)))
  if (w === undefined) return ''
  const k = Math.min(1, (w.stage + 1) / Math.max(1, Math.round(P.realm.wonderStages)))
  // 그 공사의 「짓는 중」 그림 (icon/<공사>-build.png · 형 11-08 제미나이) · 쌓은 단만큼 커진다
  return `<i class="wscafm" style="--k:${k.toFixed(2)}"><img src="${art}icon/${WONDERS[w.what].icon}-build.png" alt=""></i>`
}

export const WONDER_CSS = `
.ap .nd .wondm, .ap .nd .wscafm { position: absolute; left: -22px; bottom: -4px; pointer-events: none; z-index: 2; }
.ap .nd .wondm { width: 28px; height: 28px; border-radius: 50%; background: #1a120acc; border: 1px solid #c9a45a88; display: flex; align-items: center; justify-content: center; }
.ap .nd .wondm.ours { border-color: #e8c15a; box-shadow: 0 0 8px #e8c15a99; }
.ap .nd .wondm img { width: 24px; height: 24px; object-fit: contain; }
.ap .nd .wscafm { width: 30px; height: 30px; transform-origin: 50% 100%; transform: scale(calc(.55 + .45 * var(--k))); }
.ap .nd .wscafm img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 3px #000a); }
`
