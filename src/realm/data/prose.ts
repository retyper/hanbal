/**
 * 나라의 글 — 이름·문장은 코드가 아니라 데이터에 둔다 (docs/realm/BUILD.md §1-6)
 * 고증 검토(lore-lens)가 코드를 안 읽고 이 파일만 본다. 숫자는 여기 없다 (P.realm).
 */
import { P } from '../../tune/params.ts'
import type { Equip, Outcome, UnitKind } from '../battle.ts'
import type { Ask, BuildWhat, Cmd, DiscoverHow, EdgeKind, Good, Grp, PlotOp, EnvoyAsk, NodeKind, Realm, Relation, ReportLine, RoundLog, RoundOrder, SeasonOfYear, Tag, Why } from '../types.ts'
import { groupOf } from '../tactics.ts'
import type { ConcealWhy } from '../season.ts'
import { TRAIT } from './traits.ts'

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
  pasture: '풀이 너른 들이다. 사람이 살면 말을 칠 수 있다.',
}

/**
 * 계절따라 달라지는 꼬리표 — 지금 계절에 규칙이 걸리면 한 줄 (지도의 안개·❄ 표와 같은 것, season.conceal · fortMul).
 * 형: "이렇게 하면 이렇게 될까? 오 이게 의도한대로 진행이 되네" — 계절이 바뀌면 땅의 말이 바뀐다
 */
export function tagNow(t: Tag, season: SeasonOfYear): string | null {
  if (t === 'fog' && (season === 'spring' || season === 'autumn')) return '지금은 안개철 — 이리 드는 군대가 숨기 좋다.'
  if (t === 'moat' && season === 'winter') return '지금은 해자가 얼었다 — 겨울엔 막아 주지 못한다.'
  return null
}

/** 창고의 것 다섯 — 화면 이름과 셈 단위 */
export const GOOD_NAME: Record<Good, string> = { grain: '곡식', iron: '철', salt: '소금', wood: '나무', horse: '말' }
export const GOOD_UNIT: Record<Good, string> = { grain: '섬', iron: '덩이', salt: '섬', wood: '짐', horse: '필' }

/** 몫을 글로 — "곡식 30 · 소금 10" (없는 것은 뺀다) */
export function goodsLine(g: Partial<Record<Good, number>>): string {
  return (['grain', 'iron', 'salt', 'wood', 'horse'] as const).filter((k) => (g[k] ?? 0) > 0).map((k) => `${GOOD_NAME[k]} ${g[k]}`).join(' · ')
}

/** 지을 것의 이름 */
export const BUILD_NAME: Record<BuildWhat, string> = { palisade: '목책', moat: '해자' }

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

const COUNT_WORD = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟'] as const

/**
 * 언제 닿나 — 지금 `season` 에서 `k` 계절을 가면 (형: "다음계절 누를때 바로가는게 아니잖아. 그 턴이 다음턴인지 그다음인지 몰라가지고 헷갈림").
 * 계절을 한 번 넘기면 1 줄어든다 — k=1 이면 다음 계절 소식에 닿아 있다.
 *   "다음 계절(1년 겨울)에 닿는다" · "두 계절 뒤(2년 봄)에 닿는다". `short` 면 "에 닿는다" 를 뺀다.
 */
export function arriveWhen(season: number, k: number, short = false): string {
  const n = Math.max(1, Math.round(k))
  const when = n === 1 ? '다음 계절' : `${COUNT_WORD[n] ?? String(n)} 계절 뒤`
  return `${when}(${seasonLabel(season + n)})${short ? '' : '에 닿는다'}`
}

/** 계절이 넘어갈 때 뜨는 한 줄 (FLOW §1) */
export const SEASON_LINE: Record<SeasonOfYear, string> = {
  spring: '봄. 씨를 뿌린다. 지금 뽑은 사람은 가을에 거두지 못한다.',
  summer: '여름. 장마가 든다. 나루가 막히고 길이 늦다.',
  autumn: '가을. 거둔다. 싸움철이다.',
  winter: '겨울. 강이 언다. 고개가 막히고 군량이 더 든다.',
}

export const ASK_NAME: Record<EnvoyAsk, string> = {
  truce: '화친', trade: '교역', tribute: '조공 요구', alliance: '동맹',
  gift: '선물', joint: '함께 치자', aid: '지원 요청', troops: '군대 빌리기', break: '약조 깨기',
}

export const RELATION_NAME: Record<Relation['state'], string> = {
  war: '전쟁', neutral: '중립', truce: '화친', ally: '동맹',
}

/** 이 승산보다 낮은데 이기면(또는 높은데 지면) "뜻밖" — 글의 문턱이라 여기 둔다 */
const UPSET = 0.35

/**
 * 숫자를 우리말로 읽을 때 끝소리의 받침 — 0 없음 · 8 ㄹ · 그 밖 받침 있음 (josa 가 쓴다).
 * 끝자리: 영(ㅇ) 일(ㄹ) 이 삼(ㅁ) 사 오 육(ㄱ) 칠(ㄹ) 팔(ㄹ) 구 · 끝이 0 이면 십(ㅂ) 백(ㄱ) 천(ㄴ) 만(ㄴ).
 * "철 2를" · "집 16이" · "곡식 300을" · "군사 1로" (형: "텍스트들 규칙에서 항상 한글 조사 틀리지 않게").
 */
function numberFinal(s: string): number {
  const d = s.replace(/[^0-9]/g, '')
  if (d === '' || /^0+$/.test(d)) return 21 // 영 — ㅇ
  const zeros = d.length - d.replace(/0+$/, '').length
  if (zeros > 0) return zeros === 1 ? 17 : zeros === 2 ? 1 : 4 // 십(ㅂ) · 백(ㄱ) · 천·만(ㄴ)
  return ({ '1': 8, '2': 0, '3': 16, '4': 0, '5': 0, '6': 1, '7': 8, '8': 8, '9': 0 } as Record<string, number>)[d[d.length - 1]!]!
}

/** 받침이 있으면 앞 것, 없으면 뒤 것 — 을/를 · 이/가 · 은/는 · 과/와 · 으로/로. 숫자로 끝나면 우리말 읽기로 판정한다 */
export function josa(word: string, withFinal: string, without: string): string {
  const c = word.charCodeAt(word.length - 1)
  let fin: number
  if (c >= 0x30 && c <= 0x39) fin = numberFinal(word)
  else if (c < 0xac00 || c > 0xd7a3) return word + without
  else fin = (c - 0xac00) % 28
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
export function askLine(a: Ask, from: string, place = ''): string {
  const goods = goodsLine
  switch (a.kind) {
    case 'truce': return `${josa(from, '이', '가')} 화친하자고 한다. 서로 치지 않고 장터를 연다.`
    case 'alliance': return `${josa(from, '이', '가')} 동맹을 맺자고 한다. 같은 적을 함께 치자고 한다.`
    case 'trade': return `${josa(from, '이', '가')} ${josa(goods(a.give), '을', '를')} 줄 테니 ${josa(goods(a.take), '을', '를')} 달라고 한다.`
    case 'tribute': return `${josa(from, '이', '가')} 고개를 숙이고 ${josa(goods(a.give), '을', '를')} 바치겠다고 한다.`
    case 'demand': return `${josa(from, '이', '가')} ${josa(goods(a.take), '을', '를')} 바치라고 한다. 거절하면 전쟁이다.`
    case 'joint': return `${josa(from, '이', '가')} ${place !== '' ? `${josa(place, '을', '를')} ` : ''}두 계절 안에 함께 치자고 한다. 받으면 우리도 그곳을 쳐야 한다. 약속을 어기면 사이가 크게 틀어진다.`
    case 'aid': return `동맹 ${josa(from, '이', '가')} ${josa(goods(a.take), '을', '를')} 보태 달라고 한다. 거절하면 서운해한다.`
  }
}

/**
 * 속셈의 까닭을 말로 (stance.ts — 형: "근거가 있게 움직여야해"). `about` 은 까닭이 가리키는 나라 이름,
 * `them` 은 깨기·만만함의 상대 ("우리" 또는 나라 이름). 주어는 그 일을 꺼낸 나라다.
 */
export function whyLine(why: Why | undefined, about = '', them = '우리'): string {
  switch (why) {
    case undefined: return ''
    case 'losing': return '싸움에서 밀리고 있다.'
    case 'fronts': return about !== '' ? `여러 나라와 싸우느라 힘이 갈렸다. ${about} 쪽에 힘을 모으려 한다.` : '여러 나라와 싸우느라 힘이 갈렸다.'
    case 'hungry': return '곡식이 바닥나 싸움을 이어 가기 어렵다.'
    case 'leader': return `${josa(about, '이', '가')} 너무 커졌다. 함께 막지 않으면 그쪽이 이긴다고 본다.`
    case 'commonFoe': return `둘 다 ${josa(about, '과', '와')} 싸우고 있다.`
    case 'favor': return '그동안 사이가 가까워졌다.'
    case 'weak': return them === '우리' ? '우리 힘을 두려워한다.' : `${them}의 힘을 두려워한다.`
    case 'strong': return '제 힘을 믿는다.'
    case 'surplus': return '남는 것을 모자란 것과 바꾸고 싶어 한다.'
    case 'ally': return '동맹이라 기댄다.'
    case 'tooBig': return `${josa(them, '이', '가')} 너무 커졌다고 본다. 이대로 두면 ${them === '우리' ? '우리가' : '그쪽이'} 이긴다고 여긴다.`
    case 'prey': return `${josa(them, '을', '를')} 만만하게 본다.`
  }
}

export const ASK_KIND_NAME: Record<Ask['kind'], string> = {
  truce: '화친', alliance: '동맹', trade: '교역', tribute: '조공 바침', demand: '조공 요구', joint: '함께 치자', aid: '지원 요청',
}

/**
 * 보고의 한 줄을 글로 — 보는 나라(viewer)의 눈으로. 남의 나라끼리의 일은 소문처럼 짧게.
 * `before` 는 넘기기 전 판 (사라진 군대의 이름을 찾으려고).
 */
/** 들킨 공작이 누가 보냈는지까지 드러났나 — 옛 줄(exposed 없음)은 들킴이 곧 드러남이었다 */
const exposedOf = (l: { readonly caught: boolean; readonly exposed?: boolean }): boolean => l.caught && (l.exposed ?? true)

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
      if (line.lost === undefined) return `${BLOCKED_LINE[line.why]}. ${josa(nameArmy(line.army), '은', '는')} 떠나지 못했다.`
      return line.why === 'winterPass'
        ? `${josa(nameArmy(line.army), '이', '가')} 눈 덮인 고개를 넘는다. 얼어서 ${line.lost}명을 잃고 한 계절 더 걸린다.`
        : `${josa(nameArmy(line.army), '이', '가')} 불어난 나루를 건넌다. 물살에 ${line.lost}명이 떠내려갔고 한 계절 더 걸린다.`
    }
    case 'hungry': {
      const a = after.armies[line.army] ?? before.armies[line.army]
      if (a?.faction !== viewer) return null
      return `${josa(nameArmy(line.army), '은', '는')} 군량이 떨어졌다. 배를 곯아 ${line.lost}명이 흩어지고 사기가 꺾였다.`
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
          ? ` 몰래 닿아 적이 모른 채 들이쳤다.${walled ? ' 성문이 닫히기 전에 들이쳤다.' : ''} 장정이 모이지 못했다.`
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
      // 개척은 계절을 넘기면 바로 자리 잡는다 — 길 위에 머물지 않는다
      if (line.faction === viewer) return `${josa(node(line.from), '에서', '에서')} 집 ${josa(String(line.n), '이', '가')} ${josa(node(line.to), '으로', '로')} 옮겨 가 자리 잡았다. 새 마을이 큰다.`
      return `소문. ${josa(fname(line.faction), '이', '가')} ${josa(node(line.to), '에', '에')} 사람을 보냈다.`
    case 'migrate':
      // 남의 나라 집 옮기기는 들리지 않는다
      if (line.faction !== viewer) return null
      if (line.auto === true) return `${josa(node(line.from), '이', '가')} 붐벼 집 ${josa(String(line.n), '이', '가')} ${josa(node(line.to), '으로', '로')} 옮겨 갔다.`
      return `${node(line.from)}의 집 ${josa(String(line.n), '을', '를')} ${josa(node(line.to), '으로', '로')} 옮겼다. 두 고을은 자리 잡느라 한동안 집이 늘지 않는다.`
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
    case 'ironMarket':
      if (line.from === viewer) return `${josa(fname(line.to), '이', '가')} 장터에서 우리 철 ${josa(String(line.iron), '을', '를')} 곡식 ${line.grain}섬에 사 갔다.`
      if (line.to === viewer) return `${fname(line.from)} 장터에서 철 ${josa(String(line.iron), '을', '를')} 곡식 ${line.grain}섬에 사 왔다.`
      return null
    case 'pathIron':
      // 철과 뱃길 — 우리 것이면 알림, 남의 것이면 소문
      if (line.faction === viewer) return `교역 장부 — 올해 ${line.partners}나라와 철을 바꿨다. 뱃길이 무르익는다. 조금만 더 바꾸면 변진의 쇠가 우리 뱃길로 흐른다.`
      return `소문 — ${fname(line.faction)} 포구에 이웃 나라 배들이 줄을 선다. 철이 그리로 흐른다. 그 뱃길을 끊어야 한다.`
    case 'pathRite':
      // 큰 제사 — 우리 것은 제사철마다 사슬, 남의 것은 소문
      if (line.faction === viewer) {
        const left = Math.max(0, line.need - line.chain)
        const hhLine = line.hh >= line.hhNeed ? '집도 넉넉하다.' : `집이 ${line.hhNeed - line.hh}채 더 있어야 큰 제사를 열 수 있다.`
        return left > 0
          ? `제사 사슬 ${line.chain}/${line.need} — 한 번도 거르지 않았다. ${left}번 더 지내면 큰 제사를 연다. ${hhLine}`
          : `제사 사슬을 다 이었다. 가을에 집이 넉넉하면 큰 제사가 열린다. ${hhLine}`
      }
      return `소문 — ${fname(line.faction)}은(는) 해마다 빠짐없이 하늘에 제사한다. 큰 제사가 머지않았다. 소도 곁 땅을 흔들어야 한다.`
    case 'ask':
      if (line.ask.to !== viewer) return null
      return null // 보고 카드의 "사신이 왔다" 칸(받기·거절)이 대신 보인다
    case 'answered': {
      if (line.from === viewer) return null
      const who = fname(line.from)
      if (line.yes) return `${who}의 청을 받아들였다.`
      return line.askKind === 'demand' ? `${who}의 조공 요구를 거절했다. 전쟁이다.` : `${who}의 청을 물리쳤다.`
    }
    case 'plot': {
      const target = fname(line.target)
      const where = line.node !== undefined ? node(line.node) : target
      if (line.faction === viewer) {
        const did = PLOT_DONE[line.op](target, where, line.other !== undefined ? fname(line.other) : '')
        if (line.op === 'assassin' && line.hero !== undefined) {
          const who = after.heroes[line.hero]?.name ?? '?'
          // 들켰을 때 — 고용 자객은 값만 잃고, 우리 장수는 빠져나오거나 붙잡힌다 (자객 기본 · 장수는 도박)
          const agent = line.agent !== undefined ? (after.heroes[line.agent]?.name ?? '자객') : '고용 자객'
          const fateLine = !line.caught ? ''
            : line.agent === undefined ? ` ${josa(agent, '이', '가')} 붙잡혔다. 값만 날렸다.`
              : line.agentFate === 'escaped' ? ` 들켰지만 ${josa(agent, '이', '가')} 지붕을 타고 빠져나왔다.`
                : ` ${josa(agent, '이', '가')} 붙잡혔다.`
          const whoKnows = !line.caught ? '' : exposedOf(line)
            ? ` ${josa(target, '이', '가')} 우리가 보낸 줄 안다. 사이가 크게 틀어졌다.`
            : line.agentFate === 'captured' ? ` 아직 입을 다물고 있다 — ${josa(target, '은', '는')} 누가 보냈는지 모른다.`
              : ` ${josa(target, '은', '는')} 누가 보냈는지 모른다.`
          if (line.ok) return `자객의 화살이 ${josa(who, '을', '를')} 꿰뚫었다. ${line.result === 'kill' ? `${josa(who, '이', '가')} 죽었다.` : `${josa(who, '은', '는')} 두 계절 동안 일어나지 못한다.`}${fateLine}${whoKnows}`
          return `암살이 틀어졌다.${line.caught ? fateLine + whoKnows : ` ${josa(agent, '은', '는')} 어둠 속으로 물러났다.`}`
        }
        const knew = exposedOf(line)
          ? ` ${josa(target, '이', '가')} 우리 짓인 줄 안다. 사이가 나빠졌다.`
          : ` ${josa(target, '이', '가')} 눈치챘지만 누가 했는지는 모른다.`
        if (line.ok) return `공작이 뜻대로 됐다. ${did}${line.caught ? knew : ''}`
        return `공작이 틀어졌다. ${PLOT_NAME[line.op]}.${line.caught ? knew : ''}`
      }
      // 우리가 당한 공작 — 들켰으면 일이 있었음을 안다. 누가 보냈는지는 드러났을 때만 (형: "어디서보낸 첩자인지 알기도 모르기도")
      if ((line.target === viewer || line.other === viewer) && line.caught) {
        const from = exposedOf(line) ? fname(line.faction) : null
        if (line.op === 'assassin' && line.target === viewer) {
          const v = line.hero !== undefined ? (after.heroes[line.hero]?.name ?? '장수') : '장수'
          const hit = !line.ok ? `${josa(v, '을', '를')} 노린 화살이 빗나갔다.`
            : line.result === 'kill' ? `${josa(v, '이', '가')} 자객의 화살에 죽었다.` : `${josa(v, '이', '가')} 자객의 화살에 맞았다.`
          const caughtAgent = line.agent === undefined || line.agentFate === 'captured'
          const catchLine = caughtAgent ? ' 자객을 붙잡았다.' : ' 자객은 지붕을 타고 달아났다.'
          if (from !== null) return `${hit}${catchLine} ${josa(from, '이', '가')} 보낸 자객이다.`
          return `${hit}${catchLine} ${caughtAgent ? '입을 열지 않는다 — 어디서 왔는지 모른다.' : '어디서 왔는지 모른다.'}`
        }
        if (from !== null) return `${from}의 ${PLOT_NAME[line.op]} 공작을 잡아냈다.${line.ok ? ' 그래도 일은 벌어졌다.' : ''}`
        if (line.other === viewer && line.target !== viewer) return null // 이간의 다른 쪽은 누가 했는지 모르면 알 길이 없다
        return `누군가 ${PLOT_NAME[line.op]} 공작을 벌이다 들켰다. 어디서 보냈는지는 모른다.${line.ok ? ' 그래도 일은 벌어졌다.' : ''}`
      }
      return null
    }
    case 'confess': {
      const name = after.heroes[line.hero]?.name ?? '자객'
      if (line.to === viewer) return `붙잡아 둔 자객 ${josa(name, '이', '가')} 입을 열었다. ${josa(fname(line.from), '이', '가')} 보냈다고 한다.`
      if (line.from === viewer) return `붙잡힌 ${josa(name, '이', '가')} 끝내 실토했다. ${josa(fname(line.to), '이', '가')} 우리가 보낸 줄 알게 됐다.`
      return null
    }
    case 'bowUp':
      return line.faction === viewer ? `자객의 활을 ${josa(BOW_NAME[line.tier] ?? '새 활', '으로', '로')} 바꿨다. 더 멀리, 더 세게 난다.` : null
    case 'mystery':
      if (line.faction !== viewer) return null
      switch (line.what) {
        case 'morale': return '진중에 흉흉한 소문이 돈다. 군사들 기운이 꺾였다. 누가 퍼뜨렸는지 모른다.'
        case 'grain': return '밤사이 창고에 불이 났다. 누가 놓았는지 모른다.'
        case 'militia': return `${line.node !== undefined ? node(line.node) : '어느 마을'} 장정들이 술렁인다. 누군가 손을 쓴 것 같다.`
        case 'wound': return `밤사이 ${josa(line.hero !== undefined ? (after.heroes[line.hero]?.name ?? '장수') : '장수', '이', '가')} 날아든 화살에 맞았다. 쏜 자는 사라졌다.`
        case 'death': return `밤사이 ${josa(line.hero !== undefined ? (after.heroes[line.hero]?.name ?? '장수') : '장수', '이', '가')} 화살에 맞아 죽었다. 쏜 자는 사라졌다.`
      }
      return null
    case 'pledge': {
      if (line.from !== viewer && line.to !== viewer) return null
      const place = node(line.node)
      if (line.from === viewer) {
        return line.kept ? `${josa(fname(line.to), '과', '와')} 한 약속대로 ${josa(place, '을', '를')} 쳤다. 믿음이 깊어졌다.` : `${josa(fname(line.to), '과', '와')} ${josa(place, '을', '를')} 치기로 한 약속을 어겼다. 사이가 틀어졌다.`
      }
      return line.kept ? `${josa(fname(line.from), '이', '가')} 약속대로 ${josa(place, '을', '를')} 쳤다.` : `${josa(fname(line.from), '이', '가')} ${josa(place, '을', '를')} 치겠다던 약속을 어겼다.`
    }
    case 'lent': {
      if (line.to !== viewer) return null
      return line.back
        ? `${fname(line.from)}에서 빌려 온 군대가 돌아갔다.`
        : `${fname(line.from)} 군대가 ${josa(node(line.node), '을', '를')} 지키러 왔다.`
    }
    case 'arm': {
      if (line.faction !== viewer) return null
      if (line.unit !== undefined) {
        return `${nameArmy(line.army)}의 ${UNIT_NAME[line.unit]} ${line.n ?? 0}명이 철 ${josa(String(line.iron), '을', '를')} 들여 ${josa(GEAR_NAME[line.unit][line.equip], '을', '를')} 들었다.`
      }
      return `${josa(nameArmy(line.army), '이', '가')} 철 ${josa(String(line.iron), '을', '를')} 들여 무장을 한 단계씩 올렸다.`
    }
    case 'recruit': {
      if (line.faction !== viewer) return null
      const h = after.heroes[line.hero]
      return line.how === 'persuade'
        ? `${josa(h?.name ?? '?', '이', '가')} 마침내 무릎을 꿇었다. 우리 장수가 되었다.`
        : `${josa(h?.name ?? '?', '이', '가')} 우리 사람이 되었다.`
    }
    // 정과 성장 (HEROES §6) — 우리 장수만
    case 'grow': {
      const h = after.heroes[line.hero]
      if (h === undefined || h.faction !== viewer) return null
      return `${h.name}의 ${josa(STAT_NAME[line.stat], '이', '가')} 한 단계 올랐다.`
    }
    case 'bond': {
      const h = after.heroes[line.hero]
      if (h === undefined || h.faction !== viewer) return null
      return `${josa(h.name, '이', '가')} 우리를 믿게 됐다. 이끄는 군대의 사기가 오르고, 꾀어도 잘 안 넘어간다.`
    }
    case 'awaken': {
      const h = after.heroes[line.hero]
      if (h === undefined || h.faction !== viewer) return null
      return `${josa(h.name, '이', '가')} 「${TRAIT[line.trait]?.name ?? line.trait}」에 눈떴다.`
    }
    case 'wanderer': {
      if (after.nodes[line.node]?.owner !== viewer) return null
      return null // 보고 카드의 "떠돌이 인재" 칸(들인다)이 대신 보인다
    }
    case 'heroMoved': {
      if (line.faction !== viewer) return null
      const name = after.heroes[line.hero]?.name ?? '?'
      if (line.captor !== null) return `${josa(name, '이', '가')} 고을을 잃고 ${fname(line.captor)}에 사로잡혔다.`
      return `${josa(name, '이', '가')} 고을을 잃고 ${line.to !== null ? josa(node(line.to), '으로', '로') : '이웃 고을로'} 물러났다.`
    }
    case 'guard':
      return line.faction === viewer ? `${node(line.node)}에 횃불을 늘리고 망을 세웠다.` : null
    case 'build':
      if (line.faction !== viewer) return null
      return line.done
        ? `${node(line.node)}에 ${josa(BUILD_NAME[line.what], "이", "가")} 섰다.`
        : `${node(line.node)}에 ${josa(BUILD_NAME[line.what], '을', '를')} 짓기 시작했다. 이 계절이 끝나면 선다.`
    case 'spoil':
      return line.faction === viewer ? `겨울 동안 곡식 ${line.grain}섬이 썩었다. 소금이 모자랐다.` : null
    case 'discover':
      return line.faction === viewer ? DISCOVER_LINE[line.how](fname(line.nation)) : null
    case 'rumor': {
      if (line.viewer !== viewer) return null
      const who = fname(line.about)
      const head = `첩보 — ${who}:`
      switch (line.fact) {
        case 'hungry': return `${head} 곳간이 비어 간다고 한다.`
        case 'hoard': return `${head} ${josa(GOOD_NAME[line.good ?? 'iron'], '을', '를')} 잔뜩 쌓아 두었다고 한다.`
        case 'settled': return `${head} ${node(line.node ?? '')}에 새 마을을 일궜다고 한다.`
        case 'building': return `${head} ${node(line.node ?? '')}에 울타리를 친다고 한다.`
        case 'drafting': return `${head} 장정을 모아 군사로 뽑는다고 한다.`
        case 'armed': return `${head} 대장간에 불이 꺼지지 않는다. 무장을 올렸다고 한다.`
        case 'seekAlly': return `${head} ${line.other === viewer ? '우리' : fname(line.other ?? '')} 쪽으로 사신이 자주 간다고 한다.`
        case 'seekTruce': return `${head} 싸움을 그치고 싶어 한다는 말이 돈다${line.other !== undefined ? ` (${line.other === viewer ? '우리와' : josa(fname(line.other), '과', '와')})` : ''}.`
      }
      return null
    }
    case 'hunger':
      return line.faction === viewer ? '곡식이 바닥났다. 군사들이 굶는다.' : null
    case 'envoy': {
      const about = line.about !== undefined ? fname(line.about) : ''
      // 남의 나라끼리 — 판이 움직이는 일(맺기·깨기)만 소문으로. 속셈은 그 나라에 첩자가 있거나 동맹일 때만 (형: "속셈은 아무에게나 드러내게 하지 말고")
      const knows = (f: string): boolean => after.relations?.[f < viewer ? `${f}|${viewer}` : `${viewer}|${f}`]?.state === 'ally'
        || (after.spies?.[viewer] ?? []).some((s) => s.until >= before.season && after.nodes[s.node]?.owner === f)
      const mind = (f: string, w: string): string => (knows(f) ? ` 첩자의 말로는 — ${w}` : '')
      if (line.from !== viewer && line.to !== viewer) {
        if (!line.accepted || line.why === undefined) return null
        const a = fname(line.from)
        const b = fname(line.to)
        switch (line.ask) {
          case 'alliance': return `소문 — ${josa(a, '과', '와')} ${josa(b, '이', '가')} 동맹을 맺었다.${mind(line.from, whyLine(line.why, about, b))}`
          case 'truce': return `소문 — ${josa(a, '과', '와')} ${josa(b, '이', '가')} 화친했다.${mind(line.from, whyLine(line.why, about, b))}`
          case 'break': return `소문 — ${josa(a, '이', '가')} ${josa(b, '과', '와')}의 약조를 깼다.${mind(line.from, whyLine(line.why, about, b))}`
          default: return null
        }
      }
      const other = line.from === viewer ? line.to : line.from
      if (line.from === viewer) {
        if (line.ask === 'break') return `${josa(fname(other), '과', '와')}의 약조를 깼다.`
        return line.accepted
          ? `${josa(fname(other), '이', '가')} ${josa(ASK_NAME[line.ask], '을', '를')} 받아들였다.`
          : `${josa(fname(other), '이', '가')} ${josa(ASK_NAME[line.ask], '을', '를')} 거절했다.`
      }
      if (line.ask === 'break') return `${josa(fname(other), '이', '가')} 우리와의 약조를 깼다.${mind(other, whyLine(line.why, about))} 이제 언제든 쳐들어올 수 있다.`
      return `${fname(other)}에서 ${ASK_NAME[line.ask]} 사신이 왔다.`
    }
    case 'recall': {
      if (line.faction === viewer) return `약조를 맺어 ${josa(node(line.node), '으로', '로')} 가던 ${josa(nameArmy(line.army), '을', '를')} 돌린다.`
      if (after.nodes[line.node]?.owner !== viewer) return null
      return `${josa(node(line.node), '으로', '로')} 오던 ${fname(line.faction)} 군대가 발길을 돌렸다.`
    }
    case 'relation': {
      const by = line.by
      const why = line.why
      // 남의 나라끼리 — 전쟁·동맹만 (누가 먼저 걸었나까지)
      if (line.a !== viewer && line.b !== viewer) {
        const [x, y] = by === line.b ? [line.b, line.a] : [line.a, line.b]
        if (line.state === 'war') {
          const how = why === 'betray' ? '약조를 깨고 쳐들어갔다' : why === 'tribute' ? '조공을 거절당하자 칼을 뽑았다' : why === 'sow' ? '이간에 넘어가 등을 돌렸다' : why === 'plot' ? '공작이 드러나 칼을 뽑았다' : '군대를 들였다'
          return by !== undefined ? `${josa(fname(x), '이', '가')} ${josa(fname(y), '과', '와')} 전쟁을 벌였다 — ${how}.` : `${josa(fname(x), '과', '와')} ${fname(y)} 사이에 전쟁이 났다.`
        }
        if (line.state === 'ally') return `${josa(fname(x), '과', '와')} ${josa(fname(y), '이', '가')} 동맹을 맺었다.`
        return null
      }
      const other = line.a === viewer ? line.b : line.a
      const o = fname(other)
      switch (line.state) {
        case 'war':
          if (by === viewer) {
            if (why === 'tribute' || why === 'demand') return `${josa(o, '이', '가')} 우리 요구를 거절했다. ${josa(o, '과', '와')} 전쟁이다.`
            return why === 'betray' ? `우리가 약조를 깨고 ${josa(o, '을', '를')} 쳤다. 전쟁이다. 다른 나라들도 우리를 덜 믿는다.` : `우리가 ${o} 땅에 군대를 들였다. ${josa(o, '과', '와')} 전쟁이다.`
          }
          if (by === other) {
            const how = why === 'betray' ? '약조를 깨고 쳐들어왔다' : why === 'attack' ? '우리 땅에 군대를 들였다'
              : why === 'tribute' ? '바치라는 요구를 우리가 거절하자 칼을 뽑았다' : why === 'demand' ? '우리가 그 요구를 거절하자 칼을 뽑았다'
                : why === 'plot' ? '우리가 보낸 공작이 드러나 노했다' : '칼을 뽑았다'
            return `${josa(o, '이', '가')} 우리에게 전쟁을 걸어왔다 — ${how}.`
          }
          return why === 'sow' ? `누군가의 이간으로 ${josa(o, '과', '와')} 틀어져 전쟁이 됐다.` : `${josa(o, '과', '와')} 전쟁이다.`
        case 'truce':
          // 동맹에서 한 칸 물러난 것 — 맺은 게 아니다
          if (why === 'distrust') return `${josa(o, '이', '가')} 우리를 덜 믿어 동맹을 거두고 화친만 남겼다.`
          if (why === 'plot' || why === 'sow') return `${josa(o, '과', '와')} 틀어져 동맹이 화친으로 물러났다.`
          return `${josa(o, '과', '와')} 화친을 맺었다.`
        case 'ally': return `${josa(o, '과', '와')} 동맹을 맺었다.`
        case 'neutral':
          if (why === 'break') return null // 사신 줄(약조를 깼다)이 이미 말한다
          if (why === 'distrust') return `${josa(o, '이', '가')} 우리를 믿지 못해 맺은 사이를 거뒀다.`
          if (why === 'plot') return `우리가 보낸 공작이 드러나 ${josa(o, '이', '가')} 등을 돌렸다.`
          return `${josa(o, '과', '와')}의 화친이 끝났다.`
      }
      return null
    }
    case 'end':
      if (line.faction !== viewer) return null
      if (line.path === 'ironsea') {
        return line.outcome === 'win'
          ? '변진의 쇠가 우리 뱃길로 흘렀다. 이웃 나라들이 다 우리 철을 사 간다. 바다의 맹주가 되었다.'
          : `${josa(fname(line.by ?? ''), '이', '가')} 철과 뱃길을 쥐었다. 이웃이 다 그 철을 사 간다. 우리 판은 여기까지다.`
      }
      if (line.path === 'rite') {
        return line.outcome === 'win'
          ? '온 나라가 모여 하늘에 절했다. 큰 제사가 열리고, 군장들이 우리 소도 앞에 섰다.'
          : `${josa(fname(line.by ?? ''), '이', '가')} 큰 제사를 열었다. 온 나라가 그 소도 앞에 절했다. 우리 판은 여기까지다.`
      }
      if (line.path === 'suzerain') {
        return line.outcome === 'win'
          ? '여러 나라 군장이 모여 우리 군장을 진왕으로 받들었다. 맹주가 되었다.'
          : `${josa(fname(line.by ?? ''), '이', '가')} 진왕이 되었다. 여러 나라가 그 아래 섰다. 우리 판은 여기까지다.`
      }
      return line.outcome === 'win' ? '도읍을 넉넉히 차지했다. 이 판의 맹주가 되었다.' : '도읍을 빼앗겼다. 나라가 무너졌다.'
    case 'suzerain': {
      // 맹주의 길 — 우리 것이면 맹약의 해, 남의 것이면 소문 (보고판이 모르는 나라 줄은 거른다)
      const left = Math.max(0, P.realm.suzerainSeasons - line.streak)
      if (line.faction === viewer) {
        return line.streak > 0
          ? `맹약의 해 — 아는 나라 가운데 ${line.have}곳이 우리와 손잡았다. 이대로 ${left}계절 더 버티면 진왕이 된다.`
          : `손잡은 나라가 ${line.have}곳이다. ${line.need}곳이 되면 맹약의 해가 시작된다.`
      }
      return line.streak > 0
        ? `소문 — ${fname(line.faction)} 군장 곁에 군장들이 모였다. 이대로 ${left}계절이면 진왕이 된다. 그 맹약을 깨야 한다.`
        : `소문 — ${fname(line.faction)} 군장 곁에 군장들이 모인다. 진왕을 바란다.`
    }
    case 'envoyHeld':
      if (line.from === viewer) return `${josa(fname(line.to), '이', '가')} 사신으로 간 ${josa(after.heroes[line.hero]?.name ?? '장수', '을', '를')} 붙잡았다.`
      if (line.to === viewer) return `${fname(line.from)}에서 온 사신 ${josa(after.heroes[line.hero]?.name ?? '장수', '을', '를')} 붙잡았다.`
      return null
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

type Battle = Extract<ReportLine, { kind: 'battle' }>

/** 이름의 첫 마디 — "삼랑 나루 마을" → "삼랑" */
/** 땅을 이르는 흔한 낱말 — 싸움 이름의 뿌리로는 뜻이 없다 */
const GENERIC_ROOT = new Set(['갯벌', '바다', '나루', '들', '벌', '섬', '고개', '마을', '포구', '항구', '산성', '도읍', '빈땅', '새'])
function rootName(name: string): string {
  return name.split(' ')[0] ?? name
}
/** 끝이 이미 그 말이면 또 붙이지 않는다 — "너른벌" + "벌" → "너른벌" */
function withTail(root: string, tail: string): string {
  return root.endsWith(tail) ? root : `${root}${tail}`
}

/**
 * 싸움의 이름 — 싸운 땅에서 딴다 (형: "황산벌전투 옥포해전 칠천량전투 이런것들 … 그지역들을따서").
 * 바다로 왔으면 "○○ 바다 싸움", 나루·갈대 물가면 "○○나루 싸움", 고개면 "○○재 싸움", 갯벌이면 "○○ 갯벌 싸움",
 * 숲이면 "○○숲 싸움", 성(도읍·산성·목책) 앞이면 "○○성 싸움", 그 밖은 "○○벌 싸움". ○○ 은 그 고을 이름의 첫 마디.
 */
export function battleName(r: Realm, l: Pick<Battle, 'node' | 'field' | 'edge' | 'via' | 'approach'>): string {
  const node = r.nodes[l.node]
  let root = rootName(node?.name ?? l.node)
  // 고을 이름의 첫 마디가 땅 낱말뿐이면("갯벌 마을" → 갯벌) 그 땅 주인 나라 이름으로 — "갯벌 바다 싸움" 대신 "가락 바다 싸움"
  if (GENERIC_ROOT.has(root) && node?.owner != null) root = (r.factions[node.owner]?.name ?? root).replace(/(국|부)$/, '')
  const kind = l.field === true && l.edge !== undefined ? r.edges[l.edge]?.kind : l.via
  switch (kind) {
    case 'sea': return `${root} 바다 싸움`
    case 'ford': case 'reeds': return `${withTail(root, '나루')} 싸움`
    case 'pass': return `${withTail(root, '재')} 싸움`
    case 'mudflat': return `${root} 갯벌 싸움`
    case 'forest': if (l.field === true) return `${withTail(root, '숲')} 싸움`; break
    default: break
  }
  const walled = node !== undefined && (node.kind === 'capital' || node.kind === 'fort' || node.tags.includes('palisade') || l.approach === 'cliff')
  if (l.field !== true && walled) return `${withTail(root, '성')} 싸움`
  return `${withTail(root, '벌')} 싸움`
}

/** 무리를 부르는 이름 — 그 무리에 든 병종 (많은 차례로 둘까지): "창병·방패병" · "궁수" · "기병" */
export function groupLabel(mix: Readonly<Partial<Record<UnitKind, number>>>, g: Grp): string {
  const ks = (Object.keys(mix) as UnitKind[]).filter((k) => (mix[k] ?? 0) > 0 && groupOf(k) === g).sort((p, q) => (mix[q] ?? 0) - (mix[p] ?? 0))
  if (ks.length === 0) return GROUP_NAME[g]
  return ks.slice(0, 2).map((k) => UNIT_NAME[k]).join('·')
}
export const GROUP_NAME: Record<Grp, string> = { front: '앞줄', bows: '활', horse: '기병' }

/** 명령마다 그 무리가 한 일 — 끝이 '-다' (잇는 꼴은 '-고') */
const DID: Readonly<Partial<Record<Cmd, string>>> = {
  charge: '창끝을 낮추고 돌격했다', hold: '방패를 겹쳐 방진을 쳤다', open: '앞줄을 벌려 활에 길을 텄다',
  ford: '여울목을 막아섰다', rocks: '비탈 위에서 바위를 굴렸다', gate: '성문을 들이쳤다', ram: '뱃머리로 들이받았다',
  volley: '화살비를 퍼부었다', counter: '맞은편 궁수를 겨눠 맞쏘았다', fire: '불화살을 날렸다', height: '높은 곳에서 내리쏘았다',
  flank: '옆으로 돌아 들어갔다', punch: '앞줄 사이로 내달았다', pursue: '흔들리는 맞은편을 쫓았다', guard: '장수 곁을 지켰다',
}
const did = (c: Cmd): string => DID[c] ?? '맞섰다'
const didAnd = (c: Cmd): string => did(c).replace(/다$/, '고')

/** 싸움 이야기를 짓는 데 쓰는 것 — [공격 쪽, 지킴 쪽] */
export interface StoryCtx {
  /** 쪽을 부르는 말 — 우리 쪽은 '우리', 맞은편은 '적' */
  readonly side: readonly [string, string]
  /** 장수 이름 — 없으면 null */
  readonly hero: readonly [string | null, string | null]
  /** 처음 병종 */
  readonly mix: readonly [Readonly<Partial<Record<UnitKind, number>>>, Readonly<Partial<Record<UnitKind, number>>>]
  /** 처음 사기 · 처음 사람 */
  readonly m0: readonly [number, number]
  readonly men0: readonly [number, number]
}

/** 그 판의 이야기 틀 — 보는 나라가 낀 쪽이 '우리', 맞은편이 '적' (안 꼈으면 나라 이름). 판 기록(start)이 없으면 null */
export function storyCtx(r: Realm, l: { readonly start?: Battle['start'] | undefined; readonly atkFaction?: string | undefined; readonly defender: string }, viewer: string): StoryCtx | null {
  const st = l.start
  if (st === undefined) return null
  const fname = (f: string | undefined): string => (f !== undefined ? (r.factions[f]?.name ?? '?') : '?')
  const side: [string, string] = l.atkFaction === viewer ? ['우리', '적'] : l.defender === viewer ? ['적', '우리'] : [fname(l.atkFaction), fname(l.defender)]
  const hn = (id: string | null): string | null => (id !== null ? (r.heroes[id]?.name ?? null) : null)
  return {
    side, hero: [hn(st.heroes[0]), hn(st.heroes[1])], mix: st.mix ?? [{}, {}], m0: [st.morale[0], st.morale[1]], men0: [st.men[0], st.men[1]],
  }
}

const ix = (s: 'a' | 'd'): 0 | 1 => (s === 'a' ? 0 : 1)
const opp = (s: 'a' | 'd'): 'a' | 'd' => (s === 'a' ? 'd' : 'a')
const ppl = (n: number): string => `${Math.round(n).toLocaleString('ko-KR')}명`

/**
 * 한 합의 이야기 — 두세 문장 (형: "누가 얼마가 어떻게 공격한거고 그게 어떻게 된거고 몇명이 어떻게 침투해서 어떤작전으로 시도를 했고
 * 어떻게된 어느쪽 군사들이 어떻게 와해됐는지"). 장수의 일(사로잡기·겨루기·물러나기) → 앞줄 맞붙음 → 크게 잃게 한 일 차례로,
 * 그 합에 새로 흔들린 쪽이 있으면 끝에 한 줄.
 */
export function roundStory(rd: RoundLog, prev: RoundLog | undefined, c: StoryCtx): string[] {
  const acts = rd.acts ?? []
  const who = (s: 'a' | 'd'): string => c.side[ix(s)]
  const grp = (s: 'a' | 'd', g: Grp | 'lead' | undefined): string => (g === undefined || g === 'lead' ? '장수' : groupLabel(c.mix[ix(s)], g))
  const heroOf = (s: 'a' | 'd'): string => c.hero[ix(s)] ?? `${who(s)} 장수`
  const orderOf = (s: 'a' | 'd'): RoundOrder | undefined => (s === 'a' ? rd.oa : rd.od)
  const out: string[] = []

  // 장수의 일
  for (const a of acts) {
    if (a.g !== 'lead') continue
    const x = a.s
    const y = opp(x)
    if (a.c === 'retreat') {
      out.push(`${josa(who(x), '이', '가')} 징을 쳐 군사를 물렸다 — 물러나며 ${josa(ppl(a.sl ?? 0), '을', '를')} 잃었다.`)
    } else if (a.c === 'duel') {
      out.push(`${josa(heroOf(x), '이', '가')} 앞으로 나서 ${josa(heroOf(y), '과', '와')} 겨뤘다 — `
        + (a.res === 'won' ? `${josa(heroOf(y), '이', '가')} 말에서 떨어졌다. ${who(y)} 군사들이 술렁인다.` : `${josa(heroOf(x), '이', '가')} 밀려 다쳤다. ${who(x)} 군사들이 술렁인다.`))
    } else if (a.c === 'capture') {
      const yo = orderOf(y)
      const where = (c.mix[ix(x)].horse ?? 0) > 0 ? '말을 달려 적진 옆을 돌아' : yo?.front === 'open' ? '벌어진 앞줄 틈으로' : '앞줄 틈을 비집고'
      const guard = yo?.horse === 'guard' ? `기병이 둘러싼 호위 ${ppl(a.guard ?? 0)}` : `장수 곁 호위 ${ppl(a.guard ?? 0)}`
      out.push(a.res === 'ok'
        ? `${who(x)} 날랜 무리 ${josa(ppl(a.n), '이', '가')} ${where} 파고들어 ${josa(guard, '을', '를')} 뚫고 ${josa(heroOf(y), '을', '를')} 사로잡았다!`
        : `${who(x)} 날랜 무리 ${josa(ppl(a.n), '이', '가')} ${where} 파고들었으나 ${guard}에 막혔다 — ${josa(ppl(a.sl ?? 0), '을', '를')} 잃고 돌아섰다.`)
    }
  }

  // 앞줄 맞붙음 — 두 쪽 앞줄을 한 문장으로
  const fr = acts.filter((a) => a.g === 'front' && a.tg === 'front')
  if (fr.length > 0) {
    const win = fr.find((a) => a.res === 'won')
    const lose = fr.find((a) => a.res === 'lost')
    const f0 = fr[0]!
    if (win !== undefined) {
      const x = win.s
      const y = opp(x)
      const yc = orderOf(y)?.front
      const lg = grp(y, 'front')
      let why: string
      if (win.c === 'hold' || win.c === 'ford' || win.c === 'rocks') why = `달려든 ${josa(`${who(y)} ${lg}`, '이', '가')} 방패 벽에 부딪혀 꺾였다`
      else if (win.c === 'open') why = `서 있는 ${who(y)} 방진이 화살받이가 됐다`
      else if (yc === 'open') why = `벌어진 ${who(y)} 앞줄을 뚫고 들어갔다`
      else if (lose !== undefined || yc === 'hold') why = `흔들리던 ${who(y)} 방진이 뚫렸다`
      else why = `${josa(`${who(y)} ${lg}`, '이', '가')} 밀렸다`
      out.push(`${who(x)} ${grp(x, 'front')} ${josa(ppl(win.n), '이', '가')} ${did(win.c)} — ${why}. ${who(y)} 앞줄 ${josa(ppl(win.tl ?? 0), '이', '가')} 쓰러지고 ${(win.sl ?? 0) > 0 ? `${josa(who(x), '은', '는')} ${josa(ppl(win.sl ?? 0), '을', '를')} 잃었다` : `${josa(who(x), '은', '는')} 하나도 잃지 않았다`}.`)
    } else if (f0.res === 'stall') {
      const [p, q] = fr.length > 1 ? [fr[0]!, fr[1]!] : [f0, undefined]
      out.push(q !== undefined
        ? `${who(p.s)} ${grp(p.s, 'front')} ${josa(ppl(p.n), '과', '와')} ${who(q.s)} ${grp(q.s, 'front')} ${josa(ppl(q.n), '이', '가')} 마주 섰으나 서로 버티며 크게 붙지 않았다.`
        : `${who(p.s)} ${grp(p.s, 'front')} ${josa(ppl(p.n), '이', '가')} ${did(p.c)}.`)
    } else if (fr.length > 1) {
      const [p, q] = [fr[0]!, fr[1]!]
      out.push(`${who(p.s)} ${grp(p.s, 'front')} ${josa(ppl(p.n), '이', '가')} ${didAnd(p.c)} ${who(q.s)} ${grp(q.s, 'front')} ${josa(ppl(q.n), '은', '는')} ${did(q.c)} — `
        + `${p.c === 'hold' && q.c === 'charge' || p.c === 'charge' && q.c === 'hold' ? '흔들리던 방진이라 돌격을 꺾지 못하고 ' : ''}맞붙어 ${who(p.s)} ${ppl(p.sl ?? 0)}, ${who(q.s)} ${josa(ppl(q.sl ?? 0), '이', '가')} 쓰러졌다.`)
    } else {
      out.push(`${who(f0.s)} ${grp(f0.s, 'front')} ${josa(ppl(f0.n), '이', '가')} ${did(f0.c)} — ${who(opp(f0.s))} ${josa(ppl(f0.tl ?? 0), '이', '가')} 쓰러졌다.`)
    }
  }

  // 그 밖의 일 — 크게 잃게 한 차례로 (헛걸음·막힘도 이야기다)
  const rest = acts.filter((a) => a.g !== 'lead' && !(a.g === 'front' && a.tg === 'front') && a.c !== 'guard' && !(a.c === 'punch' && a.res === 'hit'))
    .filter((a) => (a.tl ?? 0) > 0 || a.res === 'blocked' || a.res === 'wasted' || a.res === 'fail')
    .sort((p, q) => (q.tl ?? 0) - (p.tl ?? 0))
  for (const a of rest) {
    if (out.length >= 3) break
    const x = a.s
    const y = opp(x)
    const me = `${who(x)} ${grp(x, a.g)} ${josa(ppl(a.n), '이', '가')}`
    const them = `${who(y)} ${grp(y, a.tg)}`
    const tl = ppl(a.tl ?? 0)
    if (a.c === 'charge') out.push(`${who(x)} 돌격이 그대로 ${them}까지 덮쳐 ${josa(tl, '이', '가')} 쓰러졌다.`)
    else if (a.c === 'punch') out.push(`${me} 앞줄 사이로 내달았으나 ${who(y)} 방진에 부딪혀 크게 다쳤다.`)
    else if (a.c === 'fire') out.push(a.res === 'fail'
      ? `${me} 불화살을 날렸으나 바람이 돌아 불길이 ${who(x)} 쪽으로 왔다.`
      : `${me} 불화살을 날렸다 — 불길이 ${who(y)} 진으로 번져 ${josa(tl, '이', '가')} 쓰러졌다.`)
    else if (a.res === 'wasted') out.push(a.c === 'pursue'
      ? `${me} 쫓으러 나섰으나 ${josa(who(y), '은', '는')} 아직 흔들리지 않았다 — 헛걸음이었다.`
      : `${me} 맞쏠 적 궁수가 없어 화살만 버렸다.`)
    else if (a.c === 'flank' && a.res === 'blocked') out.push(`${me} 옆으로 돌았으나 ${who(y)} 기병이 막아섰다 — 말끼리 맞붙어 ${who(y)} ${ppl(a.tl ?? 0)}, ${who(x)} ${josa(ppl(a.sl ?? 0), '이', '가')} 떨어졌다.`)
    else if (a.c === 'flank') out.push(`${me} 옆으로 돌아 ${them}의 옆구리를 쳤다 — ${them} ${josa(tl, '이', '가')} 쓰러졌다.`)
    else if (a.res === 'won') out.push(`${me} 서 있는 ${them} 위로 화살비를 퍼부었다 — 방패 벽 너머로 ${josa(tl, '이', '가')} 쓰러졌다.`)
    else out.push(`${me} ${did(a.c)} — ${them} ${josa(tl, '이', '가')} 쓰러졌다.`)
  }

  // 새로 흔들린 쪽
  for (const s of ['a', 'd'] as const) {
    const m = s === 'a' ? rd.ma : rd.md
    const was = prev === undefined ? c.m0[ix(s)] : s === 'a' ? prev.ma : prev.md
    const base = Math.max(0.05, c.m0[ix(s)])
    if (rd.ev !== 'capture-ok' && rd.ev !== 'retreat' && m / base < P.realm.tacHoldSteady && was / base >= P.realm.tacHoldSteady) out.push(`${who(s)} 진이 흔들린다 — 깃발이 기울고 대열이 성기다.`)
  }
  return out
}

/** 싸움이 끝난 까닭 — 진 쪽이 왜 무너졌나 (한 줄) */
export function endStory(l: Pick<Battle, 'outcome' | 'endWhy' | 'rounds'>, c: StoryCtx): string {
  const rds = l.rounds ?? []
  const last = rds[rds.length - 1]
  const atkLost = l.outcome === 'lose' || l.outcome === 'routed'
  let loser: 'a' | 'd' = atkLost ? 'a' : 'd'
  if (l.endWhy === 'retreat' && last?.by !== undefined) loser = last.by
  const w = opp(loser)
  const L = c.side[ix(loser)]
  const now = (s: 'a' | 'd'): number => Math.round(c.men0[ix(s)] * (last === undefined ? 1 : s === 'a' ? last.na : last.nd))
  switch (l.endWhy) {
    case 'captured': return `${josa(c.hero[ix(loser)] ?? `${L} 장수`, '이', '가')} 사로잡히자 ${L} 군사들은 이끌 사람을 잃고 흩어졌다.`
    case 'men': return `${L} 군사가 ${ppl(c.men0[ix(loser)])}에서 ${josa(ppl(now(loser)), '으로', '로')} 줄자 더 버티지 못하고 무너졌다.`
    case 'morale': {
      // 가장 크게 꺾인 무리
      const g0 = c.mix[ix(loser)]
      const ga = last === undefined ? undefined : loser === 'a' ? last.ga : last.gd
      let worst: Grp | null = null
      let wf = 1
      for (const g of ['front', 'bows', 'horse'] as const) {
        let n0 = 0
        for (const k of Object.keys(g0) as UnitKind[]) if (groupOf(k) === g) n0 += g0[k] ?? 0
        if (n0 <= 0 || ga?.[g] === undefined) continue
        const f = ga[g]! / n0
        if (f < wf) { wf = f; worst = g }
      }
      const g = worst !== null ? `${josa(groupLabel(g0, worst), '이', '가')} 꺾이자 ` : ''
      return `${L} ${g}기세가 무너져 군사들이 등을 보이고 달아났다.`
    }
    case 'retreat': return `${josa(L, '이', '가')} 더 잃기 전에 징을 쳐 물러났다.`
    case 'draw': return '어느 쪽도 무너지지 않아 날이 저물자 서로 물러났다.'
    default: return l.outcome === 'draw' ? '어느 쪽도 무너지지 않아 날이 저물자 서로 물러났다.' : `끝까지 맞붙은 끝에 ${c.side[ix(w)]} 쪽이 더 많이 남아 싸움터를 차지했다.`
  }
}

/**
 * 장수 능력치 여섯의 이름 (docs/realm/HEROES.md §1) — 두 글자로 (형: "한글자로 하지말고 두글자로. 한자 하나로는 이해하기 힘들다고").
 * 열쇠는 Hero 의 칸 이름 (tong · uiri 는 장수 첫판에서 더한다). 순서가 육각형의 꼭짓점 순서다.
 * 궁술은 뺐다 — 형: "장군 특성에 궁술?? 암살자를 보내야지 장군 지혼자 왜 가냐?" 활은 자객(공작 암살 · 명궁 특성)의 몫.
 */
export const STAT_NAME = {
  mu: '무예', tong: '통솔', ryak: '지략', chi: '내정', deok: '매력', uiri: '의리',
} as const

/** 공작 다섯 (plots.ts) — 화면의 이름 · 한 줄 · 먹혔을 때 보고 */
export const PLOT_NAME: Record<PlotOp, string> = {
  rumor: '소문', sow: '이간', bribe: '매수', burn: '방화', spy: '첩자', assassin: '암살',
}

export const PLOT_DOES: Record<PlotOp, string> = {
  rumor: '그 나라 진중에 흉흉한 소문을 퍼뜨려 군사들 기운을 꺾는다',
  sow: '두 나라 사이를 갈라놓는다. 화친이 깨지고, 전쟁이 붙기도 한다',
  bribe: '그 마을 장정들을 매수한다. 두 계절 동안 싸우러 나오지 않는다',
  burn: '그 나라 창고에 불을 놓아 곡식을 태운다',
  spy: '그 마을에 첩자를 심는다. 네 계절 동안 군세가 늘 보인다',
  assassin: '밤에 자객을 보내 적장을 쏜다. 맞히면 다치거나 죽는다. 들키면 자객이 잡힌다',
}

const PLOT_DONE: Record<PlotOp, (target: string, where: string, other: string) => string> = {
  rumor: (t) => `${t} 진중에 소문이 돌아 군사들 기운이 꺾였다.`,
  sow: (t, _w, o) => `${josa(t, '과', '와')} ${o} 사이가 틀어졌다.`,
  bribe: (_t, w) => `${w} 장정들이 두 계절 동안 나서지 않는다.`,
  burn: (t) => `${t} 창고가 불탔다.`,
  spy: (_t, w) => `${w}에 첩자를 심었다. 네 계절 동안 군세가 보인다.`,
  assassin: (t) => `${t} 진중에 자객의 화살이 날아들었다.`,
}

/**
 * 무장 단계의 이름 — 병종을 가리지 않는 말 (형: "쇠칼을 들려뽑는다? 이게 좀 말이안됨" — 궁수에게 쇠칼은 없다).
 * 병종마다의 이름은 GEAR_NAME. 철이 아니면 무엇으로 싸우나: 돌·나무·뼈, 그리고 청동.
 */
export const EQUIP_NAME: Record<Equip, string> = {
  stone: '돌·나무 무장', bronze: '청동 무장', ironTip: '쇠날 무장', iron: '온 쇠 무장', leather: '청동 무장', ringSword: '고리칼',
}

/** 단계의 짧은 이름 — 표의 머리 */
export const TIER_NAME: Record<Equip, string> = {
  stone: '돌·나무', bronze: '청동', ironTip: '쇠날', iron: '온 쇠', leather: '청동', ringSword: '고리칼',
}

/** 병종마다 단계마다 드는 것 — "쇠날 창" · "쇠촉 화살" · "쇠 테 방패" */
export const GEAR_NAME: Record<UnitKind, Record<Equip, string>> = {
  spear: { stone: '돌창', bronze: '청동창', ironTip: '쇠날 창', iron: '쇠창과 쇠비늘 갑옷', leather: '청동창', ringSword: '고리칼과 쇠비늘 갑옷' },
  bow: { stone: '뼈촉 화살', bronze: '청동촉 화살', ironTip: '쇠촉 화살', iron: '쇠촉 화살과 쇠비늘 갑옷', leather: '청동촉 화살', ringSword: '쇠촉 화살과 고리칼' },
  shield: { stone: '나무 방패', bronze: '청동 장식 방패와 가죽 갑옷', ironTip: '쇠 테 방패', iron: '쇠 테 방패와 쇠비늘 갑옷', leather: '청동 장식 방패와 가죽 갑옷', ringSword: '쇠 방패와 고리칼' },
  pike: { stone: '나무 긴창', bronze: '청동 긴창', ironTip: '쇠날 긴창', iron: '쇠 긴창과 쇠비늘 갑옷', leather: '청동 긴창', ringSword: '쇠 긴창과 고리칼' },
  horse: { stone: '나무 창과 맨 말', bronze: '청동창과 가죽 말갖춤', ironTip: '쇠날 창과 가죽 말갖춤', iron: '쇠창과 쇠 말갖춤', leather: '청동창과 가죽 말갖춤', ringSword: '고리칼과 쇠 말갖춤' },
  crossbow: { stone: '나무 쇠뇌', bronze: '청동 방아쇠 쇠뇌', ironTip: '쇠촉 쇠뇌', iron: '쇠촉 쇠뇌와 쇠비늘 갑옷', leather: '청동 방아쇠 쇠뇌', ringSword: '쇠촉 쇠뇌와 고리칼' },
  boat: { stone: '돌창과 나무배', bronze: '청동창과 나무배', ironTip: '쇠날 창과 나무배', iron: '쇠창과 쇠 박은 배', leather: '청동창과 나무배', ringSword: '고리칼과 쇠 박은 배' },
}

/**
 * 고을이 지금의 어디쯤인가 (형: "뭔뭔읍락 진짜 어딘지 감도 안옴. 차라리 현재 지명 비슷하게") — 지도 이름 밑과 고을 판에 작게.
 * 나라 자리는 우리 역사책과 학설(가락=김해 · 아라=함안 · 추화=밀양 · 고자=고성 · 거칠산=동래 · 골포=마산), 마을은 길로 이어진 모양에 맞춘 짐작이다.
 * 판의 데이터(RNode)가 아니라 여기 두어 옛 판에도 보인다.
 */
export const NODE_NOW: Readonly<Record<string, string>> = {
  'our-cap': '창원 마산', 'our-north': '창원 북면', 'our-east': '창원 동읍',
  'guya-cap': '김해', 'guya-iron': '양산 물금', 'guya-vil': '김해 진영',
  'anya-cap': '함안', 'anya-fort': '의령', 'anya-vil': '함안 군북',
  'miri-cap': '밀양', 'miri-vil': '밀양 삼랑진',
  'goja-cap': '고성', 'goja-vil': '통영',
  'dokro-cap': '부산 동래',
  sodo: '창녕',
  'wild-galmae': '함안 여항산', 'wild-beodeul': '남강 어귀', 'wild-gomgol': '양산 원동', 'wild-neoreun': '김해 대저',
  'wild-seobu': '마산 진동', 'wild-keunseom': '거제', 'wild-dolseom': '가덕도',
  // 영남 판 (data/regions/yeongnam.ts — 고을 자리는 실제 경위도)
  'y-saro-cap': '경주', 'y-saro-fort': '경주 토함산', 'y-saro-port': '경주 감포',
  'y-eumjeup-cap': '경주 안강', 'y-eumjeup-port': '포항',
  'y-usisan-cap': '울산', 'y-usisan-iron': '울산 달천',
  'y-dokro-cap': '부산 동래', 'y-dokro-v': '부산 기장',
  'y-guya-cap': '김해', 'y-guya-iron': '양산 물금', 'y-guya-v': '김해 진영',
  'y-us-cap': '창원 마산', 'y-us-v': '창원 동읍',
  'y-anya-cap': '함안', 'y-anya-fort': '의령',
  'y-goja-cap': '고성', 'y-goja-v': '통영',
  'y-samul-cap': '사천',
  'y-miri-cap': '밀양', 'y-miri-v': '밀양 삼랑진',
  'y-bihwa-cap': '창녕', 'y-chopal-cap': '합천 초계', 'y-iseo-cap': '청도', 'y-apdok-cap': '경산',
  'y-dabeol-cap': '대구', 'y-dabeol-v': '대구 팔공산', 'y-golbeol-cap': '영천',
  'y-daegaya-cap': '고령', 'y-daegaya-iron': '합천 야로', 'y-byeokjin-cap': '성주',
  'y-gammun-cap': '김천', 'y-sabeol-cap': '상주', 'y-sabeol-v': '상주 낙동', 'y-jomun-cap': '의성',
  'y-sodo-east': '청도 가지산', 'y-sodo-west': '합천 가야산',
  'y-w-geochang': '거창', 'y-w-jinju': '진주', 'y-w-sancheong': '산청', 'y-w-neoreun': '부산 강서',
  'y-w-gomgol': '양산 원동', 'y-w-gunwi': '군위', 'y-w-uiseong': '의성 단밀', 'y-w-cheongsong': '청송',
  'y-w-yeongdeok': '영덕', 'y-w-geoje': '거제', 'y-w-namhae': '남해',
  // 삼한 남부 판 (data/regions/south.ts)
  'm-baekje-cap': '서울 송파·하남', 'm-baekje-v': '서울 한강', 'm-michuhol-cap': '인천', 'n-maek-cap': '춘천',
  'm-mokji-cap': '천안 직산', 'm-mokji-v': '아산', 'm-ungcheon-cap': '공주', 'm-sangdang-cap': '청주', 'm-sangdang-iron': '충주',
  'm-sodo': '논산', 'm-geonma-cap': '익산', 'm-geonma-port': '군산', 'm-wansan-cap': '전주', 'm-gosaburi-cap': '정읍 고부',
  'm-balla-cap': '나주', 'm-balla-port': '목포', 'm-mujin-cap': '광주', 'm-gampyeong-cap': '순천', 'm-gampyeong-port': '여수',
  'm-goryong-cap': '남원', 'n-siljik-cap': '삼척', 'n-haseulla-cap': '강릉',
  'w-byeokgol': '김제', 'w-jinan': '진안', 'w-haenam': '해남', 'w-yeonggwang': '영광', 'w-seosan': '서산', 'w-hongseong': '홍성',
  'w-wonju': '원주', 'w-pyeongchang': '평창', 'w-uljin': '울진', 'w-yeongju': '영주',
}

/** 발견의 말 — 보는 나라가 그 나라를 어떻게 알게 됐나 (discovery.ts · 형: "발견국가가 많아지면 확장") */
const DISCOVER_LINE: Readonly<Record<DiscoverHow, (n: string) => string>> = {
  border: (n) => `땅이 맞닿아 ${josa(n, '을', '를')} 알게 됐다.`,
  envoy: (n) => `사신이 오가며 ${josa(n, '을', '를')} 알게 됐다.`,
  market: (n) => `장터에서 ${n} 사람들을 만났다.`,
  war: (n) => `싸움터에서 ${josa(n, '을', '를')} 처음 마주쳤다.`,
  spy: (n) => `첩자가 ${n} 이야기를 듣고 왔다.`,
  scout: (n) => `척후가 ${n} 땅을 보고 왔다.`,
  ally: (n) => `동맹이 ${n} 이야기를 전해 줬다.`,
  rumor: (n) => `상인에게서 ${n} 이야기를 들었다. 지도에 새 땅이 펼쳐진다.`,
}

/** 자객의 활 단계 (plots.assassinBow · 밤 판 bow=) — 0 단궁 · 1 맥궁 · 2 각궁 · 3 신궁 */
export const BOW_NAME: readonly string[] = ['단궁', '맥궁', '각궁', '신궁']

/**
 * 기습 길의 까닭 (season.concealOf — 형이 고름: "길과 때의 싸움"). 지도·칠 곳 고르기에 한 줄씩.
 * 좋게 하는 것과 나쁘게 하는 것이 섞인다 — 말이 곧 까닭이다.
 */
export const CONCEAL_LINE: Readonly<Record<ConcealWhy, string>> = {
  forest: '숲이 우거져 몸을 숨기기 좋다',
  reeds: '갈대가 사람 키를 넘는다',
  reedsWinter: '겨울이라 갈대가 누웠다',
  field: '트인 들길이라 멀리서 보인다',
  pass: '외길 고개라 지키는 눈이 몰려 있다',
  ford: '나루는 건너는 동안 훤히 보인다',
  sea: '돛이 멀리서 보인다',
  mudflat: '갯벌은 숨을 데가 없다',
  edgeTag: '길가에 숨을 데가 많다',
  fog: '안개가 낀다',
  ice: '강이 얼어 지키는 쪽이 방심한다',
  winterNight: '겨울밤이 길다',
  bigArmy: '무리가 커서 눈에 띈다',
  smallArmy: '무리가 작아 숨기 쉽다',
}
