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
import { FACTION_ART, UNIT_ICON, bustOf, flagIcon } from '../../realm/data/art.ts'
import { battleName, endStory, fieldName, groupLabel, josa, roundStory, storyCtx, UNIT_NAME } from '../../realm/data/prose.ts'
import { BATTLE_STYLES, groupMen, groupOf, type BattleStyle } from '../../realm/tactics.ts'
import { rehearse, type BattleLine } from '../../realm/warroom.ts'
import { seasonOf } from '../../realm/season.ts'
import type { Act, Approach, Art, Cmd, Grp, Guess, Order, Realm, RoundLog, RoundOrder, Tactic } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { snd } from './sound.ts'
import { WIN_BUZZ, winFxHtml } from './winfx.ts'
import { scrollInside } from './scroll.ts'
import { morphInto } from './morph.ts'

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** 진군 방식의 이름 · 고르는 화면의 한 줄 (얻는 것 · 거는 것) */
export const APPROACH_NAME: Record<Approach, string> = {
  road: '대로로 간다', night: '밤길로 숨어 간다', ford: '여울을 몰래 건넌다', ridge: '산기슭으로 돌아간다', cliff: '절벽을 타고 오른다',
}
export const APPROACH_DOES: Record<Approach, { gain: string; risk: string }> = {
  road: { gain: '빠르고 질서 있게 닿는다 — 사기가 오른다', risk: '숨지 않는다. 적은 성과 장정으로 맞는다' },
  night: { gain: '들키지 않으면 잠든 적을 친다 — 성문도 장정도 못 막는다', risk: '들키면 기다리던 적의 매복에 걸린다' },
  ford: { gain: '갈대에 숨어 건넌다 — 들키지 않으면 강만 믿던 적을 친다', risk: '들키면 물 한가운데서 맞아 크게 잃는다' },
  ridge: { gain: '한 계절 더 돌아 뒤로 나온다 — 성을 비켜 치고 높은 곳에서 쏠 수 있다', risk: '들키면 산길에서 걸린다' },
  cliff: { gain: '산성 절벽을 넘어 성 안으로 — 적은 사람일수록 잘 된다', risk: '실패하면 떨어져 많이 잃는다' },
}

/** 계절에 막힌 길 — 갈 수는 있다. 고를 때 미리 보인다 (형: "불가능하게 만들지 말고 패널티 · 사전에 안내") */
export const HARD_LINE = {
  winterPass: '눈 덮인 고개 — 얼어서 사람을 잃고 한 계절 더 걸린다',
  summerFord: '장마에 불어난 나루 — 떠내려가 사람을 잃고 한 계절 더 걸린다',
} as const

/** 깃발(명령)의 이름 — 우리 옛 진법의 말로. '일기토'처럼 남의 나라 게임 말은 쓰지 않는다 (형 2026-10-19) */
export const CMD_NAME: Record<Cmd, string> = {
  charge: '돌격', hold: '방진', open: '길 트기', ford: '여울 막기', rocks: '바위 굴리기', gate: '성문 깨기', ram: '배 들이받기',
  volley: '화살비', counter: '맞쏘기', fire: '불화살', height: '높은 곳',
  flank: '옆치기', punch: '돌파', pursue: '추격', guard: '호위',
  drum: '격려', duel: '장수 겨루기', capture: '적장 사로잡기', retreat: '퇴각한다', art: '장수의 비기', feast: '호궤',
}
/** 깃발 한 줄 — 무엇을 이기고 무엇에 지나 */
const CMD_DOES: Record<Cmd, string> = {
  charge: '길 튼 적을 뚫고 궁수까지 덮친다 · 버티는 방진에 꺾인다 (흔들리는 방진은 뚫는다)',
  hold: '돌격을 받아 꺾는다 · 덜 잃는다 · 서 있으면 화살받이가 된다',
  open: '앞줄을 벌려 우리 화살비를 세게 한다 · 방진을 이긴다 · 돌격에 뚫린다',
  ford: '여울목에서 버틴다 — 건너오는 돌격이 크게 꺾인다 · 이 땅에서만, 한 번',
  rocks: '비탈에서 바위를 굴려 맞붙기 전에 적 앞줄을 깎는다 · 이 땅에서만, 한 번',
  gate: '성문을 들이친다 — 방진에도 꺾이지 않는다 · 성 앞에서만, 한 번',
  ram: '뱃머리로 들이받는다 — 물 위의 돌격 · 배가 있을 때만, 한 번',
  volley: '적 앞줄에 화살을 퍼붓는다 · 서 있는 방진에 잘 먹힌다',
  counter: '적 궁수를 겨눈다 · 적 화살비가 약해진다',
  fire: '불을 놓는다 · 바람이 돌면 우리가 흔들린다 · 한 번',
  height: '높은 곳에서 내리쏜다 — 화살이 세고 방진이 단단해진다 · 이 땅에서만, 한 번',
  flank: '옆으로 돌아 궁수(없으면 앞줄 옆구리)를 친다 · 적 기병이 호위하면 막힌다',
  punch: '앞줄과 함께 들이친다 · 방진에 부딪히면 크게 다친다',
  pursue: '흔들리는 적을 쫓아 크게 벤다 · 안 흔들리면 헛걸음',
  guard: '장수 곁을 지킨다 — 사로잡기를 막고 옆치기를 받아 내고, 물러날 때 덜 잃는다',
  drum: '장수가 군사를 다잡는다 — 사기가 조금 오른다',
  feast: '곳간의 곡식을 풀어 군사를 먹인다 — 사기가 크게 오르고(처음 사기까지) 이 합에 밀려도 반만 꺾인다 · 한 판에 한 번',
  duel: '장수끼리 나선다 · 이기면 적이 무너지고, 지면 우리 장수가 다치거나 쓰러진다 · 한 번',
  capture: '날랜 무리를 적장에게 보낸다 · 무리가 호위보다 크고 적이 흔들릴수록 잘 된다 · 놓치면 무리를 잃는다',
  // 퇴각 — 사실상 이 싸움을 지는 것 (형 10-24: "물러난다는 사실상 패배 확정 · 퇴각한다 · 붉게 · 설명 확실히")
  retreat: '이 싸움을 접고 퇴각한다 — 이 싸움은 진다. 대신 군사를 덜 잃고 장수는 안 잡힌다',
  art: '그 장수만의 수 · 한 판에 한 번',
}

/**
 * 깃발 카드에 쓰는 한 줄 — 길게 누르면 CMD_DOES 전부 (형 10-23: "카드들이 텍스트가 너무 긴데 · 적장 사로잡기는 10줄이 넘어")
 */
const CMD_SHORT: Record<Cmd, string> = {
  charge: '길 튼 적을 뚫는다 · 방진에 꺾인다', hold: '돌격을 꺾는다 · 화살에 약하다', open: '화살비를 세게 · 돌격에 뚫린다',
  ford: '건너오는 돌격을 크게 꺾는다', rocks: '맞붙기 전에 앞줄을 깎는다', gate: '방진에도 안 꺾이는 들이치기', ram: '물 위의 돌격',
  volley: '앞줄에 화살비 · 방진에 잘 먹힌다', counter: '적 궁수를 누른다', fire: '불을 놓는다 · 바람이 돌면 위험', height: '내리쏜다 · 방진도 단단',
  flank: '옆으로 돌아 궁수를 친다', punch: '앞줄과 함께 들이친다', pursue: '흔들리는 적을 크게 벤다', guard: '장수를 지킨다',
  drum: '사기가 오른다', duel: '장수끼리 맞붙는다', capture: '적장을 잡으러 간다 · 놓치면 잃는다', retreat: '싸움을 접는다 · 진다 · 덜 잃는다', art: '그 장수만의 수', feast: '사기를 크게 · 이 합엔 덜 꺾인다',
}

/** 장수의 비기 — 이름 · 그림 · 하는 일 (heroes.heroArt · tactics 의 비기). 장수마다 다르니 깃발에 그 이름으로 뜬다 */
export const ART_NAME: Readonly<Record<Art, string>> = {
  snipe: '명궁의 한 발', rite: '진중 굿', sway: '항복 권유', stand: '버텨라', ambush: '샛길 기습',
  vanguard: '선봉에 선다', feint: '거짓 퇴각', order: '진을 다잡는다', shout: '큰 외침',
}
export const ART_ICON: Readonly<Record<Art, string>> = {
  snipe: 'unit-archer', rite: 'unit-shaman', sway: 'status-betrayal', stand: 'unit-shield-wall', ambush: 'unit-scouts',
  vanguard: 'unit-general', feint: 'unit-porters', order: 'unit-drummers', shout: 'status-morale-up',
}
export const ART_DOES: Readonly<Record<Art, string>> = {
  snipe: '장수가 몸소 적장을 쏜다 — 적장이 다쳐 사로잡기 쉬워지고 적 사기가 꺾인다 · 한 번',
  rite: '진중에서 굿을 한다 — 우리 사기가 크게 오른다 (처음보다 높아질 수 있다) · 한 번',
  sway: '흔들리는 적에게 무기를 버리라 외친다 — 무리마다 일부가 넘어온다 · 안 흔들리면 헛일 · 한 번',
  stand: '백 사람의 이름을 부르며 버틴다 — 이 합 우리가 덜 잃는다 · 한 번',
  ambush: '샛길로 돌린 무리가 먼저 친다 — 적 궁수(없으면 앞줄)가 쓰러진다 · 한 번',
  vanguard: '장수가 맨 앞에 선다 — 이 합 우리 앞줄이 세다 · 한 번',
  feint: '물러나는 척 적의 돌격을 끌어들인다 — 적이 달려들면 꺾고, 안 달려들면 헛일 · 한 번',
  order: '흐트러진 진을 다잡는다 — 이 합 우리가 덜 잃는다 · 한 번',
  shout: '크게 외쳐 군사를 일으킨다 — 우리 사기가 오른다 · 한 번',
}
/** 비기 카드의 한 줄 */
const ART_SHORT: Readonly<Record<Art, string>> = {
  snipe: '적장을 몸소 쏜다', rite: '사기가 크게 오른다', sway: '흔들리는 적이 넘어온다', stand: '이 합 덜 잃는다', ambush: '샛길로 먼저 친다',
  vanguard: '이 합 앞줄이 세다', feint: '물러나는 척 끌어들인다', order: '진을 다잡는다', shout: '사기가 오른다',
}
/** 겨뤄 본 적장의 버릇 — 앞줄이 즐겨 하는 것 */
const HABIT_LINE: Partial<Record<Cmd, string>> = {
  charge: '늘 먼저 달려든다', hold: '방패 뒤에서 버티기를 좋아한다', open: '앞줄을 벌리고 활부터 쏜다',
}
/** 적진의 낌새 — 적 앞줄이 다음에 할 것 */
const HINT_LINE: Partial<Record<Cmd, string>> = {
  charge: '창끝을 낮추고 달려들 기세다', hold: '방패를 겹쳐 세우고 버틸 채비다', open: '앞줄이 벌어지고 궁수들이 그 틈으로 나온다',
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
const OMEN_WORD: Partial<Record<Cmd, string>> = { charge: '돌격할 기세', hold: '버틸 채비', open: '활을 쏠 채비' }
/** 적 앞줄의 수를 이기는 우리 앞줄의 수 — 방진 > 돌격 > 길 트기 > 방진 */
const FRONT_COUNTER: Partial<Record<Cmd, Cmd>> = { charge: 'hold', hold: 'open', open: 'charge' }
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
  /** 호궤 — 엽전 대신 곡식이 풀리는 소리 자리 (싸움 소리 고르기 판에서 바꾼다) */
  feast: snd('tap_coin'),
  /** 맞부딪힘 — 상성에서 이겼다(필살) · 그냥 */
  crit: snd('battle_crit'), clash: snd('battle_clash'),
  /** 마지막 일격 · 장수 겨루기 이김 — 형이 싸움 소리 고르기 판에서 고른 것 (10-25) */
  final: 'realm/sfx/battle_final_c1.ogg', duelWin: 'realm/sfx/battle_duelwin_c2.ogg',
  /** 사로잡았다 · 장수 겨루기 · 마지막 일격(적이 무너졌다) · 이겼다 · 졌다 */
  caught: 'jingleUnlock', win: snd('horn_victory'), lose: snd('defeat'),
  /** 싸움이 열린다 — 북 두 번, 종 한 번, 함성 */
  openDrum: snd('war_drum'), openBell: snd('war_bell'), cry: snd('war_cry'),
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
const ROUND_NAME = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째']

export interface WarHost {
  readonly art: string
  readonly me: string
  ding(name: string, vol?: number, rate?: number, dur?: number): void
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
export function actRows(acts: readonly Act[] | undefined, ourS: 'a' | 'd', art: string, mixA: Readonly<Partial<Record<string, number>>>, mixD: Readonly<Partial<Record<string, number>>>): string {
  const list = (acts ?? []).filter((x) => !(x.c === 'drum' && x.tg === undefined))
  if (list.length === 0) return ''
  const mixOfS = (s: 'a' | 'd'): Readonly<Partial<Record<string, number>>> => (s === 'a' ? mixA : mixD)
  let h = '<div class="wacts">'
  for (const x of list) {
    const us = x.s === ourS
    const other = x.s === 'a' ? 'd' : 'a'
    const r = ACT_RES[x.res]
    const good = r === 'even' ? '' : (r === 'ok') === us ? ' good' : ' bad'
    const verb = x.c === 'art' && x.art !== undefined ? ART_NAME[x.art] : CMD_NAME[x.c]
    const badge = r === 'ok' ? '✓' : r === 'no' ? '✕' : '='
    const word = r === 'ok' ? (x.tg !== undefined ? '먹혔다' : '해냈다') : r === 'no' ? (x.res === 'wasted' ? '헛방' : '막혔다') : '맞섰다'
    h += `<div class="wact${us ? ' us' : ' foe'}${good}"><span class="who">${us ? '우리' : '적'}</span><img src="${art}icon/${groupIcon(mixOfS(x.s), x.g)}.png" alt=""><b>${esc(verb)}</b>`
    if (x.tg !== undefined) h += `<i class="arw">→</i><img class="tg" src="${art}icon/${groupIcon(mixOfS(other), x.tg)}.png" alt="">`
    h += `<span class="res">${badge} ${word}</span>`
    if ((x.tl ?? 0) > 0) h += `<span class="loss">${us ? '적' : '우리'} −${x.tl}</span>`
    if ((x.sl ?? 0) > 0) h += `<span class="loss own">${us ? '우리' : '적'} −${x.sl}</span>`
    // 물러나기 — 잃은 수만 있으면 「−21」을 남은 수로 읽었다 (형 10-25: "330명이 21명 됐음 · 21명이 죽은 거 아닌가?") — 빠져나간 수를 곁에
    if (x.c === 'retreat' && x.n !== undefined) h += `<span class="kept">${x.n}명 빠져나갔다</span>`
    h += '</div>'
  }
  return h + '</div>'
}

/** 원군이 닿은 합의 띠 (형: "열세에 밀린 아군에 로한의 기병대 같은 쾌감") — 우리 원군은 금빛, 적 원군은 붉게 */
export function reliefBanner(rd: RoundLog, ourS: 'a' | 'd', art: string): string {
  const x = rd.relief
  if (x === undefined) return ''
  const us = x.side === ourS
  const ic = x.horse ? UNIT_ICON.horse : UNIT_ICON.spear
  const line = us
    ? (x.horse ? `우리 기병 원군 ${x.men}명이 옆구리를 들이친다! 적이 흔들린다` : `우리 원군 ${x.men}명이 닿았다! 적의 옆을 친다`)
    : (x.horse ? `적의 기병 원군 ${x.men}명이 닿았다 — 우리 옆이 뚫린다` : `적의 원군 ${x.men}명이 닿았다 — 우리가 밀린다`)
  return `<div class="wrelief ${us ? 'us' : 'foe'}"><img src="${art}icon/${ic}.png" alt=""><b>${us ? '원군이다!' : '적의 원군'}</b><span>${esc(line)}</span></div>`
}

/** 한 합에 무리마다 잃은 사람 — [무리, 수] (그 합 앞의 무리 수에서 뺀다) */
function groupLoss(before: Readonly<Partial<Record<Grp, number>>>, after: Readonly<Partial<Record<Grp, number>>> | undefined): Array<[Grp, number]> {
  if (after === undefined) return []
  return (['front', 'bows', 'horse'] as const).map((g) => [g, Math.max(0, Math.round((before[g] ?? 0) - (after[g] ?? 0)))] as [Grp, number]).filter(([, n]) => n > 0)
}

/** 맡긴 싸움의 지휘 버릇 — 이름과 한 줄 (tactics.aiOrder 가 실제로 그렇게 싸운다) */
const STYLE_WORD: Readonly<Record<BattleStyle, readonly [string, string]>> = {
  careful: ['신중한 지휘', '적의 수를 읽고 받아친다'],
  archer: ['명궁의 지휘', '앞줄이 길을 트고 활을 앞세운다'],
  mountain: ['산사람의 지휘', '높은 데와 돌을 놓치지 않는다'],
  river: ['물길잡이의 지휘', '나루를 끼고 싸운다'],
  steadfast: ['일편단심', '밀려도 물러서지 않는다'],
}
/** 맡기면 이 장수는 어떻게 싸우나 — 특성 → 겁 → 지략 → 무예 순으로 (형 10-24: "자동전투는 장수 특성에 따라 효과 나오게") */
export function styleWord(h: { traits?: readonly string[]; ryak: number; mu: number } | undefined): readonly [string, string] {
  if (h === undefined) return ['군대의 버릇', '무리마다 제 버릇대로 싸운다']
  const s = BATTLE_STYLES.find((x) => h.traits?.includes(x) === true)
  if (s !== undefined) return STYLE_WORD[s]
  if (h.traits?.includes('coward') === true) return ['겁 많은 장수', '밀리면 먼저 물러난다']
  if (h.ryak >= 7) return ['지략가의 지휘', '적의 수를 곧잘 읽는다']
  if (h.mu >= 7) return ['맹장의 지휘', '적장과 겨루기를 마다하지 않는다']
  return ['장수의 지휘', '무난하게 싸운다']
}

/** 맡겼을 때 — 장수의 지략이 무엇을 해 주나 (aiOrder: 지략만큼 적 앞줄의 버릇을 읽어 맞수를 둔다 · 흔들리는 적에 들이친다) */
function autoLine(h: { name: string; ryak: number } | undefined): string {
  if (h === undefined) return '장수가 없다 — 무리마다 제 버릇대로 싸운다'
  const full = Math.max(1, Math.min(5, Math.round(h.ryak / 2)))
  const dots = '●'.repeat(full) + '○'.repeat(5 - full)
  const feel = h.ryak >= 8 ? '적의 수를 잘 읽어 맞수를 둔다 — 맡겨도 좋다' : h.ryak >= 6 ? '곧잘 맞수를 둔다' : h.ryak >= 4 ? '반쯤은 제 버릇대로 싸운다' : '수를 잘 못 읽는다 — 직접 고르는 게 낫다'
  return `${esc(h.name)} · 지략 <span class="wdots">${dots}</span> — ${feel}`
}

function face(id: string | null, art: string, fallback: string): string {
  const file = id !== null ? bustOf(id) : undefined
  return file !== undefined ? `<img class="wf" src="${art}bust/${file}.jpg" alt="">` : `<img class="wf unit" src="${art}icon/${fallback}.png" alt="">`
}

/** 사로잡기 — 말과 색으로 (숫자 확률은 안 보인다) */
function captureWord(p: number): [string, string] {
  if (p >= 0.5) return ['잡을 수 있다', 'hi']
  if (p >= 0.3) return ['손이 닿는다', 'mid']
  if (p >= 0.15) return ['해볼 만하다', 'lo']
  if (p >= 0.05) return ['어렵다', 'no']
  return ['어림없다', 'no']
}

/**
 * 그 합의 말 — 눈에 보이는 잃은 수로 정한다 (우리 −37 · 적 −47 이면 우리가 민 것). 필살을 냈는데 "밀렸다"가 뜨면 헷갈린다.
 * 양쪽 다 안 잃었으면 판정의 기세(push)로.
 */
function pushWord(push: number, weAtk: boolean, lostUs: number, lostFoe: number): [string, string] {
  const p = lostUs + lostFoe > 0 ? lostFoe / (lostUs + lostFoe) : weAtk ? push : 1 - push
  if (p >= 0.62) return ['크게 밀었다', 'good']
  if (p >= 0.53) return ['조금 밀었다', 'good']
  if (p <= 0.38) return ['크게 밀렸다', 'bad']
  if (p <= 0.47) return ['조금 밀렸다', 'bad']
  return ['팽팽하다', '']
}

/** 싸움 앞의 한 줄 — 진군 방식과 기습의 결과 (우리 쪽 시점) */
function introLine(l: BattleLine, weAtk: boolean, foe: string): string {
  if (l.field === true) return '길 한가운데서 두 군대가 마주쳤다. 성도 장정도 없다.'
  const ap = l.approach ?? 'road'
  if (!weAtk) {
    if (l.ambush === 'success') return ap === 'cliff' ? `${josa(foe, '이', '가')} 절벽을 타고 성 안으로 뛰어내렸다!` : `${josa(foe, '이', '가')} 숨어 들이쳤다! 자다 깬 군사들이 무기를 찾는다.`
    if (l.ambush === 'caught') return `숨어 오던 ${josa(foe, '을', '를')} 먼저 알아챘다. 기다리던 대로 맞는다.`
    return `${josa(foe, '이', '가')} 대로로 다가온다. 진을 치고 맞는다.`
  }
  const ok = l.ambush === 'success'
  switch (ap) {
    case 'road': return '대로로 당당히 다가섰다. 적도 진을 치고 기다린다.'
    case 'night': return ok ? '밤길로 숨어 닿았다. 적은 아직 잠들어 있다 — 성문이 닫히기 전에 들이친다.' : '어둠 속에서 북이 울린다. 들켰다 — 적이 기다리고 있었다.'
    case 'ford': return ok ? '갈대에 숨어 여울을 건넜다. 적은 강을 벽으로 믿고 있었다.' : '강 한가운데서 들켰다. 물을 헤치는 사이 화살이 쏟아진다.'
    case 'ridge': return ok ? '산기슭을 돌아 적의 뒤로 나왔다 — 높은 곳을 잡았다.' : '산길에서 적의 정찰꾼에게 들켰다.'
    case 'cliff': return ok ? '절벽을 타고 올라 성 안으로 뛰어내렸다!' : '절벽을 오르다 들켰다. 돌과 화살에 많이 떨어졌다.'
  }
}

/** 한 쪽이 든 깃발들 — 앞줄 · 활 · 기병 · 장수(북은 빼고) */
/**
 * 깃발 그림 — 명령마다 한 폭 (public/realm/flag · 제미나이 Argon 네 장을 잘랐다, assets_src/realm/flags).
 * 형 10-23: "깃발을 고르는 거였다면 돌격·방진·길 트기 같은 카드들을 깃발처럼 이미지 만들어서 UI 고도화 했어야"
 */
export function flagSrc(art: string, c: Cmd, ak?: Art): string {
  return `${art}flag/flag-${c === 'art' ? (ak !== undefined ? `art-${ak}` : 'drum') : c}.png`
}

function flags(o: RoundOrder | undefined, chip: Cmd, art: string, ak?: Art): string {
  const xs: Cmd[] = o === undefined ? [chip] : [o.front, o.bows, o.horse, o.lead !== 'drum' ? o.lead : undefined].filter((c): c is Cmd => c !== undefined)
  // 장수의 비기는 그 비기의 이름·그림으로 (빛나는 칩)
  return xs.map((c) => (c === 'art' && ak !== undefined
    ? `<span class="wfl art"><img class="flg" src="${flagSrc(art, c, ak)}" alt="">${ART_NAME[ak]}</span>`
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
  if (seasonOf(r.season) === 'winter') return 'snow'
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
export function warName(r: Realm, l: BattleLine): string {
  return r.nodes[l.node] !== undefined ? battleName(r, l) : `${l.field === true && l.edge !== undefined ? fieldName(r, l.edge) : l.node} 싸움`
}


/**
 * 싸움터의 땅 한 칸 — 그림 · 이름 · 무엇이 달라지나 · 누구에게 이로운가 (형 10-25: "지형정보라던가 이런것도 이미지나 아이콘으로 보여야").
 * 판정(season.fortMul · 땅의 수 · 진군 방식)과 같은 규칙만 적는다. VS 화면과 전장 왼쪽 위에 같은 칩이 뜬다
 */
export interface TerrChip { readonly k: string; readonly icon: string; readonly name: string; readonly line: string; readonly who: 'us' | 'foe' | '' }
const AP_CHIP: Readonly<Record<Approach, readonly [string, string]>> = {
  road: ['route-column', '대로'], night: ['emblem-moon', '밤길'], ford: ['route-ferry', '여울 건너기'], ridge: ['emblem-mountain', '산기슭'], cliff: ['route-fortstair', '절벽'],
}
const AP_EFFECT: Readonly<Record<Approach, readonly [string, string]>> = {
  road: ['치는 쪽이 질서 있게 닿아 사기가 오른다', '치는 쪽이 질서 있게 닿아 사기가 오른다'],
  night: ['잠든 적을 친다 — 성문도 장정도 못 막는다', '기다리던 쪽의 매복에 걸렸다'],
  ford: ['강만 믿던 적을 친다', '물 한가운데서 맞아 크게 잃었다'],
  ridge: ['뒤로 돌아 나왔다 — 성이 덜 막아 주고 지키는 쪽 사기가 꺾인다', '산길에서 걸렸다'],
  cliff: ['적이 뒤에서 나타났다 — 지키는 쪽 사기가 꺾인다', '떨어져 많이 잃었다'],
}
export function terrChips(r: Realm, l: BattleLine, me: string, foe: string): TerrChip[] {
  const weAtk = l.atkFaction === me
  const def: 'us' | 'foe' = weAtk ? 'foe' : 'us'
  const atk: 'us' | 'foe' = weAtk ? 'us' : 'foe'
  const winter = seasonOf(r.season) === 'winter'
  const node = r.nodes[l.node]
  // 잠든 채 들이쳐졌으면 지키는 쪽은 땅의 수를 못 쓴다 (season: defTerrain)
  const sleep = l.field !== true && l.ambush === 'success'
  const dw = sleep ? '' : def
  const ds = sleep ? ' — 이번엔 기습을 당해 못 쓴다' : ''
  const out: TerrChip[] = []
  if (l.field === true) out.push({ k: 'road', icon: 'route-column', name: '길 위', line: '길에서 마주쳤다 — 성도 장정도 없이 맞붙은 그대로 겨룬다', who: '' })
  else if (node !== undefined) {
    if (node.kind === 'fort') out.push({ k: 'fort', icon: 'settle-mountain-hold', name: '산성', line: `지키는 쪽이 크게 단단하다 · 높은 곳에서 바위를 굴린다${ds}`, who: def })
    else if (node.tags.includes('high')) out.push({ k: 'high', icon: 'settle-hill-fort', name: '높은 터', line: `지키는 쪽이 단단하다 · 높은 곳에서 바위를 굴린다${ds}`, who: def })
    if (node.tags.includes('palisade')) out.push({ k: 'palisade', icon: 'settle-palisade', name: '목책', line: '지키는 쪽이 단단하다 · 치는 쪽은 「성문 깨기」를 한 번 쓸 수 있다', who: def })
    if (node.tags.includes('moat')) out.push(winter ? { k: 'moat', icon: 'settle-moat', name: '언 해자', line: '겨울이라 해자가 얼었다 — 막아 주지 못한다', who: '' } : { k: 'moat', icon: 'settle-moat', name: '해자', line: '지키는 쪽이 단단하다 — 치는 쪽은 물을 건너와야 한다', who: def })
    if (node.kind === 'port') out.push({ k: 'port', icon: 'settle-port-town', name: '포구', line: '수군이 세다 — 배가 있는 쪽은 뱃머리로 들이받을 수 있다', who: '' })
  }
  const via = l.via
  if (via === 'pass') out.push({ k: 'pass', icon: 'settle-pass', name: '고갯길', line: `지키는 쪽이 높은 곳을 잡고 바위를 굴린다${ds}`, who: dw })
  else if (via === 'forest') out.push({ k: 'forest', icon: 'settle-clearing', name: '숲길', line: `지키는 쪽이 높은 곳을 잡을 수 있다${ds}`, who: dw })
  else if (via === 'ford') out.push({ k: 'ford', icon: 'route-steppingstones', name: '나루', line: `건너오는 쪽은 돌격이 꺾인다 — 지키는 쪽 「여울 막기」${ds}`, who: dw })
  else if (via === 'reeds') out.push({ k: 'ford', icon: 'settle-reed-ambush', name: '갈대 물가', line: `건너오는 쪽은 돌격이 꺾인다 — 지키는 쪽 「여울 막기」${ds}`, who: dw })
  else if (via === 'mudflat') out.push({ k: 'ford', icon: 'route-boardwalk', name: '갯벌', line: '발이 빠져 걸음이 느리다', who: '' })
  else if (via === 'sea' && node?.kind !== 'port') out.push({ k: 'sea', icon: 'route-searoute', name: '바닷길', line: '수군이 세다 — 배가 있는 쪽은 뱃머리로 들이받을 수 있다', who: '' })
  if (l.field !== true) {
    const ap = l.approach ?? 'road'
    const caught = l.ambush === 'caught'
    const ok = ap === 'road' || l.ambush === 'success'
    const [icon, name] = AP_CHIP[ap]
    const eff = AP_EFFECT[ap][ok ? 0 : 1]
    const mil = l.militia > 0 ? (weAtk ? ` 마을 장정 ${l.militia}명이 막아선다.` : ` 마을 장정 ${l.militia}명이 함께 선다.`) : ''
    out.push({ k: 'ap', icon, name: caught ? `${name} · 들켰다` : name, line: `${introLine(l, weAtk, foe)} ${eff}.${mil}`, who: caught ? def : ok ? atk : '' })
  }
  return out
}

/** 땅 칩 하나 — 그림과 이름 (누구에게 이로운지 테두리 색) */
function terrChipHtml(art: string, c: TerrChip, cls: string): string {
  return `<i class="${cls}${c.who !== '' ? ` ${c.who}` : ''}" data-tk="${c.k}"><img src="${art}icon/${c.icon}.png" alt=""><b>${esc(c.name)}</b></i>`
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
  const mixOf = (i: 0 | 1): Readonly<Partial<Record<string, number>>> => st?.mix?.[i] ?? {}
  const pick = p !== undefined && p.round === shown
  const menOf = (i: 0 | 1, g: Grp): number => {
    if (pick && i === ourI) { const x = p!.groups.find((y) => y.g === g); if (x !== undefined) return x.men }
    if (pick && i === foeI && p!.foe[g] !== undefined) return p!.foe[g]!
    const gm = last !== undefined ? (i === 0 ? last.ga : last.gd) : undefined
    return Math.round((gm ?? groupMen(mixOf(i) as Parameters<typeof groupMen>[0]))[g] ?? 0)
  }
  const head = (side: 'us' | 'foe', icon: string, name: string, sub: string): string =>
    `<div class="wth ${side}"><em class="wck">${side === 'us' ? '우리' : '적'}</em>${icon}<b>${esc(name)}</b>${sub !== '' ? `<span>${esc(sub)}</span>` : ''}</div>`
  const flagLine = (c: Cmd, ak?: Art): string => `<p class="wtf"><img src="${flagSrc(art, c, ak)}" alt=""><span><b>${ak !== undefined ? ART_NAME[ak] : CMD_NAME[c]}</b>${esc(ak !== undefined ? ART_DOES[ak] : CMD_DOES[c])}</span></p>`
  const foeList = (): string => {
    const gs = (['front', 'bows', 'horse'] as const).map((g) => [g, menOf(foeI, g)] as const).filter(([, v]) => v > 0)
    return gs.length > 0 ? `<div class="wtl">${gs.map(([g, v]) => `<span><img src="${art}icon/${GROUP_ICON[g]}.png" alt="">${esc(groupLabel(mixOf(foeI), g))} <i>${v}명</i></span>`).join('')}</div>` : ''
  }
  const chips = terrChips(prev, l, me, fname(foeF))
  const terrBox = (c: TerrChip | undefined): string => {
    if (c === undefined) return ''
    const who = c.who === 'us' ? '<em class="wtw us">우리에게 이롭다</em>' : c.who === 'foe' ? '<em class="wtw foe">적에게 이롭다</em>' : ''
    return `<div class="wtt"><img src="${art}icon/${c.icon}.png" alt=""><span><b>${esc(c.name)}</b>${who}</span></div><p>${esc(c.line)}</p>`
  }
  if (key.startsWith('terr:')) return terrBox(chips.find((c) => c.k === key.slice(5)))
  if (key.startsWith('tp:')) {
    const k = key.slice(3)
    if (k === 'arrows') return `<div class="wtt"><img src="${art}fx/field/arrows.png" alt=""><span><b>꽂힌 화살</b></span></div><p>맞은편이 이쪽 앞줄에 활을 쏘았다</p>`
    const c = (TP_CHIP[k] ?? []).map((x) => chips.find((y) => y.k === x)).find((y) => y !== undefined)
    return terrBox(c)
  }
  if (key === 'omen') {
    let h = ''
    if (pick && p!.hint !== null) {
      const hint = p!.hint
      const habit = p!.hintSrc === 'habit'
      const hl = habit ? HABIT_LINE[hint] : HINT_LINE[hint]
      h += `<div class="wtt"><img src="${flagSrc(art, hint)}" alt=""><span><b>${habit ? '적장의 버릇' : '적 앞줄의 낌새'}</b><small>${habit ? '겨뤄 본 적이 있어 안다 — 이번에도 그럴지는 모른다' : l.field === true ? '눈앞에서 맞붙어 보인다' : weAtk ? '척후가 이번 계절 보고 왔다' : '다가오는 것을 지켜봤다'}</small></span></div>`
      if (hl !== undefined) h += `<p>${esc(hl)}</p>`
      const win = FRONT_COUNTER[hint]
      const lose = (Object.keys(FRONT_COUNTER) as Cmd[]).find((c) => FRONT_COUNTER[c] === hint)
      h += '<div class="wts"><b>이렇게 싸운다</b>'
      if (win !== undefined) h += `<p class="good">앞줄에 「${CMD_NAME[win]}」 — 적 낌새를 받아친다</p>`
      if (lose !== undefined) h += `<p class="bad">${esc(josa(CMD_NAME[lose], '은', '는'))} 이 낌새에 당한다</p>`
      h += '</div>'
    } else {
      h += `<div class="wtt"><i class="wtq">?</i><span><b>적진의 속</b><small>보이지 않는다</small></span></div><p>정찰을 보냈거나 그 적장과 겨뤄 본 적이 있으면 보인다</p>`
      h += '<div class="wts"><b>이렇게 싸운다</b><p>속을 모르면 깃발 밑 짐작 막대의 폭이 넓다 — 옅은 데까지 보고 고른다</p></div>'
    }
    if (pick && p!.foeWaver) h += '<p class="bad">적이 흔들린다 — 방진도 돌격을 못 받아 낸다. 쫓을 때다</p>'
    const fl = foeList()
    if (fl !== '') h += `<div class="wts"><b>맞은편</b>${fl}</div>`
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
    if (hh === undefined) return head(side, '', `${fname(f)} 군`, '') + '<p>장수 없이 싸운다</p>'
    const [sn, sl] = styleWord(hh)
    let h = head(side, `<span class="wtface">${face(id, art, 'unit-general')}</span>`, hh.name, fname(f)) + `<p><b class="wsty">${esc(sn)}</b> ${esc(sl)}</p>`
    if (side === 'us') {
      const c = pick ? sel.lead : last !== undefined ? (weAtk ? last.oa : last.od)?.lead : undefined
      if (c !== undefined) h += flagLine(c, c === 'art' ? p?.art : undefined)
      else if (pick && p!.lead.length > 0) h += '<p class="dim">아직 장수의 명령을 안 골랐다 — 누르면 선택</p>'
    } else if (pick) {
      const [w] = captureWord(p!.capture)
      h += `<p>사로잡기 — <b>${esc(w)}</b> <small class="dim">(우리 날랜 무리 ${p!.squad} · 적장 호위 ${p!.escort})</small></p>`
    }
    return h
  }
  const g = m[3] as Grp
  const icon = `<img src="${art}icon/${GROUP_ICON[g]}.png" alt="">`
  let h = head(side, icon, groupLabel(mixOf(i) as Parameters<typeof groupLabel>[0], g), `${menOf(i, g)}명`)
  const kinds = Object.entries(mixOf(i)).filter(([k, v]) => (v ?? 0) > 0 && groupOf(k as Parameters<typeof groupOf>[0]) === g)
  if (kinds.length > 1) h += `<p class="dim">처음 ${kinds.map(([k, v]) => `${UNIT_NAME[k as keyof typeof UNIT_NAME]} ${v}`).join(' · ')}</p>`
  if (side === 'us') {
    const c = pick ? sel[g] : last !== undefined ? (weAtk ? last.oa : last.od)?.[g] : undefined
    if (c !== undefined) h += flagLine(c)
    else if (pick && p!.groups.some((x) => x.g === g && x.options.length > 0)) h += '<p class="dim">아직 깃발을 안 골랐다 — 누르면 선택</p>'
    else h += '<p class="dim">따로 깃발을 들 만큼 많지 않다 — 가까운 무리와 섞여 싸운다</p>'
  } else {
    if (pick && g === 'front' && p!.hint !== null) {
      const win = FRONT_COUNTER[p!.hint]
      h += `<p>낌새 — <b>${OMEN_WORD[p!.hint] ?? CMD_NAME[p!.hint]}</b>${win !== undefined ? ` · ${esc(josa(CMD_NAME[win], '으로', '로'))} 받아친다` : ''}</p>`
    } else if (pick && g === 'front') h += '<p class="dim">무엇을 할지 모른다 — 정찰을 보내면 보인다</p>'
    else if (!pick && last !== undefined) { const c = (weAtk ? last.od : last.oa)?.[g]; if (c !== undefined) h += flagLine(c) }
    if (pick && p!.foeWaver) h += '<p class="bad">흔들린다 — 대열이 성기다</p>'
  }
  return h
}

/** 전장 한 판의 화면 — 보인 합(shown)까지. 마지막 합은 천천히 풀린다(anim). sel 은 지금 고르는 깃발 */
/** 활을 쏘는 명령 — 그 합에 화살이 날아간다 */
const SHOOT_CMD: ReadonlySet<string> = new Set(['volley', 'counter', 'open', 'height', 'fire'])
/** 동작 그림(8컷 띠)이 있는 병종 — 0·1 서기 · 2·3 걷기 · 4·5 찌르기 · 6 맞음(안 씀) · 7 쓰러짐 */
const ANIM_SOL: Readonly<Record<string, number>> = { spear: 167 / 160, shield: 165 / 160, bow: 139 / 160, horse: 157 / 160, boat: 164 / 160, crossbow: 152 / 160, pike: 162 / 160, axe: 144 / 160, marine: 155 / 160 } // 병종 → 띠 한 칸의 가로세로 비 (tools/strip-frames.mjs 가 찍어 준다)
/** 전장의 진이 직접 보여 주는 무리 명령 — 위 겹의 큰 연출을 띄우지 않는다 */
/**
 * 수군의 그림 — 배를 탄 수군은 물 위 싸움(바닷길·포구)에서만. 땅에서는 걸어서 싸우는 수군(두건·갈고리창·둥근 방패)
 * (형 10-25: "수군이미지는 배태우지말고 … 오직 수상전투 할때만 배탄 수군")
 */
function solArt(k: string, sea: boolean): string {
  return k === 'boat' && !sea ? 'marine' : k
}
const FIELD_CMD: ReadonlySet<string> = new Set(['charge', 'hold', 'open', 'volley', 'counter', 'flank', 'punch', 'pursue', 'guard', 'drum', 'capture', 'duel', 'retreat'])
/** 장수 기술의 결 — 초상이 튀어나오는 몸짓 */
type CutKind = 'lead' | 'cheer' | 'strike' | 'grab' | 'back' | 'shot' | 'call' | 'guard'
const CUT_OF: Readonly<Partial<Record<Cmd, CutKind>>> = { duel: 'strike', capture: 'grab', retreat: 'back' } // 격려는 흔해 장면을 띄우지 않는다 — 합마다 2초씩 전장을 가렸다 (형 10-25 · 전장의 격려 고리로 보인다)
const ART_CUT: Readonly<Record<Art, CutKind>> = {
  snipe: 'shot', rite: 'cheer', sway: 'call', stand: 'guard', ambush: 'strike', vanguard: 'strike', feint: 'back', order: 'cheer', shout: 'call',
}
/** 기술 몸짓마다 한 마디 — 초상 옆에 크게 */
const CUT_SHOUT: Readonly<Record<CutKind, string>> = { lead: '내게 맡겨라!', cheer: '힘을 내라!', strike: '나를 따르라!', grab: '사로잡아라!', back: '물러서라!', shot: '한 발로 끝낸다', call: '무기를 버려라!', guard: '버텨라!' }

/** 장수 기술이 나가는 장면 — 초상 · 이름 · 기술 이름 · 결마다 다른 효과 (2.2초쯤 · 누르면 바로 걷힌다) */
function cutHtml(art: string, hero: string | null, name: string, skill: string, kind: CutKind): string {
  const file = hero !== null ? bustOf(hero) : undefined
  const face = file !== undefined ? `<img class="wcf" src="${art}bust/${file}.jpg" alt="">` : `<img class="wcf unit" src="${art}icon/unit-general.png" alt="">`
  let fx = ''
  if (kind === 'cheer' || kind === 'call' || kind === 'lead') for (let i = 0; i < 3; i++) fx += `<i class="wcring" style="--t:${(0.35 + i * 0.18).toFixed(2)}s"></i>`
  if (kind === 'cheer') for (let i = 0; i < 14; i++) fx += `<i class="wcspark" style="--x:${(8 + ((i * 37) % 84)).toFixed(0)}%;--t:${(0.3 + ((i * 0.11) % 0.7)).toFixed(2)}s"></i>`
  if (kind === 'strike' || kind === 'shot') fx += `<i class="wcslash"></i>${Array.from({ length: 9 }, (_, i) => `<i class="wcline" style="--y:${(10 + i * 10)}%;--t:${(0.08 + (i % 3) * 0.05).toFixed(2)}s"></i>`).join('')}`
  if (kind === 'grab') fx += `<i class="wcrope"></i>`
  if (kind === 'guard') fx += `<i class="wcshield"></i>`
  return `<div class="wcut k-${kind}"><i class="wcbg"></i>${fx}<div class="wcpf">${face}<i></i></div><div class="wctx"><b>${esc(CUT_SHOUT[kind])}</b><span>${esc(name)} · ${esc(skill)}</span></div></div>`
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
const VOLLEY_N = 9
/** 화살비 소리 — [늦게(초), 크기, 빠르기] 여섯 발. 화면의 화살과 같은 결로 흩어진다 (꾸밈이라 판의 시드와 상관없다) */
const VOLLEY_SHOTS: ReadonlyArray<readonly [number, number, number]> = [[0, 1, 1], [0.07, 0.7, 1.12], [0.13, 0.85, 0.9], [0.22, 0.6, 1.05], [0.3, 0.75, 0.95], [0.41, 0.5, 1.18]]

/**
 * 화살 한 무리 — 낱낱이 (형: "화살이 지금 이미지 통째로 날아가는데"). dir r: 우리(왼쪽)가 쏜다 · l: 적(오른쪽)이 쏜다.
 * 화살마다 떠나는 자리·높이·거리·때가 조금씩 다르다 (꾸밈이라 판의 시드와 상관없이 고정된 굴림)
 */
function volleyHtml(art: string, dir: 'r' | 'l', at: number, end: number): string {
  const K = (end - at + 0.11) / 1.3
  let s = dir === 'r' ? 3 : 11
  const rnd = (): number => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  let h = ''
  for (let i = 0; i < VOLLEY_N; i++) {
    h += `<i style="--x:${(2 + rnd() * 14).toFixed(1)}%;--y:${(52 + rnd() * 24).toFixed(1)}%;--dx:${(56 + rnd() * 16).toFixed(1)}vw;--up:${(12 + rnd() * 16).toFixed(1)}vh;--t:${(at + rnd() * 0.35 * K).toFixed(2)}s;--z:${(0.75 + rnd() * 0.4).toFixed(2)}">`
      + `<b style="background-image:url('${art}fx/arrow.png')"></b></i>`
  }
  return `<div class="wfx-volley ${dir}" style="--k:${K};--end:${end.toFixed(2)}s">${h}</div>`
}

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
      h += `<i class="lg" style="--y:${c === 'ram' ? 66 : 56}%;${t(0)}">${img('ramlog')}</i>`
      for (let k = 0; k < 3; k++) {
        h += many(2, 'splinter', 'pop', () => `--x:${(44 + rnd() * 8).toFixed(1)}%;--y:${((c === 'ram' ? 62 : 52) + rnd() * 8).toFixed(1)}%;${z(0.6, 0.5)};${t(0.3 + k * 0.36)}`)
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
      h += many(5, 'smoke', 'pf bk', (i) => `--x:${(30 - i * 5).toFixed(1)}%;--y:${(70 + rnd() * 10).toFixed(1)}%;${z(0.7, 0.5)};${t(i * 0.09)}`)
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
  return { beats, clash, story: clash + R.warStoryGap, result: clash + R.warResultGap }
}

/** 「전투 개시」 단추의 말 — 다 골랐으면 켜진다 */
export function goWord(picked: number, n: number): string {
  return picked >= n ? '⚔ 전투 개시' : `⚔ 전투 개시 <small>무리마다 깃발 선택 · ${picked}/${n}</small>`
}

/**
 * 짐작 한 칸 — 판세 막대(우리 푸른빛 · 적 붉은빛, 폭은 옅게, 지금 판세에 금) · 말 하나 · 양쪽이 잃을 몫의 막대.
 * 숫자 대신 막대와 말로 (확률은 색·말로). 문턱은 엔진 짐작의 분포(판세 변화 ±0.13 안팎 · 한 합 손실 0.15 안쪽)에 맞췄다
 */
function guessHtml(gu: Guess | undefined, edge0: number): string {
  if (gu === undefined) return ''
  const d = (gu.edge[0] + gu.edge[1]) / 2 - edge0
  const [w, cls] = d > 0.07 ? ['크게 밀어붙인다', 'g2'] : d > 0.02 ? ['밀어붙인다', 'g1'] : d > -0.02 ? ['맞선다', 'g0'] : d > -0.07 ? ['밀린다', 'b1'] : ['크게 밀린다', 'b2']
  const pc = (x: number): string => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`
  // 잃을 군사는 막대 대신 말로 (형 10-25: "맞선다 바랑 우리 바 적 바 이건 뭘 의미하는거임") — 한 합 손실 0.16 을 끝으로 셋으로 나눈다
  const lossWord = (x: readonly [number, number]): [string, string] => {
    const m = (x[0] + x[1]) / 2 / 0.16
    return m < 0.3 ? ['조금', 'l1'] : m < 0.6 ? ['꽤', 'l2'] : ['많이', 'l3']
  }
  const [lu, lcu] = lossWord(gu.us)
  const [lf, lcf] = lossWord(gu.foe)
  // 판세 막대 — 왼쪽 끝이 우리, 오른쪽 끝이 적. 파랑이 우리 몫, 옅은 데가 짐작의 폭, 금빛 금이 지금 판세
  return `<span class="wguess ${cls}"><span class="wgq">판세</span><span class="wgk us">우리</span><span class="wgbar" style="--lo:${pc(gu.edge[0])};--hi:${pc(gu.edge[1])};--e0:${pc(edge0)}"></span><span class="wgk foe">적</span><b>${w}</b>`
    + `<span class="wgl"><span class="wgq">잃을 군사</span><span>우리 <b class="${lcu}">${lu}</b></span><span>적 <b class="${lcf}">${lf}</b></span></span></span>`
}

export function warHtml(prev: Realm, after: Realm, l: BattleLine, me: string, art: string, shown: number, anim: boolean, left: number, sel: RoundOrder = {}, active?: Grp | 'lead', more = false): string {
  const weAtk = l.atkFaction === me
  const st = l.start
  const fname = (f: string | undefined): string => (f !== undefined ? (after.factions[f]?.name ?? '?') : '?')
  const atkF = l.atkFaction ?? prev.armies[l.attacker]?.faction
  const ourF = weAtk ? atkF : l.defender
  const foeF = weAtk ? l.defender : atkF
  const heroOf = (i: 0 | 1): string | null => st?.heroes[i] ?? null
  const ourHero = heroOf(weAtk ? 0 : 1)
  const foeHero = heroOf(weAtk ? 1 : 0)
  const hname = (id: string | null, f: string | undefined): string => (id !== null ? (prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '?') : `${fname(f)} 군`)
  const ourName = hname(ourHero, ourF)
  const foeName = hname(foeHero, foeF)
  const ctx = storyCtx(prev, { start: st, atkFaction: atkF, defender: l.defender }, me)
  const rounds = (l.rounds ?? []).slice(0, shown)
  const last = rounds[rounds.length - 1]
  const plan = anim && last !== undefined ? roundPlan(last, weAtk) : null
  /** 시계의 세 때 — 0: 깃발 줄 · 1: 이야기 · 2: 밀림·잃은 수·막대 (시계가 없으면 옛 STAGE_S) */
  const tAt = (k: 0 | 1 | 2): number => (plan === null ? STAGE_S[k] : k === 0 ? 0 : k === 1 ? plan.story : plan.result)
  const n = (i: 0 | 1): number => (last === undefined ? 1 : i === 0 ? last.na : last.nd)
  const m = (i: 0 | 1): number => (last === undefined ? (st?.morale[i] ?? 1) : i === 0 ? last.ma : last.md)
  const men0 = (i: 0 | 1): number => st?.men[i] ?? 0
  const ourI: 0 | 1 = weAtk ? 0 : 1
  const foeI: 0 | 1 = weAtk ? 1 : 0
  const ourS: 'a' | 'd' = weAtk ? 'a' : 'd'
  const unitOf = (i: 0 | 1): string => (i === ourI ? UNIT_ICON.spear : UNIT_ICON.shield)
  const mixOf = (i: 0 | 1): Readonly<Partial<Record<string, number>>> => st?.mix?.[i] ?? {}

  // 지난 합의 값 — 천천히 풀 때 막대·사람 수가 거기서 새 값으로 간다
  const was = anim && rounds.length >= 2 ? rounds[rounds.length - 2] : undefined
  const n0 = (i: 0 | 1): number => (!anim ? n(i) : was === undefined ? 1 : i === 0 ? was.na : was.nd)
  const m0 = (i: 0 | 1): number => (!anim ? m(i) : was === undefined ? (st?.morale[i] ?? 1) : i === 0 ? was.ma : was.md)
  // 막대마다 제 키프레임 (battlecard 와 같은 길 — var() 키프레임은 크롬에서 칠이 안 됐다)
  let keys = ''
  let kn = 0
  const bar = (w1: number, w0: number): string => {
    if (w0 === w1) return `<i style="width:${w1}%"></i>`
    const k = `wb${kn++}`
    keys += `@keyframes ${k}{from{width:${w0}%}to{width:${w1}%}}`
    return `<i class="wgr" style="width:${w1}%;animation-name:${k}"></i>`
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
    const lost = Math.round(men0(i) * (n0(i) - n(i)))
    if (lost <= 0) return ''
    const j: 0 | 1 = i === 0 ? 1 : 0
    const other = Math.round(men0(j) * (n0(j) - n(j)))
    // 흔들림은 한 합에 한 번 — 더 많이 잃은 쪽만 (같으면 적 쪽)
    if (lost < other || (lost === other && i === ourI)) return ''
    return ` hit${lost > other * 1.3 ? ' hithard' : ''}`
  }
  const side = (i: 0 | 1, hero: string | null, f: string | undefined, name: string, cls: string): string => {
    const now = Math.round(men0(i) * n(i))
    const old = Math.round(men0(i) * n0(i))
    const base = Math.max(0.05, st?.morale[i] ?? 1)
    const mr = (x: number): number => Math.round(Math.max(0, Math.min(1.2, x / base)) * 83)
    const num = old !== now ? `<span class="wn swap"><s>${old}명</s><u>${now}명</u></span>` : `<span class="wn">${now}명</span>`
    const hitFx = hitOf(i) !== '' ? `<img class="wfx-hit" src="${art}fx/impact.png" alt="">` : ''
    // 호궤를 고를 수 있으면 — 그 깃발에 마우스를 올리거나 누르고 있거나 골라 두면 사기 막대에 오를 몫이 깜박인다 (형 10-25)
    const fNow = mr(m(i))
    const fTo = mr(Math.min(base, m(i) + P.realm.tacFeastMorale))
    const feastPv = i === ourI && l.pending?.feast !== undefined && fTo > fNow ? `<u class="wfpv" style="left:${fNow}%;width:${fTo - fNow}%"></u>` : ''
    const em = flagIcon(f)
    // 부장 — 함께 선 장수들 (형 10-25) · 잃은 이는 흐리게
    const lostIds = new Set(rounds.flatMap((x) => (x.lostHero !== undefined ? [x.lostHero.hero] : [])))
    const aides = (st?.aides?.[i] ?? []).map((id) => `<span class="waide${lostIds.has(id) ? ' gone' : ''}" title="${esc(prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '')}">${face(id, art, unitOf(i))}</span>`).join('')
    return `<div class="ws ${cls}${hitOf(i)}${hero !== null && lostIds.has(hero) ? ' chiefgone' : ''}" style="--hd:${plan?.clash ?? STAGE_S[1] + 0.15}s;--bd:${tAt(2)}s"><span class="wpf">${face(hero, art, unitOf(i))}<i></i></span>${aides !== '' ? `<span class="waides">${aides}</span>` : ''}<b>${esc(name)}</b><span class="wnat">${roleChip((cls === 'us') === weAtk)}${em !== undefined ? `<img src="${art}icon/${em}.png" alt="">` : ''}${esc(fname(f))}</span>`
      // 무너지는 금 — 이 밑으로 떨어지면 그 편이 무너져 진다 (tactics: 군사 tacBreakMen · 사기는 처음의 tacBreakMorale) (형 10-24: "사기가 어느 정도 떨어지면 패배한다가 가로바에 표시")
      + `<div class="wbar men">${bar(Math.round(n(i) * 100), Math.round(n0(i) * 100))}${brk(Math.round(P.realm.tacBreakMen * 100), Math.round(n(i) * 100), '군사가 이 금 밑으로 줄면 무너져 진다 — 패배')}</div>${num}`
      + `<div class="wbar mor">${bar(mr(m(i)), mr(m0(i)))}${feastPv}${brk(Math.round(P.realm.tacBreakMorale * 83), mr(m(i)), '사기가 이 금 밑으로 떨어지면 무너져 진다 — 패배')}</div><span class="wn">사기</span>${hitFx}</div>` // 맞은 불꽃은 맨 뒤에 — 앞에 끼면 초상이 새로 만들어져 깜빡였다 (paintNow 의 바뀐 곳만 고치기)
  }

  /**
   * 전장 — 진을 갖춘 두 군대가 마주 선다 (형 10-25: "진은 제대로 갖춘 상태여야 하고 내 선택에 따라 그 진도 바뀌던지 이펙트가 나던지").
   * 우리는 왼쪽에서 오른쪽을 본다 — 앞줄(창·방패)은 가운데 쪽 한두 겹 · 그 뒤 궁수 · 위 옆구리에 기병 · 맨 뒤에 장수와 깃발.
   * 적은 같은 배치를 거울로 (.wf2s.foe 가 통째로 뒤집힌다). 아래에 선 말일수록 크고 앞에 선다 (깊이).
   * 깃발(data-f·b·h·l)대로 진이 움직인다 — 돌격은 앞줄이 기울며 나서고, 방진은 촘촘히 방패벽, 길 트기는 앞줄이 갈라져 궁수가 나온다 ….
   * 고르는 동안은 고른 것(openWar.syncField) · 적은 낌새 · 합이 풀릴 때는 그 합에 실제로 낸 명령으로 맞부딪친다 (play).
   * 말 수는 군사 수에 비례 — 큰 쪽이 판 크기(warTokMin~warTokMax), 작은 쪽은 그 몫만큼. 숫자 대신 진의 두께로 보인다.
   */
  /** 공격·수비 (형 10-25: "공성하는쪽이랑 수성하는쪽이 어딘지 모르겠고") — 길에서 맞닥뜨린 싸움엔 없다 */
  const roleChip = (atk: boolean): string => (l.field === true ? '' : `<em class="wrole ${atk ? 'atk' : 'def'}">${atk ? '공격' : '수비'}</em>`)
  const fieldHtml = (): string => {
    if (st === undefined) return ''
    const big = Math.max(1, st.men[0], st.men[1])
    const RANK: Readonly<Record<string, 0 | 1 | 2>> = { spear: 0, pike: 0, shield: 0, boat: 0, axe: 0, bow: 1, crossbow: 1, horse: 2 }
    const SOL = new Set(['spear', 'shield', 'bow', 'crossbow', 'horse', 'pike', 'boat', 'axe', 'marine'])
    const sea = warGround(prev, l) === 'sea'
    const pd = l.pending
    const play = anim && last !== undefined
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
    // 땅 이름표 — 그 소품 바로 곁에 「해자 · 적에게 유리」 (형 10-25: "해자 갯벌 이게 정확히 어디있는지 누구에게 유리하고 불리한지 전혀 모르겠으며")
    const tchips = terrChips(prev, l, me, fname(foeF))
    const tlab = (k: string, x: number, oy: number): string => {
      const c = tchips.find((y) => y.k === k)
      if (c === undefined) return ''
      const w = c.who === 'us' ? '우리에게 유리' : c.who === 'foe' ? '적에게 유리' : '양쪽 같다'
      return `<b class="wf-tl ${c.who === '' ? 'n' : c.who}" data-tk="${c.k}" style="--x:${x}%;--oy:${oy}%">${esc(c.name)}<small>${w}</small></b>`
    }
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
        // 물길 그림은 진 층이 아니라 땅 층(lowTerr)에 깐다 — 여기는 이름표만 (형 10-26: "강과 해자는 늘 다른 것보다 뒤")
        if (hasMoat) h += tlab('moat', 58, 42)
        // 성벽·목책은 판정에 있는 것만 그린다 (season.fortMul — 목책 꼬리표 · 산성) · 그냥 도읍에 울타리를 그리면 없는 수비 덤을 있는 것처럼 보였다
        if (node.tags.includes('palisade') || node.kind === 'fort') {
          const gate = node.kind === 'fort' || node.kind === 'capital'
          h += tlab(node.kind === 'fort' ? 'fort' : 'palisade', 47.5, -47)
          // 지키는 쪽 뒤에 성 — 흙 성벽·목책·망루 (공격이 이기면 부서져 불탄다) · 어느 쪽이 성을 지키는지 한눈에 (형 10-25: "공성하는쪽이랑 수성하는쪽이 어딘지 모르겠고")
          const wall = (b: boolean, cls = ''): string => `<img class="wf-wall${cls}" data-tk="${node.kind === 'fort' ? 'fort' : 'palisade'}" src="${art}fx/field/wall-${b ? 'breach' : 'whole'}.png" alt="">`
          h += late ? wall(false, ' wf-pre') + wall(true, ' wf-post') : wall(breached)
          // 목책 — 깎은 통나무 말뚝을 하나하나 세운다(굵기·높이·기울기가 저마다) · 가로대·새끼줄 · 도읍·산성은 망루 둘 사이 성문.
          // 깨지면 말뚝이 꺾이고 쓰러지고 그을린다 (형 10-26: "목책 더 잘 구현해야" · 메모리: 이펙트는 낱낱이)
          h += late ? `<i class="wf-pre">${stakes(art, false, gate)}</i><i class="wf-post">${stakes(art, true, gate)}</i>` : stakes(art, breached, gate)
        }
      }
      if (cls === defCls && l.via === 'pass') { h += tp('rocks', 30, -36, 0.9); h += tp('rocks', 24, 32, 1.1); h += tlab('pass', 26, 46) }
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
      ? `<div class="wf-mid-terr${mud ? ' mud' : ''}">${moatLow}${ford ? `${waterSvg(mud, rvShift)}${mud ? '' : REEDS_AT.map(([x, oy, s]) => tp('reeds', x + rvShift - oy * 0.22, oy, s)).join('')}${tlab('ford', 50 + rvShift, -48)}` : ''}</div>`
      : ''
    const side = (i: 0 | 1, cls: 'us' | 'foe', o: RoundOrder | undefined, hero: string | null, f: string | undefined): string => {
      const mix = mixOf(i)
      const all = Object.entries(mix).filter(([, v]) => (v ?? 0) > 0) as Array<[string, number]>
      const men = all.reduce((s, [, v]) => s + v, 0)
      const fc = f !== undefined ? (FACTION_ART[f]?.color ?? '#888') : '#888'
      const em = flagIcon(f)
      const gen = `<span class="wgen" style="--fc:${fc}"><i class="wpole">${em !== undefined ? `<img src="${art}icon/${em}.png" alt="">` : ''}</i>${face(hero, art, 'unit-general')}</span>`
      const cues = '<i class="wq q-charge"><b>돌격</b></i><i class="wq q-hold"></i><i class="wq q-shoot"></i><i class="wq q-ride"></i><i class="wq q-drum"></i><i class="wq q-cap"><b>사로잡으러</b></i><i class="wq q-back"><b>물러난다</b></i>'
      if (men <= 0) return `<div class="wf2s ${cls}"${formAttrs(o)}>${terrainProps(cls)}${gen}${cues}</div>`
      // 말 수는 군사 수에 비례 — 큰 쪽이 판의 크기(백 명 8 · 천 명 13 · 만 명 18), 작은 쪽은 그 몫만큼. 전엔 6~18 에 눌려 230 대 640 이 10 대 18 로 보였다 (형 10-25: "군사 숫자에 비례해서 유닛 개수도")
      const tMax = Math.max(P.realm.warTokMin, Math.min(P.realm.warTokMax, Math.round(8 + 5 * Math.log10(big / 100))))
      const T = Math.max(2, Math.round((tMax * st.men[i]) / big))
      // 병종마다 몫 — 줄마다 모은다
      const rows: string[][] = [[], [], []]
      let given = 0
      const order = all.sort((p, q) => (RANK[p[0]] ?? 0) - (RANK[q[0]] ?? 0) || q[1] - p[1])
      order.forEach(([k, v], j) => {
        const c = j === order.length - 1 ? T - given : Math.max(1, Math.round((T * v) / men))
        given += c
        for (let x = 0; x < c; x++) rows[RANK[k] ?? 0]!.push(k)
      })
      const alive = Math.round(T * n(i)), before = Math.round(T * n0(i))
      let idx = 0
      // 한 줄(세로) — 가운데에서 위아래로 고르게. 많으면 두 겹(앞 겹·뒤 겹이 엇갈린다)
      const tok = (k0: string, r: 0 | 1 | 2, x: number, oy: number): string => {
        const k = solArt(k0, sea)
        const s2 = idx < alive ? 'tku' : idx < before ? 'tkf' : 'tkd' // 'fall' 은 군주가 무너진 판(.ap .fall — 액자 테)과 이름이 겹쳐 말이 큰 액자로 그려졌다 (10-25)
        const hl = oy < -0.5 ? ' hi' : oy > 0.5 ? ' lo' : ''
        const sc = (0.8 + 0.4 * ((oy + 40) / 80)).toFixed(2)
        const pos = `--x:${(x + oy * 0.22).toFixed(1)}%;--oy:${oy.toFixed(1)}%;--sc:${sc};--j:${idx++ % 6};z-index:${10 + Math.round(oy + 40)}`
        // 동작 그림이 있는 병종은 컷으로 움직인다 (서기 · 걷기 · 찌르기 · 쓰러짐 — public/realm/anim · tools/strip-frames.mjs)
        const ar = ANIM_SOL[k]
        if (ar !== undefined) return `<i class="tk wsp k-${k} r${r}${hl} ${s2}" style="${pos};--ar:${ar.toFixed(3)}"><b class="spf" style="background-image:url('${art}anim/${k}.png')"></b></i>`
        return `<img class="tk r${r}${hl} ${s2}" src="${art}icon/sol-${SOL.has(k) ? k : 'spear'}.png" alt="" style="${pos}">`
      }
      const column = (ks: readonly string[], r: 0 | 1, x0: number): string => {
        // 겹 — 한 겹에 다섯까지. 많으면 겹을 늘려 두꺼운 네모 진이 된다 (한 줄로 길게 늘어지면 진이 아니라 줄로 보였다 · 형 10-25)
        const nl = Math.max(1, Math.ceil(ks.length / 5))
        const lines = Array.from({ length: nl }, (_, li) => ks.filter((_, j) => j % nl === li))
        return lines.map((ln, li) => {
          const sp = Math.min(9, 44 / Math.max(1, ln.length))
          return ln.map((k, j) => tok(k, r, x0 - li * 4.5, (j - (ln.length - 1) / 2) * sp + (li % 2) * sp * 0.5)).join('')
        }).join('')
      }
      // 기병 — 위 옆구리에 가로로
      const horse = rows[2]!.map((k, j) => tok(k, 2, 18 + (j % 6) * 4.2, -34 + Math.floor(j / 6) * 7)).join('')
      // 뒷줄·옆을 먼저 세고 앞줄을 나중에 — 쓰러지는 것은 맞부딪는 앞줄부터
      const bows = column(rows[1]!, 1, 22)
      const front = column(rows[0]!, 0, 37)
      // 무리마다 제 깃발 박자 — 그 박자에 앞줄이 나서고 · 기병이 돌고 · 화살이 난다. 박자가 없으면(깃발 연출 수를 넘었으면) 맞부딪기 조금 앞
      const beatOf = (c: Cmd | undefined): number => (c === undefined ? 0 : plan?.beats.find((x) => x.ours === (cls === 'us') && x.c === c)?.at ?? Math.max(0, (plan?.clash ?? 1) - 0.7))
      const shoot = play && o?.bows !== undefined && rows[1]!.length > 0 ? beatOf(o.bows) : null
      const tempo = play ? ` style="--fa:${beatOf(o?.front).toFixed(2)}s;--ha:${beatOf(o?.horse).toFixed(2)}s;--sa:${(shoot ?? 0).toFixed(2)}s"` : ''
      const arrows = shoot === null ? '' : `<i class="wf-arw" style="--sa:${shoot.toFixed(2)}s">${Array.from({ length: 8 }, (_, j) => `<i style="--k:${j};--ay:${-30 + j * 8}%"><img src="${art}fx/arrow.png" alt=""></i>`).join('')}</i>`
      const terr = terrainProps(cls)
      // 꽂힌 화살 — 맞은편이 쏜 적이 있으면 이쪽 앞줄 곁에. 진의 맨 뒤에 붙인다(앞에 끼면 뒤의 병사 그림이 다 새로 만들어져 깜빡였다)
      const stuck = shot(cls === 'us' ? (weAtk ? 'd' : 'a') : (weAtk ? 'a' : 'd')) ? [-14, 4, 22].map((oy) => tp('arrows', 41, oy, 0.55)).join('') : ''
      // 적이 흔들린다(사기가 꺾여 방진도 돌격을 못 받아 낼 지경) — 고를 때 적 진이 떨고 깃발이 기운다 (판세가 눈에 보이게)
      const waver = !play && cls === 'foe' && pd !== undefined && pd.round === shown && pd.foeWaver ? ' waver' : ''
      return `<div class="wf2s ${cls}${waver}"${formAttrs(o)}${tempo}>${terr}${gen}${cues}${bows}${horse}${front}${stuck}${arrows}</div>`
    }
    // 이 합에 낸 명령 (풀릴 때) · 고르는 중엔 우리는 고른 것, 적은 낌새
    const ordUs: RoundOrder | undefined = play ? (weAtk ? last!.oa : last!.od) : pd !== undefined ? sel : undefined
    const ordFoe: RoundOrder | undefined = play ? (weAtk ? last!.od : last!.oa) : pd?.hint != null ? { front: pd.hint } : undefined
    // 적 앞줄 위의 낌새 — 고를 때 눈에 먼저 들어오게 (형 10-24: "상대 낌새가 눈에 보이면서")
    const omen = pd === undefined || pd.round !== shown ? ''
      : pd.hint !== null ? `<div class="wf-omen${pd.hintSrc === 'habit' ? ' habit' : ''}"><img src="${flagSrc(art, pd.hint)}" alt=""><span><b>${OMEN_WORD[pd.hint] ?? CMD_NAME[pd.hint]}</b><small>${pd.hintSrc === 'habit' ? '적장의 버릇' : '적 앞줄의 낌새'}</small></span></div>`
        : '<div class="wf-omen none"><i>?</i><span><b>속을 모른다</b><small>정찰을 보내면 보인다</small></span></div>'
    // 맞부딪는 자리에 불꽃·흙먼지 · 양쪽이 잃은 수가 떠오른다 · 싸움이 처음 열리면 두 군대가 대열을 지어 들어온다
    const lost = (i: 0 | 1): number => Math.max(0, Math.round(men0(i) * (n0(i) - n(i))))
    const hit = play ? `<i class="wf-hit"><img class="h1" src="${art}fx/impact.png" alt=""><img class="h2" src="${art}fx/dust.png" alt=""><img class="h3" src="${art}fx/dust.png" alt=""></i>`
      + (lost(ourI) > 0 ? `<b class="wf-loss us">−${lost(ourI)}</b>` : '') + (lost(foeI) > 0 ? `<b class="wf-loss foe">−${lost(foeI)}</b>` : '') : ''
    const enter = !anim && shown === 0 ? ' enter' : ''
    // 판의 끝 — 진 쪽은 무너져 등을 돌려 달아나고, 이긴 쪽은 한 발 나서며 장수 깃발을 높이 든다 (형 10-25: 승패가 전장에서 보이게)
    const fin = l.pending === undefined && shown >= (l.rounds ?? []).length && l.outcome !== undefined && l.outcome !== 'draw'
    const atkWon = l.outcome === 'win' || l.outcome === 'rout'
    const usWon = weAtk === atkWon
    const endCls = fin ? (usWon ? ' fin win-us' : ' fin win-foe') : ''
    // 승패가 드러나는 때 — 「승리·패배」 글자와 같은 때(paintNow 의 endAt). 다시 그린 끝 판(연출 없음)이면 처음부터
    const rv = fin && play ? roundPlan(last!, weAtk).result + 0.9 : 0
    return `<div class="wfield${play ? ' play' : ''}${enter}${endCls}" style="--hd:${plan?.clash ?? STAGE_S[1] + 0.15}s;--rv:${rv.toFixed(2)}s"><i class="wf-ground"></i>${midTerr}${side(ourI, 'us', ordUs, ourHero, ourF)}${side(foeI, 'foe', ordFoe, foeHero, foeF)}<i class="wf-mid">⚔</i><b class="wf-who us">${roleChip(weAtk)}우리 ${esc(ourName)}</b><b class="wf-who foe">${roleChip(!weAtk)}적 ${esc(foeName)}</b>${hit}${omen}<div class="wf-terr">${terrChips(prev, l, me, fname(foeF)).map((c) => terrChipHtml(art, c, 'wtc')).join('')}</div></div>`
  }

  // 싸움터 배경 (땅마다) · 위 카드는 굴려도 그 자리에 (형: "싸우는로그가 스크롤로 보이더라도 상단에 캐릭터랑 체력바 있는 그 카드는 고정")
  const ground = warGround(prev, l)
  let h = `<div class="wbg g-${ground}${WAR_BG_READY.has(ground) ? '' : ' stand'}" style="background-image:url('${warBg(art, ground, !weAtk)}')"></div>`
  // 싸움의 기운 — 흙먼지 둘이 바닥을 흐르고, 이 합에 활을 쏜 쪽에서 화살이 낱낱이 활꼴로 날아간다 (그림: realm/fx)
  h += `<div class="wfx"><img class="wfx-dust a" src="${art}fx/dust.png" alt=""><img class="wfx-dust b" src="${art}fx/dust.png" alt="">${AIR_EMBERS}`
  if (anim && last !== undefined) {
    // 깃발마다 제 차례 — 차례가 끝나면 걷힌다 (다음 깃발과 겹치지 않게)
    for (const b of roundPlan(last, weAtk).beats) {
      const end = b.at + b.len - 0.06
      // 무리 명령은 전장의 진이 제 박자에 직접 움직인다 — 화면을 가로지르던 큰 깃발·화살비는 진을 가렸다 (형 10-25). 장수 기술·땅의 수만 남긴다
      if (FIELD_CMD.has(b.c)) continue
      h += SHOOT_CMD.has(b.c) ? volleyHtml(art, b.dir, b.at + 0.05, end) : cmdFxHtml(art, b.c, b.dir, b.at, end)
    }
  }
  h += `</div><div class="wrbox">`
  // 위 카드는 그 싸움터를 무대로 — 길·성문·물가·눈밭·밤 (형 10-23: "길에서 마주치거나 수성하거나 공성할 때는 그 위치에 맞게 배경")
  h += `<div class="wtop" style="--wtbg:url('${warBg(art, ground, !weAtk)}')"><div class="wrh"><b>${esc(warName(after, l))}</b>${left > 1 ? `<span class="mute">이번 계절 우리 싸움 ${left}판</span>` : ''}<button class="whelp" data-war="help" aria-label="설명 보기">?</button></div>`
  h += `<div class="wvs">${side(ourI, ourHero, ourF, ourName, 'us')}<img class="vs" src="${art}ui/vs.png" alt="VS">${side(foeI, foeHero, foeF, foeName, 'foe')}</div>${fieldHtml()}</div>`
  if (keys !== '') h += `<style>${keys}</style>`
  // 지나간 합들 — 마지막 합만 천천히
  h += `<div class="wlog">`
  rounds.forEach((rd, i) => {
    const slow = anim && i === rounds.length - 1
    const prevN = i === 0 ? [1, 1] : [rounds[i - 1]!.na, rounds[i - 1]!.nd]
    const lostUs = Math.max(0, Math.round(men0(ourI) * ((prevN[ourI] ?? 1) - (ourI === 0 ? rd.na : rd.nd))))
    const lostFoe = Math.max(0, Math.round(men0(foeI) * ((prevN[foeI] ?? 1) - (foeI === 0 ? rd.na : rd.nd))))
    const [pw, pc] = pushWord(rd.push, weAtk, lostUs, lostFoe)
    const crit = rd.beat === ourS
    const d = (k: 0 | 1 | 2): string => (slow ? ` style="--d:${tAt(k)}s"` : '')
    h += `<div class="wrd${slow ? ' slow' : ''}${crit ? ' crit' : ''}"><div class="wrn">${ROUND_NAME[i] ?? `${i + 1}`} 합</div>${reliefBanner(rd, ourS, art)}`
    const akOf = (sd: 'a' | 'd'): Art | undefined => (rd.acts ?? []).find((x) => x.c === 'art' && x.s === sd)?.art
    h += `<div class="wcmds"${d(0)}><span class="wc us"><em class="wck">우리</em>${flags(weAtk ? rd.oa : rd.od, weAtk ? rd.a : rd.d, art, akOf(ourS))}</span><i>×</i><span class="wc foe"><em class="wck">적</em>${flags(weAtk ? rd.od : rd.oa, weAtk ? rd.d : rd.a, art, akOf(ourS === 'a' ? 'd' : 'a'))}</span></div>`
    const story = ctx !== null ? roundStory(rd, rounds[i - 1], ctx) : []
    // 누가 누구를 · 됐나 — 그림 줄이 먼저, 글 이야기는 그 밑에 작게
    const rows = actRows(rd.acts, ourS, art, mixOf(0), mixOf(1))
    h += `<div class="wst${rows !== '' ? ' sm' : ''}"${d(1)}>${rows}${story.map((s) => `<p>${esc(s)}</p>`).join('')}</div>`
    // 사로잡기·물러나기로 끝난 합은 밀고 밀린 것이 없다
    if (rd.ev === 'capture-ok' || rd.ev === 'retreat') h += `<p class="wpush"${d(2)}>싸움이 거기서 끝났다</p></div>`
    else {
      // 무리마다 — 앞줄·활·말 그림과 잃은 수 (형: "전투로그에서도 다이나믹함이 보이게끔 유닛마다 아이콘도 같이")
      const gBefore = (sd: 0 | 1): Readonly<Partial<Record<Grp, number>>> => (i === 0 ? groupMen(mixOf(sd) as Parameters<typeof groupMen>[0]) : (sd === 0 ? rounds[i - 1]!.ga : rounds[i - 1]!.gd) ?? {})
      const chips = (sd: 0 | 1): string => groupLoss(gBefore(sd), sd === 0 ? rd.ga : rd.gd).map(([g, k]) => `<span class="wl"><img src="${art}icon/${GROUP_ICON[g]}.png" alt="">−${k}</span>`).join('')
      const cu = chips(ourI)
      const cf = chips(foeI)
      h += `<p class="wpush ${pc}"${d(2)}>${pw}</p><p class="wloss"${d(2)}><span class="us">우리 ${cu !== '' ? cu : `−${lostUs}`}</span><span class="foe">적 ${cf !== '' ? cf : `−${lostFoe}`}</span></p></div>`
    }
  })
  h += `</div>`

  const p = l.pending
  const ended = p === undefined && !more
  if (p !== undefined && p.round === shown) {
    // 다음 합의 깃발을 든다 — 무리마다 하나, 장수 하나
    h += `<div class="wnext"${anim ? ` style="--d:${(tAt(2) + 0.6).toFixed(2)}s"` : ''}><div class="wrn">${ROUND_NAME[shown] ?? `${shown + 1}`} 합 </div>`
    // 적진의 속·맞은편·땅은 전장에서 누르고 있거나 마우스를 올리면 (openWar 의 정보창 · warTip) — 여기엔 어떻게 보는지만
    h += '<p class="wfhint">전장에서 <b>우리 무리</b>를 누르면 깃발 선택 · 적·낌새·땅은 <b>누르고 있으면</b>(마우스는 올리면) 자세히 보인다</p>'
    if (p.foeWaver) h += `<div class="wintel"><div class="wi warn"><b>적이 흔들린다</b><p>깃발이 기울고 대열이 성기다</p><small>방진도 돌격을 못 받아 낸다 — 쫓을 때다</small></div></div>`
    // 지난 합에 장수를 잃었다 — 누가 · 누가 지휘를 넘겨받았나 (형 10-25: "한 명 잡히면 바로 지는 건 말이 안 되는데")
    const lh = rounds[rounds.length - 1]?.lostHero
    if (lh !== undefined) {
      const ours = (lh.side === 'a') === weAtk
      const nm = (id: string): string => prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '?'
      const what = lh.how === 'taken' ? '사로잡혔다' : '쓰러졌다'
      const next = lh.chief !== undefined ? ` — ${josa(nm(lh.chief), '이', '가')} 지휘를 넘겨받는다` : ''
      h += `<div class="wintel"><div class="wi ${ours ? 'warn' : 'good'}"><b>${esc(`${ours ? '우리' : '적의'} ${lh.chief !== undefined ? '총대장' : '부장'} ${josa(nm(lh.hero), '이', '가')} ${what}`)}</b><p>${esc(`싸움은 이어진다${next}`)}</p></div></div>`
    }
    if (p.shaken === true) h += `<div class="wintel"><div class="wi warn"><b>지휘가 흔들린다</b><p>총대장을 잃었다 — 이번 합은 북과 물러나기뿐</p></div></div>`
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
        if (arts.length > 1) s += `<div class="wwho mine art"><span>누가 비기를 쓰나</span>${arts.map((x) => `<button class="wfc${x.id === artPick ? ' on' : ''}" data-war="who" data-id="${x.id}">${face(x.id, art, unitOf(ourI))}<b>${esc(nm(x.id))}</b><small>${esc(ART_NAME[x.art!])}</small></button>`).join('')}</div>`
        const best = [...hs].sort((x, y) => y.mu - x.mu)[0]?.id
        const duelPick = sel.who !== undefined && hs.some((x) => x.id === sel.who) ? sel.who : best
        s += `<div class="wwho mine duel"><span>누가 나서 겨루나</span>${hs.map((x) => `<button class="wfc${x.id === duelPick ? ' on' : ''}" data-war="who" data-id="${x.id}">${face(x.id, art, unitOf(ourI))}<b>${esc(nm(x.id))}</b><small>무예 ${x.mu}${x.chief ? ' · 총대장' : ''}</small></button>`).join('')}</div>`
      }
      const fs = p.foeHeroes ?? []
      if (fs.length > 1) {
        const tPick = sel.target ?? fs.find((x) => x.chief)?.id
        s += `<div class="wwho foe capture"><span>누구를 잡나</span>${fs.map((x) => { const [w, cls] = captureWord(x.p); return `<button class="wfc${x.id === tPick ? ' on' : ''}" data-war="target" data-id="${x.id}">${face(x.id, art, unitOf(foeI))}<b>${esc(nm(x.id))}</b><small class="wf-${cls}">${x.chief ? '총대장 · ' : '부장 · '}${w}</small></button>` }).join('')}</div>`
      }
      return s
    }
    let recNow: Cmd | undefined
    const opt = (g: Grp | 'lead', c: Cmd): string => {
      const on = sel[g] === c
      let tag = recNow === c ? `<em class="rec">★ 권함</em>` : ''
      if (g === 'front' && p.hint !== null && FRONT_COUNTER[p.hint] === c) tag = `<em>적 낌새를 받아친다</em>`
      else if (c === 'pursue' && p.foeWaver) tag = `<em>지금이다</em>`
      else if (TERRAIN_CMD.has(c)) tag = `<em class="land">이 땅에서만</em>`
      let feel = ''
      if (c === 'capture') {
        const [w, cls] = captureWord(p.capture)
        feel = `<span class="wf-${cls}">${w}</span><span class="wcap">무리 ${p.squad} · 호위 ${p.escort}</span>`
      }
      if (c === 'feast' && p.feast !== undefined) feel = `<span class="wfcost">곡식 ${p.feast}</span>`
      // 장수의 비기 — 그 장수만의 이름·그림 (형: "아이콘과 함께 그거라는걸 알게 해줘야함")
      const ak = c === 'art' ? p.art : undefined
      if (ak !== undefined) tag = `<em class="art">비기</em>`
      const gu = p.guess !== undefined ? guessHtml(p.guess.opts[g]?.[c], p.guess.edge0) : ''
      return `<button class="wcmd ${c}${on ? ' on' : ''}" data-war="pick" data-g="${g}" data-c="${c}" data-more="${esc(ak !== undefined ? ART_DOES[ak] : CMD_DOES[c])}"><img class="wflag" src="${flagSrc(art, c, ak)}" alt=""><span class="wct"><b>${ak !== undefined ? ART_NAME[ak] : CMD_NAME[c]}</b>${tag}${feel}<small>${esc(ak !== undefined ? ART_SHORT[ak] : CMD_SHORT[c])}</small>${gu}</span></button>`
    }
    // 무리 탭 — 누른 무리만 빛나고 그 무리 깃발만 보인다. 무리마다 다 고르면 「전투 개시」가 켜진다
    // (형 10-24: "깃발이 너무 많아서 헷갈려 · 창병 방패병을 탭하면 빛나면서 걔네들 깃발만 · 다 고른 뒤에 전투개시 버튼 활성화")
    const panes: Array<{ g: Grp | 'lead'; name: string; sub: string; icon: string; options: readonly Cmd[] }> = []
    for (const gr of p.groups) if (gr.options.length > 0) panes.push({ g: gr.g, name: groupLabel(mixOf(ourI), gr.g), sub: `${gr.men}명`, icon: `<img class="wgi" src="${art}icon/${GROUP_ICON[gr.g]}.png" alt="">`, options: gr.options })
    if (p.lead.length > 0) panes.push({ g: 'lead', name: '장수', sub: ourName, icon: `<span class="wgi f">${face(ourHero, art, unitOf(ourI))}</span>`, options: p.lead })
    const act = panes.find((x) => x.g === active) ?? panes.find((x) => sel[x.g] === undefined) ?? panes[0]
    h += `<div class="wgtabs">`
    for (const x of panes) {
      const c = sel[x.g]
      const ak = c === 'art' ? p.art : undefined
      const chip = c !== undefined ? `<span class="wgs"><img src="${flagSrc(art, c, ak)}" alt="">${esc(ak !== undefined ? ART_NAME[ak] : CMD_NAME[c])}</span>` : '<span class="wgs none">선택</span>'
      h += `<button class="wgt${x === act ? ' on' : ''}${c !== undefined ? ' done' : ''}" data-war="gtab" data-g="${x.g}">${x.icon}<span class="wgn"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span>${chip}</button>`
    }
    h += `</div>`
    if (p.guess !== undefined) h += `<p class="wgby">${p.guess.by === 'hint' ? '깃발마다 이번 합의 짐작 — <b>적이 낌새대로 오면</b>' : '깃발마다 이번 합의 짐작 — 적의 속을 몰라 <b>폭</b>이 있다 (막대의 옅은 데)'} · <b>판세</b> 막대는 왼쪽 끝이 우리, 오른쪽 끝이 적 — 파랑이 그 깃발을 들었을 때 우리 몫, 금빛 금이 지금 · <b>잃을 군사</b>는 이번 합에 양쪽이 잃을 만큼</p>`
    for (const x of panes) {
      recNow = advise(x.g, x.options)
      h += `<div class="wgrp" data-g="${x.g}"${recNow !== undefined ? ` data-rec="${recNow}"` : ''}${x === act ? '' : ' hidden'}><div class="wcmdgrid">${x.options.map((c) => opt(x.g, c)).join('')}</div>${x.g === 'lead' ? whoRows() : ''}</div>`
    }
    const picked = panes.filter((x) => sel[x.g] !== undefined).length
    // 맡기면 장수의 지략대로 — 그 장수의 얼굴·지략을 단추 옆에 (형: "장수의 지략?수치가 … 버튼주변에 뭔가보여지면")
    const ourH = ourHero !== null ? (prev.heroes[ourHero] ?? after.heroes[ourHero]) : undefined
    const [sn, sl] = styleWord(ourH)
    h += `<div class="wfoot"><div class="wauto">${ourH !== undefined ? face(ourHero, art, unitOf(ourI)) : ''}<span>${autoLine(ourH)}<br><b class="wsty">${esc(sn)}</b> ${esc(sl)}</span></div>`
    // 누구에게 무엇을 맡기나 — 말로 (형 10-23: "'이 싸움은 맡긴다'는 뭔 소린지 모르겠잖아. 장수에게 전투를 전부 일임한다 이런 식으로")
    // 「○○에게 일임한다 (자동전투)」 · 남은 싸움을 한꺼번에 넘기는 단추는 뺐다 — 싸움은 하나씩 (형 10-25)
    const whom = ourHero !== null ? `${josa(ourName, '에게', '에게')} 일임한다 (자동전투)` : '알아서 싸운다 (자동전투)'
    h += `<button class="btn ghost" data-war="auto">${esc(whom)}</button>`
    // 이 합을 싸운다 — 장수의 「격려」와 헷갈리지 않게 북 말은 뺐다 (형 10-23: "북을 친다가 있는데 북을 울린다라고 하면 헷갈리잖아 · 설명이 쓸데없어")
    h += `<button class="btn pri wgo" data-war="go" data-n="${panes.length}"${picked < panes.length ? ' disabled' : ''}>${goWord(picked, panes.length)}</button></div></div>`
  } else if (ended) {
    const atkWon = l.outcome === 'rout' || l.outcome === 'win'
    const good = weAtk === atkWon && l.outcome !== 'draw'
    const place = l.field === true && l.edge !== undefined ? fieldName(after, l.edge) : (after.nodes[l.node]?.name ?? l.node)
    let res: string
    if (l.outcome === 'draw') res = weAtk ? '승부가 안 났다 — 물러난다' : `${josa(place, '을', '를')} 지켜 냈다`
    else if (l.field === true) res = good ? '적을 물리치고 길을 간다' : '밀려서 돌아간다'
    else if (weAtk) res = atkWon ? `${josa(place, '을', '를')} 차지한다` : '물러난다'
    else res = atkWon ? `${josa(place, '을', '를')} 빼앗긴다` : `${josa(place, '을', '를')} 지켜 냈다`
    const big = l.outcome === 'rout' || l.outcome === 'routed' ? (good ? '대승 — ' : '대패 — ') : ''
    const d = anim ? ` style="--d:${tAt(2) + 0.5}s"` : ''
    const fall = l.field !== true && atkWon
    if (fall) h += `<div class="wfx burn"${d}><img class="wfx-smoke" src="${art}fx/smoke.png" alt="">${burnHtml(art, 'l')}${burnHtml(art, 'r')}</div>`
    h += `<div class="wend ${good ? 'good' : l.outcome === 'draw' ? '' : 'bad'}"${d}><b>${big}${esc(res)}</b>`
    if (ctx !== null && (l.rounds ?? []).length > 0) h += `<p class="wwhy">${esc(endStory(l, ctx))}</p>`
    // 잡힌 이 · 쓰러진 이 — 장수가 여럿이면 하나가 아닐 수 있다
    for (const id of l.captives ?? (l.captured !== null ? [l.captured] : [])) {
      const c = after.heroes[id]
      h += c?.faction === me ? '<p>' + esc(josa(c.name, '이', '가')) + ' 사로잡혀 갔다.</p>' : '<p>' + esc(josa(c?.name ?? '?', '을', '를')) + ' 사로잡았다!</p>'
    }
    for (const id of l.fallen ?? (l.killed !== null ? [l.killed] : [])) h += `<p>${esc(josa(after.heroes[id]?.name ?? '?', '이', '가'))} 쓰러졌다.</p>`
    h += `<button class="btn pri wide" data-war="next">${left > 1 ? '다음 싸움으로' : '계절을 마무리한다'}</button></div>`
  }
  h += `</div>`
  return h
}

export const WAR_CSS = `
.ap .tn.hard { color: #f0a08a; }
/* 장수가 여럿 — 누가 나서나 · 누구를 잡나 (그 깃발을 골랐을 때만) */
.ap .ws .waides { display: flex; gap: 2px; justify-content: center; margin: 2px 0 0; } .ap .ws .waide .wf { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; object-position: top; border: 1px solid #c9a45a; }
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
.ap .wbg { position: absolute; inset: 0; z-index: 0; background: center / cover no-repeat; filter: brightness(.62) saturate(.9); }
.ap .wbg { animation: wbgpan 26s ease-in-out infinite alternate; }
@keyframes wbgpan { from { transform: scale(1.04) translate(-1%, 0); } to { transform: scale(1.1) translate(1.2%, -1%); } }
.ap .wember { position: absolute; bottom: -10px; left: var(--x); width: var(--s); height: var(--s); border-radius: 50%; background: radial-gradient(circle, #fff2c0, #ffb04a 45%, #ff6a1a00 70%);
  opacity: 0; animation: wemberup var(--d) linear var(--t) infinite; }
@keyframes wemberup { 0% { opacity: 0; transform: translate(0, 0); } 10% { opacity: .9; } 70% { opacity: .6; } 100% { opacity: 0; transform: translate(var(--w), -70vh); } }
.ap .wbg.stand { filter: brightness(.3) saturate(.7) blur(2px); transform: scale(1.04); }
.ap .wbg.g-snow { filter: brightness(.45) saturate(.6) hue-rotate(-8deg); } .ap .wbg.g-night { filter: brightness(.3) saturate(.7); }
.ap .wbg::after { content: ''; position: absolute; inset: 0; background: linear-gradient(#0d0f1340, #0d0f1300 30%, #0d0f1388 55%, #0d0f13dd 90%); }
.ap .wrbox { position: relative; z-index: 1; max-width: 600px; margin: 0 auto; padding: 0 14px 40px; }
/* 위 카드 — 굴려도 늘 보인다 (포켓몬의 HP 창) */
.ap .wtop { position: sticky; top: 0; z-index: 3; margin: 0 -14px; padding: calc(16px + env(safe-area-inset-top)) 30px 22px;
  background: linear-gradient(#0d0f1388, #0d0f1311 35%, #0d0f1344 70%, #0d0f13f2), var(--wtbg) center 55% / cover no-repeat; background-origin: border-box;
  filter: drop-shadow(0 6px 14px #000a); }
.ap .wtop::after { content: ''; position: absolute; inset: 0; border: 22px solid transparent; border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 22px stretch; pointer-events: none; z-index: 2; }
.ap .wtop.def { background: linear-gradient(#0d0f1388, #0d0f1311 35%, #0d0f1344 70%, #0d0f13f2), var(--wtbg) center 55% / cover no-repeat; }
@media (max-width: 520px) { .ap .wtop { padding: calc(12px + env(safe-area-inset-top)) 22px 18px; } .ap .wtop::after { border-width: 16px; border-image-width: 16px; } }
/* 장수 초상 — 쇠 귀퉁이 청동 테 안에 얼굴 (테 그림이 얼굴 위에 얹힌다) */
.ap .wpf { position: relative; display: grid; place-items: center; width: var(--pf, 172px); aspect-ratio: 1; flex: none; }
.ap .wpf > i { position: absolute; inset: 0; background: url(__ART__ui/frame-portrait.png) center / 100% 100% no-repeat; pointer-events: none; z-index: 1; filter: drop-shadow(0 3px 6px #000c); }
.ap .wpf .wf { width: 66%; height: 66%; border: 0; border-radius: 2px; box-shadow: none; }
.ap .ws.foe .wpf > i { filter: drop-shadow(0 3px 6px #000c) sepia(.35) hue-rotate(-20deg) saturate(1.3); }
@media (max-width: 520px) { .ap .wtop .wpf { --pf: min(92px, 24vw); } } /* 폰 — 초상을 줄여 전장에 자리를 (형 10-25: 초상이 화면 반을 먹고 병사가 작았다) */
@media (max-width: 520px) { .ap .wtop .wfield { height: clamp(170px, 46vw, 220px); } .ap .wtop .wf2s .tk { height: clamp(30px, 8.6cqw, 44px); } .ap .wtop .wf2s .tk.wsp.k-horse, .ap .wtop .wf2s .tk.wsp.k-boat { height: clamp(40px, 11.5cqw, 60px); } }
@media (max-width: 520px) { .ap .wnext .wgt .wgn b { white-space: normal; font-size: 13px; line-height: 1.15; } .ap .wnext .wgt { padding: 6px 7px; gap: 5px; } .ap .wnext .wgt .wgi { width: 28px; height: 28px; } }
/* 우리 장수 테는 숨 쉬듯 빛난다 */
.ap .ws.us .wpf > i { animation: wpfglow 2.6s ease-in-out infinite alternate; }
@keyframes wpfglow { from { filter: drop-shadow(0 3px 6px #000c); } to { filter: drop-shadow(0 3px 6px #000c) drop-shadow(0 0 10px #9fd18b88); } }
.ap .wpf.big { --pf: clamp(120px, 34vw, 190px); }
.ap .wosd .wpf .wf { width: 66%; height: 66%; border: 0; border-radius: 2px; box-shadow: none; }
.ap .wvs img.vs { width: clamp(52px, 13vw, 78px); height: auto; align-self: center; filter: drop-shadow(0 3px 6px #000c); }
.ap .wom img.wox { width: clamp(70px, 20vw, 130px); height: auto; filter: drop-shadow(0 0 14px #ff6a3a88) drop-shadow(0 3px 6px #000); animation: wostamp .5s cubic-bezier(.2, 1.6, .4, 1) .8s both; }
/* 나라 이름 — 싸움터 그림 위에서도 읽히게 어두운 띠 */
.ap .ws .wnat { background: #0b0a08c8; border: 1px solid #6a523688; border-radius: 999px; padding: 1px 9px 1px 4px; text-shadow: 0 1px 2px #000; }
.ap .wtop .ws b, .ap .wtop .ws > span, .ap .wtop .wn, .ap .wrh { text-shadow: 0 1px 3px #000, 0 0 8px #000c; }
.ap .wtop .wf { box-shadow: 0 4px 14px #000c; }
@media (max-width: 520px) { .ap .wtop .wrh { font-size: 17px; } }
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
  background: url(__ART__icon/war-skull.png) center / 82% no-repeat, radial-gradient(#2a0c08 55%, #2a0c0800 72%); filter: drop-shadow(0 0 2px #000) drop-shadow(0 0 3px #ff3b2b88); }
.ap .wbar .brk.near::after { animation: wskull .7s ease-in-out infinite alternate; } @keyframes wskull { to { scale: 1.35; filter: drop-shadow(0 0 2px #000) drop-shadow(0 0 8px #ff3b2b); } }
.ap .wbar .wdz { position: absolute; left: 0; top: 0; bottom: 0; z-index: 1; pointer-events: none; text-decoration: none;
  background: repeating-linear-gradient(135deg, #3a0a06b0 0 3px, #ff3b2b55 3px 6px); border-radius: 6px 0 0 6px; }
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
  .ap .wtop .ws .wbar { margin-top: 6px; height: 10px; }
  .ap .wtop .ws .wn { font-size: 11px; line-height: 1.2; text-align: center; }
  .ap .wtop .ws.foe { grid-template-columns: minmax(0, 1fr) auto; text-align: right; }
  .ap .wtop .ws.foe .wpf { grid-column: 2; }
  .ap .wtop .ws.foe > b, .ap .wtop .ws.foe .wnat { grid-column: 1; justify-self: end; }
  .ap .wtop .wfield { height: clamp(230px, 62vw, 290px); }
  .ap .wtop .wf2s .tk { height: clamp(34px, 10cqw, 50px) !important; } .ap .wtop .wf2s .tk.wsp.k-horse, .ap .wtop .wf2s .tk.wsp.k-boat { height: clamp(44px, 13cqw, 66px) !important; }
}
/* 병사 발밑 그림자 — 땅에 서 있게 */
.ap .wf2s .tk.wsp::before { content: ''; position: absolute; left: 18%; right: 18%; bottom: -4%; height: 12%; border-radius: 50%; background: radial-gradient(closest-side, #000b, #0000); z-index: -1; pointer-events: none; }
.ap .wf2s .tk.wsp.tkd::before { opacity: .4; }
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
.ap .wf2s .wf-wall { position: absolute; left: -4%; bottom: 4%; height: 90%; width: auto; transform: scaleX(-1); z-index: 1; pointer-events: none; filter: brightness(.8) saturate(.9) drop-shadow(0 4px 8px #000b); }
.ap .wfield i.wf-pre, .ap .wfield i.wf-post { position: absolute; inset: 0; pointer-events: none; }
.ap .wfield .wf-pre { animation: wfpre .5s ease-out var(--rv, 0s) forwards; } @keyframes wfpre { to { opacity: 0; visibility: hidden; } }
.ap .wfield .wf-post { animation: wfpost .5s ease-out var(--rv, 0s) both; } @keyframes wfpost { from { opacity: 0; } to { opacity: 1; } }
.ap .wr.fast .wfield { --rv: 0s !important; }
/* 물 한 줄기 (waterSvg) — 땅 위 · 병사 밑. 위쪽은 지평선으로 스러진다 */
.ap .wfield .wrv { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none; filter: drop-shadow(0 0 3px #0006); }
.ap .wfield .wrv-rip { opacity: 0; animation: wrvflow 3.6s linear calc(var(--i) * -.6s) infinite; }
@keyframes wrvflow { 0% { opacity: 0; transform: translateY(-3px); } 30% { opacity: .7; } 100% { opacity: 0; transform: translateY(6px); } }
.ap .wfield .wrv-gloss { opacity: .6; }
@media (prefers-reduced-motion: reduce) { .ap .wfield .wrv-rip { animation: none; opacity: .5; } }
/* 땅 이름표 (tlab) — 소품 곁 · 누구에게 유리한지 색 */
.ap .wf-tl { position: absolute; left: var(--x); top: calc(60% + var(--oy)); transform: translate(-50%, -50%); z-index: 75; display: flex; flex-direction: column; align-items: center; padding: 1px 6px 2px; border-radius: 7px; background: #120d09d8; border: 1px solid #6a5a48; font-size: clamp(9.5px, 2.5cqw, 12px); font-weight: 800; line-height: 1.15; color: #f6d8a0; white-space: nowrap; pointer-events: none; box-shadow: 0 2px 6px #000a; }
.ap .wf-tl small { font-size: .82em; font-weight: 700; color: #c8bca8; }
.ap .wf-tl.us { border-color: #5fae55; } .ap .wf-tl.us small { color: #9fe08a; } .ap .wf-tl.foe { border-color: #c8604a; } .ap .wf-tl.foe small { color: #ff9a80; }
.ap .wf2s.foe .wf-tl { transform: translate(-50%, -50%) scaleX(-1); }
.ap .wfield.play .wf-tl { opacity: .3; transition: opacity .3s; }
/* 공격·수비 꼬리 */
.ap .wrole { display: inline-block; font-style: normal; font-size: .82em; font-weight: 900; padding: 0 5px; margin-right: 4px; border-radius: 6px; vertical-align: 1px; letter-spacing: .04em; }
.ap .wrole.atk { background: #c8402a; color: #fff; } .ap .wrole.def { background: #3a6ab0; color: #fff; }
.ap .wfield.play .wf-mid-terr { transform-origin: 50% 62%; animation: wpushin 1.5s cubic-bezier(.2, .7, .3, 1) calc(var(--hd) - .25s) both; }
.ap .wf2s .tk { position: absolute; left: calc(var(--x) + var(--dx, 0%)); top: calc(60% + var(--oy) * var(--sy, 1) + var(--dy, 0%)); height: clamp(28px, 7.4cqw, 50px); width: auto;
  transform: translate(-50%, -100%) scale(var(--sc, 1)); transform-origin: 50% 100%; rotate: var(--rot, 0deg);
  transition: left .5s cubic-bezier(.3, 1.25, .5, 1), top .5s cubic-bezier(.3, 1.25, .5, 1), rotate .35s ease-out, filter .3s; filter: drop-shadow(0 0 2px #7cc4ff) drop-shadow(0 2px 2px #000c); }
.ap .wf2s.foe .tk { filter: drop-shadow(0 0 2px #ff6a5a) drop-shadow(0 2px 2px #000c) sepia(.25) saturate(1.2); }
.ap .wf2s .tk.tkd { opacity: .16; filter: grayscale(1); rotate: -78deg; }
/* 장수 — 맨 뒤 · 깃발 */
.ap .wf2s .wgen { position: absolute; left: calc(7% + var(--gdx, 0%)); top: 60%; width: clamp(26px, 6.6cqw, 40px); transform: translate(-50%, -78%); z-index: 60; transition: left .5s cubic-bezier(.3, 1.25, .5, 1); }
.ap .wf2s .wgen .wf { width: 100%; height: auto; aspect-ratio: 1; border-radius: 50%; object-fit: cover; border: 2px solid var(--fc); box-shadow: 0 0 0 1.5px #000a, 0 2px 6px #000c; background: #201811; position: relative; z-index: 1; }
.ap .wf2s.foe .wgen .wf { transform: scaleX(-1); }
.ap .wf2s .wpole { position: absolute; left: 50%; bottom: 60%; width: 3px; height: 110%; background: linear-gradient(90deg, #3a2814, #8a6a40); }
.ap .wf2s .wpole img { position: absolute; left: 3px; top: 0; width: clamp(16px, 4cqw, 24px); aspect-ratio: 1.2; object-fit: contain; padding: 2px; background: var(--fc); border: 1px solid #1a1008; clip-path: polygon(0 0, 100% 0, 85% 50%, 100% 100%, 0 100%); }
/* 지금 고르는 무리가 진에서 빛난다 (탭과 이어진다) */
.ap .wfield[data-act="front"] .us .tk.r0, .ap .wfield[data-act="bows"] .us .tk.r1, .ap .wfield[data-act="horse"] .us .tk.r2 { filter: drop-shadow(0 0 4px #ffd27a) drop-shadow(0 0 2px #ffd27a) drop-shadow(0 2px 2px #000c); }
.ap .wfield[data-act="lead"] .us .wgen .wf { box-shadow: 0 0 0 2px #ffd27a, 0 0 14px #ffd27a; }
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
.ap .wf2s .q-drum { left: 7%; top: 47%; width: clamp(40px, 11cqw, 64px); aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; border: 2px solid #ffd27a; }
.ap .wf2s[data-l="drum"] .q-drum, .ap .wf2s[data-l="art"] .q-drum { opacity: 1; animation: wqdrum 1s ease-out infinite; } @keyframes wqdrum { from { scale: .6; opacity: 1; } to { scale: 1.5; opacity: 0; } }
.ap .wf2s[data-l="art"] .q-drum { border-color: #ff9ad8; }
.ap .wf2s .q-cap { left: 11%; top: 38%; width: 80%; border-top: 2px dashed #ffb070; text-align: left; padding-left: 14%; box-sizing: border-box; white-space: nowrap; color: #ffb070; } /* 글자는 제 쪽에 — 가운데 두면 양쪽이 같이 낼 때 겹친다 */
.ap .wf2s .q-cap b { position: relative; top: -16px; text-shadow: 0 1px 3px #000; }
.ap .wf2s[data-l="capture"] .q-cap { opacity: 1; }
.ap .wf2s .q-back { left: 16%; top: 30%; color: #c8d0e0; text-shadow: 0 1px 3px #000; } .ap .wf2s[data-l="retreat"] .q-back { opacity: 1; }
/* 맞부딪힘 — 앞줄이 서로 달려들어 부딪고 조금 물러선다. 이번 합에 잃은 만큼 쓰러진다 */
/* 근접전 — 맞부딪친 앞줄이 한가운데서 엉긴 채 남는다(말마다 조금씩 들쭉날쭉 — --j). 결과가 나오면 syncField 가 진으로 되돌린다 (형 10-25: "메가히트 수준") */
.ap .wfield.play .wf2s .tk.r0:not(.tkd) { animation: wstep .5s ease-out var(--fa, 0s) both, wclash .9s cubic-bezier(.3, .1, .3, 1) calc(var(--hd) - .45s) forwards; }
@keyframes wstep { from { translate: 0 0; } to { translate: 2cqw 0; } }
@keyframes wclash { 0% { translate: 2cqw 0; } 50% { translate: calc(9cqw + var(--j, 0) * .3cqw) 0; } 100% { translate: calc(6.5cqw + var(--j, 0) * .4cqw) calc((var(--j, 0) - 2.5) * .4cqw); } }
.ap .wfield.play .wf2s[data-h="flank"] .tk.r2:not(.tkd), .ap .wfield.play .wf2s[data-h="pursue"] .tk.r2:not(.tkd), .ap .wfield.play .wf2s[data-h="punch"] .tk.r2:not(.tkd) { animation: wride .9s ease-in var(--ha, 0s) both; }
@keyframes wride { 0% { translate: 0 0; } 70% { translate: 14cqw 9cqw; } 100% { translate: 12cqw 10cqw; } } /* 옆구리로 파고들어 적 진 가장자리에서 엉긴다 */
.ap .wfield .tk.tkf { animation: wtkfall .55s ease-in calc(var(--hd) + .2s + var(--j) * .05s) forwards !important; }
@keyframes wtkfall { 0% { translate: 3cqw 0; } 100% { translate: 2cqw 0; rotate: -78deg; opacity: .16; filter: grayscale(1); } }
.ap .wfield .wf-mid { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); font-style: normal; font-size: 22px; color: #f0d090; text-shadow: 0 0 8px #000; opacity: 0; z-index: 80; }
/* 판의 끝 — 진 쪽은 등을 돌려(거울) 뒤로 달아나며 흩어지고, 이긴 쪽 장수 깃발이 솟는다. 맞부딪힘이 끝난 뒤(--hd + .9s) */
.ap .wfield.fin.win-us .wf2s.foe .tk.tku, .ap .wfield.fin.win-foe .wf2s.us .tk.tku { animation: wflee 1.6s ease-in calc(var(--rv, 0s) + var(--j, 0) * .07s) forwards !important; }
.ap .wfield.fin.win-us .wf2s.foe .tk.wsp.tku .spf, .ap .wfield.fin.win-foe .wf2s.us .tk.wsp.tku .spf { animation: spwalk .26s steps(1) var(--rv, 0s) infinite !important; }
@keyframes wflee { 0% { translate: 0 0; scale: 1; } 12% { scale: -1 1; } 100% { scale: -1 1; translate: -32cqw calc((var(--j, 0) - 2.5) * 2cqw); opacity: 0; } }
.ap .wfield.fin.win-us .wf2s.us .wgen, .ap .wfield.fin.win-foe .wf2s.foe .wgen { animation: wgenwin .7s cubic-bezier(.3, 1.6, .5, 1) calc(var(--rv, 0s) + .2s) both; }
@keyframes wgenwin { from { translate: 0 0; scale: 1; } to { translate: 9cqw -2cqw; scale: 1.35; } }
.ap .wfield.fin.win-us .wf2s.us .wpole, .ap .wfield.fin.win-foe .wf2s.foe .wpole { animation: wpoleup .6s ease-out calc(var(--rv, 0s) + .3s) both; }
@keyframes wpoleup { from { height: 110%; } to { height: 190%; filter: drop-shadow(0 0 6px #ffd27a); } }
/* 끝나면 진의 기세 표시(방패벽·화살 활꼴·기병 길·돌격 글자·격려 고리)를 걷는다 — 승패만 남게 */
.ap .wfield.fin .wq { animation: wqoff .4s ease-out var(--rv, 0s) forwards !important; } @keyframes wqoff { to { opacity: 0; visibility: hidden; } }
.ap .wfield.play .wf-mid { animation: wmid2 .6s ease-out var(--hd) both; } @keyframes wmid2 { 0% { opacity: 0; scale: .4; } 40% { opacity: 1; scale: 1.8; color: #fff; } 100% { opacity: 0; scale: 1.2; } }
/* 숨 쉬는 병사 — 서 있는 말이 저마다 조금씩 들썩인다 */
.ap .wf2s .tk.tku { animation: tkidle 1.8s ease-in-out calc(var(--j) * -.31s) infinite alternate; } @keyframes tkidle { to { translate: 0 -2px; } }
/* 들어오기 — 싸움이 처음 열리면 두 군대가 대열을 지어 걸어 들어온다 (적은 거울이라 오른쪽에서) */
.ap .wfield.enter .tk, .ap .wfield.enter .wgen { animation: tkin .95s cubic-bezier(.2, .8, .3, 1) calc(.15s + var(--j, 0) * .06s) both; }
@keyframes tkin { from { translate: -28cqw 0; opacity: 0; } 60% { opacity: 1; } to { translate: 0 0; opacity: 1; } }
/* 돌격이면 앞줄이 더 깊이 달려든다 */
/* 돌격 — 제 박자에 달려 나가 깊이 부딪친다 · 방진 — 제자리에서 받아 낸다 */
.ap .wfield.play .wf2s[data-f="charge"] .tk.r0:not(.tkd) { animation-name: wstepc, wclashc; } @keyframes wstepc { from { translate: 0 0; } to { translate: 5cqw 0; } } @keyframes wclashc { 0% { translate: 5cqw 0; } 50% { translate: calc(9.5cqw + var(--j, 0) * .3cqw) 0; } 100% { translate: calc(7cqw + var(--j, 0) * .4cqw) calc((var(--j, 0) - 2.5) * .4cqw); } }
.ap .wfield.play .wf2s[data-f="hold"] .tk.r0:not(.tkd) { animation-name: wsteph, wclashh; } @keyframes wsteph { from { translate: 0 0; } to { translate: 0 0; scale: 1; } } @keyframes wclashh { 0% { translate: 0 0; } 50% { translate: calc(4cqw + var(--j, 0) * .3cqw) 0; } 100% { translate: calc(3cqw + var(--j, 0) * .4cqw) calc((var(--j, 0) - 2.5) * .3cqw); } }
/* 전장 안의 화살비 — 궁수 자리에서 적 앞줄까지 활꼴로 (밖 틀이 가로로 가고 안의 화살이 오르내린다) */
.ap .wf-arw { position: absolute; left: 24%; top: 44%; z-index: 75; pointer-events: none; }
.ap .wf-arw > i { position: absolute; left: 0; top: var(--ay); opacity: 0; animation: arwx .8s linear calc(var(--sa) + var(--k) * .05s) both; }
.ap .wf-arw img { display: block; width: clamp(14px, 4.2cqw, 28px); filter: drop-shadow(0 1px 1px #000a); animation: arwy .8s calc(var(--sa) + var(--k) * .05s) both; }
@keyframes arwx { 0% { opacity: 1; translate: 0 0; } 90% { opacity: 1; } 100% { opacity: 0; translate: 38cqw 0; } }
@keyframes arwy { 0% { translate: 0 0; rotate: -38deg; animation-timing-function: ease-out; } 50% { translate: 0 -15cqw; rotate: 0deg; animation-timing-function: ease-in; } 100% { translate: 0 0; rotate: 38deg; } }
/* 맞부딪힘 — 불꽃 · 흙먼지 · 흔들림 · 살짝 당겨 보기 */
.ap .wfield.play { animation: wshake .5s ease-out var(--hd) both; }
@keyframes wshake { 0% { translate: 0 0; scale: 1; } 15% { translate: -5px 2px; scale: 1.05; } 35% { translate: 4px -2px; } 55% { translate: -2px 1px; } 100% { translate: 0 0; scale: 1; } }
.ap .wf-hit { position: absolute; left: 50%; top: 56%; z-index: 85; pointer-events: none; }
.ap .wf-hit img { position: absolute; left: 0; top: 0; translate: -50% -50%; opacity: 0; }
.ap .wf-hit .h1 { width: clamp(70px, 22cqw, 140px); animation: whit1 .45s ease-out var(--hd) both; mix-blend-mode: screen; }
.ap .wf-hit .h2 { width: clamp(90px, 30cqw, 190px); animation: whit2 1.1s ease-out var(--hd) both; }
.ap .wf-hit .h3 { width: clamp(70px, 24cqw, 150px); animation: whit3 1.2s ease-out calc(var(--hd) + .08s) both; }
@keyframes whit1 { 0% { opacity: 0; scale: .3; } 25% { opacity: 1; scale: 1.1; } 100% { opacity: 0; scale: 1.5; } }
@keyframes whit2 { 0% { opacity: 0; scale: .5; } 20% { opacity: .85; } 100% { opacity: 0; scale: 1.5; translate: -70% -60%; } }
@keyframes whit3 { 0% { opacity: 0; scale: .5; } 20% { opacity: .7; } 100% { opacity: 0; scale: 1.4; translate: -30% -55%; } }
/* 잃은 수 — 양쪽 위로 떠오른다 */
.ap .wf-loss { position: absolute; top: 26%; z-index: 90; font-size: clamp(15px, 4.4cqw, 26px); font-weight: 900; color: #ff6a5a; text-shadow: 0 0 6px #000, 0 2px 3px #000; opacity: 0;
  animation: wloss 1.6s ease-out calc(var(--hd) + .35s) both; }
.ap .wf-loss.us { left: 26%; } .ap .wf-loss.foe { right: 26%; color: #ffd27a; }
.ap .wf-who { position: absolute; bottom: 6px; z-index: 80; font-size: clamp(10px, 2.6cqw, 13px); font-weight: 800; padding: 2px 8px; border-radius: 9px; background: #3f8f3acc; color: #eaffe0; text-shadow: 0 1px 2px #000; pointer-events: none; max-width: 42%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap .wf-who.us { left: 6px; } .ap .wf-who.foe { right: 6px; background: #8a3a2acc; color: #ffe3dc; }
@keyframes wloss { 0% { opacity: 0; translate: 0 10px; scale: .6; } 15% { opacity: 1; translate: 0 0; scale: 1.15; } 70% { opacity: 1; scale: 1; } 100% { opacity: 0; translate: 0 -18px; } }
/* 동작 그림 — 8컷 띠를 칸씩 넘긴다 (steps). 바깥(.tk)은 자리·밀기, 안(.spf)은 컷 */
.ap .wf2s .tk.wsp { width: auto; aspect-ratio: var(--ar, 1); } .ap .wf2s .tk.wsp.k-horse, .ap .wf2s .tk.wsp.k-boat { height: clamp(38px, 10cqw, 68px); } /* 말 탄 이는 걷는 이보다 크다 */
.ap .wf2s .tk.wsp .spf { position: absolute; inset: 0; background: 0 0 / 800% 100% no-repeat; animation: spidle 1.5s steps(1) calc(var(--j) * -.27s) infinite; }
@keyframes spidle { 0% { background-position-x: 0%; } 50% { background-position-x: 14.2857%; } }
@keyframes spwalk { 0% { background-position-x: 28.5714%; } 50% { background-position-x: 42.8571%; } }
@keyframes spatk { 0% { background-position-x: 57.1429%; } 50% { background-position-x: 71.4286%; } }
.ap .wfield.enter .tk.wsp .spf { animation: spwalk .42s steps(1) calc(var(--j) * -.1s) 4, spidle 1.5s steps(1) 1.9s infinite; }
.ap .wfield.play .wf2s .tk.wsp.r0:not(.tkd) .spf { animation: spwalk .42s steps(1) var(--fa, 0s) 2, spatk calc(.3s + var(--j, 0) * .03s) steps(1) calc(var(--hd) - .32s + var(--j, 0) * .05s) 7, spidle 1.5s steps(1) calc(var(--hd) + 1.9s) infinite; }
/* 도끼병 — 받은 그림엔 내려치는 컷이 없다(든 컷 4 뿐) → 든 컷을 앞으로 휘둘러 기울인다 (컷 5는 들기의 다른 자세라 안 쓴다) */
.ap .wfield.play .wf2s .tk.wsp.k-axe.r0:not(.tkd) .spf { animation: spwalk .42s steps(1) var(--fa, 0s) 2, spaxe .3s steps(1) calc(var(--hd) - .32s + var(--j, 0) * .05s) 7, spidle 1.5s steps(1) calc(var(--hd) + 1.9s) infinite; }
.ap .wfield.play .wf2s .tk.wsp.k-axe.r0:not(.tkd) .spf { transform-origin: 40% 90%; }
@keyframes spaxe { 0% { background-position-x: 57.1429%; rotate: -8deg; } 50% { background-position-x: 57.1429%; rotate: 28deg; } }
/* 궁수 — 쏘는 박자에 시위를 당겼다(4) 놓는다(5) · 기병 — 제 박자에 달린다(걷기 컷) */
.ap .wfield.play .wf2s[data-b] .tk.wsp.r1:not(.tkd) .spf { animation: spdraw .75s steps(1) calc(var(--sa) - .45s) forwards, spidle 1.5s steps(1) calc(var(--sa) + .5s) infinite; }
@keyframes spdraw { 0% { background-position-x: 57.1429%; } 60% { background-position-x: 71.4286%; } 100% { background-position-x: 71.4286%; } }
.ap .wfield.play .wf2s[data-h] .tk.wsp.r2:not(.tkd) .spf { animation: spwalk .3s steps(1) var(--ha, 0s) 3, spatk .26s steps(1) calc(var(--hd) - .3s) 2, spidle 1.5s steps(1) calc(var(--hd) + .5s) infinite; }
/* 쓰러짐 — 굴리지 않고 쓰러진 컷으로 땅에 남는다 */
.ap .wf2s .tk.wsp.tkd { rotate: 0deg; opacity: .62; filter: grayscale(.5) brightness(.8) drop-shadow(0 2px 2px #000c); }
.ap .wf2s .tk.wsp.tkd .spf { animation: none; background-position-x: 100%; }
.ap .wfield .tk.wsp.tkf { animation: wtkfallsp .5s ease-out calc(var(--hd) + .2s + var(--j) * .05s) forwards !important; }
.ap .wfield .tk.wsp.tkf .spf { animation: spidle 1.5s steps(1) infinite, spdie .01s steps(1) calc(var(--hd) + .2s + var(--j) * .05s) forwards; }
/* 앞줄에서 쓰러지는 이는 엉긴 한가운데로 달려들었다가 거기서 쓰러진다 · 다음 합에도 그 자리에 누워 있다 */
.ap .wfield .tk.r0.tkf { animation: wtkfallm 1.5s ease-out calc(var(--hd) - .45s) forwards !important; }
@keyframes wtkfallm { 0% { translate: 2cqw 0; } 30% { translate: calc(8.5cqw + var(--j, 0) * .3cqw) 0; } 55% { translate: calc(8.5cqw + var(--j, 0) * .3cqw) 0; opacity: 1; filter: none; } 100% { translate: calc(7cqw + var(--j, 0) * .3cqw) .6cqw; opacity: .62; filter: grayscale(.5) brightness(.8); } }
.ap .wfield .tk.wsp.r0.tkf .spf { animation: spatk .3s steps(1) calc(var(--hd) - .2s) 2, spdie .01s steps(1) calc(var(--hd) + .4s + var(--j) * .08s) forwards; }
.ap .wf2s .tk.r0.tkd { translate: calc(7cqw + var(--j, 0) * .3cqw) .6cqw; }
@keyframes spdie { to { background-position-x: 100%; } }
/* 맞음 — 맞부딪는 순간 살아남은 앞줄 몇이 뒤로 휘청(맞음 컷 6) 했다가 다시 싸운다 */
.ap .wfield.play .wf2s .tk.wsp.r0.tku:nth-child(3n) .spf { animation: spflinch .38s steps(1) calc(var(--hd) + .02s + var(--j, 0) * .04s) 1, spatk calc(.3s + var(--j, 0) * .03s) steps(1) calc(var(--hd) + .42s) 5, spidle 1.5s steps(1) calc(var(--hd) + 1.9s) infinite; }
@keyframes spflinch { 0%, 100% { background-position-x: 85.7143%; } }
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
@media (prefers-reduced-motion: reduce) { .ap .wfield *, .ap .wfield .tk.tkf, .ap .wfield.play { animation: none !important; transition: none !important; } .ap .wf-loss { opacity: 1; } }
.ap .wbar i { position: relative; display: block; height: 100%; border-radius: 6px; overflow: hidden; }
.ap .wbar i::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(115deg, #ffffff00 0 9px, #ffffff2a 9px 15px); background-size: 34px 100%; animation: wbarflow 1.1s linear infinite; }
.ap .wbar i::after { content: ''; position: absolute; top: 0; bottom: 0; left: -45%; width: 45%; background: linear-gradient(90deg, #fff0, #ffffffb0, #fff0); animation: wbarshine 3s ease-in-out infinite; }
.ap .ws.foe .wbar i::after { animation-delay: 1.4s; }
@keyframes wbarflow { to { background-position: 34px 0; } }
@keyframes wbarshine { 0% { left: -45%; } 55%, 100% { left: 110%; } }
@media (prefers-reduced-motion: reduce) { .ap .wbar i::before, .ap .wbar i::after, .ap .ws.us .wpf > i, .ap .wbg, .ap .wember { animation: none !important; } }
.ap .wbar i.wgr { animation-duration: .4s; animation-timing-function: ease-out; animation-delay: var(--bd, 2.4s); animation-fill-mode: both; }
.ap .wn.swap { display: inline-grid; } .ap .wn.swap > * { grid-area: 1 / 1; text-decoration: none; }
.ap .wn.swap s { animation: wout .3s ease-out 2.4s both; } .ap .wn.swap u { animation: wrin .3s ease-out 2.4s both; }
@keyframes wout { to { opacity: 0; } }
.ap .wbar.men i { background: linear-gradient(90deg, #2f7a2a, #6fc05a 60%, #b6f09a); box-shadow: 0 0 10px #6fc05a99; }
.ap .ws.foe .wbar.men i { background: linear-gradient(90deg, #f0a088, #d0583c 40%, #7a2618); box-shadow: 0 0 10px #d0583c99; }
/* 호궤 미리 보기 — 오를 몫이 깜박인다 (깃발에 올리거나 · 누르고 있거나 · 골라 두면) */
.ap .wbar u.wfpv { position: absolute; top: 0; bottom: 0; display: none; border-radius: 0 6px 6px 0; background: linear-gradient(90deg, #fff2c0, #9be07a); box-shadow: 0 0 10px #c8f09a; }
.ap .wr:has(.wcmd.feast:hover) .wbar u.wfpv, .ap .wr:has(.wcmd.feast:active) .wbar u.wfpv, .ap .wr:has(.wcmd.feast.on) .wbar u.wfpv { display: block; animation: wfpv .7s ease-in-out infinite alternate; }
@keyframes wfpv { from { opacity: .25; } to { opacity: 1; } }
.ap .wcmd .wfcost { display: inline-block; margin: 1px 0; padding: 0 6px; border-radius: 8px; background: #3a2a10; border: 1px solid #c9a45a; color: #f6d27a; font-size: 11.5px; font-style: normal; }
.ap .wbar.mor { height: 8px; } .ap .wbar.mor i { background: linear-gradient(90deg, #a87a2a, #f6d27a 70%, #fff2c0); box-shadow: 0 0 8px #f6d27a88; }
.ap .ws .wn { font-size: 12px; color: var(--ink); }
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
.ap .wr.help .whelp { background: #ffd27a; color: #1b1408; box-shadow: 0 0 10px #ffd27a88; }
.ap .wr:not(.help) .wfhint, .ap .wr:not(.help) .wgby, .ap .wr:not(.help) .wnext .wintel, .ap .wr:not(.help) .wnext .wcmd .wct > small, .ap .wr:not(.help) .wst > p { display: none; }
.ap .wr:not(.help) .wst:not(:has(.wact)):not(:has(> :not(p))) { display: none; }
.ap .wcmds { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; }
.ap .wc { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3px; padding: 3px 6px; border-radius: 12px; background: #2a1f16; flex: 1; min-width: 0; }
.ap .wc.foe { background: #2d1f1d; }
.ap .wc .wck { font-style: normal; font-size: 11px; font-weight: 800; padding: 1px 6px; border-radius: 8px; background: #3f8f3a; color: #eaffe0; margin-right: 2px; } .ap .wc.foe .wck { background: #8a3a2a; color: #ffe3dc; }
.ap .wfl { display: inline-flex; align-items: center; gap: 2px; font-size: 12.5px; white-space: nowrap; padding: 0 3px; }
.ap .wfl img { width: 22px; height: 22px; object-fit: contain; }
.ap .wcmds > i { font-style: normal; color: #c8402a; }
.ap .wst { margin: 6px 0 2px; }
.ap .wacts { display: flex; flex-direction: column; gap: 4px; margin: 2px 0 6px; }
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
.ap .wact .arw { font-style: normal; color: #a89c84; }
.ap .wact .res { margin-left: auto; font-weight: 700; padding: 1px 7px; border-radius: 8px; background: #ffffff10; color: #d8cfbd; }
.ap .wact.good .res { background: #2f4a26; color: #b8e09a; } .ap .wact.bad .res { background: #4a2420; color: #ffb0a0; }
.ap .wact .loss { font-size: 12px; color: #e0a090; } .ap .wact .loss.own { color: #a89c84; }
.ap .wst.sm p { font-size: 12.5px; color: #a89c84; margin: 2px 0; }
.ap .wst p { margin: 3px 0; font-size: 14.5px; line-height: 1.5; }
.ap .wrd.crit .wst p:first-child { color: var(--gold); }
.ap .wpush { margin: 4px 0 0; text-align: center; font-size: 13px; color: var(--mute); }
.ap .wpush.good { color: var(--good); } .ap .wpush.bad { color: var(--bad); }
.ap .wfl.art { color: #ffd27a; text-shadow: 0 0 6px #ffd27a88; } .ap .wcmd.art { border-color: #c8a050; background: linear-gradient(#2a2418, #1d1a14); } .ap .wcmd em.art { background: #c8a050; color: #1b1408; }
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
.ap .wfx-cmd .sh { --w: clamp(54px, 7vw, 112px); --ar: 165 / 256; --an: wcsh; --du: 1.1s; filter: drop-shadow(0 6px 6px #000a); }
@keyframes wcsh { 0% { opacity: 0; transform: translateY(-34vh) rotate(-10deg) scale(1.1); animation-timing-function: cubic-bezier(.6, 0, 1, .6); }
  22% { opacity: 1; transform: translateY(0) rotate(0) scale(1); } 28% { transform: translateY(-4%) scale(1.03, .97); } 34% { transform: translateY(0) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(0); } }
.ap .wfx-cmd .sh.gd { --an: wcgd; }
@keyframes wcgd { 0% { opacity: 0; transform: translateY(30%) scale(.6); } 25% { opacity: 1; transform: translateY(0) scale(1.05); } 35% { transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; } }
.ap .wfx-cmd .sh.op { --an: wcop; --du: 1.3s; }
@keyframes wcop { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: 1; } 55% { opacity: 1; transform: translateY(var(--dy)); } 100% { opacity: 0; transform: translateY(var(--dy)); } }
.ap .wfx-cmd .rk { --w: clamp(76px, 9.5vw, 150px); --ar: 256 / 220; --an: wcrk; --du: 1.15s; --ease: cubic-bezier(.45, 0, .85, .55); filter: drop-shadow(0 8px 6px #000b); }
@keyframes wcrk { 0% { opacity: 0; transform: translate(-6vw, -30vh) rotate(0); } 12% { opacity: 1; } 70% { transform: translate(calc(var(--dx) * .8), 0) rotate(420deg); }
  80% { transform: translate(calc(var(--dx) * .88), -3vh) rotate(480deg); } 90% { opacity: 1; transform: translate(var(--dx), 0) rotate(540deg); } 100% { opacity: 0; transform: translate(var(--dx), 0) rotate(560deg); } }
.ap .wfx-cmd .lg { --w: clamp(180px, 24vw, 360px); --ar: 256 / 135; --x: -8%; --an: wclg; --du: 1.25s; filter: drop-shadow(0 8px 8px #000b); }
@keyframes wclg { 0% { opacity: 0; transform: translateX(-30vw); } 10% { opacity: 1; } 24% { transform: translateX(24vw); } 34% { transform: translateX(16vw); }
  53% { transform: translateX(25vw); } 63% { transform: translateX(16vw); } 82% { opacity: 1; transform: translateX(26vw); } 100% { opacity: 0; transform: translateX(22vw); } }
.ap .wfx-cmd .pop { --w: clamp(80px, 10vw, 150px); --ar: 1; --an: wcpop; --du: .7s; --ease: ease-out; }
.ap .wfx-cmd .pop.fr { --w: clamp(150px, 20vw, 300px); --ar: 1; --du: 1.2s; transform-origin: 50% 100%; filter: drop-shadow(0 0 10px #ff8a2a); }
@keyframes wcpop { 0% { opacity: 0; transform: scale(.2) rotate(-8deg); } 25% { opacity: 1; transform: scale(1) rotate(0); } 100% { opacity: 0; transform: scale(1.25) rotate(6deg); } }
.ap .wfx-cmd .pf { --w: 120px; --ar: 1; --an: wcpf; --du: 1.2s; --ease: ease-out; mix-blend-mode: screen; }
.ap .wfx-cmd .pf.bk { --an: wcpb; }
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
  background: linear-gradient(90deg, #3d8fe0 0 var(--lo), #3d8fe077 var(--lo) var(--hi), #c8503a var(--hi) 100%); }
.ap .wguess .wgbar::after { content: ''; position: absolute; left: var(--e0); top: -1px; bottom: -1px; width: 2px; margin-left: -1px; background: #ffe7b0; box-shadow: 0 0 3px #000; }
.ap .wcmd .wguess > b { font-size: 11.5px; white-space: nowrap; }
.ap .wguess.g2 > b { color: #7fd8ff; } .ap .wguess.g1 > b { color: #a8d8f0; } .ap .wguess.g0 > b { color: #d8cfbf; } .ap .wguess.b1 > b { color: #f0b090; } .ap .wguess.b2 > b { color: #ff7a5a; }
.ap .wguess .wgl { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; font-size: 11.5px; color: #d8cfbf; }
.ap .wguess .wgl b { font-size: 12px; } .ap .wguess .wgl b.l1 { color: #9fe08a; } .ap .wguess .wgl b.l2 { color: #f0d080; } .ap .wguess .wgl b.l3 { color: #ff8a6a; }
.ap .wguess .wgl .wgk { font-size: 10.5px; color: var(--mute); }
.ap .wguess .wgl i { height: 4px; border-radius: 2px; background: #0006; box-shadow: inset 0 0 0 1px #0006; }
.ap .wguess .wgl i.us { background: linear-gradient(90deg, #e0604a 0 var(--a), #e0604a66 var(--a) var(--b), #0006 var(--b)); }
.ap .wguess .wgl i.foe { background: linear-gradient(90deg, #e8c060 0 var(--a), #e8c06066 var(--a) var(--b), #0006 var(--b)); }
.ap .wcmd .wct { width: 100%; }
/* 전투 개시 — 다 고르기 전엔 잠겨 있다 */
.ap .wgo { font-size: 16px; } .ap .wgo small { display: block; font-size: 11px; font-weight: 500; }
.ap .wgo:disabled { opacity: .55; filter: grayscale(.6); cursor: default; }
.ap .wgo:not(:disabled) { animation: wgoready 1.1s ease-in-out infinite alternate; } @keyframes wgoready { from { box-shadow: 0 0 4px #ffd27a66; } to { box-shadow: 0 0 20px #ffd27a; } }
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
.ap .wrs, .ap .wrs::before, .ap .wrs::after, .ap .wrs *, .ap .wrs *::before, .ap .wrs *::after { animation: none !important; } /* paintNow 의 연출 다시 틀기 */
/* 전장을 만진다 — 꾹 누름에 글이 잡히거나 메뉴가 뜨지 않게 · 무리를 누를 수 있다는 손 모양 */
.ap .wfield { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation; cursor: pointer; }
.ap .wf-omen { cursor: help; }
/* 전장 왼쪽 위 땅 칩 (terrChips) — 그림과 이름, 누구에게 이로운지 테두리 */
.ap .wf-terr { position: absolute; left: 5px; top: 5px; z-index: 85; display: flex; gap: 4px; max-width: 58%; flex-wrap: wrap; }
.ap .wtc { display: flex; flex-direction: column; align-items: center; width: clamp(34px, 9.5cqw, 46px); padding: 2px 1px 1px; border-radius: 8px; background: #120d09c8; border: 1px solid #6a5a48; font-style: normal; cursor: help; box-shadow: 0 2px 6px #0008; }
.ap .wtc.us { border-color: #5fae55; } .ap .wtc.foe { border-color: #c8604a; }
.ap .wtc img { width: 86%; aspect-ratio: 1; object-fit: contain; } .ap .wtc b { font-size: clamp(8.5px, 2.2cqw, 10.5px); font-weight: 700; color: #f0dcb4; white-space: nowrap; overflow: hidden; max-width: 100%; text-overflow: clip; line-height: 1.2; }
.ap .wfield.play .wf-terr { opacity: .55; }
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
.ap .wsureb .wsurey { background: linear-gradient(#a8291c, #6e150c); border-color: #e04a3a; color: #fff; }
.ap .wfpop { position: fixed; z-index: 94; width: min(330px, calc(100vw - 16px)); padding: 8px; border-radius: 14px; background: #17110cf6; border: 1.5px solid #ffd27a; box-shadow: 0 0 0 1px #000, 0 12px 34px #000d, 0 0 18px #ffd27a44; animation: wfpin .16s ease-out; }
@keyframes wfpin { from { opacity: 0; transform: translateY(-6px) scale(.97); } to { opacity: 1; transform: none; } }
.ap .wfpop[hidden] { display: none; }
.ap .wfph { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; } .ap .wfph .wgi { width: 26px; height: 26px; flex: none; } .ap .wfph b { font-size: 14.5px; color: #fff; } .ap .wfph small { font-size: 11.5px; color: var(--mute); }
.ap .wfpx { margin-left: auto; width: 30px; height: 30px; border-radius: 15px; border: 1px solid #6a5a48; background: #2a221a; color: #e8dcc4; font-size: 14px; cursor: pointer; flex: none; }
.ap .wfpg { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px; }
.ap .wfpop .wcmd.mini { min-width: 0; overflow: hidden; min-height: 44px; padding: 5px 6px 5px 4px; flex-direction: row; align-items: center; gap: 4px; text-align: left; border: 1px solid #6a5236; border-image: none; border-radius: 10px; background: #241b12; filter: none; }
.ap .wfpop .wcmd.mini.on { border-color: var(--gold); background: #3a2e1c; box-shadow: 0 0 0 2px #d9b36a66; }
.ap .wfpop .wcmd.mini .wflag { width: 30px; height: auto; flex: none; }
.ap .wfpop .wcmd.mini .wct { gap: 1px; } .ap .wfpop .wcmd.mini .wct > b { font-size: 13.5px; }
/* 전장의 깃발 판엔 그림과 이름만 — 꼬리표·짐작 글이 자리를 넘쳐 튀어나오고 줄이 바뀌었다 (형 10-25) · 권함은 별 하나로 */
.ap .wfpop .wcmd.mini .wct > :not(b):not(em.rec) { display: none !important; }
.ap .wfpop .wcmd.mini .wct { flex-direction: row; align-items: center; gap: 3px; min-width: 0; }
.ap .wfpop .wcmd.mini .wct > b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.ap .wfpop .wcmd.mini .wct > em.rec { font-size: 0; padding: 0 3px; } .ap .wfpop .wcmd.mini .wct > em.rec::before { content: '★'; font-size: 11px; }
.ap .wfph b, .ap .wfph small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }

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
.ap .wr.fast .wrd.slow .wcmds, .ap .wr.fast .wrd.slow .wst, .ap .wr.fast .wrd.slow .wpush, .ap .wr.fast .wend, .ap .wr.fast .wnext { animation-delay: 0s !important; animation-duration: .01s !important; }
.ap .wr.fast .wbar i.wgr, .ap .wr.fast .wn.swap > *, .ap .wr.fast .wrd.slow .wloss, .ap .wr.fast .ws.hit, .ap .wr.fast .ws.hit::after, .ap .wr.fast .wfx-hit { animation-delay: 0s !important; animation-duration: .01s !important; }
/* 장수 기술 — 초상이 옆에서 튀어나와 한 마디 (일본식 컷인 띠·빛살 없이 · 기술 결마다 효과가 다르다) */
/* 장수 기술은 읽고 「내가 썼다」를 느낄 만큼 — 1.8초 또렷 · 0.4초 걷힘 (형 10-24: "너무 빨리 나타나고 없어진다" · 필살기 컷인은 흔히 1.5~2.5초) */
.ap .wcut { position: absolute; inset: 50% 0 0 0; z-index: 6; /* 아래 반쪽에 — 위 카드의 전장을 가리지 않게 (형 10-25) */ pointer-events: auto; cursor: pointer; overflow: hidden; animation: wcout 2.2s ease-in 1 forwards; }
@keyframes wcout { 0%, 82% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }
.ap .wcut .wcbg { position: absolute; left: -10%; right: -10%; top: 30%; height: 34%; background: linear-gradient(90deg, #0b0805f0, #2a1a0ce8 40%, #0b0805d0 80%, #0b080500);
  transform: skewY(-4deg) scaleX(0); transform-origin: 0 50%; animation: wcband .35s cubic-bezier(.2, 1.2, .4, 1) both; box-shadow: 0 0 0 2px #c9a45a88; }
@keyframes wcband { to { transform: skewY(-4deg) scaleX(1); } }
.ap .wcut .wcpf { position: absolute; left: 6%; top: 50%; width: min(36vw, 200px); aspect-ratio: 1; transform: translateY(-50%); display: grid; place-items: center; animation: wcin .45s cubic-bezier(.2, 1.4, .4, 1) .05s both; }
.ap .wcut .wcpf > i { position: absolute; inset: 0; background: url(__ART__ui/frame-portrait.png) center / 100% 100% no-repeat; filter: drop-shadow(0 6px 14px #000); }
.ap .wcut .wcf { width: 66%; height: 66%; object-fit: cover; border-radius: 2px; } .ap .wcut .wcf.unit { object-fit: contain; }
@keyframes wcin { from { opacity: 0; transform: translate(-70vw, -50%) scale(.9); } to { opacity: 1; transform: translate(0, -50%); } }
.ap .wcut .wctx { position: absolute; left: calc(6% + min(36vw, 200px) + 14px); right: 4%; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 4px; animation: wrin .4s ease-out .25s both; }
.ap .wcut .wctx b { font-family: var(--display); font-weight: 400; font-size: clamp(30px, 8vw, 54px); color: #fff1c8; text-shadow: 0 0 14px #ffb04a, 0 3px 6px #000; letter-spacing: .04em; }
.ap .wcut .wctx span { font-size: clamp(13px, 3.4vw, 16px); color: #f0dcb0; text-shadow: 0 1px 4px #000; }
/* 격려·외침 — 금빛 고리가 퍼지고 불티가 오른다 */
.ap .wcut .wcring { position: absolute; left: calc(6% + min(18vw, 100px)); top: 50%; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; border: 3px solid #ffd27a;
  box-shadow: 0 0 14px #ffd27a; opacity: 0; animation: wcring .9s ease-out var(--t) both; }
@keyframes wcring { 0% { opacity: 0; transform: scale(.4); } 10% { opacity: .9; } 100% { opacity: 0; transform: scale(4); } }
.ap .wcut.k-call .wcring { border-color: #f0f0ff; box-shadow: 0 0 14px #c8d8ff; }
.ap .wcut .wcspark { position: absolute; bottom: 20%; left: var(--x); width: 6px; height: 6px; border-radius: 50%; background: radial-gradient(circle, #fff6d0, #ffc04a 60%, #0000); opacity: 0;
  animation: wcspark 1s ease-out var(--t) both; }
@keyframes wcspark { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: 1; } 100% { opacity: 0; transform: translateY(-40vh); } }
/* 겨루기·돌진·한 발 — 흰 칼금이 비껴 지나가고 빠르기 줄이 흐른다, 화면이 한 번 흔들린다 */
.ap .wcut.k-strike, .ap .wcut.k-shot { animation: wcout .9s ease-in 1 forwards; }
@keyframes wcshake { 0%, 100% { transform: none; } 25% { transform: translate(-8px, 4px); } 50% { transform: translate(7px, -4px); } 75% { transform: translate(-3px, 2px); } }
.ap .wcut .wcslash { position: absolute; left: -20%; right: -20%; top: 48%; height: 6px; background: linear-gradient(90deg, #fff0, #ffffff, #fff0); box-shadow: 0 0 18px #fff;
  transform: rotate(-14deg) scaleX(0); animation: wcslash .32s ease-out .28s both; }
@keyframes wcslash { 0% { transform: rotate(-14deg) scaleX(0); opacity: 1; } 70% { transform: rotate(-14deg) scaleX(1); opacity: 1; } 100% { transform: rotate(-14deg) scaleX(1); opacity: 0; } }
.ap .wcut.k-shot .wcslash { height: 3px; transform-origin: 0 50%; }
.ap .wcut .wcline { position: absolute; left: 100%; top: var(--y); width: 40%; height: 2px; background: linear-gradient(90deg, #fff0, #ffffffaa); animation: wcline .5s linear var(--t) both; }
@keyframes wcline { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-260%); opacity: 0; } }
/* 사로잡기 — 고리가 좁혀 든다 */
.ap .wcut .wcrope { position: absolute; right: 18%; top: 50%; width: 160px; height: 160px; margin-top: -80px; border-radius: 50%; border: 6px dashed #c8a060; opacity: 0;
  animation: wcrope .8s ease-in .3s both; }
@keyframes wcrope { 0% { opacity: 0; transform: scale(2) rotate(0); } 30% { opacity: 1; } 100% { opacity: 1; transform: scale(.5) rotate(200deg); } }
/* 버텨라 — 방패 고리가 쾅 */
.ap .wcut .wcshield { position: absolute; left: calc(6% + min(18vw, 100px)); top: 50%; width: 220px; height: 220px; margin: -110px 0 0 -110px; border-radius: 50%;
  background: radial-gradient(circle, #9fd0f000 55%, #9fd0f066 62%, #9fd0f000 70%); opacity: 0; animation: wcshield .7s ease-out .3s both; }
@keyframes wcshield { 0% { opacity: 0; transform: scale(.6); } 30% { opacity: 1; transform: scale(1.05); } 100% { opacity: 0; transform: scale(1.2); } }
/* 물러서라 — 초상이 들어왔다 뒤로 빠진다 */
.ap .wcut.k-back .wcpf { animation: wcin .4s cubic-bezier(.2, 1.4, .4, 1) .05s both, wcbackout .5s ease-in .9s both; }
@keyframes wcbackout { to { opacity: 0; transform: translate(-30vw, -50%); } }
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
.ap .wopen .wob { position: absolute; inset: -4%; background: center / cover no-repeat; filter: brightness(.75) saturate(1.05); animation: wozoom 3.4s ease-out both; }
@keyframes wozoom { from { transform: scale(1.18); filter: brightness(.2); } 25% { filter: brightness(.8); } to { transform: scale(1); } }
.ap .wopen::before { content: ''; position: absolute; inset: 0; z-index: 1; background: radial-gradient(ellipse at 50% 50%, #0000 30%, #000c 100%); }
.ap .wopen .wofl { position: absolute; inset: 0; z-index: 2; background: radial-gradient(circle, #ff6a3a88, #b0281a55 40%, #0000 75%); opacity: 0; animation: woflash .7s ease-out .9s both; }
@keyframes woflash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
.ap .wopen .woin { position: absolute; inset: 0; z-index: 3; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; padding: 0 4vw; animation: woshake .5s ease-out .9s both; }
@keyframes woshake { 0%, 100% { transform: none; } 20% { transform: translate(-8px, 3px); } 40% { transform: translate(7px, -4px); } 60% { transform: translate(-4px, 2px); } 80% { transform: translate(2px, -1px); } }
.ap .wosd { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; min-width: 0; }
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
  background: radial-gradient(circle, #000b 0, #0000 72%); animation: sfx 2.4s ease-out forwards; }
.ap .warfx > div { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 36px; border-radius: 18px; background: #1a1210ee;
  border: 1px solid #a0502a; box-shadow: 0 8px 40px #000c; animation: sfxin 1.6s cubic-bezier(.2, 1.4, .4, 1) forwards; }
.ap .warfx b { font-family: var(--display); font-weight: 400; font-size: 32px; color: #f0c080; letter-spacing: 2px; }
.ap .warfx span { font-size: 13.5px; color: #e0d0c0; }
@media (prefers-reduced-motion: reduce) { .ap .wr *, .ap .warfx, .ap .warfx * { animation-duration: .01s !important; animation-delay: 0s !important; transition: none !important; } }
`

/** 싸움이 열리는 판 — 싸움터 그림 · 양쪽 깃발과 장수 · 이름 · 누가 쳐들어왔나 · 세기 막대 · 어느 나라와 싸우는 중인가 */
function openHtml(prev: Realm, after: Realm, l: BattleLine, me: string, art: string, us: number, them: number): string {
  const weAtk = l.atkFaction === me
  const atkF = l.atkFaction ?? prev.armies[l.attacker]?.faction
  const ourF = weAtk ? atkF : l.defender
  const foeF = weAtk ? l.defender : atkF
  const fname = (f: string | undefined): string => (f !== undefined ? (after.factions[f]?.name ?? '?') : '?')
  const st = l.start
  const ourHero = st?.heroes[weAtk ? 0 : 1] ?? null
  const foeHero = st?.heroes[weAtk ? 1 : 0] ?? null
  const hname = (id: string | null, f: string | undefined): string => (id !== null ? (prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '?') : `${fname(f)} 군`)
  const color = (f: string | undefined): string => (f !== undefined ? (FACTION_ART[f]?.color ?? '#ccc') : '#ccc')
  const emb = (f: string | undefined): string => {
    const e = flagIcon(f)
    return e !== undefined ? `<img class="woe" src="${art}icon/${e}.png" alt="">` : ''
  }
  const place = after.nodes[l.node]?.name ?? prev.nodes[l.node]?.name ?? ''
  const foe = fname(foeF)
  const sub = l.field === true ? `길에서 ${josa(foe, '과', '와')} 맞닥뜨렸다`
    : weAtk ? `${josa(place, '을', '를')} 친다`
    : `${josa(foe, '이', '가')} ${josa(place, '으로', '로')} 쳐들어왔다!`
  const ground = warGround(prev, l)
  const SOLS = new Set(['spear', 'shield', 'bow', 'crossbow', 'horse', 'pike', 'boat', 'axe', 'marine'])
  const seaWar = warGround(prev, l) === 'sea'
  const mixHtml = (i: 0 | 1): string => {
    const mx = Object.entries(st?.mix?.[i] ?? {}).filter(([, v]) => (v ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    return mx.length > 0 ? `<div class="womix">${mx.map(([k, v]) => `<span><img src="${art}icon/sol-${SOLS.has(solArt(k, seaWar)) ? solArt(k, seaWar) : 'spear'}.png" alt=""><b>${esc(UNIT_NAME[k as keyof typeof UNIT_NAME] ?? k)}</b>${(v ?? 0).toLocaleString('ko-KR')}</span>`).join('')}</div>` : ''
  }
  const side = (cls: string, f: string | undefined, hero: string | null, n: number, fallback: string, i: 0 | 1): string =>
    `<div class="wosd ${cls}" style="--c:${color(f)}">${emb(f)}<span class="wpf big">${face(hero, art, fallback)}<i></i></span><b>${esc(hname(hero, f))}</b><span>${esc(fname(f))} · ${n.toLocaleString('ko-KR')}명</span>${mixHtml(i)}</div>`
  const share = Math.round((us / Math.max(1, us + them)) * 100)
  // 땅 — 그림 칩으로 (형 10-25: "지형정보라던가 이런것도 이미지나 아이콘으로") · 진군 이야기는 맨 아래 마지막으로 (형: "대로로 당당히 다가섰다 이거는 vs 화면 하단에 마지막 오브젝트로")
  // 누가 치나 — 우리의 공격·기습 / 적의 침략·기습 / 길 위에서 맞닥뜨림 (형 10-25: "침략은 내가 공격하는것도 있잖아")
  const sneak = l.ambush !== 'none'
  const kindWord = l.field === true ? '길에서 맞닥뜨렸다' : weAtk ? (sneak ? '우리의 기습' : '우리의 공격') : (sneak ? '적의 기습' : '적의 침략')
  const chips = terrChips(prev, l, me, foe)
  const ap = chips.find((c) => c.k === 'ap')
  const land = chips.filter((c) => c.k !== 'ap')
  const D = P.realm.warOpenCount + 0.6
  const t0 = 1.5
  const terr = land.length > 0 ? `<div class="woterr">${land.map((c, i) => `<div class="wotc${c.who !== '' ? ` ${c.who}` : ''}" style="--i:${i}"><img src="${art}icon/${c.icon}.png" alt=""><span><b>${esc(c.name)}</b>${c.who === 'us' ? '<em>우리에게 이롭다</em>' : c.who === 'foe' ? '<em>적에게 이롭다</em>' : ''}<small>${esc(c.line)}</small></span></div>`).join('')}</div>` : ''
  const lastAt = t0 + land.length * 0.22 + 0.25
  const intro = l.field === true ? '길 한가운데서 두 군대가 마주쳤다. 성도 장정도 없다.' : (ap?.line ?? '')
  return `<div class="wob" style="background-image:url('${warBg(art, ground, !weAtk)}');animation-duration:${D}s"></div><div class="wofl"></div><div class="wocol">`
    + `<div class="wohead"><b>${esc(warName(after, l))}</b><span>${esc(sub)}</span></div>`
    + `<div class="woin">${side('us', ourF, ourHero, us, UNIT_ICON.spear, 0)}<div class="wom"><img class="wox" src="${art}ui/vs.png" alt="VS"></div>${side('foe', foeF, foeHero, them, UNIT_ICON.shield, 1)}</div>`
    + `<div class="wofoot"><div class="wobar"><i class="us" style="width:${share}%"></i><i class="foe" style="width:${100 - share}%"></i></div>`
    + `<em class="${weAtk ? 'us' : 'foe'}">⚔ ${esc(kindWord)} · ${esc(josa(foe, '과', '와'))} 싸운다</em>${terr}`
    + (intro !== '' ? `<div class="wointro${ap !== undefined && ap.who !== '' ? ` ${ap.who}` : ''}" style="--d:${lastAt.toFixed(2)}s">${ap !== undefined ? `<img src="${art}icon/${ap.icon}.png" alt="">` : ''}<p>${esc(intro)}</p></div>` : '')
    + `<b class="wocd" style="--d:${(lastAt + 0.3).toFixed(2)}s"><i>${P.realm.warOpenCount}</i></b></div></div>`
}

/**
 * 전장을 연다 — 이번 계절에 우리가 낄 싸움이 없으면 false (부른 쪽이 바로 넘긴다).
 * 싸움마다 시험 돌림으로 판을 찾고, 다 끝나면 host.done(tactics).
 */
export function openWar(root: HTMLElement, prev: Realm, orders: readonly Order[], host: WarHost): boolean {
  const done: Record<string, Tactic> = {}
  let cur: { key: string; cmds: (Cmd | RoundOrder)[] } | null = null
  /** 지금 고르는 합의 깃발 — 무리마다 */
  let sel: { -readonly [K in keyof RoundOrder]: RoundOrder[K] } = {}
  /** 지금 펼친 무리 탭 — 합마다 처음엔 아직 안 고른 첫 무리 */
  let active: Grp | 'lead' | undefined
  /** 맡긴 싸움을 합마다 풀어 보이는 중 — 여기까지만 보인다 (없으면 끝까지) */
  let upto: number | undefined
  /** 그 차례의 시계 (소리 시계와 따로 — 합마다 소리가 앞의 것을 걷는다) */
  const chain: number[] = []
  const stopChain = (): void => { for (const x of chain.splice(0)) clearTimeout(x) }
  let t = rehearse(prev, orders, done, null, host.me)
  if (t.line === null) return false
  /** 처음 우리 싸움 수 — 머리의 "몇 판" */
  let left = t.left
  /** 이번 합에 고른 장수 기술 — 풀릴 때 초상 장면을 띄운다 */
  let cutLead: Cmd | null = null
  let cutSfx: string | null = null
  /** 이름 띠를 띄운 판 — 판마다 한 번 */
  let named: string | undefined
  // 배경·효과는 붙박이 층에, 글은 그 위 굴리는 층에 — 굴려도 배경이 안 움직이고, 깃발을 골라도 배경을 다시 깔지 않는다
  // (형 10-23: "전투 스크롤할 때 뒷배경이 자꾸 움직임 · 전투할 때 뭔가 선택하면 깜빡임")
  const ov = document.createElement('div')
  ov.className = 'wr'
  // 첫째 합 밑의 설명·깃발 설명은 「?」를 눌렀을 때만 (형 10-25) — 펼친 채로 두면 다음 싸움에도 펼쳐 둔다
  try { if (localStorage.getItem(HELP_KEY) === '1') ov.classList.add('help') } catch { /* 없으면 접힌 채 */ }
  ov.innerHTML = '<div class="wbg"></div><div class="wfxl"></div><div class="wsc"></div><div class="wfxt"></div><div class="wwin"></div>'
  const bgEl = ov.querySelector<HTMLElement>('.wbg')!
  const fxEl = ov.querySelector<HTMLElement>('.wfxl')!
  const fxTop = ov.querySelector<HTMLElement>('.wfxt')!
  const sc = ov.querySelector<HTMLElement>('.wsc')!
  const winEl = ov.querySelector<HTMLElement>('.wwin')!
  root.appendChild(ov)
  // 싸우는 동안 배우기 띠는 숨긴다 (형: "싸우는도중에 하단에 배우기 창 계속 떠있어서 짜증나")
  root.classList.add('war-open')
  const timers: number[] = []
  const clearTimers = (): void => { for (const x of timers.splice(0)) clearTimeout(x); booked = [] }
  /** 잡아 둔 소리의 [시작, 끝] — 한꺼번에 warSoundMax 를 넘지 않게 (feel-lens 검토 10-24: 한 합에 13개가 겹쳤다) */
  let booked: Array<readonly [number, number]> = []
  const room = (s: number, len: number): boolean => booked.filter(([a, b]) => a < s + len && b > s).length < P.realm.warSoundMax
  const at = (s: number, name: string, vol: number, rate = 1, dur = 0, low = false): void => {
    const len = dur > 0 ? dur : 1
    if (low && !room(s, len)) return
    booked.push([s, s + len])
    timers.push(window.setTimeout(() => { if (document.visibilityState === 'visible') host.ding(name, vol, rate, dur) }, s * 1000))
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
  }

  /** 폰 떨림 — 잘됐을 때만 (좋은 합 · 사로잡기 · 이김). 진 쪽 떨림은 헷갈려서 안 쓴다 (형: "공격하거나 잘됐을때로 긍정 피드백 시켜야 하나? 헷갈리니까??") */
  const buzz = (s: number, pattern: number[]): void => {
    if (typeof navigator.vibrate !== 'function') return
    timers.push(window.setTimeout(() => { if (document.visibilityState === 'visible') navigator.vibrate(pattern) }, s * 1000))
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
      else if (rd.ev === 'duel-win' || rd.ev === 'duel-lose') at(clashAt, BATTLE_SFX.duelWin, 0.45, 1, 1)
      else at(clashAt, rd.beat !== null ? BATTLE_SFX.crit : BATTLE_SFX.clash, rd.beat !== null ? 0.6 : 0.42, 1, 0.9)
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
        for (const [dt, v, rt] of b.slice(0, 2)) at(s0 + dt, BATTLE_SFX[c], vol * v * (ring ? P.realm.warRingBoost : 1), rt, ring ? 0 : Math.max(0.25, dur - dt), low)
      }
      for (const b of plan.beats) beat(b.c, b.at, b.ours ? 0.5 : 0.3, b.ours ? P.realm.warBeatDur : P.realm.warFoeBeatDur, !b.ours)
      // 엉긴 앞줄 — 찌르기 컷의 박자에 쇠가 부딪는 소리를 몇 번 흩어 낸다(작게 · 자리가 없으면 버린다). 소리마다 높낮이를 조금씩 (형 10-25: 소리와 동작 박자)
      if (rd.ev !== 'capture-ok' && rd.ev !== 'retreat') {
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
      if (rd !== undefined && (end.outcome === 'rout' || end.outcome === 'routed')) at(roundPlan(rd, weAtk).clash + 0.12, BATTLE_SFX.final, 0.6, 1, 1.6)
      // 판의 끝 — 결과 때에 승리·패배 소리 하나 · 음악은 그 소리가 가라앉은 뒤 (마지막 일격 소리는 맞부딪힘이 맡는다)
      const endAt = (rd !== undefined ? roundPlan(rd, weAtk).result : STAGE_S[2]) + 0.5
      if (!endSeen.horn) timers.push(window.setTimeout(() => { if (document.visibilityState === 'visible') { endSeen.horn = true; host.ding(good ? BATTLE_SFX.win : BATTLE_SFX.lose, 0.45) } }, endAt * 1000))
      if (!endSeen.music) timers.push(window.setTimeout(() => { endSeen.music = true; host.music?.(good ? 'win' : 'lose') }, (endAt + 0.6) * 1000))
      // 이겼다 — 부우웅 크게 (듀오링고처럼)
      if (good) buzz(endAt, end.outcome === 'rout' ? [60, 40, 60, 40, 60, 40, 120, 60, 300] : [...WIN_BUZZ])
    }
  }

  /** 싸움이 열린다 — 이름 띠 · 북 두 번 · 종 (계절 띠와 같은 길: 애니메이션이 끝나면 지운다) */
  const band = (l: BattleLine): void => {
    if (named === l.key) return
    named = l.key
    host.music?.('war')
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
    // 셈은 걷힘 애니메이션의 시계를 읽는다 — 탭이 숨어 애니메이션이 멈추면 셈도 멈춘다
    const tick = window.setInterval(() => {
      if (!el.isConnected) { window.clearInterval(tick); return }
      const a = el.getAnimations().find((x) => (x as CSSAnimation).animationName === 'woout')
      const n = Math.max(1, Math.ceil(N - Number(a?.currentTime ?? 0) / 1000))
      if (n !== shownN && cd !== null) {
        shownN = n
        cd.textContent = String(n)
        cd.classList.remove('tk')
        void cd.offsetWidth
        cd.classList.add('tk')
      }
    }, 100)
    const gone = (): void => { window.clearInterval(tick); el.remove() }
    el.addEventListener('animationend', (e) => { if (e.target === el) gone() })
    el.addEventListener('click', (e) => { e.stopPropagation(); gone() })
    root.appendChild(el)
    if (document.visibilityState === 'visible') {
      at(0, BATTLE_SFX.openDrum, 0.5)
      at(0.38, BATTLE_SFX.openDrum, 0.5)
      at(0.9, BATTLE_SFX.openBell, 0.45)
      at(0.95, BATTLE_SFX.cry, 0.4)
      buzz(0.9, [40, 30, 90])
    }
  }

  const paintNow = (anim: boolean): void => {
    const l = t.line!
    const shown = upto ?? (l.pending !== undefined ? l.pending.round : (l.rounds ?? []).length)
    const more = l.pending === undefined && shown < (l.rounds ?? []).length
    const tpl = document.createElement('template')
    tpl.innerHTML = warHtml(prev, t.after, l, host.me, host.art, shown, anim, left, sel, active, more)
    const bg = tpl.content.querySelector<HTMLElement>('.wbg')
    if (bg !== null) {
      if (bgEl.className !== bg.className) bgEl.className = bg.className
      if (bgEl.style.backgroundImage !== bg.style.backgroundImage) bgEl.style.backgroundImage = bg.style.backgroundImage
      bg.remove()
    }
    // 화살은 글판 위로 날아간다 — 흙먼지만 뒤에 (형 10-23: "배경이 막 화살 날아다니는 거 같은데 보드판 뒤로 밀려서 안 보임")
    fxTop.replaceChildren(...tpl.content.querySelectorAll('.wfx-volley, .wfx-cmd'))
    // 바뀐 곳만 고친다 — 합마다 통째로 갈아 끼워 초상·병사·깃발·배경 먼지 그림이 새로 만들어지며 화면 전체가 깜빡였다 (형 10-25: "전투할때 전부 화면이 엄청 깜빡")
    const fxf = document.createDocumentFragment()
    fxf.append(...tpl.content.querySelectorAll('.wfx'))
    morphInto(fxEl, fxf)
    morphInto(sc, tpl.content)
    // 살려 둔 요소의 연출(막대·흔들림·진·다음 합 판·먼지)은 새로 그린 것처럼 처음부터 다시 — 한 틀 안에서 껐다 켜서 비는 틀이 없다
    const again = [fxEl, ...sc.querySelectorAll<HTMLElement>('.wvs, .wfield, .wnext, .wend')]
    for (const e of again) e.classList.add('wrs')
    void sc.offsetWidth
    for (const e of again) e.classList.remove('wrs')
    // 싸움이 끝났다 — 이겼으면 「승리」가 쾅, 졌으면 「패배」가 내려앉는다 (형: "승리했다는 이펙트가 더 확실히")
    winEl.replaceChildren()
    if (anim && !more && l.pending === undefined && l.outcome !== 'draw') {
      const atkWon = l.outcome === 'rout' || l.outcome === 'win'
      const good = (l.atkFaction === host.me) === atkWon
      const word = good ? (l.outcome === 'rout' || l.outcome === 'routed' ? '대승' : '승리') : (l.outcome === 'rout' || l.outcome === 'routed' ? '대패' : '패배')
      // 마지막 합의 연출(장수 장면 · 깃발 하나씩 · 맞부딪힘 · 막대)이 다 끝난 뒤에 — 늘 3.3초에 떠서 싸우는 도중에 승패가 먼저 나왔다 (형 10-24)
      const lr = (l.rounds ?? [])[shown - 1]
      const endAt = (lr !== undefined ? roundPlan(lr, l.atkFaction === host.me).result : STAGE_S[2]) + 0.9
      winEl.innerHTML = winFxHtml(word, '', endAt, !good, true, l.outcome === 'rout' || l.outcome === 'routed', `${host.art}ui/win-logo.png`)
    }
  }

  const draw = (anim: boolean): void => {
    const l = t.line!
    const shown = upto ?? (l.pending !== undefined ? l.pending.round : (l.rounds ?? []).length)
    const more = l.pending === undefined && shown < (l.rounds ?? []).length
    ov.classList.toggle('slow', anim)
    ov.classList.remove('fast')
    closePop()
    hideTip()
    animating = false // 앞 합의 「연출 중」이 남지 않게 — 이 합이 풀리면 아래에서 다시 건다
    paintNow(anim)
    // 장수 기술 — 고른 합이면 그 장수가 튀어나온다
    if (anim && cutLead !== null) {
      const rd = (l.rounds ?? [])[shown - 1]
      const weAtk = l.atkFaction === host.me
      const ourS = weAtk ? 'a' : 'd'
      const act = rd?.acts?.find((x) => x.g === 'lead' && x.s === ourS)
      const c: Cmd = act?.c ?? cutLead
      const ak = c === 'art' ? act?.art : undefined
      const kind = ak !== undefined ? ART_CUT[ak] : CUT_OF[c]
      const hero = l.start?.heroes[weAtk ? 0 : 1] ?? null
      if (kind !== undefined && hero !== null) {
        const name = prev.heroes[hero]?.name ?? t.after.heroes[hero]?.name ?? ''
        const el = document.createElement('div')
        el.innerHTML = cutHtml(host.art, hero, name, ak !== undefined ? ART_NAME[ak] : CMD_NAME[c], kind)
        const cut = el.firstElementChild as HTMLElement
        cut.addEventListener('animationend', (e) => { if (e.target === cut) cut.remove() })
        cut.addEventListener('click', (e) => { e.stopPropagation(); cut.remove() })
        ov.appendChild(cut)
        cutSfx = kind === 'cheer' || kind === 'call' ? BATTLE_SFX.openDrum : BATTLE_SFX.duelWin
      }
    }
    cutLead = null
    sound(anim ? (l.rounds ?? [])[shown - 1] : undefined, l.atkFaction === host.me, anim && l.pending === undefined && !more ? l : null)
    if (cutSfx !== null) { at(0.28, cutSfx, 0.45); cutSfx = null } // 장수 기술 소리 — sound() 가 앞의 것을 걷은 뒤에
    if (!anim) band(l)
    // 싸운다를 누르면 — 이번 합이 위 카드 바로 밑에 오게, 판이 끝났으면 결과가 다 풀린 뒤 결과로 (형 10-23: "싸운다 누르면 스크롤 맨 위로 가는 게 맞나?")
    ov.style.setProperty('--wtoph', `${(sc.querySelector<HTMLElement>('.wtop')?.offsetHeight ?? 170) + 8}px`) // 붙박이 위 카드에 가리지 않게
    if (anim) {
      scrollInside(sc.querySelector('.wrd.slow'), 'start', true)
      const lr = (l.rounds ?? [])[shown - 1]
      const res = lr !== undefined ? roundPlan(lr, l.atkFaction === host.me).result : STAGE_S[2]
      if (more) { /* 다음 합이 곧 온다 */ } else if (l.pending === undefined) timers.push(window.setTimeout(() => scrollInside(sc.querySelector('.wend'), 'center', true), (res + 0.4) * 1000))
      else {
        timers.push(window.setTimeout(() => scrollInside(sc.querySelector('.wnext'), 'start', true), (res + 0.6) * 1000))
        animating = true
        timers.push(window.setTimeout(() => syncField(true), (res + 0.5) * 1000)) // 맞부딪힌 진을 거두고 다음 합을 고르는 진으로 (다음 합의 낌새도 그때 뜬다)
      }
    } else {
      sc.scrollTop = 0
      syncField()
    }
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
    active ??= sc.querySelector<HTMLElement>('.wgt.on[data-g]')?.dataset['g'] as Grp | 'lead' | undefined // 합 처음엔 펼친 탭의 무리가 빛나게
    if (f.dataset['act'] !== (active ?? '')) f.dataset['act'] = active ?? ''
    const us = f.querySelector<HTMLElement>('.wf2s.us')
    if (us !== null) setForm(us, peek !== null ? { ...sel, [peek.g]: peek.c } : sel)
    const hint = t.line?.pending?.hint ?? null
    const foe = f.querySelector<HTMLElement>('.wf2s.foe')
    if (foe !== null) setForm(foe, hint !== null ? { front: hint } : {})
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
        const img = document.createElement('img')
        img.src = src.querySelector('img.wflag')?.getAttribute('src') ?? ''
        img.alt = ''
        chip.className = 'wgs'
        chip.replaceChildren(img, src.querySelector('.wct b')?.textContent ?? '')
      } else {
        chip.className = 'wgs none'
        chip.textContent = '선택'
      }
    }
    for (const pn of sc.querySelectorAll<HTMLElement>('.wgrp[data-g]')) pn.hidden = pn.dataset['g'] !== active
    const go = sc.querySelector<HTMLButtonElement>('[data-war="go"]')
    if (go !== null) {
      const k = tabs.filter((tb) => sel[tb.dataset['g'] as Grp | 'lead'] !== undefined).length
      go.disabled = k < tabs.length
      go.innerHTML = goWord(k, tabs.length)
    }
    syncField()
  }

  const finish = (): void => {
    clearTimers()
    stopChain()
    ov.remove()
    root.classList.remove('war-open')
    host.done({ ...done })
  }

  /** 지금 판을 다 골랐다 — 그 명령으로 굳히고 결과를 보인다 (남은 합은 맡긴다) */
  const settle = (): void => {
    const key = cur?.key ?? t.line?.key
    if (key === undefined) return
    done[key] = { cmds: [...(cur?.key === key ? cur.cmds : [])] }
    cur = null
    sel = {}
    t = rehearse(prev, orders, done, null, host.me, key)
    if (t.line === null) advanceTo()
    else draw(true)
  }

  /**
   * 장수에게 맡긴다 — 그 장수의 지휘 버릇 장면 뒤 남은 합을 하나씩 풀어 보인다. 끝 합이 다 풀린 뒤에 승패
   * (형 10-24: "자동전투는 장수 특성에 따라 효과 나오게" — 전엔 마지막 합만 보이고 끝났다). 아무 데나 누르면 끝까지 건너뛴다
   */
  const autoPlay = (): void => {
    const l0 = t.line
    const key = cur?.key ?? l0?.key
    if (l0 === null || key === undefined) return
    const from = l0.pending?.round ?? (l0.rounds ?? []).length
    done[key] = { cmds: [...(cur?.key === key ? cur.cmds : [])] }
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
      box.innerHTML = cutHtml(host.art, hero, hh?.name ?? '', `${sn} — ${sl}`, 'lead')
      const cut = box.firstElementChild as HTMLElement
      cut.addEventListener('animationend', (e) => { if (e.target === cut) cut.remove() })
      cut.addEventListener('click', (e) => { e.stopPropagation(); cut.remove() })
      ov.appendChild(cut)
      at(0.28, BATTLE_SFX.openDrum, 0.45)
      t0 = P.realm.warAutoCutS
    }
    const step = (k: number, after: number): void => {
      const id = window.setTimeout(() => {
        chain.splice(chain.indexOf(id), 1) // 불린 것은 뺀다 — 남으면 끝난 뒤 첫 빈 곳 누르기가 마지막 합을 다시 틀었다 (재검토 10-25)
        upto = k < R ? k : undefined
        draw(true)
        const rd = (l.rounds ?? [])[k - 1]
        if (k < R && rd !== undefined) step(k + 1, roundPlan(rd, weAtk).result + P.realm.warAutoGapS)
      }, after * 1000)
      chain.push(id)
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
    const els = [...s.querySelectorAll<HTMLElement>(g === 'lead' ? '.wgen' : `.tk.r${RANK_G.indexOf(g)}:not(.tkd)`)]
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
    if (!inR(f.getBoundingClientRect())) return null
    const om = f.querySelector<HTMLElement>('.wf-omen')
    if (om !== null && om.offsetParent !== null && inR(om.getBoundingClientRect())) return { key: 'omen' }
    for (const c of f.querySelectorAll<HTMLElement>('.wtc[data-tk], .wf-tl[data-tk]')) if (inR(c.getBoundingClientRect())) return { key: `terr:${c.dataset['tk']}` }
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
  /** 다음 합을 고르는 중인가 (합이 풀리는 중·맡긴 싸움을 보는 중이 아니고) */
  const choosing = (): boolean => t.line?.pending !== undefined && !animating && chain.length === 0
  let popG: Grp | 'lead' | undefined
  const closePop = (): void => {
    if (pop.hidden) return
    pop.hidden = true
    pop.replaceChildren()
    popG = undefined
  }
  /** 무리 곁의 깃발 판 — 아래 깃발 칸의 카드를 작게 옮겨 온다 (누르면 같은 일) */
  const openPop = (g: Grp | 'lead'): void => {
    const pane = sc.querySelector<HTMLElement>(`.wgrp[data-g="${g}"]`)
    const tab = sc.querySelector<HTMLElement>(`.wgt[data-g="${g}"]`)
    const q = groupRect('us', g)
    if (pane === null || tab === null || q === null) { closePop(); return }
    const name = tab.querySelector('.wgn b')?.textContent ?? ''
    const sub = tab.querySelector('.wgn small')?.textContent ?? ''
    pop.innerHTML = `<div class="wfph">${tab.querySelector('.wgi')?.outerHTML ?? ''}<b>${esc(name)}</b><small>${esc(sub)}</small><button class="wfpx" data-war="popx" aria-label="닫기">✕</button></div><div class="wfpg"></div>`
    const grid = pop.querySelector<HTMLElement>('.wfpg')!
    for (const b of pane.querySelectorAll<HTMLElement>('[data-war="pick"]')) {
      const c = b.cloneNode(true) as HTMLElement
      c.classList.add('mini')
      grid.appendChild(c)
    }
    pop.hidden = false
    popG = g
    window.clearTimeout(hoverT)
    hideTip()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pw = pop.offsetWidth
    const ph = pop.offsetHeight
    const left = Math.max(8, Math.min(vw - pw - 8, q.left + q.width / 2 - pw / 2))
    let top = q.bottom + 8
    if (top + ph > vh - 8) top = Math.max(8, q.top - ph - 8)
    pop.style.left = `${Math.round(left)}px`
    pop.style.top = `${Math.round(top)}px`
  }
  /** 이 합을 고른 대로 싸운다 */
  const fight = (key: string): void => {
    active = undefined
    if (cur === null || cur.key !== key) cur = { key, cmds: [] }
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
      done[cur.key] = { cmds: [...cur.cmds] }
      cur = null
    }
    draw(true)
  }
  /** 정말 물러나나 — 묻는 판 (예면 그 자리에서 퇴각) */
  const sure = document.createElement('div')
  sure.className = 'wsure'
  sure.hidden = true
  sure.innerHTML = `<div class="wsurec"><b>정말 퇴각하시겠습니까?</b><p>${esc(CMD_DOES.retreat)}</p><div class="wsureb"><button class="btn ghost" data-war="retreat-no">계속 싸운다</button><button class="btn pri wsurey" data-war="retreat-yes">퇴각한다</button></div></div>`
  ov.appendChild(sure)
  const askRetreat = (): void => { sure.hidden = false }
  let press: { x: number; y: number; timer: number; held: boolean } | null = null
  /** 꾹 눌러 정보창을 띄웠다 — 이어지는 click 하나를 삼킨다 (무리를 고르지 않는다) */
  let swallow = false
  let hoverT = 0
  ov.addEventListener('pointerdown', (ev) => {
    swallow = false // 꾹 누름 뒤 click 이 안 오는 폰도 있다 — 남은 삼킴이 다음 누름을 먹지 않게
    if (ev.pointerType === 'mouse' || (ev.target as HTMLElement).closest('.wfield') === null) return
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
    if (tg.closest('.wfield') !== null && tg.closest('[data-war]') === null && choosing()) {
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
    if (b === null) {
      // 맡긴 싸움을 풀어 보이는 중이면 끝까지 건너뛴다
      if (chain.length > 0) {
        stopChain()
        upto = undefined
        draw(true)
      }
      ov.classList.add('fast') // 아무 데나 누르면 이 합을 끝까지 바로
      clearTimers()
      flushEnd() // 끝에 닿았으면 걷힌 뿔나팔·대승 음악을 바로
      fxTop.replaceChildren()
      ov.querySelector('.wcut')?.remove()
      // 진을 되돌리는 타이머도 걷혔다 — 다음 합을 고를 판이면 바로 고르는 진으로 (재검토 10-25: 연출 상태로 굳었다)
      if (t.line?.pending !== undefined) syncField(true)
      return
    }
    const l = t.line
    if (l === null || l.key === undefined) return
    if (animating && b.dataset['war'] !== 'auto' && b.dataset['war'] !== 'next' && b.dataset['war'] !== 'help') return
    host.ding('click1', 0.18)
    switch (b.dataset['war']) {
      case 'pick': {
        // 무리마다 깃발 하나 — 같은 것을 또 누르면 내린다(맡긴다). 다시 그리되 자리는 그대로
        const g = b.dataset['g'] as Grp | 'lead'
        const c = b.dataset['c'] as Cmd
        // 퇴각은 묻고 바로 — 다른 무리를 고르고 「전투 개시」까지 누를 까닭이 없다 (형 10-25: "정말 퇴각하시겠습니까? 가 뜨고 그냥 퇴각되어야")
        if (c === 'retreat') { closePop(); hideTip(); askRetreat(); return }
        sel = { ...sel, [g]: sel[g] === c ? undefined : c }
        if (sel[g] === undefined) delete sel[g]
        // 다시 그리지 않고 고른 표만 옮긴다 — 다시 그리면 배경·그림이 깜빡였다
        for (const x of sc.querySelectorAll<HTMLElement>(`[data-war="pick"][data-g="${g}"]`)) x.classList.toggle('on', sel[g] === x.dataset['c'])
        active = g
        syncCmd()
        // 골랐으면 아직 안 고른 다음 무리로 — 깃발이 내려앉는 것을 잠깐 보고 (전장의 깃발 판에서 골랐으면 그 판도 다음 무리 곁으로)
        const fromPop = popG !== undefined
        closePop()
        hideTip()
        if (sel[g] !== undefined) {
          const order = [...sc.querySelectorAll<HTMLElement>('.wgt[data-g]')].map((x) => x.dataset['g'] as Grp | 'lead')
          const at = order.indexOf(g)
          const next = [...order.slice(at + 1), ...order.slice(0, at)].find((x) => sel[x] === undefined)
          if (next !== undefined) {
            timers.push(window.setTimeout(() => { if (active === g) { active = next; syncCmd(); if (fromPop && choosing()) openPop(next) } }, P.realm.warTabNextMs))
          } else scrollInside(sc.querySelector('[data-war="go"]'), 'center', true)
        }
        return
      }
      case 'gtab': {
        active = b.dataset['g'] as Grp | 'lead'
        syncCmd()
        return
      }
      case 'who': case 'target': {
        // 장수가 여럿 — 누가 나서나 · 누구를 잡나. 다시 그리지 않고 고른 표만 옮긴다
        const id = b.dataset['id']!
        if (b.dataset['war'] === 'who') sel = { ...sel, who: id }
        else sel = { ...sel, target: id }
        const row = b.closest('.wwho')
        if (row !== null) for (const x of row.querySelectorAll<HTMLElement>('.wfc')) x.classList.toggle('on', x === b)
        return
      }
      case 'popx': closePop(); return
      case 'help': {
        const on = ov.classList.toggle('help')
        try { localStorage.setItem(HELP_KEY, on ? '1' : '0') } catch { /* 저장이 막혀도 이번 판은 된다 */ }
        return
      }
      case 'go': {
        if ((b as HTMLButtonElement).disabled) return
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
      case 'auto': autoPlay(); return
      case 'next': {
        if (cur !== null) done[cur.key] = { cmds: [...cur.cmds] }
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
