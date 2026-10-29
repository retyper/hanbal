/**
 * 군막의 말 — 행군 화면의 길 단추 위에 그 길을 권하는 장수의 얼굴과 한 줄 (docs/realm/COUNCIL.md 위원회 결정 · 1주 조각 ②).
 *
 * 앉는 사람은 둘 — 그 군대를 이끄는 장수와, 그 밖에 지략이 가장 높은 우리 장수. 저마다 길 하나를 권하고 적이 지킬 길목을 읽는다.
 * 지략이 cnReadRyak 밑이면 짚지 않고 모르겠다고 한다 (틀리게 말하지 않는다 — 정보의 계약 · 2라운드 결정).
 * 특성이 먼저 말한다(산사람 → 산기슭 · 물길잡이 → 여울 · 밤눈 → 밤길 · 거친 결이나 무예 8 → 대로), 아니면 읽은 대로 가장 잘 숨는 길.
 * 글만 고르고 판에는 손대지 않는다. 이름 뒤 조사 없음 (josa 규칙).
 */
import { guardAdjust, guardWeights } from '../../realm/council.ts'
import type { ApproachMove } from '../../realm/estimate.ts'
import { hasTrait, isRuler } from '../../realm/heroes.ts'
import type { Approach, Army, Hero, Realm } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { voiceKind, type VoiceKind } from './voice.ts'

export interface Advice {
  readonly hero: Hero
  readonly ap: Approach
  /** 적이 지킬 것 같은 길목 — 모르면 null */
  readonly read: Approach | null
  /** 권하는 말 · 읽은 말 */
  readonly say: string
  readonly readSay: string
}

/** 결마다 · 길마다 권하는 말 */
const SAY: Readonly<Record<VoiceKind, Readonly<Record<Approach, string>>>> = {
  'm-gruff': { road: '정면으로 밀어붙이면 됩니다!', night: '밤에 들이쳐 목을 따 버립시다.', ford: '강쯤이야 헤엄쳐 건너면 그만이오!', ridge: '산을 넘어 뒤통수를 칩시다.', cliff: '절벽? 내가 맨 먼저 오르겠소!' },
  'm-young': { road: '당당히 대로로 가시지요!', night: '어둠을 타면 들키지 않을 겁니다!', ford: '갈대에 숨어 여울을 건너 보겠습니다!', ridge: '산기슭으로 돌면 뒤를 잡을 수 있습니다!', cliff: '날랜 이들만 데리고 절벽을 오르겠습니다!' },
  'm-sage': { road: '숨을 곳이 없으니 차라리 떳떳이 가시오.', night: '밤길이 가장 덜 보일 것이오.', ford: '여울은 갈대가 가려 주니 셈이 맞소.', ridge: '한 계절 늦더라도 산기슭이 안전하오.', cliff: '절벽은 저들이 설마 하는 곳이오.' },
  'm-elder': { road: '젊은 혈기로 숨지 말고 대로로 가세.', night: '이 늙은이 경험으론 밤이 낫네.', ford: '옛날에도 이 여울로 건넜지.', ridge: '서두르지 말고 산을 돌아가세.', cliff: '위험하지만 해 볼 만한 절벽일세.' },
  'm-charm': { road: '대로로 가서 깃발을 보여 줍시다. 겁먹을 거요.', night: '밤손님처럼 살짝 들어가 봅시다.', ford: '물길로 가면 아무도 모를 거요.', ridge: '산기슭 경치도 볼 겸 돌아갑시다.', cliff: '절벽 위에서 깃발을 흔들면 볼만하겠소.' },
  'w-bright': { road: '그냥 대로로 가요! 우리가 더 세잖아요!', night: '밤에 몰래 가요, 깜짝 놀라게!', ford: '여울로 건너요, 갈대가 숨겨 줄 거예요!', ridge: '산으로 돌아가요, 뒤에서 놀래 주게!', cliff: '절벽, 제가 먼저 오를게요!' },
  'w-cool': { road: '대로. 그걸로 충분하다.', night: '밤길. 소리 내지 마라.', ford: '여울로 건넌다. 갈대가 가린다.', ridge: '산기슭으로 돈다. 뒤를 친다.', cliff: '절벽을 오른다. 적은 거기를 안 본다.' },
  'w-sly': { road: '대로로 가는 척만 해도 저들은 겁먹을걸요.', night: '밤이 제일 싸게 먹히죠.', ford: '여울 쪽 문지기는 졸기로 소문났어요.', ridge: '산기슭으로 돌면 뒷문이 비어 있을 거예요.', cliff: '절벽이요? 설마 하는 데가 제일 허술하죠.' },
  'w-shaman': { road: '신령께서 떳떳이 가라 하시오.', night: '달이 숨는 밤이 길하오.', ford: '물의 신이 길을 열어 줄 것이오.', ridge: '산신께 빌고 산을 돌아가시오.', cliff: '높은 곳의 신령이 손을 잡아 줄 것이오.' },
}

/** 적이 지킬 길목을 읽은 말 */
const READ_SAY: Readonly<Record<Approach, string>> = {
  road: '적은 대로를 막고 있을 겁니다',
  night: '적은 밤 경계를 세게 설 겁니다',
  ford: '적은 여울목을 지킬 겁니다',
  ridge: '적은 산기슭을 지킬 겁니다',
  cliff: '적은 절벽 위를 지킬 겁니다',
}
const READ_NONE = '적이 어디를 지킬지는 모르겠습니다'
/** 읽은 길목으로 그래도 가자고 할 때 */
const READ_BUT: Readonly<Record<Approach, string>> = {
  road: '적이 대로를 막겠지만 밀어붙일 만합니다',
  night: '적이 밤 경계를 서겠지만 해 볼 만합니다',
  ford: '적이 여울목을 지키겠지만 해 볼 만합니다',
  ridge: '적이 산기슭을 지키겠지만 해 볼 만합니다',
  cliff: '적이 절벽 위를 지키겠지만 해 볼 만합니다',
}

/** 지키는 쪽의 장수 — 그 고을에 선 적 군대 가운데 지략이 가장 높은 이 */
function foeCmd(r: Realm, to: string, def: string): Hero | null {
  const hs = Object.values(r.armies).filter((x) => x.at === to && x.march === null && x.faction === def && x.hero !== null).map((x) => r.heroes[x.hero!]).filter((h): h is Hero => h !== undefined)
  return hs.sort((x, y) => y.ryak - x.ryak || (x.id < y.id ? -1 : 1))[0] ?? null
}

/** 이 장수가 마음에 둔 길 — 특성이 먼저, 아니면 읽은 대로 가장 잘 숨는 길 */
function wantOf(h: Hero, moves: readonly ApproachMove[], read: Approach | null): Approach {
  const has = (ap: Approach): boolean => moves.some((x) => x.ap === ap)
  // 읽은 대로 숨어 닿을 가망 — 대로는 숨지 않으니 셈하지 않는다
  const q = (ap: Approach): number => {
    const x = moves.find((y) => y.ap === ap)
    return x === undefined || ap === 'road' ? 0 : read === null ? x.p : guardAdjust(x.p, ap, read)
  }
  // 특성이 먼저 말한다 — 다만 그 길이 거의 막혔으면(가망이 cnAdviseMin 밑) 고집하지 않는다
  const fits = (ap: Approach): boolean => has(ap) && q(ap) >= P.realm.cnAdviseMin
  if (hasTrait(h, 'mountain') && fits('ridge')) return 'ridge'
  if (hasTrait(h, 'river') && fits('ford')) return 'ford'
  if (hasTrait(h, 'nighteye') && fits('night')) return 'night'
  if ((voiceKind(h) === 'm-gruff' || h.mu >= 8) && has('road')) return 'road'
  let best: Approach | null = null
  let bp = -1
  for (const x of moves) {
    if (x.ap === 'road') continue
    if (q(x.ap) > bp) { bp = q(x.ap); best = x.ap }
  }
  return best !== null && bp >= P.realm.cnAdviseMin ? best : has('road') ? 'road' : (best ?? 'road')
}

/** 군막에 앉은 둘의 말 — 적 고을을 칠 때만 (빈 땅·소도면 빈 배열) */
export function adviseMarch(r: Realm, me: string, a: Army, to: string, moves: readonly ApproachMove[]): Advice[] {
  const def = r.nodes[to]?.owner ?? null
  if (def === null || def === me || moves.length < 2) return []
  const lead = a.hero !== null ? r.heroes[a.hero] : undefined
  const others = Object.values(r.heroes)
    .filter((h) => h.faction === me && h.status === 'free' && h.id !== lead?.id && !isRuler(r, h.id))
    .sort((x, y) => y.ryak - x.ryak || (x.id < y.id ? -1 : 1))
  const seats = [lead ?? others[0], lead !== undefined ? others[0] : others[1]].filter((h): h is Hero => h !== undefined)
  if (seats.length === 0) return []
  const ws = guardWeights(r, to, def, me, foeCmd(r, to, def))
  const top = ws.length > 1 ? [...ws].sort((x, y) => y.w - x.w)[0]!.ap : null
  const out: Advice[] = []
  for (const h of seats) {
    const read = h.ryak >= P.realm.cnReadRyak ? top : null
    const ap = wantOf(h, moves, read)
    // 뜻이 같으면 한 사람만 말한다 — 갈리지 않으면 회의가 아니라 알림이다 (위원회)
    if (out.some((v) => v.ap === ap)) continue
    out.push({ hero: h, ap, read, say: SAY[voiceKind(h)][ap], readSay: read === null ? READ_NONE : read === ap ? READ_BUT[read] : READ_SAY[read] })
  }
  return out
}

/** 숨어 닿을 가망의 범위 — 읽힌 때와 비켜 간 때 (ODDS 원칙 1: 남의 속이 섞이면 범위) */
export const guardRange = (p: number, ap: Approach): readonly [number, number] => {
  // 절벽은 오를 가망이라 0~1 안에서 (season.fight 와 같게)
  if (ap === 'cliff') return [Math.max(0, p - P.realm.cnWatchHit), Math.min(1, p + P.realm.cnWatchMiss)]
  return [guardAdjust(p, ap, ap), guardAdjust(p, ap, ap === 'road' ? 'night' : 'road')]
}
