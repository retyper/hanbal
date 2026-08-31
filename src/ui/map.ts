/**
 * 지도 (2026-08-26, 형: "지도 버튼도 만들어서 지도로 여행의 재미를 더해야겠어").
 *
 * 캠페인 50판을 주사위판처럼 구불구불하게 배치한다 — 챕터(10판)마다 한 줄, 줄마다
 * 진행 방향이 뒤집힌다(뱀 놀이판 문법). 10번째마다 보스(마름모), 각 줄의 첫 칸(n-1,
 * 즉 1-1·2-1·3-1·4-1·5-1)은 체크포인트다. 그 앞 보스를 잡아본 적이 있으면 노란색으로
 * 켜지고, 눌러서 그 판부터 새 여정을 연다 (형: "보스깨면 죽었을때 직전보스 다음스테이지
 * 부터 시작하게 하고... n-1들은 노란색으로 눌러서 그 스테이지로 바로 이동할수 있게").
 *
 * ★ 2026-08-26 재작도. 첫 판은 원 50개를 flexbox 줄에 늘어놓은 것뿐이었다 — 형의
 *   반려: "지도가 지금 니눈에 그게 지도야? 이게 무슨 누구 홈페이지냐?" 맞는 말이다.
 *   길이 안 보이면 지도가 아니라 목록이다. 그래서 노드 좌표를 직접 계산해 절대
 *   배치하고, 그 좌표를 그대로 이은 SVG 선 하나를 밑에 깐다 — 지나온 구간은 강조색,
 *   나머지는 어둡게. 좌표를 DOM 측정 없이 수식으로 구하는 이유는 레이아웃이 깨질
 *   여지를 안 남기기 위해서다(그리드가 그대로 곧 좌표다).
 *
 * 여정이 진행 중이면 보기만 하고 못 옮긴다 — 지도로 위험 없이 깊이만 사면 로그라이트가
 * 아니게 된다. 체크포인트가 열렸는가는 save.bossKills 하나로 계산한다
 * (game/stages.ts checkpointStage) — 보스는 마디 순서대로만 잡히므로 새 필드가 필요 없다.
 */
import { BOSS_EVERY, CAMPAIGN, STAGES, checkpointStage } from '../game/stages.ts'
import { STAR_MAX } from '../game/rewards.ts'
import type { Overlay } from './overlay.ts'

const PANEL_ID = 'map'
const ROW_LEN = BOSS_EVERY
const ROWS = Math.ceil(CAMPAIGN / ROW_LEN)

// ── 판 배치 기하 (px, DOM 측정 없이 이 숫자에서 전부 나온다) ──
const NODE = 30
const STEP_X = 42
const STEP_Y = 50
const LABEL_W = 50
const PAD = 18
const BOARD_W = PAD * 2 + LABEL_W + (ROW_LEN - 1) * STEP_X + NODE
const BOARD_H = PAD * 2 + (ROWS - 1) * STEP_Y + NODE

interface Pt { x: number; y: number }

/** 판 번호(1-based) → 화면 중심 좌표. 줄마다 방향이 뒤집히는 뱀 놀이판 수식. */
function centerOf(n: number): Pt {
  const idx = n - 1
  const r = Math.floor(idx / ROW_LEN)
  const c = idx % ROW_LEN
  const vc = r % 2 === 0 ? c : ROW_LEN - 1 - c
  return {
    x: PAD + LABEL_W + vc * STEP_X + NODE / 2,
    y: PAD + r * STEP_Y + NODE / 2,
  }
}

const CSS = `
.map-lead { color: var(--dim); font-size: 14px; margin: 4px 0 16px; }
.map-lead b { color: var(--teal); font-weight: 700; font-family: inherit; }
/* 판은 ${BOARD_W}px 고정이다 — 폰(360~390px)에는 안 들어간다. 가로 스크롤로 밀어놓으면
   조준 중인 화면에서 손가락 드래그를 훔치므로, **통째로 줄여서** 다 보이게 한다.
   배율은 열릴 때 JS가 --map-s 에 넣는다 (calc으로는 길이÷길이를 배수로 못 만든다). */
.map-fit { width: 100%; overflow: hidden; }
.map-wrap {
  position: relative; width: ${BOARD_W}px; height: ${BOARD_H}px; margin: 0 auto;
  transform: scale(var(--map-s, 1)); transform-origin: top center;
}
.map-wrap svg { position: absolute; inset: 0; pointer-events: none; }
.map-ch {
  position: absolute; width: ${LABEL_W - 8}px; color: var(--dim); font-size: 11px;
  letter-spacing: .08em; text-align: right; transform: translateY(-50%);
}
.map-node {
  position: absolute; width: ${NODE}px; height: ${NODE}px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--num); font-size: 10.5px; color: var(--mute);
  background: var(--sunk); border: 1px solid var(--line); transition: background .12s, border-color .12s;
}
.map-node.done { background: var(--card); border-color: #5c584c; color: var(--dim); }
.map-node.full { background: var(--card-hi); border-color: var(--gold); color: var(--accent); }
/* 보스 — 마름모. 판별 별 격자·수집 화면과 같은 문법이다. */
.map-node.boss { border-radius: 5px; transform: rotate(45deg); width: ${NODE - 4}px; height: ${NODE - 4}px; }
.map-node.boss span { display: block; transform: rotate(-45deg); }
/* 체크포인트 — 열리면 노랑(강조색), 잠기면 흐리게. 열린 것만 누를 수 있다. */
.map-node.ckpt { width: ${NODE + 4}px; height: ${NODE + 4}px; margin: -2px; }
.map-node.ckpt.unlocked {
  background: var(--accent); border-color: var(--accent); color: #241a06; font-weight: 700;
  cursor: pointer;
}
.map-node.ckpt.unlocked:hover { background: #ffc46a; border-color: #ffc46a; }
.map-node.ckpt.unlocked:active { background: #e69d33; }
.map-node.ckpt.locked { opacity: .45; }
.map-node.busy { cursor: default; }
.map-foot { border-top: 1px solid var(--line); margin-top: 20px; padding-top: 16px; color: var(--mute); font-size: 13px; }
`

interface NodeEl {
  n: number
  el: HTMLElement
  span: HTMLElement
}

let curStars: Readonly<Record<string, number>> = {}
let curBossKills = 0
let curBestRunStage = 0
let curRunActive = false
let onJumpFn: ((index0: number) => void) | null = null
let refreshFn: (() => void) | null = null

function stageIdOf(n: number): string {
  const s = STAGES[n - 1]
  return s?.id ?? `${Math.floor((n - 1) / ROW_LEN) + 1}-${((n - 1) % ROW_LEN) + 1}`
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function pointsAttr(pts: readonly Pt[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ')
}

/**
 * 지도를 오버레이에 붙인다. `stars`·`bossKills`·`bestRunStage`·`runActive`는 여는 순간
 * 다시 읽는다 — updateMap으로 최신을 넘기면 화면이 그때그때 최신을 그린다.
 */
export function mountMap(
  o: Overlay,
  stars: Readonly<Record<string, number>>,
  bossKills: number,
  bestRunStage: number,
  runActive: boolean,
  onJump: (index0: number) => void,
): void {
  curStars = stars
  curBossKills = bossKills
  curBestRunStage = bestRunStage
  curRunActive = runActive
  onJumpFn = onJump

  const panel = o.panel(PANEL_ID)
  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  const head = document.createElement('div')
  head.className = 'c-h'
  head.innerHTML = '<h2>지도</h2>'
  const lead = document.createElement('p')
  lead.className = 'map-lead'
  panel.append(head, lead)

  const wrap = document.createElement('div')
  wrap.className = 'map-wrap'

  // ── 길 — 좌표를 그대로 이은 선 하나. 지나온 구간은 강조색, 나머지는 어둡게. ──
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', String(BOARD_W))
  svg.setAttribute('height', String(BOARD_H))
  svg.setAttribute('aria-hidden', 'true')
  const allPts: Pt[] = []
  for (let n = 1; n <= CAMPAIGN; n++) allPts.push(centerOf(n))
  const pathAll = document.createElementNS(SVG_NS, 'polyline')
  pathAll.setAttribute('points', pointsAttr(allPts))
  pathAll.setAttribute('fill', 'none')
  pathAll.setAttribute('stroke', '#1c2530')
  pathAll.setAttribute('stroke-width', '3')
  pathAll.setAttribute('stroke-linecap', 'round')
  pathAll.setAttribute('stroke-linejoin', 'round')
  svg.appendChild(pathAll)
  const pathDone = document.createElementNS(SVG_NS, 'polyline')
  pathDone.setAttribute('fill', 'none')
  pathDone.setAttribute('stroke', 'var(--teal)')
  pathDone.setAttribute('stroke-width', '3')
  pathDone.setAttribute('stroke-linecap', 'round')
  pathDone.setAttribute('stroke-linejoin', 'round')
  svg.appendChild(pathDone)
  wrap.appendChild(svg)

  // ── 챕터 표지 — 각 줄의 첫 칸 옆, 세로 중앙에 맞춘다. ──
  for (let r = 0; r < ROWS; r++) {
    const lab = document.createElement('div')
    lab.className = 'map-ch'
    lab.textContent = `${r + 1}장`
    const y = PAD + r * STEP_Y + NODE / 2
    lab.style.left = `${PAD}px`
    lab.style.top = `${y}px`
    wrap.appendChild(lab)
  }

  const nodes: NodeEl[] = []
  for (let n = 1; n <= CAMPAIGN; n++) {
    const { x, y } = centerOf(n)
    const el = document.createElement('div')
    el.className = 'map-node'
    el.style.left = `${x - NODE / 2}px`
    el.style.top = `${y - NODE / 2}px`
    el.title = stageIdOf(n)
    const span = document.createElement('span')
    span.textContent = String(n)
    el.appendChild(span)
    const isBoss = n % ROW_LEN === 0
    const isCkpt = n % ROW_LEN === 1
    if (isBoss) el.classList.add('boss')
    if (isCkpt) {
      el.classList.add('ckpt')
      el.addEventListener('click', () => {
        if (curRunActive) return
        if (n - 1 > checkpointStage(curBossKills)) return
        onJumpFn?.(n - 1)
        o.hide(true)
      })
    }
    wrap.appendChild(el)
    nodes.push({ n, el, span })
  }
  // 판을 담는 칸. 여기 폭에 맞춰 판 전체를 줄인다 (CSS .map-fit 주석).
  const fit = document.createElement('div')
  fit.className = 'map-fit'
  fit.appendChild(wrap)
  panel.appendChild(fit)

  /**
   * 판을 칸 폭에 맞춰 줄인다. transform은 레이아웃 높이를 바꾸지 않으므로
   * 담는 칸의 높이도 같이 줄여 준다 — 안 그러면 판 아래로 빈 공간이 남는다.
   * 패널이 닫혀 있으면 폭이 0이라 아무것도 하지 않는다 (열릴 때 다시 부른다).
   */
  const fitBoard = (): void => {
    const avail = fit.clientWidth
    if (avail <= 0) return
    const k = Math.min(1, avail / BOARD_W)
    fit.style.setProperty('--map-s', String(k))
    fit.style.height = `${Math.ceil(BOARD_H * k)}px`
  }

  const foot = document.createElement('div')
  foot.className = 'map-foot'
  foot.textContent = '노란 칸이 지금 열린 체크포인트다 — 눌러서 그 판부터 새 여정을 연다. '
    + '여정이 진행 중일 때는 옮길 수 없다.'
  panel.appendChild(foot)

  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'hb-btn'
  open.innerHTML = '지도'
  open.setAttribute('aria-label', '지도 열기')
  const isOpen = (): boolean => o.showing(PANEL_ID)
  open.addEventListener('click', () => {
    if (isOpen()) {
      o.hide()
      return
    }
    refresh()
    o.show(PANEL_ID)
    // 배율은 패널이 실제로 보인 뒤에야 잰다 — 닫혀 있으면 폭이 0이다.
    fitBoard()
  })
  o.hud().appendChild(open)

  // 화면이 돌아가면(세로↔가로) 폭이 바뀐다. 열려 있을 때만 다시 잰다.
  const onResize = (): void => {
    if (o.showing(PANEL_ID)) fitBoard()
  }
  window.addEventListener('resize', onResize, { passive: true })
  o.onDispose(() => window.removeEventListener('resize', onResize))

  function refresh(): void {
    const far = curBestRunStage
    lead.innerHTML = far > 0
      ? `최고 도달 <b>${far}판</b>${far > CAMPAIGN ? ' · 캠페인 너머' : ''}`
      : '아직 첫 여정 전이다.'

    const travelEnd = Math.max(0, Math.min(far, CAMPAIGN))
    pathDone.setAttribute('points', travelEnd >= 2 ? pointsAttr(allPts.slice(0, travelEnd)) : '')

    for (const { n, el, span } of nodes) {
      const id = stageIdOf(n)
      const s = curStars[id] ?? 0
      const isCkpt = el.classList.contains('ckpt')
      el.classList.toggle('done', s > 0)
      el.classList.toggle('full', s >= STAR_MAX)
      if (isCkpt) {
        const unlocked = n - 1 <= checkpointStage(curBossKills)
        el.classList.toggle('unlocked', unlocked && !curRunActive)
        el.classList.toggle('locked', !unlocked)
        el.classList.toggle('busy', unlocked && curRunActive)
      }
      span.textContent = String(n)
    }
  }

  refreshFn = refresh
  o.onDispose(() => { refreshFn = null })
  refresh()
}

/** 세이브가 바뀌었다 (판 클리어·보스 처치·여정 시작/종료). 화면이 열려 있지 않아도 불러도 된다. */
export function updateMap(
  stars: Readonly<Record<string, number>>,
  bossKills: number,
  bestRunStage: number,
  runActive: boolean,
): void {
  curStars = stars
  curBossKills = bossKills
  curBestRunStage = bestRunStage
  curRunActive = runActive
  refreshFn?.()
}
