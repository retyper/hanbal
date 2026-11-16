/**
 * 장수 열전의 판 밖 기록 — 금 · 상점 영구 강화 · 스테이지 휘장 (형 11-16: 다이센카식 「돈을 모아 상점에서 사서 새 판마다 기본 능력치가 자란다
 * · 중간 패배는 조금, 다 깨면 많이 · 스테이지를 깨면 휘장」). 본편 저장(hanbal.realm.*)과 따로인 한 칸.
 * 상점 값은 언제든 전부 되돌려 받는다 (다이센카와 같이).
 */
import { HAEBI_SHOP as SH, HAEBI_STAGES as ST } from '../tune/params.ts'
import { NO_BONUS, type Bonus, type StageId } from './haebi.ts'
import { META_KEY } from './link.ts'
import { DLC } from '../realm/dlc.ts'

export type ShopKey = keyof Bonus
export const SHOP: readonly { key: ShopKey; name: string; glyph: string; desc: (lv: number) => string }[] = [
  { key: 'might', name: '힘', glyph: '力', desc: lv => `모든 공격 피해 +${Math.round(lv * SH.might.step * 100)}%` },
  { key: 'vigor', name: '체력', glyph: '體', desc: lv => `최대 체력 +${lv * SH.vigor.step}` },
  { key: 'armor', name: '갑옷', glyph: '甲', desc: lv => `받는 피해 −${lv * SH.armor.step}` },
  { key: 'regen', name: '회복', glyph: '癒', desc: lv => `초마다 체력 +${(lv * SH.regen.step).toFixed(1)}` },
  { key: 'haste', name: '손놀림', glyph: '迅', desc: lv => `공격 속도 +${Math.round(lv * SH.haste.step * 100)}%` },
  { key: 'swift', name: '발놀림', glyph: '足', desc: lv => `이동 속도 +${Math.round(lv * SH.swift.step * 100)}%` },
  { key: 'magnet', name: '끌어오기', glyph: '引', desc: lv => `기세 줍는 거리 +${Math.round(lv * SH.magnet.step * 100)}%` },
  { key: 'wisdom', name: '깨달음', glyph: '智', desc: lv => `기세 얻는 양 +${Math.round(lv * SH.wisdom.step * 100)}%` },
  { key: 'revive', name: '부활', glyph: '魂', desc: lv => `쓰러지면 ${lv}번 다시 일어남` },
  { key: 'reroll', name: '다시 고르기', glyph: '擲', desc: lv => `판마다 다시 고르기 +${lv}번` },
  { key: 'greed', name: '전리품', glyph: '金', desc: lv => `판이 끝나고 받는 금 +${Math.round(lv * SH.greed.step * 100)}%` },
  { key: 'luck', name: '급소', glyph: '運', desc: lv => `${Math.round(lv * SH.luck.step * 100)}% 확률로 두 배 피해` },
]
/** 본편 스테이지 셋 + 진각성 묶음(DLC)의 둘 (realm/dlc.ts) */
export const STAGE_ORDER: readonly Exclude<StageId, 'trial'>[] = ['forest', 'ford', 'palisade', ...(DLC.trueWake ? ['snow', 'fortress'] as const : [])]
export interface RaidMeta { gold: number; spent: number; shop: Bonus; cleared: Partial<Record<StageId, boolean>>; best: Partial<Record<StageId, number>>; runs: number
  /** 장수마다 깬 스테이지 — 본편 진각성 자격 (link.ts SEAL_STAGE) */
  heroes: Record<string, StageId[]> }
const KEY = META_KEY
const fresh = (): RaidMeta => ({ gold: 0, spent: 0, shop: { ...NO_BONUS }, cleared: {}, best: {}, runs: 0, heroes: {} })

/** 다음 단계 값 — 단계가 오를수록 비싸진다 */
export const shopCost = (key: ShopKey, lv: number) => Math.round(SH[key].cost * (lv + 1) ** SH.growth)
export const shopMax = (key: ShopKey) => SH[key].max
/** 깨야 열리는 스테이지 — 앞 스테이지를 깨면 다음이 열린다 */
export const stageOpen = (m: RaidMeta, id: Exclude<StageId, 'trial'>) => { const i = STAGE_ORDER.indexOf(id); return i <= 0 || !!m.cleared[STAGE_ORDER[i - 1]!] }
export const stageName = (id: StageId) => ST[id].name

export function loadMeta(): RaidMeta {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return fresh()
    const m = JSON.parse(raw) as Partial<RaidMeta>
    const shop = { ...NO_BONUS }
    for (const k of Object.keys(shop) as ShopKey[]) shop[k] = Math.max(0, Math.min(shopMax(k), Math.floor(Number(m.shop?.[k] ?? 0)) || 0))
    return { gold: Math.max(0, Math.floor(Number(m.gold) || 0)), spent: Math.max(0, Math.floor(Number(m.spent) || 0)), shop, cleared: m.cleared ?? {}, best: m.best ?? {}, runs: Math.max(0, Number(m.runs) || 0), heroes: cleanHeroes(m.heroes) }
  } catch { return fresh() }
}
export function saveMeta(m: RaidMeta) { try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* 사생활 창 등 — 이번 판만 */ } }

export function buy(m: RaidMeta, key: ShopKey) {
  const lv = m.shop[key]; if (lv >= shopMax(key)) return false
  const cost = shopCost(key, lv); if (m.gold < cost) return false
  m.gold -= cost; m.spent += cost; m.shop[key] = lv + 1; return true
}
/** 산 것을 모두 되돌린다 — 쓴 금을 전부 돌려받는다 */
export function refund(m: RaidMeta) { m.gold += m.spent; m.spent = 0; m.shop = { ...NO_BONUS } }
const cleanHeroes = (x: unknown): Record<string, StageId[]> => {
  const out: Record<string, StageId[]> = {}
  if (x && typeof x === 'object') for (const [id, s] of Object.entries(x)) if (Array.isArray(s)) out[id] = s.filter((v): v is StageId => typeof v === 'string' && v in ST)
  return out
}
/** 판 결과를 적는다 — 받은 금 · 깸(휘장 · 그 장수의 깸) · 가장 오래 버틴 시간. 새로 휘장을 받았으면 first, 이 장수로 처음 깼으면 heroFirst */
export function record(m: RaidMeta, stage: StageId, gold: number, won: boolean, seconds: number, hero?: string) {
  m.gold += gold; m.runs++
  m.best[stage] = Math.max(m.best[stage] ?? 0, Math.floor(seconds))
  const first = won && !m.cleared[stage]
  if (won) m.cleared[stage] = true
  const mine = won && hero !== undefined ? (m.heroes[hero] ??= []) : null
  const heroFirst = mine !== null && !mine.includes(stage)
  if (heroFirst) mine.push(stage)
  return { first, heroFirst }
}
