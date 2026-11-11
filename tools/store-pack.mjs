/**
 * 스팀 캡슐 굽기 꾸러미 — 형이 손으로 굽는다 (tools/bake-pack.mjs 와 같은 틀 · 형 11-10 「토큰 아끼려 내가 구워서 저장」).
 * 스팀 그림 규격(STEAM-STORE.md §4)마다 카드 하나: 붙일 참고 그림 · 영어 문안 · 저장 이름 · 어떻게 잘리나.
 *
 *   node tools/store-pack.mjs        → tools/out/store-pack/index.html (파일로 열기)
 *
 * 굽고 나면 받은 그림(capsule_*.png)을 Downloads 에 두고 `node tools/store-capsule.mjs` — 확정 로고를 그 위에 얹어 규격 크기로 낸다.
 * 로고는 AI 가 그리지 않는다: 문안은 「로고 자리를 비워라」 라고만 하고, 로고 그림은 색·분위기 참고로만 붙인다 (AI 가 로고나 글자를 그렸으면 버린다).
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { ASSETS } from './store-layout.mjs'

const OUT = 'tools/out/store-pack'
rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'ref'), { recursive: true })
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const LOGO_KO = 'public/realm/logo/title.png'
const LOGO_EN = 'public/realm/logo/title-en.png'
const SOEBI = 'public/realm/awaken-hd/w-30-guya-soebi.jpg'
const ONJO = 'public/realm/awaken-hd/g-71-baekje-onjo.jpg'
const CAPTURE = 'public/realm/event/event-capture.jpg'

/** 모든 문안에 붙는 틀 — 메모리 규칙: 한국 중심 · 일장기식 해 원 금지 · 15세 · 닌자 금지 · 글자 없음 */
const STYLE = ' Style: premium Korean historical-fantasy strategy game key art, hand-painted semi-realistic illustration matching the attached references, bold clean linework with painterly shading, rich warm cinematic lighting. Setting: ancient Korea in the Samhan era (Mahan, Jinhan, Byeonhan, Gaya, Baekje, Goguryeo; 1st to 3rd century): hemp and silk jeogori-style jackets and robes, lamellar and scale armor, bronze and iron ornaments, jade comma-shaped ornaments (gogok). Strictly Korean-centered: no Chinese palace motifs, no Japanese motifs, no ninja or masked figures. Absolutely no sun disc: no red circle, no rising-sun rays or sunburst, no banner or flag with a red circle anywhere (banners are plain solid colors or abstract patterns). Teen (15+) rating: all clothing fully opaque, no sheer fabric over the chest, no visible nipple outline, no nudity. No text, no letters, no logo, no watermark, no UI, no frame or border.'
const LOGO_NOTE = ' IMAGE 3 is our game title logo, attached ONLY to show the mood and colors (dark bronze and gold). Do NOT draw it, do NOT draw any title or any other text: the logo will be placed there later by software, so that band must stay completely empty.'

const CARDS = [
  {
    key: 'header', title: '헤더 캡슐 920×430 · 장수 둘 + 로고 자리', save: 'capsule_header.png',
    refs: [SOEBI, ONJO, LOGO_KO],
    prompt: 'Generate one image: a wide landscape 3:2 key art for a game store header. IMAGE 1 is the woman (Soebi, a Gaya iron-forge captain with a chain hammer): keep her face, hair, jade ornaments, armor and colors exactly. IMAGE 2 is the man (Onjo, the founder-king of Baekje): keep his face, hair, armor and colors exactly. Composition: the two heroes stand close together side by side, facing the viewer at a slight angle, she on the left-center and he on the right-center, confident and proud, framed from the top of the head to about the chest; their faces and heads stay inside the top 60% of the image. Behind them an epic misty Korean mountain valley battlefield at dusk with sparks and drifting embers and faint silhouettes of plain-colored banners (no sun visible). The bottom 40% of the image fades smoothly into dark brown-black smoky ground with a few embers, empty of figures and details: a title logo will be placed on this band later, centered, about 60% of the image width.' + LOGO_NOTE + STYLE,
  },
  {
    key: 'main', title: '메인 캡슐 1232×706 · 생포 장면 + 로고 자리 (굽지 않아도 됨)', save: 'capsule_main.png',
    refs: [CAPTURE, LOGO_KO],
    note0: '굽지 않아도 됩니다 — 파일이 없으면 store-capsule.mjs 가 이 참고 그림(event-capture.jpg)으로 바로 만듭니다. 더 넓고 로고 자리를 비운 새 그림을 원하면 굽습니다.',
    prompt: 'Generate one image: a wide landscape 3:2 scene. IMAGE 1 is the reference scene: a captured, rope-bound enemy general kneeling in a muddy village yard at the left, and the victorious woman ruler in rich red, blue and gold Korean silk robes seated on a carved wooden throne at the right, with two armored guards holding spears behind, thatched-roof houses and a wooden palisade, stormy mountains in the background. Recreate the same scene with the same people and mood, but wider and with the figures framed a little smaller: all faces, hands and the rope-tied wrists stay inside the top 72% of the image. The bottom 28% is plain dark packed earth fading to deep shadow, empty of figures and details: a title logo will be placed there later, centered, about half of the image width.' + LOGO_NOTE.replace('IMAGE 3', 'IMAGE 2') + STYLE,
  },
  {
    key: 'vertical', title: '세로 캡슐 748×896 · 각성한 여장수 + 로고 자리', save: 'capsule_vertical.png',
    refs: [SOEBI, LOGO_KO],
    prompt: 'Generate one image: a tall portrait 2:3 key art for a game store vertical capsule. IMAGE 1 is the woman (Soebi, awakened form): keep her face, hair style, jade earrings and necklace, the layered dark armor with red and gold silk and the heavy iron chain-wrapped hammer on her shoulder exactly the same, same colors. Show her from the top of the head down to about the knees, standing in a bold confident pose with a faint smile looking at the viewer, glowing embers and sparks swirling around her, a dark burning-ember night behind her with faint misty Gaya iron-forge hills. Her head is near the top of the image with a little space above it; her body fades into dark smoke around 78% of the image height. The bottom 22% is dark smoky ground, empty of figures and details: a title logo will be placed there later, centered, about 80% of the image width. All clothing must be fully opaque with the chest area solid fabric and armor.' + LOGO_NOTE.replace('IMAGE 3', 'IMAGE 2') + STYLE,
  },
  {
    key: 'hero', title: '라이브러리 히어로 3840×1240 · 글자 없는 넓은 그림 (지도 위 두 군대)', save: 'capsule_hero.png',
    refs: [`public/realm/keyart/world.jpg`, 'public/realm/event/event-invade-field.jpg'],
    prompt: 'Generate one image: a wide landscape 3:2 panoramic scene, to be cropped to a very wide banner afterwards, so keep ALL the important action inside the central horizontal band (the middle 40% of the image height); the top and bottom thirds are only calm sky/map margins and ground. Subject: a painterly, parchment-and-ink war map of the southern Korean peninsula seen from a high angle, with mountains, rivers and coastline, and two armies facing each other across it, one marching in from the left and one from the right, hundreds of tiny soldiers with spears, shields and bows, plain solid-colored banners in blue and amber (no emblems), a few tiny cavalry, war drums and drifting smoke and dust, ink-wash mist; warm lamp-lit tones with deep brown and teal. The lower-left quarter of the center band is calm and uncluttered. No close-up characters, no large figures. IMAGE 1 is the world map key art and IMAGE 2 an invasion scene, for style only.' + STYLE,
  },
]

const files = new Map()
const refImg = (src) => {
  if (!existsSync(src)) return null
  if (!files.has(src)) { const f = `ref/${files.size}-${basename(src)}`; copyFileSync(src, join(OUT, f)); files.set(src, f) }
  return files.get(src)
}
const lay = Object.fromEntries(ASSETS.map((a) => [a.key, a]))

const card = (c, i) => {
  const a = lay[c.key]
  const imgs = c.refs.map((r, k) => { const f = refImg(r); return f === null ? '' : `<figure><a href="${f}" target="_blank"><img src="${f}" alt="" draggable="true"></a><figcaption>${k + 1}번${r === LOGO_KO ? ' · 로고(참고만)' : ''}</figcaption></figure>` }).join('')
  return `<article class="card" data-k="${c.save}">
  <header><b>${i + 1}</b><span>${esc(c.title)}</span><label><input type="checkbox" class="done"> 다 함</label></header>
  <div class="row">${imgs}
  <div class="col"><textarea readonly>${esc(c.prompt)}</textarea>
  <div class="btns"><button data-copy="prompt">문안 복사</button><button data-copy="save" data-v="${esc(c.save)}">저장 이름 복사</button><code>${esc(c.save)}</code><small>비율 ${esc(a.ratio)}</small></div>
  <p class="cut">잘리는 법 · ${esc(a.note)}</p>${c.note0 ? `<p class="opt">${esc(c.note0)}</p>` : ''}</div></div>
</article>`
}
const auto = ASSETS.filter((a) => a.bake === null).map((a) => `<article class="card auto"><header><b>·</b><span>${esc(a.key === 'small' ? '작은 캡슐 462×174' : '라이브러리 로고 1280×720 (투명)')} · 굽지 않음</span></header><p class="cut">${esc(a.note)}</p></article>`).join('')

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>스팀 캡슐 꾸러미</title>
<style>
:root { color-scheme: dark; --bg: #15120e; --card: #221c15; --line: #4a3a28; --gold: #e8c15a; --ink: #efe6d2; --mute: #a39478; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.5 system-ui, "Malgun Gothic", sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 16px; }
h1 { color: var(--gold); margin: 8px 0; } .how { color: var(--mute); } .how b, .how code { color: var(--gold); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px; margin: 10px 0; }
.card.isdone { opacity: .35; } .card.auto { opacity: .8; }
.card header { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; } .card header b { color: var(--gold); min-width: 28px; } .card header span { flex: 1; font-weight: 700; }
.row { display: flex; gap: 10px; align-items: flex-start; } figure { margin: 0; text-align: center; } .row img { width: 150px; border-radius: 6px; border: 1px solid var(--line); background: #0c0a07; } figcaption { color: var(--mute); font-size: 12px; }
.col { flex: 1; min-width: 0; } textarea { width: 100%; height: 150px; box-sizing: border-box; background: #120f0b; color: var(--ink); border: 1px solid var(--line); border-radius: 6px; font: 12px/1.4 ui-monospace, monospace; }
.btns { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 6px; } button { background: #8d6626; color: #fff4d6; border: 1px solid var(--gold); border-radius: 8px; padding: 6px 12px; font-weight: 700; cursor: pointer; }
button.ok { background: #2e6b33; } code { color: var(--gold); } small { color: var(--mute); } .cut { color: var(--mute); margin: 6px 0 0; } .opt { color: var(--gold); margin: 4px 0 0; }
@media (max-width: 640px) { .row { flex-direction: column; } .row img { width: 100%; } }
</style></head><body><main>
<h1>스팀 캡슐 꾸러미</h1>
<p class="how">챗지피티(사람이 나오는 그림)에서 <b>새 대화마다 한 장</b> · 참고 그림을 끌어다 붙이고 문안을 넣어 구우세요. 로고(번호 3번 · 2번)는 <b>분위기 참고로만</b> 붙입니다 — AI 가 로고나 글자를 그려 넣었으면 그 그림은 버리고 다시 구우세요. 받은 그림은 <b>저장 이름</b> 그대로 <code>Downloads</code> 에 두고(png), 끝나면 <code>node tools/store-capsule.mjs</code> 한 번 — 확정 로고를 얹어 규격 크기(한국어·영어)로 <code>tools/out/store-final/</code> 에 냅니다. 사람 그림은 15세 판(옷이 다 불투명한 것)만 씁니다. 「다 함」 표시는 이 컴퓨터에만 남습니다.</p>
${CARDS.map(card).join('\n')}
${auto}
</main><script>
const K = 'storepack.done'
let done = {}; try { done = JSON.parse(localStorage.getItem(K) || '{}') } catch {}
for (const c of document.querySelectorAll('.card[data-k]')) {
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
console.log(`스팀 캡슐 꾸러미: 굽는 것 ${CARDS.length}장 (굽지 않는 것 ${ASSETS.filter((a) => a.bake === null).length}) → ${OUT}/index.html`)
