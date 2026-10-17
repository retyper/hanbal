// 검산 4: p_ambush = clamp(은폐 + 0.05·(략a−략d) + 특성 − 경계, 0.05, 0.85)  (SYSTEMS §3, §1-1, §1-2, §5-8, CONTENT 신중)
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pct = x => (x * 100).toFixed(0).padStart(4);
// 길 은폐 (계절별). 고을 꼬리표: 갈대 +0.15, 안개골 봄·가을 +0.2
const roads = {
  '들길': [0.05, 0.05, 0.05, 0.05], '고갯길': [0.35, 0.35, 0.35, null], '숲길': [0.30, 0.30, 0.30, 0.30],
  '갈대물가': [0.40, 0.40, 0.40, 0.15], '나루': [0.10, null, 0.10, 0.10], '뱃길': [0.20, 0.20, 0.20, 0.20], '갯벌': [0.10, 0.10, 0.10, 0.10],
};
const SEAS = ['봄', '여름', '가을', '겨울'];
// 경계 시나리오
const guards = {
  '기본 0.10': 0.10,
  '신중 0.30': 0.30,
  '제천+수확(가을) 0.0−': 0.10 - 0.10 - 0.05,
  '말놀이최대 −0.10': 0.10 - 0.20,
  '가을 제천+수확+말놀이+술꾼': 0.10 - 0.10 - 0.05 - 0.20 - 0.10,
  '저격실패 0.35': 0.35,
  '신중+저격실패+이웃 0.65': 0.65,
};
console.log('략 차이 0 (같은 략) · 꼬리표 없음 — p_ambush %, [raw]');
console.log('길       계절 | ' + Object.keys(guards).map(g => g.slice(0, 10).padEnd(11)).join(''));
for (const [rn, cs] of Object.entries(roads)) for (let s = 0; s < 4; s++) {
  if (cs[s] === null) continue;
  const line = Object.values(guards).map(g => { const raw = cs[s] - g; const p = clamp(raw, 0.05, 0.85); return (pct(p) + (raw <= 0.05 ? '_' : raw >= 0.85 ? '^' : ' ')).padEnd(11); }).join('');
  console.log(`${rn.padEnd(7)} ${SEAS[s]}  | ${line}`);
}
console.log('  (_ = 하한 0.05 에 붙음, ^ = 상한 0.85 에 붙음)');

// MC: 무작위 상황에서 클램프에 붙는 비율. 략: 무명 2..7 균등, 명장 6..9.
// 경계 수정자: 각각 독립 확률로 켬 (가정). 길·계절·꼬리표 균등.
const rng = mulberry32(2026);
const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
let lo = 0, hi = 0, n = 0, negGuard = 0; const hist = new Array(10).fill(0);
const rn = Object.values(roads);
for (let i = 0; i < 200000; i++) {
  const road = rn[ri(0, rn.length - 1)], s = ri(0, 3); if (road[s] === null) continue;
  let conceal = road[s];
  if (rng() < 0.25) conceal += 0.15;                  // 갈대 꼬리표
  if ((s === 0 || s === 2) && rng() < 0.2) conceal += 0.2; // 안개골
  const la = rng() < 0.1 ? ri(6, 9) : ri(2, 7), ld = rng() < 0.1 ? ri(6, 9) : ri(2, 7);
  let guard = 0.10;
  if (rng() < 0.2) guard += 0.20;                    // 신중
  if (rng() < 0.15) guard += 0.15;                   // 정찰 들킴
  if (rng() < 0.10) guard += 0.25;                   // 저격 실패
  if (rng() < 0.15) guard += 0.10;                   // 이웃 기습
  if (s === 2) guard -= 0.10 + 0.05;                 // 가을: 제천 + 수확철 (가을 출정이면 늘 켜진다)
  if (rng() < 0.3) guard -= 0.05 * ri(1, 4);          // 말놀이 1~4해
  if (rng() < 0.1) guard -= 0.10;                    // 술꾼
  if (guard < 0) negGuard++;
  let trait = rng() < 0.15 ? 0.10 : 0;               // 산사람
  const raw = conceal + 0.05 * (la - ld) + trait - guard;
  n++; if (raw <= 0.05) lo++; else if (raw >= 0.85) hi++;
  hist[Math.min(9, Math.floor(clamp(raw, 0.05, 0.85) * 10))]++;
}
console.log(`\nMC 무작위 상황 N=${n}: 하한 붙음 ${(lo / n * 100).toFixed(1)}% · 상한 붙음 ${(hi / n * 100).toFixed(1)}% · 경계가 음수 ${(negGuard / n * 100).toFixed(1)}%`);
console.log('분포(10%칸): ' + hist.map((h, i) => `${i * 10}~${i * 10 + 9}:${(h / n * 100).toFixed(1)}`).join(' '));

// 략 차이가 얼마나 큰가: ±9 → ±0.45
console.log('\n략 차이의 폭: 무명끼리 최대 ±5 → ±0.25 · 명장(9) 대 무명(2) ±7 → ±0.35 · 이론 최대 ±0.45');

// PLAY §4 예: 겨울 · 갈대 나루 · 적장 신중 → 54% 가 가능한가
for (const [name, c] of [['갈대물가 겨울 0.15', 0.15], ['나루 0.10 + 갈대 꼬리표 0.15', 0.25], ['나루 + 갈대(겨울 눕기 무시) 0.25', 0.25]]) {
  const need = (0.54 - c + 0.30) / 0.05;
  console.log(`PLAY §4 "기습 54%": ${name} · 경계 0.30(신중) → 필요한 략 차이 ${need.toFixed(1)} (최대 9) ${need > 9 ? '불가능' : ''}`);
}
// 가을 갈대물가 + 갈대꼬리표 + 안개, 경계 기본·제천·수확 → 같은 략에서
console.log(`가을 갈대물가+갈대+안개, 제천+수확 경계 −0.05: raw ${(0.40 + 0.15 + 0.2 + 0.05).toFixed(2)} → 략 −1 이하로 떨어져도 0.85`);
