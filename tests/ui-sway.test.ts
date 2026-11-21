// 카드 자석 흔들림 · 판 밖으로 넘는 꾸밈 (A1 · 형 11-20: 「카드 끌 때 자석처럼 흔들림 · 이펙트가 판 경계를 넘나듦 · 소리와 딱 맞음」)
// 셈만 잰다 — 멈춘다 · 기울기는 끝을 넘지 않는다 · 움직임 줄이기면 아무것도 안 한다 · 멈추면 rAF 를 끈다 · 숨은 탭에선 안 돈다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UI_FLY as F, UI_SWAY as S } from '../src/tune/params.ts'
import { SWAY_REST, pointerVel, swayAim, swayBody, swayOn, swaySettled, swayStep, tether, tiltScale, type SwayEl, type SwayEnv, type SwayInput } from '../src/ui/fx/sway.ts'
import { flyPath, onScreen, sparkCount, sparkSpecs } from '../src/ui/fx/flyout.ts'

const FRAME = 1 / 60
const still: SwayInput = { dx: 0, dy: 0, pv: 0, hx: 0, hy: 0, half: 100, lift: S.hoverLift }

test('놓으면 용수철로 제자리에 돌아와 멈춘다 · 조금 넘쳤다 돌아온다', () => {
  const b = { ...swayBody(), x: 24, y: -18, r: 8, s: S.liftScale, vx: 300, vy: -200, vr: 40, vs: .5 }
  let t = 0
  let under = 0
  while (!swaySettled(b, SWAY_REST) && t < 3) {
    swayStep(b, SWAY_REST, FRAME, S.back, S.tiltBack)
    under = Math.min(under, b.x)
    t += FRAME
  }
  assert.ok(swaySettled(b, SWAY_REST), `3초 안에 멈춘다 (${t.toFixed(2)}초)`)
  assert.ok(t < 1.5, `1.5초 안에 멈춘다 (${t.toFixed(2)}초)`)
  assert.ok(Math.abs(b.x) < S.restPx && Math.abs(b.r) < S.restDeg && Math.abs(b.s - 1) < S.restScale)
  // 작게 넘친다 — 제자리를 지나 반대로 가지만 처음 거리의 절반은 넘지 않는다
  assert.ok(under < 0, '제자리를 한 번 지나친다 (넘침)')
  assert.ok(-under < 24 * .5, `넘침이 작다 (${(-under).toFixed(1)}px)`)
})

test('누르고 있는 동안 손을 따라붙어 멈춘다 (멈추면 그 꼴 그대로)', () => {
  const b = swayBody()
  const a = swayAim('drag', { ...still, dx: 60, dy: 20 })
  let t = 0
  while (!swaySettled(b, a) && t < 3) { swayStep(b, a, FRAME, S.follow, S.tilt); t += FRAME }
  assert.ok(t < 1, `따라붙기 ${t.toFixed(2)}초`)
  assert.ok(Math.abs(b.x - tether(60)) < S.restPx)
})

test('고무줄 — 멀리 끌어도 pull·reach 를 넘지 않고, 더 끌면 조금씩 더 온다', () => {
  let prev = 0
  for (const d of [1, 5, 20, 60, 120, 300, 1000, 10000]) {
    const v = tether(d)
    assert.ok(v > prev, `끈 만큼 더 온다 ${d}`)
    assert.ok(v < S.pull * S.reach, `한도 안 ${d} → ${v.toFixed(1)}`)
    assert.equal(tether(-d), -v)
    prev = v
  }
})

test('기울기는 어떤 손놀림에도 maxTilt 를 넘지 않는다', () => {
  const b = swayBody()
  let seed = 7
  const rnd = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  let x = 0
  let pv = 0
  let most = 0
  for (let i = 0; i < 4000; i++) {
    // 거칠게 흔든다 — 한 프레임에 수백 px 씩 오락가락 · 가끔 크게 튄다
    const jump = (rnd() - .5) * (i % 97 === 0 ? 3000 : 400)
    x += jump
    pv = pointerVel(pv, jump, FRAME)
    const a = swayAim('drag', { ...still, dx: x, dy: (rnd() - .5) * 200, pv })
    assert.ok(Math.abs(a.r) <= S.maxTilt + 1e-9, `가고 싶은 기울기도 한도 안 (${a.r})`)
    // 프레임 길이도 들쭉날쭉 (느린 폰) · 따라붙기/돌아오기 용수철을 번갈아
    swayStep(b, a, FRAME * (1 + rnd() * 3), i % 2 ? S.follow : S.back, i % 2 ? S.tilt : S.tiltBack)
    most = Math.max(most, Math.abs(b.r))
    assert.ok(Math.abs(b.r) <= S.maxTilt + 1e-9, `기울기 ${b.r.toFixed(2)} > ${S.maxTilt}`)
  }
  assert.ok(most > S.maxTilt * .9, `끝까지는 기운다 (${most.toFixed(2)})`)
  // 마우스 올림도 — 카드 밖 멀리 있어도 hoverTilt 까지
  const h = swayAim('hover', { ...still, hx: 1e6, hy: -1e6 })
  assert.ok(Math.abs(h.r) <= S.hoverTilt + 1e-9 && S.hoverTilt <= S.maxTilt)
})

test('넓은 카드는 덜 기운다 (끝이 흔들리는 거리를 비슷하게) · 좁은 카드는 그대로', () => {
  assert.equal(tiltScale(S.wideRef), 1)
  assert.equal(tiltScale(120), 1)
  assert.ok(tiltScale(S.wideRef * 2) < 1 && tiltScale(S.wideRef * 2) >= S.wideMin)
  assert.equal(tiltScale(1e5), S.wideMin)
  const narrow = swayAim('drag', { ...still, dx: 60, pv: 900 })
  const wide = swayAim('drag', { ...still, dx: 60, pv: 900, tiltK: tiltScale(S.wideRef * 2) })
  assert.ok(Math.abs(wide.r) < Math.abs(narrow.r) && wide.x === narrow.x)
})

test('오른쪽으로 끌면 시계 방향으로 기운다 · 왼쪽이면 반대', () => {
  assert.ok(swayAim('drag', { ...still, dx: 40, pv: 600 }).r > 0)
  assert.ok(swayAim('drag', { ...still, dx: -40, pv: -600 }).r < 0)
  assert.equal(swayAim('press', still).s, S.pressScale)
  assert.equal(swayAim('drag', still).s, S.liftScale)
})

// ───────── DOM 몰이 — 흉내 낸 칸과 프레임

function rig(over: Partial<SwayEnv> = {}) {
  const queue = new Map<number, (t: number) => void>()
  let id = 0
  let now = 1000
  let hidden = false
  let calm = false
  let asked = 0
  const env: SwayEnv = {
    raf: (cb) => { asked++; queue.set(++id, cb); return id },
    caf: (k) => { queue.delete(k) },
    hidden: () => hidden,
    calm: () => calm,
    low: () => false,
    ...over,
  }
  const classes = new Set<string>()
  const el: SwayEl & { isConnected: boolean } = {
    style: { translate: '', rotate: '', scale: '', transformOrigin: '' },
    classList: { add: (...t: string[]) => { for (const x of t) classes.add(x) }, remove: (...t: string[]) => { for (const x of t) classes.delete(x) } },
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 240, height: 300 }),
    isConnected: true,
  }
  /** 프레임을 n 번 돌린다 — 걸린 rAF 만 */
  const frames = (n: number): number => {
    let ran = 0
    for (let i = 0; i < n; i++) {
      if (queue.size === 0) break
      now += FRAME * 1000
      const cbs = [...queue.values()]
      queue.clear()
      for (const cb of cbs) { cb(now); ran++ }
    }
    return ran
  }
  return { env, el, classes, frames, pending: () => queue.size, asked: () => asked, hide: (v: boolean) => { hidden = v }, calm: (v: boolean) => { calm = v } }
}

test('누르고 끄는 동안만 rAF · 놓고 멈추면 끄고 꾸밈을 걷는다', () => {
  const r = rig()
  const s = swayOn(r.el, {}, r.env)
  assert.equal(r.pending(), 0, '가만히 있으면 rAF 없음')
  s.grab(220, 350)
  assert.equal(r.pending(), 1)
  for (let i = 1; i <= 20; i++) { s.move(220 + i * 8, 350 - i * 3); r.frames(1) }
  assert.equal(s.mode, 'drag')
  assert.ok(r.el.style.rotate !== '' && Number.parseFloat(r.el.style.rotate) > 0, `오른쪽으로 끄니 기운다 (${r.el.style.rotate})`)
  assert.ok(Math.abs(Number.parseFloat(r.el.style.rotate)) <= S.maxTilt)
  assert.ok(r.classes.has('swy-lift'), '끄는 동안 그림자')
  s.release()
  const ran = r.frames(600)
  assert.ok(ran > 5 && ran < 120, `돌아오는 동안만 (${ran} 프레임)`)
  assert.equal(r.pending(), 0, '멈추면 rAF 를 끈다')
  assert.equal(r.el.style.translate, '')
  assert.equal(r.el.style.rotate, '')
  assert.equal(r.el.style.scale, '')
  assert.equal(r.el.style.transformOrigin, '')
  assert.equal(r.classes.size, 0, '붙인 표도 걷는다')
  const before = r.asked()
  r.frames(100)
  assert.equal(r.asked(), before, '멈춘 뒤엔 rAF 를 다시 걸지 않는다')
})

test('손가락을 멈추고 누르고만 있으면 rAF 를 끈다 (꼴은 그대로)', () => {
  const r = rig()
  const s = swayOn(r.el, {}, r.env)
  s.grab(220, 350)
  for (let i = 1; i <= 10; i++) { s.move(220 + i * 10, 350); r.frames(1) }
  r.frames(600)
  assert.equal(r.pending(), 0, '가만히 쥐고 있으면 프레임이 서 있다')
  assert.equal(s.mode, 'drag')
  assert.ok(Math.abs(Number.parseFloat(r.el.style.translate) - tether(100)) < .5, `끈 쪽에 그대로 (${r.el.style.translate})`)
  assert.ok(Math.abs(Number.parseFloat(r.el.style.rotate) - tether(100) * S.tiltPerPull) < .1, `손이 멈추면 빠르기 몫은 풀린다 (${r.el.style.rotate})`)
  s.move(330, 350)
  assert.equal(r.pending(), 1, '다시 움직이면 깬다')
})

test('움직임 줄이기면 아무것도 하지 않는다 (rAF 도 꾸밈도 없음)', () => {
  const r = rig()
  r.calm(true)
  const s = swayOn(r.el, {}, r.env)
  s.hover(150, 260)
  s.grab(220, 350)
  for (let i = 1; i <= 10; i++) s.move(220 + i * 20, 350)
  s.release()
  assert.equal(r.asked(), 0)
  assert.equal(r.frames(100), 0)
  assert.equal(r.el.style.translate, '')
  assert.equal(r.el.style.transformOrigin, '')
  assert.equal(r.classes.size, 0)
})

test('숨은 탭에선 돌지 않는다 · 돌다가 가려지면 그 자리에서 멈추고 걷는다', () => {
  const r = rig()
  const s = swayOn(r.el, {}, r.env)
  r.hide(true)
  s.grab(220, 350)
  s.move(300, 350)
  assert.equal(r.asked(), 0, '가려진 탭에선 rAF 를 걸지 않는다')
  r.hide(false)
  s.grab(220, 350)
  for (let i = 1; i <= 6; i++) { s.move(220 + i * 15, 350); r.frames(1) }
  assert.ok(r.el.style.rotate !== '')
  r.hide(true)
  r.frames(1)
  assert.equal(r.pending(), 0, '가려지면 다음 rAF 를 걸지 않는다')
  assert.equal(r.el.style.rotate, '')
  assert.equal(r.classes.size, 0)
})

test('판에서 떨어져 나간 카드(고른 뒤 다시 그려짐)는 멈춘다', () => {
  const r = rig()
  const s = swayOn(r.el, {}, r.env)
  s.grab(220, 350)
  s.move(260, 340)
  r.frames(2)
  r.el.isConnected = false
  r.frames(1)
  assert.equal(r.pending(), 0)
})

test('마우스를 올리면 커서 쪽으로 끌리며 들린다 · 떠나면 돌아와 멈춘다', () => {
  const r = rig()
  const s = swayOn(r.el, {}, r.env)
  // 카드 가운데 (220, 350) 에서 오른쪽 위로 커서
  s.hover(320, 250)
  r.frames(600)
  assert.equal(r.pending(), 0, '커서가 멈추면 프레임도 멈춘다')
  const [tx, ty] = r.el.style.translate.split(' ').map((v) => Number.parseFloat(v))
  assert.ok(tx !== undefined && ty !== undefined && tx > 0 && ty < -S.hoverLift + 1e-6, `오른쪽 위로 (${r.el.style.translate})`)
  assert.ok(Number.parseFloat(r.el.style.rotate) > 0 && Number.parseFloat(r.el.style.rotate) <= S.hoverTilt + 1e-6)
  s.leave()
  r.frames(600)
  assert.equal(r.pending(), 0)
  assert.equal(r.el.style.translate, '')
})

// ───────── 판 밖으로 넘는 꾸밈 — 길 셈

test('날아가는 길 — 부풀어 솟았다가 닿을 칸 한가운데에서 끝난다 · 때는 0→1', () => {
  const from = { left: 300, top: 250, width: 52, height: 52 }
  const to = { left: 340, top: 100, width: 34, height: 34 }
  const keys = flyPath(from, to)
  assert.equal(keys.length, F.steps + 2)
  assert.equal(keys[0]!.offset, 0)
  assert.equal(keys[1]!.s, F.popScale)
  const last = keys[keys.length - 1]!
  assert.equal(last.offset, 1)
  assert.ok(Math.abs(last.x - (357 - 326)) < 1e-9 && Math.abs(last.y - (117 - 276)) < 1e-9, `닿을 칸 가운데 (${last.x}, ${last.y})`)
  assert.ok(Math.abs(last.s - 34 / 52) < 1e-9, '닿을 칸 크기로')
  assert.equal(last.r, 0)
  for (let i = 1; i < keys.length; i++) assert.ok(keys[i]!.offset > keys[i - 1]!.offset)
  // 끝에서 빨라진다 — 마지막 마디 사이 거리가 첫 마디 사이 거리보다 길다 (「쾅」 박힌다)
  const seg = (i: number): number => Math.hypot(keys[i]!.x - keys[i - 1]!.x, keys[i]!.y - keys[i - 1]!.y)
  assert.ok(seg(keys.length - 1) > seg(2))
})

test('불티는 판 밖까지 흩어지고 꾸밈은 다 해서 0.8초 안 · 저사양은 줄인다', () => {
  const sp = sparkSpecs(F.sparks)
  assert.equal(sp.length, F.sparks)
  for (const s of sp) {
    assert.ok(s.d >= F.sparkDist[0] && s.d <= F.sparkDist[1])
    assert.ok(s.size >= F.sparkSize[0] && s.size <= F.sparkSize[1])
    assert.ok(s.ms >= F.sparkMs[0] && s.ms <= F.sparkMs[1])
  }
  assert.ok(F.popMs + F.flyMs + Math.max(F.landMs, F.ringMs, F.pulseMs) <= 800, '닿고 걷히기까지 0.8초 안')
  assert.ok(F.sparkMs[1] <= 800 && F.ringMs <= 800)
  assert.ok(sparkCount(true, false) < sparkCount(false, true) && sparkCount(false, true) < sparkCount(false, false))
  assert.ok(sparkCount(true, false) >= F.minSparks)
  assert.equal(onScreen({ left: 0, top: 0, width: 0, height: 10 }, 100, 100), false, '숨은 칸(0 폭)엔 날지 않는다')
  assert.equal(onScreen({ left: 120, top: 0, width: 10, height: 10 }, 100, 100), false, '화면 밖')
  assert.equal(onScreen({ left: 10, top: 10, width: 10, height: 10 }, 100, 100), true)
  assert.equal(onScreen(null, 100, 100), false)
})
