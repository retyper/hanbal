/**
 * 나라의 글 — 이름·문장은 코드가 아니라 데이터에 둔다 (docs/realm/BUILD.md §1-6)
 * 고증 검토(lore-lens)가 코드를 안 읽고 이 파일만 본다. 숫자는 여기 없다 (P.realm).
 */
import type { Outcome, UnitKind } from '../battle.ts'
import type { EdgeKind, EnvoyAsk, NodeKind, Realm, Relation, ReportLine, SeasonOfYear, Tag } from '../types.ts'

export const SEASON_NAME: Record<SeasonOfYear, string> = {
  spring: '봄', summer: '여름', autumn: '가을', winter: '겨울',
}

export const EDGE_NAME: Record<EdgeKind, string> = {
  field: '들길', pass: '고갯길', forest: '숲길', reeds: '갈대 물가', ford: '나루', sea: '뱃길', mudflat: '갯벌',
}

export const NODE_KIND_NAME: Record<NodeKind, string> = {
  capital: '국읍', village: '읍락', sodo: '소도', port: '포구', fort: '산성', ironMine: '철산', wild: '빈땅',
}

/** 빈땅을 일군 뒤의 이름 — kind 는 그대로 'wild' 지만 사람이 살면 새 마을이다 */
export const SETTLED_NAME = '새 마을'

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
  spear: '창병', bow: '궁수', pike: '장창병', shield: '방패병', horse: '기병', crossbow: '쇠뇌병', boat: '수군',
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

/** 계절이 넘어갈 때 뜨는 한 줄 (FLOW §1) */
export const SEASON_LINE: Record<SeasonOfYear, string> = {
  spring: '봄. 씨를 뿌린다. 지금 뽑은 사람은 가을에 거두지 못한다.',
  summer: '여름. 장마가 든다. 나루가 막히고 길이 늦다.',
  autumn: '가을. 거둔다. 싸움철이다.',
  winter: '겨울. 강이 언다. 고개가 막히고 군량이 더 든다.',
}

export const ASK_NAME: Record<EnvoyAsk, string> = {
  truce: '화친', trade: '교역', tribute: '조공', alliance: '동맹',
}

export const RELATION_NAME: Record<Relation['state'], string> = {
  war: '전쟁', neutral: '중립', truce: '화친', ally: '동맹',
}

/** 이 승산보다 낮은데 이기면(또는 높은데 지면) "뜻밖" — 글의 문턱이라 여기 둔다 */
const UPSET = 0.35

/** 받침이 있으면 앞 것, 없으면 뒤 것 — 을/를 · 이/가 · 은/는 · 과/와 · 으로/로 */
export function josa(word: string, withFinal: string, without: string): string {
  const c = word.charCodeAt(word.length - 1)
  if (c < 0xac00 || c > 0xd7a3) return word + without
  const fin = (c - 0xac00) % 28
  if (withFinal === '으로' && fin === 8) return word + without // ㄹ 받침은 "로"
  return word + (fin !== 0 ? withFinal : without)
}

const OUTCOME_LINE: Record<Outcome, string> = {
  rout: '크게 이겼다', win: '이겼다', draw: '맞붙었다가 물러났다', lose: '졌다', routed: '크게 졌다',
}

function armyName(r: Realm, id: string): string {
  const a = r.armies[id]
  if (a === undefined) return '흩어진 군대'
  const h = a.hero !== null ? r.heroes[a.hero] : undefined
  const f = r.factions[a.faction]?.name ?? '?'
  if (h !== undefined) return `${f} ${h.name}의 군대`
  // 장수 없는 군대가 여럿일 수 있다 (나누기) — 사람 수로 가른다
  let n = 0
  for (const v of Object.values(a.mix)) n += v ?? 0
  return `${f}의 군대(${n}명)`
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
  const fname = (id: string): string => after.factions[id]?.name ?? '?'
  const node = (id: string): string => nodeName(after, id)
  switch (line.kind) {
    case 'scout':
      if (line.faction !== viewer) return null
      return line.detected
        ? `척후가 ${josa(node(line.node), '을', '를')} 보고 왔다. 들켰다. 그 고을이 경계를 올린다.`
        : `척후가 ${josa(node(line.node), '을', '를')} 보고 왔다.`
    case 'blocked': {
      const a = before.armies[line.army]
      if (a?.faction !== viewer) return null
      return `${BLOCKED_LINE[line.why]}. ${josa(nameArmy(line.army), '은', '는')} 떠나지 못했다.`
    }
    case 'arrive': {
      const a = after.armies[line.army] ?? before.armies[line.army]
      if (a?.faction !== viewer) return null
      return `${josa(nameArmy(line.army), '이', '가')} ${node(line.node)}에 닿았다.`
    }
    case 'split': {
      const a = before.armies[line.army]
      if (a?.faction !== viewer) return null
      return `${nameArmy(line.army)}에서 별동대를 떼어 냈다.`
    }
    case 'merge': {
      const a = before.armies[line.army]
      if (a?.faction !== viewer) return null
      return `${josa(nameArmy(line.army), '이', '가')} ${nameArmy(line.into)}에 합쳤다.`
    }
    case 'take':
      return `${josa(fname(line.faction), '이', '가')} ${josa(node(line.node), '을', '를')} 쥐었다.`
    case 'battle': {
      const atk = before.armies[line.attacker]
      const ours = atk?.faction === viewer || line.defender === viewer
      const amb = line.ambush === 'success' ? ' 기습이 먹혔다.' : line.ambush === 'caught' ? ' 기습이 들켰다.' : ''
      const side = line.allies.length === 0 ? '' : line.pincer ? ` 등 ${line.allies.length + 1}군이 두 길로` : ` 등 ${line.allies.length + 1}군이`
      const who = line.allies.length === 0 ? josa(nameArmy(line.attacker), '이', '가') : `${nameArmy(line.attacker)}${side}`
      const head = `${node(line.node)} 싸움. ${who} ${josa(fname(line.defender), '을', '를')} 쳐서 ${OUTCOME_LINE[line.outcome]}.`
      // 승산은 숫자로 안 나간다 (형: 숫자나오면 재미없다) — 판세를 뒤집었을 때만 한마디
      const atkWon = line.outcome === 'rout' || line.outcome === 'win'
      const atkLost = line.outcome === 'lose' || line.outcome === 'routed'
      const odds = (atkWon && line.p < UPSET) || (atkLost && line.p > 1 - UPSET) ? ' 뜻밖이다.' : ''
      const cap = line.captured !== null ? ` ${josa(after.heroes[line.captured]?.name ?? '?', '을', '를')} 사로잡았다.` : ''
      const dead = line.killed !== null ? ` ${josa(after.heroes[line.killed]?.name ?? '?', '이', '가')} 죽었다.` : ''
      // 싸움 소식은 퍼진다 (SYSTEMS §2-2) — 남의 싸움도 한 줄은 들린다
      return ours ? head + odds + amb + cap + dead : `소문. ${head}`
    }
    case 'harvest':
      return line.faction === viewer ? `추수. 곡식 ${line.grain}이 창고에 들었다.` : null
    case 'draft':
      return line.faction === viewer ? `${node(line.node)}에서 ${UNIT_NAME[line.unit]} ${line.n}명을 뽑았다.` : null
    case 'disband': {
      const a = before.armies[line.army]
      if (a?.faction !== viewer) return null
      return `${josa(nameArmy(line.army), '을', '를')} 집으로 돌려보냈다. ${node(line.node)}에 ${line.n}집이 돌아왔다.`
    }
    case 'settle':
      if (line.faction === viewer) return `${node(line.from)}에서 ${line.n}집이 ${josa(node(line.to), '으로', '로')} 옮겨 가 땅을 일군다.`
      return `소문. ${josa(fname(line.faction), '이', '가')} ${node(line.to)}에 사람을 보냈다.`
    case 'hunger':
      return line.faction === viewer ? '곡식이 바닥났다. 군사들이 굶는다.' : null
    case 'envoy': {
      if (line.from !== viewer && line.to !== viewer) return null
      const other = line.from === viewer ? line.to : line.from
      if (line.from === viewer) {
        return line.accepted
          ? `${josa(fname(other), '이', '가')} ${josa(ASK_NAME[line.ask], '을', '를')} 받아들였다.`
          : `${josa(fname(other), '이', '가')} ${josa(ASK_NAME[line.ask], '을', '를')} 거절했다.`
      }
      return `${fname(other)}에서 ${ASK_NAME[line.ask]} 사신이 왔다.`
    }
    case 'relation': {
      if (line.a !== viewer && line.b !== viewer) return null
      const other = fname(line.a === viewer ? line.b : line.a)
      switch (line.state) {
        case 'war': return `${josa(other, '과', '와')} 전쟁이다.`
        case 'truce': return `${josa(other, '과', '와')} 화친을 맺었다.`
        case 'ally': return `${josa(other, '과', '와')} 동맹을 맺었다.`
        case 'neutral': return `${josa(other, '과', '와')}의 화친이 끝났다.`
      }
      return null
    }
    case 'end':
      if (line.faction !== viewer) return null
      return line.outcome === 'win' ? '국읍 셋을 쥐었다. 변한의 맹주가 되었다.' : '국읍을 잃었다. 나라가 무너졌다.'
    case 'sighted': {
      if (viewer !== before.player) return null
      const a = before.armies[line.army] ?? after.armies[line.army]
      let n = 0
      if (a !== undefined) for (const v of Object.values(a.mix)) n += v ?? 0
      const size = n > 0 ? ` ${Math.max(10, Math.round(n / 10) * 10)}명 남짓.` : ''
      return `${fname(line.faction)} 군대가 ${node(line.from)}에서 ${josa(node(line.to), '으로', '로')} 가고 있다.${size}`
    }
  }
}
