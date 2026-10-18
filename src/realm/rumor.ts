/**
 * 첩보 — 첩자가 그 나라에서 듣고 본 것 (형: "속셈은 아무에게나 드러내게 하지 말고 뭔가 공작을 통해 드러내게 되더라도
 * 간접정보로 전달받아야함. 첩보로 뭔가 철광이 새로 생겼다거나 그런거" — 2026-10-18)
 *
 * 속셈(stance.ts)을 그대로 보여 주지 않는다. 첩자는 **겉으로 드러난 일**을 듣는다 — 곳간이 빈다, 소금을 쌓는다, 새 마을을 일궜다,
 * 장정을 모은다, 무장을 올렸다, 목책을 짓는다, 어느 나라로 사신이 자주 간다(손잡으려 한다 · 화친을 바란다).
 * 속을 읽는 것은 플레이어의 몫이다.
 *
 * 첩자 하나가 아니라 **나라마다** 계절에 두 소식까지. 굴림은 `rumor:<viewer>:<about>:<i>` (결정론).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { goodOf, stockOf, upkeepOf, worthOf } from './economy.ts'
import { allianceWhy, truceWhy } from './stance.ts'
import type { Good, Realm, ReportLine, RumorFact } from './types.ts'

interface Fact { readonly fact: RumorFact; readonly good?: Good; readonly node?: string; readonly other?: string }

/** 이만큼 넘게 쌓으면 "쌓는다"는 소문이 돈다 — 맞바꿈 몫의 네 배 */
const hoardAt = (g: Good): number => 4 * Math.max(1, Math.round(P.realm.tradeLot / worthOf(g)))

/** `about` 나라에서 이번 계절에 들릴 만한 것 — 순서는 고정 (굴림이 고른다) */
function factsAbout(r: Realm, about: string, lines: readonly ReportLine[]): Fact[] {
  const out: Fact[] = []
  const s = stockOf(r, about)
  if (s.grain < upkeepOf(r, about, false) * 2) out.push({ fact: 'hungry' })
  const hoard = (['iron', 'salt', 'wood', 'horse'] as const).filter((g) => goodOf(s, g) >= hoardAt(g))
    .sort((a, b) => goodOf(s, b) * worthOf(b) - goodOf(s, a) * worthOf(a))[0]
  if (hoard !== undefined) out.push({ fact: 'hoard', good: hoard })
  for (const l of lines) {
    if (l.kind === 'settle' && l.faction === about) out.push({ fact: 'settled', node: l.to })
    if (l.kind === 'build' && l.faction === about && !l.done) out.push({ fact: 'building', node: l.node })
  }
  if (lines.some((l) => l.kind === 'draft' && l.faction === about)) out.push({ fact: 'drafting' })
  if (lines.some((l) => l.kind === 'arm' && l.faction === about)) out.push({ fact: 'armed' })
  for (const x of Object.keys(r.factions).sort()) {
    if (x === about || !Object.values(r.nodes).some((n) => n.owner === x)) continue
    if (truceWhy(r, about, x) !== null) out.push({ fact: 'seekTruce', other: x })
    else if (allianceWhy(r, about, x) !== null) out.push({ fact: 'seekAlly', other: x })
  }
  return out
}

/** 9 — 첩자를 심은 나라마다, 그 첩자가 있는 나라의 소식 0~2개 (보고에 `rumor`) */
export function spreadRumors(r: Realm, lines: ReportLine[]): void {
  const now = [...lines]
  for (const viewer of Object.keys(r.spies ?? {}).sort()) {
    const abouts = new Set<string>()
    for (const sp of r.spies?.[viewer] ?? []) {
      const o = r.nodes[sp.node]?.owner
      if (sp.until >= r.season && o !== null && o !== undefined && o !== viewer) abouts.add(o)
    }
    for (const about of [...abouts].sort()) {
      const left = factsAbout(r, about, now)
      for (let i = 0; i < 2 && left.length > 0; i++) {
        if (roll(r.seed, r.season, `rumor:${viewer}:${about}:${i}`) >= P.realm.rumorChance) continue
        const j = Math.floor(roll(r.seed, r.season, `rumor-pick:${viewer}:${about}:${i}`) * left.length)
        const f = left.splice(Math.min(j, left.length - 1), 1)[0]!
        lines.push({ kind: 'rumor', viewer, about, ...f })
      }
    }
  }
}

/** 이 나라가 이번 보고에서 들은 첩보 */
export function rumorsFor(lines: readonly ReportLine[], viewer: string): Array<Extract<ReportLine, { kind: 'rumor' }>> {
  return lines.filter((l): l is Extract<ReportLine, { kind: 'rumor' }> => l.kind === 'rumor' && l.viewer === viewer)
}
