/**
 * 유물 — 옛 무덤의 껴묻거리 (docs/realm/HERO-GROWTH.md ★ 둘째 판 §B · 형 10-26: "한반도 그 시절 출토 유물로 … 삼국시대까지 넓혀야겠지?").
 *
 *   판을 이기면 상자 셋 가운데 하나를 고른다 — 상자는 판의 땅이 정한다 (REGION_TAGS). 장수가 몸에 지닌다(무기 아님 · 지닌 것).
 *   출토지는 실제, 효과는 게임 것. 이름은 우리 박물관이 부르는 이름으로 (한국 중심 · 동북공정 틀 금지 메모).
 *   그림은 `public/realm/relic/<id>.png` (160 칸 투명) — 상자는 chest-common · chest-rare · chest-legend, 쌓인 껴묻거리는 loot.
 *
 * 효과는 데이터다 — 판(realm/relics.ts)이 읽는다. 숫자는 params 의 relic* 손잡이에만 둔다 (by 가 그 이름).
 * soon 은 아직 판에 안 걸린 것 — 끼울 수는 있고 「곧 쓰인다」로 보인다.
 */
import type { GrowStat, RegionId } from '../types.ts'

/** 귀함 — 상자의 겉빛 (흔함 나무 · 귀함 청동 · 보배 금) */
export type RelicTier = 'common' | 'rare' | 'legend'
export const TIER_NAME: Readonly<Record<RelicTier, string>> = { common: '흔함', rare: '귀함', legend: '보배' }
export const TIER_CHEST: Readonly<Record<RelicTier, string>> = { common: 'chest-common', rare: 'chest-rare', legend: 'chest-legend' }

/** 유물이 난 겨레 — 판의 땅과 맞춘다 */
export type RelicFolk = 'gojoseon' | 'buyeo' | 'goguryeo' | 'mahan' | 'jinbyeon' | 'gaya' | 'silla' | 'baekje'

/** 손잡이 이름 — params 의 relic* 가운데 숫자 하나 */
export type RelicKnob =
  | 'relicStat' | 'relicRoom' | 'relicMorale' | 'relicBondMul' | 'relicIron' | 'relicCheonmaHorse' | 'relicRiderHorse'
  | 'relicFarm' | 'relicCrown' | 'relicHouEnvoy' | 'relicBrushEnvoy' | 'relicDaggerDuel' | 'relicBipaDuel'

/**
 * 지니면 — 판이 읽는 효과 하나.
 *   stat  판을 열 때 그 능력치 + (단련 그릇 위에 얹는다 — 그릇을 먹지 않는다)
 *   room  단련 그릇 + (단련터에서 더 올릴 수 있다)
 *   morale 이끄는 군대 사기 + · horse 이끄는 기병 힘 × · bond 정이 오를 때 × · iron 맡은 고을 철 +/계절 · farm 맡은 고을 수확 +
 *   crown 군주가 지니면 나라 모든 고을 수확 + · envoy 따라간 사신이 받아들여질 몫 + · duel 겨루기 무예 +
 *   soon  아직 판에 안 걸렸다 — 글만
 */
export type RelicFx =
  | { readonly kind: 'stat' | 'room'; readonly stat: GrowStat; readonly by: RelicKnob }
  | { readonly kind: 'morale' | 'horse' | 'bond' | 'iron' | 'farm' | 'crown' | 'envoy' | 'duel'; readonly by: RelicKnob }
  | { readonly kind: 'soon'; readonly text: string }

export interface RelicDef {
  readonly id: string
  readonly name: string
  /** 시대 · 출토 한 줄 */
  readonly era: string
  readonly tier: RelicTier
  readonly folk: readonly RelicFolk[]
  readonly fx: readonly RelicFx[]
}

const stat = (s: GrowStat): RelicFx => ({ kind: 'stat', stat: s, by: 'relicStat' })
const room = (s: GrowStat): RelicFx => ({ kind: 'room', stat: s, by: 'relicRoom' })
const soon = (text: string): RelicFx => ({ kind: 'soon', text })

/** 스물넷 — HERO-GROWTH §B 의 표 · 비파형동검 · 세형동검 · 다호리 붓은 뒤에 더했다 */
export const RELICS: readonly RelicDef[] = [
  { id: 'mirror', name: '잔무늬거울', era: '청동기 · 화순 대곡리', tier: 'legend', folk: ['gojoseon', 'mahan'], fx: [soon('진중 굿을 쓸 수 있다 · 굿의 사기 +50%')] },
  { id: 'eightbell', name: '팔주령', era: '청동기 · 화순 대곡리', tier: 'rare', folk: ['gojoseon', 'mahan'], fx: [soon('지는 합에서 사기가 덜 꺾인다')] },
  { id: 'polebell', name: '간두령', era: '초기철기 · 함평 초포리', tier: 'common', folk: ['gojoseon', 'mahan', 'jinbyeon'], fx: [{ kind: 'morale', by: 'relicMorale' }] },
  { id: 'farmplaque', name: '농경문 청동기', era: '청동기 · 대전 출토 전', tier: 'rare', folk: ['mahan'], fx: [{ kind: 'farm', by: 'relicFarm' }] },
  { id: 'gogok', name: '굽은옥', era: '삼한~삼국 · 곳곳', tier: 'common', folk: ['mahan', 'jinbyeon', 'gaya', 'silla', 'baekje', 'goguryeo'], fx: [{ kind: 'bond', by: 'relicBondMul' }] },
  { id: 'beads', name: '마한 유리구슬 목걸이', era: '원삼국 · 마한 무덤', tier: 'common', folk: ['mahan', 'baekje'], fx: [stat('deok')] },
  { id: 'ingots', name: '덩이쇠 묶음', era: '가야 · 김해 대성동', tier: 'common', folk: ['gaya', 'jinbyeon'], fx: [{ kind: 'iron', by: 'relicIron' }] },
  { id: 'duck', name: '오리모양 토기', era: '원삼국 · 진한·변한', tier: 'common', folk: ['jinbyeon', 'gaya', 'silla'], fx: [soon('쓰러져도 한 번은 빠져나온다')] },
  { id: 'wheelcup', name: '수레바퀴모양 토기', era: '가야 · 함안', tier: 'rare', folk: ['gaya'], fx: [soon('이끄는 군대 행군이 한 길 빠르다')] },
  { id: 'rider', name: '기마인물형 토기', era: '신라 · 경주 금령총', tier: 'rare', folk: ['silla'], fx: [{ kind: 'horse', by: 'relicRiderHorse' }] },
  { id: 'horncup', name: '말머리 뿔잔', era: '가야 · 김해', tier: 'common', folk: ['gaya'], fx: [soon('호궤 값이 절반')] },
  { id: 'cheonma', name: '천마도 말다래', era: '신라 · 경주 천마총', tier: 'legend', folk: ['silla'], fx: [{ kind: 'horse', by: 'relicCheonmaHorse' }, room('mu')] },
  { id: 'crown', name: '신라 금관', era: '신라 · 경주 황남대총', tier: 'legend', folk: ['silla'], fx: [{ kind: 'crown', by: 'relicCrown' }] },
  { id: 'goldbelt', name: '금제 허리띠', era: '신라 · 경주 황남대총', tier: 'rare', folk: ['silla'], fx: [stat('tong')] },
  { id: 'earring', name: '굵은고리 금귀걸이', era: '신라 · 경주 보문동', tier: 'common', folk: ['silla'], fx: [soon('회유 저항이 빨리 깎인다')] },
  { id: 'dagger', name: '계림로 장식 보검', era: '신라 · 경주 계림로', tier: 'legend', folk: ['silla'], fx: [{ kind: 'duel', by: 'relicDaggerDuel' }] },
  { id: 'houbowl', name: '호우명 그릇', era: '고구려 → 신라 · 경주 호우총', tier: 'rare', folk: ['goguryeo', 'silla'], fx: [{ kind: 'envoy', by: 'relicHouEnvoy' }] },
  { id: 'incense', name: '백제 금동대향로', era: '백제 · 부여 능산리 절터', tier: 'legend', folk: ['baekje'], fx: [soon('큰 제사 길 한 계단 덤 · 무당 핏줄처럼 눈뜬다')] },
  { id: 'crownflame', name: '무령왕 금제 관꾸미개', era: '백제 · 공주 무령왕릉', tier: 'rare', folk: ['baekje'], fx: [stat('ryak')] },
  { id: 'guardian', name: '진묘수', era: '백제 · 공주 무령왕릉', tier: 'legend', folk: ['baekje'], fx: [soon('지키는 고을이 첫 공격을 한 번 막는다')] },
  { id: 'shoes', name: '금동신발', era: '마한·백제 · 나주 정촌', tier: 'rare', folk: ['mahan', 'baekje'], fx: [soon('공작이 들킬 몫 −30%')] },
  { id: 'bipa', name: '비파형동검', era: '고조선 · 청동기 · 부여 송국리', tier: 'rare', folk: ['gojoseon', 'buyeo'], fx: [{ kind: 'duel', by: 'relicBipaDuel' }, room('tong')] },
  { id: 'sehyeong', name: '세형동검', era: '초기철기 · 한반도 곳곳', tier: 'common', folk: ['gojoseon', 'mahan', 'jinbyeon'], fx: [stat('mu')] },
  { id: 'brush', name: '다호리 붓', era: '원삼국 · 창원 다호리', tier: 'rare', folk: ['jinbyeon', 'gaya'], fx: [stat('chi'), { kind: 'envoy', by: 'relicBrushEnvoy' }] },
]

export const RELIC: Readonly<Record<string, RelicDef>> = Object.fromEntries(RELICS.map((x) => [x.id, x]))

/** 판의 땅 → 상자에 드는 겨레 — 낙동강은 가야·신라 · 삼한은 마한·백제 · 북녘은 고구려·부여·고조선 · 쇠의 바다는 변한·가야 · 배우는 판은 없다 */
export const REGION_TAGS: Readonly<Record<RegionId, readonly RelicFolk[]>> = {
  tutorial: [],
  yeongnam: ['gaya', 'silla', 'jinbyeon'],
  seorabeol: ['silla', 'jinbyeon'],
  south: ['mahan', 'baekje'],
  mahan: ['mahan', 'baekje'],
  world: ['goguryeo', 'buyeo', 'gojoseon'],
  jumong: ['goguryeo', 'buyeo', 'gojoseon'],
  'byeonhan-mini': ['jinbyeon', 'gaya'],
}

/** 그 판의 상자에 들 수 있는 유물 — 표 차례 */
export function poolOf(region: RegionId): RelicDef[] {
  const tags = REGION_TAGS[region] ?? []
  return RELICS.filter((x) => x.folk.some((f) => tags.includes(f)))
}
