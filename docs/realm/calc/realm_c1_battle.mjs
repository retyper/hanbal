// 검산 1: 전투 F = N·E·L·M·T·S, P = Fa^2/(Fa^2+Fd^2)  (SYSTEMS §4-2, §4-3, §6-3)
const k = 2;
const P = (fa, fd) => fa ** k / (fa ** k + fd ** k);
const pct = x => (x * 100).toFixed(1).padStart(5);

// 저격 해석 두 가지: A = 공격 -30% 만 (F×0.70), B = 공격 -30% 와 사기 -0.3 (M 1.0→0.7) 이 둘 다 곱해짐 (F×0.49)
const shots = {
  '없음': 1, '머리A(×0.70)': 0.70, '머리B(×0.49)': 0.49, '몸통(×0.85)': 0.85, '북(방어×0.85)': 0.85, '다리(×1)': 1,
};
const amb = { '기습없음': 1, '기습성공': 1.5, '들킴': 0.85 };

for (const ratio of [1, 0.5]) {
  console.log(`\n== 공격 병력 / 방어 병력 = ${ratio} (E·L·M 같음) ==`);
  console.log('기습      목책  | ' + Object.keys(shots).map(s => s.padEnd(12)).join(''));
  for (const [an, av] of Object.entries(amb)) for (const T of [1, 1.2]) {
    const row = Object.values(shots).map(sv => pct(P(ratio * av, 1 * T * sv)) + '%      ').join('');
    console.log(`${an.padEnd(8)} ${T === 1 ? '없음' : '1.2 '}  | ${row}`);
  }
}

// 저격 한 발이 승률을 얼마나 움직이나 — 바탕 P 에 따라
console.log('\n== 저격 한 발의 승률 변화 (바탕 P → 명중 시 P, Δpp) ==');
console.log('바탕P  병력비(동등조건)  머리A    Δ     머리B    Δ');
for (const p0 of [0.05, 0.10, 0.20, 0.30, 0.50, 0.70, 0.90]) {
  const R = Math.sqrt(p0 / (1 - p0)); // P = R^2/(1+R^2)
  const pa = P(R, 0.70), pb = P(R, 0.49);
  console.log(`${pct(p0)}  ${R.toFixed(2).padStart(8)}         ${pct(pa)} ${((pa - p0) * 100).toFixed(1).padStart(5)}   ${pct(pb)} ${((pb - p0) * 100).toFixed(1).padStart(5)}`);
}

// 결과 칸: 대승 r<0.35P, 승 r<P, 교착 r<P+0.10, 나머지 패·대패
console.log('\n== 결과 칸 (교착 0.10 이 패 쪽에서만 빠진다) ==');
for (const p of [0.3, 0.5, 0.8, 0.9, 0.95]) {
  const stall = Math.min(0.10, 1 - p), lose = Math.max(0, 1 - p - 0.10);
  console.log(`P=${pct(p)}  공격승 ${pct(p)}  교착 ${pct(stall)}  방어승 ${pct(lose)}  (1-P=${pct(1 - p)})`);
}

// 병력 2배를 뒤집기: 기습 확률 pa, 저격 명중 확률 ph 의 기대 승률
console.log('\n== 병력 1:2 를 뒤집나 — 기대 승률 (기습 시도 시 실패=들킴 0.85) ==');
console.log('p기습  p머리  목책 | 머리A 기대P  머리B 기대P | 둘 다 성공시 A/B');
for (const T of [1, 1.2]) for (const pa of [0.3, 0.5, 0.85]) for (const ph of [0.3, 0.5, 0.7]) {
  let ea = 0, eb = 0;
  for (const [ps, s] of [[pa, 1.5], [1 - pa, 0.85]]) for (const [pp, hA, hB] of [[ph, 0.70, 0.49], [1 - ph, 1, 1]]) {
    ea += ps * pp * P(0.5 * s, T * hA); eb += ps * pp * P(0.5 * s, T * hB);
  }
  console.log(`${pa.toFixed(2)}  ${ph.toFixed(2)}  ${T}  |  ${pct(ea)}%      ${pct(eb)}%    | ${pct(P(0.75, T * 0.7))}/${pct(P(0.75, T * 0.49))}`);
}
// 기습 없이 정면 1:2
console.log(`정면 1:2 목책없음 ${pct(P(0.5, 1))}% · 목책 ${pct(P(0.5, 1.2))}%`);

// 뒤집을 수 있는 최대 병력비 (P=0.5 가 되는 Nd/Na)
console.log('\n== P=50% 가 되는 방어/공격 병력비 (곱이 클수록 큰 차이를 뒤집는다) ==');
const combos = {
  '기습': 1.5, '머리A': 1 / 0.7, '머리B': 1 / 0.49, '기습+머리A': 1.5 / 0.7, '기습+머리B': 1.5 / 0.49,
  '기습+머리B+무10대무1': 1.5 / 0.49 * 1.30 / 0.85, '+장비 1.45 대 0.80': 1.5 / 0.49 * 1.30 / 0.85 * 1.45 / 0.8,
};
for (const [n, m] of Object.entries(combos)) console.log(`${n.padEnd(22)} 곱 ${m.toFixed(2)}  → ${m.toFixed(2)}배 병력까지 반반`);

// 기습 시도의 손익분기: S 기대 = 0.85 + 0.65p ; P 기준(동등 병력)
let be = null;
for (let p = 0; p <= 1; p += 0.001) { const e = p * P(1.5, 1) + (1 - p) * P(0.85, 1); if (e >= 0.5) { be = p; break; } }
console.log(`\n기습 시도 손익분기 p: F 기대 기준 ${(0.15 / 0.65).toFixed(3)} · 동등병력 P 기준 ${be.toFixed(3)}`);
