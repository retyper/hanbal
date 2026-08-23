// localStorage 스텁
const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v) },
  removeItem: (k: string) => { mem.delete(k) },
}
const { loadSave, writeSave, defaultSave } = await import('../src/game/save.ts')
const { settleOffline } = await import('../src/game/offline.ts')
const { grantArrows, awardRun } = await import('../src/game/progression.ts')
const { getStage } = await import('../src/game/stages.ts')

// ── 시나리오 A: 탭을 숨기지 않고 25분 자리를 비운다 ──
const d = loadSave()
console.log('start arrows', d.arrows, 'training', d.training)
// 판 하나 끝났다 (writeSave 발생)
awardRun(d, getStage(0), { cleared: true, score: 100, accuracy: 0.5, arrowsUsed: 3 })
console.log('after run  arrows', d.arrows, 'training', d.training, 'lastSeen->now', Date.now() - d.lastSeen)
// 25분 자리를 비웠다. 탭은 계속 보였다 → visibilitychange 없음 → settleOffline 없음
// 돌아와서 클릭 → loadStage → writeSave
writeSave(d)
console.log('25분 뒤 writeSave 후: lastSeen이 now로 도장. 경과 =', ((Date.now() - d.lastSeen)/1000).toFixed(1), 's')
// 이제 정산해도
const g1 = settleOffline(d, Date.now())
console.log('시나리오A 정산 결과:', g1)

// ── 시나리오 B: 정상 (탭 숨김) ──
const e = defaultSave(Date.now())
e.lastSeen = Date.now() - 25 * 60 * 1000
const g2 = settleOffline(e, Date.now())
console.log('시나리오B(25분 숨김) 정산:', g2, '보유화살', e.arrows, '훈련치', e.training)

// ── 화살 경제: 25분 뒤 3판 ──
const f = defaultSave(Date.now())
f.arrows = 0; f.carry.arrows = 0
f.lastSeen = Date.now() - 25 * 60 * 1000
settleOffline(f, Date.now())
console.log('25분 축적 화살:', f.arrows)
for (let i = 0; i < 5; i++) {
  const st = getStage(2) // 1-3, arrows 6
  const grant = grantArrows(f, st)
  awardRun(f, st, { cleared: false, score: 0, accuracy: 0.5, arrowsUsed: grant })
  console.log(`판${i+1}: 지급 ${grant}발 → 잔여 ${f.arrows}`)
}
