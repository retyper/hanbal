# 조의 활미 비각성 전투 애니메이션 (11-08 Claude)

- 게임 ID `goguryeo-2`, 초상 `w-65-goguryeo-hwalmi`(형이 11-07 고친 것 · 이마 점 없음 · 빨간 머리띠·깃털 둘), 여성 26세, 활. 띠 `public/realm/anim2/gen-hwalmi.png` 280×160×20, `GEN_ANIM.hwalmi` ar 1.75 / body .9375 / bow, 화살 나가는 점 frame 14 (204, 50).
- 원본(assets_src/realm/gemini/battle): `hwalmi-actions-source.png`(u/0 새 대화 · 2×2 준비·만작·발사 + 넷째는 뒷모습 과녁이라 버림) · `hwalmi-hitfall-source.png`(같은 대화 · 왼위 피격만 씀 · 쓰러짐은 선 사람과 겹쳐 버림) · `hwalmi-fall2-source.png`(새 대화 · 누운 한 사람만 · 성공). 대화 u/0 `eecc54814da9afed` · `af4cedd0676622df`.
- 대기는 Codex 11-07 정지 후보(`hwalmi-idle-source.png`) · 걷기는 갯내 4실보행 하체(바지색 그대로 · 같은 짙은 바지·갈색 장화) 위에 활미 상체(y≤100 · 활 아래 가지 포함) · 공격 12·13 준비, 14 만작(화살촉 x204), 15·16 발사, 17 대기 · 18 피격 · 19 쓰러짐(몸+떨어진 활 한 덩어리를 폭 165 로).
- 키잉은 그림마다 테두리 중앙값 바탕색으로(활미 정지 후보는 바탕이 순수 자홍이 아니라 처음엔 보라 네모가 남았다) · `hwalmi/hwalmi-rig.py`.
- 검수: 20셀 · 가장자리 4px 안 · 걷기 1/5 반대 다리 · 활은 늘 왼손(보는 쪽 손) · review `hwalmi/hwalmi-battle-20cell-review.png`. 실제 전투 재생은 미검수.
