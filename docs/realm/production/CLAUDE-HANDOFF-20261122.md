# Claude 이어 하기 · 2026-11-22 새벽

역할: **Codex = 그림 생성만 · Claude = 코드 · 영상(브라우저 Flow/제미나이) · 그림 검수·게임에 넣기 · 커밋**(명령 ### 64 · 67).
Codex 명령 문서: `docs/realm/production/CODEX-SKILLBODY-REDO-20261117.md` 맨 끝 ### 번호. Codex 보고: `D:/에셋창고/CODEX-TO-CLAUDE-LATEST.md`.

## 배포된 것 (11-21 밤 ~ 11-22 새벽)
- 열전 승패 영상 13명(`src/raid/ending-video.ts` clips · 넣는 도구 `tools/veo/ending-install.py <그림id>`). 쇠비는 덩이쇠 지킨 v2.
- 시작 화면 「아무 키나 누르세요」(`src/ui/realm/startgate.ts`) · 배경 `public/realm/title/start-16x9.jpg`·`start-9x16.jpg` = 키 아트 v2(주몽 시위 당김 없음 · 쇠비 노출 올림). 영상 자리 `start-*.mp4` 비어 있음 → **새 키 아트로 Flow 10초 루프 내기(처음=끝 같은 그림)**.
- 데려갈 장수 얼굴 링(`src/ui/realm/hero-ring.ts`) · 단련터·열전 출전 고르기는 아직 옛 화면(`ringCard` 로 옮기면 됨).
- 열전 걷기·공격 몸놀림 코드(`src/raid/hero-motion.ts` · `HAEBI_ANIM`).
- 걷기 4칸이던 24명 → 8칸(`tools/sprite-kit/walk8-intake.py` · `anim-px` 만 · anim2 는 옛 옷 띠가 있어 손대지 않음) · 매화 각성 걷기 서기에 맞춤 · 걷기 6칸 띠 107개 남음.
- 쇠비 진각성 그림 사슬 쇠망치판(`awaken2-hd`·`awaken2`) · **진각성 대기 영상(awaken2-loop)은 옛 덩이쇠 판 → 새 그림으로 다시 내기.**
- 물안개 여울 바탕 가을판.
- 각성 대기 영상 등록: 고구려 소나 · 늙은 대소.

## 진행 중 · 다음
- 56-C 목책을 진짜 물건으로(코드 갈래 · 바탕 `D:/에셋창고/codex56/palisade-sunset-ground` · 말뚝·부서진 말뚝·문). 끝나면 합치고 배포.
- Codex 67 그림 줄: 공격 8칸 6명 → 넣는 도구 만들기(걷기처럼 칸 12~17 · 박자 표는 hero-motion 과 맞출 것) · 흑룡 부위(`D:/에셋창고/codex55/blackdragon`) → 55 거대 보스 코드 · 정예 다섯 · 51(해적 주인공 시안·갈래 테두리·새 적 열다섯).
- 영상(크레딧 매일 오후 갱신 · Jay Flow 11-28): 시작 화면 10초 · 쇠비 진각성 대기 · 남은 장수 승패. 정책 거절(노출 큰 그림)은 돌려 쓰지 않음: 감실 승리 · 탈해 너울 각성 대기. 제미나이 Jay 는 모델 Neon(Argon 사라짐) · 오류면 같은 대화에 한 번 되묻기 · 하루 한도 걸리면 멈춤(아도간 held).
- 형 판정 대기: 승패 영상 장면표 `D:/에셋창고/승패영상-전체-20261121.jpg`.

## 디스크
- D: 남은 곳 ~16GB(코드 갈래 작업 공간이 한 벌에 ~3.5GB · 다 쓰면 `git worktree remove`) · `dist` 는 빌드 결과(지워도 됨).
- C: 18GB · Codex 그림 원본을 `D:/에셋창고/codex-generated-images` 로 옮김 · 옛 Codex 대화 기록(~8GB)은 형이 직접 지우기로(안전 장치가 막음).
