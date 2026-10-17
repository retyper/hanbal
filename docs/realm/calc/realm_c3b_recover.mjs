// 검산 3 보충: 창고>0 인 계절에 민심 +rec 회복(가정) 을 넣고 같은 MC
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function wx(r) { const u = r(); return u < 0.15 ? 1.3 : u < 0.70 ? 1.0 : u < 0.90 ? 0.7 : 0.5; }
function sim(seed, t, hb, rec, S0 = 150) {
  const rng = mulberry32(seed); let stock = S0, mood = 60, low = 0, empty = 0;
  for (let s = 0; s < 40; s++) {
    const se = s % 4; if (se === 2) stock += hb * wx(rng) * (1 - t);
    stock -= 150 * (se === 3 ? 1.5 : 1);
    if (stock <= 0) { stock = 0; mood -= 10; empty++; } else mood = Math.min(100, mood + rec);
    low = mood < 20 ? low + 1 : 0; if (low >= 2) return [s + 1, empty];
  }
  return [null, empty];
}
console.log('해석  세율  회복/계절 | 40계절 내 "왕을 바꾸자" % · 중앙 계절 · 창고 0 계절 평균');
for (const hb of [816, 960]) for (const t of [0.1, 0.2, 0.35]) for (const rec of [2, 5]) {
  let hits = [], em = 0; const N = 5000;
  for (let i = 0; i < N; i++) { const [r, e] = sim(999 + i, t, hb, rec); em += e; if (r) hits.push(r); }
  hits.sort((a, b) => a - b);
  console.log(`${hb}  ${t.toFixed(2)}   +${rec}       | ${(hits.length / N * 100).toFixed(1).padStart(5)}% · ${hits.length ? hits[hits.length >> 1] : '-'} · ${(em / N).toFixed(1)}`);
}
