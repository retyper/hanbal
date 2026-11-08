/**
 * 숨 쉬는 영상 — 적어 둔 판마다 파일이 실제로 있다 (이름 규칙 11-08: awaken-loop/<id>.mp4 · .sq · .2 … · awaken2-loop/ 같은 규칙)
 * 판이 둘인 쇠비 2차 · 소서노 1차는 번갈아 돈다 (형 11-08)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { AWAKEN2_LOOP, AWAKEN_LOOP, loopTakes, loopTakes2 } from '../../src/realm/data/awaken-art.ts'

const pub = (f: string): string => new URL(`../../public/realm/${f}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

describe('각성 숨쉬기 영상', () => {
  it('1차·2차 각성 영상의 판마다 파일이 있다', () => {
    for (const id of AWAKEN_LOOP) for (const f of loopTakes(id)) assert.ok(existsSync(pub(f)), f)
    for (const id of AWAKEN2_LOOP) for (const f of loopTakes2(id)) assert.ok(existsSync(pub(f)), f)
  })
  it('쇠비 2차 · 소서노 1차는 판이 둘', () => {
    assert.equal(loopTakes2('w-30-guya-soebi').length, 2)
    assert.equal(loopTakes('l-L2-soseono').length, 2)
  })
})
