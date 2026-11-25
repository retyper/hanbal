/**
 * 전장 소리 기록 — 헤드리스로 한 판을 돌리며 소리 모델이 틀 것을 초마다 적는다 (F3e · 소리는 못 들으니 사건 → 소리를 표로 본다)
 *
 *   node --experimental-strip-types tools/field-sound-log.ts [씨앗=3] [병력=1200]   → tools/out/sound/seed<씨앗>-log.txt
 *
 * 엔진 한 판(양쪽 임시 AI · 입력 없음)을 틱마다 돌리고, 그리기 프레임처럼 한 틱에 한 번 소리 모델에 읽혀 준다.
 * 카메라는 판 전체가 보이는 한 자리(맞춤 배율)이다. 시계는 틱 × (1000 / hz) ms 로 가정한다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createField, stepField } from '../src/field/sim.ts'
import { plainSetup } from '../src/field/scenario.ts'
import { P } from '../src/tune/params.ts'
import { eventsFromDiff, loopTargets, newSoundState, planLoops, stepSound } from '../src/field/mainSoundModel.ts'
import { soundFrameOf } from '../src/field/mainSound.ts'
import type { LoopRun, SoundCam } from '../src/field/mainSoundModel.ts'

export function soundLog(seed: number, men: number): { text: string; counts: Record<string, number>; maxPlays: number; starts: Record<string, number> } {
  const s = createField(plainSetup(seed, men, true))
  const cellPx = P.field.cellPx
  const cam: SoundCam = { x: s.map.u * cellPx / 2, y: s.map.w * cellPx / 2, zoom: 1, vpW: s.map.u * cellPx, vpH: s.map.w * cellPx, zoomRel: 1 }
  let st = newSoundState()
  const perSec = new Map<number, { plays: Map<string, { n: number; max: number }>; loops: Map<string, number> }>()
  const counts: Record<string, number> = {}
  let maxPlays = 0
  // 이어지는 소리 고리가 새로 시작된 횟수 (planLoops 의 start · 재생 쪽이 하는 것과 같다)
  let run: Record<string, LoopRun> = {}
  const starts: Record<string, number> = {}
  const msPerTick = 1000 / P.field.hz
  const maxTicks = P.field.timesMax * P.field.timeSec * P.field.hz
  for (let i = 0; i < maxTicks && s.end === null; i++) {
    stepField(s)
    const now = s.tick * msPerTick
    const fr = soundFrameOf(s, [1000, 1000])
    const out = stepSound(st, fr, cam, eventsFromDiff(st.last, fr), now, false)
    st = out.state
    maxPlays = Math.max(maxPlays, out.plays.length)
    const lp = planLoops(run, loopTargets(out.loops), now)
    run = lp.run
    for (const a of lp.actions) if (a.op === 'start') starts[a.slot] = (starts[a.slot] ?? 0) + 1
    const sec = Math.floor(now / 1000)
    const row = perSec.get(sec) ?? { plays: new Map(), loops: new Map() }
    perSec.set(sec, row)
    for (const p of out.plays) {
      const c = row.plays.get(p.slot) ?? { n: 0, max: 0 }
      c.n++; c.max = Math.max(c.max, p.vol); row.plays.set(p.slot, c)
      counts[p.slot] = (counts[p.slot] ?? 0) + 1
    }
    for (const l of out.loops) {
      row.loops.set(l.slot, Math.max(row.loops.get(l.slot) ?? 0, l.vol))
      counts[l.base] = (counts[l.base] ?? 0) + 1
    }
  }
  const lines = [`씨앗 ${seed} · 병력 ${men} · ${s.tick} 틱 (${(s.tick / P.field.hz).toFixed(1)}초) · 끝 ${s.end} · 이긴 편 ${s.winner}`, '초\t한 번 소리(자리 ×횟수 · 가장 큰 크기)\t이어지는 소리(자리 · 가장 큰 크기)']
  for (const [sec, row] of [...perSec].sort((a, b) => a[0] - b[0])) {
    const pl = [...row.plays].map(([k, v]) => `${k}×${v.n}(${v.max.toFixed(2)})`).join(' ')
    const lp = [...row.loops].map(([k, v]) => `${k}(${v.toFixed(2)})`).join(' ')
    lines.push(`${sec}\t${pl || '-'}\t${lp || '-'}`)
  }
  lines.push('', '고리 새로 시작한 횟수: ' + (Object.entries(starts).sort().map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'))
  lines.push('합계: ' + Object.entries(counts).sort().map(([k, v]) => `${k} ${v}`).join(' · '), `한 프레임 최대 소리 ${maxPlays} (상한 ${P.field.soundVoicesMax})`)
  return { text: lines.join('\n') + '\n', counts, maxPlays, starts }
}

if (process.argv[1] !== undefined && path.basename(process.argv[1]) === 'field-sound-log.ts') {
  const seed = Number(process.argv[2] ?? 3), men = Number(process.argv[3] ?? 1200)
  const r = soundLog(seed, men)
  const dir = path.resolve(import.meta.dirname, 'out/sound')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `seed${seed}-log.txt`)
  fs.writeFileSync(file, r.text)
  console.log(`${file}\n` + r.text.split('\n').slice(0, 4).join('\n'))
}
