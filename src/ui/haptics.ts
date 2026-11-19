/**
 * 폰 떨림 한 곳 (11-19 형: 「피격될 때 햅틱 필요 · 전투 승리하면 듀오링고처럼 햅틱 막 지랄 나 주면」).
 * 열전(raid)·본편(realm)·겨루기가 모두 여기로 부른다 — 끄기(본편 설정 「진동 끄기」)와 가려진 탭 막기를 한 번에 지킨다.
 *  - 아이폰 사파리는 navigator.vibrate 가 없다: 조용히 넘어간다 (오류도 글도 없음)
 *  - 탭이 가려졌거나 화면이 꺼졌으면 떨지 않는다 (절대 규칙 4)
 *  - 판 상태는 읽기만 한다: 부르는 쪽이 판의 사건(hurt · 이김)을 보고 부른다
 * 길이·패턴은 src/tune/params.ts HAPTICS · 열전 기술 계단·크리티컬은 HAEBI_FEEL_TIERS (11-19 형: 「기술 쓸 때 햅틱 · 크리티컬은 더 강하게」).
 */
import { HAPTICS as H, HAEBI_FEEL_TIERS as F, type FeelTier } from '../tune/params.ts'

export const HAPTICS_KEY = 'hanbal.realm.haptics'
type Pattern = number | readonly number[]
type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void }
/** 바깥 것 — 시험에서 갈아 끼운다 */
export interface HapticEnv {
  vibrate: ((p: number | number[]) => boolean) | null
  hidden: () => boolean
  store: () => Store | null
  now: () => number
}

function browserEnv(): HapticEnv {
  const nav = typeof navigator === 'undefined' ? null : navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
  return {
    vibrate: nav !== null && typeof nav.vibrate === 'function' ? (p) => nav.vibrate!(p) : null,
    hidden: () => typeof document !== 'undefined' && document.visibilityState !== 'visible',
    store: () => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } },
    now: () => typeof performance === 'undefined' ? Date.now() : performance.now(),
  }
}

/** 잃은 몫(최대 체력 대비 0~1) → 떨 길이 ms (H.hurt 사이 · H.hurtFull 에서 가장 길게) */
export function hurtMs(share: number): number {
  const [lo, hi] = H.hurt, k = Math.max(0, Math.min(1, (Number.isFinite(share) ? share : 0) / H.hurtFull))
  return Math.round(lo + (hi - lo) * k)
}
/** 이김 패턴 — big: 대승(몰아냄) */
export const winPattern = (big = false): readonly number[] => big ? H.bigWin : H.win

/** 기술 계단 패턴 (HAEBI_FEEL_TIERS) — 비기 한 번 · 각성 두 박 · 진각성 세 박 길게 */
export const skillPattern = (tier: FeelTier): readonly number[] => F.tiers[tier].buzz
const total = (p: readonly number[]) => p.reduce((a, b) => a + b, 0)

export function makeHaptics(env: HapticEnv = browserEnv()) {
  let hurtAt = -Infinity, critAt = -Infinity, skillUntil = -Infinity
  const on = (): boolean => { try { return env.store()?.getItem(HAPTICS_KEY) !== '0' } catch { return true } }
  /** 낸다 — 냈으면 true (끔 · 없는 기기 · 가려진 탭이면 false) */
  const buzz = (p: Pattern): boolean => {
    if (env.vibrate === null || !on() || env.hidden()) return false
    try { return env.vibrate(typeof p === 'number' ? p : [...p]) } catch { return false }
  }
  return {
    /** 이 기기가 떨 수 있나 — 없으면(아이폰) 설정 단추도 숨긴다 */
    can: (): boolean => env.vibrate !== null,
    on,
    set(v: boolean): void { try { env.store()?.setItem(HAPTICS_KEY, v ? '1' : '0') } catch { /* 저장이 막힌 창 */ } },
    buzz,
    /** 맞았다 — 잃은 몫만큼 짧게 · 연타는 H.hurtGap ms 사이를 둔다 */
    hurt(share: number): boolean {
      const now = env.now()
      if (now - hurtAt < H.hurtGap) return false
      const ok = buzz(hurtMs(share))
      if (ok) hurtAt = now
      return ok
    },
    /** 기술이 터졌다 — 계단마다 길게 (열전 비기·각성·진각성) · 도는 동안은 크리티컬이 끊지 않는다 */
    skill(tier: FeelTier): boolean {
      const p = skillPattern(tier), ok = buzz(p)
      if (ok) skillUntil = env.now() + total(p)
      return ok
    },
    /** 크리티컬 — 짧고 날카롭게 한 번 · 몰려도 F.crit.buzzGap ms 사이 · 기술 떨림이 도는 중이면 건너뜀 */
    crit(): boolean {
      const now = env.now()
      if (now - critAt < F.crit.buzzGap || now < skillUntil) return false
      const ok = buzz(F.crit.buzz)
      if (ok) critAt = now
      return ok
    },
    /** 이겼다 — 다다닥 (듀오링고) */
    win: (big = false): boolean => buzz(winPattern(big)),
  }
}
export type Haptics = ReturnType<typeof makeHaptics>
/** 문서에 하나 */
let shared: Haptics | null = null
export const haptics = (): Haptics => shared ??= makeHaptics()
