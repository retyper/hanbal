// 웹판을 desktop/game 으로 빌드하고, 포장에 필요 없는 것(작업 폴더·검토용 파일)을 덜어낸다.
// base 는 '/' 그대로 — app://game/ 이 루트이므로 Pages 배포(PUBLIC_BASE)와 충돌하지 않는다.
import { execSync } from 'node:child_process'
import { rmSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const out = join(here, 'game')
rmSync(out, { recursive: true, force: true })
execSync(`npx vite build --outDir "${out}" --emptyOutDir`, { cwd: repo, stdio: 'inherit', env: { ...process.env } })

for (const p of ['_tmp', 'sound-picker.html', 'sw.js']) rmSync(join(out, p), { recursive: true, force: true })
for (const f of readdirSync(out)) if (/^KakaoTalk_/.test(f)) rmSync(join(out, f))
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.x-.*\.mp4$/.test(f)) rmSync(p) } }
walk(out)
if (!existsSync(join(out, 'realm.html'))) throw new Error('realm.html 이 없다')
if (process.env.SHRINK !== '0') execSync('node "' + join(here, 'shrink-media.mjs') + '" "' + out + '"', { stdio: 'inherit' })
console.log('game build ok →', out)
