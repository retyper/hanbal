# 챗지피티 굽기 꾸러미 — 에이전트용 절차 (11-10)

한 카드 = 새 대화 하나. 크레딧이 돈이다: 카드마다 **한 번만** 굽고, 결과가 어긋나도 같은 카드를 다시 굽지 않는다(보류 목록에 적는다).

## 준비 (한 번)
- 꾸러미: `node tools/bake-pack.mjs` → `tools/out/bake-pack/index.html`. 카드 차례는 그 파일의 `<article data-k="gpt-<저장이름>">` 순서. **초상(gpt_bust-)·1차(gpt_aw1-) 카드가 2차(gpt_aw2-)보다 먼저.** 넣은 뒤엔 `node tools/bake-pack.mjs` 를 다시 돌려야 다음 단계 카드(RECAST)가 나온다.
- 카드 하나 뽑기: `node tools/sprite-kit/gpt-card.mjs <저장이름>` → 첫 줄 JSON = 첨부할 그림(윈도 경로) · 문안은 `tools/out/gpt-card.txt`.
- 챗지피티 탭 id **640634232** (크롬 bcba6fe9). 다른 탭은 건드리지 않는다.

## 카드 한 장
1. `navigate https://chatgpt.com/` → 3초 → JS:
   ```js
   const n=[...document.querySelectorAll('script[nonce]')][0]?.nonce; if(!window.gkit && localStorage.gkit){const s=document.createElement('script'); s.nonce=n; s.textContent=localStorage.gkit; document.head.appendChild(s);} let t=document.getElementById('gtxt'); if(!t){t=document.createElement('input');t.type='file';t.id='gtxt';t.setAttribute('aria-label','gpt-text');t.style.display='none';document.body.appendChild(t);} typeof window.gkit
   ```
   `object` 가 아니면 로그인 화면이다 → 멈추고 보고.
2. 입력칸(화면 가운데, 대략 (900,375)) 클릭 → `ctrl+a` → `Delete` (지난 초안이 남아 있다).
3. `find "사진 첨부 file input and gpt-text file input"` → `file_upload` 로 그림(들)을 「사진 첨부」 ref 에, `tools/out/gpt-card.txt` 를 `gpt-text` ref 에 올린다. **ref 는 매번 새로 find** (페이지가 다시 그려지며 사라진다).
4. 3초 기다림 → 「파일이 채팅에만 추가됨」 알림이 뜨면 ✕(대략 (932,290)) 클릭 → 입력칸 클릭 → JS:
   ```js
   const a = gkit.attached(); const t = (await document.getElementById('gtxt').files[0].text()).replace(/\s*\n\s*/g,' ').trim(); a < N ? 'ATTACHED ' + a : JSON.stringify(await gkit.say(t)) + ' att=' + a
   ```
   N = 첨부 그림 수. `ATTACHED k` 면 그림이 덜 붙은 것 → 3번부터 다시(한 번만). `{"sent":false,"why":"length"}` 면 초안이 남은 것 → 2번부터.
5. 기다림: JS `JSON.stringify(await gkit.wait(35))` → `{"done":true}` 까지(여러 번 불러도 된다). 그 뒤 5초 더 기다려 JS `JSON.stringify(await gkit.grab('<저장이름에서 gpt_ 뺀 것>'))` → `~/Downloads/<저장이름>` 이 생긴다. `{"limit":...}` 나 화면에 「이미지 생성 제한」이 보이면 **멈추고 풀리는 시각을 보고**(docs/realm/ART-QUEUE.md 맨 위 표에 적는다).
6. 검수: 새 그림과 원본(1차는 `public/realm/bust-hd/<id>.jpg`, 2차는 `public/realm/awaken-hd/<id>.jpg`)을 나란히 400×400 으로 붙여 보고 **같은 사람인가 · 활시위 당기는 자세가 아닌가 · 손가락·무기가 멀쩡한가 · 가슴 천이 비치지 않는가(15세)** 를 본다. 어긋나면 넣지 말고 `~/Downloads/<저장이름>` 을 `assets_src/realm/gemini/generals2/try/` 로 옮기고 보류 목록에 까닭을 적는다.
7. 넣기: **방금 받은 그 파일 하나만** 따로 담아서 넣는다 — `mkdir -p tools/out/intake-one && mv ~/Downloads/<저장이름> tools/out/intake-one/ && BAKE_DL=tools/out/intake-one timeout 300 sh tools/bake-intake.sh` (커밋·푸시까지 한다). 그다음 `node tools/bake-pack.mjs`.
   ⚠ **`BAKE_DL` 없이 그냥 돌리면 형 Downloads 전체를 훑는다** — 11-13 00:2x 옛 「gpt_aw2-*(1).png」 여섯 장이 딸려 들어가 지금 진각성 여섯 장을 갈아 끼웠다(옛 그림은 -b.jpg 로 남음). Downloads 의 다른 파일은 절대 건드리지 않는다(메모리 downloads-folder-hands-off).
   · `gkit.grab` 이 이름을 `gpt_aw1-….png.png` 처럼 붙일 때가 있다 → 저장이름과 똑같게 바꾼 뒤 옮긴다.

## 보고
- 넣은 카드 / 보류 카드(까닭) / 한도 문구와 시각 / 계정이 바뀐 흔적(새 대화가 다른 계정 이름으로 뜨면 그대로 쓰되 적는다).
- 한 카드에 두 번 실패하면 다음 카드로 넘어간다. 전체 3장 연속 실패면 멈추고 보고.
