/**
 * 열전 판 기록 — 기기 칸 (`hanbal.raid.games` · 형 11-19: 「열전 플레이데이터도 받고 있지?」)
 *
 * 판마다 한 장: 언제 · 어느 판(모드·스테이지·장수·씨앗·판 옵션) · 누른 것(입력 흐름 · 판을 그대로 다시 돌릴 만큼) · 고른 카드 차례 · 결과 · 본편에서 열었는지.
 * 본편 판 기록(realm-main `hanbal.realm.games`)과 같은 법: 넘치면 오래된 판의 입력부터 덜고, 그래도 크면 오래된 판을 덜어 낸다.
 * 서버로는 net/sync.ts pushRaids 가 올린다 (로그인했을 때만 · 실패해도 판은 그대로).
 * 이 파일은 판의 셈(haebi.ts)을 부르지 않는다 — 본편(realm-main 기록 내보내기)도 가볍게 읽을 수 있게. 적기·다시 돌리기는 runlog.ts.
 */
import type { HaebiOpts, HaebiRun, Kit, StageId } from './haebi.ts'

export const RAID_GAMES = 'hanbal.raid.games'
/** 이보다 커지면 오래된 판의 입력부터 덜고, 그래도 크면 판을 덜어 낸다 (localStorage 는 5MB 안팎 · 본편 판 기록이 3MB 를 쓴다) */
const MAX_CHARS = 1_200_000
/** 남겨 두는 판 수 (입력을 덜어 낸 판도 한 줄씩은 남는다) */
const MAX_GAMES = 400

/** createHaebi 에 넘긴 판 옵션 그대로 */
export type RaidOpts = HaebiOpts
export interface RaidEnd {
  /** won 이김 · lost 짐 · quit 물러남(멈춤 창에서) · left 판 가운데 화면을 떠남(닫기·새로고침) */
  result: 'won' | 'lost' | 'quit' | 'left'
  /** 진 까닭 — fell 쓰러짐 · time 시간 초과(두목 생존) */
  why?: 'fell' | 'time'
  /** 버틴 초 · 받은 금 · 레벨 · 격파 · 남은 체력 */
  t: number; gold: number; level: number; kills: number; hp: number
  /** 쓰러질 때 둘레(150px)의 적 — 가까운 차례로 셋 */
  near?: string[]
  /** 55 final boss remaining HP percent, including timeout/withdrawal. */
  bossHp?: number
  /** 끝난 때 (벽시계 · 화면 쪽) */
  at: string
}
export interface RaidGame {
  readonly v: 1
  /** Input format stays backward compatible; earlier stage results used different combat rules. */
  readonly rules?: '53B' | '56A' | '56B' | '55-IMUGI'
  /** 판 이름 — 시작 시각 + 씨앗 (서버 문서 이름) */
  readonly id: string
  /** 시작 시각 (벽시계 · 화면 쪽에서만) */
  readonly started: string
  readonly mode: HaebiRun['mode']
  readonly stage: StageId
  /** 본편 장수 id · 무기 묶음 · 전투 그림 */
  readonly hero: string
  readonly kit: Kit
  readonly sprite: string
  readonly seed: number
  readonly opts: RaidOpts
  /** 본편에서 열었으면 — 어느 틀(열전·각성 시련·선봉) · 본편 판 id(씨앗) · 그 달(턴) */
  readonly from: { via: 'campaign' | 'trial' | 'vanguard'; game?: number; turn?: number } | null
  /** 입력 격자 (HAEBI_LOG.grid) */
  readonly grid: number
  /**
   * 입력 흐름 — 빈칸으로 나눈 토막. 토막마다 앞의 base36 수 = 그 앞 입력으로 걸은 걸음(1/120초) 수, 뒤는 그다음에 일어난 일:
   * `,x,y,f` 이동 입력이 바뀜(x·y 는 격자 정수 base36 · f 비트 1 회피 2 비기 4 각성) · `=카드` 카드를 고름 · `!` 다시 고르기 · `.` 물러남 · 없음 = 끝까지 걸음.
   * 기기 칸이 넘쳐 덜어 냈으면 '' (cut)
   */
  input: string
  cut?: true
  /** 고른 카드 차례 */
  picks: string[]
  /** 걸음 수 */
  steps: number
  end: RaidEnd | null
  /** 끝나기 전에 적어 둔 그때의 판 (판 가운데 창을 닫으면 이것으로 「떠남」을 적는다) */
  snap?: { t: number; level: number; kills: number; hp: number }
  /** 서버에 올렸다 */
  up?: true
}

export function loadRaidGames(): RaidGame[] {
  try {
    const raw = localStorage.getItem(RAID_GAMES)
    const g = raw === null ? [] : (JSON.parse(raw) as RaidGame[])
    return Array.isArray(g) ? g.filter((x) => x !== null && typeof x === 'object' && typeof x.id === 'string') : []
  } catch {
    return []
  }
}

/** 넘치면: 오래된 판의 입력부터, 그다음 오래된 판 통째로. 마지막 판(지금 판)은 남긴다 */
export function saveRaidGames(games: RaidGame[]): void {
  try {
    while (games.length > MAX_GAMES) games.shift()
    let json = JSON.stringify(games)
    for (let i = 0; json.length > MAX_CHARS && i < games.length - 1; i++) {
      if (games[i]!.input === '') continue
      games[i]!.input = ''; games[i]!.cut = true
      json = JSON.stringify(games)
    }
    while (json.length > MAX_CHARS && games.length > 1) { games.shift(); json = JSON.stringify(games) }
    localStorage.setItem(RAID_GAMES, json)
  } catch {
    // 사생활 창 · 칸이 참 — 이번 판은 기록 없이
  }
}

/** 한 판을 넣거나(새 판) 바꾼다(같은 id) */
export function putRaidGame(g: RaidGame): void {
  const games = loadRaidGames(), i = games.findIndex((x) => x.id === g.id)
  if (i >= 0) games[i] = g; else games.push(g)
  saveRaidGames(games)
}

/**
 * 열 때 — 끝이 안 적힌 판(판 가운데 창을 닫음 · 새로고침)은 「떠남」으로 닫는다. 끝은 마지막으로 적어 둔 자리까지
 * (탭이 가려질 때 · 카드를 고를 때 적는다). 다른 탭에서 지금 도는 판까지 닫을 수 있다 — 그 탭이 끝날 때 제 끝으로 다시 덮는다
 */
export function sealLeftovers(at: string): void {
  const games = loadRaidGames()
  let changed = false
  for (const g of games) if (g.end === null) { const n = g.snap; g.end = { result: 'left', t: n?.t ?? 0, gold: 0, level: n?.level ?? 1, kills: n?.kills ?? 0, hp: n?.hp ?? 0, at }; delete g.snap; delete g.up; changed = true }
  if (changed) saveRaidGames(games)
}

/** 아직 서버에 안 올린 끝난 판 */
export const unsentRaids = (): RaidGame[] => loadRaidGames().filter((g) => g.end !== null && g.up !== true)

/** 올린 판에 표시 */
export function markRaidsSent(ids: readonly string[]): void {
  if (ids.length === 0) return
  const games = loadRaidGames(), set = new Set(ids)
  for (const g of games) if (set.has(g.id)) g.up = true
  saveRaidGames(games)
}
