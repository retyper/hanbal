/**
 * 직접 지휘하는 싸움 — 전투 2판: 세 무리를 깃발마다 따로 부린다 (docs/realm/BATTLE.md §전투 2판 · 형 2026-10-19:
 * "포켓몬이나 가위바위보식 상성 · 포획시도는 유저가 직접 · 열세여도 잘 판단하면 이기고 우세여도 잘못 판단하면 진다" ·
 * "어떤 군대가 창병움직이면 다른애들 가만있냐. 각자 행동 컨트롤 되어야 하는거 아냐?" · "기병컨트롤은 방법이없나?")
 *
 * 군대는 세 무리 — 앞줄(창·방패·긴창 · 물 위의 배) · 활(궁수·쇠뇌) · 말(기병). 전체의 tacGroupMin 넘게 있어야 깃발을 따로 든다.
 * 한 합에 무리마다 명령 하나 + 장수의 명령 하나 (결정은 넷을 넘지 않는다). 두 쪽은 **동시에** 낸다.
 *   앞줄: 돌격 · 방진 · 길 트기(앞줄을 벌려 활에 길을 연다) — 앞줄의 세모: 방진 > 돌격 > 길 트기 > 방진.
 *         흔들리는 방진은 돌격을 못 받아 낸다. 땅의 수(그 자리에서만 한 번): 여울 막기 · 바위 굴리기 · 성문 깨기 · 배 들이받기
 *   활:   화살비(적 앞줄을 쏜다 — 서 있는 방진에 잘 박힌다: 화살비 > 방진) · 맞쏘기(적 활을 쏘아 그 화살비를 꺾는다) · 불화살 · 높은 곳
 *   말:   옆치기(적 활을, 없으면 앞줄 옆구리를) · 돌파(앞줄과 함께 들이친다 — 방진에 부딪히면 크게 다친다) · 추격(흔들리는 적만) · 호위(장수를 지킨다)
 *   장수: 북을 친다 · 장수 겨루기 · 적장 사로잡기(날랜 무리 ÷ 적장 곁 호위) · 물러나기
 *   세모의 셋째 변 — 돌격이 막히지 않으면 적 궁수까지 덮친다 (돌격 > 화살비).
 * 합은 tacRoundsMin ~ tacRoundsMax. 셋째 합 뒤에도 팽팽하면 더 간다. 한쪽이 무너지면 일찍 끝난다.
 * 손실은 무리마다 따로 — 적 궁수를 치면 적 화살비가 약해진다. 끝의 남은 전투력 몫으로 결과 다섯 칸.
 *
 * 전부 순수 함수다. 굴림은 이름이 있다 (core/rng.ts roll) — `${key}:t${i}:…`. 같은 판 같은 명령이면 같은 결과다 (A1).
 * 플레이어 쪽 명령은 Tactic 으로 들어온다. 빠진 무리·모자란 합은 맡긴다 — 같은 AI 가 고른다 (봇 시뮬도 이 길이다).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import type { Outcome, UnitKind } from './battle.ts'
import type { Act, Cmd, EndWhy, Grp, Pending, RoundLog, RoundOrder, Tactic } from './types.ts'

/** 땅이 주는 한 번짜리 수 — season 이 그 싸움 자리를 보고 정한다 */
export interface Terrain {
  /** 강을 건너오는 적을 여울에서 막는다 (지키는 쪽 · 나루·갈대 물가) */
  readonly ford?: boolean
  /** 고개·산성·높은 터에서 바위를 굴린다 (지키는 쪽) */
  readonly rocks?: boolean
  /** 성벽·목책 앞 — 성문을 깬다 (치는 쪽) */
  readonly gate?: boolean
  /** 물 위 — 배로 들이받는다 (수군이 있는 쪽) */
  readonly ram?: boolean
  /** 높은 곳을 차지한다 (고개·숲·산성 · 산기슭으로 돌아온 쪽) */
  readonly height?: boolean
}

/** 한쪽의 싸움 입력 */
export interface Side {
  /** 처음 전투력 (자리·상성·진군 방식까지 곱한 값) */
  readonly F: number
  readonly mix: Readonly<Partial<Record<UnitKind, number>>>
  /** 처음 사기 — F 에 이미 들어 있다. 라운드의 사기는 이것에 대한 비로 F 를 흔든다 */
  readonly morale: number
  /** 싸움 앞의 사기 덤·감 (대로로 질서 있게 · 절벽에서 적이 뒤에 나타났다 …) */
  readonly moraleBonus?: number
  readonly hero: { readonly id: string; readonly mu: number; readonly ryak: number; readonly coward: boolean } | null
  /** 군량이 바닥이다 — 라운드마다 사기가 꺾인다 */
  readonly hungry: boolean
  /** 이 싸움에서 쓸 수 있는 한 번짜리 명령 (불화살 fire) — 그 밖의 땅의 수는 terrain */
  readonly specials: readonly Cmd[]
  readonly terrain?: Terrain
  /** 물 위 싸움 — 수군이 앞줄에 선다 */
  readonly water: boolean
  /** 플레이어 쪽인가 — Tactic 이 이쪽에 걸린다 */
  readonly player: boolean
  /** 상대를 보고 있나 (이번 계절 정찰·첩자 · 지키는 쪽은 다가오는 것을 봤다) — 낌새가 잘 맞는다 */
  readonly seen: boolean
  /** 상대 장수와 겨뤄 본 적이 있다 — 그 버릇(즐겨 내는 명령)을 안다 */
  readonly knowsFoe?: boolean
  /** 사로잡기 가산 (저격 발 묶음 …) */
  readonly captureBonus?: number
  /** 배우는 판 — sure 면 이쪽 사로잡기는 반드시 되고, never 면 아예 못 한다 */
  readonly capture?: 'sure' | 'never'
}

export interface FightResult {
  readonly outcome: Outcome
  /** 처음 사람에 대한 남은 몫 0~1 — 부른 쪽이 군대에 곱한다 */
  readonly na: number
  readonly nd: number
  /** 무리마다 남은 몫 0~1 — 부른 쪽이 병종마다 곱한다 (궁수를 잃었으면 궁수가 준다) */
  readonly ga: Readonly<Record<Grp, number>>
  readonly gd: Readonly<Record<Grp, number>>
  /** 사기 변화 (끝 - 처음) — 부른 쪽이 군대 사기에 더한다 */
  readonly dma: number
  readonly dmd: number
  /** 사로잡힌 쪽 (그 쪽 장수가 잡혔다) */
  readonly captured: 'a' | 'd' | null
  /** 무너진 쪽 — 그 쪽 장수가 난전에 쓰러질 수 있다 */
  readonly broke: 'a' | 'd' | null
  /** 장수 겨루기에서 진 장수 — 쓰러졌나 다쳤나 */
  readonly duel: { readonly loser: 'a' | 'd'; readonly kill: boolean } | null
  readonly rounds: readonly RoundLog[]
  readonly pending?: Pending
  /** 플레이어가 명령을 하나라도 냈나 */
  readonly led: boolean
  /** 끝난 까닭 */
  readonly endWhy: EndWhy
}

export const GRPS: readonly Grp[] = ['front', 'bows', 'horse']
/** 앞줄의 두 기본 명령 — 세모의 한 변 */
export const BASIC: readonly Cmd[] = ['charge', 'volley', 'hold']
/** 세모 — 열쇠가 값을 이긴다 (돌격 > 화살비 > 방진 > 돌격) */
export const BEATS: Readonly<Partial<Record<Cmd, Cmd>>> = { charge: 'volley', volley: 'hold', hold: 'charge' }
/** 값을 이기는 명령 */
export const COUNTER: Readonly<Partial<Record<Cmd, Cmd>>> = { volley: 'charge', hold: 'volley', charge: 'hold' }

/** 앞줄 명령 가운데 버티는 것 · 들이치는 것 */
const HOLDS: ReadonlySet<Cmd> = new Set(['hold', 'ford', 'rocks'])
const CHARGES: ReadonlySet<Cmd> = new Set(['charge', 'gate', 'ram'])
/** 한 번만 쓰는 명령 */
const ONCE: ReadonlySet<Cmd> = new Set(['ford', 'rocks', 'gate', 'ram', 'fire', 'height', 'duel'])

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/** 두 세기의 몫 — a^k / (a^k + d^k). 라운드마다 쌓이니 한 번 굴림의 battleK 보다 무르게 (tacK) */
export function edgeOf(a: number, d: number): number {
  const k = P.realm.tacK
  const x = Math.pow(Math.max(0, a), k)
  const y = Math.pow(Math.max(0, d), k)
  return x + y === 0 ? 0.5 : x / (x + y)
}

/** 병종 → 무리. 배는 앞줄 (물 위에서는 들이받고, 뭍에서는 내려 싸운다) */
export function groupOf(k: UnitKind): Grp {
  if (k === 'bow' || k === 'crossbow') return 'bows'
  if (k === 'horse') return 'horse'
  return 'front'
}

/** 무리마다 사람 수 */
export function groupMen(mix: Readonly<Partial<Record<UnitKind, number>>>): Record<Grp, number> {
  const out: Record<Grp, number> = { front: 0, bows: 0, horse: 0 }
  for (const [k, v] of Object.entries(mix) as Array<[UnitKind, number]>) out[groupOf(k)] += v ?? 0
  return out
}

/** 깃발을 따로 드는 무리 — 전체의 tacGroupMin 넘게 (아니면 가까운 무리에 섞여 싸운다) */
export function groupsOf(mix: Readonly<Partial<Record<UnitKind, number>>>): Grp[] {
  const g = groupMen(mix)
  const n = g.front + g.bows + g.horse
  if (n <= 0) return []
  const min = Math.max(3, n * P.realm.tacGroupMin)
  const out = GRPS.filter((x) => g[x] >= min)
  return out.length > 0 ? out : [GRPS.reduce((b, x) => (g[x] > g[b] ? x : b), 'front' as Grp)]
}

/** 병종 몫 — 돌격 · 화살비 · 방진에 맞는 사람의 몫 (옛 한 줄 세기 — AI 의 짐작에 쓴다) */
export function shares(mix: Readonly<Partial<Record<UnitKind, number>>>, water: boolean): { charge: number; volley: number; hold: number } {
  let n = 0
  for (const v of Object.values(mix)) n += v ?? 0
  if (n <= 0) return { charge: 0, volley: 0, hold: 0 }
  const g = (k: UnitKind): number => mix[k] ?? 0
  const boat = water ? g('boat') : 0
  return {
    charge: (g('spear') + g('horse') + g('pike') * 0.5 + boat * 0.5) / n,
    volley: (g('bow') + g('crossbow') + boat * 0.5) / n,
    hold: (g('shield') + g('pike') * 0.5) / n,
  }
}

/** 명령 하나가 그 군대에 맞는 세기 — 병종 구성으로 (0.5~1.7 쯤). 화면·AI 의 짐작 */
export function might(side: Pick<Side, 'mix' | 'water'>, cmd: Cmd): number {
  const R = P.realm
  const s = shares(side.mix, side.water)
  const base = (x: number): number => R.tacShareBase + R.tacShareGain * x
  switch (cmd) {
    case 'charge': case 'gate': case 'ram': return base(s.charge) * R.tacChargeMul
    case 'volley': case 'counter': case 'height': return base(s.volley)
    case 'hold': case 'ford': case 'rocks': return base(s.hold) * R.tacHoldMul
    case 'flank': case 'punch': case 'pursue': return base(s.charge) * R.tacFlankMul
    default: return 1
  }
}

/** 앞줄 안의 몫 — 돌격은 창이, 방진은 방패가 받친다 */
function frontQ(side: Side, cmd: Cmd): number {
  const m = side.mix
  const g = (k: UnitKind): number => m[k] ?? 0
  const boat = g('boat')
  const front = g('spear') + g('shield') + g('pike') + boat
  if (front <= 0) return 1
  if (CHARGES.has(cmd)) return 0.6 + 0.8 * (g('spear') + g('pike') * 0.5 + boat * (side.water ? 0.8 : 0.3)) / front
  return 0.6 + 0.8 * (g('shield') + g('pike') * 0.5 + boat * 0.2) / front
}

interface State {
  /** 무리마다 남은 몫 */
  fa: Record<Grp, number>
  fd: Record<Grp, number>
  ma: number
  md: number
  usedA: Set<Cmd>
  usedD: Set<Cmd>
  /** 장수 겨루기로 장수를 잃은 쪽 */
  lostA: boolean
  lostD: boolean
  /** 장수 겨루기로 다친 장수 — 사로잡기가 쉽다 */
  hurtA: boolean
  hurtD: boolean
}

interface Ctx {
  readonly atk: Side
  readonly def: Side
  readonly g0a: Record<Grp, number>
  readonly g0d: Record<Grp, number>
  readonly n0a: number
  readonly n0d: number
}

const totalOf = (g: Record<Grp, number>): number => g.front + g.bows + g.horse
/** 남은 사람 — 무리마다 */
const menNow = (g0: Record<Grp, number>, f: Record<Grp, number>, g: Grp): number => g0[g] * f[g]
/** 남은 몫 — 전체 사람 */
function aliveShare(g0: Record<Grp, number>, f: Record<Grp, number>): number {
  const n0 = totalOf(g0)
  return n0 <= 0 ? 0 : GRPS.reduce((s, g) => s + g0[g] * f[g], 0) / n0
}

/** 남은 전투력 — 처음 F × 남은 사람 × 사기의 비 × 장수를 잃었으면 */
function live(s: Side, n: number, m: number, lost: boolean): number {
  return s.F * n * (m / Math.max(0.05, s.morale)) * (lost ? P.realm.tacDuelLeader : 1)
}

function shareOf(c: Ctx, st: State): number {
  return edgeOf(live(c.atk, aliveShare(c.g0a, st.fa), st.ma, st.lostA), live(c.def, aliveShare(c.g0d, st.fd), st.md, st.lostD))
}

/** 무리 하나의 세기 — 사람 하나 세기(처음 F ÷ 사람 · 사기) × 그 무리 사람 × 무리 배수 */
function groupPower(side: Side, g0: Record<Grp, number>, f: Record<Grp, number>, m: number, lost: boolean, g: Grp): number {
  const R = P.realm
  const n0 = totalOf(g0)
  if (n0 <= 0) return 0
  const per = (side.F / n0) * (m / Math.max(0.05, side.morale)) * (lost ? R.tacDuelLeader : 1)
  const mul = g === 'front' ? R.tacGrpFront : g === 'bows' ? R.tacGrpBows : R.tacGrpHorse
  return per * menNow(g0, f, g) * mul
}

/**
 * 사로잡기 — 날랜 무리를 적장 곁 호위와 견준다 (형: "28명과 570명이었는데 이게 가능한가?? 한방에??").
 *   날랜 무리 = 우리 사람 × tacCapSquad (+ 말 × tacCapSquadHorse)
 *   호위 = 적 사람 × tacCapEscort × 적 사기의 비 (적 말이 호위하면 × tacCapGuardMul · 적장이 다쳤으면 반)
 *   확률 = tacCapK × (날랜 무리 ÷ 호위)^tacCapExp + 적이 무너질 지경 + 무예 차이 + 저격 덤 → [tacCapMin, captureMax]
 * 적은 수로 큰 무리 속 장수는 거의 못 잡는다. 적이 줄고 흔들리고 다쳤을수록 잘 된다. 겁 많은 장수는 먼저 달아난다.
 */
export function captureOdds(
  me: Side, foe: Side, myMen: number, myHorse: number, foeMen: number, foeM: number, foeHurt: boolean, foeGuard: boolean,
): { p: number; squad: number; escort: number } {
  const R = P.realm
  const squad = Math.max(0, Math.round(myMen * R.tacCapSquad + myHorse * R.tacCapSquadHorse))
  const mr = clamp(foeM / Math.max(0.05, foe.morale), 0.15, 1.2)
  const escort = Math.max(1, Math.round(foeMen * R.tacCapEscort * mr * (foeGuard ? R.tacCapGuardMul : 1) * (foeHurt ? 0.5 : 1)))
  if (foe.hero === null || me.capture === 'never') return { p: 0, squad, escort }
  if (me.capture === 'sure') return { p: 1, squad, escort }
  let p = R.tacCapK * Math.pow(squad / escort, R.tacCapExp)
  // 무너질 지경이면 호위가 흩어진다 — 그래도 날랜 무리가 호위에 견줄 만해야 덕을 본다 (세 사람으로 오백 명 속 장수는 못 잡는다)
  if (mr < R.tacBreakMorale + 0.1) p += R.tacCapBroken * Math.min(1, (2 * squad) / escort)
  p += R.tacCapPerMu * ((me.hero?.mu ?? 3) - foe.hero.mu)
  p += me.captureBonus ?? 0
  if (foe.hero.coward) p *= 0.5
  if (squad < 3) p = 0
  return { p: clamp(p, squad < 3 ? 0 : R.tacCapMin * Math.min(1, squad / escort), R.captureMax), squad, escort }
}

/**
 * 옛 꼴의 사로잡기 확률 — myN · foeN 은 처음 사람의 몫, foeM 은 적 사기 (시험·화면이 부른다).
 * 무리 없이 짐작할 때는 말이 없다고 친다.
 */
export function captureChance(me: Side, foe: Side, myN: number, foeN: number, foeM: number, _edge: number, foeHurt: boolean, foeGuard = false): number {
  const gm = groupMen(me.mix)
  const n0m = totalOf(gm)
  const n0f = totalOf(groupMen(foe.mix))
  return captureOdds(me, foe, n0m * myN, gm.horse * myN, n0f * foeN, foeM, foeHurt, foeGuard).p
}

/** 무리 하나가 이번 합에 고를 수 있는 명령 */
export function groupOptions(me: Side, foe: Side, g: Grp, used: ReadonlySet<Cmd>): Cmd[] {
  const t = me.terrain ?? {}
  const once = (c: Cmd, ok: boolean | undefined): Cmd[] => (ok === true && !used.has(c) ? [c] : [])
  const foeG = groupsOf(foe.mix)
  switch (g) {
    case 'front': return ['charge', 'hold', ...(groupsOf(me.mix).includes('bows') ? ['open' as Cmd] : []), ...once('ford', t.ford), ...once('rocks', t.rocks), ...once('gate', t.gate), ...once('ram', t.ram)]
    case 'bows': return ['volley', ...(foeG.includes('bows') ? ['counter' as Cmd] : []), ...once('fire', me.specials.includes('fire')), ...once('height', t.height)]
    case 'horse': return ['flank', 'punch', 'pursue', 'guard']
  }
}

/** 장수의 명령 */
export function leadOptions(me: Side, foe: Side, used: ReadonlySet<Cmd>, foeHeroGone: boolean): Cmd[] {
  const out: Cmd[] = ['drum']
  if (me.hero !== null && foe.hero !== null && !foeHeroGone && me.hero.mu >= P.realm.tacDuelMu && !used.has('duel')) out.push('duel')
  if (foe.hero !== null && !foeHeroGone && me.capture !== 'never') out.push('capture')
  out.push('retreat')
  return out
}

/** 이 라운드에 고를 수 있는 명령 전부 (옛 꼴 — 시험이 쓴다) */
export function optionsOf(me: Side, foe: Side, used: ReadonlySet<Cmd>, foeHeroGone: boolean): Cmd[] {
  const out: Cmd[] = []
  for (const g of groupsOf(me.mix)) for (const c of groupOptions(me, foe, g, used)) if (!out.includes(c)) out.push(c)
  for (const c of leadOptions(me, foe, used, foeHeroGone)) if (!out.includes(c)) out.push(c)
  return out
}

/** 옛 판의 명령 한 개 → 무리별 명령 (그 명령을 맞는 무리에 건다) */
export function asOrder(x: Cmd | RoundOrder): RoundOrder {
  if (typeof x !== 'string') return x
  switch (x) {
    case 'charge': case 'gate': case 'ram': return { front: x, horse: 'punch' }
    case 'hold': case 'ford': case 'rocks': return { front: x }
    case 'volley': case 'counter': case 'fire': case 'height': return { bows: x, front: 'open' }
    case 'open': return { front: 'open', bows: 'volley' }
    case 'flank': case 'punch': case 'pursue': case 'guard': return { horse: x }
    default: return { lead: x }
  }
}

/** 적 앞줄이 즐겨 낼 명령 — 그 앞줄의 생김새로 (창이 많으면 돌격, 방패가 많으면 방진) */
function frontHabit(foe: Side): Cmd {
  const g = groupMen(foe.mix)
  const n = totalOf(g)
  if (n > 0 && g.bows / n >= 0.35) return 'open'
  return frontQ(foe, 'charge') >= frontQ(foe, 'hold') ? 'charge' : 'hold'
}

/**
 * 맡긴 쪽의 명령 — 제 처지와 상대 구성만 보고 (상대의 이번 선택은 모른다). 무리마다 따로 정한다.
 */
function aiOrder(c: Ctx, me: Side, foe: Side, mine: 'a' | 'd', st: State, cap: number, edge: number, key: string, seed: number, season: number, lastFoe?: Cmd): RoundOrder {
  const R = P.realm
  const r = (k: string): number => roll(seed, season, `${key}:${k}`)
  const used = mine === 'a' ? st.usedA : st.usedD
  const fMe = mine === 'a' ? st.fa : st.fd
  const g0Me = mine === 'a' ? c.g0a : c.g0d
  const g0Foe = mine === 'a' ? c.g0d : c.g0a
  const fFoe = mine === 'a' ? st.fd : st.fa
  const myN = aliveShare(g0Me, fMe)
  const foeM = mine === 'a' ? st.md : st.ma
  const foeRatio = foeM / Math.max(0.05, foe.morale)
  const groups = groupsOf(me.mix)
  const foeGroups = groupsOf(foe.mix)
  const ryak = me.hero?.ryak ?? 3
  const atk = mine === 'a'
  // 장수
  let lead: Cmd = 'drum'
  const lopts = leadOptions(me, foe, used, false)
  const coward = me.hero?.coward === true
  if (lopts.includes('capture') && cap >= R.tacAiCapture) lead = 'capture'
  else if (atk && edge < (coward ? 0.35 : 0.22) && myN < 0.75) lead = 'retreat'
  else if (!atk && edge < 0.12 && myN < 0.5) lead = 'retreat'
  else if (lopts.includes('duel') && me.hero !== null && foe.hero !== null && me.hero.mu >= foe.hero.mu + 1 && r('duel') < 0.4) lead = 'duel'
  const out: { front?: Cmd; bows?: Cmd; horse?: Cmd; lead: Cmd } = { lead }
  if (groups.includes('front')) {
    const opts = groupOptions(me, foe, 'front', used)
    const terr = opts.find((x) => ONCE.has(x))
    if (terr !== undefined && r('terr') < 0.6) out.front = terr
    else if (foeRatio < R.tacHoldSteady && r('break') < 0.5 + 0.05 * (ryak - 5)) out.front = 'charge' // 흔들리는 적 — 들이칠 때다
    else {
      // 적 앞줄의 버릇을 읽고 그 맞수를 — 지략만큼. 치러 온 쪽은 버티기만 해서는 고을을 못 얻는다
      // 지난 합에 적 앞줄이 한 것을 기억한다 — 같은 수를 되풀이하는 적은 읽힌다
      const basicOf = (x: Cmd): Cmd => (HOLDS.has(x) ? 'hold' : CHARGES.has(x) ? 'charge' : x)
      const foeLikely = !foeGroups.includes('front') ? 'charge' : lastFoe !== undefined && r('memory') < 0.7 ? basicOf(lastFoe) : frontHabit(foe)
      const pCounter = clamp(R.tacAiCounter + 0.05 * (ryak - 5), 0.1, 0.9)
      const canOpen = groupsOf(me.mix).includes('bows')
      if (r('counter') < pCounter) {
        if (foeLikely === 'charge') out.front = 'hold'
        else if (foeLikely === 'open') out.front = 'charge'
        else out.front = canOpen ? 'open' : 'hold'
      } else {
        const wc = Math.pow(frontQ(me, 'charge') * R.tacChargeMul, 3) * (atk ? 1.3 : 1)
        const wh = Math.pow(frontQ(me, 'hold') * R.tacHoldMul, 3)
        const wo = canOpen ? Math.pow(0.6 + 0.8 * groupMen(me.mix).bows / Math.max(1, totalOf(groupMen(me.mix))), 3) : 0
        const x = r('front') * (wc + wh + wo)
        out.front = x < wc ? 'charge' : x < wc + wh ? 'hold' : 'open'
      }
    }
  }
  if (groups.includes('bows')) {
    const opts = groupOptions(me, foe, 'bows', used)
    if (opts.includes('fire') && r('fire') < 0.55) out.bows = 'fire'
    else if (opts.includes('height') && r('height') < 0.6) out.bows = 'height'
    else if (opts.includes('counter') && menNow(g0Foe, fFoe, 'bows') >= menNow(g0Me, fMe, 'bows') * 0.8 && r('counter-b') < 0.4) out.bows = 'counter'
    else out.bows = 'volley'
  }
  if (groups.includes('horse')) {
    if (foeRatio < R.tacPursueMorale) out.horse = 'pursue'
    else if (lead === 'retreat' || (foe.hero !== null && me.hero !== null && cap < 0.05 && r('guard') < 0.25)) out.horse = 'guard'
    else if (foeGroups.includes('bows') && r('flank') < 0.6) out.horse = 'flank'
    else out.horse = out.front === 'charge' ? 'punch' : 'flank'
  }
  return out
}

/** 낌새를 Pending 칸으로 */
const hintFields = (h: { cmd: Cmd; src: 'saw' | 'habit' } | null): { hint: Cmd | null; hintSrc?: 'saw' | 'habit' } => (h === null ? { hint: null } : { hint: h.cmd, hintSrc: h.src })

/**
 * 적진의 낌새 — 적 앞줄의 다음 명령. 짐작이 아니라 **본 것 · 들은 것**에서만 (형: "적진의 낌새는 직접본거나 주변정보여야지 짐작이머냐"):
 *  - saw: 척후·첩자가 이번 계절 봤거나 눈앞에서 맞붙는다 — 거의 맞힌다 (지략이 높으면 더)
 *  - habit: 그 적장과 겨뤄 본 적이 있다 — 그 앞줄이 즐겨 내는 명령을 안다. 이번 합에 꼭 그러진 않는다
 */
function hintOf(me: Side, foe: Side, foeFront: Cmd | undefined, key: string, seed: number, season: number): { cmd: Cmd; src: 'saw' | 'habit' } | null {
  const R = P.realm
  if (foeFront === undefined) return null
  const basic = (x: Cmd): Cmd => (HOLDS.has(x) ? 'hold' : CHARGES.has(x) ? 'charge' : x)
  if (me.seen) {
    const acc = Math.min(0.95, R.tacHintScout + R.tacHintPerRyak * Math.max(0, (me.hero?.ryak ?? 1) - 5))
    if (roll(seed, season, `${key}:hint`) < acc) return { cmd: basic(foeFront), src: 'saw' }
    return { cmd: basic(foeFront) === 'charge' ? 'hold' : 'charge', src: 'saw' }
  }
  if (me.knowsFoe === true && foe.hero !== null) return { cmd: frontHabit(foe), src: 'habit' }
  return null
}

/** 무리별 명령을 다듬는다 — 없는 무리는 빼고, 못 고르는 명령이면 AI 것을 쓴다 */
function settle(me: Side, foe: Side, given: RoundOrder, ai: RoundOrder, used: ReadonlySet<Cmd>, foeHeroGone: boolean): Required<Pick<RoundOrder, 'lead'>> & RoundOrder {
  const out: { front?: Cmd; bows?: Cmd; horse?: Cmd; lead: Cmd } = { lead: 'drum' }
  for (const g of groupsOf(me.mix)) {
    const opts = groupOptions(me, foe, g, used)
    const want = given[g]
    out[g] = want !== undefined && opts.includes(want) ? want : (ai[g] ?? opts[0]!)
  }
  const lo = leadOptions(me, foe, used, foeHeroGone)
  out.lead = given.lead !== undefined && lo.includes(given.lead) ? given.lead : given.lead === undefined ? (ai.lead ?? 'drum') : 'drum'
  return out
}

/**
 * 한 판을 싸운다. `tactic` 은 플레이어 쪽(atk.player 또는 def.player)의 명령.
 * 굴림 열쇠는 `key` — season.battleKey 와 같은 값을 넣는다.
 */
export function fightRounds(atk: Side, def: Side, key: string, seed: number, season: number, tactic?: Tactic): FightResult {
  const R = P.realm
  const g0a = groupMen(atk.mix)
  const g0d = groupMen(def.mix)
  const c: Ctx = { atk, def, g0a, g0d, n0a: totalOf(g0a), n0d: totalOf(g0d) }
  const st: State = {
    fa: { front: 1, bows: 1, horse: 1 }, fd: { front: 1, bows: 1, horse: 1 },
    ma: atk.morale + (atk.moraleBonus ?? 0), md: def.morale + (def.moraleBonus ?? 0),
    usedA: new Set(), usedD: new Set(), lostA: false, lostD: false, hurtA: false, hurtD: false,
  }
  const rounds: RoundLog[] = []
  const memo: { pending?: Pending; led: boolean } = { led: false }
  let captured: 'a' | 'd' | null = null
  let broke: 'a' | 'd' | null = null
  let retreat: 'a' | 'd' | 'both' | null = null
  let duel: { loser: 'a' | 'd'; kill: boolean } | null = null
  let brokeBy: 'men' | 'morale' | null = null
  const rk = (i: number, k: string): number => roll(seed, season, `${key}:t${i}:${k}`)
  const max = Math.max(1, Math.round(R.tacRoundsMax))
  const min = Math.min(max, Math.max(1, Math.round(R.tacRoundsMin)))
  const small = c.n0a + c.n0d < R.tacSmallBattle

  for (let i = 0; i < max; i++) {
    // 셋째 합 뒤로는 팽팽할 때만 더 간다
    if (i >= min) {
      const s = shareOf(c, st)
      if (small || Math.abs(s - 0.5) >= R.tacExtendBand) break
    }
    const edge = shareOf(c, st)
    const goneD = st.lostD && duel?.kill === true && duel.loser === 'd'
    const goneA = st.lostA && duel?.kill === true && duel.loser === 'a'
    const capOf = (mine: 'a' | 'd', guard: boolean): { p: number; squad: number; escort: number } => {
      const me = mine === 'a' ? atk : def
      const foe = mine === 'a' ? def : atk
      const g0m = mine === 'a' ? g0a : g0d
      const fm = mine === 'a' ? st.fa : st.fd
      const g0f = mine === 'a' ? g0d : g0a
      const ff = mine === 'a' ? st.fd : st.fa
      const gone = mine === 'a' ? goneD : goneA
      if (gone) return { p: 0, squad: 0, escort: 0 }
      const myMen = GRPS.reduce((s, g) => s + menNow(g0m, fm, g), 0)
      const foeMen = GRPS.reduce((s, g) => s + menNow(g0f, ff, g), 0)
      return captureOdds(me, foe, myMen, menNow(g0m, fm, 'horse'), foeMen, mine === 'a' ? st.md : st.ma, mine === 'a' ? st.hurtD : st.hurtA, guard)
    }
    // 낌새·AI 는 호위를 모르고 본다 (적의 이번 선택은 모른다)
    const capA0 = capOf('a', false)
    const capD0 = capOf('d', false)
    const prev = rounds[rounds.length - 1]
    const aiA = aiOrder(c, atk, def, 'a', st, capA0.p, edge, `${key}:t${i}:a`, seed, season, prev?.od?.front)
    const aiD = aiOrder(c, def, atk, 'd', st, capD0.p, 1 - edge, `${key}:t${i}:d`, seed, season, prev?.oa?.front)
    const pick = (me: Side, foe: Side, mine: 'a' | 'd', ai: RoundOrder, foeAi: RoundOrder, cap: { p: number; squad: number; escort: number }): RoundOrder => {
      const used = mine === 'a' ? st.usedA : st.usedD
      const gone = mine === 'a' ? goneD : goneA
      if (!me.player || tactic === undefined) return settle(me, foe, {}, ai, used, gone)
      const x = tactic.cmds[i]
      if (x !== undefined) {
        memo.led = true
        return settle(me, foe, asOrder(x), ai, used, gone)
      }
      if (tactic.open === true && memo.pending === undefined) {
        const g0m = mine === 'a' ? g0a : g0d
        const fm = mine === 'a' ? st.fa : st.fd
        const g0f = mine === 'a' ? g0d : g0a
        const ff = mine === 'a' ? st.fd : st.fa
        const foeNow: Partial<Record<Grp, number>> = {}
        for (const g of groupsOf(foe.mix)) foeNow[g] = Math.round(menNow(g0f, ff, g))
        memo.pending = {
          round: i,
          groups: groupsOf(me.mix).map((g) => ({ g, men: Math.round(menNow(g0m, fm, g)), options: groupOptions(me, foe, g, used) })),
          lead: leadOptions(me, foe, used, gone),
          foe: foeNow,
          foeWaver: (mine === 'a' ? st.md / Math.max(0.05, def.morale) : st.ma / Math.max(0.05, atk.morale)) < P.realm.tacHoldSteady,
          capture: cap.p, squad: cap.squad, escort: cap.escort,
          ...hintFields(hintOf(me, foe, foeAi.front, `${key}:t${i}`, seed, season)),
          weAtk: mine === 'a', seen: me.seen,
        }
      }
      return settle(me, foe, {}, ai, used, gone)
    }
    const oa = pick(atk, def, 'a', aiA, aiD, capA0) as RoundOrder & { lead: Cmd }
    const od = pick(def, atk, 'd', aiD, aiA, capD0) as RoundOrder & { lead: Cmd }
    for (const [o, used] of [[oa, st.usedA], [od, st.usedD]] as const) {
      for (const x of [o.front, o.bows, o.horse, o.lead]) if (x !== undefined && ONCE.has(x)) used.add(x)
    }
    const res = resolveRound(c, st, oa, od, i, rk, capOf)
    rounds.push(res.log)
    if (res.captured !== null) {
      captured = res.captured
      break
    }
    if (res.duel !== null) duel = res.duel
    if (res.retreat !== null) {
      retreat = res.retreat
      break
    }
    // 무너짐 — 처음보다 많이 줄었거나 사기가 꺾였다. 둘 다면 더 밀린 쪽만
    const na = aliveShare(g0a, st.fa)
    const nd = aliveShare(g0d, st.fd)
    const menA = na < R.tacBreakMen
    const menD = nd < R.tacBreakMen
    const downA = menA || st.ma / Math.max(0.05, atk.morale) < R.tacBreakMorale
    const downD = menD || st.md / Math.max(0.05, def.morale) < R.tacBreakMorale
    if (downA || downD) {
      const s = shareOf(c, st)
      broke = downA && downD ? (s >= 0.5 ? 'd' : 'a') : downA ? 'a' : 'd'
      brokeBy = (broke === 'a' ? menA : menD) ? 'men' : 'morale'
      break
    }
  }

  const s = shareOf(c, st)
  let outcome: Outcome
  if (captured === 'd' || broke === 'd' || retreat === 'd') outcome = s >= R.tacRoutShare || captured === 'd' ? 'rout' : 'win'
  else if (captured === 'a' || broke === 'a' || retreat === 'a') outcome = s <= 1 - R.tacRoutShare || captured === 'a' ? 'routed' : 'lose'
  else if (retreat === 'both') outcome = 'draw'
  else outcome = s >= R.tacWinShare ? 'win' : s <= 1 - R.tacWinShare ? 'lose' : 'draw'
  // 무너진 쪽은 쫓기며 더 잃는다 (물러난 쪽은 아니다 — 물러나기의 값이다)
  const chase = (f: Record<Grp, number>): void => { for (const g of GRPS) f[g] = Math.max(0, f[g] - R.tacChase) }
  if (outcome === 'rout' && retreat !== 'd') chase(st.fd)
  if (outcome === 'routed' && retreat !== 'a') chase(st.fa)
  if (outcome === 'rout' || outcome === 'routed') broke ??= outcome === 'rout' ? 'd' : 'a'
  if (retreat !== null) broke = null
  const endWhy: EndWhy = captured !== null ? 'captured' : retreat !== null ? 'retreat' : brokeBy !== null ? brokeBy : outcome === 'draw' ? 'draw' : 'share'

  return {
    outcome, na: aliveShare(g0a, st.fa), nd: aliveShare(g0d, st.fd), ga: { ...st.fa }, gd: { ...st.fd },
    // 싸움 앞의 덤·감(moraleBonus)은 그 판에만 — 남는 것은 라운드에서 오간 몫
    dma: st.ma - atk.morale - (atk.moraleBonus ?? 0), dmd: st.md - def.morale - (def.moraleBonus ?? 0),
    captured, broke, duel, rounds, led: memo.led, endWhy,
    ...(memo.pending !== undefined ? { pending: memo.pending } : {}),
  }
}

/** 한 합 — 장수의 명령(물러나기 · 겨루기 · 사로잡기) → 앞줄 맞붙음 → 활 → 말 → 손실 · 사기 */
function resolveRound(
  c: Ctx, st: State, oa: RoundOrder & { lead: Cmd }, od: RoundOrder & { lead: Cmd }, i: number,
  rk: (i: number, k: string) => number, capOf: (mine: 'a' | 'd', guard: boolean) => { p: number; squad: number; escort: number },
): { log: RoundLog; captured: 'a' | 'd' | null; retreat: 'a' | 'd' | 'both' | null; duel: { loser: 'a' | 'd'; kill: boolean } | null } {
  const R = P.realm
  const { atk, def, g0a, g0d } = c
  const acts: Act[] = []
  const lossA: Record<Grp, number> = { front: 0, bows: 0, horse: 0 }
  const lossD: Record<Grp, number> = { front: 0, bows: 0, horse: 0 }
  const side = (x: 'a' | 'd'): { s: Side; g0: Record<Grp, number>; f: Record<Grp, number>; o: RoundOrder & { lead: Cmd }; loss: Record<Grp, number>; m: number; lost: boolean } =>
    x === 'a' ? { s: atk, g0: g0a, f: st.fa, o: oa, loss: lossA, m: st.ma, lost: st.lostA } : { s: def, g0: g0d, f: st.fd, o: od, loss: lossD, m: st.md, lost: st.lostD }
  const other = (x: 'a' | 'd'): 'a' | 'd' => (x === 'a' ? 'd' : 'a')
  const men = (x: 'a' | 'd', g: Grp): number => { const q = side(x); return Math.max(0, menNow(q.g0, q.f, g) - q.loss[g]) }
  /** 합이 시작될 때의 사람 — 이야기의 '몇이' */
  const start = (x: 'a' | 'd', g: Grp): number => Math.round(menNow(side(x).g0, side(x).f, g))
  const has = (x: 'a' | 'd', g: Grp): boolean => side(x).o[g] !== undefined && men(x, g) >= 1
  const pow = (x: 'a' | 'd', g: Grp): number => { const q = side(x); return groupPower(q.s, q.g0, q.f, q.m, q.lost, g) }
  const hurt = (x: 'a' | 'd', g: Grp, n: number): number => {
    const q = side(x)
    const cut = Math.min(Math.max(0, n), menNow(q.g0, q.f, g) - q.loss[g])
    q.loss[g] += cut
    return Math.round(cut)
  }
  const jit = (k: string): number => (rk(i, k) - 0.5) * R.tacJitter * 0.5
  const L = R.tacRoundLoss * 2
  let ev: RoundLog['ev']
  let by: 'a' | 'd' | undefined
  let lossScale = 1
  let duelRes: { loser: 'a' | 'd'; kill: boolean } | null = null
  const draw: Record<'a' | 'd', number> = { a: 1, d: 1 }
  const front = (x: 'a' | 'd'): Cmd | undefined => side(x).o.front
  const chipOf = (o: RoundOrder & { lead: Cmd }): Cmd => (o.lead !== 'drum' ? o.lead : o.front ?? o.bows ?? o.horse ?? 'drum')
  const finish = (beat: 'a' | 'd' | null, extra: Partial<RoundLog> = {}): RoundLog => {
    for (const g of GRPS) {
      st.fa[g] = g0a[g] > 0 ? Math.max(0, st.fa[g] - lossA[g] / g0a[g]) : 0
      st.fd[g] = g0d[g] > 0 ? Math.max(0, st.fd[g] - lossD[g] / g0d[g]) : 0
    }
    const la = GRPS.reduce((s, g) => s + lossA[g], 0)
    const ld = GRPS.reduce((s, g) => s + lossD[g], 0)
    const push = la + ld > 0 ? ld / (la + ld) : 0.5
    const ga: Partial<Record<Grp, number>> = {}
    const gd: Partial<Record<Grp, number>> = {}
    for (const g of GRPS) {
      if (g0a[g] > 0) ga[g] = Math.round(g0a[g] * st.fa[g])
      if (g0d[g] > 0) gd[g] = Math.round(g0d[g] * st.fd[g])
    }
    return {
      a: chipOf(oa), d: chipOf(od), beat, push, na: aliveShare(g0a, st.fa), nd: aliveShare(g0d, st.fd), ma: st.ma, md: st.md,
      oa, od, acts, ga, gd, ...(ev !== undefined ? { ev } : {}), ...(by !== undefined ? { by } : {}), ...extra,
    }
  }

  // ── 물러나기 — 싸우기 전에 끝난다. 물러나는 쪽은 한 합 몫의 일부만 잃는다 (말이 호위하면 덜)
  if (oa.lead === 'retreat' || od.lead === 'retreat') {
    for (const x of ['a', 'd'] as const) {
      if (side(x).o.lead !== 'retreat') continue
      const k = R.tacRoundLoss * R.tacRetreatLoss * (side(x).o.horse === 'guard' ? R.tacGuardRetreat : 1)
      let lost = 0
      for (const g of GRPS) lost += hurt(x, g, menNow(side(x).g0, side(x).f, g) * k)
      acts.push({ s: x, g: 'lead', c: 'retreat', n: Math.round(GRPS.reduce((s, g) => s + men(x, g), 0)), sl: lost, res: 'ok' })
    }
    const retreat = oa.lead === 'retreat' && od.lead === 'retreat' ? 'both' : oa.lead === 'retreat' ? 'a' : 'd'
    ev = 'retreat'
    by = retreat === 'd' ? 'd' : 'a'
    return { log: finish(null), captured: null, retreat, duel: null }
  }

  // ── 장수 겨루기 — 장수끼리 나선다. 군대는 숨을 죽이고 본다 (이 합 손실이 적다)
  if (oa.lead === 'duel' || od.lead === 'duel') {
    const starter: 'a' | 'd' = oa.lead === 'duel' ? 'a' : 'd'
    const pA = clamp(0.5 + R.tacDuelPerMu * ((atk.hero?.mu ?? 1) - (def.hero?.mu ?? 1)), 0.1, 0.9)
    const aWins = rk(i, 'duel') < pA
    const loser: 'a' | 'd' = aWins ? 'd' : 'a'
    const kill = rk(i, 'duel-kill') < R.tacDuelKill
    duelRes = { loser, kill }
    if (loser === 'a') { st.lostA = true; st.hurtA = !kill } else { st.lostD = true; st.hurtD = !kill }
    st.ma += aWins ? R.tacDuelWin : -R.tacDuelLose
    st.md += aWins ? -R.tacDuelLose : R.tacDuelWin
    ev = aWins === (starter === 'a') ? 'duel-win' : 'duel-lose'
    by = starter
    lossScale = 0.3
    acts.push({ s: starter, g: 'lead', c: 'duel', n: 1, res: (loser !== starter) ? 'won' : 'lost' })
  }

  // ── 사로잡기 — 날랜 무리가 적장 곁으로 파고든다. 먹히면 판이 끝난다. 둘 다 가면 공격 쪽 먼저
  for (const x of ['a', 'd'] as const) {
    if (side(x).o.lead !== 'capture') continue
    if (duelRes?.loser === x) continue // 겨루기에서 진 장수는 이 합에 날랜 무리를 못 부린다
    const foeGuard = side(other(x)).o.horse === 'guard' && men(other(x), 'horse') >= 1
    const cap = capOf(x, foeGuard)
    by = x
    draw[x] = R.tacCapDraw
    if (rk(i, `cap-${x}`) < cap.p) {
      ev = 'capture-ok'
      acts.push({ s: x, g: 'lead', c: 'capture', n: cap.squad, tg: 'lead', res: 'ok', guard: cap.escort })
      // captured 는 장수를 잃은 쪽이다 — 이끌 사람을 잃은 군사는 기세가 꺾인다
      if (x === 'a') st.md = clamp(st.md - R.tacCaughtMorale, 0.1, 1.6)
      else st.ma = clamp(st.ma - R.tacCaughtMorale, 0.1, 1.6)
      return { log: finish(null, { push: x === 'a' ? 1 : 0 }), captured: other(x), retreat: null, duel: duelRes }
    }
    ev = 'capture-fail'
    // 놓쳤다 — 날랜 무리가 호위에 걸려 잃는다 (말에서 먼저, 없으면 앞줄에서)
    const lostSquad = cap.squad * R.tacCapFailLoss
    const fromHorse = Math.min(lostSquad, men(x, 'horse'))
    const sl = hurt(x, 'horse', fromHorse) + hurt(x, 'front', lostSquad - fromHorse)
    acts.push({ s: x, g: 'lead', c: 'capture', n: cap.squad, tg: 'lead', sl, res: 'fail', guard: cap.escort })
  }

  // ── 앞줄 맞붙음 (+ 말 돌파)
  let beat: 'a' | 'd' | null = null
  const fa0 = front('a')
  const fd0 = front('d')
  // 바위 굴리기 — 맞붙기 전에 적 앞줄이 잃는다
  for (const x of ['a', 'd'] as const) {
    if (front(x) !== 'rocks') continue
    const y = other(x)
    const tg: Grp = has(y, 'front') ? 'front' : 'bows'
    const tl = hurt(y, tg, men(y, tg) * R.tacRocks * lossScale)
    acts.push({ s: x, g: 'front', c: 'rocks', n: start(x, 'front'), tg, tl, res: 'hit' })
  }
  if (has('a', 'front') || has('d', 'front')) {
    const strength = (x: 'a' | 'd'): number => {
      const y = other(x)
      const o = side(x).o
      const fc = o.front
      let s = has(x, 'front') ? pow(x, 'front') * frontQ(side(x).s, fc ?? 'hold') : 0
      if (fc === 'charge' || fc === 'gate' || fc === 'ram') s *= R.tacChargeMul
      if (fc === 'hold' || fc === 'ford' || fc === 'rocks') s *= R.tacHoldMul
      if (fc === 'open') s *= R.tacOpenFront
      if (fc === 'gate') s *= R.tacGateMul
      if (fc === 'ram') s *= R.tacRamMul
      if (fc === 'ford') s *= R.tacFordHold
      if (o.bows === 'height' && HOLDS.has(fc ?? 'hold')) s *= 1 + (R.tacHeight - 1) * 0.5
      if (front(y) === 'ford' && CHARGES.has(fc ?? 'hold')) s *= R.tacFordCharge
      if (o.horse === 'punch' && has(x, 'horse')) s += pow(x, 'horse') * R.tacChargeMul
      return s * draw[x]
    }
    const charging = (x: 'a' | 'd'): boolean => CHARGES.has(front(x) ?? 'hold') || (side(x).o.horse === 'punch' && has(x, 'horse') && !has(x, 'front'))
    const holding = (x: 'a' | 'd'): boolean => HOLDS.has(front(x) ?? 'charge') && has(x, 'front')
    const opening = (x: 'a' | 'd'): boolean => front(x) === 'open' && has(x, 'front')
    let sa = strength('a')
    let sd = strength('d')
    const takeOf = (x: 'a' | 'd'): number => (charging(x) ? R.tacTakenCharge : opening(x) ? R.tacTakenVolley : R.tacTakenHold)
    let takeA = takeOf('a')
    let takeD = takeOf('d')
    let scale = lossScale
    // 세모의 한 변: 방진 > 돌격 — 단 흔들리지 않는 방진만 (화살비·옆치기로 흔들어 놓고 돌격하면 뚫린다). 성문 깨기는 방진에 꺾이지 않는다
    const steady = (x: 'a' | 'd'): number => (x === 'a' ? st.ma / Math.max(0.05, atk.morale) : st.md / Math.max(0.05, def.morale))
    for (const [h, c2] of [['a', 'd'], ['d', 'a']] as const) {
      if (!holding(h) || !charging(c2) || beat !== null) continue
      if (steady(h) < R.tacHoldBreak) beat = c2 // 흔들리던 방진이 뚫렸다
      else if (steady(h) >= R.tacHoldSteady && front(c2) !== 'gate') beat = h
    }
    // 돌격 > 길 트기 (벌어진 앞줄을 뚫고 궁수에게 닿는다) · 길 트기 > 방진 (서 있는 방패 벽에 화살이 쏟아진다 — 활에서 셈한다)
    for (const [c1, o1] of [['a', 'd'], ['d', 'a']] as const) if (beat === null && charging(c1) && opening(o1)) beat = c1
    for (const [o1, h1] of [['a', 'd'], ['d', 'a']] as const) if (beat === null && opening(o1) && holding(h1)) beat = o1
    if (beat === 'a') { sa *= R.tacTriUp; sd *= R.tacTriDown; takeA *= R.tacTriTakeWin; takeD *= R.tacTriTakeLose }
    if (beat === 'd') { sd *= R.tacTriUp; sa *= R.tacTriDown; takeD *= R.tacTriTakeWin; takeA *= R.tacTriTakeLose }
    // 서로 버티거나 서로 길을 트면 앞줄끼리는 크게 안 붙는다 · 길 튼 쪽과 방진은 활이 싸운다
    if ((holding('a') || opening('a')) && (holding('d') || opening('d'))) scale *= R.tacStall
    const p = clamp(edgeOf(sa, sd) + jit('front'), 0.03, 0.97)
    // 손실을 앞줄과 돌파한 말에 나눈다 — 방진에 부딪힌 말은 크게 다친다
    const deal = (x: 'a' | 'd', frac: number, take: number): number => {
      // x 가 잃는다
      let lost = 0
      const punch = side(x).o.horse === 'punch' && has(x, 'horse')
      const fm = men(x, 'front')
      const hm = punch ? men(x, 'horse') : 0
      const tot = fm + hm
      if (tot <= 0) return 0
      const k = L * frac * take * scale
      lost += hurt(x, 'front', fm * k)
      if (punch) lost += hurt(x, 'horse', hm * k * (holding(other(x)) ? R.tacPunchHoldTake : 1))
      return lost
    }
    const lostD = has('d', 'front') || side('d').o.horse === 'punch' ? deal('d', p, takeD) : 0
    const lostA = has('a', 'front') || side('a').o.horse === 'punch' ? deal('a', 1 - p, takeA) : 0
    const res = (x: 'a' | 'd'): Act['res'] => (beat === x ? 'won' : beat === other(x) ? 'lost' : (holding('a') || opening('a')) && (holding('d') || opening('d')) ? 'stall' : 'even')
    if (has('a', 'front')) acts.push({ s: 'a', g: 'front', c: fa0 ?? 'charge', n: start('a', 'front'), tg: 'front', tl: lostD, sl: lostA, res: res('a') })
    if (has('d', 'front')) acts.push({ s: 'd', g: 'front', c: fd0 ?? 'charge', n: start('d', 'front'), tg: 'front', tl: lostA, sl: lostD, res: res('d') })
    for (const x of ['a', 'd'] as const) {
      if (side(x).o.horse === 'punch' && has(x, 'horse')) acts.push({ s: x, g: 'horse', c: 'punch', n: start(x, 'horse'), tg: 'front', res: holding(other(x)) ? 'blocked' : 'hit' })
    }
    // 세모의 셋째 변 — 돌격이 막히지 않으면 적 궁수까지 덮친다 (돌격 > 화살비)
    for (const x of ['a', 'd'] as const) {
      const y = other(x)
      if (!charging(x) || !has(y, 'bows')) continue
      if (has(y, 'front') && !opening(y)) continue
      const tl = hurt(y, 'bows', men(y, 'bows') * L * R.tacChargeSpill * (x === 'a' ? p : 1 - p) * lossScale)
      if (tl > 0) {
        acts.push({ s: x, g: 'front', c: 'charge', n: start(x, 'front'), tg: 'bows', tl, res: 'won' })
        beat ??= x
      }
    }
  }

  // ── 활
  for (const x of ['a', 'd'] as const) {
    const y = other(x)
    const ob = side(x).o.bows
    if (ob === undefined || !has(x, 'bows')) continue
    const n = start(x, 'bows')
    let s = pow(x, 'bows') * draw[x]
    if (side(y).o.bows === 'counter' && has(y, 'bows') && men(y, 'bows') >= men(x, 'bows') * 0.5 && ob !== 'counter') s *= R.tacCounterCut
    if (ob === 'height') s *= R.tacHeight
    if (front(x) === 'open') s *= R.tacOpenVolley
    if (ob === 'fire') {
      if (rk(i, `fire-${x}`) < R.tacFireOk) {
        ev ??= 'fire-ok'
        by ??= x
        let tl = 0
        for (const g of ['front', 'bows'] as const) if (has(y, g)) tl += hurt(y, g, men(y, g) * L * 0.5 * (1 + R.tacFireTaken) * lossScale)
        if (y === 'a') st.ma -= R.tacFireBack
        else st.md -= R.tacFireBack
        acts.push({ s: x, g: 'bows', c: 'fire', n, tg: has(y, 'front') ? 'front' : 'bows', tl, res: 'hit' })
      } else {
        ev ??= 'fire-back'
        by ??= x
        if (x === 'a') st.ma -= R.tacFireBack
        else st.md -= R.tacFireBack
        acts.push({ s: x, g: 'bows', c: 'fire', n, res: 'fail' })
      }
      continue
    }
    if (ob === 'counter') {
      if (!has(y, 'bows')) { acts.push({ s: x, g: 'bows', c: ob, n, res: 'wasted' }); continue }
      const p = clamp(edgeOf(s, pow(y, 'bows')) + jit(`cb-${x}`), 0.03, 0.97)
      const tl = hurt(y, 'bows', men(y, 'bows') * L * p * R.tacVolleyLoss * lossScale)
      acts.push({ s: x, g: 'bows', c: ob, n, tg: 'bows', tl, res: 'hit' })
      continue
    }
    // 화살비(높은 곳 포함) — 적 앞줄을 쏜다 (앞줄이 없으면 활 · 말)
    const tg: Grp = has(y, 'front') ? 'front' : has(y, 'bows') ? 'bows' : 'horse'
    if (!has(y, tg)) continue
    const yf = front(y)
    let mul = 1
    let res: Act['res'] = 'hit'
    if (tg === 'front' && yf !== undefined && HOLDS.has(yf)) { mul = R.tacVolleyHold; res = 'won' }
    else if (tg === 'front' && yf !== undefined && CHARGES.has(yf)) mul = R.tacVolleyCharge
    const p = clamp(edgeOf(s * mul, pow(y, tg) * 0.8) + jit(`vb-${x}`), 0.03, 0.97)
    const tl = hurt(y, tg, men(y, tg) * L * p * R.tacVolleyLoss * lossScale)
    if (res === 'won') beat ??= x
    acts.push({ s: x, g: 'bows', c: ob, n, tg, tl, res })
  }

  // ── 말
  for (const x of ['a', 'd'] as const) {
    const y = other(x)
    const oh = side(x).o.horse
    if (oh === undefined || oh === 'punch' || !has(x, 'horse')) continue
    const n = start(x, 'horse')
    if (oh === 'guard') { acts.push({ s: x, g: 'horse', c: 'guard', n, tg: 'lead', res: 'ok' }); continue }
    let s = pow(x, 'horse') * draw[x]
    if (oh === 'flank') {
      // 적 말이 호위하고 있으면 말끼리 맞붙는다
      if (side(y).o.horse === 'guard' && has(y, 'horse')) {
        const p = clamp(edgeOf(s, pow(y, 'horse')) + jit(`hh-${x}`), 0.03, 0.97)
        const tl = hurt(y, 'horse', men(y, 'horse') * L * p * lossScale)
        const sl = hurt(x, 'horse', men(x, 'horse') * L * (1 - p) * lossScale)
        acts.push({ s: x, g: 'horse', c: 'flank', n, tg: 'horse', tl, sl, res: 'blocked' })
        continue
      }
      const tg: Grp = has(y, 'bows') ? 'bows' : has(y, 'front') ? 'front' : 'horse'
      if (!has(y, tg)) continue
      let mul = R.tacFlank2
      if (tg === 'front' && HOLDS.has(front(y) ?? 'charge')) mul *= R.tacFlankHold
      s *= mul
      const p = clamp(edgeOf(s, pow(y, tg) * 0.7) + jit(`fl-${x}`), 0.03, 0.97)
      const tl = hurt(y, tg, men(y, tg) * L * p * lossScale)
      const sl = hurt(x, 'horse', men(x, 'horse') * L * (1 - p) * 0.3 * lossScale)
      acts.push({ s: x, g: 'horse', c: 'flank', n, tg, tl, sl, res: 'hit' })
      if (tg === 'front' && HOLDS.has(front(y) ?? 'charge')) beat ??= x
      continue
    }
    // 추격 — 흔들리는 적만 (사기가 꺾였거나 이번 합 앞줄이 밀렸다)
    const ym = y === 'a' ? st.ma : st.md
    const wavering = ym / Math.max(0.05, side(y).s.morale) < R.tacPursueMorale || beat === x
    const tg: Grp = GRPS.filter((g) => has(y, g)).sort((p, q) => men(y, q) - men(y, p))[0] ?? 'front'
    if (!has(y, tg)) continue
    const p = clamp(edgeOf(s * (wavering ? R.tacPursueMul : R.tacPursueWaste), pow(y, tg) * 0.6) + jit(`pu-${x}`), 0.03, 0.97)
    const tl = hurt(y, tg, men(y, tg) * L * p * lossScale * (wavering ? 1 : 0.4))
    acts.push({ s: x, g: 'horse', c: 'pursue', n, tg, tl, res: wavering ? 'hit' : 'wasted' })
  }

  // ── 사기 — 잃은 사람만큼 오간다. 세모에서 진 쪽은 더 꺾인다 · 북 · 군량
  const la = GRPS.reduce((s, g) => s + lossA[g], 0)
  const ld = GRPS.reduce((s, g) => s + lossD[g], 0)
  // 사람 비로 — 큰 군대가 조금 잃는 것과 작은 군대가 조금 잃는 것은 다르다
  const ra = c.n0a > 0 ? la / c.n0a : 0
  const rd = c.n0d > 0 ? ld / c.n0d : 0
  const pr = ra + rd > 0 ? rd / (ra + rd) : 0.5
  const dm = (pr - 0.5) * R.tacMoraleSwing
  st.ma += dm
  st.md -= dm
  if (beat === 'a') st.md -= R.tacTriMorale
  if (beat === 'd') st.ma -= R.tacTriMorale
  // 북 — 흔들린 군사를 다잡는다 (처음 사기까지만 — 북으로 처음보다 세지지는 않는다)
  const top = (s: Side): number => s.morale + (s.moraleBonus ?? 0)
  if (oa.lead === 'drum' && st.ma < top(atk)) st.ma = Math.min(top(atk), st.ma + R.tacDrumMorale)
  if (od.lead === 'drum' && st.md < top(def)) st.md = Math.min(top(def), st.md + R.tacDrumMorale)
  if (atk.hungry) st.ma -= R.tacHungry
  if (def.hungry) st.md -= R.tacHungry
  st.ma = clamp(st.ma, 0.1, 1.6)
  st.md = clamp(st.md, 0.1, 1.6)
  const log = finish(beat)
  return { log: { ...log, push: pr }, captured: null, retreat: null, duel: duelRes }
}
