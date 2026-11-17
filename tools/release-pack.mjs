// release-pack.mjs — 출시 제작실 (형 11-15: 「제미나이 영상 만들거 웹페이지로 · 1차각성 위주 · 2차는 DLC」
//   + 「뱀서식 컨텐츠 캔버스·css 로 그린 것들 에셋 프롬프트 · 챗지피티로 만들어 올게」)
//   node tools/release-pack.mjs  →  tools/out/release-pack/index.html  (http://127.0.0.1:5174/tools/out/release-pack/)
//   영상 동작 줄: tools/veo/tier1-lines-20261115.json (장수 그림을 직접 보고 쓴 것) · 할 일 목록은 그때그때 missing-loops 와 같은 셈으로 다시 센다
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { AWAKEN_ART, AWAKEN_LOOP } from '../src/realm/data/awaken-art.ts'
import { GROUPS as RELEASE_GROUPS, RELEASE_JOBS } from './release-jobs.mjs'
import { REMAKE_GROUPS, REMAKE_JOBS } from './remake-jobs.mjs'

const L = process.env.VEO_LEDGER ?? 'C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code'
const DAY = '20261115'
const OUT = 'tools/out/release-pack'
const lines = JSON.parse(readFileSync('tools/veo/tier1-lines-20261115.json', 'utf8'))
const st = existsSync(`${L}/outputs/veo-production-state.json`) ? JSON.parse(readFileSync(`${L}/outputs/veo-production-state.json`, 'utf8')) : { attempts: [] }
const last = (id) => st.attempts.filter((a) => a.heroId === id && String(a.tier) === '1').pop()
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// ── 1차 각성 영상 ──
const BODY = {
  she: 'The motion runs through her whole body: her chest rises and falls with deep visible breaths, and each step or jolt gives her fitted top and the loose cloth a soft natural bounce that settles.',
  he: 'The motion runs through his whole body: his chest and shoulders rise and fall with deep visible breaths, and the cloth, hair and ornaments follow each movement a moment late and settle.',
}
const prompt = (l) => {
  const P = l.sex === 'she' ? 'She' : 'He', p = l.sex === 'she' ? 'her' : 'his'
  return [
    `Animate this fantasy game illustration into a 10-second vertical 9:16 video. ${P} is a fictional painted character, not a real person. Keep the same character, face, painted art style, outfit, colors and framing exactly as in the image.`,
    `${l.who} ${l.motion}`,
    BODY[l.sex === 'she' ? 'she' : 'he'],
    `${P} looks straight into the camera for most of the clip. The face stays alive: natural blinks, the eyes move a little, the expression softens and comes back. Same face, same painted style, ${p} hands keep the same grip.`,
    'Slow smooth motion in one continuous shot, the last second returns close to the first frame so it can loop. Silent: no dialogue, no speech, no singing, only soft ambient sound. No text, no logo.',
  ].join('\n\n')
}
const video = []
for (const id of [...AWAKEN_ART].sort()) {
  if (AWAKEN_LOOP.has(id)) continue
  const a = last(id), s = a?.status ?? 'todo'
  const l = lines[id]
  const got = existsSync(`public/realm/awaken-loop/${id}.mp4`)  // 형이 손으로 만들어 넣은 것도 받음으로 (등록은 판정 뒤)
  const kind = s === 'held' ? 'held' : s === 'downloaded' || got ? 'judge' : l?.motion ? 'todo' : 'noline'
  video.push({
    id, kind, sex: l?.sex ?? (id.startsWith('w-') || id.startsWith('l-') ? 'she' : 'he'), note: l?.note ?? '',
    ref: `/realm/awaken-hd/${id}.jpg`, prompt: l?.motion ? prompt(l) : '',
    save: `veo_${id}_aw1_manual-${DAY}.mp4`,
    preview: existsSync(`public/realm/awaken-loop/${id}.mp4`) ? `/realm/awaken-loop/${id}.mp4` : '',
    file: a?.filePath ?? '', reason: a?.reviewNote ?? '',
  })
}
// 여인 먼저 (veo-rules: 20~30대 여성 1차 우선)
video.sort((a, b) => (a.sex === 'she' ? 0 : 1) - (b.sex === 'she' ? 0 : 1) || a.id.localeCompare(b.id, 'en', { numeric: true }))

// ── 뱀서식(해비 열전) 에셋 · 챗지피티 ──
const STYLE = 'Match the attached reference exactly in material and color: hand-painted dark iron, aged bronze with a small square spiral motif, restrained red braided cord. Practical and understated, original early-Korean historical fantasy, not Chinese imperial, no dragons, no Japanese motifs, no red sun discs.'
const NOTXT = 'Absolutely no text, letters, numbers, faces, mockup screens or game scenes. Real transparent background, no checkerboard, no cast shadow outside the artwork.'
const raid = [
  { id: 'H21', title: '체력·기세·두목 게이지 조각', refs: ['/assets_src/realm/raid/haebi-pack-v1-H20.png', '/realm/raid/ui-health.png'],
    now: '체력바는 640px 그림 한 장을 통째로 늘림 · 기세(경험치)바는 CSS 그라디언트만 · 두목 체력바는 캔버스 네모 두 개', use: '바의 양 끝은 그대로, 가운데 홈만 반복 → 어떤 폭에서도 안 늘어남. 채움 색은 코드가 칠함',
    prompt: `Create one transparent PNG, 1536x1024, a UI GAUGE KIT for a game HUD. ${STYLE}\n\nPaint these separate pieces in rows, each complete, with clear empty space between them:\n1. HEALTH BAR: a left end cap (bronze, about 150x110 px), a right end cap, and a straight middle trough segment about 500x110 px. The trough is a dark empty recessed channel with an iron rim, perfectly uniform along its length so any slice can repeat seamlessly; no fill color inside.\n2. EXPERIENCE BAR: the same three pieces but slimmer, about one third of the health bar height, plainer caps.\n3. BOSS HEALTH BAR: wider, more imposing left and right end caps (bronze plates with the spiral motif and a short red cord tassel), and a uniform middle trough segment like piece 1.\n4. A small empty bronze-rimmed name plaque (about 360x70 px) that sits above the boss bar, plain dark center.\n\nFlat front view. ${NOTXT}` },
  { id: 'H22', title: '단추 판과 작은 아이콘', refs: ['/assets_src/realm/raid/haebi-pack-v1-H20.png', '/realm/raid/power-skill.png'],
    now: '회피·비기·다시 고르기·일시정지·전체화면 단추가 CSS 그라디언트와 글자(⛶ · II)', use: '판은 9분할로 늘리지 않고 붙이고, 아이콘은 단추 왼쪽에',
    prompt: `Create one transparent PNG, 1536x1024, a BUTTON AND ICON KIT for a game HUD. ${STYLE}\n\nTop row, two wide button plates (each about 600x200 px), empty center, small bronze corner pieces and plain straight edges suitable for nine-slice resizing:\n1. A normal button: dark green-black lacquered wood plate with an iron rim.\n2. A primary button: warm aged-bronze plate with a slightly brighter rim.\n\nBottom row, five separate square icons (about 220x220 px each), drawn as bronze and iron emblems with the same lighting:\n3. Evade: a quick side-step shown as three curved wind streaks behind a small boot print.\n4. Pause: two upright bronze bars.\n5. Full screen: four bronze corner brackets pointing outward.\n6. Re-roll choices: two curved arrows chasing each other in a circle, made of red braided cord.\n7. Close: a simple bronze X.\n\nEvery piece is complete and separate. ${NOTXT}` },
  { id: 'H23', title: '전장 바닥 표식', refs: ['/assets_src/realm/raid/haebi-pack-v1-H20.png', '/realm/raid/forest.webp'],
    now: '두목 내려찍기 경고(빨간 원+줄어드는 고리), 이동 목적지, 해비 발밑 고리, 선봉 「돌파 표적」 표시가 전부 캔버스 원과 글자', use: '위에서 내려다보는 숲 바닥에 깔림 · 코드가 크기만 바꿈',
    prompt: `Create one transparent PNG, 1536x1536, a set of GROUND MARKERS for a top-down 3/4 view battlefield on a mossy forest floor. Painted, semi-transparent glowing ground decals in the same hand-painted style as the attached frame. Separate pieces with clear empty space between them:\n1. Boss slam warning: a large flat circle seen from above, an orange-red glowing ring of cracked earth with a faint translucent red fill and a ring of small square-spiral runes. Perfect circle, about 600 px wide.\n2. A thin bright orange ring alone, same diameter, no fill (it shrinks in code to show the countdown).\n3. Move target: a small gold ring with four short ticks pointing inward, about 160 px.\n4. Hero ground ring: a soft gold ellipse ring three times wider than tall, about 420x140 px, with tiny bronze spiral accents at left and right.\n5. Breakthrough target: a bright gold ellipse ring like 4 but stronger, plus, separately, a downward-pointing bronze arrowhead marker with a red cord tassel (about 120x160 px) that floats above an enemy.\n\nNo characters, no scenery, no background. ${NOTXT}` },
  { id: 'H24', title: '알림 띠·조합 패', refs: ['/assets_src/realm/raid/haebi-pack-v1-H20.png'],
    now: '「해비의 출전 · 첫 조합을 향해」 같은 알림 띠와 조합 배지가 CSS 그라디언트', use: '알림 띠는 양 끝 고정 + 가운데 반복 · 글자는 코드가 얹음',
    prompt: `Create one transparent PNG, 1536x1024, a BANNER KIT for game announcements. ${STYLE}\n\n1. Announcement banner: a dark cloth band with iron edging, given as a left end piece (bronze clasp with the spiral motif and a short red cord), a right end piece, and a plain middle segment (about 500x120 px) whose cloth texture is uniform along its length so it can repeat seamlessly. Empty, no writing.\n2. A small badge plaque for an earned combo (about 260x90 px): bronze-rimmed dark plate, empty center, in three color variants side by side: bronze, silver-iron, and red-lacquer.\n3. A title ribbon for the result screen (about 900x160 px) in the same materials, empty center.\n\nFlat front view. ${NOTXT}` },
  { id: 'H25', title: '산적 대두목 전투 그림 (3×3 아홉 자세)', refs: ['/realm/anim-px/bandit-chief.png', '/realm/anim-px/gen-haebi.png'],
    now: '두목이 정예 산적(bandit-chief)과 같은 그림을 크게 키운 것', use: '두목만 따로 · 정예는 지금 그림 그대로 · 넣는 길은 bake-haebi-master 와 같은 3×3 굽기',
    prompt: `Use case: production game asset, not a presentation.\nCreate ONE NEW transparent PNG combat sprite sheet of the BANDIT WARLORD, the final boss of a mountain bandit army in an original early-Korean historical fantasy game. Input 1 is the existing bandit captain; the warlord must clearly outrank him: a huge broad-shouldered adult man, wild topknot with iron rings, scarred face, layered iron-plate and fur coat over a ragged dark tunic, red cord bindings, and a massive two-handed iron-studded war club. Input 2 is only a reference for the pixel-art rendering style and scale.\n\nArt direction: clean hand-crafted pixel art for a premium Korean 2D action RPG, readable outline, restrained colour clusters, no blur or painterly texture. Keep the same face, body, outfit and club construction in EVERY pose. Three-quarter view facing right.\n\nLayout: square canvas, strict evenly spaced 3-column by 3-row grid, nine full-body sprites at IDENTICAL SCALE on genuine transparency, each with at least 10 percent empty margin in its cell; nothing touches a cell edge. No cell outlines, no text.\n\nPose order left to right, top to bottom:\n1. Ready idle, club resting on his shoulder.\n2. Heavy stomping walk, left leg forward.\n3. Walk, right leg forward.\n4. Walk, mid-stride.\n5. Slam wind-up: club raised high overhead with both hands, whole club inside the cell.\n6. Slam impact: club smashed into the ground in front of him, arms extended, no effect trail.\n7. Recover, lifting the club back.\n8. Hit recoil, leaning back, still holding the club.\n9. Defeated, lying horizontally, head to the right, club beside him.\n\nNo scenery, no shadow plane, no watermark, no captions.` },
  { id: 'H26', group: 'raid', title: '산적 활잡이 전투 그림 (3×3 아홉 자세)', refs: ['/realm/anim-px/bow.png', '/assets_src/realm/raid/haebi-pack-v1-H25.png'],
    now: '산적 활잡이가 본편 궁수 병사(bow) 그림을 빌려 씀 · 산적처럼 안 보임', use: '해비 열전의 활 쏘는 산적 · 넣는 길은 대두목(H25)과 같은 3×3 굽기',
    prompt: `Use case: production game asset, not a presentation.\nCreate ONE NEW transparent PNG combat sprite sheet of a MOUNTAIN BANDIT ARCHER, a common enemy of the same bandit army as Input 2 (the bandit warlord) in an original early-Korean historical fantasy game. A lean adult man, ragged dark hemp tunic and leggings with red cord bindings, a fur scrap over one shoulder, a cloth headband, a short wooden recurve bow and a hide quiver of arrows at his hip. Input 1 is only the existing soldier archer for scale; the bandit must look poorer and wilder. Match Input 2 exactly in pixel-art rendering, outline, palette range and scale.\n\nArt direction: clean hand-crafted pixel art for a premium Korean 2D action RPG, readable outline, restrained colour clusters, no blur or painterly texture. Keep the same face, body, outfit and bow in EVERY pose. Three-quarter view facing right.\n\nLayout: square canvas, strict evenly spaced 3-column by 3-row grid, nine full-body sprites at IDENTICAL SCALE on genuine transparency, each with at least 10 percent empty margin in its cell; nothing touches a cell edge. No cell outlines, no text.\n\nPose order left to right, top to bottom:\n1. Ready idle, bow held low.\n2. Running, left leg forward.\n3. Running, right leg forward.\n4. Running, mid-stride.\n5. Nocking an arrow, bow raised.\n6. Full draw aiming right, the whole bow and arrow inside the cell.\n7. Release, bow arm still extended, string relaxed.\n8. Hit recoil, leaning back, still holding the bow.\n9. Defeated, lying horizontally, head to the right, bow beside him.\n\nNo scenery, no shadow plane, no watermark, no captions.` },
]

mkdirSync(OUT, { recursive: true })
const count = (k) => video.filter((v) => v.kind === k).length
const vcard = (v) => `<article class="card" data-kind="v-${v.kind}" data-id="${v.id}"><div class="ref"><a href="${v.ref}" target="_blank"><img loading="lazy" src="${v.ref}" alt=""></a><a href="${v.ref}" download="${v.id}.jpg">원화 받기</a></div><div class="body"><div class="head"><b>${v.id}</b><span class="tag ${v.sex}">${v.sex === 'she' ? '여' : '남'}</span>${v.note ? `<small>${esc(v.note)}</small>` : ''}<select aria-label="진행"><option value="todo">대기</option><option value="sent">보냄</option><option value="done">받음</option><option value="retry">다시</option></select></div>${
  v.kind === 'todo' ? `<textarea readonly>${esc(v.prompt)}</textarea><div class="btns"><button class="gold" data-copy>문안 복사</button><button data-name="${v.save}">저장 이름 복사</button><code>${v.save}</code></div>`
  : v.kind === 'judge' ? `${v.preview ? `<video src="${v.preview}" controls muted playsinline preload="metadata"></video>` : ''}<p class="note">받아 둔 영상 · 형 판정 대기 · 다시 만들지 않음${v.file ? `<br><code>${esc(v.file)}</code>` : ''}</p>`
  : v.kind === 'held' ? `<p class="note">보류 · 다시 내지 않음${v.reason ? ` · ${esc(String(v.reason).slice(0, 120))}` : ''}</p>`
  : '<p class="note">동작 줄이 아직 없음</p>'}</div></article>`
// 그림 일: group 마다 탭 하나 · 받은 것(넣은 원본 또는 다운로드·에셋창고에 저장 이름 파일)은 「받은 그림」 탭으로
const GROUPS = { raid: '해비 열전', ...REMAKE_GROUPS, ...RELEASE_GROUPS }
raid.push(...REMAKE_JOBS, ...RELEASE_JOBS)
const saveName = (r) => r.save ?? `haebi-pack-v1-${r.id}.png`
const HOME = process.env.USERPROFILE ?? 'C:/Users/my'
const SEEN = ['assets_src/realm/raid', 'assets_src/realm/steam', `${HOME}/Downloads`, 'D:/에셋창고', 'D:/에셋창고/Codex-production-next-20261117-candidates']   // 보류 후보도 받음 · Claude 가 채택하거나 v3 로 다시 줌
const received = (r) => { const n = saveName(r), raw = n.replace(/^haebi-pack-v1-(H\d+)\.png$/, 'haebi-pack-v1-$1.png'); return SEEN.some((d) => existsSync(`${d}/${raw}`) || existsSync(`${d}/${raw}.png`)) }
for (const r of raid) { r.group ??= 'raid'; r.kind = received(r) ? 'img-done' : r.group }
const icount = (k) => raid.filter((r) => r.kind === k).length
const rcard = (r) => `<article class="card" data-kind="${r.kind}" data-id="${r.id}"><div class="ref">${r.refs.map((u) => `<a href="${u}" target="_blank"><img loading="lazy" src="${u}" alt=""></a><a href="${u}" download>참고 받기</a>`).join('')}</div><div class="body"><div class="head"><b>${r.id}</b><span>${esc(r.title)}</span>${r.kind === 'img-done' ? '<small>받음 · 넣었거나 넣을 차례</small>' : ''}<select aria-label="진행"><option value="todo">대기</option><option value="sent">보냄</option><option value="done">받음</option><option value="retry">다시</option></select></div><p class="note"><b>지금</b> ${esc(r.now)}<br><b>쓰는 곳</b> ${esc(r.use)}</p><textarea readonly>${esc(r.prompt)}</textarea><div class="btns"><button class="gold" data-copy>문안 복사</button><button data-name="${saveName(r)}">저장 이름 복사</button><code>${saveName(r)}</code></div></div></article>`

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>출시 제작실</title><style>
:root{--bg:#10171a;--card:#18232a;--line:#2f3f47;--ink:#e8e2d0;--dim:#9aa7a8;--gold:#d8b46a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 system-ui,'Malgun Gothic',sans-serif}
main{max-width:1180px;margin:auto;padding:16px}h1{font-size:22px;margin:4px 0}
.how{background:#1d2a2f;border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:10px 0;color:var(--dim)}.how b{color:var(--ink)}
nav{position:sticky;top:0;z-index:2;background:var(--bg);display:flex;flex-wrap:wrap;gap:6px;padding:8px 0;border-bottom:1px solid var(--line)}
nav button,.btns button{background:#22313a;color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:7px 12px;font:inherit;cursor:pointer}
nav button.on{background:var(--gold);color:#1b1408;border-color:var(--gold);font-weight:700}
.btns .gold{background:#6b5226;border-color:var(--gold)}.btns button:active{transform:scale(.96)}
.card{display:grid;grid-template-columns:150px 1fr;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;margin:10px 0}
.card[hidden]{display:none}.card.done{opacity:.45}.card.sent{border-color:var(--gold)}
.ref{display:flex;flex-direction:column;gap:4px}.ref img{width:150px;border-radius:6px;display:block}.ref a{color:var(--gold);font-size:12px}
.head{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.head small{color:var(--dim)}.head select{margin-left:auto;background:#22313a;color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:4px}
.tag{font-size:11px;border-radius:9px;padding:0 7px;background:#344}.tag.she{background:#5b3550}
textarea{width:100%;min-height:150px;background:#0d1417;color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:8px;font:12px/1.5 ui-monospace,Consolas,monospace;margin:8px 0}
.btns{display:flex;flex-wrap:wrap;gap:6px;align-items:center}code{font-size:11px;color:var(--dim);word-break:break-all}.note{color:var(--dim)}
video{max-height:360px;max-width:100%;margin-top:8px}
#toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--gold);color:#1b1408;padding:8px 16px;border-radius:20px;font-weight:700}
@media(max-width:600px){.card{grid-template-columns:1fr}.ref img{width:120px}}
</style></head><body><main>
<h1>출시 제작실</h1>
<div class="how"><b>1차 각성 영상 (제미나이 Veo)</b> · 2차 각성은 DLC 로 미룸.<br>1) 새 대화 · 모델 <b>Argon</b> 직접 고름 · 2) 화면비 <b>세로 9:16</b> 고르고 표시까지 확인 · 3) 「원화 받기」 그림 한 장 첨부 + 문안 붙여넣기 · 4) 거절되면 같은 대화에 「왜 안 돼?」 한 번만, 또 막히면 「다시」로 두고 넘어감 · 5) 받은 영상은 저장 이름으로 <code>D:\\에셋창고</code> 에.<br>한 번에 한 계정 · 계정 사이 1~2분 쉬기. 한 사람당 한 편.</div>
<div class="how"><b>챗지피티 그림</b> · 한 장마다 <b>새 대화</b> · 참고 그림을 모두 첨부하고 문안 붙여넣기 · 저장 이름 그대로 <code>Downloads</code> 나 <code>D:\에셋창고</code> 에 두면 다음에 꾸러미를 다시 만들 때 「받은 그림」으로 옮겨 갑니다.<br>차례 추천: <b>스팀 캡슐 → 15세 판 → 고화질 초상 → 비기 전신(이야기 장 장수 먼저) → 장 표지 → 해비 열전</b>. 사람 그림은 15세 기준(비침 없음).</div>
<nav><button data-f="v-todo" class="on">영상 할 일 ${count('todo')}</button><button data-f="v-judge">받음 · 판정 대기 ${count('judge')}</button><button data-f="v-held">보류 ${count('held')}</button>${count('noline') ? `<button data-f="v-noline">문안 없음 ${count('noline')}</button>` : ''}${Object.entries(GROUPS).map(([k, t]) => `<button data-f="${k}">${t} ${icount(k)}</button>`).join("")}<button data-f="img-done">받은 그림 ${icount("img-done")}</button></nav>
${video.map(vcard).join('\n')}
${raid.map(rcard).join('\n')}
<div id="toast" hidden></div></main><script>
const KEY='release-pack-v1';let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
const put=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved))}catch{}}
const cards=[...document.querySelectorAll('.card')],toast=document.getElementById('toast');let tt
const say=t=>{toast.textContent=t;toast.hidden=false;clearTimeout(tt);tt=setTimeout(()=>toast.hidden=true,1400)}
const paint=c=>{const s=saved[c.dataset.id]||'todo';c.querySelector('select').value=s;c.classList.toggle('done',s==='done');c.classList.toggle('sent',s==='sent')}
let f='v-todo';const show=()=>cards.forEach(c=>c.hidden=c.dataset.kind!==f)
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{f=b.dataset.f;document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));show()})
cards.forEach(c=>{paint(c);c.querySelector('select').onchange=e=>{saved[c.dataset.id]=e.target.value;put();paint(c)}
const cp=c.querySelector('[data-copy]');if(cp)cp.onclick=()=>{navigator.clipboard.writeText(c.querySelector('textarea').value);if(!saved[c.dataset.id]||saved[c.dataset.id]==='todo'){saved[c.dataset.id]='sent';put();paint(c)}say('문안 복사 · 보냄으로 표시')}
const nm=c.querySelector('[data-name]');if(nm)nm.onclick=()=>{navigator.clipboard.writeText(nm.dataset.name);say('저장 이름 복사')}})
show()
</script></body></html>`
writeFileSync(`${OUT}/index.html`, html)
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ day: DAY, video: video.map(({ prompt, ...v }) => v), raid: raid.map(({ prompt, ...r }) => r) }, null, 1))
console.log(`영상 할 일 ${count('todo')} · 판정 대기 ${count('judge')} · 보류 ${count('held')} · 문안 없음 ${count('noline')} · 그림 할 일 ${raid.filter((r) => r.kind !== "img-done").length} · 받은 그림 ${icount("img-done")}`)

// ── 챗지피티(코덱스) 앱에 한마디로 맡기는 줄 (형 11-16: 「한마디만 한 다음에 계속 만들게」) ──
//   tools/out/gpt-queue/QUEUE.md + refs/ · 아직 안 받은 그림만 · 영상(Veo)은 넣지 않는다
const Q = 'tools/out/gpt-queue', ORDER = ['skilltest', 'remake', 'hit', 'raid', 'steam', 'r15', 'bust', 'cover', 'skill', 'skill1', 'dlc', 'skill2']
mkdirSync(`${Q}/refs`, { recursive: true })
const rank = (r) => ORDER.indexOf(r.group.startsWith('remake') ? 'remake' : r.group)
const todo = raid.filter((r) => r.kind !== 'img-done').sort((a, b) => rank(a) - rank(b))  // 마을·배경 다시는 한 순위 (remake-jobs 의 배열 차례 그대로)
const refFile = (u) => { const src = /^[A-Z]:\//.test(u) ? u : u.startsWith('/assets_src/') ? u.slice(1) : 'public' + u, name = u.replace(/^[A-Z]:\//, 'store/').replace(/^\//, '').replace(/\//g, '__'); if (existsSync(src)) writeFileSync(`${Q}/refs/${name}`, readFileSync(src)); return name }
const qmd = [`# 그림 만들기 줄 (${todo.length}장 · ${new Date().toISOString().slice(0, 10)})`, '',
  '규칙: 위에서부터 한 장씩. 장마다 참고 그림(refs/ 안)을 모두 보고 문안대로 이미지 생성. 결과는 **D:/에셋창고** 에 「저장 이름」 그대로 PNG 로 저장. 끝나면 묻지 말고 다음 장.',
  '투명 배경이라 한 것은 진짜 알파(체크무늬 그림 금지). 글자·워터마크 금지. 손가락·무기 개수가 틀리면 한 번만 다시. 한도에 막히면 거기서 멈추고 몇 장째인지 적어 둔다.',
  '이 줄의 파일·저장소 코드는 고치지 않는다. 그림만 만든다.', '',
  ...todo.flatMap((r, i) => [`## ${i + 1}. ${r.id} · ${r.title}`, `- 저장 이름: \`${saveName(r)}\``, `- 참고 그림: ${r.refs.map((u) => '`refs/' + refFile(u) + '`').join(' · ')}`, '', '```', r.prompt, '```', ''])].join('\n')
writeFileSync(`${Q}/QUEUE.md`, qmd)
console.log(`챗지피티 줄 ${todo.length}장 → ${Q}/QUEUE.md`)
