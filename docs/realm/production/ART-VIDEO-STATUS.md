# 그림·영상 작업 상태판 (11-13 14시 기준 · Claude → 챗지피티 인계)

> 형 11-13: 「제미나이나 flow, 챗지피티 등 니가 한 일, 앞으로 해야 할 일 진행 사항 md 로 저장해. 챗지피티한테 시킬게 이제.」
> 이 파일 하나로 이어받을 수 있게 썼다. 더 깊은 절차는 각 줄의 링크.
> **Claude 쪽 예약(크론)은 모두 지웠다** — 두 쪽이 같은 계정을 동시에 쓰지 않게. 이제 이 일은 이어받는 쪽이 돈다.

---

## 0. 먼저 지킬 것 (어기면 형이 크게 화냄 · 다 실제로 터진 일)

1. **실패하면 원인부터.** 그림·문안·코드를 갈아엎기 전에: 마지막으로 성공한 설정 그대로 한 번 · 모델/계정 확인 · 형에게 직접 한 번 부탁. 확인 안 된 가설로 굽지 않는다. 끝나면 **계정별 성공 N · 실패 N · 실패 문구 원문**을 숫자로 보고.
   - 11-12~13 Veo 실패의 진짜 원인은 **모델을 Argon 으로 안 고른 것**이었다. 그걸 「그림이 실사 같아서」로 오해해 15세+그림체 판을 굽고 게임 그림까지 바꿨다가 되돌렸다.
2. **에이전트에게 맡길 땐 README 의 ★ 줄을 그대로 붙인다**(기억으로 다시 쓰지 않음). `tools/sprite-kit/README.md` 「★ 계정」「Veo」 절.
3. **Downloads 는 형 폴더.** 이번에 새로 생긴 그 파일만 옮기거나 복사. 다른 파일·폴더째 지우기 금지. 넣기 도구는 `BAKE_DL=<한 파일만 둔 폴더>` 없이 안 돈다(걸쇠).
4. **제미나이는 한 번에 한 계정**(동시에 두 계정 → CAPTCHA·접근 제한 났었다). 사이 1~2분.
5. **로그인·약관·CAPTCHA·계정 고르기 화면은 누르지 말고 멈추고 형에게.**
6. **15세 판은 `assets_15` 에만.** 테스트 동안 게임은 원래 그림. 영상도 원래 각성 그림으로 만든다.
7. **영상은 받기만 하고, 게임 등록(`src/realm/data/awaken-art.ts` AWAKEN_LOOP)은 형이 「오케이」한 뒤.** 받은 파일은 `public/realm/awaken-loop/<heroId>.mp4`(있으면 `.2.mp4` · 덮어쓰기 금지).
8. 커밋은 한글, 하고 나면 바로 push. `git add -A` 금지(파일 하나씩). 화면 글에 긴 줄표(—) 금지 · 조사는 josa().
9. 브라우저는 **윈도 크롬 bcba6fe9** 만(맥 브라우저가 같이 붙어 있다 · 엉뚱한 데서 돌면 형이 못 본다).

---

## 1. 계정 표 (README ★ 계정 그대로)

| 무엇 | 계정 | 지금 상태 (11-13 14시) |
|---|---|---|
| 제미나이 **이미지** | u/0 · u/1 · u/2 · u/3(edu · Pro) · u/5 를 돌려 씀 · 한 번에 하나 | 새벽 02:3x: u/0·u/1·u/2 메뉴 잠김(한도) · **u/3 edu 는 이미지 만들기를 켜고 보냈는데 「I am a text-based AI」 거절 2번**(모델 칸 확인 못 함 → 다음엔 모델부터 볼 것) · u/5 는 됨 |
| 제미나이 **영상(Veo)** | **u/4 Jay 만 · 모델 Argon** | 하루 리듬: **세 편 보내면 「Create video」가 띠·시각 없이 잠기고, 첫 편 보낸 뒤 약 5시간에 풀림**(04:05→09:08 풀림 · 09:10→잠김). 형이 14:1x 에 직접 씀 → **19:1x 쯤 풀릴 것** |
| Flow (Veo 둘째 길) | u/0 · u/1 · u/2 · u/4 · u/5 (u/3 은 Flow 만 관리자 차단) | 크레딧 매일 갱신: u/0 14:33 · u/1 15:01 · u/2 15:14 · u/5 15:36 (각 20 · Omni 1.2 Flash 10초 = 30 이라 하루 한 편쯤) · u/4 Jay PRO 20 (11-28 갱신) |
| 챗지피티 | 형이 11-13 새벽 계정을 바꿔 둠(어느 계정인지는 왼쪽 아래 이름으로 확인) | 「사람」에게만 씀(사물·아이콘·이펙트는 제미나이) · 한도 장부는 `docs/realm/ART-QUEUE.md` 맨 위 표 한 곳 |

---

## 2. 11-13 에 한 일 (커밋)

**Veo 원인·걸쇠**
- Jay Veo 실패 원인 = Argon 안 고름 → 확인: Argon 으로 남장수 여섯(쇠물·맷눈·흠마루·협보·쇠돌·너른) **보냄 6 · 성공 6 · 오류 0**.
- `tools/sprite-kit/veo-next.sh`
  - 연속 실패 셋이면 다음 일을 안 내줌(`reset "원인"` 으로만 열림 · 기록 `outputs/veo-tripwire.log`)
  - `pick <job id>` (고른 일만)
  - claim 에 계정 이름(기본 `jay-u4` · `VEO_ACCOUNT` 로 바꿈)
  - 원장에 flow-any 로 잘못 적힌 Jay 시도 일곱 바로잡음
- **오류가 나면 같은 대화에 한 번 되묻기**(형: 가비 「왜 안 돼? 비디오 못 만들어 너?」, 한라 「뭐해 안 만들고. 계속해.」 → 둘 다 구워 줌). 「out of videos」 한도 띠일 땐 되묻지 않음.
- **짧은 「가상 인물」 문안**(형이 한라에서 확인): 긴 문안(4~5천 자 · 몸·가슴 문단)은 Argon 에서도 「실제 인물이 그런 상황에 있는 동영상은 만들 수 없습니다」 3번 → `She is a fictional painted character, not a real person` + 동작 하나 + 대사 금지(~1천 자) + 되묻기로 나옴. 남은 여인 16명 문안은 `node tools/veo/short-prompts.mjs` 로 만들어 원장 `-argon-20261113` 일에 붙였다.
  - 아직 시험 안 한 것: 문안의 출렁임 한 문장(「The motion runs through her whole body…」). 형: 「가슴 흔들림 없으니까 아쉬우니까 앞으로의 프롬프트들 좀 더 개선」. **첫 편에서 「실제 인물」 거절이 나면 그 문단만 뺀 판으로 새 대화 한 번**(원인 가리기).
  - 한라 영상엔 시키지 않은 대사(「깨어나소서 불길의 신령이여…」)가 들어갔다 → 형: 그대로 둔다. 새 문안엔 「Silent: no dialogue」.

**게임에 넣은 영상 (형 판정)**
- 신귀간 w-101(35b9b952)
- 한라 w-58(5a468462 · 형이 손으로)
- 가비 w-53(8898fca7 · 형이 손으로)

**지운 영상**
- 수로 g-96(475b1eca · 형: 팔이 셋 · 원본을 못 알아들음 → 다시 만들 것 · 옛 판 `assets_src/realm/retired/awaken-loop/`)

**그림**
- 15세 판으로 바뀌어 있던 1차 각성 열둘을 원래 그림으로(0f8e4433 여덟 · 21e84d78 넷 w-23·29·58·83 · 15세 판은 `assets_src/realm/retired/v15-revert` 와 `assets_15`).
- 손가락 고침: 한라·웅녀(hand-patch.py · 손 둘레만 제미나이 편집).
- 해비·원산 달래 달리기 시트 다시(u/5): 옷은 맞췄으나 **네 자세가 둘씩 같아 안 넣음**(받은 것 `assets_src/realm/gemini/generals2/<key>-r1.png` · 옛 판 `retired/act-redo/`).

**손굽기판** https://claude.ai/artifact/SyATaMDe8BemHxdHSokftF
- 실패한 1차 영상 장수 카드(원래 그림 · 짧은 문안 복사).
- 초록 딱지 = Claude 가 맡았던 여인 → 이제 이어받는 쪽 몫.
- 형은 딱지 없는 사내(수로·탈해·바다쇠·갯돌·갈미)부터.

---

## 3. 앞으로 할 일 (위가 먼저)

### A. Jay Veo — 실패했던 여인들 (형 「그래 해」 · Argon · 짧은 문안)
`sh tools/sprite-kit/veo-next.sh` 를 그냥 돌리면 원장 priority 차례로 나온다(옛 중복 일 열둘은 authorized=false 로 멈춰 둠). 지금 차례:

| 차례 | job | 장수 |
|---|---|---|
| 90 | t1-baekje-court-dancer-argon-20261113 | 연이 w-21 |
| 88 | t1-mujin-mudeung-argon-20261113 | 무등 w-48 |
| 87 | t1-iseo-sinae-argon-20261113 | 시내 w-61 |
| 86 | t1-mujin-munui-argon-20261113 | 무늬 w-40 |
| 85 | t1-mahan-pearl-diver-argon-20261113 | 물새 w-17 |
| 84 | t1-miri-dallae-argon-20261113 | 미리 달래 w-64 |
| 82 | t1-seonyeo-argon-20261113 | 선녀 L5 |
| 81 | t1-usisan-whale-queen-argon-20261113 | 고래여왕 w-23 |
| 80 | t1-siljik-mulga-argon-20261113 | 물가 w-50 |
| 80 | t1-yucheongan-v2-20261111 · t1-mulsae-v2-20261111-15 | 유천간 w-99 (새 얼굴로 다시) · 사로 물새 w-91 (15세 판 그림 → **원래 그림으로 바꿀지 형에게**) |
| 79~74 | bulmae · dangung · galmae · mir · janmul · beodeul `-argon-20261113` | 불매 · 당궁 · 갈매 · 미르 · 잔물 · 버들 |
| 60 | t1-tahae-neoul-argon-20261113 | 탈해 너울 w-103 · **게임 그림이 11-11 15세 판 → 형 판단 뒤** |
| 40 | t1-geota-v1-r-20261113 | 거타 g-11 (09:18 한도로 못 보낸 것) |
| (막힘) | t1-jumong-v1-20261111 | 주몽 · 원장 `sourceRepairDeferrals`(그림 손·무기·구도 검수 대기) — 누가 왜 건 것인지 형에게 |

보내는 법(영어 화면):
1. 새 대화 → 모델 **Argon** 손으로(기본이 Hydrogen 으로 뜰 때가 있음) → + → Create video → Portrait.
2. 사진 1장 → 문안은 JS 로 넣고 스크린샷 확인 → 보내기는 손으로. `skit.sendVeo()` 는 「세로」 글자를 찾아 영어 화면에선 안 보냄.
3. 주소 `/app/<id>` 뜨면 `veo-next.sh done`.
4. 2~4분 뒤 `skit.grabVideo` → awaken-loop → `py -3 -X utf8 tools/veo/motion.py` → 원장 downloaded → mp4 한 파일만 커밋.

### B. 형 판정 대기 영상 (awaken-loop 에 있음 · 게임 미등록)
- 쇠물 g-01 · 흠마루 g-04 · 협보 g-06 · 너른 g-10 — 움직임 좋음
- 맷눈 g-02 — 끝 두 장면에서 손의 활이 사라짐
- 쇠돌 g-08 — 끝 3초 「얼어감」
- 잔물 w-29 · 버들 w-83 영상은 15세 그림으로 만든 것 → 쓰지 않음(위 A 에서 원래 그림으로 다시).

### C. Flow
- 넘길 남자 일은 이제 거타뿐 · Jay 한도가 모자라면 Flow 크레딧(각 계정 하루 한 편)으로 A 의 뒤쪽을 나눠 낸다.
- 계정 이름은 `VEO_ACCOUNT=flow-u0` 처럼.
- Flow 절차: `tools/sprite-kit/README.md` 「Veo 둘째 길 — Google Flow」.

### D. 제미나이 이미지 — 전투 띠 (2×2 네 칸 판 · `tools/sprite-kit/README.md` · 메모리 sprite-cells-wide-few)
1. **해비 · 원산 달래 달리기(r1) 다시.**
   - 옷 참고로 `<key>-r3.png` 를 IMAGE 3 으로 붙이는 것은 통했다.
   - 문제는 자세다. 네 칸이 둘씩 같았다 → 문안에 「four clearly different phases, copy each mannequin pose exactly」를 더 세게, 또는 두 장으로 나눠 받기.
   - `figs.py list` 로 접촉 시트를 보고, 1·5번 다리 교대를 눈으로 확인한 뒤에만 넣는다.
2. 머리 닿은 옛 띠 여섯(w-bow · g-sword · g-spear · mount · soenun · sogeumbi): 원본이 없어 걷기까지 통째로 다시.
3. 찌름 컷에 무기가 칸 경계에 걸린 장수 61명(`docs/realm/ART-QUEUE.md` 「동작 띠 3×2 다시 굽기」 2순위 줄).
4. 웅녀 1차 손(689a73ae)은 거의 안 바뀌었다 → 손 둘레 다시.

### E. 챗지피티
- 꾸러미(`tools/out/bake-pack/index.html`)의 일반 카드는 다 끝났다.
- 남은 건 출시용 15세 판 카드 아홉(gpt15_*) — 영상 거절 회피용이던 이유는 사라졌고 출시용으로만 필요 → **구울지 형에게 먼저 묻기**. 구우면 `BAKE_DL` 한 파일 방식으로 `assets_15` 에만.
- 절차: `tools/sprite-kit/GPT-BAKE-RECIPE.md`.

### F. 형에게 물을 것 (답 전엔 손대지 않음)
1. 11-11 에 게임에 넣은 15세 판 1차 그림(다솜 w-18 · 사로 물새 w-91 · 변한 단비 w-98 · 탈해 너울 w-103)을 원래 그림으로 되돌릴지(형 허락 기록 못 찾음).
2. 주몽 영상 막힘 표시를 풀지.
3. 15세 챗지피티 카드 아홉을 구울지.
4. 오프닝 대본 v3(`docs/realm/OPENING.md`) 구현 — 새 그림 셋 + 내레이션 다시 녹음.

---

## 4. 파일·도구 지도
- Veo 원장: `C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code/outputs/veo-production-queue.json`(일) · `-state.json`(시도)
  - 명령: `node tools/veo/queue.mjs peek|claim|submitted|downloaded|review|cooldown|status`
  - 새 일은 JSON 에 직접 추가(replacesAttemptId 붙임 · 백업 `*.bak-20261113-*.json`)
- `tools/sprite-kit/veo-next.sh` · `tools/veo/short-prompts.mjs` · `tools/veo/motion.py` · `tools/sprite-kit/gemini-kit.js`(skit) · `tools/sprite-kit/figs.py` · `finish-strip.py` · `hand-patch.py` · `tools/bake-intake.sh`(BAKE_DL 필수)
- 장부: `docs/realm/ART-QUEUE.md`(한도 표 · 그림 줄) · 공통 상태판 `HANDOFF.md`
