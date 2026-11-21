import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { CARD_FRAME_PATHS } from '../src/raid/card-skins.ts'
import { imagePaths } from '../src/raid/haebi-view.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
type Piece = { path: string; size: [number, number]; bytes: number; sha256: string; native: [number, number]; top?: number; bottom?: number; side?: number }
type Item = { branch: 'a' | 'b' | 'c'; sourceSha256: string; frame: Piece & { slice: number[]; runtimeSlice: number[] }; pieces: Record<string, Piece> }
const manifest = JSON.parse(read('docs/realm/production/CLAUDE51-CARD-FRAMES.json')) as { runtimeBytes: number; items: Item[] }
const css = read('src/raid/card-skins.css')

test('51-1 branch frames: alpha WebP, manifest hashes and sizes, every file preloaded once', () => {
  let bytes = 0
  assert.equal(new Set(CARD_FRAME_PATHS).size, CARD_FRAME_PATHS.length)
  // The actual files are checked before the manifest so missing runtime art fails clearly.
  for (const path of CARD_FRAME_PATHS) {
    assert.equal(imagePaths.filter(p => p === path).length, 1, `${path}: startup preload missing or duplicated`)
    const data = readFileSync(new URL(`public/realm/${path}`, root))
    assert.equal(data.toString('ascii', 0, 4), 'RIFF')
    assert.equal(data.toString('ascii', 8, 12), 'WEBP')
    assert.equal(data.toString('ascii', 12, 16), 'VP8X')
    assert.ok(data[20]! & 0x10, `${path}: alpha channel lost`)
    bytes += data.length
  }
  assert.equal(manifest.runtimeBytes, bytes)
  assert.ok(bytes < 180_000, `${bytes} bytes exceeds card budget`)
  assert.deepEqual(manifest.items.map(r => r.branch), ['a', 'b', 'c'])
  const listed = manifest.items.flatMap(r => [r.frame, ...Object.values(r.pieces)])
  assert.deepEqual(listed.map(p => p.path).sort(), CARD_FRAME_PATHS.map(p => `public/realm/${p}`).sort())
  for (const p of listed) {
    const data = readFileSync(new URL(p.path, root))
    assert.equal(createHash('sha256').update(data).digest('hex'), p.sha256, p.path)
    assert.equal(statSync(new URL(p.path, root)).size, p.bytes)
    assert.equal(1 + data.readUIntLE(24, 3), p.size[0], `${p.path}: width`)
    assert.equal(1 + data.readUIntLE(27, 3), p.size[1], `${p.path}: height`)
  }
})

test('51-1 card-skins.css uses the baked numbers: slices, slice widths and unstretched centre pieces', () => {
  for (const r of manifest.items) {
    const rule = css.match(new RegExp(`\\.choices button\\.branch-${r.branch}\\{border-image:url\\('/realm/raid/ui-card-branch-${r.branch}\\.webp'\\) ([\\d ]+)/([^;]+) stretch;([^}]*)\\}`))
    assert.ok(rule, `branch-${r.branch} rule`)
    assert.deepEqual(rule[1]!.trim().split(' ').map(Number), r.frame.runtimeSlice, `${r.branch}: image slice`)
    assert.deepEqual([...rule[2]!.matchAll(/\*(\d+)px/g)].map(m => Number(m[1])), r.frame.slice, `${r.branch}: native slice widths`)
    const v = (name: string) => Number(rule[3]!.match(new RegExp(`--${name}:(-?\\d+)`))?.[1])
    const crest = r.pieces['crest']!, base = r.pieces['base']!
    assert.deepEqual([v('crest-w'), v('crest-h'), v('crest-top')], [...crest.native, crest.top], `${r.branch}: crest`)
    assert.deepEqual([v('base-w'), v('base-h'), v('base-bottom')], [...base.native, base.bottom], `${r.branch}: base`)
    assert.ok(rule[3]!.includes(`url('/realm/raid/ui-card-branch-${r.branch}-crest.webp')`) && rule[3]!.includes(`url('/realm/raid/ui-card-branch-${r.branch}-base.webp')`))
  }
  // 칼 테의 좌우 띠: 크기·자리 (원본 px)
  const band = manifest.items[0]!.pieces['band-l']!
  assert.ok(css.includes(`left calc(var(--s)*${band.side}px)`) && css.includes(`calc(var(--s)*${band.native[0]}px) calc(var(--s)*${band.native[1]}px)`))
  // 갈래 끝 카드는 「갈래 끝」 띠 자리라 위 장식을 그리지 않는다
  assert.ok(css.includes('.choices button.branch-card:not(.cap-card)::before'))
  // CSS 가 부르는 그림은 모두 미리 불러 둔다
  for (const m of css.matchAll(/url\('\/realm\/(raid\/ui-card-branch-[^']+)'\)/g)) assert.ok((CARD_FRAME_PATHS as readonly string[]).includes(m[1]!), m[1]!)
})
