// 데스크톱 포장 시험. 숨긴 창으로 두 번 띄워(저장 유지 확인) 제목 화면·mp4·오디오·localStorage·종료를 검사한다.
// 사용: node verify.mjs [--packed]   (--packed 면 dist/win-unpacked 의 실행 파일을, 아니면 개발용 electron 을 쓴다)
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const packed = process.argv.includes('--packed')
const outDir = process.env.SAMHAN_OUT || 'D:/tmp-node'
mkdirSync(outDir, { recursive: true })
const userData = mkdtempSync(join(outDir, 'samhan-ud-'))

function run(phase) {
  return new Promise((resolve) => {
    let cmd, args
    const env = { ...process.env, SAMHAN_USER_DATA: userData, SAMHAN_OUT: outDir }
    if (packed) { cmd = join(here, 'dist', 'win-unpacked', '삼한열전.exe'); args = []; env.SAMHAN_VERIFY_PHASE = phase }
    else { cmd = createRequire(import.meta.url)('electron'); args = [join(here, 'verify-main.cjs'), phase] }
    const t0 = Date.now()
    const p = spawn(cmd, args, { cwd: here, env })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', () => {})
    const kill = setTimeout(() => { p.kill(); resolve({ timeout: true, out }) }, 90000)
    p.on('exit', (code, sig) => { clearTimeout(kill); const m = out.match(/VERIFY_RESULT (.*)/); resolve({ code, sig, ms: Date.now() - t0, result: m ? JSON.parse(m[1]) : null }) })
  })
}

const r1 = await run('phase1')
const r2 = await run('phase2')
console.log(JSON.stringify({ r1, r2 }, null, 1))
const c1 = r1.result?.checks ?? {}, c2 = r2.result?.checks ?? {}
const rows = [
  ['제목 화면 렌더(스플래시 걷힘, PNG>200KB)', c1.title?.bytes > 200000 && r1.result?.splash === 'gone'],
  ['mp4(H.264) 재생', !!c1.video?.ok],
  ['AudioContext 생성', !!c1.audio?.ok],
  ['localStorage 쓰기', c1.lsWrite === 'persist-42'],
  ['재실행 뒤 localStorage 유지', c2.lsRead === 'persist-42'],
  ['시험 키 제거', c2.lsAfterRemove === null],
  ['정상 종료(1회차)', r1.code === 0 && !r1.timeout],
  ['정상 종료(2회차)', r2.code === 0 && !r2.timeout],
]
let fail = 0
for (const [n, ok] of rows) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) fail++ }
rmSync(userData, { recursive: true, force: true })
process.exit(fail ? 1 : 0)
