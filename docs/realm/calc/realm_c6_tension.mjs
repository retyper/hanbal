// 검산 6: τ += 0.04·(국력/평균), clamp 0~1, 큰 재난 뒤 τ=0.2 + 두 계절 휴지 (SYSTEMS §9-1, PLAY §3-1)
console.log('국력비 r | 계절당 +τ | 0→1 걸리는 계절 | 0.2→1 (재난 뒤) | 40계절 끝 τ(재난 없음)');
for (const r of [0.5, 0.7, 1, 1.5, 2, 3, 4.8, 6]) {
  const d = 0.04 * r;
  console.log(`${r.toFixed(1).padStart(4)}    | ${d.toFixed(3)}     | ${(1 / d).toFixed(1).padStart(5)}          | ${(0.8 / d).toFixed(1).padStart(5)} (+휴지 2)   | ${Math.min(1, 40 * d).toFixed(2)}`);
}
// 12국 권역에서 평균에 우리를 넣으면: 점유율 s → r = s·12 / 1 (평균 = 전체/12)
console.log('\n12국 권역, 우리 점유율 s → r = 12s (평균에 우리 포함): ' + [0.05, 0.083, 0.15, 0.25, 0.4, 0.5].map(s => `s=${s} r=${(12 * s).toFixed(1)}`).join(' · '));

// 판 대본 궤적: 점유율이 5% (작은 나라) → 34계절에 50% (과반) 로 로그형/선형 성장. 재난은 τ≥T 일 때 확률 q 로 (가정)
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function traj(s) { const x = Math.min(1, s / 34); return 0.05 + (0.50 - 0.05) * x; } // 선형
function run(seed, T, q, catchup = false) {
  const rng = mulberry32(seed); let tau = 0, rest = 0, dis = 0, sat = 0, track = [];
  for (let s = 1; s <= 40; s++) {
    const r = 12 * (catchup ? traj(s) * 0.5 : traj(s));
    if (rest > 0) rest--; else tau = Math.min(1, tau + 0.04 * r);
    if (tau >= 1) sat++;
    if (rest === 0 && tau >= T && rng() < q) { dis++; tau = 0.2; rest = 2; }
    if (s % 4 === 0) track.push(tau.toFixed(2));
  }
  return { dis, sat, track };
}
const ex = run(1, 2, 0); // 재난 없음
console.log('\n대본 궤적(점유 5%→50% 선형, 재난 없음) 해마다 τ: ' + ex.track.join(' ') + ` · τ=1 에 붙은 계절 ${ex.sat}/40`);
for (const [T, q] of [[0.8, 0.5], [0.6, 0.35], [0.9, 0.8]]) {
  let d = 0, st = 0; const N = 5000;
  for (let i = 0; i < N; i++) { const o = run(100 + i, T, q); d += o.dis; st += o.sat; }
  console.log(`재난 가정: τ≥${T} 이면 계절당 ${q} → 40계절 큰 재난 평균 ${(d / N).toFixed(1)}회 · τ=1 붙은 계절 평균 ${(st / N).toFixed(1)}`);
}
// 약한 나라 (점유 5% 고정, r=0.6) 도 40계절이면 τ
console.log(`\n제자리 약소국 (r=0.6): 40계절 τ = ${Math.min(1, 40 * 0.024).toFixed(2)} · 평균국 (r=1): 25계절에 1.0`);
