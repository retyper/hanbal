/**
 * 저장 (ARCHITECTURE A4)
 *
 * localStorage 단일 키. 이 파일의 규칙은 하나다: **세이브를 절대 깨뜨리지 않는다.**
 *  - 저장이 실패해도(프라이빗 모드·용량 초과) 게임은 그대로 돈다. 예외를 밖으로 내보내지 않는다.
 *  - 손상된 JSON·다른 타입·NaN이 들어와도 크래시하지 않고 기본값으로 복구한다.
 *  - 스키마 버전 마이그레이션 체인으로만 올린다. 필드를 지우지 않는다.
 *
 * Date.now()는 game 레이어라 써도 된다. **sim으로는 절대 넘기지 않는다** (A1).
 */
import { clamp } from '../core/math.ts'
import type { Stats } from '../sim/types.ts'
import { P } from '../tune/params.ts'
import { DEFAULT_BOW, isBowKindId, type BowKindId } from './bows.ts'
import { STAGES } from './stages.ts'

/** ARCHITECTURE A4가 지정한 단일 키. */
const KEY = 'hanbal.save.v1'

/** 현재 스키마 버전. 필드를 바꿀 때마다 +1 하고 MIGRATIONS에 한 줄 추가한다. */
export const SCHEMA_VERSION = 3

/**
 * 오프라인 축적의 소수부 (자원 단위). 세 자원의 축적 속도가 달라 하나로 합칠 수 없다.
 *
 * 왜 필요한가: 이 게임은 탭을 자주 오간다. 매번 floor로 잘라 버리면
 * 40초씩 스무 번 자리를 비운 사람은 화살을 한 발도 못 받는다 — C4가 무너진다.
 * 못 채운 시간을 여기 남겨 다음 정산으로 넘긴다.
 */
export interface Carry {
  arrows: number
  training: number
  requests: number
}

export interface SaveData {
  /** 스키마 버전. 마이그레이션 필수 (A4) */
  v: number
  stats: Stats
  /** 미사용 훈련치 */
  training: number
  /** 남은 화살 (오프라인 축적분) */
  arrows: number
  requests: number
  /** 진행 중인 판 */
  stageIndex: number
  bestScore: Record<string, number>
  /** wallclock ms — 오프라인 정산용 */
  lastSeen: number
  offlineEnabled: boolean
  totalShots: number
  totalHits: number
  carry: Carry

  // ── v2: 별·해금·누적 기록 (docs/HOOK.md ★2 ★3 ★4) ────────────────────
  /**
   * 판별 최고 별 (stage.id → 0..3). **줄지 않는다** — 다시 해서 못 받아도 가진 별은 남는다.
   * 해금 조건이 읽는 totalStars의 출처라, 여기가 줄면 열린 칸이 잠긴 것처럼 보인다.
   */
  stars: Record<string, number>
  /** 열린 해금 항목 id (game/unlocks.ts UNLOCKS). */
  unlocked: string[]
  /** 한 판에서 이어간 최고 연쇄 수 (누적 최댓값) */
  bestChain: number

  // ── v3: 활 (docs/BOWS.md) ────────────────────────────────────
  /** 장착한 활. 판 경계에서 game/bows.ts 가 BowMods 로 구워 sim 에 넣는다. */
  bow: BowKindId
  /**
   * 활별 누적 명중 — 숙련의 재료. **줄지 않는다** (GDD 4장 "성장은 되돌아가지 않는다").
   * 활 id 가 키다. 모르는 키도 지우지 않는다 (A4).
   */
  bowHits: Record<string, number>
  /** 누적 정중앙 명중 수 */
  bullseyes: number
  /** 누적 무손실 클리어 판수 */
  perfectRuns: number
  /**
   * 판 보상·드래프트가 쓰는 난수 스트림의 상태.
   *
   * 스테이지 시드를 쓰면 안 된다 — 같은 판을 다시 깰 때 3택과 보너스가 똑같이 나와
   * 대박이 나오는 판만 반복하는 구멍이 생긴다. 판마다 앞으로 나아가고 여기 남는다.
   * sim의 w.rng와는 완전히 별개의 스트림이다 (A1: sim 결과는 시드에만 달려 있어야 한다).
   */
  runSeed: number
}

/** 저장값이 말이 되는 범위인지만 본다. 치트 방지가 아니라 NaN·Infinity 방어다 (A4: 치트 방지 안 함). */
const HARD_MAX = 1e9
/** 손상된 세이브가 무한히 키를 늘리는 것만 막는다. 판 수보다 훨씬 넉넉하다. */
const BEST_SCORE_MAX_KEYS = 1000
/** 같은 이유의 해금 목록 상한. 실제 항목은 14개다. */
const UNLOCK_MAX_KEYS = 500
/** 별의 상한. game/rewards.ts의 STAR_MAX와 같은 값이며, 저장 계층이 game을 import하지 않으려고 여기 둔다. */
const STAR_MAX = 3

// ─────────────────────────── 값 정화 ───────────────────────────

const num = (v: unknown, def: number, lo: number, hi: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : def

const int = (v: unknown, def: number, lo: number, hi: number): number =>
  Math.floor(num(v, def, lo, hi))

const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def)

const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

export function defaultSave(now: number): SaveData {
  return {
    v: SCHEMA_VERSION,
    // 활 한 번 안 잡아본 스틱맨이다 (GDD 0장). 전부 0에서 시작한다.
    stats: { str: 0, steady: 0, stamina: 0, focus: 0 },
    training: 0,
    // 처음 켠 사람에게 주는 화살. 0으로 시작하면 첫 탭에서 아무것도 못 쏜다 — C1 위반.
    arrows: Math.floor(P.progression.startArrows),
    requests: 0,
    stageIndex: 0,
    bestScore: {},
    lastSeen: now,
    offlineEnabled: true,
    totalShots: 0,
    totalHits: 0,
    carry: { arrows: 0, training: 0, requests: 0 },
    stars: {},
    unlocked: [],
    bestChain: 0,
    bow: DEFAULT_BOW,
    bowHits: {},
    bullseyes: 0,
    perfectRuns: 0,
    // 0은 "아직 없음"이다. 루프가 첫 정산 전에 실제 시드를 심는다 (game 레이어라 Date.now 허용).
    runSeed: 0,
  }
}

type Raw = Record<string, unknown>

/**
 * 마이그레이션 체인. MIGRATIONS[n]은 버전 n → n+1 을 올린다.
 * 필드를 **지우지 않는다.** 모르는 필드는 그대로 둔다 — 되돌릴 여지를 남긴다.
 */
const MIGRATIONS: ReadonlyArray<(r: Raw) => void> = [
  // v0 → v1: M1에는 세이브가 없었다. 빈 객체에서 올라오는 경로이며,
  // 빠진 필드는 전부 sanitize가 기본값으로 채운다.
  () => {},

  /**
   * v1 → v2: 별·해금·누적 기록이 생겼다.
   *
   * 빈 값으로 올리면 20판까지 온 사람이 **화살을 하나도 못 가진 채** 시작한다 —
   * 해금이 전부 "판 클리어 수"에 걸려 있는데 그 기록이 없기 때문이다. 그건 세이브를
   * 깨뜨리는 것과 같다 (A4). 이미 지나온 판은 깨서 지나온 것이므로(loop는 클리어에서만
   * stageIndex를 올린다) **판당 별 1개**로 되살린다. 2·3번째 별은 다시 받으면 된다.
   */
  (r) => {
    if (r['stars'] !== undefined) return
    const upto = typeof r['stageIndex'] === 'number' && Number.isFinite(r['stageIndex'])
      ? Math.floor(r['stageIndex'])
      : 0
    const stars: Record<string, number> = {}
    for (let i = 0; i < upto && i < STAGES.length; i++) {
      const s = STAGES[i]
      if (s !== undefined) stars[s.id] = 1
    }
    r['stars'] = stars
  },

  /**
   * v2 → v3: 활이 생겼다. 기존 유저는 연습궁을 든 채로 올라온다 —
   * 활 4자루는 해금(unlocks)이 여는 것이라 여기서 줄 것이 없다.
   * 빠진 필드는 sanitize 가 기본값(연습궁 · 빈 숙련)으로 채우므로 옮길 일이 없다.
   */
  () => {},
]

function migrate(r: Raw): void {
  let v = typeof r['v'] === 'number' && Number.isFinite(r['v']) ? Math.floor(r['v'] as number) : 0
  if (v < 0) v = 0
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v]
    // 체인에 구멍이 있으면 멈춘다. 억지로 올려서 데이터를 뭉개는 것보다 낫다.
    if (step === undefined) break
    step(r)
    v++
  }
  r['v'] = v
}

function sanitizeStats(v: unknown): Stats {
  const s = obj(v)
  return {
    str: int(s['str'], 0, 0, 9999),
    steady: int(s['steady'], 0, 0, 9999),
    stamina: int(s['stamina'], 0, 0, 9999),
    focus: int(s['focus'], 0, 0, 9999),
  }
}

function sanitizeBest(v: unknown): Record<string, number> {
  const src = obj(v)
  const out: Record<string, number> = {}
  let n = 0
  for (const key in src) {
    if (n >= BEST_SCORE_MAX_KEYS) break
    const raw = src[key]
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    out[key] = Math.floor(clamp(raw, 0, HARD_MAX))
    n++
  }
  return out
}

/** 별은 0~STAR_MAX. 손상된 값이 totalStars를 부풀려 해금을 통째로 열어버리지 않게 자른다. */
function sanitizeStars(v: unknown): Record<string, number> {
  const src = obj(v)
  const out: Record<string, number> = {}
  let n = 0
  for (const key in src) {
    if (n >= BEST_SCORE_MAX_KEYS) break
    const raw = src[key]
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    out[key] = Math.floor(clamp(raw, 0, STAR_MAX))
    n++
  }
  return out
}

/**
 * 해금 id 목록. **모르는 id도 버리지 않는다** — 나중에 추가될 항목이나 되돌린 항목의
 * 기록을 지우면 그건 세이브를 깨뜨리는 것이다 (A4: 필드를 지우지 않는다).
 * 문자열이 아닌 것과 중복만 걷어낸다.
 */
function sanitizeUnlocked(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (let i = 0; i < v.length && out.length < UNLOCK_MAX_KEYS; i++) {
    const id = v[i]
    if (typeof id !== 'string' || id === '' || id.length > 64) continue
    if (out.indexOf(id) >= 0) continue
    out.push(id)
  }
  return out
}

/**
 * 자원 상한(P.offline.*Cap)은 여기서 적용하지 않는다.
 * 상한은 **축적**을 멈추는 장치지, 이미 가진 걸 뺏는 장치가 아니다 (GDD 5장: 시드는 자원 금지).
 * 튜닝 콘솔로 상한을 내렸다가 세이브가 깎이는 사고도 이걸로 막는다.
 */
function sanitize(r: Raw, now: number): SaveData {
  const def = defaultSave(now)
  const carry = obj(r['carry'])
  return {
    v: SCHEMA_VERSION,
    stats: sanitizeStats(r['stats']),
    training: int(r['training'], 0, 0, HARD_MAX),
    arrows: int(r['arrows'], def.arrows, 0, HARD_MAX),
    requests: int(r['requests'], 0, 0, HARD_MAX),
    stageIndex: int(r['stageIndex'], 0, 0, 9999),
    bestScore: sanitizeBest(r['bestScore']),
    // 상한은 반드시 `now` 다. HARD_MAX 같은 임의의 큰 수로 자르면 실제 wallclock(1.7e12ms)이
    // 그 아래로 깎여 **재시작할 때마다 수십 년이 흐른 것으로 정산**된다 (자원이 즉시 상한).
    // 미래 시각을 허용하지 않는 것이 오프라인 정산이 성립하는 유일한 조건이다.
    lastSeen: num(r['lastSeen'], now, 0, now),
    offlineEnabled: bool(r['offlineEnabled'], true),
    totalShots: int(r['totalShots'], 0, 0, HARD_MAX),
    totalHits: int(r['totalHits'], 0, 0, HARD_MAX),
    carry: {
      arrows: num(carry['arrows'], 0, 0, 1),
      training: num(carry['training'], 0, 0, 1),
      requests: num(carry['requests'], 0, 0, 1),
    },
    stars: sanitizeStars(r['stars']),
    unlocked: sanitizeUnlocked(r['unlocked']),
    bestChain: int(r['bestChain'], 0, 0, HARD_MAX),
    bow: isBowKindId(r['bow']) ? r['bow'] : DEFAULT_BOW,
    bowHits: sanitizeBest(r['bowHits']),
    bullseyes: int(r['bullseyes'], 0, 0, HARD_MAX),
    perfectRuns: int(r['perfectRuns'], 0, 0, HARD_MAX),
    // 32비트 무부호. mulberry32의 상태 그대로다.
    runSeed: int(r['runSeed'], 0, 0, 0xffffffff),
  }
}

// ─────────────────────────── 변경 통지 ───────────────────────────
//
// UI(성장 화면의 '올릴 수 있음' 점)가 세이브를 폴링하지 않게 하는 최소 장치.
// 매 프레임 DOM을 만지지 않기 위해 존재한다 — game이 ui를 import하지는 않는다 (레이어 방향 유지).

const listeners: Array<(d: SaveData) => void> = []

/** 반환된 함수를 부르면 구독이 끊긴다. */
export function onSaveChanged(fn: (d: SaveData) => void): () => void {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

// ─────────────────────────── 공개 API ───────────────────────────

export function loadSave(): SaveData {
  const now = Date.now()
  let raw: Raw | null = null
  try {
    const text = localStorage.getItem(KEY)
    if (text !== null && text !== '') {
      const parsed: unknown = JSON.parse(text)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        raw = parsed as Raw
      }
    }
  } catch {
    // 손상된 JSON이거나 localStorage 자체가 막혔다. 기본값으로 복구하고 계속 간다 (A4).
    raw = null
  }
  if (raw === null) return defaultSave(now)
  migrate(raw)
  return sanitize(raw, now)
}

export function writeSave(d: SaveData): void {
  d.v = SCHEMA_VERSION
  // **여기서 lastSeen에 도장을 찍지 않는다.** 저장은 판 보상·성장·탭 이탈 등 아무 때나 일어나고,
  // 도장을 찍으면 그 사이에 흐른 시간이 정산 없이 통째로 삭제된다 — 게임 탭을 옆에 띄워둔 채
  // 25분 공부한 사람의 축적이 0이 되는 경로가 이것이었다 (C4 위반).
  // lastSeen을 옮기는 곳은 settleOffline 하나뿐이고, 실제로 판을 돌린 시간은
  // game/loop.ts가 playedMs로 세어 정산 직전에 더한다(그래야 자원이 두 배로 들어오지 않는다).
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    // 용량 초과·프라이빗 모드. 이번 판이 안 남을 뿐 게임은 계속 돌아야 한다 (A4).
  }
  // 저장 성공 여부와 무관하게 통지한다. UI가 보여줘야 할 건 메모리 위의 진실이다.
  for (let i = 0; i < listeners.length; i++) listeners[i]?.(d)
}

export function resetSave(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 지우지 못해도 크래시하지 않는다 */
  }
}
