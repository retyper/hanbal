import type { Act, RoundLog } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import type { BattlePlayback } from './battle-playback.ts'

type Group = Act['g']
type Side = Act['s']
interface Unit {
  side: Side
  group: Group
  ranged: boolean
  falling: boolean
  x: number
  y: number
  hero?: string | undefined
  aide?: boolean
}
interface Strike<U extends Unit> {
  source: U
  target: U
  start: number
  impact: number
  flight: number
  windup: number
  hit: boolean
  fire: boolean
  capture?: boolean
}
type Beat = { ours: boolean; c: Act['c']; at: number }

export function captureAttempts(round: RoundLog): { side: Side; target: string | undefined; succeeded: boolean }[] {
  const targetOf = (side: Side): string | undefined => (side === 'a' ? round.oa : round.od)?.target
  const attempts = (round.acts ?? []).filter((act) => act.c === 'capture' && (act.res === 'ok' || act.res === 'fail'))
  if (attempts.length > 0) return attempts.map((act) => ({
    side: act.s, target: act.hero ?? targetOf(act.s), succeeded: act.res === 'ok',
  }))
  if ((round.ev !== 'capture-ok' && round.ev !== 'capture-fail') || round.by === undefined) return []
  const succeeded = round.ev === 'capture-ok'
  const target = succeeded && round.lostHero?.how === 'taken' ? round.lostHero.hero : targetOf(round.by)
  return [{ side: round.by, target, succeeded }]
}

/** Displayed soldiers are tokens, so pair tokens within the logged opposing group. */
export function planBattleStrikes<U extends Unit>(units: readonly U[], round: RoundLog, beats: readonly Beat[], clash: number, weAtk: boolean): Strike<U>[] {
  if (round.ev === 'retreat' || round.ev === 'retreat-fail') return []
  const R = P.realm
  const ours = weAtk ? 'a' : 'd'
  const captures = captureAttempts(round)
  const captureWindup = R.warStrikeWindupS + R.warStrikeWalkInS
  const captureInterval = captureWindup + .2 + R.warStrikeWalkBackS
  const captureStrikes = captures.flatMap(({ side, target: id, succeeded }, i): Strike<U>[] => {
    const source = units.find((u) => u.side === side && u.group === 'lead' && !u.aide)
    const rivals = units.filter((u) => u.side !== side && u.group === 'lead')
    const target = rivals.find((u) => id !== undefined && u.hero === id) ?? rivals.find((u) => !u.aide)
    if (source === undefined || target === undefined) return []
    const impact = Math.max(captureWindup, clash - (captures.length - 1 - i) * captureInterval)
    return [{ source, target, start: impact - captureWindup, impact, flight: 0, windup: captureWindup, hit: succeeded, fire: false, capture: true }]
  })
  // A successful capture ends the round before the ordinary unit clashes.
  if (captures.some((c) => c.succeeded)) return captureStrikes
  const groupIndex = new Map<string, number>()
  const meleeIndex = { a: 0, d: 0 }
  const intents = units.filter((u) => !u.falling && !u.aide).flatMap((source) => {
    const actions = round.acts?.filter((a) => a.s === source.side && a.g === source.group)
    const acts = actions?.filter((a) => a.tg !== undefined && a.c !== 'rocks' && a.c !== 'guard' && a.c !== 'capture' && a.res !== 'wasted' && a.res !== 'fail')
    const physical = acts?.filter((a) => a.tg !== 'lead' || source.group === 'lead') ?? []
    const key = source.side + source.group
    const i = groupIndex.get(key) ?? 0
    groupIndex.set(key, i + 1)
    const action = physical.length === 0 ? undefined : physical[i % physical.length]
    const duel = source.group === 'lead' && round.ev?.startsWith('duel') === true
    // Guarding cavalry and failed/wasted orders don't get an unrelated attack.
    if (action === undefined && !duel && ((actions?.length ?? 0) > 0 || (source.group === 'lead' && captures.length > 0))) return []
    const beat = beats.find((b) => b.ours === (source.side === ours) && b.c === action?.c)
    const flight = source.ranged ? R.warArrowFlightS : 0
    const windup = source.group === 'horse' ? R.warStrikeHorseWindupS : R.warStrikeWindupS + (flight === 0 ? R.warStrikeWalkInS : 0)
    const impact = source.ranged
      ? Math.max(flight + windup, Math.min(clash, (beat?.at ?? clash - flight) + flight + (i % 4) * .075))
      : clash + (meleeIndex[source.side]++ % 4) * R.warStrikeStaggerS + (source.side === ours ? 0 : R.warStrikeReplyS)
    return [{ source, action, duel, start: Math.max(0, impact - flight - windup), impact, flight, windup }]
  }).sort((a, b) => a.impact - b.impact)

  const fallen = new Set<U>()
  const claimedAt = new Map<U, number>()
  return captureStrikes.concat(intents.flatMap(({ source, action, duel, start, impact, flight, windup }) => {
    const targets = units.filter((u) => u.side !== source.side && !u.aide && !fallen.has(u))
    const group = duel ? 'lead' : action?.tg
    const preferred = targets.filter((u) => group === undefined
      ? u.group === (source.group === 'lead' ? 'lead' : 'front')
      : u.group === group)
    const pool = preferred.length > 0 || group !== undefined ? preferred : targets
    const hit = action?.res !== 'blocked' || (action.tl ?? 0) > 0
    const target = [...pool].sort((a, b) => {
      const near = (u: U): number => Math.abs(source.y - u.y) + Math.abs(source.x - u.x) * 0.35
      const recent = (u: U): number => impact - (claimedAt.get(u) ?? -Infinity) < R.warStrikeReplyS ? 1 : 0
      const loss = (u: U): number => hit && u.falling ? 0 : 1
      return loss(a) - loss(b) || recent(a) - recent(b) || near(a) - near(b)
    })[0]
    if (target === undefined) return []
    claimedAt.set(target, impact)
    if (hit && target.falling) fallen.add(target)
    return [{ source, target, start, impact, flight, windup, hit, fire: action?.c === 'fire' }]
  }))
}

interface Point { x: number; y: number }

/** The head follows the derivative of the same curve used for position. */
export function arrowPose(from: Point, to: Point, lift: number, t: number): Point & { angle: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return {
    x: from.x + dx * t,
    y: from.y + dy * t - 4 * lift * t * (1 - t),
    angle: Math.atan2(dy - 4 * lift * (1 - 2 * t), dx),
  }
}

interface Actor extends Unit {
  node: HTMLElement
  frame: HTMLElement
  skin: string
  direction: 1 | -1
  frames: 8 | 20
}

// Bow grip in the drawn cell, measured in normalized sprite coordinates.
const RELEASE: Readonly<Record<string, [number, number, number]>> = {
  bow: [14, .614, .34], crossbow: [14, .59, .22],
  'gen-g-bow': [14, .82, .35], 'gen-w-bow': [13, .87, .31],
  'gen-jumong': [14, 0.97, 0.34], 'gen-maenun': [14, .88, .34],
  'gen-ogan': [14, .87, .32], 'gen-haedal': [14, 0.91, 0.26],
  'gen-songbi': [14, 0.91, 0.24], 'gen-damul': [14, 0.98, 0.33],
  'gen-songyang': [14, 0.91, 0.28],
}
// Extended weapon position in the contact cell, in each strip's native coordinate system.
const CONTACT: Readonly<Record<string, [number, number, number]>> = {
  spear: [15, .99, .35], shield: [15, .99, .36], pike: [15, .99, .34],
  axe: [15, .89, .47], horse: [16, .98, .23], boat: [16, .88, .57],
  marine: [15, .99, .40], militia: [14, .98, .33],
  'gen-g-spear': [15, .99, .32], 'gen-g-sword': [16, .99, .33], 'gen-w-spear': [14, .98, .56],
  'gen-mount': [15, .98, .22], 'gen-ara': [14, 0.76, 0.94], 'gen-aryeong': [14, 0.94, 0.26],
  'gen-daeso': [14, 0.95, 0.34], 'gen-eureum': [14, .95, .13], 'gen-gamsil': [14, 0.94, 0.76],
  'gen-haebi': [14, 0.87, 0.53], 'gen-heo': [14, 0.94, 0.46], 'gen-hyeokgeose': [14, 0.83, 0.94],
  'gen-hyeopbo': [14, .93, .21], 'gen-malgalgi': [14, 0.88, 0.28], 'gen-mari': [14, .98, .47],
  'gen-oi': [14, .98, .48], 'gen-onjo': [14, 0.83, 0.93], 'gen-soebi': [14, 0.80, 0.95],
  'gen-soseono': [14, 0.92, 0.31], 'gen-sdallae': [14, 0.89, 0.29], 'gen-yucheongan': [14, 0.97, 0.64], 'gen-sincheongan': [14, 0.91, 0.71], 'gen-singwigan': [14, 0.91, 0.27], 'gen-mdallae': [14, 0.98, 0.30], 'gen-mulbeom': [14, 0.97, 0.36], 'gen-beomi': [14, 0.88, 0.43], 'gen-danbi': [14, 0.90, 0.30], 'gen-mulsae': [14, 0.87, 0.36], 'gen-darae': [14, 0.89, 0.29], 'gen-mir': [14, 0.98, 0.35], 'gen-wan': [14, 0.94, 0.30], 'gen-gom': [14, 0.94, 0.74], 'gen-sagong': [14, 0.79, 0.96], 'gen-halla': [14, 0.86, 0.46], 'gen-areum': [14, 0.86, 0.65], 'gen-dokmudeom': [14, 0.92, 0.29], 'gen-beom': [14, 0.98, 0.28], 'gen-baram': [14, 0.96, 0.24], 'gen-goeun': [14, 0.95, 0.66], 'gen-byeol': [14, 0.76, 0.96], 'gen-sinneoul': [14, 0.94, 0.33], 'gen-haesol': [14, 0.94, 0.34], 'gen-odi': [14, 0.91, 0.39], 'gen-irang': [14, 0.86, 0.30], 'gen-dalli': [14, 0.89, 0.32], 'gen-bakdal': [14, 0.94, 0.27], 'gen-noeul': [14, 0.88, 0.27], 'gen-maehwa': [14, 0.90, 0.31], 'gen-gaon': [14, 0.98, 0.41], 'gen-eomni': [14, 0.96, 0.42], 'gen-nuri': [14, 0.98, 0.34], 'gen-bira': [14, 0.88, 0.33], 'gen-gureum': [14, 0.98, 0.42],
  'gen-biryu': [14, 0.90, 0.35], 'gen-geumha': [14, 0.94, 0.61], 'gen-geota': [14, 0.86, 0.47], 'gen-soebo': [14, 0.87, 0.57],
  'gen-gaennae': [14, 249 / 264, 47 / 160],
  'gen-budeul': [14, 266 / 280, 51 / 160],
  'gen-sogeumbi': [14, 225 / 280, 103 / 160],
  'gen-sori': [14, 243 / 280, 42 / 160],
  'gen-beombal': [14, 248 / 280, 51 / 160],
  'gen-hwalmi': [14, 204 / 280, 50 / 160],
  'gen-dangung': [14, 200 / 280, 45 / 160],
  'gen-soenun': [14, 267 / 280, 54 / 160],
}

const HEAVY_SWINGS = new Set(['axe', 'gen-soebi', 'gen-haebi', 'gen-gamsil', 'gen-biryu', 'gen-geumha', 'gen-soebo'])
const BLADE_SWINGS = new Set(['gen-sogeumbi', 'gen-ara', 'gen-g-sword', 'gen-hyeokgeose', 'gen-eureum', 'gen-hyeopbo', 'gen-onjo', 'gen-mount', 'gen-geota'])
const swingArt = (skin: string): 'heavy' | 'sweep' | 'thrust' =>
  HEAVY_SWINGS.has(skin) ? 'heavy' : BLADE_SWINGS.has(skin) ? 'sweep' : 'thrust'

export function playBattleStrikes(field: HTMLElement, round: RoundLog, beats: readonly Beat[], clash: number, result: number, weAtk: boolean, art: string, playback: BattlePlayback, onContact: (kind: 'melee' | 'heavy' | 'arrow' | 'block') => void): () => void {
  const R = P.realm
  if (typeof field.animate !== 'function' || document.hidden || field.closest('.fast') !== null || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const actors: Actor[] = []
  const layer = document.createElement('div')
  layer.className = 'wstrike-layer'
  layer.setAttribute('aria-hidden', 'true')
  for (const [selector, side, direction] of [
    ['.wf2s.us', weAtk ? 'a' : 'd', 1],
    ['.wf2s.foe', weAtk ? 'd' : 'a', -1],
  ] as const) {
    for (const node of field.querySelectorAll<HTMLElement>(`${selector} :is(.tk.tku:not(.tkn), .tk.tkf, .wgen.gsp:not(.gdown))`)) {
      const frame = node.querySelector<HTMLElement>('.spf, .gspf')
      if (frame === null) continue
      const group = node.classList.contains('wgen') ? 'lead' : node.classList.contains('r1') ? 'bows' : node.classList.contains('r2') ? 'horse' : 'front'
      const skin = frame.style.backgroundImage.match(/\/([^/]+)\.png/)?.[1]?.replace(/-practice-hit$/, '') ?? ''
      const ranged = group === 'bows' || node.classList.contains('gbw')
      const rect = node.getBoundingClientRect()
      actors.push({ node, frame, group, skin, side, direction, ranged, hero: node.dataset['hero'], aide: node.classList.contains('gcap-aide'), falling: node.matches('.tkf, .gfall'), x: rect.x, y: rect.bottom, frames: node.matches('.v2, .gsp') ? 20 : 8 })
    }
  }
  if (actors.length === 0) return () => {}
  const strikes = planBattleStrikes(actors, round, beats, clash, weAtk)
  const images = new Set(['strike-burst.svg', 'strike-puncture.svg', 'strike-shards.svg'])
  for (const strike of strikes) {
    if (strike.capture) continue
    if (strike.flight === 0) images.add(`strike-${swingArt(strike.source.skin)}.svg`)
    if (HEAVY_SWINGS.has(strike.source.skin)) images.add('dust.png')
  }
  for (const file of images) new Image().src = `${art}fx/${file}`
  const finishAt = Math.max(result - R.warStrikeFallS, strikes[strikes.length - 1]?.impact ?? 0)
  field.classList.add('paired-strikes')
  field.append(layer)
  for (const actor of actors) actor.node.classList.add('strike-actor')
  const animations = new Set<Animation>()
  const reactions = new Map<Actor, Animation>()
  const lunges = new Map<Actor, Animation>()
  const actionPoses = new Map<Actor, Animation>()
  const returns = new Map<Actor, number>()
  const melee = new Map(strikes.filter((strike) => strike.flight === 0 && !strike.capture).map((strike) => [strike.source, strike]))
  for (const strike of strikes) {
    if (strike.flight === 0) returns.set(strike.source, Math.max(returns.get(strike.source) ?? 0, strike.impact + .2))
    if (strike.hit) returns.set(strike.target, Math.max(returns.get(strike.target) ?? 0, strike.impact + R.warStrikeHitS))
  }
  const down = new Set<Actor>()
  const play = (node: HTMLElement, keys: Keyframe[], ms: number, elapsed = 0): Animation => {
    const anim = node.animate(keys, { duration: ms })
    anim.playbackRate = playback.rate
    anim.currentTime = elapsed
    animations.add(anim)
    anim.onfinish = () => animations.delete(anim)
    return anim
  }
  const pose = (u: Actor, n: number): string => `${100 * n / (u.frames - 1)}%`
  const fall = (u: Actor): void => {
    hold(u)
    down.add(u)
    u.node.classList.add('strike-down')
    if (u.group === 'lead') return
    const anim = play(u.node, [
      { opacity: 1, scale: '1' }, { opacity: 1, scale: '1 .78', offset: .38 }, { opacity: 0, scale: '1 .62' },
    ], R.warStrikeFallS * 1000)
    anim.onfinish = () => { animations.delete(anim); u.node.classList.add('strike-gone') }
  }
  const land = (u: Actor, captured = false): void => {
    if (down.has(u)) return
    hold(u)
    cancel(actionPoses.get(u))
    cancel(reactions.get(u))
    const hit = pose(u, u.frames === 20 ? 18 : 6)
    const reaction = play(u.frame, [{ backgroundPositionX: hit }, { backgroundPositionX: hit }], R.warStrikeHitS * 1000)
    reactions.set(u, reaction)
    if (u.falling || captured) down.add(u)
    reaction.onfinish = () => {
      animations.delete(reaction)
      reactions.delete(u)
      if (u.falling || captured) fall(u)
    }
  }
  const draw = (u: Actor): [number, number, number] => u.frames === 8 ? [4, .85, .36] : RELEASE[u.skin] ?? [14, .87, .35]
  const contact = (u: Actor): [number, number, number] => u.frames === 20 ? CONTACT[u.skin] ?? [15, .92, .42] : [5, .9, .45]
  const frameScale = (u: Actor, rect: DOMRect): Point => ({
    x: Math.max(.01, rect.width / Math.max(1, u.frame.offsetWidth)),
    y: Math.max(.01, rect.height / Math.max(1, u.frame.offsetHeight)),
  })
  const offset = (u: Actor): Point => {
    const [x, y] = getComputedStyle(u.frame).translate.split(' ')
    return { x: parseFloat(x ?? '') || 0, y: parseFloat(y ?? '') || 0 }
  }
  const body = (u: Actor): Point => {
    const rect = u.node.getBoundingClientRect()
    const pos = { x: rect.x + rect.width / 2, y: rect.y + rect.height * .43 }
    const o = offset(u)
    if (o.x === 0 && o.y === 0) return pos
    const s = frameScale(u, u.frame.getBoundingClientRect())
    return { x: pos.x + o.x * s.x * u.direction, y: pos.y + o.y * s.y }
  }
  const reach = (source: Actor, target: Actor): Point => {
    const to = body(target)
    const ink = source.frame.getBoundingClientRect()
    const [, x, y] = contact(source)
    const scale = frameScale(source, ink)
    return {
      x: (to.x - ink.x - ink.width * (source.direction === 1 ? x : 1 - x)) * source.direction / scale.x,
      y: (to.y - ink.y - ink.height * y) / scale.y,
    }
  }
  const shift = ({ x, y }: Point): string => `${x}px ${y}px`
  const cancel = (anim: Animation | undefined): void => {
    if (anim === undefined) return
    anim.cancel()
    animations.delete(anim)
  }
  const hold = (u: Actor): Point => {
    const current = offset(u)
    cancel(lunges.get(u))
    lunges.delete(u)
    u.frame.style.translate = shift(current)
    return current
  }
  const actionPose = (u: Actor, keys: Keyframe[], ms: number, lateMs = 0): void => {
    cancel(actionPoses.get(u))
    const anim = play(u.frame, keys, ms, lateMs)
    actionPoses.set(u, anim)
    anim.onfinish = () => { animations.delete(anim); actionPoses.delete(u) }
  }
  const walk = (u: Actor, to: Point, ms: number, returning = false, lateMs = 0): void => {
    const from = hold(u)
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    if (distance < .5 || ms <= lateMs) return
    const motion = play(u.frame, [{ translate: shift(from) }, { translate: shift(to) }], ms, lateMs)
    motion.effect?.updateTiming({ fill: 'forwards' })
    lunges.set(u, motion)
    motion.onfinish = () => {
      u.frame.style.translate = shift(to)
      cancel(motion)
      lunges.delete(u)
    }
    const count = u.frames === 20 ? 8 : 2
    const first = u.frames === 20 ? 4 : 2
    // Each cycle covers a fixed stride. The movement and the frames share the same clock.
    const stride = u.node.matches('.k-horse, .gmt') ? R.warRideStride : R.warWalkStride
    const cyclePx = Math.max(1, u.frame.offsetHeight) * stride
    const steps = Math.min(96, Math.max(2, Math.round(distance / cyclePx * count)))
    actionPose(u, Array.from({ length: steps + 1 }, (_, i) => ({
      backgroundPositionX: pose(u, first + (returning ? count - 1 - i % count : i % count)), easing: 'steps(1)',
    })), ms, lateMs)
  }
  // Opponents that strike each other split the distance and meet between their lines.
  const meeting = new Map<Actor, Point>()
  for (const [source, strike] of melee) {
    if (melee.get(strike.target)?.target !== source) continue
    const gap = reach(source, strike.target)
    meeting.set(source, { x: gap.x * .5, y: gap.y * .5 })
  }
  const windup = ({ source, target, flight, windup, capture }: Strike<Actor>, lateMs: number): void => {
    if (reactions.has(source) || down.has(source)) return
    if (capture) {
      const from = offset(source)
      const near = body(source)
      const to = body(target)
      const rect = source.frame.getBoundingClientRect()
      const scale = frameScale(source, rect)
      const gap = (to.x - near.x) * source.direction
      walk(source, {
        x: from.x + Math.max(0, gap - rect.width * .3) / scale.x,
        y: from.y + (to.y - near.y) / scale.y,
      }, windup * 1000, false, lateMs)
      return
    }
    if (flight === 0) {
      const from = offset(source)
      const gap = reach(source, target)
      walk(source, meeting.get(source) ?? { x: from.x + gap.x, y: from.y + gap.y }, (windup - .13) * 1000, false, lateMs)
      return
    }
    const end = source.frames === 20 ? 17 : 5
    const ready = source.frames === 20 ? 12 : 4
    // Hide the disconnected arrow baked into the soldier release cell.
    const crop = source.skin === 'bow' ? 'inset(0 33% 0 0)' : source.skin === 'crossbow' ? 'inset(0 38% 0 0)' : undefined
    actionPose(source, [{ backgroundPositionX: pose(source, ready), offset: 0, easing: 'steps(1)' },
        { backgroundPositionX: pose(source, draw(source)[0]), offset: .24, easing: 'steps(1)' },
        { backgroundPositionX: pose(source, crop === undefined ? end : 15), clipPath: crop, offset: .62, easing: 'steps(1)' },
        { backgroundPositionX: pose(source, end), clipPath: 'inset(0)', offset: .86, easing: 'steps(1)' },
        { backgroundPositionX: pose(source, 0), offset: 1 }], windup / .62 * 1000, lateMs)
  }
  const point = (pos: Point, box: DOMRect): Point => ({
    x: (pos.x - box.left) * field.clientWidth / Math.max(1, box.width),
    y: (pos.y - box.top) * field.clientHeight / Math.max(1, box.height),
  })
  const strikeFx = (file: string, kind: string, pos: Point, angle: number, keys: Keyframe[], ms: number): void => {
    const img = document.createElement('img')
    img.className = `wstrike-fx ${kind}`
    img.src = `${art}fx/${file}`
    img.alt = ''
    img.style.left = `${pos.x}px`
    img.style.top = `${pos.y}px`
    img.style.rotate = `${angle}rad`
    layer.append(img)
    const effect = play(img, keys, ms)
    effect.onfinish = () => { animations.delete(effect); img.remove() }
  }
  const directionTo = (source: Actor, target: Actor): number => {
    const from = body(source)
    const to = body(target)
    // A long lunge may carry the sprite's bounds beyond the target. The weapon still faces forward.
    return Math.atan2(to.y - from.y, source.direction * Math.max(18, Math.abs(to.x - from.x)))
  }
  const impactFx = (strike: Strike<Actor>, pos: Point, angle: number): void => {
    const ranged = strike.flight > 0
    const heavy = HEAVY_SWINGS.has(strike.source.skin)
    const kind = strike.hit ? heavy ? 'heavy-hit' : ranged ? 'arrow-hit' : 'melee-hit' : 'blocked-hit'
    onContact(strike.hit ? heavy ? 'heavy' : ranged ? 'arrow' : 'melee' : 'block')
    strikeFx(ranged ? 'strike-puncture.svg' : 'strike-burst.svg', kind, pos, angle, [
      { opacity: 1, scale: '.56', easing: 'cubic-bezier(.15,.75,.25,1)' },
      { opacity: 1, scale: '1.12', offset: .23, easing: 'ease-out' },
      { opacity: 0, scale: '1.27' },
    ], heavy ? 220 : 170)
    if (!strike.hit) return
    strikeFx('strike-shards.svg', 'shards', pos, angle, [
      { opacity: .9, transform: 'translateX(0) scale(.32)', easing: 'ease-out' },
      { opacity: 1, transform: 'translateX(7px) scale(.94)', offset: .26, easing: 'ease-out' },
      { opacity: 0, transform: 'translateX(16px) scale(1.5)' },
    ], 300)
    if (heavy) strikeFx('dust.png', 'strike-dust', { x: pos.x, y: pos.y + 13 }, 0, [
      { opacity: .7, scale: '.6', easing: 'ease-out' }, { opacity: 0, scale: '1.55' },
    ], 350)
  }
  const flights: { strike: Strike<Actor>; arrow: HTMLImageElement; from: Point; last?: Point }[] = []
  const queue = strikes.flatMap((strike) => [
    { at: strike.start, act: 'windup' as const, strike },
    ...(strike.flight === 0 && !strike.capture ? [{ at: strike.impact - .13, act: 'swing' as const, strike }] : []),
    { at: strike.impact - strike.flight, act: strike.flight > 0 ? 'launch' as const : 'land' as const, strike },
  ]).sort((a, b) => a.at - b.at)
  const origin = playback.now()
  let handle = 0
  let next = 0
  const stop = (): void => {
    cancelAnimationFrame(handle)
    document.removeEventListener('visibilitychange', onVisibility)
    for (const anim of animations) anim.cancel()
    for (const actor of actors) {
      actor.node.classList.remove('strike-actor')
      actor.frame.style.removeProperty('translate')
    }
    for (const actor of down) actor.node.classList.remove('strike-down', 'strike-gone')
    field.classList.remove('paired-strikes')
    layer.remove()
  }
  const onVisibility = (): void => { if (document.hidden) stop() }
  const tick = (now: number): void => {
    if (document.hidden || !field.isConnected || !field.classList.contains('play') || field.closest('.fast') !== null) { stop(); return }
    const elapsed = (playback.now(now) - origin) / 1000
    let box: DOMRect | undefined
    while (next < queue.length && queue[next]!.at <= elapsed) {
      const { at, act, strike } = queue[next++]!
      const { source, target } = strike
      if (act === 'windup') windup(strike, (elapsed - at) * 1000)
      else if (act === 'swing') {
        if (!reactions.has(source) && !down.has(source)) {
          hold(source)
          const ready = source.frames === 20 ? 12 : 4
          actionPose(source, [
            { backgroundPositionX: pose(source, ready), offset: 0, easing: 'steps(1)' },
            { backgroundPositionX: pose(source, contact(source)[0]), offset: .13 / .33, easing: 'steps(1)' },
            { backgroundPositionX: pose(source, source.frames === 20 ? 17 : 5), offset: .73, easing: 'steps(1)' },
            { backgroundPositionX: pose(source, 0), offset: 1 },
          ], 330, (elapsed - at) * 1000)
        }
        const kind = swingArt(source.skin)
        const angle = directionTo(source, target)
        const pos = point(body(target), box ??= field.getBoundingClientRect())
        const mirror = `scaleY(${source.direction})`
        strikeFx(`strike-${kind}.svg`, `trail ${kind}`, pos, angle, [
          { opacity: 0, transform: `translateX(-29px) scale(.6) ${mirror}`, easing: 'ease-out' },
          { opacity: 1, transform: `translateX(-10px) scale(1) ${mirror}`, offset: .44, easing: 'ease-out' },
          { opacity: 0, transform: `translateX(4px) scale(1.13) ${mirror}` },
        ], 230)
      }
      else if (act === 'land') {
        if (!strike.capture) impactFx(strike, point(body(target), box ??= field.getBoundingClientRect()), directionTo(source, target))
        if (strike.hit) land(target, strike.capture)
      }
      else {
        const [, x, y] = draw(source)
        const rect = source.frame.getBoundingClientRect()
        const from = point({ x: rect.left + rect.width * (source.direction === 1 ? x : 1 - x), y: rect.top + rect.height * y }, box ??= field.getBoundingClientRect())
        const arrow = document.createElement('img')
        arrow.className = 'wstrike-arrow'
        arrow.src = `${art}fx/${strike.fire ? 'fire-arrow' : 'arrow'}.png`
        arrow.alt = ''
        layer.append(arrow)
        flights.push({ strike, arrow, from })
      }
    }
    for (const [actor, ready] of returns) {
      if (elapsed < ready || reactions.has(actor)) continue
      returns.delete(actor)
      if (!down.has(actor)) walk(actor, { x: 0, y: 0 }, R.warStrikeWalkBackS * 1000, true)
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]!
      const { impact, flight, target, hit } = f.strike
      const t = Math.max(0, Math.min(1, (elapsed - impact + flight) / flight))
      const to = point(body(target), box ??= field.getBoundingClientRect())
      const lift = Math.abs(to.x - f.from.x) * R.warArrowLift
      const p = arrowPose(f.from, to, lift, t)
      const angle = f.last !== undefined && (p.x !== f.last.x || p.y !== f.last.y)
        ? Math.atan2(p.y - f.last.y, p.x - f.last.x) : p.angle
      f.arrow.style.transform = `translate(${p.x}px, ${p.y}px) translate(-100%, -50%) rotate(${angle}rad)`
      f.last = p
      if (t === 1) {
        f.arrow.remove()
        flights.splice(i, 1)
        impactFx(f.strike, to, angle)
        if (hit) land(target)
      }
    }
    if (elapsed >= finishAt) {
      // Some losses (skills or retreat) have no physical strike to replay.
      for (const u of actors) if (u.falling && !down.has(u)) fall(u)
    }
    if (next < queue.length || flights.length > 0 || returns.size > 0 || elapsed < finishAt) handle = requestAnimationFrame(tick)
  }
  document.addEventListener('visibilitychange', onVisibility)
  handle = requestAnimationFrame(tick)
  return stop
}
