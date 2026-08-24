/**
 * HUD — 최소한만. 남은 화살, 점수/목표, 스태미나(빨간 바), 조준 확신, 성장 진입구.
 *
 * GDD 2장: "물리가 곧 UI다." 정확도 바·QTE 링 같은 장치는 만들지 않는다.
 * 스태미나 게이지는 활 바로 옆에 붙인다 — 눈이 조준점과 게이지를 왕복하면 그 자체가 페널티다.
 *
 * ★ 이 화면이 반드시 전달해야 하는 한 가지: **빨간 바(P.stamina.steadyZone)의 위치.**
 * 그 위로는 떨림 0·발사 오차 0이라 조준한 그 자리에 정확히 맞고, 아래로는 내려간 만큼 떨린다.
 * 물리가 그렇게 바뀌었는데 경계가 화면에 없으면, 플레이어는 왜 빗나갔는지 알 수 없고 그냥 화가 난다.
 * 그래서 여기서 그리는 건 정보가 아니라 **약속**이다 — 이 선 위에서는 게임이 배신하지 않는다.
 *
 * 색 언어는 하나로 묶는다: 게이지의 안전 구간과 조준 표식이 **같은 청록색**이다.
 * 하나가 붉어지는 순간 둘 다 붉어진다. 두 곳을 번갈아 볼 필요가 없어야 한다.
 *
 * A5: 매 프레임 문자열·색 문자열을 만들지 않는다. 값이 바뀔 때만 갱신해 캐시하고, 색은 램프에서 집는다.
 * A1: World는 읽기만 한다. 시간축도 w.tick 을 쓴다 — performance.now 를 끌어오지 않는다.
 */
import { TAU, clamp, clamp01, lerp } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { World } from '../sim/types.ts'
import { THEME } from './camera.ts'
import type { Camera } from './camera.ts'
import { bowHandScreenX, bowHandScreenY } from './stickman.ts'

/**
 * HUD가 밖에서 받아야 하는 것들. 성장·오디오는 game/ui 레이어의 상태라
 * World(=sim)에 넣지 않고 인자로 받는다 (A1 레이어 분리).
 * 루프가 객체 하나를 만들어 제자리에서 갱신한다 — 프레임당 할당 0 (A5).
 */
export interface HudState {
  /** 보유 훈련치 (GDD 4장 성장 재화) */
  training: number
  /** 지금 올릴 수 있는 스탯이 있는가 — 숫자가 강조색으로 켜진다 */
  canLevelUp: boolean
  /** 음소거 (M 키) */
  muted: boolean
  /** 짧은 알림 한 줄. 빈 문자열이면 그리지 않는다. */
  toast: string
  /**
   * 판 결과의 별 수. **-1 = 아직 채점 전.**
   *
   * 판은 마지막 과녁이 쓰러진 그 스텝에 즉시 클리어로 넘어가지만, 그 뒤로도 날아가던 화살과
   * 낙하 중인 공중 과녁이 점수를 더 올린다 (game/loop.ts isSettled). 그래서 별은 한 박자 늦게
   * 온다 — 그동안 0개를 보여주면 "무별 클리어"로 읽혀 배신이다. -1로 두고 별 줄만 비운다.
   */
  stars: number
  /**
   * 이 판에 쓰는 화살 종류의 이름 (docs/HOOK.md ★1).
   *
   * 고르고 나면 그 판 내내 바뀌지 않으니 크게 그릴 이유가 없다 — 남은 화살 숫자 아래에
   * 한 줄로만 붙인다. 다만 **반드시 보여야 한다**: 지금 쥔 게 뭔지 모르면 3택이 선택이 아니다.
   * 기본 살이면 빈 문자열을 넣어 아무것도 그리지 않는다 (효과가 없는 걸 알릴 이유가 없다).
   */
  arrow: string
}

/**
 * 글꼴 — **"AI가 만든 화면" 냄새의 절반은 `system-ui` 하나로 다 쓰는 데서 온다.**
 *
 * 런타임 의존성 0(A6)이고 첫 페인트 0.3초(C6)라 웹폰트는 못 쓴다. 대신 **역할을 나눈다**:
 * 글자는 한글이 예쁜 스택으로, 숫자는 좁고 각진 스택으로. 없는 기기에서는 조용히 다음 것으로
 * 떨어지므로 어디서도 깨지지 않는다.
 *
 * Bahnschrift 는 윈도우 10에 기본으로 들어 있는 DIN 계열이다 — 계기판 숫자의 얼굴이다.
 */
const FONT_UI = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif'
const FONT_NUM = '"Bahnschrift","DIN Alternate","Avenir Next Condensed","Malgun Gothic",system-ui,sans-serif'

/**
 * 치수의 기준 화면. 이 크기에서 아래 px 값이 그대로 쓰이고, 다른 크기에서는 비례로 늘고 준다.
 * 형의 반려: **"UI 크기도 더 키워."** 예전 값은 1280px 화면에서도 13~16px이라
 * 노트북에서 눈을 가늘게 뜨고 봐야 했다. 기준을 잡고 전부 한 번에 키운다.
 */
const BASE_W = 1280
const BASE_H = 800
const S_MIN = 0.82
const S_MAX = 1.9

const HUD = {
  padX: 26,
  padY: 24,
  lineGap: 26,
  /** 게이지를 활 손 기준 어디에 붙일지 (px) */
  gaugeDX: -8,
  gaugeDY: 34,
  gaugeW: 84,
  gaugeH: 8,
  /** 경고 시 게이지가 커지는 정도 */
  gaugeWarnGrow: 3,
  /** 1초 눈금이 이보다 촘촘해지면 오히려 안 읽힌다 — 그리지 않는다 */
  tickMinPx: 7,
  tickW: 1,
  /** 빨간 바가 게이지 위아래로 삐져나오는 길이. 게이지에서 유일하게 튀어나오는 것이다. */
  zoneOut: 5,
  zoneW: 2,
  /** 붕괴 문턱은 바 안쪽에 얇게만 — 빨간 바를 이기면 안 된다 */
  collapseW: 1,
  /** 플래시가 경계선 위아래로 더 뻗는 길이 / 굵기 (지속 시간은 P.render.zoneCrossFlash) */
  flashOut: 6,
  flashW: 5,
  /**
   * 조준 표식: 활 손에서 이만큼 띄우고 이만큼 길게 (px).
   * 30 -> 44: 표식이 떨림을 읽는 주 판독기인데 지렛대가 짧아 흔들림이 서브픽셀이었다.
   * 레이저 조준기가 되지 않을 만큼 짧게 유지하면서(GDD 2장) 팔 길이만큼만 늘린다.
   */
  sightGap: 15,
  sightLen: 44,
  /**
   * 떨림이 최대일 때 조준 표식 끝이 옆으로 밀리는 거리 (px). 위상은 원본 그대로다.
   *
   * 6 -> 20: 6px이면 실측 파고(0.744)를 곱해 strain 1에서도 끝점 총 이동이 4.5px인데,
   * 챕터 1의 과녁 반경 하나가 그 위에서 0.8px다 — 경계선을 넘은 직후 0.5초 구간의
   * p2p가 0.85px라 "흔들림이 중앙을 지날 때 놓기"가 실력이 아니라 서브픽셀 운이 됐다.
   * 20이면 같은 구간이 2.8px로 눈에 잡힌다. 밸런스는 불변 — 이건 눈금이지 벌이 아니다.
   */
  sightSwing: 20,
  sightW: 1.4,
  /** 만작 + 안전 구간에서만 굵어진다 — 이 굵기가 "지금 쏘면 정확하다"다 */
  sightWLock: 2.4,
  /** 잠김 표식(끝점 사각형) 한 변 */
  sightDot: 3,
  /**
   * 남은 화살 숫자 크기 (px). 다른 무엇보다 크다 —
   * 판 중에 계속 확인하는 값이고, 0이 되면 판이 끝나기 때문이다.
   */
  countPx: 46,
  /** 점수 줄과 화살 숫자 사이 여백 */
  countGap: 8,
  /** 이 개수 이하면 숫자와 눈금이 경고색이 된다 */
  lowArrows: 2,
  /** 숫자 오른쪽에서 눈금이 시작하는 거리 */
  pipStart: 30,
  /** 화살 글리프 하나가 차지하는 가로 간격 */
  pipStride: 13,
  /** 화살 글리프 길이 (세로) */
  pipH: 29,
  pipMax: 10,
  /** 훈련치 아래 줄 간격 */
  subGap: 8,
  /** 경고 깜빡임 (Hz). sim 시계로 도는 값이라 프레임레이트와 무관하다. */
  pulseHz: 2.4,
  toastUp: 58,

  // ── 판 머리글 (새로 생긴 것) ────────────────────────────────────────
  //
  // 지금까지 화면에는 **몇 판인지가 어디에도 없었다.** 40판을 지나 무한 구간에 들어가면
  // 판마다 성격이 달라지는데(endless.ts) 그게 화면에 안 뜨면 그냥 "또 비슷한 판"이 된다.
  /** 판 번호 글자 크기 (px) */
  stagePx: 17,
  /** 판 이름 글자 크기 (px) */
  titlePx: 14,
  /** 번호와 이름 사이 */
  titleGap: 10,
  /** 머리글 아래 본문까지 */
  headGap: 24,
  /** 과녁 수 / 점수 */
  goalPx: 23,
  scorePx: 14,
  scoreGap: 12,
  trainPx: 17,
  subPx: 13,
  toastPx: 16,

  // ── 판 시작 카드 ────────────────────────────────────────────────────
  //
  // 판이 시작될 때 화면 위쪽에 크게 한 번 떴다 사라진다. 모달이 아니라 **자막**이다 —
  // 아무것도 막지 않고, 그 사이에도 쏠 수 있다 (C1).
  cardPx: 40,
  cardSubPx: 16,
  cardY: 0.17,
  /**
   * 완전히 보이는 시간 / 사라지는 시간 (s).
   *
   * 0.9 + 0.7 -> 2.4 + 1.1: 형의 반려 — **"너무 빨리 사라져서 읽기도 전에 없어져버린다."**
   * 맞다. 한글 한 줄을 읽는 데만 1초 가까이 걸리는데 0.9초 뒤부터 사라지기 시작했다.
   * 아무것도 막지 않는 자막이라 길어도 손해가 없다 (그 위에서 바로 쏠 수 있다, C1).
   */
  cardHold: 2.4,
  cardFade: 1.1,
  cardGap: 12,

  // ── 판 결과 (클리어 / 실패) ─────────────────────────────────────────
  //
  // 화면 가운데 약간 위. 예전엔 화면 맨 아래 회색 12px 한 줄이 전부였고,
  // 거기엔 깼다는 사실도 별도 없었다 (형의 반려).
  resultY: 0.3,
  resultPx: 54,
  resultStarPx: 40,
  resultSubPx: 18,
  /** 등장 시간 (s)과 그 사이의 추가 확대. 확 들어와야 "끝났다"가 몸으로 온다. */
  resultIn: 0.22,
  resultPunch: 0.35,
  /** 별 사이 간격 */
  starGap: 10,

  // ── 바람 눈금 ───────────────────────────────────────────────────────
  //
  // 세기는 깃발이 말한다 (scene.ts). 여기는 **방향과 숫자**만 — 깃발을 안 보고도
  // "왼쪽으로 3.4" 를 한 번에 읽게 하는 자다.
  windPx: 15,
  windArrowW: 26,
  windArrowH: 7,
  windGap: 9,
} as const

/**
 * 화면 크기에 맞춰 다시 굽는 치수와 글꼴 문자열.
 *
 * **매 프레임 문자열을 만들지 않는다** (A5) — 크기가 바뀐 프레임에만 한 번 굽는다.
 * 캔버스 폰트는 문자열로만 지정할 수 있어서, 스케일을 곱한 값을 그때그때 템플릿으로 만들면
 * 프레임당 열 몇 개의 문자열이 생긴다.
 */
const M = {
  w: -1,
  h: -1,
  s: 1,
  padX: 0,
  padY: 0,
  headGap: 0,
  countGap: 0,
  scoreGap: 0,
  subGap: 0,
  titleGap: 0,
  pipStart: 0,
  pipStride: 0,
  pipH: 0,
  countPx: 0,
  toastUp: 0,
  cardGap: 0,
  windArrowW: 0,
  windArrowH: 0,
  windGap: 0,
  fStage: '',
  fTitle: '',
  fGoal: '',
  fScore: '',
  fCount: '',
  fSub: '',
  fTrain: '',
  fToast: '',
  fCard: '',
  fCardSub: '',
  fWind: '',
  fResult: '',
  fResultSub: '',
  fStar: '',
  starGap: 0,
}

/** 별의 최대 개수. game/rewards.ts 의 STAR_MAX 와 같은 값이다 (render는 game을 import하지 않는다). */
const STAR_MAX = 3

const px = (v: number, s: number): number => Math.round(v * s)

function syncMetrics(cam: Camera): void {
  if (cam.w === M.w && cam.h === M.h) return
  M.w = cam.w
  M.h = cam.h
  // 폭과 높이 중 **작은 쪽**을 따른다. 폭만 보면 낮고 넓은 창에서 글자가 화면을 먹는다.
  const s = clamp(Math.min(cam.w / BASE_W, cam.h / BASE_H), S_MIN, S_MAX)
  M.s = s
  M.padX = px(HUD.padX, s)
  M.padY = px(HUD.padY, s)
  M.headGap = px(HUD.headGap, s)
  M.countGap = px(HUD.countGap, s)
  M.scoreGap = px(HUD.scoreGap, s)
  M.subGap = px(HUD.subGap, s)
  M.titleGap = px(HUD.titleGap, s)
  M.pipStart = px(HUD.pipStart, s)
  M.pipStride = px(HUD.pipStride, s)
  M.pipH = px(HUD.pipH, s)
  M.countPx = px(HUD.countPx, s)
  M.toastUp = px(HUD.toastUp, s)
  M.cardGap = px(HUD.cardGap, s)
  M.windArrowW = px(HUD.windArrowW, s)
  M.windArrowH = px(HUD.windArrowH, s)
  M.windGap = px(HUD.windGap, s)

  M.fStage = `700 ${px(HUD.stagePx, s)}px ${FONT_NUM}`
  M.fTitle = `500 ${px(HUD.titlePx, s)}px ${FONT_UI}`
  M.fGoal = `600 ${px(HUD.goalPx, s)}px ${FONT_UI}`
  M.fScore = `500 ${px(HUD.scorePx, s)}px ${FONT_NUM}`
  M.fCount = `700 ${M.countPx}px ${FONT_NUM}`
  M.fSub = `600 ${px(HUD.subPx, s)}px ${FONT_UI}`
  M.fTrain = `600 ${px(HUD.trainPx, s)}px ${FONT_UI}`
  M.fToast = `500 ${px(HUD.toastPx, s)}px ${FONT_UI}`
  M.fCard = `700 ${px(HUD.cardPx, s)}px ${FONT_UI}`
  M.fCardSub = `500 ${px(HUD.cardSubPx, s)}px ${FONT_NUM}`
  M.fWind = `600 ${px(HUD.windPx, s)}px ${FONT_NUM}`
  M.fResult = `700 ${px(HUD.resultPx, s)}px ${FONT_UI}`
  M.fResultSub = `600 ${px(HUD.resultSubPx, s)}px ${FONT_NUM}`
  M.fStar = `400 ${px(HUD.resultStarPx, s)}px ${FONT_UI}`
  M.starGap = px(HUD.starGap, s)
}

/**
 * strain(빨간 바를 얼마나 넘었는가) 램프. 0 = 아직 안 넘음.
 * 0번이 이미 붉은 계열인 건 의도다 — 게이지의 왼쪽 구간은 **아직 쓰지 않았어도 위험 구간**이고,
 * 그게 보여야 "저기까지 내려가면 떨린다"가 미리 읽힌다. 다만 넘기 전엔 죽은 색이다.
 */
const DANGER_RAMP = ['#5d3a38', '#8a4239', '#ad4a37', '#cd5439', '#ee5f3d', '#ff6a45'] as const
/** 위험 구간의 빈 트랙. 안전 구간 트랙(THEME.gaugeBack)보다 붉게 죽여 구역을 나눈다. */
const DANGER_BACK = '#2a1b1c'
/** 조준 표식 램프. 0번(안전)은 게이지 안전색과 같은 계열이어야 색 언어가 하나로 묶인다. */
const SIGHT_RAMP = ['#7fd6c8', '#a7cfa2', '#cbc37b', '#e5a862', '#f88a4f', '#ff6a45'] as const
/** 아직 만작이 아닐 때 — 무채색. "아직 믿지 마라" */
const SIGHT_DRAWING = '#5c6670'

/**
 * 화살 글리프 하나 — 촉 + 대 + 깃.
 *
 * 막대기로 그리면 "이게 뭐지"가 된다. 남은 화살은 이 게임에서 가장 중요한 자원이라
 * 무엇을 세고 있는지가 형태만으로 읽혀야 한다. 위를 향하게 세워 화살통에 꽂힌 모양으로 둔다.
 * cx는 화살대의 중심 x, cy는 세로 중심.
 */
function drawArrowGlyph(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, low: boolean,
): void {
  const top = cy - len * 0.5
  const bot = cy + len * 0.5
  const headH = len * 0.3
  const headW = 3.2
  const fletchH = len * 0.28
  const fletchW = 2.6

  // 촉 — 채운 삼각형. 여기가 화살로 읽히게 하는 부분이라 제일 또렷하다.
  ctx.fillStyle = low ? THEME.gaugeWarn : THEME.accent
  ctx.beginPath()
  ctx.moveTo(cx, top)
  ctx.lineTo(cx - headW, top + headH)
  ctx.lineTo(cx + headW, top + headH)
  ctx.closePath()
  ctx.fill()

  // 대
  ctx.strokeStyle = low ? THEME.gaugeWarn : THEME.arrow
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(cx, top + headH * 0.6)
  ctx.lineTo(cx, bot)
  ctx.stroke()

  // 깃 — 뒤쪽에 사선 두 개
  ctx.strokeStyle = low ? THEME.gaugeWarn : THEME.hudDim
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(cx, bot - fletchH)
  ctx.lineTo(cx - fletchW, bot)
  ctx.moveTo(cx, bot - fletchH)
  ctx.lineTo(cx + fletchW, bot)
  ctx.stroke()
}

/** 램프에서 색 하나 고르기. 문자열을 만들지 않는다 (A5). */
function ramp(table: readonly string[], v: number): string {
  const n = table.length - 1
  const i = (clamp01(v) * n + 0.5) | 0
  return table[i] ?? table[n] ?? THEME.gauge
}

/** 문자열 캐시. 값이 바뀐 프레임에만 새 문자열이 생긴다. */
const cache = {
  score: -1,
  goal: -1,
  scoreText: '',
  scoreNum: '',
  arrows: -1,
  arrowsText: '',
  training: -1,
  trainingText: '',
  /** 판 머리글 — 판이 바뀔 때만 다시 만든다 */
  stageId: '',
  stageNo: '',
  wind: Number.NaN,
  windText: '',
}

/**
 * 스테이지 id('7-3') → 통산 판 번호('63판').
 * 챕터-판 표기는 짧지만 "지금까지 몇 판을 왔는가"가 안 읽힌다. 둘 다 보여준다.
 */
function stageNoText(id: string): string {
  const dash = id.indexOf('-')
  if (dash < 0) return id
  const ch = Number(id.slice(0, dash))
  const n = Number(id.slice(dash + 1))
  if (!Number.isFinite(ch) || !Number.isFinite(n)) return id
  return `${(ch - 1) * 10 + n}판`
}

/**
 * 경계선을 넘는 "순간"을 표시하기 위한 렌더 지역 상태.
 * World에 쓰면 결정론이 깨진다 (A1). 카메라의 흔들림 상태와 같은 급의 연출 값이라 여기 둔다.
 */
const mark = {
  prevStrain: 0,
  /** 판이 끝난 sim 시각 (s). 음수면 아직 안 끝났다. 결과 배너의 등장 연출이 이걸 쓴다. */
  endT: -1,
  /** 경계선을 넘은 sim 시각 (s). 음수면 아직 없음. */
  crossT: -1,
}

export function drawHud(
  ctx: CanvasRenderingContext2D, cam: Camera, w: World, hud: HudState,
): void {
  const a = w.archer
  // 렌더의 시계는 sim tick 이다. 값이 결정론적이라 리플레이에서도 같은 그림이 나온다.
  const t = w.tick * w.dt
  syncMetrics(cam)
  const strain = clamp01(a.strain)
  const holding = a.phase === 'drawing' || a.phase === 'full' || a.phase === 'collapsing'

  // ── 경계선 넘김 감지 ─────────────────────────────────────────
  // 판을 다시 시작하면 sim 시계가 0으로 되감긴다. 그대로 두면 옛 플래시가 미래에서 되살아난다.
  if (t < mark.crossT) mark.crossT = -1
  if (mark.prevStrain <= 0 && strain > 0) mark.crossT = t
  mark.prevStrain = strain
  const flashDur = P.render.zoneCrossFlash
  const flash = mark.crossT >= 0 && flashDur > 0
    ? clamp01(1 - (t - mark.crossT) / flashDur)
    : 0

  // ── 조준 확신 표식 ───────────────────────────────────────────
  // 활 손 앞으로 짧게 뻗는 선 하나. 길게 그으면 레이저 조준기가 되고 GDD 2장이 금지한 UI 장치가 된다.
  // 이 선이 말하는 건 방향이 아니라 **신뢰도**다:
  //   당기는 중 = 무채색 가늘게 (아직 덜 당겨서 오차가 있다 — partialDrawPenalty)
  //   만작 + 안전 구간 = 청록색으로 굵고 미동 없음 + 끝에 잠김 점  ← "지금 쏘면 그대로 맞는다"
  //   경계선을 넘은 뒤 = 붉어지며 떨림 위상 그대로 옆으로 흔들린다
  if (holding) {
    drawSight(ctx, cam, w, strain)
  }

  // ── 남은 과녁 / 점수 ─────────────────────────────────────────
  //
  // 클리어 조건은 **과녁을 다 없애는 것**이다 (sim/world.ts evaluateEnd).
  // 그래서 화면 맨 위에 있어야 할 숫자는 점수가 아니라 남은 과녁 수다.
  // 점수는 보상의 크기일 뿐이라 한 단계 작게, 옆에 둔다.
  let standing = 0
  for (let i = 0; i < w.targets.length; i++) {
    const t = w.targets[i]
    if (t !== undefined && t.alive) standing++
  }
  const score = w.score | 0
  if (standing !== cache.goal || score !== cache.score) {
    cache.goal = standing
    cache.score = score
    cache.scoreText = standing > 0 ? `과녁 ${standing}` : '정리 완료'
    cache.scoreNum = `${score}점`
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  // ── 판 머리글 ── 몇 판인지, 무슨 판인지. 지금까지 화면 어디에도 없던 정보다.
  if (w.stage.id !== cache.stageId) {
    cache.stageId = w.stage.id
    cache.stageNo = stageNoText(w.stage.id)
  }
  ctx.font = M.fStage
  ctx.fillStyle = THEME.accent
  ctx.fillText(cache.stageNo, M.padX, M.padY)
  const noW = ctx.measureText(cache.stageNo).width
  const title = w.stage.title ?? ''
  if (title !== '') {
    ctx.font = M.fTitle
    ctx.fillStyle = THEME.hudDim
    ctx.fillText(title, M.padX + noW + M.titleGap, M.padY + Math.round(M.s * 3))
  }

  const bodyY = M.padY + M.headGap
  ctx.font = M.fGoal
  ctx.fillStyle = standing === 0 ? THEME.accent : THEME.hudText
  ctx.fillText(cache.scoreText, M.padX, bodyY)
  const goalW = ctx.measureText(cache.scoreText).width
  ctx.font = M.fScore
  ctx.fillStyle = THEME.hudDim
  ctx.fillText(cache.scoreNum, M.padX + goalW + M.scoreGap, bodyY + Math.round(M.s * 6))

  // ── 남은 화살 ────────────────────────────────────────────────
  //
  // 큰 숫자 + 화살 눈금을 **둘 다** 보여준다. 숫자는 한눈에 읽히고, 눈금은 세지 않아도
  // 남은 양이 덩어리로 보인다. 전에는 3×11px 회색 막대뿐이라 몇 발인지 알아보기 어려웠다.
  const left = w.arrowsLeft
  const pipY = bodyY + M.countGap + px(HUD.goalPx, M.s)
  if (left !== cache.arrows) {
    cache.arrows = left
    cache.arrowsText = String(left)
  }

  // 마지막 한 발은 색으로도 말해준다 — 세고 있지 않아도 알아야 한다.
  const low = left <= HUD.lowArrows
  ctx.fillStyle = low ? THEME.gaugeWarn : THEME.hudText
  ctx.font = M.fCount
  ctx.fillText(cache.arrowsText, M.padX, pipY)
  const numW = ctx.measureText(cache.arrowsText).width

  ctx.font = M.fSub
  ctx.fillStyle = THEME.hudDim
  ctx.fillText('발', M.padX + numW + Math.round(M.s * 6), pipY + M.countPx - px(HUD.subPx + 8, M.s))

  // 눈금 — 숫자 오른쪽에. 막대가 아니라 **진짜 화살 모양**으로 그린다.
  // 짝대기로 두면 "이게 뭐지"가 되고, 이 게임에서 가장 중요한 자원이 무엇인지 안 읽힌다.
  if (left <= HUD.pipMax) {
    const pipX = M.padX + numW + M.pipStart
    const midY = pipY + M.countPx * 0.5
    for (let i = 0; i < left; i++) {
      drawArrowGlyph(ctx, pipX + i * M.pipStride, midY, M.pipH, low)
    }
  }

  // 이 판의 화살 종류 — 숫자 아래 한 줄. 고른 것이 무엇인지 판 내내 보인다 (HOOK ★1).
  if (hud.arrow !== '') {
    ctx.font = M.fSub
    ctx.fillStyle = THEME.accent
    ctx.fillText(hud.arrow, M.padX, pipY + M.countPx + M.subGap)
  }

  // ── 스태미나 — 활 옆 ─────────────────────────────────────────
  const max = a.staminaMax > 0 ? a.staminaMax : 1
  const ratio = clamp01(a.stamina / max)
  const warn = clamp01(a.warn)
  const gx = bowHandScreenX(cam, w) + HUD.gaugeDX - HUD.gaugeW * 0.5
  const gy = bowHandScreenY(cam, w) + HUD.gaugeDY
  const gh = HUD.gaugeH + warn * HUD.gaugeWarnGrow
  const gw = HUD.gaugeW

  // 빨간 바의 화면 x. sim의 strain 이 (redAt - stamina)/redAt 이므로 비율 공간에서 정확히 steadyZone 이다.
  const zoneX = gw * clamp01(P.stamina.steadyZone)
  const headX = gw * ratio

  // 지금 이 순간의 실제 소모 속도. **bow.ts의 drain 식과 같아야 한다.**
  // P.stamina.drawDrain 은 '당김 100%·평상호흡' 기준값일 뿐이라 그대로 쓰면 게이지가 말하는 '초'가
  // 실제와 최대 2.6배 어긋난다 — 초보(당김 0.72)에게는 시간을 과소, 호흡정지 중에는 과대로,
  // 즉 **반대 방향으로** 틀려서 플레이어가 보정 상수조차 못 배운다.
  // 잡고 있지 않으면 0이다. 그때 남은 칸은 아무 시간도 뜻하지 않는다.
  const drainNow = holding && a.draw > 0
    ? P.stamina.drawDrain
      * Math.pow(a.draw, P.stamina.drainByDraw)
      * lerp(1, P.steady.staminaDrain, clamp01(a.steadyBlend))
    : 0

  // 트랙 — 구역부터 나눈다. 게이지가 가득 차 있어도 "왼쪽은 위험 구역"이 보여야 예고가 된다.
  ctx.fillStyle = DANGER_BACK
  ctx.fillRect(gx, gy, zoneX, gh)
  ctx.fillStyle = THEME.gaugeBack
  ctx.fillRect(gx + zoneX, gy, gw - zoneX, gh)

  // 채움 — 경계선 아래(위험)와 위(안전)를 다른 색으로.
  // strain 0 이면 위험 구간 색이 죽은 벽돌색이라 화면 전체가 평온하다. 넘는 순간 살아난다.
  const dangerW = headX < zoneX ? headX : zoneX
  if (dangerW > 0) {
    ctx.fillStyle = ramp(DANGER_RAMP, strain)
    ctx.fillRect(gx, gy, dangerW, gh)
  }
  if (headX > zoneX) {
    // 이 구간의 길이가 곧 "아직 정확한 상태로 남은 시간"이다.
    const safeSec = drainNow > 0
      ? (a.stamina - max * P.stamina.steadyZone) / drainNow
      : 0
    // 1초도 안 남았으면 숨쉬게 한다. 숫자 카운트다운을 띄우면 과녁이 아니라 시계를 보게 된다.
    // 실소모율로 나누므로 safeLowSec 이 비로소 '초'다 — 어떤 스탯 조합에서도 같은 시간에 켜진다.
    if (drainNow > 0 && safeSec < P.render.safeLowSec) {
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * HUD.pulseHz * TAU)
    }
    ctx.fillStyle = THEME.gauge
    ctx.fillRect(gx + zoneX, gy, headX - zoneX, gh)
    ctx.globalAlpha = 1
  }

  // 1초 눈금 — **경계선에서부터** 오른쪽으로 지금의 실소모율(drainNow) 만큼마다 하나.
  // 채움 끝과 경계선 사이에 남은 칸 수가 곧 "정확하게 쏠 수 있는 시간이 몇 초"다.
  // 0에서부터 그으면 붕괴까지의 시간이 되는데, 이제 플레이어가 다투는 건 붕괴가 아니라 이 경계선이다.
  // 잡지 않은 동안에는 그리지 않는다(drainNow 0) — 그때 칸은 시간이 아니라 그냥 스태미나다.
  if (drainNow > 0) {
    const stepPx = gw * drainNow / max
    if (stepPx >= HUD.tickMinPx) {
      ctx.fillStyle = THEME.sky0
      for (let s = zoneX + stepPx; s < gw - 0.5; s += stepPx) {
        ctx.fillRect(gx + s, gy, HUD.tickW, gh)
      }
    }
  }

  // 붕괴 문턱 — 여전히 예고는 필요하다. 다만 바 안쪽에 얇게만 그어 빨간 바를 이기지 않게 한다.
  const warnAt = clamp01(P.stamina.collapseWarnAt / max)
  if (warnAt > 0 && warnAt < zoneX / gw) {
    ctx.fillStyle = THEME.gaugeWarn
    ctx.globalAlpha = warn > 0 ? 0.55 + 0.45 * Math.sin(t * HUD.pulseHz * TAU) : 0.3
    ctx.fillRect(gx + gw * warnAt, gy, HUD.collapseW, gh)
    ctx.globalAlpha = 1
  }

  // ── 빨간 바 본체 ─────────────────────────────────────────────
  // 게이지에서 유일하게 위아래로 튀어나오는 것. 이게 이 화면의 주인공이다.
  ctx.fillStyle = THEME.gaugeWarn
  ctx.globalAlpha = strain > 0
    ? 0.8 + 0.2 * Math.sin(t * HUD.pulseHz * TAU)
    : 0.85
  ctx.fillRect(gx + zoneX - HUD.zoneW * 0.5, gy - HUD.zoneOut, HUD.zoneW, gh + HUD.zoneOut * 2)
  ctx.globalAlpha = 1

  // 넘는 순간 — 짧은 흰 섬광. 청록색 구간이 사라지는 색 전환과 같은 프레임에 터진다.
  // 이 한 번을 놓치면 "언제부터 떨리기 시작했는지"를 영영 모른다.
  if (flash > 0) {
    ctx.fillStyle = THEME.target2
    ctx.globalAlpha = flash
    const fw = HUD.flashW * flash + HUD.zoneW
    const fo = HUD.zoneOut + HUD.flashOut * flash
    ctx.fillRect(gx + zoneX - fw * 0.5, gy - fo, fw, gh + fo * 2)
    ctx.globalAlpha = 1
  }

  // 호흡정지 중이면 게이지 아래 짧은 선 — 지금 급소모 중이라는 신호
  if (a.steadyBlend > 0.01) {
    ctx.fillStyle = THEME.target2
    ctx.globalAlpha = clamp01(a.steadyBlend)
    ctx.fillRect(gx, gy + gh + HUD.zoneOut + 2, gw, 1)
    ctx.globalAlpha = 1
  }

  // ── 훈련치 · 음소거 (오른쪽 위) ──────────────────────────────
  // 성장 화면을 여는 버튼은 DOM 오버레이(ui/growth.ts)가 왼쪽 아래에 그린다.
  // 캔버스에 또 그리면 버튼이 둘이 되고, 조준선이 지나는 자리에서 클릭을 먹는다 (C1).
  // 여기서는 "올릴 게 있다"는 신호만 훈련치 숫자의 색으로 낸다.
  const training = hud.training | 0
  if (training !== cache.training) {
    cache.training = training
    cache.trainingText = `훈련 ${training}`
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.font = M.fTrain
  ctx.fillStyle = hud.canLevelUp ? THEME.accent : THEME.hudText
  ctx.fillText(cache.trainingText, cam.w - M.padX, M.padY)

  let rightY = M.padY + px(HUD.trainPx, M.s) + M.subGap

  // ── 바람 ──
  // 세기는 깃발이 말한다 (scene.ts drawWindFlag). 여기는 방향과 숫자다 —
  // 깃발을 못 봤어도 "지금 어느 쪽으로 얼마나"를 한 번에 읽을 수 있어야 한다.
  if (w.stage.wind !== 0) {
    const wind = w.wind
    // 0.1 단위로만 갱신한다. 매 프레임 문자열을 만들면 A5가 깨진다.
    const rounded = Math.round(wind * 10) / 10
    if (rounded !== cache.wind) {
      cache.wind = rounded
      cache.windText = `${Math.abs(rounded).toFixed(1)}`
    }
    ctx.font = M.fWind
    ctx.fillStyle = THEME.windCloth
    ctx.fillText(cache.windText, cam.w - M.padX, rightY)
    const wTextW = ctx.measureText(cache.windText).width
    drawWindArrow(ctx, cam.w - M.padX - wTextW - M.windGap, rightY + px(HUD.windPx, M.s) * 0.5, wind)
    rightY += px(HUD.windPx, M.s) + M.subGap
  }

  if (hud.muted) {
    ctx.font = M.fSub
    ctx.fillStyle = THEME.hudDim
    ctx.fillText('무음 · M', cam.w - M.padX, rightY)
  }

  drawStageCard(ctx, cam, w, t)
  drawResult(ctx, cam, w, hud, t)
  ctx.textAlign = 'left'
}

/**
 * 판 결과 — **화면 가운데 약간 위에, 확실하게.**
 *
 * 형의 반려: "클리어했으면 아래 회색 글씨로 나오게 하지 말고 확실하게 띄워줘야지.
 * 별로 그 클리어 수준 정해놓을 거라면 별도 보여줘야지."
 *
 * 예전엔 화면 맨 아래에 회색 12px로 '한 번 더 누르면 다음 판'이 전부였다. 그 한 줄에는
 * **깼다는 사실도, 얼마나 잘 깼는지도 없었다** — 별은 세이브에만 적히고 화면에는 안 왔다.
 *
 * 모달은 아니다. 아무것도 막지 않고, 이 위에서 바로 다음 판을 누를 수 있다 (C1).
 */
function drawResult(
  ctx: CanvasRenderingContext2D, cam: Camera, w: World, hud: HudState, t: number,
): void {
  if (w.status === 'playing') {
    mark.endT = -1
    return
  }
  // 판을 다시 시작하면 sim 시계가 되감긴다. 옛 시각이 남아 있으면 등장 연출이 통째로 건너뛰어진다.
  if (mark.endT < 0 || t < mark.endT) mark.endT = t
  const age = t - mark.endT
  // 튀어나오는 0.22초. 확 들어와야 "끝났다"가 몸으로 온다.
  const inT = clamp01(age / HUD.resultIn)
  const pop = 1 + (1 - inT) * (1 - inT) * HUD.resultPunch
  const cleared = w.status === 'cleared'

  const cx = cam.w * 0.5
  const cy = cam.h * HUD.resultY
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = inT

  // ── 큰 글자 ──
  ctx.font = pop > 1.01 ? popFont(M.s, pop) : M.fResult
  ctx.fillStyle = cleared ? THEME.accent : THEME.gaugeWarn
  ctx.fillText(cleared ? '클리어' : '실패', cx, cy)

  // ── 별 ── 채점이 끝나야 나온다 (stars < 0 이면 아직).
  let y = cy + px(HUD.resultStarPx, M.s) + M.cardGap
  if (cleared && hud.stars >= 0) {
    ctx.font = M.fStar
    // 받은 별과 못 받은 별을 **한 줄에** 그린다. 못 받은 칸이 보여야 다음 목표가 생긴다.
    const got = hud.stars
    const starW = ctx.measureText('★').width
    const total = starW * STAR_MAX + M.starGap * (STAR_MAX - 1)
    let sx = cx - total * 0.5 + starW * 0.5
    for (let i = 0; i < STAR_MAX; i++) {
      ctx.fillStyle = i < got ? THEME.accent : THEME.gaugeBack
      ctx.fillText(i < got ? '★' : '☆', sx, y)
      sx += starW + M.starGap
    }
    y += px(HUD.resultSubPx, M.s) + M.cardGap
  }

  // ── 점수 ──
  ctx.font = M.fResultSub
  ctx.fillStyle = THEME.hudText
  ctx.fillText(cache.scoreNum, cx, y)

  // ── 다음 안내 ── 이제 이건 '결과'가 아니라 '조작 안내'다. 작게, 아래에.
  if (hud.toast !== '') {
    ctx.font = M.fToast
    ctx.fillStyle = THEME.hudDim
    ctx.fillText(hud.toast, cx, y + px(HUD.toastPx, M.s) + M.cardGap)
  }

  ctx.globalAlpha = 1
  ctx.textBaseline = 'top'
}

/**
 * 튀어나오는 동안만 쓰는 임시 폰트 문자열.
 * 0.22초 동안만 만들어지고 그 뒤로는 캐시된 M.fResult 로 돌아간다 — 매 프레임은 아니다 (A5).
 */
function popFont(s: number, mul: number): string {
  return `700 ${Math.round(HUD.resultPx * s * mul)}px ${FONT_UI}`
}

/**
 * 바람 방향 화살표. 길이가 아니라 **머리 크기**로 세기를 말한다 —
 * 길이로 하면 숫자 옆에서 폭이 들쭉날쭉해 HUD가 흔들린다.
 */
function drawWindArrow(ctx: CanvasRenderingContext2D, rightX: number, cy: number, wind: number): void {
  const dir = wind >= 0 ? 1 : -1
  const strength = clamp01(Math.abs(wind) / P.wind.maxSpeed)
  const w2 = M.windArrowW
  const h = M.windArrowH * (0.55 + strength * 0.75)
  // 오른쪽 끝을 기준으로 왼쪽으로 뻗는다. 방향은 촉이 말한다.
  const tipX = dir > 0 ? rightX : rightX - w2
  const backX = dir > 0 ? rightX - w2 : rightX

  ctx.strokeStyle = THEME.windCloth
  ctx.lineWidth = Math.max(1.5, h * 0.35)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(backX, cy)
  ctx.lineTo(tipX - dir * h, cy)
  ctx.stroke()

  ctx.fillStyle = THEME.windCloth
  ctx.beginPath()
  ctx.moveTo(tipX, cy)
  ctx.lineTo(tipX - dir * h * 1.4, cy - h)
  ctx.lineTo(tipX - dir * h * 1.4, cy + h)
  ctx.closePath()
  ctx.fill()
}

/**
 * 판이 시작될 때 위쪽에 한 번 뜨는 자막.
 *
 * 모달이 아니다 — 아무것도 막지 않고, 뜨는 동안에도 쏠 수 있다 (C1).
 * 시계는 `w.tick * w.dt` 라 판이 시작되는 순간이 곧 0이고, R로 재시작하면 다시 뜬다.
 * 무한 구간에서 판마다 성격이 바뀌는 걸(endless.ts 테마) 알려주는 유일한 자리다.
 */
function drawStageCard(ctx: CanvasRenderingContext2D, cam: Camera, w: World, t: number): void {
  const title = w.stage.title ?? ''
  if (title === '') return
  const life = HUD.cardHold + HUD.cardFade
  if (t > life) return
  const alpha = t <= HUD.cardHold ? 1 : clamp01(1 - (t - HUD.cardHold) / HUD.cardFade)
  if (alpha <= 0) return

  const cx = cam.w * 0.5
  const cy = cam.h * HUD.cardY
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = alpha

  ctx.font = M.fCardSub
  ctx.fillStyle = THEME.accent
  ctx.fillText(cache.stageNo, cx, cy)

  const titleY = cy + px(HUD.cardPx, M.s) + M.cardGap
  ctx.font = M.fCard
  ctx.fillStyle = THEME.target2
  ctx.fillText(title, cx, titleY)

  // 이 판에서 무엇을 배우는가. 앞 40판에만 있다 — 무한 구간은 이름 하나로 충분하다.
  const hint = w.stage.hint ?? ''
  if (hint !== '') {
    ctx.font = M.fCardSub
    ctx.fillStyle = THEME.hudDim
    ctx.fillText(hint, cx, titleY + px(HUD.cardSubPx, M.s) + M.cardGap)
  }

  ctx.globalAlpha = 1
  ctx.textBaseline = 'top'
}

/**
 * 조준 확신 표식.
 *
 * 만작(phase 'full')이 아니면 오차원이 하나 더 있다 — bow.ts의 partialDrawPenalty.
 * 덜 당기고 쏘면 안전 구간이어도 빗나가므로, 표식은 만작에 **닿는 순간에만** 잠긴다.
 * 그래서 이 선은 GDD 3장의 리듬("빠르게 당긴다 → 만작이 가장 정확하다 → 오래 끌면 벌받는다")을
 * 그대로 그린다: 흐릿함 → 탁 잠김 → 붉게 풀림.
 */
function drawSight(ctx: CanvasRenderingContext2D, cam: Camera, w: World, strain: number): void {
  const a = w.archer
  const locked = a.phase === 'full' && strain <= 0

  const hx = bowHandScreenX(cam, w)
  const hy = bowHandScreenY(cam, w)
  // 월드는 y가 위로 +, 화면은 아래로 +. 방향 벡터를 여기서 뒤집는다.
  const ux = Math.cos(a.aimAngle)
  const uy = -Math.sin(a.aimAngle)

  // 떨림을 화면에서 읽을 수 있는 크기로 옮긴다. **최대 진폭으로 정규화만 하고 위상은 그대로 둔다** —
  // 부호와 위상이 보존돼야 "흔들림이 중앙을 지날 때 놓기"가 이 표식으로도 성립한다 (GDD 2장).
  const swing = P.tremor.baseAmp > 0
    ? (a.tremorOffset / P.tremor.baseAmp) * HUD.sightSwing
    : 0

  const x0 = hx + ux * HUD.sightGap
  const y0 = hy + uy * HUD.sightGap
  const end = HUD.sightGap + HUD.sightLen
  // 수직 방향으로 끝점만 민다. 작은 각에서는 회전과 같고 sin/cos 두 번을 아낀다.
  const x1 = hx + ux * end - uy * swing
  const y1 = hy + uy * end + ux * swing

  ctx.strokeStyle = a.phase === 'drawing' ? SIGHT_DRAWING : ramp(SIGHT_RAMP, strain)
  ctx.lineWidth = locked ? HUD.sightWLock : HUD.sightW
  ctx.lineCap = 'butt'
  ctx.globalAlpha = a.phase === 'drawing' ? 0.35 : 0.9
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()

  // 잠김 점 — 안전 구간의 만작에서만 켜지고, 경계선을 넘는 즉시 꺼진다.
  // "켜져 있으면 조준한 그대로 간다"는 한 비트짜리 약속이다.
  if (locked) {
    const d = HUD.sightDot
    ctx.fillStyle = SIGHT_RAMP[0] ?? THEME.gauge
    ctx.fillRect(x1 - d * 0.5, y1 - d * 0.5, d, d)
  }
  ctx.globalAlpha = 1
}
