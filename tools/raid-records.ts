/**
 * 형의 열전 판 기록 읽기 (11-23 형 「내 플레이 기록이랑 금으로 산 능력치도 감안해서 확인해 · 플레이 데이터니까」).
 * 판 기록 JSON(RaidGame[] — 기기 칸 hanbal.raid.games 또는 서버 users/{uid}/raids 를 풀어 모은 것)을 받아 판마다 다시 돌려
 *   언제 몇 레벨이었나(5분마다) · 만렙에 닿은 때 · 가장 낮았던 체력 · 찍은 점(무기 나무) · 만렙 칸 · 상점 능력치 · 결과 를 한 줄씩.
 *   node --experimental-strip-types tools/raid-records.ts <판기록.json> [--csv 나갈.csv]
 * 입력이 잘린 판(cut)은 다시 돌리지 못해 기록에 적힌 끝만 적는다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { replayRaid } from '../src/raid/runlog.ts'
import { POWERS } from '../src/raid/haebi.ts'
import type { RaidGame } from '../src/raid/runlog-store.ts'

const file = process.argv[2]; if (!file) { console.error('판기록.json 을 주세요'); process.exit(1) }
const games = JSON.parse(readFileSync(file, 'utf8')) as RaidGame[]
const rows: string[] = ['시작,모드,스테이지,무기,결과,끝초,끝레벨,5분,10분,15분,만렙초,최저체력,찍은점,만렙칸,상점']
const shopTxt = (b: Record<string, number> | undefined) => b ? Object.entries(b).filter(([, v]) => v > 0).map(([k, v]) => `${k}${v}`).join(' ') : ''
for (const g of games) {
  const base = [g.started.slice(0, 16), g.mode, g.stage, g.kit]
  if (!g.input || g.cut) { rows.push([...base, g.end?.result ?? '-', Math.round(g.end?.t ?? 0), g.end?.level ?? '', '', '', '', '', '', g.picks.length, '', shopTxt(g.opts.bonus as never)].join(',')); continue }
  const at: Record<number, number> = {}; let capAt = -1, minHp = Infinity
  const s = replayRaid(g, (r) => {
    for (const m of [5, 10, 15]) if (at[m] === undefined && r.t >= m * 60) at[m] = r.level
    const cap = (r as unknown as { maxLevel?: number }).maxLevel
    if (capAt < 0 && r.level >= (cap ?? 44)) capAt = r.t
    if (r.state === 'playing' && r.hp < minHp) minHp = r.hp
  })
  const ranks = Object.entries(s.ranks).filter(([k]) => k in POWERS) as [keyof typeof POWERS, number][]
  const pts = ranks.reduce((n, [, v]) => n + v, 0), maxed = ranks.filter(([k, v]) => v > 0 && v >= POWERS[k].max).map(([k]) => k)
  rows.push([...base, s.state, Math.round(s.t), s.level, at[5] ?? '', at[10] ?? '', at[15] ?? '', capAt < 0 ? '' : Math.round(capAt), Math.round(minHp), pts, maxed.join(' '), shopTxt(g.opts.bonus as never)].join(','))
}
const csv = process.argv.indexOf('--csv'); if (csv > 0) writeFileSync(process.argv[csv + 1]!, '﻿' + rows.join('\n'))
for (const r of rows) console.log(r)
