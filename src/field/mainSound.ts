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
import { eventsFromDiff, flagEvent, newSoundState, stepSound } from './mainSoundModel.ts'
import type { FieldSlot, FlagKind, Play, SoundCam, SoundEvent, SoundFrame, SoundState } from './mainSoundModel.ts'

/**
 * 자리 → 본편 소리 표의 자리 (파일 이름은 PICK 에서 읽는다 — 여기서 손으로 박지 않는다).
 * null 은 형이 아직 안 고른 자리라 조용하다.
 */
export const PICKED: Readonly<Record<FieldSlot, Slot | null>> = {
  flag_charge: 'cmd_charge', flag_hold: 'cmd_hold', flag_open: 'cmd_open', flag_horse: 'cmd_horse', flag_move: 'ui_order',
  war_cry: 'war_cry', war_drums: 'war_drums', horse_start: 'horses', arrow_volley: 'arrow_volley', clash: 'battle_clash',
  gate: 'cmd_gate', end_win: 'horn_victory', end_lose: 'defeat',
  impact: null, rout: null, step_walk: null, step_run: null, hoof_walk: null, hoof_gallop: null,
}

/** 판 읽기 (FieldState → 소리 모델이 읽는 모양) — 읽기만 한다. edge 는 readField(state).edge */
export function soundFrameOf(s: FieldState, edge: readonly [number, number]): SoundFrame {
  return {
    tick: s.tick,
    squads: s.squads.map(q => ({ id: q.id, side: q.side, grp: q.grp, men: q.men, u: q.u, v: q.v, stance: q.stance, lock: q.lock, target: q.target })),
    pieces: s.map.pieces.map(p => ({ id: p.id, kind: p.kind, hp: p.hp })),
    edge, end: s.end, winner: s.winner,
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
    const slot = PICKED[p.slot]
    if (slot === null) return // 형이 아직 안 고른 자리 — 조용하다
    const sfx = soundVolume('sfx')
    if (sfx <= 0 || live >= P.field.soundVoicesMax) return
    const name = snd(slot)
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

  return {
    unlock() {
      unlocked = true
      const c = audio()
      if (c !== null) void c.resume().catch(() => {})
    },
    frame(frame, cam, events, nowMs) {
      const hidden = document.hidden
      const ev = hidden ? [] : [...(events ?? eventsFromDiff(st.last, frame)), ...pending]
      pending = []
      const out = stepSound(st, frame, cam, ev, nowMs, hidden)
      st = out.state
      if (!unlocked || hidden || muted()) return
      const c = audio()
      if (c === null) return
      if (c.state === 'suspended') void c.resume().catch(() => {})
      for (const p of out.plays) play(c, p)
    },
    order(kind) { pending.push(flagEvent(kind)) },
    end(win) { pending.push({ kind: 'end', win }) },
    stop() { st = newSoundState(); pending = [] },
  }
}
