# 장수 무기 감사 (2026-11-16) · 원화 기준

형 11-16: 감실은 초상·1차 각성·진각성 모두 방울인데 장수 열전에서는 도끼를 들었다. 설정(데이터)과 원화가 어긋난 곳을 모두 찾아 원화에 맞춘다.

- 근거 그림: `bust-hd`(초상) · `skill-body`(전신 비기) · `awaken-hd`(1차 각성) · `skill-body/aw1`(1차 전신) · `awaken2-hd`(진각성). 여기에 전투 띠 0번(선 자세)과 14번(공격) 칸을 한 줄에 놓은 접촉 시트로 221줄을 눈으로 봤다.
- 그림끼리 다르면: 진짜 무기가 일상 소품(잔·볏단·은덩이)보다 먼저다. 무기끼리 다르면 초상과 1차 각성(awaken-hd·skill-body/aw1)을 따른다. 무기가 하나도 없으면 공격 동작으로 정한다(악기·제물·굿 도구는 주술, 맨주먹은 단검).
- 묶음 정하는 법: 활 · 창(삼지창·언월도·작살) · 칼(큰칼) · 단검(낫·칼·주먹·채찍·밧줄) · 도끼(망치·몽둥이·노·괭이) · 주술(방울·지팡이·부채·홀·악기).
- 전체 기록은 `tools/sprite-kit/weapon-audit-20261116.json`에 있다. 줄마다 key · portrait · artWeapon · artKit · queueWeapon · currentKit · fixedKit · spriteWeapon · mismatch · note를 담았다.

## 숫자

| 항목 | 수 |
|---|---|
| 본 전투 띠 | 221 (원장 210 · `dalbit` · 1차 각성 띠 10) |
| 열전 묶음이 원화와 달라 고친 것 | **26** (`tools/raid-kit-overrides.json`) |
| 띠가 든 무기가 원화와 다른 것(다시 구워야 함) | **19** |
| 원화끼리 무기가 다른 것 | 17 |
| 1차 각성 띠 10개 | 모두 원화와 같다 |

고친 방법은 다음과 같다. `tools/raid-kit-table.mjs`가 원장 무기를 묶음으로 바꾼 뒤 `tools/raid-kit-overrides.json`을 덮어쓰고, 그 결과로 `src/raid/kit-table.ts`를 다시 만든다. `queue.json`의 옛 기록은 건드리지 않았다.
원장 `weapon: "heavy"` 12개는 무기가 아니라 동작 결(크게 휘두르기)이었다. 그래서 방울·지팡이를 든 장수 다섯(감실·할라·진하·고목·소벌)이 도끼 묶음에 들어가 있었다.

## 1. 열전 묶음이 틀렸던 것 (26 · 고침)

| key | 초상 | 원래 | 고친 뒤 | 원화 무기 | 띠 |
|---|---|---|---|---|---|
| gamsil | w-33-gammun-gamsil | 도끼 | **주술** | 방울 막대·거울 | 맞음 |
| halla | w-58-tamna-halla | 도끼 | 주술 | 방울 지팡이 | 맞음 |
| jinha | g-76-mokji-jinha | 도끼 | 주술 | 방울 지팡이·거울 | 맞음 |
| gomok | g-90-haengin-gomok | 도끼 | 주술 | 방울 단 굽은 지팡이 | 맞음 |
| sobeol | g-77-saro-sobeol | 도끼 | 주술 | 조 이삭 단 지팡이 | 맞음 |
| heo | l-L3-heo-hwangok | 칼 | 창 | 창 지팡이(1차) | 맞음 |
| dalbit | w-31-dabeol-dalbit | 칼(표에 없어 기본값) | 활 | 활 | 맞음 |
| damul | g-65-goguryeo-damul | 활 | 칼 | 칼(초상·각성·1차) | **활 · 다시** |
| olddaeso | g-100-buyeo-old-daeso | 주술 | 단검 | 금 자루 채찍 | **홀 · 다시** |
| goeun | w-01-silla-princess | 칼 | 주술 | 부채(각성·1차) | **칼 · 다시** |
| bdanbi | w-98-byeonhan-danbi | 도끼 | 단검 | 낫 | **절굿공이 · 다시** |
| bira | w-28-michuhol-bira | 창 | 단검 | 밧줄 올가미 | **작살 · 다시** |
| beombal | w-68-maek-beombal | 도끼 | 단검 | 칼(초상·1차) | **손도끼 · 다시** |
| geumbawi | g-86-mokji-geumbawi | 도끼 | 칼 | 칼 | **몽둥이 · 다시** |
| base-g-07-drunk-warrior | g-07-drunk-warrior | 칼 | 단검 | 맨주먹(술독·잔) | **칼 · 다시** |
| base-w-05-baekje-queen | w-05-baekje-queen | 칼 | 주술 | 향로 | **칼 · 다시** |
| base-g-18-daegaya-king | g-18-daegaya-king | 칼 | 주술 | 가야금 | **칼 · 다시** |
| base-w-61-iseo-sinae | w-61-iseo-sinae | 창 | 주술 | 산가지(던짐) | **창 · 다시** |
| base-g-37-eumjeup-jeup | g-37-eumjeup-jeup | 칼 | 주술 | 볏단·호리병 | **칼 · 다시** |
| base-g-38-chopal-palmae | g-38-chopal-palmae | 창 | 단검 | 무릿매(맞는 묶음이 없어 채찍처럼 단검) | **창 · 다시** |
| base-g-45-dabeol-deulgae | g-45-dabeol-deulgae | 도끼 | 칼 | 긴 칼(각성·1차) | **몽둥이 · 다시** |
| base-w-50-siljik-mulga | w-50-siljik-mulga | 창 | 단검 | 짧은 칼·물 기운 | **창 · 다시** |
| base-w-45-tamna-oreumbi | w-45-tamna-oreumbi | 주술 | 단검 | 채찍(각성·1차) | **지팡이 · 다시** |
| base-g-60-golbeol-golgae | g-60-golbeol-golgae | 칼 | 도끼 | 큰 망치(각성·1차) | **칼 · 다시** |
| base-g-66-geonma-malbalgup | g-66-geonma-malbalgup | 창 | 칼 | 칼(각성·1차) | **창 · 다시** |
| base-g-68-mujin-bitgoeul | g-68-mujin-bitgoeul | 주술 | 칼 | 칼(각성·1차) | **해 원반 지팡이 · 다시** |

## 2. 띠가 원화와 다른 것 (19 · 데이터로는 못 고침 · 챗지피티로 다시 구울 차례)

위 표에서 「다시」라고 적힌 19명이다. 다시 굽기 전까지는 묶음(원화 기준)과 띠가 든 것이 서로 다르게 보인다.
먼저 구울 것은 진짜 무기를 틀리게 든 쪽이다: damul(활→칼) · olddaeso(홀→채찍) · goeun(칼→부채) · bdanbi(공이→낫) · beombal(손도끼→칼) · geumbawi · golgae · malbalgup · bitgoeul · deulgae · bira · mulga · oreumbi · palmae.
원화에 무기가 아예 없는 다섯은 띠가 칼이나 창을 「만들어 낸」 것이다. 악기·제물·맨주먹 동작으로 다시 그리거나, 형이 무기를 정한 뒤 원화 쪽을 고친다: drunk-warrior · baekje-queen · daegaya-king · iseo-sinae · eumjeup-jeup.

## 3. 원화끼리 무기가 다른 것 (17)

대부분 「전신 비기(skill-body) 한 장만 무기를 들고, 초상·각성은 소품」인 경우다. 정한 쪽은 굵게 적었다.

| key | 판정 | 서로 다른 점 |
|---|---|---|
| damul | **칼** | 초상·각성·1차는 칼, 전신 비기는 활 |
| olddaeso | **채찍** | 초상·각성·1차는 금 자루 채찍, 전신 비기는 금 홀 |
| goeun | **부채** | 각성·1차는 부채, 전신 비기는 칼 |
| base-w-05-baekje-queen | **향로** | 각성·1차는 향로, 전신 비기는 칼 |
| base-w-45-tamna-oreumbi | **채찍** | 각성·1차는 채찍, 전신 비기는 장대 |
| base-g-60-golbeol-golgae | **망치** | 각성·1차는 망치, 전신 비기는 짧은 칼 |
| base-g-66-geonma-malbalgup | **칼** | 초상은 말채찍, 전신 비기는 창, 각성·1차는 칼 |
| beombal | **칼** | 초상·1차는 칼, 전신 비기는 손도끼 |
| alpyeong | **깃 단 손도끼** | 초상·전신 비기는 손도끼, 1차는 날 없는 깃 지팡이 (도끼 유지) |
| base-g-22-ungcheon-gomnae | **무딘 쇠 칼판(도끼 묶음 유지)** | 초상·전신은 끝이 네모난 쇠 칼판, 1차는 굽은 칼 · 띠는 초상과 같다 |
| horselord | 칼 | 초상은 말채찍, 전신·1차는 칼 |
| base-g-40-anya-adan | 칼 | 초상·1차는 잔, 전신 비기만 칼 |
| base-g-41-goja-bau | 창 | 초상·1차는 소금 자루·쇳덩이, 전신 비기만 창 |
| hogong | 단검 | 초상·각성·1차는 목패·호리병, 전신 비기만 단검 |
| odogan | 단검 | 초상·각성·1차는 은덩이·저울, 전신 비기만 칼 |
| base-g-24-wansan-onsan | 단검 | 초상·각성·1차는 피리, 전신 비기만 단검 |
| base-w-56-dongokjeo-sogeum | 단검 | 초상·각성·1차는 소금 상자, 전신 비기만 단검 |

표 아래쪽 여섯(anya-adan · goja-bau · hogong · odogan · wansan-onsan · dongokjeo-sogeum)은 띠와 묶음이 이미 같아 고칠 것이 없다. 다만 형이 「소품이 정체성」이라고 보면 주술·단검 같은 다른 묶음으로 옮길 수 있다.

## 4. 본편 데이터 가운데 원화와 결이 다른 것 (목록만 · 안 고침)

- `src/ui/realm/battle-strikes.ts`의 `HEAVY_SWINGS`(본편 싸움의 「크게 내려치기 + 흙먼지」)에 원장 `heavy` 12명이 그대로 들어 있다(`src/realm/data/duelGenerated.ts`의 `GENERATED_HEAVY_KEYS` · `AWAKENED_HEAVY`). 방울·지팡이를 든 감실·aw1-감실·할라·진하·고목·소벌도 도끼처럼 내리찍고 흙먼지를 낸다. 띠 동작이 실제로 내려치기로 그려져 있어 데이터만 바꾸면 동작과 효과가 어긋날 수 있다. 다시 구울 때 같이 본다.
- `BLADE_SWINGS`(베기)의 `goeun`: 원화는 부채이고 띠는 칼이다. 띠를 다시 구우면 빼야 한다.
- `battle-strikes.ts`의 `RELEASE`(활 시위 자리)에 `gen-damul`이 있고 `FULL20_ANIM.damul.bow`도 켜져 있다. 다물의 원화는 칼이지만 띠가 활이라, 띠를 다시 굽기 전까지는 이대로 둔다(끄면 활 띠가 칼 박자로 돈다).
- `heo`(허황옥)의 원장 `weapon`이 `null`이어서 열전에서 칼이 되던 것은 덮어쓰기로 창이 됐다.
