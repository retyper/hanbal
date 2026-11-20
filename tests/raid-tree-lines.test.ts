import { test } from 'node:test'
import assert from 'node:assert/strict'
import { treeBusLevels } from '../src/raid/tree-view.ts'

test('52 the six actual landscape connector spans fit three separated horizontal lanes', () => {
  // Actual 844x390 SVG x ranges from the first real UI run. Six sequential lanes had only 1.91px separation.
  const spans: [number, number][] = [[7, 101.03], [270, 117.35], [273, 296.03], [7, 312.35], [250, 491.03], [507, 507.35]]
  const result = treeBusLevels(spans)
  assert.equal(result.count, 3)
  assert.equal(result.levels.length, spans.length)
  for (let a = 0; a < spans.length; a++) for (let b = a + 1; b < spans.length; b++) if (result.levels[a] === result.levels[b]) {
    const start = Math.max(Math.min(...spans[a]!), Math.min(...spans[b]!)), end = Math.min(Math.max(...spans[a]!), Math.max(...spans[b]!))
    assert.ok(start > end + 2, `strokes ${a}/${b} share a lane only with a real horizontal gap`)
  }
  const available = 11.5
  assert.ok(available / result.count > 3.8, 'the same measured vertical room now separates the 2px strokes')
})
