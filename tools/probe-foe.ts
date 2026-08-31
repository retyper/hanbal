/**
 * 적 크기 프로브 — **창가의 사수가 사람으로 보이는가** (2026-08-31, 형: "가끔 창문이
 * 너무 작아서 적이 거의 안보이는 경우 있는데 (…) 최소 적군사람 머리랑 상체 나올만큼은
 * 크게 만들어").
 *
 * 창 크기는 사수 반경 r에서 나온다 (render/buildings.ts CELL: 반너비 1.3r · 반높이 1.05r).
 * 그리는 사람도 같은 r을 쓴다 — 그래서 **r이 작으면 창도 사람도 같이 작아진다.**
 * 여기서는 판별 사수 반경과 그 창의 실치수(m)를 재서, 사람으로 안 읽히는 판을 골라낸다.
 */
import { getStage } from '../src/game/stages.ts'
import { P } from '../src/tune/params.ts'

/** 창 반너비·반높이 (render/buildings.ts CELL). */
const WIN_HW = 1.3
const WIN_HH = 1.05
/** 사람으로 읽히는 하한 — 창의 **높이**(2×hh)가 이보다 작으면 머리+상체가 안 나온다. */
const NEED_H = 1.0

const pad = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length))
const num = (v: number, n = 6): string => {
  const s = v.toFixed(2)
  return s.length >= n ? s : ' '.repeat(n - s.length) + s
}

console.log('── 창가의 사수 — 창 실치수 (m) ─────────────────────────')
console.log('판    사수  최소r   창 W×H(m)   판정')
let bad = 0
let rows = 0
for (let n = 11; n <= 50; n++) {
  const st = getStage(n - 1)
  const foes = st.targets.filter((t) => t.kind === 'archer' && (t.look ?? 0) !== 3)
  if (foes.length === 0) continue
  let minR = Number.POSITIVE_INFINITY
  for (const t of foes) minR = Math.min(minR, t.r ?? 0)
  const w = minR * WIN_HW * 2
  const h = minR * WIN_HH * 2
  const ok = h >= NEED_H
  if (!ok) bad++
  rows++
  console.log(
    pad(`${n}판`, 6) + num(foes.length, 4) + num(minR) + '  ' +
    num(w) + '×' + num(h) + '   ' + (ok ? '✓' : '✗ 너무 작다'),
  )
}
console.log(`\n  foeR = ${P.enemy.foeR} · 창 높이 하한 ${NEED_H}m`)
console.log(bad === 0 ? '  전부 통과 ✓' : `  ✗ ${bad}/${rows} 판의 창이 사람보다 작다`)

// ── 2. 돌진하는 적 — **발이 땅에 닿는가** ──────────────────────
//
// 2026-08-31, 형: "척후는 비행체가 아니라 칼을 들고 나에게 달려오는 사람모습이어야해."
// 사람으로 그리려면 먼저 **땅 위에 서 있어야** 한다. 그전에는 1.3~3.2m 상공이라
// 어떻게 그려도 떠 있는 물건이었다. 규칙은 sim/world.ts 한 곳에 있다 (중심 높이 = 반경).
{
  const { createWorld } = await import('../src/sim/world.ts')
  const { applyFork, forkOptions, hasFork } = await import('../src/game/forks.ts')
  const { endlessStage } = await import('../src/game/endless.ts')
  const { CAMPAIGN_STAGES } = await import('../src/game/stagekit.ts')

  const STATS = { str: 10, steady: 8, stamina: 8, focus: 6 }
  // 카드는 뽑기에서만 나온다 — 판을 훑어 '척후'가 뜨는 첫 판에서 한 장 집는다.
  let scout = null
  for (let n = 1; n <= 200 && scout === null; n++) {
    if (!hasFork(n)) continue
    for (const o of forkOptions(n, getStage(n - 1))) if (o.id === 'scout') scout = o
  }
  console.log('\n── 돌진하는 적 — 발이 땅에 닿는가 ──────────────────────')
  console.log('판       수   r(m)   중심y   발끝y   판정')

  let off = 0
  const check = (label: string, stage: ReturnType<typeof endlessStage>): void => {
    const w = createWorld(stage, STATS)
    const cs = w.targets.filter((t) => t.alive && t.kind === 'charger')
    if (cs.length === 0) return
    for (const c of cs) {
      const foot = c.y - c.r
      const ok = Math.abs(foot) < 1e-6
      if (!ok) off++
      console.log(
        pad(label, 8) + num(cs.length, 4) + num(c.r) + num(c.y) + num(foot) +
        '   ' + (ok ? '✓' : '✗ 떠 있다'),
      )
    }
  }

  if (scout !== null) {
    for (const n of [12, 23, 37]) {
      check(`${n}판 척후`, applyFork(getStage(n - 1), scout, n) as never)
    }
  }
  // 무한 구간의 '돌진' 판 — index 는 0부터 세는 전체 판 번호다. 캠페인 뒤부터 훑는다.
  for (let i = CAMPAIGN_STAGES; i < CAMPAIGN_STAGES + 80; i++) {
    const st = endlessStage(i)
    if (st.targets.some((t) => t.kind === 'charger')) {
      check(`무한 ${i + 1}`, st)
      break
    }
  }
  console.log(off === 0 ? '  전부 땅을 딛는다 ✓' : `  ✗ ${off}이 떠 있다`)
}
