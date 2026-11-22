// gamecap EACH — 열전 자동 몰기 (게임 코드는 그대로 · DEV 손잡이 __raid 로 판을 읽고 WASD 를 누른다 · 레벨업 카드는 첫 칸 · 일시정지는 「계속 싸우기」)
// 쓰기: EACH="$(cat tools/gamecap-raid-drive.js)" node --experimental-strip-types tools/gamecap.ts 나갈.mp4 8 1280 720 "http://localhost:5174/raid.html?review&background&stage=forest"
// 열전은 세로 화면이면 「가로로 돌리세요」로 멈춘다 → 가로로 찍고 쇼츠는 잘라 쓴다 · ?background 가 없으면 창 흐림(blur)에 멈춘다
const r = window.__raid && window.__raid(); if (!r) return
const up = document.querySelector('[data-up]'); if (r.offers && r.offers.length && up) { up.click(); return }
const cont = [...document.querySelectorAll('button')].find(b => b.textContent.includes('계속 싸우기') && b.offsetParent); if (cont) { cont.click(); return }
const boss = r.enemies.find(e => e.kind === 'boss')
let cx = 0, cy = 0, n = 0
for (const e of r.enemies) { const d = Math.hypot(e.x - r.x, e.y - r.y); if (d < 420) { cx += e.x; cy += e.y; n++ } }
const a = r.t * .5
let tx, ty
if (boss) { tx = boss.x + Math.cos(a) * 140; ty = boss.y + Math.sin(a) * 140 }
else if (n) { tx = cx / n + Math.cos(a) * 170; ty = cy / n + Math.sin(a) * 170 }
else { tx = r.x + Math.cos(a) * 200; ty = r.y + Math.sin(a) * 200 }
const dx = tx - r.x, dy = ty - r.y, want = new Set()
if (dx > 20) want.add('d'); if (dx < -20) want.add('a'); if (dy > 20) want.add('s'); if (dy < -20) want.add('w')
window.__held = window.__held || new Set()
for (const k of ['w', 'a', 's', 'd']) {
  if (want.has(k) && !window.__held.has(k)) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); window.__held.add(k) }
  if (!want.has(k) && window.__held.has(k)) { window.dispatchEvent(new KeyboardEvent('keyup', { key: k })); window.__held.delete(k) }
}
