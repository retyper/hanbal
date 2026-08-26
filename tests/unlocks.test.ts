/**
 * 칭호(업적) 아이콘 (2026-08-26, 형: "스팀이랑 똑같이 아이콘이랑 업적 달성 같은걸로
 * 해놓던지"). 장착 개념은 걷어냈다 — 스팀은 뭘 달았는지 보여주는 게 아니라 몇 개
 * 땄는지, 그리고 각각에 아이콘이 있는지만 보여준다. 여기서 지키는 건 그 전제 하나다:
 * **칭호마다 반드시 자기 아이콘이 있다.** 하나라도 빠지면 잠긴 것과 구분이 안 된다
 * (titleIconSvg의 미확인 id 폴백이 잠긴 칸에도 쓰이는 그 실루엣이라서).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { UNLOCKS } from '../src/game/unlocks.ts'
import { TITLE_ICON, titleIconSvg, isTitleId } from '../src/ui/titleicons.ts'

const titleDefs = UNLOCKS.filter((d) => d.kind === 'title')

describe('칭호 아이콘', () => {
  it('칭호 8개가 그대로 있다 (숫자가 바뀌면 이 테스트도 같이 갱신할 것)', () => {
    assert.equal(titleDefs.length, 8)
  })

  it('칭호마다 자기만의 아이콘이 있다 — 빠지면 잠긴 것과 구분이 안 된다', () => {
    for (const d of titleDefs) {
      assert.ok(d.id in TITLE_ICON, `${d.id}(${d.label})에 아이콘이 없다`)
    }
  })

  it('TITLE_ICON에 칭호가 아닌 id·죽은 id가 섞여 있지 않다', () => {
    const ids = new Set(titleDefs.map((d) => d.id))
    for (const key of Object.keys(TITLE_ICON)) {
      assert.ok(ids.has(key), `TITLE_ICON에 있는 ${key}가 실제 칭호 목록에 없다`)
    }
  })

  it('아이콘끼리 그림이 겹치지 않는다 (복붙 실수로 같은 path를 두 번 쓰는 사고 방지)', () => {
    const seen = new Set<string>()
    for (const [id, svg] of Object.entries(TITLE_ICON)) {
      assert.ok(!seen.has(svg), `${id}의 아이콘이 다른 칭호와 그림이 똑같다`)
      seen.add(svg)
    }
  })

  it('활 해금(bow.*)은 칭호가 아니다 — 아이콘 대상에서 빠져야 한다', () => {
    assert.equal(isTitleId('bow.gakgung'), false)
    assert.equal(isTitleId('title.oneshot'), true)
    assert.equal(isTitleId('없는id'), false)
  })

  it('모르는 id는 크래시 없이 잠긴 칸과 같은 실루엣을 돌려준다', () => {
    const unknown = titleIconSvg('title.없는것', 20)
    const locked = titleIconSvg('', 20)
    assert.equal(unknown, locked)
    assert.ok(unknown.includes('<svg'))
  })
})
