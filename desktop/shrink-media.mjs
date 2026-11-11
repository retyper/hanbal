// 배포용 사본(desktop/game)만 다시 인코딩해 용량을 줄인다. public/ 의 원본은 건드리지 않는다.
// - mp4: H.264 CRF 28 · slow · 해상도·프레임률 그대로 · AAC 96k(소리는 app.ts 가 켜서 쓴다) · +faststart
// - mp3(400KB↑): 128k · ogg(300KB↑): Vorbis q4 · 같은 형식·같은 파일 이름이라 코드가 부르는 경로는 그대로
// - 결과가 원본보다 작을 때만 바꾼다. 원본 내용 해시로 D:/tmp-node/shrink-cache 에 캐시해 다시 빌드가 빠르다.
// 쓰는 법: node shrink-media.mjs [게임폴더=desktop/game]   (환경변수 FFMPEG · SHRINK_CACHE · SHRINK_JOBS)
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, statSync, readFileSync, copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = process.argv[2] || join(here, 'game')
const FFMPEG = process.env.FFMPEG || 'C:/Users/my/AppData/Roaming/Python/Python39/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
const CACHE = process.env.SHRINK_CACHE || 'D:/tmp-node/shrink-cache'
const JOBS = Number(process.env.SHRINK_JOBS || 3)
const MP3_MIN = 400 * 1024
const OGG_MIN = 300 * 1024

// 인코딩 설정이 바뀌면 이 문자열을 바꿔 캐시를 무효화한다
const RECIPES = {
  '.mp4': { tag: 'v1-crf28-slow-aac96', args: ['-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'] },
  '.mp3': { tag: 'v1-mp3-128k', min: MP3_MIN, args: ['-vn', '-c:a', 'libmp3lame', '-b:a', '128k'] },
  '.ogg': { tag: 'v1-vorbis-q4', min: OGG_MIN, args: ['-vn', '-c:a', 'libvorbis', '-q:a', '4'] },
}

mkdirSync(CACHE, { recursive: true })
const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); const s = statSync(p); if (s.isDirectory()) walk(p); else if (RECIPES[extname(f).toLowerCase()] && s.size >= (RECIPES[extname(f).toLowerCase()].min ?? 0)) files.push({ p, size: s.size }) } }
walk(root)

const run = (args) => new Promise((res, rej) => {
  const c = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  let err = ''
  c.stderr.on('data', (d) => { err += d })
  c.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg ${code}: ${err.slice(-400)}`))))
})

const stat = { done: 0, cached: 0, kept: 0, before: 0, after: 0 }
const one = async ({ p, size }) => {
  const ext = extname(p).toLowerCase()
  const r = RECIPES[ext]
  const key = createHash('sha1').update(readFileSync(p)).update(r.tag).digest('hex')
  const cached = join(CACHE, key + ext)
  if (existsSync(cached)) stat.cached++
  else {
    const tmp = join(CACHE, key + '.tmp' + ext)
    await run(['-y', '-v', 'error', '-i', p, ...r.args, tmp])
    renameSync(tmp, cached)
  }
  const out = statSync(cached).size
  stat.before += size
  if (out < size * 0.9) { copyFileSync(cached, p); stat.after += out } else { stat.kept++; stat.after += size }
  if (++stat.done % 20 === 0) console.log(`shrink ${stat.done}/${files.length}`)
}

let i = 0
await Promise.all(Array.from({ length: JOBS }, async () => { while (i < files.length) await one(files[i++]) }))
const mb = (n) => (n / 1048576).toFixed(0)
console.log(`shrink ok: ${files.length}개 ${mb(stat.before)}MB → ${mb(stat.after)}MB (캐시 ${stat.cached} · 그대로 ${stat.kept})`)
