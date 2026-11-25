/**
 * 전장 발소리를 「여러 명」으로 굽는다 (F3e · 형 11-25: "걷기 달리기 발소리는 1명분 발소리라서 여러개를 붙여만들던지")
 *
 * 한 명분 발소리 원본을 N겹으로 겹친다. 겹마다 시작을 0~한 걸음 사이에서 어긋나게(고른 간격 + 흔들림), 빠르기 · 크기 · 좌우를 조금씩 달리한다.
 * 적음은 흔들림이 작아 발소리가 낱낱이 들리고, 많음은 흔들림이 커서 웅성이는 행군 소리가 된다. 씨앗이 고정이라 다시 구워도 같은 파일이다.
 * 합친 뒤 봉우리를 -1.5 dB 로 맞추고(본편 효과음 수준) 끝 0.3초를 앞에 겹쳐 물려 이음매 없는 고리로 만든다.
 *
 *   node tools/field-crowd-steps.mjs            (여섯 개 모두)
 *   node tools/field-crowd-steps.mjs walk few   (하나만)
 *
 * 원본(받은 파일)은 assets_src/realm/sfx-in/gongu/field/<번호>.bin (저장소 밖 · 이 PC 에만 있다).
 * 걷기 = 공유마당 13264254 「발_흙길_고무신_여자_천천히걷기」 · 달리기 = 13264251 「발_흙길_고무신_어린이_달리기」 (둘 다 한국저작권위원회 · CC BY)
 * 도구: imageio-ffmpeg 의 ffmpeg (tools/bake-bgm.py 와 같은 길).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const FF = process.env.FFMPEG ?? 'C:\\Users\\my\\AppData\\Roaming\\Python\\Python39\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe'
const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'assets_src/realm/sfx-in/gongu/field')
const OUT = path.join(ROOT, 'public/realm/sfx')
const TMP = path.join(ROOT, 'tools/out/f3e')
const SR = 44100
const LOOP_SEC = 3.0, WRAP_SEC = 0.3, PEAK_DB = -1.5
// 발소리는 뾰족해서 봉우리만 맞추면 평균이 한참 작다 — 가볍게 눌러 평균을 본편 효과음 쪽으로 올린다
const COMP = 'acompressor=threshold=0.05:ratio=4:attack=3:release=60:makeup=4,alimiter=limit=0.84:level=disabled'

/** 원본 · 시작(초) · 쓸 길이(초) · 한 걸음 길이(초 · 겹의 시작을 이 안에서 어긋나게) */
const KIND = {
  walk: { id: 13264254, from: 0.33, len: 11.5, step: 0.7 },
  run: { id: 13264251, from: 0.15, len: 6.6, step: 0.36 },
}
/** 단계 · 겹 수 · 시작 흔들림(0 = 고른 간격 · 1 = 한 걸음 안에서 마음대로) · 빠르기 ± · 크기 ±dB · 좌우 ± */
const LEVEL = {
  few: { n: 4, jitter: 0.25, rate: 0.04, db: 2, pan: 0.45 },
  mid: { n: 12, jitter: 0.6, rate: 0.05, db: 3, pan: 0.6 },
  many: { n: 30, jitter: 1, rate: 0.06, db: 3, pan: 0.75 },
}

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const seedOf = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }

function ff(args, opt = {}) {
  const r = spawnSync(FF, ['-nostdin', '-hide_banner', '-y', ...args], { maxBuffer: 1 << 28, ...opt })
  if (r.status !== 0) throw new Error(String(r.stderr).slice(-1500))
  return r
}

function decode(kind) {
  const k = KIND[kind]
  const r = ff(['-ss', String(k.from), '-t', String(k.len), '-i', path.join(SRC, `${k.id}.bin`), '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'pipe:1'])
  const b = r.stdout
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength - (b.byteLength % 4)))
}

function bake(kind, level) {
  const k = KIND[kind], L = LEVEL[level]
  const src = decode(kind)
  const rnd = mulberry32(seedOf(`${kind}-${level}`))
  const total = Math.round((LOOP_SEC + WRAP_SEC) * SR)
  const mixL = new Float64Array(total), mixR = new Float64Array(total)
  const stepS = Math.round(k.step * SR)
  for (let i = 0; i < L.n; i++) {
    const base = (stepS * i) / L.n
    const off = base + (rnd() - 0.5) * L.jitter * stepS
    const rate = 1 + (rnd() * 2 - 1) * L.rate
    const need = Math.ceil(total * rate) + stepS * 2
    // 다른 겹은 다른 대목에서 읽는다 (같은 발소리가 되풀이되어 들리지 않게) · 걸음 박자는 한 걸음 단위로 옮겨 맞춘다
    const room = Math.max(0, src.length - need)
    const seg = Math.floor((rnd() * room) / stepS) * stepS
    const start = Math.max(0, seg + Math.round(((off % stepS) + stepS) % stepS))
    const g = Math.pow(10, ((rnd() * 2 - 1) * L.db) / 20)
    const pan = (rnd() * 2 - 1) * L.pan
    const gl = Math.cos(((pan + 1) * Math.PI) / 4) * g, gr = Math.sin(((pan + 1) * Math.PI) / 4) * g
    for (let n = 0; n < total; n++) {
      const p = start + n * rate, i0 = Math.floor(p)
      if (i0 + 1 >= src.length) break
      const f = p - i0, v = src[i0] * (1 - f) + src[i0 + 1] * f
      mixL[n] += v * gl; mixR[n] += v * gr
    }
  }
  // 끝 0.3초를 앞에 겹쳐 물린다 (같은 힘 겹침)
  const loop = Math.round(LOOP_SEC * SR), wrap = Math.round(WRAP_SEC * SR)
  const outL = new Float64Array(loop), outR = new Float64Array(loop)
  for (let n = 0; n < loop; n++) { outL[n] = mixL[n]; outR[n] = mixR[n] }
  for (let n = 0; n < wrap; n++) {
    const t = (n + 0.5) / wrap, a = Math.sin((t * Math.PI) / 2), b = Math.cos((t * Math.PI) / 2)
    outL[n] = mixL[n] * a + mixL[loop + n] * b
    outR[n] = mixR[n] * a + mixR[loop + n] * b
  }
  let peak = 0
  for (let n = 0; n < loop; n++) peak = Math.max(peak, Math.abs(outL[n]), Math.abs(outR[n]))
  const gain = Math.pow(10, PEAK_DB / 20) / peak
  const pcm = Buffer.alloc(loop * 4)
  for (let n = 0; n < loop; n++) {
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(outL[n] * gain * 32767))), n * 4)
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(outR[n] * gain * 32767))), n * 4 + 2)
  }
  const raw = path.join(TMP, `crowd_${kind}_${level}.raw`)
  fs.mkdirSync(TMP, { recursive: true })
  fs.writeFileSync(raw, pcm)
  const out = path.join(OUT, `field_step_${kind}_${level}.ogg`)
  ff(['-f', 's16le', '-ar', String(SR), '-ac', '2', '-i', raw, '-af', COMP, '-c:a', 'libvorbis', '-q:a', '4', out])
  fs.unlinkSync(raw)
  const st = spawnSync(FF, ['-nostdin', '-hide_banner', '-i', out, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
  const mean = /mean_volume: (-?[0-9.]+)/.exec(st)?.[1], max = /max_volume: (-?[0-9.]+)/.exec(st)?.[1]
  console.log(`field_step_${kind}_${level}.ogg\t${L.n}겹\t${LOOP_SEC}초\t${fs.statSync(out).size}B\t봉우리 ${max} dB · 평균 ${mean} dB`)
}

/**
 * 말발굽 고리 — 본편 말 소리 m (horses_m.wav 4초 · 여러 마리가 겹친 떼)의 끝 0.3초를 앞에 겹쳐 물려 3.7초 고리로 굽는다.
 * 말은 이미 여러 마리가 겹친 소리라 사람 발소리처럼 단계를 따로 굽지 않는다. 걷기와 질주는 같은 파일을 재생 빠르기와 크기로 가른다 (mainSound.ts).
 */
function hoof() {
  const src = path.join(ROOT, 'public/realm/sfx/horses_m.wav')
  const r = ff(['-i', src, '-ac', '2', '-ar', String(SR), '-f', 'f32le', 'pipe:1'])
  const b = r.stdout
  const a = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength - (b.byteLength % 4)))
  const total = Math.floor(a.length / 2), wrap = Math.round(0.3 * SR), loop = total - wrap
  const out = new Float64Array(loop * 2)
  for (let n = 0; n < loop; n++) { out[n * 2] = a[n * 2]; out[n * 2 + 1] = a[n * 2 + 1] }
  for (let n = 0; n < wrap; n++) {
    const t = (n + 0.5) / wrap, x = Math.sin((t * Math.PI) / 2), y = Math.cos((t * Math.PI) / 2)
    for (let c = 0; c < 2; c++) out[n * 2 + c] = a[n * 2 + c] * x + a[(loop + n) * 2 + c] * y
  }
  let peak = 0
  for (const v of out) peak = Math.max(peak, Math.abs(v))
  const g = Math.pow(10, PEAK_DB / 20) / peak
  const pcm = Buffer.alloc(out.length * 2)
  out.forEach((v, i) => pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * g * 32767))), i * 2))
  const raw = path.join(TMP, 'hoof.raw'), dst = path.join(OUT, 'field_hoof_loop.ogg')
  fs.mkdirSync(TMP, { recursive: true })
  fs.writeFileSync(raw, pcm)
  ff(['-f', 's16le', '-ar', String(SR), '-ac', '2', '-i', raw, '-c:a', 'libvorbis', '-q:a', '4', dst])
  fs.unlinkSync(raw)
  const st = spawnSync(FF, ['-nostdin', '-hide_banner', '-i', dst, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
  console.log(`field_hoof_loop.ogg	본편 horses_m 0~${(loop / SR).toFixed(2)}초 + 끝 0.3초 겹침	${fs.statSync(dst).size}B	봉우리 ${/max_volume: (-?[0-9.]+)/.exec(st)?.[1]} dB · 평균 ${/mean_volume: (-?[0-9.]+)/.exec(st)?.[1]} dB`)
}

const [kArg, lArg] = process.argv.slice(2)
if (kArg === 'hoof') hoof()
else for (const kind of kArg ? [kArg] : Object.keys(KIND)) for (const level of lArg ? [lArg] : Object.keys(LEVEL)) bake(kind, level)
