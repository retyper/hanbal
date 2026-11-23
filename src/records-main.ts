/**
 * 열전 판 기록 읽기 화면 (records.html · 11-23 형 「데이터 수집해」) — 이 기기의 판(hanbal.raid.games) + 로그인했으면 서버의 판을 모아
 * 판마다 다시 돌려(runlog.replayRaid) 레벨 흐름 · 만렙에 닿은 때 · 가장 낮은 체력 · 찍은 점 · 만렙 칸 · 상점 능력치를 표로. 판은 바꾸지 않는다(읽기만).
 */
import { loadRaidGames, type RaidGame } from './raid/runlog-store.ts'
import { replayRaid } from './raid/runlog.ts'
import { POWERS, maxLevel } from './raid/haebi.ts'
import { pullRaids } from './net/sync.ts'

const $ = (id: string) => document.getElementById(id)!
const shop = (b: Record<string, number> | undefined) => b ? Object.entries(b).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(' · ') : ''

async function main() {
  const local = loadRaidGames(); let server: RaidGame[] = []
  try { server = ((await pullRaids()) ?? []) as RaidGame[] } catch (e) { $('msg').textContent = `서버 기록을 못 읽었습니다: ${String(e)}` }
  const byId = new Map<string, RaidGame>(); for (const g of [...server, ...local]) byId.set(g.id, g)
  const games = [...byId.values()].sort((a, b) => a.started < b.started ? -1 : 1)
  $('msg').textContent = `이 기기 ${local.length}판 · 서버 ${server.length}판 · 합쳐 ${games.length}판. 판마다 다시 돌려 셉니다.`
  const head = ['시작', '모드', '스테이지', '무기', '결과', '끝(분)', '끝 레벨', '5분', '10분', '15분', '만렙(분)', '최저 체력', '찍은 점', '만렙 칸', '상점']
  const t = $('t'); t.innerHTML = `<tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>`
  for (const g of games) {
    await new Promise((r) => setTimeout(r, 0))
    const cells: (string | number)[] = [g.started.slice(2, 16).replace('T', ' '), g.mode, g.stage, g.kit]
    if (!g.input || g.cut) { cells.push(g.end?.result ?? '-', ((g.end?.t ?? 0) / 60).toFixed(1), g.end?.level ?? '', '', '', '', '', '', g.picks.length, '(입력 잘림)', shop(g.opts.bonus as never)) }
    else {
      const at: Record<number, number> = {}; let capAt = -1, minHp = Infinity
      const s = replayRaid(g, (r) => {
        for (const m of [5, 10, 15]) if (at[m] === undefined && r.t >= m * 60) at[m] = r.level
        if (capAt < 0 && r.level >= maxLevel(r)) capAt = r.t
        if (r.state === 'playing' && r.hp < minHp) minHp = r.hp
      })
      const ranks = Object.entries(s.ranks).filter(([k]) => k in POWERS) as [keyof typeof POWERS, number][]
      const pts = ranks.reduce((n, [, v]) => n + v, 0), maxed = ranks.filter(([k, v]) => v > 0 && v >= POWERS[k].max).map(([k]) => POWERS[k].name)
      cells.push(s.state, (s.t / 60).toFixed(1), s.level, at[5] ?? '', at[10] ?? '', at[15] ?? '', capAt < 0 ? '' : (capAt / 60).toFixed(1), Math.round(minHp), pts, maxed.join(' '), shop(g.opts.bonus as never))
    }
    const tr = document.createElement('tr'); tr.className = String(cells[4]); tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join(''); t.appendChild(tr)
  }
  $('msg').textContent += ' 다 셌습니다.'
}
void main()
