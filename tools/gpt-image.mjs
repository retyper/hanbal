// 챗지피티 그림 API 로 그림을 여러 장 **동시에** 받는다 (11-24 형 「이제 더 빨리 병렬적으로 · 챗지피티 api 100불 매달 무료니까 우리 일에도 쓸 수 있으면 써」).
// Codex 가 2분마다 한 장씩 그리던 줄을 기다리지 않는다. 문안·장면 규칙은 Codex 주문과 같다(NOW 파일의 블록을 본뜬다).
//
//   node tools/gpt-image.mjs <일감.json> [동시=4]
//   일감.json = [{ "out": "D:/에셋창고/STD/out-….png", "images": ["장면.png", "같이 넣을 그림.png", …], "prompt": "…", "size": "1536x1024" }, …]
//   이미 있는 out 은 건너뛴다(다시 받으려면 지운다 · 덮어쓰지 않는다).
//
// 키: 형이 만든 ~/Downloads/챗지피티키.txt 를 실행할 때만 읽는다. **키를 찍지 않고, 저장소·메모리·다른 파일에 옮기지 않는다.**
// 거절(moderation)은 다시 시키지 않고 말을 바꾸지도 않는다 — 기록만 하고 넘어간다.
// 쓴 돈: tools/out/api-ledger.tsv 에 한 줄씩(때 · 모델 · 파일 · 입력/출력 토큰). 끝에 이번 합계를 찍는다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MODEL = process.env.GPT_IMAGE_MODEL || 'chatgpt-image-latest'
const QUALITY = process.env.GPT_IMAGE_QUALITY || 'high'
const LEDGER = path.resolve('tools/out/api-ledger.tsv')

function key() {
  const p = path.join(os.homedir(), 'Downloads', '챗지피티키.txt')
  const k = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').trim()
  if (!k.startsWith('sk-')) throw new Error('키 파일 모양이 다르다(내용은 찍지 않음)')
  return k
}

async function one(job, k) {
  if (fs.existsSync(job.out)) return { out: job.out, skip: true }
  const fd = new FormData()
  fd.append('model', job.model || MODEL)
  fd.append('prompt', job.prompt)
  fd.append('size', job.size || '1536x1024')
  fd.append('quality', job.quality || QUALITY)
  fd.append('n', '1')
  for (const im of job.images) fd.append('image[]', new Blob([fs.readFileSync(im)], { type: 'image/png' }), path.basename(im))
  const t0 = Date.now()
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + k }, body: fd })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.data?.[0]?.b64_json) {
    const code = j.error?.code || j.error?.type || r.status
    return { out: job.out, error: String(code), message: (j.error?.message || '').slice(0, 200) }
  }
  fs.mkdirSync(path.dirname(job.out), { recursive: true })
  fs.writeFileSync(job.out, Buffer.from(j.data[0].b64_json, 'base64'))
  const u = j.usage || {}
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true })
  fs.appendFileSync(LEDGER, [new Date().toISOString(), job.model || MODEL, path.basename(job.out), u.input_tokens ?? '', u.output_tokens ?? '', Math.round((Date.now() - t0) / 1000)].join('\t') + '\n')
  return { out: job.out, ok: true, sec: Math.round((Date.now() - t0) / 1000), usage: u }
}

const [file, par = '4'] = process.argv.slice(2)
const jobs = JSON.parse(fs.readFileSync(file, 'utf8'))
const k = key()
const results = []
let next = 0
await Promise.all(Array.from({ length: Math.max(1, Number(par)) }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++]
    const r = await one(job, k).catch(e => ({ out: job.out, error: String(e.message || e).slice(0, 200) }))
    results.push(r)
    console.log(r.ok ? `받음 ${path.basename(r.out)} · ${r.sec}초 · 토큰 ${r.usage?.input_tokens ?? '?'}/${r.usage?.output_tokens ?? '?'}` : r.skip ? `건너뜀(이미 있음) ${path.basename(r.out)}` : `실패 ${path.basename(r.out)} · ${r.error} · ${r.message ?? ''}`)
  }
}))
const ok = results.filter(r => r.ok).length, bad = results.filter(r => r.error).length
console.log(`끝: 받음 ${ok} · 실패 ${bad} · 건너뜀 ${results.length - ok - bad}`)
