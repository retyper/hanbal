# 그림 검수 (11-11 들어간 그림 전수)

11-11 22:00 이후 커밋된 `public/realm` 그림을 전체 크기로 한 장씩 본 기록. 고치지 않고 목록만 만들었다.
진각성은 같은 장수의 1차 각성(`awaken-hd`)과 나란히 놓고 같은 사람인지 봤다.

- 본 장수: 진각성 45 + 1차 짝 45 · 겨루기 군중 12 · 큰 공사 단계 12 · 완공/잔치 장면 5 · 도읍 궁궐 1 · 목책 2 · 전투 띠 5(조각 확인만) · 명치 초상 2(진각성 짝으로 같이 봄)
- 못 본 것: `duel/arena-*.jpg`, `duel/crowd-back.png`, `duel/crowd-front.png` 는 커밋에는 있는데 지금 저장소에 파일이 없다(낱장 `b1~f6` 으로 바꾼 것으로 보임). 작은 `awaken/`·`bust/` 는 `-hd` 의 줄인 것이라 따로 안 봤다.
- 한계: 진각성은 900px 전체를 줄여 본 것이라 손가락 한 개 한 개까지 확대해 세지는 못했다. 눈에 띄는 뭉침·여섯 손가락은 없었다. 전투 띠 5장은 칸 폭이 160 이 아니라서(2900/18 같은 값) 칸을 정확히 못 잘랐다. 걷기 띠 검수는 sprite-sheet-qa 로 따로.

## 요약

| 판정 | 장 수 | 어디 |
|---|---|---|
| 고칠 것 | 5 | 제단 단계 그림 2 · 제단 완공 장면 1 · 장대 완공 장면과 궁궐에 제미나이 ✦ 2 |
| 버릴 것 | 0 | |
| OK | 나머지 전부 | 진각성 45, 군중 12 등 |

겨루기 군중은 오늘 형이 화낸 "몸이 붙은 사람·목이 돌아간 사람" 이 **없다.** 낱장 12장이 다 따로 서 있고, 머리·몸 방향이 맞고, 손도 멀쩡하다.

## 고칠 것

| 파일 | 판정 | 무엇이 어디가 이상한가 | 다시 구울 때 넣을 한 줄 |
|---|---|---|---|
| `event/event-wonder-altar.jpg` | 고칠 것 | 돌기둥 사이 굵은 새끼줄에 **하얀 지그재그 종이(시데)** 가 줄줄이 걸림. 일본 신사 시메나와 모양. 색 천·방울은 괜찮음 | `Hang only colored cloth strips and small bronze bells on the rope. No white zigzag paper streamers (shide), no Shinto shimenawa look.` |
| `icon/wonder-altar-s2.png` | 고칠 것 | 제단 아래 돌 둘레에 **새끼줄 + 지그재그 종이 술**(시메나와). 위 나무 틀이 **도리이처럼** 위가 휘고 검붉은 문틀 | `Stone base wrapped with a plain rope and hanging straw/cloth tassels only. The wooden frame is an unpainted bare-log scaffold with straight beams, not a curved dark torii gate.` |
| `icon/wonder-altar-s3.png` | 고칠 것 | s2 와 같은 시메나와 종이 술 + 도리이 닮은 문틀. 바닥 판자에 **글씨 같은 낙서("4/18" 비슷)** 가 보임 | `Same as altar s2 fix. Ground planks and boards must be blank, no letters, numbers or scribbles anywhere.` |
| `event/event-wonder-sotdae.jpg` | 고칠 것 | **오른쪽 아래 모서리에 제미나이 ✦ 별** 이 작게 남음 | `(그림은 그대로) 오른쪽 아래 모서리 90x90 을 더 잘라 내거나 주변 바탕으로 덮는다. 굽기 지시: leave the bottom-right corner empty.` |
| `town/palace-hall.jpg` | 고칠 것 | **오른쪽 아래 모서리에 제미나이 ✦ 별** 이 작게 남음. 처마 밑 현판 글씨가 깨진 가짜 글자 | `(그림은 그대로) 오른쪽 아래 모서리를 잘라 내거나 덮는다. Keep the plaque under the eave blank or use a plain carved pattern, no pseudo-text.` |

## 눈여겨볼 것 (OK 이지만 짚어 둠)

| 파일 | 판정 | 메모 |
|---|---|---|
| `event/event-great-feast.jpg` | OK | 네모 격자 창 등롱이 중국풍에 가깝지만 일본·기와는 아님. 초가·통돼지·모닥불이라 한반도 결. 불만이면 등롱을 짚 광주리 등으로 |
| `awaken2-hd/w-56 · w-76 · w-99` | OK | 가슴골이 크고 배가 드러난 옷. 가슴 비침·유두 윤곽은 없음(천이 불투명). 1차와 같은 수준이라 15세 판 기준으로 새로 걸리지 않음 |
| `awaken2-hd/g-30 · g-48 · g-56` | OK | 두 손을 포갠 자리 손가락이 살짝 뭉침. 여섯 손가락·팔 수 이상은 없음 |
| `awaken2-hd/g-87-wae-chief` | OK | 진각성은 비늘갑·곧은 칼. 1차도 비늘갑이라 같은 사람. 어깨 층판이 오소데 모양에 약간 가깝지만 일본갑 단정은 못 함 |
| `awaken2-hd/g-28 · g-82` | OK | 진각성에서 호랑이 영 / 곰 가죽 후드가 빠졌지만 얼굴·수염·무기가 같아 같은 사람으로 읽힘 |

## 진각성 45장 (`awaken2-hd`) 전부 OK

사람 맞춤(진각성 ↔ 1차 `awaken-hd`) · 손 · 몸 · 활시위 · 워터마크 · 일장기 · 닌자 · 바탕 잔여 모두 문제 없음. 활시위를 당기는 자세는 한 장도 없음(g-56 은 활 대신 막대, g-80 은 화살 묶음을 쥠, g-105 계열은 창).

| 파일 | 판정 | 한 줄 |
|---|---|---|
| g-10-buyeo-horse-lord | OK | 털모자·갑옷 같은 사람 |
| g-22-ungcheon-gomnae | OK | 구슬 목걸이·수염 같은 사람 |
| g-23-sangdang-soedal | OK | 백발 묶음·금장 같은 사람 |
| g-24-wansan-onsan | OK | 피리 부는 긴 머리 청년 같은 사람 |
| g-25-balla-keunmoe | OK | 방울 막대·붉은 염주 같은 사람 |
| g-26-gampyeong-gaetbeol | OK | 웃는 두건 장수 같은 사람 |
| g-27-maek-maekdol | OK | 화살통 진 장발 궁사 같은 사람 |
| g-28-goguryeo-damul | OK | 붉은 갑옷 망치 장수(호랑이 영만 빠짐) |
| g-29-yeonna-myeongsol | OK | 깃 달린 모자 노장 같은 사람 |
| g-30-gwanna-soemoe | OK | 수염 큰 장수 같은 사람 |
| g-43-hwanna-amnok | OK | 배 노 든 청년 같은 사람 |
| g-48-gwanna-musoe | OK | 대장장이 망치 같은 사람 |
| g-49-goguryeo-sona | OK | 깃 투구·도끼 같은 사람 |
| g-51-biryuna-mulgyeol | OK | 파란 옷 방망이 청년 같은 사람 |
| g-53-baekje-haeru | OK | 콧수염 두건 책사 같은 사람 |
| g-54-mokji-mahan | OK | 벼 이삭 창 노인 같은 사람 |
| g-56-haseulla-gwahama | OK | 화살통 웃는 장수(활 대신 막대) |
| g-65-goguryeo-damul | OK | 왕관·보라 망토 같은 사람 |
| g-68-baekje-onnuri | OK | 머리띠·검 든 군주 같은 사람 |
| g-74-saro-hyeokgeose | OK | 보라 옷 미청년 같은 사람 |
| g-75-saro-hogong | OK | 박(호리병) 윙크 노인 같은 사람 |
| g-77-saro-sobeol | OK | 수염 흰 노인 곡식 지팡이 같은 사람 |
| g-78-saro-alpyeong | OK | 관 쓴 점술가 같은 사람 |
| g-79-saro-jibaekho | OK | 호랑이털 창 같은 사람 |
| g-80-saro-guryema | OK | 화살통 사냥꾼 같은 사람 |
| g-81-saro-jita | OK | 붉은 비단 구슬 상인 같은 사람 |
| g-82-saro-hojin | OK | 큰 도끼 장수(곰 후드만 빠짐) |
| g-87-wae-chief | OK | 비늘갑 칼 장수 같은 사람 |
| g-89-baekje-maryeo | OK | 낫(1차) → 큰 칼(진) 이지만 같은 사람 |
| g-95-goguryeo-daemusin | OK | 깃 투구 두루마리 청년 같은 사람 |
| g-96-garak-suro | OK | 붉은 머리띠 옥 청년 같은 사람 |
| g-97-tahae | OK | 밧줄·털 웃는 장수 같은 사람 |
| g-98-goguryeo-gwaeyu | OK | 큰 검 수염 장수 같은 사람 |
| g-99-goguryeo-maro | OK | 방울 창·밧줄 같은 사람 |
| g-100-buyeo-old-daeso | OK | 흰 수염 관 노왕 같은 사람 |
| g-101-garak-adogan | OK | 회색 수염 지팡이 같은 사람 |
| g-102-garak-yeodogan | OK | 벼 단 웃는 농부 같은 사람 |
| g-103-garak-pidogan | OK | 머리띠 도끼 같은 사람 |
| g-104-garak-odogan | OK | 철판 든 상인 같은 사람 |
| g-105-garak-yusugan | OK | 창 든 장발 용사 같은 사람 |
| g-106-garak-ocheongan | OK | 웃는 이 빠진 뱃사공 같은 사람 |
| g-107-garak-musoe | OK | 큰 망치 대장장이 같은 사람 |
| w-56-dongokjeo-sogeum | OK | 푸른 보석 여인 같은 사람 |
| w-76-gampyeong-baetsagong | OK | 조개 장식 여인 같은 사람 |
| w-99-garak-yucheongan | OK | 곡식 항아리 여인 같은 사람 |

## 겨루기 군중 12장 (`duel/crowd`) 전부 OK

화살 쏘는 사람 b5/f5 도 활을 높이 든 응원 자세지 시위를 당기지 않음. 몸이 다른 사람과 붙은 것·목 방향 틀어진 것·손 이상 없음. 키잉 잔여(자홍/초록)·잘린 가장자리 없음(바닥에 발이 닿는 것만).

| 파일 | 판정 | 한 줄 |
|---|---|---|
| b1 / f1 | OK | 투구 창병 등/앞 맞음 |
| b2 / f2 | OK | 방패+몽둥이, 방패 쪽 좌우 등/앞 맞게 뒤집힘 |
| b3 / f3 | OK | 맨손 주먹 응원 |
| b4 / f4 | OK | 검+판자 방패 |
| b5 / f5 | OK | 활 든 응원 |
| b6 / f6 | OK | 도끼+둥근 방패. f6 오른발 근처 흰 점 몇 개가 보이나 흠 아님 수준 |

## 큰 공사 단계 12장 (`icon/wonder-*-s1~s3`)

| 파일 | 판정 | 한 줄 |
|---|---|---|
| wonder-altar-s1 | OK | 통나무 쌓고 터 닦는 단계 |
| wonder-altar-s2 | **고칠 것** | 위 표 참고 |
| wonder-altar-s3 | **고칠 것** | 위 표 참고 |
| wonder-dolmen-s1~s3 | OK | 고인돌 얹는 비탈길·기둥돌, 한반도 결 |
| wonder-furnace-s1~s3 | OK | 가마 구덩이→가마 틀→병 모양 굴뚝 가마 |
| wonder-sotdae-s1~s3 | OK | 구덩이→오리 장대→오리 장대 숲 |

## 완공·잔치 장면 5장 (`event`)

| 파일 | 판정 | 한 줄 |
|---|---|---|
| event-great-feast | OK | 모닥불·통돼지·초가 마당 |
| event-wonder-altar | **고칠 것** | 시메나와+시데 |
| event-wonder-dolmen | OK | 고인돌 제사, 흰 깃발 |
| event-wonder-furnace | OK | 제철 가마·풀무·오리 장대 |
| event-wonder-sotdae | **고칠 것(경미)** | 오른쪽 아래 ✦ |

## 그 밖

| 파일 | 판정 | 한 줄 |
|---|---|---|
| town/palace-hall | **고칠 것(경미)** | 오른쪽 아래 ✦, 현판 가짜 글씨 |
| pirate/palisade-0 · palisade-1 | OK | 통나무 목책 온전/부서짐 |
| anim2/bandit-chief · bandit-club · gen-bdanbi · gen-dallae2 · gen-yucheongan | OK(조각 확인) | 칸이 정확히 안 잘려 앞뒤 조각이 섞여 보였음. 인물·무기는 멀쩡. 걷기 띠 정식 검수는 따로 |
| bust-hd/w-56 · w-76 | OK | 같은 사람(진각성 짝과 얼굴 같음), 가슴 비침 없음 |

## 다시 구울 때 공통으로 더할 한 줄

- 제단·제사 그림: `No Shinto shimenawa, no white zigzag shide streamers, no torii. Use plain rope with colored cloth strips and bronze bells.`
- 장면 그림 바탕: `Leave the bottom-right corner empty (no logo, no star).` 그리고 잘라 낸 뒤 `tools` 의 모서리 지우개로 다시 확인.
