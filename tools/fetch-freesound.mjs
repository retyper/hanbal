/**
 * Freesound 에서 CC0 소리를 찾아 받는다 — API 키 없이 (2026-09-20, 도구로 남긴다)
 *
 * 형: **"효과음들도 마찬가지야. 죽는소리같은게 지금 없잖아."**
 *
 * 검색 페이지 HTML 에 프리뷰 주소가 박혀 있다 (data-ogg, …-lq.ogg → -hq.ogg). 예전에도 이 길로 받았는데
 * 그때 도구는 세션 스크래치에 있다가 사라졌다 — 이번엔 저장소에 둔다.
 *
 *   node tools/fetch-freesound.mjs search "male death scream" [최대초=3] [몇개=12]
 *       → 후보를 다운로드 많은 순으로 적는다 (ID · 길이 · 다운로드 수 · 제목 · 올린이)
 *   node tools/fetch-freesound.mjs get <ID> <public/sfx/이름.ogg>
 *       → 그 소리의 hq 프리뷰를 받는다. 출처 한 줄을 찍어 준다 (CREDITS.txt 에 붙일 것).
 *
 * ★ **나는 소리를 못 듣는다.** 제목·설명·길이·다운로드 수로 고를 뿐이다. 받은 것은 형이
 *   public/sound-picker.html 에서 들어 보고 갈아 끼운다 (2026-09-10 의 교훈: 다운로드 수만 보고 고르면 틀린다).
 * CC0 만 검색한다 — 출처 표기 의무는 없지만 나중에 우리가 찾으려고 적는다.
 */
import { writeFileSync } from 'node:fs'

const UA = { 'User-Agent': 'Mozilla/5.0' }
const [cmd, a, b, c] = process.argv.slice(2)

/** 검색 결과 한 쪽을 읽어 소리 목록으로. */
async function search(q, page) {
  const url = 'https://freesound.org/search/?q=' + encodeURIComponent(q)
    + '&f=' + encodeURIComponent('license:"Creative Commons 0"')
    + '&s=' + encodeURIComponent('Downloads (most first)') + '&page=' + page
  const html = await (await fetch(url, { headers: UA })).text()
  const out = []
  for (const block of html.split('data-sound-id="').slice(1)) {
    const id = block.slice(0, block.indexOf('"'))
    const pick = (k) => { const m = new RegExp(`data-${k}="([^"]*)"`).exec(block); return m === null ? '' : m[1] }
    const ogg = pick('ogg')
    if (ogg === '') continue
    const user = /\/people\/([^/]+)\//.exec(block)
    out.push({
      id, title: pick('title').replaceAll('&amp;', '&'), dur: Number(pick('duration')),
      dl: Number(pick('num-downloads')), ogg: ogg.replace('-lq.ogg', '-hq.ogg'), user: user === null ? '?' : user[1],
    })
  }
  return out
}

if (cmd === 'search') {
  const maxDur = Number(b ?? 3)
  const want = Number(c ?? 12)
  const seen = new Set()
  const rows = []
  for (let page = 1; page <= 3 && rows.length < want; page++) {
    for (const r of await search(a, page)) {
      if (seen.has(r.id) || r.dur > maxDur || r.dur <= 0) continue
      seen.add(r.id)
      rows.push(r)
    }
  }
  for (const r of rows.slice(0, want)) {
    console.log(`${r.id.padStart(7)}  ${r.dur.toFixed(2).padStart(5)}s  ↓${String(r.dl).padStart(6)}  ${r.title}  — ${r.user}`)
  }
  if (rows.length === 0) console.log('(없다 — 검색어를 바꾸거나 최대 길이를 늘릴 것)')
} else if (cmd === 'get') {
  const html = await (await fetch(`https://freesound.org/s/${a}/`, { headers: UA, redirect: 'follow' })).text()
  const ogg = /data-ogg="([^"]+)"/.exec(html)
  const title = /<title>([^<]*)<\/title>/.exec(html)
  if (ogg === null) throw new Error(`${a}: 프리뷰 주소를 못 찾았다`)
  if (!/Creative Commons 0|publicdomain\/zero/.test(html)) throw new Error(`${a}: CC0 가 아니다 — 받지 않는다`)
  const buf = Buffer.from(await (await fetch(ogg[1].replace('-lq.ogg', '-hq.ogg'), { headers: UA })).arrayBuffer())
  if (buf.subarray(0, 4).toString('latin1') !== 'OggS') throw new Error(`${a}: ogg 가 아니다`)
  writeFileSync(b, buf)
  console.log(`${b}  ${(buf.length / 1024).toFixed(1)}KB  ←  Freesound ID ${a} · ${title === null ? '' : title[1].trim()} · CC0`)
} else {
  console.log('쓰는 법은 이 파일 머리말에 있다')
}
