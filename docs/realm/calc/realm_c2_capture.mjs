// 검산 2: 생포 (SYSTEMS §4-3 표, §5-3, §5-5, §5-9) — 결정론 시드 RNG
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pct = x => (x * 100).toFixed(1).padStart(5);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// 승리 조건부 생포 확률: 대승 비중 = 0.35 (r<0.35P 이므로 승리 중 35%)
function capGivenWin(bonus) { return 0.35 * clamp(0.40 + bonus, 0, 0.9) + 0.65 * clamp(0.20 + bonus, 0, 0.9); }
const rows = {
  '맨손': 0, '기습성공(+.10)': 0.10, '다리(+.35)': 0.35, '다리+기습': 0.45, '다리+퇴로': 0.55,
  '다리+기습+퇴로': 0.65, '몸통+기습+퇴로': 0.45, '퇴로만': 0.20, '다리+날랜발': 0.20, '다리+기습+퇴로−기병': 0.55,
};
console.log('조합                 | 대승시  승시   | 승리 조건부 | 전사와의 합(대승) ');
for (const [n, b] of Object.entries(rows)) {
  const a = clamp(0.40 + b, 0, 0.9), w = clamp(0.20 + b, 0, 0.9);
  console.log(`${n.padEnd(20)} | ${pct(a)}  ${pct(w)} |   ${pct(capGivenWin(b))}    | 생포 ${pct(a)} + 전사 15 = ${pct(a + 0.15)}`);
}

// 첫 판 40계절 수집 몬테카를로
// 가정 (문서에 없음 → 명시): 판당 전투 B회, 각 전투 승률 W, 저격 다리 명중 확률 hLeg (직접 쏜 판 + 맡김 p_auto),
// 기습 성공률 pAmb, 퇴로차단 확률 pCut. 회유: 귀순 .70 · 거짓귀순 .10 · 탈출 .15 · 자결 .05.
// 발견: 처음 여는 고을 정찰 S회 × 떠돌이 장수 12% (회유 성공 가정 0.8). 튜토리얼 첫 회유 1명 확정.
function run(seed, { B, W, hLeg, pAmb, pCut, S }) {
  const rng = mulberry32(seed);
  let gen = 1; // 튜토리얼 귀순 (PLAY §1)
  let fake = 0, caps = 0;
  for (let i = 0; i < B; i++) {
    if (rng() >= W) continue;
    let bonus = 0;
    if (rng() < pAmb) bonus += 0.10;
    if (rng() < hLeg) bonus += 0.35;
    if (rng() < pCut) bonus += 0.20;
    const big = rng() < 0.35;
    if (rng() < clamp((big ? 0.40 : 0.20) + bonus, 0, 0.9)) {
      caps++;
      const r = rng();
      if (r < 0.70) gen++; else if (r < 0.80) { gen++; fake++; }
    }
  }
  for (let i = 0; i < S; i++) if (rng() < 0.12 && rng() < 0.8) gen++;
  return { gen, fake, caps };
}
const N = 20000;
const q = (arr, p) => arr[Math.floor(p * (arr.length - 1))];
console.log('\n첫 판 40계절 — 거느리게 되는 장수 수 (MC N=20000, 시드 고정)');
console.log('봇        전투B 승률W 다리명중 기습 퇴로 정찰S | 생포 평균 | 장수 p10/p50/p90 | 덕3·덕5·덕7 상한(9·15·21) 넘는 판 %');
const bots = {
  '무모':     { B: 12, W: 0.50, hLeg: 0.0, pAmb: 0.2, pCut: 0.0, S: 6 },
  '신중':     { B: 10, W: 0.70, hLeg: 0.2, pAmb: 0.5, pCut: 0.1, S: 12 },
  '수집가':   { B: 12, W: 0.60, hLeg: 0.5, pAmb: 0.5, pCut: 0.3, S: 10 },
  '수집가+':  { B: 18, W: 0.65, hLeg: 0.6, pAmb: 0.6, pCut: 0.4, S: 14 },
  '전투多':   { B: 24, W: 0.65, hLeg: 0.4, pAmb: 0.5, pCut: 0.3, S: 14 },
};
let seed = 12345;
for (const [n, cfg] of Object.entries(bots)) {
  const g = [], c = [];
  for (let i = 0; i < N; i++) { const r = run(seed + i, cfg); g.push(r.gen); c.push(r.caps); }
  g.sort((a, b) => a - b);
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const over = cap => pct(g.filter(x => x > cap).length / N);
  console.log(`${n.padEnd(8)} ${String(cfg.B).padStart(4)} ${cfg.W.toFixed(2)}  ${cfg.hLeg.toFixed(1)}    ${cfg.pAmb} ${cfg.pCut}  ${String(cfg.S).padStart(3)}  | ${mean(c).toFixed(1).padStart(5)}    | ${q(g, .1)}/${q(g, .5)}/${q(g, .9)}            | ${over(9)} ${over(15)} ${over(21)}`);
  seed += N;
}

// 충성 상한 벌점 크기: 장수 n, 군장 덕 d → 계절마다 각 장수 −(n−3d)
console.log('\n충성 상한 벌점: 장수 수 n, 군장 덕 d → 계절당 −max(0, n−3d)');
for (const d of [3, 4, 5, 7]) console.log(`덕 ${d}: 상한 ${3 * d} · n=8 → ${Math.max(0, 8 - 3 * d)} · n=12 → ${Math.max(0, 12 - 3 * d)} · n=16 → ${Math.max(0, 16 - 3 * d)}`);
