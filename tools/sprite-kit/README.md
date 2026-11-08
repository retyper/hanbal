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

## 알아 둔 함정 (11-08)

- **참고 걷기 시트가 곧 결과다.** `pirate-run.png` 는 여덟 칸이 거의 한 자세라 결과도 한 자세로 굳었다(그 시트로 만든 11-08 오전 띠들은 다시 구울 거리). 지금은 `generals2/aryeong-walk.png`.
- 그래도 제미나이 무료(Flash)는 **줄마다 같은 자세 넷**을 자주 낸다 · 참고 시트의 **줄마다 다른 쥐는 법을 그대로 베낀다**. 창은 「어깨에 멘」 아랫줄만 쓰면 된다: `cut.sh <key> walk 5,6,7,7,5,6,7,7` (8번 칸은 별 자국이 남기 쉬워 뺌).
- 동작 시트가 **참고 시트의 사람(아령)으로 바뀌는** 일 → 문안에 "NOT the person of IMAGE 1" 이 들어 있다. 그래도 바뀌면 `skit.say('Wrong person …')`.
- 찌르기 칸에서 **창이 뒤를 향하는** 일 → `skit.say` 로 3·4번만 고쳐 달라. 창끝이 칸 밖으로 나가면 띠에서 잘린다(받아들일 만함).
- 무릎 꿇은 걷기 칸("down" 을 앉기로 읽음) → 칸 고르기로 뺀다.
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
- 「동영상 만들기」가 흐리게 잠기면(aria-disabled) 한도 → 잡아 둔 일은 `veo-next.sh held` + 같은 문안으로 새 job · `queue.mjs cooldown`
- **동영상 화면의 + 자리(658,352)를 누르면 템플릿 카드가 눌린다** → 다른 그림이 붙으면 보내지 말고 새 대화
