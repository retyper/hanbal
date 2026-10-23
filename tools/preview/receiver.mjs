/**
 * 브라우저가 구운 WebP 를 받아 public/ 아래에 적는다 (개발용 · 2026-09-20).
 *
 * tools/preview 의 bakeBackdrop · bakeWebp 가 여기로 보낸다. 크롬은 한 페이지가 파일을 연달아 내려받으면 막아 버려서
 * (두 겹짜리 배경이 그렇게 막혔다) 다운로드 대신 이 길을 쓴다.
 *
 *   node tools/preview/receiver.mjs        # 127.0.0.1:5199 — 다 구웠으면 끈다
 *
 * 받는 것은 **public/bg · public/sprites · public/realm/map-* 아래의 .webp 뿐**이다. 그 밖의 경로·확장자는 거절한다.
 */
import { createServer } from 'node:http'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

const OK = /^(bg|sprites|realm\/map-[a-z]+)\/[a-z0-9-]+\.webp$|^realm\/(keyart|battle|title|event)\/[a-z0-9-]+\.jpg$|^realm\/sfx\/[a-z0-9_]+\.wav$/ // 영남 판의 계절 지도도 받는다 (2026-10-18) · 표지·싸움터·로비·사건 jpg 도 · 브라우저로 잘라 낸 누르는 소리 wav 도 (2026-10-23)
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }
  const rel = decodeURIComponent((req.url ?? '').replace(/^\/save\//, ''))
  if (req.method !== 'PUT' || !OK.test(rel)) { res.writeHead(400).end('거절: ' + rel); return }
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const buf = Buffer.concat(chunks)
    const isWebp = buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP'
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    const isWav = buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WAVE'
    if (!(rel.endsWith('.webp') ? isWebp : rel.endsWith('.wav') ? isWav : isJpg)) {
      res.writeHead(400).end('webp/jpg/wav 가 아니다')
      return
    }
    const file = normalize(join('public', rel))
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, buf)
    console.log(`${file}  ${(buf.length / 1024).toFixed(1)}KB`)
    res.writeHead(200).end('ok')
  })
}).listen(5199, '127.0.0.1', () => console.log('받는 중 — http://127.0.0.1:5199/save/<bg|sprites>/<이름>.webp'))
