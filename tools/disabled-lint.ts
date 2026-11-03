/**
 * 말없이 죽은 단추 세기 — 화면 틀(src/ui/realm)의 템플릿에 `disabled` 를 쓴 곳 (위원회 11-04 UX ④ · 메모리 「못 하는 단추는 까닭+소리」).
 * disabled 단추는 click 이 오지 않아 denyPop(까닭·소리)이 못 받는다. noBtn(까닭) 을 쓴다. 0곳이 목표다.
 * 체크박스(input)와 :disabled CSS · aria-disabled · 주석은 센다에서 뺀다.
 *   node --experimental-strip-types tools/disabled-lint.ts
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'src/ui/realm'
let n = 0
for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts')).sort()) {
  const lines = readFileSync(join(dir, f), 'utf8').split('\n')
  lines.forEach((line, i) => {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
    const code = line.replace(/aria-disabled/g, '').replace(/:disabled/g, '').replace(/\.disabled/g, '')
    if (!/(['" ]disabled['" >])|('disabled')/.test(code)) return
    if (/<input/.test(line)) return // 체크박스는 손으로 못 누르는 것이 맞다
    n++
    console.log(`${dir}/${f}:${i + 1}: ${t.slice(0, 120)}`)
  })
}
console.log(`${n} 곳`)
