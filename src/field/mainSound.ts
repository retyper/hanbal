/**
 * 전장 소리 — 재생 쪽 (F3e). 계산은 mainSoundModel.ts 가 하고, 여기는 그 목록을 본편 소리 표로 바꿔 WebAudio 로 낸다.
 *
 * 판(sim 상태)은 읽기만 한다. 소리는 형이 고른다: 본편 PICK(src/ui/realm/sound.ts)에 이미 있는 자리만 파일을 붙이고,
 * 아직 안 고른 자리(걷는 발소리 · 달리는 발소리 · 말발굽 · 부딪힘 쾅 · 무너지는 함성)는 null 로 두어 조용하다 (없는 파일이 판을 막지 않는다).
 * 고르는 곳: public/realm/field-sounds.html · 후보 목록: docs/realm/battle-study/43-field-sounds.md
 *
 * 본편 sound.ts 의 playOnce 는 좌우(pan)를 못 줘서 재생은 여기에 작게 다시 썼다 (본편 파일은 고치지 않는다).
 * 끔·크기는 본편 설정을 그대로 따른다 (hanbal.realm.mute · hanbal.realm.volume.sfx). 탭이 가려지면 모든 소리가 멈춘다 (규칙 4).
 */
import { P } from '../tune/params.ts'
import { snd, soundVolume } from '../ui/realm/sound.ts'
import type { Slot } from '../ui/realm/sound.ts'
import type { FieldState } from './types.ts'
import type { Cam, Rect, Viewport } from './viewCamera.ts'
import { fitZoom } from './viewCamera.ts'
import { eventsFromDiff, flagEvent, loopTargets, newSoundState, planLoops, stepSound } from './mainSoundModel.ts'
import type { FieldSlot, FlagKind, LoopAction, LoopRun, LoopTarget, Play, SoundCam, SoundEngineEvent, SoundEvent, SoundFrame, SoundState } from './mainSoundModel.ts'

/**
 * 자리 → 본편 소리 표의 자리 (파일 이름은 PICK 에서 읽는다 — 여기서 손으로 박지 않는다).
 * null 은 형이 아직 안 고른 자리라 조용하다.
 */
export const PICKED: Readonly<Record<FieldSlot, Slot | null>> = {
  flag_charge: 'cmd_charge', flag_hold: 'cmd_hold', flag_open: 'cmd_open', flag_horse: 'cmd_horse', flag_move: 'ui_order',
  war_cry: 'war_cry', war_drums: 'war_drums', horse_start: 'horses', arrow_volley: 'arrow_volley', clash: 'battle_clash',
  gate: 'cmd_gate', end_win: 'horn_victory', end_lose: 'defeat',
  // 형이 고른 본편 소리 (11-25 저녁 고르기 판): 부딪힘 쾅 = 본편 필살 맞부딪힘 g3 · 무너지는 함성 = 본편 함성 h1
  impact: 'battle_crit', rout: 'war_cry',
  // 아래는 본편 표에 없는 새 파일이라 FIELD_FILE 에 있다
  // 장수: 내닫기 = 본편 결투 베기(cmd_duel) · 비기 = 본편 기술 깃발(cmd_art) — 본편 표에 이미 있는 자리만 쓴다
  hero_dash: 'cmd_duel', hero_art: 'cmd_art',
  arrow_hit: null, step_walk_few: null, step_walk_mid: null, step_walk_many: null, step_run_few: null, step_run_mid: null, step_run_many: null, hoof_walk: null, hoof_gallop: null,
}

/**
 * 고른 뒤 넣을 자리 — 형이 public/realm/field-sounds.html 에서 고르면 이 표에 한 줄씩 넣는다 (예: step_walk: 'sfx/field_step_walk_a.ogg').
 * 본편 소리 표(PICK)에 없는 새 파일이라 파일 길을 바로 적는다. 비어 있으면(지금) 그 자리는 조용하다. PICKED 보다 먼저 본다.
 * 이어지는 소리(step_walk · step_run · hoof_walk · hoof_gallop)는 돌아가며(loop) 계속 울리고 재생 빠르기가 박자 배율을 따른다.
 */
export const FIELD_FILE: Readonly<Partial<Record<FieldSlot, string>>> = {
  // 발소리: 형이 고른 한 명분 소리(걷기 13264254 · 달리기 13264251)를 tools/field-crowd-steps.mjs 가 4 · 12 · 30 명분으로 겹쳐 구운 고리
  step_walk_few: 'sfx/field_step_walk_few.ogg', step_walk_mid: 'sfx/field_step_walk_mid.ogg', step_walk_many: 'sfx/field_step_walk_many.ogg',
  step_run_few: 'sfx/field_step_run_few.ogg', step_run_mid: 'sfx/field_step_run_mid.ogg', step_run_many: 'sfx/field_step_run_many.ogg',
  // 말발굽: 걷기와 질주가 같은 파일(본편 말 소리 m 의 고리). 걷기는 느리고 작게(P.field.soundHoofWalkRatePct · GainPct)
  hoof_walk: 'sfx/field_hoof_loop.ogg', hoof_gallop: 'sfx/field_hoof_loop.ogg',
  // 꽂히는 화살: 형이 고른 「화살 맞는1」 (13254994)
  arrow_hit: 'sfx/field_arrow_hit_b.ogg',
}

/** 이 자리에서 낼 파일의 주소 (없으면 null = 조용) */
export function fileOf(slot: FieldSlot, base: string, files: Readonly<Partial<Record<FieldSlot, string>>> = FIELD_FILE): string | null {
  const own = files[slot]
  if (own !== undefined) return base + 'realm/' + own
  const p = PICKED[slot]
  if (p === null) return null
  const name = snd(p)
  return base + name.replace(/#t=[\d.]+$/, '')
}

/** 엔진 사건 줄에서 최근 몇 틱 몫 (소리 모델이 앞 프레임 이후 것만 고른다 · 그리기 사이에 틱이 몇 번 돌아도 놓치지 않게) */
const EVENT_KINDS: ReadonlySet<string> = new Set(['impact', 'rout', 'volley', 'gateBreak', 'loss', 'flankHit', 'artHit', 'heroDash', 'heroSkill', 'sideBreak', 'stand', 'regroup'])
function recentEvents(s: FieldState): SoundEngineEvent[] {
  const out: SoundEngineEvent[] = []
  const from = s.tick - P.field.maxCatchUpTicks * 2
  for (let i = s.log.events.length - 1; i >= 0 && s.log.events[i]!.tick >= from; i--) {
    const e = s.log.events[i]!
    if (EVENT_KINDS.has(e.kind)) out.push({ tick: e.tick, kind: e.kind, side: e.side, id: e.id, u: e.u, v: e.v, n: e.n, to: e.to ?? -1, how: e.how ?? 0 })
  }
  return out.reverse()
}

/** 판 읽기 (FieldState → 소리 모델이 읽는 모양) — 읽기만 한다. edge 는 readField(state).edge */
export function soundFrameOf(s: FieldState, edge: readonly [number, number], morale?: readonly [number, number]): SoundFrame {
  const h = s.heroes.find(e => e.side === 0), foe = s.heroes.find(e => e.side === 1)
  return {
    tick: s.tick,
    squads: s.squads.map(q => ({ id: q.id, side: q.side, grp: q.grp, men: q.men, u: q.u, v: q.v, stance: q.stance, lock: q.lock, target: q.target, ran: q.ran, flee: q.flee, aim: q.aim, order: q.order })),
    pieces: s.map.pieces.map(p => ({ id: p.id, kind: p.kind, hp: p.hp })),
    edge, end: s.end, winner: s.winner,
    events: recentEvents(s),
    hero: h === undefined ? undefined : { grit: h.grit, gritN: h.gritN, stun: h.stun, foeStun: foe?.stun ?? 0 },
    morale,
  }
}

/** 화면 카메라 → 소리 카메라 */
export function soundCamOf(cam: Cam, vp: Viewport, bounds: Readonly<Rect>): SoundCam {
  return { x: cam.x, y: cam.y, zoom: cam.zoom, vpW: vp.w, vpH: vp.h, zoomRel: cam.zoom / fitZoom(vp, bounds) }
}

const MUTE_KEY = 'hanbal.realm.mute'
function muted(): boolean {
  try { if (new URLSearchParams(location.search).has('silent')) return true } catch { /* 주소를 못 읽는 곳 */ }
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

export interface FieldSound {
  /** 첫 손짓(누름·키)에서 부른다 — 이 뒤에만 소리가 난다 */
  unlock(): void
  /** 매 그리기 프레임에 한 번 — events 를 안 주면 앞뒤 프레임 차이에서 뽑는다 (F2c 사건 줄이 오면 그것을 넘긴다) */
  frame(frame: SoundFrame, cam: SoundCam, events: readonly SoundEvent[] | null, nowMs: number): void
  /** 깃발을 꽂은 순간 (돌격 · 방진 · 길 트기 · 기병 · 이동) */
  order(kind: FlagKind): void
  /** 판이 끝난 순간 (frame 의 차이에서도 나지만 같은 소리는 한 번만 난다) */
  end(win: boolean): void
  /** 새 판 · 나갈 때 — 기억을 지운다 */
  stop(): void
}

export function createFieldSound(base: string = import.meta.env?.BASE_URL ?? '/'): FieldSound {
  let st: SoundState = newSoundState()
  let unlocked = false
  let ctx: AudioContext | null = null
  let live = 0
  let pending: SoundEvent[] = []
  const buffers = new Map<string, Promise<AudioBuffer | null>>()

  function audio(): AudioContext | null {
    if (ctx !== null) return ctx
    type Ctor = new () => AudioContext
    const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
    const C = g.AudioContext ?? g.webkitAudioContext
    try { ctx = C !== undefined ? new C() : null } catch { ctx = null }
    return ctx
  }
  function bufferOf(c: AudioContext, url: string): Promise<AudioBuffer | null> {
    let p = buffers.get(url)
    if (p === undefined) {
      p = fetch(url).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))).then(b => c.decodeAudioData(b)).catch(() => null)
      buffers.set(url, p)
    }
    return p
  }

  function play(c: AudioContext, p: Play): void {
    if (p.loop) return // 이어지는 소리는 아래 syncLoops 가 돌린다
    const own = FIELD_FILE[p.slot]
    const slot = PICKED[p.slot]
    if (own === undefined && slot === null) return // 형이 아직 안 고른 자리 — 조용하다
    const sfx = soundVolume('sfx')
    if (sfx <= 0 || live >= P.field.soundVoicesMax) return
    const name = own !== undefined ? 'realm/' + own : snd(slot as Slot)
    const m = /#t=([\d.]+)$/.exec(name)
    const from = m !== null ? Number(m[1]) : 0
    const url = base + (m !== null ? name.slice(0, m.index) : name)
    live++
    void bufferOf(c, url).then(buf => {
      if (buf === null || document.hidden) { live--; return }
      const src = c.createBufferSource(), gain = c.createGain()
      src.buffer = buf
      src.playbackRate.value = p.rate
      gain.gain.value = Math.min(1, p.vol * sfx)
      let tail: AudioNode = gain
      if (typeof c.createStereoPanner === 'function') {
        const pan = c.createStereoPanner()
        pan.pan.value = p.pan
        gain.connect(pan)
        tail = pan
      }
      src.connect(gain)
      tail.connect(c.destination)
      src.onended = () => { live--; src.disconnect(); gain.disconnect(); if (tail !== gain) tail.disconnect() }
      try { src.start(0, Math.min(from, Math.max(0, buf.duration - 0.05))) } catch { live--; src.disconnect() }
    })
  }

  /** 돌아가는 이어지는 소리 — 자리마다 하나 · 고리는 끊지 않고 크기·좌우·재생 빠르기만 바꾼다 (계획은 mainSoundModel.planLoops) */
  interface Running { src: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode | null }
  const running = new Map<FieldSlot, Running>()
  /** 아직 파일을 받는 중인 자리와 그 자리의 가장 최근 할 일 */
  const want = new Map<FieldSlot, LoopAction>()
  let plan: Record<string, LoopRun> = {}
  function ramp(c: AudioContext, r: Running, a: LoopAction): void {
    const now = c.currentTime
    r.gain.gain.setTargetAtTime(Math.min(1, a.gain), now, Math.max(0.001, a.tc))
    if (a.op !== 'mute') { r.src.playbackRate.setTargetAtTime(a.rate, now, 0.1); r.pan?.pan.setTargetAtTime(a.pan, now, 0.08) }
  }
  function killLoop(c: AudioContext | null, slot: FieldSlot, tc: number): void {
    const r = running.get(slot)
    want.delete(slot)
    if (r === undefined) return
    running.delete(slot)
    const t = c?.currentTime ?? 0
    try { r.gain.gain.setTargetAtTime(0, t, Math.max(0.001, tc)); r.src.stop(t + tc * 6 + 0.02) } catch { /* 이미 멈춤 */ }
    r.src.onended = () => { r.src.disconnect(); r.gain.disconnect(); r.pan?.disconnect() }
  }
  /** 모두 멈춘다 (숨은 탭 · 소리 끔 · 새 판) — 계획도 비워 다음에 새로 튼다 */
  function stopLoops(c: AudioContext | null): void {
    for (const slot of [...running.keys()]) killLoop(c, slot, P.field.soundLoopTailMs / 3000)
    want.clear(); plan = {}
  }
  function syncLoops(c: AudioContext, targets: readonly LoopTarget[], nowMs: number): void {
    const sfx = soundVolume('sfx')
    const usable = sfx <= 0 ? [] : targets.filter(t => fileOf(t.slot, base) !== null).map(t => ({ ...t, gain: t.gain * sfx }))
    const p = planLoops(plan, usable, nowMs)
    plan = p.run
    for (const a of p.actions) {
      if (a.op === 'stop') { killLoop(c, a.slot, a.tc); continue }
      const r = running.get(a.slot)
      if (r !== undefined) { ramp(c, r, a); continue }
      if (a.op === 'mute') continue
      const pending = want.has(a.slot)
      want.set(a.slot, a)
      if (pending) continue
      const url = fileOf(a.slot, base)
      if (url === null) continue
      void bufferOf(c, url).then(buf => {
        const w = want.get(a.slot)
        want.delete(a.slot)
        if (buf === null || document.hidden || w === undefined || running.has(a.slot) || plan[a.slot] === undefined) return
        const src = c.createBufferSource(), gain = c.createGain()
        src.buffer = buf; src.loop = true
        src.playbackRate.value = w.rate
        gain.gain.value = 0
        let pan: StereoPannerNode | null = null, tail: AudioNode = gain
        if (typeof c.createStereoPanner === 'function') { pan = c.createStereoPanner(); pan.pan.value = w.pan; gain.connect(pan); tail = pan }
        src.connect(gain); tail.connect(c.destination)
        src.start()
        const r: Running = { src, gain, pan }
        running.set(a.slot, r)
        ramp(c, r, { ...w, op: 'set' })
      })
    }
  }

  return {
    unlock() {
      unlocked = true
      const c = audio()
      if (c === null) return
      void c.resume().catch(() => {})
      // 이어지는 소리 파일을 미리 받아 풀어 둔다 — 단계가 처음 바뀔 때 늦게 나지 않게
      for (const slot of Object.keys(FIELD_FILE) as FieldSlot[]) { const url = fileOf(slot, base); if (url !== null) void bufferOf(c, url) }
    },
    frame(frame, cam, events, nowMs) {
      const hidden = document.hidden
      const ev = hidden ? [] : [...(events ?? eventsFromDiff(st.last, frame)), ...pending]
      pending = []
      const out = stepSound(st, frame, cam, ev, nowMs, hidden)
      st = out.state
      if (!unlocked || hidden || muted()) { stopLoops(ctx); return }
      const c = audio()
      if (c === null) return
      if (c.state === 'suspended') void c.resume().catch(() => {})
      for (const p of out.plays) play(c, p)
      syncLoops(c, loopTargets(out.loops), nowMs)
    },
    order(kind) { pending.push(flagEvent(kind)) },
    end(win) { pending.push({ kind: 'end', win }) },
    stop() { st = newSoundState(); pending = []; stopLoops(ctx) },
  }
}
