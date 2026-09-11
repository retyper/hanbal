/**
 * 지도 — **행로도(行路圖)** (2026-08-26 첫 판 · 2026-09-10 재작도)
 *
 * 형: "지도 버튼도 만들어서 지도로 여행의 재미를 더해야겠어" → 첫 판은 원 50개를 flexbox 에
 * 늘어놓은 것뿐이었다. 형의 반려: "지도가 지금 니눈에 그게 지도야?" → 좌표를 계산해 뱀 놀이판으로
 * 놓고 그 좌표를 이은 선을 깔았다. 그리고 다시 반려: **"지도가 지금 너무 멋이 없으니까 더
 * 그럴듯하게 만들어봐. 지도답게좀."**
 *
 * 두 번째 판의 문제는 분명했다 — **길은 있는데 땅이 없었다.** 어두운 판 위의 동그라미와 선은
 * 노선도지 지도가 아니다. 그래서 셋을 바꿨다:
 *
 *   ① **종이 위로 옮겼다.** 어두운 화면 안의 낡은 종이 한 장 — 얼룩·접힌 자국·광곽(匡郭)까지.
 *      (`ui/mapart.ts`. 색은 이 게임의 어두운 팔레트를 안 쓴다 — 종이는 종이여야 물건으로 보인다.)
 *   ② **땅을 그렸다.** 줄 사이의 빈 띠마다 산줄기와 솔숲, 셋째 줄 아래로 물길, 아래 가장자리엔
 *      바다. 나침반과 표제(標題)까지. 지도가 지도로 보이는 건 길이 아니라 그 둘레의 것들이다.
 *   ③ **길을 길답게.** 직선 꺾임이 아니라 **부드러운 곡선**이고, 판마다 자리가 조금씩 흔들린다
 *      (고정 해시라 늘 같은 자리다). 지나온 길은 먹으로 짙고, 아직 안 간 길은 **점선**이다.
 *      지나온 끝에는 **붉은 깃발**이 선다 — "여기까지 왔다".
 *   그리고 장 이름을 **지명**으로 바꿨다: 一 활터 · 二 솔숲 · 三 바람재 · 四 돌다리 · 五 높은재.
 *   "1장"은 목차의 말이고 "활터"는 지도의 말이다.
 *
 * ── 안 바꾼 것 (규칙) ────────────────────────────────────────────────
 * 10번째마다 보스(붉은 인장), 각 줄의 첫 칸(n-1)은 체크포인트다. 그 앞 보스를 잡아본 적이 있으면
 * 열리고, 눌러서 그 판부터 새 여정을 연다. 여정 중에 옮기면 지금 여정이 접히므로 **두 번 눌러**
 * 확인한다. 열렸는가는 save.bossDepth 하나로 계산한다 (game/stages.ts checkpointStage) —
 * 같은 보스를 다시 잡아도 깊이는 안 는다 (2026-09-10 형의 반려).
 *
 * 좌표는 DOM 측정 없이 전부 수식에서 나온다. 레이아웃이 깨질 여지를 안 남기기 위해서다.
 */
import { BOSS_EVERY, CAMPAIGN, STAGES, checkpointStage } from '../game/stages.ts'
import { STAR_MAX } from '../game/rewards.ts'
import { INK, drawMapArt, hash01 } from './mapart.ts'
import type { Overlay } from './overlay.ts'

const PANEL_ID = 'map'
const ROW_LEN = BOSS_EVERY
const ROWS = Math.ceil(CAMPAIGN / ROW_LEN)

// ── 판 배치 기하 (px, DOM 측정 없이 이 숫자에서 전부 나온다) ──
/** 위 띠 — 표제와 나침반의 자리. 길은 여기까지 안 올라온다. */
const HEAD = 74
const PAD = 24
/** 왼쪽 지명 띠. */
const LABEL_W = 58
const NODE_R = 12
const STEP_X = 46
const STEP_Y = 62
/** 아래 가장자리의 바다 띠. */
const SEA_H = 34

const BOARD_W = PAD * 2 + LABEL_W + (ROW_LEN - 1) * STEP_X + NODE_R * 2
const ROW_Y = Array.from({ length: ROWS }, (_, r) => HEAD + PAD + r * STEP_Y + NODE_R)
const SEA_Y = (ROW_Y[ROWS - 1] as number) + NODE_R + 18
const BOARD_H = SEA_Y + SEA_H + PAD

/** 장마다의 지명. "1장"은 목차의 말이고 지명은 지도의 말이다. */
const PLACES: readonly string[] = ['활터', '솔숲', '바람재', '돌다리', '높은재']
const NUMERALS: readonly string[] = ['一', '二', '三', '四', '五']

interface Pt { x: number; y: number }

/**
 * 판 번호(1-based) → 화면 중심 좌표. 줄마다 방향이 뒤집히는 뱀 놀이판 수식 위에,
 * 판 번호에서 뽑은 **고정 흔들림**(±3px)을 얹는다 — 자로 잰 듯 곧은 길은 길처럼 안 보인다.
 * 해시라 열 때마다 같은 자리다 (ui/mapart.ts hash01).
 */
function centerOf(n: number): Pt {
  const idx = n - 1
  const r = Math.floor(idx / ROW_LEN)
  const c = idx % ROW_LEN
  const vc = r % 2 === 0 ? c : ROW_LEN - 1 - c
  return {
    x: PAD + LABEL_W + vc * STEP_X + NODE_R + (hash01(n * 2) - 0.5) * 6,
    y: (ROW_Y[r] as number) + (hash01(n * 2 + 1) - 0.5) * 6,
  }
}

/** 점들을 중점 이차곡선으로 잇는다 — 꺾이지 않고 굽는 길. */
function roadPath(pts: readonly Pt[]): string {
  if (pts.length < 2) return ''
  const p0 = pts[0] as Pt
  let d = `M ${p0.x} ${p0.y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i] as Pt
    const b = pts[i + 1] as Pt
    d += ` Q ${a.x} ${a.y} ${(a.x + b.x) / 2} ${(a.y + b.y) / 2}`
  }
  const last = pts[pts.length - 1] as Pt
  d += ` L ${last.x} ${last.y}`
  return d
}

/** 지도를 키우는 상한. 이보다 키우면 획이 뭉툭해지고 글자만 큰 지도가 된다. */
const MAP_MAX_SCALE = 1.7

const CSS = `
.map-lead { color: var(--dim); font-size: 14px; margin: 4px 0 14px; }
.map-lead b { color: var(--teal); font-weight: 700; font-family: inherit; }
/* 종이는 ${BOARD_W}px 고정이다 — 폰(360~390px)에는 안 들어간다. 가로 스크롤로 밀어놓으면
   조준 중인 화면에서 손가락 드래그를 훔치므로, **통째로 줄여서** 다 보이게 한다.
   배율은 열릴 때 JS가 --map-s 에 넣는다 (calc으로는 길이÷길이를 배수로 못 만든다). */
.map-fit { width: 100%; overflow: hidden; }
.map-wrap {
  position: relative; width: ${BOARD_W}px; height: ${BOARD_H}px; margin: 0 auto;
  transform: scale(var(--map-s, 1)); transform-origin: top center;
  /* 종이 한 장이 화면 위에 놓여 있다 — 그림자가 그 말을 한다. */
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, .45));
}
.map-wrap svg { position: absolute; inset: 0; display: block; }
/* 바탕(종이·산·강)은 클릭을 안 먹는다. 지도의 주인공은 길 위의 칸이다. */
.mp-art, .mp-road { pointer-events: none; }
.mp-node { cursor: default; }
.mp-node.hit { cursor: pointer; }
.mp-node.hit:hover .mp-ring { opacity: 1; }
.map-foot { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 16px; color: var(--mute); font-size: 13px; }
.map-foot b { color: var(--gold); }
`

const SVG_NS = 'http://www.w3.org/2000/svg'
function el(tag: string, attrs: Record<string, string> = {}): SVGElement {
  const e = document.createElementNS(SVG_NS, tag)
  for (const k in attrs) e.setAttribute(k, attrs[k] as string)
  return e
}

interface NodeEl {
  n: number
  g: SVGElement
  dot: SVGElement
  label: SVGElement
  /** 체크포인트의 문(門). 없으면 null. */
  gate: SVGElement | null
  /** 3성 표시 겹테. */
  ring: SVGElement
}

let curStars: Readonly<Record<string, number>> = {}
let curBossDepth = 0
let curBestRunStage = 0
let onJumpFn: ((index0: number) => void) | null = null
let refreshFn: (() => void) | null = null

function stageIdOf(n: number): string {
  const s = STAGES[n - 1]
  return s?.id ?? `${Math.floor((n - 1) / ROW_LEN) + 1}-${((n - 1) % ROW_LEN) + 1}`
}

/**
 * 지도를 오버레이에 붙인다. `stars`·`bossKills`·`bestRunStage`·`runActive`는 여는 순간
 * 다시 읽는다 — updateMap으로 최신을 넘기면 화면이 그때그때 최신을 그린다.
 */
export function mountMap(
  o: Overlay,
  stars: Readonly<Record<string, number>>,
  bossDepth: number,
  bestRunStage: number,
  runActive: boolean,
  onJump: (index0: number) => void,
): void {
  curStars = stars
  curBossDepth = bossDepth
  curBestRunStage = bestRunStage
  void runActive
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
  const svg = el('svg', { width: String(BOARD_W), height: String(BOARD_H), viewBox: `0 0 ${BOARD_W} ${BOARD_H}` })
  wrap.appendChild(svg)

  // ── ① 바탕 — 종이·산줄기·물길·바다·나침반·표제 (ui/mapart.ts) ──
  const art = el('g', { class: 'mp-art' })
  svg.appendChild(art)
  drawMapArt(art, BOARD_W, BOARD_H, ROW_Y, SEA_Y)

  // ── ② 지명 — 장마다 왼쪽에. 번호는 한자, 이름은 우리말. ──
  for (let r = 0; r < ROWS; r++) {
    const y = ROW_Y[r] as number
    const num = el('text', {
      x: String(PAD + LABEL_W - 10), y: String(y - 4), 'text-anchor': 'end',
      fill: INK.inkSoft, 'font-size': '10', 'letter-spacing': '1',
    })
    num.setAttribute('font-family', 'var(--serif)')
    num.textContent = `${NUMERALS[r] ?? ''}章`
    const name = el('text', {
      x: String(PAD + LABEL_W - 10), y: String(y + 10), 'text-anchor': 'end',
      fill: INK.ink, 'font-size': '12.5', 'letter-spacing': '1',
    })
    name.setAttribute('font-family', 'var(--serif)')
    name.textContent = PLACES[r] ?? ''
    art.append(num, name)
  }

  // ── ③ 길 — 아직 안 간 길은 점선, 지나온 길은 먹으로 짙게 그 위에. ──
  const pts: Pt[] = []
  for (let n = 1; n <= CAMPAIGN; n++) pts.push(centerOf(n))
  const road = el('g', { class: 'mp-road' })
  const roadBase = el('path', {
    d: roadPath(pts), fill: 'none', stroke: INK.roadAhead, 'stroke-width': '5',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.5',
  })
  const roadDash = el('path', {
    d: roadPath(pts), fill: 'none', stroke: INK.road, 'stroke-width': '1.6',
    'stroke-dasharray': '5 5', 'stroke-linecap': 'round', opacity: '0.75',
  })
  const roadDone = el('path', {
    d: '', fill: 'none', stroke: INK.ink, 'stroke-width': '3.2',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.9',
  })
  road.append(roadBase, roadDash, roadDone)
  svg.appendChild(road)

  /** 여정 중 점프는 두 번 눌러야 간다. 무장한 판 번호(0=없음)와 해제 타이머. */
  const ARM_MS = 4000
  let armed = 0
  let armTimer = 0
  const disarm = (): void => {
    window.clearTimeout(armTimer)
    if (armed !== 0) {
      const q = nodes.find((z) => z.n === armed)
      if (q !== undefined) q.dot.setAttribute('data-arm', '0')
    }
    armed = 0
    refreshFn?.()
  }

  // ── ④ 칸 — 마을(원) · 귀신(붉은 인장) · 관문(문). ──
  const nodes: NodeEl[] = []
  const nodeLayer = el('g', {})
  svg.appendChild(nodeLayer)
  for (let n = 1; n <= CAMPAIGN; n++) {
    const { x, y } = centerOf(n)
    const isBoss = n % ROW_LEN === 0
    const isCkpt = n % ROW_LEN === 1
    const g = el('g', { class: 'mp-node' })
    g.setAttribute('role', 'button')
    const title = el('title')
    title.textContent = `${n}판 (${stageIdOf(n)})`
    g.appendChild(title)

    // 3성 겹테 — 평소엔 안 보이고, 다 딴 칸과 hover 에만 뜬다.
    const ring = el('circle', {
      class: 'mp-ring', cx: String(x), cy: String(y), r: String(NODE_R + 3.5),
      fill: 'none', stroke: INK.gold, 'stroke-width': '1.2', opacity: '0',
    })
    g.appendChild(ring)

    let gate: SVGElement | null = null
    if (isCkpt) {
      // 관문(門) — 기둥 둘에 지붕 하나. 여기서만 여정을 시작할 수 있다.
      gate = el('path', {
        d: `M ${x - 10} ${y - NODE_R - 4} L ${x + 10} ${y - NODE_R - 4}`
          + ` M ${x - 12} ${y - NODE_R - 4} L ${x + 12} ${y - NODE_R - 4}`
          + ` M ${x - 7} ${y - NODE_R - 4} L ${x - 7} ${y - NODE_R + 4}`
          + ` M ${x + 7} ${y - NODE_R - 4} L ${x + 7} ${y - NODE_R + 4}`,
        stroke: INK.ink, 'stroke-width': '1.6', fill: 'none', 'stroke-linecap': 'round',
      })
      g.appendChild(gate)
    }

    // 몸통 — 보스는 붉은 인장(마름모), 나머지는 마을(원).
    const dot = isBoss
      ? el('rect', {
        x: String(x - NODE_R * 0.78), y: String(y - NODE_R * 0.78),
        width: String(NODE_R * 1.56), height: String(NODE_R * 1.56), rx: '2',
        transform: `rotate(45 ${x} ${y})`, fill: INK.seal, stroke: '#7d1f18', 'stroke-width': '1',
      })
      : el('circle', { cx: String(x), cy: String(y), r: String(NODE_R), fill: INK.paper0, stroke: INK.ink, 'stroke-width': '1.3' })
    g.appendChild(dot)

    const label = el('text', {
      x: String(x), y: String(y + 3.4), 'text-anchor': 'middle',
      fill: isBoss ? '#fff2dc' : INK.ink, 'font-size': isBoss ? '10' : '9.5',
    })
    label.setAttribute('font-family', isBoss ? 'var(--serif)' : 'var(--num)')
    label.textContent = isBoss ? '鬼' : String(n)
    g.appendChild(label)

    if (!isCkpt) {
      g.addEventListener('click', () => {
        o.toast('문(門)이 있는 칸에서만 출발할 수 있다 — 각 장의 첫 판이다', 2600)
      })
    } else {
      g.classList.add('hit')
      g.addEventListener('click', () => {
        // ★ 못 가는 칸도 **이유를 말한다** (2026-08-31, 형: "아직도 스테이지 이동이 안돼").
        //   예전엔 조건이 안 맞으면 조용히 return 했다 — 눌러도 아무 일이 없으니
        //   고장 난 것과 구별이 안 됐다. 화면은 거절할 때 반드시 말해야 한다.
        if (n - 1 > checkpointStage(curBossDepth)) {
          const need = Math.max(1, Math.floor((n - 1) / ROW_LEN)) * ROW_LEN
          o.toast(`${need}판 귀신을 잡아야 이 문이 열린다`, 3000)
          return
        }
        // ── 여정 중이라면 두 번 눌러야 간다 ──
        // 지도 점프는 새 여정을 여는 일이고, 지금 여정은 거기서 접힌다. 실수로 잃지 않게
        // 한 번 묻는다 (성장 화면의 '기록 삭제'와 같은 문법). 확인은 **언제나** 받는다 —
        // runActive 는 판이 시작될 때 갱신된다는 보장이 없어 그 값으로 흐름을 가르면 조용히 어긋난다.
        if (armed !== n) {
          disarm()
          armed = n
          dot.setAttribute('data-arm', '1')
          refreshFn?.()
          armTimer = window.setTimeout(disarm, ARM_MS)
          o.toast(`한 번 더 누르면 ${n}판부터 새 여정 — 지금 여정은 여기서 접힌다`, ARM_MS)
          return
        }
        disarm()
        onJumpFn?.(n - 1)
        o.hide(true)
      })
    }
    nodeLayer.appendChild(g)
    nodes.push({ n, g, dot, label, gate, ring })
  }

  // ── ⑤ 여기까지 왔다 — 붉은 깃발. 지도에서 제일 중요한 한 점이다. ──
  const flag = el('g', { opacity: '0' })
  const flagPole = el('line', { stroke: INK.ink, 'stroke-width': '1.4', 'stroke-linecap': 'round', x1: '0', y1: '0', x2: '0', y2: '0' })
  const flagCloth = el('path', { fill: INK.seal, opacity: '0.92', d: '' })
  flag.append(flagPole, flagCloth)
  svg.appendChild(flag)

  // 판을 담는 칸. 여기 폭에 맞춰 종이 전체를 줄인다 (CSS .map-fit 주석).
  const fit = document.createElement('div')
  fit.className = 'map-fit'
  fit.appendChild(wrap)
  panel.appendChild(fit)

  /**
   * 종이를 칸 폭에 맞춰 줄인다. transform은 레이아웃 높이를 바꾸지 않으므로
   * 담는 칸의 높이도 같이 줄여 준다 — 안 그러면 종이 아래로 빈 공간이 남는다.
   * 패널이 닫혀 있으면 폭이 0이라 아무것도 하지 않는다 (열릴 때 다시 부른다).
   */
  const fitBoard = (): void => {
    const avail = fit.clientWidth
    if (avail <= 0) return
    // ★ 줄이기만 하던 것을 **키우기도** 한다 (2026-09-11, 형: "빈공간이 너무 많아서").
    //   종이는 ${BOARD_W}px 고정이라, 넓어진 판에서는 좌우가 통째로 빈 막이었다.
    //   상한을 두는 이유: 그 이상 키우면 획이 뭉툭해지고 글자만 커진 지도가 된다.
    const k = Math.min(MAP_MAX_SCALE, avail / BOARD_W)
    fit.style.setProperty('--map-s', String(k))
    fit.style.height = `${Math.ceil(BOARD_H * k)}px`
  }

  const foot = document.createElement('div')
  foot.className = 'map-foot'
  foot.innerHTML = '<b>문(門)</b>이 그려진 칸이 지금 열린 관문이다 — 눌러서 그 판부터 새 여정을 연다. '
    + '여정 중에 옮기면 지금 여정은 거기서 접힌다 — 두 번 눌러 확인한다.'
  panel.appendChild(foot)

  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'hb-btn'
  open.innerHTML = '<i class="hb-ic i-map"></i><span class="hb-lbl">지도</span>'
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
      ? `가장 멀리 <b>${far}판</b>${far > CAMPAIGN ? ' · 캠페인 너머' : ''}`
      : '아직 첫 여정 전이다.'

    // 지나온 길 — 도달한 칸까지만 짙게.
    const travelEnd = Math.max(0, Math.min(far, CAMPAIGN))
    roadDone.setAttribute('d', travelEnd >= 2 ? roadPath(pts.slice(0, travelEnd)) : '')

    // 깃발 — 지나온 끝의 칸 위에.
    if (travelEnd >= 1) {
      const p = pts[travelEnd - 1] as Pt
      const top = p.y - NODE_R - 22
      flagPole.setAttribute('x1', String(p.x))
      flagPole.setAttribute('y1', String(p.y - NODE_R - 2))
      flagPole.setAttribute('x2', String(p.x))
      flagPole.setAttribute('y2', String(top))
      flagCloth.setAttribute('d', `M ${p.x} ${top} L ${p.x + 15} ${top + 4.5} L ${p.x} ${top + 9} Z`)
      flag.setAttribute('opacity', '1')
    } else {
      flag.setAttribute('opacity', '0')
    }

    const ckptOpen = checkpointStage(curBossDepth)
    for (const { n, g, dot, gate, ring } of nodes) {
      const s = curStars[stageIdOf(n)] ?? 0
      const isBoss = n % ROW_LEN === 0
      const isCkpt = n % ROW_LEN === 1
      const armedHere = dot.getAttribute('data-arm') === '1'

      if (!isBoss) {
        // 밟아본 마을은 먹으로 채운다 — 지도에서 "다녀왔다"는 색으로 말한다.
        dot.setAttribute('fill', s > 0 ? '#c8b48c' : INK.paper0)
        dot.setAttribute('opacity', n <= Math.max(travelEnd, ckptOpen + 1) ? '1' : '0.55')
      }
      ring.setAttribute('opacity', s >= STAR_MAX ? '1' : '0')

      if (isCkpt && gate !== null) {
        const unlocked = n - 1 <= ckptOpen
        const col = armedHere ? INK.seal : unlocked ? INK.gold : INK.inkSoft
        gate.setAttribute('stroke', col)
        gate.setAttribute('opacity', unlocked ? '1' : '0.4')
        dot.setAttribute('stroke', col)
        dot.setAttribute('stroke-width', unlocked ? '2.2' : '1.3')
        if (armedHere) dot.setAttribute('fill', '#f0c9a0')
        g.classList.toggle('hit', unlocked)
      }
    }
  }

  refreshFn = refresh
  o.onDispose(() => { refreshFn = null })
  refresh()
}

/** 세이브가 바뀌었다 (판 클리어·보스 처치·여정 시작/종료). 화면이 열려 있지 않아도 불러도 된다. */
export function updateMap(
  stars: Readonly<Record<string, number>>,
  bossDepth: number,
  bestRunStage: number,
  runActive: boolean,
): void {
  curStars = stars
  curBossDepth = bossDepth
  curBestRunStage = bestRunStage
  // 여정 진행 여부는 화면이 안 쓴다 — 점프는 언제나 두 번 눌러 확인한다 (클릭 핸들러 주석).
  void runActive
  refreshFn?.()
}
