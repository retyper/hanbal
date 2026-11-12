/**
 * 전장 — 우리가 낀 싸움을 합(라운드)마다 직접 지휘한다 (docs/realm/BATTLE.md §전투 2판 · 형 2026-10-19:
 * "기병컨트롤은 방법이없나? 군대 운용이 제일 중요한데" · "창병움직이면 다른애들 가만있냐. 각자 행동 컨트롤")
 *
 * 계절을 넘기기 전에 열린다. 판정은 늘 advance 다 — 이 화면은 warroom.rehearse 로 시험 돌림을 하고,
 * 고른 명령(tactics)을 모아 끝에 host.done 으로 넘긴다. 같은 명령이면 진짜 판도 같다 (결정론).
 *
 * 한 합에 무리마다 깃발을 하나씩 든다 — 앞줄 · 활 · 기병 · 장수. 고르지 않은 무리는 장수가 알아서 움직인다.
 * "북을 울린다"를 누르면 그 합이 천천히 풀린다: 두 진의 깃발 → 무슨 일이 있었나(누가 몇이 무엇을 해서 어떻게 됐나) → 잃은 사람.
 * 싸움이 열리면 계절 띠처럼 그 싸움의 이름이 가운데 떴다 사라진다 (북 · 종).
 * 움직임은 CSS 애니메이션의 지연뿐이고, 소리만 타이머로 — 탭이 보일 때만 (절대 규칙 4).
 * 확률은 숫자로 안 보인다 — 사로잡기는 말과 색으로, 대신 사람 수(날랜 무리 · 호위)는 보인다 (realm-no-numbers).
 */
import { faceFile } from './face.ts'
import { FACTION_ART, SOL_ANIM2, bustOf, SOL_ANIM_AR, UNIT_ICON, flagIcon, genArtOf, generalSprite, PX_HERO } from '../../realm/data/art.ts'
import { battleName, endStory, fieldName, groupLabel, roundStory, storyCtx, TURN, turnWord, UNIT_NAME as UNIT_NAME_KO } from '../../realm/data/prose.ts'
import { BATTLE_STYLES, groupMen, groupOf, lookRound, nightAt, type BattleStyle, type RoundAt } from '../../realm/tactics.ts'
import { rehearse, type BattleLine } from '../../realm/warroom.ts'
import { seasonOf } from '../../realm/season.ts'
import { heroArt } from '../../realm/heroes.ts'
import type { Act, Approach, Art, Clock, Cmd, Dusk, DuskAsk, DuskLog, Grp, Hero, Look, Order, Pending, Realm, RoundLog, RoundOrder, Tactic } from '../../realm/types.ts'
import type { GuardWhy } from '../../realm/council.ts'
import { P } from '../../tune/params.ts'
import { captureAttempts, playBattleStrikes } from './battle-strikes.ts'
import { captureCast, carryEnd, caughtIn, playCapture, withoutCapture } from './battle-capture.ts'
import { BATTLE_SPEEDS, battlePlayback, battleSpeed, type BattleSpeed } from './battle-playback.ts'
import { snd } from './sound.ts'
import { artVoicePath, autoVoicePath, voiceGate, voicePath } from './voice.ts'
import { WIN_BUZZ, warmWinLogos, winFxHtml } from './winfx.ts'
import { morph, morphInto } from './morph.ts'
import { mountDuel, type DuelSide } from '../../duel/view.ts'
import { clampTier } from '../../realm/tier.ts'
import { holdBox } from './holdbox.ts'
import { TIER_MEN, sideIdx, tierCounts, tierPrec, tierStanding, type Tier } from './troops.ts'
import { preloadSkillFx, skillCues, skillCutHtml, type SkSfx, type SkillId } from './skillfx.ts'
import { ELEM } from './ascend.ts'
import type { Elem } from '../../realm/elem.ts'
import { cellColor, lookCells, lookNums, oneChance, pctText, signed, type LookCell } from './lookword.ts'
import { t as tr, type Key } from '../../i18n/index.ts'
import { nameTable } from '../../i18n/names.ts'

/** 장수마다 숨쉬기 박자를 어긋나게 (0~1 · 이름에서 정해져 같은 장수는 늘 같다 · 형 11-12: 「다 동시에 움직인다」) */
const idlePhase = (id: string): string => ([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) / 997).toFixed(2)

/** 키 줄의 i 번째 글을 지금 말로 (표를 모듈 첫머리에서 굳히지 않는다: 말이 바뀌어도 읽는 때마다) */
const nth = (keys: readonly Key[], i: number): string | undefined => (keys[i] === undefined ? undefined : tr(keys[i]!))
/** [그대로, 글] 한 쌍 — 둘째 칸만 읽을 때마다 지금 말로 */
const lzPair = (first: string, key: Key): readonly [string, string] => {
  const p: [string, string] = [first, '']
  Object.defineProperty(p, 1, { get: () => tr(key), enumerable: true })
  return p
}
/** [글, 글] 한 쌍 — 읽을 때마다 지금 말로 */
const lzTwo = (a: Key, b: Key): readonly [string, string] => {
  const p: [string, string] = ['', '']
  Object.defineProperty(p, 0, { get: () => tr(a), enumerable: true })
  Object.defineProperty(p, 1, { get: () => tr(b), enumerable: true })
  return p
}

const UNIT_NAME = nameTable('unit', UNIT_NAME_KO)
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** 진군 방식의 이름 · 고르는 화면의 한 줄 (얻는 것 · 거는 것) */
export const APPROACH_NAME: Record<Approach, string> = {
  road: '대로로 간다', night: '밤길로 숨어 간다', ford: '여울을 몰래 건넌다', ridge: '산기슭으로 돌아간다', cliff: '절벽을 타고 오른다',
}
export const APPROACH_DOES: Record<Approach, { gain: string; risk: string }> = {
  road: { get gain() { return tr('war.approachDoes.road.gain') }, get risk() { return tr('war.approachDoes.road.risk') } },
  night: { get gain() { return tr('war.approachDoes.night.gain') }, get risk() { return tr('war.approachDoes.night.risk') } },
  ford: { get gain() { return tr('war.approachDoes.ford.gain') }, get risk() { return tr('war.approachDoes.ford.risk') } },
  ridge: { get gain() { return tr('war.approachDoes.ridge.gain', { TURN }) }, get risk() { return tr('war.approachDoes.ridge.risk') } },
  cliff: { get gain() { return tr('war.approachDoes.cliff.gain') }, get risk() { return tr('war.approachDoes.cliff.risk') } },
}

/** 계절에 막힌 길 — 갈 수는 있다. 고를 때 미리 보인다 (형: "불가능하게 만들지 말고 패널티 · 사전에 안내") */
export const HARD_LINE = {
  get winterPass() { return tr('war.hardLine.winterPass', { TURN }) },
  get summerFord() { return tr('war.hardLine.summerFord', { TURN }) },
} as const

/** 깃발(명령)의 이름 — 우리 옛 진법의 말로. '일기토'처럼 남의 나라 게임 말은 쓰지 않는다 (형 2026-10-19) */
export const CMD_NAME: Record<Cmd, string> = {
  get charge() { return tr('war.cmdName.charge') }, get hold() { return tr('war.cmdName.hold') }, get open() { return tr('war.cmdName.open') }, get ford() { return tr('war.cmdName.ford') }, get rocks() { return tr('war.cmdName.rocks') }, get gate() { return tr('war.cmdName.gate') }, get ram() { return tr('war.cmdName.ram') },
  get volley() { return tr('war.cmdName.volley') }, get counter() { return tr('war.cmdName.counter') }, get fire() { return tr('war.cmdName.fire') }, get height() { return tr('war.cmdName.height') },
  get flank() { return tr('war.cmdName.flank') }, get punch() { return tr('war.cmdName.punch') }, get pursue() { return tr('war.cmdName.pursue') }, get guard() { return tr('war.cmdName.guard') },
  get drum() { return tr('war.cmdName.drum') }, get duel() { return tr('war.cmdName.duel') }, get capture() { return tr('war.cmdName.capture') }, get retreat() { return tr('war.cmdName.retreat') }, get art() { return tr('war.cmdName.art') }, get feast() { return tr('war.cmdName.feast') }, get wake() { return tr('war.cmdName.wake') },
}
/** 깃발 한 줄 — 무엇을 이기고 무엇에 지나 */
const CMD_DOES: Record<Cmd, string> = {
  get charge() { return tr('war.cmdDoes.charge') },
  get hold() { return tr('war.cmdDoes.hold') },
  get open() { return tr('war.cmdDoes.open') },
  get ford() { return tr('war.cmdDoes.ford') },
  get rocks() { return tr('war.cmdDoes.rocks') },
  get gate() { return tr('war.cmdDoes.gate') },
  get ram() { return tr('war.cmdDoes.ram') },
  get volley() { return tr('war.cmdDoes.volley') },
  get counter() { return tr('war.cmdDoes.counter') },
  get fire() { return tr('war.cmdDoes.fire') },
  get height() { return tr('war.cmdDoes.height') },
  get flank() { return tr('war.cmdDoes.flank') },
  get punch() { return tr('war.cmdDoes.punch') },
  get pursue() { return tr('war.cmdDoes.pursue') },
  get guard() { return tr('war.cmdDoes.guard') },
  get drum() { return tr('war.cmdDoes.drum') },
  get feast() { return tr('war.cmdDoes.feast') },
  get duel() { return tr('war.cmdDoes.duel') },
  get capture() { return tr('war.cmdDoes.capture') },
  // 퇴각 — 사실상 이 싸움을 지는 것 (형 10-24: "물러난다는 사실상 패배 확정 · 퇴각한다 · 붉게 · 설명 확실히")
  get retreat() { return tr('war.cmdDoes.retreat') },
  get art() { return tr('war.cmdDoes.art') },
  get wake() { return tr('war.cmdDoes.wake') },
}

/**
 * 깃발 카드에 쓰는 한 줄 — 길게 누르면 CMD_DOES 전부 (형 10-23: "카드들이 텍스트가 너무 긴데 · 적장 사로잡기는 10줄이 넘어")
 */
const CMD_SHORT: Record<Cmd, string> = {
  get charge() { return tr('war.cmdShort.charge') }, get hold() { return tr('war.cmdShort.hold') }, get open() { return tr('war.cmdShort.open') },
  get ford() { return tr('war.cmdShort.ford') }, get rocks() { return tr('war.cmdShort.rocks') }, get gate() { return tr('war.cmdShort.gate') }, get ram() { return tr('war.cmdShort.ram') },
  get volley() { return tr('war.cmdShort.volley') }, get counter() { return tr('war.cmdShort.counter') }, get fire() { return tr('war.cmdShort.fire') }, get height() { return tr('war.cmdShort.height') },
  get flank() { return tr('war.cmdShort.flank') }, get punch() { return tr('war.cmdShort.punch') }, get pursue() { return tr('war.cmdShort.pursue') }, get guard() { return tr('war.cmdShort.guard') },
  get drum() { return tr('war.cmdShort.drum') }, get duel() { return tr('war.cmdShort.duel') }, get capture() { return tr('war.cmdShort.capture') }, get retreat() { return tr('war.cmdShort.retreat') }, get art() { return tr('war.cmdShort.art') }, get feast() { return tr('war.cmdShort.feast') },
  get wake() { return tr('war.cmdShort.wake') },
}

/** 각성기의 이름 — 기운마다 (DESIRE §13-3 · 다섯 다 켜졌다 · realm/elem.ts WAKE_ON) */
export const WAKE_NAME: Readonly<Record<import('../../realm/elem.ts').Elem, string>> = {
  get earth() { return tr('war.wakeName.earth') }, get wind() { return tr('war.wakeName.wind') }, get fire() { return tr('war.wakeName.fire') }, get water() { return tr('war.wakeName.water') }, get bolt() { return tr('war.wakeName.bolt') },
}
const WAKE_SHORT: Readonly<Record<import('../../realm/elem.ts').Elem, string>> = {
  get earth() { return tr('war.wakeShort.earth') }, get wind() { return tr('war.wakeShort.wind') }, get fire() { return tr('war.wakeShort.fire') }, get water() { return tr('war.wakeShort.water') }, get bolt() { return tr('war.wakeShort.bolt') },
}

/** 장수의 비기 — 이름 · 그림 · 하는 일 (heroes.heroArt · tactics 의 비기). 장수마다 다르니 깃발에 그 이름으로 뜬다 */
export const ART_NAME: Readonly<Record<Art, string>> = {
  get snipe() { return tr('war.artName.snipe') }, get rite() { return tr('war.artName.rite') }, get sway() { return tr('war.artName.sway') }, get stand() { return tr('war.artName.stand') }, get ambush() { return tr('war.artName.ambush') },
  get vanguard() { return tr('war.artName.vanguard') }, get feint() { return tr('war.artName.feint') }, get order() { return tr('war.artName.order') }, get shout() { return tr('war.artName.shout') },
}
export const ART_ICON: Readonly<Record<Art, string>> = {
  snipe: 'unit-archer', rite: 'unit-shaman', sway: 'status-betrayal', stand: 'unit-shield-wall', ambush: 'unit-scouts',
  vanguard: 'unit-general', feint: 'unit-porters', order: 'unit-drummers', shout: 'status-morale-up',
}
export const ART_DOES: Readonly<Record<Art, string>> = {
  get snipe() { return tr('war.artDoes.snipe') },
  get rite() { return tr('war.artDoes.rite') },
  get sway() { return tr('war.artDoes.sway') },
  get stand() { return tr('war.artDoes.stand') },
  get ambush() { return tr('war.artDoes.ambush') },
  get vanguard() { return tr('war.artDoes.vanguard') },
  get feint() { return tr('war.artDoes.feint') },
  get order() { return tr('war.artDoes.order') },
  get shout() { return tr('war.artDoes.shout') },
}
/** 비기 카드의 한 줄 */
const ART_SHORT: Readonly<Record<Art, string>> = {
  get snipe() { return tr('war.artShort.snipe') }, get rite() { return tr('war.artShort.rite') }, get sway() { return tr('war.artShort.sway') }, get stand() { return tr('war.artShort.stand') }, get ambush() { return tr('war.artShort.ambush') },
  get vanguard() { return tr('war.artShort.vanguard') }, get feint() { return tr('war.artShort.feint') }, get order() { return tr('war.artName.order') }, get shout() { return tr('war.cmdShort.drum') },
}
/** 겨뤄 본 적장의 버릇 — 앞줄이 즐겨 하는 것 */
const HABIT_LINE: Partial<Record<Cmd, string>> = {
  get charge() { return tr('war.habitLine.charge') }, get hold() { return tr('war.habitLine.hold') }, get open() { return tr('war.habitLine.open') },
}
/** 적진의 낌새 — 적 앞줄이 다음에 할 것 */
const HINT_LINE: Partial<Record<Cmd, string>> = {
  get charge() { return tr('war.hintLine.charge') }, get hold() { return tr('war.hintLine.hold') }, get open() { return tr('war.hintLine.open') },
}
/** 깃발 → 진의 꼴 (전장 띠의 data-f·b·h·l) — 돌격 갈래(성문 부수기·배 들이받기)는 돌격, 버티는 갈래(여울 막기·돌 굴리기)는 방진 */
export function formOf(o: RoundOrder | undefined): Record<'f' | 'b' | 'h' | 'l', string | undefined> {
  const f = o?.front
  return {
    f: f === undefined ? undefined : f === 'gate' || f === 'ram' ? 'charge' : f === 'ford' || f === 'rocks' ? 'hold' : f,
    b: o?.bows, h: o?.horse, l: o?.lead,
  }
}
function formAttrs(o: RoundOrder | undefined): string {
  return Object.entries(formOf(o)).map(([k, v]) => (v !== undefined ? ` data-${k}="${v}"` : '')).join('')
}
/** 진의 꼴을 다시 그리지 않고 바꾼다 (고를 때 · 손을 올렸을 때) */
export function setForm(el: HTMLElement, o: RoundOrder | undefined): void {
  for (const [k, v] of Object.entries(formOf(o))) {
    if (v === undefined) delete el.dataset[k]
    else if (el.dataset[k] !== v) el.dataset[k] = v
  }
}
/** 전장 띠의 낌새 말 — 적 앞줄이 무엇을 할 기세인가 */
const OMEN_WORD: Partial<Record<Cmd, string>> = { get charge() { return tr('war.omenWord.charge') }, get hold() { return tr('war.omenWord.hold') }, get open() { return tr('war.omenWord.open') } }
/** 적 앞줄의 수를 이기는 우리 앞줄의 수 — 방진 > 돌격 > 길 트기 > 방진 */
const FRONT_COUNTER: Partial<Record<Cmd, Cmd>> = { charge: 'hold', hold: 'open', open: 'charge' }

/**
 * 깃발 상성을 그림으로 — 이 깃발이 이기는 적 깃발(up) · 이 깃발을 이기는 적 깃발(dn). tactics.ts 의 판정 그대로:
 * 세모 돌격 > 길 트기 > 방진 > 돌격 (여울 막기·바위 굴리기도 방진 편 · 성문 깨기는 방진에 안 꺾인다) · 화살비·높은 곳 > 방진 · 맞쏘기 > 화살비 ·
 * 옆치기 > 방진(세모 밖, tacFlankHold) · 호위 > 옆치기 · 거짓 퇴각 > 돌격.
 * 깃발 카드마다 달던 줄은 걷고, 싸움 위 띠 왼쪽 「상성」 단추의 판 한 곳에 모은다 (sgHtml · 형 10-29: "상성은 깃발마다 주지 말고")
 */
type FlagKey = Cmd | `art-${Art}`
const HOLD_SIDE: readonly Cmd[] = ['hold', 'ford', 'rocks']
const MATCH: Readonly<Partial<Record<FlagKey, { readonly up: readonly Cmd[]; readonly dn: readonly FlagKey[] }>>> = {
  charge: { up: ['open', 'volley'], dn: ['hold', 'ford'] },
  ram: { up: ['open'], dn: ['hold'] },
  gate: { up: ['open'], dn: [] },
  hold: { up: ['charge', 'ram'], dn: ['open', 'volley', 'flank'] },
  ford: { up: ['charge', 'ram'], dn: ['open', 'volley'] },
  rocks: { up: ['charge', 'ram'], dn: ['open', 'volley'] },
  open: { up: [...HOLD_SIDE], dn: ['charge', 'gate', 'ram'] },
  volley: { up: [...HOLD_SIDE], dn: ['counter', 'charge'] },
  height: { up: [...HOLD_SIDE], dn: ['counter', 'charge'] },
  counter: { up: ['volley', 'height'], dn: [] },
  flank: { up: [...HOLD_SIDE], dn: ['guard'] },
  guard: { up: ['flank'], dn: [] },
  punch: { up: [], dn: [...HOLD_SIDE] },
  'art-feint': { up: ['charge', 'gate', 'ram'], dn: [] },
}
const keyOf = (c: Cmd, ak?: Art): FlagKey => (c === 'art' && ak !== undefined ? `art-${ak}` : c)
const keySrc = (art: string, k: FlagKey): string => (k.startsWith('art-') ? flagSrc(art, 'art', k.slice(4) as Art) : flagSrc(art, k as Cmd))
/** 이 깃발이 적 낌새(적 앞줄의 수)를 이기나 — 깃발 판에서 그 카드를 빛낸다 */
const beatsHint = (c: Cmd, ak: Art | undefined, hint: Cmd | null): boolean => hint !== null && (MATCH[keyOf(c, ak)]?.up.includes(hint) ?? false)

/** 한 합의 상성 판정 — 누가 어느 깃발로 어느 깃발을 이겼나 (판정이 남긴 beat 과 일을 읽기만 한다) */
interface RoundMatch {
  readonly k: 'win' | 'lose' | 'even'; readonly us: FlagKey; readonly foe: FlagKey; readonly mul?: number
  /** 진 쪽도 다른 무리에서 하나 먹였다 (앞줄은 졌어도 화살비가 방진을 쳤다 같은 것) — 밑에 작게 [그 깃발 ▶ 맞은 깃발 ✓] */
  readonly also?: { readonly us: boolean; readonly from: FlagKey; readonly to: FlagKey }
}
const MU_SKIP: ReadonlySet<NonNullable<RoundLog['ev']>> = new Set(['retreat', 'retreat-fail', 'capture-ok', 'capture-fail', 'duel-win', 'duel-lose'])
function roundMatch(rd: RoundLog, ourS: 'a' | 'd'): RoundMatch | null {
  if (rd.ev !== undefined && MU_SKIP.has(rd.ev)) return null
  const foeS: 'a' | 'd' = ourS === 'a' ? 'd' : 'a'
  const ordOf = (s: 'a' | 'd'): RoundOrder | undefined => (s === 'a' ? rd.oa : rd.od)
  const chip = (s: 'a' | 'd'): Cmd => ordOf(s)?.front ?? (s === 'a' ? rd.a : rd.d)
  if (rd.beat === null) {
    const u = chip(ourS)
    const f = chip(foeS)
    return u === 'drum' || f === 'drum' ? null : { k: 'even', us: u, foe: f }
  }
  const w = rd.beat
  const l: 'a' | 'd' = w === 'a' ? 'd' : 'a'
  // beat 을 낸 일 — 이긴 쪽의 「먹혔다」(won) · 옆치기는 방진 옆구리를 친 것
  const x = (rd.acts ?? []).find((a) => a.s === w && (a.res === 'won' || (a.c === 'flank' && a.res === 'hit' && a.tg === 'front' && HOLD_SIDE.includes(ordOf(l)?.front ?? 'charge'))))
  if (x === undefined) return null
  const wk = keyOf(x.c, x.art)
  const lc = x.tg !== undefined && x.tg !== 'lead' ? ordOf(l)?.[x.tg] : ordOf(l)?.front
  const lk: FlagKey = lc ?? chip(l)
  const y = (rd.acts ?? []).find((a) => a.s === l && a.res === 'won')
  const yt = y === undefined ? undefined : y.tg !== undefined && y.tg !== 'lead' ? ordOf(w)?.[y.tg] : ordOf(w)?.front
  const also = y !== undefined && yt !== undefined ? { also: { us: l === ourS, from: keyOf(y.c, y.art), to: yt as FlagKey } } : {}
  const R = P.realm
  // 그 판정의 배수 — 세모는 이긴 세기 ÷ 진 세기 · 화살비는 방진에 · 옆치기는 방진 옆구리에 (돌격이 궁수를 덮친 것은 배수 없이 ✓)
  const mul = x.c === 'flank' ? R.tacFlank2 * R.tacFlankHold
    : x.c === 'volley' || x.c === 'height' ? R.tacVolleyHold
      : x.c === 'art' || x.tg === 'front' ? R.tacTriUp / R.tacTriDown : undefined
  return w === ourS ? { k: 'win', us: wk, foe: lk, ...(mul !== undefined ? { mul } : {}), ...also } : { k: 'lose', us: lk, foe: wk, ...(mul !== undefined ? { mul } : {}), ...also }
}
const mulText = (m: number): string => { const r = Math.round(m * 10) / 10; return `×${Math.abs(r - Math.round(r)) < 0.15 ? Math.round(r) : r.toFixed(1)}` }

/** 상성 판의 한 칸 — 깃발 열쇠, 또는 '#글' 이면 글 딱지 */
type SgTok = FlagKey | `#${string}`
/** 상성 판의 한 줄 — [깃발] ▶ 이기는 것 · = 안 꺾이는 것 · ◀ 지는 것 · 몇 마디 */
interface SgRow { readonly k: FlagKey; readonly up?: readonly SgTok[]; readonly eq?: readonly SgTok[]; readonly dn?: readonly SgTok[]; readonly w: string }
/** 깃발 밑 이름 — 긴 것은 줄인다 */
const SG_NAME: Readonly<Partial<Record<FlagKey, string>>> = { get duel() { return tr('war.sgName.duel') }, get capture() { return tr('war.sgName.capture') }, get retreat() { return tr('war.sgName.retreat') }, get drum() { return tr('war.cmdName.drum') } }
const sgName = (k: FlagKey): string => SG_NAME[k] ?? (k.startsWith('art-') ? ART_NAME[k.slice(4) as Art] : CMD_NAME[k as Cmd])
/**
 * 「상성」 판 — 싸움 위 띠 왼쪽 단추로 뜬다 (오른쪽 「기록」과 짝). 한 판에 깃발이 무엇을 이기고 무엇에 지나를 그림으로.
 * 앞줄: 세모 방진 ▶ 돌격 ▶ 길 트기 ▶ 방진 을 깃발 그림과 화살로 · 활·말 · 장수: 한 줄씩. 수는 조율판(params) 그대로.
 * 굴리지 않는다 — 세 쪽을 탭으로 넘긴다 (형 10-29: "한 방에 깃발들이 뭔지 설명하는 팝업" · 굴리기 대신 떴다 사라지는 상자)
 */
export function sgHtml(art: string): string {
  const R = P.realm
  const pct = (x: number): string => String(Math.round(x * 100))
  const M = (k: FlagKey): { up: readonly SgTok[]; dn: readonly SgTok[] } => ({ up: MATCH[k]?.up.slice(0, 2) ?? [], dn: MATCH[k]?.dn.slice(0, 2) ?? [] })
  const pages: readonly { readonly tab: string; readonly icons: readonly string[]; readonly ring?: boolean; readonly rows: readonly SgRow[] }[] = [
    { tab: tr('war.sghtml.1'), icons: [`${art}icon/${GROUP_ICON.front}.png`], ring: true, rows: [
      { k: 'ford', ...M('ford'), w: mulText(R.tacFordHold) },
      { k: 'rocks', ...M('rocks'), w: tr('war.sghtml.2', { pct: pct(R.tacRocks) }) },
      { k: 'gate', up: ['open'], eq: ['hold'], w: mulText(R.tacGateMul) },
      { k: 'ram', ...M('ram'), w: mulText(R.tacRamMul) },
    ] },
    { tab: tr('war.sghtml.3'), icons: [`${art}icon/${GROUP_ICON.bows}.png`, `${art}icon/${GROUP_ICON.horse}.png`], rows: [
      { k: 'volley', up: ['hold', 'ford'], dn: ['counter', 'charge'], w: mulText(R.tacVolleyHold) },
      { k: 'counter', up: ['volley', 'height'], w: tr('war.sghtml.4', { mulText: mulText(R.tacCounterCut) }) },
      { k: 'fire', up: [`#${tr('war.sghtml.5', { pct: pct(R.tacFireOk) })}`], dn: [`#${tr('war.sghtml.6', { pct: pct(1 - R.tacFireOk) })}`], w: tr('war.sghtml.7') },
      { k: 'height', up: ['hold', 'ford'], dn: ['counter'], w: mulText(R.tacHeight) },
      { k: 'flank', up: ['volley', 'hold'], dn: ['guard'], w: mulText(R.tacFlank2) },
      { k: 'guard', up: ['flank', 'capture'], w: tr('war.sghtml.8') },
      { k: 'punch', ...M('punch'), w: tr('war.sghtml.9') },
      { k: 'pursue', up: [`#${tr('war.sghtml.10')}`], dn: [`#${tr('war.sghtml.11')}`], w: mulText(R.tacPursueMul) },
    ] },
    { tab: tr('war.sghtml.12'), icons: [flagSrc(art, 'drum')], rows: [
      { k: 'drum', w: tr('war.sghtml.13', { pct: pct(R.tacDrumMorale) }) },
      { k: 'feast', w: tr('war.sghtml.14', { pct: pct(R.tacFeastMorale) }) },
      { k: 'duel', up: [`#${tr('war.sghtml.15')}`], w: tr('war.sghtml.16') },
      { k: 'capture', up: [`#${tr('war.sghtml.17')}`], dn: ['guard'], w: '' },
      { k: 'art-feint', ...M('art-feint'), w: tr('war.sghtml.18') },
      { k: 'retreat', dn: [`#${tr('war.sghtml.19')}`], w: tr('war.sghtml.20') },
    ] },
  ]
  const tok = (x: SgTok): string => (x.startsWith('#') ? `<em>${esc(x.slice(1))}</em>` : `<img src="${keySrc(art, x as FlagKey)}" alt="${esc(sgName(x as FlagKey))}">`)
  const chips = (cls: string, xs: readonly SgTok[] | undefined): string => (xs !== undefined && xs.length > 0 ? `<i class="${cls}">${xs.map(tok).join('')}</i>` : '')
  const row = (r: SgRow): string => `<div class="wsg-row"><span class="wsg-me"><img src="${keySrc(art, r.k)}" alt=""><b>${esc(sgName(r.k))}</b></span><span class="wsg-vs">${chips('u', r.up)}${chips('e', r.eq)}${chips('d', r.dn)}</span>${r.w !== '' ? `<b class="wsg-w">${esc(r.w)}</b>` : ''}</div>`
  // 세모 — 방진(위) ▶ 돌격(오른쪽 아래) ▶ 길 트기(왼쪽 아래) ▶ 방진. 그림 판은 300 × 222
  const V: readonly (readonly [Cmd, number, number])[] = [['hold', 150, 48], ['charge', 250, 168], ['open', 50, 168]]
  const cx = 150, cy = 128
  const arrow = (i: number): string => {
    const [, x0, y0] = V[i]!
    const [, x1, y1] = V[(i + 1) % 3]!
    const ax = x0 + (x1 - x0) * 0.3, ay = y0 + (y1 - y0) * 0.3, bx = x0 + (x1 - x0) * 0.7, by = y0 + (y1 - y0) * 0.7
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2
    const qx = mx + (mx - cx) * 0.45, qy = my + (my - cy) * 0.45
    return `<path d="M${ax.toFixed(0)} ${ay.toFixed(0)} Q${qx.toFixed(0)} ${qy.toFixed(0)} ${bx.toFixed(0)} ${by.toFixed(0)}" marker-end="url(#wsg-ah)"/>`
  }
  const ring = `<div class="wsg-ring"><svg viewBox="0 0 300 222" aria-hidden="true"><defs><marker id="wsg-ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M0 0 L10 5 L0 10 z"/></marker></defs>${[0, 1, 2].map(arrow).join('')}</svg>`
    + V.map(([c, x, y]) => `<span class="wsg-rf" style="left:${((x / 300) * 100).toFixed(1)}%;top:${((y / 222) * 100).toFixed(1)}%"><img src="${flagSrc(art, c)}" alt=""><b>${CMD_NAME[c]}</b></span>`).join('')
    + `<b class="wsg-x2">${mulText(R.tacTriUp / R.tacTriDown)}</b></div>`
  const tabs = `<div class="wsg-tabs">${pages.map((pg, i) => `<button class="wsg-t${i === 0 ? ' on' : ''}" data-war="mutab" data-i="${i}">${pg.icons.map((x) => `<img src="${x}" alt="">`).join('')}<span>${pg.tab}</span></button>`).join('')}</div>`
  const body = pages.map((pg, i) => `<div class="wsg-p" data-i="${i}"${i === 0 ? '' : ' hidden'}>${pg.ring === true ? ring : ''}${pg.rows.map(row).join('')}</div>`).join('')
  return `<button class="wsg-bg" data-war="mu" aria-label="${tr('war.sghtml.21')}"></button><div class="wsg-c" data-war="mu-in"><button class="wsg-xb" data-war="mu" aria-label="${tr('war.sghtml.22')}">✕</button><div class="wsg-h"><b>${tr('war.sghtml.23')}</b><span class="wsg-lg"><i class="u">▶</i>${tr('war.sghtml.24')}<i class="d">◀</i>${tr('war.sghtml.25')}</span></div>${tabs}${body}</div>`
}
/** 금 간 자국 — 진 깃발 위에 그어진다 */
const CRACK = '<svg class="wmu-ck" viewBox="0 0 100 120" aria-hidden="true"><path d="M58 0 L46 28 L62 50 L40 76 L55 98 L48 120 M46 28 L24 40 M62 50 L84 62 M40 76 L20 90"/></svg>'
/**
 * 맞부딪는 순간 전장 한가운데 — [우리 깃발] ▶ [적 깃발] 크게. 이기면 금빛이 터지고 ✓ · 배수, 진 깃발이 금 가며 흔들린다.
 * 지면 붉게 ✗ · 우리 깃발이 흔들린다. 맞서면 작은 회색 = 만 (읽지 않고 1초 안에 · 누르기를 막지 않는다)
 */
function muHtml(art: string, mu: RoundMatch): string {
  const f = (k: FlagKey, side: 'us' | 'foe', broke: boolean): string => `<span class="wmu-f ${side}${broke ? ' broke' : ''}"><img src="${keySrc(art, k)}" alt="">${broke ? CRACK : ''}</span>`
  if (mu.k === 'even') return `<div class="wmu even" style="--mus:${P.realm.warMuS}s">${f(mu.us, 'us', false)}<b class="wmu-v">=</b>${f(mu.foe, 'foe', false)}</div>`
  const win = mu.k === 'win'
  const glow = win ? `<img class="wmu-burst" src="${art}fx/gold.png" alt="">` : '<i class="wmu-red"></i>'
  const mid = `<span class="wmu-c"><b class="wmu-k">${win ? '✓' : '✗'}</b><b class="wmu-v">${win ? '▶' : '◀'}</b>${mu.mul !== undefined ? `<em class="wmu-x">${mulText(mu.mul)}</em>` : ''}</span>`
  const a = mu.also
  const also = a === undefined ? '' : `<span class="wmu-also ${a.us ? 'us' : 'foe'}"><img src="${keySrc(art, a.from)}" alt=""><b>${a.us ? '▶' : '◀'}</b><img src="${keySrc(art, a.to)}" alt=""><b>✓</b></span>`
  return `<div class="wmu ${win ? 'win' : 'lose'}" style="--mus:${P.realm.warMuS}s">${glow}${f(mu.us, 'us', !win)}${mid}${f(mu.foe, 'foe', win)}${also}</div>`
}
/** 땅이 주는 수 — 그 땅에서만 깃발에 뜬다 */
const TERRAIN_CMD: ReadonlySet<Cmd> = new Set<Cmd>(['ford', 'rocks', 'gate', 'ram', 'height'])

/** 소리 자리 (형: "공방필살 마지막일격등 상황에 맞게 소리 들어갈곳") — public/sfx 의 활터 소리. 바꾸려면 여기만 */
export const BATTLE_SFX = {
  // 깃발마다 형이 고른 소리 (sound.ts PICK cmd_*) · 맞쏘기는 화살비 소리 (형 10-23: "맞쏘기는 화살 소리여야지")
  charge: snd('cmd_charge'), hold: snd('cmd_hold'), open: snd('cmd_open'), ford: snd('cmd_ford'), rocks: snd('cmd_rocks'), gate: snd('cmd_gate'), ram: snd('cmd_ram'),
  volley: snd('arrow_volley'), counter: snd('cmd_counter'), fire: snd('cmd_fire'), height: snd('cmd_height'),
  // 사람 고함·비명(roar · herodeath · bossdeath)은 걷었다 (형 10-23: "비명소리인지 사람 고함인지 너무 AI 가 만든 티") — 말발굽·쇠·북으로
  flank: snd('cmd_horse'), punch: snd('cmd_horse'), pursue: snd('cmd_horse'), guard: snd('cmd_guard'),
  drum: snd('cmd_drum'), duel: snd('cmd_duel'), capture: snd('cmd_capture'), retreat: snd('cmd_retreat'), art: snd('cmd_art'),
  /** 각성기 — 비기 소리 자리 (짐승 울음은 컷인이 따로 낸다) */
  wake: snd('cmd_art'),
  /** 호궤 — 엽전 대신 곡식이 풀리는 소리 자리 (싸움 소리 고르기 판에서 바꾼다) */
  feast: snd('tap_coin'),
  /** 맞부딪힘 — 상성에서 이겼다(필살) · 그냥 */
  crit: snd('battle_crit'), clash: snd('battle_clash'),
  /** 마지막 일격 · 장수 겨루기 이김 — 형이 싸움 소리 고르기 판에서 고른 것 (10-25) */
  final: 'realm/sfx/battle_final_c1.ogg', duelWin: 'realm/sfx/battle_duelwin_c2.ogg',
  /** 사로잡았다 · 장수 겨루기 · 마지막 일격(적이 무너졌다) · 이겼다 · 졌다 */
  caught: snd('capt_lock'), win: snd('horn_victory'), lose: snd('bad_big'),
  /** 싸움이 열린다 — 북 두 번, 종 한 번, 함성 */
  openDrum: snd('tap_drum'), openBell: snd('war_bell'), cry: snd('war_cry'),
} as const

/**
 * 타는 고을 — 불꽃 한 장을 늘였다 줄였다 하면 어색했다 (형 10-23: "불타는 이미지는 어색하지 않게"). 작은 불길 여럿이 저마다 솟았다 스러지고
 * 불티가 낱낱이 날아오른다 (이펙트는 낱낱이 — 덩어리를 흔들지 않는다). 자리는 늘 같다(꾸밈이라 판정과 상관없다)
 */
const FLAMES = 6
const EMBERS = 8
export function burnHtml(art: string, side: 'l' | 'r'): string {
  const h = (i: number, k: number): number => { const x = Math.sin(i * 12.9898 + k * 78.233 + (side === 'l' ? 0 : 17)) * 43758.5453; return x - Math.floor(x) }
  let s = `<div class="wburn ${side}"><i class="bed"></i>`
  for (let i = 0; i < FLAMES; i++) {
    s += `<img src="${art}fx/fire.png" alt="" style="--x:${(h(i, 1) * 100).toFixed(0)}%;--s:${(0.55 + h(i, 2) * 0.7).toFixed(2)};--t:${(-h(i, 3) * 2).toFixed(2)}s;--d:${(1.6 + h(i, 4) * 1.2).toFixed(2)}s">`
  }
  for (let i = 0; i < EMBERS; i++) {
    s += `<b style="--x:${(h(i, 5) * 100).toFixed(0)}%;--t:${(-h(i, 6) * 2.4).toFixed(2)}s;--d:${(1.6 + h(i, 7) * 1.4).toFixed(2)}s;--w:${Math.round(-30 + h(i, 8) * 60)}px"></b>`
  }
  return s + '</div>'
}

/**
 * 전장 한가운데 물 한 줄기 (SVG · 상자 비율대로 늘어난다) — 나루·갈대 물가는 강, 갯벌은 젖은 진흙과 물웅덩이.
 * 위(지평선 쪽)는 좁고 흐리게, 아래는 넓게 — 진의 원근과 맞춘다. 물결 줄은 천천히 흘러내린다 (CSS wrvflow)
 */
/** 물길의 가운데 · 반폭 (상자 세로 y% 에서) — 굽이치며(사인) 아래로 갈수록 넓어진다 (원근) */
const rvC = (y: number): number => 50 + 3.4 * Math.sin((y - 18) * 0.078) - (y - 18) * 0.018
const rvW = (y: number): number => 1.1 + (y - 18) * 0.072
/** 둑 선 하나 — 위(18)에서 아래(100)로, 가운데에서 side·(반폭+더) 만큼 */
const rvEdge = (side: -1 | 1, more: number): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  for (let y = 18; y <= 100; y += 2) out.push([rvC(y) + side * (rvW(y) + more * (0.4 + (y - 18) / 82)), y])
  return out
}
const rvPoly = (more: number): string => {
  const l = rvEdge(-1, more)
  const rr = rvEdge(1, more).reverse()
  return `M${[...l, ...rr].map(([x, y]) => `${x.toFixed(2)} ${y}`).join(' L')} Z`
}
const rvLine = (side: -1 | 1): string => `M${rvEdge(side, 0).map(([x, y]) => `${x.toFixed(2)} ${y}`).join(' L')}`

export function waterSvg(mud: boolean, shift = 0): string {
  // shift — 상자 가로 % 만큼 옆으로 비켜 흐른다 (고을 싸움에서 치는 쪽 앞으로)
  const at = shift !== 0 ? ` style="transform:translateX(${shift}%)"` : ''
  const band = rvPoly(0)
  const bank = rvPoly(1.8)
  if (mud) {
    const pools = [[49.5, 46, 2.6, 1.1], [51.8, 62, 3.6, 1.4], [48, 78, 4.4, 1.7], [53, 91, 5, 1.8]]
      .map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#wrvP)"/>`).join('')
    return `<svg class="wrv mud"${at} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>`
      + `<linearGradient id="wrvM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b5a44" stop-opacity="0"/><stop offset=".22" stop-color="#5e4c36" stop-opacity=".85"/><stop offset="1" stop-color="#3e2f20"/></linearGradient>`
      + `<radialGradient id="wrvP"><stop offset="0" stop-color="#b8cfd6" stop-opacity=".85"/><stop offset=".7" stop-color="#7f9aa2" stop-opacity=".6"/><stop offset="1" stop-color="#4a5a5e" stop-opacity="0"/></radialGradient></defs>`
      + `<path d="${bank}" fill="#7a6648" opacity=".55"/><path d="${band}" fill="url(#wrvM)"/>`
      + `<path d="M50 24 C49 40, 52 52, 50.5 66 S48 86, 50 100" fill="none" stroke="#9fb6bd" stroke-width=".6" opacity=".55"/>${pools}`
      + `<path class="wrv-gloss" d="M48.5 50 Q50 49, 51.5 50 M47 70 Q50 69, 53 70 M46 88 Q50 87, 54 88" fill="none" stroke="#e8f2f4" stroke-width=".35"/></svg>`
  }
  // 물결 — 물길 가운데를 따라 짧은 반짝임이 천천히 흘러내린다
  const ripples = [28, 37, 46, 55, 64, 73, 82, 91].map((y, i) => {
    const w = rvW(y) * 0.5
    const x = rvC(y) + (i % 2 === 0 ? -1 : 1) * rvW(y) * 0.3
    return `<path class="wrv-rip" style="--i:${i}" d="M${(x - w).toFixed(2)} ${y} Q${x.toFixed(2)} ${(y - 0.7).toFixed(1)}, ${(x + w).toFixed(2)} ${y}" fill="none" stroke="#e8f6f8" stroke-width=".3"/>`
  }).join('')
  return `<svg class="wrv"${at} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>`
    + `<linearGradient id="wrvW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fbccb" stop-opacity="0"/><stop offset=".2" stop-color="#6aa5b6" stop-opacity=".55"/><stop offset=".55" stop-color="#3b7c90" stop-opacity=".72"/><stop offset="1" stop-color="#245a70" stop-opacity=".8"/></linearGradient>`
    + `<linearGradient id="wrvB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a7a52" stop-opacity="0"/><stop offset=".25" stop-color="#7d6c48" stop-opacity=".35"/><stop offset="1" stop-color="#5e4e32" stop-opacity=".55"/></linearGradient></defs>`
    + `<path d="${bank}" fill="url(#wrvB)"/><path d="${band}" fill="url(#wrvW)"/>`
    + `<path d="${rvLine(-1)}" fill="none" stroke="#eef6ee" stroke-width=".4" stroke-dasharray="2 1.4" opacity=".5"/><path d="${rvLine(1)}" fill="none" stroke="#eef6ee" stroke-width=".4" stroke-dasharray="1.6 1.8" opacity=".45"/>`
    + `${ripples}</svg>`
}

/** 0..1 — 같은 자리 같은 값 (말뚝마다의 생김새) */
const jit = (i: number, k: number): number => (((i * 73 + k * 151) % 97) + 0.5) / 97

/**
 * 해자 — 지키는 쪽 진 앞의 한 줄기 물길 (tp 와 같은 비스듬함: x = 54 + oy·0.22, 위가 멀다).
 * 바깥 둑 · 물 · 안쪽 거친 둑 · 천천히 흘러내리는 반짝임 — 한 장으로 이어진다
 */
function moatSvg(mirror: boolean): string {
  const pts = (off: number): string => {
    const L: string[] = []
    for (let y = 18; y <= 100; y += 4) {
      const oy = y - 60
      const w = 1.6 + (y - 18) * 0.045 // 가까울수록 넓다
      L.push(`${(54 + oy * 0.22 + off * w).toFixed(2)} ${y}`)
    }
    return L.join(' L')
  }
  const band = `M${pts(-1)} L${pts(1).split(' L').reverse().join(' L')} Z`
  const bank = `M${pts(-1.6)} L${pts(1.5).split(' L').reverse().join(' L')} Z`
  const rip = [30, 42, 54, 66, 78, 90].map((y, i) => {
    const x = 54 + (y - 60) * 0.22
    const w = 0.8 + (y - 18) * 0.02
    return `<path class="wrv-rip" style="--i:${i}" d="M${(x - w).toFixed(2)} ${y} Q${x.toFixed(2)} ${y - 0.6}, ${(x + w).toFixed(2)} ${y}" fill="none" stroke="#e8f6f8" stroke-width=".25"/>`
  }).join('')
  return `<svg class="wf-moat${mirror ? ' mir' : ''}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>`
    + `<linearGradient id="wmtW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f8f98" stop-opacity=".35"/><stop offset=".4" stop-color="#3f6f7c" stop-opacity=".8"/><stop offset="1" stop-color="#284f5c" stop-opacity=".92"/></linearGradient>`
    + `<linearGradient id="wmtB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e5e40" stop-opacity=".25"/><stop offset="1" stop-color="#4e3e28" stop-opacity=".7"/></linearGradient></defs>`
    + `<path d="${bank}" fill="url(#wmtB)"/><path d="${band}" fill="url(#wmtW)"/>`
    + `<path d="M${pts(-1)}" fill="none" stroke="#2a2016" stroke-width=".35" opacity=".6"/><path d="M${pts(1)}" fill="none" stroke="#2a2016" stroke-width=".35" opacity=".6"/>${rip}</svg>`
}

/**
 * 목책 — 말뚝 하나하나 (tp 와 같은 비스듬함: x = 47.5 + oy·0.22). 굵기·높이·기울기가 저마다 다르고, 말뚝마다 두 줄 새끼줄로 묶었다.
 * 도읍·산성(gate)은 가운데에 망루 둘과 성문. 깨졌으면(broken) 말뚝이 꺾이고·쓰러지고·빠지고, 가로대가 끊기고, 그을린다
 */
function stakes(art: string, broken: boolean, gate: boolean): string {
  // 말뚝 그림 — 제미나이 Argon 한 장에서 덩어리마다 떼어 냈다 (tools/cut-sprites.py · fx/field/stake-NN):
  //   01~03 키 큰 통나무(망루 기둥) · 04~09 성한 말뚝 여섯 · 10~13 꺾인 것 · 14~17 그을린 것 (형 10-26: "목책 될 만한 나무 하나 이미지들을 여러 개 받아서")
  const img = (k: number, cls: string, x: number, oy: number, hk: number, r: number, z: number): string =>
    `<img class="${cls}" src="${art}fx/field/stake-${String(k).padStart(2, '0')}.png" alt="" style="--x:${x.toFixed(2)}%;--oy:${oy.toFixed(1)}%;--p:${(1 + oy / 140).toFixed(3)};--hk:${hk.toFixed(2)};--r:${r.toFixed(1)}deg;z-index:${z}">`
  let h = '<span class="wf-pal' + (broken ? ' broken' : '') + '">'
  const N = 24
  for (let i = 0; i < N; i++) {
    const oy = -40 + (80 * i) / (N - 1)
    if (gate && Math.abs(oy) < 6.5) continue // 성문 자리
    const x = 47.5 + oy * 0.22 + (jit(i, 7) - 0.5) * 0.6
    let k = 4 + Math.floor(jit(i, 1) * 6)
    let r = (jit(i, 2) - 0.5) * 6
    let hk = 0.9 + jit(i, 3) * 0.22
    if (broken) {
      const q = jit(i, 4)
      if (q < 0.18) continue // 빠진 말뚝
      if (q < 0.45) { k = 10 + Math.floor(jit(i, 5) * 4); r = (jit(i, 6) - 0.5) * 30 } // 꺾였다
      else if (q < 0.8) k = 14 + Math.floor(jit(i, 5) * 4) // 그을렸다
      else { r = (jit(i, 6) < 0.5 ? -1 : 1) * (40 + jit(i, 5) * 30); hk *= 0.9 } // 넘어간다
    }
    h += img(k, 'stk', x, oy, hk, r, 10 + Math.round(oy + 40))
  }
  if (gate) {
    // 성문 — 키 큰 통나무 둘씩 망루 기둥 · 사이에 널문
    for (const [oy, k] of [[-8, 1], [-6.5, 3], [6.5, 2], [8, 1]] as const) h += img(k, 'stk tall', 47.5 + oy * 0.22, oy, 1, broken && oy > 0 ? 18 : 0, 10 + Math.round(oy + 40))
    h += `<i class="gatedoor${broken ? ' smashed' : ''}" style="--x:47.5%;--oy:0%;z-index:50"></i>`
  }
  return h + '</span>'
}

/** 강둑의 갈대 — [상자 가로 %, 진의 세로 oy, 크기]. waterSvg 의 둑 선을 따라 (tp 의 원근 기울기는 빼고 넣는다) */
const REEDS_AT: ReadonlyArray<readonly [number, number, number]> = [
  ...[-30, -8, 16, 34].map((oy, i): readonly [number, number, number] => [rvC(60 + oy) - rvW(60 + oy) - 1.2, oy, 0.7 + i * 0.13]),
  ...[-26, -2, 22, 38].map((oy, i): readonly [number, number, number] => [rvC(60 + oy) + rvW(60 + oy) + 1.2, oy, 0.65 + i * 0.13]),
]

/** 한 합이 풀리는 사이 (초) — 깃발 → 이야기 → 사람 수 */
const STAGE_S = [0, 1.1, 2.4] as const

/** 「?」 설명 펼침 — 이 기기에서만 기억 */
const HELP_KEY = 'hanbal.realm.warHelp'
const SPEED_KEY = 'hanbal.realm.warSpeed'
/**
 * 새 전투 시험 (BATTLE-LIVE 0번 · 형 10-28: 지금 전투에 바로 넣지 말고 켜고 끄며 지인과 해 본다) — 첫 화면 단추로 이 기기에서만 켠다.
 * 켜면: 손가락이 권하는 깃발·「전투 개시」를 가리키고 · 고르면 큰 깃발이 뜨고 진이 움찔하고 · 숫자 표는 「자세히」 안으로
 */
export const B0_KEY = 'hanbal.realm.battle0'
export function b0On(): boolean {
  try { return localStorage.getItem(B0_KEY) === '1' } catch { return false }
}
const ROUND_KEYS = ['war.round.1', 'war.round.2', 'war.round.3', 'war.round.4', 'war.round.5', 'war.round.6'] as const
/** 장수를 골라야 하는 깃발 — 비기(누가 쓰나) · 겨루기(누가 나서나) · 사로잡기(누구를 잡나) */
const WHO_KINDS = ['art', 'duel', 'capture'] as const
/** 비기 깃발에 걸 비기 — 「누가 비기를 쓰나」에서 고른 장수의 것 · 안 골랐으면 처음 보인 것 */
const artFor = (p: Pending, who: string | undefined): Art | undefined => (who !== undefined ? p.heroes?.find((x) => x.id === who && x.art !== undefined && !x.artUsed)?.art : undefined) ?? p.art

/**
 * 해시계 (형 10-26: "유저는 언제 전투가 끝나는지도 모르고 갑자기 끝나버려서 당황스러울거같은데" · "야습이나 야간전투 같은건 어떻게함?") —
 * 낮 싸움은 아침 → 한낮 → 해거름 → 해질녘, 기습·야습은 한밤 → 깊은 밤 → 동틀 녘 → 새벽. 한 때가 한 합. 작은 싸움은 늦게 붙어 앞 때가 빠진다.
 * 마지막 때 너머(한 합 더)는 낮 싸움이면 밤, 밤 싸움이면 아침.
 */
const DAY_SLOT = ['war.daySlot.1', 'war.daySlot.2', 'war.daySlot.3', 'war.daySlot.4'] as const
const NIGHT_SLOT = ['war.nightSlot.1', 'war.nightSlot.2', 'war.nightSlot.3', 'war.nightSlot.4'] as const
export function slotName(ck: Clock, i: number): string {
  if (i >= ck.slots) return ck.night ? tr('war.slotname.1') : tr('war.slotname.2')
  const names = ck.night ? NIGHT_SLOT : DAY_SLOT
  return tr(names[Math.max(0, names.length - ck.slots + i)] ?? names[0])
}
const COUNT_KEYS = ['war.countWord.1', 'war.countWord.2', 'war.countWord.3', 'war.countWord.4', 'war.countWord.5'] as const
/** 마지막 때의 고름 — 이름 */
export function duskName(d: Dusk, night: boolean): string {
  return d === 'camp' ? tr('war.duskname.1') : d === 'retreat' ? tr('war.duskname.2') : night ? tr('war.duskname.3') : tr('war.duskname.4')
}

/**
 * 해시계 줄 — 전장 머리에 늘 보인다. 지난 때는 흐리게, 지금 때는 빛나고, 남은 합을 말로 (「해 지기까지 두 합」 · 「새벽까지 한 합」).
 * 마지막 때는 붉게 「오늘 마지막 합」 — 끝이 오는 것이 미리 보인다
 */
export function clockHtml(l: BattleLine, shown: number): string {
  const ck = l.clock
  if (ck === undefined) return ''
  const p = l.pending
  const rounds = l.rounds ?? []
  const ended = p === undefined && shown >= rounds.length
  const now = p !== undefined && p.round === shown ? p.round : Math.max(0, shown - 1)
  // 보이는 데까지만 — 시험 돌림은 고를 자리 뒤를 맡긴 셈으로 끝까지 돌려 두었다 (그 합들은 아직 안 일어났다)
  const over = Math.max(shown, p !== undefined && p.round === shown && p.dusk === undefined ? p.round + 1 : 0)
  const n = Math.max(ck.slots, over)
  let pips = ''
  for (let i = 0; i < n; i++) {
    // 칸 이름은 ck- 로 — .ap .next 는 「다음 계절」 단추라 겹쳤다 (메모리: CSS 이름 겹침)
    const cls = i < now || (ended && i === now) ? 'ck-past' : i === now ? 'ck-now' : 'ck-next'
    const dark = nightAt({ clock: { ...ck, edge: false } }, i)
    pips += `<li class="${cls}${dark ? ' ck-dark' : ''}${i >= ck.slots ? ' ck-over' : ''}">${slotName(ck, i)}</li>`
  }
  let left: string
  let cls = ''
  if (p !== undefined && p.dusk !== undefined && p.round === shown) {
    left = ck.night ? tr('war.clockhtml.1') : tr('war.clockhtml.2')
    cls = ' ask'
  } else if (p !== undefined && p.round === shown) {
    const k = ck.slots - p.round
    if (k <= 0) left = ck.night ? tr('war.clockhtml.3') : tr('war.clockhtml.4')
    else if (k === 1) { left = ck.night ? tr('war.clockhtml.5') : tr('war.clockhtml.6'); cls = ' last' }
    else left = tr('war.clockhtml.9', { v1: ck.night ? tr('war.clockhtml.7') : tr('war.clockhtml.8'), v2: k === 0 ? '' : nth(COUNT_KEYS, k - 1) ?? k })
  } else if (ended) left = tr('war.clockhtml.10')
  else left = tr('war.clockhtml.11', { slotName: slotName(ck, now) })
  const mark = ck.night ? `<em class="wclk-m">${tr('war.slotname.2')}</em>` : ''
  return `<div class="wclk${ck.night ? ' night' : ''}${cls}">${mark}<ol>${pips}</ol><b>${esc(left)}</b></div>`
}

/** 마지막 때의 고름 한 줄 — 지난 합들 사이에 (해질녘 — 우리: 진을 친다 · 적: 한 합 더) */
function duskRow(d: DuskLog, ck: Clock, ourS: 'a' | 'd'): string {
  const foeS: 'a' | 'd' = ourS === 'a' ? 'd' : 'a'
  const pick = (x: 'a' | 'd'): Dusk => (x === 'a' ? d.a : d.d)
  const who = (x: 'a' | 'd'): string => (x === ourS ? tr('war.duskrow.whoUs') : tr('war.duskrow.whoFoe'))
  const cost = (x: 'a' | 'd'): string => {
    const g = d.grain?.[x]
    if (g !== undefined) return ` <small class="wdkc">${tr('war.duskrow.3', { g })}</small>`
    if (d.hungry?.[x] === true) return ` <small class="wdkc bad">${tr('war.duskrow.4')}</small>`
    return ''
  }
  // 따라잡힌 쪽은 「물러난다」를 골랐다 — 판정은 진을 친 것으로 바뀌었어도 고른 것을 보인다
  const chose = (x: 'a' | 'd'): Dusk => (d.caught === x ? 'retreat' : pick(x))
  const line = (x: 'a' | 'd'): string => `<span class="wdkp ${x === ourS ? 'us' : 'foe'} ${chose(x)}"><em>${who(x)}</em>${esc(duskName(chose(x), ck.night))}${pick(x) === 'press' ? cost(x) : ''}</span>`
  let res: string
  const back = (['a', 'd'] as const).filter((x) => pick(x) === 'retreat')
  if (d.caught !== undefined) res = tr('war.duskrow.7', { who: who(d.caught), v1: ck.night ? tr('war.duskrow.5') : tr('war.duskrow.6') })
  else if (back.length === 2) res = ck.night ? tr('war.duskrow.8') : tr('war.duskrow.9')
  else if (back.length === 1) res = tr('war.duskrow.11', { who: who(back[0]!), v1: ck.night ? tr('war.duskrow.10') : tr('war.duskrow.6') })
  else if (pick('a') === 'press' || pick('d') === 'press') {
    const by = (['a', 'd'] as const).filter((x) => pick(x) === 'press')
    const who2 = by.length === 2 ? tr('war.duskrow.12') : tr('war.duskrow.subj', { who: who(by[0]!) })
    res = ck.night ? tr('war.duskrow.13', { who2 }) : tr('war.duskrow.14', { who2 })
  } else res = tr('war.duskrow.15')
  const when = d.at >= ck.slots + 1 ? (ck.night ? tr('war.slotname.1') : tr('war.slotname.2')) : ck.night ? tr('war.duskrow.16') : tr('war.duskrow.17')
  return `<div class="wrd wdkrow${ck.night ? ' night' : ''}"><div class="wrn">${tr('war.duskrow.18', { when })}</div><div class="wdkps">${line(ourS)}${line(foeS)}</div><p class="wpush">${esc(res)}</p></div>`
}

/** 진을 치면 어떻게 정해지나 — 우리 눈의 말 (고을을 치는 쪽 · 지키는 쪽 · 들판) */
function campWord(l: BattleLine, weAtk: boolean, camp: DuskAsk['camp']): string {
  if (l.field === true) return camp === 'win' ? tr('war.sghtml.24') : camp === 'lose' ? tr('war.sghtml.25') : tr('war.campword.1')
  if (weAtk) return camp === 'win' ? tr('war.campword.2') : camp === 'lose' ? tr('war.campword.3') : tr('war.campword.4')
  return camp === 'lose' ? tr('war.campword.5') : tr('war.campword.6')
}

/**
 * 마지막 때의 큰 판 — 해가 진다(밤 싸움이면 날이 밝는다). 깃발 대신 셋을 묻는다 (WWE: 하늘이 바뀌고 종이 울린다).
 * 진을 친다 — 지금 판세로 정해진다 · 한 합 더 — 곡식과 사기가 든다 · 물러난다 — 이 싸움은 진다
 */
function duskHtml(l: BattleLine, a: DuskAsk, weAtk: boolean, art: string, anim: boolean, delay: number): string {
  const pc = Math.round(Math.max(0, Math.min(1, a.edge)) * 100)
  const sky = a.night ? 'dawn' : 'dusk'
  const press = a.night ? tr('war.duskname.3') : tr('war.duskname.4')
  const pressDoes = a.night ? tr('war.duskhtml.1') : tr('war.duskhtml.2')
  const cost = a.hasGrain ? `<span class="wfcost">${tr('war.duskhtml.3', { grain: a.grain })}</span><span class="wfcost">${tr('war.duskhtml.4', { morale: a.morale })}</span>` : `<span class="wfcost bad">${tr('war.duskhtml.5', { morale: a.morale })}</span>`
  const back = l.field === true ? tr('war.duskhtml.6') : weAtk ? tr('war.duskhtml.7') : tr('war.duskhtml.8')
  const btn = (d: Dusk, name: string, does: string, extra: string, img: Cmd): string =>
    `<button class="wdkb ${d}" data-war="dusk" data-c="${d}"><img class="wflag" src="${flagSrc(art, img)}" alt=""><span class="wct"><b>${esc(name)}</b>${extra}<small>${esc(does)}</small></span></button>`
  let h = `<div class="wnext wdusk ${sky}"${anim ? ` style="--d:${delay.toFixed(2)}s"` : ''}><div class="wdk-sky"><i></i></div>`
  h += `<b class="wdk-h">${a.night ? tr('war.duskhtml.9') : tr('war.duskhtml.10')}</b><p class="wdk-s">${tr('war.duskhtml.11')}</p>`
  h += `<p class="wdk-now">${tr('war.duskhtml.12')} <b class="us">${tr('war.duskhtml.13', { pc })}</b> : <b class="foe">${tr('war.duskhtml.14', { v1: 100 - pc })}</b>${tr('war.duskhtml.15')} <b class="wdk-${a.camp}">${esc(campWord(l, weAtk, a.camp))}</b></p>`
  h += `<div class="wdkg">`
  // 확실히 지는 고름은 내놓지 않는다 — 진을 쳐서 지면 「진을 친다」를, 진을 쳐서 이기면 「물러난다」(물러나면 진다)를 뺀다 (형 10-31: "패배하는 선택지가 왜 있는거임 · 그걸 누가 선택해")
  if (a.camp !== 'lose') h += btn('camp', tr('war.duskname.1'), tr('war.duskhtml.16'), `<em class="wdk-${a.camp}">${esc(campWord(l, weAtk, a.camp))}</em>`, 'hold')
  h += btn('press', press, pressDoes, cost, a.night ? 'charge' : 'fire')
  const rp = a.retreatP !== undefined ? `<span class="wf-${retreatCls(a.retreatP)}">${tr('war.duskhtml.17', { round: Math.round(a.retreatP * 100) })}</span>` : ''
  const caughtCost = a.retreatFailLoss !== undefined ? `<span class="wfcost bad">${tr('war.duskhtml.18', { retreatFailLoss: a.retreatFailLoss })}</span>` : ''
  if (a.camp !== 'win') h += btn('retreat', tr('war.duskname.2'), tr('war.duskhtml.21', { v1: a.night ? tr('war.duskhtml.19') : tr('war.duskhtml.20'), back }), `${rp}<span class="wfcost">${tr('war.duskhtml.22', { retreatLoss: a.retreatLoss })}</span>${caughtCost}`, 'retreat')
  h += `</div><p class="wdk-n">${tr('war.duskhtml.23')}</p></div>`
  return h
}

export interface WarHost {
  readonly art: string
  /** 도트 시험(연습 싸움) — 겨루기 장수를 anim-px 도트 띠로 (없는 장수는 옛 띠) */
  readonly px?: boolean
  readonly me: string
  ding(name: string, vol?: number, rate?: number, dur?: number): void
  /** 곧 낼 소리를 미리 받아 풀어 둔다 (ding 과 같은 이름) — 처음 한 번이 늦게 나지 않게 */
  warm?(names: readonly string[]): void
  /** 음악 — 싸움이 열리면 싸움 음악, 끝나면 이긴·진 음악 (비기면 그대로) */
  music?(kind: 'war' | 'win' | 'lose'): void
  /** 다 골랐다 — 이 명령들로 진짜 넘긴다 */
  done(tactics: Record<string, Tactic>): void
}

/** 무리의 그림 — 싸움 기록의 잃은 사람 칩 */
const GROUP_ICON: Readonly<Record<Grp, string>> = { front: UNIT_ICON.spear, bows: UNIT_ICON.bow, horse: UNIT_ICON.horse }

/** 무리를 대표하는 병종 그림 — 그 무리에서 가장 많은 병종 (창병·방패병·장창병 · 궁수·쇠뇌 · 기병) */
function groupIcon(mix: Readonly<Partial<Record<string, number>>>, g: Grp | 'lead'): string {
  if (g === 'lead') return 'unit-general'
  const ks = Object.keys(mix).filter((k) => (mix[k] ?? 0) > 0 && (k === 'bow' || k === 'crossbow' ? 'bows' : k === 'horse' ? 'horse' : 'front') === g)
    .sort((p, q) => (mix[q] ?? 0) - (mix[p] ?? 0))
  const k = ks[0] as keyof typeof UNIT_ICON | undefined
  return k !== undefined && UNIT_ICON[k] !== undefined ? UNIT_ICON[k] : GROUP_ICON[g]
}

/** 일의 결과 — 한 일을 한 쪽에서 보아 먹혔나(ok) · 막혔나(no) · 맞섰나(even) */
const ACT_RES: Readonly<Record<Act['res'], 'ok' | 'no' | 'even'>> = {
  won: 'ok', hit: 'ok', ok: 'ok', lost: 'no', blocked: 'no', wasted: 'no', fail: 'no', even: 'even', stall: 'even',
}

/**
 * 한 합의 일을 그림 줄로 (형: "창병 방패병 이런게 아이콘으로 안뜨고 누가 누굴 공격하고 성공했는지 실패했는지가 한눈에 안보여") —
 * [우리/적 · 무리 그림 · 명령] → [맞은편 무리 그림] · ✓ 먹혔다 / ✕ 막혔다 / = 맞섰다 · 맞은편이 잃은 사람.
 * 우리에게 좋은 일은 초록, 나쁜 일은 붉게. 글 이야기는 그 밑에 작게 남는다
 */
/** 그림 줄에 올릴 일 — 북만 치고 겨눈 데가 없는 것은 뺀다 */
const shownActs = (acts: readonly Act[] | undefined): Act[] => (acts ?? []).filter((x) => !(x.c === 'drum' && x.tg === undefined))
export function actRows(acts: readonly Act[] | undefined, ourS: 'a' | 'd', art: string, mixA: Readonly<Partial<Record<string, number>>>, mixD: Readonly<Partial<Record<string, number>>>): string {
  const list = shownActs(acts)
  if (list.length === 0) return ''
  return `<div class="wacts">${list.map((x) => actRow(x, ourS, art, mixA, mixD)).join('')}</div>`
}
/** 굵은 화살표 — 우리 일은 오른쪽(→), 적의 일은 CSS 로 뒤집어 왼쪽(←) */
const ACT_ARW = '<svg class="arw" viewBox="0 0 30 18" aria-hidden="true"><path d="M1 6.5h17V1l11 8-11 8v-5.5H1z"/></svg>'
/** 누가 누구를 · 됐나 — 한 줄 */
function actRow(x: Act, ourS: 'a' | 'd', art: string, mixA: Readonly<Partial<Record<string, number>>>, mixD: Readonly<Partial<Record<string, number>>>): string {
  const mixOfS = (s: 'a' | 'd'): Readonly<Partial<Record<string, number>>> => (s === 'a' ? mixA : mixD)
  let h = ''
  {
    const us = x.s === ourS
    const other = x.s === 'a' ? 'd' : 'a'
    const r = ACT_RES[x.res]
    const good = r === 'even' ? '' : (r === 'ok') === us ? ' good' : ' bad'
    const verb = x.c === 'art' && x.art !== undefined ? ART_NAME[x.art] : x.c === 'wake' && x.wake !== undefined ? WAKE_NAME[x.wake] : CMD_NAME[x.c]
    // 표시와 말은 늘 우리 눈으로 — 우리 일: 「우리 무리 → 적 무리 · 먹혔다」 · 적의 일은 거울로: 「당했다 · 우리 무리 ← 적 무리 적」
    // (형 11-02: "우리꺼였으면 적은 「당했다 ~병 ← 어쩌구 적」 이런 식으로 거꾸로 · 화살표도 두껍게")
    const badge = good === ' good' ? '✓' : good === ' bad' ? '✕' : '='
    const word = us
      ? (r === 'ok' ? (x.tg !== undefined ? tr('war.actrow.1') : tr('war.actrow.2')) : r === 'no' ? (x.res === 'wasted' ? tr('war.actrow.3') : x.c === 'retreat' ? tr('war.actrow.4') : tr('war.actrow.5')) : tr('war.actrow.6'))
      : (r === 'ok' ? (x.tg !== undefined ? tr('war.actrow.7') : tr('war.actrow.2')) : r === 'no' ? (x.res === 'wasted' ? tr('war.actrow.3') : x.c === 'retreat' ? tr('war.actrow.8') : tr('war.actrow.9')) : tr('war.actrow.6'))
    const who = `<span class="who">${us ? tr('war.duskrow.1') : tr('war.duskrow.2')}</span>`
    const self = `<img src="${art}icon/${groupIcon(mixOfS(x.s), x.g)}.png" alt=""><b>${esc(verb)}</b>`
    const tgt = x.tg !== undefined ? `<img class="tg" src="${art}icon/${groupIcon(mixOfS(other), x.tg)}.png" alt="">` : ''
    const res = `<span class="res">${badge} ${word}</span>`
    let tail = ''
    if ((x.tl ?? 0) > 0) tail += `<span class="loss">${us ? tr('war.duskrow.2') : tr('war.duskrow.1')} −${x.tl}</span>`
    if ((x.sl ?? 0) > 0) tail += `<span class="loss own">${us ? tr('war.duskrow.1') : tr('war.duskrow.2')} −${x.sl}</span>`
    // 물러나기 — 잃은 수만 있으면 「−21」을 남은 수로 읽었다 (형 10-25: "330명이 21명 됐음 · 21명이 죽은 거 아닌가?") — 빠져나간 수를 곁에
    if (x.c === 'retreat' && x.res === 'ok' && x.n !== undefined) tail += `<span class="kept">${tr('war.actrow.10', { n: x.n })}</span>`
    h += us
      ? `<div class="wact us${good}">${who}${self}${tgt !== '' ? `${ACT_ARW}${tgt}` : ''}${res}${tail}</div>`
      : `<div class="wact foe${good}">${res}${tail}${tgt !== '' ? `${tgt}${ACT_ARW}` : ''}${self}${who}</div>`
  }
  return h
}
/**
 * 합 결과 두 줄 창 — 일어난 일을 그 깃발 연출이 나올 때 한 줄씩 띄우고, 두 줄이 차면 위로 밀어 올린다 (1·2 → 2·3 → 3·4)
 * (형 10-28: "전투 연출 나오는 동시에 · 싸우는 장면도 보이고 어디가 먹히고 안 먹혔는지")
 */
function tickerHtml(lines: ReadonlyArray<readonly [string, number]>, key: string): string {
  if (lines.length === 0) return ''
  const R = P.realm
  const ls = [...lines].sort((x, y) => x[1] - y[1])
  const step = R.warTickLineH + R.warTickGap
  const end = ls[ls.length - 1]![1] + R.warTickMove + 0.05
  const pc = (t: number): string => `${Math.min(100, Math.max(0, (t / end) * 100)).toFixed(2)}%`
  let fr = '0%{transform:translateY(0)}'
  let was = 0
  ls.forEach(([, t], i) => {
    if (i < 2) return
    const at = Math.max(t, was)
    fr += `${pc(at)}{transform:translateY(${-(i - 2) * step}px)}${pc(at + R.warTickMove)}{transform:translateY(${-(i - 1) * step}px)}`
    was = at + R.warTickMove
  })
  fr += `100%{transform:translateY(${-Math.max(0, ls.length - 2) * step}px)}`
  return `<div class="wtick" style="--th:${R.warTickLineH}px;--tg:${R.warTickGap}px"><style>@keyframes ${key}{${fr}}</style><div class="wtk" style="animation:${key} ${end.toFixed(2)}s linear both">`
    + ls.map(([h, t]) => `<div class="wtl" style="--t:${t.toFixed(2)}s">${h}</div>`).join('') + '</div></div>'
}

/** 원군이 닿은 합의 띠 (형: "열세에 밀린 아군에 로한의 기병대 같은 쾌감") — 우리 원군은 금빛, 적 원군은 붉게 */
export function reliefBanner(rd: RoundLog, ourS: 'a' | 'd', art: string): string {
  const x = rd.relief
  if (x === undefined) return ''
  const us = x.side === ourS
  const ic = x.horse ? UNIT_ICON.horse : UNIT_ICON.spear
  const line = us
    ? (x.horse ? tr('war.reliefbanner.1', { men: x.men }) : tr('war.reliefbanner.2', { men: x.men }))
    : (x.horse ? tr('war.reliefbanner.3', { men: x.men }) : tr('war.reliefbanner.4', { men: x.men }))
  return `<div class="wrelief ${us ? 'us' : 'foe'}"><img src="${art}icon/${ic}.png" alt=""><b>${us ? tr('war.reliefbanner.5') : tr('war.reliefbanner.6')}</b><span>${esc(line)}</span></div>`
}

/** 한 합에 무리마다 잃은 사람 — [무리, 수] (그 합 앞의 무리 수에서 뺀다) */
function groupLoss(before: Readonly<Partial<Record<Grp, number>>>, after: Readonly<Partial<Record<Grp, number>>> | undefined): Array<[Grp, number]> {
  if (after === undefined) return []
  return (['front', 'bows', 'horse'] as const).map((g) => [g, Math.max(0, Math.round((before[g] ?? 0) - (after[g] ?? 0)))] as [Grp, number]).filter(([, n]) => n > 0)
}

/** 맡긴 싸움의 지휘 버릇 — 이름과 한 줄 (tactics.aiOrder 가 실제로 그렇게 싸운다) */
const STYLE_WORD: Readonly<Record<BattleStyle, readonly [string, string]>> = {
  careful: lzTwo('war.styleWord.careful.a', 'war.styleWord.careful.b'),
  archer: lzTwo('war.styleWord.archer.a', 'war.styleWord.archer.b'),
  mountain: lzTwo('war.styleWord.mountain.a', 'war.styleWord.mountain.b'),
  river: lzTwo('war.styleWord.river.a', 'war.styleWord.river.b'),
  steadfast: lzTwo('war.styleWord.steadfast.a', 'war.styleWord.steadfast.b'),
}
/** 맡기면 이 장수는 어떻게 싸우나 — 특성 → 겁 → 지략 → 무예 순으로 (형 10-24: "자동전투는 장수 특성에 따라 효과 나오게") */
export function styleWord(h: { traits?: readonly string[]; ryak: number; mu: number } | undefined): readonly [string, string] {
  if (h === undefined) return [tr('war.styleword.1'), tr('war.styleword.2')]
  const s = BATTLE_STYLES.find((x) => h.traits?.includes(x) === true)
  if (s !== undefined) return STYLE_WORD[s]
  if (h.traits?.includes('coward') === true) return [tr('war.styleword.3'), tr('war.styleword.4')]
  if (h.ryak >= 7) return [tr('war.styleword.5'), tr('war.styleword.6')]
  if (h.mu >= 7) return [tr('war.styleword.7'), tr('war.styleword.8')]
  return [tr('war.styleword.9'), tr('war.styleword.10')]
}

/** 맡겼을 때 — 장수의 지략이 무엇을 해 주나 (aiOrder: 지략만큼 적 앞줄의 버릇을 읽어 맞수를 둔다 · 흔들리는 적에 들이친다) */
function autoLine(h: { name: string; ryak: number } | undefined): string {
  if (h === undefined) return tr('war.autoline.1')
  const full = Math.max(1, Math.min(5, Math.round(h.ryak / 2)))
  const dots = '●'.repeat(full) + '○'.repeat(5 - full)
  const feel = h.ryak >= 8 ? tr('war.autoline.2') : h.ryak >= 6 ? tr('war.autoline.3') : h.ryak >= 4 ? tr('war.autoline.4') : tr('war.autoline.5')
  return `${tr('war.autoline.6', { name: esc(h.name) })} <span class="wdots">${dots}</span>: ${feel}`
}

function face(id: string | null, art: string, fallback: string): string {
  const file = id !== null ? faceFile(id) : undefined
  return file !== undefined ? `<img class="wf" src="${art}bust/${file}.jpg" alt="">` : `<img class="wf unit" src="${art}icon/${fallback}.png" alt="">`
}

/** 사로잡기 — 말과 색으로 (숫자 확률은 안 보인다) */
/** 물러날 가망의 빛 — 사로잡기 말 빛과 같은 결 */
function retreatCls(p: number): string {
  return p >= 0.7 ? 'hi' : p >= 0.5 ? 'mid' : p >= 0.3 ? 'lo' : 'no'
}

function captureWord(p: number): [string, string] {
  if (p >= 0.5) return [tr('war.captureword.1'), 'hi']
  if (p >= 0.3) return [tr('war.captureword.2'), 'mid']
  if (p >= 0.15) return [tr('war.captureword.3'), 'lo']
  if (p >= 0.05) return [tr('war.captureword.4'), 'no']
  return [tr('war.captureword.5'), 'no']
}

/**
 * 그 합의 말 — 눈에 보이는 잃은 수로 정한다 (우리 −37 · 적 −47 이면 우리가 민 것). 필살을 냈는데 "밀렸다"가 뜨면 헷갈린다.
 * 양쪽 다 안 잃었으면 판정의 기세(push)로.
 */
function pushWord(push: number, weAtk: boolean, lostUs: number, lostFoe: number): [string, string] {
  const p = lostUs + lostFoe > 0 ? lostFoe / (lostUs + lostFoe) : weAtk ? push : 1 - push
  if (p >= 0.62) return [tr('war.pushword.1'), 'good']
  if (p >= 0.53) return [tr('war.pushword.2'), 'good']
  if (p <= 0.38) return [tr('war.pushword.3'), 'bad']
  if (p <= 0.47) return [tr('war.pushword.4'), 'bad']
  return [tr('war.pushword.5'), '']
}

/** 싸움 앞의 한 줄 — 진군 방식과 기습의 결과 (우리 쪽 시점) */
function introLine(l: BattleLine, weAtk: boolean, foe: string): string {
  if (l.field === true) return tr('war.introline.1')
  const ap = l.approach ?? 'road'
  if (!weAtk) {
    if (l.ambush === 'success') return ap === 'cliff' ? tr('war.introline.2', { foe }) : tr('war.introline.3', { foe })
    if (l.ambush === 'caught') return tr('war.introline.4', { foe })
    return tr('war.introline.5', { foe })
  }
  const ok = l.ambush === 'success'
  switch (ap) {
    case 'road': return tr('war.introline.6')
    case 'night': return ok ? tr('war.introline.7') : tr('war.introline.8')
    case 'ford': return ok ? tr('war.introline.9') : tr('war.introline.10')
    case 'ridge': return ok ? tr('war.introline.11') : tr('war.introline.12')
    case 'cliff': return ok ? tr('war.introline.13') : tr('war.introline.14')
  }
}

/** 한 쪽이 든 깃발들 — 앞줄 · 활 · 기병 · 장수(북은 빼고) */
/**
 * 깃발 그림 — 명령마다 한 폭 (public/realm/flag · 제미나이 Argon 네 장을 잘랐다, assets_src/realm/flags).
 * 형 10-23: "깃발을 고르는 거였다면 돌격·방진·길 트기 같은 카드들을 깃발처럼 이미지 만들어서 UI 고도화 했어야"
 */
export function flagSrc(art: string, c: Cmd, ak?: Art, wk?: Elem): string {
  // 각성기는 깃발 대신 그 기운의 짐승 (fx/awaken · 각성 연출의 그림 그대로 · 새 그림 0장)
  if (c === 'wake') return wk !== undefined ? `${art}fx/awaken/beast-${ELEM[wk].beast}.png` : `${art}flag/flag-drum.png`
  return `${art}flag/flag-${c === 'art' ? (ak !== undefined ? `art-${ak}` : 'drum') : c}.png`
}

function flags(o: RoundOrder | undefined, chip: Cmd, art: string, ak?: Art, wk?: Elem): string {
  const xs: Cmd[] = o === undefined ? [chip] : [o.front, o.bows, o.horse, o.lead !== 'drum' ? o.lead : undefined].filter((c): c is Cmd => c !== undefined)
  // 장수의 비기는 그 비기의 이름·그림으로 (빛나는 칩) · 각성기는 그 기운의 이름과 짐승으로
  return xs.map((c) => (c === 'art' && ak !== undefined
    ? `<span class="wfl art"><img class="flg" src="${flagSrc(art, c, ak)}" alt="">${ART_NAME[ak]}</span>`
    : c === 'wake' && wk !== undefined
      ? `<span class="wfl art"><img class="flg" src="${flagSrc(art, c, undefined, wk)}" alt="">${WAKE_NAME[wk]}</span>`
      : `<span class="wfl"><img class="flg" src="${flagSrc(art, c)}" alt="">${CMD_NAME[c]}</span>`)).join('')
}

/** 싸움터 그림의 땅 — HoMM3 처럼 그 땅이 배경이 된다 (형: "싸울때 배경이 전쟁터 배경이어야") · docs/GAP.md §12 */
export type WarGround = 'field' | 'ford' | 'pass' | 'forest' | 'gate' | 'sea' | 'snow' | 'night'

/**
 * 받아 둔 싸움터 그림 (public/realm/battle/battle-<땅>.jpg). 아직 없는 땅은 있는 장면 그림을 어둡게 깐다 —
 * 그림이 오면 여기에 이름만 더한다 (ART-QUEUE)
 */
const WAR_BG_READY: ReadonlySet<WarGround> = new Set<WarGround>(['field', 'ford', 'pass', 'forest', 'gate', 'sea', 'snow', 'night'])
const WAR_BG_FALLBACK: Readonly<Record<WarGround, string>> = {
  field: 'event/event-goguryeo-hunt', ford: 'event/event-monsoon-ford', pass: 'event/event-goguryeo-hunt', forest: 'event/event-night-raid',
  gate: 'event/event-palisade-build', sea: 'event/event-eight-harbours', snow: 'event/event-winter-ambush', night: 'event/event-night-raid',
}

/** 이 싸움이 어디서 났나 — 밤길 · 겨울 · 성문 · 물 · 길의 종류 순으로 */
export function warGround(r: Realm, l: BattleLine): WarGround {
  const node = r.nodes[l.node]
  if (l.approach === 'night' && l.ambush === 'success') return 'night'
  if (seasonOf(r) === 'winter') return 'snow'
  const via = l.via
  if (via === 'sea' || (l.field !== true && node?.kind === 'port' && via === undefined)) return 'sea'
  if (l.field !== true && node !== undefined && (node.kind === 'fort' || node.kind === 'capital' || node.tags.includes('palisade'))) return 'gate'
  if (via === 'ford' || via === 'reeds' || via === 'mudflat') return 'ford'
  if (via === 'pass') return 'pass'
  if (via === 'forest') return 'forest'
  return 'field'
}

/** def — 우리가 지키는 싸움. 성문 싸움이면 우리 성이 왼쪽에 선 그림으로 (형 10-23: "우리 고을에 쳐들어온 공성전이면 우리 성이 좌측에 있는 이미지여야") */
function warBg(art: string, g: WarGround, def = false): string {
  if (g === 'gate' && def) return `${art}battle/battle-gate-def.jpg`
  return WAR_BG_READY.has(g) ? `${art}battle/battle-${g}.jpg` : `${art}${WAR_BG_FALLBACK[g]}.jpg`
}

/** 그 판의 이름 — 땅에서 딴다 (prose.battleName). 옛 보고처럼 판 기록이 모자라면 곳 이름으로 */
/**
 * 이 싸움이 어떤 판인가: 우리의 기습 · 적의 기습 · 우리의 공성 · 적의 공성(수성) · 들판에서 맞붙음 · 우리가 침 · 적이 쳐들어옴.
 * 싸움 이름 왼쪽에 꼬리표로 (형 10-29: "이게 어디서 어떻게 싸운 건지 모르겠어")
 */
export function warKind(r: Realm, l: BattleLine, me: string): { word: string; us: boolean } {
  const weAtk = l.atkFaction === me
  const node = r.nodes[l.node]
  if (l.field === true) return { word: tr('war.warkind.1'), us: weAtk }
  if (l.ambush === 'success') return { word: weAtk ? tr('war.warkind.2') : tr('war.warkind.3'), us: weAtk }
  if (l.ambush === 'caught') return { word: weAtk ? tr('war.warkind.4') : tr('war.warkind.5'), us: !weAtk }
  const walled = node !== undefined && (node.kind === 'fort' || node.kind === 'capital' || node.tags.includes('palisade'))
  if (walled) return { word: weAtk ? tr('war.warkind.6') : tr('war.warkind.7'), us: weAtk }
  return { word: weAtk ? tr('war.warkind.8') : tr('war.warkind.9'), us: weAtk }
}

export function warName(r: Realm, l: BattleLine): string {
  return r.nodes[l.node] !== undefined ? battleName(r, l) : tr('war.warname.1', { v1: l.field === true && l.edge !== undefined ? fieldName(r, l.edge) : l.node })
}


/**
 * 싸움터의 땅 한 칸 — 그림 · 이름 · 무엇이 달라지나 · 누구에게 이로운가 (형 10-25: "지형정보라던가 이런것도 이미지나 아이콘으로 보여야").
 * 판정(season.fortMul · 땅의 수 · 진군 방식)과 같은 규칙만 적는다. VS 화면과 전장 왼쪽 위에 같은 칩이 뜬다
 */
export interface TerrChip { readonly k: string; readonly icon: string; readonly name: string; readonly line: string; readonly who: 'us' | 'foe' | '' }
export const AP_CHIP: Readonly<Record<Approach, readonly [string, string]>> = {
  road: lzPair('route-column', 'war.apChip.road'), night: lzPair('emblem-moon', 'war.apChip.night'), ford: lzPair('route-ferry', 'war.apChip.ford'), ridge: lzPair('emblem-mountain', 'war.apChip.ridge'), cliff: lzPair('route-fortstair', 'war.apChip.cliff'),
}
const AP_EFFECT: Readonly<Record<Approach, readonly [string, string]>> = {
  road: lzTwo('war.apEffect.road.ok', 'war.apEffect.road.bad'),
  night: lzTwo('war.apEffect.night.ok', 'war.apEffect.night.bad'),
  ford: lzTwo('war.apEffect.ford.ok', 'war.apEffect.ford.bad'),
  ridge: lzTwo('war.apEffect.ridge.ok', 'war.apEffect.ridge.bad'),
  cliff: lzTwo('war.apEffect.cliff.ok', 'war.apEffect.cliff.bad'),
}
/** 길목이 드러나는 한 줄 — 「○○의 말대로」 (COUNCIL.md 1주 조각 ③ · 위원회: 남이 캡처하는 건 회의가 아니라 수가 드러나는 순간) */
const GUARD_AT: Readonly<Record<Approach, string>> = { get road() { return tr('war.guardAt.road') }, get night() { return tr('war.guardAt.night') }, get ford() { return tr('war.guardAt.ford') }, get ridge() { return tr('war.guardAt.ridge') }, get cliff() { return tr('war.guardAt.cliff') } }
const CAME_BY: Readonly<Record<Approach, string>> = { get road() { return tr('war.cameBy.road') }, get night() { return tr('war.cameBy.night') }, get ford() { return tr('war.cameBy.ford') }, get ridge() { return tr('war.cameBy.ridge') }, get cliff() { return tr('war.cameBy.cliff') } }
const GUARD_WHY: Readonly<Record<GuardWhy, string>> = {
  get repeat() { return tr('war.guardWhy.repeat') },
  get trait() { return tr('war.guardWhy.trait') },
  get mind() { return tr('war.guardWhy.mind') },
  get land() { return tr('war.guardWhy.land') },
}
function guardChip(r: Realm, l: BattleLine, weAtk: boolean): TerrChip | null {
  const g = l.guarded
  if (g === undefined || l.field === true) return null
  const ap = l.approach ?? 'road'
  const read = ap === g
  // 대로로 왔는데 다른 길목을 지켰다 — 판정에 아무것도 걸리지 않는다(대로는 숨지 않는다 · 성에서 기다린 그대로 맞는다).
  // 「적이 다른 길로 왔다 · 적에게 이롭다」가 떴던 것은 거짓이었다 (형 11-05: "대로로 쳐들어갔거나 성에서 기다렸는데도 길이 엇갈렸다 적에게 이롭다")
  if (ap === 'road' && g !== 'road') return null
  const adv = l.adviser !== undefined ? r.heroes[l.adviser]?.name : undefined
  const [icon] = AP_CHIP[g]
  if (weAtk) {
    if (!read) return { k: 'guard', icon, name: tr('war.guardchip.1'), line: tr('war.guardchip.3', { GUARD_AT: GUARD_AT[g], CAME_BY: CAME_BY[ap], v1: adv !== undefined ? ` ${tr('war.guardchip.2', { adv })}` : '' }), who: 'us' }
    const lead = ap === 'road' ? tr('war.guardchip.4') : tr('war.guardchip.5', { GUARD_AT: GUARD_AT[g] })
    return { k: 'guard', icon, name: tr('war.guardchip.6'), line: `${lead} ${GUARD_WHY[l.gwhy ?? 'land']}${adv !== undefined ? ` ${tr('war.guardchip.7', { adv })}` : ''}`, who: 'foe' }
  }
  // 누가 그 길을 골랐나 — 몸소 고른 길(경계 강화 · 지킬 길)인지, 지키는 장수에게 맡긴 길인지 (형 11-01 FOCUS E: 고른 적 없는 길이 「빗겨나감」으로 보였다)
  const who = l.gord === true ? tr('war.guardchip.8') : tr('war.guardchip.9')
  return read
    ? { k: 'guard', icon, name: tr('war.guardchip.10'), line: tr('war.guardchip.11', { who, AP_CHIP: AP_CHIP[g][1] }), who: 'us' }
    : { k: 'guard', icon, name: tr('war.guardchip.12'), line: tr('war.guardchip.14', { who, GUARD_AT: GUARD_AT[g], CAME_BY: CAME_BY[ap], v1: l.gord === true ? '' : ` ${tr('war.guardchip.13')}` }), who: 'foe' }
}

export function terrChips(r: Realm, l: BattleLine, me: string, foe: string): TerrChip[] {
  const weAtk = l.atkFaction === me
  const def: 'us' | 'foe' = weAtk ? 'foe' : 'us'
  const atk: 'us' | 'foe' = weAtk ? 'us' : 'foe'
  const winter = seasonOf(r) === 'winter'
  const node = r.nodes[l.node]
  // 잠든 채 들이쳐졌으면 지키는 쪽은 땅의 수를 못 쓴다 (season: defTerrain)
  const sleep = l.field !== true && l.ambush === 'success'
  const dw = sleep ? '' : def
  const ds = sleep ? tr('war.terrchips.1') : ''
  const out: TerrChip[] = []
  // 쉬움(촌장) — 우리 쪽 덤이 판정에 늘 걸려 있다. 보이게 맨 앞에 (형 10-27: "쉬운 난이도에서는 전투 혜택도 좀 줘라")
  if ((r.tier ?? 1) < 1 && r.region !== 'tutorial') out.push({ k: 'easy', icon: 'emblem-crown', name: tr('war.terrchips.2'), line: tr('war.terrchips.3', { easyPower: P.realm.easyPower, round: Math.round(P.realm.easyMorale * 100) }), who: 'us' })
  if (l.field === true) out.push({ k: 'road', icon: 'route-column', name: tr('war.terrchips.4'), line: tr('war.terrchips.5'), who: '' })
  else if (node !== undefined) {
    if (node.kind === 'fort') out.push({ k: 'fort', icon: 'settle-mountain-hold', name: tr('war.terrchips.6'), line: tr('war.terrchips.7', { ds }), who: def })
    else if (node.tags.includes('high')) out.push({ k: 'high', icon: 'settle-hill-fort', name: tr('war.terrchips.8'), line: tr('war.terrchips.9', { ds }), who: def })
    if (node.tags.includes('palisade')) out.push({ k: 'palisade', icon: 'settle-palisade', name: tr('war.terrchips.10'), line: tr('war.terrchips.11'), who: def })
    if (node.tags.includes('moat')) out.push(winter ? { k: 'moat', icon: 'settle-moat', name: tr('war.terrchips.12'), line: tr('war.terrchips.13'), who: '' } : { k: 'moat', icon: 'settle-moat', name: tr('war.terrchips.14'), line: tr('war.terrchips.15'), who: def })
    if (node.kind === 'port') out.push({ k: 'port', icon: 'settle-port-town', name: tr('war.terrchips.16'), line: tr('war.terrchips.17'), who: '' })
  }
  const via = l.via
  if (via === 'pass') out.push({ k: 'pass', icon: 'settle-pass', name: tr('war.terrchips.18'), line: tr('war.terrchips.19', { ds }), who: dw })
  else if (via === 'forest') out.push({ k: 'forest', icon: 'settle-clearing', name: tr('war.terrchips.20'), line: tr('war.terrchips.21', { ds }), who: dw })
  else if (via === 'ford') out.push({ k: 'ford', icon: 'route-steppingstones', name: tr('war.terrchips.22'), line: tr('war.terrchips.23', { ds }), who: dw })
  else if (via === 'reeds') out.push({ k: 'ford', icon: 'settle-reed-ambush', name: tr('war.terrchips.24'), line: tr('war.terrchips.23', { ds }), who: dw })
  else if (via === 'mudflat') out.push({ k: 'ford', icon: 'route-boardwalk', name: tr('war.terrchips.25'), line: tr('war.terrchips.26'), who: '' })
  else if (via === 'sea' && node?.kind !== 'port') out.push({ k: 'sea', icon: 'route-searoute', name: tr('war.terrchips.27'), line: tr('war.terrchips.17'), who: '' })
  if (l.field !== true) {
    const ap = l.approach ?? 'road'
    const caught = l.ambush === 'caught'
    const ok = ap === 'road' || l.ambush === 'success'
    const [icon, name] = AP_CHIP[ap]
    const eff = AP_EFFECT[ap][ok ? 0 : 1]
    const mil = l.militia > 0 ? (weAtk ? ` ${tr('war.terrchips.28', { militia: l.militia })}` : ` ${tr('war.terrchips.29', { militia: l.militia })}`) : ''
    out.push({ k: 'ap', icon, name: caught ? tr('war.terrchips.30', { name }) : name, line: `${introLine(l, weAtk, foe)} ${eff}.${mil}`, who: caught ? def : ok ? atk : '' })
    const gc = guardChip(r, l, weAtk)
    if (gc !== null) out.push(gc)
  }
  return out
}

/** 땅 칩 하나 — 그림과 이름 · 밑에 누구에게 유리한지 (테두리·글 색) */
function terrChipHtml(art: string, c: TerrChip, cls: string): string {
  const w = c.who === 'us' ? tr('war.terrchiphtml.1') : c.who === 'foe' ? tr('war.terrchiphtml.2') : tr('war.terrchiphtml.3')
  return `<i class="${cls}${c.who !== '' ? ` ${c.who}` : ''}" data-tk="${c.k}"><img src="${art}icon/${c.icon}.png" alt=""><span><b>${esc(c.name)}</b><small>${w}</small></span></i>`
}

/** 전장 그림 소품(public/realm/fx/field) → 땅 칩 */
const TP_CHIP: Readonly<Record<string, readonly string[]>> = {
  palisade: ['palisade', 'fort', 'high'], broken: ['palisade', 'fort', 'high'], gate: ['fort', 'palisade', 'high'], moat: ['moat'], river: ['ford'], reeds: ['ford'], rocks: ['pass', 'fort', 'high'],
}

/**
 * 전장 정보창 — 무리·장수·낌새·땅을 누르고 있거나(손가락) 마우스를 올리면 (형 10-25: "적진의 속은 … 누르고 있거나 커서 올리면
 * 터치 지역에서 약간 떨어진 왼쪽부분에 전략정보 · 적군의 수나 정보도 그 동적 오브젝트를 터치하거나 커서 올려둘 때").
 * key — omen · terr:<k> · tp:<소품> · grp:<us|foe>:<무리> · gen:<us|foe>
 */
export function warTip(prev: Realm, after: Realm, l: BattleLine, me: string, art: string, sel: RoundOrder, key: string): string {
  const weAtk = l.atkFaction === me
  const st = l.start
  const fname = (f: string | undefined): string => (f !== undefined ? (after.factions[f]?.name ?? '?') : '?')
  const atkF = l.atkFaction ?? prev.armies[l.attacker]?.faction
  const ourF = weAtk ? atkF : l.defender
  const foeF = weAtk ? l.defender : atkF
  const ourI: 0 | 1 = weAtk ? 0 : 1
  const foeI: 0 | 1 = weAtk ? 1 : 0
  const p = l.pending
  const rounds = l.rounds ?? []
  const shown = p !== undefined ? p.round : rounds.length
  const last = rounds[shown - 1]
  const mixOf = (i: 0 | 1): Readonly<Partial<Record<string, number>>> => (i === 1 ? splitMilitia(st?.mix?.[i] ?? {}, l.militia) : st?.mix?.[i] ?? {}) // 지키는 쪽(1)의 농민군은 따로
  const pick = p !== undefined && p.round === shown
  const menOf = (i: 0 | 1, g: Grp): number => {
    if (pick && i === ourI) { const x = p!.groups.find((y) => y.g === g); if (x !== undefined) return x.men }
    if (pick && i === foeI && p!.foe[g] !== undefined) return p!.foe[g]!
    const gm = last !== undefined ? (i === 0 ? last.ga : last.gd) : undefined
    return Math.round((gm ?? groupMen(mixOf(i) as Parameters<typeof groupMen>[0]))[g] ?? 0)
  }
  const head = (side: 'us' | 'foe', icon: string, name: string, sub: string): string =>
    `<div class="wth ${side}"><em class="wck">${side === 'us' ? tr('war.duskrow.1') : tr('war.duskrow.2')}</em>${icon}<b>${esc(name)}</b>${sub !== '' ? `<span>${esc(sub)}</span>` : ''}</div>`
  const flagLine = (c: Cmd, ak?: Art): string => `<p class="wtf"><img src="${flagSrc(art, c, ak)}" alt=""><span><b>${ak !== undefined ? ART_NAME[ak] : CMD_NAME[c]}</b>${esc(ak !== undefined ? ART_DOES[ak] : CMD_DOES[c])}</span></p>`
  const foeList = (): string => {
    const gs = (['front', 'bows', 'horse'] as const).map((g) => [g, menOf(foeI, g)] as const).filter(([, v]) => v > 0)
    return gs.length > 0 ? `<div class="wtl">${gs.map(([g, v]) => `<span><img src="${art}icon/${GROUP_ICON[g]}.png" alt="">${esc(groupLabel(mixOf(foeI), g))} <i>${tr('war.wartip.1', { v })}</i></span>`).join('')}</div>` : ''
  }
  const chips = terrChips(prev, l, me, fname(foeF))
  const terrBox = (c: TerrChip | undefined): string => {
    if (c === undefined) return ''
    const who = c.who === 'us' ? `<em class="wtw us">${tr('war.wartip.2')}</em>` : c.who === 'foe' ? `<em class="wtw foe">${tr('war.wartip.3')}</em>` : ''
    return `<div class="wtt"><img src="${art}icon/${c.icon}.png" alt=""><span><b>${esc(c.name)}</b>${who}</span></div><p>${esc(c.line)}</p>`
  }
  if (key.startsWith('terr:')) return terrBox(chips.find((c) => c.k === key.slice(5)))
  if (key.startsWith('tp:')) {
    const k = key.slice(3)
    if (k === 'arrows') return `<div class="wtt"><img src="${art}fx/field/arrows.png" alt=""><span><b>${tr('war.wartip.4')}</b></span></div><p>${tr('war.wartip.5')}</p>`
    const c = (TP_CHIP[k] ?? []).map((x) => chips.find((y) => y.k === x)).find((y) => y !== undefined)
    return terrBox(c)
  }
  if (key === 'omen') {
    let h = ''
    if (pick && p!.hint !== null) {
      const hint = p!.hint
      const habit = p!.hintSrc === 'habit'
      const hl = habit ? HABIT_LINE[hint] : HINT_LINE[hint]
      h += `<div class="wtt"><img src="${flagSrc(art, hint)}" alt=""><span><b>${habit ? tr('war.wartip.6') : tr('war.wartip.7')}</b><small>${habit ? tr('war.wartip.8') : l.field === true ? tr('war.wartip.9') : weAtk ? tr('war.wartip.10', { turnWord: turnWord(after) }) : tr('war.wartip.11')}</small></span></div>`
      if (hl !== undefined) h += `<p>${esc(hl)}</p>`
      const win = FRONT_COUNTER[hint]
      const lose = (Object.keys(FRONT_COUNTER) as Cmd[]).find((c) => FRONT_COUNTER[c] === hint)
      h += `<div class="wts"><b>${tr('war.wartip.12')}</b>`
      if (win !== undefined) h += `<p class="good">${tr('war.wartip.13', { CMD_NAME: CMD_NAME[win] })}</p>`
      if (lose !== undefined) h += `<p class="bad">${tr('war.wartip.14', { CMD_NAME: esc(CMD_NAME[lose]) })}</p>`
      h += '</div>'
    } else {
      h += `<div class="wtt"><i class="wtq">?</i><span><b>${tr('war.wartip.15')}</b><small>${tr('war.wartip.16')}</small></span></div><p>${tr('war.wartip.17')}</p>`
      h += `<div class="wts"><b>${tr('war.wartip.12')}</b><p>${tr('war.wartip.18')}</p></div>`
    }
    if (pick && p!.foeWaver) h += `<p class="bad">${tr('war.wartip.19')}</p>`
    const fl = foeList()
    if (fl !== '') h += `<div class="wts"><b>${tr('war.wartip.20')}</b>${fl}</div>`
    return h
  }
  const m = /^(grp|gen):(us|foe)(?::(\w+))?$/.exec(key)
  if (m === null) return ''
  const side = m[2] as 'us' | 'foe'
  const i: 0 | 1 = side === 'us' ? ourI : foeI
  if (m[1] === 'gen') {
    const id = st?.heroes[i] ?? null
    const hh = id !== null ? (prev.heroes[id] ?? after.heroes[id]) : undefined
    const f = side === 'us' ? ourF : foeF
    if (hh === undefined) return head(side, '', tr('war.wartip.21', { fname: fname(f) }), '') + `<p>${tr('war.wartip.22')}</p>`
    const [sn, sl] = styleWord(hh)
    let h = head(side, `<span class="wtface">${face(id, art, 'unit-general')}</span>`, hh.name, fname(f)) + `<p><b class="wsty">${esc(sn)}</b> ${esc(sl)}</p>`
    if (side === 'us') {
      const c = pick ? sel.lead : last !== undefined ? (weAtk ? last.oa : last.od)?.lead : undefined
      if (c !== undefined) h += flagLine(c, c === 'art' ? p?.art : undefined)
      else if (pick && p!.lead.length > 0) h += `<p class="dim">${tr('war.wartip.23')}</p>`
    } else if (pick) {
      const [w] = captureWord(p!.capture)
      h += `<p>${tr('war.wartip.24')} <b>${esc(w)}</b> <small class="dim">${tr('war.wartip.25', { squad: p!.squad, escort: p!.escort })}</small></p>`
    }
    return h
  }
  const g = m[3] as Grp
  const icon = `<img src="${art}icon/${GROUP_ICON[g]}.png" alt="">`
  let h = head(side, icon, groupLabel(mixOf(i) as Parameters<typeof groupLabel>[0], g), tr('war.wartip.26', { menOf: menOf(i, g) }))
  const kinds = Object.entries(mixOf(i)).filter(([k, v]) => (v ?? 0) > 0 && groupOf(k as Parameters<typeof groupOf>[0]) === g)
  if (kinds.length > 1) h += `<p class="dim">${tr('war.wartip.28', { map: kinds.map(([k, v]) => `${k === 'militia' ? tr('war.wartip.27') : UNIT_NAME[k as keyof typeof UNIT_NAME]} ${v}`).join(' · ') })}</p>`
  if (side === 'us') {
    const c = pick ? sel[g] : last !== undefined ? (weAtk ? last.oa : last.od)?.[g] : undefined
    if (c !== undefined) h += flagLine(c)
    else if (pick && p!.groups.some((x) => x.g === g && x.options.length > 0)) h += `<p class="dim">${tr('war.wartip.29')}</p>`
    else h += `<p class="dim">${tr('war.wartip.30')}</p>`
  } else {
    if (pick && g === 'front' && p!.hint !== null) {
      const win = FRONT_COUNTER[p!.hint]
      h += `<p>${tr('war.wartip.32')} <b>${OMEN_WORD[p!.hint] ?? CMD_NAME[p!.hint]}</b>${win !== undefined ? ` ${tr('war.wartip.31', { CMD_NAME: esc(CMD_NAME[win]) })}` : ''}</p>`
    } else if (pick && g === 'front') h += `<p class="dim">${tr('war.wartip.33')}</p>`
    else if (!pick && last !== undefined) { const c = (weAtk ? last.od : last.oa)?.[g]; if (c !== undefined) h += flagLine(c) }
    if (pick && p!.foeWaver) h += `<p class="bad">${tr('war.wartip.34')}</p>`
  }
  return h
}

/** 전장 한 판의 화면 — 보인 합(shown)까지. 마지막 합은 천천히 풀린다(anim). sel 은 지금 고르는 깃발 */
/** 활을 쏘는 명령 — 그 합에 화살이 날아간다 */
const SHOOT_CMD: ReadonlySet<string> = new Set(['volley', 'counter', 'open', 'height', 'fire'])
/** 동작 그림(8컷 띠)이 있는 병종 — 0·1 서기 · 2·3 걷기 · 4·5 찌르기 · 6 맞음(안 씀) · 7 쓰러짐 */
const ANIM_SOL = SOL_ANIM_AR // 병종 → 띠 한 칸의 가로세로 비 (art.ts · 지도 유닛도 같이 쓴다)
/** 전장의 진이 직접 보여 주는 무리 명령 — 위 겹의 큰 연출을 띄우지 않는다 */
/**
 * 수군의 그림 — 배를 탄 수군은 물 위 싸움(바닷길·포구)에서만. 땅에서는 걸어서 싸우는 수군(두건·갈고리창·둥근 방패)
 * (형 10-25: "수군이미지는 배태우지말고 … 오직 수상전투 할때만 배탄 수군")
 */
function solArt(k: string, sea: boolean): string {
  // 농민군은 제 그림(anim2/militia.png · 삼베옷·도롱이·돌창 · 제미나이 11-04) — 조금 작게 (.tkm)
  return k === 'boat' && !sea ? 'marine' : k
}
/**
 * 농민군(마을 장정)을 창병에서 떼어 따로 센다 — 화면만. 판정(season.militiaOf)은 장정을 돌창 든 창병으로 지키는 쪽에 더한다.
 * 그대로 그리면 「창병·방패병 1000」으로 보여 정찰(군사 200~300)과 어긋나고 "1000명인데 왜 약하지"가 됐다 (형 11-03)
 */
export function splitMilitia(mix: Readonly<Partial<Record<string, number>>>, militia: number): Readonly<Partial<Record<string, number>>> {
  const sp = mix['spear'] ?? 0
  const m = Math.min(sp, Math.max(0, militia))
  return m > 0 ? { ...mix, spear: sp - m, militia: m } : mix
}
const FIELD_CMD: ReadonlySet<string> = new Set(['charge', 'hold', 'open', 'volley', 'counter', 'flank', 'punch', 'pursue', 'guard', 'drum', 'capture', 'duel', 'retreat'])
/** 장면이 뜨는 장수의 명령 — 비기는 비기마다 (skillfx.ts). 격려는 흔해 장면을 띄우지 않는다 — 합마다 2초씩 전장을 가렸다 (형 10-25 · 전장의 격려 고리로 보인다) */
const CUT_OF: Readonly<Partial<Record<Cmd, SkillId>>> = { duel: 'duel', capture: 'capture', retreat: 'retreat' }
/** 각성기의 장면 뼈대 — 땅은 버텨라(방패) · 바람은 거짓 퇴각(휘감김) · 불은 선봉(돌진) · 물·번개는 아직 안 켰다(realm/elem WAKE_ON) */
const WAKE_CUT: Readonly<Record<Elem, SkillId>> = { earth: 'w-earth', wind: 'w-wind', fire: 'w-fire', water: 'w-water', bolt: 'w-bolt' } // 11-08 제 장면 (전엔 버텨라·거짓 퇴각·선봉·굿·명궁을 빌림)
/** 장면 끝의 갈림 — 먹혔으면 도장, 헛쳤으면 갈라진 먹 (11-08 · 비기 연출 더 고민 · 비김·버팀은 갈림 없이) */
const skillRes = (r: Act['res'] | undefined): 'hit' | 'miss' | null =>
  r === 'hit' || r === 'won' || r === 'ok' ? 'hit' : r === 'wasted' || r === 'fail' || r === 'blocked' || r === 'lost' ? 'miss' : null
/** 장면의 소리 — 장면이 부르는 이름을 싸움 소리로 */
const SK_SFX: Readonly<Record<SkSfx, string>> = {
  whoosh: BATTLE_SFX.art, draw: snd('tap_arms'), release: BATTLE_SFX.counter, impact: BATTLE_SFX.crit, drum: BATTLE_SFX.drum, bell: snd('tap_bell'), rite: snd('tap_rite'),
  cry: BATTLE_SFX.cry, shield: BATTLE_SFX.hold, clatter: snd('tap_arms'), slash: BATTLE_SFX.duel, charge: BATTLE_SFX.charge, retreat: BATTLE_SFX.retreat, capture: BATTLE_SFX.capture, gong: BATTLE_SFX.openBell,
}

/** 맡길 때 장수가 나서는 장면 — 초상 · 한 마디 (기술이 아니라 꾸밈 없이 · 누르면 바로 걷힌다) */
function cutHtml(art: string, hero: string | null, name: string, skill: string, shout: string): string {
  const file = hero !== null ? faceFile(hero) : undefined
  const face = file !== undefined ? `<img class="wcf" src="${art}bust/${file}.jpg" alt="">` : `<img class="wcf unit" src="${art}icon/unit-general.png" alt="">`
  return `<div class="wcut k-lead"><i class="wcbg"></i><div class="wcpf">${face}<i></i></div><div class="wctx${[...shout].length > 7 ? ' long' : ''}"><b>${esc(shout)}</b><span>${esc(name)} · ${esc(skill)}</span></div></div>`
}

/** 싸움터에 날아오르는 불티 — 낱낱이, 자리·크기·빠르기가 조금씩 다르게 (꾸밈이라 판의 시드와 상관없다) */
const AIR_EMBERS = Array.from({ length: 16 }, (_, i) => {
  const f = (k: number): number => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1
  return `<i class="wember" style="--x:${(f(1) * 100).toFixed(1)}%;--s:${(3 + f(2) * 5).toFixed(1)}px;--d:${(6 + f(3) * 7).toFixed(1)}s;--t:${(-f(4) * 12).toFixed(1)}s;--w:${Math.round((f(5) - 0.5) * 120)}px"></i>`
}).join('')

/**
 * 깃발 소리의 박자 — [연출이 시작한 뒤(초), 크기, 빠르기]. 화면의 연출과 같은 때에 맞춘다
 * (방패가 쿵 내려앉는 때 · 통나무가 칠 때 · 바위가 닿을 때). 형이 고른 소리는 제 안에 박자가 있는 긴 것이 많아
 * (북 빠른 가락 · 칼 세 번 · 말발굽) 한 번만 친다 — 짧은 것만 겹쳐 친다. 없는 깃발은 시작에 한 번.
 */
/** 자르지 않고 끝까지 울리는 깃발 소리 — 그 깃발의 얼굴 같은 소리 (방진의 쇠판 「탱탱」) */
const RING_FULL: ReadonlySet<Cmd> = new Set<Cmd>(['hold'])

/**
 * 엉긴 앞줄의 칼·창 — 여섯을 돌려 가며 (형 10-25: "6개를 섞어서 조합해서 쓰면 될 듯 · impactMetal_medium_000 은 쓰지 마").
 * c1 은 앞 1초가 비어 있어 0.95초부터
 */
const MELEE: readonly string[] = ['realm/sfx/battle_melee_c1.ogg#t=0.95', ...[2, 3, 4, 5, 6].map((n) => `realm/sfx/battle_melee_c${n}.ogg`)]

/**
 * 여러 겹으로 내는 깃발 — [파일, 늦게 낼 초] (형 10-25)
 *   불화살 — 다섯을 다 겹친다. 저마다 앞의 빈 데를 건너뛰어 크게 터지는 자리를 맞춘다
 *   여울 막기 — 텀벙(c5)을 셋, 고르지 않은 틈으로
 */
const LAYERS: Partial<Record<Cmd, ReadonlyArray<readonly [string, number]>>> = {
  fire: [['realm/sfx/cmd_fire_c1.ogg', 0], ['realm/sfx/cmd_fire_c2.ogg#t=0.2', 0], ['realm/sfx/cmd_fire_c3.ogg#t=0.28', 0], ['realm/sfx/cmd_fire_c4.ogg#t=0.06', 0], ['realm/sfx/cmd_fire_c5.ogg', 0]],
  ford: [['realm/sfx/cmd_ford_c5.ogg', 0], ['realm/sfx/cmd_ford_c5.ogg', 0.17], ['realm/sfx/cmd_ford_c5.ogg', 0.43]],
}
const CMD_BEAT: Partial<Record<Cmd, ReadonlyArray<readonly [number, number, number]>>> = {
  hold: [[0.3, 1, 1]],
  ford: [[0.38, 1, 1], [0.82, 0.75, 0.95]],
  guard: [[0.42, 1, 1], [0.62, 0.75, 1.1]],
  gate: [[0.28, 0.85, 1.05], [1.0, 1, 0.95]],
  ram: [[0.25, 1, 1]],
  rocks: [[0.45, 1, 1]],
  duel: [[0.3, 1, 1]],
  capture: [[0.05, 1, 1]],
}

/** 한 무리의 화살 수 */
/** 화살비 소리 — [늦게(초), 크기, 빠르기] 여섯 발. 화면의 화살과 같은 결로 흩어진다 (꾸밈이라 판의 시드와 상관없다) */
const VOLLEY_SHOTS: ReadonlyArray<readonly [number, number, number]> = [[0, 1, 1], [0.07, 0.7, 1.12], [0.13, 0.85, 0.9], [0.22, 0.6, 1.05], [0.3, 0.75, 0.95], [0.41, 0.5, 1.18]]

/**
 * 깃발마다 제 연출 (형 10-23: "화살 말고 다른 카드들도 돌격 방진 바위 굴리기 … 다 그만의 이펙트와 사운드 필요하지 않아?").
 * 그림은 한 개짜리를 여럿으로 — 창끝·방패·바위·물보라·나무 조각·통나무·밧줄·말 탄 무사 (realm/fx · 제미나이 한 장을 잘랐다).
 * dir r: 우리(왼쪽)가 · l: 적(오른쪽)이 — 통째로 뒤집는다. 꾸밈이라 판의 시드와 상관없는 고정 굴림.
 */
export function cmdFxHtml(art: string, c: Cmd, dir: 'r' | 'l', at: number, end: number = at + beatLen(c)): string {
  const K = (end - at + 0.06) / (FX_SPAN[c] ?? 1) // 제 차례 안에 끝나게 — 사이 시각도 길이도 같은 배율로 줄인다
  let s = (dir === 'r' ? 5 : 17) + c.length * 31
  const rnd = (): number => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const img = (f: string): string => `<b style="background-image:url('${art}fx/${f}.png')"></b>`
  const many = (n: number, f: string, k: string, pos: (i: number) => string): string => {
    let h = ''
    for (let i = 0; i < n; i++) h += `<i class="${k}" style="${pos(i)}">${img(f)}</i>`
    return h
  }
  const t = (x: number): string => `--t:${(at + x * K).toFixed(2)}s`
  const z = (a: number, b: number): string => `--z:${(a + rnd() * b).toFixed(2)}`
  let h = ''
  switch (c) {
    case 'charge': case 'punch':
      // 창끝이 낱낱이 앞으로 쏟아진다 · 발밑에 흙먼지 (돌파는 말 탄 무사가 함께)
      h += many(c === 'punch' ? 4 : 7, 'spear', 'sp', (i) => `--y:${(48 + rnd() * 30).toFixed(1)}%;--dx:${(38 + rnd() * 18).toFixed(1)}vw;${z(0.8, 0.5)};${t(i * 0.05 + rnd() * 0.1)}`)
      h += many(3, 'smoke', 'pf', (i) => `--x:${(4 + i * 12 + rnd() * 5).toFixed(1)}%;--y:${(78 + rnd() * 8).toFixed(1)}%;${z(0.7, 0.5)};${t(0.15 + i * 0.08)}`)
      if (c === 'punch') h += many(3, 'rider', 'rd', (i) => `--y:${(56 + i * 9).toFixed(1)}%;--dx:${(40 + rnd() * 12).toFixed(1)}vw;${z(0.85, 0.3)};${t(0.1 + i * 0.12)}`)
      break
    case 'flank': case 'pursue':
      // 말 탄 무사들이 달린다 — 옆치기는 위에서 비스듬히, 추격은 길게
      h += many(c === 'pursue' ? 6 : 5, 'rider', c === 'flank' ? 'rd fl' : 'rd', (i) => `--y:${(c === 'flank' ? 30 + i * 8 : 52 + rnd() * 26).toFixed(1)}%;--dx:${(c === 'pursue' ? 70 + rnd() * 20 : 42 + rnd() * 10).toFixed(1)}vw;${z(0.75, 0.4)};${t(i * 0.11 + rnd() * 0.08)}`)
      h += many(4, 'smoke', 'pf', (i) => `--x:${(6 + i * 12 + rnd() * 5).toFixed(1)}%;--y:${((c === 'flank' ? 48 : 80) + rnd() * 6).toFixed(1)}%;${z(0.6, 0.5)};${t(0.25 + i * 0.1)}`)
      break
    case 'hold': case 'ford':
      // 방패가 쿵 쿵 내려앉아 벽이 된다 (가야 방패) · 여울에서는 물보라
      h += many(5, 'shield', 'sh', (i) => `--x:${(3 + i * 8).toFixed(1)}%;--y:${(58 + (i % 2) * 3).toFixed(1)}%;${z(0.85, 0.2)};${t(i * 0.08)}`)
      if (c === 'ford') h += many(6, 'splash', 'pop', (i) => `--x:${(36 + rnd() * 30).toFixed(1)}%;--y:${(72 + rnd() * 12).toFixed(1)}%;${z(0.7, 0.6)};${t(0.5 + i * 0.09)}`)
      break
    case 'guard':
      // 장수 곁에 방패 셋이 둘러선다
      h += many(3, 'shield', 'sh gd', (i) => `--x:${(14 + i * 9).toFixed(1)}%;--y:${(20 + (i === 1 ? 6 : 0)).toFixed(1)}%;--z:0.8;${t(i * 0.1)}`)
      break
    case 'open':
      // 앞줄 방패가 위아래로 벌어진다 (그 틈으로 화살비가 간다)
      h += many(6, 'shield', 'sh op', (i) => `--x:${(18 + (i % 3) * 6).toFixed(1)}%;--y:${i < 3 ? 52 : 62}%;--dy:${i < 3 ? -12 : 12}vh;--z:0.8;${t((i % 3) * 0.06)}`)
      break
    case 'rocks':
      // 바위가 비탈에서 굴러 내려와 적 앞줄에 부딪힌다 · 먼지
      h += many(3, 'rock', 'rk', (i) => `--x:${(2 + i * 7 + rnd() * 4).toFixed(1)}%;--y:${(62 + rnd() * 16).toFixed(1)}%;--dx:${(40 + rnd() * 16).toFixed(1)}vw;${z(0.55, 0.5)};${t(i * 0.14)}`)
      h += many(3, 'smoke', 'pf', (i) => `--x:${(50 + rnd() * 22).toFixed(1)}%;--y:${(72 + rnd() * 10).toFixed(1)}%;${z(0.8, 0.5)};${t(0.75 + i * 0.14)}`)
      break
    case 'gate': case 'ram':
      // 통나무가 세 번 들이친다 — 칠 때마다 나무 조각이 튄다 (배 들이받기는 물보라까지)
      h += `<i class="ramlg" style="--y:${c === 'ram' ? 66 : 56}%;${t(0)}">${img('ramlog')}</i>`
      for (let k = 0; k < 3; k++) {
        h += many(2, 'splinter', 'pop', () => `--x:${(44 + rnd() * 8).toFixed(1)}%;--y:${((c === 'ram' ? 62 : 52) + rnd() * 8).toFixed(1)}%;${z(0.6, 0.5)};${t(0.3 + k * 0.36)}`)
        h += `<i class="pop fl" style="--x:${(40 + rnd() * 6).toFixed(1)}%;--y:${((c === 'ram' ? 58 : 48) + rnd() * 4).toFixed(1)}%;${z(0.9, 0.3)};${t(0.29 + k * 0.36)}">${img('skill/common/flash')}</i>` // 칠 때마다 쾅 — 번쩍임 (비기 그림과 같은 것)
        if (c === 'ram') h += many(2, 'splash', 'pop', () => `--x:${(40 + rnd() * 12).toFixed(1)}%;--y:${(74 + rnd() * 6).toFixed(1)}%;${z(0.8, 0.4)};${t(0.32 + k * 0.36)}`)
      }
      break
    case 'fire':
      // 불화살 — 적 앞줄에 불길이 솟는다
      h += many(5, 'fire', 'pop fr', (i) => `--x:${(56 + rnd() * 30).toFixed(1)}%;--y:${(60 + rnd() * 18).toFixed(1)}%;${z(0.7, 0.6)};${t(0.75 + i * 0.07)}`)
      break
    case 'capture':
      // 밧줄이 빙글 날아가 적장에게 걸린다
      h += `<i class="rp" style="--y:22%;${t(0.1)}">${img('rope')}</i>`
      break
    case 'retreat':
      // 먼지를 일으키며 뒤로 빠진다
      h += many(5, 'smoke', 'pf pfbk', (i) => `--x:${(30 - i * 5).toFixed(1)}%;--y:${(70 + rnd() * 10).toFixed(1)}%;${z(0.7, 0.5)};${t(i * 0.09)}`)
      break
    case 'drum':
      // 북소리 — 금빛 고리가 장수 둘레로 퍼진다
      for (let k = 0; k < 3; k++) h += `<i class="rg" style="${t(k * 0.32)}"></i>`
      break
    case 'duel':
      // 칼금 둘이 엇갈린다
      h += `<i class="sl a" style="${t(0.35)}"></i><i class="sl b" style="${t(0.5)}"></i>`
      break
    default:
      return ''
  }
  return `<div class="wfx-cmd ${dir}" style="--k:${K};--end:${end.toFixed(2)}s">${h}</div>`
}

/**
 * 장수 기술의 여운 (11-08 형: "비기 연출도 더 고민해봐") — 컷인이 걷힌 뒤 전장 제자리에 1~2초. 먹힌 기술만 (헛친 것은 컷인의 갈라진 먹으로 끝).
 * dir 'r' 은 왼쪽(우리 쪽)에서 쓴 기술 — 'l' 이면 판째 뒤집힌다(.wfx-cmd.l). 자리: 우리 진 x 3~35% · 적 진 x 60~90% · 장수 줄 y 12~26%.
 */
export function artFieldFxHtml(art: string, k: Art | Elem | undefined, dir: 'r' | 'l', at: number): string {
  if (k === undefined) return ''
  let s = (dir === 'r' ? 7 : 19) + k.length * 37
  const rnd = (): number => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const one = (cls: string, f: string, x: number, y: number, z: number, dt: number, more = ''): string =>
    `<i class="${cls}" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--z:${z.toFixed(2)};--t:${(at + dt).toFixed(2)}s${cls.startsWith('pop') && !cls.includes('fl') ? `;--du:${P.realm.warArtPopS}s` : ''}${more}"><b style="background-image:url('${art}fx/${f}.png')"></b></i>`
  let h = ''
  switch (k) {
    case 'snipe': // 적장 머리 위로 번쩍 · 먹 튐
      h += one('pop fl', 'skill/common/flash', 74, 12, 0.8, 0) + one('pop', 'skill/common/ink-burst', 75, 14, 0.7, 0.05)
      break
    case 'rite': // 우리 진 위로 혼불이 하나씩 피어오른다
      for (let i = 0; i < 6; i++) h += one('pop', 'skill/rite/spirit-flame', 4 + i * 5.5 + rnd() * 3, 56 + rnd() * 18, 0.45 + rnd() * 0.3, i * 0.09)
      break
    case 'sway': // 넘어온 적 줄 위로 흰 깃발이 하나씩
      for (let i = 0; i < 3; i++) h += one('pop', 'skill/sway/white-flag', 62 + i * 9 + rnd() * 3, 48 + rnd() * 14, 0.8, i * 0.18)
      break
    case 'stand': case 'order': // 우리 앞줄 앞에 방패가 쿵 쿵 내려앉는다
      for (let i = 0; i < 5; i++) h += one('sh', 'shield', 18 + i * 6, 58 + (i % 2) * 3, 0.85, i * 0.07)
      break
    case 'ambush': // 적 활 줄 밑에서 갈대가 갈라지고 흙먼지
      h += one('pop', 'skill/ambush/reeds', 72, 60, 1.3, 0)
      for (let i = 0; i < 3; i++) h += one('pf', 'smoke', 68 + i * 7 + rnd() * 3, 66 + rnd() * 8, 0.7 + rnd() * 0.4, 0.15 + i * 0.1)
      break
    case 'vanguard': // 우리 앞줄에서 창끝이 쏟아져 나간다
      for (let i = 0; i < 4; i++) h += one('sp', 'spear', -4, 50 + rnd() * 26, 0.8 + rnd() * 0.4, i * 0.07, `;--dx:${(42 + rnd() * 14).toFixed(1)}vw`)
      break
    case 'feint': // 적 앞줄 발밑에서 말뚝이 솟는다
      h += one('pop', 'skill/feint/trap-stakes', 54, 64, 1.4, 0)
      break
    case 'shout': // 우리 장수에서 금빛 울림이 퍼진다
      for (let i = 0; i < 3; i++) h += `<i class="rg" style="--t:${(at + i * 0.22).toFixed(2)}s"></i>`
      break
    case 'earth': h += one('pop', 'skill/wake/rock-spikes', 58, 50, 2.4, 0); break
    case 'wind': h += one('pop', 'skill/wake/tornado', 64, 30, 2.2, 0); break
    case 'fire': for (let i = 0; i < 4; i++) h += one('pop fr', 'fire', 58 + rnd() * 26, 56 + rnd() * 16, 0.7 + rnd() * 0.5, i * 0.08); break
    case 'water': h += one('pop', 'skill/wake/water-spout', 62, 30, 2.2, 0); break
    case 'bolt': for (let i = 0; i < 3; i++) h += one('pop fl', `awaken/bolt-${i + 1}`, 58 + i * 12, 28, 0.9, i * 0.12); break
  }
  return h === '' ? '' : `<div class="wfx-cmd ${dir}" style="--k:1;--end:${(at + P.realm.warArtFxS).toFixed(2)}s">${h}</div>`
}

/**
 * 한 합의 시계 하나 (feel-lens 검토 10-24 — 전엔 그림·소리·결과가 시계 셋으로 따로 놀아 "맞는 순간"이 두 번이었다).
 * 깃발: 우리 것 먼저 그다음 적 것 · 쪽마다 warBeatMax 까지 (장수 기술은 장면이 맡아 빼고) → 맞부딪힘(clash) → 이야기(story) → 밀림·잃은 수·막대(result).
 * warHtml 의 CSS 지연과 openWar 의 소리가 둘 다 이것만 읽는다
 */
type Beat = { c: Cmd; dir: 'r' | 'l'; at: number; len: number; ours: boolean }
/** 깃발 연출의 본디 길이(초) — 맨 마지막 조각이 사라질 때까지 (cmdFxHtml 의 사이 시각 + CSS --du) · 화살비는 volleyHtml */
const FX_SPAN: Readonly<Partial<Record<Cmd, number>>> = {
  volley: 1.3, counter: 1.3, open: 1.3, height: 1.3, fire: 1.3,
  charge: 1.2, punch: 1.4, flank: 1.5, pursue: 1.6, hold: 1.4, ford: 1.6, guard: 1.3,
  rocks: 1.9, gate: 1.8, ram: 1.8, capture: 1.2, retreat: 1.5, drum: 1.6, duel: 1.0,
}
/** 한 깃발의 차례 — 본디 길이를 warFxSquash 로 줄인 것 (warBeatMin ~ warBeatLong) */
export function beatLen(c: Cmd): number {
  const R = P.realm
  const s = FX_SPAN[c]
  return s === undefined ? R.warBeatStep : Math.min(R.warBeatLong, Math.max(R.warBeatMin, s * R.warFxSquash))
}
function roundPlan(rd: RoundLog, weAtk: boolean): { beats: Beat[]; clash: number; story: number; result: number } {
  const R = P.realm
  const ord = (o: RoundOrder | undefined, main: Cmd, art: boolean): Cmd[] => {
    const cs = o === undefined ? [main] : (['front', 'bows', 'horse', 'lead'] as const).filter((g) => !(art && g === 'lead')).map((g) => o[g]).filter((c): c is Cmd => c !== undefined && c !== 'art')
    return [...new Set(cs.length > 0 ? cs : [main])].slice(0, R.warBeatMax)
  }
  const ourS = weAtk ? 'a' : 'd'
  const lead = (rd.acts ?? []).find((x) => x.g === 'lead' && x.s === ourS)?.c
  const cut = lead !== undefined && (lead === 'art' || CUT_OF[lead] !== undefined)
  const us = ord(weAtk ? rd.oa : rd.od, weAtk ? rd.a : rd.d, cut)
  const them = ord(weAtk ? rd.od : rd.oa, weAtk ? rd.d : rd.a, false)
  const t0 = cut ? R.warBeatCut : R.warBeat0
  // 깃발은 하나씩 — 앞 깃발의 차례가 끝나야 다음 깃발 (형 10-24: "이펙트가 아직도 너무 한꺼번에 · 하나씩 해야지")
  let at = t0
  const beats: Beat[] = [...us.map((c) => ({ c, dir: 'r' as const, ours: true })), ...them.map((c) => ({ c, dir: 'l' as const, ours: false }))]
    .map((b) => { const len = beatLen(b.c); const x = { ...b, at, len }; at += len; return x })
  const clash = at + R.warClashGap
  const lastContact = clash + 3 * R.warStrikeStaggerS + R.warStrikeReplyS
  const story = Math.max(clash + R.warStoryGap, lastContact + R.warStrikeHitS)
  // 사로잡은 합은 적장을 이고 돌아와 내려놓을 때까지 (battle-capture.ts)
  const carried = caughtIn(rd) !== undefined ? carryEnd(clash) : 0
  const result = Math.max(clash + R.warResultGap, story, carried, lastContact + R.warStrikeHitS + Math.max(R.warStrikeFallS, R.warStrikeWalkBackS))
  return { beats, clash, story, result }
}

/** 「전투 개시」 단추의 말 — 다 골랐으면 켜진다 */
export function goWord(picked: number, n: number): string {
  return picked >= n ? tr('war.goword.1') : `${tr('war.goword.1')} <small>${tr('war.goword.2', { picked, n })}</small>`
}

/** 고른 것에 이 깃발을 끼운 명령 — 안 고른 무리는 장수가 고를 것(엔진이 채운다) */
const withPick = (sel: RoundOrder, g: Grp | 'lead', c: Cmd): RoundOrder => ({ ...sel, [g]: c })
const orderKey = (o: RoundOrder): string => [o.front, o.bows, o.horse, o.lead, o.who, o.target].map((x) => x ?? '').join('|')
const LOOKS = new WeakMap<RoundAt, Map<string, Look>>()
/** 깃발 짐작 — 한 합 동안 한 번 셈한 것은 다시 쓴다 (고를 때마다 다시 그려도 셈은 한 번). compute 가 아니면 셈해 둔 것만 */
function lookFor(at: RoundAt, o: RoundOrder, compute: boolean): Look | undefined {
  let m = LOOKS.get(at)
  if (m === undefined) { m = new Map(); LOOKS.set(at, m) }
  const k = orderKey(o)
  let v = m.get(k)
  if (v === undefined && compute) { v = lookRound(at, o); m.set(k, v) }
  return v
}

const TEN_KEYS = ['war.ten.1', 'war.ten.2', 'war.ten.3', 'war.ten.4', 'war.ten.5', 'war.ten.6', 'war.ten.7', 'war.ten.8', 'war.ten.9', 'war.ten.10', 'war.ten.11'] as const

/**
 * 짐작 한 칸 — 판세 막대(우리 푸른빛 · 적 붉은빛, 폭은 옅게, 지금 판세에 금) · 말 하나 · 양쪽이 잃을 군사와 사기의 폭 (형 10-26: "결과가 눈에 보여야 · 어느정도가 +- 범위이고 어느정도가 확률인지").
 * 숫자는 엔진의 한 합을 그대로 굴린 것(tactics.lookRound) — 적이 낼 만한 수와 우리 운의 가운데 폭. 사로잡기는 잡을 가망을 따로, 잃을 것은 놓쳤을 때
 */
function lookHtml(lk: Look | undefined, k: string): string {
  if (lk === undefined) return `<span class="wguess wait" data-k=""></span>`
  const d = (lk.edge[0] + lk.edge[1]) / 2 - lk.edge0
  const [w, cls] = d > 0.07 ? [tr('war.lookhtml.1'), 'g2'] : d > 0.02 ? [tr('war.lookhtml.2'), 'g1'] : d > -0.02 ? [tr('war.lookhtml.3'), 'g0'] : d > -0.07 ? [tr('war.lookhtml.4'), 'b1'] : [tr('war.lookhtml.5'), 'b2']
  const n = lookNums(lk)
  const tag = lk.by === 'saw' ? `<i class="wgtag">${tr('war.lookhtml.6')}</i>` : ''
  // 위 카드와 같은 자리 — 왼쪽 우리 · 오른쪽 적, 윗줄 피해 · 아랫줄 사기 (형 10-26: "상단에서 보여지는게 우리명 적명 / 우리사기 적사기 · 깃발에서도 그런배치로").
  // 칸은 일곱 — 이름 | 우리 최악 ~ 최선 | 적 최악 ~ 최선. 왼쪽이 플레이어에게 가장 나쁠 때 · 오른쪽이 가장 좋을 때.
  // 나쁜 숫자는 붉게 · 좋은 숫자는 녹색으로, 클수록 짙게 · 0 은 회색 (형 10-26: "돌격을 선택하면 붉은 숫자가 방진보다 많으니 나쁘다고 알고")
  const c = lookCells(n)
  const num = (x: LookCell, unit: string): string => `<b style="color:${cellColor(x)}${x.k > 0.6 ? ';font-weight:900' : ''}">${signed(x.v)}<small>${unit}</small></b>`
  // 폭이 없는 확정값도 최악 · 최선 두 칸에 같은 숫자로 (형 10-27: "범위가 없고 확정이면 중앙에 −60 이렇게만 나오던데 그냥 최악 최선 값을 똑같이")
  const pair = (x: [LookCell, LookCell], unit: string): string => `${num(x[0], unit)}<i>~</i>${num(x[1], unit)}`
  const table = `<span class="wgx"><i></i><span class="wgk us">${tr('war.lookhtml.8', { v1: n.cap !== undefined ? `<small> ${tr('war.lookhtml.7')}</small>` : '' })}</span><span class="wgk foe">${tr('war.duskrow.2')}</span>`
    + `<span class="wgk">${tr('war.lookhtml.10')}</span>${pair(c.usMen, tr('war.lookhtml.9'))}${pair(c.foeMen, tr('war.lookhtml.9'))}`
    + `<span class="wgk">${tr('war.lookhtml.11')}</span>${pair(c.usMor, '')}${pair(c.foeMor, '')}`
    + `<span class="wgxn"><span>${tr('war.lookhtml.12')}</span><span>${tr('war.lookhtml.13')}</span><span>${tr('war.lookhtml.12')}</span><span>${tr('war.lookhtml.13')}</span></span></span>`
  const cap = n.cap !== undefined ? `<span class="wgl wgc"><span class="wgk">${tr('war.lookhtml.14')}</span><b>${pctText(n.cap)}</b></span>` : ''
  // 무너지는 선 — 이 깃발이면 이번 합에 무너질 수 있다 (우리 붉게 깜박 · 적은 금빛) · 해시계와 함께 (형 10-26)
  const warn = (lk.fall ?? 0) >= P.realm.tacLookFall ? `<span class="wgl wgff us"><span class="wgk">⚠</span>${tr('war.lookhtml.15')} <b>${oneChance(lk.fall!)}%</b></span>` : ''
  const chance = (lk.foeFall ?? 0) >= P.realm.tacLookFall ? `<span class="wgl wgff foe"><span class="wgk">★</span>${tr('war.lookhtml.16')} <b>${oneChance(lk.foeFall!)}%</b></span>` : ''
  // 판세 막대 — 왼쪽 끝이 우리, 오른쪽 끝이 적. 파랑이 우리 몫, 옅은 데가 짐작의 폭, 금빛 금이 지금 판세
  return `<span class="wguess ${cls}" data-k="${esc(k)}"><span class="wgq">${tr('war.lookhtml.17', { tag })}</span><span class="wgk us">${tr('war.duskrow.1')}</span>${deltaBar(lk)}<span class="wgk foe">${tr('war.duskrow.2')}</span><b>${w}</b>`
    + `${cap}${table}${warn}${chance}</span>`
}

/**
 * 판세 막대 — 가운데 금이 지금 판세, 이 깃발이면 얼마나 밀어붙이나(오른쪽 파랑) · 밀리나(왼쪽 붉음)를 warLookGain 배로 키워서.
 * 판세가 99% 처럼 한쪽으로 꽉 차면 깃발마다 막대가 똑같아 보였다 (형 10-28) · 옅은 칸은 짐작의 폭 · 그러데이션 없이 단색 조각
 */
function deltaBar(lk: Look): string {
  const K = P.realm.warLookGain
  const at = (v: number): number => 50 + Math.max(-1, Math.min(1, (v - lk.edge0) * K)) * 50
  const mid = at((lk.edge[0] + lk.edge[1]) / 2)
  const r0 = at(lk.edge[0])
  const r1 = at(lk.edge[1])
  const f = (x: number): string => `${x.toFixed(1)}%`
  return `<span class="wgbar ${mid >= 50 ? 'pos' : 'neg'}" style="--s0:${f(Math.min(50, mid))};--sw:${f(Math.abs(mid - 50))};--r0:${f(Math.min(r0, r1))};--rw:${f(Math.abs(r1 - r0))}"><i class="wgb2"></i><i class="wgb1"></i></span>`
}

/** 「이대로 싸우면」 — 무리마다 다 골랐을 때 그 명령 그대로의 짐작 (전투 개시 단추 위) */
function lookSumHtml(at: RoundAt | undefined, sel: RoundOrder, all: boolean, compute: boolean): string {
  if (at === undefined || !all) return ''
  const k = orderKey(sel)
  const lk = lookFor(at, sel, compute)
  return lk === undefined ? '' : `<b class="wlst">${tr('war.looksumhtml.1')}</b>${lookHtml(lk, k)}`
}

function roundHighlights(rd: RoundLog, end: BattleLine | null): Partial<Record<'a' | 'd', string>> {
  const labels: Partial<Record<'a' | 'd', string>> = {}
  for (const act of rd.acts ?? []) {
    if (act.art === 'snipe' && act.res === 'hit') labels[act.s === 'a' ? 'd' : 'a'] = tr('war.roundhighlights.1')
  }
  if (rd.by !== undefined && (rd.ev === 'duel-win' || rd.ev === 'duel-lose')) {
    const loser = rd.ev === 'duel-lose' ? rd.by : rd.by === 'a' ? 'd' : 'a'
    labels[loser] = tr('war.cmdName.duel')
  }
  if (end?.endWhy === 'men' || end?.endWhy === 'morale') {
    if (end.outcome === 'win' || end.outcome === 'rout') labels.d ??= tr('war.roundhighlights.2')
    else if (end.outcome === 'lose' || end.outcome === 'routed') labels.a ??= tr('war.roundhighlights.2')
  }
  return labels
}

export function warHtml(prev: Realm, after: Realm, l: BattleLine, me: string, art: string, shown: number, anim: boolean, left: number, sel: RoundOrder = {}, active?: Grp | 'lead', more = false, speed: BattleSpeed = 1): string {
  const weAtk = l.atkFaction === me
  const st = l.start
  const fname = (f: string | undefined): string => (f !== undefined ? (after.factions[f]?.name ?? '?') : '?')
  const atkF = l.atkFaction ?? prev.armies[l.attacker]?.faction
  const ourF = weAtk ? atkF : l.defender
  const foeF = weAtk ? l.defender : atkF
  // 원군과 함께 닿은 장수가 지휘를 맡았으면 그 합부터 그가 총대장 (형 11-03 · tactics arrive)
  const heroOf = (i: 0 | 1): string | null => {
    const side = i === 0 ? 'a' : 'd'
    let chief = st?.heroes[i] ?? null
    for (const [index, rd] of (l.rounds ?? []).slice(0, shown).entries()) {
      if (rd.relief?.side === side && rd.relief.chief !== undefined) chief = rd.relief.chief
      if (index < shown - 1 && rd.lostHero?.side === side && rd.lostHero.chief !== undefined) chief = rd.lostHero.chief
    }
    return chief
  }
  const ourHero = heroOf(weAtk ? 0 : 1)
  const foeHero = heroOf(weAtk ? 1 : 0)
  const hname = (id: string | null, f: string | undefined): string => (id !== null ? (prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '?') : tr('war.wartip.21', { fname: fname(f) }))
  const ourName = hname(ourHero, ourF)
  const foeName = hname(foeHero, foeF)
  const ctx = storyCtx(prev, { start: st, atkFaction: atkF, defender: l.defender }, me)
  const rounds = (l.rounds ?? []).slice(0, shown)
  const last = rounds[rounds.length - 1]
  const plan = anim && last !== undefined ? roundPlan(last, weAtk) : null
  /** 시계의 세 때 — 0: 깃발 줄 · 1: 이야기 · 2: 밀림·잃은 수·막대 (시계가 없으면 옛 STAGE_S) */
  const tAt = (k: 0 | 1 | 2): number => (plan === null ? STAGE_S[k] : k === 0 ? 0 : k === 1 ? plan.story : plan.result)
  /** 처음 와 있는 몫 — 원군은 닿기 전엔 싸움터에 없다. 1 로 두면 첫 합에 원군 몫까지 잃은 것으로 보였다 (형 11-03: "합 한 번 붙으니 290명 마이너스") */
  const here0 = (i: 0 | 1): number => {
    const all = Object.values(st?.mix?.[i] ?? {}).reduce((x: number, v) => x + (v ?? 0), 0)
    const late = Object.values(st?.late?.[i] ?? {}).reduce((x: number, v) => x + (v ?? 0), 0)
    return all > 0 ? Math.max(0, 1 - late / all) : 1
  }
  const n = (i: 0 | 1): number => (last === undefined ? here0(i) : i === 0 ? last.na : last.nd)
  const m = (i: 0 | 1): number => (last === undefined ? (st?.morale[i] ?? 1) : i === 0 ? last.ma : last.md)
  const men0 = (i: 0 | 1): number => st?.men[i] ?? 0
  const ourI: 0 | 1 = weAtk ? 0 : 1
  const foeI: 0 | 1 = weAtk ? 1 : 0
  const ourS: 'a' | 'd' = weAtk ? 'a' : 'd'
  const unitOf = (i: 0 | 1): string => (i === ourI ? UNIT_ICON.spear : UNIT_ICON.shield)
  const mixOf = (i: 0 | 1): Readonly<Partial<Record<string, number>>> => (i === 1 ? splitMilitia(st?.mix?.[i] ?? {}, l.militia) : st?.mix?.[i] ?? {}) // 지키는 쪽(1)의 농민군은 따로

  // 지난 합의 값 — 천천히 풀 때 막대·사람 수가 거기서 새 값으로 간다
  const was = anim && rounds.length >= 2 ? rounds[rounds.length - 2] : undefined
  const n0 = (i: 0 | 1): number => (!anim ? n(i) : was === undefined ? here0(i) : i === 0 ? was.na : was.nd)
  /** 이 합에 원군이 닿았으면 잃은 수는 원군까지 친 처음에서 잰다 — 닿은 몫이 잃은 수를 가리지 않게 */
  const lostBase = (i: 0 | 1): number => n0(i) + (anim && last?.relief?.side === (i === 0 ? 'a' : 'd') ? 1 - here0(i) : 0)
  const m0 = (i: 0 | 1): number => (!anim ? m(i) : was === undefined ? (st?.morale[i] ?? 1) : i === 0 ? was.ma : was.md)
  const moraleLoss = (i: 0 | 1): number => Math.round(((m0(i) - m(i)) / Math.max(0.05, st?.morale[i] ?? 1)) * 100)
  // 막대마다 제 키프레임 (battlecard 와 같은 길 — var() 키프레임은 크롬에서 칠이 안 됐다)
  let keys = ''
  let kn = 0
  const bar = (w1: number, w0: number): string => {
    if (w0 === w1) return `<i style="width:${w1}%"></i>`
    const k = `wb${kn++}`
    keys += `@keyframes ${k}{from{width:${w0}%}to{width:${w1}%}}`
    if (w1 > w0) return `<i class="wgr" style="width:${w1}%;animation-name:${k}"></i>`
    // 줄 때는 롤 체력바처럼 — 막대는 단번에 떨어지고, 잃은 토막만 희게→노랗게→붉게 터졌다가 처음엔 빠르게 끝 무렵엔 천천히 줄어든다 (형 10-28: "와! 하고 때리거나 맞은 듯한 타격감")
    return `<i class="wgr cut" style="width:${w1}%;animation-name:${k}"></i><em class="wchunk" style="left:${w1}%;--cw:${w0 - w1}%;--cf:${P.realm.warChunkFlashS}s;--cs:${P.realm.warChunkShrinkS}s"></em>`
  }
  /**
   * 세는 숫자 — 옛 값을 보이다가 막대가 줄기 시작하는 때(--bd)에 새 값으로 빠르게 센다 (형 10-29: "바 줄어들 때 그제야 숫자가 줄어들어야지").
   * 줄 때는 잃은 토막이 줄어드는 길이만큼(warChunkFlashS 반 + warChunkShrinkS) · 오를 때는 막대가 자라는 .4초. 숫자는 CSS 셈(counter)이라 글에는 안 남는다
   */
  const cnt = (a: number, b: number): string => {
    if (a === b) return String(b)
    const k = `wc${kn++}`
    keys += `@keyframes ${k}{from{--wc:${a}}to{--wc:${b}}}`
    const dn = b < a
    const cd = dn ? P.realm.warChunkFlashS * 0.5 + P.realm.warChunkShrinkS : 0.4
    return `<i class="wcnt${dn ? ' dn' : ' upn'}" aria-label="${b}" style="--wc:${b};--cd:${cd.toFixed(2)}s;animation-name:${k},${dn ? 'wnhit' : 'wnup'}"></i>`
  }
  /**
   * 무너지는 금 — 그 밑은 패배가 정해진 구역(붉은 빗금)이고 금 위에 해골. 지금 값이 금에 가까우면 해골이 깜박인다
   * (형 10-25: "사기랑 명수 이하로는 패배 확정이라는 건 해골 표시가 필요할 듯")
   */
  const brk = (at: number, now: number, tip: string): string =>
    `<s class="wdz" style="width:${at}%"></s><b class="brk${now <= at + P.realm.warSkullNear ? ' near' : ''}" style="left:${at}%" data-tip="${tip}"></b>`
  // 마지막 합에 맞은 쪽은 흔들린다 (형: "피격당한쪽이 흔들리거나") — 우리는 붉게, 적은 금빛으로 번쩍
  const hitOf = (i: 0 | 1): string => {
    if (!anim) return ''
    const lost = Math.round(men0(i) * (lostBase(i) - n(i)))
    if (lost <= 0) return ''
    const j: 0 | 1 = i === 0 ? 1 : 0
    const other = Math.round(men0(j) * (lostBase(j) - n(j)))
    // 흔들림은 한 합에 한 번 — 더 많이 잃은 쪽만 (같으면 적 쪽)
    if (lost < other || (lost === other && i === ourI)) return ''
    return ` hit${lost > other * 1.3 ? ' hithard' : ''}`
  }
  const side = (i: 0 | 1, hero: string | null, f: string | undefined, name: string, cls: string): string => {
    const now = Math.round(men0(i) * n(i))
    const old = Math.round(men0(i) * n0(i))
    const base = Math.max(0.05, st?.morale[i] ?? 1)
    const mr = (x: number): number => Math.round(Math.max(0, Math.min(1.2, x / base)) * 83)
    const num = `<span class="wn">${tr('war.warhtml.1', { cnt: cnt(old, now) })}</span>`
    const hitFx = hitOf(i) !== '' ? `<img class="wfx-hit" src="${art}fx/impact.png" alt="">` : ''
    // 잃은 사람 수 · 꺾인 사기는 전장 한가운데 배지로 튄다 (fieldHtml 의 popOf · 형 11-01: "화면 중앙부근에서") — 위 카드에서는 막대와 숫자만 준다
    // 호궤를 고를 수 있으면 — 그 깃발에 마우스를 올리거나 누르고 있거나 골라 두면 사기 막대에 오를 몫이 깜박인다 (형 10-25)
    const fNow = mr(m(i))
    const fTo = mr(Math.min(base, m(i) + P.realm.tacFeastMorale))
    const feastPv = i === ourI && l.pending?.feast !== undefined && fTo > fNow ? `<u class="wfpv" style="left:${fNow}%;width:${fTo - fNow}%"></u>` : ''
    const em = flagIcon(f)
    // 부장 — 함께 선 장수들 (형 10-25) · 잃은 이는 흐리게. 초상 안 밑에 얹는다 — 줄을 따로 먹으면 장수가 많은 쪽의 막대가 밀려 내려갔다 (형 10-26)
    const lostIds = new Set(rounds.flatMap((x) => (x.lostHero !== undefined ? [x.lostHero.hero] : [])))
    // 부장 — 처음부터 선 이들 + 원군과 함께 닿아 지휘를 맡지 않은 이들
    const cameH = rounds.flatMap((x) => (x.relief?.side === (i === 0 ? 'a' : 'd') ? (x.relief.heroes ?? []).filter((id) => id !== x.relief!.chief) : []))
    const aides = [...(st?.aides?.[i] ?? []), ...cameH].map((id) => `<span class="waide${lostIds.has(id) ? ' gone' : ''}" title="${esc(prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '')}">${face(id, art, unitOf(i))}</span>`).join('')
    return `<div class="ws ${cls}${hitOf(i)}${hero !== null && lostIds.has(hero) ? ' chiefgone' : ''}" style="--hd:${plan?.clash ?? STAGE_S[1] + 0.15}s;--bd:${tAt(2)}s"><span class="wpf">${face(hero, art, unitOf(i))}<i></i>${aides !== '' ? `<span class="waides">${aides}</span>` : ''}</span><b>${esc(name)}</b><span class="wnat">${roleChip((cls === 'us') === weAtk)}${em !== undefined ? `<img src="${art}icon/${em}.png" alt="">` : ''}${esc(fname(f))}</span>`
      // 무너지는 금 — 이 밑으로 떨어지면 그 편이 무너져 진다 (tactics: 군사 tacBreakMen · 사기는 처음의 tacBreakMorale) (형 10-24: "사기가 어느 정도 떨어지면 패배한다가 가로바에 표시")
      + `<div class="wbar men">${bar(Math.round(n(i) * 100), Math.round(n0(i) * 100))}${brk(Math.round(P.realm.tacBreakMen * 100), Math.round(n(i) * 100), tr('war.warhtml.2'))}</div>${num}`
      + `<div class="wbar mor">${bar(mr(m(i)), mr(m0(i)))}${feastPv}${brk(st?.brk !== undefined ? mr(st.brk[i]) : Math.round(P.realm.tacBreakMorale * 83), mr(m(i)), tr('war.warhtml.3'))}</div><span class="wn">${tr('war.warhtml.4', { cnt: cnt(Math.round((m0(i) / base) * 100), Math.round((m(i) / base) * 100)) })}<small class="brkl"> ${tr('war.warhtml.5', { round: Math.round(((st?.brk?.[i] ?? P.realm.tacBreakMorale * base) / base) * 100) })}</small></span>${hitFx}</div>` // 맞은 불꽃은 맨 뒤에 — 앞에 끼면 초상이 새로 만들어져 깜빡였다 (paintNow 의 바뀐 곳만 고치기)
  }

  /**
   * 전장 — 진을 갖춘 두 군대가 마주 선다 (형 10-25: "진은 제대로 갖춘 상태여야 하고 내 선택에 따라 그 진도 바뀌던지 이펙트가 나던지").
   * 우리는 왼쪽에서 오른쪽을 본다 — 앞줄(창·방패)은 가운데 쪽 한두 겹 · 그 뒤 궁수 · 위 옆구리에 기병 · 맨 뒤에 장수와 깃발.
   * 적은 같은 배치를 거울로 (.wf2s.foe 가 통째로 뒤집힌다). 아래에 선 말일수록 크고 앞에 선다 (깊이).
   * 깃발(data-f·b·h·l)대로 진이 움직인다 — 돌격은 앞줄이 기울며 나서고, 방진은 촘촘히 방패벽, 길 트기는 앞줄이 갈라져 궁수가 나온다 ….
   * 고르는 동안은 고른 것(openWar.syncField) · 적은 낌새 · 합이 풀릴 때는 그 합에 실제로 낸 명령으로 맞부딪친다 (play).
   * 병사 그림은 한 잣대 — 작은 병사 10명 · 큰 병사 100명 · 깃발 병사 1000명 (troops.ts). 무리마다 정확한 수가 진 발치에, 잣대는 맨 아래 가운데에.
   */
  /** 공격·수비 (형 10-25: "공성하는쪽이랑 수성하는쪽이 어딘지 모르겠고") — 길에서 맞닥뜨린 싸움엔 없다 */
  const roleChip = (atk: boolean): string => (l.field === true ? '' : `<em class="wrole ${atk ? 'atk' : 'def'}">${atk ? tr('war.warhtml.6') : tr('war.warhtml.7')}</em>`)
  const fieldHtml = (): string => {
    const fin = l.pending === undefined && shown >= (l.rounds ?? []).length && l.outcome !== undefined && l.outcome !== 'draw'
    const highlights = last !== undefined && anim ? roundHighlights(last, fin ? l : null) : {}
    const moraleBadge = (i: 0 | 1, cls: 'us' | 'foe', faction: string | undefined): string => {
      const change = moraleLoss(i)
      if (change === 0) return ''
      const up = change < 0
      const flag = flagIcon(faction)
      const emblem = flag === undefined ? '' : `<img src="${art}icon/${flag}.png" alt="">`
      return `<span class="wflag-morale ${cls}${up ? ' up' : ''}">${emblem}<small>${tr('war.lookhtml.11')}</small><b>${up ? '▲' : '▼'} ${Math.abs(change)}</b></span>`
    }
    if (st === undefined) return ''
    // 그림이 폰에 너무 많으면 잣대는 그대로 두고 맨 아랫자리만 버린다 — 두 쪽이 같은 자리 (원군은 따로 센다: 따로 그려지니까)
    const kindMen = (i: 0 | 1): number[] => Object.entries(st.mix?.[i] ?? {}).flatMap(([k, v]) => { const lv = Math.min(v ?? 0, st.late?.[i]?.[k as keyof NonNullable<typeof st.late>[0]] ?? 0); return [(v ?? 0) - lv, lv] })
    const prec = tierPrec([kindMen(0), kindMen(1)], P.realm.warTokCap)
    const RANK: Readonly<Record<string, 0 | 1 | 2>> = { spear: 0, pike: 0, shield: 0, boat: 0, axe: 0, militia: 0, bow: 1, crossbow: 1, horse: 2 }
    const SOL = new Set(['spear', 'shield', 'bow', 'crossbow', 'horse', 'pike', 'boat', 'axe', 'marine'])
    const sea = warGround(prev, l) === 'sea'
    const pd = l.pending
    const play = anim && last !== undefined
    const captures = last === undefined ? [] : captureAttempts(last)
    /**
     * 싸움터의 땅 — 규칙이 전장에 보이게 (형: 규칙은 지도에 보이게 · 10-25 전장에도).
     * 지키는 쪽 진 앞: 목책(도읍·산성은 성문) · 해자 물 · 고갯길이면 옆구리 돌무더기. 공격이 이기면 목책이 부서져 있다.
     * 화살이 오간 뒤엔 그 앞줄 곁에 꽂힌 화살이 남는다. 두 진 사이: 나루·갈대·갯벌이면 강물과 갈대
     */
    const node = prev.nodes[l.node]
    const defCls: 'us' | 'foe' = weAtk ? 'foe' : 'us'
    const shot = (sd: 'a' | 'd'): boolean => rounds.some((rd) => (sd === 'a' ? rd.oa : rd.od)?.bows !== undefined)
    const tp = (k: string, x: number, oy: number, sc: number, flat = false): string =>
      `<img class="tp${flat ? ' flat' : ''}" src="${art}fx/field/${k}.png" alt="" style="--x:${(x + oy * 0.22).toFixed(1)}%;--oy:${oy}%;--sc:${sc};z-index:${(flat ? 2 : 10) + Math.round(oy + 40)}">`
    // 땅 이름표(「목책 · 적에게 유리」)는 전장 위 띠(.wterr)에 모은다 — 소품 곁에 띄우면 목책·나루 이름표가 가운데서 서로·병사와 겹쳤다 (형 10-26).
    // 소품 자체(성·말뚝·물)를 누르고 있거나 마우스를 올리면 그 땅의 설명이 뜬다 (fieldHit 의 data-tk)
    // 해자 — 물가(나루·갈대·갯벌)에서 싸우면 그 강이 해자 노릇이라 따로 안 그린다 (형 10-26: "해자랑 물가랑 겹쳐 버리는 듯")
    const hasMoat = l.field !== true && node !== undefined && node.tags.includes('moat') && l.via !== 'ford' && l.via !== 'reeds' && l.via !== 'mudflat'
    const terrainProps = (cls: 'us' | 'foe'): string => {
      let h = ''
      if (cls === defCls && l.field !== true && node !== undefined) {
        const breached = l.pending === undefined && shown >= (l.rounds ?? []).length && (l.outcome === 'win' || l.outcome === 'rout')
        // 끝 합이 풀리는 중이면 「승리·패배」가 뜨는 때(--rv)에 바꾼다 — 그 전엔 멀쩡한 성 (형 10-25: "결과 나오기 전엔 이런 승패를 연출로 힌트줘선 안돼")
        const late = breached && play
        // 해자 — 그림 다섯 장을 겹쳐 붙이던 것을 한 줄기 물길로 (형 10-26: "녹색물 이미지 아직도 5개 통째로 복붙") · 진 앞을 비스듬히 따라 내려오며 넓어진다
        // 물가(나루·갈대·갯벌)에서 싸우면 그 강이 해자 노릇 — 따로 그리면 겹친다 (형 10-26: "해자랑 물가랑 겹쳐 버리는 듯")
        // 물길 그림은 진 층이 아니라 땅 층(lowTerr)에 깐다 (형 10-26: "강과 해자는 늘 다른 것보다 뒤")
        // 성벽·목책은 판정에 있는 것만 그린다 (season.fortMul — 목책 꼬리표 · 산성) · 그냥 도읍에 울타리를 그리면 없는 수비 덤을 있는 것처럼 보였다
        if (node.tags.includes('palisade') || node.kind === 'fort') {
          const gate = node.kind === 'fort' || node.kind === 'capital'
          // 지키는 쪽 뒤에 성 — 흙 성벽·목책·망루 (공격이 이기면 부서져 불탄다) · 어느 쪽이 성을 지키는지 한눈에 (형 10-25: "공성하는쪽이랑 수성하는쪽이 어딘지 모르겠고")
          const wall = (b: boolean, cls = ''): string => `<img class="wf-wall${cls}" data-tk="${node.kind === 'fort' ? 'fort' : 'palisade'}" src="${art}fx/field/wall-${b ? 'breach' : 'whole'}.png" alt="">`
          h += late ? wall(false, ' wf-pre') + wall(true, ' wf-post') : wall(breached)
          // 목책 — 깎은 통나무 말뚝을 하나하나 세운다(굵기·높이·기울기가 저마다) · 가로대·새끼줄 · 도읍·산성은 망루 둘 사이 성문.
          // 깨지면 말뚝이 꺾이고 쓰러지고 그을린다 (형 10-26: "목책 더 잘 구현해야" · 메모리: 이펙트는 낱낱이)
          // 말뚝은 늘 감싸개(wf-tw) 안에 — 끝 합에 감싸개가 생기며 진의 그림이 한 칸씩 밀려 모두 새로 그려지던 것 (형 10-31: 끝날 때 낱낱이 깜빡)
          h += late ? `<i class="wf-tw wf-pre">${stakes(art, false, gate)}</i><i class="wf-tw wf-post">${stakes(art, true, gate)}</i>` : `<i class="wf-tw">${stakes(art, breached, gate)}</i>`
        }
      }
      if (cls === defCls && l.via === 'pass') { h += tp('rocks', 30, -36, 0.9); h += tp('rocks', 24, 32, 1.1) }
      return h
    }
    const ford = l.via === 'ford' || l.via === 'reeds' || l.via === 'mudflat'
    // 물가 — 나루·갈대는 강물과 갈대, 갯벌은 진흙 빛 (강물 그림을 진흙 빛으로)
    const mud = l.via === 'mudflat'
    // 고을을 치는 싸움의 물가는 건너오는 쪽(치는 쪽) 앞으로 비켜 흐른다 — 지키는 쪽 목책·해자와 겹치지 않게 (형 10-26: "개울이나 물가는 불리한 쪽에 아예 이동해 있어야")
    const siege = l.field !== true && node !== undefined
    const rvShift = ford && siege ? (defCls === 'us' ? 1 : -1) * P.realm.warFordShift : 0
    // 두 진 사이의 물 — 강물 그림 다섯 장을 겹쳐 붙였더니 물가로 안 보였다 (형 10-25: "불가 이미지 5개 대충 붙여넣으면 그게 물가냐").
    // 이제 한 줄기로 그린다: 지평선에서 내려오며 넓어지는 강(원근) · 강둑 · 천천히 흐르는 물결 · 둑의 갈대. 갯벌은 젖은 진흙 · 물웅덩이 · 갯골
    // 땅 층 — 강·갯벌·해자는 늘 군사와 목책 밑 (형 10-26: "창병 유닛들이 해자 뒤에 그려지고 있음 · 목책도 물 뒤에 그려지는데")
    // 해자는 지키는 쪽 진 앞이라 적이 지키면 거울로 뒤집는다
    const moatLow = hasMoat ? moatSvg(defCls === 'foe') : ''
    const midTerr = ford || moatLow !== ''
      ? `<div class="wf-mid-terr${mud ? ' mud' : ''}">${moatLow}${ford ? `${waterSvg(mud, rvShift)}${mud ? '' : REEDS_AT.map(([x, oy, s]) => tp('reeds', x + rvShift - oy * 0.22, oy, s)).join('')}` : ''}</div>`
      : ''
    const side = (i: 0 | 1, cls: 'us' | 'foe', o: RoundOrder | undefined, hero: string | null, f: string | undefined): string => {
      const mix = mixOf(i)
      const all = Object.entries(mix).filter(([, v]) => (v ?? 0) > 0) as Array<[string, number]>
      const men = all.reduce((s, [, v]) => s + v, 0)
      const fc = f !== undefined ? (FACTION_ART[f]?.color ?? '#888') : '#888'
      const em = flagIcon(f)
      // 사령관은 진 뒤에 선다. 사로잡기 표적이 부장이면 해당 합에만 따로 그린다.
      // 결은 장수에서 (art.ts generalSprite: 명궁 활 · 통솔 말 · 여인 창 · 무예 언월도 · 그 밖 환두대도). 사로잡히거나 쓰러지면 그 합에 쓰러지고 다음 합부터 누워 있다
      const capture = captures.find((c) => c.side === (i === 0 ? 'd' : 'a'))
      const knownTarget = capture?.target
      const target = knownTarget !== undefined && (prev.heroes[knownTarget] ?? after.heroes[knownTarget]) !== undefined ? knownTarget : hero
      // 사로잡힌 장수는 제 진에 눕지 않는다 — 잡힌 합에는 제자리에서 쓰러지고(gtaken) 잡은 장수가 이고 가서, 그 뒤로는 잡은 쪽 진 땅바닥에 누워 있다 (형 11-08 · battle-capture.ts)
      const takenIds = new Set(rounds.flatMap((rd) => { const c = caughtIn(rd); return c !== undefined ? [c.target] : [] }))
      const genOf = (id: string | null, aide = false): string => {
        const gh = id !== null ? (prev.heroes[id] ?? after.heroes[id]) : undefined
        if (id === null || gh === undefined) return ''
        const ga = genArtOf(generalSprite(gh, P.realm.tacArtMinStat))
        const caught = capture?.succeeded === true && target === id
        const takenNow = play && caught
        if (takenIds.has(id) && !takenNow) return ''
        const gDown = caught || rounds.some((rd) => rd.lostHero?.hero === id)
        const gNow = anim && (caught || last?.lostHero?.hero === id)
        const gCls = ` gsp g-${ga.kind}${ga.bow === true ? ' gbw' : ''}${ga.mount === true ? ' gmt' : ''}${gNow ? ' gfall' : gDown ? ' gdown' : ''}${takenNow ? ' gtaken' : ''}${aide ? ' gcap-aide' : ''}`
        return `<span class="wgen${gCls}" data-hero="${esc(id)}" style="--fc:${fc};--gar:${ga.ar.toFixed(3)};--gb:${ga.body.toFixed(3)};--k:${idlePhase(id)}"><i class="wpole">${em !== undefined ? `<img src="${art}icon/${em}.png" alt="">` : ''}</i><i class="gbody"><b class="gspf" style="background-image:url('${art}${ga.file}')"></b></i>${face(id, art, 'unit-general')}</span>`
      }
      // 우리가(이 진이) 사로잡은 적장들 — 장수 발치 땅바닥에 쓰러진 채 (쓰러짐 컷 19). 이번 합에 잡은 이는 이고 올 때까지 숨어 있다(.late)
      const mySide: 'a' | 'd' = i === 0 ? 'a' : 'd'
      const captives = rounds.flatMap((rd) => { const c = caughtIn(rd); return c !== undefined && c.side === mySide ? [{ id: c.target, late: play && rd === last }] : [] })
      const captiveHtml = captives.map(({ id, late }, k) => {
        const gh = prev.heroes[id] ?? after.heroes[id]
        if (gh === undefined) return ''
        const ga = genArtOf(generalSprite(gh, P.realm.tacArtMinStat))
        return `<i class="wcapt${late ? ' late' : ''}" data-hero="${esc(id)}" style="--ci:${k};--gar:${ga.ar.toFixed(3)};--gb:${ga.body.toFixed(3)}"><b class="wcaptf" style="background-image:url('${art}${ga.file}')"></b></i>`
      }).join('')
      const gen = genOf(hero) + (play && target !== hero ? genOf(target, true) : '') + captiveHtml
      // 이번 합에 잡으러 나간 쪽 진은 맞은편 진 위에 그린다 — 적진 한가운데로 뛰어든 장수가 적 병사 그림 밑에 묻혀 안 보였다
      const capBy = captives.some((x) => x.late) ? ' wcapby' : ''
      const cues = `<i class="wq q-charge"><b>${tr('war.cmdName.charge')}</b></i><i class="wq q-hold"></i><i class="wq q-shoot"></i><i class="wq q-ride"></i><i class="wq q-cap"><b>${tr('war.warhtml.8')}</b></i><i class="wq q-back"><b>${tr('war.duskname.2')}</b></i>`
      if (men <= 0) return `<div class="wf2s ${cls}${capBy}"${formAttrs(o)}>${terrainProps(cls)}${gen}${cues}</div>`
      // 병사 그림 — 어느 싸움이든 한 잣대: 작은 병사 10명 · 큰 병사(2배) 100명 · 깃발 병사 1000명 (troops.ts · 형 11-01: "보기만 해도 몇명인지").
      // 전엔 큰 쪽 군대에 맞춘 로그 눈금(백 명 8 · 천 명 13)이라 920 명과 340 명이 13 대 5 로 보였다 — 판마다 잣대가 달라 셀 수가 없었다
      const RG: readonly Grp[] = ['front', 'bows', 'horse']
      const g0 = groupMen(mix as Parameters<typeof groupMen>[0])
      const gOf = (rd: RoundLog | undefined): Readonly<Partial<Record<Grp, number>>> | undefined => (rd === undefined ? undefined : i === 0 ? rd.ga : rd.gd)
      // 원군 — 닿기 전엔 그 몫의 그림을 숨기고(쓰러진 병사로 그리면 원군이 와서 되살아나 보였다), 닿는 합에 걸어 들어온다 (형 10-28: "원군 들어와도 어색하지 않게")
      const sd: 'a' | 'd' = i === 0 ? 'a' : 'd'
      const lateMix: Readonly<Partial<Record<string, number>>> = st.late?.[i] ?? {}
      const lateG = groupMen(lateMix as Parameters<typeof groupMen>[0])
      const came = rounds.some((rd) => rd.relief?.side === sd)
      const cameNow = anim && came && !rounds.slice(0, -1).some((rd) => rd.relief?.side === sd)
      /** 병종 k 에 남은 사람 — 무리(창·활·말)마다 남은 수(ga·gd)를 병종 몫대로 나눈다. 기록이 없는 옛 판은 전체 몫(share) · here: 원군까지 센다 */
      const leftOf = (k: string, v: number, lv: number, gm: Readonly<Partial<Record<Grp, number>>> | undefined, share: number, here: boolean): number => {
        const base = here ? v : v - lv
        if (base <= 0) return 0
        // 몫(share)은 원군까지 친 전체에서의 몫 — 원군이 아직 안 닿았으면 와 있는 사람 몫으로 바꿔 센다.
        // 그대로 곱하면 첫 합도 붙기 전에 와 있는 병사가 원군 몫만큼 쓰러져 보였다 (형 11-02: "협공할 때 합 붙은 적도 없는데 아군이 미리 죽어 있다")
        if (gm === undefined) return base * (here ? share : Math.min(1, share / Math.max(1e-9, here0(i))))
        const g = RG[RANK[k] ?? 0]!
        return (base * (gm[g] ?? 0)) / Math.max(1, here ? g0[g] : g0[g] - (lateG[g] ?? 0))
      }
      type Tok = { k: string; r: 0 | 1 | 2; t: Tier; s2: string }
      const rows: [Tok[], Tok[], Tok[]] = [[], [], []]
      const order = all.sort((p, q) => (RANK[p[0]] ?? 0) - (RANK[q[0]] ?? 0) || q[1] - p[1])
      for (const [k, v] of order) {
        const lv = Math.min(v, lateMix[k] ?? 0)
        const cP = tierCounts(v - lv, prec)
        const cL = tierCounts(lv, prec)
        const cA: [number, number, number] = [cP[0] + cL[0], cP[1] + cL[1], cP[2] + cL[2]]
        // 서 있는 수 — 지금(이 합 뒤) · 이 합 앞. 원군이 닿았으면 원군까지 한데 센다
        const stand = (gm: Readonly<Partial<Record<Grp, number>>> | undefined, share: number, here: boolean): readonly number[] =>
          here ? tierStanding(cA, v, leftOf(k, v, lv, gm, share, true)) : tierStanding(cP, v - lv, leftOf(k, v, lv, gm, share, false))
        const now = stand(gOf(last), n(i), came)
        const before = anim ? stand(was !== undefined ? gOf(was) : g0, n0(i), came && !cameNow) : now
        const r = (RANK[k] ?? 0) as 0 | 1 | 2
        for (const t of [0, 1, 2] as const) {
          for (let q = 0; q < cA[t]; q++) {
            const late = q >= cP[t]
            // 'fall' 은 군주가 무너진 판(.ap .fall — 액자 테)과 이름이 겹쳐 말이 큰 액자로 그려졌다 (10-25)
            const s2 = late && !came ? 'tkh' : late && cameNow ? (q < now[t]! ? 'tku tkn' : 'tkd') : q < now[t]! ? 'tku' : q < before[t]! ? 'tkf' : 'tkd'
            rows[r].push({ k, r, t, s2 })
          }
        }
      }
      let idx = 0
      const TSC = [1, P.realm.warTokBigSc, P.realm.warTokFlagSc] as const
      // 병사 하나 — 큰 병사는 크게, 깃발 병사는 등에 나라 깃발
      const tok = (tk: Tok, x: number, oy: number): string => {
        const k = solArt(tk.k, sea)
        const mil = tk.k === 'militia' ? ' tkm' : '' // 농민군 — 조금 작게
        const { r, s2 } = tk
        const hl = oy < -0.5 ? ' hi' : oy > 0.5 ? ' lo' : ''
        const sc = ((0.8 + 0.4 * ((oy + 40) / 80)) * TSC[tk.t]).toFixed(2)
        const tb = tk.t > 0 ? ` tb${tk.t}` : ''
        const ban = tk.t === 2 && em !== undefined ? `<u class="tkban"><img src="${art}icon/${em}.png" alt=""></u>` : ''
        const pos = `--x:${(x + oy * 0.22).toFixed(1)}%;--oy:${oy.toFixed(1)}%;--sc:${sc};--j:${idx % 6};--k:${(((idx++ * 47) % 97) / 97).toFixed(2)};z-index:${10 + Math.round(oy + 40)}`
        // 동작 그림이 있는 병종은 컷으로 움직인다 (서기 · 걷기 · 찌르기 · 쓰러짐 — public/realm/anim · tools/strip-frames.mjs)
        const ar = ANIM_SOL[k]
        // 새 20컷 띠가 있으면 그것 — 말의 자리·크기는 옛 비(--ar), 안의 그림만 --r 배 넓다
        const a2 = SOL_ANIM2[k]
        if (ar !== undefined && a2 !== undefined) return `<i class="tk wsp v2 k-${k} r${r}${tb}${hl}${mil} ${s2}" style="${pos};--ar:${ar.toFixed(3)};--r:${(a2 / ar).toFixed(3)}"><b class="spf" style="background-image:url('${art}anim-px/${k}.png')"></b>${ban}</i>`
        if (ar !== undefined) return `<i class="tk wsp k-${k} r${r}${tb}${hl}${mil} ${s2}" style="${pos};--ar:${ar.toFixed(3)}"><b class="spf" style="background-image:url('${art}anim/${k}.png')"></b>${ban}</i>`
        return `<img class="tk r${r}${tb}${hl}${mil} ${s2}" src="${art}icon/sol-${SOL.has(k) ? k : 'spear'}.png" alt="" style="${pos}">`
      }
      /**
       * 한 무리(세로 진) — 앞 겹엔 작은 병사, 뒤 겹으로 갈수록 큰 병사 (큰 병사가 작은 병사를 가리지 않고 · 쓰러지는 것도 맞부딪는 앞 겹의 작은 병사부터).
       * 한 겹에 다섯까지, 많으면 겹을 늘려 두꺼운 네모 진이 된다 (한 줄로 길게 늘어지면 진이 아니라 줄로 보였다 · 형 10-25). 큰 병사 겹은 그만큼 넓게. 돌려주는 값은 맨 뒤 겹의 자리
       */
      const column = (ts: readonly Tok[], x0: number): [string, number] => {
        const sorted = [...ts].sort((p, q) => p.t - q.t)
        const nl = Math.max(1, Math.ceil(sorted.length / 5))
        const per = Math.ceil(sorted.length / nl)
        let x = x0
        let h = ''
        for (let li = 0; li < nl; li++) {
          const ln = sorted.slice(li * per, (li + 1) * per)
          const w = TSC[ln[ln.length - 1]?.t ?? 0]
          if (li > 0) x -= 4.5 * w
          const sp = Math.min(9 * w, 48 / Math.max(1, ln.length))
          h += ln.map((tk, j) => tok(tk, x, (j - (ln.length - 1) / 2) * sp + (li % 2) * sp * 0.25)).join('')
        }
        return [h, x]
      }
      // 기병 — 위 옆구리에 가로로 (큰 말은 그만큼 띄운다)
      let hx = 18
      const horse = [...rows[2]].sort((p, q) => q.t - p.t).map((tk, j) => { const x = hx; hx += 4.2 * TSC[tk.t]; if (j % 6 === 5) hx = 18; return tok(tk, x, -34 + Math.floor(j / 6) * 7) }).join('')
      // 뒷줄·옆을 먼저 세고 앞줄을 나중에 — 쓰러지는 것은 맞부딪는 앞줄부터. 궁수는 앞 무리의 맨 뒤 겹 뒤에
      const [front, fBack] = column(rows[0], 37)
      const bowX = Math.max(15, Math.min(22, fBack - 7))
      const [bows] = column(rows[1], bowX)
      // 무리마다 제 깃발 박자 — 그 박자에 앞줄이 나서고 · 기병이 돌고 · 화살이 난다. 박자가 없으면(깃발 연출 수를 넘었으면) 맞부딪기 조금 앞
      const beatOf = (c: Cmd | undefined): number => (c === undefined ? 0 : plan?.beats.find((x) => x.ours === (cls === 'us') && x.c === c)?.at ?? Math.max(0, (plan?.clash ?? 1) - 0.7))
      const shoot = play && o?.bows !== undefined && rows[1]!.length > 0 ? beatOf(o.bows) : null
      // 쏘는 횟수 — 첫 살(--sa)부터 합이 끝날 때(맞부딪힘 + 1.2초)까지 한 박자(CSS spshot 1.1초)마다 한 번씩 (활 당기기와 화살 날기가 같은 수로 되풀이된다)
      const volleys = shoot === null ? 1 : Math.max(2, Math.min(6, Math.floor(((plan?.clash ?? shoot) + 1.2 - shoot) / 1.1) + 1))
      const tempo = play ? ` style="--fa:${beatOf(o?.front).toFixed(2)}s;--ha:${beatOf(o?.horse).toFixed(2)}s;--sa:${(shoot ?? 0).toFixed(2)}s;--bn:${volleys}"` : ''
      const terr = terrainProps(cls)
      // 꽂힌 화살 — 맞은편이 쏜 적이 있으면 이쪽 앞줄 곁에. 진의 맨 뒤에 붙인다(앞에 끼면 뒤의 병사 그림이 다 새로 만들어져 깜빡였다)
      const stuck = shot(cls === 'us' ? (weAtk ? 'd' : 'a') : (weAtk ? 'a' : 'd')) ? [-14, 4, 22].map((oy) => tp('arrows', 41, oy, 0.55)).join('') : ''
      // 적이 흔들린다(사기가 꺾여 방진도 돌격을 못 받아 낼 지경) — 고를 때 적 진이 떨고 깃발이 기운다 (판세가 눈에 보이게)
      const waver = !play && cls === 'foe' && pd !== undefined && pd.round === shown && pd.foeWaver ? ' waver' : ''
      // 무리마다 정확한 수 — 진 발치에 (그림은 어림, 숫자는 정확 · 토탈워의 부대 카드처럼). 줄 때는 막대와 같은 때에 센다
      const gAt = (g: Grp, rd: RoundLog | undefined, share: number, here: boolean): number => Math.round(gOf(rd)?.[g] ?? (g0[g] - (here ? 0 : lateG[g] ?? 0)) * share)
      const gLeft = (g: Grp): number => gAt(g, last, n(i), came)
      const gWas = (g: Grp): number => (anim ? gAt(g, was, n0(i), came && !cameNow) : gLeft(g))
      const chipAt: Readonly<Record<Grp, string>> = { front: 'left:37%;top:calc(60% + 27%)', bows: `left:${bowX}%;top:calc(60% + 27%)`, horse: 'left:24%;top:27%' }
      const gChips = RG.filter((g) => rows[RG.indexOf(g)]!.some((tk) => tk.s2 !== 'tkh'))
        .map((g) => `<b class="wgct${gLeft(g) <= 0 ? ' none' : ''}" style="${chipAt[g]}"><img src="${art}icon/${GROUP_ICON[g]}.png" alt="">${cnt(gWas(g), gLeft(g))}</b>`).join('')
      return `<div class="wf2s ${cls}${waver}${capBy}"${formAttrs(o)}${tempo}>${terr}${gen}${cues}${bows}${horse}${front}${stuck}${gChips}</div>`
    }
    // 이 합에 낸 명령 (풀릴 때) · 고르는 중엔 우리는 고른 것, 적은 낌새
    const ordUs: RoundOrder | undefined = play ? (weAtk ? last!.oa : last!.od) : pd !== undefined ? sel : undefined
    const ordFoe: RoundOrder | undefined = play ? (weAtk ? last!.od : last!.oa) : pd?.hint != null ? { front: pd.hint } : undefined
    // 적 앞줄 위의 낌새 — 고를 때 눈에 먼저 들어오게 (형 10-24: "상대 낌새가 눈에 보이면서")
    const omen = pd === undefined || pd.round !== shown ? ''
      : pd.hint !== null ? `<div class="wf-omen${pd.hintSrc === 'habit' ? ' habit' : ''}"><img src="${flagSrc(art, pd.hint)}" alt=""><span><b>${OMEN_WORD[pd.hint] ?? CMD_NAME[pd.hint]}</b><small>${pd.hintSrc === 'habit' ? tr('war.wartip.6') : tr('war.wartip.7')}</small></span></div>`
        : `<div class="wf-omen none"><i>?</i><span><b>${tr('war.warhtml.9')}</b><small>${tr('war.warhtml.10')}</small></span></div>`
    // 맞부딪는 자리에 불꽃·흙먼지 · 양쪽이 잃은 수가 떠오른다 · 싸움이 처음 열리면 두 군대가 대열을 지어 들어온다
    const lost = (i: 0 | 1): number => Math.max(0, Math.round(men0(i) * (lostBase(i) - n(i))))
    const popOf = (i: 0 | 1, cls: 'us' | 'foe'): string => {
      const ln = lost(i)
      const critical = highlights[i === 0 ? 'a' : 'd']
      if (ln === 0 && critical === undefined) return ''
      return `<div class="wside-loss ${cls}${critical === undefined ? '' : ' critical'}">${ln > 0 ? `<b>${tr('war.warhtml.11', { ln: ln.toLocaleString('ko-KR') })}</b>` : ''}${critical === undefined ? '' : `<small>${critical}</small>`}</div>`
    }
    const hit = play ? popOf(ourI, 'us') + popOf(foeI, 'foe') + moraleBadge(ourI, 'us', ourF) + moraleBadge(foeI, 'foe', foeF) : ''
    const enter = !anim && shown === 0 ? ' enter' : ''
    // 판의 끝 — 진 쪽은 무너져 등을 돌려 달아나고, 이긴 쪽은 한 발 나서며 장수 깃발을 높이 든다 (형 10-25: 승패가 전장에서 보이게)
    const atkWon = l.outcome === 'win' || l.outcome === 'rout'
    const usWon = weAtk === atkWon
    const endCls = fin ? (usWon ? ' fin win-us' : ' fin win-foe') : ''
    // 승패가 드러나는 때 — 「승리·패배」 글자와 같은 때(paintNow 의 endAt). 다시 그린 끝 판(연출 없음)이면 처음부터
    const rv = fin && play ? roundPlan(last!, weAtk).result + 0.9 : 0
    // 상성 판정 — 맞부딪는 순간 한가운데 크게 (형 10-29: "전투가 깃발마다 큰 차이가 없는 느낌") · 이기거나 지면 전장이 크게 흔들린다
    const mu = play ? roundMatch(last!, ourS) : null
    // 잣대 — 작은 병사 10 · 큰 병사 100 (· 깃발 병사 1000 은 그런 병사가 섰을 때만). 읽지 않아도 크기 차이로 보이게 그림 셋을 크기대로
    const used = [0, 1, 2].filter((t) => t === 0 || [kindMen(0), kindMen(1)].some((ks) => ks.some((v) => (tierCounts(v, prec)[t] ?? 0) > 0)))
    const legend = `<div class="wleg" aria-label="${tr('war.warhtml.12')}">${used.map((t) => `<span class="l${t}"><img src="${art}icon/sol-spear.png" alt="">${TIER_MEN[t]!.toLocaleString('ko-KR')}</span>`).join('')}</div>`
    return `<div class="wfield${play ? ' play' : ''}${captures.length > 0 ? ' capture-round' : ''}${enter}${endCls}" style="--hd:${plan?.clash ?? STAGE_S[1] + 0.15}s;--bd:${tAt(2)}s;--rv:${rv.toFixed(2)}s;--ce:${(plan?.result ?? 0).toFixed(2)}s"><i class="wf-ground"></i>${midTerr}${side(ourI, 'us', ordUs, ourHero, ourF)}${side(foeI, 'foe', ordFoe, foeHero, foeF)}${legend}<i class="wf-mid">⚔</i><b class="wf-who us">${tr('war.warhtml.13', { roleChip: roleChip(weAtk), ourName: esc(ourName) })}</b><b class="wf-who foe">${tr('war.warhtml.14', { roleChip: roleChip(!weAtk), foeName: esc(foeName) })}</b>${hit}${omen}${mu !== null ? muHtml(art, mu) : ''}</div>`
  }

  // 싸움터 배경 (땅마다) · 위 카드는 굴려도 그 자리에 (형: "싸우는로그가 스크롤로 보이더라도 상단에 캐릭터랑 체력바 있는 그 카드는 고정")
  const ground = warGround(prev, l)
  // 해시계의 하늘 — 지금 때가 어둠 속이면 어둡게, 마지막 때를 묻는 중이면 노을(밤 싸움이면 새벽빛) (그림은 읽기만 한다)
  const ck = l.clock
  const nowI = l.pending !== undefined && l.pending.round === shown ? l.pending.round : shown - 1
  const sky = ck === undefined ? '' : l.pending?.dusk !== undefined && l.pending.round === shown ? (ck.night ? ' dk-dawn' : ' dk-dusk') : nowI >= 0 && nightAt({ clock: { ...ck, edge: false } }, nowI) ? ' dk-night' : ''
  let h = `<div class="wbg g-${ground}${WAR_BG_READY.has(ground) ? '' : ' stand'}${sky}" style="background-image:url('${warBg(art, ground, !weAtk)}')"></div>`
  // 싸움의 기운 — 흙먼지 둘이 바닥을 흐르고, 이 합에 활을 쏜 쪽에서 화살이 낱낱이 활꼴로 날아간다 (그림: realm/fx)
  h += `<div class="wfx"><img class="wfx-dust a" src="${art}fx/dust.png" alt=""><img class="wfx-dust b" src="${art}fx/dust.png" alt="">${AIR_EMBERS}`
  if (anim && last !== undefined) {
    // 깃발마다 제 차례 — 차례가 끝나면 걷힌다 (다음 깃발과 겹치지 않게)
    for (const b of roundPlan(last, weAtk).beats) {
      const end = b.at + b.len - 0.06
      // 무리 명령은 전장의 진이 제 박자에 직접 움직인다 — 화면을 가로지르던 큰 깃발·화살비는 진을 가렸다 (형 10-25). 장수 기술·땅의 수만 남긴다
      if (FIELD_CMD.has(b.c)) continue
      // 불화살 — 불붙은 화살이 날아가고(fx/fire-arrow · 한 개짜리를 여럿으로) 적 앞줄에 불길이 솟는다 (형 10-26: "불화살은 별도로 이미지가 없었지")
      if (!SHOOT_CMD.has(b.c) || b.c === 'fire') h += cmdFxHtml(art, b.c, b.dir, b.at, end)
    }
    // 장수 기술의 여운 — 컷인이 걷힌 뒤 전장 제자리에 (우리 것 · 적 것 · 먹힌 것만 · 11-08)
    for (const x of last.acts ?? []) if (x.g === 'lead' && (x.c === 'art' || x.c === 'wake') && skillRes(x.res) !== 'miss') h += artFieldFxHtml(art, x.c === 'wake' ? x.wake : x.art, x.s === (weAtk ? 'a' : 'd') ? 'r' : 'l', (P.realm.warSkEndMs * P.realm.warSkSpeed) / 1000)
  }
  h += `</div><div class="wrbox">`
  // 위 카드는 그 싸움터를 무대로 — 길·성문·물가·눈밭·밤 (형 10-23: "길에서 마주치거나 수성하거나 공성할 때는 그 위치에 맞게 배경")
  // 머리 카드도 같은 하늘 — 그림 위에 한 겹 (어둠 · 노을 · 새벽빛)
  const skyLayer = sky === ' dk-night' ? 'linear-gradient(#0a1440aa, #05081add), ' : sky === ' dk-dusk' ? 'linear-gradient(#ff7a2a77, #a0302a44 50%, #1a0a0a88), ' : sky === ' dk-dawn' ? 'linear-gradient(#ffd8a866, #8aa0d044 50%, #0d0f1366), ' : ''
  const speeds = `<div class="wspeed" role="group" aria-label="${tr('war.warhtml.16')}">${BATTLE_SPEEDS.map((n) => `<button type="button" data-war="speed" data-speed="${n}" aria-pressed="${n === speed}">${tr('war.warhtml.15', { n })}</button>`).join('')}</div>`
  h += `<div class="wtop" style="--wtbg:${skyLayer}url('${warBg(art, ground, !weAtk)}')"><div class="wrh"><span class="wrk">${((k) => `<i class="wkind ${k.us ? 'us' : 'foe'}">${esc(k.word)}</i>`)(warKind(prev, l, me))}<b>${esc(warName(after, l))}</b></span>${left > 1 ? `<span class="mute">${tr('war.warhtml.17', { turnWord: turnWord(after), left })}</span>` : ''}<div class="wrbt"><button class="wsgb" data-war="mu" aria-label="${tr('war.warhtml.20')}">${tr('war.warhtml.21')}</button>${`<button class="wlogb${rounds.length > 0 ? '' : ' off'}" data-war="log" aria-label="${tr('war.warhtml.18')}"${rounds.length > 0 ? '' : ' disabled'}>${tr('war.warhtml.19')}</button>`}${speeds}</div><button class="whelp" data-war="help" aria-label="${tr('war.warhtml.22')}">?</button></div>${clockHtml(l, shown)}`
  // 땅 띠 — 전장 바로 위 제 자리에 (형 10-26: "목책이랑 나루 둘다 가운데 설명 '우리에게 유리' 이게 다른거랑 겹쳐짐")
  const terr = terrChips(prev, l, me, fname(foeF)).map((c) => terrChipHtml(art, c, 'wtc')).join('')
  h += `<div class="wvs">${side(ourI, ourHero, ourF, ourName, 'us')}<img class="vs" src="${art}ui/vs.png" alt="VS">${side(foeI, foeHero, foeF, foeName, 'foe')}</div>${terr !== '' ? `<div class="wterr">${terr}</div>` : ''}${fieldHtml()}</div>`
  if (keys !== '') h += `<style>${keys}</style>`
  // 지나간 합들 — 마지막 합만 천천히 · 평소엔 마지막 합만 전장 위 상자로 떴다 사라지고, 다 보려면 위의 「기록」 (형 10-28)
  h += `<button class="wlogbg" data-war="log" aria-label="${tr('war.warhtml.23')}"></button><div class="wlog"><button class="btn sm wlogx" data-war="log">${tr('war.sghtml.22')}</button>`
  // 마지막 때의 고름 — 묻는 중이면 그 자리부터는 아직 안 고른 것(맡긴 셈)이라 빼고
  const askK = l.pending?.dusk !== undefined && l.pending.round === shown ? l.pending.dusk.k : Infinity
  const dusks = (l.dusk ?? []).filter((_, j) => j < askK)
  rounds.forEach((rd, i) => {
    const slow = anim && i === rounds.length - 1
    for (const dk of dusks) if (dk.at === i && ck !== undefined) h += duskRow(dk, ck, ourS)
    const prevN = i === 0 ? [1, 1] : [rounds[i - 1]!.na, rounds[i - 1]!.nd]
    const lostUs = Math.max(0, Math.round(men0(ourI) * ((prevN[ourI] ?? 1) - (ourI === 0 ? rd.na : rd.nd))))
    const lostFoe = Math.max(0, Math.round(men0(foeI) * ((prevN[foeI] ?? 1) - (foeI === 0 ? rd.na : rd.nd))))
    const [pw, pc] = pushWord(rd.push, weAtk, lostUs, lostFoe)
    const crit = rd.beat === ourS
    const d = (k: 0 | 1 | 2): string => (slow ? ` style="--d:${tAt(k)}s"` : '')
    h += `<div class="wrd${slow ? ' slow' : ''}${crit ? ' crit' : ''}${rd.night === true ? ' night' : ''}"${slow ? ` style="--pd:${(tAt(2) + P.realm.warRoundPopHoldS).toFixed(2)}s"` : ''}><div class="wrn">${tr('war.warhtml.24', { v1: ck !== undefined ? `${slotName(ck, i)} · ` : '', v2: nth(ROUND_KEYS, i) ?? `${i + 1}` })}</div>${reliefBanner(rd, ourS, art)}`
    const akOf = (sd: 'a' | 'd'): Art | undefined => (rd.acts ?? []).find((x) => x.c === 'art' && x.s === sd)?.art
    const wkOf = (sd: 'a' | 'd'): Elem | undefined => (rd.acts ?? []).find((x) => x.c === 'wake' && x.s === sd)?.wake
    h += `<div class="wcmds"${d(0)}><span class="wc us"><em class="wck">${tr('war.duskrow.1')}</em>${flags(weAtk ? rd.oa : rd.od, weAtk ? rd.a : rd.d, art, akOf(ourS), wkOf(ourS))}</span><i>×</i><span class="wc foe"><em class="wck">${tr('war.duskrow.2')}</em>${flags(weAtk ? rd.od : rd.oa, weAtk ? rd.d : rd.a, art, akOf(ourS === 'a' ? 'd' : 'a'))}</span></div>`
    const story = ctx !== null ? roundStory(rd, rounds[i - 1], ctx) : []
    // 누가 누구를 · 됐나 — 그림 줄이 먼저, 글 이야기는 그 밑에 작게
    const rows = actRows(rd.acts, ourS, art, mixOf(0), mixOf(1))
    h += `<div class="wst${rows !== '' ? ' sm' : ''}"${d(1)}>${rows}${story.map((s) => `<p>${esc(s)}</p>`).join('')}</div>`
    // 두 줄 창 — 일마다 그 깃발 연출이 나오는 때에 (맞는 깃발이 없으면 앞 줄 조금 뒤)
    const tick: Array<[string, number]> = []
    if (slow && plan !== null) {
      const used = new Set<Beat>()
      let at = plan.beats[0]?.at ?? 0
      for (const x of shownActs(rd.acts)) {
        const b = plan.beats.find((q) => !used.has(q) && q.ours === (x.s === ourS) && q.c === x.c)
        if (b !== undefined) { used.add(b); at = b.at } else at += P.realm.warTickMove + 0.15
        tick.push([actRow(x, ourS, art, mixOf(0), mixOf(1)), Math.min(at, plan.story)])
      }
    }
    // 끝줄은 밀고 밀린 말 — 잃은 수는 전장 위 숫자(.wside-loss)가 보인다
    const tickEnd = (push: string): string => {
      if (!slow || plan === null) return ''
      tick.push([push, plan.result])
      return tickerHtml(tick, `wtk${kn++}`)
    }
    // 사로잡기·물러나기로 끝난 합은 밀고 밀린 것이 없다
    if (rd.ev === 'capture-ok' || rd.ev === 'retreat') h += `<p class="wpush"${d(2)}>${tr('war.warhtml.25')}</p>${tickEnd(`<p class="wpush">${tr('war.warhtml.25')}</p>`)}</div>`
    else if (rd.ev === 'retreat-fail') { const w = rd.by === ourS ? tr('war.warhtml.26') : tr('war.warhtml.27'); h += `<p class="wpush"${d(2)}>${w}</p>${tickEnd(`<p class="wpush">${w}</p>`)}</div>` }
    else {
      // 무리마다 — 앞줄·활·말 그림과 잃은 수 (형: "전투로그에서도 다이나믹함이 보이게끔 유닛마다 아이콘도 같이")
      const gBefore = (sd: 0 | 1): Readonly<Partial<Record<Grp, number>>> => (i === 0 ? groupMen(mixOf(sd) as Parameters<typeof groupMen>[0]) : (sd === 0 ? rounds[i - 1]!.ga : rounds[i - 1]!.gd) ?? {})
      const chips = (sd: 0 | 1): string => groupLoss(gBefore(sd), sd === 0 ? rd.ga : rd.gd).map(([g, k]) => `<span class="wl"><img src="${art}icon/${GROUP_ICON[g]}.png" alt="">−${k}</span>`).join('')
      const cu = chips(ourI)
      const cf = chips(foeI)
      const loss = `<span class="us">${tr('war.warhtml.28', { v1: cu !== '' ? cu : `−${lostUs}` })}</span><span class="foe">${tr('war.warhtml.29', { v1: cf !== '' ? cf : `−${lostFoe}` })}</span>`
      h += `<p class="wpush ${pc}"${d(2)}>${pw}</p><p class="wloss"${d(2)}>${loss}</p>${tickEnd(`<p class="wpush ${pc}">${pw}</p>`)}</div>`
    }
  })
  // 마지막 때에 판이 끝났다 (진을 쳤다 · 물러났다) — 그 고름을 맨 끝에
  if (ck !== undefined) for (const dk of dusks) if (dk.at === rounds.length) h += duskRow(dk, ck, ourS)
  h += `</div>`

  const p = l.pending
  const ended = p === undefined && !more
  if (p !== undefined && p.round === shown && p.dusk !== undefined) {
    h += duskHtml(l, p.dusk, weAtk, art, anim, tAt(2) + 0.6)
  } else if (p !== undefined && p.round === shown) {
    // 다음 합의 깃발을 든다 — 무리마다 하나, 장수 하나
    h += `<div class="wnext"${anim ? ` style="--d:${(tAt(2) + 0.6).toFixed(2)}s"` : ''}><div class="wrn">${tr('war.warhtml.30', { v1: nth(ROUND_KEYS, shown) ?? `${shown + 1}` })} </div>`
    // 적진의 속·맞은편·땅은 전장에서 누르고 있거나 마우스를 올리면 (openWar 의 정보창 · warTip) — 여기엔 어떻게 보는지만
    h += `<p class="wfhint">${tr('war.warhtml.31')} <b>${tr('war.warhtml.32')}</b>${tr('war.warhtml.33')} <b>${tr('war.warhtml.34')}</b>${tr('war.warhtml.35')}</p>`
    h += `<p class="wb0g"><b>${tr('war.warhtml.36')}</b><span>${tr('war.warhtml.37')}</span></p>`
    if (p.foeWaver) h += `<div class="wintel"><div class="wi warn"><b>${tr('war.warhtml.38')}</b><p>${tr('war.warhtml.39')}</p><small>${tr('war.warhtml.40')}</small></div></div>`
    // 지난 합에 장수를 잃었다 — 누가 · 누가 지휘를 넘겨받았나 (형 10-25: "한 명 잡히면 바로 지는 건 말이 안 되는데")
    const lh = rounds[rounds.length - 1]?.lostHero
    if (lh !== undefined) {
      const ours = (lh.side === 'a') === weAtk
      const nm = (id: string): string => prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '?'
      // 우리 장수는 죽지 않는다 (season.battleFates) — 겨루기에서 지면 다쳐 물러난다
      const what = lh.how === 'taken' ? tr('war.warhtml.41') : ours ? tr('war.warhtml.42') : tr('war.warhtml.43')
      const next = lh.chief !== undefined ? tr('war.warhtml.44', { nm: nm(lh.chief) }) : ''
      h += `<div class="wintel"><div class="wi ${ours ? 'warn' : 'good'}"><b>${esc(tr('war.warhtml.lostHero', { side: ours ? tr('war.warhtml.ourSide') : tr('war.warhtml.45'), role: lh.chief !== undefined ? tr('war.warhtml.46') : tr('war.warhtml.47'), hero: nm(lh.hero), what }))}</b><p>${esc(tr('war.warhtml.48', { next }))}</p></div></div>`
    }
    if (p.shaken === true) h += `<div class="wintel"><div class="wi warn"><b>${tr('war.warhtml.49')}</b><p>${tr('war.warhtml.50')}</p></div></div>`
    /**
     * 권함 — 무리마다 판세로 하나 (형 10-24: 동료 "선택지마다 뭘 골라야 좋을지 몰라서"). 보이는 것만으로 셈한다(낌새 · 맞은편 수 · 사기 · 사로잡기 손)
     */
    const advise = (g: Grp | 'lead', options: readonly Cmd[]): Cmd | undefined => {
      const has = (c: Cmd): Cmd | undefined => (options.includes(c) ? c : undefined)
      const ours = (k: Grp): number => p.groups.find((x) => x.g === k)?.men ?? 0
      if (g === 'front') {
        if (p.hint !== null && FRONT_COUNTER[p.hint] !== undefined && has(FRONT_COUNTER[p.hint]!)) return FRONT_COUNTER[p.hint]
        if (p.foeWaver && has('pursue')) return 'pursue'
        return ours('front') >= (p.foe.front ?? 0) * 1.2 ? (has('charge') ?? options[0]) : (has('hold') ?? options[0])
      }
      if (g === 'bows') return (p.foe.bows ?? 0) > 0 && (p.foe.bows ?? 0) >= ours('bows') * 0.6 ? (has('counter') ?? options[0]) : (has('volley') ?? options[0])
      if (g === 'horse') return (p.foeWaver ? has('pursue') : undefined) ?? options[0]
      if (p.capture >= 0.3 && has('capture')) return 'capture'
      if (m(ourI) < (st?.morale[ourI] ?? 1) * 0.8 && has('drum')) return 'drum'
      return has('art') ?? has('drum') ?? options[0]
    }
    /**
     * 장수가 여럿이면 — 비기·겨루기에 누가 나서나 · 사로잡기에 누구를 잡나 (형 10-25). 그 깃발을 골랐을 때만 보인다 (CSS :has)
     * 안 고르면 비기는 아직 안 쓴 장수부터, 겨루기는 무예가 가장 높은 이, 사로잡기는 적의 총대장
     */
    const whoRows = (): string => {
      const nm = (id: string): string => prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '?'
      const hs = p.heroes ?? []
      let s = ''
      if (hs.length > 1) {
        const arts = hs.filter((x) => x.art !== undefined && !x.artUsed)
        const artPick = sel.who !== undefined && arts.some((x) => x.id === sel.who) ? sel.who : arts[0]?.id
        if (arts.length > 1) s += `<div class="wwho mine art"><span>${tr('war.warhtml.51')}</span>${arts.map((x) => `<button class="wfc${x.id === artPick ? ' on' : ''}" data-war="who" data-id="${x.id}">${face(x.id, art, unitOf(ourI))}<b>${esc(nm(x.id))}</b><small>${esc(ART_NAME[x.art!])}</small></button>`).join('')}</div>`
        const best = [...hs].sort((x, y) => y.mu - x.mu)[0]?.id
        const duelPick = sel.who !== undefined && hs.some((x) => x.id === sel.who) ? sel.who : best
        s += `<div class="wwho mine duel"><span>${tr('war.warhtml.54')}</span>${hs.map((x) => `<button class="wfc${x.id === duelPick ? ' on' : ''}" data-war="who" data-id="${x.id}">${face(x.id, art, unitOf(ourI))}<b>${esc(nm(x.id))}</b><small>${tr('war.warhtml.53', { mu: x.mu, v1: x.chief ? ` ${tr('war.warhtml.52')}` : '' })}</small></button>`).join('')}</div>`
      }
      const fs = p.foeHeroes ?? []
      if (fs.length > 1) {
        const tPick = sel.target ?? fs.find((x) => x.chief)?.id
        s += `<div class="wwho foe capture"><span>${tr('war.warhtml.57')}</span>${fs.map((x) => { const [w, cls] = captureWord(x.p); return `<button class="wfc${x.id === tPick ? ' on' : ''}" data-war="target" data-id="${x.id}">${face(x.id, art, unitOf(foeI))}<b>${esc(nm(x.id))}</b><small class="wf-${cls}">${x.chief ? `${tr('war.warhtml.55')} ` : `${tr('war.warhtml.56')} `}${w}</small></button>` }).join('')}</div>`
      }
      return s
    }
    let recNow: Cmd | undefined
    const opt = (g: Grp | 'lead', c: Cmd, now: boolean): string => {
      const on = sel[g] === c
      let tag = recNow === c ? `<em class="rec">${tr('war.warhtml.58')}</em>` : ''
      if (g === 'front' && p.hint !== null && FRONT_COUNTER[p.hint] === c) tag = `<em>${tr('war.warhtml.59')}</em>`
      else if (c === 'pursue' && p.foeWaver) tag = `<em>${tr('war.warhtml.60')}</em>`
      else if (TERRAIN_CMD.has(c)) tag = `<em class="land">${tr('war.warhtml.61')}</em>`
      let feel = ''
      if (c === 'capture') {
        const [w, cls] = captureWord(p.capture)
        feel = `<span class="wf-${cls}">${w}</span><span class="wcap">${tr('war.warhtml.62', { squad: p.squad, escort: p.escort })}</span><i class="wodd wf-${cls}">${Math.round(p.capture * 100)}%</i>`
      }
      if (c === 'feast' && p.feast !== undefined) feel = `<span class="wfcost">${tr('war.warhtml.63', { feast: p.feast })}</span>`
      // 물러나기는 시도다 — 빠져나갈 가망을 % 로 (우리 것은 %) · 말이 호위하면 오르는 몫도 (형 10-27)
      if (c === 'retreat' && p.retreatP !== undefined) {
        const rp = sel.horse === 'guard' ? (p.retreatGuardP ?? p.retreatP) : p.retreatP
        feel = `<span class="wf-${retreatCls(rp)}">${tr('war.duskhtml.17', { round: Math.round(rp * 100) })}</span>`
        if (sel.horse !== 'guard' && (p.retreatGuardP ?? 0) > p.retreatP + 0.005) feel += `<span class="wcap">${tr('war.warhtml.64', { round: Math.round(p.retreatGuardP! * 100) })}</span>`
        feel += `<i class="wodd wf-${retreatCls(rp)}">${Math.round(rp * 100)}%</i>` // 전장 깃발 판(작은 단추)에서도 가망이 보이게
      }
      // 장수의 비기 — 그 장수만의 이름·그림 (형: "아이콘과 함께 그거라는걸 알게 해줘야함")
      const ak = c === 'art' ? artFor(p, sel.who) : undefined
      if (ak !== undefined) tag = `<em class="art">${tr('war.sghtml.18')}</em>`
      // 깃발 짐작 — 펼친 무리만 바로 셈한다 (나머지는 탭을 열 때 openWar 의 fillLooks 가)
      const gu = p.look !== undefined ? (() => { const o = withPick(sel, g, c); return lookHtml(lookFor(p.look, o, now), orderKey(o)) })() : ''
      // 적 낌새를 이기는 깃발은 카드가 빛난다 (형 10-29) · 무엇이 무엇을 이기나는 위 띠의 「상성」 판에
      const ctr = beatsHint(c, ak, p.hint) ? ' wbxc' : ''
      // 각성기 — 그 기운의 이름과 짐승 (깃발 대신) · 금빛 테 (.wcmd.wake)
      const wk = c === 'wake' ? p.wake : undefined
      // 진각성 — 이 싸움이 크면 각성기 단추가 「진각성」으로 금빛이 짙어지고, 작으면 「진각성은 큰 싸움에서」 꼬리 (형 11-05: "진각성 방법도 자연스럽게 알 수 있어야")
      if (wk !== undefined) tag = p.trueWake === 'big' ? `<em class="art tru">${tr('war.warhtml.65')}</em>` : `<em class="art">${tr('war.cmdName.wake')}</em>${p.trueWake === 'small' ? `<small class="trun">${tr('war.warhtml.66')}</small>` : ''}`
      const nm = wk !== undefined ? WAKE_NAME[wk] : ak !== undefined ? ART_NAME[ak] : CMD_NAME[c]
      const sh = wk !== undefined ? WAKE_SHORT[wk] : ak !== undefined ? ART_SHORT[ak] : CMD_SHORT[c]
      return `<button class="wcmd ${c}${on ? ' on' : ''}${recNow === c ? ' rec' : ''}${ctr}${wk !== undefined && p.trueWake === 'big' ? ' tru' : ''}" data-war="pick" data-g="${g}" data-c="${c}" data-more="${esc(ak !== undefined ? ART_DOES[ak] : CMD_DOES[c])}"><img class="wflag${wk !== undefined ? ' wbeast' : ''}" src="${flagSrc(art, c, ak, wk)}" alt=""><span class="wct"><b>${nm}</b>${tag}${feel}<small>${esc(sh)}</small>${gu}</span></button>`
    }
    // 무리 탭 — 누른 무리만 빛나고 그 무리 깃발만 보인다. 무리마다 다 고르면 「전투 개시」가 켜진다
    // (형 10-24: "깃발이 너무 많아서 헷갈려 · 창병 방패병을 탭하면 빛나면서 걔네들 깃발만 · 다 고른 뒤에 전투개시 버튼 활성화")
    const panes: Array<{ g: Grp | 'lead'; name: string; sub: string; icon: string; options: readonly Cmd[] }> = []
    // 아직 안 닿은 원군뿐인 무리는 깃발을 안 든다 (사람이 0 이면)
    for (const gr of p.groups) if (gr.options.length > 0 && gr.men >= 1) panes.push({ g: gr.g, name: groupLabel(mixOf(ourI), gr.g), sub: tr('war.warhtml.67', { men: gr.men }), icon: `<img class="wgi" src="${art}icon/${GROUP_ICON[gr.g]}.png" alt="">`, options: gr.options })
    if (p.lead.length > 0) panes.push({ g: 'lead', name: tr('war.sghtml.12'), sub: ourName, icon: `<span class="wgi f">${face(ourHero, art, unitOf(ourI))}</span>`, options: p.lead })
    const act = panes.find((x) => x.g === active) ?? panes.find((x) => sel[x.g] === undefined) ?? panes[0]
    h += `<div class="wgtabs">`
    for (const x of panes) {
      const c = sel[x.g]
      const ak = c === 'art' ? artFor(p, sel.who) : undefined
      const wkc = c === 'wake' ? p.wake : undefined
      const chip = c !== undefined ? `<span class="wgs"><img src="${flagSrc(art, c, ak, wkc)}" alt="">${esc(ak !== undefined ? ART_NAME[ak] : wkc !== undefined ? WAKE_NAME[wkc] : CMD_NAME[c])}</span>` : `<span class="wgs none">${tr('war.warhtml.68')}</span>`
      h += `<button class="wgt${x === act ? ' on' : ''}${c !== undefined ? ' done' : ''}" data-war="gtab" data-g="${x.g}">${x.icon}<span class="wgn"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span>${chip}</button>`
    }
    h += `</div>`
    if (p.look !== undefined) h += `<p class="wgby">${tr('war.warhtml.70', { round: Math.round(P.realm.tacLookSamples) })} <b>${tr('war.warhtml.71', { v1: nth(TEN_KEYS, Math.round((1 - 2 * P.realm.tacLookBand) * 10)) ?? '' })}</b>${tr('war.warhtml.72', { v1: p.look.by === 'saw' ? ` · <b>${tr('war.lookhtml.6')}</b>${tr('war.warhtml.69')}` : '' })} <b>${tr('war.warhtml.73')}</b> ${tr('war.warhtml.74')} <b>${tr('war.lookhtml.11')}</b>${tr('war.warhtml.75')} <b>${tr('war.sgName.capture')}</b>${tr('war.warhtml.76')}</p>`
    for (const x of panes) {
      recNow = advise(x.g, x.options)
      h += `<div class="wgrp" data-g="${x.g}"${recNow !== undefined ? ` data-rec="${recNow}"` : ''}${x === act ? '' : ' hidden'}><div class="wcmdgrid">${x.options.map((c) => opt(x.g, c, x === act)).join('')}</div>${x.g === 'lead' ? whoRows() : ''}</div>`
    }
    const picked = panes.filter((x) => sel[x.g] !== undefined).length
    // 맡기면 장수의 지략대로 — 그 장수의 얼굴·지략을 단추 옆에 (형: "장수의 지략?수치가 … 버튼주변에 뭔가보여지면")
    const ourH = ourHero !== null ? (prev.heroes[ourHero] ?? after.heroes[ourHero]) : undefined
    const [sn, sl] = styleWord(ourH)
    h += `<div class="wlsum">${lookSumHtml(p.look, sel, picked >= panes.length, true)}</div>`
    h += `<div class="wfoot"><div class="wauto">${ourH !== undefined ? face(ourHero, art, unitOf(ourI)) : ''}<span>${autoLine(ourH)}<br><b class="wsty">${esc(sn)}</b> ${esc(sl)}</span></div>`
    // 누구에게 무엇을 맡기나 — 말로 (형 10-23: "'이 싸움은 맡긴다'는 뭔 소린지 모르겠잖아. 장수에게 전투를 전부 일임한다 이런 식으로")
    // 「○○에게 일임한다 (자동전투)」 · 남은 싸움을 한꺼번에 넘기는 단추는 뺐다 — 싸움은 하나씩 (형 10-25)
    const whom = ourHero !== null ? tr('war.warhtml.77', { ourName }) : tr('war.warhtml.78')
    h += `<button class="btn ghost" data-war="auto">${esc(whom)}</button>`
    // 이 합을 싸운다 — 장수의 「격려」와 헷갈리지 않게 북 말은 뺐다 (형 10-23: "북을 친다가 있는데 북을 울린다라고 하면 헷갈리잖아 · 설명이 쓸데없어")
    h += `<button class="btn pri wgo" data-war="go" data-n="${panes.length}"${picked < panes.length ? ' aria-disabled="true"' : ''}>${goWord(picked, panes.length)}</button></div></div>`
  } else if (ended) {
    const atkWon = l.outcome === 'rout' || l.outcome === 'win'
    const good = weAtk === atkWon && l.outcome !== 'draw'
    const place = l.field === true && l.edge !== undefined ? fieldName(after, l.edge) : (after.nodes[l.node]?.name ?? l.node)
    let res: string
    if (l.outcome === 'draw') res = weAtk ? tr('war.warhtml.79') : tr('war.warhtml.80', { place })
    else if (l.field === true) res = good ? tr('war.warhtml.81') : tr('war.warhtml.82')
    else if (weAtk) res = atkWon ? tr('war.warhtml.83', { place }) : tr('war.duskname.2')
    else res = atkWon ? tr('war.warhtml.84', { place }) : tr('war.warhtml.80', { place })
    const big = l.outcome === 'rout' || l.outcome === 'routed' ? (good ? `${tr('war.warhtml.85')} ` : `${tr('war.warhtml.86')} `) : ''
    // 결과 판은 마지막 합의 결과 띠들이 걷힌 뒤에 — 같이 뜨면 화면 아래에서 겹쳤다 (10-28)
    const d = anim ? ` style="--d:${tAt(2) + P.realm.warRoundPopHoldS + 0.5}s"` : ''
    const fall = l.field !== true && atkWon
    if (fall) h += `<div class="wfx burn"${d}><img class="wfx-smoke" src="${art}fx/smoke.png" alt="">${burnHtml(art, 'l')}${burnHtml(art, 'r')}</div>`
    h += `<div class="wend ${good ? 'good' : l.outcome === 'draw' ? '' : 'bad'}"${d}><b>${big}${esc(res)}</b>`
    if (ctx !== null && (l.rounds ?? []).length > 0) h += `<p class="wwhy">${esc(endStory(l, ctx))}</p>`
    // 잡힌 이 · 쓰러진 이 — 장수가 여럿이면 하나가 아닐 수 있다
    for (const id of l.captives ?? (l.captured !== null ? [l.captured] : [])) {
      const c = after.heroes[id]
      h += c?.faction === me ? `<p>${tr('war.warhtml.87', { name: esc(c.name) })}</p>` : `<p>${tr('war.warhtml.88', { name: esc(c?.name ?? '?') })}</p>`
    }
    for (const id of l.fallen ?? (l.killed !== null ? [l.killed] : [])) h += `<p>${tr('war.warhtml.89', { v1: esc(after.heroes[id]?.name ?? '?') })}</p>`
    // 항복한 군사를 거뒀다 (season.takeYielded) — 그림으로: 흰 깃발 수 → 군사 +n · 집 +n (형 10-29)
    const yl = l.yielded
    if (yl !== undefined && yl.join + yl.hh > 0) {
      const mine = (yl.side === 'a') === (l.atkFaction === me)
      h += `<p class="wyld ${mine ? 'us' : 'foe'}"><img src="${art}icon/status-betrayal.png" alt="${tr('war.warhtml.90')}"><b>${yl.n}</b><i>▶</i>`
        + `${yl.join > 0 ? `<img src="${art}icon/unit-spear.png" alt="${tr('war.warhtml.91')}"><b>+${yl.join}</b>` : ''}${yl.hh > 0 ? `<img src="${art}icon/settle-farm-village.png" alt="${tr('war.warhtml.92')}"><b>+${yl.hh}</b>` : ''}</p>`
    }
    h += `<button class="btn pri wide" data-war="next">${left > 1 ? tr('war.warhtml.93') : tr('war.warhtml.94', { turnWord: turnWord(after) })}</button></div>`
  }
  h += `</div>`
  return h
}

export const WAR_CSS = `
/* 화면을 굴리지 않는다 (형 10-28: "합 할 때마다 슬라이드로 내려가며 설명 보게 하지 말고 · 하스스톤은 팝업 · 터치하면 뜨는 상자") —
   마지막 합은 전장 위 상자로 떴다 사라지고(--pd 뒤), 지난 합들은 「기록」을 누르면 뜨는 판 안에. 끝난 판의 결과는 화면 아래에 붙는다 */
.ap .wr:not(.logopen) .wlog > :not(.wrd.slow) { display: none; }
/* 각성기 카드 — 금빛 테 · 깃발 대신 기운의 짐승 (검은 바탕 그림이라 screen) */
.ap .wcmd.wake { box-shadow: 0 0 0 1.5px #ffd27a, 0 0 12px #ffb04a66; }
.ap .wcmd .wflag.wbeast { mix-blend-mode: screen; object-fit: contain; }
.ap .wr:not(.logopen) .wlog .wrd.slow { position: fixed; left: 50%; top: auto; bottom: calc(12px + env(safe-area-inset-bottom)); max-height: 46vh; overflow: hidden; z-index: 70; width: min(92vw, 480px); box-sizing: border-box; margin: 0; padding: 10px 14px; border-radius: 14px;
  background: #1a130cf2; border: 1.5px solid #c9a45a; box-shadow: 0 10px 30px #000c; pointer-events: none; transform: translateX(-50%);
  animation: wrpin .25s ease-out both, wrpout .45s ease-in var(--pd, 4s) forwards; }
/* 화면 아래쪽에 — 가운데에 띄웠더니 맞부딪히는 전장을 가렸다 (형 10-28) · 상자는 투명하게, 일어난 일만 작은 띠로 하나씩 (형 10-28: "착착착") */
.ap .wr:not(.logopen) .wlog .wrd.slow { background: none; border: 0; box-shadow: none; padding: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; max-height: 52vh; }
.ap .wr:not(.logopen) .wlog .wrd.slow > .wrn, .ap .wr:not(.logopen) .wlog .wrd.slow > .wcmds, .ap .wr:not(.logopen) .wlog .wrd.slow > .wpush, .ap .wr:not(.logopen) .wlog .wrd.slow > .wloss,
.ap .wr:not(.logopen) .wlog .wrd.slow .wst > * { background: #120d09e0; border-radius: 10px; padding: 3px 10px; box-shadow: 0 2px 8px #000a; }
.ap .wr:not(.logopen) .wlog .wrd.slow .wst { background: none; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0; }
.ap .wr:not(.logopen) .wlog .wrd.slow > .wrn { font-size: 12px; color: #ffe2a0; }
/* 두 줄 창 — 전장 위 상자에서는 이것만 (기록 판을 열면 옛 모양 그대로) */
.ap .wr:not(.logopen) .wlog .wrd.slow:has(.wtick) > :is(.wst, .wpush, .wloss) { display: none; }
.ap .wr.logopen .wtick, .ap .wrd:not(.slow) .wtick { display: none; }
.ap .wtick { width: 100%; height: calc(var(--th) * 2 + var(--tg)); overflow: hidden; }
.ap .wtick .wtk { display: flex; flex-direction: column; gap: var(--tg); }
.ap .wtick .wtl { flex: none; height: var(--th); display: flex; align-items: center; justify-content: center; opacity: 0; animation: wrrow .3s ease-out var(--t, 0s) both; }
.ap .wtick .wtl > * { margin: 0; max-height: 100%; overflow: hidden; background: #120d09e0; border-radius: 10px; padding: 3px 10px; box-shadow: 0 2px 8px #000a; }
.ap .wtick .wtl > .wact { flex-wrap: nowrap; white-space: nowrap; } .ap .wtick .wtl > .wloss { display: flex; gap: 10px; }
@keyframes wrpin { from { opacity: 0; transform: translate(-50%, 16px) scale(.96); } to { opacity: 1; transform: translateX(-50%); } }
@keyframes wrpout { to { opacity: 0; visibility: hidden; transform: translate(-50%, 24px); } }
.ap .wr .wlogbg, .ap .wr .wlogx { display: none; }
.ap .wr.logopen .wlogbg { display: block; position: fixed; inset: 0; z-index: 74; border: 0; padding: 0; background: #000b; }
.ap .wr.logopen .wlog { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 75; width: min(94vw, 560px); max-height: 82vh; overflow-y: auto; box-sizing: border-box;
  padding: 10px 12px 14px; border-radius: 14px; background: #15100bf8; border: 1px solid #c9a45a; box-shadow: 0 10px 40px #000d; }
.ap .wr.logopen .wlog .wrd { animation: none !important; } .ap .wr.logopen .wlog .wrd * { animation-delay: 0s !important; }
.ap .wr.logopen .wlogx { display: block; position: sticky; top: 0; margin: 0 0 6px auto; z-index: 2; }
.ap .wrh .wrbt { display: flex; align-items: center; align-self: stretch; min-height: 26px; }
.ap .wspeed { display: inline-flex; gap: 2px; margin-left: 8px; padding: 2px; border: 1px solid #c9a45a; border-radius: 10px; background: #1f1710e8; }
.ap .wspeed button { min-width: 38px; min-height: 32px; padding: 2px 5px; border: 0; border-radius: 7px; background: transparent; color: #f3d48a; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.ap .wspeed button[aria-pressed="true"] { background: #f3d48a; color: #211506; }
.ap .wspeed button:focus-visible { outline: 2px solid #fff2c8; outline-offset: 2px; }
.ap .wrh .wlogb, .ap .wrh .wsgb { margin-left: auto; padding: 2px 10px; border-radius: 12px; border: 1px solid #c9a45a; background: #1f1710cc; color: #f3d48a; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
/* 기록 단추는 처음부터 늘 같은 자리에 · 합이 없으면 흐리게 (형 10-30: "시작할 때는 없다가 전투하는 도중에 생김") */
.ap .wrh .wlogb.off { opacity: .45; cursor: default; }
.ap .wrh .wsgb { margin-left: 0; } /* 「기록」과 같은 모양 · 왼쪽 (형 10-29) */
/* PC 넓은 화면 — 상성·기록·빠르기 단추가 판 크기에 비해 너무 작았다 (형 11-09) · 폰은 그대로 */
@media (pointer: fine) and (min-width: 1000px) {
  .ap .wrh .wlogb, .ap .wrh .wsgb { padding: 6px 18px; border-radius: 16px; font-size: 17px; border-width: 2px; }
  .ap .wspeed { padding: 3px; border-radius: 13px; border-width: 2px; }
  .ap .wspeed button { min-width: 54px; min-height: 42px; font-size: 16px; border-radius: 10px; }
}
.ap .wr .wrh .whelp { display: none; } /* 설명은 누르고 있으면 뜨는 창 · 판세는 깃발 판 밑에 (형 10-28: 자세히 버튼은 필요 없다) */
.ap .wr .wend { position: sticky; bottom: calc(8px + env(safe-area-inset-bottom)); z-index: 6; box-shadow: 0 -6px 24px #000c; }
/* 새 전투 시험 (.wr.b0) — 손가락 · 고른 깃발이 크게 · 숫자 표는 「자세히」 안으로 */
.ap .wr:not(.b0) .wb0g { display: none; }
.ap .wb0g { display: flex; flex-direction: column; gap: 2px; margin: 4px 2px 10px; padding: 9px 12px; border-radius: 12px; background: #2a1f0ccc; border: 1.5px solid #e0b860; }
.ap .wb0g b { color: #ffd27a; font-size: 16px; } .ap .wb0g span { font-size: 13px; color: #e8d4a8; }
.ap .wr.b0 .wgrp:not([hidden]):not(:has(.wcmd.on)) .wcmd.rec { position: relative; animation: tutglow .9s ease-in-out infinite alternate; outline: 3px solid #ffd27a; outline-offset: 2px; }
.ap .wr.b0 .wgrp:not([hidden]):not(:has(.wcmd.on)) .wcmd.rec::after, .ap .wr.b0 .wgo:not(:disabled):not([aria-disabled="true"])::after { content: '👆'; position: absolute; left: 50%; top: 100%; margin: 2px 0 0 -18px; font-size: 32px; line-height: 1;
  filter: drop-shadow(0 2px 3px #000); pointer-events: none; z-index: 5; animation: b0hand .7s ease-in-out infinite alternate; }
.ap .wr.b0 .wgo { position: relative; }
.ap .wr.b0 .wrgo { position: relative; overflow: visible; } .ap .wr.b0 .wrgo:not(:disabled):not([aria-disabled="true"])::before { content: '👉'; position: absolute; right: 100%; top: 50%; margin: -17px 6px 0 0; font-size: 30px; line-height: 1; filter: drop-shadow(0 2px 3px #000); pointer-events: none; animation: b0point .7s ease-in-out infinite alternate; }
@keyframes b0point { from { transform: translateX(0); } to { transform: translateX(-10px); } }
.ap .wr.b0 .wfpop .wcmd.mini.rec:not(.on) { outline: 2px solid #ffd27a; outline-offset: 1px; animation: tutglow .9s ease-in-out infinite alternate; }

.ap .wr.b0 .wfoot { margin-bottom: 40px; }
@keyframes b0hand { from { transform: translateY(0); } to { transform: translateY(-10px); } }
.ap .wr.b0 .wgrp.b0flash .wcmdgrid { animation: b0flash .6s ease-out; } @keyframes b0flash { 0% { filter: brightness(2.2); transform: scale(1.03); } 100% { filter: none; transform: none; } }
.ap .wb0pop { position: fixed; left: 50%; top: 38%; z-index: 80; display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: none; transform: translate(-50%, -50%);
  animation: b0pop var(--ms, 1s) ease-out forwards; }
.ap .wb0pop img { width: 132px; height: 132px; object-fit: contain; filter: drop-shadow(0 6px 14px #000c) drop-shadow(0 0 18px #ffd27a88); }
.ap .wb0pop b { font-size: 30px; font-weight: 900; color: #ffe6a8; text-shadow: 0 2px 0 #000, 0 0 14px #000; letter-spacing: 2px; }
@keyframes b0pop { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.4); } 18% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); } 30% { transform: translate(-50%, -50%) scale(1); } 75% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -60%) scale(1); } }
.ap .wr.b0:not(.whelpon) .wgx, .ap .wr.b0:not(.whelpon) .wgff, .ap .wr.b0:not(.whelpon) .wgby, .ap .wr.b0:not(.whelpon) .wloss, .ap .wr.b0:not(.whelpon) .wodd, .ap .wr.b0:not(.whelpon) .wcap, .ap .wr.b0:not(.whelpon) .brkl { display: none; }
.ap .wr.b0 .whelp { width: auto; padding: 0 10px; font-size: 0; } .ap .wr.b0 .whelp::after { content: '자세히'; font-size: 13px; }
.ap .wr.b0.whelpon .whelp::after { content: '접기'; }
html[data-lang="en"] .ap .wr.b0 .whelp::after { content: 'Details'; } html[data-lang="en"] .ap .wr.b0.whelpon .whelp::after { content: 'Hide'; } /* i18n (11-12) · CSS 안 글이라 t() 대신 */
@media (prefers-reduced-motion: reduce) { .ap .wb0pop, .ap .wr.b0 .wcmd.rec::after, .ap .wr.b0 .wgo::after { animation-duration: .01s; } }
.ap .tn.hard { color: #f0a08a; }
/* 장수가 여럿 — 누가 나서나 · 누구를 잡나 (그 깃발을 골랐을 때만) */
.ap .ws .wpf .waides { position: absolute; left: 0; right: 0; bottom: 5%; z-index: 2; display: flex; gap: 2px; justify-content: center; margin: 0; pointer-events: none; }
.ap .ws .waide .wf { box-shadow: 0 1px 4px #000c; } .ap .wtop .ws .waide .wf { width: 28px; height: 28px; border-width: 1.5px; }
@media (max-width: 520px) { .ap .wtop .ws .wpf .waides { bottom: -3px; } .ap .wtop .ws .waide .wf { width: 17px; height: 17px; } }
.ap .ws .waide .wf { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; object-position: top; border: 1px solid #c9a45a; }
.ap .ws .waide.gone .wf { filter: grayscale(1) brightness(.5); border-color: #6a3a2a; } .ap .ws.chiefgone .wpf .wf { filter: grayscale(1) brightness(.55); }
.ap .wwho { display: none; flex-wrap: wrap; align-items: center; gap: 6px; margin: 8px 0 2px; padding: 8px; border-radius: 12px; background: #1a140ecc; border: 1px solid #5a4a2a; }
.ap .wwho > span { flex-basis: 100%; font-size: 12.5px; color: var(--gold); }
.ap .wgrp:has(.wcmd.art.on) .wwho.art, .ap .wgrp:has(.wcmd.duel.on) .wwho.duel, .ap .wgrp:has(.wcmd.capture.on) .wwho.capture { display: flex; }
.ap .wwho .wfc { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 84px; padding: 6px 2px; border-radius: 10px; border: 1.5px solid #5a4a2a; background: #241b12; color: var(--ink); font: inherit; cursor: pointer; opacity: .7; }
.ap .wwho .wfc .wf { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; object-position: top; }
.ap .wwho .wfc b { font-size: 12px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ap .wwho .wfc small { font-size: 10.5px; color: var(--mute); }
.ap .wwho .wfc.on { opacity: 1; border-color: #e0b860; box-shadow: 0 0 10px #e0b86055; }
.ap .wwho.foe .wfc.on { border-color: #e06a4a; box-shadow: 0 0 10px #e06a4a55; }
.ap.war-open .tutband, .ap.war-open .tutbar { display: none; }
.ap .wr { position: fixed; inset: 0; z-index: 60; background: #0d0f13; overflow: hidden; }
/* 위아래로만 굴린다 — 옆으로 밀리던 것 (형 10-23: "전투 화면에서 불필요하게 x축 스크롤") */
.ap .wsc { position: absolute; inset: 0; z-index: 1; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch; }
.ap .wsc .wrbox { overflow-wrap: anywhere; }
.ap .wfxl { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.ap .wfxt { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
.ap .wwin { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
/* 싸움터 — 화면 뒤에 붙박이. 받아 둔 싸움터 그림이 없으면(stand) 장면 그림을 더 어둡고 흐리게 */
/* 폰 깜빡임 (형 11-02 · 동생 폰 영상: 전술 상자를 연 채 위 띠·숫자·상자 가운데가 몇 프레임씩 통째로 빠짐) — 화면 가득한 층에
   filter 밝기·채도 + 끝없이 커지는 transform 이 겹쳐 그래픽 한도를 넘었다 (메모리 mobile-gpu-layer-limit).
   어둡게 하기는 filter 대신 위에 덮는 검은 막(::before)의 opacity 로 (--wdim · --wtint) · 천천히 미는 움직임은 고사양에서만 */
.ap .wbg { position: absolute; inset: 0; z-index: 0; background: center / cover no-repeat; --wdim: .38; --wtint: #0d0f13; }
.ap .wbg::before { content: ''; position: absolute; inset: 0; background: var(--wtint); opacity: var(--wdim); }
.ap.q-high .wbg { animation: wbgpan 26s ease-in-out infinite alternate; }
@keyframes wbgpan { from { transform: scale(1.04) translate(-1%, 0); } to { transform: scale(1.1) translate(1.2%, -1%); } }
.ap .wember { position: absolute; bottom: -10px; left: var(--x); width: var(--s); height: var(--s); border-radius: 50%; background: radial-gradient(circle, #fff2c0, #ffb04a 45%, #ff6a1a00 70%);
  opacity: 0; animation: wemberup var(--d) linear var(--t) infinite; }
@keyframes wemberup { 0% { opacity: 0; transform: translate(0, 0); } 10% { opacity: .9; } 70% { opacity: .6; } 100% { opacity: 0; transform: translate(var(--w), -70vh); } }
.ap .wbg.stand { --wdim: .7; } .ap.q-high .wbg.stand { filter: blur(2px); transform: scale(1.04); }
.ap .wbg.g-snow { --wdim: .55; --wtint: #0d1218; } .ap .wbg.g-night { --wdim: .7; }
.ap .wbg::after { content: ''; position: absolute; inset: 0; background: linear-gradient(#0d0f1340, #0d0f1300 30%, #0d0f1388 55%, #0d0f13dd 90%); }
/* 부드러운 linear-gradient 는 폰에서 까만 줄무늬로 깨진다 — 고사양이 아니면 둥근 그러데이션으로 아래를 어둡게 */
.ap:not(.q-high) .wbg::after { background: radial-gradient(ellipse 150% 100% at 50% 0%, #0d0f1311 30%, #0d0f13cc 100%); }
.ap .wrbox { position: relative; z-index: 1; max-width: 600px; margin: 0 auto; padding: 0 14px 40px; }
/* 위 카드 — 굴려도 늘 보인다 (포켓몬의 HP 창) */
.ap .wtop { position: sticky; top: 0; z-index: 3; margin: 0 -14px; padding: calc(16px + env(safe-area-inset-top)) 30px 22px;
  background: linear-gradient(#0d0f1388, #0d0f1311 35%, #0d0f1322 70%, #0d0f1330), var(--wtbg) center 55% / cover no-repeat; background-origin: border-box;
  box-shadow: 0 6px 14px #000a; }
/* 붙박이 위 띠에 filter 를 걸면 띠 전체가 따로 그려져 폰에서 통째로 빠졌다 (형 11-02 깜빡임) — 그림자는 box-shadow ·
   고사양이 아니면 부드러운 linear-gradient 대신 둥근 그러데이션으로 */
.ap:not(.q-high) .wtop { background: radial-gradient(ellipse 120% 80% at 50% 50%, #0d0f1311 40%, #0d0f1366 100%), var(--wtbg) center 55% / cover no-repeat; background-origin: border-box; }
.ap .wtop::after { content: ''; position: absolute; inset: 0; border: 22px solid transparent; border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 22px stretch; pointer-events: none; z-index: 2; }
.ap .wtop.def { background: linear-gradient(#0d0f1388, #0d0f1311 35%, #0d0f1322 70%, #0d0f1330), var(--wtbg) center 55% / cover no-repeat; }
.ap:not(.q-high) .wtop.def { background: radial-gradient(ellipse 120% 80% at 50% 50%, #0d0f1311 40%, #0d0f1366 100%), var(--wtbg) center 55% / cover no-repeat; }
@media (max-width: 520px) { .ap .wtop { padding: calc(12px + env(safe-area-inset-top)) 22px 18px; } .ap .wtop::after { border-width: 16px; border-image-width: 16px; } }
/* 위 카드 안의 싸움판은 테 안쪽 선에 딱 붙인다 — 모서리 없이, 테 밑으로 2px 숨겨 틈이 안 보이게 (형 10-26: "판 테두리 이미지에서 살짝 이격 · 성 이미지가 옆 아래 잘려 · 코너도 주지 말고")
   테의 안쪽 선은 22px(폰 16px) — 좌우는 안쪽 여백(30·22)에서 그만큼 빼고, 아래는 여백(22·18)에서 뺀다. isolation 으로 판 속 높은 z(장수 깃발)가 테 위로 못 올라온다 */
.ap .wtop .wfield { margin: 6px -10px -2px; border-radius: 0; isolation: isolate; }
@media (max-width: 520px) { .ap .wtop .wfield { margin: 6px -8px -4px; } }
/* 장수 초상 — 쇠 귀퉁이 청동 테 안에 얼굴 (테 그림이 얼굴 위에 얹힌다).
   테는 아홉 조각으로 얇게(한 변 9%) — 통째로 늘리면 테가 칸의 넉넉한 몫을 먹어 얼굴이 66% 였다 (형 11-03: "장수 이미지가 너무 작고 액자가 너무 커") */
.ap .wpf { position: relative; display: grid; place-items: center; width: var(--pf, 172px); aspect-ratio: 1; flex: none; }
.ap .wpf > i { position: absolute; inset: 0; box-sizing: border-box; border: calc(var(--pf, 172px) * .09) solid transparent; border-image: url(__ART__ui/frame-portrait.png) 60 / calc(var(--pf, 172px) * .09) stretch; pointer-events: none; z-index: 1; filter: drop-shadow(0 3px 6px #000c); }
.ap .wpf .wf { width: 84%; height: 84%; object-fit: cover; object-position: top; border: 0; border-radius: 2px; box-shadow: none; }
.ap .ws.foe .wpf > i { filter: drop-shadow(0 3px 6px #000c) sepia(.35) hue-rotate(-20deg) saturate(1.3); }
@media (max-width: 520px) { .ap .wtop .wpf { --pf: min(92px, 24vw); } } /* 폰 — 초상을 줄여 전장에 자리를 (형 10-25: 초상이 화면 반을 먹고 병사가 작았다) */
@media (max-width: 520px) { .ap .wtop .wfield { height: clamp(170px, 46vw, 220px); } .ap .wtop .wf2s .tk { height: clamp(30px, 8.6cqw, 44px); } .ap .wtop .wf2s .tk.wsp.k-horse, .ap .wtop .wf2s .tk.wsp.k-boat { height: clamp(40px, 11.5cqw, 60px); } }
@media (max-width: 520px) { .ap .wnext .wgt .wgn b { white-space: normal; font-size: 13px; line-height: 1.15; } .ap .wnext .wgt { padding: 6px 7px; gap: 5px; } .ap .wnext .wgt .wgi { width: 28px; height: 28px; } }
/* 우리 장수 테는 숨 쉬듯 빛난다 */
.ap .ws.us .wpf > i { animation: wpfglow 2.6s ease-in-out infinite alternate; }
@keyframes wpfglow { from { filter: drop-shadow(0 3px 6px #000c); } to { filter: drop-shadow(0 3px 6px #000c) drop-shadow(0 0 10px #9fd18b88); } }
.ap .wpf.big { --pf: clamp(120px, 34vw, 190px); }
.ap .wosd .wpf .wf { width: 84%; height: 84%; object-fit: cover; object-position: top; border: 0; border-radius: 2px; box-shadow: none; }
.ap .wvs img.vs { width: clamp(52px, 13vw, 78px); height: auto; align-self: center; filter: drop-shadow(0 3px 6px #000c); }
.ap .wom img.wox { width: clamp(70px, 20vw, 130px); height: auto; filter: drop-shadow(0 0 14px #ff6a3a88) drop-shadow(0 3px 6px #000); animation: wostamp .5s cubic-bezier(.2, 1.6, .4, 1) .8s both; }
/* 나라 이름 — 싸움터 그림 위에서도 읽히게 어두운 띠 */
.ap .ws .wnat { background: #0b0a08c8; border: 1px solid #6a523688; border-radius: 999px; padding: 1px 9px 1px 4px; text-shadow: 0 1px 2px #000; }
.ap .wtop .ws b, .ap .wtop .ws > span, .ap .wtop .wn, .ap .wrh { text-shadow: 0 1px 3px #000, 0 0 8px #000c; }
.ap .wtop .wf { box-shadow: 0 4px 14px #000c; }
@media (max-width: 520px) { .ap .wtop .wrh { font-size: 17px; } }
.ap .wrh .wrk { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
.ap .wrh .wkind { font-style: normal; font-size: 13px; font-weight: 800; letter-spacing: .02em; padding: 2px 9px; border-radius: 9px; text-shadow: none; white-space: nowrap; }
.ap .wrh .wkind.us { background: #2f5a8acc; color: #e6f2ff; border: 1px solid #8ab8e8; } .ap .wrh .wkind.foe { background: #8a2a1ecc; color: #ffe3dc; border: 1px solid #e8907a; }
.ap .wrh { position: relative; z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 0; color: var(--gold); font-size: 21px; margin: -6px 0 4px; }
.ap .wrh b { padding: 2px 18px 3px; border-radius: 4px; background: linear-gradient(#2a1c0ee6, #1a1008e6); border: 1px solid #8a6a3a; box-shadow: 0 2px 8px #000c; }
.ap .wrh .mute { font-size: 12px; margin-top: 2px; }
.ap .wrh b { font-family: 'Gowun Batang', serif; letter-spacing: 1px; }
.ap .wvs { display: flex; align-items: flex-start; gap: 8px; }
.ap .wvs .vs { font-style: normal; font-weight: 800; color: #c8402a; font-size: 20px; align-self: center; }
.ap .ws { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; }
/* 장수가 없는 쪽(병종 그림)도 같은 높이 — 그림 칸은 테두리까지 같은 크기, 이름은 한 줄 (형 10-23: "상대 장군이 없을 때 명 바·사기 바 높이가 서로 달라서 안 맞아") */
.ap .ws b { font-size: 15px; margin-top: 4px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .ap .ws > span { font-size: 12px; color: var(--mute); }
.ap .ws .wnat { display: inline-flex; align-items: center; gap: 4px; min-height: 22px; font-size: 13px; color: #e8dcc0; }
.ap .ws .wnat img { width: 20px; height: 20px; object-fit: contain; filter: drop-shadow(0 1px 2px #000); }
.ap .wf { box-sizing: border-box; width: 84px; height: 84px; border-radius: 14px; object-fit: cover; border: 2px solid #6a5a3a; background: #3a2c1e; }
.ap .wf.unit { object-fit: contain; padding: 6px; }
.ap .ws.foe .wf { border-color: #7a3a2a; }
.ap .wbar { position: relative; width: 100%; height: 12px; border-radius: 6px; background: linear-gradient(#0c0805, #22180f); overflow: hidden; margin-top: 7px;
  box-shadow: inset 0 1px 3px #000e, 0 0 0 1px #8a6a3a, 0 0 0 2.5px #1a120c; }
/* 무너지는 금 — 붉은 세로 금 */
.ap .wbar .brk { position: absolute; top: 0; bottom: 0; width: 3px; margin-left: -1px; background: #ff3b2b; box-shadow: 0 0 5px #ff3b2b; z-index: 2; cursor: help; overflow: visible; }
/* 해골 — 금 위에 · 금 밑 구역은 붉은 빗금(패배가 정해지는 곳) */
.ap .wbar .brk::after { content: ''; position: absolute; left: 50%; top: -11px; width: 20px; height: 20px; translate: -50% 0; border-radius: 50%;
  background: #2a0c08 url(__ART__icon/war-skull.png) center / 82% no-repeat; filter: drop-shadow(0 0 2px #000) drop-shadow(0 0 3px #ff3b2b88); } /* 둥근 그러데이션 대신 단색 동그라미 — 갤럭시 크롬이 못 그렸다 (10-28) */
.ap .wbar .brk.near::after { animation: wskull .7s ease-in-out infinite alternate; } @keyframes wskull { to { scale: 1.35; filter: drop-shadow(0 0 2px #000) drop-shadow(0 0 8px #ff3b2b); } }
.ap .wbar .wdz { position: absolute; left: 0; top: 0; bottom: 0; z-index: 1; pointer-events: none; text-decoration: none;
  background: #b8221866; box-shadow: inset -2px 0 0 #ff3b2b, inset 0 0 6px #ff3b2b88; border-radius: 6px 0 0 6px; } /* 비스듬한 빗금 무늬 대신 단색 붉은 구역 — 형 폰에서 안 보였다 (10-28) */
/* 막대가 무너지는 금에 가까우면 붉은 구역이 깜박 — 「여기로 떨어지면 진다」 (형 10-28: 그 빨간 연출을 다시) */
.ap .wbar:has(.brk.near) .wdz { animation: wdzwarn .55s ease-in-out infinite alternate; }
@keyframes wdzwarn { from { background-color: #b8221866; } to { background-color: #ff3b2bcc; } }
@media (prefers-reduced-motion: reduce) { .ap .wbar:has(.brk.near) .wdz { animation: none; background-color: #ff3b2b99; } }
.ap .wbar:has(.brk) { overflow: visible; } /* 해골이 막대 밖으로 나오게 (채움 i 는 제 둥근 테 안에서 잘린다) */
@media (prefers-reduced-motion: reduce) { .ap .wbar .brk.near::after { animation: none; } }
/* 전장 띠 — 병졸 말 */
/* 전장 — 진을 갖춘 두 군대 (fieldHtml). 적은 통째로 거울 · 아래일수록 크고 앞에 */
.ap .wfield { position: relative; height: clamp(150px, 22vw, 236px); margin: 6px 2px 2px; border-radius: 10px; overflow: hidden; container-type: inline-size;
  background: none; }
.ap .wfield .wf-ground { position: absolute; left: 0; right: 0; top: 40%; bottom: 0; background: radial-gradient(ellipse 70% 60% at 50% 70%, #3a2a1666, #0000 75%); }
.ap .wf2s { position: absolute; inset: 0; z-index: 2; } .ap .wf2s.foe { transform: scaleX(-1); }
/* 땅 조각 — 병사와 같은 자리 셈(원근으로 비스듬히 · 아래일수록 앞) */
.ap .wfield .tp { position: absolute; left: var(--x); top: calc(60% + var(--oy)); height: clamp(26px, 7cqw, 46px); width: auto; transform: translate(-50%, -100%) scale(var(--sc, 1)); transform-origin: 50% 100%; pointer-events: none; filter: drop-shadow(0 2px 2px #000a); }
.ap .wfield .tp.flat { height: clamp(18px, 5cqw, 32px); transform: translate(-50%, -60%) scale(var(--sc, 1)); filter: none; opacity: .92; }
.ap .wfield .wf-mid-terr { position: absolute; inset: 0; z-index: 1; } /* 물은 늘 군사 밑 — 적 진(뒤집힌 층)이 강 뒤로 숨던 것 (형 10-26) */
/* ── 폰 전투 머리띠 — 초상 옆에 이름·나라, 막대는 밑 (형 10-25: "싸구려웹게임같음" — 초상 카드가 화면 반을 먹어 전장이 작았다) ── */
@media (max-width: 520px) {
  .ap .wtop .wvs { align-items: flex-start; gap: 4px; }
  .ap .wtop .wvs img.vs { width: 34px; align-self: flex-start; margin-top: 14px; }
  .ap .wtop .ws { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 6px; align-items: center; text-align: left; }
  .ap .wtop .ws .wpf { --pf: 60px; grid-row: 1 / span 2; grid-column: 1; }
  .ap .wtop .ws > b { grid-column: 2; grid-row: 1; margin: 0; font-size: 14px; align-self: end; }
  .ap .wtop .ws .wnat { grid-column: 2; grid-row: 2; justify-self: start; align-self: start; font-size: 11.5px; min-height: 18px; padding: 0 7px 0 3px; max-width: 100%; overflow: hidden; white-space: nowrap; }
  .ap .wtop .ws .wnat img { width: 16px; height: 16px; }
  .ap .wtop .ws .wbar, .ap .wtop .ws .wn { grid-column: 1 / -1; }
  .ap .wtop .ws .wbar { margin-top: 14px; height: 10px; }
  .ap .wtop .ws .wn { font-size: 11px; line-height: 1.25; text-align: center; justify-self: center; padding: 0 6px; }
  .ap .wtop .ws.foe { grid-template-columns: minmax(0, 1fr) auto; text-align: right; }
  .ap .wtop .ws.foe .wpf { grid-column: 2; }
  .ap .wtop .ws.foe > b, .ap .wtop .ws.foe .wnat { grid-column: 1; justify-self: end; }
  .ap .wtop .wfield { height: clamp(230px, 62vw, 290px); }
  .ap .wtop .wf2s .tk { height: clamp(34px, 10cqw, 50px) !important; } .ap .wtop .wf2s .tk.wsp.k-horse, .ap .wtop .wf2s .tk.wsp.k-boat { height: clamp(44px, 13cqw, 66px) !important; }
}
/* 병사 발밑 그림자 — 땅에 서 있게 */
.ap .wf2s .tk.wsp::before { content: ''; position: absolute; left: 18%; right: 18%; bottom: -4%; height: 12%; border-radius: 50%; background: radial-gradient(closest-side, #000b, #0000); z-index: -1; pointer-events: none; }
.ap .wf2s .tk.wsp.tkd::before { opacity: .4; }
/* 농민군 — 돌창 든 마을 사람: 작고 흐리게 · 발밑 고리는 흙빛 (filter 없이 · 폰 그래픽 한도) · 전용 그림은 그림 줄 「농민군 띠」 (형 11-03: "정찰 땐 200~300인데 창방패병 1000이면 당황") */
.ap .wf2s .tk.tkm { scale: .9; }
.ap .wf2s .tk.wsp.tkm::before, .ap .wf2s.foe .tk.wsp.tkm.tku::before, .ap .wf2s .tk.wsp.tkm.tku::before { background: radial-gradient(closest-side, #000a, #0006 50%, #b08a4ac0 74%, #b08a4a00); }
/* 폰 — v2 말은 그림 칸이 몸의 서너 배로 넓다(창이 다 뻗어도 들어가게). 그 말에 빛(filter: drop-shadow)을 걸면 폰에서 칸이 통째로 하늘색 띠로 번졌다
   (형 10-29 갤럭시: 목책 곁 우리 창병 위에 기울어진 하늘색 막대 · 너비 128px = 창병 칸 131px · 기울기 8도 = 돌격 앞줄 9도). 폰에선 빛을 끄고 발밑 고리로 편을 가른다 */
@media (pointer: coarse) {
  .ap .wf2s .tk.wsp { filter: none !important; }
  .ap .wf2s .tk.wsp.tkd { opacity: .5; }
  .ap .wf2s .tk.wsp.tku::before { left: 6%; right: 6%; bottom: -7%; height: 18%; background: radial-gradient(closest-side, #000a, #0008 48%, #7cc4ffd0 72%, #7cc4ff00); }
  .ap .wf2s.foe .tk.wsp.tku::before { background: radial-gradient(closest-side, #000a, #0008 48%, #ff6a5ad0 72%, #ff6a5a00); }
  .ap .wfield[data-act="front"] .us .tk.wsp.r0.tku::before, .ap .wfield[data-act="bows"] .us .tk.wsp.r1.tku::before, .ap .wfield[data-act="horse"] .us .tk.wsp.r2.tku::before { background: radial-gradient(closest-side, #000a, #0008 40%, #ffd27a 68%, #ffd27a00); }
}
/* 땅 — 지평선 아래로 짙어져 병사가 떠 보이지 않게 */
.ap .wfield .wf-ground { display: none; }
/* 지키는 쪽 뒤의 성 (그림은 바깥이 왼쪽 — 우리 쪽이면 뒤집고, 거울인 적 쪽에선 한 번 더 뒤집어 바깥이 공격 쪽을 본다) */
/* 해자 · 목책 (말뚝 하나하나) — 10-26 */
.ap .wfield .wf-moat { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; } .ap .wfield .wf-moat.mir { transform: scaleX(-1); }
.ap .wf2s .wf-pal { position: absolute; inset: 0; pointer-events: none; }
.ap .wf2s .wf-pal .stk { position: absolute; left: var(--x); top: calc(60% + var(--oy)); height: calc(clamp(30px, 8.5cqw, 62px) * var(--hk) * var(--p, 1)); width: auto;
  transform: translate(-50%, -100%) rotate(var(--r)); transform-origin: 50% 100%; filter: drop-shadow(1px 3px 2px #000a); }
.ap .wf2s .wf-pal .stk.tall { height: calc(clamp(60px, 17cqw, 124px) * var(--p, 1)); }
.ap .wf2s .wf-pal .gatedoor { position: absolute; left: var(--x); top: calc(60% + var(--oy)); width: clamp(20px, 5cqw, 38px); height: clamp(36px, 9cqw, 66px); transform: translate(-50%, -100%) skewY(-12deg);
  background: repeating-linear-gradient(90deg, #5a3a1e 0 22%, #3a2614 22% 25%); border: 2px solid #2a1a0c; filter: drop-shadow(1px 2px 2px #000a); }
.ap .wf2s .wf-pal .gatedoor.smashed { clip-path: polygon(0 0, 40% 0, 30% 40%, 55% 55%, 35% 100%, 0 100%); filter: brightness(.6) drop-shadow(1px 2px 2px #000a); }
/* 성은 판 바닥까지 — 바닥 이름표(「수비 · 적 …」)의 중간에서 끊겨 떠 보였다 (형 10-26: "더 밑에까지 내려야해") */
/* 폰 폭에서는 높이 95% 가 너비의 4분의 1을 먹어 목책과 겹쳤다 → 26cqw 로 묶었더니 너무 작다 (형 10-29: "성벽이 너무 작아진 거 아님") · 그 사이 44cqw */
.ap .wf2s .wf-wall { position: absolute; left: -4%; bottom: -3%; height: min(95%, 44cqw); width: auto; transform: scaleX(-1); z-index: 1; pointer-events: none; filter: brightness(.8) saturate(.9) drop-shadow(0 4px 8px #000b); }
.ap .wfield i.wf-tw, .ap .wfield i.wf-pre, .ap .wfield i.wf-post { position: absolute; inset: 0; pointer-events: none; }
.ap .wfield .wf-pre { animation: wfpre .5s ease-out var(--rv, 0s) forwards; } @keyframes wfpre { to { opacity: 0; visibility: hidden; } }
.ap .wfield .wf-post { animation: wfpost .5s ease-out var(--rv, 0s) both; } @keyframes wfpost { from { opacity: 0; } to { opacity: 1; } }
.ap .wr.fast .wfield { --rv: 0s !important; --ce: 0s !important; }
/* 물 한 줄기 (waterSvg) — 땅 위 · 병사 밑. 위쪽은 지평선으로 스러진다 */
.ap .wfield .wrv { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none; filter: drop-shadow(0 0 3px #0006); }
.ap .wfield .wrv-rip { opacity: 0; animation: wrvflow 3.6s linear calc(var(--i) * -.6s) infinite; }
@keyframes wrvflow { 0% { opacity: 0; transform: translateY(-3px); } 30% { opacity: .7; } 100% { opacity: 0; transform: translateY(6px); } }
.ap .wfield .wrv-gloss { opacity: .6; }
@media (prefers-reduced-motion: reduce) { .ap .wfield .wrv-rip { animation: none; opacity: .5; } }
/* 공격·수비 꼬리 */
.ap .wrole { display: inline-block; font-style: normal; font-size: .82em; font-weight: 900; padding: 0 5px; margin-right: 4px; border-radius: 6px; vertical-align: 1px; letter-spacing: .04em; }
.ap .wrole.atk { background: #c8402a; color: #fff; } .ap .wrole.def { background: #3a6ab0; color: #fff; }
.ap .wfield.play .wf-mid-terr { transform-origin: 50% 62%; animation: wpushin 1.5s cubic-bezier(.2, .7, .3, 1) calc(var(--hd) - .25s) both; }
.ap .wf2s .tk { position: absolute; left: calc(var(--x) + var(--dx, 0%)); top: calc(60% + var(--oy) * var(--sy, 1) + var(--dy, 0%)); height: clamp(28px, 7.4cqw, 50px); width: auto;
  transform: translate(-50%, -100%) scale(var(--sc, 1)); transform-origin: 50% 100%; rotate: var(--rot, 0deg);
  transition: left .5s cubic-bezier(.3, 1.25, .5, 1), top .5s cubic-bezier(.3, 1.25, .5, 1), rotate .35s ease-out; filter: drop-shadow(0 0 2px #7cc4ff) drop-shadow(0 2px 2px #000c); } /* 빛(filter)은 서서히 바꾸지 않는다 — 누를 때 파란 테가 연기처럼 번졌다 (형 10-28) */
.ap .wf2s.foe .tk { filter: drop-shadow(0 0 2px #ff6a5a) drop-shadow(0 2px 2px #000c) sepia(.25) saturate(1.2); }
.ap .wf2s .tk.tkd, .ap .wf2s .tk.strike-gone, .ap .wfield:not(.play) .tk.tkf, .ap .wr.fast .wfield .tk.tkf { visibility: hidden; }
/* 장수 — 맨 뒤 · 깃발 */
.ap .wf2s .wgen { position: absolute; left: calc(7% + var(--gdx, 0%)); top: 60%; width: clamp(26px, 6.6cqw, 40px); transform: translate(-50%, -78%); z-index: 60; transition: left .5s cubic-bezier(.3, 1.25, .5, 1); }
.ap .wf2s .wgen .wf { width: 100%; height: auto; aspect-ratio: 1; border-radius: 50%; object-fit: cover; border: 2px solid var(--fc); box-shadow: 0 0 0 1.5px #000a, 0 2px 6px #000c; background: #201811; position: relative; z-index: 1; }
.ap .wf2s.foe .wgen .wf { transform: scaleX(-1); }
.ap .wf2s .wpole { position: absolute; left: 50%; bottom: 60%; width: 3px; height: 110%; background: linear-gradient(90deg, #3a2814, #8a6a40); }
.ap .wf2s .wpole img { position: absolute; left: 3px; top: 0; width: clamp(16px, 4cqw, 24px); aspect-ratio: 1.2; object-fit: contain; padding: 2px; background: var(--fc); border: 1px solid #1a1008; clip-path: polygon(0 0, 100% 0, 85% 50%, 100% 100%, 0 100%); }
/* 지금 고르는 무리가 진에서 빛난다 (탭과 이어진다) */
.ap .wfield[data-act="front"] .us .tk.r0, .ap .wfield[data-act="bows"] .us .tk.r1, .ap .wfield[data-act="horse"] .us .tk.r2 { filter: drop-shadow(0 0 4px #ffd27a) drop-shadow(0 0 2px #ffd27a) drop-shadow(0 2px 2px #000c); }
.ap .wfield[data-act="lead"] .us .wgen .wf { box-shadow: 0 0 0 2px #ffd27a, 0 0 14px #ffd27a; }
/* 장수 그림 (형 10-30: "전투할 때 장수 유닛도") — public/realm/anim2/gen-<결>.png · 병사 v2 띠와 같은 20컷(서기 0~3 · 걷기 4~11 · 공격 12~17 · 맞음 18 · 쓰러짐 19).
   발이 땅(60%)에 · 몸은 병사의 1.3배쯤(--gb = 서 있는 몸 / 띠 높이) · 얼굴 동그라미는 머리 위 · 깃대는 등 뒤 */
.ap .wf2s .wgen.gsp { left: calc(9% + var(--gdx, 0%)); width: auto; height: calc(clamp(44px, 12.4cqw, 80px) / var(--gb, 1)); aspect-ratio: var(--gar, 1); transform: translate(-50%, -100%); }
.ap .wf2s .wgen.gsp.gcap-aide { left: 16%; top: 72%; }
.ap .wf2s .wgen.gsp.gmt { height: calc(clamp(56px, 15.6cqw, 100px) / var(--gb, 1)); }
.ap .wf2s .wgen.gsp .gbody { position: absolute; inset: 0; z-index: 1; filter: drop-shadow(0 0 2px #7cc4ff) drop-shadow(0 2px 2px #000c); }
.ap .wf2s.foe .wgen.gsp .gbody { filter: drop-shadow(0 0 2px #ff6a5a) drop-shadow(0 2px 2px #000c); }
.ap .wf2s .wgen.gsp .gbody::before { content: ''; position: absolute; left: 30%; right: 30%; bottom: -3%; height: 9%; border-radius: 50%; background: radial-gradient(closest-side, #000b, #0000); z-index: -1; }
.ap .wf2s .wgen.gsp .gspf { position: absolute; inset: 0; background: 0 0 / 2000% 100% no-repeat; --i0: 0%; --i1: 21.0526%; --w0: 21.0526%; --w1: 63.1579%;
  animation: spidle calc(2.3s + var(--k, .4) * .7s) steps(4) calc(var(--k, .4) * -2.6s) infinite; }
.ap .wf2s .wgen.gsp .wf { position: absolute; left: 50%; top: 0; width: clamp(16px, 4.2cqw, 26px); translate: -50% -92%; z-index: 2; }
.ap .wf2s .wgen.gsp .wpole { left: 30%; bottom: 30%; height: 175%; z-index: 0; }
/* 장수의 깃발(비기·겨루기·사로잡기·북)이 오른 합엔 맞부딪기 앞부터 칼질(활 장수는 쏘기). */
.ap .wfield.enter .wgen.gsp .gspf { animation: spidle calc(2.3s + var(--k, .4) * .7s) steps(4) calc(var(--k, .4) * -2.6s) infinite, spwalk calc(var(--entry-time) / 3) steps(8) var(--entry-delay) 3; }
.ap .wfield.play:not(.capture-round) .wf2s:is([data-l="art"], [data-l="duel"], [data-l="drum"]) .wgen.gsp:not(.gdown):not(.gfall) .gspf { animation: spidle calc(2.3s + var(--k, .4) * .7s) steps(4) calc(var(--k, .4) * -2.6s) infinite, gatk .9s steps(1) calc(var(--hd) - 1.2s) 3; }
.ap .wfield.play:not(.capture-round) .wf2s:is([data-l="art"], [data-l="duel"], [data-l="drum"]) .wgen.gsp.gbw:not(.gdown):not(.gfall) .gspf { animation: spidle calc(2.3s + var(--k, .4) * .7s) steps(4) calc(var(--k, .4) * -2.6s) infinite, spshot 1.1s steps(1) calc(var(--hd) - 1.2s) 3; }
/* 합마다 장수도 칼질한다 — 자기 깃발이 아닌 합엔 진 맨 뒤에 서 있기만 해서 "장수 유닛은 왜 안 움직이냐 · 공격·기술이 하나도 안 보임"(형 11-04) ·
   맞부딪는 때에 한 번 · 자기 깃발(비기·겨루기·사로잡기·북) 합엔 앞으로 뛰어들어 세 번(아래 gdash) */
.ap .wfield.play:not(.enter, .capture-round) .wf2s:not(:is([data-l="art"], [data-l="duel"], [data-l="capture"], [data-l="drum"])) .wgen.gsp:not(.gdown):not(.gfall) .gspf { animation: spidle calc(2.3s + var(--k, .4) * .7s) steps(4) calc(var(--k, .4) * -2.6s) infinite, gatk .9s steps(1) calc(var(--hd) - .5s) 1; }
.ap .wfield.play:not(.enter, .capture-round) .wf2s:not(:is([data-l="art"], [data-l="duel"], [data-l="capture"], [data-l="drum"])) .wgen.gsp.gbw:not(.gdown):not(.gfall) .gspf { animation: spidle calc(2.3s + var(--k, .4) * .7s) steps(4) calc(var(--k, .4) * -2.6s) infinite, spshot 1.1s steps(1) calc(var(--hd) - .6s) 1; }
.ap .wfield.play:not(.enter, .capture-round) .wf2s:is([data-l="art"], [data-l="duel"], [data-l="drum"]) .wgen.gsp:not(.gdown):not(.gfall):not(.gbw) { animation: gdash 3.4s cubic-bezier(.3, 0, .2, 1) calc(var(--hd) - 1.3s) 1 both; }
@keyframes gdash { 0% { translate: 0 0; } 25%, 75% { translate: clamp(40px, 16cqw, 120px) 0; } 100% { translate: 0 0; } }
@media (prefers-reduced-motion: reduce) { .ap .wfield.play .wgen.gsp { animation: none !important; } }
@keyframes gatk { 0% { background-position-x: 63.1579%; } 10% { background-position-x: 68.4211%; } 26% { background-position-x: 73.6842%; } 40% { background-position-x: 78.9474%; } 66% { background-position-x: 84.2105%; } 84%, 100% { background-position-x: 89.4737%; } }
/* 사로잡히거나 쓰러진 장수 — 그 합엔 휘청(18) 했다가 쓰러지고(19) 깃대가 넘어간다 · 다음 합부터 누운 채 */
.ap .wfield .wgen.gsp.gfall .gspf { animation: gdie 1.3s steps(1) calc(var(--hd) + .1s) forwards; }
@keyframes gdie { 0% { background-position-x: 94.7368%; } 35%, 100% { background-position-x: 100%; } }
.ap .wfield .wgen.gsp.gfall .wpole { animation: gpolefall .7s ease-in calc(var(--hd) + .6s) forwards; } @keyframes gpolefall { to { rotate: -70deg; } }
.ap .wfield .wgen.gsp.gfall .wf { animation: gbadge .5s ease-in calc(var(--hd) + .6s) forwards; } @keyframes gbadge { to { top: 58%; opacity: .7; } }
.ap .wf2s .wgen.gsp.gdown .gspf { animation: none; background-position-x: 100%; }
.ap .wf2s .wgen.gsp.gdown .wpole { rotate: -70deg; } .ap .wf2s .wgen.gsp .wpole { transform-origin: 50% 100%; }
.ap .wf2s .wgen.gsp.gdown .wf { top: 58%; opacity: .7; }
/* 사로잡힌 적장 — 잡은 쪽 진, 장수 발치 땅바닥에 쓰러진 채 (쓰러짐 컷 19 · 형 11-08). 제 진(거울)에서 쓰러진 모습 그대로라 칸을 뒤집는다.
   이번 합에 잡힌 이(.late)는 장수가 이고 와서 내려놓을 때 나타난다 (battle-capture.ts 가 쥔다) · 연출을 못 돌리면 그 합이 끝날 때(--ce) 바뀐다 */
.ap .wf2s .wcapt { position: absolute; left: calc(11% + var(--ci, 0) * 7%); top: calc(69% + var(--ci, 0) * 4%); height: calc(clamp(44px, 12.4cqw, 80px) / var(--gb, 1)); aspect-ratio: var(--gar, 1); transform: translate(-50%, -100%); z-index: 130; pointer-events: none; }
.ap .wf2s .wcapt .wcaptf { position: absolute; inset: 0; background: 100% 0 / 2000% 100% no-repeat; scale: -1 1; }
.ap .wfield.play .wf2s .wcapt.late { animation: wcaplate .01s steps(1) var(--ce, 0s) both; } @keyframes wcaplate { from { opacity: 0; } to { opacity: 1; } }
.ap .wfield.play .wf2s .wgen.gsp.gtaken { animation: wcapgone .01s steps(1) var(--ce, 0s) both; } @keyframes wcapgone { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ap .wfield.play .wf2s .wgen.gsp.gtaken { visibility: hidden; } }
/* 잡으러 나간 장수는 적진 병사들 위로 (진 하나가 통째로 맞은편 진 위에 · 그 합에만) */
.ap .wfield.play .wf2s.wcapby { z-index: 3; } .ap .wfield.play .wf2s.wcapby .wgen.gsp:not(.gcap-aide) { z-index: 160; } .ap .wfield.play .wf2s.wcapby .wcapt.late { z-index: 161; }
@media (pointer: coarse) {
  .ap .wf2s .wgen.gsp .gbody, .ap .wf2s.foe .wgen.gsp .gbody { filter: none; }
  .ap .wf2s .wgen.gsp .gbody::before { left: 22%; right: 22%; bottom: -5%; height: 13%; background: radial-gradient(closest-side, #000a, #0008 48%, #7cc4ffd0 72%, #7cc4ff00); }
  .ap .wf2s.foe .wgen.gsp .gbody::before { background: radial-gradient(closest-side, #000a, #0008 48%, #ff6a5ad0 72%, #ff6a5a00); }
}
/* 진의 꼴 — 앞줄 */
.ap .wf2s[data-f="charge"] .tk.r0 { --dx: 7%; --rot: 9deg; }
.ap .wf2s[data-f="hold"] .tk.r0 { --sy: .7; --dx: -1%; }
.ap .wf2s[data-f="open"] .tk.r0.hi { --dy: -13%; } .ap .wf2s[data-f="open"] .tk.r0.lo { --dy: 13%; } .ap .wf2s[data-f="open"] .tk.r1 { --dx: 11%; }
/* 활 — 활을 들어 올린다 · 맞쏘기는 낮게 */
.ap .wf2s[data-b] .tk.r1 { --rot: -13deg; } .ap .wf2s[data-b="counter"] .tk.r1 { --rot: -5deg; }
/* 기병 — 옆구리 · 가운데 뚫기 · 쫓기 · 장수 곁 */
.ap .wf2s[data-h="flank"] .tk.r2 { --dx: 24%; --dy: -3%; } .ap .wf2s[data-h="punch"] .tk.r2 { --dx: 11%; --dy: 30%; }
.ap .wf2s[data-h="pursue"] .tk.r2 { --dx: 30%; --dy: 8%; } .ap .wf2s[data-h="guard"] .tk.r2 { --dx: -13%; --dy: 26%; }
/* 장수 — 물러나기는 다 같이 뒤로 · 겨루기는 장수가 앞으로 */
.ap .wf2s[data-l="retreat"] .tk { --dx: -6%; } .ap .wf2s[data-l="duel"] .wgen { --gdx: 30%; }
/* 표시 — 진 앞에 뜨는 기세 (적 쪽은 통째로 거울이라 글자만 되뒤집는다) */
.ap .wf2s .wq { position: absolute; opacity: 0; pointer-events: none; transition: opacity .3s; z-index: 70; }
.ap .wf2s.foe .wq b { display: inline-block; transform: scaleX(-1); }
.ap .wf2s .wq b { font-size: clamp(10px, 2.4cqw, 13px); font-weight: 800; letter-spacing: .04em; }
/* 돌격 글자는 제 앞줄 위에 — 한가운데(46%)에 두면 적 것(거울 54%)과 반쯤 겹쳐 「돌돌격」으로 읽혔다 (형 10-25) */
.ap .wf2s .q-charge { left: 33%; top: 12%; transform: translateX(-50%); white-space: nowrap; text-align: center; color: #ff8a6a; text-shadow: 0 0 8px #ff4a2a, 0 1px 2px #000; font-size: clamp(16px, 4cqw, 26px); font-weight: 900; }
.ap .wf2s .q-charge::before { content: '›››'; display: block; letter-spacing: -2px; animation: wqgo .7s ease-in-out infinite; }
@keyframes wqgo { 0% { transform: translateX(-6px); opacity: .4; } 60% { opacity: 1; } 100% { transform: translateX(6px); opacity: .2; } }
.ap .wf2s[data-f="charge"] .q-charge { opacity: 1; }
.ap .wf2s .q-charge b { font-size: clamp(12px, 3cqw, 15px); }
.ap .wf2s .q-hold { left: 41%; top: 22%; width: 5px; height: 52%; border-radius: 3px; background: linear-gradient(#ffd27a00, #ffd27a, #ffd27a00); box-shadow: 0 0 12px #ffd27a, 0 0 4px #fff3c8; }
.ap .wf2s[data-f="hold"] .q-hold { opacity: .9; animation: wqhold 1.2s ease-in-out infinite alternate; } @keyframes wqhold { to { box-shadow: 0 0 22px #ffd27a, 0 0 6px #fff3c8; } }
.ap .wf2s .q-shoot { left: 22%; top: 12%; width: 44%; height: 50%; border-top: 2px dashed #ffe7a8; border-radius: 50% 50% 0 0; filter: drop-shadow(0 0 3px #ffd27a); }
.ap .wf2s[data-b] .q-shoot { opacity: .85; } .ap .wf2s[data-b="fire"] .q-shoot { border-top-color: #ff8a3a; filter: drop-shadow(0 0 5px #ff5a1a); } .ap .wf2s[data-b="counter"] .q-shoot { height: 30%; top: 26%; }
.ap .wf2s .q-ride { left: 20%; top: 6%; width: 38%; height: 34%; border-top: 2px dashed #c8e8ff; border-right: 2px dashed #c8e8ff; border-radius: 0 60% 0 0; }
.ap .wf2s[data-h="flank"] .q-ride, .ap .wf2s[data-h="pursue"] .q-ride { opacity: .85; }
.ap .wf2s .q-cap { left: 11%; top: 38%; width: 80%; border-top: 2px dashed #ffb070; text-align: left; padding-left: 14%; box-sizing: border-box; white-space: nowrap; color: #ffb070; } /* 글자는 제 쪽에 — 가운데 두면 양쪽이 같이 낼 때 겹친다 */
.ap .wf2s .q-cap b { position: relative; top: -16px; text-shadow: 0 1px 3px #000; }
.ap .wf2s[data-l="capture"] .q-cap { opacity: 1; }
.ap .wf2s .q-back { left: 16%; top: 30%; color: #c8d0e0; text-shadow: 0 1px 3px #000; } .ap .wf2s[data-l="retreat"] .q-back { opacity: 1; }
/* 맞부딪힘 — 앞줄이 서로 달려들어 부딪고 조금 물러선다. 이번 합에 잃은 만큼 쓰러진다 */
/* 근접전 — 맞부딪친 앞줄이 한가운데서 엉긴 채 남는다(말마다 조금씩 들쭉날쭉 — --j). 결과가 나오면 syncField 가 진으로 되돌린다 (형 10-25: "메가히트 수준") */
.ap .wfield.play .wf2s .tk.r0:not(.tkd) { animation: wstep .5s ease-out var(--fa, 0s) both, wclash .9s cubic-bezier(.3, .1, .3, 1) calc(var(--hd) - .45s) forwards; }
/* 앞줄이 다 쓰러지면 뒷줄이 나서 맞붙는다 (형 10-31: "자동전투 1합은 잘 움직이는데 갈수록 안 움직임" · 사상자는 앞줄부터 쓰러지고 움직임은 앞줄에만 걸려, 남은 병사가 서 있기만 했다) */
.ap .wfield.play .wf2s:not(:has(.tk.r0:not(.tkd))) .tk.r1:not(.tkd) { animation: wstep .5s ease-out var(--fa, 0s) both, wclash .9s cubic-bezier(.3, .1, .3, 1) calc(var(--hd) - .45s) forwards; }
.ap .wfield.play .wf2s:not(:has(.tk:is(.r0, .r1):not(.tkd))) .tk.r2:not(.tkd) { animation: wstep .5s ease-out var(--fa, 0s) both, wclash .9s cubic-bezier(.3, .1, .3, 1) calc(var(--hd) - .45s) forwards; }
@keyframes wstep { from { translate: 0 0; } to { translate: 2cqw 0; } }
@keyframes wclash { 0% { translate: 2cqw 0; } 50% { translate: calc(9cqw + var(--j, 0) * .3cqw) 0; } 100% { translate: calc(6.5cqw + var(--j, 0) * .4cqw) calc((var(--j, 0) - 2.5) * .4cqw); } }
.ap .wfield.play .wf2s[data-h="flank"] .tk.r2:not(.tkd), .ap .wfield.play .wf2s[data-h="pursue"] .tk.r2:not(.tkd), .ap .wfield.play .wf2s[data-h="punch"] .tk.r2:not(.tkd) { animation: wride ${P.realm.warHorseRideS}s ease-in-out var(--ha, 0s) both; }
@keyframes wride { 0% { translate: 0 0; } 70% { translate: 14cqw 9cqw; } 100% { translate: 12cqw 10cqw; } } /* 옆구리로 파고들어 적 진 가장자리에서 엉긴다 */
.ap .wfield:not(.paired-strikes) .tk.tkf { animation: wtkfall .55s ease-in calc(var(--hd) + .2s + var(--j) * .05s) forwards !important; }
@keyframes wtkfall { 0% { translate: 3cqw 0; } 100% { translate: 2cqw 0; rotate: -78deg; opacity: .16; filter: grayscale(1); } }
/* 쓰러질 때 몸이 78도 눕는데 발밑 그림자(::before)도 같이 돌아 세로로 떠 보였다 (형 11-09: 그림자가 유닛과 떨어짐) → 눕기 시작하면 그림자는 걷힌다 */
.ap .wfield:not(.paired-strikes) .tk.tkf::before { animation: wtkshade .25s ease-in calc(var(--hd) + .2s + var(--j) * .05s) forwards !important; } @keyframes wtkshade { to { opacity: 0; } }
.ap .wfield .wf-mid { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); font-style: normal; font-size: 22px; color: #f0d090; text-shadow: 0 0 8px #000; opacity: 0; z-index: 80; }
/* 판의 끝 — 진 쪽은 등을 돌려(거울) 뒤로 달아나며 흩어지고, 이긴 쪽 장수 깃발이 솟는다. 맞부딪힘이 끝난 뒤(--hd + .9s) */
.ap .wfield.fin .tk.tku { --flee-time: 1.6s; --flee-delay: calc(var(--rv, 0s) + var(--j, 0) * .07s); }
.ap .wfield.fin .tk.wsp.tku .spf { --flee-walk: spflee calc(var(--flee-time) / 4) steps(var(--spwalkn, 2)) var(--flee-delay) 4; }
.ap .wfield.fin.win-us .wf2s.foe .tk.tku, .ap .wfield.fin.win-foe .wf2s.us .tk.tku { animation: wflee var(--flee-time) linear var(--flee-delay) forwards !important; }
.ap .wfield.fin.win-us .wf2s.foe .tk.wsp.tku .spf, .ap .wfield.fin.win-foe .wf2s.us .tk.wsp.tku .spf { animation: var(--flee-walk) !important; }
/* 진 쪽도 달아나기(--rv) 전까지는 싸운다 — 전엔 끝 합에서 진 쪽은 한 번도 칼질을 안 했다 (형 10-30) · 달아나는 컷은 spwalk 와 이름이 달라야 처음부터 다시 돈다
   (같은 이름이면 앞 장면의 걷기가 이어 돌아 합이 열리자마자 달아났다) */
.ap .wfield.fin.win-us:not(.paired-strikes) .wf2s.foe .tk.wsp.v2.r0.tku .spf, .ap .wfield.fin.win-foe:not(.paired-strikes) .wf2s.us .tk.wsp.v2.r0.tku .spf { animation: var(--atk, spthr) calc(.72s + var(--j, 0) * .04s) steps(1) calc(var(--hd) - 1.2s + var(--j, 0) * .09s) 5, var(--flee-walk) !important; }
.ap .wfield.fin.win-us:not(.paired-strikes) .wf2s.foe[data-b] .tk.wsp.v2.r1.tku .spf, .ap .wfield.fin.win-foe:not(.paired-strikes) .wf2s.us[data-b] .tk.wsp.v2.r1.tku .spf { animation: spshot 1.1s steps(1) calc(var(--sa) - .55s + var(--j, 0) * .07s) var(--bn, 2), var(--flee-walk) !important; }
.ap .wfield.fin.win-us:not(.paired-strikes) .wf2s.foe[data-h] .tk.wsp.v2.r2.tku .spf, .ap .wfield.fin.win-foe:not(.paired-strikes) .wf2s.us[data-h] .tk.wsp.v2.r2.tku .spf { animation: spthr calc(.7s + var(--j, 0) * .05s) steps(1) max(calc(var(--ha, 0s) + .45s), calc(var(--hd) - 1.2s + var(--j, 0) * .09s)) 5, var(--flee-walk) !important; }
@keyframes spflee { from { background-position-x: var(--w0, 28.5714%); } to { background-position-x: var(--w1, 57.1429%); } }
@keyframes wflee { 0% { translate: 0 0; scale: 1; } 12% { scale: -1 1; } 100% { scale: -1 1; translate: -32cqw calc((var(--j, 0) - 2.5) * 2cqw); opacity: 0; } }
.ap .wfield.fin.win-us .wf2s.us .wgen, .ap .wfield.fin.win-foe .wf2s.foe .wgen { animation: wgenwin .7s cubic-bezier(.3, 1.6, .5, 1) calc(var(--rv, 0s) + .2s) both; }
@keyframes wgenwin { from { translate: 0 0; scale: 1; } to { translate: 9cqw -2cqw; scale: 1.35; } }
.ap .wfield.fin.win-us .wf2s.us .wpole, .ap .wfield.fin.win-foe .wf2s.foe .wpole { animation: wpoleup .6s ease-out calc(var(--rv, 0s) + .3s) both; }
@keyframes wpoleup { from { height: 110%; } to { height: 190%; filter: drop-shadow(0 0 6px #ffd27a); } }
/* 끝나면 진의 기세 표시(방패벽·화살 활꼴·기병 길·돌격 글자·격려 고리)를 걷는다 — 승패만 남게 */
.ap .wfield.fin .wq { animation: wqoff .4s ease-out var(--rv, 0s) forwards !important; } @keyframes wqoff { to { opacity: 0; visibility: hidden; } }
.ap .wfield.play .wf-mid { animation: wmid2 .6s ease-out var(--hd) both; } @keyframes wmid2 { 0% { opacity: 0; scale: .4; } 40% { opacity: 1; scale: 1.8; color: #fff; } 100% { opacity: 0; scale: 1.2; } }
/* 서 있는 병사는 땅에 붙어 있다 — 옛 숨쉬기 들썩임(translate -2px)은 둥실 떠 보였다 (형 11-09) · 숨은 띠의 서 있기 칸(spidle)이 맡는다 */

/* 들어오기 — 싸움이 처음 열리면 두 군대가 대열을 지어 걸어 들어온다 (적은 거울이라 오른쪽에서) */
.ap .wfield.enter :is(.tk, .wgen) { --entry-time: .95s; --entry-delay: calc(.15s + var(--j, 0) * .06s); animation: tkin var(--entry-time) linear var(--entry-delay) both; }
@keyframes tkin { from { translate: -28cqw 0; opacity: 0; } 60% { opacity: 1; } to { translate: 0 0; opacity: 1; } }
/* 돌격이면 앞줄이 더 깊이 달려든다 */
/* 돌격 — 제 박자에 달려 나가 깊이 부딪친다 · 방진 — 제자리에서 받아 낸다 */
.ap .wfield.play .wf2s[data-f="charge"] .tk.r0:not(.tkd) { animation-name: wstepc, wclashc; } @keyframes wstepc { from { translate: 0 0; } to { translate: 5cqw 0; } } @keyframes wclashc { 0% { translate: 5cqw 0; } 50% { translate: calc(9.5cqw + var(--j, 0) * .3cqw) 0; } 100% { translate: calc(7cqw + var(--j, 0) * .4cqw) calc((var(--j, 0) - 2.5) * .4cqw); } }
.ap .wfield.play .wf2s[data-f="hold"] .tk.r0:not(.tkd) { animation-name: wsteph, wclashh; } @keyframes wsteph { from { translate: 0 0; } to { translate: 0 0; scale: 1; } } @keyframes wclashh { 0% { translate: 0 0; } 50% { translate: calc(4cqw + var(--j, 0) * .3cqw) 0; } 100% { translate: calc(3cqw + var(--j, 0) * .4cqw) calc((var(--j, 0) - 2.5) * .3cqw); } }
/* 맞부딪힘 — 불꽃 · 흙먼지 · 흔들림 · 살짝 당겨 보기 */
/* 상성 판정 (muHtml) — 맞부딪는 순간 한가운데 [우리 깃발] ▶ [적 깃발] · 움직임은 transform·opacity 만, 몇 개 안 되는 칸에만 (폰 그래픽 한도) · 누르기를 막지 않는다 */
.ap .wmu { position: absolute; left: 50%; top: 31%; z-index: 95; display: flex; align-items: center; gap: clamp(4px, 2cqw, 12px); translate: -50% -50%; white-space: nowrap; pointer-events: none; opacity: 0; animation: wmuin var(--mus, 1.2s) ease-out var(--hd) both; }
.ap .wmu::before { content: ''; position: absolute; left: -16%; right: -16%; top: -26%; bottom: -26%; z-index: -2; border-radius: 50%; background: radial-gradient(closest-side, #0b0805d9 40%, #0b080500); } /* 병사들 위에서도 읽히게 — 어두운 받침 (움직이지 않는다) */
@keyframes wmuin { 0% { opacity: 0; scale: .5; } 10% { opacity: 1; scale: 1.18; } 20% { scale: 1; } 82% { opacity: 1; scale: 1; } 100% { opacity: 0; scale: 1.04; } }
.ap .wmu-f { position: relative; display: block; width: clamp(54px, 17cqw, 104px); }
.ap .wmu-f img { display: block; width: 100%; height: auto; filter: drop-shadow(0 4px 6px #000c); }
.ap .wmu.win .wmu-f.us img { filter: drop-shadow(0 0 7px #ffd27a) drop-shadow(0 4px 6px #000c); }
.ap .wmu.lose .wmu-f.foe img { filter: drop-shadow(0 0 7px #ff5a3c) drop-shadow(0 4px 6px #000c); }
.ap .wmu-f.broke { animation: wmushk .5s ease-in-out calc(var(--hd) + .14s) both; }
.ap .wmu-f.broke img { animation: wmudim .4s ease-out calc(var(--hd) + .2s) both; }
@keyframes wmushk { 0%, 100% { translate: 0 0; rotate: 0deg; } 15% { translate: -6px 0; rotate: -8deg; } 35% { translate: 6px 2px; rotate: 7deg; } 55% { translate: -4px 3px; rotate: -4deg; } 75% { translate: 2px 4px; rotate: 3deg; } }
@keyframes wmudim { from { opacity: 1; } to { opacity: .55; } }
.ap .wmu-ck { position: absolute; left: 24%; top: 6%; width: 66%; height: 84%; overflow: visible; filter: drop-shadow(0 0 2px #000); }
.ap .wmu-ck path { fill: none; stroke: #fff4dc; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 260; stroke-dashoffset: 260; animation: wmuck .3s ease-out calc(var(--hd) + .12s) both; }
.ap .wmu.lose .wmu-ck path { stroke: #ffd0c4; }
@keyframes wmuck { to { stroke-dashoffset: 0; } }
.ap .wmu-c { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.ap .wmu-k { display: grid; place-items: center; width: clamp(34px, 10cqw, 56px); height: clamp(34px, 10cqw, 56px); border-radius: 50%; font-size: clamp(22px, 7cqw, 38px); font-weight: 900; line-height: 1; color: #1b1206; background: #ffd27a; box-shadow: 0 0 0 3px #1b1206, 0 0 18px #ffd27a; animation: wmukin .4s cubic-bezier(.3, 1.8, .5, 1) calc(var(--hd) + .1s) both; }
.ap .wmu.lose .wmu-k { color: #fff; background: #d8402c; box-shadow: 0 0 0 3px #2a0806, 0 0 18px #ff5a3c; }
@keyframes wmukin { from { scale: 2.4; opacity: 0; } to { scale: 1; opacity: 1; } }
.ap .wmu-v { font-size: clamp(22px, 7cqw, 40px); line-height: 1; color: #ffe2a0; text-shadow: 0 2px 4px #000, 0 0 10px #ffd27a; }
.ap .wmu.lose .wmu-v { color: #ffb0a0; text-shadow: 0 2px 4px #000, 0 0 10px #ff5a3c; }
.ap .wmu-x { font-style: normal; font-weight: 900; font-size: clamp(20px, 6.5cqw, 36px); line-height: 1; color: #ffe2a0; text-shadow: 0 2px 0 #000, 0 0 10px #ffb84a; animation: wmukin .35s cubic-bezier(.3, 1.8, .5, 1) calc(var(--hd) + .26s) both; }
.ap .wmu.lose .wmu-x { color: #ff9a8a; text-shadow: 0 2px 0 #000, 0 0 10px #ff3a2a; }
.ap .wmu-burst { position: absolute; left: 50%; top: 50%; width: 170%; height: auto; translate: -50% -50%; z-index: -1; opacity: 0; animation: wmubst .8s ease-out var(--hd) both; }
.ap .wmu-red { position: absolute; left: 50%; top: 50%; width: 150%; aspect-ratio: 1; translate: -50% -50%; z-index: -1; border-radius: 50%; background: radial-gradient(circle, #ff3a2aaa 0%, #ff3a2a00 68%); opacity: 0; animation: wmubst .8s ease-out var(--hd) both; }
@keyframes wmubst { 0% { opacity: 0; scale: .3; } 15% { opacity: 1; } 100% { opacity: 0; scale: 1.5; } }
/* 맞섰다 — 작은 회색 = 만 (세모에서 갈린 합이 더 크게 보이게) */
.ap .wmu.even { top: 22%; gap: 4px; animation-name: wmuev; }
@keyframes wmuev { 0% { opacity: 0; } 15% { opacity: .85; } 80% { opacity: .85; } 100% { opacity: 0; } }
.ap .wmu.even .wmu-f { width: clamp(24px, 7.5cqw, 40px); } .ap .wmu.even .wmu-f img { filter: none; opacity: .7; }
.ap .wmu.even .wmu-v { font-size: clamp(16px, 5cqw, 26px); font-weight: 900; color: #b8b0a0; text-shadow: 0 1px 2px #000; }
/* 진 쪽이 다른 무리에서 먹인 것 — 밑에 작게 (우리 것은 초록 · 적 것은 붉게) */
.ap .wmu-also { position: absolute; left: 50%; top: 100%; translate: -50% 4px; display: flex; align-items: center; gap: 3px; padding: 2px 8px 2px 4px; border-radius: 999px; background: #0b0805d9; box-shadow: inset 0 0 0 1.5px #7fd06a; color: #9fe08a; font-size: 13px; animation: wmukin .3s ease-out calc(var(--hd) + .35s) both; }
.ap .wmu-also.foe { box-shadow: inset 0 0 0 1.5px #e0705e; color: #ff9a8a; }
.ap .wmu-also img { width: clamp(20px, 6cqw, 30px); height: auto; }
.ap .wmu.even::before { opacity: .5; }
.ap .wr.fast .wmu { --hd: 0s !important; }
@media (prefers-reduced-motion: reduce) { .ap .wmu-f.broke { animation: none; } }
/* 적 낌새를 이기는 깃발 카드는 초록빛이 숨 쉰다 */
.ap .wcmd.wbxc { position: relative; }
.ap .wcmd.wbxc::before { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px #8fe07a, inset 0 0 10px #8fe07a99; pointer-events: none; animation: wbxglow .8s ease-in-out infinite alternate; }
@keyframes wbxglow { from { opacity: .3; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .ap .wcmd.wbxc::before { animation: none; } }
.ap .wside-loss { position: absolute; z-index: 96; top: 52%; display: grid; justify-items: center; gap: 3px; color: #fff0ca; font-size: clamp(27px, 5.9cqw, 43px); line-height: 1; white-space: nowrap; translate: -50% 0; opacity: 0; pointer-events: none; --rise: clamp(34px, 8.5cqw, 57px); --kick: 1.28; animation: wloss-arc .57s linear var(--bd) both; }
.ap .wside-loss b { font-weight: 950; font-variant-numeric: tabular-nums; -webkit-text-stroke: 4px #36150c; paint-order: stroke fill; text-shadow: 0 3px 1px #291309, 0 1px 7px #180c06; }
.ap .wside-loss.us { left: 32%; --away: -11cqw; }
.ap .wside-loss.foe { left: 68%; --away: 11cqw; }
.ap .wside-loss.critical { color: #ffdf75; font-size: clamp(31px, 6.6cqw, 51px); --rise: clamp(42px, 9.8cqw, 66px); --kick: 1.43; animation-duration: .78s; }
.ap .wside-loss.critical b { text-shadow: 0 3px 1px #491a0b, 0 0 14px #ff9f4c; }
.ap .wside-loss small { padding: 3px 7px; border: 1px solid #f4ba6c; border-radius: 5px; background: #58291a; color: #fff0c3; font-size: clamp(12px, 2.8cqw, 16px); font-weight: 850; }
/* Horizontal drift slows as the vertical arc reaches its apex and falls. */
@keyframes wloss-arc {
  0% { opacity: 0; transform: translate(0, 0) scale(.45); }
  8% { opacity: 1; transform: translate(calc(var(--away) * .22), calc(var(--rise) * -.36)) scale(var(--kick)); }
  20% { transform: translate(calc(var(--away) * .49), calc(var(--rise) * -.76)) scale(1.05); }
  36% { transform: translate(calc(var(--away) * .74), calc(var(--rise) * -1.04)) scale(.98); }
  46% { transform: translate(calc(var(--away) * .84), calc(var(--rise) * -1.07)) scale(1); }
  60% { transform: translate(calc(var(--away) * .94), calc(var(--rise) * -.92)) scale(1); }
  76% { opacity: 1; transform: translate(calc(var(--away) * .99), calc(var(--rise) * -.49)) scale(.99); }
  88% { opacity: .55; transform: translate(var(--away), calc(var(--rise) * .025)) scale(.95); }
  100% { opacity: 0; transform: translate(var(--away), calc(var(--rise) * .7)) scale(.9); }
}
.ap .wflag-morale { position: absolute; z-index: 97; top: clamp(29px, 17%, 47px); display: flex; align-items: center; gap: 4px; padding: 4px 7px; border: 1px solid #d88967; border-radius: 6px; background: #301b17f5; color: #ffd8b3; line-height: 1; white-space: nowrap; pointer-events: none; opacity: 0; animation: wflag-delta .85s linear var(--bd) both; }
.ap .wflag-morale.us { left: 6%; }
.ap .wflag-morale.foe { right: 6%; }
.ap .wflag-morale.foe img { order: 1; }
.ap .wflag-morale img { width: clamp(16px, 4cqw, 22px); height: auto; }
.ap .wflag-morale small { color: #fff4e4; font-size: clamp(11px, 2.7cqw, 14px); font-weight: 750; }
.ap .wflag-morale b { font-size: clamp(17px, 4.2cqw, 23px); font-weight: 900; }
.ap .wflag-morale.up { border-color: #8ab8d3; background: #182b36f5; color: #c7efff; }
@keyframes wflag-delta { 0% { opacity: 0; transform: translateY(3px); } 9%, 82% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce) {
  .ap .wfield .wside-loss, .ap .wfield .wflag-morale { animation: wloss-static 1.1s linear var(--bd) both !important; }
}
@keyframes wloss-static { 0%, 85% { opacity: 1; } 100% { opacity: 0; } }
.ap .wf-who { position: absolute; bottom: 6px; z-index: 80; font-size: clamp(10px, 2.6cqw, 13px); font-weight: 800; padding: 2px 8px; border-radius: 9px; background: #3f8f3acc; color: #eaffe0; text-shadow: 0 1px 2px #000; pointer-events: none; max-width: 42%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap .wf-who.us { left: 6px; } .ap .wf-who.foe { right: 6px; background: #8a3a2acc; color: #ffe3dc; }
/* 머릿수 잣대 (troops.ts) — 큰 병사 · 깃발 병사 · 무리마다 정확한 수 · 맨 아래 가운데 잣대 */
.ap .wf2s .tk.tb2 { filter: drop-shadow(0 0 3px #ffd27a) drop-shadow(0 2px 2px #000c); }
.ap .wf2s .tkban { position: absolute; left: 4%; top: -16%; width: 34%; height: 40%; border-left: 2px solid #3a2a18; pointer-events: none; }
.ap .wf2s .tkban img { position: absolute; left: 0; top: 0; width: 100%; height: 70%; object-fit: contain; }
.ap .wf2s .tk.tkd .tkban { display: none; }
.ap .wgct { position: absolute; z-index: 95; translate: -50% 0; display: inline-flex; align-items: center; gap: 2px; padding: 1px 6px 1px 2px; border-radius: 9px; background: #000b; border: 1px solid #7cc4ff99; color: #fff; font-size: clamp(10px, 2.8cqw, 13px); font-weight: 800; line-height: 1.2; white-space: nowrap; pointer-events: none; text-shadow: 0 1px 2px #000; }
.ap .wgct img { height: 1.5em; width: auto; }
.ap .wf2s.foe .wgct { transform: scaleX(-1); border-color: #ff6a5a99; }
.ap .wgct.none { opacity: .4; }
.ap .wleg { position: absolute; left: 50%; bottom: 5px; translate: -50% 0; z-index: 80; display: flex; align-items: flex-end; gap: 6px; padding: 1px 7px; border-radius: 9px; background: #000a; color: #f6ead2; font-size: clamp(10px, 2.6cqw, 12px); font-weight: 800; line-height: 1; white-space: nowrap; pointer-events: none; }
.ap .wleg span { display: inline-flex; align-items: flex-end; gap: 1px; } .ap .wleg img { width: auto; height: 12px; } .ap .wleg .l1 img { height: 19px; } .ap .wleg .l2 img { height: 25px; }
@media (max-width: 520px) { .ap .wf-who { max-width: 33%; } }
/* 동작 그림 — 8컷 띠를 칸씩 넘긴다 (steps). 바깥(.tk)은 자리·밀기, 안(.spf)은 컷 */
/* 새 20컷 띠(v2) — 칸이 넓다(창이 다 뻗어도 들어가게). 말의 자리·크기는 옛 비 그대로 두고 안의 그림만 --r 배 넓혀 가운데에 (형 10-29) */
.ap .wf2s .tk.wsp.v2 .spf { inset: 0 auto 0 50%; width: calc(var(--r, 1) * 100%); transform: translateX(-50%); --nf: 20; --i0: 0%; --i1: 21.0526%; --w0: 21.0526%; --w1: 63.1579%; --a0: 63.1579%; --a1: 94.7368%; --al: 89.4737%; --fl: 94.7368%; --spidlen: 4; --spwalkn: 8; --spatkn: 6; --spidles: 1.6; --spwalks: 1.4; --spatks: 2.2; --spdraws: 1.2; }
.ap .wf2s .tk.wsp { width: auto; aspect-ratio: var(--ar, 1); } .ap .wf2s .tk.wsp.k-horse, .ap .wf2s .tk.wsp.k-boat { height: clamp(38px, 10cqw, 68px); } /* 말 탄 이는 걷는 이보다 크다 */
.ap .wf2s .tk.wsp .spf { position: absolute; inset: 0; background: 0 0 / calc(var(--nf, 8) * 100%) 100% no-repeat; animation: spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--j) * -.27s) - var(--k, .5) * 1.6s) infinite; }
/* 컷의 자리와 수는 변수로 — 옛 8컷 띠(anim)와 새 20컷 띠(anim2 · tools/anim-pack.py)를 같은 규칙이 돌린다. 옛 띠는 두 컷씩 번갈아 (예전과 같다) */
@keyframes spidle { from { background-position-x: var(--i0, 0%); } to { background-position-x: var(--i1, 28.5714%); } }
@keyframes spwalk { from { background-position-x: var(--w0, 28.5714%); } to { background-position-x: var(--w1, 57.1429%); } }
@keyframes spatk { from { background-position-x: var(--a0, 57.1429%); } to { background-position-x: var(--a1, 85.7143%); } }
.ap .wfield.enter .tk.wsp .spf { animation: spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--j) * -.27s) - var(--k, .5) * 1.6s) infinite, spwalk calc(var(--entry-time) / 3) steps(var(--spwalkn, 2)) var(--entry-delay) 3; }
.ap .wfield.play .wf2s .tk.wsp.r0:not(.tkd) .spf { animation: spwalk calc(.42s * var(--spwalks, 1)) steps(var(--spwalkn, 2)) var(--fa, 0s) 2, spatk calc(calc(.3s + var(--j, 0) * .03s) * var(--spatks, 1)) steps(var(--spatkn, 2)) calc(var(--hd) - .32s + var(--j, 0) * .05s) 7, spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--hd) + 1.9s) - var(--k, .5) * 1.6s) infinite; }
.ap .wfield.play .wf2s:not(:has(.tk.r0:not(.tkd))) .tk.wsp.r1:not(.tkd) .spf { animation: spwalk calc(.42s * var(--spwalks, 1)) steps(var(--spwalkn, 2)) var(--fa, 0s) 2, spatk calc(calc(.3s + var(--j, 0) * .03s) * var(--spatks, 1)) steps(var(--spatkn, 2)) calc(var(--hd) - .32s + var(--j, 0) * .05s) 7, spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--hd) + 1.9s) - var(--k, .5) * 1.6s) infinite; }
.ap .wfield.play .wf2s:not(:has(.tk:is(.r0, .r1):not(.tkd))) .tk.wsp.r2:not(.tkd) .spf { animation: spwalk calc(.42s * var(--spwalks, 1)) steps(var(--spwalkn, 2)) var(--fa, 0s) 2, spatk calc(calc(.3s + var(--j, 0) * .03s) * var(--spatks, 1)) steps(var(--spatkn, 2)) calc(var(--hd) - .32s + var(--j, 0) * .05s) 7, spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--hd) + 1.9s) - var(--k, .5) * 1.6s) infinite; }
/* 도끼병 — 받은 그림엔 내려치는 컷이 없다(든 컷 4 뿐) → 든 컷을 앞으로 휘둘러 기울인다 (컷 5는 들기의 다른 자세라 안 쓴다) */
.ap .wfield.play .wf2s .tk.wsp.k-axe:not(.v2).r0:not(.tkd) .spf { animation: spwalk calc(.42s * var(--spwalks, 1)) steps(var(--spwalkn, 2)) var(--fa, 0s) 2, spaxe .3s steps(1) calc(var(--hd) - .32s + var(--j, 0) * .05s) 7, spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--hd) + 1.9s) - var(--k, .5) * 1.6s) infinite; }
.ap .wfield.play .wf2s .tk.wsp.k-axe:not(.v2).r0:not(.tkd) .spf { transform-origin: 40% 90%; }
@keyframes spaxe { 0% { background-position-x: var(--a0, 57.1429%); rotate: -8deg; } 50% { background-position-x: var(--a0, 57.1429%); rotate: 28deg; } }
/* 궁수 — 쏘는 박자에 시위를 당겼다(4) 놓는다(5) · 기병 — 제 박자에 달린다(걷기 컷) */
.ap .wfield.play .wf2s[data-b] .tk.wsp.r1:not(.tkd) .spf { animation: spdraw calc(.75s * var(--spdraws, 1)) steps(var(--spatkn, 2), jump-none) calc(var(--sa) - .45s) forwards, spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--sa) + .5s) - var(--k, .5) * 1.6s) infinite; }
@keyframes spdraw { from { background-position-x: var(--a0, 57.1429%); } to { background-position-x: var(--al, 71.4286%); } }
/* 진·길이 바뀌어 자리를 옮기는 .5초(.wf2s.mv · left 전환과 같은 길이) — 걷기 칸을 돌린다 (형 11-11: 선 채로 날아다님) */
.ap .wf2s.mv .tk.wsp .spf { animation: spwalk .5s steps(var(--spwalkn, 2)) 0s 1 !important; }
.ap .wf2s.mv .wgen.gsp .gspf { animation: spwalk .5s steps(8) 0s 1 !important; }
/* 새 띠(v2)의 궁수·쇠뇌 — 1.1초 박자로 살 메기기(12) 당기기(13) 다 당겨 겨누기(14 · 오래) 놓기(15 · 살이 떠난다) 내리기(16·17).
   놓는 때(박자의 반)가 화살(.wf-arw)이 뜨는 때와 같고, 화살과 같은 수(--bn)만큼 되풀이한다 (형 10-30: "창병은 공격 모션이 보이는데 다른 유닛들은 공격하는 게 안 보임" — 전엔 여섯 컷을 고르게 넘겨 다 당긴 컷이 0.2초씩만 비쳤고 화살은 한 번만 났다).
   끝없는 움직임이 아니라 횟수가 있어 저사양에서도 멈추지 않는다 (quality.ts 는 infinite 만 멈춘다) */
.ap .wfield.play .wf2s[data-b] .tk.wsp.v2.r1.tku .spf { animation: spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--j) * -.27s) - var(--k, .5) * 1.6s) infinite, spshot 1.1s steps(1) calc(var(--sa) - .55s + var(--j, 0) * .07s) var(--bn, 2); }
.ap .wfield.play .wf2s[data-b] .tk.wsp.v2.r1.tkf .spf { animation: spshot 1.1s steps(1) calc(var(--sa) - .55s + var(--j, 0) * .07s) var(--bn, 2), spdie .01s steps(1) calc(var(--hd) + .2s + var(--j) * .05s) forwards; }
@keyframes spshot { 0% { background-position-x: 63.1579%; } 8% { background-position-x: 68.4211%; } 20% { background-position-x: 73.6842%; } 50% { background-position-x: 78.9474%; } 64% { background-position-x: 84.2105%; } 78%, 100% { background-position-x: 89.4737%; } }
.ap .wfield.play .wf2s[data-h] .tk.wsp.r2:not(.tkd) .spf { animation: spwalk calc(.3s * var(--spwalks, 1)) steps(var(--spwalkn, 2)) var(--ha, 0s) 3, spatk calc(.26s * var(--spatks, 1)) steps(var(--spatkn, 2)) calc(var(--hd) - .3s) 2, spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--hd) + .5s) - var(--k, .5) * 1.6s) infinite; }
/* 새 띠(v2)의 기병 — 제 박자에 달려(걷기 컷이 달리기) 들이친 뒤, 거의 닿은 때(--ha + .45초 · 맞부딪기 1.2초 앞 중 늦은 때)부터 창을 들어(14) 내지르고(15·16 · 오래) 거두기를 다섯 번 (형 10-30 · 전엔 맞부딪는 0.3초 앞에 0.57초짜리 한 번 두 번) */
.ap .wfield.play .wf2s[data-h] .tk.wsp.v2.r2.tku .spf { animation: spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--j) * -.27s) - var(--k, .5) * 1.6s) infinite, spwalk calc(.3s * var(--spwalks, 1)) steps(var(--spwalkn, 2)) var(--ha, 0s) 3, spthr calc(.7s + var(--j, 0) * .05s) steps(1) max(calc(var(--ha, 0s) + .45s), calc(var(--hd) - 1.2s + var(--j, 0) * .09s)) 5; }
.ap .wfield.play .wf2s[data-h] .tk.wsp.v2.r2.tkf .spf { animation: spwalk calc(.3s * var(--spwalks, 1)) steps(var(--spwalkn, 2)) var(--ha, 0s) 3, spthr calc(.7s + var(--j, 0) * .05s) steps(1) max(calc(var(--ha, 0s) + .45s), calc(var(--hd) - 1.2s + var(--j, 0) * .09s)) 5, spdie .01s steps(1) calc(var(--hd) + .2s + var(--j) * .05s) forwards; }
/* 무리가 작아 제 깃발이 없는 활·말(가까운 무리에 섞여 싸운다)도 맞부딪기 1.2초 앞부터 쏘고 찌른다 — 전엔 끝까지 서 있기만 했다 (형 10-30) */
.ap .wfield.play .wf2s:not([data-b]) .tk.wsp.v2.r1.tku .spf { animation: spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--j) * -.27s) - var(--k, .5) * 1.6s) infinite, spshot 1.1s steps(1) calc(var(--hd) - 1.2s + var(--j, 0) * .07s) 3; }
.ap .wfield.play .wf2s:not([data-h]) .tk.wsp.v2.r2.tku .spf { animation: spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--j) * -.27s) - var(--k, .5) * 1.6s) infinite, spthr calc(.7s + var(--j, 0) * .05s) steps(1) calc(var(--hd) - 1.2s + var(--j, 0) * .09s) 5; }
/* 쓰러짐 — 굴리지 않고 쓰러진 컷으로 땅에 남는다 */
.ap .wf2s .tk.wsp.tkd { rotate: 0deg; opacity: .62; filter: grayscale(.5) brightness(.8) drop-shadow(0 2px 2px #000c); }
.ap .wf2s .tk.wsp.tkd .spf { animation: none; background-position-x: 100%; }
.ap .wfield:not(.paired-strikes) .tk.wsp.tkf { animation: wtkfallsp .5s ease-out calc(var(--hd) + .2s + var(--j) * .05s) forwards !important; }
.ap .wfield .tk.wsp.tkf .spf { animation: spidle calc(1.5s * var(--spidles, 1)) steps(var(--spidlen, 2)) infinite, spdie .01s steps(1) calc(var(--hd) + .2s + var(--j) * .05s) forwards; }
/* 앞줄에서 쓰러지는 이는 엉긴 한가운데로 달려들었다가 거기서 쓰러진다 · 다음 합에도 그 자리에 누워 있다 */
.ap .wfield:not(.paired-strikes) .tk.r0.tkf { animation: wtkfallm 1.5s ease-out calc(var(--hd) - .45s) forwards !important; }
@keyframes wtkfallm { 0% { translate: 2cqw 0; } 30% { translate: calc(8.5cqw + var(--j, 0) * .3cqw) 0; } 55% { translate: calc(8.5cqw + var(--j, 0) * .3cqw) 0; opacity: 1; filter: none; } 100% { translate: calc(7cqw + var(--j, 0) * .3cqw) .6cqw; opacity: .62; filter: grayscale(.5) brightness(.8); } }
.ap .wfield .tk.wsp.r0.tkf .spf { animation: spatk calc(.3s * var(--spatks, 1)) steps(var(--spatkn, 2)) calc(var(--hd) - .2s) 2, spdie .01s steps(1) calc(var(--hd) + .4s + var(--j) * .08s) forwards; }
.ap .wf2s .tk.r0.tkd { translate: calc(7cqw + var(--j, 0) * .3cqw) .6cqw; }
@keyframes spdie { to { background-position-x: var(--dd, 100%); } }
/* 맞음 — 맞부딪는 순간 살아남은 앞줄 몇이 뒤로 휘청(맞음 컷 6) 했다가 다시 싸운다 */
.ap .wfield.play .wf2s .tk.wsp.r0.tku:nth-child(3n) .spf { animation: spflinch .38s steps(1) calc(var(--hd) + .02s + var(--j, 0) * .04s) 1, spatk calc(calc(.3s + var(--j, 0) * .03s) * var(--spatks, 1)) steps(var(--spatkn, 2)) calc(var(--hd) + .42s) 5, spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--hd) + 1.9s) - var(--k, .5) * 1.6s) infinite; }
@keyframes spflinch { 0%, 100% { background-position-x: var(--fl, 85.7143%); } }
/* 새 띠(v2)의 앞줄 — 맞부딪기 1.2초 앞부터 합이 끝날 때까지 창을 거듭 찌르고, 다 뻗은 컷(15·16)에 오래 머문다 (형 10-29: "창병이 창을 찌르는 모션을 본 적이 없다").
   전엔 맞부딪는 순간 0.6초쯤 한 번 찔렀고, 그때는 흙먼지·당겨 보기에 가렸다. 컷 자리는 20컷 띠 기준(n/19) */
/* 앞줄 병종마다 제 칼질 (--atk) — 창·방패칼·긴창·갈고리창·배의 창은 뻗는 컷(15·16)에 · 도끼는 치켜든 컷(13)과 내려찍는 컷(14)에 머문다 (형 10-30: "다른 유닛들은 공격하는 게 안 보임").
   다섯 번이면 합이 끝날 때(맡긴 싸움은 맞부딪힘 + 1.65초)를 넘는다 · 횟수가 있어야 저사양에서도 돈다(끝없으면 quality.ts 가 멈춘다) · 끝나면 맨 앞의 서기로 */
.ap .wf2s .tk.wsp.v2.k-axe { --atk: spchop; }
.ap .wfield.play .wf2s .tk.wsp.v2.r0.tku .spf { animation: spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--j) * -.27s) - var(--k, .5) * 1.6s) infinite, spwalk calc(.42s * var(--spwalks, 1)) steps(var(--spwalkn, 2)) var(--fa, 0s) 2, var(--atk, spthr) calc(.72s + var(--j, 0) * .04s) steps(1) calc(var(--hd) - 1.2s + var(--j, 0) * .09s) 5; }
.ap .wfield.play .wf2s .tk.wsp.v2.r0.tku:nth-child(3n) .spf { animation: spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--j) * -.27s) - var(--k, .5) * 1.6s) infinite, spwalk calc(.42s * var(--spwalks, 1)) steps(var(--spwalkn, 2)) var(--fa, 0s) 2, var(--atk, spthr) calc(.72s + var(--j, 0) * .04s) steps(1) calc(var(--hd) - 1.2s + var(--j, 0) * .09s) 5, spflinch .38s steps(1) calc(var(--hd) + .02s + var(--j, 0) * .04s) 1; }
.ap .wfield.play .wf2s .tk.wsp.v2.r0.tkf .spf { animation: var(--atk, spthr) calc(.72s + var(--j, 0) * .04s) steps(1) calc(var(--hd) - 1.2s + var(--j, 0) * .09s) 5, spdie .01s steps(1) calc(var(--hd) + .4s + var(--j) * .08s) forwards; }
@keyframes spthr { 0% { background-position-x: 63.1579%; } 12% { background-position-x: 68.4211%; } 24% { background-position-x: 73.6842%; } 36% { background-position-x: 78.9474%; } 52% { background-position-x: 84.2105%; } 72% { background-position-x: 89.4737%; } 86%, 100% { background-position-x: 94.7368%; } }
@keyframes spchop { 0% { background-position-x: 63.1579%; } 6% { background-position-x: 68.4211%; } 36% { background-position-x: 73.6842%; } 58% { background-position-x: 78.9474%; } 72% { background-position-x: 84.2105%; } 86%, 100% { background-position-x: 89.4737%; } }
/* Paired strikes own the walk, contact and return. Reinforcements are still marching in. */
.ap .wfield.play.paired-strikes .wf2s .strike-actor { animation: none !important; transition: none; }
.ap .wfield.play.paired-strikes .wf2s .strike-actor :is(.spf, .gspf) { animation: none !important; }
.ap .wfield.play.fin.win-us.paired-strikes .wf2s.foe .tk.wsp.tku .spf,
.ap .wfield.play.fin.win-foe.paired-strikes .wf2s.us .tk.wsp.tku .spf {
  animation: var(--flee-walk) !important;
}
.ap .wfield.play.paired-strikes .tk.wsp.tkf::after { animation: none; opacity: 0; }
.ap .wfield.play.paired-strikes .wf2s .strike-down :is(.spf, .gspf) { animation: none !important; background-position-x: 100%; }
.ap .wstrike-layer { position: absolute; inset: 0; z-index: 77; pointer-events: none; }
.ap .wstrike-arrow { position: absolute; left: 0; top: 0; width: clamp(14px, 4.2cqw, 28px); transform-origin: right center; filter: drop-shadow(0 1px 1px #000a); }
.ap .wstrike-fx { position: absolute; width: clamp(23px, 7cqw, 43px); height: auto; translate: -50% -50%; opacity: 0; }
.ap .wstrike-fx.trail { width: clamp(33px, 10cqw, 68px); }
.ap .wstrike-fx.thrust { width: clamp(29px, 9cqw, 58px); }
.ap .wstrike-fx.heavy-hit { width: clamp(29px, 8.4cqw, 53px); }
.ap .wstrike-fx.arrow-hit { width: clamp(18px, 5.2cqw, 33px); }
.ap .wstrike-fx.blocked-hit { width: clamp(13px, 3.9cqw, 25px); filter: grayscale(.75); }
.ap .wstrike-fx.shards { width: clamp(26px, 7.6cqw, 48px); }
.ap .wstrike-fx.strike-dust { width: clamp(30px, 9cqw, 54px); }
/* 건너뛰면(아무 데나 누름) 끝 판의 이긴 쪽은 칼질을 멈추고 선다 · 진 쪽은 위의 달아나기(!important) */
.ap .wr.fast .wfield.play .wf2s .tk.wsp.v2.tku:not(.tkd) .spf { animation: spidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--spidles, 1)) steps(var(--spidlen, 2)) calc(calc(var(--j) * -.27s) - var(--k, .5) * 1.6s) infinite; }
/* 쓰러질 때 흙먼지 — 병사마다 발치에서 한 번 */
.ap .wf2s .tk.wsp.tkf::after { content: ''; position: absolute; left: 50%; bottom: 0; width: 140%; height: 45%; translate: -50% 20%; border-radius: 50%; pointer-events: none;
  background: radial-gradient(ellipse, #c8a87acc 0, #a0805a88 40%, #0000 70%); opacity: 0; animation: wpuff .9s ease-out calc(var(--hd) + .55s + var(--j, 0) * .06s) both; }
@keyframes wpuff { 0% { opacity: 0; scale: .3; } 25% { opacity: .9; } 100% { opacity: 0; scale: 1.4; translate: -50% 0; } }
/* 카메라 — 맞부딪는 순간 전장을 크게 당겨 보였다가 돌아온다 (판 크기는 그대로, 안만) */
.ap .wfield.play .wf2s, .ap .wfield.play .wf-ground { transform-origin: 50% 62%; animation: wpushin 1.5s cubic-bezier(.2, .7, .3, 1) calc(var(--hd) - .25s) both; }
@keyframes wpushin { 0% { scale: 1; } 28% { scale: 1.16; } 60% { scale: 1.12; } 100% { scale: 1; } }
/* 흔들리는 적 */
.ap .wf2s.waver .tk.tku { animation: wwaver .32s ease-in-out calc(var(--j, 0) * -.07s) infinite alternate; filter: drop-shadow(0 0 2px #ff6a5a) drop-shadow(0 2px 2px #000c) sepia(.25) saturate(.7) brightness(.85); }
@keyframes wwaver { from { translate: -1.5px 0; } to { translate: 1.5px .5px; } }
.ap .wf2s.waver .wpole { rotate: 18deg; transform-origin: 50% 100%; transition: rotate .6s; }
@media (prefers-reduced-motion: reduce) { .ap .wfield.play .wf2s, .ap .wfield.play .wf-ground, .ap .wf2s.waver .tk.tku { animation: none !important; } }
@keyframes wtkfallsp { 0% { translate: 3cqw 0; } 100% { translate: 1cqw 0; opacity: .62; filter: grayscale(.5) brightness(.8); } }
@media (prefers-reduced-motion: reduce) { .ap .wfield *, .ap .wfield .tk.tkf, .ap .wfield.play { animation: none !important; transition: none !important; } }
.ap .wbar i { position: relative; display: block; height: 100%; border-radius: 6px; overflow: hidden; }
/* 흐르는 빗금 — 45도 네모 칸이라야 칸 이음매가 안 보인다 · 115도 빗금을 34px 칸에 넣었더니 이음매마다 끊겨 바코드처럼 보였다 (형 10-29) */
/* 빗금·빛줄은 transform 으로만 민다 — background-position·left 를 움직이면 막대 넷이 틀마다 다시 그려져 폰에서 버벅였다 (형 11-03) */
.ap .wbar i::before { content: ''; position: absolute; top: 0; bottom: 0; left: -18px; right: 0; background-image: linear-gradient(135deg, #ffffff2a 25%, #ffffff00 25% 50%, #ffffff2a 50% 75%, #ffffff00 75%); background-size: 18px 18px; animation: wbarflow 1.1s linear infinite; }
.ap .wbar i::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 45%; translate: -100% 0; background: linear-gradient(90deg, #fff0, #ffffffb0, #fff0); animation: wbarshine 3s ease-in-out infinite; }
.ap .ws.foe .wbar i::after { animation-delay: 1.4s; }
@keyframes wbarflow { to { translate: 18px 0; } }
@keyframes wbarshine { 0% { translate: -100% 0; } 55%, 100% { translate: 245% 0; } }
@media (prefers-reduced-motion: reduce) { .ap .wbar i::before, .ap .wbar i::after, .ap .ws.us .wpf > i, .ap .wbg, .ap .wember { animation: none !important; } }
.ap .wbar i.wgr { animation-duration: .4s; animation-timing-function: ease-out; animation-delay: var(--bd, 2.4s); animation-fill-mode: both; }
.ap .wbar i.wgr.cut { animation-duration: .04s; animation-timing-function: linear; }
/* 잃은 토막 — 맞는 순간 나타나 터지고(희게·노랗게·붉게 · 위아래로 부풀었다) 줄어든다 · 단색만 (호환 모드에서도 그대로) */
.ap .wbar .wchunk { position: absolute; top: 0; bottom: 0; width: var(--cw); z-index: 1; pointer-events: none; border-radius: 0 6px 6px 0; background-color: #c8160c; transform-origin: left center;
  animation: wchunkon 0s linear var(--bd, 2.4s) both, wchunkfx var(--cf, .24s) linear var(--bd, 2.4s) both, wchunkcut var(--cs, .6s) cubic-bezier(.1, .8, .25, 1) calc(var(--bd, 2.4s) + var(--cf, .24s) * .5) both; }
@keyframes wchunkon { from { visibility: hidden; } to { visibility: visible; } }
@keyframes wchunkfx {
  0% { background-color: #ffffff; box-shadow: 0 0 16px 5px #ffffff; transform: scaleY(2); }
  30% { background-color: #ffe14a; box-shadow: 0 0 14px 4px #ffc800; transform: scaleY(1.55); }
  65% { background-color: #ff2a14; box-shadow: 0 0 12px 3px #ff2a14; transform: scaleY(1.15); }
  100% { background-color: #c8160c; box-shadow: 0 0 6px 1px #ff2a1499; transform: none; } }
@keyframes wchunkcut { from { width: var(--cw); } to { width: 0; } }
@media (prefers-reduced-motion: reduce) { .ap .wbar .wchunk { animation: wchunkon 0s linear var(--bd, 2.4s) both, wchunkcut .3s linear var(--bd, 2.4s) both; } }
/* 세는 숫자 — 막대와 같은 --bd 에 옛 값→새 값 (cnt) · 정수 셈이라 @property 로 한 칸씩 · 못 알아듣는 브라우저는 반에서 한 번에 바뀐다 */
.ap .wcnt { display: inline-block; font-style: normal; counter-reset: wc var(--wc); transform-origin: 100% 60%; animation-duration: var(--cd, .72s), .9s; animation-timing-function: cubic-bezier(.1, .8, .25, 1), ease-out; animation-delay: var(--bd, 2.4s); animation-fill-mode: both, none; } /* 튀는 붉은 빛(wnhit·wnup)은 바뀌는 그때만 — both 로 두면 기다리는 2.4초 내내 커다란 붉은 숫자가 「명」을 덮었다 · 오른쪽을 축으로 커져 「명」을 안 덮는다 */
.ap .wcnt::before { content: counter(wc); }
.ap .wbar.men i { background: linear-gradient(90deg, #2f7a2a, #6fc05a 60%, #b6f09a); box-shadow: 0 0 10px #6fc05a99; }
.ap .ws.foe .wbar.men i { background: linear-gradient(90deg, #f0a088, #d0583c 40%, #7a2618); box-shadow: 0 0 10px #d0583c99; }
/* 호궤 미리 보기 — 오를 몫이 깜박인다 (깃발에 올리거나 · 누르고 있거나 · 골라 두면) */
.ap .wbar u.wfpv { position: absolute; top: 0; bottom: 0; display: none; border-radius: 0 6px 6px 0; background: linear-gradient(90deg, #fff2c0, #9be07a); box-shadow: 0 0 10px #c8f09a; }
.ap .wr:has(.wcmd.feast:hover) .wbar u.wfpv, .ap .wr:has(.wcmd.feast:active) .wbar u.wfpv, .ap .wr:has(.wcmd.feast.on) .wbar u.wfpv { display: block; animation: wfpv .7s ease-in-out infinite alternate; }
@keyframes wfpv { from { opacity: .25; } to { opacity: 1; } }
.ap .wcmd .wfcost { display: inline-block; margin: 1px 0; padding: 0 6px; border-radius: 8px; background: #3a2a10; border: 1px solid #c9a45a; color: #f6d27a; font-size: 11.5px; font-style: normal; }
.ap .wbar.mor { height: 8px; } .ap .wbar.mor i { background: linear-gradient(90deg, #a87a2a, #f6d27a 70%, #fff2c0); box-shadow: 0 0 8px #f6d27a88; }
.ap .ws .wn { font-size: 12px; color: var(--ink); }
/* 명·사기 수 — 막대에 닿지 않게 띄우고(위 막대의 해골도 비켜), 어떤 싸움터 그림 위에서도 읽히게 진하게 · 어두운 받침 (형 10-26: "바랑 살짝 겹쳐 · 잘 안보이니 진하게") */
.ap .ws .wbar { margin-top: 15px; }
.ap .ws .wn { margin-top: 4px; padding: 1px 8px; border-radius: 8px; background: #0b0a08c4; box-shadow: 0 0 0 1px #6a523666; color: #fff6e0; font-weight: 800; line-height: 1.3; text-shadow: 0 1px 2px #000, 0 0 4px #000; }
.ap .ws .wn s, .ap .ws .wn u { color: inherit; }
.ap .wintro { margin: 12px 0 6px; padding: 8px 10px; border-radius: 10px; background: #1e160fe6; font-size: 14.5px; }
.ap .wlog { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
.ap .wrd, .ap .wnext, .ap .wend { scroll-margin-top: var(--wtoph, 170px); }
/* 합 기록 · 다음 합 · 결과 · 들머리 — 같은 청동 테 (형 10-23: "밋밋한 CSS UI 찾아서 개선") */
.ap.ap :is(.wrd, .wnext, .wend, .wintro) { border: 11px solid transparent; border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 11px stretch; border-radius: 0; background-clip: padding-box; }
.ap.ap .wrd.crit { filter: drop-shadow(0 0 5px #d9b36a99); box-shadow: none; }
.ap .wrd { padding: 8px 10px; border-radius: 12px; background: #201a16e6; border: 1px solid #4d3b26; }
.ap .wrd.crit { border-color: #d9b36a; box-shadow: 0 0 0 1px #d9b36a55 inset; }
.ap .wrn { font-size: 12px; color: var(--mute); margin-bottom: 4px; }
.ap .wrh .whelp { position: absolute; right: 0; top: 0; width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid #a0802a; background: #2a2016; color: #ffd27a; font-weight: 900; font-size: 16px; cursor: pointer; flex: none; }
.ap .wr.whelpon .whelp { background: #ffd27a; color: #1b1408; box-shadow: 0 0 10px #ffd27a88; }
.ap .wr:not(.whelpon) .wfhint, .ap .wr:not(.whelpon) .wgby, .ap .wr:not(.whelpon) .wnext .wintel, .ap .wr:not(.whelpon) .wnext .wcmd .wct > small, .ap .wr:not(.whelpon) .wst > p { display: none; }
.ap .wr:not(.whelpon) .wst:not(:has(.wact)):not(:has(> :not(p))) { display: none; }
.ap .wcmds { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; }
.ap .wc { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3px; padding: 3px 6px; border-radius: 12px; background: #2a1f16; flex: 1; min-width: 0; }
.ap .wc.foe { background: #2d1f1d; }
.ap .wc .wck { font-style: normal; font-size: 11px; font-weight: 800; padding: 1px 6px; border-radius: 8px; background: #3f8f3a; color: #eaffe0; margin-right: 2px; } .ap .wc.foe .wck { background: #8a3a2a; color: #ffe3dc; }
.ap .wfl { display: inline-flex; align-items: center; gap: 2px; font-size: 12.5px; white-space: nowrap; padding: 0 3px; }
.ap .wfl img { width: 22px; height: 22px; object-fit: contain; }
.ap .wcmds > i { font-style: normal; color: #c8402a; }
.ap .wst { margin: 6px 0 2px; }
.ap .wacts { display: flex; flex-direction: column; gap: 4px; margin: 2px 0 6px; }
/* 우리 원군이 처음 닿는 합 — 화면을 가로지르는 기병 (draw · 형 11-03: 로한의 기병대 오마주) · 넓은 칸은 opacity 만, 움직이는 건 빛띠 하나 (폰 그래픽 한도) · 해 동그라미·햇살 없음 */
.ap .wrlc { position: fixed; inset: 0; z-index: 97; display: grid; place-items: center; overflow: hidden; background: #000a; cursor: pointer; animation: wrlcout .45s ease-in 2.1s forwards; }
@keyframes wrlcout { to { opacity: 0; visibility: hidden; } }
.ap .wrlc-img, .ap .wrlc-sweep { position: absolute; top: 50%; height: min(56vh, 70vw); translate: 0 -50%; }
.ap .wrlc-img { left: 0; right: 0; background: center 40% / cover no-repeat; box-shadow: 0 0 0 2px #e0bd78, 0 14px 40px #000; opacity: 0; animation: wrlcin .35s ease-out forwards; }
@keyframes wrlcin { to { opacity: 1; } }
.ap .wrlc-sweep { left: 0; width: 34%; background: linear-gradient(90deg, #fff0, #fff2cc99 50%, #fff0); transform: translateX(-110%); animation: wrlcsweep 1.2s ease-in-out .2s forwards; pointer-events: none; }
@keyframes wrlcsweep { to { transform: translateX(320%); } }
.ap .wrlc-t { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; animation: wrlcslam .5s cubic-bezier(.2, 1.4, .35, 1) .35s both; }
.ap .wrlc-t b { font-family: "East Sea Dokdo", var(--display); font-weight: 400; font-size: clamp(66px, 19vw, 128px); line-height: .9; color: #ffe2a0; text-shadow: 0 3px 0 #2a1606, 0 0 18px #ffb84a, 0 6px 18px #000; }
.ap .wrlc-t span { font-family: "Gowun Batang", serif; font-size: clamp(16px, 4.6vw, 22px); font-weight: 700; color: #fff4dc; text-shadow: 0 2px 6px #000; }
@keyframes wrlcslam { from { opacity: 0; transform: scale(1.4); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .ap .wrlc-sweep { display: none; } }
.ap .wrelief { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0 6px; padding: 8px 10px; border-radius: 12px; font-size: 14px; animation: wrel .9s ease-out both; }
.ap .wrelief img { width: 34px; height: 34px; object-fit: contain; }
.ap .wrelief b { font-family: 'Gowun Batang', serif; font-size: 18px; }
.ap .wrelief.us { background: linear-gradient(90deg, #5a4318, #2c2416); border: 1px solid #e0bd78; color: #fff1cc; box-shadow: 0 0 18px #e0bd7855; }
.ap .wrelief.us b { color: #ffd27a; }
.ap .wrelief.foe { background: linear-gradient(90deg, #4a1c16, #241614); border: 1px solid #b0584a; color: #ffd0c4; }
@keyframes wrel { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
.ap .wact { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; padding: 4px 8px; border-radius: 9px; background: #ffffff08; border-left: 3px solid #6a6458; font-size: 13.5px; }
.ap .wact.us { border-left-color: #c9a45a; } .ap .wact.foe { border-left-color: #b0584a; }
.ap .wact img { width: 26px; height: 26px; object-fit: contain; }
.ap .wact .who { font-size: 11px; color: #a89c84; min-width: 24px; }
.ap .wact .arw { flex: none; width: 30px; height: 18px; fill: #e8c27a; filter: none; } .ap .wact.foe .arw { fill: #ff8a74; transform: scaleX(-1); } /* 굵은 화살표 · 적의 일은 왼쪽으로 (형 11-02) */
.ap .wact.foe { justify-content: flex-end; border-left: 0; border-right: 3px solid #b0584a; } .ap .wact.foe .res { margin-left: 0; margin-right: auto; } .ap .wact.foe .who { text-align: right; }
.ap .wact .res { margin-left: auto; font-weight: 700; padding: 1px 7px; border-radius: 8px; background: #ffffff10; color: #d8cfbd; }
.ap .wact.good .res { background: #2f4a26; color: #b8e09a; } .ap .wact.bad .res { background: #4a2420; color: #ffb0a0; }
.ap .wact .loss { font-size: 12px; color: #e0a090; } .ap .wact .loss.own { color: #a89c84; }
.ap .wst.sm p { font-size: 12.5px; color: #a89c84; margin: 2px 0; }
.ap .wst p { margin: 3px 0; font-size: 14.5px; line-height: 1.5; }
.ap .wrd.crit .wst p:first-child { color: var(--gold); }
.ap .wpush { margin: 4px 0 0; text-align: center; font-size: 13px; color: var(--mute); }
.ap .wpush.good { color: var(--good); } .ap .wpush.bad { color: var(--bad); }
.ap .wfl.art { color: #ffd27a; text-shadow: 0 0 6px #ffd27a88; } .ap .wcmd.art { border-color: #c8a050; background: linear-gradient(#2a2418, #1d1a14); } .ap .wcmd em.art { background: #c8a050; color: #1b1408; }
/* 진각성 — 각성기 단추가 진각성이 되는 싸움이면 금빛이 짙게 숨 쉬고 「진각성」 · 작은 싸움이면 꼬리 한 줄 (형 11-05) */.ap .wcmd.wake.tru { border-color: #ffd76a; box-shadow: 0 0 0 1px #ffd76a, 0 0 14px #ffb84a99; animation: trubtn 1.2s ease-in-out infinite alternate; }@keyframes trubtn { to { box-shadow: 0 0 0 2px #ffe8a8, 0 0 22px #ffb84acc; } }.ap .wcmd em.art.tru { background: #ffd76a; color: #3a2408; font-weight: 900; }.ap .wcmd small.trun { display: block; font-size: 10.5px; color: #c8b890; font-weight: 600; }@media (prefers-reduced-motion: reduce) { .ap .wcmd.wake.tru { animation: none; } }.ap.q-low .wcmd.wake.tru { animation: none; }
/* 무리마다 잃은 사람 — 그림 칩 */
.ap .wloss { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; margin: 3px 0 0; font-size: 13px; }
.ap .wloss > span { display: inline-flex; align-items: center; gap: 5px; } .ap .wloss .us { color: #9fd18b; } .ap .wloss .foe { color: #e8a08a; }
.ap .wl { display: inline-flex; align-items: center; gap: 1px; font-weight: 700; } .ap .wl img { width: 22px; height: 22px; object-fit: contain; }
.ap .wrd.slow .wloss { opacity: 0; animation: wrin .45s ease-out var(--d, 0s) both; }
/* 맞은 쪽 — 흔들리고 번쩍 (우리 붉게 · 적 금빛) */
.ap .ws.hit { animation: wshake .5s ease-in-out var(--hd, 1.2s) both; position: relative; }
.ap .ws.hit.hithard { animation-name: wshakeh; }
.ap .ws.hit::after { content: ''; position: absolute; inset: -4px; border-radius: 14px; pointer-events: none; opacity: 0; animation: wflash .6s ease-out var(--hd, 1.2s) both; }
.ap .ws.us.hit::after { background: radial-gradient(circle, #ff4a3a66, #ff4a3a00 70%); } .ap .ws.foe.hit::after { background: radial-gradient(circle, #ffd27a66, #ffd27a00 70%); }
@keyframes wshake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
@keyframes wshakeh { 0%, 100% { transform: translateX(0) rotate(0); } 15% { transform: translateX(-9px) rotate(-2deg); } 35% { transform: translateX(8px) rotate(2deg); } 55% { transform: translateX(-6px) rotate(-1deg); } 75% { transform: translateX(3px); } }
@keyframes wflash { 0% { opacity: 0; } 25% { opacity: 1; } 100% { opacity: 0; } }
/* 그림 효과 (realm/fx — 제미나이, 검은 바탕을 밝기로 알파) */
.ap .wfx { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.ap .wfx-dust { position: absolute; bottom: -14%; width: 60vw; max-width: 640px; opacity: .3; animation: wdust 26s linear infinite; }
.ap .wfx-dust.a { left: -20%; } .ap .wfx-dust.b { left: 45%; animation-duration: 34s; animation-direction: reverse; opacity: .22; }
@keyframes wdust { 0% { transform: translateX(-6%) scale(1); } 50% { transform: translateX(6%) scale(1.08); } 100% { transform: translateX(-6%) scale(1); } }
/* 화살 — 앞으로는 고르게(바깥 i), 위아래는 오르다 떨어지게(안쪽 b), 머리는 오를 때 들리고 떨어질 때 숙인다. 적이 쏘면 통째로 뒤집는다 */
.ap .wfx-volley { position: absolute; inset: 0; animation: wfend .12s linear var(--end, 99s) forwards; } .ap .wfx-volley.l { transform: scaleX(-1); }
@keyframes wfend { to { opacity: 0; visibility: hidden; } }
.ap .wfx-volley i { position: absolute; left: var(--x); top: var(--y); width: calc(var(--z) * 96px); height: calc(var(--z) * 13px); opacity: 0; animation: wvx calc(.95s * var(--k, 1)) linear var(--t) both; }
.ap .wfx-volley b { position: absolute; inset: 0; background: center / 100% 100% no-repeat; animation: wvy calc(.95s * var(--k, 1)) linear var(--t) both; }
.ap .wfx-volley b::before { content: ''; position: absolute; right: 92%; top: 38%; height: 24%; width: 110%; border-radius: 2px; background: linear-gradient(to left, #ffffff99, #fff0); }
.ap .wfx-volley.fire i { height: calc(var(--z) * 16.5px); } .ap .wfx-volley.fire b { filter: drop-shadow(0 0 4px #ff7a1a); }
.ap .wfx-volley.fire b::before { top: 52%; height: 18%; background: linear-gradient(to left, #ff9a3aaa, #ff5a1a00); }
@keyframes wvx { 0% { opacity: 0; transform: translateX(0); } 8% { opacity: 1; } 88% { opacity: 1; } 100% { opacity: 0; transform: translateX(var(--dx)); } }
@keyframes wvy { 0% { transform: translateY(0) rotate(-28deg); animation-timing-function: ease-out; } 50% { transform: translateY(calc(var(--up) * -1)) rotate(0deg); animation-timing-function: ease-in; } 100% { transform: translateY(0) rotate(30deg); } }
/* 깃발마다 제 연출 — 낱낱이 (cmdFxHtml) */
.ap .wfx-cmd { position: absolute; inset: 0; animation: wfend .12s linear var(--end, 99s) forwards; } .ap .wfx-cmd.l { transform: scaleX(-1); }
.ap .wfx-cmd i { position: absolute; left: var(--x, 0); top: var(--y); width: calc(var(--z, 1) * var(--w)); aspect-ratio: var(--ar); opacity: 0; animation: var(--an) calc(var(--du) * var(--k, 1)) var(--ease, linear) var(--t) both; }
.ap .wfx-cmd i b { position: absolute; inset: 0; background: center / contain no-repeat; }
.ap .wfx-cmd .sp { --w: clamp(86px, 10vw, 160px); --ar: 256 / 65; --x: -4%; --an: wcsp; --du: .62s; --ease: cubic-bezier(.5, 0, .9, .6); }
@keyframes wcsp { 0% { opacity: 0; transform: translateX(-12vw); } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; transform: translateX(var(--dx)); } }
.ap .wfx-cmd .rd { --w: clamp(104px, 13vw, 210px); --ar: 256 / 235; --x: -6%; --an: wcrd; --du: 1.05s; --ease: cubic-bezier(.3, 0, .8, .7); }
.ap .wfx-cmd .rd b { animation: wcbob .16s ease-in-out infinite alternate; }
.ap .wfx-cmd .rd.fl { --an: wcfl; }
@keyframes wcrd { 0% { opacity: 0; transform: translateX(-14vw); } 12% { opacity: .95; } 82% { opacity: .95; } 100% { opacity: 0; transform: translateX(var(--dx)); } }
@keyframes wcfl { 0% { opacity: 0; transform: translate(-14vw, -6vh); } 12% { opacity: .95; } 82% { opacity: .95; } 100% { opacity: 0; transform: translate(var(--dx), 12vh); } }
@keyframes wcbob { from { transform: translateY(0) rotate(-1.5deg); } to { transform: translateY(-5%) rotate(1.5deg); } }
.ap .wfx-cmd .sh { --w: clamp(54px, 7vw, 112px); --ar: 165 / 256; --an: wcsh; --du: 1.1s; }
@keyframes wcsh { 0% { opacity: 0; transform: translateY(-34vh) rotate(-10deg) scale(1.1); animation-timing-function: cubic-bezier(.6, 0, 1, .6); }
  22% { opacity: 1; transform: translateY(0) rotate(0) scale(1); } 28% { transform: translateY(-4%) scale(1.03, .97); } 34% { transform: translateY(0) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(0); } }
.ap .wfx-cmd .sh.gd { --an: wcgd; }
@keyframes wcgd { 0% { opacity: 0; transform: translateY(30%) scale(.6); } 25% { opacity: 1; transform: translateY(0) scale(1.05); } 35% { transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; } }
.ap .wfx-cmd .sh.op { --an: wcop; --du: 1.3s; }
@keyframes wcop { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: 1; } 55% { opacity: 1; transform: translateY(var(--dy)); } 100% { opacity: 0; transform: translateY(var(--dy)); } }
.ap .wfx-cmd .rk { --w: clamp(76px, 9.5vw, 150px); --ar: 256 / 220; --an: wcrk; --du: 1.15s; --ease: cubic-bezier(.45, 0, .85, .55); }
@keyframes wcrk { 0% { opacity: 0; transform: translate(-6vw, -30vh) rotate(0); } 12% { opacity: 1; } 70% { transform: translate(calc(var(--dx) * .8), 0) rotate(420deg); }
  80% { transform: translate(calc(var(--dx) * .88), -3vh) rotate(480deg); } 90% { opacity: 1; transform: translate(var(--dx), 0) rotate(540deg); } 100% { opacity: 0; transform: translate(var(--dx), 0) rotate(560deg); } }
/* 공성추 (이름은 ramlg — .lg 는 깃발 줄 알약이라 둥근 판·테두리가 통나무에 같이 붙어 「아크릴 카드」로 보였다) — 줄에 매단 통나무처럼 위를 축으로 크게 젖혔다가(천천히) 가속해 내리친다(빠르게) · 칠 때 눌린다 · 쾅 번쩍임(.pop.fl)
   (형 11-01: "나무가 움직이는 게 아니라 아크릴 카드가 왔다 갔다 · 이미지 통째로 그림자" — 가로로만 미끄러지고 공중에서 둥근 그림자를 끌고 다녔다) */
.ap .wfx-cmd .ramlg { --w: clamp(180px, 24vw, 360px); --ar: 256 / 135; --x: -8%; --an: wclg; --du: 1.25s; transform-origin: 40% -160%; }
/* 날아드는 바위·방패의 그림자 — drop-shadow 필터는 폰에서 움직이는 그림의 네모 칸째로 그림자가 졌다 (형 10-30: "누끼는 따졌는데 이미지 박스 그대로 그림자가 테두리에") · 밑에 둥근 바닥 그림자만 · 공성추는 매달려 흔들리므로 그림자를 끌고 다니지 않는다 */
.ap .wfx-cmd :is(.rk, .sh)::after { content: ''; position: absolute; left: 12%; right: 12%; bottom: -8%; height: 18%; border-radius: 50%; background: radial-gradient(closest-side, #000a, #0000); z-index: -1; pointer-events: none; }
@keyframes wclg {
  0% { opacity: 0; transform: translateX(-24vw) rotate(-16deg); animation-timing-function: ease-out; }
  8% { opacity: 1; } 16% { transform: translateX(6vw) rotate(-17deg); animation-timing-function: cubic-bezier(.55, 0, 1, .45); }
  24% { transform: translateX(24vw) rotate(3deg) scale(1.05, .93); animation-timing-function: ease-out; }
  29% { transform: translateX(19vw) rotate(-3deg) scale(1); } 45% { transform: translateX(7vw) rotate(-16deg); animation-timing-function: cubic-bezier(.55, 0, 1, .45); }
  53% { transform: translateX(25vw) rotate(4deg) scale(1.05, .93); animation-timing-function: ease-out; }
  58% { transform: translateX(19vw) rotate(-3deg) scale(1); } 74% { transform: translateX(6vw) rotate(-18deg); animation-timing-function: cubic-bezier(.6, 0, 1, .4); }
  82% { opacity: 1; transform: translateX(27vw) rotate(5deg) scale(1.07, .9); animation-timing-function: ease-out; }
  100% { opacity: 0; transform: translateX(21vw) rotate(-2deg) scale(1); } }
.ap .wfx-cmd .pop.fl { --w: clamp(110px, 15vw, 220px); --ar: 1; --du: .45s; mix-blend-mode: screen; }
.ap .wfx-cmd .pop { --w: clamp(80px, 10vw, 150px); --ar: 1; --an: wcpop; --du: .7s; --ease: ease-out; }
.ap .wfx-cmd .pop.fr { --w: clamp(150px, 20vw, 300px); --ar: 1; --du: 1.2s; transform-origin: 50% 100%; filter: drop-shadow(0 0 10px #ff8a2a); }
@keyframes wcpop { 0% { opacity: 0; transform: scale(.2) rotate(-8deg); } 25% { opacity: 1; transform: scale(1) rotate(0); } 100% { opacity: 0; transform: scale(1.25) rotate(6deg); } }
.ap .wfx-cmd .pf { --w: 120px; --ar: 1; --an: wcpf; --du: 1.2s; --ease: ease-out; mix-blend-mode: screen; }
.ap .wfx-cmd .pf.pfbk { --an: wcpb; } /* .bk 는 전투 카드 판이라 바탕·테두리가 연기에 붙었다 */
@keyframes wcpf { 0% { opacity: 0; transform: scale(.4) translateX(0); } 25% { opacity: .55; } 100% { opacity: 0; transform: scale(1.4) translateX(4vw); } }
@keyframes wcpb { 0% { opacity: 0; transform: scale(.5) translateX(0); } 25% { opacity: .6; } 100% { opacity: 0; transform: scale(1.5) translateX(-10vw); } }
.ap .wfx-cmd .rp { --w: clamp(110px, 12vw, 180px); --ar: 256 / 242; --x: 20%; --an: wcrp; --du: 1.1s; --ease: cubic-bezier(.3, .2, .6, 1); }
@keyframes wcrp { 0% { opacity: 0; transform: translate(0, 0) rotate(0) scale(.6); } 15% { opacity: 1; } 75% { opacity: 1; transform: translate(46vw, -4vh) rotate(720deg) scale(1); }
  88% { transform: translate(47vw, -4vh) rotate(720deg) scale(.82); } 100% { opacity: 0; transform: translate(47vw, -4vh) rotate(720deg) scale(.82); } }
.ap .wfx-cmd .rg { --w: clamp(110px, 13vw, 200px); --ar: 1; --x: 14%; --y: 12%; --an: wcrg; --du: 1s; --ease: ease-out; border-radius: 50%; border: 3px solid #ffd27a; box-shadow: 0 0 18px #ffd27a99, inset 0 0 12px #ffd27a66; }
@keyframes wcrg { 0% { opacity: 0; transform: scale(.3); } 20% { opacity: .9; } 100% { opacity: 0; transform: scale(2.2); } }
.ap .wact .kept { font-size: 12px; color: #cfe3b8; margin-left: 4px; }
.ap .wfx-cmd .sl { --w: 62vw; --ar: 40 / 1; --x: 19%; --y: 24%; --an: wcsl; --du: .5s; --ease: ease-out; background: linear-gradient(90deg, #fff0, #fffbe8 45%, #ffd27a 55%, #fff0); box-shadow: 0 0 14px #ffe9b0; }
.ap .wfx-cmd .sl.a { rotate: 18deg; } .ap .wfx-cmd .sl.b { rotate: -18deg; }
@keyframes wcsl { 0% { opacity: 0; transform: scaleX(0); } 30% { opacity: 1; transform: scaleX(1); } 100% { opacity: 0; transform: scaleX(1.05); } }
@media (prefers-reduced-motion: reduce) { .ap .wfx-cmd { display: none; } }
.ap .ws .wfx-hit { position: absolute; left: 50%; top: 42px; width: 150px; height: 150px; margin: -75px 0 0 -75px; z-index: 2; pointer-events: none; opacity: 0; animation: whitfx .55s ease-out var(--hd, 1.2s) both; }
@keyframes whitfx { 0% { opacity: 0; transform: scale(.3) rotate(0); } 25% { opacity: 1; transform: scale(1.05) rotate(12deg); } 100% { opacity: 0; transform: scale(1.35) rotate(24deg); } }
.ap .wend { position: relative; } .ap .wend > b { position: relative; }
.ap .wend .wyld { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 6px 0 0; font-size: 18px; } .ap .wend .wyld img { width: 30px; height: 30px; object-fit: contain; } .ap .wend .wyld i { font-style: normal; color: #cbbf9f; } .ap .wend .wyld.us b { color: #b8f09a; } .ap .wend .wyld.foe b { color: #ffb4a0; }
.ap .wfx.burn { opacity: 0; animation: wrin 1.2s ease-out var(--d, 0s) both; }
/* 불 — 작은 불길 여럿이 바닥에서 솟아 스러진다 · 불티는 낱낱이 위로 · 밑에 붉은 숯불 기운 */
.ap .wburn { position: absolute; bottom: 1%; width: min(46vw, 430px); height: min(40vw, 360px); }
.ap .wburn.l { left: 1%; } .ap .wburn.r { right: 2%; width: min(36vw, 330px); height: min(32vw, 290px); }
.ap .wburn .bed { position: absolute; left: 5%; right: 5%; bottom: 0; height: 22%; border-radius: 50%; background: radial-gradient(ellipse at 50% 70%, #ffb04acc, #ff6a1a66 45%, #0000 75%);
  filter: blur(6px); opacity: .85; }
/* 불길은 늘 보이는 채로 천천히 흔들린다 — 0↔0.95 로 켜졌다 꺼지고 화면 섞기(screen)까지 걸려 폰에서 끝 화면 그림 전체가 깜빡였다 (형 10-25: "승리던 패배던 전투 끝날때 이미지들이 엄청 깜빡") */
.ap .wburn img { position: absolute; bottom: 0; left: calc(var(--x) * .8); width: calc(52% * var(--s)); transform-origin: 50% 100%; opacity: .88;
  animation: wsway var(--d) ease-in-out var(--t) infinite alternate; }
@keyframes wsway { from { transform: scale(1, 1) skewX(-2deg); } to { transform: scale(.94, 1.08) skewX(3deg); } }
.ap .wburn b { position: absolute; bottom: 12%; left: var(--x); width: 4px; height: 4px; border-radius: 50%; background: #ffd27a; box-shadow: 0 0 6px 2px #ff9a3a; opacity: 0;
  animation: wember var(--d) linear var(--t) infinite; }
@keyframes wtongue { 0% { opacity: 0; transform: translateY(8%) scale(.5, .6); } 18% { opacity: .95; transform: translateY(0) scale(1, 1); }
  60% { opacity: .75; transform: translateY(-14%) scale(.85, 1.15); } 100% { opacity: 0; transform: translateY(-34%) scale(.35, .7); } }
@keyframes wember { 0% { opacity: 0; transform: translate(0, 0); } 12% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--w), -220%) ; } }
@keyframes wbed { from { opacity: .7; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .ap .wburn img, .ap .wburn b { animation: none; opacity: .8; } }
.ap .wfx-smoke { position: absolute; bottom: 18%; left: 2%; width: min(42vw, 380px); opacity: .7; animation: wsmoke 9s ease-in-out infinite alternate; }
@keyframes wsmoke { from { transform: translateY(0) scale(1); } to { transform: translateY(-30px) scale(1.12); } }
/* 맡기기 — 그 장수의 얼굴과 지략 */
.ap .wauto { flex: 1 1 100%; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #d8cfbf; }
.ap .wauto .wf { width: 30px; height: 30px; border-radius: 50%; } .ap .wauto .wdots { color: var(--gold); letter-spacing: 1px; } .ap .wauto .wsty { color: #ffd27a; }
.ap .wfoot .btn small { display: block; font-size: 11px; font-weight: 500; opacity: .85; }
/* 이긴 결과 카드 — 조용히 떠오르고 금테만 (크게 터지는 것은 가운데 「승리·대승」이 맡는다 · 형 10-23: "대승 카드가 혼자만 깜빡거림") */
.ap .wend.good { border: 1px solid #c9a45a; box-shadow: 0 0 14px #ffd27a33; }
@media (prefers-reduced-motion: reduce) { .ap .ws.hit, .ap .ws.hit::after, .ap .wfx-dust, .ap .wfx-smoke { animation: none; } .ap .wfx-volley, .ap .ws .wfx-hit { display: none; } }
.ap .wrd.slow .wcmds, .ap .wrd.slow .wst, .ap .wrd.slow .wpush { opacity: 0; animation: wrin .45s ease-out var(--d, 0s) both; }
/* 합 결과 줄이 하나씩 촤르륵 (형 10-28) — 이야기 칸의 줄마다 · 잃은 수 칩마다 조금씩 늦게 */
.ap .wrd.slow .wst > * { opacity: 0; animation: wrrow .32s ease-out calc(var(--d, 0s) + var(--n, 0) * .26s) both; }
.ap .wrd.slow .wloss > * { display: inline-block; opacity: 0; animation: wrrow .3s ease-out calc(var(--d, 0s) + var(--n, 0) * .22s) both; }
.ap .wrd.slow :is(.wst, .wloss) > :nth-child(2) { --n: 1; } .ap .wrd.slow :is(.wst, .wloss) > :nth-child(3) { --n: 2; } .ap .wrd.slow :is(.wst, .wloss) > :nth-child(4) { --n: 3; }
.ap .wrd.slow :is(.wst, .wloss) > :nth-child(5) { --n: 4; } .ap .wrd.slow :is(.wst, .wloss) > :nth-child(6) { --n: 5; } .ap .wrd.slow :is(.wst, .wloss) > :nth-child(7) { --n: 6; } .ap .wrd.slow :is(.wst, .wloss) > :nth-child(n+8) { --n: 7; }
@keyframes wrrow { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
/* 맞부딪힘 — 잃은 사람 수·사기가 초상 위로 크게 튀어 오른다 */
.ap .wtop .ws { position: relative; }
/* 원군 그림 — 닿기 전엔 없고, 닿는 합에 뒤에서 걸어 들어온다 */
.ap .wf2s .tk.tkh { display: none; }
.ap .wfield.play .wf2s .tk.tkn { --relief-time: 1s; --relief-delay: var(--hd, 1.2s); animation: tknin var(--relief-time) linear var(--relief-delay) both !important; }
.ap .wfield.play .wf2s .tk.wsp.tkn .spf { animation: spwalk var(--relief-time) steps(var(--spwalkn, 2)) var(--relief-delay) !important; }
@keyframes tknin { from { opacity: 0; translate: -60% 0; } to { opacity: 1; translate: 0 0; } }
/* 줄어든 머릿수는 붉게 번쩍이며 튄다 (형 10-29: "데미지 입을 때 명수 깎이는 게 너무 안 보여 · 더 강하게") */
@keyframes wnup { 0% { transform: scale(1.4); color: #b8f0a0; text-shadow: 0 0 12px #6fc05a; } 60% { transform: scale(1); } 100% { color: inherit; } }
@keyframes wnhit { 0% { transform: scale(1.6); color: #ff3a1a; text-shadow: 0 0 14px #ff2a00; } 60% { transform: scale(1); } 100% { color: inherit; } }
.ap .wr.fast .wside-loss, .ap .wr.fast .wflag-morale { animation-delay: 0s !important; }
.ap .wrd.slow .wcmds { animation-name: wrflip; }
@keyframes wrin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes wrflip { from { opacity: 0; transform: rotateX(90deg); } to { opacity: 1; transform: none; } }
.ap .wnext { margin-top: 12px; padding: 10px; border-radius: 14px; background: #1f1710; border: 1px solid #4a4030; animation: wrin .4s ease-out both; }
.ap .wr.slow .wnext { animation-delay: var(--d, 3.1s); }
.ap .whint { margin: 2px 0 6px; font-size: 14px; } .ap .whint b { color: var(--gold); margin-right: 4px; }
.ap .wintel { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 12px; }
.ap .wintel .wi { padding: 8px 10px; border-radius: 10px; background: #15100bcc; border-left: 3px solid var(--gold); }
.ap .wintel .wi > b { display: block; font-size: 12.5px; color: var(--gold); letter-spacing: .04em; }
.ap .wintel .wi p { margin: 2px 0 0; font-size: 15.5px; line-height: 1.45; color: #f3e8d2; }
.ap .wintel .wi small { display: block; margin-top: 2px; font-size: 12px; color: var(--mute); }
.ap .wintel .wi.warn { border-left-color: #ff9a70; } .ap .wintel .wi.warn > b { color: #ff9a70; }
.ap .wintel .wi.dim { border-left-color: #5a5040; } .ap .wintel .wi.dim p { color: #b8ae9c; }
.ap .wintel .wi.foe { border-left-color: #c8604a; } .ap .wintel .wi.foe > b { color: #e0a090; }
.ap .wfoes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.ap .wfoes span { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px 2px 3px; border-radius: 999px; background: #2a1812; border: 1px solid #6a3a2a; font-size: 13.5px; }
.ap .wfoes img { width: 22px; height: 22px; object-fit: contain; } .ap .wfoes i { font-style: normal; color: #f0c0b0; }
.ap .whint.warn b { color: #ff9a70; }
.ap .wfoe { margin: 0 0 8px; font-size: 13px; color: #e0b0a0; }
.ap .wgrp { margin: 8px 0; } .ap .wgrp[hidden] { display: none; }
/* 무리 탭 — 누른 무리만 빛난다 · 고른 무리엔 고른 깃발이 붙는다 */
.ap .wgtabs { display: flex; gap: 5px; margin: 4px 0 6px; } /* 한 줄에 다 — 조금 작아져도 (형 10-25) */
.ap .wgt { position: relative; display: flex; align-items: center; gap: 7px; padding: 7px 9px; border-radius: 12px; border: 1.5px solid #5a4630; background: linear-gradient(#2a2016, #1a130c);
  color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: transform .12s, box-shadow .2s, border-color .2s; }
.ap .wgt .wgi { width: 34px; height: 34px; flex: none; object-fit: contain; filter: drop-shadow(0 1px 2px #000a); }
.ap .wgt .wgi.f .wf, .ap .wgt .wgi.f img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.ap .wgt .wgn { display: flex; flex-direction: column; min-width: 0; flex: 1; } .ap .wgt .wgn b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .ap .wgt .wgn small { font-size: 11.5px; color: var(--mute); }
.ap .wgt .wgs { display: flex; flex-direction: column; align-items: center; gap: 1px; font-size: 11px; font-weight: 700; color: #ffe2a0; white-space: nowrap; }
.ap .wgt .wgs img { width: 30px; height: auto; filter: drop-shadow(0 0 4px #ffd27a99); }
.ap .wgt .wgs.none { color: #c9a070; font-weight: 600; padding: 2px 7px; border: 1px dashed #8a6a40; border-radius: 8px; }
.ap .wgt.done { border-color: #8aa86a; } .ap .wgt.done::after { content: '✓'; position: absolute; left: 4px; top: 2px; font-size: 11px; color: #b6e08f; font-weight: 800; }
.ap .wgt.on { border-color: #ffd27a; background: linear-gradient(#4a3a20, #2a2012); box-shadow: 0 0 0 2px #ffd27a55, 0 0 16px #ffd27a88; transform: translateY(-2px); }
.ap .wgt:not(.on):not(.done) { animation: wgtwait 1.6s ease-in-out infinite alternate; } @keyframes wgtwait { to { border-color: #a07a48; } }
.ap .wgby { margin: 2px 2px 4px; font-size: 12px; color: var(--mute); } .ap .wgby b { color: #e8d4a8; }
/* 짐작 — 판세 막대(우리 푸른빛 · 적 붉은빛 · 폭은 옅게 · 지금에 금) · 말 · 잃을 몫 */
.ap .wguess { display: grid; grid-template-columns: auto auto 1fr auto auto; align-items: center; gap: 3px 4px; width: 100%; margin-top: 4px; }
.ap .wguess .wgq { font-size: 10.5px; color: var(--mute); white-space: nowrap; } /* wgt 는 무리 탭 — 이름이 겹쳐 단추 모양이 됐다 */ .ap .wguess > .wgk { font-size: 10.5px; font-weight: 700; } .ap .wguess > .wgk.us { color: #7fb8f0; } .ap .wguess > .wgk.foe { color: #f09080; }
.ap .wguess .wgbar { position: relative; height: 7px; border-radius: 4px; overflow: hidden; box-shadow: inset 0 0 0 1px #0008;
  background: #2a2420; }
/* 가운데 금 = 지금 · 오른쪽 파랑 = 밀어붙임 · 왼쪽 붉음 = 밀림 · 옅은 칸 = 짐작의 폭 — 단색 조각 (형 폰에서 그러데이션이 까맣게 깨졌다 · 10-28) */
.ap .wguess .wgbar .wgb2, .ap .wguess .wgbar .wgb1 { position: absolute; top: 0; bottom: 0; }
.ap .wguess .wgbar .wgb2 { left: var(--r0); width: var(--rw); background: #ffffff26; } .ap .wguess .wgbar .wgb1 { left: var(--s0); width: var(--sw); background: #3d8fe0; }
.ap .wguess .wgbar.neg .wgb1 { background: #d8503a; }
.ap .wguess .wgbar::after { content: ''; position: absolute; left: 50%; top: -1px; bottom: -1px; width: 2px; margin-left: -1px; background: #ffe7b0; box-shadow: 0 0 3px #000; }
.ap .wcmd .wguess > b { font-size: 11.5px; white-space: nowrap; }
.ap .wguess > b { width: 6.4em; text-align: right; white-space: nowrap; } /* 「맞선다」·「크게 밀린다」 길이에 따라 판세 막대가 늘고 줄지 않게 (형 10-28) */
.ap .wguess.g2 > b { color: #7fd8ff; } .ap .wguess.g1 > b { color: #a8d8f0; } .ap .wguess.g0 > b { color: #d8cfbf; } .ap .wguess.b1 > b { color: #f0b090; } .ap .wguess.b2 > b { color: #ff7a5a; }
/* 잃을 군사 · 사기의 폭 — 숫자로 (형 10-26) · 한 줄에 한 쪽 */
.ap .wguess .wgl { grid-column: 1 / -1; display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 8px; font-size: 11.5px; color: #d8cfbf; }
.ap .wguess .wgl > .wgk { flex: 0 0 auto; min-width: 2.2em; font-size: 10.5px; color: var(--mute); }
.ap .wguess .wgl b { font-size: 12.5px; white-space: nowrap; } .ap .wguess .wgl b.us { color: #ff9a7a; } .ap .wguess .wgl b.foe { color: #f0d080; }
.ap .wguess .wgl .wgm { white-space: nowrap; color: var(--mute); font-size: 11px; } .ap .wguess .wgl .wgm b { font-size: 11.5px; } .ap .wguess .wgl .wgm b.up { color: #9fe08a; } .ap .wguess .wgl .wgm b.dn { color: #f0a08a; }
.ap .wguess .wgl.wgc b { color: #7fd8ff; font-size: 13.5px; }
/* 짐작 표 — 위 카드의 막대와 같은 자리: 왼쪽 우리(초록 막대) · 오른쪽 적(붉은 막대) · 윗줄 명 · 아랫줄 사기 */
/* 짐작 표 — 일곱 칸: 이름 | 우리 최악 ~ 최선 | 적 최악 ~ 최선 · 숫자는 칸 가운데 (형 10-26) */
.ap .wguess .wgx { grid-column: 1 / -1; display: grid; grid-template-columns: auto minmax(0, 1fr) 10px minmax(0, 1fr) minmax(0, 1fr) 10px minmax(0, 1fr); align-items: baseline; gap: 2px 3px; padding: 4px 6px; border-radius: 8px; background: #0b0a0899; }
.ap .wguess .wgx > .wgk.us, .ap .wguess .wgx > .wgk.foe { grid-column: span 3; text-align: center; }
.ap .wguess .wgx > i { font-style: normal; text-align: center; color: #6a645a; font-size: 11px; }
.ap .wguess .wgx > b { text-align: center; font-variant-numeric: tabular-nums; text-shadow: 0 1px 0 #000; }
.ap .wguess .wgx > b small { font-size: .78em; font-weight: 600; margin-left: 1px; opacity: .8; }
.ap .wguess .wgx > .wgxn { grid-column: 2 / -1; display: grid; grid-template-columns: subgrid; font-size: 9.5px; color: #6a645a; text-align: center; }
.ap .wguess .wgx > .wgxn > span:nth-child(1) { grid-column: 1; } .ap .wguess .wgx > .wgxn > span:nth-child(2) { grid-column: 3; }
.ap .wguess .wgx > .wgxn > span:nth-child(3) { grid-column: 4; } .ap .wguess .wgx > .wgxn > span:nth-child(4) { grid-column: 6; }
.ap .wguess .wgx > .wgk { font-size: 10.5px; color: var(--mute); white-space: nowrap; }
.ap .wguess .wgx > .wgk.us, .ap .wguess .wgx > .wgk.foe { font-weight: 800; padding-bottom: 1px; border-bottom: 2px solid; }
.ap .wguess .wgx > .wgk.us { color: #9fe08a; border-color: #4f9a44; } .ap .wguess .wgx > .wgk.foe { color: #ff9a80; border-color: #b0482e; }
.ap .wguess .wgx > .wgk small { font-size: .9em; font-weight: 600; color: var(--mute); }
.ap .wguess .wgx > b { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.ap .wguess .wgtag { margin-left: 3px; padding: 0 4px; border-radius: 5px; background: #2e4a3a; color: #b6e8c8; font-size: 10px; font-style: normal; }
.ap .wguess.wait { display: none; }
/* 이대로 싸우면 — 다 골랐을 때 전투 개시 위 */
.ap .wlsum:empty { display: none; }
.ap .wlsum { margin: 8px 0 2px; padding: 7px 10px; border-radius: 12px; background: #1a140ecc; border: 1px solid #8a6a3a; }
.ap .wlsum .wlst { font-size: 12px; color: var(--gold); }
.ap .wcmd .wct { width: 100%; }
/* 전투 개시 — 다 고르기 전엔 잠겨 있다 */
.ap .wgo { font-size: 16px; } .ap .wgo small { display: block; font-size: 11px; font-weight: 500; }
.ap .wgo:is(:disabled, [aria-disabled="true"]) { opacity: .55; filter: grayscale(.6); cursor: default; }
.ap .wgo:not(:disabled):not([aria-disabled="true"]) { animation: wgoready 1.1s ease-in-out infinite alternate; } @keyframes wgoready { from { box-shadow: 0 0 4px #ffd27a66; } to { box-shadow: 0 0 20px #ffd27a; } }
@media (prefers-reduced-motion: reduce) { .ap .wgt, .ap .wgo { animation: none !important; } }
/* 적 앞줄 위의 낌새 */
.ap .wfield { position: relative; }
.ap .wf-omen { position: absolute; right: 3%; top: 6px; display: flex; align-items: center; gap: 5px; padding: 3px 9px 3px 4px; border-radius: 12px; z-index: 2;
  background: #2a1410ee; border: 1.5px solid #ff8a6a; box-shadow: 0 0 12px #ff6a4a88; animation: wfomen 1.3s ease-in-out infinite alternate; }
.ap .wf-omen img { width: 30px; height: auto; } .ap .wf-omen span { display: flex; flex-direction: column; line-height: 1.15; }
.ap .wf-omen b { font-size: 13px; color: #ffd0b8; } .ap .wf-omen small { font-size: 10px; color: #d8a890; }
.ap .wf-omen.habit { border-style: dashed; }
.ap .wf-omen.none { background: #1a1612e8; border-color: #6a5a48; box-shadow: none; animation: none; } .ap .wf-omen.none i { font-style: normal; font-weight: 800; font-size: 20px; color: #a89880; padding: 0 6px; }
.ap .wf-omen.none b { color: #c8bca8; }
@keyframes wfomen { to { box-shadow: 0 0 20px #ff6a4acc; } }
@media (prefers-reduced-motion: reduce) { .ap .wf-omen { animation: none; } }
.ap .wfield.play .wf-omen { display: none; } /* 합이 풀리는 동안엔 다음 합의 낌새를 띄우지 않는다 */
@property --wc { syntax: '<integer>'; inherits: false; initial-value: 0; }
.ap .wrs, .ap .wrs::before, .ap .wrs::after, .ap .wrs *, .ap .wrs *::before, .ap .wrs *::after { animation: none !important; } /* paintNow 의 연출 다시 틀기 */
/* 전장을 만진다 — 꾹 누름에 글이 잡히거나 메뉴가 뜨지 않게 · 무리를 누를 수 있다는 손 모양 */
.ap .wfield { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation; cursor: pointer; }
.ap .wf-omen { cursor: help; }
/* 땅 띠 (terrChips) — 전장 바로 위 제 줄. 그림 · 이름 · 누구에게 유리한지(테두리·글 색). 전장 위에 띄우지 않아 병사·깃발과 안 겹친다 (형 10-26) */
.ap .wterr { position: relative; z-index: 3; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 5px; margin: 8px 0 0; }
.ap .wtc { display: flex; align-items: center; gap: 4px; padding: 2px 8px 2px 3px; border-radius: 9px; background: #120d09e0; border: 1px solid #6a5a48; font-style: normal; cursor: help; box-shadow: 0 2px 6px #0008; }
.ap .wtc.us { border-color: #5fae55; } .ap .wtc.foe { border-color: #c8604a; }
.ap .wtc img { width: 24px; height: 24px; object-fit: contain; flex: none; }
.ap .wtc span { display: flex; flex-direction: column; line-height: 1.12; white-space: nowrap; }
.ap .wtc b { font-size: 12px; font-weight: 800; color: #f6e2b8; text-shadow: 0 1px 2px #000; }
.ap .wtc small { font-size: 10.5px; font-weight: 700; color: #c8bca8; } .ap .wtc.us small { color: #9fe08a; } .ap .wtc.foe small { color: #ff9a80; }
@media (max-width: 520px) { .ap .wterr { gap: 3px; margin-top: 6px; } .ap .wtc { padding: 1px 6px 1px 2px; gap: 3px; } .ap .wtc img { width: 20px; height: 20px; } .ap .wtc b { font-size: 11px; } .ap .wtc small { font-size: 9.5px; } }
.ap .wfhint { margin: 2px 2px 8px; font-size: 12.5px; color: var(--mute); line-height: 1.45; } .ap .wfhint b { color: #e8d4a8; font-weight: 700; }
/* 정보창 — 손가락·커서 곁 */
.ap .wtip { position: fixed; z-index: 95; box-sizing: border-box; width: min(270px, calc(100vw - 24px)); padding: 9px 11px; border-radius: 12px; background: #17110cf4; border: 1px solid #a0802a; box-shadow: 0 10px 30px #000c; color: #f3e8d2; font-size: 13px; line-height: 1.45; pointer-events: none; opacity: 0; visibility: hidden; transform: scale(.96); transition: opacity .12s, transform .12s, visibility 0s .12s; }
.ap .wtip.on { opacity: 1; visibility: visible; transform: none; transition: opacity .12s, transform .12s; }
.ap .wtip p { margin: 5px 0 0; } .ap .wtip .dim { color: #b8ae9c; } .ap .wtip .good { color: #9fe08a; } .ap .wtip .bad { color: #ff9a80; }
.ap .wtip .wth { display: flex; align-items: center; gap: 6px; } .ap .wtip .wth img { width: 26px; height: 26px; object-fit: contain; }
.ap .wtip .wth b { font-size: 15px; color: #fff; } .ap .wtip .wth > span { margin-left: auto; font-weight: 700; color: #f6d8a0; }
.ap .wtip .wth .wck { font-style: normal; font-size: 11px; font-weight: 800; padding: 1px 6px; border-radius: 8px; background: #3f8f3a; color: #eaffe0; } .ap .wtip .wth.foe .wck { background: #8a3a2a; color: #ffe3dc; }
.ap .wtip .wtface { display: inline-block; width: 30px; height: 30px; } .ap .wtip .wtface .wf { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 1px solid #a0802a; }
.ap .wtip .wtt { display: flex; align-items: center; gap: 8px; } .ap .wtip .wtt img { width: 46px; height: 46px; object-fit: contain; flex: none; }
.ap .wtip .wtt span { display: flex; flex-direction: column; } .ap .wtip .wtt b { font-size: 15px; color: #f6d8a0; } .ap .wtip .wtt small { font-size: 11.5px; color: #c8bca8; }
.ap .wtip .wtq { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 10px; background: #2a221a; font-style: normal; font-weight: 900; font-size: 24px; color: #a89880; }
.ap .wtip .wtw { font-style: normal; font-size: 11.5px; font-weight: 700; color: #9fe08a; } .ap .wtip .wtw.foe { color: #ff9a80; }
.ap .wtip .wts { margin-top: 7px; padding-top: 6px; border-top: 1px solid #ffffff1a; } .ap .wtip .wts > b { font-size: 11.5px; color: var(--gold); letter-spacing: .04em; } .ap .wtip .wts p { margin: 2px 0 0; }
.ap .wtip .wtf { display: flex; align-items: flex-start; gap: 7px; } .ap .wtip .wtf img { width: 30px; height: auto; flex: none; } .ap .wtip .wtf span { display: flex; flex-direction: column; } .ap .wtip .wtf b { color: #ffd27a; }
.ap .wtip .wtl { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; } .ap .wtip .wtl span { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px 1px 2px; border-radius: 8px; background: #2d1f1d; font-size: 12px; }
.ap .wtip .wtl img { width: 20px; height: 20px; object-fit: contain; } .ap .wtip .wtl i { font-style: normal; color: #ffb8a0; }
/* 무리 곁의 깃발 판 (openPop) */
.ap .wsure { position: fixed; inset: 0; z-index: 96; display: grid; place-items: center; padding: 16px; background: #000a; }
.ap .wsure[hidden] { display: none; }
.ap .wsurec { width: min(420px, 100%); padding: 20px 18px 16px; border-radius: 16px; background: #1c100c; border: 1.5px solid #e04a3a; box-shadow: 0 0 24px #e04a3a66, 0 14px 40px #000d; text-align: center; animation: wfpin .16s ease-out; }
.ap .wsurec b { display: block; font-size: 20px; color: #ffb4a4; }
.ap .wsurec p { margin: 10px 0 16px; font-size: 14px; color: #e6d8c6; }
.ap .wsureb { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ap .wauto-ask .wsurec { border-color: #e0b860; box-shadow: 0 0 24px #e0b86055, 0 14px 40px #000d; } .ap .wauto-ask .wsurec b { color: #ffe2a0; }
.ap .wauto-ask .wsurec .wf { display: block; width: 96px; height: 110px; margin: 0 auto 10px; border-radius: 12px; object-fit: cover; object-position: top; border: 2px solid #e0b860; }
.ap .wsureb .wsurey { background: linear-gradient(#a8291c, #6e150c); border-color: #e04a3a; color: #fff; }
.ap .wfpop { position: fixed; z-index: 94; width: min(330px, calc(100vw - 16px)); padding: 8px; border-radius: 14px; background: #17110cf6; border: 1.5px solid #ffd27a; box-shadow: 0 0 0 1px #000, 0 12px 34px #000d, 0 0 18px #ffd27a44; animation: wfpin .16s ease-out; }
.ap .wsg { position: fixed; inset: 0; z-index: 97; display: grid; place-items: start center; padding: max(12px, 7dvh) 12px 12px; } /* 위에 붙여 탭을 넘겨도 판이 들썩이지 않게 */
.ap .wsg[hidden] { display: none; }
.ap .wsg-bg { position: absolute; inset: 0; border: 0; padding: 0; background: #000b; cursor: pointer; }
.ap .wsg-c { position: relative; width: min(420px, 100%); max-height: calc(100dvh - max(24px, 7dvh + 12px)); overflow: hidden; box-sizing: border-box; padding: 12px 12px 10px; border-radius: 16px; background: #1c140c; border: 1.5px solid #c9a45a; box-shadow: 0 0 24px #c9a45a44, 0 14px 40px #000d; animation: wfpin .16s ease-out; }
.ap .wsg-xb { position: absolute; right: 8px; top: 8px; width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #a0802a; background: #2a2016; color: #ffd27a; font-size: 16px; font-weight: 900; line-height: 1; cursor: pointer; }
.ap .wsg-h { display: flex; align-items: baseline; gap: 10px; padding-right: 40px; }
.ap .wsg-h > b { font-family: 'Gowun Batang', serif; font-size: 19px; color: var(--gold); }
.ap .wsg-lg { font-size: 12px; color: #d8cfbd; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.ap .wsg-lg i { font-style: normal; font-size: 11px; } .ap .wsg-lg i.u { color: #9fe08a; } .ap .wsg-lg i.d { color: #ff9a8a; margin-left: 6px; }
.ap .wsg-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0; }
.ap .wsg-t { display: flex; align-items: center; justify-content: center; gap: 3px; min-height: 36px; padding: 3px 4px; border-radius: 10px; border: 1px solid #4d3b26; background: #120d09; color: #bfb39c; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
.ap .wsg-t img { width: 22px; height: 22px; object-fit: contain; }
.ap .wsg-t.on { border-color: #e0b860; background: #3a2a14; color: #ffe2a0; box-shadow: 0 0 0 1px #e0b860, 0 0 10px #e0b86055; }
.ap .wsg-p[hidden] { display: none; }
.ap .wsg-p { display: flex; flex-direction: column; gap: 4px; }
.ap .wsg-ring { position: relative; width: min(100%, 300px); aspect-ratio: 300 / 222; margin: 0 auto 4px; }
.ap .wsg-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ap .wsg-ring svg path { fill: none; stroke: #ffd27a; stroke-width: 7; stroke-linecap: round; }
.ap .wsg-ring svg marker path { fill: #ffd27a; stroke: none; }
.ap .wsg-rf { position: absolute; display: flex; flex-direction: column; align-items: center; translate: -50% -50%; }
.ap .wsg-rf img { width: clamp(52px, 17vw, 70px); height: auto; filter: drop-shadow(0 3px 5px #000c); }
.ap .wsg-rf b { margin-top: -4px; padding: 1px 8px; border-radius: 8px; background: #0b0805d9; color: #fff2d6; font-size: 13px; white-space: nowrap; }
.ap .wsg-x2 { position: absolute; left: 50%; top: 58%; translate: -50% -50%; font-size: clamp(24px, 8vw, 32px); font-weight: 900; color: #ffe2a0; text-shadow: 0 2px 0 #000, 0 0 10px #ffb84a; }
.ap .wsg-row { display: grid; grid-template-columns: 54px minmax(0, 1fr) auto; align-items: center; gap: 6px; padding: 2px 8px 2px 2px; border-radius: 10px; background: #0b0a0899; }
.ap .wsg-me { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.ap .wsg-me img { width: 30px; height: 36px; object-fit: contain; }
.ap .wsg-me b { margin-top: -2px; font-size: 10.5px; line-height: 1.1; color: #f3e6c8; text-align: center; word-break: keep-all; }
.ap .wsg-vs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-width: 0; }
.ap .wsg-vs i { display: inline-flex; align-items: center; gap: 2px; padding: 2px 5px 2px 3px; border-radius: 8px; font-style: normal; font-size: 11px; font-weight: 800; line-height: 1; white-space: nowrap; }
.ap .wsg-vs i.u { background: #1d3818; box-shadow: inset 0 0 0 1px #7fd06a; color: #9fe08a; } .ap .wsg-vs i.u::before { content: '▶'; }
.ap .wsg-vs i.e { background: #26231e; box-shadow: inset 0 0 0 1px #8a8270; color: #cfc6b4; } .ap .wsg-vs i.e::before { content: '='; font-size: 13px; }
.ap .wsg-vs i.d { background: #3c1814; box-shadow: inset 0 0 0 1px #e0705e; color: #ff9a8a; } .ap .wsg-vs i.d::before { content: '◀'; }
.ap .wsg-vs img { width: 22px; height: 26px; object-fit: contain; }
.ap .wsg-vs em { font-style: normal; padding: 0 1px; }
.ap .wsg-w { font-size: 13px; font-weight: 900; color: #ffe2a0; white-space: nowrap; text-shadow: 0 1px 2px #000; }
@keyframes wfpin { from { opacity: 0; transform: translateY(-6px) scale(.97); } to { opacity: 1; transform: none; } }
.ap .wfpop[hidden] { display: none; }
/* 누르는 동안만 뜨는 설명 창 · 지금 고를 무리 위 보석 · 끄는 빨간 화살 (형 10-28: 하스스톤처럼) */
.ap .whold { position: fixed; z-index: 99; width: min(300px, calc(100vw - 16px)); box-sizing: border-box; padding: 9px 11px; border-radius: 12px; background: #120d09f5; border: 1.5px solid #e0b860;
  box-shadow: 0 10px 28px #000d; pointer-events: none; animation: whin .12s ease-out; }
.ap .whold[hidden] { display: none; }
@keyframes whin { from { opacity: 0; transform: translateY(6px) scale(.96); } }
.ap .whold .whh { display: flex; align-items: center; gap: 6px; } .ap .whold .whh img, .ap .whold .whh .wgi { width: 30px; height: 30px; object-fit: contain; flex: none; }
.ap .whold .whh b { font-size: 16px; color: #ffe2a0; } .ap .whold .whh small { color: var(--mute); font-size: 12px; } .ap .whold .whh em { font-size: 11px; }
.ap .whold .wrwhy { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; margin-top: 7px; padding: 6px 8px; border-radius: 8px; background: #0b0a08b3; font-size: 12.5px; color: #e8dcc0; }
.ap .whold .wrwhy b { font-weight: 800; text-align: right; } .ap .whold .wrwhy b.up { color: #9fe08a; } .ap .whold .wrwhy b.dn { color: #ff9a7a; }
.ap .whold p { margin: 6px 0 0; font-size: 12.5px; line-height: 1.45; color: #e8dcc0; } .ap .whold .whn { color: #ffd27a; font-weight: 700; }
.ap .wr .whold .wguess .wgx { display: grid !important; } .ap .wr .whold .wguess .wgl { display: flex !important; }
/* 보석 — 밑변 --a, 높이 --h 인 거꾸로 선 사각뿔. 옆면은 빗변 길이(--s)의 세모, 안쪽으로 --t 만큼 기운다 (a=16 · h=21 → s≈22.5 · t≈20.9° · 형 10-28: 너무 크다) */
.ap .wgem { position: fixed; z-index: 95; width: 0; height: 0; pointer-events: none; perspective: 260px; --a: 16px; --s: 22.5px; --t: 20.9deg; animation: wgembob 1.1s ease-in-out infinite alternate; }
.ap .wgem[hidden] { display: none; }
@keyframes wgembob { from { translate: 0 -40px; } to { translate: 0 -33px; } }
.ap .wgem .g3 { position: absolute; left: 0; top: 0; transform-style: preserve-3d; animation: wgemspin 2.6s linear infinite; }
@keyframes wgemspin { from { transform: rotateX(-22deg) rotateY(0deg); } to { transform: rotateX(-22deg) rotateY(360deg); } }
.ap .wgem .gf { position: absolute; left: calc(var(--a) / -2); top: 0; width: var(--a); height: var(--s); transform-origin: 50% 0; clip-path: polygon(0 0, 100% 0, 50% 100%); backface-visibility: visible; }
.ap .wgem .f0 { transform: rotateY(0deg) translateZ(calc(var(--a) / 2)) rotateX(calc(var(--t) * -1)); background: #3fd46a; }
.ap .wgem .f1 { transform: rotateY(90deg) translateZ(calc(var(--a) / 2)) rotateX(calc(var(--t) * -1)); background: #1f9e48; }
.ap .wgem .f2 { transform: rotateY(180deg) translateZ(calc(var(--a) / 2)) rotateX(calc(var(--t) * -1)); background: #13702f; }
.ap .wgem .f3 { transform: rotateY(270deg) translateZ(calc(var(--a) / 2)) rotateX(calc(var(--t) * -1)); background: #2bba57; }
.ap .wgem .gt { position: absolute; left: calc(var(--a) / -2); top: calc(var(--a) / -2); width: var(--a); height: var(--a); transform: rotateX(90deg); background: #9dffbe; box-shadow: inset 0 0 0 2px #d8ffe6; }
@media (prefers-reduced-motion: reduce) { .ap .wgem, .ap .wgem .g3 { animation: none; } }
.ap .wdrag { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 98; pointer-events: none; overflow: visible; }
.ap .wdrag .wdl { fill: none; stroke: #5a1008; stroke-width: 16; stroke-linecap: round; }
.ap .wdrag .wdf { fill: none; stroke: #ff5a3c; stroke-width: 10; stroke-linecap: round; stroke-dasharray: 16 12; animation: wdflow .45s linear infinite; }
.ap .wdrag .wdh { fill: #ff5a3c; stroke: #ff5a3c; stroke-width: 6; stroke-linejoin: round; } /* 촉에 짙은 테 없이 · 모서리만 살짝 둥글게 (형 10-28) */
.ap .wdrag.ok .wdh { stroke: #ffd27a; }
.ap .wdrag.ok .wdf, .ap .wdrag.ok .wdh { fill: none; } .ap .wdrag.ok .wdf { stroke: #ffd27a; } .ap .wdrag.ok .wdh { fill: #ffd27a; }
@keyframes wdflow { to { stroke-dashoffset: -28; } }
.ap .wfpop .wcmd.mini { touch-action: none; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
.ap .wfpop .wcmd.mini.dragging, .ap .wfpop .wcmd.mini.armed { outline: 2px solid #ff5a3c; outline-offset: 1px; }
.ap .wfpop .wfphint { margin: 6px 2px 0; font-size: 11.5px; color: #c9b88e; text-align: center; }
/* 깃발 판 안의 「누가 나서나 · 누구를 잡나」 — 누른 깃발이 그것일 때만 · 작게 한 줄 */
.ap .wfpop .wwho { margin: 6px 0 0; padding: 5px 6px; gap: 4px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
.ap .wfpop .wwho.show { display: flex; }
.ap .wfpop .wwho > span { flex: none; flex-basis: auto; width: 48px; font-size: 11.5px; line-height: 1.25; word-break: keep-all; }
.ap .wfpop .wwho .wfc { flex: none; width: 62px; padding: 4px 2px; }
.ap .wfpop .wwho .wfc .wf { width: 34px; height: 34px; }
.ap .wfpop .wwho .wfc b { font-size: 11px; } .ap .wfpop .wwho .wfc small { font-size: 9.5px; }
/* 깃발 판 밑의 판세 — 누른 깃발(처음엔 ★권함)의 판세 막대와 바로 끝날 확률 · 깃발을 누를 때마다 바뀐다 (형 10-28: "깃발 선택 창 하단에 아예 전황 바") */
.ap .wfpop .wfplook { margin-top: 6px; padding: 5px 7px; border-radius: 10px; background: #0b0a08b3; } .ap .wfpop .wfplook:empty { display: none; }
.ap .wfpop .wfplook .wguess { margin-top: 0; } .ap .wr .wfpop .wfplook .wguess .wgx { display: none !important; } .ap .wr .wfpop .wfplook.held .wguess .wgx { display: grid !important; } .ap .wr .wfpop .wfplook .wguess .wgl.wgff { display: flex !important; }
.ap .wfpop .wfplook .wlkn { font-size: 11.5px; color: #ffe2a0; font-weight: 700; margin-bottom: 2px; }
.ap .wfpop .wcmd.mini .wct > .wguess { display: none !important; } /* 판세는 깃발을 누르고 있을 때 뜨는 설명 창 밑에 (형 10-28) */
.ap .wfpop .wcmd.mini { position: relative; } .ap .wfpop .wcmd.mini .wct > em.rec { position: absolute; right: 6px; top: 5px; }
/* 싸움판을 화면 가득 — 아래로 밀지 않는다 (형 10-28) · 전장이 남은 높이를 다 쓰고, 깃발 칸(.wnext)은 「자세히」를 켰을 때만 */
.ap .wr.choosing:not(.whelpon) .wnext { display: none; }
.ap .wr .wtop { min-height: calc(100dvh - 132px - env(safe-area-inset-bottom)); display: flex; flex-direction: column; box-sizing: border-box; } /* 고르는 동안만 키웠더니 전투 개시 때 잠깐 낮아졌다 (형 10-28) */
.ap .wr .wtop .wfield { flex: 1 1 auto; height: auto !important; min-height: 170px; }
.ap .wr .wsc { padding-bottom: 140px; } .ap .wr.choosing:not(.whelpon):not(.logopen) .wsc { overflow-y: hidden; }
.ap .wrc { cursor: pointer; font: inherit; } .ap .wrc.none { border-color: #e0b860; animation: wrcask 1s ease-in-out infinite alternate; } .ap .wrc.none i { color: #ffd27a; font-size: 15px; }
@keyframes wrcask { from { box-shadow: 0 0 0 #ffd27a00; } to { box-shadow: 0 0 10px #ffd27a; } }
.ap .wrrow { display: flex; gap: 8px; width: min(520px, 100%); } .ap .wrrow .wrgo { flex: 1; width: auto; } .ap .wrrow .wrauto { flex: none; flex-direction: column; line-height: 1.15; } .ap .wrrow .wrauto small { display: block; font-size: 11px; color: #ffd27a; }
.ap .wrgo:is(:disabled, [aria-disabled="true"]) { animation: none; font-size: 15px; }
.ap .wfpop { z-index: 96; }
/* 다 골랐다 — 아래 띠 (고른 깃발 한 줄 + 큰 「전투 개시」) */
.ap .wready { position: fixed; left: 0; right: 0; bottom: 0; z-index: 95; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 26px 16px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(#0d0a0700, #0d0a07ee 34%); animation: wrdyin .22s ease-out; }
.ap .wready[hidden] { display: none; }
@keyframes wrdyin { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
.ap .wrchips { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: 640px; }
.ap .wrc { display: flex; align-items: center; gap: 5px; padding: 3px 9px 3px 4px; border-radius: 999px; background: #2a2016; border: 1.5px solid #8aa86a; font-size: 13px; color: #f0e2c4; }
.ap .wrc .wgi, .ap .wrc .wgi.f .wf, .ap .wrc .wgi.f img { width: 24px; height: 24px; flex: none; object-fit: contain; border-radius: 50%; }
.ap .wrc .wrf { width: 22px; height: auto; filter: drop-shadow(0 0 3px #ffd27a99); }
.ap .wrc i { font-style: normal; font-weight: 800; color: #ffe2a0; }
.ap .wrgo { width: min(520px, 100%); display: flex; justify-content: center; align-items: center; text-align: center; padding: 14px 16px; font-size: 20px; animation: wgoready 1.1s ease-in-out infinite alternate; }
.ap .wr.ready .wsc { padding-bottom: 150px; }
@media (prefers-reduced-motion: reduce) { .ap .wready, .ap .wrgo { animation: none !important; } }
.ap .wfph { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; } .ap .wfph .wgi { width: 26px; height: 26px; flex: none; }
/* 장수 깃발 판 — 장수 그림을 크게 (형 10-28: "장수 이미지가 나오는 건 중요") · 기술이 늘면 판은 위로 자란다 (아래 띠 위에 붙어 있으니) */
.ap .wfpop.lead { width: min(380px, calc(100vw - 16px)); }
.ap .wfpop.lead .wfph { gap: 10px; margin-bottom: 8px; } .ap .wfpop.lead .wfph b { font-size: 18px; color: #ffe2a0; } .ap .wfpop.lead .wfph small { font-size: 13px; }
.ap .wfpop.lead .wfph .wgi.f, .ap .wfpop.lead .wfph .wgi.f .wf, .ap .wfpop.lead .wfph .wgi.f img { width: 84px; height: 96px; border-radius: 12px; object-fit: cover; object-position: top; }
.ap .wfpop.lead .wfph .wgi.f { flex: none; border: 2px solid #e0b860; box-shadow: 0 4px 12px #000a; overflow: hidden; } .ap .wfph b { font-size: 14.5px; color: #fff; } .ap .wfph small { font-size: 11.5px; color: var(--mute); }
.ap .wfpx { margin-left: auto; width: 30px; height: 30px; border-radius: 15px; border: 1px solid #6a5a48; background: #2a221a; color: #e8dcc4; font-size: 14px; cursor: pointer; flex: none; }
.ap .wfpg { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px; }
/* 좁은 화면에서 전장을 안 가리게 줄인 판 (placePop · 형 11-02) — 깃발 넷을 한 줄에, 이름은 깃발 밑 · 누가 나서나·도움말은 「자세히」에만 */
.ap .wfpop .wcmd.mini { min-width: 0; overflow: hidden; min-height: 44px; padding: 5px 6px 5px 4px; flex-direction: row; align-items: center; gap: 4px; text-align: left; border: 1px solid #6a5236; border-image: none; border-radius: 10px; background: #241b12; filter: none; }
.ap .wfpop .wcmd.mini.on { border-color: var(--gold); background: #3a2e1c; box-shadow: 0 0 0 2px #d9b36a66; }
.ap .wfpop .wcmd.mini .wflag { width: 30px; height: auto; flex: none; }
.ap .wfpop .wcmd.mini .wct { gap: 1px; } .ap .wfpop .wcmd.mini .wct > b { font-size: 13.5px; }
/* 전장의 깃발 판엔 그림과 이름만 — 꼬리표·짐작 글이 자리를 넘쳐 튀어나오고 줄이 바뀌었다 (형 10-25) · 권함은 별 하나로 */
.ap .wfpop .wcmd.mini .wct > :not(b):not(em.rec):not(.wodd):not(.wguess) { display: none !important; }
/* 가망 % — 큰 깃발엔 말로 이미 있어 작은 단추(전장 깃발 판)에서만 */
.ap .wcmd .wct > .wodd { display: none; } .ap .wfpop .wcmd.mini .wct > .wodd { display: inline; flex: none; font-style: normal; font-size: 12px; font-weight: 800; }
.ap .wfpop .wcmd.mini .wct:has(> .wodd) { flex-direction: column; align-items: flex-start; gap: 0; } /* 이름 밑 줄에 — 옆에 두면 「퇴…」로 잘렸다 */
.ap .wfpop .wcmd.mini .wct { flex-direction: row; align-items: center; gap: 3px; min-width: 0; }
.ap .wfpop .wcmd.mini .wct > b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.ap .wfpop .wcmd.mini .wct > em.rec { font-size: 0; padding: 0 3px; } .ap .wfpop .wcmd.mini .wct > em.rec::before { content: '★'; font-size: 11px; }
.ap .wfph b, .ap .wfph small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.ap .wfpop { box-sizing: border-box; } /* 폭에 안쪽 여백·테까지 넣는다 — 안 넣으면 100vw-12px 판이 화면 오른쪽으로 5px 튀어나왔다 (형 11-03) */
/* 좁은 화면에서 전장을 안 가리게 줄인 판 (placePop · 형 11-02 · 11-03: "깃발창이 짜부돼서 오른쪽으로 튀어나옴 · 글자 작아져도 되니 공간 활용")
   양옆 6px 를 띄운 화면 폭 · 머리는 한 줄(작은 얼굴·이름·✕) · 깃발은 몇 개든 한 줄에 같은 폭으로(그림 위 · 이름 밑) · 판세는 막대 한 줄 ·
   꾹 누르면 피해·사기 표(±)가 그 밑에 붙고 판은 위로 자란다 (아래는 화면 끝에 붙어 있다). 누가 나서나·도움말은 「자세히」에만.
   아래 규칙들보다 뒤에 두고 .wr 을 더 붙인다 — 앞에 두었더니 보통 판 규칙(가로 줄·최소 높이 44px)이 덮어 칸이 짜부됐다 */
.ap .wr .wfpop.tight { width: min(560px, calc(100vw - 12px)); right: auto; padding: 5px 6px 6px; border-radius: 12px; max-height: calc(100dvh - 12px); }
/* 줄인 판도 넓은 화면에선 그만큼만 — PC·가로 폰에서 양끝까지 늘어나 깃발 셋이 쓸데없이 길었다 (형 11-05) */
.ap .wr .wfpop.tight .wfphint, .ap .wr .wfpop.tight .wwho, .ap .wr .wfpop.tight .wfplook .wlkn { display: none !important; }
.ap .wr .wfpop.tight .wfph { gap: 6px; margin-bottom: 4px; min-height: 0; }
.ap .wr .wfpop.tight .wfph .wgi, .ap .wr .wfpop.tight .wfph .wgi.f .wf, .ap .wr .wfpop.tight .wfph .wgi.f img { width: 22px; height: 22px; }
.ap .wr .wfpop.tight .wfph b { font-size: 13.5px; } .ap .wr .wfpop.tight .wfph small { font-size: 11px; }
.ap .wr .wfpop.tight .wfpx { width: 26px; height: 26px; font-size: 12px; }
.ap .wr .wfpop.lead.tight .wfph .wgi.f, .ap .wr .wfpop.lead.tight .wfph .wgi.f .wf, .ap .wr .wfpop.lead.tight .wfph .wgi.f img { width: 36px; height: 42px; border-radius: 7px; }
.ap .wr .wfpop.lead.tight .wfph .wgi.f { border-width: 1.5px; }
.ap .wr .wfpop.tight .wfpg { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px; }
.ap .wr .wfpop.tight .wcmd.mini { flex-direction: column; align-items: center; justify-content: center; min-height: 0; padding: 4px 1px 3px; gap: 1px; text-align: center; border-radius: 8px; }
.ap .wr .wfpop.tight .wcmd.mini .wflag, .ap .wr .wfpop.tight .wcmd.mini > img { position: static; width: 22px; height: auto; max-height: 30px; object-fit: contain; }
.ap .wr .wfpop.tight .wcmd.mini .wct, .ap .wr .wfpop.tight .wcmd.mini .wct:has(> .wodd) { flex-direction: column; align-items: center; gap: 0; width: 100%; }
.ap .wr .wfpop.tight .wcmd.mini .wct > b { max-width: 100%; font-size: 11.5px; line-height: 1.2; }
.ap .wr .wfpop.tight .wcmd.mini .wct > .wodd { font-size: 10.5px; line-height: 1.1; }
.ap .wr .wfpop.tight .wcmd.mini .wct > em.rec { position: absolute; right: 2px; top: 2px; padding: 0 2px; } .ap .wr .wfpop.tight .wcmd.mini .wct > em.rec::before { font-size: 9px; }
.ap .wr .wfpop.tight .wfplook { margin-top: 4px; padding: 3px 6px; border-radius: 8px; }
.ap .wr .wfpop.tight .wfplook .wguess { gap: 2px 4px; }
.ap .wr .wfpop.tight .wfplook .wguess .wgq, .ap .wr .wfpop.tight .wfplook .wguess > .wgk { font-size: 10px; }
.ap .wr .wfpop.tight .wfplook .wguess > b { width: auto; min-width: 4.4em; font-size: 11px; }
.ap .wr .wfpop.tight .wfplook .wguess .wgl { font-size: 10.5px; } .ap .wr .wfpop.tight .wfplook .wguess .wgl b { font-size: 11px; }
.ap .wr .wfpop.tight .wfplook .wguess .wgx { padding: 2px 4px; gap: 1px 2px; margin-top: 2px; }
.ap .wr .wfpop.tight .wfplook .wguess .wgx > b { font-size: 11px; } .ap .wr .wfpop.tight .wfplook .wguess .wgx > .wgk { font-size: 10px; } .ap .wr .wfpop.tight .wfplook .wguess .wgx > .wgxn { font-size: 9px; }

.ap .wgh { font-size: 13.5px; margin-bottom: 4px; } .ap .wgh b { color: var(--gold); margin-right: 4px; }
.ap .wcmdgrid { display: grid; grid-template-columns: 1fr; gap: 6px; } /* 한 열 (형 10-25) */
.ap .wnext .wgtabs .wgt { flex: 1 1 0; min-width: 0; flex-direction: column; align-items: center; gap: 2px; padding: 6px 3px 5px; text-align: center; }
.ap .wnext .wgtabs .wgt .wgi, .ap .wnext .wgtabs .wgt .wgi.f .wf, .ap .wnext .wgtabs .wgt .wgi.f img { width: 28px; height: 28px; }
.ap .wnext .wgtabs .wgt .wgn { flex: none; width: 100%; align-items: center; }
.ap .wnext .wgtabs .wgt .wgn b { font-size: 12px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.ap .wnext .wgtabs .wgt .wgn small { font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.ap .wnext .wgtabs .wgt .wgs { flex-direction: row; gap: 3px; font-size: 10.5px; max-width: 100%; overflow: hidden; }
.ap .wnext .wgtabs .wgt .wgs img { width: 18px; }
.ap .wcmd { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 7px 9px; border-radius: 12px; border: 1px solid #6a5236;
  background: #2a1f16; color: var(--ink); font: inherit; text-align: left; cursor: pointer; position: relative; }
.ap .wcmd.on { border-color: var(--gold); background: #3a3222; box-shadow: 0 0 0 2px #d9b36a66; }
/* 깃발 카드 — 같은 청동 테 (가늘게) · 고르면 금빛이 번진다 */
.ap .wcmd { border: 12px solid transparent; border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 12px stretch; background: #1d1610 padding-box; border-radius: 0; }
.ap .wcmd.on { border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 12px stretch; background: #3a2e1c padding-box; box-shadow: none; filter: drop-shadow(0 0 6px #ffd27aaa); animation: wcmdland .18s cubic-bezier(.3, 1.6, .5, 1); }
.ap .wcmd { transition: transform .12s ease-out, filter .12s; } .ap .wcmd:hover:not(.on) { transform: translateY(-4px); filter: drop-shadow(0 8px 8px #000a); } .ap .wcmd:active { transform: translateY(1px) scale(.97); transition-duration: .06s; }
@keyframes wcmdland { 0% { transform: scale(1.08); } 100% { transform: scale(1); } }
/* 깃발 카드 — 왼쪽에 깃발 한 폭, 고르면 깃발이 들려 나부낀다 */
.ap .wcmd { flex-direction: row; align-items: flex-start; gap: 8px; padding: 7px 9px 7px 6px; }
.ap .wcmd img.wflag { position: static; width: 50px; height: auto; flex: none; opacity: 1; filter: drop-shadow(0 2px 3px #000a); transform-origin: 18% 4%; transition: transform .25s; }
.ap .wcmd .wct { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; }
.ap .wcmd.on img.wflag { transform: translateY(-3px) scale(1.08); filter: drop-shadow(0 0 7px #ffd27acc) drop-shadow(0 2px 3px #000a); animation: wflagwave 1.4s ease-in-out infinite alternate; }
@keyframes wflagwave { from { transform: translateY(-3px) scale(1.08) rotate(-2deg) skewY(0deg); } to { transform: translateY(-3px) scale(1.08) rotate(1.5deg) skewY(-2deg); } }
@media (prefers-reduced-motion: reduce) { .ap .wcmd.on img.wflag { animation: none; } }
.ap .wfl img.flg { width: auto; height: 26px; object-fit: contain; border-radius: 0; background: none; }
.ap .wcmd img { width: 30px; height: 30px; object-fit: contain; position: absolute; right: 8px; top: 7px; opacity: .9; }
.ap .wcmd b { font-size: 15.5px; } .ap .wcmd small { font-size: 11.5px; color: var(--mute); line-height: 1.35; padding-right: 2px; }
.ap .wcmd em { font-style: normal; font-size: 11px; color: #14161a; background: var(--gold); border-radius: 6px; padding: 0 5px; }
.ap .wcmd em.land { background: #7fb07a; }
.ap .wcmd em.rec { background: #9fd18b; color: #10200a; font-weight: 800; box-shadow: 0 0 8px #9fd18b88; }
.ap .wcmd .wcap { font-size: 12px; color: var(--ink); }
.ap .wcmd.capture { border-color: #8a6a2a; }
/* 퇴각 — 지는 선택이라 붉게 */
.ap .wcmd.retreat { background: linear-gradient(#5a1a14, #3a100c) padding-box; } .ap .wcmd.retreat b { color: #ffb4a4; } .ap .wcmd.retreat.on { box-shadow: 0 0 14px #e04a3a; }
.ap .wf-hi { color: var(--good); font-weight: 700; font-size: 13px; } .ap .wf-mid { color: var(--gold); font-size: 13px; }
.ap .wf-lo { color: var(--bad); font-size: 13px; } .ap .wf-no { color: #8b8478; font-size: 13px; }
.ap .wfoot { display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 10px; flex-wrap: wrap; }
.ap .wfoot .btn.pri { font-size: 16px; padding: 8px 18px; }
.ap .wend { margin-top: 14px; padding: 12px; border-radius: 14px; text-align: center; background: #1f1710; animation: wrin .5s ease-out var(--d, 0s) both; }
.ap .wend b { font-size: 21px; } .ap .wend.good b { color: var(--good); } .ap .wend.bad b { color: var(--bad); }
.ap .wend .wwhy { font-size: 14.5px; color: #e8dcc0; }
.ap .wr.fast .wtick .wtk, .ap .wr.fast .wtick .wtl, .ap .wr.fast .wrd.slow .wcmds, .ap .wr.fast .wrd.slow .wst, .ap .wr.fast .wrd.slow .wpush, .ap .wr.fast .wend, .ap .wr.fast .wnext { animation-delay: 0s !important; animation-duration: .01s !important; }
.ap .wr.fast .wbar i.wgr, .ap .wr.fast .wbar .wchunk, .ap .wr.fast .wcnt, .ap .wr.fast .wrd.slow .wloss, .ap .wr.fast .ws.hit, .ap .wr.fast .ws.hit::after, .ap .wr.fast .wfx-hit { animation-delay: 0s !important; animation-duration: .01s !important; }
/* 장수 기술 — 초상이 옆에서 튀어나와 한 마디 (일본식 컷인 띠·빛살 없이 · 기술 결마다 효과가 다르다) */
/* 장수 기술은 읽고 「내가 썼다」를 느낄 만큼 — 1.8초 또렷 · 0.4초 걷힘 (형 10-24: "너무 빨리 나타나고 없어진다" · 필살기 컷인은 흔히 1.5~2.5초) */
.ap .wcut { position: absolute; inset: 50% 0 0 0; z-index: 6; /* 아래 반쪽에 — 위 카드의 전장을 가리지 않게 (형 10-25) */ pointer-events: auto; cursor: pointer; overflow: hidden; animation: wcout 2.2s ease-in 1 forwards; }
@keyframes wcout { 0%, 82% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }
.ap .wcut .wcbg { position: absolute; left: -10%; right: -10%; top: 30%; height: 34%; background: linear-gradient(90deg, #0b0805f0, #2a1a0ce8 40%, #0b0805d0 80%, #0b080500);
  transform: skewY(-4deg) scaleX(0); transform-origin: 0 50%; animation: wcband .35s cubic-bezier(.2, 1.2, .4, 1) both; box-shadow: 0 0 0 2px #c9a45a88; }
@keyframes wcband { to { transform: skewY(-4deg) scaleX(1); } }
.ap .wcut .wcpf { position: absolute; left: 6%; top: 50%; width: min(36vw, 200px); aspect-ratio: 1; transform: translateY(-50%); display: grid; place-items: center; animation: wcin .45s cubic-bezier(.2, 1.4, .4, 1) .05s both; }
.ap .wcut .wcpf > i { position: absolute; inset: 0; box-sizing: border-box; border: min(3.2vw, 18px) solid transparent; border-image: url(__ART__ui/frame-portrait.png) 60 / min(3.2vw, 18px) stretch; filter: drop-shadow(0 6px 14px #000); }
.ap .wcut .wcf { width: 84%; height: 84%; object-fit: cover; object-position: top; border-radius: 2px; } .ap .wcut .wcf.unit { object-fit: contain; }
@keyframes wcin { from { opacity: 0; transform: translate(-70vw, -50%) scale(.9); } to { opacity: 1; transform: translate(0, -50%); } }
.ap .wcut .wctx { position: absolute; left: calc(6% + min(36vw, 200px) + 14px); right: 4%; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 4px; animation: wrin .4s ease-out .25s both; }
.ap .wcut .wctx b { font-family: var(--display); font-weight: 400; font-size: clamp(30px, 8vw, 54px); color: #fff1c8; text-shadow: 0 0 14px #ffb04a, 0 3px 6px #000; letter-spacing: .04em; }
/* 긴 외침(「제게 맡겨 주시옵소서!」)은 폰 폭에서 줄이 넘어갔다 · 작게 한 줄로 조금 위에 (형 10-29) */
.ap .wcut .wctx.long { top: 40%; } .ap .wcut .wctx.long b { font-size: clamp(16px, 4.4vw, 40px); white-space: nowrap; letter-spacing: 0; }
.ap .wcut .wctx span { align-self: flex-start; font-size: clamp(13px, 3.4vw, 16px); color: #f0dcb0; text-shadow: 0 1px 4px #000; background: #0b0805d9; padding: 2px 10px; border-radius: 8px; } /* 기술 카드 밑 글씨가 배경에 묻혔다 (형 10-28) */
@media (prefers-reduced-motion: reduce) { .ap .wcut, .ap .wcut * { animation-duration: .01s !important; animation-delay: 0s !important; } .ap .wcut { animation: wcout 1.2s steps(1) forwards !important; } }
/* 싸움이 열린다 — 판 전체: 싸움터 그림이 다가오고, 양쪽 깃발·장수가 밀려들고, 이름이 쾅 (형 10-23: "전투가 발생했다는 게 확 실감이 안 나는데")
   히어로즈·토탈워의 싸움 앞 화면처럼 — 누가 누구와 어디서, 세기는 막대로 */
.ap .wopen { position: fixed; inset: 0; z-index: 70; overflow: hidden; background: #000; cursor: pointer; animation: woout 3.4s ease-in forwards; }
@keyframes woout { 0%, 94% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }
.ap .wopen .wocol { position: absolute; inset: 0; z-index: 3; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; padding: max(4vh, env(safe-area-inset-top)) 0 max(3vh, env(safe-area-inset-bottom)); overflow-y: auto; }
.ap .wopen .wocol > .wohead, .ap .wopen .wocol > .woin, .ap .wopen .wocol > .wofoot { position: relative; inset: auto; top: auto; bottom: auto; }
.ap .wosd .womix { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px 6px; margin-top: 2px; max-width: 42vw; }
.ap .wosd .womix span { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; color: #f6ead2; background: #0008; border-radius: 8px; padding: 1px 6px 1px 2px; text-shadow: 0 1px 2px #000; }
.ap .wosd .womix img { width: 22px; height: 22px; object-fit: contain; } .ap .wosd .womix b { font-weight: 600; color: #e0cfa8; margin-right: 3px; font-size: 11px; }
.ap .woterr { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px; margin-top: 12px; text-align: left; }
.ap .wotc { display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 5px; border-radius: 10px; background: #120d09d9; border: 1px solid #6a5a48; box-shadow: 0 4px 12px #000a; animation: wrin .45s ease-out calc(1.5s + var(--i, 0) * .22s) both; }
.ap .wotc.us { border-color: #5fae55; } .ap .wotc.foe { border-color: #c8604a; }
.ap .wotc img { width: 44px; height: 44px; object-fit: contain; flex: none; filter: drop-shadow(0 2px 3px #000); }
.ap .wotc span { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; } .ap .wotc b { font-size: 14px; color: #f6d8a0; }
.ap .wofoot .wotc em { display: block; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; font-style: normal; font-size: 11px; font-weight: 700; color: #9fe08a; } .ap .wofoot .wotc.foe em { color: #ff9a80; }
.ap .wotc small { font-size: 11.5px; color: #e8dcc4; }
.ap .wointro { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 8px 12px 8px 8px; border-radius: 12px; background: #000b; border: 1px solid #a0802a; text-align: left; animation: wrin .5s ease-out var(--d, 2.2s) both; }
.ap .wointro.us { border-color: #5fae55; } .ap .wointro.foe { border-color: #c8604a; }
.ap .wointro img { width: 52px; height: 52px; object-fit: contain; flex: none; filter: drop-shadow(0 2px 4px #000); }
.ap .wointro p { margin: 0; font-size: clamp(14px, 3.8vw, 16.5px); line-height: 1.45; color: #fff3dc; text-shadow: 0 1px 3px #000; }
.ap .wofoot > .wocd { display: inline-grid; place-items: center; width: 52px; height: 52px; margin-top: 12px; border-radius: 50%; border: 2px solid #f6d8a0; background: #000b; box-shadow: 0 0 16px #ff6a3a66, 0 4px 12px #000c; animation: wrin .4s ease-out var(--d, 2.5s) both; }
.ap .wofoot > .wocd i { font-style: normal; font-family: var(--display); font-size: 26px; color: #fff3dc; text-shadow: 0 0 10px #ff6a3a, 0 2px 4px #000; }
.ap .wofoot > .wocd i.tk { animation: wocdtk .45s cubic-bezier(.2, 1.6, .4, 1); } @keyframes wocdtk { from { scale: 1.6; opacity: .3; } to { scale: 1; opacity: 1; } }
/* 누르면 넘어간다는 것을 글 대신 손가락으로 (긴급 위원회 11-04 · 셈 화면을 누르면 바로 걷히는데 그런 표시가 없었다) */
.ap .wofoot > .wocd { position: relative; } .ap .wofoot > .wocd::after { content: "👆"; position: absolute; left: 100%; top: 50%; margin: -14px 0 0 8px; font-size: 24px; line-height: 1; animation: wotap 1s ease-in-out infinite alternate; }
@keyframes wotap { from { transform: translateY(0); opacity: .55; } to { transform: translateY(-6px); opacity: 1; } }
.ap .wopen .wob { position: absolute; inset: -4%; background: center / cover no-repeat; filter: brightness(.75) saturate(1.05); animation: wozoom 3.4s ease-out both; }
/* 고사양이 아니면 여는 그림도 filter·크게 키우기 없이 어둠에서 밝아지기만 (화면보다 큰 층 · 폰 깜빡임) */
.ap:not(.q-high) .wopen .wob { inset: 0; filter: none; animation: wozoomlite 1.2s ease-out both; } @keyframes wozoomlite { from { opacity: .25; } to { opacity: .85; } }
@keyframes wozoom { from { transform: scale(1.18); filter: brightness(.2); } 25% { filter: brightness(.8); } to { transform: scale(1); } }
.ap .wopen::before { content: ''; position: absolute; inset: 0; z-index: 1; background: url(__ART__fx/vig-edge.png) center / 100% 100% no-repeat; } /* 흐림은 구운 그림으로 — CSS 그러데이션은 갤럭시에서 층층이 띠가 졌다 (형 10-29) */
.ap .wopen .wofl { position: absolute; inset: 0; z-index: 2; background: url(__ART__fx/flash-red.png) center / 100% 100% no-repeat; opacity: 0; animation: woflash .7s ease-out .9s both; }
@keyframes woflash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
.ap .wopen .woin { position: absolute; inset: 0; z-index: 3; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; align-content: center; gap: 8px; padding: 0 4vw; animation: woshake .5s ease-out .9s both; }
@keyframes woshake { 0%, 100% { transform: none; } 20% { transform: translate(-8px, 3px); } 40% { transform: translate(7px, -4px); } 60% { transform: translate(-4px, 2px); } 80% { transform: translate(2px, -1px); } }
.ap .wosd { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; min-width: 0; align-self: start; } /* 위로 붙인다 — 병종 칩이 넷 대 하나면 가운데 맞춤이 두 장수 그림 높이를 어긋냈다 (형 10-28) */
.ap .wopen .wom { align-self: start; margin-top: calc(clamp(40px, 11vw, 64px) + 4px + clamp(84px, 26vw, 150px) / 2 - clamp(70px, 20vw, 130px) / 2); }
.ap .wosd.us { animation: woinl .55s cubic-bezier(.2, 1.3, .4, 1) .25s both; } .ap .wosd.foe { animation: woinr .55s cubic-bezier(.2, 1.3, .4, 1) .45s both; }
@keyframes woinl { from { opacity: 0; transform: translateX(-60vw); } to { opacity: 1; transform: none; } }
@keyframes woinr { from { opacity: 0; transform: translateX(60vw); } to { opacity: 1; transform: none; } }
.ap .wosd .woe { width: clamp(40px, 11vw, 64px); aspect-ratio: 1; object-fit: contain; filter: drop-shadow(0 2px 6px #000); }
.ap .wosd .wf { width: clamp(84px, 26vw, 150px); height: auto; aspect-ratio: 1; border-radius: 18px; border: 3px solid var(--c, #9fd18b); box-shadow: 0 0 0 2px #000a, 0 10px 30px #000d, 0 0 24px var(--c, #9fd18b); }
.ap .wosd b { font-family: var(--display); font-weight: 400; font-size: clamp(16px, 4.4vw, 24px); color: #fff; text-shadow: 0 2px 6px #000; }
.ap .wosd span { font-size: 13px; color: #f0e4cc; text-shadow: 0 1px 4px #000; }
.ap .wom { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.ap .wom .wox { font-style: normal; font-size: clamp(34px, 10vw, 60px); color: #ffcf8a; text-shadow: 0 0 18px #ff6a3a, 0 2px 4px #000; animation: wostamp .5s cubic-bezier(.2, 1.6, .4, 1) .8s both; }
@keyframes wostamp { from { opacity: 0; transform: scale(3.2) rotate(-12deg); } to { opacity: 1; transform: none; } }
.ap .wohead { position: absolute; z-index: 3; left: 0; right: 0; top: 14%; text-align: center; padding: 0 16px; animation: wrin .5s ease-out .95s both; }
.ap .wohead b { display: block; font-family: var(--display); font-weight: 400; font-size: clamp(30px, 8.5vw, 52px); color: #f6d8a0; letter-spacing: 3px; text-shadow: 0 0 14px #000, 0 3px 6px #000; }
.ap .wohead span { display: block; margin-top: 4px; font-size: clamp(15px, 4vw, 19px); color: #fff; text-shadow: 0 1px 5px #000; }
.ap .wofoot { position: absolute; z-index: 3; left: 0; right: 0; margin: 0 auto; bottom: 14%; width: min(92vw, 520px); text-align: center; animation: wrin .5s ease-out 1.15s both; } /* 가운데는 margin 으로 — transform 은 나타나는 애니메이션이 덮어써 폰에서 오른쪽으로 밀려 나갔다 (형 10-23) */
.ap .wobar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; box-shadow: 0 0 0 2px #000a, 0 4px 14px #000c; }
.ap .wobar i { display: block; height: 100%; } .ap .wobar i.us { background: linear-gradient(90deg, #3f8f3a, #8fd07a); } .ap .wobar i.foe { background: linear-gradient(90deg, #e08a74, #8a3a2a); }
.ap .wofoot em { display: inline-block; margin-top: 10px; font-style: normal; font-size: 13.5px; color: #ffd6c8; background: #5a1a10cc; border: 1px solid #c8402a; border-radius: 999px; padding: 3px 12px; }
.ap .wofoot > em.us { color: #e4ffd8; background: #1f4a1ccc; border-color: #5fae55; }
.ap .wofoot small { display: block; margin-top: 8px; font-size: 11.5px; color: #e0d0c0aa; }
@media (prefers-reduced-motion: reduce) { .ap .wopen, .ap .wopen * { animation-duration: .01s !important; animation-delay: 0s !important; } .ap .wopen { animation: woout 2.2s steps(1) forwards !important; } }
/* 싸움이 열린다 — 계절 띠처럼 가운데 이름 (북 · 종) */
.ap .warfx { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; pointer-events: none;
  background: url(__ART__fx/vig-center.png) center / 100% 100% no-repeat; animation: sfx 2.4s ease-out forwards; }
.ap .warfx > div { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 36px; border-radius: 18px; background: #1a1210ee;
  border: 1px solid #a0502a; box-shadow: 0 8px 40px #000c; animation: sfxin 1.6s cubic-bezier(.2, 1.4, .4, 1) forwards; }
.ap .warfx b { font-family: var(--display); font-weight: 400; font-size: 32px; color: #f0c080; letter-spacing: 2px; }
.ap .warfx span { font-size: 13.5px; color: #e0d0c0; }
/* 해시계 (형 10-26) — 머리 밑 때 줄: 지난 때 흐리게 · 지금 때 빛나게 · 남은 합을 말로 · 마지막 때는 붉게 */
.ap .wclk { position: relative; z-index: 3; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px 8px; margin: 0 0 6px; }
.ap .wclk ol { display: flex; gap: 3px; margin: 0; padding: 0; list-style: none; }
.ap .wclk li { padding: 1px 8px; border-radius: 10px; font-size: 11.5px; line-height: 1.5; color: #d8cfbf; background: #241a10cc; border: 1px solid #6a5236; text-shadow: 0 1px 2px #000; white-space: nowrap; }
.ap .wclk li.ck-past { opacity: .45; }
.ap .wclk li.ck-now { color: #1a1206; background: linear-gradient(#ffe7a8, #e8b860); border-color: #fff3c8; font-weight: 800; box-shadow: 0 0 10px #ffd27acc; animation: wclknow 1.2s ease-in-out infinite alternate; }
.ap .wclk li.ck-dark { background: #141a2ccc; border-color: #4a5a8a; color: #c8d4f0; }
.ap .wclk li.ck-dark.ck-now { color: #0c1020; background: linear-gradient(#e0e8ff, #9fb4f0); border-color: #f0f4ff; box-shadow: 0 0 10px #9fb4f0cc; }
.ap .wclk li.ck-over { border-style: dashed; }
.ap .wclk > b { font-size: 13px; color: #ffe7b0; text-shadow: 0 1px 3px #000, 0 0 8px #000c; white-space: nowrap; }
.ap .wclk.last > b { color: #ff8a6a; animation: wclklast .8s ease-in-out infinite alternate; }
.ap .wclk.ask > b { color: #ffd27a; font-size: 15px; }
.ap .wclk .wclk-m { font-style: normal; font-size: 11px; font-weight: 800; padding: 0 6px; border-radius: 8px; color: #e0e8ff; background: #223060; border: 1px solid #8fa4e0; }
@keyframes wclknow { to { box-shadow: 0 0 16px #ffd27a; } }
@keyframes wclklast { to { text-shadow: 0 1px 3px #000, 0 0 12px #ff5a3a; transform: scale(1.06); } }
@media (max-width: 520px) { .ap .wclk li { padding: 0 6px; font-size: 10.5px; } .ap .wclk > b { font-size: 12px; } }
/* 해시계의 하늘 — 어둠 속 합 · 해질녘 노을 · 새벽빛 (그림은 읽기만) */
.ap .wbg.dk-night { --wdim: .7; --wtint: #05081a; }
.ap .wbg.dk-night::after { background: radial-gradient(ellipse at 50% 20%, #1a2a5a55, #05081acc 75%); }
.ap .wbg.dk-dusk { --wdim: .45; --wtint: #2a1206; }
.ap .wbg.dk-dusk::after { background: linear-gradient(#ff8a3a55, #a0302a33 40%, #0d0f13cc 85%); }
.ap .wbg.dk-dawn { --wdim: .4; --wtint: #1a1410; }
.ap .wbg.dk-dawn::after { background: linear-gradient(#ffd8a855, #8aa0d033 40%, #0d0f13cc 85%); }
.ap:not(.q-high) .wbg.dk-dusk::after { background: radial-gradient(ellipse 150% 100% at 50% 0%, #ff8a3a33 20%, #0d0f13cc 100%); } .ap:not(.q-high) .wbg.dk-dawn::after { background: radial-gradient(ellipse 150% 100% at 50% 0%, #ffd8a833 20%, #0d0f13cc 100%); }
.ap .wrd.night { background: #141a26e6; border-color: #3a4a6a; }
/* 마지막 때의 큰 판 — 하늘이 바뀌고 해가 진다(새벽이면 뜬다) */
/* 화면 아래에 붙는다 — 칸 밑에 숨어 굴려야 고를 수 있었다 (형 10-31: "합 다 끝나고 나오는 선택지가 아직도 칸 밑에서 스크롤되어야 선택") */
.ap .wdusk { position: fixed; left: 0; right: 0; margin: 0 auto; bottom: calc(10px + env(safe-area-inset-bottom)); width: min(94vw, 560px); box-sizing: border-box; z-index: 72; max-height: 72vh; overflow-y: auto; box-shadow: 0 -6px 24px #000c; text-align: center; border-color: #a0602a; background: linear-gradient(#3a1c10, #1f1710 60%); }
.ap .wdusk.dawn { border-color: #8aa0d0; background: linear-gradient(#20304a, #1f1710 60%); }
.ap .wdusk .wdk-sky { position: absolute; left: 0; right: 0; top: 0; height: 70px; pointer-events: none; }
.ap .wdusk .wdk-sky i { position: absolute; left: 50%; top: 18px; width: 54px; height: 54px; margin-left: -27px; border-radius: 50%;
  background: radial-gradient(circle, #fff1c0, #ffb050 55%, #ff7a3a00 72%); animation: wdksun 2.4s ease-in forwards; }
.ap .wdusk.dawn .wdk-sky i { background: radial-gradient(circle, #fffbe8, #ffe0a0 55%, #ffd08000 72%); animation-name: wdkrise; }
@keyframes wdksun { from { transform: translateY(-14px); opacity: 1; } to { transform: translateY(34px); opacity: .55; } }
@keyframes wdkrise { from { transform: translateY(34px); opacity: .4; } to { transform: translateY(-6px); opacity: 1; } }
.ap .wdusk > * { position: relative; }
.ap .wdusk .wdk-h { display: block; margin-top: 30px; font-family: 'Gowun Batang', serif; font-size: 30px; letter-spacing: 3px; color: #ffd27a;
  text-shadow: 0 2px 8px #000, 0 0 18px #ff8a3a; animation: wdkh .7s cubic-bezier(.2, 1.6, .4, 1) both; }
.ap .wdusk.dawn .wdk-h { color: #fff1c8; text-shadow: 0 2px 8px #000, 0 0 18px #9fb4f0; }
@keyframes wdkh { from { transform: scale(1.8); opacity: 0; } to { transform: none; opacity: 1; } }
.ap .wdusk .wdk-s { margin: 2px 0 6px; font-size: 13px; color: #e0d0c0; }
.ap .wdusk .wdk-now { margin: 0 0 8px; font-size: 13.5px; } .ap .wdusk .wdk-now b.us { color: #7fb8f0; } .ap .wdusk .wdk-now b.foe { color: #f09080; }
.ap .wdusk .wdk-win { color: #9fe08a; } .ap .wdusk .wdk-lose { color: #ff8a6a; } .ap .wdusk .wdk-draw { color: #ffe7b0; }
.ap .wdusk .wdkg { display: grid; grid-template-columns: 1fr; gap: 6px; text-align: left; }
.ap .wdkb { display: flex; align-items: flex-start; gap: 8px; padding: 7px 9px 7px 6px; color: var(--ink); font: inherit; text-align: left; cursor: pointer;
  border: 12px solid transparent; border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 12px stretch; background: #1d1610 padding-box; transition: transform .12s ease-out, filter .12s; }
.ap .wdkb:hover { transform: translateY(-4px); filter: drop-shadow(0 8px 8px #000a); } .ap .wdkb:active { transform: translateY(1px) scale(.97); transition-duration: .06s; }
.ap .wdkb img.wflag { width: 50px; height: auto; flex: none; filter: drop-shadow(0 2px 3px #000a); }
.ap .wdkb .wct { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }
.ap .wdkb b { font-size: 16px; } .ap .wdkb small { font-size: 11.5px; color: var(--mute); line-height: 1.35; }
.ap .wdkb em { font-style: normal; font-size: 12px; font-weight: 800; }
.ap .wdkb .wfcost { display: inline-block; margin: 0 4px 0 0; padding: 0 6px; border-radius: 8px; background: #3a2a10; border: 1px solid #c9a45a; color: #f6d27a; font-size: 11.5px; }
.ap .wdkb .wfcost.bad { background: #3a1410; border-color: #c95a4a; color: #ffb0a0; }
.ap .wdkb.press { background: #2a1a10 padding-box; } .ap .wdusk.dawn .wdkb.press { background: #1a2030 padding-box; }
.ap .wdusk .wdk-n { margin: 8px 0 0; font-size: 11.5px; color: var(--mute); }
/* 지난 합 사이의 마지막 때 줄 */
.ap .wdkrow { border-color: #a0602a; background: #2a1a10e6; } .ap .wdkrow.night { border-color: #6a7aa0; background: #1a2030e6; }
.ap .wdkrow .wdkps { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; }
.ap .wdkrow .wdkp em { font-style: normal; font-size: 11px; margin-right: 4px; padding: 0 5px; border-radius: 6px; background: #ffffff1a; }
.ap .wdkrow .wdkp.us em { color: #7fb8f0; } .ap .wdkrow .wdkp.foe em { color: #f09080; }
.ap .wdkrow .wdkp.press { color: #ffd27a; } .ap .wdkrow .wdkp.retreat { color: #ff9a7a; }
.ap .wdkrow .wdkc { margin-left: 4px; font-size: 11px; color: #f6d27a; } .ap .wdkrow .wdkc.bad { color: #ffb0a0; }
/* 깃발 짐작 — 무너지는 선 경고 (우리 붉게 깜박 · 적 금빛) */
.ap .wguess .wgl.wgff { font-weight: 700; } .ap .wguess .wgl.wgff .wgk { min-width: 1.2em; }
.ap .wguess .wgl.wgff.us { color: #ff8a6a; animation: wgff .8s ease-in-out infinite alternate; } .ap .wguess .wgl.wgff.us b { color: #ff6a4a; }
.ap .wguess .wgl.wgff.foe { color: #ffd27a; } .ap .wguess .wgl.wgff.foe b { color: #ffe7a8; }
@keyframes wgff { to { text-shadow: 0 0 8px #ff5a3a; } }
/* 사기 막대의 무너지는 선 — 이름표 */
.ap .ws .wn .brkl { font-size: .92em; font-weight: 800; color: #ffa486; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .ap .wclk li.ck-now, .ap .wclk.last > b, .ap .wdusk .wdk-sky i, .ap .wguess .wgl.wgff.us { animation: none; } }
/* 컴퓨터 모니터 (넓고 가로로 긴 화면) — 초상·막대는 양옆으로, 전장은 가운데에 크게 (형 10-28: "전투판이 너무 모바일이라 컴퓨터로 하니까 화면이 너무 작네") */
@media (min-width: 1100px) and (min-aspect-ratio: 5/4) {
  .ap .wr .wrbox { max-width: min(1760px, 96vw); }
  .ap .wr .wtop { display: grid; grid-template-columns: minmax(250px, 19%) minmax(0, 1fr) minmax(250px, 19%); grid-template-rows: auto auto auto minmax(0, 1fr); column-gap: 22px; height: calc(100dvh - 132px - env(safe-area-inset-bottom)); min-height: 0; }
  .ap .wr .wtop > .wrh, .ap .wr .wtop > .wclk { grid-column: 1 / -1; }
  .ap .wr .wtop > .wvs { display: contents; }
  .ap .wr .wtop .wvs > .ws.us { grid-column: 1; grid-row: 3 / 5; align-self: center; }
  .ap .wr .wtop .wvs > .ws.foe { grid-column: 3; grid-row: 3 / 5; align-self: center; }
  .ap .wr .wtop .wvs > .vs { display: none; }
  .ap .wr .wtop > .wterr { grid-column: 2; grid-row: 3; }
  .ap .wr .wtop > .wfield { grid-column: 2; grid-row: 4; min-height: 0; height: auto !important; }
  .ap .wr .wtop .wpf { --pf: min(220px, 15vw); }
  .ap .wr .wtop .wf2s .tk { height: clamp(34px, 5.6cqw, 88px); } .ap .wr .wtop .wf2s .tk.wsp.k-horse, .ap .wr .wtop .wf2s .tk.wsp.k-boat { height: clamp(46px, 7.4cqw, 116px); }
  .ap .wr .wtop .wfield .tp { height: clamp(26px, 5.2cqw, 80px); }
  .ap .wfpop { width: 400px; }
}
@media (prefers-reduced-motion: reduce) { .ap .wr *, .ap .warfx, .ap .warfx * { animation-duration: .01s !important; animation-delay: 0s !important; transition: none !important; } }
`

/** 싸움이 열리는 판 — 싸움터 그림 · 양쪽 깃발과 장수 · 이름 · 누가 쳐들어왔나 · 세기 막대 · 어느 나라와 싸우는 중인가 */
export function openHtml(prev: Realm, after: Realm, l: BattleLine, me: string, art: string, us: number, them: number): string {
  const weAtk = l.atkFaction === me
  const atkF = l.atkFaction ?? prev.armies[l.attacker]?.faction
  const ourF = weAtk ? atkF : l.defender
  const foeF = weAtk ? l.defender : atkF
  const fname = (f: string | undefined): string => (f !== undefined ? (after.factions[f]?.name ?? '?') : '?')
  const st = l.start
  const ourHero = st?.heroes[weAtk ? 0 : 1] ?? null
  const foeHero = st?.heroes[weAtk ? 1 : 0] ?? null
  const hname = (id: string | null, f: string | undefined): string => (id !== null ? (prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '?') : tr('war.wartip.21', { fname: fname(f) }))
  const color = (f: string | undefined): string => (f !== undefined ? (FACTION_ART[f]?.color ?? '#ccc') : '#ccc')
  const emb = (f: string | undefined): string => {
    const e = flagIcon(f)
    return e !== undefined ? `<img class="woe" src="${art}icon/${e}.png" alt="">` : ''
  }
  const place = after.nodes[l.node]?.name ?? prev.nodes[l.node]?.name ?? ''
  const foe = fname(foeF)
  const sub = l.field === true ? tr('war.openhtml.1', { foe })
    : weAtk ? tr('war.openhtml.2', { place })
    : tr('war.openhtml.3', { foe, place })
  const ground = warGround(prev, l)
  const SOLS = new Set(['spear', 'shield', 'bow', 'crossbow', 'horse', 'pike', 'boat', 'axe', 'marine'])
  const seaWar = warGround(prev, l) === 'sea'
  const mixHtml = (i: 0 | 1): string => {
    const mx = Object.entries(i === 1 ? splitMilitia(st?.mix?.[i] ?? {}, l.militia) : st?.mix?.[i] ?? {}).filter(([, v]) => (v ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    return mx.length > 0 ? `<div class="womix">${mx.map(([k, v]) => `<span><img src="${art}icon/sol-${SOLS.has(solArt(k, seaWar)) ? solArt(k, seaWar) : 'spear'}.png" alt=""><b>${esc(k === 'militia' ? tr('war.wartip.27') : UNIT_NAME[k as keyof typeof UNIT_NAME] ?? k)}</b>${(v ?? 0).toLocaleString('ko-KR')}</span>`).join('')}</div>` : ''
  }
  const side = (cls: string, f: string | undefined, hero: string | null, n: number, fallback: string, i: 0 | 1): string =>
    `<div class="wosd ${cls}" style="--c:${color(f)}">${emb(f)}<span class="wpf big">${face(hero, art, fallback)}<i></i></span><b>${esc(hname(hero, f))}</b><span>${tr('war.openhtml.4', { fname: esc(fname(f)), n: n.toLocaleString('ko-KR') })}</span>${mixHtml(i)}</div>`
  const share = Math.round((us / Math.max(1, us + them)) * 100)
  // 땅 — 그림 칩으로 (형 10-25: "지형정보라던가 이런것도 이미지나 아이콘으로") · 진군 이야기는 맨 아래 마지막으로 (형: "대로로 당당히 다가섰다 이거는 vs 화면 하단에 마지막 오브젝트로")
  // 누가 치나 — 우리의 공격·기습 / 적의 침략·기습 / 길 위에서 맞닥뜨림 (형 10-25: "침략은 내가 공격하는것도 있잖아")
  const sneak = l.ambush !== 'none'
  const kindWord = l.field === true ? tr('war.openhtml.5') : weAtk ? (sneak ? tr('war.warkind.2') : tr('war.openhtml.6')) : (sneak ? tr('war.warkind.3') : tr('war.openhtml.7'))
  const chips = terrChips(prev, l, me, foe)
  const ap = chips.find((c) => c.k === 'ap')
  const land = chips.filter((c) => c.k !== 'ap')
  const D = P.realm.warOpenCount + 0.6
  const t0 = 1.5
  const terr = land.length > 0 ? `<div class="woterr">${land.map((c, i) => `<div class="wotc${c.who !== '' ? ` ${c.who}` : ''}" style="--i:${i}"><img src="${art}icon/${c.icon}.png" alt=""><span><b>${esc(c.name)}</b>${c.who === 'us' ? `<em>${tr('war.wartip.2')}</em>` : c.who === 'foe' ? `<em>${tr('war.wartip.3')}</em>` : ''}<small>${esc(c.line)}</small></span></div>`).join('')}</div>` : ''
  const lastAt = t0 + land.length * 0.22 + 0.25
  const intro = l.field === true ? tr('war.introline.1') : (ap?.line ?? '')
  return `<div class="wob" style="background-image:url('${warBg(art, ground, !weAtk)}');animation-duration:${D}s"></div><div class="wofl"></div><div class="wocol">`
    + `<div class="wohead"><b>${esc(warName(after, l))}</b><span>${esc(sub)}</span></div>`
    // 병종 짜임은 [공격, 지킴] 순으로 적혀 있다 — 우리가 지키는 싸움에서 0·1 을 그대로 썼더니 우리 칸에 적의 짜임이 떴다 (형 11-01: "군사구성 나랑 적이 반대로")
    + `<div class="woin">${side('us', ourF, ourHero, us, UNIT_ICON.spear, sideIdx(weAtk).us)}<div class="wom"><img class="wox" src="${art}ui/vs.png" alt="VS"></div>${side('foe', foeF, foeHero, them, UNIT_ICON.shield, sideIdx(weAtk).foe)}</div>`
    + `<div class="wofoot"><div class="wobar"><i class="us" style="width:${share}%"></i><i class="foe" style="width:${100 - share}%"></i></div>`
    + `<em class="${weAtk ? 'us' : 'foe'}">${tr('war.openhtml.8', { kindWord: esc(kindWord), foe: esc(foe) })}</em>${terr}`
    + (intro !== '' ? `<div class="wointro${ap !== undefined && ap.who !== '' ? ` ${ap.who}` : ''}" style="--d:${lastAt.toFixed(2)}s">${ap !== undefined ? `<img src="${art}icon/${ap.icon}.png" alt="">` : ''}<p>${esc(intro)}</p></div>` : '')
    + `<b class="wocd" style="--d:${(lastAt + 0.3).toFixed(2)}s"><i>${P.realm.warOpenCount}</i></b></div></div>`
}

/**
 * 전장을 연다 — 이번 계절에 우리가 낄 싸움이 없으면 false (부른 쪽이 바로 넘긴다).
 * 싸움마다 시험 돌림으로 판을 찾고, 다 끝나면 host.done(tactics).
 */
export function openWar(root: HTMLElement, prev: Realm, orders: readonly Order[], host: WarHost): boolean {
  const done: Record<string, Tactic> = {}
  /** 지금 고르는 판 — 합마다의 깃발 · 마지막 때마다의 고름 (해시계) */
  let cur: { key: string; cmds: (Cmd | RoundOrder)[]; dusk: Dusk[] } | null = null
  /** 그 판에 고른 것을 굳힌다 — 판 기록(명령 줄)에 남는 꼴 */
  const tacOf = (key: string): Tactic => (cur?.key === key ? { cmds: [...cur.cmds], ...(cur.dusk.length > 0 ? { dusk: [...cur.dusk] } : {}) } : { cmds: [] })
  /** 지금 고르는 합의 깃발 — 무리마다 */
  let sel: { -readonly [K in keyof RoundOrder]: RoundOrder[K] } = {}
  /** 지금 펼친 무리 탭 — 합마다 처음엔 아직 안 고른 첫 무리 */
  let active: Grp | 'lead' | undefined
  /** 맡긴 싸움을 합마다 풀어 보이는 중 — 여기까지만 보인다 (없으면 끝까지) */
  let upto: number | undefined
  /** 그 차례의 시계 (소리 시계와 따로 — 합마다 소리가 앞의 것을 걷는다) */
  const chain: Array<() => void> = []
  const stopChain = (): void => { for (const cancel of chain.splice(0)) cancel() }
  /** 장면을 누름 — 그 자리 밑에 배속 단추가 있으면 장면은 두고 배속을 바꾼다 (장면이 화면 전체를 덮어 배속 단추를 삼켰다 · 형 11-10) */
  const cutTap = (e: MouseEvent, cut: HTMLElement): void => {
    e.stopPropagation()
    const sb = document.elementsFromPoint(e.clientX, e.clientY).find((x): x is HTMLElement => x instanceof HTMLElement && x.dataset['war'] === 'speed')
    if (sb !== undefined) { sb.click(); return }
    cut.remove()
  }
  let speed: BattleSpeed = 1
  try { speed = battleSpeed(Number(localStorage.getItem(SPEED_KEY))) } catch { /* use the default */ }
  const playback = battlePlayback(P.realm.warPlaybackRate * speed)
  let t = rehearse(prev, orders, done, null, host.me)
  if (t.line === null) return false
  preloadSkillFx(host.art) // 기술 장면 그림을 미리 — 안 구운 그림은 장면에서 빠진다 (skillfx.ts)
  // 각성 장면의 짐승·진각성 초상도 미리 (형 11-10: 각성 연출이 되게 늦게 뜸)
  for (const rd of t.line.rounds ?? []) for (const x of rd.acts ?? []) {
    if (x.c !== 'wake' || x.wake === undefined) continue
    new Image().src = `${host.art}fx/awaken/beast-${ELEM[x.wake].beast}.png`
    const b2 = x.true === true && x.hero !== undefined ? bustOf(x.hero) : undefined
    if (b2 !== undefined && b2 !== null) new Image().src = `${host.art}awaken2-hd/${b2}`
    const f = x.hero !== undefined ? faceFile(x.hero) : undefined
    if (f !== undefined && f !== null) new Image().src = `${host.art}${f}`
  }
  // 싸움 소리도 미리 — 처음 내는 소리는 받기·풀기를 기다려 늦었다: 방진의 쾅이 방패가 내려앉은 뒤에 났다 (형 11-01)
  host.warm?.([...new Set([...Object.values(BATTLE_SFX), ...Object.values(SK_SFX), ...MELEE, ...Object.values(LAYERS).flatMap((ly) => (ly ?? []).map(([f]) => f))])])
  /** 처음 우리 싸움 수 — 머리의 "몇 판" */
  let left = t.left
  /** 이번 합에 고른 장수 기술 — 풀릴 때 초상 장면을 띄운다 */
  let cutLead: Cmd | null = null
  let cutSfx: Array<readonly [number, SkSfx]> | null = null
  /** 그 장면의 외침 — sound() 가 소리 시계를 걷은 뒤에 건다 */
  let cutVoice: string | null = null
  /** 이름 띠를 띄운 판 — 판마다 한 번 */
  let named: string | undefined
  // 배경·효과는 붙박이 층에, 글은 그 위 굴리는 층에 — 굴려도 배경이 안 움직이고, 깃발을 골라도 배경을 다시 깔지 않는다
  // (형 10-23: "전투 스크롤할 때 뒷배경이 자꾸 움직임 · 전투할 때 뭔가 선택하면 깜빡임")
  const ov = document.createElement('div')
  ov.className = 'wr'
  // 첫째 합 밑의 설명·깃발 설명은 「?」를 눌렀을 때만 (형 10-25) — 펼친 채로 두면 다음 싸움에도 펼쳐 둔다
  try { if (localStorage.getItem(HELP_KEY) === '1') ov.classList.add('whelpon') } catch { /* 없으면 접힌 채 */ }
  ov.classList.add('b0') // 새 전투 시험(BATTLE-LIVE 0번)의 안내·반응을 10-28 부터 기본으로 — 스위치 대신 「더 보기」의 연습 싸움으로 시험한다
  ov.innerHTML = '<div class="wbg"></div><div class="wfxl"></div><div class="wsc"></div><div class="wfxt"></div><div class="wwin"></div>'
  const bgEl = ov.querySelector<HTMLElement>('.wbg')!
  const fxEl = ov.querySelector<HTMLElement>('.wfxl')!
  const fxTop = ov.querySelector<HTMLElement>('.wfxt')!
  const sc = ov.querySelector<HTMLElement>('.wsc')!
  const winEl = ov.querySelector<HTMLElement>('.wwin')!
  const rateAnimations = (element = ov): void => {
    for (const animation of element.getAnimations?.({ subtree: true }) ?? []) {
      if (typeof CSSTransition !== 'undefined' && animation instanceof CSSTransition) continue
      if (animation.playbackRate !== playback.rate) animation.updatePlaybackRate(playback.rate)
    }
  }
  root.appendChild(ov)
  // 싸우는 동안 배우기 띠는 숨긴다 (형: "싸우는도중에 하단에 배우기 창 계속 떠있어서 짜증나")
  root.classList.add('war-open')
  const timers: number[] = []
  const beatTimers: Array<() => void> = []
  const afterBeat = (run: () => void, seconds: number): void => {
    beatTimers.push(playback.after(run, seconds * 1000))
  }
  const clearTimers = (): void => {
    for (const x of timers.splice(0)) clearTimeout(x)
    for (const cancel of beatTimers.splice(0)) cancel()
    booked = []
  }
  /** 잡아 둔 소리의 [시작, 끝] — 한꺼번에 warSoundMax 를 넘지 않게 (feel-lens 검토 10-24: 한 합에 13개가 겹쳤다) */
  let booked: Array<readonly [number, number]> = []
  const room = (s: number, len: number): boolean => booked.filter(([a, b]) => a < s + len && b > s).length < P.realm.warSoundMax
  const at = (s: number, name: string, vol: number, rate = 1, dur = 0, low = false): void => {
    const len = dur > 0 ? dur : 1
    if (low && !room(s, len)) return
    booked.push([s, s + len])
    afterBeat(() => { if (document.visibilityState === 'visible') host.ding(name, vol, rate * playback.rate, dur / playback.rate) }, s)
  }

  /**
   * 장수 목소리 (voice.ts) — 판이 열릴 때 · 장수 깃발을 고를 때 · 장수 장면이 튀어나올 때 (형 10-26: "다른 데에서는 아무데서도 장수목소리가 안들리는데. 전투할때도").
   * 너무 잦으면 voiceGate 가 거르고, 탭이 가려져 있으면 안 낸다 (규칙 4)
   */
  const heroById = (id: string | null | undefined): Hero | undefined => (id == null ? undefined : prev.heroes[id] ?? t.after.heroes[id])
  const isRulerHero = (h: Hero): boolean => Object.values(prev.factions).some((f) => f.ruler === h.id)
  /** 내 군주는 나 자신이다 — 대답·「맡기시오」·이김 짐 보고를 내지 않는다 (기술 외침만 · 형 10-29: "내가 나를 부르는 격") */
  const isMe = (h: Hero): boolean => h.faction === prev.player && isRulerHero(h)
  const say = (path: string): void => {
    if (document.visibilityState !== 'visible' || !ov.isConnected || !voiceGate(performance.now())) return
    host.ding(path, P.realm.voiceVol)
  }
  /** 짧은 대답(「네?」 「부르셨습니까?」) */
  const bark = (id: string | null | undefined): void => {
    const hh = heroById(id)
    if (hh !== undefined && !isMe(hh)) say(voicePath(hh, 'tap', isRulerHero(hh)))
  }

  /**
   * 판 끝의 뿔나팔·이김 음악을 이 싸움에서 이미 냈나 — 누르면(건너뛰기·맡긴 싸움 풀기) 걸어 둔 소리가 다 걷혀 대승 음악이 안 나왔다 (형 10-25).
   * 건너뛰어 끝에 닿았으면 못 낸 것만 바로 낸다 (flushEnd)
   */
  let endSeen: { key: string; horn: boolean; music: boolean } = { key: '', horn: false, music: false }
  const endGood = (l: BattleLine): boolean => (l.atkFaction === host.me) === (l.outcome === 'rout' || l.outcome === 'win') && l.outcome !== 'draw'
  const markEnd = (l: BattleLine): void => { if (endSeen.key !== (l.key ?? '')) endSeen = { key: l.key ?? '', horn: false, music: l.outcome === 'draw' } }
  const flushEnd = (): void => {
    const l = t.line
    if (l === null || l.pending !== undefined || document.visibilityState !== 'visible') return
    if ((upto ?? (l.rounds ?? []).length) < (l.rounds ?? []).length) return // 아직 끝이 아니다
    markEnd(l)
    const good = endGood(l)
    if (!endSeen.horn) { endSeen.horn = true; host.ding(good ? BATTLE_SFX.win : BATTLE_SFX.lose, 0.45) }
    if (!endSeen.music) { endSeen.music = true; host.music?.(good ? 'win' : 'lose') }
    sayAutoEnd() // 맡긴 싸움을 건너뛰어 끝에 닿았어도 맡은 장수의 끝말은 한다
  }

  /** 맡긴 싸움 — 맡은 장수가 끝에 한마디 (이김 · 짐 · 비기면 조용히) · 판마다 한 번 */
  let autoEnd: { key: string; hero: Hero; said: boolean } | null = null
  const sayAutoEnd = (): void => {
    const l = t.line
    if (autoEnd === null || autoEnd.said || l === null || (l.key ?? '') !== autoEnd.key || l.outcome === 'draw') return
    autoEnd.said = true
    say(autoVoicePath(autoEnd.hero, endGood(l) ? 'win' : 'lose', isRulerHero(autoEnd.hero)))
  }

  /** 폰 떨림 — 잘됐을 때만 (좋은 합 · 사로잡기 · 이김). 진 쪽 떨림은 헷갈려서 안 쓴다 (형: "공격하거나 잘됐을때로 긍정 피드백 시켜야 하나? 헷갈리니까??") */
  const buzz = (s: number, pattern: number[]): void => {
    if (typeof navigator.vibrate !== 'function') return
    afterBeat(() => { if (document.visibilityState === 'visible') navigator.vibrate(pattern) }, s)
  }
  // 소리 — 깃발 → 맞부딪힘(필살이면 크게) → 마지막 일격 · 이김/짐. 탭이 보일 때만
  const sound = (rd: RoundLog | undefined, weAtk: boolean, end: BattleLine | null): void => {
    clearTimers()
    if (document.visibilityState !== 'visible') return
    if (rd !== undefined) {
      const ourSide = weAtk ? 'a' : 'd'
      const wePushed = weAtk ? rd.push > 0.55 : rd.push < 0.45
      const plan = roundPlan(rd, weAtk)
      // 맞는 순간 하나 — 맞부딪힘 소리 · 떨림 · 흔들림(그림) 이 같은 때 (plan.clash)
      const clashAt = plan.clash
      if (rd.ev === 'capture-ok' && rd.by === ourSide) buzz(clashAt, [30, 50, 30, 50, 70])
      else if (rd.beat === ourSide) buzz(clashAt, [25, 40, 25])
      else if (wePushed) buzz(clashAt, [15])
      // 맞부딪힘 · 큰일 소리를 먼저 잡아 둔다 — 깃발 소리가 넘치면 깃발 쪽이 빠진다
      if (rd.ev === 'capture-ok') at(clashAt, rd.by === ourSide ? BATTLE_SFX.caught : BATTLE_SFX.lose, 0.5, 1, 1)
      if (Object.keys(roundHighlights(rd, end)).length > 0) at(plan.result, BATTLE_SFX.crit, 0.58, 1, 0.45)
      // 깃발 소리 — 그림과 같은 차례·박자로, 앞부분만 짧게 · 적 것은 더 짧고 작게, 자리가 없으면 버린다
      const beat = (c: Cmd, s0: number, vol: number, dur: number, low: boolean): void => {
        if (c === 'volley' || c === 'counter') { for (const [dt, v, rt] of VOLLEY_SHOTS.slice(0, 3)) at(s0 + dt, BATTLE_SFX[c], vol * v, rt, 0.4, low); return }
        // 여러 겹 — 우리 것은 다 겹치고(겹친 만큼 작게), 적 것은 첫 겹만 (자리가 없으면 버린다)
        const ly = LAYERS[c]
        if (ly !== undefined) {
          const ks = low ? ly.slice(0, 1) : ly
          for (const [f, dt] of ks) at(s0 + dt, f, (vol / Math.sqrt(ks.length)) * 1.3, 1, dur + 0.3, low)
          return
        }
        const b = CMD_BEAT[c]
        if (b === undefined) { at(s0, BATTLE_SFX[c], vol, 1, dur, low); return }
        // 방진의 「탱탱」은 끝까지 울린다 — 0.5초에 자르며 0.32초부터 줄였더니 소리가 가장 큰 곳(0.25~0.45초)이 깎여 안 들렸다 (형 10-25)
        const ring = RING_FULL.has(c)
        // 그림(cmdFxHtml)은 제 차례 길이에 맞춰 사이 시각을 K 배로 줄인다 — 소리도 같은 배율로 (성문 통나무 1·3번째 쿵에 맞게). 진이 직접 움직이는 명령(FIELD_CMD)은 그림이 없어 그대로
        const kx = FIELD_CMD.has(c) ? 1 : beatLen(c) / (FX_SPAN[c] ?? 1)
        for (const [dt, v, rt] of b.slice(0, 2)) at(s0 + dt * kx, BATTLE_SFX[c], vol * v * (ring ? P.realm.warRingBoost : 1), rt, ring ? 0 : Math.max(0.25, dur - dt * kx), low)
      }
      for (const b of plan.beats) beat(b.c, b.at, b.ours ? 0.5 : 0.3, b.ours ? P.realm.warBeatDur : P.realm.warFoeBeatDur, !b.ours)
      // 엉긴 앞줄 — 찌르기 컷의 박자에 쇠가 부딪는 소리를 몇 번 흩어 낸다(작게 · 자리가 없으면 버린다). 소리마다 높낮이를 조금씩 (형 10-25: 소리와 동작 박자)
      if ((typeof ov.animate !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) && rd.ev !== 'capture-ok' && rd.ev !== 'retreat') {
        // 여섯을 합마다 다른 자리에서 돌려 — 같은 소리가 줄지어 나지 않게
        const r0 = (rd.na * 97 + rd.nd * 53) | 0
        for (let k = 0; k < P.realm.warMeleeHits; k++) at(clashAt + 0.25 + k * P.realm.warMeleeGap, MELEE[(r0 + k * 2) % MELEE.length]!, 0.22, 0.92 + (k % 3) * 0.06, 0.45, true)
      }
      // 우리가 말로 달려드는 합엔 함성 (돌격은 소리 안에 함성이 섞였다)
      const ours = weAtk ? rd.a : rd.d
      if (ours === 'pursue' || ours === 'flank') at((plan.beats[0]?.at ?? 0) + 0.1, BATTLE_SFX.cry, 0.26, 1, 0.8, true)
    }
    if (end !== null) {
      const good = endGood(end)
      markEnd(end)
      // 마지막 일격 — 한쪽이 무너지거나 사로잡혀 끝난 판의 마지막 합 (전엔 이름만 있고 안 냈다)
      // 판의 끝 — 결과 때에 승리·패배 소리 하나 · 음악은 그 소리가 가라앉은 뒤 (마지막 일격 소리는 맞부딪힘이 맡는다)
      const endAt = (rd !== undefined ? roundPlan(rd, weAtk).result : STAGE_S[2]) + 0.5
      if (!endSeen.horn) afterBeat(() => { if (document.visibilityState === 'visible') { endSeen.horn = true; host.ding(good ? BATTLE_SFX.win : BATTLE_SFX.lose, 0.45) } }, endAt)
      if (!endSeen.music) afterBeat(() => { endSeen.music = true; host.music?.(good ? 'win' : 'lose') }, endAt + 0.6)
      // 이겼다 — 부우웅 크게 (듀오링고처럼)
      if (good) buzz(endAt, end.outcome === 'rout' ? [60, 40, 60, 40, 60, 40, 120, 60, 300] : [...WIN_BUZZ])
    }
  }

  /** 싸움이 열린다 — 이름 띠 · 북 두 번 · 종 (계절 띠와 같은 길: 애니메이션이 끝나면 지운다) */
  const band = (l: BattleLine): void => {
    if (named === l.key) return
    named = l.key
    host.music?.('war')
    // 여는 화면엔 장수 대답(「네」)을 내지 않는다 — 부른 적 없는데 대답하는 꼴 (형 10-27: "전투 개시할 때 시작 화면에서 「네」 소리 — 필요 없지 않나") · 기술 외침은 그대로
    const weAtk = l.atkFaction === host.me
    const st = l.start
    const us = st !== undefined ? st.men[weAtk ? 0 : 1] : 0
    const them = st !== undefined ? st.men[weAtk ? 1 : 0] : 0
    const el = document.createElement('div')
    el.className = 'wopen'
    // 10 9 8 … 1 — 다 세면 걷힌다 (형 10-25: "누르면 넘어간다가 아니라 10 9 8 7 6 5 4 3 2 1") · 누르면 바로
    const N = P.realm.warOpenCount
    el.style.animationDuration = `${N + 0.6}s`
    el.innerHTML = openHtml(prev, t.after, l, host.me, host.art, us, them)
    const cd = el.querySelector<HTMLElement>('.wocd i')
    let shownN = N
    // 셈은 걷힘 애니메이션의 시계를 읽는다. 탭이 숨으면 셈 타이머도 멈췄다가 보이면 다시 (CLAUDE 규칙 4)
    let tick = 0
    const step = (): void => {
      if (!el.isConnected) { stop(); document.removeEventListener('visibilitychange', vis); return }
      const a = el.getAnimations().find((x) => (x as CSSAnimation).animationName === 'woout')
      const n = Math.max(1, Math.ceil(N - Number(a?.currentTime ?? 0) / 1000))
      if (n !== shownN && cd !== null) {
        shownN = n
        cd.textContent = String(n)
        cd.classList.remove('tk')
        void cd.offsetWidth
        cd.classList.add('tk')
      }
    }
    const run = (): void => { if (tick === 0 && document.visibilityState === 'visible') tick = window.setInterval(step, 100) }
    const stop = (): void => { if (tick !== 0) { window.clearInterval(tick); tick = 0 } }
    const vis = (): void => { if (document.visibilityState === 'visible') run(); else stop() }
    document.addEventListener('visibilitychange', vis)
    run()
    const gone = (): void => { stop(); document.removeEventListener('visibilitychange', vis); el.remove() }
    el.addEventListener('animationend', (e) => { if (e.target === el) gone() })
    el.addEventListener('click', (e) => { e.stopPropagation(); gone() })
    root.appendChild(el)
    rateAnimations(el)
    if (document.visibilityState === 'visible') {
      at(0, BATTLE_SFX.openDrum, 0.5)
      at(0.38, BATTLE_SFX.openDrum, 0.5)
      at(0.9, BATTLE_SFX.openBell, 0.45)
      at(0.95, BATTLE_SFX.cry, 0.4)
      buzz(0.9, [40, 30, 90])
    }
  }

  /** 그린 차례 — 다음 틀에 미룬 되감기가 그 사이 또 그렸으면 걷히게 */
  let paintGen = 0
  let stopStrikes: (() => void) | undefined
  /** 위 띠 높이(--wtoph) — 바뀔 때만 적는다 (뿌리에 변수를 적으면 판 전체 스타일을 다시 셈한다) */
  let topH = -1
  const paintNow = (anim: boolean, endNow = false): void => {
    stopStrikes?.()
    stopStrikes = undefined
    const strikePaint = ++paintGen
    const l = t.line!
    const shown = upto ?? (l.pending !== undefined ? l.pending.round : (l.rounds ?? []).length)
    const more = l.pending === undefined && shown < (l.rounds ?? []).length
    const tpl = document.createElement('template')
    tpl.innerHTML = warHtml(prev, t.after, l, host.me, host.art, shown, anim, left, sel, active, more, speed)
    const bg = tpl.content.querySelector<HTMLElement>('.wbg')
    if (bg !== null) {
      if (bgEl.className !== bg.className) bgEl.className = bg.className
      if (bgEl.style.backgroundImage !== bg.style.backgroundImage) bgEl.style.backgroundImage = bg.style.backgroundImage
      bg.remove()
    }
    // 화살은 글판 위로 날아간다 — 흙먼지만 뒤에 (형 10-23: "배경이 막 화살 날아다니는 거 같은데 보드판 뒤로 밀려서 안 보임")
    fxTop.replaceChildren(...tpl.content.querySelectorAll('.wfx-cmd'))
    // 바뀐 곳만 고친다 — 합마다 통째로 갈아 끼워 초상·병사·깃발·배경 먼지 그림이 새로 만들어지며 화면 전체가 깜빡였다 (형 10-25: "전투할때 전부 화면이 엄청 깜빡")
    // 꼴로 맞춘다(keyed) — 가운데에 하나(<style>·성벽 둘째 장·꽂힌 화살)가 끼면 그 뒤 요소가 한 칸씩 밀려 남의 그림으로 덮어써지며 낱낱이 깜빡였다 (형 10-31)
    const rewind = typeof sc.getAnimations === 'function'
    const had = anim && rewind ? new Set([...fxEl.getAnimations({ subtree: true }), ...sc.getAnimations({ subtree: true })]) : null
    const fxf = document.createDocumentFragment()
    fxf.append(...tpl.content.querySelectorAll('.wfx'))
    morphInto(fxEl, fxf, true)
    // 진(data-f)·고른 길(data-l)이 바뀌면 병사·장수가 left 전환으로 미끄러진다 — 그 .5초 동안 걷기 칸을 돌린다 (형 11-11: "선 채로 날아다님")
    const formBefore = new Map([...sc.querySelectorAll<HTMLElement>('.wf2s')].map((e) => [e, `${e.dataset['f'] ?? ''}|${e.dataset['l'] ?? ''}`] as const))
    morphInto(sc, tpl.content, true)
    for (const e of sc.querySelectorAll<HTMLElement>('.wf2s')) {
      const was = formBefore.get(e)
      if (was === undefined || was === `${e.dataset['f'] ?? ''}|${e.dataset['l'] ?? ''}`) continue
      e.classList.add('mv')
      window.setTimeout(() => e.classList.remove('mv'), 600)
    }
    // 살려 둔 요소의 연출(막대·흔들림·진·다음 합 판)은 새 합이 풀릴 때만 처음부터 다시 — 그 연출만 되감는다.
    // 전엔 통째로 animation:none 을 걸었다 풀어 수백 개가 한꺼번에 다시 돌았다: 늘 도는 불티·먼지·물결·숨쉬기까지 처음으로 튀고
    // (불티는 투명에서 다시 떠 낱낱이 깜빡) · 연출 없이 다시 그릴 때도 병사가 다시 걸어 들어왔다 (형 10-31: 합이 풀릴 때·끝날 때 낱낱이 깜빡)
    const again = [fxEl, ...sc.querySelectorAll<HTMLElement>('.wvs, .wfield, .wnext, .wend')]
    if (had !== null) {
      // 되감기는 다음 틀 처음에 — 여기서 getAnimations 를 부르면 막 바꾼 판 전체의 스타일을 그 자리에서 셈하고, 아래(위 띠 높이 재기·보석 자리)에서
      // 또 셈해 합이 넘어갈 때마다 폰에서 0.3~0.6초 멈췄다 (형 11-03: "아직도 전투할 때 버벅" · tools/war-perf.ts). 틀 처음엔 그 틀의 셈 한 번으로 끝난다
      const gen = strikePaint
      requestAnimationFrame(() => {
        if (gen !== paintGen || ov.classList.contains('fast')) return
        for (const e of again) {
          if (!e.isConnected) continue
          for (const a of e.getAnimations({ subtree: true })) {
            if (!had.has(a)) continue // 이번에 새로 걸린 연출은 스스로 처음부터 돈다
            const tm = a.effect?.getTiming()
            // 늘 도는 것(끝없고 기다림 없이 바로 도는 것)은 그대로 둔다 — 불티·먼지·물결·숨쉬기·깃발 손짓
            if (tm === undefined || (tm.iterations === Infinity && Number(tm.delay ?? 0) <= 0)) continue
            a.currentTime = 0
          }
        }
      })
    } else if (!rewind) {
      // getAnimations 가 없는 옛 브라우저 — 옛 길(한 틀 안에서 껐다 켠다)
      for (const e of again) e.classList.add('wrs')
      void sc.offsetWidth
      for (const e of again) e.classList.remove('wrs')
    }
    const strikeRound = anim ? l.rounds?.[shown - 1] : undefined
    if (strikeRound !== undefined) {
      const weAtk = l.atkFaction === host.me
      const plan = roundPlan(strikeRound, weAtk)
      requestAnimationFrame(() => {
        if (strikePaint !== paintGen || !ov.isConnected || ov.classList.contains('fast')) return
        const field = sc.querySelector<HTMLElement>('.wfield.play')
        if (field === null) return
        let lastSound = -Infinity
        let hitCount = 0
        // 사로잡기가 먹힌 합 — 다른 무리는 여느 합처럼 맞붙고, 그 사이 잡는 장수가 뛰어나가 적장을 이고 온다 (battle-capture.ts · 형 11-08).
        // 맞부딪힘 연출은 .wgen.gsp:not(.gdown) 을 배우로 고르므로, 고르는 그 순간에만 두 장수에 gdown 을 걸어 다른 무리의 칼끝에서 뺀다
        const cast = captureCast(field, strikeRound, weAtk)
        const spared = cast === null ? [] : [cast.capturer, cast.target]
        for (const n of spared) n.classList.add('gdown')
        const stopFight = playBattleStrikes(field, cast === null ? strikeRound : withoutCapture(strikeRound), plan.beats, plan.clash, plan.result, weAtk, host.art, playback, (kind) => {
          const now = playback.now()
          if (now - lastSound < 95) return
          lastSound = now
          const rate = playback.rate
          const sound = kind === 'heavy' ? BATTLE_SFX.clash : MELEE[hitCount++ % MELEE.length]!
          host.ding(sound, kind === 'heavy' ? .32 : kind === 'melee' ? .24 : .14, rate, .26 / rate)
        })
        for (const n of spared) n.classList.remove('gdown')
        const stopCarry = cast === null ? undefined : playCapture(field, cast, plan.clash, playback)
        stopStrikes = () => { stopFight(); stopCarry?.() }
      })
    }
    // 싸움이 끝났다 — 이겼으면 「승리」가 쾅, 졌으면 「패배」가 내려앉는다 (형: "승리했다는 이펙트가 더 확실히")
    winEl.replaceChildren()
    if ((anim || endNow) && !more && l.pending === undefined && l.outcome !== 'draw') {
      const atkWon = l.outcome === 'rout' || l.outcome === 'win'
      const good = (l.atkFaction === host.me) === atkWon
      const word = good ? (l.outcome === 'rout' || l.outcome === 'routed' ? tr('war.openwar.1') : tr('war.openwar.2')) : (l.outcome === 'rout' || l.outcome === 'routed' ? tr('war.openwar.3') : tr('war.openwar.4'))
      // 마지막 합의 연출(장수 장면 · 깃발 하나씩 · 맞부딪힘 · 막대)이 다 끝난 뒤에 — 늘 3.3초에 떠서 싸우는 도중에 승패가 먼저 나왔다 (형 10-24)
      const lr = anim ? (l.rounds ?? [])[shown - 1] : undefined
      const endAt = (lr !== undefined ? roundPlan(lr, l.atkFaction === host.me).result : endNow ? 0 : STAGE_S[2]) + 0.9
      winEl.innerHTML = winFxHtml(word, '', endAt, !good, true, l.outcome === 'rout' || l.outcome === 'routed', `${host.art}ui/win-logo.png`)
    }
    requestAnimationFrame(() => { if (strikePaint === paintGen && ov.isConnected) rateAnimations() })
  }

  const draw = (anim: boolean, endNow = false): void => {
    const l = t.line!
    const shown = upto ?? (l.pending !== undefined ? l.pending.round : (l.rounds ?? []).length)
    const more = l.pending === undefined && shown < (l.rounds ?? []).length
    ov.classList.toggle('slow', anim)
    ov.classList.remove('fast')
    warmWinLogos(`${host.art}ui/win-logo.png`) // 끝에 쾅 박힐 로고를 미리 풀어 둔다 (한 번만)
    closePop()
    hideTip()
    animating = false // 앞 합의 「연출 중」이 남지 않게 — 이 합이 풀리면 아래에서 다시 건다
    paintNow(anim, endNow)
    // 장수 기술 — 고른 합이면 그 장수가 튀어나온다
    if (anim && cutLead !== null) {
      const rd = (l.rounds ?? [])[shown - 1]
      const weAtk = l.atkFaction === host.me
      const ourS = weAtk ? 'a' : 'd'
      const act = rd?.acts?.find((x) => x.g === 'lead' && x.s === ourS)
      const c: Cmd = act?.c ?? cutLead
      // 비기면 그 합의 행동에 적힌 비기 — 없으면 나선 장수의 비기 (전엔 비어 짧은 대답 「어머」가 나왔다 · 형 10-27)
      // 사로잡기의 act.hero 는 사로잡힌 적장이다 — 외치는 이는 우리 장수 (형 10-27: "남자 장수인데 여자 목소리") · 비기·겨루기는 나선 우리 장수
      const mine = act?.c === 'capture' ? undefined : act?.hero
      const leadH = heroById(mine ?? l.start?.heroes[weAtk ? 0 : 1] ?? null)
      const ak = c === 'art' ? (act?.art ?? (leadH !== undefined ? heroArt(leadH) : undefined)) : undefined
      // 각성기 — 그 기운에 맞는 장면 뼈대를 빌리고(새 그림 0장) 그 위로 기운의 짐승이 솟았다 사라진다
      const wk = c === 'wake' ? act?.wake : undefined
      const kind: SkillId | undefined = wk !== undefined ? WAKE_CUT[wk] : ak ?? CUT_OF[c]
      const hero = l.start?.heroes[weAtk ? 0 : 1] ?? null
      if (kind !== undefined && hero !== null) {
        // 장면의 얼굴은 나선 장수 (부장이 비기를 쓰면 그 부장) · 사로잡기·물러나기는 총대장
        const actor = mine !== undefined && heroById(mine) !== undefined ? mine : hero
        const name = heroById(actor)?.name ?? ''
        const el = document.createElement('div')
        // 진각성 — 2차 초상 · 이름 앞에 「진」 · 짐승이 둘 (DESIRE §17 · 한 판에 한 번이라 크게)
        const tru = act?.true === true
        const b2 = tru ? bustOf(actor) ?? null : null
        el.innerHTML = skillCutHtml(host.art, kind, b2 !== null ? `../awaken2-hd/${b2}` : faceFile(actor) ?? null, name, wk !== undefined ? `${tru ? `${tr('war.openwar.5')} ` : ''}${WAKE_NAME[wk]}` : ak !== undefined ? ART_NAME[ak] : CMD_NAME[c], skillRes(act?.res))
        const cut = el.firstElementChild as HTMLElement
        if (wk !== undefined) cut.insertAdjacentHTML('beforeend', `<img class="wsk-beast" src="${host.art}fx/awaken/beast-${ELEM[wk].beast}.png" alt="">${tru ? `<img class="wsk-beast b2" src="${host.art}fx/awaken/beast-${ELEM[wk].beast}.png" alt="">` : ''}`)
        if (tru) cut.classList.add('wsk-true')
        cut.addEventListener('animationend', (e) => { if (e.target === cut) cut.remove() })
        cut.addEventListener('click', (e) => cutTap(e, cut))
        ov.querySelector('.wsk')?.remove()
        ov.appendChild(cut)
        cutSfx = skillCues(kind)
        // 나선 장수가 외친다 — 기술이면 그 기술 외침, 북·겨루기·사로잡기면 짧은 대답 (voice.ts · 장수의 목소리 결로)
        const hh = heroById(mine ?? hero)
        if (hh !== undefined) cutVoice = ak !== undefined ? artVoicePath(hh, ak, isRulerHero(hh)) : isMe(hh) ? null : voicePath(hh, 'tap', isRulerHero(hh))
      }
    }
    // 적 장수의 비기·각성기 — 우리가 장수를 내세우지 않은 합에 적이 쓰면 오른쪽에서 핏빛 막으로 (11-08 형: "비기 연출도 더 고민" · 무엇에 당했는지 보이게)
    if (anim && cutLead === null) {
      const rd = (l.rounds ?? [])[shown - 1]
      const weAtk = l.atkFaction === host.me
      // 우리 장수의 각성·비기가 먼저 (맡긴 싸움에선 cutLead 가 없어 우리 각성 장면이 아예 안 떴다 · 형 11-10)
      const ours = rd?.acts?.find((x) => x.g === 'lead' && x.s === (weAtk ? 'a' : 'd') && (x.c === 'wake' || x.c === 'art') && skillRes(x.res) !== 'miss')
      const fa = ours ?? rd?.acts?.find((x) => x.g === 'lead' && x.s === (weAtk ? 'd' : 'a') && (x.c === 'art' || x.c === 'wake'))
      const foeSide = ours === undefined
      const kind: SkillId | undefined = fa === undefined ? undefined : fa.c === 'wake' ? (fa.wake !== undefined ? WAKE_CUT[fa.wake] : undefined) : fa.art
      const actor = fa?.hero ?? l.start?.heroes[foeSide === (weAtk) ? 1 : 0] ?? null
      if (fa !== undefined && kind !== undefined && actor !== null) {
        const el = document.createElement('div')
        const tru = !foeSide && fa.c === 'wake' && fa.true === true
        const b2 = tru ? bustOf(actor) ?? null : null
        const title = fa.c === 'wake' && fa.wake !== undefined ? `${tru ? `${tr('war.openwar.5')} ` : ''}${WAKE_NAME[fa.wake]}` : fa.art !== undefined ? ART_NAME[fa.art] : ''
        el.innerHTML = skillCutHtml(host.art, kind, b2 !== null ? `../awaken2-hd/${b2}` : faceFile(actor) ?? null, heroById(actor)?.name ?? '', title, skillRes(fa.res), foeSide)
        const cut = el.firstElementChild as HTMLElement
        if (!foeSide && fa.c === 'wake' && fa.wake !== undefined) cut.insertAdjacentHTML('beforeend', `<img class="wsk-beast" src="${host.art}fx/awaken/beast-${ELEM[fa.wake].beast}.png" alt="">`)
        if (tru) cut.classList.add('wsk-true')
        cut.addEventListener('animationend', (e) => { if (e.target === cut) cut.remove() })
        cut.addEventListener('click', (e) => cutTap(e, cut))
        ov.querySelector('.wsk')?.remove()
        ov.appendChild(cut)
        cutSfx = skillCues(kind)
      }
    }
    cutLead = null
    sound(anim ? (l.rounds ?? [])[shown - 1] : undefined, l.atkFaction === host.me, (anim || endNow) && l.pending === undefined && !more ? l : null)
    if (cutSfx !== null) { for (const [s, k] of cutSfx) at(s, SK_SFX[k], 0.5); cutSfx = null } // 장수 기술 장면의 소리 — sound() 가 앞의 것을 걷은 뒤에
    // 외침도 sound() 뒤에 건다 — 전엔 앞에 걸어 sound() 의 clearTimers 가 바로 걷어 싸움에서 목소리가 한 번도 안 났다 (형 10-26: "전투할때도")
    if (cutVoice !== null) { const v = cutVoice; afterBeat(() => say(v), P.realm.warVoiceArtS); cutVoice = null }
    // 우리 원군이 처음 닿는 합 — 금빛 카드 한 줄만으론 약했다. 기병이 빛을 몰고 언덕을 달려 내려오는 장면이 화면을 가로지르고 말발굽·함성 (형 11-03: 로한의 기병대 오마주)
    if (anim) {
      const rs = l.rounds ?? []
      const rd = rs[shown - 1]
      const ourS = l.atkFaction === host.me ? 'a' : 'd'
      if (rd?.relief !== undefined && rd.relief.side === ourS && !rs.slice(0, shown - 1).some((x) => x.relief?.side === ourS)) {
        ov.querySelector('.wrlc')?.remove()
        const el = document.createElement('div')
        el.className = 'wrlc'
        el.innerHTML = `<i class="wrlc-img" style="background-image:url('${host.art}event/event-relief-charge.jpg')"></i><i class="wrlc-sweep"></i><div class="wrlc-t"><b>${tr('war.reliefbanner.5')}</b><span>${tr('war.openwar.7', { v1: rd.relief.horse ? `${tr('war.openwar.6')} ` : '', men: rd.relief.men.toLocaleString('ko-KR') })}</span></div>`
        el.addEventListener('animationend', (e) => { if (e.target === el) el.remove() })
        el.addEventListener('click', (e) => { e.stopPropagation(); el.remove() })
        ov.appendChild(el)
        at(0, snd('cmd_horse'), 0.55)
        at(0.35, BATTLE_SFX.cry, 0.5)
        at(0.7, BATTLE_SFX.charge, 0.45)
        buzz(0.35, [30, 40, 60])
      }
    }
    if (!anim && !endNow) band(l)
    // 싸운다를 누르면 — 이번 합이 위 카드 바로 밑에 오게, 판이 끝났으면 결과가 다 풀린 뒤 결과로 (형 10-23: "싸운다 누르면 스크롤 맨 위로 가는 게 맞나?")
    // 붙박이 위 카드에 가리지 않게 — 재는 건 다음 틀 처음에 (여기서 재면 막 바꾼 판을 그 자리에서 한 번 더 셈한다 · 형 11-03 버벅임)
    requestAnimationFrame(() => {
      const h = (sc.querySelector<HTMLElement>('.wtop')?.offsetHeight ?? 170) + 8
      if (h !== topH) { topH = h; ov.style.setProperty('--wtoph', `${h}px`) }
    })
    if (anim) {
      const lr = (l.rounds ?? [])[shown - 1]
      const res = lr !== undefined ? roundPlan(lr, l.atkFaction === host.me).result : STAGE_S[2]
      // 화면을 굴리지 않는다 — 합 결과는 전장 위에 떴다 사라지고, 결과·다음 합 판은 제자리에 (형 10-28: "폰 게임에서 슬라이드는 피할 수 있으면 피해야")
      if (more || l.pending === undefined) { /* 다음 합이 곧 온다 · 끝났으면 결과 판이 아래에 붙는다 */ }
      else {
        // 해가 진다 — 마지막 때를 묻는 판이 뜨는 때에 종 (밤 싸움이면 새벽)
        if (l.pending.dusk !== undefined) { at(res + 0.6, BATTLE_SFX.openBell, 0.5); buzz(res + 0.6, [20, 40, 20]) }
        animating = true
        afterBeat(() => { syncField(true); syncReady() }, res + 0.5)
      }
    } else if (endNow) {
      // 마지막 때에 판이 끝났다 — 결과 판은 아래에 붙는다 (굴리지 않는다)
    } else {
      sc.scrollTop = 0
      syncField()
    }
    syncReady()
  }

  /** 이번 합이 풀리는 중 — 다음 합을 고르는 판은 아직 투명하다. 그동안은 진을 되돌리지 않고 깃발 누르기도 받지 않는다 */
  let animating = false
  /** 깃발에 손을 올린 동안 — 그 진을 미리 보인다 (마우스만) */
  let peek: { g: Grp | 'lead'; c: Cmd } | null = null
  /** 전장의 진을 고르는 것에 맞춘다 — 우리는 고른 것(손을 올렸으면 그것), 적은 낌새. 지금 고르는 무리가 진에서 빛난다 */
  const syncField = (force = false): void => {
    // 합이 풀리는 동안엔 손대지 않는다 — 보이지 않는 깃발 위로 마우스가 지나가도 맞부딪힘이 중간에 끊겼다 (재검토 10-25)
    if (animating && !force) return
    animating = false
    const f = sc.querySelector<HTMLElement>('.wfield')
    if (f === null) return
    f.classList.remove('play')
    stopStrikes?.()
    stopStrikes = undefined
    active ??= sc.querySelector<HTMLElement>('.wgt.on[data-g]')?.dataset['g'] as Grp | 'lead' | undefined // 합 처음엔 펼친 탭의 무리가 빛나게
    if (f.dataset['act'] !== (active ?? '')) f.dataset['act'] = active ?? ''
    const us = f.querySelector<HTMLElement>('.wf2s.us')
    if (us !== null) setForm(us, peek !== null ? { ...sel, [peek.g]: peek.c } : sel)
    const hint = t.line?.pending?.hint ?? null
    const foe = f.querySelector<HTMLElement>('.wf2s.foe')
    if (foe !== null) setForm(foe, hint !== null ? { front: hint } : {})
    placeGem()
    window.setTimeout(placeGem, P.realm.warGemSettleMs) // 병사가 걸어 들어오는 동안 재면 엉뚱한 데 선다 (형 10-28: 시작 때 보석이 창병 위에 없다)
  }

  /**
   * 깃발 짐작을 고른 것에 맞춘다 — 펼친 무리의 깃발과 「이대로 싸우면」만 셈한다 (한 합 동안 셈한 것은 다시 쓴다).
   * 다른 무리를 바꾸면 이 깃발의 짐작도 바뀐다 (돌격에 말이 함께 들이치느냐 같은 것)
   */
  /** 그 무리의 깃발마다 짐작 — 깃발 판에 옮기기 전에도 (숨은 무리 칸이어도) */
  const fillPane = (pane: ParentNode): void => {
    const at = t.line?.pending?.look
    if (at === undefined) return
    for (const b of pane.querySelectorAll<HTMLElement>('[data-war="pick"]')) {
      const o = withPick(sel, b.dataset['g'] as Grp | 'lead', b.dataset['c'] as Cmd)
      const k = orderKey(o)
      const old = b.querySelector<HTMLElement>('.wguess')
      if (old === null || old.dataset['k'] === k) continue
      old.outerHTML = lookHtml(lookFor(at, o, true), k)
    }
  }
  const fillLooks = (): void => {
    const at = t.line?.pending?.look
    if (at === undefined) return
    for (const b of sc.querySelectorAll<HTMLElement>('.wgrp:not([hidden]) [data-war="pick"]')) {
      const o = withPick(sel, b.dataset['g'] as Grp | 'lead', b.dataset['c'] as Cmd)
      const k = orderKey(o)
      const old = b.querySelector<HTMLElement>('.wguess')
      if (old === null || old.dataset['k'] === k) continue
      old.outerHTML = lookHtml(lookFor(at, o, true), k)
    }
    const sum = sc.querySelector<HTMLElement>('.wlsum')
    if (sum !== null) {
      const tabs = [...sc.querySelectorAll<HTMLElement>('.wgt[data-g]')]
      const all = tabs.every((tb) => sel[tb.dataset['g'] as Grp | 'lead'] !== undefined)
      const k = all ? orderKey(sel) : ''
      if (sum.dataset['k'] !== k) {
        sum.dataset['k'] = k
        sum.innerHTML = lookSumHtml(at, sel, all, true)
      }
    }
  }

  /** 무리 탭 · 깃발판 · 「전투 개시」를 고른 것에 맞춘다 — 다시 그리지 않고 (다시 그리면 배경·그림이 깜빡였다) */
  const syncCmd = (): void => {
    active ??= sc.querySelector<HTMLElement>('.wgt.on[data-g]')?.dataset['g'] as Grp | 'lead' | undefined
    const tabs = [...sc.querySelectorAll<HTMLElement>('.wgt[data-g]')]
    for (const tb of tabs) {
      const g = tb.dataset['g'] as Grp | 'lead'
      const c = sel[g]
      tb.classList.toggle('on', g === active)
      tb.classList.toggle('done', c !== undefined)
      const chip = tb.querySelector<HTMLElement>('.wgs')
      const src = c !== undefined ? sc.querySelector<HTMLElement>(`[data-war="pick"][data-g="${g}"][data-c="${c}"]`) : null
      if (chip === null) continue
      if (src !== null) {
        // 있던 깃발 그림은 살려 두고 주소만 — 고를 때마다 새로 만들어 깜빡였다 (형 10-31)
        const img = chip.querySelector('img') ?? document.createElement('img')
        const want = src.querySelector('img.wflag')?.getAttribute('src') ?? ''
        if (img.getAttribute('src') !== want) img.setAttribute('src', want)
        img.alt = ''
        chip.className = 'wgs'
        const word = src.querySelector('.wct b')?.textContent ?? ''
        const tx = chip.childNodes[1]
        if (chip.firstChild === img && chip.childNodes.length === 2 && tx?.nodeType === Node.TEXT_NODE) { if (tx.nodeValue !== word) tx.nodeValue = word }
        else chip.replaceChildren(img, word)
      } else {
        chip.className = 'wgs none'
        chip.textContent = tr('war.warhtml.68')
      }
    }
    for (const pn of sc.querySelectorAll<HTMLElement>('.wgrp[data-g]')) pn.hidden = pn.dataset['g'] !== active
    const go = sc.querySelector<HTMLButtonElement>('[data-war="go"]')
    if (go !== null) {
      const k = tabs.filter((tb) => sel[tb.dataset['g'] as Grp | 'lead'] !== undefined).length
      go.toggleAttribute('aria-disabled', k < tabs.length) // 흐리게만 · 누르면 안 고른 무리로 (UX ⑨)
      if (k < tabs.length) go.setAttribute('aria-disabled', 'true')
      go.innerHTML = goWord(k, tabs.length)
    }
    syncReady()
    // 짐작은 고른 표가 먼저 보인 뒤에 — 폰에서 누름이 늦게 느껴지지 않게
    timers.push(window.setTimeout(fillLooks, 0))
    syncField()
  }

  const finish = (): void => {
    clearTimers()
    stopStrikes?.()
    stopStrikes = undefined
    stopChain()
    ov.remove()
    root.classList.remove('war-open')
    host.done({ ...done })
  }

  /** 지금 판을 다 골랐다 — 그 명령으로 굳히고 결과를 보인다 (남은 합은 맡긴다) */
  const settle = (endNow = false): void => {
    const key = cur?.key ?? t.line?.key
    if (key === undefined) return
    done[key] = tacOf(key)
    cur = null
    sel = {}
    t = rehearse(prev, orders, done, null, host.me, key)
    if (t.line === null) advanceTo()
    else draw(!endNow, endNow)
  }

  /**
   * 장수에게 맡긴다 — 그 장수의 지휘 버릇 장면 뒤 남은 합을 하나씩 풀어 보인다. 끝 합이 다 풀린 뒤에 승패
   * (형 10-24: "자동전투는 장수 특성에 따라 효과 나오게" — 전엔 마지막 합만 보이고 끝났다). 아무 데나 누르면 끝까지 건너뛴다
   */
  const autoPlay = (): void => {
    const l0 = t.line
    const key = cur?.key ?? l0?.key
    if (l0 === null || key === undefined) return
    gem.hidden = true // 맡기면 보석·아래 띠를 걷는다
    ready.hidden = true
    const from = l0.pending?.round ?? (l0.rounds ?? []).length
    done[key] = tacOf(key)
    cur = null
    sel = {}
    active = undefined
    t = rehearse(prev, orders, done, null, host.me, key)
    const l = t.line
    if (l === null) { advanceTo(); return }
    const R = (l.rounds ?? []).length
    stopChain()
    if (R <= from) { upto = undefined; draw(true); return }
    const weAtk = l.atkFaction === host.me
    // 고르던 판은 걷고 지난 합까지만 — 장수 장면이 덮는 동안
    upto = from
    paintNow(false)
    let t0 = 0
    const hero = l.start?.heroes[weAtk ? 0 : 1] ?? null
    if (hero !== null) {
      const hh = prev.heroes[hero] ?? t.after.heroes[hero]
      const [sn, sl] = styleWord(hh)
      const box = document.createElement('div')
      // 맡긴 장수가 군주에게 「제게 맡겨 주시옵소서!」 · 내 군주가 몸소 이끌면 군사들에게 외친다 (형 10-29: "전투 일임하면 '내게 맡겨라' 라고 반말")
      box.innerHTML = cutHtml(host.art, hero, hh?.name ?? '', `${sn}: ${sl}`, hh !== undefined && isMe(hh) ? tr('war.openwar.8') : tr('war.openwar.9'))
      const cut = box.firstElementChild as HTMLElement
      cut.addEventListener('animationend', (e) => { if (e.target === cut) cut.remove() })
      cut.addEventListener('click', (e) => { e.stopPropagation(); cut.remove() })
      ov.appendChild(cut)
      at(0.28, BATTLE_SFX.openDrum, 0.45)
      t0 = P.realm.warAutoCutS
      // 맡은 장수가 「싸움은 제게 맡기시오!」 — 장면이 튀어나올 때 · 끝나면 이김·짐 한마디 (형 10-27)
      if (hh !== undefined && !isMe(hh)) {
        autoEnd = { key: l.key ?? '', hero: hh, said: false }
        afterBeat(() => say(autoVoicePath(hh, 'go', isRulerHero(hh))), P.realm.warVoiceArtS)
      }
    }
    const step = (k: number, after: number): void => {
      const cancel = playback.after(() => {
        chain.splice(chain.indexOf(cancel), 1)
        upto = k < R ? k : undefined
        draw(true)
        const rd = (l.rounds ?? [])[k - 1]
        if (k < R && rd !== undefined) step(k + 1, roundPlan(rd, weAtk).result + P.realm.warAutoGapS)
        else if (rd !== undefined) afterBeat(sayAutoEnd, roundPlan(rd, weAtk).result + P.realm.warAutoEndVoiceS)
      }, after * 1000)
      chain.push(cancel)
    }
    step(from + 1, t0)
  }

  /** 다음 우리 싸움으로 — 없으면 마무리 */
  const advanceTo = (): void => {
    t = rehearse(prev, orders, done, null, host.me)
    if (t.line === null) {
      finish()
      return
    }
    left = t.left
    draw(false)
  }

  // ── 전장을 만진다 (형 10-25: "적군의 수나 정보도 그 동적 오브젝트를 터치하거나 커서 올려둘 때 정보 · 내 병사 컨트롤도 그 맵에서 선택하고") ──
  // 정보창: 손가락은 꾹 누르면(떼고 조금 더 남는다) · 짧게 누르면 잠깐 · 마우스는 올리면. 손가락·커서에서 조금 떨어진 왼쪽 (자리가 없으면 오른쪽)
  // 우리 무리(앞줄·활·기병·장수)를 누르면 그 무리가 빛나고 곁에 깃발 판이 뜬다 — 고르면 다음 무리로 (파이어 엠블렘처럼 고르고 → 명령)
  const tip = document.createElement('div')
  tip.className = 'wtip'
  ov.appendChild(tip)
  const pop = document.createElement('div')
  pop.className = 'wfpop'
  pop.hidden = true
  ov.appendChild(pop)
  /**
   * 다 골랐다 — 화면 아래에 크게: 무리마다 고른 깃발 한 줄 + 「전투 개시」 (형 10-27 지인: "전투 개시 버튼을 스스로 찾아야 해 불편 · 내가 뭘 골랐는지 모르겠다").
   * 하나라도 비면 걷힌다
   */
  const ready = document.createElement('div')
  ready.className = 'wready'
  ready.hidden = true
  ov.appendChild(ready)
  /**
   * 아래 띠는 고르는 내내 붙어 있다 (형 10-28: "슬라이드 없애려면 전투판이 커지고 · 뭔가 선택하면 그 인터페이스가 팝업되고 없어지고 · 하스스톤") —
   * 무리마다 칩(고른 깃발 또는 「?」) · 칩이나 전장의 무리를 누르면 그 자리에 깃발 판이 뜬다 · 다 고르면 「전투 개시」가 켜진다. 아래로 밀어야 보이던 깃발 칸은 「자세히」에서만
   */
  const syncReady = (): void => {
    const tabs = [...sc.querySelectorAll<HTMLElement>('.wgt[data-g]')]
    const choosingNow = t.line?.pending !== undefined && !animating && tabs.length > 0
    const all = choosingNow && tabs.every((tb) => sel[tb.dataset['g'] as Grp | 'lead'] !== undefined)
    ov.classList.toggle('ready', all)
    ov.classList.toggle('choosing', choosingNow)
    if (!choosingNow) { ready.hidden = true; return }
    const chips = tabs.map((tb) => {
      const g = tb.dataset['g'] as Grp | 'lead'
      const src = sel[g] !== undefined ? sc.querySelector<HTMLElement>(`[data-war="pick"][data-g="${g}"][data-c="${sel[g]}"]`) : null
      const flag = src?.querySelector('img.wflag')?.getAttribute('src') ?? ''
      return `<button class="wrc${src === null ? ' none' : ''}" data-war="gtab" data-g="${g}">${tb.querySelector('.wgi')?.outerHTML ?? ''}<b>${esc(tb.querySelector('.wgn b')?.textContent ?? '')}</b>${flag !== '' ? `<img class="wrf" src="${flag}" alt="">` : ''}<i>${src !== null ? esc(src.querySelector('.wct b')?.textContent ?? '') : '?'}</i></button>`
    }).join('')
    const n = tabs.filter((tb) => sel[tb.dataset['g'] as Grp | 'lead'] !== undefined).length
    // 맡기면 장수의 지략대로 싸운다 — 그 숫자를 단추에 (형 10-28)
    const l0 = t.line
    const hid = l0?.start !== undefined ? l0.start.heroes[l0.atkFaction === host.me ? 0 : 1] ?? null : null
    const ryak = hid !== null ? prev.heroes[hid]?.ryak : undefined
    // 바뀐 곳만 — 합이 풀린 뒤 띠가 다시 뜰 때마다 칩의 깃발·무리 그림이 새로 만들어지며 깜빡였다 (형 10-31)
    morph(ready, `<div class="wrchips">${chips}</div><div class="wrrow"><button class="btn ghost wrauto" data-war="auto">${tr('war.openwar.13', { v1: ryak !== undefined ? `<small>${tr('war.openwar.10', { ryak })}</small>` : '' })}</button><button class="btn pri wrgo" data-war="go"${all ? '' : ' aria-disabled="true"'}>${all ? tr('war.openwar.11') : tr('war.openwar.12', { n, length: tabs.length })}</button></div>`, true)
    ready.hidden = false
  }
  let tipKey = ''
  let tipHideT = 0
  const hideTip = (after = 0): void => {
    window.clearTimeout(tipHideT)
    if (after > 0) { tipHideT = window.setTimeout(() => hideTip(0), after); return }
    tip.classList.remove('on')
    tipKey = ''
  }
  const showTip = (key: string, x: number, y: number, touch: boolean): void => {
    const l = t.line
    if (l === null) return
    window.clearTimeout(tipHideT)
    const html = warTip(prev, t.after, l, host.me, host.art, sel, key)
    if (html === '') { hideTip(); return }
    if (key !== tipKey) { tip.innerHTML = html; tipKey = key }
    tip.classList.add('on')
    const gap = touch ? P.realm.warTipGapTouch : P.realm.warTipGapMouse
    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxW = Math.min(P.realm.warTipW, vw - 24)
    const minW = Math.min(maxW, P.realm.warTipMinW)
    const roomL = x - gap - 8
    const roomR = vw - 8 - (x + gap)
    const side = roomL >= minW ? 'l' : roomR >= minW ? 'r' : 'up'
    const bw = side === 'l' ? Math.min(maxW, roomL) : side === 'r' ? Math.min(maxW, roomR) : maxW
    tip.style.width = `${Math.round(bw)}px`
    const bh = tip.offsetHeight
    const left = side === 'l' ? x - gap - bw : side === 'r' ? x + gap : Math.max(8, Math.min(vw - bw - 8, x - bw / 2))
    const top = Math.max(8, Math.min(vh - bh - 8, side === 'up' ? y - bh - gap : y - bh / 2 - (touch ? gap / 2 : 0)))
    tip.style.left = `${Math.round(left)}px`
    tip.style.top = `${Math.round(top)}px`
  }
  /** 무리의 자리 — 살아 있는 말들을 다 덮는 네모 */
  const RANK_G: readonly Grp[] = ['front', 'bows', 'horse']
  const groupRect = (side: 'us' | 'foe', g: Grp | 'lead'): DOMRect | null => {
    const s = sc.querySelector<HTMLElement>(`.wfield .wf2s.${side}`)
    if (s === null) return null
    const els = [...s.querySelectorAll<HTMLElement>(g === 'lead' ? '.wgen' : `.tk.r${RANK_G.indexOf(g)}:not(.tkd):not(.tkh)`)]
    if (els.length === 0) return null
    let l = Infinity, tp = Infinity, r = -Infinity, b = -Infinity
    for (const e of els) { const q = e.getBoundingClientRect(); l = Math.min(l, q.left); tp = Math.min(tp, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom) }
    return new DOMRect(l, tp, r - l, b - tp)
  }
  /** 이 점에 무엇이 있나 — 낌새 카드 · 땅 칩 · 무리·장수(작은 것 먼저) · 땅 소품 */
  const fieldHit = (x: number, y: number): { key: string; side?: 'us' | 'foe'; g?: Grp | 'lead' } | null => {
    const f = sc.querySelector<HTMLElement>('.wfield')
    if (f === null) return null
    const inR = (q: DOMRect, pad = 0): boolean => x >= q.left - pad && x <= q.right + pad && y >= q.top - pad && y <= q.bottom + pad
    // 전장 위 땅 띠의 칩 — 전장 밖이지만 같은 정보창
    for (const c of sc.querySelectorAll<HTMLElement>('.wterr .wtc[data-tk]')) if (inR(c.getBoundingClientRect())) return { key: `terr:${c.dataset['tk']}` }
    if (!inR(f.getBoundingClientRect())) return null
    const om = f.querySelector<HTMLElement>('.wf-omen')
    if (om !== null && om.offsetParent !== null && inR(om.getBoundingClientRect())) return { key: 'omen' }
    let best: { key: string; side: 'us' | 'foe'; g: Grp | 'lead' } | null = null
    let area = Infinity
    for (const side of ['us', 'foe'] as const) {
      for (const g of ['lead', ...RANK_G] as const) {
        const q = groupRect(side, g)
        if (q === null || !inR(q, P.realm.warHitPad)) continue
        const a = q.width * q.height
        if (a < area) { area = a; best = { key: g === 'lead' ? `gen:${side}` : `grp:${side}:${g}`, side, g } }
      }
    }
    if (best !== null) return best
    for (const im of f.querySelectorAll<HTMLElement>('.wf-wall[data-tk]')) if (inR(im.getBoundingClientRect())) return { key: `terr:${im.dataset['tk']}` }
    for (const im of f.querySelectorAll<HTMLImageElement>('img.tp')) {
      if (!inR(im.getBoundingClientRect())) continue
      const k = /field\/(\w+)\.png/.exec(im.src)?.[1]
      if (k !== undefined) return { key: `tp:${k}` }
    }
    return null
  }
  /** Show the selected flag without moving the formation. */
  const b0Pop = (b: HTMLElement): void => {
    fxTop.querySelector('.wb0pop')?.remove()
    const el = document.createElement('div')
    el.className = 'wb0pop'
    const img = document.createElement('img')
    img.src = b.querySelector('img.wflag')?.getAttribute('src') ?? ''
    img.alt = ''
    const nm = document.createElement('b')
    nm.textContent = b.querySelector('.wct b')?.textContent ?? ''
    el.append(img, nm)
    el.style.setProperty('--ms', `${P.realm.warB0PopMs}ms`)
    fxTop.appendChild(el)
    timers.push(window.setTimeout(() => el.remove(), P.realm.warB0PopMs))
  }
  /**
   * 무리 g 에 깃발 c 를 든다 — toggle 이면 같은 것을 또 들면 내린다(맡긴다).
   * 골랐으면 아직 안 고른 다음 무리로 · 깃발 판에서 끌어 놓았으면 그 판도 다음 무리 곁으로 (보석도 그 무리 머리 위로)
   */
  const doPick = (g: Grp | 'lead', c: Cmd, card: HTMLElement | null, toggle: boolean): void => {
    // 퇴각은 묻고 바로 — 다른 무리를 고르고 「전투 개시」까지 누를 까닭이 없다 (형 10-25: "정말 퇴각하시겠습니까? 가 뜨고 그냥 퇴각되어야")
    if (c === 'retreat') { closePop(); hideTip(); askRetreat(); return }
    sel = { ...sel, [g]: toggle && sel[g] === c ? undefined : c }
    if (sel[g] === undefined) delete sel[g]
    // 다시 그리지 않고 고른 표만 옮긴다 — 다시 그리면 배경·그림이 깜빡였다
    for (const x of sc.querySelectorAll<HTMLElement>(`[data-war="pick"][data-g="${g}"]`)) x.classList.toggle('on', sel[g] === x.dataset['c'])
    active = g
    syncCmd()
    if (sel[g] !== undefined && card !== null) b0Pop(card)
    // 장수 깃발(비기·격려…)을 들 때는 말하지 않는다 — 「무엇이든 말씀만 하셔요」는 명을 고르는 자리에 안 맞았다 (형 10-27). 외침은 그 수가 풀릴 때
    const fromPop = popG !== undefined
    closePop()
    hideTip()
    if (sel[g] === undefined) return
    const order = [...sc.querySelectorAll<HTMLElement>('.wgt[data-g]')].map((x) => x.dataset['g'] as Grp | 'lead')
    const at = order.indexOf(g)
    const next = [...order.slice(at + 1), ...order.slice(0, at)].find((x) => sel[x] === undefined)
    if (next !== undefined) timers.push(window.setTimeout(() => { if (active === g) { active = next; syncCmd(); if (fromPop && choosing()) openPop(next) } }, P.realm.warTabNextMs))
  }

  // ───────── 누르고 있는 동안만 뜨는 설명 창 · 지금 고를 무리 위의 보석 · 깃발 끌기 (형 10-28: 하스스톤처럼)
  /** 설명 창 — 손가락 위에 · 손을 떼면 warHoldLingerMs 뒤 걷힌다 (holdbox.ts · 지도와 같이 쓴다) */
  const hold = holdBox(ov, () => P.realm.warHoldLingerMs)
  const showHold = hold.show
  const hideHold = hold.hide
  /** 무리의 설명 — 이름 · 사람 수 · 들 수 있는 깃발 */
  const groupHold = (g: Grp | 'lead'): string => {
    const tab = sc.querySelector<HTMLElement>(`.wgt[data-g="${g}"]`)
    const pane = sc.querySelector<HTMLElement>(`.wgrp[data-g="${g}"]`)
    const flags = [...(pane?.querySelectorAll<HTMLElement>('[data-war="pick"] .wct > b') ?? [])].map((x) => x.textContent ?? '').filter((x) => x !== '')
    return `<div class="whh">${tab?.querySelector('.wgi')?.outerHTML ?? ''}<b>${esc(tab?.querySelector('.wgn b')?.textContent ?? '')}</b><small>${esc(tab?.querySelector('.wgn small')?.textContent ?? '')}</small></div>`
      + `<p>${tr('war.openwar.14', { flags: esc(flags.join(' · ')) })}</p><p class="whn">${tr('war.openwar.15')}</p>`
  }
  /** 깃발의 설명 — 하는 일 · 판세 막대 · 피해·사기 표 */
  const flagHold = (card: HTMLElement): string => {
    const why = card.dataset['c'] === 'retreat' ? t.line?.pending?.retreatWhy : undefined
    const rows = why !== undefined ? `<div class="wrwhy"><span>${tr('war.openwar.16')}</span><b>${Math.round(P.realm.tacRetBase * 100)}%</b>${why.map(([k, v]) => `<span>${esc(k)}</span><b class="${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%</b>`).join('')}</div>` : ''
    return flagHoldBase(card) + rows
  }
  const flagHoldBase = (card: HTMLElement): string =>
    `<div class="whh">${card.querySelector('img.wflag')?.outerHTML ?? ''}<b>${esc(card.querySelector('.wct > b')?.textContent ?? '')}</b>${card.querySelector('.wct > em')?.outerHTML ?? ''}</div>`
    + `<p>${esc(card.dataset['desc'] ?? card.dataset['more'] ?? '')}</p>`
  /** 깃발 판 밑의 판세 칸을 그 깃발로 */
  const showLook = (card: HTMLElement | null, table = false): void => {
    const box = pop.querySelector<HTMLElement>('.wfplook')
    if (box === null) return
    const gu = card?.querySelector('.wguess')
    box.innerHTML = gu != null && card !== null ? `<div class="wlkn">${tr('war.openwar.17', { v1: esc(card.querySelector('.wct > b')?.textContent ?? '') })}</div>${gu.outerHTML}` : ''
    // 0.5초 넘게 누르고 있으면 피해·사기 표까지 (형 10-28) · 다른 깃발을 누르면 다시 막대만
    // 표가 붙거나 걷히면 판 높이가 바뀐다 — 다시 놓아야 표가 화면 밑으로 잘리지 않는다 (형 11-03: "꾹 누를 때 보이는 +- 도 화면에 잘 나오게")
    let moved = box.classList.contains('held') !== table
    box.classList.toggle('held', table)
    // 장수가 여럿 — 누른 깃발이 비기·겨루기·사로잡기면 그 아래 「누가 나서나 · 누구를 잡나」 (끌어 놓기 전에 고른다)
    const kind = card === null ? undefined : WHO_KINDS.find((k) => card.classList.contains(k))
    for (const row of pop.querySelectorAll<HTMLElement>('.wwho')) { const on = kind !== undefined && row.classList.contains(kind); if (row.classList.contains('show') !== on) { row.classList.toggle('show', on); moved = true } }
    if (moved && !pop.hidden) placePop()
  }
  let lookT = 0

  /** 지금 고를 무리 머리 위의 보석 — 초록 역삼각뿔 (그러데이션·filter 없이 면마다 단색) */
  const gem = document.createElement('div')
  gem.className = 'wgem'
  gem.hidden = true
  // 진짜 3D 사각뿔 — 세모 넷이 아래 꼭짓점으로 모이고 윗면 네모 하나 · 통째로 Y 축으로 돈다 (형 10-28: "사각뿔이 아래를 가리키면서 3d로 돌아가야")
  gem.innerHTML = '<i class="g3"><b class="gf f0"></b><b class="gf f1"></b><b class="gf f2"></b><b class="gf f3"></b><b class="gt"></b></i>'
  ov.appendChild(gem)
  const placeGem = (): void => {
    // 깃발 판을 연 무리 → 지금 펼친 무리(아직 안 골랐으면) → 아직 안 고른 첫 무리 (형 10-28: "다른 UI 가 떠 가려지더라도 지금 선택한 게 이거라는 표시")
    const tabs = [...sc.querySelectorAll<HTMLElement>('.wgt[data-g]')].map((x) => x.dataset['g'] as Grp | 'lead')
    const g = popG ?? (active !== undefined && sel[active] === undefined ? active : tabs.find((x) => sel[x] === undefined))
    const q = g !== undefined && choosing() ? groupRect('us', g) : null
    if (q === null) { gem.hidden = true; return }
    gem.hidden = false
    gem.style.left = `${Math.round(q.left + q.width / 2)}px`
    gem.style.top = `${Math.round(q.top)}px`
  }

  /** 끄는 화살 — 깃발에서 손끝까지 흘러가는 빨간 화살 (하스스톤) */
  const dragSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  dragSvg.setAttribute('class', 'wdrag')
  dragSvg.innerHTML = '<path class="wdl"/><path class="wdf"/><polygon class="wdh" points="0,-14 26,0 0,14"/>'
  dragSvg.style.display = 'none'
  ov.appendChild(dragSvg)
  const drawDrag = (x0: number, y0: number, x1: number, y1: number, ok: boolean): void => {
    // 살짝만 휜다 — 굽이점을 처음과 끝 사이에 두어 화살촉이 늘 가는 쪽(위)을 본다 (형 10-28: 위로 가다 아래로 꺾였다)
    const mx = x0 + (x1 - x0) * 0.15
    const my = y0 + (y1 - y0) * 0.55
    const d = `M${x0},${y0} Q${mx},${my} ${x1},${y1}`
    dragSvg.querySelector('.wdl')!.setAttribute('d', d)
    dragSvg.querySelector('.wdf')!.setAttribute('d', d)
    const a = (Math.atan2(y1 - my, x1 - mx) * 180) / Math.PI
    dragSvg.querySelector('.wdh')!.setAttribute('transform', `translate(${x1},${y1}) rotate(${a.toFixed(1)})`)
    dragSvg.classList.toggle('ok', ok)
    dragSvg.style.display = ''
  }
  let drag: { card: HTMLElement; x0: number; y0: number; on: boolean; id: number } | null = null
  /** 누른 깃발 — 그 깃발에서 화면 가운데 위 1/3 자리로 화살이 서 있다 (형 10-28: "선택하자마자 그 박스를 시작점으로 화면 중앙 위에서 1/3 지점을 가리키고 · 그게 움직여야") */
  let armed: HTMLElement | null = null
  const aimAt = (card: HTMLElement): void => {
    const q = card.getBoundingClientRect()
    drawDrag(q.left + q.width / 2, q.top + 4, window.innerWidth / 2, window.innerHeight / 3, false)
  }
  const disarm = (): void => {
    armed?.classList.remove('armed')
    armed = null
    dragSvg.style.display = 'none'
  }
  /** 깃발을 놓으면 쓰이는 곳 — 깃발 판(없으면 아래 띠)보다 위면 어디든 (형 10-28: "드랍할 곳이 너무 팍팍해 · 깃발 창보다 위 전투판이면") */
  const overField = (x: number, y: number): boolean => {
    const top = !pop.hidden ? pop.getBoundingClientRect().top : !ready.hidden ? ready.getBoundingClientRect().top : window.innerHeight
    return x >= 0 && x <= window.innerWidth && y >= 0 && y < top - P.realm.warDropGap
  }
  pop.addEventListener('pointerdown', (ev) => {
    const card = (ev.target as HTMLElement).closest<HTMLElement>('[data-war="pick"]')
    if (card === null || !choosing()) return
    // 하는 일은 판 위에 (판과 겹치지 않게) · 판세는 판 밑 칸에
    const pq = pop.getBoundingClientRect()
    showHold(flagHold(card), pq.left + pq.width / 2, pq.top + 18)
    showLook(card)
    window.clearTimeout(lookT)
    lookT = window.setTimeout(() => {
      if (drag?.card !== card || drag.on) return
      showLook(card, true)
      // 표가 붙어 판이 위로 자랐다 — 설명 창도 판 위로 다시 (판 머리를 덮었다)
      const q2 = pop.getBoundingClientRect()
      if (hold.isOpen()) showHold(flagHold(card), q2.left + q2.width / 2, q2.top + 18)
    }, P.realm.warLookTableMs)
    if (armed !== card) { armed?.classList.remove('armed'); armed = card; card.classList.add('armed') }
    aimAt(card)
    drag = { card, x0: ev.clientX, y0: ev.clientY, on: false, id: ev.pointerId }
    try { card.setPointerCapture(ev.pointerId) } catch { /* 못 잡아도 끌기는 ov 에서 */ }
  })
  ov.addEventListener('pointermove', (ev) => {
    if (drag === null || ev.pointerId !== drag.id) return
    if (!drag.on && Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < P.realm.warDragSlop) return
    if (!drag.on) { drag.on = true; hold.close(); drag.card.classList.add('dragging') }
    const q = drag.card.getBoundingClientRect()
    drawDrag(q.left + q.width / 2, q.top + q.height / 2, ev.clientX, ev.clientY, overField(ev.clientX, ev.clientY))
  })
  const endDrag = (ev: PointerEvent): void => {
    if (drag === null || ev.pointerId !== drag.id) return
    const d = drag
    drag = null
    d.card.classList.remove('dragging')
    window.clearTimeout(lookT)
    if (!d.on) {
      hideHold()
      // 꾹 눌러 붙은 피해·사기 표는 손을 떼면 설명 창과 함께 걷힌다 — 판이 다시 낮아져 전장이 보인다
      if (pop.querySelector('.wfplook.held') !== null) lookT = window.setTimeout(() => { if (drag === null && d.card.isConnected) showLook(d.card) }, P.realm.warHoldLingerMs)
      if (armed === d.card && d.card.isConnected) aimAt(d.card)
      return
    } // 누르기만 했다 — 화살은 그 깃발에서 가운데를 가리킨 채
    hideHold(0)
    if (ev.type === 'pointerup' && overField(ev.clientX, ev.clientY)) {
      swallow = true // 놓은 뒤 오는 click 이 전장 누르기로 깃발 판을 다시 열지 않게
      host.ding('click1', 0.22)
      disarm()
      doPick(d.card.dataset['g'] as Grp | 'lead', d.card.dataset['c'] as Cmd, d.card, false)
    } else if (d.card.isConnected) aimAt(d.card) // 전장 밖에 놓았다 — 처음 화살로
  }
  ov.addEventListener('pointerup', endDrag)
  ov.addEventListener('pointercancel', endDrag)
  pop.addEventListener('contextmenu', (ev) => ev.preventDefault()) // 폰에서 꾹 누르면 뜨는 메뉴를 막는다
  window.addEventListener('resize', placeGem)

  /** 다음 합을 고르는 중인가 (합이 풀리는 중·맡긴 싸움을 보는 중이 아니고) */
  const choosing = (): boolean => t.line?.pending !== undefined && !animating && chain.length === 0
  let popG: Grp | 'lead' | undefined
  const closePop = (): void => {
    ov.querySelector('.wdrag')?.setAttribute('style', 'display:none') // 판이 닫히면 서 있던 화살도
    ov.querySelector('.wfpop .armed')?.classList.remove('armed')
    if (pop.hidden) return
    pop.hidden = true
    pop.replaceChildren()
    popG = undefined
  }
  /**
   * 깃발 판을 붙일 자리 — 그 무리가 전장에 그려져 있으면 그 무리, 아니면(아직 안 닿은 원군과 함께 오는 궁병처럼 그림이 없다) 우리 다른 무리 · 그것도 없으면 전장 가운데.
   * 예전엔 자리가 없으면 판이 안 떠서 고를 수가 없었고, 자동전투로 넘길 수밖에 없었다 (형 11-04: "원군 도착 직전에 궁병 선택지가 있는데 궁병이 없어서 뭘 고를 수가 없음")
   */
  const popRect = (g: Grp | 'lead'): DOMRect => {
    const q = groupRect('us', g) ?? groupRect('us', 'lead') ?? groupRect('us', 'front') ?? groupRect('us', 'bows') ?? groupRect('us', 'horse')
    if (q !== null) return q
    const fr = sc.querySelector<HTMLElement>('.wfield')?.getBoundingClientRect()
    return fr !== undefined && fr.width > 0 ? new DOMRect(fr.left + fr.width * 0.3, fr.top + fr.height * 0.5, fr.width * 0.2, 40) : new DOMRect(window.innerWidth * 0.4, window.innerHeight * 0.4, window.innerWidth * 0.2, 40)
  }
  /** 무리 곁의 깃발 판 — 아래 깃발 칸의 카드를 작게 옮겨 온다 (누르면 같은 일) */
  const openPop = (g: Grp | 'lead'): void => {
    const pane = sc.querySelector<HTMLElement>(`.wgrp[data-g="${g}"]`)
    const tab = sc.querySelector<HTMLElement>(`.wgt[data-g="${g}"]`)
    if (pane === null || tab === null) { closePop(); return }
    const name = tab.querySelector('.wgn b')?.textContent ?? ''
    const sub = tab.querySelector('.wgn small')?.textContent ?? ''
    fillPane(pane)
    pop.innerHTML = `<div class="wfph">${tab.querySelector('.wgi')?.outerHTML ?? ''}<b>${esc(name)}</b><small>${esc(sub)}</small><button class="wfpx" data-war="popx" aria-label="${tr('war.sghtml.22')}">✕</button></div><div class="wfpg"></div><div class="wfplook"></div>${[...pane.querySelectorAll('.wwho')].map((x) => x.outerHTML).join('')}<p class="wfphint">${tr('war.openwar.18')}</p>`
    const grid = pop.querySelector<HTMLElement>('.wfpg')!
    for (const b of pane.querySelectorAll<HTMLElement>('[data-war="pick"]')) {
      const c = b.cloneNode(true) as HTMLElement
      c.classList.add('mini')
      // 누르면 뜨는 말(tips.ts · data-more)이 설명 창과 겹쳤다 (형 10-28) — 하는 일은 data-desc 로 옮겨 설명 창에서만
      if (c.dataset['more'] !== undefined) { c.dataset['desc'] = c.dataset['more']; delete c.dataset['more'] }
      grid.appendChild(c)
    }
    showLook(grid.querySelector<HTMLElement>('[data-war="pick"].on') ?? grid.querySelector<HTMLElement>('[data-war="pick"].rec') ?? grid.querySelector<HTMLElement>('[data-war="pick"]')) // 처음엔 고른 것 · 없으면 ★권함

    pop.classList.remove('tight')
    pop.hidden = false
    pop.classList.toggle('lead', g === 'lead')
    popG = g
    window.clearTimeout(hoverT)
    hideTip()
    placePop()
  }
  /** 깃발 판 자리 — 그 무리 위 가운데, 높이는 아래 띠 바로 위 · 판 높이가 바뀌면(누가 나서나 줄) 다시 */
  const placePop = (): void => {
    const q = popG === undefined ? null : popRect(popG)
    if (q === null) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pw = pop.offsetWidth
    const ph = pop.offsetHeight
    const edge = pop.classList.contains('tight') ? 6 : 8
    const left = Math.max(edge, Math.min(vw - pw - edge, q.left + q.width / 2 - pw / 2))
    // 화면 아래쪽에 — 아래 띠 바로 위 (형 10-28: "깃발 선택 창이 너무 위로 가지 않게 아래에") · 띠가 없으면 무리 밑
    const bar = ready.hidden ? null : ready.getBoundingClientRect()
    let top = bar !== null ? bar.top - ph + 14 : q.bottom + 8
    if (top + ph > vh - 8) top = Math.max(8, vh - ph - 8)
    // 전장(깃발을 끌어다 놓는 곳)을 가리면 화면 맨 아래로 내려 아래 띠를 덮고, 그래도 가리면 판을 줄인다
    // (형 11-02 · 동생 폰 411×780: 판이 전장의 3분의 2를 덮어 끌어 놓을 데가 없었다)
    const field = sc.querySelector<HTMLElement>('.wtop .wfield')?.getBoundingClientRect()
    if (pop.classList.contains('tight')) top = vh - ph - 6 // 줄인 판은 늘 화면 맨 아래 · 꾹 눌러 표가 붙으면 위로 자란다
    else if (field !== undefined && top < field.bottom - 4) {
      top = vh - ph - 6
      if (top < field.bottom - 4) { pop.classList.add('tight'); placePop(); return }
    }
    pop.style.left = `${Math.round(left)}px` // 줄인 판도 그 무리 밑 가운데 (폭은 CSS 가 정한다 · 좁은 폰에선 양옆 6px 과 같다)
    pop.style.top = `${Math.round(top)}px`
  }
  /**
   * 장수 겨루기를 골랐으면 그 합이 풀리기 전에 손으로 겨룬다 (src/duel/view.ts · 형 11-09 「붙이자」).
   * 끝(이김·짐)은 그 합의 명령에 적혀 판 기록에 남는다 — 다시 돌려도 같다. 비기면 적지 않아 예전처럼 무예로 굴린다.
   * 겨루기는 전투판 위에 겹쳐 뜨고 저절로 닫힌다 — 싸움 음악은 그대로 흐른다.
   */
  const fight = (key: string): void => {
    const pd = t.line?.key === key ? t.line.pending : undefined
    if (sel.lead === 'duel' && sel.duel === undefined && pd !== undefined) {
      const mine = pd.heroes ?? []
      const meId = sel.who ?? [...mine].sort((a, b) => b.mu - a.mu || (a.id < b.id ? -1 : 1))[0]?.id
      const me = meId !== undefined ? prev.heroes[meId] : undefined
      const foe = (pd.foeHeroes ?? []).map((h) => prev.heroes[h.id]).filter((h): h is Hero => h !== undefined)
        .sort((a, b) => b.mu - a.mu || (a.id < b.id ? -1 : 1))[0]
      if (me !== undefined && foe !== undefined) {
        const side = (h: Hero): DuelSide => { const b = bustOf(h.id); return { name: h.name, mu: h.mu, sprite: host.px === true ? (PX_HERO[h.id] ?? generalSprite(h)) : generalSprite(h), ...(b !== undefined ? { portrait: b } : {}) } }
        let seed = 0
        for (const ch of `${key}:${pd.round}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
        const line = t.line
        const bgUrl = line !== null ? warBg(host.art, warGround(prev, line), line.atkFaction !== host.me) : undefined
        void mountDuel({ me: side(me), foe: side(foe), tier: prev.region === 'tutorial' ? 0 : clampTier(prev.tier ?? 1), seed, ...(host.px === true ? { px: true } : {}), ...(bgUrl !== undefined ? { bg: bgUrl } : {}) }).then((res) => {
          if (res !== undefined) sel.duel = res
          fightNow(key)
        })
        return
      }
    }
    fightNow(key)
  }
  /** 이 합을 고른 대로 싸운다 */
  const fightNow = (key: string): void => {
    active = undefined
    gem.hidden = true // 합이 풀리는 동안엔 보석을 걷는다
    if (cur === null || cur.key !== key) cur = { key, cmds: [], dusk: [] }
    cutLead = sel.lead ?? null // 고른 장수 기술 — 이 합이 풀릴 때 초상이 튀어나온다
    cur.cmds.push({ ...sel })
    sel = {}
    t = rehearse(prev, orders, done, cur, host.me)
    if (t.line === null || t.line.key !== cur.key) {
      // 그 합으로 판이 끝났다 — 굳히고 결과를 보인다
      settle()
      return
    }
    if (t.line.pending === undefined) {
      done[cur.key] = tacOf(cur.key)
      cur = null
    }
    draw(true)
  }
  /**
   * 마지막 때의 고름 — 진을 친다 · 한 합 더 · 물러난다 (해시계 · 형 10-26). 새 합이 없으면 그 자리에서 판이 끝나 결과가 쾅,
   * 한 합 더면 다음 합(어둠 속 · 밤 싸움이면 날이 밝은 뒤)의 깃발을 고르는 판으로
   */
  const duskPick = (key: string, d: Dusk): void => {
    active = undefined
    if (cur === null || cur.key !== key) cur = { key, cmds: [], dusk: [] }
    cur.dusk.push(d)
    sel = {}
    t = rehearse(prev, orders, done, cur, host.me)
    if (t.line === null || t.line.key !== cur.key || t.line.pending === undefined) {
      settle(true)
      return
    }
    // 한 합 더 — 북을 울려 다시 붙는다
    draw(false)
    if (document.visibilityState === 'visible') { at(0, BATTLE_SFX.openDrum, 0.5); at(0.38, BATTLE_SFX.openDrum, 0.5); at(0.5, BATTLE_SFX.cry, 0.35) }
  }
  /** 정말 물러나나 — 묻는 판 (예면 그 자리에서 퇴각) */
  const sure = document.createElement('div')
  sure.className = 'wsure'
  sure.hidden = true
  sure.innerHTML = `<div class="wsurec"><b>${tr('war.openwar.19')}</b><p class="wsurep"></p><div class="wsureb"><button class="btn ghost" data-war="retreat-no">${tr('war.openwar.20')}</button><button class="btn pri wsurey" data-war="retreat-yes">${tr('war.cmdName.retreat')}</button></div></div>`
  ov.appendChild(sure)
  /** 상성 판 — 위 띠 왼쪽 「상성」 · 연출 중에도 열고 닫는다 · 밖을 누르거나 ✕ 로 닫힌다 */
  const sg = document.createElement('div')
  sg.className = 'wsg'
  sg.hidden = true
  sg.innerHTML = sgHtml(host.art)
  ov.appendChild(sg)
  const sgAct = (b: HTMLElement): void => {
    if (b.dataset['war'] === 'mu') { sg.hidden = !sg.hidden; return }
    const i = b.dataset['i']
    for (const x of sg.querySelectorAll<HTMLElement>('[data-war="mutab"]')) x.classList.toggle('on', x.dataset['i'] === i)
    for (const pg of sg.querySelectorAll<HTMLElement>('.wsg-p')) pg.hidden = pg.dataset['i'] !== i
  }
  /** 맡긴다 — 바로 넘기지 않고 장수 얼굴과 함께 묻는다 (형 10-28: "~한테 전투를 모두 맡기겠습니까? (자동전투)") */
  const autoAsk = document.createElement('div')
  autoAsk.className = 'wsure wauto-ask'
  autoAsk.hidden = true
  ov.appendChild(autoAsk)
  const askAuto = (): void => {
    const l0 = t.line
    const hid = l0?.start !== undefined ? l0.start.heroes[l0.atkFaction === host.me ? 0 : 1] ?? null : null
    const h = hid !== null ? prev.heroes[hid] : undefined
    const nm = h?.name ?? tr('war.sghtml.12')
    autoAsk.innerHTML = `<div class="wsurec">${face(hid, host.art, UNIT_ICON.spear)}<b>${tr('war.openwar.22', { nm: esc(nm) })}</b><p>${tr('war.openwar.23', { v1: h !== undefined ? ` ${tr('war.openwar.21', { ryak: h.ryak })}` : '' })}</p><div class="wsureb"><button class="btn ghost" data-war="auto-no">${tr('war.openwar.24')}</button><button class="btn pri" data-war="auto-yes">${tr('war.openwar.25')}</button></div></div>`
    autoAsk.hidden = false
  }
  const askRetreat = (): void => {
    // 빠져나갈 가망을 묻는 판에도 — 말이 호위하게 골라 두었으면 그 몫으로 (형 10-27: 물러나기는 시도다)
    const p = t.line?.pending
    const rp = p === undefined || p.retreatP === undefined ? undefined : sel.horse === 'guard' ? (p.retreatGuardP ?? p.retreatP) : p.retreatP
    const q = sure.querySelector<HTMLElement>('.wsurep')
    if (q !== null) q.innerHTML = rp === undefined ? '' : `${tr('war.openwar.26')} <strong class="wf-${retreatCls(rp)}">${Math.round(rp * 100)}%</strong>${tr('war.openwar.27')}`
    sure.hidden = false
  }
  let press: { x: number; y: number; timer: number; held: boolean } | null = null
  /** 꾹 눌러 정보창을 띄웠다 — 이어지는 click 하나를 삼킨다 (무리를 고르지 않는다) */
  let swallow = false
  let hoverT = 0
  ov.addEventListener('pointerdown', (ev) => {
    swallow = false // 꾹 누름 뒤 click 이 안 오는 폰도 있다 — 남은 삼킴이 다음 누름을 먹지 않게
    if ((ev.target as HTMLElement).closest('.wfield') !== null && choosing()) {
      // 우리 무리를 누르는 동안 — 그 무리의 설명 창 (손을 떼면 1초쯤 뒤 걷힌다 · 떼면 깃발 판이 열린다)
      const h0 = fieldHit(ev.clientX, ev.clientY)
      if (h0 !== null && h0.side === 'us' && h0.g !== undefined && sc.querySelector(`.wgt[data-g="${h0.g}"]`) !== null) { showHold(groupHold(h0.g), ev.clientX, ev.clientY); return }
    }
    if (ev.pointerType === 'mouse' || (ev.target as HTMLElement).closest('.wfield, .wterr') === null) return
    const x = ev.clientX
    const y = ev.clientY
    const p0 = { x, y, held: false, timer: 0 }
    p0.timer = window.setTimeout(() => {
      if (press !== p0) return
      const h = fieldHit(x, y)
      if (h === null) return
      p0.held = true
      swallow = true
      showTip(h.key, x, y, true)
      if (typeof navigator.vibrate === 'function') navigator.vibrate(8)
    }, P.realm.warTipHoldMs)
    press = p0
  })
  ov.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse') {
      const h = pop.hidden ? fieldHit(ev.clientX, ev.clientY) : null
      window.clearTimeout(hoverT)
      if (h === null) { if (tipKey !== '') hideTip(); return }
      if (h.key === tipKey) { showTip(h.key, ev.clientX, ev.clientY, false); return }
      const x = ev.clientX
      const y = ev.clientY
      hoverT = window.setTimeout(() => { if (pop.hidden) showTip(h.key, x, y, false) }, P.realm.warTipHoverMs)
      return
    }
    if (press === null || press.held) return
    if (Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > P.realm.warTipSlop) { window.clearTimeout(press.timer); press = null }
  })
  const endPress = (): void => {
    if (hold.isOpen() && drag === null) hideHold()
    if (press === null) return
    window.clearTimeout(press.timer)
    if (press.held) hideTip(P.realm.warTipLingerMs)
    press = null
  }
  ov.addEventListener('pointerup', endPress)
  ov.addEventListener('pointercancel', endPress)
  ov.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') { window.clearTimeout(hoverT); hideTip() } })
  ov.addEventListener('contextmenu', (ev) => { if ((ev.target as HTMLElement).closest('.wfield') !== null) ev.preventDefault() })

  ov.addEventListener('pointerover', (ev) => {
    if (ev.pointerType !== 'mouse') return
    const c = (ev.target as HTMLElement).closest<HTMLElement>('[data-war="pick"]')
    const next = c !== null ? { g: c.dataset['g'] as Grp | 'lead', c: c.dataset['c'] as Cmd } : null
    if (next?.g === peek?.g && next?.c === peek?.c) return
    peek = next
    syncField()
  })
  ov.addEventListener('click', (ev) => {
    ev.stopPropagation()
    if (swallow) { swallow = false; return }
    const tg = ev.target as HTMLElement
    if (!pop.hidden && tg.closest('.wfpop') === null) closePop()
    if (tg.closest('.wfield, .wterr') !== null && tg.closest('[data-war]') === null && choosing()) {
      const h = fieldHit(ev.clientX, ev.clientY)
      const touch = (ev as PointerEvent).pointerType !== 'mouse'
      if (h !== null && h.side === 'us' && h.g !== undefined && sc.querySelector(`.wgt[data-g="${h.g}"]`) !== null) {
        host.ding('click1', 0.18)
        hideTip()
        active = h.g
        syncCmd()
        openPop(h.g)
      } else if (h !== null && !touch) showTip(h.key, ev.clientX, ev.clientY, false)
      // 손가락은 누르고 있는 동안만 (하스스톤처럼 · 형 10-25: "터치하고 있는 동안에만 나와야해. 손 떼면 없어져야")
      return
    }
    const b = tg.closest<HTMLElement>('[data-war]')
    // 위 단추 줄(상성·기록·배속)의 틈·테두리를 누른 것은 건너뛰기가 아니다 — 폰에서 배속 단추를 살짝 비껴 누르면 싸움이 통째로 끝까지 넘어가 멈춘 듯하다가 대승이 떴다 (형 11-10)
    if (b === null && tg.closest('.wrbt, .wrh') !== null) return
    if (b === null) {
      // 맡긴 싸움을 풀어 보이는 중이면 끝까지 건너뛴다
      if (chain.length > 0) {
        stopChain()
        upto = undefined
        draw(true)
      }
      ov.classList.add('fast') // 아무 데나 누르면 이 합을 끝까지 바로
      stopStrikes?.()
      stopStrikes = undefined
      clearTimers()
      flushEnd() // 끝에 닿았으면 걷힌 뿔나팔·대승 음악을 바로
      fxTop.replaceChildren()
      ov.querySelector('.wcut')?.remove()
      ov.querySelector('.wsk')?.remove()
      // 진을 되돌리는 타이머도 걷혔다 — 다음 합을 고를 판이면 바로 고르는 진으로 (재검토 10-25: 연출 상태로 굳었다)
      if (t.line?.pending !== undefined) syncField(true)
      return
    }
    // 상성 판 — 싸움이 풀리는 중에도 · 판 안을 눌러도 건너뛰지 않는다
    if (b.dataset['war'] === 'mu-in') return
    if (b.dataset['war'] === 'speed') {
      speed = battleSpeed(Number(b.dataset['speed']))
      playback.setRate(P.realm.warPlaybackRate * speed)
      rateAnimations()
      for (const button of ov.querySelectorAll<HTMLButtonElement>('.wspeed button')) {
        button.setAttribute('aria-pressed', String(Number(button.dataset['speed']) === speed))
      }
      try { localStorage.setItem(SPEED_KEY, String(speed)) } catch { /* keep this battle's setting */ }
      return
    }
    if (b.dataset['war'] === 'mu' || b.dataset['war'] === 'mutab') { host.ding('click1', 0.18); sgAct(b); return }
    const l = t.line
    if (l === null || l.key === undefined) return
    if (animating && b.dataset['war'] !== 'auto' && b.dataset['war'] !== 'auto-yes' && b.dataset['war'] !== 'auto-no' && b.dataset['war'] !== 'next' && b.dataset['war'] !== 'help') return
    host.ding('click1', 0.18)
    switch (b.dataset['war']) {
      case 'pick': {
        // 전장 위 깃발 판은 누르기로 고르지 않는다 — 끌어 전장에 놓아야 (dropFlag) · 누르고 있으면 설명 창
        if (b.closest('.wfpop') !== null) return
        doPick(b.dataset['g'] as Grp | 'lead', b.dataset['c'] as Cmd, b, true)
        return
      }
      case 'gtab': {
        const again = active === b.dataset['g']
        active = b.dataset['g'] as Grp | 'lead'
        syncCmd()
        // 아래 띠의 칩 — 그 무리 곁에 깃발 판이 뜬다
        if (b.classList.contains('wrc')) { openPop(active); return }
        // 시험판 — 펼친 무리 탭을 또 누르면 그 깃발 칸이 번쩍이며 눈앞으로 (첫 손님: 「선택」을 눌러도 그대로였다)
        if (again && ov.classList.contains('b0')) {
          const pane = sc.querySelector<HTMLElement>(`.wgrp[data-g="${active}"]`)
          if (pane !== null) { pane.classList.remove('b0flash'); void pane.offsetWidth; pane.classList.add('b0flash'); pane.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }
        }
        return
      }
      case 'who': case 'target': {
        // 장수가 여럿 — 누가 나서나 · 누구를 잡나. 다시 그리지 않고 고른 표만 옮긴다 (깃발 판과 아래 깃발 칸 둘 다)
        const id = b.dataset['id']!
        if (b.dataset['war'] === 'who') { sel = { ...sel, who: id }; bark(id) } // 나설 장수를 고르면 그 장수가 대답한다
        else sel = { ...sel, target: id }
        const kind = WHO_KINDS.find((k) => b.closest('.wwho')?.classList.contains(k))
        if (kind !== undefined) for (const x of ov.querySelectorAll<HTMLElement>(`.wwho.${kind} .wfc`)) x.classList.toggle('on', x.dataset['id'] === id)
        // 비기 깃발의 이름·그림도 그 장수의 비기로 (오간을 골랐는데 깃발은 을음의 「거짓 퇴각」이었다)
        const ak = kind === 'art' && t.line?.pending !== undefined ? artFor(t.line.pending, id) : undefined
        if (ak !== undefined) for (const x of ov.querySelectorAll<HTMLElement>('.wcmd.art[data-war="pick"]')) {
          const nb = x.querySelector('.wct > b'); if (nb !== null) nb.textContent = ART_NAME[ak]
          const sm = x.querySelector('.wct > small'); if (sm !== null) sm.textContent = ART_SHORT[ak]
          x.querySelector<HTMLImageElement>('.wflag')?.setAttribute('src', flagSrc(host.art, 'art', ak))
          if (x.dataset['more'] !== undefined) x.dataset['more'] = ART_DOES[ak]
          if (x.dataset['desc'] !== undefined) x.dataset['desc'] = ART_DOES[ak]
        }
        fillLooks()
        return
      }
      case 'popx': closePop(); return
      case 'log': ov.classList.toggle('logopen'); return
      case 'help': {
        const on = ov.classList.toggle('whelpon')
        try { localStorage.setItem(HELP_KEY, on ? '1' : '0') } catch { /* 저장이 막혀도 이번 판은 된다 */ }
        return
      }
      case 'go': {
        // 덜 고르고 누르면 — 말없이 아무 일 없던 것 대신 둔탁한 소리와 함께 안 고른 무리의 깃발 판을 연다 (위원회 11-04 UX ⑨)
        const miss = [...sc.querySelectorAll<HTMLElement>('.wgt[data-g]')].map((x) => x.dataset['g'] as Grp | 'lead').find((g) => sel[g] === undefined)
        if (miss !== undefined) { host.ding(snd('tap_cancel'), 0.5, 0.7); active = miss; syncCmd(); openPop(miss); return }
        fight(l.key)
        return
      }
      case 'retreat-yes': {
        sure.hidden = true
        sel = { lead: 'retreat' }
        fight(l.key)
        return
      }
      case 'retreat-no': sure.hidden = true; return
      case 'auto': askAuto(); return
      case 'auto-yes': autoAsk.hidden = true; autoPlay(); return
      case 'auto-no': autoAsk.hidden = true; return
      case 'dusk': duskPick(l.key, b.dataset['c'] as Dusk); return
      case 'next': {
        if (cur !== null) done[cur.key] = tacOf(cur.key)
        cur = null
        sel = {}
        active = undefined
        left = Math.max(0, left - 1)
        advanceTo()
        return
      }
      default: return
    }
  })
  draw(false)
  return true
}
