// 그림 검수를 Claude API 에 맡긴다 (11-24 형 「클로드 200달러 많이 써도 되니까 적절하게 잘 활용해봐」).
// 본체(이 대화)가 판을 한 장씩 열어 보면 맥락이 금방 찬다 — 검수 눈은 API 로, 본체는 걸린 것만 본다.
//
//   node tools/claude-review.mjs <검수 이름> <그림.png> [그림.png …] [--brief=<점검 목록.md>] [--par=4]
//   그림 한 장마다 한 번 묻는다(동시에 par 개). 결과: tools/out/review/claude-<검수 이름>.json · 걸린 것만 화면에 찍는다.
//
// 키: 형이 만든 ~/Downloads/클로드키.txt 를 실행할 때만 읽는다. **찍지 않고, 저장소·메모리·다른 파일에 옮기지 않는다.**
// 모델: claude-opus-5-5 (기본 · 그림 판단) · 거절되면 서버가 다른 모델로 넘긴다(fallbacks "default").
// 쓴 토큰: tools/out/api-ledger.tsv 에 한 줄씩.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.CLAUDE_REVIEW_MODEL || 'claude-opus-5-5'
const LEDGER = path.resolve('tools/out/api-ledger.tsv')

const BRIEF = `You are a strict art reviewer for a 2D pixel-art game's battle sprites. Each image you get is one row or board of game-size cells:
the leftmost cell is the APPROVED standing pose of a hero; the other cells are new animation cells of the SAME hero (in order: hit flinch, knocked back, kneeling on one knee to get up, wide fighting stance), unless the request says otherwise.
Check every new cell against the approved standing cell and report only real problems a player would notice:
- identity: different face, hair, hairstyle color, outfit, outfit colors or accessories than the standing cell (a different garment, missing cape/fur, a new vest)
- size: the body clearly larger or smaller than the standing cell (head size is the best gauge); body type changed (thinner, flatter chest, bulkier)
- weapon: weapon missing, doubled, a different weapon, a placeholder block/grey square, held wrong (floating, hand not on it)
- anatomy: extra/missing hands, arms or legs; broken limbs; detached body parts
- pose: the cell does not read as its intended action (e.g. "hit flinch" looks like a calm standing pose)
- rendering: cut off at the cell edge, purple/magenta fringe, smeared or blurry pixels, see-through clothing, visible nipples
Do not nitpick tiny pixel differences. Be concrete about which cell and what.
Answer ONLY with JSON: {"rows":[{"name":"<label written at the top-left of the row, or '-'>","ok":true|false,"problems":[{"cell":<1-based index of the new cell>,"kind":"identity|size|weapon|anatomy|pose|rendering","what":"<short, concrete>"}]}]}`

function apiKey() {
  // 키 찾는 차례: 환경 변수 HANBAL_CLAUDE_KEY(ANTHROPIC_API_KEY 는 쓰지 않는다 — 걸어 두면 Claude Code 가 구독 대신 그 키로 돈을 낸다) → ~/.keys/클로드키.txt → ~/Downloads/클로드키.txt (11-24 형이 Downloads 에서 치운 뒤 「따로 안전하게 저장 안 해 놨어?」 — 저장소 밖 ~/.keys 를 쓴다 · 키를 찍거나 옮기지 않는다)
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
const files = args.slice(1).filter(a => !a.startsWith('--'))
const brief = opt.brief ? fs.readFileSync(opt.brief, 'utf8') : BRIEF
const par = Number(opt.par || 4)
const client = new Anthropic({ apiKey: apiKey() })

async function one(file) {
  const data = fs.readFileSync(file).toString('base64')
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: brief,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data } },
      { type: 'text', text: `Board: ${path.basename(file)}. Review every row.` },
    ] }],
  })
  const u = res.usage || {}
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true })
  fs.appendFileSync(LEDGER, [new Date().toISOString(), res.model, 'review:' + path.basename(file), u.input_tokens ?? '', u.output_tokens ?? ''].join('\t') + '\n')
  if (res.stop_reason === 'refusal') return { file, refusal: res.stop_details?.category ?? 'unknown' }
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const m = text.match(/\{[\s\S]*\}/)
  try { return { file, ...JSON.parse(m ? m[0] : text) } } catch { return { file, raw: text.slice(0, 800) } }
}

const out = []
let next = 0
await Promise.all(Array.from({ length: Math.max(1, par) }, async () => {
  while (next < files.length) {
    const f = files[next++]
    try { out.push(await one(f)) } catch (e) {
      const status = e instanceof Anthropic.APIError ? e.status : ''
      out.push({ file: f, error: `${status} ${String(e.message || e).slice(0, 160)}` })
    }
  }
}))
fs.mkdirSync('tools/out/review', { recursive: true })
fs.writeFileSync(`tools/out/review/claude-${name}.json`, JSON.stringify(out, null, 1))
let bad = 0
for (const r of out) {
  if (r.error || r.refusal || r.raw) { console.log(`${path.basename(r.file)}: ${r.error ?? (r.refusal ? '거절 ' + r.refusal : '형식 어긋남')}`); continue }
  for (const row of r.rows ?? []) {
    if (row.ok) continue
    bad++
    console.log(`${row.name}: ` + row.problems.map(p => `칸${p.cell} ${p.kind} — ${p.what}`).join(' / '))
  }
}
console.log(`끝: 판 ${out.length} · 걸린 줄 ${bad} → tools/out/review/claude-${name}.json`)
