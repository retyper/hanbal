// 74-BUFF 상태 효과 그림 — 판의 목록(s.buffs · mobStatuses)을 읽기만 한다.
//   장수 줄(체력 띠 바로 위 왼쪽 끝에서 오른쪽으로 작게)은 DOM 조각을 만들어 주고, 적 줄은 체력 띠 위 왼쪽(띠 없는 잡졸은 몸 위)에 캔버스로 그린다.
//   물기운 동안 장수 둘레에 물방울이 낱낱이 오르고 펄스마다 초록 숫자가 뜬다 (시계는 판 시각 s.t).
import type { HaebiRun, Mob } from './haebi.ts'
import { mobStatuses, type Status, type StatusKind } from './status.ts'
import { HAEBI_STATUS as ST } from '../tune/params.ts'

const D: Record<StatusKind, string> = {
  water: 'M0-6C3-2 5 0 5 3A5 5 0 0 1-5 3C-5 0-3-2 0-6Z',
  poison: 'M0-6C4-6 6-3 6 0C6 2 5 3 3 4V6H-3V4C-5 3-6 2-6 0C-6-3-4-6 0-6ZM-3-1.5a1.6 1.6 0 1 0 .01 0ZM3-1.5a1.6 1.6 0 1 0 .01 0Z',
  slow: 'M-5-4L0 0L5-4M-5 1L0 5L5 1',
  daze: 'M0-6L1.6-1.6L6 0L1.6 1.6L0 6L-1.6 1.6L-6 0L-1.6-1.6Z',
}
const STROKE: Record<StatusKind, boolean> = { water: false, poison: false, slow: true, daze: false }
const paths: Partial<Record<StatusKind, Path2D>> = {}
const frac = (b: Status) => Math.max(0, Math.min(1, b.t / (b.kind === 'water' ? b.total : ST.ref[b.kind])))
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

/** 장수 줄 DOM 조각 — 아이콘마다 남은 시간 고리 · 겹침 2 이상이면 작은 숫자 (같은 글이면 다시 쓰지 않게 키도 준다) */
export function heroStatusRow(list: readonly Status[] | undefined): { key: string; html: string } {
  if (!list?.length) return { key: '', html: '' }
  const H = ST.hero, parts: string[] = []; let key = ''
  for (const b of list.slice(0, H.max)) {
    const f = Math.round(frac(b) * 20) / 20, c = 2 * Math.PI * 9
    key += `${b.kind}${f}${b.stacks};`
    parts.push(`<i class="buff-ic" style="width:${H.icon}px;height:${H.icon}px"><svg viewBox="-11 -11 22 22" width="${H.icon}" height="${H.icon}"><circle r="9" fill="#0a1218cc" stroke="#ffffff22" stroke-width="${H.ring}"/><circle r="9" fill="none" stroke="${ST.color[b.kind]}" stroke-width="${H.ring}" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90)"/><path d="${D[b.kind]}" transform="scale(.9)" ${STROKE[b.kind] ? `fill="none" stroke="${ST.color[b.kind]}" stroke-width="2" stroke-linecap="round"` : `fill="${ST.color[b.kind]}" fill-rule="evenodd"`}/></svg>${b.stacks > 1 ? `<b>${b.stacks}</b>` : ''}</i>`)
  }
  return { key, html: parts.join('') }
}

function icon(ctx: CanvasRenderingContext2D, b: Status, x: number, y: number, size: number, ring: number) {
  const p = paths[b.kind] ??= new Path2D(D[b.kind]), r = size / 2, u = size / 14, f = frac(b)
  ctx.fillStyle = '#0a1218cc'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.lineWidth = ring; ctx.strokeStyle = ST.color[b.kind]; ctx.beginPath(); ctx.arc(x, y, r - ring / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke()
  ctx.save(); ctx.translate(x, y); ctx.scale(u * .55, u * .55)
  if (STROKE[b.kind]) { ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = ST.color[b.kind]; ctx.stroke(p) } else { ctx.fillStyle = ST.color[b.kind]; ctx.fill(p, 'evenodd') }
  ctx.restore()
  if (b.stacks > 1) { ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(6, size * .6)}px sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(b.stacks), x + r + 1, y + r) }
}

/** 적의 디버프 줄 — 체력 띠가 있으면 띠 위 왼쪽 끝(left·top 은 띠의 왼쪽 위), 없으면 몸 위 가운데 (붐비면 생략) */
export function drawFoeStatus(ctx: CanvasRenderingContext2D, s: HaebiRun, e: Mob, bodyTop: number, bar: { left: number } | null) {
  const list = mobStatuses(e); if (!list.length) return
  if (!bar && s.enemies.length > ST.foe.crowd) return
  const F = ST.foe, n = Math.min(F.max, list.length), step = F.icon + F.gap
  const y = e.y - bodyTop - F.lift - F.icon / 2 - (bar ? 5 : 0)
  const x0 = bar ? bar.left + F.icon / 2 : e.x - (n * step - F.gap) / 2 + F.icon / 2
  ctx.save()
  for (let i = 0; i < n; i++) icon(ctx, list[i]!, x0 + i * step, y, F.icon, F.ring)
  ctx.restore()
}

/** 물기운 동안 장수 둘레에 오르는 물방울 낱낱이 + 펄스마다 뜨는 초록 숫자 (판 읽기만 · 위치는 s.t 로 정해진다) */
export function drawHeroWater(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  const b = s.buffs?.find(x => x.kind === 'water')
  const D0 = ST.drops, N = ST.num
  if (b && b.t > 0) {
    ctx.save(); ctx.fillStyle = D0.color
    for (let i = 0; i < D0.n; i++) {
      const u = ((s.t / D0.life) + hash(i + 1)) % 1, a = hash(i + 9) * Math.PI * 2 + s.t * .8
      ctx.globalAlpha = Math.sin(u * Math.PI) * .85
      ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * D0.round, s.y - 6 - u * D0.rise + Math.sin(a) * D0.round * .35, D0.size * (1 - u * .4), 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
  // 펄스 숫자는 물기운이 끝난 뒤에도 잠깐 보이게 판이 마지막 값을 쥔다 (s.waterPulse)
  const pu = s.waterPulse
  if (pu && s.t - pu.at >= 0 && s.t - pu.at < N.life && pu.n > 0) {
    const u = (s.t - pu.at) / N.life
    ctx.save(); ctx.globalAlpha = 1 - u * u; ctx.font = `900 ${N.size}px "Noto Serif KR", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const x = s.x + (hash(Math.round(pu.at * 10)) - .5) * 24, y = s.y - 40 - u * N.rise
    ctx.lineWidth = 4; ctx.strokeStyle = N.edge; ctx.strokeText(`+${pu.n}`, x, y); ctx.fillStyle = N.fill; ctx.fillText(`+${pu.n}`, x, y); ctx.restore()
  }
}
