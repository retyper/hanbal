/**
 * 긴 말 읽기 쉽게 (형 11-03: "전략회의 같은 긴 대사는 중요 단어에 볼드 · 결론에 볼드 · 적국 이름은 붉게") —
 * 글을 받아 HTML 로 돌려준다(이스케이프 포함). 판에는 손대지 않는다.
 *   남의 나라 이름·그 나라 고을 → 붉게 · 우리 나라·우리 고을 → 우리 땅 파랑 · 길(대로·밤길…)과 꾀 → 금빛 굵게 · 숫자 → 굵게
 *   두 문장 이상이면 마지막 문장(결론)을 굵게
 */
import type { Realm } from '../../realm/types.ts'

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** 회의에서 고르는 길과 꾀 — 결정이 걸린 낱말 */
const KEYS = ['대로', '밤길', '여울', '산기슭', '절벽', '협공', '두 갈래', '기습', '매복', '곳간']

interface Kit { readonly re: RegExp; readonly side: ReadonlyMap<string, 'foe' | 'me' | 'place'> }
const kits = new WeakMap<Realm, Map<string, Kit>>()

function kitOf(r: Realm, me: string): Kit {
  let byMe = kits.get(r)
  if (byMe === undefined) kits.set(r, (byMe = new Map()))
  const hit = byMe.get(me)
  if (hit !== undefined) return hit
  const side = new Map<string, 'foe' | 'me' | 'place'>()
  for (const [id, f] of Object.entries(r.factions)) if (f.name.length >= 2) side.set(f.name, id === me ? 'me' : 'foe')
  for (const n of Object.values(r.nodes)) {
    if (n.name.length < 2 || side.has(n.name)) continue
    side.set(n.name, n.owner === me ? 'me' : n.owner !== null ? 'foe' : 'place')
  }
  // 긴 이름부터 — 「거칠산국」이 「거칠산」보다 먼저 잡히게
  const words = [...side.keys(), ...KEYS].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const kit: Kit = { re: new RegExp(`(${words.join('|')})|(\\d[\\d,]*)`, 'g'), side }
  byMe.set(me, kit)
  return kit
}

function marks(r: Realm, me: string, text: string): string {
  const { re, side } = kitOf(r, me)
  return esc(text).replace(re, (all: string, word: string | undefined) => {
    if (word === undefined) return `<b class="hnum">${all}</b>`
    const s = side.get(word)
    return s === undefined ? `<b class="hkey">${all}</b>` : `<b class="h${s}">${all}</b>`
  })
}

/** 한 줄 → 꾸민 HTML. 마지막 문장이 결론 */
export function hilite(r: Realm, me: string, text: string): string {
  const m = /^(.*[.!?:])\s+([^.!?:]+[.!?]?)\s*$/s.exec(text)
  if (m === null) return marks(r, me, text)
  return `${marks(r, me, m[1]!)} <strong class="hend">${marks(r, me, m[2]!)}</strong>`
}

export const HILITE_CSS = `
.ap .hfoe { color: #ff7a66; font-weight: 700; }
.ap .hme { color: #6fb6ff; font-weight: 700; }
.ap .hplace, .ap .hnum { color: #fff; font-weight: 700; }
.ap .hkey { color: #ffd27a; font-weight: 700; }
.ap .hend { font-weight: 700; color: #fff; }
`
