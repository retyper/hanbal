/**
 * 하늘 — **장(章)이 하루의 다른 시각이다** (docs/MEGAHIT.md §4-1)
 *
 * ★ 왜 생겼나 (렌즈 ②·⑥)
 *   "50판을 깨도 첫 판과 같은 화면이다. 스탯 창에 들어가야만 내가 강해진 걸 알 수 있으면
 *    그건 성장이 아니라 회계다."  "색을 줄인 건 맞는데 **대비를 안 만들었다.**"
 *
 *   진행 표시 UI 백 개보다 강한 건 **하늘이 달라지는 것**이다. 그리고 비용은
 *   색 상수 다섯 벌 + 빛 방향 하나뿐이다 — 새 애셋이 0이다.
 *
 * ★ 왜 한낮이 없는가 (지키는 것)
 *   초안에는 '한낮 · 흰 청 · 높은 대비'가 있었다. 넣지 않았다.
 *   이 게임의 실루엣 계약은 **밝은 몸(#d3dce6)이 어두운 하늘에서 떨어져 나오는 것**이다
 *   (GDD 8장). 하늘을 밝히면 궁수·화살·과녁의 색을 전부 뒤집어야 하고(어두운 실루엣),
 *   그러면 HUD 대비까지 다시 짜야 한다 — 형이 "회색 글씨 쳐 안 보여"라고 반려했던 그 축이다.
 *
 *   그래서 다섯 장을 **하루의 어두운 쪽 다섯 시각**으로 잡았다. 여명 전 → 새벽 →
 *   안개 아침 → 노을 → 밤. 전부 몸보다 어둡다. 실루엣 계약을 한 톨도 안 건드리면서
 *   장마다 화면이 확실히 다르다. 진짜 대낮을 원하면 실루엣을 뒤집는 별도 결정이 필요하다.
 *
 * ARCHITECTURE A1: 렌더 전용. World를 읽지도 않는다 — 판 id 문자열 하나만 받는다.
 * A5: 팔레트는 고정 배열이라 프레임당 할당이 없다.
 */

export interface SkyPalette {
  /** 이 시각의 이름. 디버그·프로브가 읽는다. */
  name: string
  sky0: string
  sky1: string
  ridgeFaint: string
  ridgeFar: string
  ridgeNear: string
  mist: string
  cloud: string
  pine: string
  ground: string
  groundLine: string
  /**
   * 별이 얼마나 보이는가 0..1. 낮에 별이 뜨면 하늘이 유리가 된다.
   */
  stars: number
  /**
   * 빛이 오는 쪽 (+1 오른쪽 = 그림자가 왼쪽으로 늘어진다). 0이면 머리 위 — 그림자가 발밑에만.
   * 그림자는 이 게임에서 **가장 싼 입체감**이다. 지금은 모든 것이 떠 있다 (렌즈 ⑥).
   */
  lightDir: number
  /** 그림자가 늘어지는 길이 (몸 높이 대비). 해가 낮을수록 길다. */
  shadowLen: number
  /** 그림자의 진하기 0..1. 흐린 날은 옅다. */
  shadowAlpha: number
}

/**
 * 다섯 시각. **순서가 곧 진행이다** — 여명 전에서 시작해 밤으로 닫는다.
 * 하루가 흐르는 게 아니라 '점점 깊어지는' 순서라, 뒤로 갈수록 화면이 조용해진다.
 */
const HOURS: readonly SkyPalette[] = [
  {
    // 1장 — 여명 전. 가장 푸르고 가장 조용하다. 아직 아무 일도 일어나지 않았다.
    name: '여명 전',
    sky0: '#0b0e13', sky1: '#1a222c',
    ridgeFaint: '#161f2b', ridgeFar: '#121a23', ridgeNear: '#0d1319',
    mist: '#3a4a5e', cloud: '#242f3d', pine: '#0a0f15',
    ground: '#080b0f', groundLine: '#28313c',
    stars: 0.55, lightDir: 0, shadowLen: 0.5, shadowAlpha: 0.3,
  },
  {
    // 2장 — 새벽. 지평선에 살구빛이 한 줄. 해는 아직 능선 뒤라 그림자가 길다.
    name: '새벽',
    sky0: '#131425', sky1: '#3a2a34',
    ridgeFaint: '#26243a', ridgeFar: '#1b1b2c', ridgeNear: '#12111c',
    mist: '#6a5568', cloud: '#3a3244', pine: '#0d0c14',
    ground: '#0c0a0e', groundLine: '#3a3040',
    stars: 0.2, lightDir: 1, shadowLen: 1.35, shadowAlpha: 0.34,
  },
  {
    // 3장 — 안개 아침. 대비가 가장 낮고 능선이 겹겹으로 물러난다. 멀리 있는 것이 더 멀어 보인다.
    name: '안개 아침',
    sky0: '#1d2733', sky1: '#38454f',
    ridgeFaint: '#2e3a45', ridgeFar: '#25303a', ridgeNear: '#1b242c',
    mist: '#7d8b96', cloud: '#42505b', pine: '#161d24',
    ground: '#111820', groundLine: '#3d4a55',
    stars: 0, lightDir: 0.4, shadowLen: 0.7, shadowAlpha: 0.16,
  },
  {
    // 4장 — 노을. 다섯 중 가장 강렬하다. 빛이 반대쪽(왼쪽)에서 와 그림자가 오른쪽으로 눕는다.
    name: '노을',
    sky0: '#1b1220', sky1: '#5a2c25',
    ridgeFaint: '#3a2230', ridgeFar: '#2a1826', ridgeNear: '#1a0f1a',
    mist: '#8a5348', cloud: '#4a2a2e', pine: '#120a12',
    ground: '#0e080c', groundLine: '#4a2c2c',
    stars: 0.1, lightDir: -1, shadowLen: 1.5, shadowAlpha: 0.38,
  },
  {
    // 5장 — 밤. 별이 가장 많고 그림자는 달빛이라 짧고 옅다. 곡사 챕터의 하늘이다.
    name: '밤',
    sky0: '#07090d', sky1: '#121821',
    ridgeFaint: '#111823', ridgeFar: '#0d141c', ridgeNear: '#090e14',
    mist: '#2f3d4e', cloud: '#1b2431', pine: '#070b10',
    ground: '#05070a', groundLine: '#222a34',
    stars: 1, lightDir: 0.2, shadowLen: 0.45, shadowAlpha: 0.22,
  },
]

/** 판 id('5-3') → 장 번호 (1부터). 규칙 밖이면 1. */
function chapterOf(id: string): number {
  const dash = id.indexOf('-')
  if (dash < 0) return 1
  const c = Number(id.slice(0, dash))
  return Number.isFinite(c) && c >= 1 ? Math.floor(c) : 1
}

/**
 * 이 판의 하늘. 무한 구간(6장~)은 다섯 시각을 **되풀이한다** —
 * 새 팔레트를 무한히 만들 수는 없고, 되풀이는 "하루가 또 지났다"로 읽힌다.
 */
export function skyOf(stageId: string): SkyPalette {
  const i = (chapterOf(stageId) - 1) % HOURS.length
  return HOURS[i] ?? (HOURS[0] as SkyPalette)
}

/** 시각의 수. 프로브가 전수 검사에 쓴다. */
export const SKY_COUNT = HOURS.length

/**
 * 땅에 붙이는 그림자 하나. **이 게임에서 가장 싼 입체감이다.**
 *
 * 색을 새로 만들지 않는다 — 지면색을 알파로 겹칠 뿐이다 (GDD 8장: 색 수를 안 늘린다).
 * 빛이 머리 위(lightDir 0)면 발밑의 타원 하나, 해가 낮으면 그 타원이 반대쪽으로 길게 눕는다.
 */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  sky: SkyPalette,
  /** 발이 땅에 닿는 화면 좌표 */
  x: number, groundY: number,
  /** 몸의 화면 높이 (px). 그림자의 길이와 크기를 정한다. */
  h: number,
): void {
  if (sky.shadowAlpha <= 0 || h <= 0) return
  const rx = h * 0.3
  const ry = Math.max(1.2, h * 0.055)
  // 해가 낮을수록 반대쪽으로 길게. lightDir이 +1이면 그림자는 -x로 간다.
  const reach = -sky.lightDir * h * sky.shadowLen
  ctx.globalAlpha = sky.shadowAlpha
  ctx.fillStyle = sky.pine
  ctx.beginPath()
  ctx.ellipse(x + reach * 0.5, groundY, rx + Math.abs(reach) * 0.5, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}
