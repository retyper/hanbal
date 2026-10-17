/**
 * 나라의 글 — 이름·문장은 코드가 아니라 데이터에 둔다 (docs/realm/BUILD.md §1-6)
 * 고증 검토(lore-lens)가 코드를 안 읽고 이 파일만 본다. 숫자는 여기 없다 (P.realm).
 */
import type { Outcome, UnitKind } from '../battle.ts'
import type { EdgeKind, NodeKind, Realm, ReportLine, SeasonOfYear, Tag } from '../types.ts'

export const SEASON_NAME: Record<SeasonOfYear, string> = {
  spring: '봄', summer: '여름', autumn: '가을', winter: '겨울',
}

export const EDGE_NAME: Record<EdgeKind, string> = {
  field: '들길', pass: '고갯길', forest: '숲길', reeds: '갈대 물가', ford: '나루', sea: '뱃길', mudflat: '갯벌',
}

export const NODE_KIND_NAME: Record<NodeKind, string> = {
  capital: '국읍', village: '읍락', sodo: '소도', port: '포구', fort: '산성', ironMine: '철산',
}

/** 지형 꼬리표의 문장 (SYSTEMS §1-2) — 화면에는 숫자가 아니라 이 문장이 나간다 */
export const TAG_LINE: Record<Tag, string> = {
  reeds: '갈대가 사람 키를 넘는다.',
  shallows: '물이 얕아 여울목이 보인다.',
  pines: '솔숲이 길을 덮었다. 말이 지나기 어렵다.',
  high: '언덕 위에 있다. 오르는 길이 하나다.',
  palisade: '통나무 울타리를 둘렀다.',
  moat: '울타리 앞에 물을 끌어 두었다.',
  fog: '새벽마다 골짜기에 안개가 찬다.',
  iron: '붉은 흙이 드러난 산이다.',
  sodo: '큰 나무에 방울과 북을 달았다. 칼을 들고 들어가지 않는다.',
}

export const UNIT_NAME: Record<UnitKind, string> = {
  spear: '창수', bow: '궁수', pike: '긴창수', shield: '방패수', horse: '기병', crossbow: '쇠뇌수', boat: '배꾼',
}

export const OUTCOME_NAME: Record<Outcome, string> = {
  rout: '대승', win: '승', draw: '교착', lose: '패', routed: '대패',
}

export const BLOCKED_LINE = {
  winterPass: '눈이 고개를 막았다',
  summerFord: '장마로 나루를 건널 수 없다',
} as const

/** 0 = 첫해 봄 → "1년 봄" */
export function seasonLabel(n: number): string {
  const s: SeasonOfYear[] = ['spring', 'summer', 'autumn', 'winter']
  return `${Math.floor(n / 4) + 1}년 ${SEASON_NAME[s[((n % 4) + 4) % 4]!]}`
}

const pct = (x: number): string => `${Math.round(x * 100)}%`

function armyName(r: Realm, id: string): string {
  const a = r.armies[id]
  if (a === undefined) return '흩어진 군대'
  const h = a.hero !== null ? r.heroes[a.hero] : undefined
  const f = r.factions[a.faction]?.name ?? '?'
  return h !== undefined ? `${f} ${h.name}의 군대` : `${f}의 군대`
}

function nodeName(r: Realm, id: string): string {
  return r.nodes[id]?.name ?? id
}

/**
 * 보고의 한 줄을 글로 — 보는 나라(viewer)의 눈으로. 남의 나라끼리의 일은 소문처럼 짧게.
 * `before` 는 넘기기 전 판 (사라진 군대의 이름을 찾으려고).
 */
export function reportText(before: Realm, after: Realm, line: ReportLine, viewer: string): string | null {
  const nameArmy = (id: string): string => (before.armies[id] !== undefined ? armyName(before, id) : armyName(after, id))
  switch (line.kind) {
    case 'scout':
      if (line.faction !== viewer) return null
      return `척후가 ${nodeName(after, line.node)}을(를) 보고 왔다${line.detected ? ' — 들켰다. 그 고을이 경계를 올린다.' : '.'}`
    case 'blocked': {
      const a = before.armies[line.army]
      if (a?.faction !== viewer) return null
      return `${nameArmy(line.army)}: ${BLOCKED_LINE[line.why]}.`
    }
    case 'arrive': {
      const a = after.armies[line.army] ?? before.armies[line.army]
      if (a?.faction !== viewer) return null
      return `${nameArmy(line.army)}이(가) ${nodeName(after, line.node)}에 닿았다.`
    }
    case 'take':
      return `${after.factions[line.faction]?.name ?? '?'}이(가) ${nodeName(after, line.node)}을(를) 쥐었다.`
    case 'battle': {
      const atk = before.armies[line.attacker]
      const ours = atk?.faction === viewer || line.defender === viewer
      const amb = line.ambush === 'success' ? ' 기습이 먹혔다.' : line.ambush === 'caught' ? ' 기습이 들켰다.' : ''
      const head = `${nodeName(after, line.node)}의 싸움 — ${nameArmy(line.attacker)} 대 ${after.factions[line.defender]?.name ?? '?'}: `
        + `공격측 ${OUTCOME_NAME[line.outcome]} (승률 ${pct(line.p)}).${amb}`
      const cap = line.captured !== null ? ` ${after.heroes[line.captured]?.name ?? '?'}을(를) 사로잡았다.` : ''
      const dead = line.killed !== null ? ` ${after.heroes[line.killed]?.name ?? '?'}이(가) 죽었다.` : ''
      // 싸움 소식은 퍼진다 (SYSTEMS §2-2) — 남의 싸움도 한 줄은 들린다
      return ours ? head + cap + dead : `소문: ${head}`
    }
  }
}
