# sprite-kit — 초상 한 장으로 전투 띠(걷기 8 + 동작 8) 굽기

형 11-08: "너무 똑같이 반복하는 것들은 모듈화해서 크레딧도 아끼자 · 다른 게임 만들 때도 쓸 수 있게".
게임과 무관한 부분(브라우저·자르기)과 이 게임 전용 어댑터(`register-realm.sh`)를 나눴다.

## 한 사람 굽는 길 (Claude 가 쓰는 호출 수를 최소로)

1. 명세: `heroes/<묶음>.json` 에 한 줄 — `key · heroId · bust · weapon(bow|spear|sword|dagger|heavy) · desc · hold · stride` (+ 남자면 `sex: "man"`, 노출 문구를 바꾸려면 `extra`).
   명세를 고치면 아래 설치를 다시 해 skitSpec 을 바꾼다.
2. 제미나이 탭 (Jay u/4 는 Veo 전용 · 공유 단추 금지):
   - 한 번만 (gemini.google.com 출처 · 이 페이지는 바깥 fetch 가 CSP 로 막힌다): 페이지에 임시 `<input type=file id=skitin aria-label=skit-installer>` 를 만들어 find → file_upload [gemini-kit.js, heroes/<묶음>.json] → `for (const f of skitin.files) { const t = await f.text(); if (f.name.endsWith(".js")) localStorage.skit = t; else localStorage.skitSpec = JSON.stringify(JSON.parse(t)) }` (내용이 채팅으로 안 지나가 크레딧이 안 든다)
   - 불러오기 (페이지를 새로 열 때마다 · Trusted Types 때문에 정책을 거친다): `const p = window.__skitP || (window.__skitP = trustedTypes.createPolicy("skit" + Date.now(), { createScript: (s) => s })); eval(p.createScript(localStorage.skit))` — 아래에서 `LOAD` 라 부른다
   - 새 대화: `LOAD; await skit.setup('u0')` → find `u0file0` → file_upload [참고 걷기 시트, `public/realm/bust-hd/<bust>.jpg`]
   - `LOAD; await skit.send('walk', key)`
   - 받기: `sh tools/sprite-kit/cut.sh mark` → `LOAD; await skit.grab(key + 'w')` → `sh tools/sprite-kit/cut.sh <key> walk`
   - 같은 대화에 `skit.send('act', key)` → grab → `cut.sh <key> act`
3. 넣기: `sh tools/sprite-kit/register-realm.sh <key> "<한글 설명>"` — 자리줄·매핑·맞는 점·합치기·typecheck·시험·커밋·푸시까지.

## ★ 11-12 새 틀 — 동작 시트 act5: 3×2 가로 칸 · 5컷 + 우하단 자홍 네모 (형: 「머리 잘림 · 창칼 짧음 · 프레임 몇 개·각각 어떤 모습 · 우하단은 워터마크용 자홍 네모」)

게임이 실제로 쓰는 장수 띠 20칸(battlefield.ts spidle·spwalk·gatk·spshot·gdie): 서기 0~3 · 걷기 4~11 · 공격 12~17 · 맞음 18 · 쓰러짐 19.
그래서 **서로 다른 그림은 13장**이면 된다 — 걷기 8 + 동작 5. 옛 동작 시트의 「마무리」 컷은 찌름과 거의 같아 버렸다.

| 동작 칸 | 모습 | 게임 자리 |
|---|---|---|
| 1 | 똑바로 선 대기 자세(걷기와 같은 키 · 배율 맞춤의 기준) | 서기 0~3 · 공격 12 · 17 |
| 2 | 당김(창 뒤로·칼 치켜듦·화살 메김) | 공격 13 |
| 3 | 끝까지 뻗은 공격 · 무기 끝까지 칸 안 | 공격 14~16 (멈춘 듯 길게 = 손맛) |
| 4 | 맞음(상체 뒤로 젖힘) | 맞음 18 |
| 5 | 누움(무기는 곁에) | 쓰러짐 19 |
| 6 | **자홍 #FF00FF 네모 · 아무것도 안 그림** — 제미나이 ✦ 워터마크가 여기 떨어진다 | 버림 |

- 칸 458×384(16:9 3×2) · 1~4 는 사람이 칸 **왼쪽 40%**, 오른쪽 60% 는 무기 자리 · 5(누움)는 가운데.
- 참고 시트 `ref-act-3x2.png` = 지백호 원본에서 덩어리째 떠서 만든 것(`mkref.py act jibaekho 1,2,3,6,8 … 3:1040:148`) · 몸속 구멍 메움 · 순수 초록 바탕. **참고 시트는 초록 옷 없는 사람 · 키 뺀 띠를 키우지 말 것**(첫 판은 흐리고 몸속이 초록이었다).
- 받기: `cut.sh <key> act5` (clean.py 가 6번 칸 자홍을 알아보고 바탕으로 덮은 뒤 키를 뺀다 · 1~5 칸만 띠로) → `check-strip.py <key>-act5-key.png 3 2 --skip 6` 0·0 → `NACT=5 sh register-realm.sh <key> "…"` (검사 문이 들어 있다).
- 문안: `skit.send('act5', key)`(걷기 다음 같은 대화 · 첨부 = 참고 시트) · `skit.send('act5solo', key)`(새 대화 · 첨부 = 참고 시트 · 초상 · 옛 걷기 1번 컷 옷 참고). 형 손 굽기 꾸러미 `node tools/sprite-kit/act-pack.mjs` → docs/realm/BAKE-ACT.md (한 장수 = 새 대화에 걷기 walk9 1:1 → 같은 대화 동작 act5 16:9) · 형이 inbox/ 에 `<key>-walk9.png`·`<key>-act5.png` 로 올리면 `sh tools/sprite-kit/inbox-intake.sh`.
- **걷기 참고 `ref-walk-3x3.png` (11-12 · 형: 「걷기 프레임 전달용 그림은 웹에도 있다」)**: 우리 원본 걷기는 전부 줄마다 쥐는 법이 다르거나(아령·지백호) 무릎 꿇은 칸(노을)이 있어 못 쓴다 → CC0 견본 itch.io mostlydecent 「8 frame walk」(https://mostlydecent.itch.io/8-frame-walk · CC0) 미리보기 8컷을 **색 마네킹**(다리 보라/파랑 · 팔 빨강/주황 · 몸통 회색)으로 1:1 3×3 에 앉히고 9번 칸은 자홍 네모. 색이 다리를 갈라 줘서 1·5번 다리 교대가 그림으로 전해진다.
  - `skit.send('walk9', key)` · 새 대화 · **비율 1:1** · 첨부 = ref-walk-3x3.png · 초상 → `cut.sh <key> walk9` (3×3 에서 1~8 · clean.py 가 9번 자홍을 덮는다) → `<key>-walk9-strip.png` 를 `<key>-walk-strip.png` 로 쓰면 된다(compose 는 8컷 띠만 본다).
  - 같은 대화에 이어 `skit.send('act5', key)` (첨부 = ref-act-3x2.png · 비율 16:9 로 바꿔서) — 걷기와 동작 옷이 같아진다.
  - 아직 실제로 한 장도 안 구워 봤다 — 첫 장은 시험.
- 받는 판 크기: 자동 `skit.grab` 은 화면 미리보기(1024 폭)를 캔버스로 떠서 작다 → 손으로 받을 땐 **원본 크기 다운로드**.

## ★ 계정 (11-13 형 지적 · 에이전트 지시에 그대로 붙인다)
- **제미나이 이미지: u/0 · u/1 · u/2 · u/3(edu · Pro) · u/5 다섯 개를 돌려 쓴다.** u/3 edu 를 빼지 말 것 — 막힌 건 Flow 뿐이다. 한 번에 한 계정 · 사이 1~2분.
- **제미나이 영상(Veo): u/4 Jay 만 · 모델 Argon.**
- **Flow: u/0 · u/1 · u/2 · u/4 · u/5** (u/3 은 Flow 만 관리자 차단).

## 알아 둔 함정 (11-08)

- **참고 걷기 시트가 곧 결과다.** `pirate-run.png` 는 여덟 칸이 거의 한 자세라 결과도 한 자세로 굳었다(그 시트로 만든 11-08 오전 띠들은 다시 구울 거리). 지금은 `generals2/aryeong-walk.png`.
- 그래도 제미나이 무료(Flash)는 **줄마다 같은 자세 넷**을 자주 낸다 · 참고 시트의 **줄마다 다른 쥐는 법을 그대로 베낀다**. 창은 「어깨에 멘」 아랫줄만 쓰면 된다: `cut.sh <key> walk 5,6,7,7,5,6,7,7` (8번 칸은 별 자국이 남기 쉬워 뺌).
- 동작 시트가 **참고 시트의 사람(아령)으로 바뀌는** 일 → 문안에 "NOT the person of IMAGE 1" 이 들어 있다. 그래도 바뀌면 `skit.say('Wrong person …')`.
- 찌르기 칸에서 **창이 뒤를 향하는** 일 → `skit.say` 로 3·4번만 고쳐 달라. 창끝이 칸 밖으로 나가면 띠에서 잘린다(받아들일 만함).
- 무릎 꿇은 걷기 칸("down" 을 앉기로 읽음) → 칸 고르기로 뺀다.
- 제미나이 「이미지 만들기」 메뉴 칸은 JS 클릭이 자주 헛돈다(setup 결과 wide:false) → 진짜 클릭: 새 대화의 + (658,352) → 메뉴를 확대해 「이미지 만들기」 자리(계정마다 y 495~524)를 누른 뒤 비율·파일 칸만 JS로
- 「원본 크기 다운로드」 단추는 자동화에서 내려받기가 안 될 때가 있다 → `skit.grab` (캔버스, 1024×572 → clean.py 가 1376×768 로 키움).

## 파일

- `gemini-kit.js` — 브라우저 쪽 (setup · send · say · grab · 문안 틀)
- `cut.sh` + `clean.py` — 받기·초록 빼기·별 지우기·8컷 띠
- `compose20.py` — 걷기 8 + 동작 8 → 20컷 (서 있기 4 · 걷기 8 · 공격 6 · 맞음 · 쓰러짐)
- `realm-finish.py` · `register-realm.sh` — 칠십팔국 어댑터 (art.ts GEN_ANIM/GEN_OWN · battle-strikes CONTACT)
- `heroes/*.json` — 명세 묶음

## Veo (Jay u/4 · 하루 한도가 있다)

> ★ **11-13 형: 모델을 Argon 으로 바꿔야 된다.** 새 대화의 모델 고르기(입력칸 옆 · Flash/Pro/Argon)에서 **Argon** 을 고른 뒤 「동영상 만들기」로 보낸다. 기본 모델로 보내면 「I'm having a hard time…」·「encountering an error」·「full capacity」로 거의 다 실패했다 — 그걸 그림 탓으로 오해해 15세+그림체 판을 새로 구운 것은 헛수고였다(원래 각성 그림으로 돌림). 영상은 **원래 각성 그림**으로.
> ★ **11-13 형: 「Sorry, something went wrong」·「encountering an error」가 나오면 같은 대화에 한 번 되묻는다** — 형이 가비 대화에 「왜 안 돼? 비디오 못 만들어 너?」라고 치자 구워 줬다. 새 대화로 다시 내지 말고 그 대화에 짧게 한 번(「왜 안 돼? 비디오 만들어 줘」). 그래도 안 되면 그때 실패로 적는다. 「out of videos」 한도 띠가 떠 있으면 되묻지 않는다.
> 얼굴이 웃는 채 얼어 버리면 문안의 얼굴 고정이 너무 센 것 — 원장 문안 끝에 「FACE LIFE」 절(깜빡임·눈 움직임·숨 따라 풀렸다 돌아오는 미소)을 붙였다(-l.txt).

- `sh tools/sprite-kit/veo-next.sh` → 다음 일을 claim · 문안을 `tools/out/veo-prompt.txt` 로 (브라우저 업로드는 작업 폴더 안 파일만 된다) · `IMG` 경로를 찍음
- 탭: 새 대화 → **진짜 클릭**으로 + (658,352) → 「동영상 만들기」(720,524) (JS 클릭은 이 메뉴에서 자주 헛돈다 · 첫 클릭이 안 먹으면 한 번 더) → `가로` 단추 → 「세로 모드」 → 동영상 화면의 + (659,597) 로 파일 칸을 만들고 이름표 `vfile0` · 내 칸 `skit-text`
- file_upload: `vfile0` ← 사진, `skit-text` ← `tools/out/veo-prompt.txt` → `LOAD; await skit.sendVeo()` (사진 1장·세로가 아니면 안 보냄)
- 주소가 `/app/<id>` 로 바뀌면 `veo-next.sh done <job> <url>`
- 받기: 대화를 열고 `LOAD; await skit.grabVideo(<대화 id 앞 8자>)` → scratchpad veoget.sh 처럼 `~/Downloads/veo_*.mp4` 를 outputs 로 옮기고 downloaded · `tools/veo/motion.py` 로 얼음·튐 검사
- 「동영상 만들기」가 흐리게 잠기면(aria-disabled) 한도 → 잡아 둔 일은 `veo-next.sh held` + 같은 문안으로 새 job · `queue.mjs cooldown`
- **동영상 화면의 + 자리(658,352)를 누르면 템플릿 카드가 눌린다** → 다른 그림이 붙으면 보내지 말고 새 대화
- Argon 은 보낸 뒤 대화 주소가 1~4분 늦게 뜬다 — **다시 보내지 말 것** (겹쳐 나간다 · 11-10 가비)

## Veo 둘째 길 — Google Flow (형 계정 roqkfeke12 · 크레딧 · Gemini 한도와 따로) · 11-10 첫 시험
- 프로젝트: https://flow.google.com/project/252c3f46-4e13-4c10-a4ba-cef09167cfa6 · 오른쪽 에이전트 채팅에 시킨다
- 에이전트 설정(입력칸 조절 아이콘): 동영상 9:16 · x1 · 「생성 전에 확인: 항상」 (크레딧을 보고 승인). **Omni 1.2 Flash 만 쓴다** (10초 · 한 편 30 크레딧 · 720×1280 · 24fps · 워터마크 안 보임 · 형: "veo 랑 거의 비슷"). Veo 3.1 은 8초까지이고, 시험해 보니 정사각 그림을 9:16 가운데에 두고 위아래 검은 띠 · 오른쪽 아래 Veo 워터마크 · 얼굴이 바뀜 (누리 11-10)
- 크레딧은 계정마다 달마다 · 11-10 roqkfeke12 두 편(고운 Omni · 누리 Veo 3.1)에 「크레딧이 소진」 · retyper92(u/1 · 프로젝트 8e32fb8d) 은 Omni 한 편(누리) 뒤 「사용량 한도에 도달」 · hepastosian(u/2 · 프로젝트 b9ec4f34) 도 한 편(구름) 뒤 한도 — 계정마다 Omni 한 편 · 갱신 뒤 다시
- 그림 붙이기: + → 「미디어 업로드」는 파일 창이 뜬다 → 먼저 JS 로 `HTMLInputElement.prototype.click` 을 가로채 file 칸을 화면에 붙이고(aria-label `flowfile`) file_upload → 처음 한 번 「이 이미지를 사용할 권리」 동의(형이 함) → 「프롬프트에 추가」
- 문안: 내 칸 `skit-text` 로 파일을 올려 `[contenteditable=true]` 에 insertText (앞에 "Make ONE image-to-video clip … Omni 1.2 Flash, 10 s, 9:16, 1 output … use this prompt exactly") → 보내기 → 크레딧 승인 → 몇 분
- 받기: 결과 칸을 열고 오른쪽 위 다운로드 → 720p 원본 → `~/Downloads/<제목>_<8자>.mp4` · 원장은 `--account flow-roqkfeke12` 로 claim (u/4 쿨다운에 안 걸린다) · submitted 의 주소는 Gemini 꼴만 받아 `https://gemini.google.com/app/flow-<결과 id 앞 8자>`

## 챗지피티 (사람 그림 · 무료 계정만 · roqkfeke12·Jay 금지)

- `gpt-kit.js` + `heroes/gpt-1108.json`(초상 둘 + 비기 전신 열둘 문안) — 설치는 위와 같이 임시 file input 으로 `localStorage.gkit`·`gkitSpec`
- 한 장: 새 대화 → find 「사진 첨부」 → file_upload(명세의 ref) → `gkit.send(key)` → `gkit.wait()` → `gkit.grab(id)` → 초상이면 `sh tools/sprite-kit/install-bust.sh <id> <나이> <장수 키> "<설명>"`
- **함정: 새 대화 입력칸에 지난 문안 초안이 남아 있다** → `gkit.say` 가 먼저 비우고 길이를 잰 뒤에만 보낸다 (11-08 두 문안이 붙어 나가 한 장을 날림)
- **함정: 새 대화를 열자마자 find 한 「사진 첨부」 ref 는 페이지가 다시 그려지며 사라진다** → file_upload 가 실패한 채 문안만 나가 엉뚱한 사람을 그린다(11-08 밤 감나무). `gkit.send` 는 입력칸에 사진이 없으면 안 보낸다 — 실패하면 find 를 다시 해서 올린다
- 「보내기」 단추는 첨부가 올라가는 동안 없다 → 나타날 때까지 기다린다
- 무료 한도는 하루 두세 장일 때도 있다 · 한도 문구의 시각을 ART-QUEUE 맨 위 장부에 그 자리에서 적는다
