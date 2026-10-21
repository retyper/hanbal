/**
 * 밤의 암살판 — 판 셋의 배치 (docs/realm/SNIPE.md §0-1)
 *
 * 손으로 짠 표 하나에 시드로 조금 흔든다 — 같은 시드·같은 판이면 같은 배치다 (순수 함수, 결정론 A1).
 * 좌표는 활터와 같다: 미터, y 위쪽 +. 자객의 발밑(지붕)이 y=0, 마당 땅이 y=−roofHeight.
 * 사람은 그림이 아니라 형체다 — 여기에는 자리·자세·든 것만 있다 (그리기는 draw.ts).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'

export type LightKind = 'torch' | 'lantern' | 'fire' | 'candle'

export interface Light {
  readonly id: number
  readonly kind: LightKind
  x: number
  y: number
  lit: boolean
  /** 들고 다니는 사람의 id — 없으면 −1 (제자리 불) */
  readonly carrier: number
  /** 모닥불에 꽂힌 살 — fireHits 에 닿으면 사그라든다 (다시 붙이면 0) */
  hits: number
}

/**
 * 경비 — 0 느슨 · 1 보통 · 2 삼엄 (형: "경비가 삼엄한 암살이랑 안삼엄한거랑 조금 달라야").
 * 칠십팔국이 고을 경계·도읍·군주로 정해 `guard=` 로 넘긴다 (realm/plots.ts assassinGuard).
 * 판의 사람·불 수가 달라지고(아래 표의 min), 꺼진 불을 다시 붙이는 빠르기·눈길이 달라진다 (sim.ts).
 */
export type Guard = 0 | 1 | 2
export const GUARD_NAME: readonly string[] = ['느슨', '보통', '삼엄']
export const guardOf = (x: unknown): Guard => {
  const v = Math.floor(Number(x))
  return v <= 0 ? 0 : v >= 2 ? 2 : 1
}

/**
 * 꺼진 불을 다시 붙이러 가는 일 (형: "불꺼지면 경비들은 불키러 가야하는거 아님?").
 * go — 불로 걸어간다 · light — 붙이는 중(게이지) · back — 제자리로
 */
export interface Task {
  readonly light: number
  step: 'go' | 'light' | 'back'
  /** light 를 시작한 틱 */
  at: number
  readonly homeX: number
  readonly homePose: Pose
  readonly homeFacing: 1 | -1
}

export type Pose = 'stand' | 'walk' | 'sit'

export interface Patrol {
  readonly x0: number
  readonly x1: number
  readonly speed: number
  /** 0..1 — 왕복의 어디서 시작하나 */
  readonly phase: number
}

export interface Figure {
  readonly id: number
  readonly role: 'guard' | 'chief'
  x: number
  /** 발이 닿은 높이 */
  readonly y: number
  /** 앉은 보초도 불을 붙이러 가면 일어선다 */
  pose: Pose
  readonly holds: 'spear' | 'lantern' | null
  facing: 1 | -1
  readonly patrol: Patrol | null
  /** 키 배수 (형체마다 조금씩 다르게) */
  readonly size: number
  alive: boolean
  /** 쓰러진 틱 (−1 = 서 있다) */
  downAt: number
  /** 어디를 맞고 쓰러졌나 */
  hitZone: 'head' | 'body' | 'leg' | null
  /** 빛 안의 시체를 보고 있던 시간 (s) — noticeDelay 를 넘으면 게이지가 오른다 */
  watching: number
  /** 순찰의 자리 0..2 (왕복 삼각파) — 불을 붙이러 간 동안엔 멈춘다 */
  pu: number
  /** 꺼진 불을 붙이러 가는 중 — 없으면 null */
  task: Task | null
}

/** 살이 꽂히는 것 — 담·기둥·기와·수레 */
export type SolidKind = 'wall' | 'tile' | 'wood'

export interface Solid {
  readonly kind: SolidKind
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** 창호지 문 — 살이 뚫고 지나간다. 뒤에 적장의 그림자가 선다 */
export interface Door {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** 그리기만 하는 뒤 배경 (살이 안 걸린다) */
export interface Decor {
  readonly kind: 'compound' | 'gate' | 'hall' | 'granary' | 'well' | 'cart' | 'sarangchae' | 'stand'
  readonly x: number
  readonly w: number
  readonly h: number
}

export interface Scene {
  readonly index: number
  readonly title: string
  readonly guard: Guard
  readonly ground: number
  readonly figures: Figure[]
  readonly lights: Light[]
  readonly solids: readonly Solid[]
  readonly door: Door | null
  readonly decor: readonly Decor[]
}

/** 판 하나의 손 표 — y 는 모두 땅에서 잰 높이. `min` — 이 경비 단계부터 있다 (없으면 늘) */
interface Blueprint {
  readonly title: string
  readonly guards: ReadonlyArray<{
    readonly x: number; readonly pose: Pose; readonly holds: 'spear' | 'lantern' | null; readonly facing: 1 | -1
    readonly patrol?: { readonly x0: number; readonly x1: number }
    readonly min?: Guard
  }>
  readonly lights: ReadonlyArray<{ readonly kind: LightKind; readonly x: number; readonly y: number; readonly min?: Guard }>
  readonly solids: ReadonlyArray<Omit<Solid, never>>
  readonly door?: Door
  readonly chief?: { readonly x: number; readonly y: number }
  readonly decor: readonly Decor[]
}

const BLUEPRINTS: readonly Blueprint[] = [
  {
    title: '담장 밖',
    guards: [
      { x: 18.4, pose: 'stand', holds: 'spear', facing: -1 },
      { x: 23.6, pose: 'stand', holds: 'spear', facing: -1, min: 1 },
      { x: 13.5, pose: 'walk', holds: null, facing: 1, patrol: { x0: 11.5, x1: 15.5 } },
      { x: 29, pose: 'walk', holds: 'lantern', facing: -1, patrol: { x0: 26.5, x1: 32 }, min: 2 },
    ],
    lights: [
      { kind: 'torch', x: 19.75, y: 2.6 },
      { kind: 'torch', x: 22.25, y: 2.6 },
      { kind: 'torch', x: 13, y: 1.9 },
      { kind: 'torch', x: 27, y: 2.4, min: 2 },
    ],
    // 옆에서 보는 판이라 뒤 배경(담·대문)은 살을 안 막는다 — 앞에 놓인 수레만 막는다
    solids: [
      { kind: 'wood', x0: 9.2, y0: 0, x1: 10.8, y1: 1.1 }, // 수레
    ],
    decor: [
      { kind: 'compound', x: 8, w: 28, h: 2.4 },
      { kind: 'gate', x: 19.2, w: 3.6, h: 3.6 },
      { kind: 'cart', x: 9.2, w: 1.6, h: 1.1 },
      { kind: 'stand', x: 13, w: 0.2, h: 1.9 },
    ],
  },
  {
    title: '안뜰',
    guards: [
      { x: 15.4, pose: 'sit', holds: null, facing: 1 },
      { x: 18.6, pose: 'sit', holds: 'spear', facing: -1, min: 1 },
      { x: 17, pose: 'walk', holds: 'lantern', facing: 1, patrol: { x0: 10.5, x1: 25 } },
      { x: 26.5, pose: 'stand', holds: 'spear', facing: -1 },
      { x: 8.6, pose: 'stand', holds: 'spear', facing: 1, min: 2 },
    ],
    // 모닥불은 살 셋(fireHits)이면 사그라든다 — 그러면 둘러앉은 보초가 일어나 불씨를 살리러 간다 (어둠 속에서 하나씩)
    lights: [
      { kind: 'fire', x: 17, y: 0.3 },
      { kind: 'torch', x: 27.75, y: 2.2, min: 2 }, // 곳간 기둥의 횃불
    ],
    solids: [
      { kind: 'wall', x0: 11.6, y0: 0, x1: 12.7, y1: 0.9 }, // 우물
      { kind: 'wood', x0: 27.6, y0: 0, x1: 27.9, y1: 2.6 }, // 곳간 기둥
      { kind: 'tile', x0: 26.8, y0: 2.6, x1: 31, y1: 3.4 }, // 곳간 지붕
    ],
    decor: [
      { kind: 'hall', x: 6, w: 26, h: 5.2 },
      { kind: 'well', x: 11.6, w: 1.1, h: 0.9 },
      { kind: 'granary', x: 26.8, w: 4.2, h: 3.4 },
    ],
  },
  {
    title: '사랑채 앞',
    guards: [
      { x: 15.4, pose: 'stand', holds: 'spear', facing: -1 },
      { x: 19.6, pose: 'stand', holds: null, facing: -1, min: 1 },
      { x: 18, pose: 'walk', holds: 'spear', facing: 1, patrol: { x0: 16.5, x1: 21 } },
      { x: 12.5, pose: 'walk', holds: 'lantern', facing: 1, patrol: { x0: 10.5, x1: 15 }, min: 2 },
    ],
    lights: [
      { kind: 'torch', x: 16.6, y: 1.9 },
      { kind: 'torch', x: 21.2, y: 2.4 },
      { kind: 'candle', x: 24.5, y: 1.4 },
    ],
    solids: [
      { kind: 'wood', x0: 21, y0: 0, x1: 23.4, y1: 0.6 }, // 마루 앞
      { kind: 'wood', x0: 25.6, y0: 0, x1: 30, y1: 0.6 },
      { kind: 'wood', x0: 21, y0: 0.6, x1: 21.3, y1: 3.3 }, // 기둥
      { kind: 'wood', x0: 29.6, y0: 0.6, x1: 29.9, y1: 3.3 },
      { kind: 'tile', x0: 20.3, y0: 3.3, x1: 30.6, y1: 4.3 }, // 사랑채 지붕
    ],
    door: { x0: 23.4, y0: 0.6, x1: 25.6, y1: 2.8 },
    chief: { x: 24.5, y: 0.6 },
    decor: [
      { kind: 'sarangchae', x: 20.3, w: 10.3, h: 4.3 },
      { kind: 'stand', x: 16.6, w: 0.2, h: 1.9 },
    ],
  },
  {
    // 연습장 전용 — 보초가 아니라 그냥 서 있는 형체 (형: "궁술연습장도 만들어서 아무때나 해볼수 있게")
    title: '과녁만',
    guards: [
      { x: 9, pose: 'stand', holds: null, facing: -1 },
      { x: 14, pose: 'stand', holds: null, facing: -1 },
      { x: 19, pose: 'sit', holds: null, facing: -1 },
      { x: 24, pose: 'stand', holds: 'spear', facing: -1 },
      { x: 28, pose: 'walk', holds: null, facing: 1, patrol: { x0: 26, x1: 31 } },
    ],
    lights: [
      { kind: 'torch', x: 11.5, y: 1.2 },
      { kind: 'fire', x: 26.5, y: 0.3 },
    ],
    solids: [],
    decor: [
      { kind: 'compound', x: 6, w: 28, h: 2.4 },
      { kind: 'stand', x: 11.5, w: 0.2, h: 1.2 },
    ],
  },
]

/** 진짜 판 셋 (담장 밖 · 안뜰 · 사랑채 앞). 그 뒤는 연습장 전용 */
export const STAGE_COUNT = 3
/** 연습장에서 고를 수 있는 판 — 판 셋 + 과녁만 */
export const PRACTICE_STAGES = BLUEPRINTS.length
export const stageTitle = (i: number): string => BLUEPRINTS[i]?.title ?? ''

/** 판 하나를 굽는다 — 같은 시드·같은 판·같은 경비 = 같은 배치 (경비를 안 주면 보통) */
export function bakeScene(seed: number, index: number, guard: Guard = 1): Scene {
  const bp = BLUEPRINTS[Math.max(0, Math.min(BLUEPRINTS.length - 1, index))]!
  const g = -P.night.roofHeight
  const shake = (key: string): number => (roll(seed, index, key) - 0.5) * 2 * P.night.jitter
  const figures: Figure[] = []
  const lights: Light[] = []
  bp.guards.forEach((s, i) => {
    if ((s.min ?? 0) > guard) return
    const id = figures.length
    const dx = shake(`g${i}`)
    const patrol = s.patrol === undefined ? null : {
      x0: s.patrol.x0 + dx, x1: s.patrol.x1 + dx,
      speed: P.night.patrolSpeed * (0.85 + roll(seed, index, `sp${i}`) * 0.3),
      phase: roll(seed, index, `ph${i}`),
    }
    figures.push({
      id, role: 'guard', x: s.x + dx, y: g, pose: s.pose, holds: s.holds, facing: s.facing, patrol,
      size: 0.94 + roll(seed, index, `sz${i}`) * 0.12,
      alive: true, downAt: -1, hitZone: null, watching: 0, pu: patrol === null ? 0 : patrol.phase * 2, task: null,
    })
    if (s.holds === 'lantern') lights.push({ id: lights.length, kind: 'lantern', x: s.x + dx, y: g + 1.05, lit: true, carrier: id, hits: 0 })
  })
  for (const l of bp.lights) if ((l.min ?? 0) <= guard) lights.push({ id: lights.length, kind: l.kind, x: l.x, y: g + l.y, lit: true, carrier: -1, hits: 0 })
  if (bp.chief !== undefined) {
    figures.push({
      id: figures.length, role: 'chief', x: bp.chief.x, y: g + bp.chief.y, pose: 'stand', holds: null, facing: -1, patrol: null,
      size: 1.05, alive: true, downAt: -1, hitZone: null, watching: 0, pu: 0, task: null,
    })
  }
  const lift = (s: Solid): Solid => ({ kind: s.kind, x0: s.x0, y0: g + s.y0, x1: s.x1, y1: g + s.y1 })
  const door = bp.door === undefined ? null : { x0: bp.door.x0, y0: g + bp.door.y0, x1: bp.door.x1, y1: g + bp.door.y1 }
  return { index, title: bp.title, guard, ground: g, figures, lights, solids: bp.solids.map(lift), door, decor: bp.decor }
}
