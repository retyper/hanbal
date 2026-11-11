/**
 * 스프라이트 띠 감사 — public/realm/anim2 의 모든 띠를 재서 docs/realm/sprite-audit.json · SPRITE-AUDIT.md 를 만든다.
 * 쓰는 법: node tools/sprite-audit.mjs   (결과 JSON 은 tools/sprite-normalize.mjs 가 읽는다)
 * 칸 수: 장수 · 병사 = 20컷 · 마을 사람(migrant · villager-*) = 8컷 · 군중(duel/crowd) = 낱장 1컷
 */
import { readdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { decodePng } from './png.mjs'
import { SPEC } from './sprite-spec.mjs'
import { cleanStrip, edgeTouch, flatCutOf, sharpOf } from './sprite-clean.mjs'

const ROOT = 'public/realm'
const CELLS8 = new Set(['migrant', 'villager-builder', 'villager-farmer', 'villager-porter', 'villager-woman'])
const A_ON = 40 // 이보다 불투명하면 몸
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0 }
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d

/** 한 컷 재기: bbox · 윤곽 어두움 · 색 */
function cellStats(img, cx0, cw) {
  const { w: W, h: H, px } = img
  let top = H, bot = -1, left = cw, right = -1
  for (let y = 0; y < H; y++) for (let x = 0; x < cw; x++) {
    if (px[((y * W) + cx0 + x) * 4 + 3] > A_ON) { if (y < top) top = y; if (y > bot) bot = y; if (x < left) left = x; if (x > right) right = x }
  }
  if (bot < 0) return null
  const op = (x, y) => x >= 0 && y >= 0 && x < cw && y < H && px[((y * W) + cx0 + x) * 4 + 3] > 128
  const lum = (x, y) => { const i = ((y * W) + cx0 + x) * 4; return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] }
  let edge = 0, dark = 0, runSum = 0, runN = 0
  const cols = new Set()
  for (let y = top; y <= bot; y++) for (let x = left; x <= right; x++) {
    if (!op(x, y)) continue
    const i = ((y * W) + cx0 + x) * 4
    cols.add(((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4))
    if (op(x - 1, y) && op(x + 1, y) && op(x, y - 1) && op(x, y + 1)) continue
    edge++; if (lum(x, y) < 70) dark++
    // 두께: 투명 쪽 반대로 어두운 연속 길이
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (op(x - dx, y - dy)) continue
      let n = 0
      while (n < 8 && op(x + dx * n, y + dy * n) && lum(x + dx * n, y + dy * n) < 70) n++
      runSum += n; runN++; break
    }
  }
  return { top, bot, left, right, bh: bot - top + 1, bw: right - left + 1, edge, dark, thick: runN ? runSum / runN : 0, cols }
}

export function cellsOf(name, w) {
  return CELLS8.has(name) ? 8 : 20
}

export function auditStrip(file, kind) {
  const img = decodePng(file)
  const name = file.split('/').pop().replace('.png', '')
  const nCells = kind === 'crowd' ? 1 : cellsOf(name, img.w)
  const cw = img.w / nCells
  const cells = []
  const allCols = new Set()
  for (let i = 0; i < nCells; i++) {
    const c = cellStats(img, Math.round(i * cw), Math.round((i + 1) * cw) - Math.round(i * cw))
    cells.push(c)
    if (c) for (const k of c.cols) allCols.add(k)
  }
  const ok = cells.filter((c) => c !== null)
  const stand = cells.slice(0, Math.min(4, nCells)).filter((c) => c !== null)
  const bh = med(stand.map((c) => c.bh))
  const bots = ok.map((c) => c.bot)
  const edge = ok.reduce((s, c) => s + c.edge, 0), dark = ok.reduce((s, c) => s + c.dark, 0)
  const feet = med(stand.map((c) => c.bot))
  // 누끼·잘림·흐림 (docs/realm/SPRITE-AUDIT.md 의 「누끼」「잘림」「흐림」)
  const cl = cleanStrip(img, nCells).log
  const edges = [], sharps = [], flats = []
  for (let i = 0; i < nCells; i++) {
    const c0 = Math.round(i * cw), c1 = Math.round((i + 1) * cw)
    sharps.push(sharpOf(img, c0, c1 - c0))
    if (kind !== 'crowd') { const f = flatCutOf(img, c0, c1 - c0); if (f.length) flats.push(`${i}${f[0].side}${f[0].run}`) }
    if (kind === 'crowd') continue
    for (const e of edgeTouch(img, c0, c1 - c0, i > 0 ? Math.round((i - 1) * cw) : undefined, i > 0 ? c0 - Math.round((i - 1) * cw) : 0, i < nCells - 1 ? c1 : undefined)) edges.push({ cell: i, ...e })
  }
  return {
    halo: cl.halo, fringe: cl.fringe, islands: cl.islands, edges, flats, sharp: round(med(sharps.filter((v) => v > 0)), 1),
    name, kind, w: img.w, h: img.h, cells: nCells, cellW: round(cw), cellH: img.h,
    bodyPx: bh, bodyFrac: round(bh / img.h, 3), bodyW: med(stand.map((c) => c.bw)),
    feet, padBot: img.h - 1 - feet,
    feetJit: Math.max(...bots) - Math.min(...bots), hJit: ok.length ? Math.max(...ok.map((c) => c.bh)) - Math.min(...ok.map((c) => c.bh)) : 0,
    darkEdge: round(edge ? dark / edge : 0, 2), thick: round(ok.reduce((s, c) => s + c.thick, 0) / Math.max(1, ok.length), 2), colors: allCols.size,
    topPad: med(stand.map((c) => c.top)),
  }
}

export function listStrips() {
  const out = []
  for (const f of readdirSync(`${ROOT}/anim2`).sort()) if (f.endsWith('.png')) out.push([`${ROOT}/anim2/${f}`, f.startsWith('gen-') ? 'general' : CELLS8.has(f.replace('.png', '')) ? 'folk' : 'soldier'])
  for (const f of readdirSync(`${ROOT}/duel/crowd`).sort()) if (/^[fb]\d\.png$/.test(f)) out.push([`${ROOT}/duel/crowd/${f}`, 'crowd'])
  return out
}

function pngSize(file) { try { const { w, h } = decodePng(file); return `${w}×${h}` } catch { return '?' } }

if (process.argv[1].endsWith('sprite-audit.mjs')) {
  const rows = listStrips().map(([f, k]) => auditStrip(f, k))
  writeFileSync('docs/realm/sprite-audit.json', JSON.stringify(rows))
  const gens = rows.filter((r) => r.kind === 'general')
  const stat = (a) => {
    const s = [...a].sort((x, y) => x - y), m = a.reduce((p, q) => p + q, 0) / a.length
    return `중앙 ${round(med(a))} · 최소 ${s[0]} · 최대 ${s[s.length - 1]} · 표준편차 ${round(Math.sqrt(a.reduce((t, v) => t + (v - m) ** 2, 0) / a.length))}`
  }
  const sorted = [...rows].sort((a, b) => b.bodyPx - a.bodyPx)
  const mB = med(gens.map((r) => r.bodyPx)), mC = med(gens.map((r) => r.colors)), mA = med(gens.map((r) => r.cellW / r.cellH)), mP = med(gens.map((r) => r.padBot)), mT = med(gens.map((r) => r.thick))
  const odd = (r) => Math.abs(r.bodyPx - mB) / mB * 4 + Math.abs(r.cellW / r.cellH - mA) / mA + Math.abs(r.padBot - mP) / 8 + Math.abs(r.colors - mC) / mC + Math.abs(r.thick - mT) / Math.max(0.5, mT) * 0.5 + r.feetJit / 12
  const worst = rows.filter((r) => r.kind !== 'crowd').map((r) => ({ r, s: odd(r) })).sort((a, b) => b.s - a.s).slice(0, 20)
  const kindName = { general: '장수', soldier: '병사', folk: '마을', crowd: '군중' }
  const line = (r) => `| ${r.name} | ${kindName[r.kind]} | ${r.cellW}×${r.cellH} | ${r.cells} | ${r.bodyPx} | ${r.bodyFrac} | ${r.bodyW} | ${r.padBot} | ${r.feetJit} | ${r.hJit} | ${r.darkEdge} | ${r.thick} | ${r.colors} |`
  const head = '| 이름 | 종류 | 칸(px) | 컷 | 몸 키 | 몸/칸 | 몸 너비 | 발 아래 여백 | 발 흔들림 | 키 흔들림 | 어두운 가장자리 | 윤곽 두께 | 색(4비트) |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|'
  const bustDirs = ['bust', 'bust-hd', 'awaken-hd', 'awaken2-hd'].map((d) => {
    const dir = `${ROOT}/${d}`
    if (!existsSync(dir)) return `${d}: 없음`
    const fs = readdirSync(dir).filter((f) => /\.(png|jpg)$/.test(f))
    const sz = new Map()
    for (const f of fs.filter((f) => f.endsWith('.png')).slice(0, 30)) { const k = pngSize(`${dir}/${f}`); sz.set(k, (sz.get(k) ?? 0) + 1) }
    return `${d} ${fs.length}장${sz.size ? ` (PNG 표본 ${[...sz].map(([k, n]) => `${k}×${n}`).join(' ')})` : ' (jpg)'}`
  })
  const flat = rows.filter((r) => r.kind !== 'crowd')
  const fmtEdges = (r) => r.edges.map((e) => `${e.cell}${e.side}${e.spill ? '↔' : ''}`).join(' ')
  const cutRows = flat.filter((r) => r.edges.length > 0).sort((a, b) => b.edges.length - a.edges.length)
  const spillN = flat.reduce((t, r) => t + r.edges.filter((e) => e.spill).length, 0), flatN = flat.reduce((t, r) => t + r.edges.filter((e) => !e.spill).length, 0)
  const blur = []
  for (const kind of ['general', 'soldier']) { const g = flat.filter((r) => r.kind === kind && r.sharp > 0).sort((a, b) => a.sharp - b.sharp); blur.push(...g.slice(0, Math.max(1, Math.ceil(g.length * 0.1)))) }
  const logFile = 'docs/realm/sprite-clean-log.json'
  const cleanLog = existsSync(logFile) ? JSON.parse(readFileSync(logFile, 'utf8')) : null
  const cleanNote = cleanLog === null ? '' : `\n### 자동으로 지운 조각 (변환 기록 · 칸 번호 : 면적px / 몸 면적px)\n\n${Object.entries(cleanLog).filter(([, v]) => v.islands.length).map(([k, v]) => `- ${k}: ${v.islands.map((i) => `${i.cell}번 ${i.area}/${i.of}`).join(', ')}`).join('\n') || '- 없음'}`
  const md = `# 스프라이트 띠 감사

\`node tools/sprite-audit.mjs\` 가 만든다 (손으로 고치지 말 것). 규격 상수는 tools/sprite-spec.mjs 한 곳.

${SPEC.doc}

## 요약 (원본 anim2 · 몸 키는 서기 0~3컷 중앙값의 불투명 bbox 높이)

- 띠 ${rows.length}개: 장수 ${gens.length} · 병사 ${rows.filter((r) => r.kind === 'soldier').length} · 마을 ${rows.filter((r) => r.kind === 'folk').length} · 군중 ${rows.filter((r) => r.kind === 'crowd').length}
- 장수 칸 가로(px, 높이는 모두 160): ${stat(gens.map((r) => r.cellW))}
- 장수 칸 가로세로비: 최소 ${round(Math.min(...gens.map((r) => r.cellW / r.cellH)), 2)} ~ 최대 ${round(Math.max(...gens.map((r) => r.cellW / r.cellH)), 2)}
- 장수 몸 키(px): ${stat(gens.map((r) => r.bodyPx))}
- 장수 발 아래 여백(px): ${stat(gens.map((r) => r.padBot))}
- 장수 한 띠 안 발 흔들림(컷 사이 발바닥 높이 차, px): ${stat(gens.map((r) => r.feetJit))}
- 장수 색 수(4비트로 뭉갠 서로 다른 색): ${stat(gens.map((r) => r.colors))}
- 장수 윤곽 두께(px): ${stat(gens.map((r) => r.thick))} · 어두운 가장자리 비율: ${stat(gens.map((r) => r.darkEdge))}
- 초상 묶음: ${bustDirs.join(' · ')}

## 가장 튀는 20개 (몸 키·가로세로비·발 여백·색 수·윤곽·발 흔들림 어긋남의 합)

${head}
${worst.map((w) => line(w.r)).join('\n')}

## 누끼 (원본 anim2 · 변환기가 자동으로 고친다)

- 반투명 후광(알파 1~59) 픽셀: 띠 ${flat.filter((r) => r.halo > 0).length}/${flat.length}개에 합계 ${flat.reduce((t, r) => t + r.halo, 0)}px → 알파 60 미만은 지우고 줄이기 뒤 반투명 없이 딱 떨어지게
- 초록/마젠타 fringe: 띠 ${flat.filter((r) => r.fringe > 0).length}개 합계 ${flat.reduce((t, r) => t + r.fringe, 0)}px → 바깥 2px 안에서 despill
- 떠 있는 부스러기 · 옆 칸에서 넘어온 조각: 띠 ${flat.filter((r) => r.islands.length > 0).length}개 합계 ${flat.reduce((t, r) => t + r.islands.length, 0)}조각 → 칸마다 가장 큰 덩어리(몸+붙은 무기)만 남기고 지움 (면적 < 몸의 0.3%, 또는 몸에서 떨어진 것 중 < 1.5%, 칸 끝에 닿은 얇은 것 < 5%)
${cleanNote}

## 칸 끝에 닿아 잘린 칸 — 다시 뽑을 목록 (군중 낱장 제외)

불투명 픽셀이 칸의 왼(L)·오른(R) 끝 1px 에 닿은 칸. 칸 번호 + 쪽. **↔ 표시 = 이웃 칸까지 이어진 것(넘침)** — 원본 시트가 있으면 tools/sprite-kit/widen-cells.py(칸 폭을 1.5배로 넓혀 다시 자름)로 살릴 수 있다. **표시 없음 = 이웃 칸이 비어 있는 곳에서 그림 자체가 잘린 것** — 자동으로 못 고친다(이웃 칸으로 바꿔 끼우거나 다시 굽기). 합계: 넘침 ${spillN}곳 · 잘림 ${flatN}곳 · 띠 ${cutRows.length}/${flat.length}개

| 띠 | 칸 수 | 닿은 칸 |
|---|---|---|
${cutRows.map((r) => `| ${r.name} | ${r.edges.length} | ${fmtEdges(r)} |`).join('\n')}

## 칸 안에서 곧은 세로선으로 잘린 칸 (의심 · 36줄 이상)

칸 끝이 아니라 칸 가운데서 몸이 직선으로 뚝 끊긴 것(원본을 붙일 때 잘린 것). 칸번호+쪽(L/R)+줄 수. 자동으로 못 고친다 — 다시 굽거나 이웃 칸으로 갈아 끼운다.

| 띠 | 칸 |
|---|---|
${flat.filter((r) => r.flats.length).map((r) => `| ${r.name} | ${r.flats.join(' ')} |`).join(String.fromCharCode(10))}

## 흐린 띠 — 선명도 하위 10% (종류별 · 안쪽 라플라시안 분산 ÷ 밝기 분산 × 1000, 클수록 선명)

장수 중앙 ${round(med(flat.filter((r) => r.kind === 'general').map((r) => r.sharp)), 1)} · 병사 중앙 ${round(med(flat.filter((r) => r.kind === 'soldier').map((r) => r.sharp)), 1)}

| 띠 | 종류 | 선명도 |
|---|---|---|
${blur.map((r) => `| ${r.name} | ${kindName[r.kind]} | ${r.sharp} |`).join('\n')}

## 전체 (몸 키 큰 순)

${head}
${sorted.map(line).join('\n')}
`
  writeFileSync('docs/realm/SPRITE-AUDIT.md', md)
  console.log(`띠 ${rows.length}개 → docs/realm/SPRITE-AUDIT.md`)
}
