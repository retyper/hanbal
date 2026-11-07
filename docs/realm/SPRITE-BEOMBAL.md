# 살해 범발 비각성 전투 애니메이션 (11-08 Claude)

- 게임 ID `maek-1`, 초상 `w-68-maek-beombal`, 여성 24세. 오른손 단검 찌르기. 띠 `public/realm/anim2/gen-beombal.png` 280×160×20, `GEN_ANIM.beombal` ar 1.75 / body .9375, 타격점 frame 14 (248, 51).
- 셀은 전부 Codex 가 11-07 에 정규화해 둔 것(`work/beombal-rig-*.png`): 대기 160 · 갯내 4실보행 하체에 범발 상체(바지색만 보정) · 준비/찌르기/피격 280. 쓰러짐은 `beombal-actions-source.png` 우하단 네 번째 컴포넌트를 준비 컷과 같은 배율(0.3247)로 줄여 넣었다(장화가 칸 선을 넘었을 뿐 사람과 겹치지 않아 컴포넌트로 통째 분리됨). 조립 `work/beombal-battle-pack.py`.
- Codex 의 HOLD 사유였던 「뺨 줄무늬가 반대쪽」은 잘못 읽은 것으로 판단: 원초상(정면)은 인물의 왼뺨(화면 오른쪽)에 줄무늬. 오른쪽을 보는 3/4 측면 띠에서 보이는 뺨은 인물의 왼뺨이므로 같은 쪽이다. 정체성 불일치 아님.
- 검수: 20셀 · 가장자리 4px 안 · 걷기 1/5 반대 다리(갯내 하체) · 같은 손 단검 유지 · review `outputs/beombal-base-battle-20cell-review.png`. 실제 전투 재생은 미검수.
