/**
 * 조사 검사 — 글 틀 속 `${…}` 바로 뒤에 받침 따라 바뀌는 조사(이·가·을·를·은·는·과·와·으로 …)를 손으로 붙인 곳을 찾는다
 * (형 2026-10-19: "우리 궁수이 적어 잘 안먹힌다? 텍스트들 규칙에서 항상 이렇게 한글 조사 틀리지 않게 확실하게 규칙 짜놔").
 *
 * 규칙: 이름·고을·병종처럼 바뀌는 낱말 뒤의 조사는 **반드시** prose.josa(낱말, '이', '가') 로 붙인다.
 * 숫자 뒤에 단위가 있으면(`${n}명이`) 단위가 받침을 정하니 괜찮다 — 이 검사는 `}` 바로 뒤의 조사만 본다.
 * tests/realm/josa.test.ts 가 이 검사를 돌려 0 곳이어야 통과한다.
 *
 *   node --experimental-strip-types tools/josa-lint.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const DIRS = ['src/ui/realm', 'src/realm']
// '로' 와 '을(를)' 같은 둘 다 적기도 잡는다 (2026-10-20 끝 화면의 "골포국로 다시" · "마을을(를) 쥐었다")
const PARTICLES = ['이', '가', '을', '를', '은', '는', '과', '와', '으로', '로', '이다', '이었다', '이고', '이며', '을\\(를\\)', '를\\(을\\)', '이\\(가\\)', '은\\(는\\)', '과\\(와\\)', '와\\(과\\)', '\\(으\\)로']
const RE = new RegExp('\\$\\{([^{}]{1,120})\\}(' + PARTICLES.join('|') + ')(?=[\\s.,!?·)<`\'"—:;]|$)', 'g')
/** 받침이 정해진 것을 내는 식 — 숫자(·명·집 같은 단위 없이 끝나도 조사가 안 붙는 곳에서만 쓰인다) · josa 를 이미 거친 것 */
const SAFE = /josa\(/

export function lint(): Array<{ file: string; line: number; text: string }> {
  const out: Array<{ file: string; line: number; text: string }> = []
  const walk = (d: string): void => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f)
      if (fs.statSync(p).isDirectory()) { walk(p); continue }
      if (!p.endsWith('.ts')) continue
      const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
      lines.forEach((l, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(l)) return
        for (const m of l.matchAll(RE)) {
          if (SAFE.test(m[1]!)) continue
          out.push({ file: p.split(path.sep).join('/'), line: i + 1, text: l.trim().slice(0, 160) })
        }
      })
    }
  }
  for (const d of DIRS) walk(d)
  return out
}

if (process.argv[1]?.endsWith('josa-lint.ts')) {
  const hits = lint()
  for (const h of hits) console.log(`${h.file}:${h.line}  ${h.text}`)
  console.log(`${hits.length} 곳`)
}
