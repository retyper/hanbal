# 건물·이펙트 그림 빈자리 목록 (11-24 밤)

코드가 제 그림 대신 다른 것으로 때우던 자리. 장수 띠·초상·영상은 뺐다. 근거는 `파일:줄` (찾은 때 기준).

| 차례 | 항목 | 화면 | 때우던 것 | 만든 그림 | 크기 | 상태 |
|---|---|---|---|---|---|---|
| 1 | 목수 마을 아이콘 | 마을 일터 고르기·지도·한 줄 알림 | `src/realm/works.ts:42` good-wood (나무 물건) | `icon/settle-lumber.png` | 96, 투명 | 넣음 |
| 2 | 장정 마을 아이콘 | 같음 | works.ts:46 unit-spear (창 병종) | `icon/settle-yard.png` | 96, 투명 | 넣음 |
| 3 | 젓갈 창고 아이콘 | 같음 | works.ts:48 good-soybean-jar (장 항아리) | `icon/settle-jeotgal.png` | 96, 투명 | 넣음 |
| 4 | 쇠부리터 아이콘 | 같음 | works.ts:41 treasure-iron-ingots | 있던 `icon/settle-iron-town.png` 로 | 96 | 새로 안 그림 |
| 5 | 말 목장 아이콘 | 같음 | works.ts:44 good-horse | 있던 `icon/settle-horse-ranch.png` 로 | 96 | 새로 안 그림 |
| 6 | 열전 망루 | 열전 강화 칸 | `src/raid/power-ui.ts:21` 목책 판 장식 webp | `raid/prop-tower.png` | 96, 투명 | 넣음 |
| 7 | 열전 목책 | 같음 | power-ui.ts:21 palisade-0.webp | `raid/prop-fence.png` | 96, 투명 | 넣음 |
| 8 | 열전 우물 | 같음 | power-ui.ts:23 shop-regen (회복 상점 그림) | `raid/prop-well.png` | 96, 투명 | 넣음 |
| 9 | 열전 포차 | 같음 | power-ui.ts:23 boulder (바위) | `raid/prop-catapult.png` | 96, 투명 | 넣음 |
| 10 | 열전 화력 | 같음 | power-ui.ts:25 arrow + 불빛 tint | `raid/prop-firepower.png` | 96, 투명 | 넣음 |
| 11 | 열전 장전 | 같음 | power-ui.ts:25 shop-haste | `raid/prop-reload.png` | 96, 투명 | 넣음 |

## 남긴 것 (까닭)
- 열전 오라 `src/raid/fx-aura.ts:32` 선·점 대체: 불꽃 가닥·불티·고리는 이미 `fx/` 그림이 있고, 없을 때만 선으로 그리는 헤드리스 길이라 빈자리가 아니다.
- 열전 바닥 `wide-view.ts:48`: 다섯 스테이지 모두 `raid/ground-*.webp` 가 있다. 민무늬 색은 로딩 폴백.
- 이기는 법 `howwin.ts:185`: `howwin/howwin-*.jpg` 아홉 장이 모두 있어 사건 그림은 폴백. 건물·이펙트가 아니다.
- 열전 설치 장독 `jar`(power-ui.ts:21)·장승·솟대·봉수: 본편 아이콘 그림이 이미 맞는 물건이다.
- 아직 안 본 곳: 지도 고을 기호 전부, 궁궐 `palace-hall-*`, 성문 `fx/woo-gate-*` 의 단별 빠진 것은 이번에 하나씩 대조하지 않았다.
