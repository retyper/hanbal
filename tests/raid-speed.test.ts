// 열전 판 빠르기 ×1 · ×2 · ×3 (11-19 형) — 걸음 크기는 그대로, 한 프레임에 걸음을 더 돌릴 뿐이라 같은 입력이면 같은 판 · 같은 기록 (A1)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_SPEED as SP } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, type HaebiRun } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { startRecord, recInput, recPick, finishRecord, replayRaid, STEP } from '../src/raid/runlog.ts'
import { runFrame, speedOf, nextSpeed, speedLevel } from '../src/raid/speed.ts'

const hash = (s: HaebiRun) => JSON.stringify(s)

/** 화면(raid-main frame)처럼 돈다 — 들쭉날쭉한 프레임 시간 · 빠르기 배수 · 시전 동안 ×1 · 레벨업 카드는 프레임 밖에서 봇이 고른다 · 걸음 수 steps 에서 멈춤 */
function playAt(mult: number, steps: number) {
  const s = createHaebi(20261119, 'stage', 'sword', { stage: 'forest', awaken: true })
  const r = startRecord(s, { id: 'speed', started: 'x', mode: 'stage', stage: 'forest', hero: 'haebi', kit: 'sword', sprite: 'haebi', seed: 20261119, opts: { stage: 'forest', awaken: true }, from: null })
  let acc = 0, frame = 0, casts = 0
  while (r.g.steps < steps && s.state === 'playing') {
    if (s.offers.length) { const p = botChoice(s, 'spread'); if (choose(s, p)) recPick(r, p); continue }
    const dt = [1 / 60, 1 / 144, 1 / 30, .1][frame++ % 4]!
    acc = runFrame(acc, dt, () => s.cast ? 1 : mult, () => {
      const before = s.cast
      // 비기는 판 시각으로 누른다 (화면이 맡아 두는 누름과 같은 꼴 · 판 시각이라 빠르기와 상관없다)
      stepHaebi(s, recInput(r, { ...botInput(s, .45), skill: Math.floor(s.t * 2) % 7 === 0 }), STEP)
      if (s.cast && s.cast !== before) casts++
      return !s.offers.length && s.state === 'playing' && r.g.steps < steps
    })
  }
  return { s, g: finishRecord(r, 0, 'x'), frames: frame, casts }
}

test('판 빠르기: ×1 로 돈 판과 ×2·×3 로 돈 판이 같은 입력이면 같은 판 · 같은 기록 · 다시 돌려도 같다', () => {
  const N = 120 * 150   // 판 시각 150초
  const one = playAt(1, N), two = playAt(2, N), three = playAt(3, N)
  assert.ok(one.s.level >= 2 && one.casts > 0, `레벨업·비기 시전을 지나는 판 (Lv.${one.s.level} · 시전 ${one.casts})`)
  assert.equal(three.g.steps, one.g.steps)
  assert.equal(hash(two.s), hash(one.s), '×2 판 상태 전체가 ×1 과 같다')
  assert.equal(hash(three.s), hash(one.s), '×3 판 상태 전체가 ×1 과 같다')
  assert.equal(three.g.input, one.g.input, '기록(입력 흐름)도 같다')
  assert.equal(hash(replayRaid(three.g)), hash(one.s), '×3 기록을 다시 돌리면 같은 판')
  assert.ok(three.frames < one.frames * .5, `×3 는 프레임이 적게 든다 (${three.frames} < ${one.frames})`)
})

test('판 빠르기: 프레임마다 걸음 수 · 시전 동안 ×1 · 카드가 뜨면 남은 시간을 버린다', () => {
  let n = 0
  const left = runFrame(0, 1 / 60, () => 3, () => { n++; return true })
  assert.equal(n, 6, '×3 이면 1/60초 프레임에 걸음 여섯 (×1 은 둘)')
  assert.ok(Math.abs(left) < 1e-6, `남는 시간이 거의 없다 (${left})`)
  n = 0; runFrame(0, 1 / 60, () => 1, () => { n++; return true }); assert.equal(n, 2)
  // 둘째 걸음에서 시전이 서면 그 뒤로는 ×1
  n = 0; let cast = false
  runFrame(0, 1 / 60, () => cast ? 1 : 3, () => { n++; if (n === 2) cast = true; return true })
  assert.equal(n, 2 + Math.floor((1 / 60 - 2 * STEP / 3) / STEP + 1e-9), '시전이 선 뒤로는 ×1 걸음')
  n = 0; assert.equal(runFrame(0, .1, () => 3, () => { n++; return n < 4 }), 0, '카드가 뜨면 남은 시간은 버린다'); assert.equal(n, 4)
  // 단계 ×1 → ×2 → ×3 → ×1 · 기기 칸 값 다듬기
  assert.deepEqual(SP.steps, [1, 2, 3])
  assert.equal(nextSpeed(0), 1); assert.equal(nextSpeed(1), 2); assert.equal(nextSpeed(2), 0)
  assert.equal(speedOf(2), 3); assert.equal(speedLevel('9'), 2); assert.equal(speedLevel(null), 0); assert.equal(speedLevel('x'), 0); assert.equal(speedLevel(-1), 0)
})
