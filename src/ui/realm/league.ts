/**
 * 합종이 보이게 (coalition.ts · 위원회 11-08 ⑤) — 글은 마지막 수단 (메모리 show-not-read).
 *   지도   연합 나라 도읍을 붉은 새끼줄 하나로 잇고 매듭을 단다 · 출정 동안엔 줄이 숨 쉰다(투명도만 · 폰 한도)
 *   단추   「다음 달」 앞에 묶인 깃발과 남은 달 수 · 출정이면 붉게 ⚔
 *   알림   섰을 때 깃발들이 한 줄로 끌려와 묶이는 짧은 알림 · 깼을 때 줄이 끊긴다
 * 판을 읽기만 한다.
 */
import { coalitionOf, coalStriking } from '../../realm/coalition.ts'
import { turnsLabel } from '../../realm/data/prose.ts'
import type { Realm, ReportLine } from '../../realm/types.ts'
import { t as tr } from '../../i18n/index.ts'

type Pt = readonly [number, number]

/**
 * 지도 위 새끼줄 — 보이는 연합 나라 도읍을 가운데를 도는 차례로 잇는다(둘이면 한 줄 · 셋부터 고리). `px` 는 지도 좌표 · `seen` 은 보이는 고을
 */
export function leagueRopeSvg(r: Realm, me: string, px: (id: string) => Pt, seen: (id: string) => boolean, lw: number): string {
  const c = coalitionOf(r)
  if (c === null || c.against !== me) return ''
  const caps = c.members.map((m) => r.factions[m]?.capital).filter((id): id is string => id !== undefined && seen(id))
  if (caps.length < 2) return ''
  const pts = caps.map(px)
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const ring = pts.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx))
  const d = `M${ring.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}${ring.length >= 3 ? 'Z' : ''}`
  const knots = ring.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(11 * lw).toFixed(1)}" fill="#7a1a10" stroke="#f3e6c8" stroke-width="${(3 * lw).toFixed(1)}"/>`).join('')
  return `<g class="lgrope${coalStriking(r) ? ' on' : ''}"><title>${tr('lgue.title')}</title>`
    + `<path d="${d}" fill="none" stroke="#3a0a05" stroke-width="${(9 * lw).toFixed(1)}" stroke-linejoin="round" stroke-linecap="round" opacity=".55"/>`
    + `<path d="${d}" fill="none" stroke="#c8402a" stroke-width="${(5 * lw).toFixed(1)}" stroke-dasharray="${(12 * lw).toFixed(1)} ${(5 * lw).toFixed(1)}" stroke-linejoin="round" opacity=".95"/>`
    + `${knots}</g>`
}

/** 「다음 달」 단추 앞의 연합 칩 — 묶인 깃발(셋까지) + 칠 때까지 남은 턴 · 출정이면 ⚔ 와 출정이 끝날 때까지 */
export function leagueChipHtml(r: Realm, me: string, emblem: (f: string) => string): string {
  const c = coalitionOf(r)
  if (c === null || c.against !== me) return ''
  const on = coalStriking(r)
  const left = Math.max(1, (on ? c.endAt : c.strikeAt) - r.season)
  const tip = tr(on ? 'lgue.tipStrike' : 'lgue.tipForm', { span: turnsLabel(r, left) })
  return `<i class="nxp lg${on ? ' on' : ''}" data-tip="${tip}">${c.members.slice(0, 3).map(emblem).join('')}<b>${on ? '⚔' : ''}${left}</b></i>`
}

/** 이번 턴의 합종 알림 — 섰다 · 칼을 뽑았다 · 깼다 · 흩어졌다. 없으면 null */
export function leagueToastHtml(r: Realm, me: string, lines: readonly ReportLine[], emblem: (f: string) => string): { html: string; big: boolean } | null {
  const l = lines.find((x): x is Extract<ReportLine, { kind: 'coalition' }> => x.kind === 'coalition' && x.against === me && x.ev !== 'leave')
  if (l === undefined) return null
  const flags = (cls: string): string => `<span class="lgfl ${cls}">${l.members.map((m, i) => `<span style="--i:${i}">${emblem(m)}</span>`).join('<i class="lgk"></i>')}</span>`
  const left = (at: number | undefined): string => turnsLabel(r, Math.max(1, (at ?? r.season) - r.season))
  switch (l.ev) {
    case 'form': return { html: `<span class="gtk">${tr('lgue.title')}</span>${flags('tie')}${tr('lgue.form', { left: `<b>${left(l.at)}</b>` })}`, big: true }
    case 'strike': return { html: `<span class="gtk">${tr('lgue.strike')}</span>${flags('tie')}⚔ ${tr('lgue.hold', { left: `<b>${left(l.at)}</b>` })}`, big: true }
    case 'broken': return { html: `<span class="gtk">${tr('lgue.broken')}</span>${flags('cut')}`, big: true }
    case 'spent': return { html: `<span class="gtk">${tr('lgue.spent')}</span>${flags('cut')}${tr('lgue.lost', { n: `<b>${l.took ?? 0}</b>` })}`, big: false }
    default: return { html: `<span class="gtk">${tr('lgue.scattered')}</span>${flags('cut')}`, big: false }
  }
}

export const LEAGUE_CSS = `
.ap .lgrope.on { animation: lgbreath 1.3s ease-in-out infinite; }
@keyframes lgbreath { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
.ap .next .nxps .nxp.lg { width: auto; padding: 0 7px 0 3px; border-radius: 13px; display: inline-flex; align-items: center; gap: 0; background: #5a1c14; border: 1px solid #c8402a; }
.ap .next .nxps .nxp.lg img { width: 18px; height: 18px; margin-right: -5px; }
.ap .next .nxps .nxp.lg b { margin-left: 8px; font-size: 13px; color: #ffc0a8; font-variant-numeric: tabular-nums; }
.ap .next .nxps .nxp.lg.on { background: #8a1a10; animation: lgbreath 1.3s ease-in-out infinite; }
.ap .gotoast .lgfl { display: flex; justify-content: center; align-items: center; margin: 4px 0 6px; }
.ap .gotoast .lgfl img { width: 34px; height: 34px; }
.ap .gotoast .lgfl .lgk { width: 18px; height: 4px; border-radius: 2px; background: repeating-linear-gradient(90deg, #c8402a 0 5px, #5a0f08 5px 7px); }
.ap .gotoast .lgfl.tie > span { animation: lgpull .55s cubic-bezier(.2, 1.6, .4, 1) both; animation-delay: calc(var(--i) * 90ms); }
.ap .gotoast .lgfl.tie .lgk { animation: lgrope .4s ease-out .45s both; }
.ap .gotoast .lgfl.cut .lgk { animation: lgsnap .5s ease-in .35s both; }
.ap .gotoast .lgfl.cut > span { animation: lgfall .6s ease-in .5s both; }
@keyframes lgpull { from { transform: translateY(-18px) scale(1.5); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes lgrope { from { transform: scaleX(0); } to { transform: none; } }
@keyframes lgsnap { to { transform: scaleX(.2) rotate(25deg); opacity: 0; } }
@keyframes lgfall { to { transform: translateY(5px) rotate(-12deg); opacity: .5; } }
@media (prefers-reduced-motion: reduce) { .ap .lgrope.on, .ap .next .nxps .nxp.lg.on, .ap .gotoast .lgfl * { animation: none; } }
`
