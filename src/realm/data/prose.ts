/**
 * 나라의 글 — 이름·문장은 코드가 아니라 데이터에 둔다 (docs/realm/BUILD.md §1-6)
 * 고증 검토(lore-lens)가 코드를 안 읽고 이 파일만 본다. 숫자는 여기 없다 (P.realm).
 */
import type { Outcome, UnitKind } from '../battle.ts'
import type { Ask, EdgeKind, EnvoyAsk, NodeKind, Realm, Relation, ReportLine, SeasonOfYear, Tag } from '../types.ts'

export const SEASON_NAME: Record<SeasonOfYear, string> = {
  spring: '봄', summer: '여름', autumn: '가을', winter: '겨울',
}

export const EDGE_NAME: Record<EdgeKind, string> = {
  field: '들길', pass: '고갯길', forest: '숲길', reeds: '갈대 물가', ford: '나루', sea: '뱃길', mudflat: '갯벌',
}

export const NODE_KIND_NAME: Record<NodeKind, string> = {
  capital: '도읍', village: '마을', sodo: '소도', port: '항구', fort: '산성', ironMine: '철광', wild: '빈땅',
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

/** 들판의 이름 — 길 양 끝 고을 사이 ("안개골 마을과 여울목 마을 사이 나루") */
export function fieldName(r: Realm, edge: string): string {
  const e = r.edges[edge]
  if (e === undefined) return '들판'
  return `${josa(nodeName(r, e.a), '과', '와')} ${nodeName(r, e.b)} 사이 ${EDGE_NAME[e.kind]}`
}

/** 남의 나라가 걸어온 청 한 줄 — 무엇을 주고 무엇을 바라나 */
export function askLine(a: Ask, from: string): string {
  const goods = (g: { grain: number; iron: number }): string =>
    [g.grain > 0 ? `곡식 ${g.grain}` : '', g.iron > 0 ? `철 ${g.iron}` : ''].filter((x) => x !== '').join(' · ')
  switch (a.kind) {
    case 'truce': return `${josa(from, '이', '가')} 화친하자고 한다. 서로 치지 않고 장터를 연다.`
    case 'alliance': return `${josa(from, '이', '가')} 동맹을 맺자고 한다. 같은 적을 함께 치자고 한다.`
    case 'trade': return `${josa(from, '이', '가')} ${goods(a.give)}을 줄 테니 ${goods(a.take)}을 달라고 한다.`
    case 'tribute': return `${josa(from, '이', '가')} 고개를 숙이고 ${goods(a.give)}을 바치겠다고 한다.`
    case 'demand': return `${josa(from, '이', '가')} ${goods(a.take)}을 바치라고 한다. 거절하면 전쟁이다.`
  }
}

export const ASK_KIND_NAME: Record<Ask['kind'], string> = {
  truce: '화친', alliance: '동맹', trade: '교역', tribute: '조공 바침', demand: '조공 요구',
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
      return `${josa(fname(line.faction), '이', '가')} ${josa(node(line.node), '을', '를')} 차지했다.`
    case 'battle': {
      const atk = before.armies[line.attacker]
      const ours = atk?.faction === viewer || line.defender === viewer
      // 기습은 정면과 다르게 들려야 한다 (형: "느껴지는게 없음") — 무엇을 건너뛰었는지, 무엇에 맞았는지
      const nd = after.nodes[line.node]
      const walled = nd !== undefined && (nd.kind === 'fort' || nd.tags.includes('palisade') || nd.tags.includes('high'))
      const weAtk = atk?.faction === viewer
      let amb = ''
      if (line.ambush === 'success') {
        amb = weAtk
          ? ` 숨어 들어가 기습이 먹혔다.${walled ? ' 성문이 닫히기 전에 들이쳤다.' : ''} 장정이 모이지 못했다.`
          : ` 기습을 당했다.${walled ? ' 성문을 닫을 틈도 없었다.' : ''} 장정이 모이지 못했다.`
      } else if (line.ambush === 'caught') {
        amb = weAtk ? ' 기습이 들켰다. 적이 기다리고 있었다.' : ' 몰래 오는 적을 먼저 알아챘다.'
      }
      const side = line.allies.length === 0 ? '' : line.pincer ? ` 등 ${line.allies.length + 1}군이 두 길로` : ` 등 ${line.allies.length + 1}군이`
      const who = line.allies.length === 0 ? josa(nameArmy(line.attacker), '이', '가') : `${nameArmy(line.attacker)}${side}`
      // 들판 싸움 — 길 위에서 마주쳤다 (성·장정 없음)
      const fieldAt = line.field === true && line.edge !== undefined ? fieldName(after, line.edge) : null
      const head = fieldAt !== null
        ? `${fieldAt}에서 마주쳤다. ${who} ${josa(fname(line.defender), '과', '와')} 맞붙어 ${OUTCOME_LINE[line.outcome]}.`
        : `${node(line.node)} 싸움. ${who} ${josa(fname(line.defender), '을', '를')} 쳐서 ${OUTCOME_LINE[line.outcome]}.`
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
      return line.faction === viewer ? `추수. 곡식 ${line.grain}섬이 창고에 들었다.` : null
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
    case 'rite':
      if (line.faction === viewer) {
        return line.season === 'spring'
          ? '소도에서 봄 제사를 지냈다. 올가을 수확이 늘 것이다.'
          : '소도에서 가을 제사를 지냈다. 군사들 기운이 올랐다.'
      }
      return `소문. ${josa(fname(line.faction), '이', '가')} 소도에서 제사를 지냈다.`
    case 'market': {
      if (line.a !== viewer && line.b !== viewer) return null
      return `${josa(fname(line.a === viewer ? line.b : line.a), '과', '와')} 장터가 섰다. 곡식 ${line.grain}섬이 들어왔다.`
    }
    case 'ask':
      if (line.ask.to !== viewer) return null
      return null // 보고 카드의 "사신이 왔다" 칸(받기·거절)이 대신 보인다
    case 'answered': {
      if (line.from === viewer) return null
      const who = fname(line.from)
      if (line.yes) return `${who}의 청을 받아들였다.`
      return line.askKind === 'demand' ? `${who}의 조공 요구를 거절했다. 전쟁이다.` : `${who}의 청을 물리쳤다.`
    }
    case 'guard':
      return line.faction === viewer ? `${node(line.node)}에 횃불을 늘리고 망을 세웠다.` : null
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
      return line.outcome === 'win' ? '도읍 셋을 차지했다. 변한의 맹주가 되었다.' : '도읍을 빼앗겼다. 나라가 무너졌다.'
    case 'sighted': {
      if (viewer !== before.player) return null
      const a = before.armies[line.army] ?? after.armies[line.army]
      let n = 0
      if (a !== undefined) for (const v of Object.values(a.mix)) n += v ?? 0
      const size = n > 0 ? ` ${Math.max(10, Math.round(n / 10) * 10)}명 남짓.` : ''
      const hint = line.suspect === true ? ' 낌새가 수상하다. 몰래 치려는 것 같다.' : ''
      return `${fname(line.faction)} 군대가 ${node(line.from)}에서 ${josa(node(line.to), '으로', '로')} 가고 있다.${size}${hint}`
    }
  }
}

/**
 * 싸움 한 판을 차례로 (형: "확률에 따라 답이 정해져있긴 하지만 진행되는걸 실시간으로 되는듯 하게") — ui/realm/battlecard.ts 가 쓴다.
 * 판정은 이미 났다. 이 글은 그 결과를 한 줄씩 풀어 보여 줄 뿐이다.
 */
export const BATTLE_APPROACH: Record<EdgeKind, string> = {
  field: '들판을 가로질러 다가선다.',
  pass: '고갯길을 넘어 내려온다.',
  forest: '숲길을 헤치고 나온다.',
  reeds: '갈대숲에 몸을 숨기고 다가선다.',
  ford: '나루를 건너 물을 차고 오른다.',
  sea: '배를 대고 뭍에 오른다.',
  mudflat: '갯벌을 건너 발이 빠지며 다가선다.',
}

export const BATTLE_AMBUSH = {
  success: '밤이 깊었다. 적은 아직 잠들어 있다.',
  caught: '어둠 속에서 북이 울린다. 들켰다. 적이 기다리고 있었다.',
  none: '해가 뜨자 두 진이 마주 선다.',
} as const

/** 맞붙은 뒤 — 결과마다 두 줄 (공격하는 쪽의 눈) */
export const BATTLE_CLASH: Record<Outcome, readonly [string, string]> = {
  rout: ['화살이 한 차례 쏟아진다.', '첫 부딪힘에 적진이 무너진다.'],
  win: ['창끝이 맞부딪힌다. 밀고 밀린다.', '한참 만에 적이 물러서기 시작한다.'],
  draw: ['창끝이 맞부딪힌다. 밀고 밀린다.', '해가 지도록 승부가 나지 않는다.'],
  lose: ['적의 화살이 쏟아진다.', '버티지 못하고 뒤로 밀린다.'],
  routed: ['적의 화살이 쏟아진다.', '진이 무너져 뿔뿔이 흩어진다.'],
}

/**
 * 장수 능력치 여섯의 이름 (docs/realm/HEROES.md §1) — 두 글자로 (형: "한글자로 하지말고 두글자로. 한자 하나로는 이해하기 힘들다고").
 * 열쇠는 Hero 의 칸 이름 (tong · gung 은 장수 첫판에서 더한다). 순서가 육각형의 꼭짓점 순서다.
 */
export const STAT_NAME = {
  mu: '무예', tong: '통솔', ryak: '지략', chi: '내정', deok: '매력', gung: '궁술',
} as const
