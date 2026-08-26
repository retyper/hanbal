/**
 * 스테이지 — 캠페인 40판과 그 뒤의 무한 구간.
 *
 * 여기서 지키는 것은 셋이다.
 *  1. **판이 반복되지 않는다.** 형의 반려("일정 스테이지 이후엔 계속 똑같은 과녁")가
 *     `getStage()`의 clamp 때문이었다. 41판부터 실제로 다른 판이 나오는지 검사한다.
 *  2. **결정론** (A1). 같은 판 번호는 언제 구워도 같은 판이다 — 캐시가 비워진 뒤에도.
 *  3. **경계 안에 있다.** 생성기가 과녁을 화면 밖·지면 아래로 보내면 그 판은 못 깬다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { BOSS_EVERY, CAMPAIGN, STAGES, checkpointStage, getStage, stageH } from '../src/game/stages.ts'
import { ENDLESS_THEMES, endlessThemeName } from '../src/game/endless.ts'

/** 검사할 무한 구간 길이. 테마 한 바퀴를 여러 번 돌 만큼. */
const PROBE = 120

/** 1280px 화면 기준 과녁 화면 반경의 바닥 (px). 이 아래는 "안 보이는 것 맞히기"다. */
const MIN_SCREEN_R = 9
const VIEWPORT = 1280

const key = (i: number): string => JSON.stringify(getStage(i).targets)

describe('스테이지 — 캠페인', () => {
  it('40판이 그대로 있다', () => {
    assert.equal(STAGES.length, CAMPAIGN)
  })

  it('각크기 곡선이 화면 반경 바닥을 지킨다', () => {
    for (let n = 1; n <= CAMPAIGN + PROBE; n++) {
      const px = stageH(n) * VIEWPORT
      assert.ok(px >= MIN_SCREEN_R, `${n}판 과녁 화면 반경 ${px.toFixed(1)}px < ${MIN_SCREEN_R}px`)
    }
  })
})

describe('스테이지 — 무한 구간', () => {
  it('41판부터 판이 반복되지 않는다 (형의 반려 회귀)', () => {
    // 예전에는 getStage 가 인덱스를 잘라 4-10 을 무한히 돌려줬다.
    const last = key(CAMPAIGN - 1)
    for (let i = CAMPAIGN; i < CAMPAIGN + PROBE; i++) {
      assert.notEqual(key(i), last, `${i + 1}판이 캠페인 마지막 판과 같다`)
    }
    const seen = new Set<string>()
    for (let i = CAMPAIGN; i < CAMPAIGN + PROBE; i++) seen.add(key(i))
    // 완전히 같은 배치가 겹치는 일은 없어야 한다.
    assert.equal(seen.size, PROBE, `${PROBE}판 중 서로 같은 배치가 ${PROBE - seen.size}쌍 있다`)
  })

  it('같은 테마가 연달아 나오지 않는다', () => {
    let prev = ''
    for (let i = CAMPAIGN; i < CAMPAIGN + PROBE; i++) {
      const name = endlessThemeName(i)
      assert.notEqual(name, '', `${i + 1}판에 테마 이름이 없다`)
      assert.notEqual(name, prev, `${i + 1}판이 직전 판과 같은 테마('${name}')다`)
      prev = name
    }
  })

  it('한 바퀴 동안 모든 테마가 정확히 한 번씩 나온다', () => {
    for (let b = 0; b < Math.floor(PROBE / ENDLESS_THEMES); b++) {
      const seen = new Set<string>()
      for (let k = 0; k < ENDLESS_THEMES; k++) {
        seen.add(endlessThemeName(CAMPAIGN + b * ENDLESS_THEMES + k))
      }
      assert.equal(seen.size, ENDLESS_THEMES, `${b}번째 바퀴에서 테마가 ${seen.size}종류뿐이다`)
    }
  })

  it('같은 판 번호는 언제 구워도 같은 판이다 (A1)', () => {
    // 캐시 용량보다 훨씬 멀리 갔다 되돌아온다 — 다시 굽는 경로를 실제로 태운다.
    const first = key(CAMPAIGN + 3)
    for (let i = CAMPAIGN + 40; i < CAMPAIGN + 80; i++) key(i)
    assert.equal(key(CAMPAIGN + 3), first, '같은 판을 다시 구웠더니 다른 판이 나왔다')
  })

  it('과녁이 전부 경계 안에 있다', () => {
    for (let i = CAMPAIGN; i < CAMPAIGN + PROBE; i++) {
      const s = getStage(i)
      assert.ok(s.targets.length > 0, `${s.id}: 과녁이 없다`)
      assert.ok(s.arrows >= 5, `${s.id}: 화살이 ${s.arrows}발뿐이다`)
      // 여벌 화살 — 지급량은 언제나 "직접 맞혀야 하는 수"보다 넉넉해야 한다 (C1).
      assert.ok(s.arrows <= 10, `${s.id}: 화살이 ${s.arrows}발이면 한 판이 1분을 넘는다`)
      for (const t of s.targets) {
        assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y), `${s.id}: 좌표가 NaN이다`)
        // 만작 최대 사거리는 ~320m (35도, 실측). 곡사 챕터(5장)가 115m까지 쓴다.
        assert.ok(t.x > 5 && t.x < 130, `${s.id}: x=${t.x.toFixed(1)} 이 사거리 밖이다`)
        const lo = (t.y ?? 0) - (t.ampY ?? 0)
        const hi = (t.y ?? 0) + (t.ampY ?? 0)
        assert.ok(lo > 0.2, `${s.id}: y=${lo.toFixed(2)} 이 지면 아래로 내려간다`)
        assert.ok(hi < 9, `${s.id}: y=${hi.toFixed(2)} 이 너무 높다`)
        assert.ok((t.r ?? 0) > 0, `${s.id}: 반경이 0이다`)
      }
    }
  })

  it('판 이름과 id가 붙어 있다', () => {
    for (let i = CAMPAIGN; i < CAMPAIGN + PROBE; i++) {
      const s = getStage(i)
      assert.ok((s.title ?? '') !== '', `${s.id}: 이름이 없다`)
      assert.match(s.id, /^\d+-\d+$/, `이상한 id: ${s.id}`)
    }
  })
})

describe('체크포인트 (지도, 2026-08-26 — 형: "보스깨면 죽었을때 직전보스 다음스테이지부터")', () => {
  it('보스를 한 번도 안 잡았으면 1-1(0)이다', () => {
    assert.equal(checkpointStage(0), 0)
  })

  it('보스 N번 = 다음 마디 시작(0-based, N × BOSS_EVERY)', () => {
    assert.equal(checkpointStage(1), BOSS_EVERY) // 2-1
    assert.equal(checkpointStage(2), BOSS_EVERY * 2) // 3-1
    assert.equal(checkpointStage(4), BOSS_EVERY * 4) // 5-1
  })

  it('그 자리는 실제로 챕터 첫 판(n-1)이다 — getStage와 어긋나면 지도가 거짓말을 한다', () => {
    for (let k = 0; k <= 4; k++) {
      const idx = checkpointStage(k)
      const s = getStage(idx)
      assert.equal(s.id, `${k + 1}-1`, `체크포인트 ${idx}가 ${k + 1}-1이 아니라 ${s.id}다`)
    }
  })

  it('캠페인을 넘어서도 같은 식이 통한다(끝없는 구간도 10판마다 보스)', () => {
    const idx = checkpointStage(6) // 캠페인(5마디)을 넘은 6번째 마디
    assert.equal(idx, BOSS_EVERY * 6)
    assert.ok(idx >= CAMPAIGN, '캠페인 안에 있으면 이 테스트 전제가 틀렸다')
  })

  it('음수·소수는 방어적으로 처리한다', () => {
    assert.equal(checkpointStage(-3), 0)
    assert.equal(checkpointStage(2.9), BOSS_EVERY * 2)
  })
})
