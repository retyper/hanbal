/**
 * 굽기 꾸러미 — 형이 손으로 굽는다 (형 11-10: "챗지피티로 이미지 뽑을 거 니가 한번에 만들어 둬 줘 · 클로드 토큰 아까우니까 내가 구워서 저장할게").
 * 참고 그림 · 문안 · 저장할 이름을 한 장의 HTML(tools/out/bake-pack/index.html)에 모은다. 형은 파일로 열어
 * 그림을 끌어다 붙이고(또는 「그림 열기」) · 「문안 복사」 · 받은 것을 「저장 이름」대로 ~/Downloads 에 둔다.
 * 다 두면 Claude 가 `sh tools/bake-intake.sh` 한 번으로 모아 넣는다.
 *
 *   node tools/bake-pack.mjs
 *
 * 묶음: ① 챗지피티 진각성 aw2 (아직 안 넣은 사람) ② Veo 숨쉬기 (원장에서 낼 수 있는 일 · 높은 차례부터) ③ 제미나이 그림 (옥문 셋 등 · 아래 GEMINI)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const OUT = 'tools/out/bake-pack'
const LEDGER = 'C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code'
rmSync(OUT, { recursive: true, force: true })
for (const d of ['gpt', 'veo', 'gem']) mkdirSync(join(OUT, d), { recursive: true })

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const cards = { gpt: [], veo: [], gem: [] }
const add = (kind, n, title, imgs, prompt, save, note = '') => {
  const files = imgs.map((src, i) => { const f = `${kind}/${String(n).padStart(2, '0')}-${i}-${basename(src)}`; copyFileSync(src, join(OUT, f)); return f })
  cards[kind].push({ n, title, files, prompt, save, note })
}

// ① 챗지피티 진각성 aw2 — 진각성 그림이 아직 없는 사람만 (같은 id 가 두 번이면 처음 것)
const spec = JSON.parse(readFileSync('tools/sprite-kit/heroes/gpt-awaken.json', 'utf8'))
const seen = new Set()
let n = 0
for (const x of spec) {
  if (x.tier !== 2 || seen.has(x.id)) continue
  seen.add(x.id)
  if (existsSync(`public/realm/awaken2-hd/${x.id}.jpg`)) continue
  if (!existsSync(x.ref)) continue
  add('gpt', ++n, x.id, [x.ref], x.prompt, `gpt_aw2-${x.id}.png`)
}

// ② Veo — 원장에서 낼 수 있는 일 (queue.mjs peek 와 같은 거름 · 쿨다운은 보지 않는다 · 높은 차례부터)
const q = JSON.parse(readFileSync(`${LEDGER}/outputs/veo-production-queue.json`, 'utf8')).jobs
const st = JSON.parse(readFileSync(`${LEDGER}/outputs/veo-production-state.json`, 'utf8'))
const tried = new Set(st.attempts.map((a) => a.jobId))
const latest = {}
for (const a of st.attempts) latest[`${a.heroId}/${a.tier}`] = a
const veo = q.filter((j) => j.authorized === true && j.sourceRepairRequired !== true && !tried.has(j.id)
  && (latest[`${j.heroId}/${j.tier}`] ? j.replacesAttemptId === latest[`${j.heroId}/${j.tier}`].id : j.replacesAttemptId == null))
  .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id, 'en'))
n = 0
for (const j of veo) add('veo', ++n, `${j.heroId} · ${j.tier === '2' ? '진각성' : '1차'}`, [j.inputPath], readFileSync(j.promptPath, 'utf8').trim(), `veo_${j.id}.mp4`, `job ${j.id}`)

// ③ 제미나이 그림 — 사물은 제미나이 (메모리: 챗지피티는 사람에게만) · 「이미지 만들기」 · 16:9 · 한 대화에서 차례로
const GATE0 = 'A heavy ancient Korean prison gate seen straight from the front: two thick dark wooden doors with iron bands and big iron studs, a heavy wooden crossbar, set in a short rough stone frame, hand-painted semi-realistic game art matching a dark Korean historical strategy game, the gate fills the frame, on a flat pure magenta #FF00FF background, no text, no shadow on the background.'
const GEMINI = [
  ['옥문 1/3 · 멀쩡한 문 (새 대화 · 이미지 만들기 · 16:9)', GATE0, 'woo-gate-0.png'],
  ['옥문 2/3 · 같은 대화에 이어서', 'Same gate, same framing, same size and same magenta background, but badly cracked and splintered: deep cracks across both doors, a split crossbar, a few iron studs popped out, still standing.', 'woo-gate-1.png'],
  ['옥문 3/3 · 같은 대화에 이어서', 'Same gate, same framing, same size and same magenta background, now smashed open: both doors broken inward and hanging off, the crossbar snapped in two, flying splinters, the dark doorway visible behind.', 'woo-gate-2.png'],
]
n = 0
for (const [title, p, save] of GEMINI) add('gem', ++n, title, [], p, save, '받으면 「원본 크기 다운로드」 · 이름만 바꿔 Downloads 에')

const sec = (kind, head, how) => {
  const cs = cards[kind]
  if (cs.length === 0) return ''
  return `<section id="${kind}"><h2>${head} <small>${cs.length}</small></h2><p class="how">${how}</p>` + cs.map((c) => `
<article class="card" data-k="${kind}-${c.save}">
  <header><b>${c.n}</b><span>${esc(c.title)}</span><label><input type="checkbox" class="done"> 다 함</label></header>
  <div class="row">${c.files.map((f) => `<a href="${f}" target="_blank"><img src="${f}" alt="" draggable="true"></a>`).join('')}
  <div class="col"><textarea readonly>${esc(c.prompt)}</textarea>
  <div class="btns"><button data-copy="prompt">문안 복사</button><button data-copy="save" data-v="${esc(c.save)}">저장 이름 복사</button><code>${esc(c.save)}</code>${c.note ? `<small>${esc(c.note)}</small>` : ''}</div></div></div>
</article>`).join('') + '</section>'
}

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>굽기 꾸러미</title>
<style>
:root { color-scheme: dark; --bg: #15120e; --card: #221c15; --line: #4a3a28; --gold: #e8c15a; --ink: #efe6d2; --mute: #a39478; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.5 system-ui, "Malgun Gothic", sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 16px; }
h1 { color: var(--gold); margin: 8px 0; } h2 { color: var(--gold); border-bottom: 1px solid var(--line); padding-bottom: 4px; } h2 small { color: var(--mute); font-size: 14px; }
nav a { color: var(--gold); margin-right: 14px; } .how { color: var(--mute); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px; margin: 10px 0; }
.card.isdone { opacity: .35; }
.card header { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; } .card header b { color: var(--gold); min-width: 28px; } .card header span { flex: 1; font-weight: 700; }
.row { display: flex; gap: 10px; align-items: flex-start; } .row img { width: 150px; border-radius: 6px; border: 1px solid var(--line); }
.col { flex: 1; min-width: 0; } textarea { width: 100%; height: 110px; box-sizing: border-box; background: #120f0b; color: var(--ink); border: 1px solid var(--line); border-radius: 6px; font: 12px/1.4 ui-monospace, monospace; }
.btns { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 6px; } button { background: #8d6626; color: #fff4d6; border: 1px solid var(--gold); border-radius: 8px; padding: 6px 12px; font-weight: 700; cursor: pointer; }
button.ok { background: #2e6b33; } code { color: var(--gold); } small { color: var(--mute); }
@media (max-width: 640px) { .row { flex-direction: column; } .row img { width: 100%; } }
</style></head><body><main>
<h1>굽기 꾸러미</h1>
<p class="how">그림은 끌어다 챗지피티·제미나이 입력칸에 놓으면 붙습니다 (안 되면 그림을 눌러 연 뒤 저장해서 첨부). 받은 결과는 <b>저장 이름</b> 그대로 <code>Downloads</code> 에 두세요. 다 두면 Claude 에게 「꾸러미 넣어」 한마디면 됩니다 (<code>sh tools/bake-intake.sh</code>). 「다 함」 표시는 이 컴퓨터에만 남습니다.</p>
<nav><a href="#gem">제미나이 ${cards.gem.length}</a><a href="#gpt">챗지피티 진각성 ${cards.gpt.length}</a><a href="#veo">Veo ${cards.veo.length}</a></nav>
${sec('gem', '제미나이 그림', '「이미지 만들기」 · 16:9 · 옥문 셋은 한 대화에서 차례로 (같은 틀이어야 겹쳐 쓸 수 있습니다)')}
${sec('gpt', '챗지피티 진각성', '새 대화마다 한 사람 · 그림 하나 붙이고 문안 · 정사각 1:1 · 무료 계정 한도가 뜨면 그 시각을 알려 주세요')}
${sec('veo', 'Veo 숨쉬기 영상 (Jay u/4)', '「동영상 만들기」 · 세로 모드 · 사진 하나 + 문안 · 받으면 저장 이름대로 (거절되면 「다 함」 대신 비워 두고 알려 주세요)')}
</main><script>
const K = 'bakepack.done'
let done = {}; try { done = JSON.parse(localStorage.getItem(K) || '{}') } catch {}
for (const c of document.querySelectorAll('.card')) {
  const cb = c.querySelector('.done'); cb.checked = !!done[c.dataset.k]; c.classList.toggle('isdone', cb.checked)
  cb.addEventListener('change', () => { done[c.dataset.k] = cb.checked; c.classList.toggle('isdone', cb.checked); try { localStorage.setItem(K, JSON.stringify(done)) } catch {} })
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-copy]'); if (!b) return
  const t = b.dataset.copy === 'prompt' ? b.closest('.col').querySelector('textarea').value : b.dataset.v
  try { await navigator.clipboard.writeText(t) } catch { const ta = b.closest('.col').querySelector('textarea'); ta.select(); document.execCommand('copy') }
  b.classList.add('ok'); setTimeout(() => b.classList.remove('ok'), 900)
})
</script></body></html>`
writeFileSync(join(OUT, 'index.html'), html)
console.log(`꾸러미: 제미나이 ${cards.gem.length} · 챗지피티 ${cards.gpt.length} · Veo ${cards.veo.length} → ${OUT}/index.html`)
