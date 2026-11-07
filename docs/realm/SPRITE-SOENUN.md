# 관나 쇠눈 비각성 전투 애니메이션 (11-08 Claude)

- 게임 ID `gwanna-2`, 초상 `w-42-gwanna-soenun`, 여성 27세, 양손 긴 창. 띠 `public/realm/anim2/gen-soenun.png` 280×160×20, `GEN_ANIM.soenun` ar 1.75 / body .9375, 창끝 접촉 frame 14 (267, 54).
- 원본(assets_src/realm/gemini/battle): `soenun-actions-source.png`(u/2 새 대화 한 번 · 1:1 · 겨눔·찌르기·거둠·피격 · 옅은 칸 선은 지움) · `soenun-fall2-source.png`(u/2 새 대화 · 누운 몸과 떨어진 창). 대화 u/2 `222003acf6808775` · `e11f21bac31ad74c`.
- 대기는 Codex 11-07 `soenun-ready-final-candidate.png`, 걷기는 갯내 4실보행 하체(바지 빛 짙게) 위에 쇠눈 상체(y≤100) + 몸 왼쪽 아래로 내려온 창 자루(x<64)를 남겼다. **걷는 동안 쇠 정강이받이가 장화로 보인다.**
- 동작 셀은 모두 준비 컷과 같은 배율(찌르기·거둠·피격). 11-08 단궁 피격이 세로로 늘어나 있던 버그(높이를 150 에 고정)도 같이 고쳐 다시 묶었다.
- 검수: 20셀 · 걷기 1/5 반대 다리 · 창은 늘 두 손 · 실제 전투 재생은 미검수. 구름 w-49 는 발끝까지 내려오는 흰 비단 치마라 바지 하체를 못 쓴다 — 이랑과 같은 이유로 HOLD.
