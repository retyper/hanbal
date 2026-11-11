# desktop/ — 삼한열전 데스크톱 포장 시제품 (Electron)

웹판(realm.html)을 Windows 실행 파일로 감싼다. **게임 루트 package.json 의 런타임 의존성은 0 그대로**이고, Electron 은 이 폴더의 devDependencies 에만 있다. `src/` 는 건드리지 않았다.

## 구조
- `main.cjs` : 창(1280x800, 최소 960x600, 메뉴 없음, F11/Alt+Enter 전체화면, ESC 는 게임에 맡김) · 단일 실행 잠금 · `app://game/` 프로토콜(standard+secure, fetch·Range 지원)
- `build-game.mjs` : 루트에서 `vite build --outDir desktop/game` (base `/` 그대로라 Pages 배포와 충돌 없음) 뒤 `_tmp`·`sw.js`·카톡 원본·검토용 `.x-*.mp4` 를 덜어낸다
- `preload.cjs` : 비어 있음. steamworks.js 다리가 들어갈 자리
- `verify.mjs` / `verify-main.cjs` : 숨긴 창 자동 검수

## 쓰는 법 (C: 가 차 있으면 아래 환경변수를 D: 로)
```
set TMP=D:\tmp-node & set TEMP=D:\tmp-node
set ELECTRON_CACHE=D:\tmp-node\electron-cache & set electron_config_cache=D:\tmp-node\electron-cache
set ELECTRON_BUILDER_CACHE=D:\tmp-node\electron-cache\builder
cd desktop && npm install
npm run build:game     # 웹판 → desktop/game (약 4분)
npm start              # 개발 실행   (루트에서는 npm run desktop)
npm run pack           # dist/win-unpacked/삼한열전.exe
node verify.mjs            # 개발 실행 검수
node verify.mjs --packed   # 포장본 검수
```
저장 위치를 바꾸려면 `SAMHAN_USER_DATA=경로`. localStorage 는 userData 의 `app://game` 출처에 남는다.

## 검수한 것 (2026-11-11, Windows 10, Electron 33.4)
개발 실행과 포장본 모두 8개 전부 통과.
1. 제목 화면 렌더 (스플래시 걷힘, 캡처 PNG 1.1MB) — D:\tmp-node\desktop-title.png
2. `realm/awaken-loop/w-31-dabeol-dalbit.mp4` (H.264 720x1280) 재생: readyState 4, currentTime 진행
3. AudioContext 생성·running (48kHz)
4. localStorage 쓰기 → 종료 → 재실행 → 값 유지 → 시험 키만 제거 (`clear()` 안 씀)
5. 두 번 모두 종료 코드 0

## 크기
- 게임 빌드(desktop/game): 약 1.8GB (public/realm 이 1.9GB 원본, 그중 awaken-loop 영상 784MB · awaken2-loop 177MB · sfx 193MB · voice 149MB)
- 포장본 win-unpacked: 약 2.1GB (Electron 런타임 약 300MB + 게임). `compression: store` 로 영상 재압축은 안 한다
- 참고: 루트 `dist/` 는 오래된 빌드라 기준이 아니다

## 알려진 위험
- **용량**: 2GB 급은 Steam 에는 허용되나 다운로드 부담이 크다. 영상 재인코딩(CRF 올림)·미사용 파일 정리·DLC 분리 검토 필요
- **미검수**: 단일 실행 잠금·F11 전체화면·창 크기 복원은 코드만 있고 자동 검수 없음(숨긴 창 한계). 눈으로 한 번 확인 필요
- **미서명**: exe 서명 없음 → SmartScreen 경고 가능 (Steam 배포본은 보통 무관)
- 서비스 워커는 `app:` 에서 켜지지 않는다(https 에서만 등록). 웹판 자동 갱신 알림(update.ts)이 데스크톱에서 어떻게 보이는지 확인 안 함
- 항상 보이는 창이 아닐 때 rAF 가 멈추는 규칙 4 는 데스크톱에서도 동일하게 적용됨(최소화 시 정지)
- 검수는 하드웨어 GPU 가 있는 이 PC 한 대. 저사양·Steam Deck 에서의 프레임은 미측정

## 다음 (Steam)
1. steamworks.js 로 업적·오버레이·클라우드 세이브(userData 또는 localStorage 내보내기) — `preload.cjs` 에 contextBridge 로 노출, Steam 앱 ID 는 형이 만든 뒤에
2. Steam Deck(Proton): 같은 Windows 빌드를 Proton 에서 실행 — 영상 코덱, 창/전체화면, 소리 지연, 저장 위치 확인. 데크 화면 1280x800 에 맞는 UI 크기
3. 컨트롤러: 게임 입력은 마우스·터치 중심 — Gamepad API 로 커서 이동·확정·취소 매핑, 스팀 입력 기본 설정 추가
4. 영상·음성 용량 줄이기, 다국어(src/i18n) 반영 후 재빌드
5. 설치기(NSIS) 대신 Steam 이 depot 로 올리므로 `win-unpacked` 폴더가 그대로 depot 내용
