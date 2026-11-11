/** Real-ESRGAN(anime x2) 로 띠를 두 배로 키워 가장자리·눈코입을 되살린다 — 내용 해시로 D:/tmp-node/esr-cache 에 캐시 (다시 돌려도 빠르다) */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { decodePng, encodePng } from './png.mjs'

const EXE = process.env.ESR_EXE ?? 'D:/tools/realesrgan/realesrgan-ncnn-vulkan.exe'
const CACHE = process.env.ESR_CACHE ?? 'D:/tmp-node/esr-cache'
const WORK = 'D:/tmp-node/esr-work'

/** RGBA 이미지 {w,h,px} → x2 이미지 */
export function esrUpscale(img) {
  mkdirSync(CACHE, { recursive: true })
  const key = createHash('sha1').update(img.px).update(`${img.w}x${img.h}`).digest('hex')
  const out = `${CACHE}/${key}.png`
  if (!existsSync(out)) {
    mkdirSync(WORK, { recursive: true })
    const inp = `${WORK}/${key}-in.png`
    writeFileSync(inp, encodePng(img.w, img.h, img.px))
    const r = spawnSync(EXE, ['-i', inp, '-o', out, '-n', 'realesr-animevideov3', '-s', '2', '-f', 'png'], { stdio: 'ignore' })
    rmSync(inp, { force: true })
    if (r.status !== 0 || !existsSync(out)) throw new Error(`esrgan 실패 ${key}`)
  }
  return decodePng(out)
}
