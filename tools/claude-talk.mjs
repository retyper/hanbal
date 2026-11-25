// 설계·검수를 Claude API 와 주고받는다 (11-25 형 「api랑도 대화해 가면서 시제품 완성까지 해봐」).
// tools/claude-review.mjs(그림 검수 · 한 장 한 번)와 달리 **이어지는 대화**다: 앞 말을 기억하고 다음 물음을 잇는다.
//
//   node tools/claude-talk.mjs <대화 이름> <물음.md> [그림.png|jpg …] [--system=<역할.md>] [--effort=high|medium|low]
//   대화는 tools/out/talk/<대화 이름>.json 에 쌓인다(그림은 그 차례에만 보내고, 기록에는 파일 이름만 남긴다).
//   답은 tools/out/talk/<대화 이름>-<차례>.md 에 쓰고 화면에는 첫머리만 찍는다.
//
// 키: tools/claude-review.mjs 와 같은 차례로 읽는다(HANBAL_CLAUDE_KEY → ~/.keys/클로드키.txt → ~/Downloads/클로드키.txt).
//     **찍지 않고, 저장소·메모리·다른 파일에 옮기지 않는다.** ANTHROPIC_API_KEY 는 쓰지 않는다.
// 보내는 글에는 사용자·프로젝트 이름을 넣지 않는다(물음 글을 쓸 때 지킨다).
// 쓴 토큰: tools/out/api-ledger.tsv 에 한 줄씩.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.CLAUDE_REVIEW_MODEL || 'claude-opus-5-5'
const LEDGER = path.resolve('tools/out/api-ledger.tsv')
const DIR = path.resolve('tools/out/talk')

function apiKey() {
  if (process.env.HANBAL_CLAUDE_KEY) return process.env.HANBAL_CLAUDE_KEY.trim()
  const p = [path.join(os.homedir(), '.keys', '클로드키.txt'), path.join(os.homedir(), 'Downloads', '클로드키.txt')].find(f => fs.existsSync(f))
  if (!p) throw new Error('키가 없다: 환경 변수 HANBAL_CLAUDE_KEY 또는 ~/.keys/클로드키.txt')
  const k = fs.readFileSync(p, 'utf8').replace(/^﻿/, '').trim()
  if (!k.startsWith('sk-ant-')) throw new Error('키 파일 모양이 다르다(내용은 찍지 않음)')
  return k
}

const args = process.argv.slice(2)
const name = args[0]
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')))
const rest = args.slice(1).filter(a => !a.startsWith('--'))
if (!name || rest.length === 0) { console.error('쓰는 법: node tools/claude-talk.mjs <대화 이름> <물음.md> [그림 …] [--system=역할.md] [--effort=high]'); process.exit(2) }
const ask = fs.readFileSync(rest[0], 'utf8')
const images = rest.slice(1)
const MEDIA = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

fs.mkdirSync(DIR, { recursive: true })
const file = path.join(DIR, `${name}.json`)
const talk = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { system: '', turns: [] }
if (opt.system) talk.system = fs.readFileSync(opt.system, 'utf8')

// 앞 차례들은 글만 보낸다(그림은 「[그림: 이름]」 한 줄로 남아 있다)
const messages = talk.turns.map(t => ({ role: t.role, content: t.text }))
const now = [
  ...images.map(f => {
    const media = MEDIA[path.extname(f).toLowerCase()]
    if (!media) throw new Error(`그림 종류를 모른다: ${f}`)
    return { type: 'image', source: { type: 'base64', media_type: media, data: fs.readFileSync(f).toString('base64') } }
  }),
  { type: 'text', text: ask },
]
messages.push({ role: 'user', content: now })

const client = new Anthropic({ apiKey: apiKey() })
let res
try {
  // 답이 길 수 있어 스트리밍으로 받고 끝난 말만 모은다(SDK 의 finalMessage)
  res = await client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: opt.effort || 'high' },
    ...(talk.system ? { system: talk.system } : {}),
    messages,
  }).finalMessage()
} catch (e) {
  const status = e instanceof Anthropic.APIError ? e.status : ''
  console.error(`실패: ${status} ${String(e.message || e).slice(0, 300)}`)
  process.exit(1)
}
const u = res.usage || {}
fs.mkdirSync(path.dirname(LEDGER), { recursive: true })
fs.appendFileSync(LEDGER, [new Date().toISOString(), res.model, `talk:${name}`, u.input_tokens ?? '', u.output_tokens ?? ''].join('\t') + '\n')
if (res.stop_reason === 'refusal') { console.error(`거절: ${res.stop_details?.category ?? 'unknown'} — 다시 넣지 않는다`); process.exit(3) }
const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('')
const n = talk.turns.filter(t => t.role === 'assistant').length + 1
talk.turns.push({ role: 'user', text: (images.length ? images.map(f => `[그림: ${path.basename(f)}]`).join(' ') + '\n' : '') + ask })
talk.turns.push({ role: 'assistant', text })
fs.writeFileSync(file, JSON.stringify(talk, null, 1))
const out = path.join(DIR, `${name}-${n}.md`)
fs.writeFileSync(out, text)
console.log(`${res.model} · 들어감 ${u.input_tokens ?? '?'} · 나옴 ${u.output_tokens ?? '?'} · ${res.stop_reason} → ${path.relative(process.cwd(), out)}`)
console.log(text.slice(0, 600))
