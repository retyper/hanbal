// shorts.mjs — 각성 숨쉬기 영상 10초로 세로 쇼츠 한 편 (형 11-11: "견지쇠비 같은 10초짜리 띄워 주면 … 링크나 게임 이름만 쳐 주면")
//   node tools/shorts.mjs --id w-30-guya-soebi --name "견지 쇠비" [--line "뽑기 없이, 싸워서 사로잡는다"] [--cta "스팀에서 찜하기"] [--url "store.steampowered.com/app/…"] [--title-img public/realm/logo/title.png] [--out D:/tmp-node/shorts/<id>.mp4]
// - 위: 장수 이름(크게) · 한 줄 훅  ·  아래: 제목 로고 · 찜하기 · 주소   (글자는 0.4초부터 서서히)
// - 1080×1920 · H.264 CRF 18 · 원래 소리 그대로 · 원본 영상은 읽기만 한다
// - 글꼴: KoPub 바탕 Bold (상업 이용 가능 · Windows 글꼴 폴더) — ffmpeg 경로 문제를 피하려 작업 폴더로 복사해 쓴다
// - 15세 선: assets_r19 로 옮긴 장수(노출 넘는 판)는 만들지 않는다 → --force 없이는 R19 목록이면 멈춘다
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const FF = process.env.FFMPEG ?? 'C:/Users/my/AppData/Roaming/Python/Python39/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
const FONT = process.env.SHORTS_FONT ?? 'C:/Windows/Fonts/KoPubBatangBold.ttf'
/** 노출이 15세 선을 넘는 판 (STEAM-RELEASE.md 등급 방향) — 15세 판을 다시 구울 때까지 쇼츠에 쓰지 않는다 */
const R19 = new Set(['w-18-jinhan-salt-widow', 'w-91-saro-mulsae', 'w-98-byeonhan-danbi', 'w-103-tahae-neoul'])

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d }
const id = arg('id')
const name = arg('name')
if (id === undefined || name === undefined) { console.error('--id <그림 id> --name "<장수 이름>" 이 필요하다'); process.exit(1) }
if (R19.has(id) && !process.argv.includes('--force')) { console.error(`${id} 는 15세 선을 넘는 판이다 (assets_r19) — 15세 판을 구운 뒤에`); process.exit(1) }
const root = resolve(import.meta.dirname, '..')
const src = join(root, 'public/realm/awaken-loop', `${id}.mp4`)
if (!existsSync(src)) { console.error(`영상 없음: ${src}`); process.exit(1) }
const line = arg('line', '뽑기 없이, 싸워서 사로잡는다')
const cta = arg('cta', '스팀에서 찜하기')
const url = arg('url', '')
const titleImg = resolve(arg('title-img', join(root, 'public/realm/logo/title.png')))
const out = resolve(arg('out', `D:/tmp-node/shorts/${id}.mp4`))

// 작업 폴더 — 글꼴과 글 파일을 상대 경로로 (윈도 드라이브 콜론이 drawtext 를 깨뜨린다)
const work = resolve(arg('work', 'D:/tmp-node/shorts/work'))
mkdirSync(work, { recursive: true })
mkdirSync(resolve(out, '..'), { recursive: true })
copyFileSync(FONT, join(work, 'font.ttf'))
const texts = { 'name.txt': name, 'line.txt': line, 'cta.txt': cta, 'url.txt': url }
for (const [f, t] of Object.entries(texts)) writeFileSync(join(work, f), t, 'utf8')

const fade = (t0) => `alpha='if(lt(t,${t0}),0,min(1,(t-${t0})/0.5))'`
const dt = (file, size, y, t0, extra = '') =>
  `drawtext=fontfile=font.ttf:textfile=${file}:fontsize=${size}:fontcolor=0xFFF1D6:borderw=4:bordercolor=0x1A0E06:x=(w-text_w)/2:y=${y}:${fade(t0)}${extra}`
// 위·아래는 딱딱한 띠 대신 위에서 아래로 옅어지는 그늘 (글자가 읽히고 그림은 덜 가린다)
const shade = (h, top) => `color=c=black@1:s=1080x${h}:d=11,format=rgba,geq=r=0:g=0:b=0:a='${top ? `170*pow(1-Y/${h},1.3)` : `190*pow(Y/${h},1.3)`}'`
const vf = [
  '[0:v]scale=1080:1920:flags=lanczos,setsar=1[base]',
  `${shade(420, true)}[gt]`,
  `${shade(640, false)}[gb]`,
  '[base][gt]overlay=0:0:shortest=1[b1]',
  '[b1][gb]overlay=0:H-640:shortest=1[b2]',
  '[1:v]scale=900:-1[logo]',
  "[b2][logo]overlay=x=(W-w)/2:y=H-440:enable='gte(t,1.0)'[b3]",
  `[b3]${[
    dt('name.txt', 96, 90, 0.4),
    dt('line.txt', 46, 222, 0.8),
    dt('cta.txt', 58, 'h-200', 1.2),
    ...(url !== '' ? [dt('url.txt', 34, 'h-118', 1.4)] : []),
  ].join(',')}[v]`,
].join(';')

const args = ['-y', '-loglevel', 'error', '-i', src, '-i', titleImg, '-filter_complex', vf, '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]
const r = spawnSync(FF, args, { cwd: work, stdio: ['ignore', 'inherit', 'inherit'] })
if (r.status !== 0) { console.error('ffmpeg 실패'); process.exit(1) }
console.log(out)
