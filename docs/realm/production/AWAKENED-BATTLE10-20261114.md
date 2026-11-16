# 각성 1차 전투 에셋 10종 — 2026-11-14

- 요청: 비각성 전원 완성 후 각성 장수 약10종 제작. 자녀 제외. 기존 dirty 변경과 물새 기존 그림 보존. 소리 재생 없음.
- 완성/게임 반영: 해비, 소서노, 감실, 미르, 단궁, 아라, 주몽, 온조, 견지 버들(w83), 허황옥. 현재 canonical `awaken-hd`의 각성1차 원화를 참조. 미르는 사용자가 교체한 보라색 한복/활 원본 사용.
- 내장 image_gen 총11회, 캐릭터별1회. 10종 채택. 알영은 공격부터 창이 활로 바뀌고 일부 창 끝 여백 부족으로 **held/미적용**. 자동 재생성 없음. 기존 알영 그림 유지. 다른 대상 허황옥을 추가해 10종 확보. 주간 사용률/크레딧 수치는 확인하지 않았으므로 추정하지 않음.
- 기준: 승인 알영·해비·소서노의 작고 성인다운 체형/얼굴 가독성. 4×5 20자세, 서로 다른 작화 idle3, 이동6, 돌진·공격·회복·막기2·비틀거림2·피격·쓰러짐. 160px cell/138px 기본 신장, 무기별 전용 동작. 미르는 작은 회색 바닥 표식이 남아 있는 경미한 한계.
- `generalSprite`가 ascended일 때 등록된 전용 `aw1-*` key 선택. 일반 장수/미등록 각성 장수/동일 그림을 쓰는 alias는 기존 fallback 유지. `GEN_OWN` 기본 매핑 불변. 본편·겨루기 atlas·접촉 위치·도끼/검/활 FX 연결. 이번 각성1차 도트를 별도 2차 도트가 생기기 전까지 공통 각성 표현으로 사용.
- source/queue/prompts/receipts: `tools/sprite-kit/awakened-20261114/`. 개별20자세 직접 시각 검토 후 accepted 등록. 원화 손대지 않고 공통 `bake-full20.py` 재사용. `install.py` → named `sprite-normalize.mjs`로 main/duel/metadata 생성. repair-pilot dispatcher에 `awakened20-master`를 추가해 재굽기 보존. 알영 held 원본도 보존.
- 코드: `src/realm/data/awakenedSpritesGenerated.ts`, `art.ts`, `src/duel/fighter-motion.ts`, `src/ui/realm/battle-strikes.ts`. 무음 fixture `tools/battle-sprite-review.html?hero=haebi&ascended=1`에 각성 단계 선택 추가.
- 검수: 관련 Node20시험 통과, 새3시험 타입 수정 후 재통과. `npm run build` (타입검사 포함) 통과, bundle budget gzip1420.4/1600KB. 기존 unresolved font/tile/run-strip 경고는 빌드에 남음. 400 main/duel frames 경계·idle3·원본SHA검증 통과. 해비/미르 repair dispatcher 재굽기 PNG byte 동일.
- 실제 Chrome 무음: 10종 각성 key 선택 확인, 해비/미르 paired14접촉, 대표 이동/대기 확인, console warn/error0. 모든 캐릭터/적 조합과 모바일 실제 기기 성능은 미검증. 사용자 미감 평가는 아직 받지 않음.
- 산출물: 채팅 outputs/awakened-battle-10/index.html, overview.png, 각 캐릭터 비교PNG/idle·walk·attack GIF/20자세PNG/프롬프트. haebi-muted-battle.png, mir-muted-battle.png. 생성중0, 설치10, 보류1. commit/push/배포/새 영상 제출 없음.
- 다음: 사용자 미감 평가에 따라 선별 교정. 알영은 사용자 판단 없이 같은 대상 자동 재생성하지 않음. 기존 비각성210종과 물새 keep-original 결정은 변경하지 않음.
