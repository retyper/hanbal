# 삼로 단궁 비각성 전투 애니메이션 (11-08 Claude)

- 게임 ID `haseulla-ruler`, 초상 `w-51-haseulla-dangung`, 여성 26세, 활. 띠 `public/realm/anim2/gen-dangung.png` 280×160×20, `GEN_ANIM.dangung` ar 1.75 / body .9375 / bow, 화살 나가는 점 frame 14 (200, 45).
- 원본(assets_src/realm/gemini/battle): `dangung-actions-source.png`(u/0 첫 판 · 16:9 로 나와 사람이 겹치고 무릎에서 잘려 버림) → 같은 대화에서 1:1 로 고쳐 `dangung-actions2-source.png`(준비·만작·발사·피격 · 칸 선은 지움) · 쓰러짐은 새 대화 `dangung-fall2-source.png`. 대화 u/0 `1b09322d2ac3d572` · `5593e1d0ec14bcbf`.
- 대기는 Codex 11-07 정지 후보, 걷기는 갯내 4실보행 하체(밝은 회녹 바지를 단궁의 짙은 바지 빛으로) 위에 단궁 상체(y≤100). 그래서 **걷는 동안 긴 두루마기가 무릎 위로 짧아진다** — 형이 거슬리면 치마/두루마기 하체를 따로 받아야 한다(이랑 HOLD 와 같은 문제).
- 피격은 준비 컷과 같은 배율로 줄였다(150 에 맞추면 웅크린 몸이 크게 보였다). 키잉은 자홍 기운 픽셀을 걷고 1px 깎아 분홍 테를 없앴다. `dangung/dangung-rig.py`.
- 검수: 20셀 · 걷기 1/5 반대 다리 · 활은 늘 보는 쪽 손 · 실제 전투 재생은 미검수.
