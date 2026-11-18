/**
 * 맞은 초상 (ui/hit-portrait.ts) — 얼굴 자리 셈 · 피격 그림 열쇠 · 그림이 있을 때 금 끄기 (11-18 형).
 * 얼굴 자료(hit-focus.generated.ts)는 다른 손이 채우므로 셈은 자료와 따로(자리 값을 직접 넣어) 시험하고, 자료는 꼴만 본다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { P } from '../src/tune/params.ts'
import { HIT_FOCUS } from '../src/ui/hit-focus.generated.ts'
import {
  HIT_ART, HIT_ART_KEEP, drawHitPortrait, facePos, faceSlide, focusSlide, hitArtKey, hitArtPath, hitArtPos, hitArtReady, hitFaceKey, hitFocus, hitFocusSlide,
  hitKeyPath, hitPortraitHtml, warmHitArt, type HitFrame,
} from '../src/ui/hit-portrait.ts'

const FX = P.render.hitPortraitFaceX, FY = P.render.hitPortraitFaceY
const ID = 'w-95-michuhol-haebi'
/** object-position 글 → [가로, 세로] 몫 */
const pos = (s: string | null): [number, number] => { assert.notEqual(s, null); const m = s!.split(' ').map((x) => parseFloat(x) / 100); return [m[0]!, m[1]!] }
/** 자리 몫 p · 보이는 몫 v → 보이는 창 [앞, 뒤] (그림의 0~1) */
const win = (p: number, v: number): [number, number] => [p * (1 - v), p * (1 - v) + v]

test('한 축 밀기: 얼굴이 판의 바라는 자리에 오고 그림 끝을 넘지 않는다', () => {
  // 가운데 얼굴은 가운데 그대로
  assert.equal(focusSlide(0.5, 0.44, 0.5), 0.5)
  // 끝을 넘지 않는다 — 얼굴이 가장자리에 있으면 그림 끝이 판 끝에 붙는다 (바탕이 드러나지 않는다)
  assert.equal(focusSlide(0.02, 0.44, 0.5), 0)
  assert.equal(focusSlide(0.98, 0.44, 0.5), 1)
  assert.equal(focusSlide(-3, 0.44, 0.5), 0)
  assert.equal(focusSlide(9, 0.44, 0.5), 1)
  // 그 사이는 얼굴이 판의 at 자리에: 창 앞끝 + v·at = f
  for (const [f, v, at] of [[0.3, 0.44, 0.5], [0.7, 0.44, 0.5], [0.3, 0.6, 1 / 3], [0.35, 0.87, 1 / 3]] as const) {
    const p = focusSlide(f, v, at)!
    assert.ok(p > 0 && p < 1, `${f}/${v} 는 끝에 안 닿는다`)
    assert.ok(Math.abs(win(p, v)[0] + v * at - f) < 1e-9)
  }
  // 얼굴 가운데는 늘 보이는 창 안 (가로 · 얼굴을 가운데 둘 때)
  for (let v = 0.2; v < 1; v += 0.07) for (let f = 0; f <= 1.0001; f += 0.05) {
    const [a, b] = win(focusSlide(f, v, 0.5)!, v)
    assert.ok(a - 1e-9 <= f && f <= b + 1e-9, `v ${v.toFixed(2)} f ${f.toFixed(2)}`)
  }
})

test('안 잘리는 축은 밀지 않는다 (null) · 이상한 값도', () => {
  assert.equal(focusSlide(0.2, 1, 0.5), null)
  assert.equal(focusSlide(0.2, 1.3, 0.5), null)
  assert.equal(focusSlide(0.2, 0, 0.5), null)
  assert.equal(focusSlide(0.2, NaN, 0.5), null)
  assert.equal(focusSlide(NaN, 0.5, 0.5), null)
})

test('cover 자리: 좁고 긴 판(열전 가로 화면)은 가로만 민다', () => {
  // 판 0.44:1 · 정사각 그림 → 가로 44% 만 보인다
  const bw = 176, bh = 400, v = bw / bh
  const [x, y] = pos(facePos([0.85, 0.27], bw, bh))
  assert.equal(y, 0.5, '세로는 안 잘려 그대로')
  assert.equal(x, 1, '오른쪽 끝 얼굴 → 그림 오른쪽 끝이 판 끝에')
  assert.ok(win(x, v)[0] <= 0.85 && 0.85 <= win(x, v)[1])
  // 예전 고정 자리(48%)로는 이 얼굴이 판 밖이었다
  assert.ok(win(0.48, v)[1] < 0.85)
  assert.deepEqual(pos(facePos([0.2, 0.16], bw, bh)), [0, 0.5])
  if (FX === 0.5) assert.deepEqual(pos(facePos([0.5, 0.3], bw, bh)), [0.5, 0.5])
  // 가운데쯤 얼굴은 판의 FX 자리에
  const p = pos(facePos([0.4, 0.3], bw, bh))[0]
  assert.ok(Math.abs(win(p, v)[0] + v * FX - 0.4) < 0.001)
})

test('cover 자리: 넓은 판(폰 세로)은 세로만 밀어 얼굴을 위에서 1/3 쯤에', () => {
  const bw = 440, bh = 240, v = bh / bw
  const [x, y] = pos(facePos([0.8, 0.45], bw, bh))
  assert.equal(x, 0.5, '가로는 안 잘려 그대로')
  assert.ok(y > 0 && y < 1)
  assert.ok(Math.abs(win(y, v)[0] + v * FY - 0.45) < 0.001)
  // 위쪽 얼굴은 그림 위 끝에서 멈춘다
  assert.deepEqual(pos(facePos([0.5, 0.05], bw, bh)), [0.5, 0])
  assert.deepEqual(pos(facePos([0.5, 0.99], bw, bh)), [0.5, 1])
})

test('cover 자리: 그림 비율을 알면 그 비율로 · 안 잘리면 null', () => {
  // 정사각 판에 정사각 그림 (본편 합전 초상 · 겨루기 액자) → 안 잘린다
  assert.equal(facePos([0.9, 0.9], 200, 200), null)
  // 가로로 긴 그림(2:1)을 정사각 판에 → 가로가 반만 보인다
  assert.deepEqual(pos(facePos([0.5, 0.5], 200, 200, 2)), [0.5, 0.5])
  assert.deepEqual(pos(facePos([0.1, 0.5], 200, 200, 2)), [0, 0.5])
  // 판과 같은 비율 그림 → null
  assert.equal(facePos([0.1, 0.5], 400, 200, 2), null)
})

test('자료가 없거나 판을 못 쟀으면 null → 부르는 쪽 기본 자리 그대로', () => {
  assert.equal(facePos(null, 176, 400), null)
  assert.equal(faceSlide(null, 1, 1, 1.15, 1.15), null)
  for (const [w, h] of [[0, 400], [176, 0], [NaN, 400], [176, NaN], [-5, 10], [Infinity, 10]] as const) assert.equal(facePos([0.5, 0.5], w, h), null, `${w}×${h}`)
  assert.equal(facePos([0.5, 0.5], 176, 400, 0), null)
  assert.equal(hitFocus(null), null)
  assert.equal(hitFocus(undefined), null)
  assert.equal(hitFocus('bust/없는-초상'), null)
  assert.equal(hitFocus('constructor'), null)
  assert.equal(hitArtPos('bust/없는-초상', 176, 400), null)
  assert.equal(hitFocusSlide('bust/없는-초상', 1, 1, 1.15, 1.15), null)
})

test('잘려 그리는 자리(겨루기 머리 창): 두 축 다 남는 몫 안에서만', () => {
  // 그림이 창의 1.15배 → 두 축 다 잘린다
  const s = faceSlide([0.1, 0.9], 1, 1, 1.15, 1.15)!
  assert.deepEqual(s, [0, 1])
  const mid = faceSlide([0.5, 0.3], 1, 1, 1.15, 1.15)!
  assert.ok(mid[0]! >= 0 && mid[0]! <= 1 && mid[1]! >= 0 && mid[1]! <= 1)
  // 창과 같은 크기면 밀 것이 없다
  assert.equal(faceSlide([0.1, 0.9], 1, 1, 1, 1), null)
})

test('얼굴 자료 꼴: 열쇠는 결/초상 id · 값은 0~1 둘 · 어느 판에서든 얼굴 가운데가 보인다', () => {
  for (const [key, f] of Object.entries(HIT_FOCUS)) {
    assert.match(key, /^(bust|awaken|awaken2)\/[\w.-]+$/, key)
    assert.equal(f.length, 2, key)
    assert.ok(f[0] >= 0 && f[0] <= 1 && f[1] >= 0 && f[1] <= 1, `${key} ${f.join(',')}`)
    assert.deepEqual(hitFocus(key), f)
    // 열전 가로 화면(0.44) · 태블릿 · 폰 세로 판들
    for (const [bw, bh] of [[176, 400], [150, 366], [320, 720], [221, 210], [442, 240]] as const) {
      const s = hitArtPos(key, bw, bh)
      if (s === null) continue
      const [x, y] = pos(s), box = bw / bh
      if (box < 1) { const [a, b] = win(x, box); assert.ok(a - 0.001 <= f[0] && f[0] <= b + 0.001, `${key} 가로 ${bw}×${bh}`) }
      else assert.ok(y >= 0 && y <= 1, key)
    }
  }
})

test('피격 그림 열쇠: 지금 떠 있는 얼굴과 같은 결 (각성 장수는 awaken · 진각성 모습은 awaken2)', () => {
  assert.ok(HIT_ART.has(`bust/${ID}`) && HIT_ART.has(`awaken/${ID}`) && HIT_ART.has(`awaken2/${ID}`))
  assert.equal(hitFaceKey(ID), `bust/${ID}`)
  assert.equal(hitFaceKey(`../awaken-hd/${ID}`), `awaken/${ID}`)
  assert.equal(hitFaceKey(`../awaken2-hd/${ID}`), `awaken2/${ID}`)
  assert.equal(hitKeyPath(hitFaceKey(`../awaken-hd/${ID}`)), `hit/awaken/${ID}.webp`)
  // 옛 버그: 각성 얼굴 이름을 bust 열쇠로 찾으면 없다
  assert.equal(hitArtPath('bust', `../awaken-hd/${ID}`), null)
  assert.equal(hitFaceKey('../awaken-hd/없는-초상'), null)
  assert.equal(hitFaceKey('없는-초상'), null)
  assert.equal(hitFaceKey(undefined), null)
  assert.equal(hitFaceKey(null), null)
  assert.equal(hitArtKey('awaken2', ID), `awaken2/${ID}`)
  assert.equal(hitArtPath('awaken2', ID), `hit/awaken2/${ID}.webp`)
  assert.equal(hitKeyPath(null), null)
})

/** 브라우저의 Image 흉내 — 주소에 'fail' 이 있으면 못 받고 · 'slow' 가 있으면 finish() 를 부를 때까지 덜 실린 채 · 그 밖에는 src 를 넣자마자 실린다 */
class FakeImage {
  static made: FakeImage[] = []
  complete = false; naturalWidth = 0; naturalHeight = 0; url = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() { FakeImage.made.push(this) }
  finish(): void { this.complete = true; this.naturalWidth = 900; this.naturalHeight = 900; this.onload?.() }
  set src(u: string) {
    this.url = u
    if (u.includes('fail')) { this.complete = true; this.onerror?.() } else if (!u.includes('slow')) this.finish()
  }
}
/** Image 를 흉내로 바꿔 놓고 돌린다 — 그동안 만든 Image 들(= 받으러 간 횟수)을 넘겨준다 */
function withImage(run: (made: FakeImage[]) => void): void {
  const g = globalThis as { Image?: unknown }
  const had = Object.hasOwn(g, 'Image'), was = g.Image
  FakeImage.made = []
  g.Image = FakeImage
  try { run(FakeImage.made) } finally { if (had) g.Image = was; else delete g.Image }
}
const crackOf = (h: string): number => Number(/--hitp-crack:([\d.]+)/.exec(h)![1])
const CRACK_ON = P.render.hitPortraitCrackMax, CRACK_ART = P.render.hitPortraitCrackMax * P.render.hitPortraitCrackWithArt

test('겉막 조각: 그림이 없거나 덜 실렸으면 금까지 예전 그대로 · 실렸으면 금을 끈다 · 붉은 빛과 빛 빠짐은 그대로', () => {
  const none = hitPortraitHtml(1)
  assert.ok(none.includes('class="hitp"'), '검수 도구(tools/raid-fps-probe)가 이 글로 겉막을 찾는다')
  assert.ok(none.includes('hitp-crack') && !none.includes('<img'))
  assert.equal(crackOf(none), CRACK_ON)

  const url = '/realm/hit/bust/test-not-loaded.webp'
  assert.equal(hitArtReady(url), false)
  const cold = hitPortraitHtml(1, { art: url, pos: '48% 12%' })
  assert.ok(cold.includes('<svg class="hitp-crack"') && cold.includes(`src="${url}"`))
  assert.equal(crackOf(cold), CRACK_ON)
  assert.ok(!cold.includes('object-position'), '얼굴 자리를 안 주면 그림에 자리를 박지 않는다 (판 쪽 CSS 그대로)')
  assert.ok(cold.includes('--hitp-pos:48% 12%'))

  // 실린 그림
  withImage(() => {
    const ready = '/realm/hit/bust/test-loaded.webp'
    warmHitArt(ready)
    assert.equal(hitArtReady(ready), true)
    const warm = hitPortraitHtml(1, { art: ready, pin: '100% 50%' })
    assert.equal(crackOf(warm), CRACK_ART)
    assert.equal(warm.includes('<svg'), CRACK_ART > 0.001)
    assert.ok(warm.includes('style="object-position:100% 50%"'), '얼굴 자리는 그림에 바로 박는다')
    assert.ok(warm.includes('hitp-red') && warm.includes('hitp-gray'))
    assert.match(warm, /--hitp-red:0\.\d+/)
    assert.equal(/--hitp-red:([\d.]+)/.exec(warm)![1], /--hitp-red:([\d.]+)/.exec(none)![1])
    assert.equal(/--hitp-gray:([\d.]+)/.exec(warm)![1], /--hitp-gray:([\d.]+)/.exec(none)![1])
  })
})

test('미리 받은 피격 그림은 쥐고 있는다: 금은 쥔 그림이 다 실린 뒤에야 끄고 · 다시 불러도 또 받으러 가지 않는다', () => {
  // 11-18 검토: 받은 Image 를 놓아 버리면 맞을 때 끼우는 <img> 가 그림을 다시 받아 와, 금을 끈 채 그림이 늦거나(느린 망) 끝내 안 떴다(끊긴 망)
  withImage((made) => {
    const url = '/realm/hit/bust/test-slow-keep.webp'
    warmHitArt(url)
    assert.equal(made.length, 1)
    assert.equal(hitArtReady(url), false, '받는 중 — 아직 금을 끄지 않는다')
    assert.equal(crackOf(hitPortraitHtml(1, { art: url })), CRACK_ON)
    made[0]!.finish()
    assert.equal(hitArtReady(url), true, '쥐고 있는 Image 가 다 실렸다')
    assert.equal(crackOf(hitPortraitHtml(1, { art: url })), CRACK_ART)
    for (let i = 0; i < 5; i++) warmHitArt(url)
    assert.equal(made.length, 1, '쥐고 있는 그림은 또 받지 않는다')
    assert.equal(hitArtReady(url), true)
  })
})

test('쥐는 그림은 최근 HIT_ART_KEEP 장: 방금 쓴 것은 남고 · 오래 안 쓴 것부터 놓고 · 놓은 그림은 부르면 다시 쥔다', () => {
  assert.ok(HIT_ART_KEEP >= 4, '열전(기본·각성 둘) · 본편 합전(양쪽 둘)이 한꺼번에 들어갈 만큼')
  withImage((made) => {
    const u = (i: number): string => `/realm/hit/bust/test-keep-${i}.webp`
    for (let i = 0; i < HIT_ART_KEEP; i++) warmHitArt(u(i))
    for (let i = 0; i < HIT_ART_KEEP; i++) assert.equal(hitArtReady(u(i)), true, `${i} 번째`)
    // 0 번을 방금 썼다 → 한 장 더 들어오면 가장 오래 안 쓴 1 번이 나간다
    warmHitArt(u(0))
    warmHitArt(u(HIT_ART_KEEP))
    assert.equal(hitArtReady(u(0)), true, '방금 쓴 그림은 남는다')
    assert.equal(hitArtReady(u(1)), false, '가장 오래 안 쓴 그림을 놓는다')
    assert.equal(hitArtReady(u(HIT_ART_KEEP)), true)
    assert.equal(crackOf(hitPortraitHtml(1, { art: u(1) })), CRACK_ON, '놓은 그림은 금까지 예전 그대로')
    // 놓은 그림을 다시 부르면 다시 받아 쥔다
    const n = made.length
    warmHitArt(u(1))
    assert.equal(made.length, n + 1)
    assert.equal(hitArtReady(u(1)), true)
    // 아무리 많이 지나가도 쥐는 것은 HIT_ART_KEEP 장뿐
    for (let i = 100; i < 140; i++) warmHitArt(u(i))
    let held = 0
    for (let i = 0; i < 140; i++) if (hitArtReady(u(i))) held++
    assert.equal(held, HIT_ART_KEEP)
  })
})

test('못 받은 피격 그림은 다시 부르지 않는다 · 금까지 예전 그대로', () => {
  withImage((made) => {
    const url = '/realm/hit/bust/test-fail.webp'
    warmHitArt(url)
    assert.equal(made.length, 1)
    assert.equal(hitArtReady(url), false)
    for (let i = 0; i < 3; i++) warmHitArt(url)
    assert.equal(made.length, 1, '없는 그림에 404 를 거듭 내지 않는다')
    assert.equal(crackOf(hitPortraitHtml(1, { art: url })), CRACK_ON)
  })
  // DOM 이 없으면(Image 없음) 아무것도 안 한다
  warmHitArt('/realm/hit/bust/test-no-dom.webp')
  assert.equal(hitArtReady('/realm/hit/bust/test-no-dom.webp'), false)
  warmHitArt(null); warmHitArt(undefined)
})

test('캔버스 겉막: 피격 그림을 실어 그린 자리에는 금을 안 긋는다 · 붉은 빛과 빛 빠짐은 그대로', () => {
  const calls: string[] = []
  const ctx = new Proxy({ globalAlpha: 1 } as Record<string, unknown>, {
    get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => { calls.push(k); void a }),
    set: (t, k: string, v) => { t[k] = v; return true },
  }) as unknown as CanvasRenderingContext2D
  const f: HitFrame = { dx: 0, dy: 0, red: 0.4, gray: 0.3, crack: 0.9, art: 1, seed: 0 }
  drawHitPortrait(ctx, f, 0, 0, 100, 100, 'rect', 6)
  const plain = { stroke: calls.filter((c) => c === 'stroke').length, fill: calls.filter((c) => c === 'fillRect').length }
  assert.ok(plain.stroke > 0 && plain.fill === 2)
  calls.length = 0
  drawHitPortrait(ctx, f, 0, 0, 100, 100, 'rect', 6, true)
  const withArt = { stroke: calls.filter((c) => c === 'stroke').length, fill: calls.filter((c) => c === 'fillRect').length }
  assert.equal(withArt.fill, 2, '붉은 빛 · 잿빛 막은 그대로')
  assert.equal(withArt.stroke > 0, P.render.hitPortraitCrackWithArt > 0.001)
})
