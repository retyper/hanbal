/**
 * LPC(Universal LPC Spritesheet Character Generator) 겹 그림 → 겨루기용 20컷 가로 띠.
 *
 * 쓰는 법:  node tools/lpc-compose.mjs [키 ...]      (키를 안 주면 아래 RECIPES 전부)
 * 환경:     LPC_DIR (기본 D:/tmp-node/lpc — 얕게 받은 저장소) · OUT_DIR (기본 public/realm/anim-px)
 *
 * 출력: public/realm/anim-px/gen-<키>.png  (20컷, 오른쪽을 본다, 컷 크기 CELL_W × CELL_H 모두 같다)
 *       서기 0-3 · 걷기 4-11 · 공격 12-17 · 맞음 18 · 쓰러짐 19   (src/duel/view.ts fieldFighters)
 *       + 시험용 확대 맞춤판 SHEET_DIR(기본 D:/tmp-node/px)/sheet-<키>.png 와 쓴 겹 목록 tools/lpc-used.json
 *
 * 런타임 의존성 0 — tools/png.mjs (zlib) 만 쓴다. 겹 정의(경로·z순서·저작권)는 저장소의
 * sheet_definitions/*.json 에서 그대로 읽는다. 라이선스는 OGA-BY / CC-BY / CC-BY-SA / CC0 쪽만 쓴다 (GPL 단독 금지).
 *
 * 새 장수를 더하려면 RECIPES 에 한 줄 더한다. 겹 하나 = L(정의json, { 색, 변형, 겹번호 }).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from './png.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const LPC = process.env.LPC_DIR ?? 'D:/tmp-node/lpc'
const OUT = process.env.OUT_DIR ?? resolve(HERE, '../public/realm/anim-px')
const SHEET_DIR = process.env.SHEET_DIR ?? 'D:/tmp-node/px'
const SHEETS = `${LPC}/spritesheets/`
const DEFS = `${LPC}/sheet_definitions/`

// ── 판 크기 ────────────────────────────────────────────────
/** 한 장을 그리는 넉넉한 판 (큰 무기 128 칸이 들어간다). 몸 64 칸은 가운데 */
const CANVAS = 192
/** 잘라 낼 칸 크기 — 모든 컷·모든 장수가 같다 */
const CELL_W = 96
const CELL_H = 72
/** 칸 아래 줄 = 발바닥. 몸 64 칸 안에서 발이 닿는 맨 아래 줄(0부터)이 이것 */
const FOOT_ROW = 62
/** 칸 안에서 발바닥 아래로 남기는 줄 수 */
const FOOT_PAD = 1

// ── 동작 판 규격 ───────────────────────────────────────────
const COLS = { walk: 9, slash: 6, thrust: 8, shoot: 13, hurt: 6, idle: 2, combat_idle: 2 }

// ── 20컷 대응: [동작, 가로 칸]  (공격 동작은 무기에 따라 갈아 끼운다) ──
const FRAMES = {
  idle: [['idle', 0], ['idle', 1], ['idle', 1], ['idle', 0]],
  walk: [1, 2, 3, 4, 5, 6, 7, 8].map((c) => ['walk', c]),
  attack: {
    slash: [0, 1, 2, 3, 4, 5].map((c) => ['slash', c]),
    thrust: [0, 1, 2, 4, 5, 7].map((c) => ['thrust', c]),
    shoot: [1, 3, 5, 8, 10, 12].map((c) => ['shoot', c]),
  },
  hurt: [['hurt', 1]],
  fall: [['hurt', 5]],
}

// ── 팔레트 ────────────────────────────────────────────────
const PAL = {
  cloth: JSON.parse(readFileSync(`${LPC}/palette_definitions/cloth/cloth_ulpc.json`, 'utf8')),
  hair: JSON.parse(readFileSync(`${LPC}/palette_definitions/hair/hair_ulpc.json`, 'utf8')),
  body: JSON.parse(readFileSync(`${LPC}/palette_definitions/body/body_ulpc.json`, 'utf8')),
  metal: JSON.parse(readFileSync(`${LPC}/palette_definitions/metal/metal_ulpc.json`, 'utf8')),
  wood: JSON.parse(readFileSync(`${LPC}/palette_definitions/wood/wood_ulpc.json`, 'utf8')),
  eye: JSON.parse(readFileSync(`${LPC}/palette_definitions/eye/eye_ulpc.json`, 'utf8')),
}
const BASE = { cloth: 'white', hair: 'orange', body: 'light', metal: 'steel', wood: 'maple', eye: 'blue' }
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
/** 색 바꾸기 지도: 원본 팔레트 칸 → 목표 팔레트 칸 */
function recolorMap(set, to) {
  const from = PAL[set][BASE[set]]
  const dst = PAL[set][to]
  if (dst === undefined) throw new Error(`팔레트 없음: ${set}/${to}`)
  const m = new Map()
  from.forEach((c, i) => { const [r, g, b] = hex(c); m.set((r << 16) | (g << 8) | b, hex(dst[i])) })
  return m
}

// ── 겹 ────────────────────────────────────────────────────
const used = new Map() // 겹 정의 → 저작권 (credits 용)
const imgCache = new Map()
const loadImg = (path) => {
  if (!imgCache.has(path)) imgCache.set(path, existsSync(path) ? decodePng(path) : null)
  return imgCache.get(path)
}

/** 겹 하나: 정의 json + 몸꼴 + 색/변형. layers 는 쓸 layer_N 번호 (안 주면 전부) */
function L(def, o = {}) {
  return { def, gender: 'female', ...o }
}
function expand(spec) {
  const j = JSON.parse(readFileSync(`${DEFS}${spec.def}`, 'utf8'))
  const out = []
  for (const k of Object.keys(j).filter((x) => /^layer_\d+$/.test(x))) {
    const n = Number(k.slice(6))
    if (spec.layers && !spec.layers.includes(n)) continue
    const ly = j[k]
    const dir0 = ly[spec.gender]
    if (dir0 === undefined) continue
    const dir = dir0.replace('${head}', spec.gender)
    out.push({ spec, name: j.name, dir, z: ly.zPos, custom: ly.custom_animation ?? null, defJson: j })
  }
  if (!used.has(spec.def)) used.set(spec.def, { def: spec.def, name: j.name, credits: j.credits ?? [] })
  return out
}
/** 이 겹의 이 동작 파일 (없으면 null) */
function fileFor(layer, anim) {
  const { spec, dir, custom } = layer
  if (custom !== null) {
    if (custom.replace(/_128$/, '') !== anim) return null
    const c = [`${dir}${spec.variant}.png`, `${dir}${anim}.png`]
    return c.map((x) => SHEETS + x).find(existsSync) ?? null
  }
  const c = spec.variant
    ? [`${dir}${anim}/${spec.variant}.png`, `${dir}${anim}.png`, `${dir}${spec.variant}.png`]
    : [`${dir}${anim}.png`]
  return c.map((x) => SHEETS + x).find(existsSync) ?? null
}

/** 겹에서 한 컷을 CANVAS 판에 올린다 (판 가운데 = 몸 64 칸의 가운데). 오른쪽 줄을 쓴다 */
function blit(canvas, layer, anim, col) {
  let file = fileFor(layer, anim)
  let c = col
  if (file === null) { // 이 겹에 이 동작이 없으면 걷기 첫 컷(선 자세)을 대신 쓴다
    file = fileFor(layer, 'walk')
    c = 0
    anim = 'walk'
    if (file === null) return
  }
  const im = loadImg(file)
  const cols = layer.custom !== null ? im.w / 128 : (COLS[anim] ?? Math.round(im.w / 64))
  const fs = layer.custom !== null ? 128 : im.w / cols
  const rows = Math.round(im.h / fs)
  const row = rows === 4 ? 3 : 0
  const ox = (CANVAS - fs) / 2
  const oy = (CANVAS - fs) / 2
  const map = layer.spec.color ? recolorMap(layer.spec.color[0], layer.spec.color[1]) : null
  for (let y = 0; y < fs; y++) {
    for (let x = 0; x < fs; x++) {
      const s = ((row * fs + y) * im.w + c * fs + x) * 4
      const a = im.px[s + 3]
      if (a === 0) continue
      let r = im.px[s]
      let g = im.px[s + 1]
      let b = im.px[s + 2]
      if (map !== null) { const m = map.get((r << 16) | (g << 8) | b); if (m !== undefined) { r = m[0]; g = m[1]; b = m[2] } }
      const d = ((oy + y) * CANVAS + ox + x) * 4
      if (a === 255 || canvas[d + 3] === 0) { canvas[d] = r; canvas[d + 1] = g; canvas[d + 2] = b; canvas[d + 3] = a; continue }
      // 반투명 겹치기 (source-over)
      const da = canvas[d + 3] / 255
      const sa = a / 255
      const oa = sa + da * (1 - sa)
      canvas[d] = Math.round((r * sa + canvas[d] * da * (1 - sa)) / oa)
      canvas[d + 1] = Math.round((g * sa + canvas[d + 1] * da * (1 - sa)) / oa)
      canvas[d + 2] = Math.round((b * sa + canvas[d + 2] * da * (1 - sa)) / oa)
      canvas[d + 3] = Math.round(oa * 255)
    }
  }
}

/** 장수 레시피 → 20컷 띠 */
function compose(key, recipe) {
  const layers = recipe.layers.flatMap(expand).sort((a, b) => a.z - b.z)
  const seq = [...FRAMES.idle, ...FRAMES.walk, ...FRAMES.attack[recipe.attack], ...FRAMES.hurt, ...FRAMES.fall]
  if (seq.length !== 20) throw new Error('컷이 스무 개가 아니다')
  const cx0 = (CANVAS - CELL_W) / 2
  const cy0 = (CANVAS - 64) / 2 + FOOT_ROW + FOOT_PAD - CELL_H
  const strip = new Uint8Array(CELL_W * 20 * CELL_H * 4)
  seq.forEach(([anim, col], i) => {
    const cv = new Uint8Array(CANVAS * CANVAS * 4)
    // 쓰러진 컷(맞음 판 끝)은 무기를 놓은 모습 — 손에 든 겹(held)은 뺀다
    for (const ly of layers) if (!(ly.spec.held && anim === 'hurt' && col === 5)) blit(cv, ly, anim, col)
    for (let y = 0; y < CELL_H; y++) {
      for (let x = 0; x < CELL_W; x++) {
        const s = ((cy0 + y) * CANVAS + cx0 + x) * 4
        const d = (y * CELL_W * 20 + i * CELL_W + x) * 4
        strip[d] = cv[s]; strip[d + 1] = cv[s + 1]; strip[d + 2] = cv[s + 2]; strip[d + 3] = cv[s + 3]
      }
    }
  })
  return strip
}

/** 컷 20개를 5×4 로 늘려 놓은 맞춤판 (눈으로 순서 확인용) */
function contact(strip, scale = 3) {
  const cols = 10
  const rows = 2
  const w = cols * CELL_W * scale
  const h = rows * CELL_H * scale
  const out = new Uint8Array(w * h * 4)
  for (let i = 0; i < 20; i++) {
    const gx = (i % cols) * CELL_W * scale
    const gy = Math.floor(i / cols) * CELL_H * scale
    for (let y = 0; y < CELL_H * scale; y++) {
      for (let x = 0; x < CELL_W * scale; x++) {
        const s = (Math.floor(y / scale) * CELL_W * 20 + i * CELL_W + Math.floor(x / scale)) * 4
        const d = ((gy + y) * w + gx + x) * 4
        const edge = x === 0 || y === 0
        const base = edge ? [255, 80, 80] : ((Math.floor(y / scale) === CELL_H - FOOT_PAD) ? [60, 90, 60] : [44, 52, 60])
        const a = strip[s + 3] / 255
        for (let k = 0; k < 3; k++) out[d + k] = Math.round(strip[s + k] * a + base[k] * (1 - a))
        out[d + 3] = 255
      }
    }
  }
  return { w, h, px: out }
}

// ══ 레시피 ═══════════════════════════════════════════════════
// 겹 순서는 z 로 자동 정렬된다. 색 = [팔레트, 이름].
const SKIN = ['body', 'light']
const BODY_F = [
  L('body/body.json', { color: SKIN }),
  L('head/heads/human/heads_human_female.json', { color: SKIN }),
  L('head/faces/face_neutral.json', { color: ['eye', 'brown'] }),
]
const BODY_M = BODY_F.map((s) => ({ ...s, gender: 'male', def: s.def.replace('female', 'male') }))

const RECIPES = {
  // 번예 달빛 — 남빛 두건 달린 겉옷, 검은 가죽 저고리, 깃 꽂은 긴 머리 · 맥궁
  dalbit: {
    attack: 'shoot',
    layers: [
      ...BODY_F,
      L('hair/braids/hair_high_ponytail.json', { color: ['hair', 'black'] }),
      L('torso/shirts/longsleeve/torso_clothes_longsleeve2.json', { color: ['cloth', 'navy'] }),
      L('torso/waist/belt_sash_narrow.json', { color: ['cloth', 'maroon'] }),
      L('legs/pants/legs_pants2.json', { color: ['cloth', 'charcoal'] }),
      L('feet/boots/feet_boots_basic.json', { color: ['cloth', 'black'] }),
      L('torso/cape/cape_solid.json', { color: ['cloth', 'navy'] }),
      L('torso/backpack/quiver.json', { variant: 'quiver' }),
      L('weapons/ranged/bow/weapon_ranged_bow_recurve.json', { held: true, variant: 'dark' }),
    ],
  },
  // 살해 완 — 초록 무명 저고리, 갈색 띠, 묶어 올린 검은 머리 · 맥궁과 화살통
  wan: {
    attack: 'shoot',
    layers: [
      ...BODY_F,
      L('hair/braids/hair_high_ponytail.json', { color: ['hair', 'black'] }),
      L('headwear/coverings/headbands/hat_headband_hairtie.json', { color: ['cloth', 'forest'] }),
      L('torso/shirts/longsleeve/torso_clothes_longsleeve2.json', { color: ['cloth', 'forest'] }),
      L('torso/waist/belt_sash_narrow.json', { color: ['cloth', 'leather'] }),
      L('legs/pants/legs_pants2.json', { color: ['cloth', 'brown'] }),
      L('feet/boots/feet_boots_basic.json', { color: ['cloth', 'leather'] }),
      L('torso/backpack/quiver.json', { variant: 'quiver' }),
      L('weapons/ranged/bow/weapon_ranged_bow_recurve.json', { held: true, variant: 'medium' }),
    ],
  },
  // 여자 창잡이 (w-spear 대신) — 삼베빛 저고리, 자주 띠, 묶은 긴 머리
  'w-spear': {
    attack: 'thrust',
    layers: [
      ...BODY_F,
      L('hair/braids/hair_ponytail2.json', { color: ['hair', 'dark_brown'] }),
      L('torso/shirts/longsleeve/torso_clothes_longsleeve2.json', { color: ['cloth', 'tan'] }),
      L('torso/waist/belt_sash_narrow.json', { color: ['cloth', 'maroon'] }),
      L('legs/pants/legs_pants2.json', { color: ['cloth', 'brown'] }),
      L('feet/boots/feet_boots_basic.json', { color: ['cloth', 'leather'] }),
      L('weapons/polearm/weapon_polearm_spear.json', { held: true, variant: 'steel' }),
    ],
  },
  // 남자 칼잡이 (g-sword 대신) — 상투, 무명 저고리, 가죽 띠, 곧은 칼
  'g-sword': {
    attack: 'slash',
    layers: [
      ...BODY_M,
      L('hair/braids/hair_topknot_short.json', { gender: 'male', color: ['hair', 'black'] }),
      L('torso/shirts/longsleeve/torso_clothes_longsleeve2.json', { gender: 'male', color: ['cloth', 'bluegray'] }),
      L('torso/waist/belt_leather.json', { gender: 'male', color: ['cloth', 'leather'] }),
      L('legs/pants/legs_pants2.json', { gender: 'male', color: ['cloth', 'charcoal'] }),
      L('feet/boots/feet_boots_basic.json', { gender: 'male', color: ['cloth', 'black'] }),
      L('weapons/sword/weapon_sword_arming.json', { held: true, gender: 'male', variant: 'steel' }),
    ],
  },
}

// ══ 실행 ═════════════════════════════════════════════════════
mkdirSync(OUT, { recursive: true })
mkdirSync(SHEET_DIR, { recursive: true })
const keys = process.argv.slice(2).length > 0 ? process.argv.slice(2) : Object.keys(RECIPES)
for (const k of keys) {
  const strip = compose(k, RECIPES[k])
  writeFileSync(`${OUT}/gen-${k}.png`, encodePng(CELL_W * 20, CELL_H, strip))
  const cs = contact(strip)
  writeFileSync(`${SHEET_DIR}/sheet-${k}.png`, encodePng(cs.w, cs.h, cs.px))
  console.log(`gen-${k}.png  ${CELL_W * 20}x${CELL_H}`)
}
writeFileSync(resolve(HERE, 'lpc-used.json'), JSON.stringify([...used.values()], null, 1) + '\n')
