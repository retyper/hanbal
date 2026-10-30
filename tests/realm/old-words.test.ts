/**
 * 늙은이 말 (형 10-30: "흰머리 나지 않은 이상 본인을 늙은이라고 하는 대사는 거의 쓰지 말아야 할 듯")
 * 결마다 쓰는 표(목소리 · 군장 말 · 회의 · 사건)엔 늙었다는 말이 없다 · 늙은이 말은 OLD_* 표(age.isOld 일 때만)나 늙은 장수의 등용 대사에만
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isOld } from '../../src/realm/age.ts'
import { HIRE_LINE } from '../../src/realm/data/hire-lines.ts'
import { CHIEF_LINE } from '../../src/ui/realm/chief-lines.ts'
import { CHIEF_LINE_B } from '../../src/ui/realm/chief-lines-b.ts'
import { SAYS, VOLUNTEER_ASK } from '../../src/ui/realm/council-says.ts'
import { AUTO_LINE } from '../../src/ui/realm/voice.ts'
import { LINES_B } from '../../src/ui/realm/voice-b.ts'
import { LINES_C } from '../../src/ui/realm/voice-c.ts'
import { LINES_NEW } from '../../src/ui/realm/voice-new.ts'

const OLD = /늙|노구|노신|노장|늘그막|이 나이에|젊은 것들|젊은이들은|젊은 날|세월은 (?:못|속일)/
const strings = (x: unknown): string[] => (typeof x === 'string' ? [x] : x !== null && typeof x === 'object' ? Object.values(x).flatMap(strings) : [])

describe('늙은이 말', () => {
  it('결마다 쓰는 표에는 없다', () => {
    for (const t of strings([AUTO_LINE, LINES_B, LINES_C, LINES_NEW, CHIEF_LINE, CHIEF_LINE_B, SAYS, VOLUNTEER_ASK])) assert.doesNotMatch(t, OLD, t)
  })
  it('등용 대사는 늙은 장수만', () => {
    for (const [id, t] of Object.entries(HIRE_LINE)) if (OLD.test(t)) assert.ok(isOld({ id }), `${id}: ${t}`)
  })
})
