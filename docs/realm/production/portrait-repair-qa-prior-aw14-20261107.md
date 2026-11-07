# 선수령 각성14개 기본 비교 QA + 박달·활미 Veo 초안

2026-11-07. **14개 모두 기본비교 PASS, 명확한 신규 손·무기 오류로 지정한 HOLD는0개**다. 이는 아래 OLD/NEW 비교판에서 얼굴/복장/손·소품의 주요 관계를 확인한 판정이다. w57/w65만 새1254px 원본을 개별 확대 확인했다. 나머지12개의 모든 손가락·활시위 접점을 원본 배율로 상세 검수했다고 주장하지 않는다. 이번 범위는 선수령 각성14개이며 전체28개 일괄 승인/적용 판정이 아니다.

기준 비교판 `outputs/portrait-repair-review-prior-aw14-1.jpg`·`-2.jpg`, 상세파일/ID/단계/수령SHA는 `outputs/portrait-repair-receipt-20261107.json`. **w54/w57/w62/w65의 사용자 포즈변경을 인정**하며 옛 포즈 보존을 요구하지 않는다. 게임/canonical 교체·deferral 개별 해제·Veo 제출은 root 담당이고 이 문서 작성자는 브라우저·게임·queue/state·Git을 변경하지 않았다.

## 개별 기본비교

| ID | 신규 파일(public/realm/) | 판정 | 직접 비교한 핵심 |
|---|---|---|---|
| w101 신귀간 | w101awrere.png | PASS(기본비교) | 얼굴/조개 장식/치켜든 손과 물빛 구체 관계 유지, 명확한 새 손 분기 없음 |
| w47 바람 | w47awrere.png | PASS(기본비교) | 얼굴/털깃/전방 손·검·새 형상 관계 유지 |
| w54 달리 | w54awrere.png | PASS(기본비교) | 활 당김에서 등 뒤 활의 휴식으로 변경 인정. 옛 만작 손 자세 요구 안 함 |
| w57 박달 | w57awrere.png | PASS(기본비교+원본 상세) | 활을 등 뒤로 옮긴 휴식 인정. 새 원본 양손은 원래 화면 밖, 등 장비 안정 |
| w62 별 | w62awrere.png | PASS(기본비교) | 아래쪽 작업물을 다루는 집게 자세 변경 인정. 집게 파지와 작업물 방향이 이어짐 |
| w65 활미 | w65awrere.png | PASS(기본비교+원본 상세) | 만작에서 세운 활 휴식으로 변경 인정. 한 손의 활자루 파지와 다른 팔의 화면 밖 연결 양호 |
| w66 사로 노을 | w66awrere.png | PASS(기본비교) | 얼굴/주황 복장/당긴 활과 양손의 큰 관계 유지. g66과 혼동 안 함 |
| w74 독무덤 | w74awrere.png | PASS(기본비교) | 얼굴/털깃/거울 목걸이/항아리 입구에 놓인 손의 관계 유지 |
| w78 완 | w78awrere.png | PASS(기본비교) | 얼굴/초록 옷/활을 잡은 손과 화살 손의 큰 관계 유지 |
| w80 강치 | w80awrere.png | PASS(기본비교) | 웃는 얼굴/검은 가죽/비껴 든 작살과 두 팔의 큰 관계 유지 |
| w82 곰 | w82awrere.png | PASS(기본비교) | 웃는 얼굴/곰털/어깨 위 곤봉 파지 관계 유지 |
| l6 정견모주 | l6awrere.png | PASS(기본비교) | 얼굴/초록 복장/펼친 전방 손과 빛 관계 유지 |
| w10 너울 | w10awrere.png | PASS(기본비교) | 얼굴/검은 복장/머리 위 작살과 반대 손 관계 유지 |
| w40 무늬 | w40awrere.png | PASS(기본비교) | 얼굴/문신/양팔 방울·띠 관계 유지. 원본 밖 손을 새로 드러내도록 요구 안 함 |

명확한 새 오류만 HOLD한다는 이번 기준에 따라 판정했다. **w54 기존 held 영상은 자동 재생성하지 않는다. w62 기존 accepted 영상도 자동 재생성하지 않으며**, 새 정지 원본과 옛 영상의 시작 자세/소품 호환은 별도 통합 판단이다. 기본비교 PASS가 이 두 영상의 교체 승인이 아니다.

## 박달 w57 상세와 미시도 대조

- 정확 portrait `w-57-bullae-bakdal`, hero `bullae-ruler`,28세 여성.
- 수령 새원본 `D:/flutter/arrow_game_one/public/realm/w57awrere.png`,1254×1254,1차각성 교정본. SHA256 `f63889bcab6206f3f6264c0b2726a2503ff2785c3dd9687078ca5afb9de324bc`를 실제 파일 해시와 대조했다.
- 원본은 부드럽고 절제된 표정, 굵은 땋은머리, 호랑이털, 황갈색/청동 갑옷, 이빨/곡옥이 유지된다. **양손은 현재 그림에 보이지 않는다.** 활/활시위와 화살통은 어깨 뒤에 고정되며 손에 들린 활이 아니다. 손/활 융합이나 새 손 분기를 보지 못했다. 가려진 손을 새로 만들거나 옛 정면 활을 되살리지 않는다.
- 현재 live queue job0·state attempt0, T1 AWAKEN_LOOP 미등록을 직접 대조했다. 첫 영상 생성/대기 근거 없음.25교정대기의 기존 차단은 root가 새 canonical 적용/해시 확인 뒤 **개별 해제**하며 이 문서만으로 해제하지 않는다.
- 손이 원래 없고 얼굴/몸통이 가까이 모여 머리~골반9:16 근접 구도의 유력 후보다. 외측 털·장비 끝 크롭은 허용한다. 제출 전 root가 실제 새 canonical과 이 문안을 연결한다.

### 박달 새 휴식 자세 전용 초안

문안 SHA256(아래 본문 UTF-8, 끝LF1개): `f3caaf030ae0a60150d7b77939eab7d8d300e1ae57ef540c2ad8683fca82d353`.

```text
Create one 10-second, 9:16 living portrait from the attached corrected FIRST-awakening painting of Samno Bakdal, a fictional adult woman of 28 from a Korean historical fantasy game. This is a quiet mountain-path guardian taking a poised pause before guiding the next journey. Begin in this exact new resting pose. Her bow and quiver are secured behind her shoulders. Neither hand is visible in this painting; keep both hands unseen and preserve the arms continuing naturally beyond the image boundaries. Do not recreate a bow held in front of her.

Preserve her exact face, reserved faint smile, thick dark braid, tiger-pelt mantle, ochre and bronze fitted armor, tooth necklace, jade ornaments and red waist cord. Keep the stowed bow, string and quiver coherent and secured behind her. No new weapon, hand, fingers or hand-held object.

Fill a locked vertical head-to-pelvis portrait with the woman. Keep her face, braid and upper body large; outer fur, sleeves and the far tips of the stowed equipment may crop naturally. No square inset, blurred bars, distant full-body shot, camera move or new entrance.

Her single purposeful action is a small attentive settling into her resting stance: a gentle transfer of weight, slight connected shoulder and upper-torso adjustment, then composed readiness. Her gaze stays calmly watchful with one natural blink. Keep the faint original smile without a laugh, a head turn, a step or a repeated routine.

Show a slow, clearly readable natural breath through the ribcage, upper chest, shoulders and fitted clothing rising and releasing together. The ochre fabric, loose braid strands, fur and hanging jade follow a little later and gradually settle. The rigid armor keeps its shape. Use restrained body-and-cloth motion without exaggerated bouncing or large sideways swaying. Soft mountain wind and faint cloth or fur rustle only; no speech, music, gasp or loud detached breath.

All 10 seconds are one uninterrupted continuous take, with smooth adjacent frames and consistent face, body scale, costume and stowed equipment. No cut, hidden splice, freeze, pose or lighting reset, hand appearing, equipment teleport, body rotation or instant jump to the first pose. End naturally. Natural motion and character consistency matter more than a perfect loop. No text or captions.
```

## 활미 w65 상세와 미시도 대조

- 정확 portrait `w-65-goguryeo-hwalmi`, hero `goguryeo-2`,26세 여성.
- 수령 새원본 `D:/flutter/arrow_game_one/public/realm/w65awrere.png`,1254×1254,1차각성 교정본. SHA256 `4486f2639379024d2741ad65e2d5a136b26d7750d0a4e158eda10b316f5b1c27`를 실제 파일 해시와 대조했다.
- 두 깃/붉은 머리끈, 위쪽 먼 곳을 보는 얼굴, 점무늬 흰옷/청동 어깨갑/붉은 띠가 유지된다. **화면 오른쪽 한 손이 세운 활의 자루를 쥐며 화살을 걸거나 시위를 당기지 않는다.** 엄지와 말린 손가락들이 자루에 이어지고 명확한 추가 손가락/끊긴 자루는 보이지 않는다. 반대 손은 원본 밖에 있으므로 새로 노출하지 않는다. 전면 이마에 새 붉은 점도 보이지 않는다.
- 현재 live queue job0·state attempt0, T1 AWAKEN_LOOP 미등록을 직접 대조했다. 첫 영상 생성/대기 근거 없음. 기존 교정 차단은 root가 새 canonical/해시로 개별 해제한다.
- **구도 주의:** 얼굴과 활손이 좌우로 떨어져 있어 박달보다9:16 배치가 어렵다. 얼굴 전체/활 파지손 전체를 크게 유지하는 실제 세로 프리뷰를 root가 확인해야 한다. 머리 깃·활의 먼 끝/외측 팔꿈치 일부는 자연스럽게 잘라도 되지만 파지손을 잘라서는 안 된다. 문안은 소품을 흔들거나 손을 옮기지 않는 휴식 전용이다. 이 초안은 root 독립 구도 승인 전 자동 제출 대상이 아니다.

### 활미 새 세운 활 휴식 자세 전용 초안

문안 SHA256(아래 본문 UTF-8, 끝LF1개): `cfe4546474652ec656e294485bc452561f9587dd8a6419e9c8e8244b923cf117`.

```text
Create one 10-second, 9:16 living portrait from the attached corrected FIRST-awakening painting of Jo-ui Hwalmi, a fictional adult woman of 26 from a Korean historical fantasy game. She is an alert archer resting with her bow held upright while watching the distant ridge. Start in this exact new relaxed-bow pose, with her gaze directed slightly upward as in the painting. She is NOT drawing, aiming or nocking an arrow.

Preserve her exact face, feather ornaments, red hair tie, dark hair, spotted white wrapped clothing, bronze shoulder armor, red sash and jade ornaments. The existing hand at SCREEN RIGHT holds the same upright decorated bow by the same handle with the same visible fingers. Keep that grip connected throughout. The bowstring remains at rest and separate from the hand where shown. Her other hand is not visible: keep it unseen. No arrow in a hand, new fingers, second bow, new forehead mark or change of weapon ownership.

Use one locked close vertical head-to-pelvis composition that keeps her WHOLE face and the COMPLETE bow-gripping hand with every visible fingertip inside the frame throughout. Position the framing to include both rather than centering the face alone. Outer feathers, far bow tips, trailing cloth and outer elbow may crop naturally. No square inset, blurred bars, distant full-body view, camera move or zoom.

Her one purposeful action is a gentle balancing adjustment during her watch: she settles a little weight into her resting stance, lets her upper torso and shoulders soften slightly, then holds alert readiness. Her grip and the upright bow stay steady; she does not lift, swing, bend or draw the bow. Keep the existing distant gaze and restrained expression alive with a natural blink. No smile routine, laugh, step or body turn.

Make a slow natural breath clearly readable through the ribcage, upper chest, shoulders and patterned white fabric rising and releasing together. Cloth and the red sash follow the torso a little later, then hair, feathers and jade ornaments settle gently. Rigid armor and bow keep their shapes. Use natural body-and-cloth response without exaggerated bouncing or large sideways swaying. Faint ridge wind and cloth rustle only; no speech, music, gasping or loud detached breath sounds.

Keep the entire 10 seconds one uninterrupted continuous take with smooth neighboring frames and consistent face, hand grip, bow, costume and scale. No cut, hidden splice, freeze, pose, face or lighting reset, extra hand, bow passing through the body or instant return to the first frame. End naturally. Complete visible hands and natural motion quality matter more than a perfect loop. No text or captions.
```

## 제출 전 인수인계

root가 새 교정 canonical을 적용한 뒤 **수령PNG SHA와 실제 제출canonical SHA를 따로 기록**하고 두 문안을 각 새 해시에 연결한다. 기존 public HD의 옛 해시를 새 그림의 입력 해시로 쓰지 않는다. 박달/활미는 실제 첫편의 결과를 검수하기 전 성공으로 기록하지 않는다. 두 초안의 실제 출력/소리는 아직 미검수이며, 교정 차단 해제나 계정 제출 권한을 이 문서가 자동 변경하지 않는다.
