# 마지막 적용 검증 — 2026-11-08 KST

## 로컬 완료

- 교정 원본33개 SHA256, 정규 HD/소형66 JPG SHA256 모두 영수증과 일치. raw PNG33개는 보존하고 assets_src/realm/repairs/2026-11-07 및 outputs/portrait-repair-originals-20261107.zip에 복사했다. ZIP 재열기33개 SHA도 일치. ZIP95835600B/SHA256 8b0704582bb9a1b275f564d44124000f1442e06606e8db705953f2ca1a6f161b. assets_src와 ZIP은 로컬 백업이며 GitHub에 원본 업로드됐다는 의미가 아니다.
- npm run build: 타입검사·Vite 빌드·번들예산 통과. gzip1194.9KB/1600KB, raw3796.2KB/5000KB. 기존 외부경로 CSS/리소스 및 큰 청크 경고가 있었으며 이를 전체 게임 시각 완주 검증으로 간주하지 않는다.
- 기존 general-sprite/strike/battle-strikes 19 tests PASS. 이번 변경은 영상 등록과 정지 초상 교체이며 전투 엔진 코드를 바꾸지 않았다.
- 실제 APP_CSS/HERO_CSS와 AWAKEN_LOOP/loopFile/bustOf를 가져온 로컬 전략회의 fixture에서 엄니·해달 모두720×1280/readyState4/시간진행/muted=true 확인. 주변부 마스크가 적용되고 정사각 삽입 없이 인물이 표시됨을 직접 시각 확인. proof: Windows outputs/final-adopted-videos-runtime-20261108.jpg. 전체 게임 흐름이나 청음·완벽루프 검수는 아님.
- 엄니 fc094928 게임 MP4 6958718B/SHA256 1cc902f881a3c734d03222ee19906d9440501f51415f60548b5cea9c0007a3ef. 해달6395203c 게임 MP45436524B/SHA256 14af9c922bc1417f59c866bcce31764e308bee27a3f738beb2380090bd83b5a9. 다운로드 원본 바이트 그대로, 크롭/패딩/재인코딩 없음.
- 박달ba87e32d·활미921590fb는 사용자 HOLD라 미적용, 별w62 기존MP4는 보존/등록만 해제. 달리 v3는HOLD,스프라이트 등록/게임파일 변경 없음.
- 라이브 Veo 큐20/시도16/accepted7/held9/active0/claim0. Jay 실제 다음한도11월8일03:54KST. veo-1 PAUSED. 사용자 요청으로 새벽 제작은 Claude 담당, Codex 예약 없음.

## 배포 확인

커밋·CI·공개 파일 해시 확인 결과는 아래 후속 기록에 덧붙인다. 이 로컬 검증만으로 공개 적용 완료라 주장하지 않는다.

## 공개 적용 완료 — 2026-11-08 00:18 KST

에셋 릴리스 커밋 `719e3c18ff4a556814997bd37ea700f6e607c37b`, GitHub Actions run `42385431285`는 서버 타입검사·전체 테스트·빌드·예산·Pages 배포 전부 SUCCESS다. 공개 version.txt=`719e3c18ff`, 교정 JPG66개와 채택 MP4 두 개 **총68파일 HTTP200·바이트/SHA256 일치**를 직접 확인했다. [검증 영수증](public-release-verification-20261108.json). 기존 사용자 변경2개도 작업 전 해시와 일치한다.

이후 문서 전용 커밋은 에셋 릴리스를 바꾸지 않는다. raw PNG33/ZIP은 로컬 보존본이며 GitHub에 올라간 것은 정규 JPG·채택 MP4·검수/인수인계 기록이다. 공개 게임: https://retyper.github.io/hanbal/realm.html
