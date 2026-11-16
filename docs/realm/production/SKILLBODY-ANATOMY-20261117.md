# 비기 전신 해부·그림체 검수 · 2026-11-17 밤 (Claude)

형: 「니가 알아서 해부학적으로 문제없는지도 검수해서 재생성 교체 명령 넣어봐」 · 「각성·진각성 비기도 문제 있는 것들, 그림체 어긋난 것들 검수해서 재생성」 · 「각성부터는 여장수의 경우 원본만큼이나 노출 높아야 함」

## 센 것

| 묶음 | 본 장 | 다시 | 무엇 |
|---|---|---|---|
| 비각성 (`skill-body/<id>.jpg`, v2 넣은 24장은 v2로 · w-21·w-25 는 에셋창고 v2로) | 184 | 12 | 무기가 초상과 다름 12 |
| 비각성 v2 아직 안 온 것 | 24 | - | 코덱스가 굽는 중 · 받으면 따로 봄 |
| 1차 각성 (`skill-body/aw1/`) | 220 | 23 | 밋밋한 선 자세 10 · 노출 줄어듦 11 · 무기 1 · 얼굴 1 · 그림체 1 (겹침 있음) |
| 진각성 (`skill-body/aw2/`) | 220 | 24 | 노출 줄어듦 21 · 무기 3 · 밋밋 1 · 그림체 1 (겹침 있음) |

- 보는 법: 한 판에 6명(전신 400px + 그 초상), 손이 수상하면 원본 확대. 활은 모두 원본으로 시위를 봤다.
- 손가락·팔·발목 꺾임은 세 묶음 모두 뚜렷한 것이 없었다. 비각성은 형이 이미 손·팔로 51장을 걸러 낸 판이라 남은 것이 깨끗하다.
- 비각성 12장은 모두 `tools/sprite-kit/weapon-audit-20261116.json` 이 이미 짚은 「초상 무기 ≠ 비기 전신 무기」. 지금 전투 띠 무기와는 맞을 수 있으니, 형이 띠 무기를 그대로 두기로 했으면 이 12장은 빼면 된다.
- 각성·진각성 다시 그리기는 비각성 v2 틀(`bodyV2`)을 그대로 쓴다: 초상 그림체·나이 잠금, 무기마다 움직이는 자세, 인물 80% 이상, 빈손은 몸 앞, 여인은 「초상만큼 드러나게 · 천 덧대지 말 것 · 비침·유두 윤곽은 금지」.
- 결과 원장: `tools/out/skillbody-anatomy-audit-20261117.json` ({ set, id, verdict ok|redo|pending, kind, problem, ko })
- 뺀 것: 진각성 g-78 알평의 「깃털 손도끼가 지팡이로」는 진각성 초상이 무기 머리를 잘라 근거가 없어 ok 로 둠 (1차 각성 원화도 깃털 지팡이).

## 줄에 올린 것 (tools/release-jobs.mjs · `node tools/release-pack.mjs` → tools/out/gpt-queue/QUEUE.md 22~79번)

- 비각성 12: `SB-<id>-v2` → `D:/에셋창고/skillbody_<id>_v2.png` · 넣기 `py -3 -I tools/skillbody-v2-intake.py` (지금 v2 와 같은 길)
- 1차 각성 23: `SB1-<id>-v2` → `skillbody_aw1_<id>_v2.png` · 여인 먼저
- 진각성 24: `SB2-<id>-v2` → `skillbody_aw2_<id>_v2.png` · 여인 먼저
- 각성 둘 넣기: `py -3 -I tools/skillbody-aw-v2-intake.py` (`--dry` 로 먼저 보기) → `skill-body/aw1|aw2/<id>.jpg` 800×1200 남색 판 · 옛 것 `assets_src/realm/retired/skill-body-aw1-v1/`·`-aw2-v1/` · 윗몸 컷 다시 굽기
- 참고 그림: IMAGE 1 = 그 단계 초상(bust-hd / awaken-hd / awaken2-hd) · IMAGE 2 = 반려된 지금 컷

## 다시 그릴 것

| 묶음 | id | 무엇 | 메모 |
|---|---|---|---|
| base | g-100-buyeo-old-daeso | weapon | 금 홀 · 초상은 금손잡이 채찍 |
| base | g-38-chopal-palmae | weapon | 창을 듦 · 초상은 돌팔매 |
| base | g-45-dabeol-deulgae | weapon | 몽둥이 · 칼이어야(각성과 같게) |
| base | g-60-golbeol-golgae | weapon | 짧은 칼 · 쇠망치여야 |
| base | g-65-goguryeo-damul | weapon | 활 · 칼이어야 |
| base | g-66-geonma-malbalgup | weapon | 창 · 칼이어야 |
| base | g-86-mokji-geumbawi | weapon | 몽둥이 · 초상은 칼 |
| base | w-01-silla-princess | weapon | 칼 · 부채여야 |
| base | w-45-tamna-oreumbi | weapon | 막대 · 채찍이어야 |
| base | w-68-maek-beombal | weapon | 손도끼 · 초상은 단검 |
| base | w-77-sabeol-malgalgi | weapon | 창 · 초상은 채찍 |
| base | w-98-byeonhan-danbi | weapon | 절굿공이 · 낫이어야 |
| aw1 | g-104-garak-odogan | flat pose | 저울·은괴 들고 똑바로 선 밋밋한 자세 |
| aw1 | g-106-garak-ocheongan | flat pose | 노를 어깨에 걸치고 걷는 밋밋한 자세 |
| aw1 | g-24-wansan-onsan | flat pose | 피리 불며 똑바로 선 정적인 자세 |
| aw1 | g-41-goja-bau | flat pose | 자루·은괴 들고 선 밋밋한 자세 |
| aw1 | g-51-biryuna-mulgyeol | weapon | 노에 넓은 노깃이 없어 몽둥이로 보임(원화는 넓은 노) |
| aw1 | g-61-heomcheuk-bawi | flat pose | 떡 찢으며 똑바로 선 밋밋한 자세 |
| aw1 | g-65-goguryeo-damul | flat pose | 칼을 세워 든 채 서 있는 밋밋한 자세 |
| aw1 | g-66-buyeo-geumha | flat pose | 말머리 지팡이·거울 들고 선 밋밋한 자세 |
| aw1 | g-78-saro-alpyeong | flat pose | 돌·지팡이 들고 똑바로 선 밋밋한 자세 |
| aw1 | l-L1-yuhwa | covered up+style | 원화보다 덜 드러남(배·허벅지 가림) · 그림체가 더 애니풍 |
| aw1 | l-L2-soseono | flat pose | 창 세워 들고 거의 서 있는 밋밋한 자세 |
| aw1 | w-04-gaya-swordswoman | covered up | 초상은 가슴골·배 드러남, 컷인은 다 가림 |
| aw1 | w-11-assassin | covered up | 초상은 배꼽티, 컷인은 배를 감싼 윗옷 |
| aw1 | w-19-buyeo-fur-princess | covered up | 초상은 어깨·배 드러남, 컷인은 긴 도포로 다 가림 |
| aw1 | w-22-dongye-tiger-huntress | covered up | 초상은 배 드러남, 컷인은 배를 가린 저고리 |
| aw1 | w-24-apdok-queen | covered up | 초상은 어깨 드러남, 컷인은 어깨를 소매로 덮음 |
| aw1 | w-27-mokji-jinha | covered up | 초상은 어깨·배 드러남, 컷인은 겉옷이 다 덮음 |
| aw1 | w-50-siljik-mulga | covered up | 초상은 어깨·가슴골·배 드러남, 컷인은 닫힌 도포 |
| aw1 | w-56-dongokjeo-sogeum | covered up | 초상은 어깨·가슴골·배 드러남, 컷인은 배를 가린 긴 옷 |
| aw1 | w-64-miri-dallae | covered up | 초상은 가슴골·배 드러남, 컷인은 블라우스로 가림 |
| aw1 | w-75-daegaya-soemoe | face | 얼굴·몸이 남자로 보임 (초상은 근육질 여자) |
| aw1 | w-92-saro-dallae | covered up | 초상은 어깨·배 드러남, 컷인은 붉은 겉옷으로 다 가림 |
| aw1 | w-99-garak-yucheongan | flat pose | 항아리 들고 서 있는 밋밋한 자세 |
| aw2 | g-102-garak-yeodogan | flat pose | 볏단 끌어안고 걷기만 하는 평이한 자세 |
| aw2 | g-67-gosaburi-buri | weapon | 활에 시위가 없음, 몽둥이처럼 휘두름 |
| aw2 | g-87-wae-chief | rule+weapon | 마체테 대신 카타나(둥근 쓰바·외날 곡도) 모양 |
| aw2 | l-L1-yuhwa | covered up+style | 진각성 초상보다 많이 가림(배·허벅지 덮은 드레스) + 얼굴 그림체가 애니풍 |
| aw2 | l-L4-bari-gongju | covered up | 초상은 배 드러난 비키니 상의인데 컷인은 배·다리 다 덮은 원피스 |
| aw2 | l-L5-seonyeo | covered up | 초상은 배 드러남, 컷인은 몸판이 배를 덮음 |
| aw2 | l-L8-nangnang-princess | covered up | 초상은 배 드러남, 컷인은 홀터 원피스로 배를 덮음 |
| aw2 | w-05-baekje-queen | covered up | 초상은 배 드러남, 컷인은 몸판이 배를 덮음 |
| aw2 | w-06-buyeo-huntress | covered up | 초상은 배 드러남, 컷인은 원피스가 배를 덮음 |
| aw2 | w-19-buyeo-fur-princess | covered up | 초상은 어깨·가슴골·배 드러남, 컷인은 털옷+몸판으로 다 덮음 |
| aw2 | w-24-apdok-queen | covered up | 초상은 배 드러남, 컷인은 원피스가 배를 덮음 |
| aw2 | w-31-dabeol-dalbit | covered up | 초상은 가슴골·배 드러남, 컷인은 몸통 전부 덮음 |
| aw2 | w-35-jomun-odi | covered up | 초상은 배 드러남, 컷인은 여밈 원피스가 배를 덮음 |
| aw2 | w-37-michuhol-gaennae | covered up | 초상은 배 드러남, 컷인은 코르셋이 배를 덮음 |
| aw2 | w-50-siljik-mulga | covered up | 초상은 배·허벅지 트임 드러남, 컷인은 겉옷이 배를 덮음 |
| aw2 | w-53-hwanna-gabi | covered up | 초상은 홀터 상의에 배 드러남, 컷인은 여민 저고리가 배를 덮음 |
| aw2 | w-62-byeokjin-byeol | covered up | 초상은 짧은 조끼에 배 드러남, 컷인은 셔츠·앞치마가 배를 덮음 |
| aw2 | w-64-miri-dallae | covered up | 초상은 배 드러남, 컷인은 흰 속옷이 배를 덮음 |
| aw2 | w-65-goguryeo-hwalmi | covered up | 초상은 빨간 짧은 상의에 배 드러남, 컷인은 상의가 배를 덮음 |
| aw2 | w-66-saro-noeul | covered up | 초상은 배 드러남, 컷인은 코르셋이 배를 덮음 |
| aw2 | w-67-buyeo-haedal | covered up | 초상은 배 드러남, 컷인은 상의가 배를 덮음 |
| aw2 | w-68-maek-beombal | covered up | 초상은 가슴골·배 드러남, 컷인은 조끼가 가슴·배를 덮음 |
| aw2 | w-77-sabeol-malgalgi | weapon+covered up | 채찍 끈이 손잡이와 끊겨 머리 뒤에 따로 떠 있음 · 초상은 배 드러남, 컷인은 코르셋이 덮음 |
| aw2 | w-92-saro-dallae | covered up | 초상은 배 드러남, 컷인은 코르셋이 배를 덮음 |
