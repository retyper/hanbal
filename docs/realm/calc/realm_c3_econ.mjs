// 검산 3: 경제 SYSTEMS §7-6, §4-4, §7-4
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const H = 600, farm = 0.8, f = x => x.toFixed(1).padStart(7);
const eatYear = H * 0.25 * (3 + 1.5); // 겨울 1.5배 포함
console.log(`한 해 먹는 것: 문서 600 · 겨울 1.5배 넣으면 ${eatYear}`);

// 수확: 일손 = H(1-징발). 해석 X = 문서의 816 (봄 일손에서도 0.15 를 뺌), Y = 농한기만이면 봄 일손은 온전 (960)
const cases = { 'X 농한기(문서 816)': H * 0.85 * farm * 2, 'Y 농한기(봄 온전)': H * farm * 2, '언제나 0.30': H * 0.70 * farm * 2 };
console.log('\n수확 해석          수확  | 세율  국읍세   백성몫   백성잉여(먹는것675) | 손익분기 날씨');
for (const [n, h] of Object.entries(cases)) for (const t of [0.1, 0.2, 0.35]) {
  const tax = h * t, ppl = h - tax;
  console.log(`${n.padEnd(18)} ${f(h)} | ${t.toFixed(2)} ${f(tax)} ${f(ppl)}  ${f(ppl - eatYear)}            | ${(eatYear / (h * (1 - t))).toFixed(3)}`);
}

// 병력과 군량
console.log('\n병력 상한 / 군량 (N×0.01/계절, 겨울 1.5) / 국읍 세 수입으로 몇 계절 출정?');
for (const [n, rate] of [['농한기', 0.15], ['언제나', 0.30]]) {
  const N = H * rate, perYear = N * 0.01 * 4.5;
  for (const t of [0.1, 0.2, 0.35]) {
    const h = rate === 0.15 ? H * 0.85 * farm * 2 : H * 0.70 * farm * 2;
    const tax = h * t;
    console.log(`${n} N=${N}  계절 군량 ${(N * 0.01).toFixed(2)} (겨울 ${(N * 0.015).toFixed(2)}) · 세 ${t}: 세수 ${tax.toFixed(0)} → 쉬지 않고 출정 ${(tax / (N * 0.01 * 1.125)).toFixed(0)} 계절분`);
  }
}
console.log(`비교: 백성 한 가호는 계절 0.25, 병사 하나는 0.01 — 병사가 ${(0.25 / 0.01)}배 덜 먹는다`);

// 민심 붕괴까지: 계절 시뮬. 봄 시작. 가을에 수확(백성몫)이 고을 창고에. 창고 0 이면 민심 −10/계절.
// 세 자체의 민심 효과는 문서에 수치가 없음 → 가정 heavyPenalty (무겁게 −2/계절, 보통 0, 가볍게 +1) 를 따로 켬.
// 날씨: 가정 분포 (풍년 1.3 15% · 보통 1.0 55% · 가뭄 0.7 20% · 큰가뭄 0.5 10%) — 평균 0.955
function wx(r) { const u = r(); return u < 0.15 ? 1.3 : u < 0.70 ? 1.0 : u < 0.90 ? 0.7 : 0.5; }
function sim(seed, { t, harvestBase, S0, M0, taxMood }) {
  const rng = mulberry32(seed);
  let stock = S0, mood = M0, low = 0;
  for (let s = 0; s < 40; s++) {
    const season = s % 4; // 0봄 1여름 2가을 3겨울
    if (season === 2) stock += harvestBase * wx(rng) * (1 - t);
    stock -= H * 0.25 * (season === 3 ? 1.5 : 1);
    if (stock <= 0) { stock = 0; mood -= 10; }
    mood += taxMood; mood = Math.max(0, Math.min(100, mood));
    low = mood < 20 ? low + 1 : 0;
    if (low >= 2) return s + 1;
  }
  return null;
}
console.log('\n"왕을 바꾸자"(민심<20 두 계절)가 뜨는 계절 — MC N=5000 · 시작 민심 60 · 날씨 가정 분포');
console.log('수확해석  세율 시작창고 세민심 | 40계절 안에 뜨는 비율 · 중앙 계절');
for (const [hn, hb] of [['X816', 816], ['Y960', 960]]) for (const t of [0.1, 0.2, 0.35]) for (const S0 of [0, 300]) for (const tm of [0, -2]) {
  if (t !== 0.35 && tm !== 0) continue;
  const res = [];
  for (let i = 0; i < 5000; i++) res.push(sim(777 + i, { t, harvestBase: hb, S0, M0: 60, taxMood: tm }));
  const hit = res.filter(x => x !== null).sort((a, b) => a - b);
  console.log(`${hn}  ${t.toFixed(2)}  ${String(S0).padStart(4)}   ${String(tm).padStart(3)}  | ${(hit.length / 50).toFixed(1).padStart(5)}% · 중앙 ${hit.length ? hit[Math.floor(hit.length / 2)] : '-'}`);
}
// 날씨 고정 1.0 결정론 트랙: 무겁게, X816, 시작창고 300
{
  let stock = 300, mood = 60, out = [];
  for (let s = 0; s < 16; s++) {
    const season = s % 4; if (season === 2) stock += 816 * 0.65;
    stock -= 150 * (season === 3 ? 1.5 : 1); if (stock <= 0) { stock = 0; mood -= 10; }
    out.push(`${s + 1}:${stock.toFixed(0)}/${mood}`);
  }
  console.log('\n무겁게·X816·창고300·민심60·날씨1.0 트랙 (계절:창고/민심): ' + out.join(' '));
}
