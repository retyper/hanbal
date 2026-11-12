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

## ★ 11-12 새 틀 — 동작 시트는 3×2 가로 칸 (형: 「머리 잘림 · 창칼 짧음 · 비효율」)

뿌리 둘을 확인했다. ① 머리 잘림은 compose20 이 칸(160)보다 큰 컷의 위를 잘라서(106띠 중 50 · refit20.py 로 44띠 고침). ② 창·칼이 짧은 건 4×2 세로 칸(344×384)에 사람을 **가운데** 세워서 찌르기 칼끝이 옆 칸으로 넘어가고, 넘어간 끝은 못 살려서. 키 빼기는 멀쩡했다.

- **동작 시트는 `act6`**: 3열×2행 = 6컷(준비·당김·찌름·마무리·맞음·누움) · 칸 460×384 가로 · **사람은 칸 왼쪽 40%, 오른쪽 60% 는 무기 자리** · 참고 시트 `ref-act-3x2.png` 를 그 메시지에 첨부(11-12 다시: 키 안 뺀 제미나이 원본 3×2 그대로 · 처음 판은 아령 띠를 키워 흐리고 옷의 초록 테가 키에서 빠져 몸속이 초록 구멍이었다 · **참고 시트는 초록 옷 없는 사람·키 안 뺀 원본으로**) · 한 장에 컷을 적게 넣어 퀄리티도 올린다.
  - `LOAD; await skit.send('act6', key)` (첨부 1장 없으면 안 보냄) → grab → `sh tools/sprite-kit/cut.sh <key> act6` → `NACT=6 sh tools/sprite-kit/register-realm.sh <key> "…"` (compose 는 1,2,3,3,4,1,5,6 으로 20컷을 짠다 · 회복 컷은 준비 자세).
- 걷기는 4×2 그대로(무기는 어깨에 · 보폭이 칸에 든다).
- **넣기 전 검사(필수)**: 머리가 칸 위에 닿은 컷 0 · 무기 끝이 칸 벽에 닿은 컷 0 — 받자마자 `py -3 -X utf8 tools/sprite-kit/check-strip.py <key>-act6-key.png 3 2` (칸 경계에 무기가 걸쳤으면 다시 굽는다 · `skit.say` 로 그 칸만 고쳐 달라) · 합친 뒤 `check-strip.py gen-<key>.png 20`. 축소 화면만 보고 넘기지 말 것.
- 옛 `act`(4×2) 길은 남겨 두되 새로 굽는 건 전부 act6.

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
