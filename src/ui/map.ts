/**
 * 지도 (2026-08-26, 형: "지도 버튼도 만들어서 지도로 여행의 재미를 더해야겠어").
 *
 * 캠페인 50판을 주사위판처럼 구불구불하게 배치한다 — 챕터(10판)마다 한 줄, 줄마다
 * 진행 방향이 뒤집힌다(뱀 놀이판 문법). 10번째마다 보스(마름모), 각 줄의 첫 칸(n-1,
 * 즉 1-1·2-1·3-1·4-1·5-1)은 체크포인트다. 그 앞 보스를 잡아본 적이 있으면 노란색으로
 * 켜지고, 눌러서 그 판부터 새 여정을 연다 (형: "보스깨면 죽었을때 직전보스 다음스테이지
 * 부터 시작하게 하고... n-1들은 노란색으로 눌러서 그 스테이지로 바로 이동할수 있게").
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

const CSS = `
.map-lead { color: var(--dim); font-size: 14px; margin: 4px 0 16px; }
.map-lead b { color: var(--teal); font-weight: 700; font-family: inherit; }
.map-board { display: flex; flex-direction: column; gap: 8px; }
.map-row { display: flex; align-items: center; gap: 8px; }
.map-row.rev { flex-direction: row-reverse; }
.map-ch {
  flex: 0 0 56px; color: var(--dim); font-size: 12px; letter-spacing: .08em;
  text-align: center;
}
.map-nodes { display: flex; gap: 6px; }
.map-row.rev .map-nodes { flex-direction: row-reverse; }
.map-node {
  width: 28px; height: 28px; border-radius: 50%; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--num); font-size: 10.5px; color: var(--mute);
  background: #10171f; border: 1px solid #202a35;
}
.map-node.done { background: #152029; border-color: #2c3846; color: #93a0b0; }
.map-node.full { background: #1d2530; border-color: #3a4655; color: var(--accent); }
/* 보스 — 마름모. 판별 별 격자·수집 화면과 같은 문법이다. */
.map-node.boss { border-radius: 4px; transform: rotate(45deg); width: 24px; height: 24px; }
.map-node.boss span { display: block; transform: rotate(-45deg); }
/* 체크포인트 — 열리면 노랑(강조색), 잠기면 흐리게. 열린 것만 누를 수 있다. */
.map-node.ckpt.unlocked {
  background: var(--accent); border-color: var(--accent); color: #0b0e13; font-weight: 700;
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

  const board = document.createElement('div')
  board.className = 'map-board'
  const nodes: NodeEl[] = []
  const rows = Math.ceil(CAMPAIGN / ROW_LEN)
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div')
    row.className = r % 2 === 1 ? 'map-row rev' : 'map-row'
    const chLabel = document.createElement('div')
    chLabel.className = 'map-ch'
    chLabel.textContent = `${r + 1}장`
    const nodesWrap = document.createElement('div')
    nodesWrap.className = 'map-nodes'
    for (let c = 0; c < ROW_LEN; c++) {
      const n = r * ROW_LEN + c + 1
      if (n > CAMPAIGN) break
      const el = document.createElement('div')
      el.className = 'map-node'
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
      nodesWrap.appendChild(el)
      nodes.push({ n, el, span })
    }
    row.append(chLabel, nodesWrap)
    board.appendChild(row)
  }
  panel.appendChild(board)

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
  const isOpen = (): boolean => o.visible() && panel.classList.contains('hb-open')
  open.addEventListener('click', () => {
    if (isOpen()) {
      o.hide()
      return
    }
    refresh()
    o.show(PANEL_ID)
  })
  o.hud().appendChild(open)

  function refresh(): void {
    const far = curBestRunStage
    lead.innerHTML = far > 0
      ? `최고 도달 <b>${far}판</b>${far > CAMPAIGN ? ' · 캠페인 너머' : ''}`
      : '아직 첫 여정 전이다.'
    for (const { n, el, span } of nodes) {
      const id = stageIdOf(n)
      const stars = curStars[id] ?? 0
      const isCkpt = el.classList.contains('ckpt')
      el.classList.toggle('done', stars > 0)
      el.classList.toggle('full', stars >= STAR_MAX)
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
