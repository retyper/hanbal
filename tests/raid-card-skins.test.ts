import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { CARD_FRAME_PATHS } from '../src/raid/card-skins.ts'
import { imagePaths } from '../src/raid/haebi-view.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('three shipping frames retain alpha, dimensions, native hashes and startup preload', () => {
  let bytes = 0
  assert.equal(CARD_FRAME_PATHS.length, 3)
  assert.equal(new Set(CARD_FRAME_PATHS).size, 3)
  // The actual files are checked before the manifest so missing runtime art fails clearly.
  for (const path of CARD_FRAME_PATHS) {
    assert.equal(imagePaths.filter(p => p === path).length, 1, `${path}: startup preload missing or duplicated`)
    const data = readFileSync(new URL(`public/realm/${path}`, root))
    assert.equal(data.toString('ascii', 0, 4), 'RIFF')
    assert.equal(data.toString('ascii', 8, 12), 'WEBP')
    assert.equal(data.toString('ascii', 12, 16), 'VP8X')
    assert.ok(data[20]! & 0x10, `${path}: alpha channel lost`)
    assert.equal(1 + data.readUIntLE(24, 3), 384)
    assert.equal(1 + data.readUIntLE(27, 3), 576)
    bytes += data.length
  }
  const manifest = JSON.parse(read('docs/realm/production/CODEX50-CARD-FRAMES.json'))
  assert.equal(manifest.runtimeBytes, bytes)
  assert.ok(bytes < 180_000, `${bytes} bytes exceeds card budget`)
  assert.equal(manifest.items.length, 3)
  assert.deepEqual(manifest.items.map((row: { path: string }) => row.path).sort(), CARD_FRAME_PATHS.map(p => `public/realm/${p}`).sort())
  for (const row of manifest.items) {
    const data = readFileSync(new URL(row.path, root))
    assert.equal(createHash('sha256').update(data).digest('hex'), row.sha256)
    assert.equal(statSync(new URL(row.path, root)).size, row.bytes)
    assert.equal(row.sourceSha256, row.archiveSha256)
    assert.equal(row.sourceSha256, row.generatorSha256)
    assert.equal(row.runtimeSlice, 60)
    assert.equal(row.nativeSlice, 160)
    assert.ok(row.alpha.transparentPixels > 0 && row.alpha.visiblePixels > 0)
  }
})
