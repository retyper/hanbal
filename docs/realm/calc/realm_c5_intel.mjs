// 검산 5: 정보 폭 w(a) → 보이는 승률 범위 (SYSTEMS §2-2, §2-3)
const P = R => R * R / (1 + R * R);
const W = [0, 0.2, 0.4, 0.7];
const pp = x => (x * 100).toFixed(0).padStart(3);
// 모르는 적 입력 m 개(N, E, M, ...)가 같은 나이 a 로 낡았다. 각자 [v(1−wu), v(1+w(1−u))].
// 승률 범위 = 적 F 의 최소·최대를 끝에서 끝까지 넣음. 참 P 는 Ptrue.
console.log('참P  a  w   u   모르는입력1(N)     2(N,M)        3(N,E,M)  → [최소~최대] 폭pp');
for (const Pt of [0.3, 0.5, 0.7]) {
  const R0 = Math.sqrt(Pt / (1 - Pt));
  for (let a = 1; a <= 3; a++) for (const u of [0.5, 0.0, 1.0]) {
    const w = W[a];
    const cells = [1, 2, 3].map(m => {
      const fdMin = (1 - w * u) ** m, fdMax = (1 + w * (1 - u)) ** m;
      const lo = P(R0 / fdMax), hi = P(R0 / fdMin);
      return `${pp(lo)}~${pp(hi)} (${pp(hi - lo)})`;
    });
    console.log(`${pp(Pt)}  ${a}  ${w.toFixed(1)} ${u.toFixed(1)}  ${cells.join('   ')}`);
  }
}
// 기습 확률 범위: 적 경계만 모름. 경계 참값 0.10~0.65 의 범위에 w 를 곱하면? 경계는 비율이 아니라 덧셈 값.
console.log('\n기습 범위 (경계 g 참값 0.30, 은폐 0.40, 같은 략): 비율 폭을 경계에 그대로 적용하면');
for (let a = 1; a <= 3; a++) { const w = W[a], g = 0.30; const lo = 0.40 - g * (1 + w * 0.5), hi = 0.40 - g * (1 - w * 0.5); console.log(`a=${a}: 경계 ${(g * (1 - w * .5)).toFixed(2)}~${(g * (1 + w * .5)).toFixed(2)} → 기습 ${pp(Math.max(.05, lo))}~${pp(hi)}%`); }
console.log('→ 문서 예 "기습 40~70%(2계절 전)" 은 폭 30pp: 경계 폭 0.30 이 필요 = 경계 참값 0.75 × w0.4 이상. 기본 경계 0.10 이면 a=2 폭은 4pp 뿐');

// 참값 이동과 정보 계약: 적이 징발을 농한기 0.15 → 언제나 0.30 으로 바꾸면 병력 상한 ×2 (한 계절)
console.log('\n참값이 움직일 때: 범위를 "참값 v" 둘레에 그리면 안 본 사이의 변화가 새고, "본 값" 둘레에 그리면 계약이 깨진다');
for (const [n, ch] of [['징발 0.15→0.30', 2.0], ['전투 패배 손실 25%', 0.75], ['대패 40%', 0.60], ['이주 5%', 0.95]]) {
  const out = W.slice(1).map((w, i) => `a=${i + 1}: ${ch <= 1 + w && ch >= 1 - w ? '품음' : '못 품음'}`).join(' · ');
  console.log(`${n.padEnd(16)} (×${ch}) — 본 값 둘레 범위가 참값을: ${out}`);
}
