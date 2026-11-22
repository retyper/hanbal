#!/usr/bin/env node
/**
 * GitHub Pages 판만 가볍게 (tools/pages-shrink.sh 가 부른다 · CI 는 .github/workflows/deploy.yml).
 * 원본(public/)과 스팀 판(desktop/)은 손대지 않는다. 빌드된 dist 안의 사본만 바꾼다.
 * 파일 이름·확장자·가로세로·형식은 그대로다 (png 는 png, ogg 는 ogg). 코드도 그대로다.
 *
 * 1) 빼기: 이 빌드의 코드가 주소를 만들 수 없는 파일만 (근거는 규칙마다 아래에)
 *    - 각성 숨 영상 가운데 게임에 등록되지 않은 것 (src/realm/data/awaken-art.ts 의 AWAKEN_LOOP · AWAKEN2_LOOP 와 판 수)
 *    - 진각성 비기 전신 jpg (skill-body/aw2/*.jpg): 쓰는 함수 aw2SkillBody 를 부르는 곳이 없어 번들에 주소 틀이 없다
 *    - 진각성(2차 각성) 묶음: src/realm/dlc.ts 의 DLC.trueWake 가 꺼진 빌드에서만 (켜면 다음 배포부터 다시 올라간다)
 * 2) 같은 형식 안에서 다시 굽기 (KINDS)
 *    - video: 각성 숨 영상·열전 승패 영상 · 세로 960 이하 · H.264 crf 30 · 소리 aac 64k (11-17 부터 각성 영상에 쓰던 값)
 *    - png: 256색 팔레트 + 오차 확산 (libimagequant 품질 100) · 원본과 견주어 문턱을 못 넘으면 원본 그대로
 *    - jpg: 원본과 같은 표준 양자화 표로 품질만 2 낮춰 다시 (트렐리스 · 프로그레시브) · 문턱을 못 넘으면 원본 그대로 · 비기 전신은 그대로
 *    - webp: 맞은 초상(hit)·비기 컷인 띠(cut) · 잠깐 번쩍 뜨는 그림만 품질 70
 *    - bgm: 20초 넘는 배경음 가운데 비트레이트가 높은 것만 (vorbis q5 · mp3 V2)
 *    - voice: 장수 목소리 ogg (vorbis q4)
 * 3) 구운 결과는 원본 내용 해시로 캐시해 둔다 (CI 는 actions/cache) · 다음 배포부터는 새로 들어온 파일만 굽는다
 * 4) 다 줄인 뒤 크기가 한도를 넘으면 실패한다 (PAGES_LIMIT_MB · 기본 950 · Pages 1GB 경고선보다 먼저 멈춘다)
 *
 *   node --experimental-strip-types tools/pages-shrink.mjs <dist>
 *   환경: PAGES_SHRINK_SHARP(sharp 폴더) · PAGES_SHRINK_CACHE(캐시 폴더) · PAGES_SHRINK_JOBS · PAGES_LIMIT_MB · FFMPEG
 *         PAGES_SHRINK_LOG(파일마다 판정을 적을 tsv)
 */
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { availableParallelism, homedir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = process.argv[2] ?? 'dist'
const MB = 1048576
const LIMIT_MB = Number(process.env.PAGES_LIMIT_MB ?? 950)
const JOBS = Math.max(1, Number(process.env.PAGES_SHRINK_JOBS ?? availableParallelism()))
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const CACHE = process.env.PAGES_SHRINK_CACHE ?? join(homedir(), '.cache', 'pages-shrink')
const SHARP_DIR = process.env.PAGES_SHRINK_SHARP ?? join(ROOT, 'node_modules', 'sharp')
const LOG = process.env.PAGES_SHRINK_LOG ?? ''

/**
 * 갈래마다 고를 파일(test) · 굽는 값(set) · 바꿀 문턱(guard).
 * set 을 바꾸면 그 갈래의 캐시만 새로 굽는다. guard 는 캐시에 든 잰 값으로 그때그때 판정한다 (문턱을 바꿔도 다시 굽지 않는다).
 * guard: ratio = 원본보다 이 몫 아래로 작아질 때만 · psnr = 알파 곱한 RGB 의 PSNR(dB) · psnrAlpha · worst = 8×8 칸 밝기 SSIM 의 가장 나쁜 칸
 */
const KINDS = {
  video: {
    test: (r) => /^realm\/(awaken-loop|awaken2-loop|raid\/ending)\/[^/]+\.mp4$/.test(r),
    set: ['-vf', "scale=-2:'min(960,ih)'", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '64k'],
    guard: { ratio: 1 },
  },
  png: {
    test: (r) => r.endsWith('.png'),
    set: { palette: true, quality: 100, effort: 7, dither: 1, compressionLevel: 9 },
    guard: { ratio: 0.9, psnr: 35, psnrAlpha: 38, worst: 0.6 },
  },
  // 비기 전신(skill-body/*.jpg)은 열전 컷인이 화면에서 바탕 판을 색 거리로 오려 낸다(raid/cutin-plate.ts) · 다시 구우면 가장자리 알파가 바뀌어 그대로 둔다
  jpg: {
    test: (r) => /\.jpe?g$/.test(r) && !r.startsWith('realm/skill-body/'),
    set: { offset: -2, quantisationTable: 0, mozjpeg: true, trellisQuantisation: true, overshootDeringing: true, optimiseScans: true, optimiseCoding: true, progressive: true, chromaSubsampling: '4:2:0' },
    guard: { ratio: 0.97, psnr: 37 },
  },
  webp: {
    test: (r) => /^realm\/(hit\/|skill-body\/(aw[12]\/)?cut\/)[^.]+\.webp$/.test(r),
    set: { quality: 70, alphaQuality: 100, effort: 4, smartSubsample: true },
    guard: { ratio: 0.9, psnr: 30 },
  },
  bgm: {
    test: (r) => /\.(ogg|mp3)$/.test(r) && !r.startsWith('realm/voice/'),
    set: { minSec: 20, vorbisKbps: 150, vorbisQ: '5', mp3Kbps: 224, mp3Q: '2' },
    guard: { ratio: 0.97 },
  },
  voice: {
    test: (r) => /^realm\/voice\/.+\.ogg$/.test(r),
    set: { q: '4' },
    guard: { ratio: 0.95 },
  },
}
const tagOf = (k) => `${k}-${createHash('sha1').update(JSON.stringify(KINDS[k].set)).digest('hex').slice(0, 8)}`

const say = (...a) => console.log('pages-shrink:', ...a)
const walk = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p, out); else out.push(p) } return out }
const rel = (p) => relative(DIST, p).split(sep).join('/')
const sizeOf = (files) => files.reduce((s, p) => s + statSync(p).size, 0)
const folder = (r) => { const a = r.split('/'); return a.length > 2 && a[0] === 'realm' ? `realm/${a[1]}` : a.length > 1 ? a[0] : '(맨 위)' }
const extOf = (r) => r.slice(r.lastIndexOf('.') + 1).toLowerCase()
const run = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 1 << 24 }, (err, out, errText) => (err ? rej(new Error(`${cmd} ${args.join(' ')}\n${errText}`)) : res({ out, err: errText }))))

if (!existsSync(join(DIST, 'index.html'))) throw new Error(`dist 가 아니다: ${DIST}`)
const before = walk(DIST)
const beforeBytes = sizeOf(before)
const byFolder = new Map()
for (const p of before) { const k = folder(rel(p)); byFolder.set(k, (byFolder.get(k) ?? 0) + statSync(p).size) }

// ── 0) 시험 찌꺼기(_tmp)·카톡 사진/영상
for (const p of [join(DIST, '_tmp'), ...readdirSync(DIST).filter((n) => n.startsWith('KakaoTalk_')).map((n) => join(DIST, n))]) rmSync(p, { recursive: true, force: true })

// ── 1) 빼기
const bundle = readdirSync(join(DIST, 'assets')).filter((n) => n.endsWith('.js')).map((n) => readFileSync(join(DIST, 'assets', n), 'utf8')).join('\n')
const dropped = []
const drop = (p, why) => { dropped.push([rel(p), statSync(p).size, why]); rmSync(p) }
{
  // 각성 숨 영상: 주소를 만드는 곳은 loopFile·loopTakes·loopFile2·loopTakes2(awaken-art.ts)와 raid-main 의 HERO.video 뿐이고
  // 모두 AWAKEN_LOOP · AWAKEN2_LOOP 에 든 장수만 고른다 (HERO.video 도 본편이 AWAKEN_LOOP.has 로 넘긴다). 등록 전 영상은 형 판정 기다림.
  const art = await import(pathToFileURL(join(ROOT, 'src/realm/data/awaken-art.ts')).href)
  const keep = new Set([...[...art.AWAKEN_LOOP].flatMap((id) => art.loopTakes(id)), ...[...art.AWAKEN2_LOOP].flatMap((id) => art.loopTakes2(id))].map((f) => `realm/${f}`))
  for (const d of ['awaken-loop', 'awaken2-loop']) {
    const dir = join(DIST, 'realm', d)
    if (existsSync(dir)) for (const p of walk(dir)) if (p.endsWith('.mp4') && !keep.has(rel(p))) drop(p, '등록 안 된 각성 영상')
  }
  // 진각성 비기 전신 jpg: aw2SkillBody 를 부르는 곳이 없어 번들에 `skill-body/aw2/…jpg` 틀이 없다 (컷인 띠는 skill-body/aw2/cut/*.webp 만 쓴다).
  // 누가 그 함수를 쓰기 시작하면 번들에 cut/ 아닌 skill-body/aw2/ 가 생긴다 → 그때는 빼지 않는다.
  const aw2 = join(DIST, 'realm', 'skill-body', 'aw2')
  if (/skill-body\/aw2\/(?!cut\/)/.test(bundle)) say('skill-body/aw2/*.jpg 를 쓰는 코드가 생겨 그대로 둔다')
  else if (existsSync(aw2)) for (const n of readdirSync(aw2)) if (n.endsWith('.jpg')) drop(join(aw2, n), '부르는 곳 없는 진각성 전신')
  // 진각성 묶음 (11-18 형: 진각성은 DLC · 본편 빌드에서 끔 → src/realm/dlc.ts DLC.trueWake = false).
  // 진각성 그림·영상의 주소를 만드는 곳은 넷뿐이고 모두 DLC.trueWake 를 거친다:
  //   app.ts 장수 판(진각성 칸 · 진각성 초상·영상)은 TRUE_WAKE.has (= DLC.trueWake && …) · 싸움터의 진각성 장면(battlefield.ts)은 판의 셈이 낸
  //   act.true 뿐인데 그것은 heroes.trueWakeOf → TRUE_WAKE.has 에서만 켜진다 · 컷인 띠(cutin-band tier 2)와 맞은 초상(hit-portrait awaken2)은
  //   그 장면이 넘긴 '../awaken2-hd/' 얼굴에서만. 그래서 꺼진 빌드에서는 압축기가 app.ts 의 진각성 줄을 지워 번들에 'awaken2-loop' 가 없다 (확인 값).
  // DLC 를 켜면(또는 번들에 진각성 영상 틀이 남아 있으면) 빼지 않는다.
  const dlc = await import(pathToFileURL(join(ROOT, 'src/realm/dlc.ts')).href)
  if (dlc.DLC.trueWake !== false || bundle.includes('awaken2-loop')) say('진각성 DLC 가 켜져 있어 진각성 그림·영상을 그대로 둔다')
  else for (const d of ['realm/awaken2-loop', 'realm/awaken2-hd', 'realm/awaken2', 'realm/hit/awaken2', 'realm/skill-body/aw2']) {
    const dir = join(DIST, d)
    if (existsSync(dir)) { for (const p of walk(dir)) drop(p, '진각성 DLC (본편 빌드에서 꺼짐)'); rmSync(dir, { recursive: true, force: true }) }
  }
}

// ── 2) 다시 굽기
const require = createRequire(join(SHARP_DIR, 'package.json'))
const sharp = require(SHARP_DIR)
sharp.concurrency(1)
sharp.cache(false)

/** 원본과 견준 값: 알파 곱한 RGB 의 PSNR · 알파 PSNR · 8×8 칸 밝기 SSIM 가장 나쁜 값 (거의 투명한 칸은 뺀다) */
function fidelity(a, b, w, h) {
  let se = 0, n = 0, seA = 0
  for (let i = 0; i < w * h * 4; i += 4) {
    const aa = a[i + 3], ab = b[i + 3]
    seA += (aa - ab) ** 2
    if (aa === 0 && ab === 0) continue
    for (let c = 0; c < 3; c++) { const d = (a[i + c] * aa - b[i + c] * ab) / 255; se += d * d }
    n += 3
  }
  const psnr = n ? 10 * Math.log10(65025 / Math.max(se / n, 1e-9)) : 99
  const psnrAlpha = 10 * Math.log10(65025 / Math.max(seA / (w * h), 1e-9))
  const Y = (d, k) => (0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]) * d[k + 3] / 255
  let worst = 1
  for (let y = 0; y + 8 <= h; y += 4) for (let x = 0; x + 8 <= w; x += 4) {
    let ma = 0, mb = 0, va = 0, vb = 0, cov = 0, seen = 0
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const k = ((y + j) * w + x + i) * 4; if (a[k + 3] > 0) seen++; const p = Y(a, k), q = Y(b, k); ma += p; mb += q; va += p * p; vb += q * q; cov += p * q }
    if (seen < 16) continue
    ma /= 64; mb /= 64; va = va / 64 - ma * ma; vb = vb / 64 - mb * mb; cov = cov / 64 - ma * mb
    const s = ((2 * ma * mb + 6.5025) * (2 * cov + 58.5225)) / ((ma * ma + mb * mb + 6.5025) * (va + vb + 58.5225))
    if (s < worst) worst = s
  }
  return { psnr: +psnr.toFixed(2), psnrAlpha: +psnrAlpha.toFixed(2), worst: +worst.toFixed(4) }
}
const rgba = async (buf) => sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const measured = async (src, out) => { const [a, b] = [await rgba(src), await rgba(out)]; return fidelity(a.data, b.data, a.info.width, a.info.height) }

/** PNG 덩이 이름들 · 색 공간을 따로 적은 것(iCCP·gAMA·cHRM)과 움직이는 PNG(acTL)는 그대로 둔다 */
function pngChunks(b) {
  const names = new Set()
  for (let p = 8; p + 8 <= b.length;) { const len = b.readUInt32BE(p), t = b.toString('latin1', p + 4, p + 8); names.add(t); if (t === 'IEND') break; p += 12 + len }
  return names
}
/** JPEG 의 밝기 양자화 표 → IJG 품질 (표준 표를 그 품질로 늘인 것과 꼭 맞을 때만) · ICC(APP2) 가 있으면 null */
const STD = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99]
const ZIGZAG = [0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63]
function jpegQuality(b) {
  let q = null
  for (let i = 2; i + 4 < b.length && b[i] === 0xff;) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2)
    if (m === 0xe2) return null
    if (m === 0xdb && q === null && (b[i + 4] & 15) === 0) {
      const wide = b[i + 4] >> 4, table = Array.from({ length: 64 }, (_, k) => (wide ? b.readUInt16BE(i + 5 + k * 2) : b[i + 5 + k]))
      for (let t = 1; t <= 100 && q === null; t++) {
        const s = t < 50 ? 5000 / t : 200 - t * 2
        if (table.every((v, k) => v === Math.max(1, Math.min(255, Math.floor((STD[ZIGZAG[k]] * s + 50) / 100))))) q = t
      }
      if (q === null) return null
    }
    if (m === 0xda) break
    i += 2 + len
  }
  return q
}
/** ffmpeg 가 읽은 길이(초)·비트레이트·코덱 */
async function probe(path) {
  const { err } = await run(FFMPEG, ['-hide_banner', '-nostdin', '-i', path]).catch((e) => ({ err: e.message }))
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(err), br = /bitrate: (\d+) kb\/s/.exec(err)
  return { sec: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0, kbps: br ? Number(br[1]) : 0, vorbis: /Audio: vorbis/.test(err) }
}
const ffOut = async (path, tmp, args) => { await run(FFMPEG, ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error', '-i', path, ...args, tmp]); return { out: readFileSync(tmp) } }

/** 갈래마다 굽기 · 후보(out)와 잰 값(m)을 돌려준다 (굽지 않을 것이면 null) */
const BAKE = {
  async video(path, src, tmp) { return ffOut(path, tmp, KINDS.video.set) },
  async png(path, src) {
    const c = pngChunks(src)
    if (c.has('acTL') || c.has('iCCP') || c.has('gAMA') || c.has('cHRM')) return null
    const out = await sharp(src).png(KINDS.png.set).toBuffer()
    return { out, m: await measured(src, out) }
  },
  async jpg(path, src) {
    const q = jpegQuality(src)
    if (q === null) return null
    const { offset, ...opt } = KINDS.jpg.set
    const out = await sharp(src).jpeg({ ...opt, quality: q + offset }).toBuffer()
    return { out, m: await measured(src, out) }
  },
  async webp(path, src) {
    if (((await sharp(src).metadata()).pages ?? 1) > 1) return null
    const out = await sharp(src).webp(KINDS.webp.set).toBuffer()
    return { out, m: await measured(src, out) }
  },
  /** 긴 배경음만 · 짧은 효과음은 앞머리 박자를 코드가 재 둔 것(sound.ts LEAD_IN · PRE_ROLL)이 있어 그대로 */
  async bgm(path, src, tmp) {
    const s = KINDS.bgm.set, ext = extOf(path), p = await probe(path)
    if (p.sec < s.minSec) return null
    if (ext === 'ogg' && p.vorbis && p.kbps >= s.vorbisKbps) return ffOut(path, tmp, ['-map', '0:a:0', '-map_metadata', '-1', '-c:a', 'libvorbis', '-q:a', s.vorbisQ])
    if (ext === 'mp3' && p.kbps >= s.mp3Kbps) return ffOut(path, tmp, ['-map', '0:a:0', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-q:a', s.mp3Q])
    return null
  },
  async voice(path, src, tmp) {
    if (!(await probe(path)).vorbis) return null
    return ffOut(path, tmp, ['-map', '0:a:0', '-map_metadata', '-1', '-c:a', 'libvorbis', '-q:a', KINDS.voice.set.q])
  },
}
const pass = (g, m, a, b) => b <= a * g.ratio && (m === undefined || ((g.psnr ?? 0) <= m.psnr && (g.psnrAlpha ?? 0) <= m.psnrAlpha && (g.worst ?? 0) <= m.worst))

/** 무엇으로 구울까 · 맨 위 아이콘(파비콘·홈 화면 아이콘)과 번들(assets/)은 그대로 */
const kindOf = (r) => (r.startsWith('assets/') || !r.includes('/') ? null : Object.keys(KINDS).find((k) => KINDS[k].test(r)) ?? null)

const tags = Object.fromEntries(Object.keys(KINDS).map((k) => [k, tagOf(k)]))
for (const t of Object.values(tags)) mkdirSync(join(CACHE, t), { recursive: true })
const scratch = join(CACHE, `tmp-${process.pid}`)
mkdirSync(scratch, { recursive: true })
/** CI: 캐시 이름 = 갈래 이름 + 든 파일 목록 · 바뀐 게 없으면 다시 올리지 않는다 (deploy.yml 의 cache/save) */
const cacheKey = () => {
  if (!process.env.GITHUB_OUTPUT) return
  const h = createHash('sha1')
  for (const t of Object.values(tags).sort()) h.update(t + '\n' + readdirSync(join(CACHE, t)).filter((f) => !f.endsWith('.part')).sort().join('\n'))
  appendFileSync(process.env.GITHUB_OUTPUT, `cache-key=pages-shrink-${h.digest('hex').slice(0, 20)}\n`)
}
// 배포가 새 푸시로 취소되면(SIGINT) 여기까지 구운 것을 캐시에 남기고 끝낸다 · 다음 배포가 이어서 굽는다
for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { say(`${sig} · 구운 것까지 캐시에 남기고 멈춘다`); try { cacheKey() } finally { process.exit(130) } })
const used = new Set()
const stat = { hit: 0, baked: 0, kept: 0, failed: 0 }
const changed = [], logRows = []
/** 내용이 같은 파일(사본)은 한 번만 굽는다 · 동시에 오면 앞의 것을 기다린다 */
const inflight = new Map()
let tmpN = 0
/** 캐시에서 꺼내거나 새로 굽는다 → { out, m } · 굽지 않을 것이면 { out: null } · 실패하면 null */
async function baked(kind, key, ext, path, src, r) {
  const outFile = join(CACHE, tags[kind], `${key}.${ext}`), metaFile = join(CACHE, tags[kind], `${key}.json`)
  used.add(outFile); used.add(metaFile)
  if (existsSync(metaFile)) {
    const meta = JSON.parse(readFileSync(metaFile, 'utf8'))
    if (meta.none === true) { stat.hit++; return { out: null } }
    if (existsSync(outFile)) { stat.hit++; return { out: readFileSync(outFile), m: meta.m } }
  }
  const tmp = join(scratch, `${key}-${tmpN++}.${ext}`)
  try {
    const b = await BAKE[kind](path, src, tmp)
    stat.baked++
    if (b === null) { writeFileSync(metaFile, JSON.stringify({ none: true })); return { out: null } }
    writeFileSync(outFile + '.part', b.out); renameSync(outFile + '.part', outFile); writeFileSync(metaFile, JSON.stringify({ m: b.m }))
    return b
  } catch (e) {
    stat.failed++; say(`굽기 실패 · 원본 그대로: ${r}\n${String(e.message).slice(0, 400)}`)
    return null
  } finally { try { rmSync(tmp, { force: true }) } catch { /* 윈도에서 아직 잡혀 있으면 다음에 치운다 */ } }
}
async function one(path) {
  const r = rel(path), kind = kindOf(r)
  if (kind === null) return
  const src = readFileSync(path)
  const key = createHash('sha1').update(src).digest('hex'), ext = extOf(r), job = `${tags[kind]}/${key}.${ext}`
  let p = inflight.get(job)
  if (p === undefined) { p = baked(kind, key, ext, path, src, r).finally(() => inflight.delete(job)); inflight.set(job, p) }
  const res = await p
  if (res === null) return
  const { out, m } = res
  const ok = out !== null && pass(KINDS[kind].guard, m, src.length, out.length)
  if (LOG) logRows.push([r, kind, src.length, out?.length ?? '', m?.psnr ?? '', m?.psnrAlpha ?? '', m?.worst ?? '', ok ? 'swap' : 'keep'].join('\t'))
  if (!ok) { stat.kept++; return }
  writeFileSync(path, out)
  changed.push([r, kind, src.length, out.length])
}
const queue = walk(DIST).filter((p) => kindOf(rel(p)) !== null)
// 큰 것부터 · 끝에 큰 영상 하나가 홀로 도는 시간을 줄인다
queue.sort((x, y) => statSync(y).size - statSync(x).size)
await Promise.all(Array.from({ length: JOBS }, async () => { for (let p = queue.shift(); p !== undefined; p = queue.shift()) await one(p) }))
// 이번에 쓰지 않은 캐시는 지운다 (굽는 값이 바뀐 옛 갈래 폴더·남은 임시 폴더도) · 캐시가 끝없이 불지 않게
const live = new Set(Object.values(tags))
const tidy = (p, recursive) => { try { rmSync(p, { recursive, force: true }) } catch { /* 윈도에서 잡혀 있으면 다음에 */ } }
for (const d of readdirSync(CACHE)) {
  const p = join(CACHE, d)
  if (!live.has(d)) { tidy(p, true); continue }
  for (const f of readdirSync(p)) if (!used.has(join(p, f))) tidy(join(p, f), false)
}
cacheKey()
if (LOG) writeFileSync(LOG, ['file\tkind\tbefore\tcandidate\tpsnr\tpsnrAlpha\tssimWorst\tdecision', ...logRows].join('\n') + '\n')

// ── 3) 보고 · 한도
const after = walk(DIST)
const afterBytes = sizeOf(after)
const afterFolder = new Map()
for (const p of after) { const k = folder(rel(p)); afterFolder.set(k, (afterFolder.get(k) ?? 0) + statSync(p).size) }
console.log('pages-shrink: 폴더별 MB (전 -> 후)')
for (const [k, b] of [...byFolder].sort((x, y) => y[1] - x[1]).slice(0, 24)) console.log(`  ${(b / MB).toFixed(1).padStart(8)} -> ${((afterFolder.get(k) ?? 0) / MB).toFixed(1).padStart(8)}  ${k}`)
const byWhy = new Map()
for (const [, s, why] of dropped) { const v = byWhy.get(why) ?? [0, 0]; v[0]++; v[1] += s; byWhy.set(why, v) }
for (const [why, [n, s]] of byWhy) say(`뺌: ${why} ${n}개 ${(s / MB).toFixed(1)}MB`)
const byKind = new Map()
for (const [, kind, b, a] of changed) { const v = byKind.get(kind) ?? [0, 0, 0]; v[0]++; v[1] += b; v[2] += a; byKind.set(kind, v) }
for (const [kind, [n, b, a]] of byKind) say(`다시 구움: ${kind} ${n}개 ${(b / MB).toFixed(1)}MB -> ${(a / MB).toFixed(1)}MB`)
say(`캐시에서 ${stat.hit} · 새로 구움 ${stat.baked} · 원본 그대로 ${stat.kept} · 실패 ${stat.failed}`)
say(`${(beforeBytes / MB).toFixed(0)}MB -> ${(afterBytes / MB).toFixed(0)}MB (${afterBytes} bytes · 한도 ${LIMIT_MB}MB)`)
if (afterBytes > LIMIT_MB * MB) {
  console.log(`::error::Pages 판이 ${(afterBytes / MB).toFixed(0)}MB 로 한도 ${LIMIT_MB}MB 를 넘었다. 새로 넣은 큰 파일을 보거나 tools/pages-shrink.mjs 규칙을 늘릴 것 (원본은 그대로 두고 사이트 판만)`)
  process.exit(1)
}
