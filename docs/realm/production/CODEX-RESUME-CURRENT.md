# Codex 재개 진행 · 2026-11-21

**사용자 재개 지시 적용, 작업 중.** 정본은 docs/realm/production/CODEX-SKILLBODY-REDO-20261117.md 끝 **56**. 순서 52→53→56-A→56-B→55→56-C→51→47/48. 불가사리는56-C뒤. 이미지 native만, 브라우저는 영상만. 모델 임의 변경0, 기존 RAW·사용자 변경 삭제0. 옛 PAUSED 문서는 역사 기록입니다.

## 완료 배포
- 52 e184fe3e / CI44829710166 성공·운영 확인. 이름26 c9d0d9a6 / CI44845623883 성공·운영 확인.
- 53-A **f6cc0b11e382f9d32fe11cdc79e003c30400d43c**, 즉시 push·CI **44858175718 성공**, 운영version **f6cc0b11e3**. HTML200·실JS/CSS6개 전부 로컬dist SHA 일치·주몽HDPNG200/SHA일치 확인. 전체1687(1685pass/0fail/기존skip2), 타입/관련22, build4972.8KBraw/1539.9gzip.
- CSS587.984375×378/backing1120×720→1176×756(DPR2), 내 장수94px 중간축소 제거/native160 보존. 주몽만 실제원본×2 HD3840×640/20칸/발312, SHA f775f616f674adc95b919e72aad4cebd093a9142cb54516319fc0ca148e2f772. 다나/각성해비 원본×2미달 목록. 적/판셈불변. 다나·주몽·각성해비 전후3쌍·PC사진/JS0, low/DPR1/HD실패fallback 통과. 실제각성/소유권/실폰FPS 증거 아님. rAF p95전15.1×3/후13.5·13.8·13.8ms는난수·시간대다름/인과개선주장0. D창고53A-NATIVE-CROPS.png 등3파일. 근거 Coutputs/codex53/HD-production-bundle-final.json.

## 53-B 배포 완료 · dbe8ad3091 · CI44865600981 성공
- 스테이지별 dash/slam/fan/summon/guard,50%2막·boss30%3막,1.25초틈/추가피해1.5,첫실명중만큰49반응(반복전체정지방지),실공격원점방패,부하2..4/진입공격0. 실제camera bounds8px양자화·기록재생, oldlegacybot SHA불변.
- 정예 상자 ground→opened→claimed/종료expire,20초내golden2선택/기타1,희귀상위합법칸·조합우선,XP/level/reroll불변·nonce중복click방지. 기존perElite12를실픽업금으로이동(stage/greed1회),결과정예옆실획득상자수. 기존장수·적이미지는그대로. 새closed ground기존그림, opened신규64PNG는동일byte설치/RAW보존.
- 눈에보이는붉은예고=실제geometry,정예이름판·기존HIT18/포효대체프레임. 실제사진의이름판/footer겹침→하단25%회피, RED9/10→GREEN10/10. 새고유dash/roar그림은아직없음.
- 53B기존최종boss1140초/총1200→1230(90초예산). **55에서는이boss를약10분중간boss로옮기고상자후계속,새거대boss가최종승리**로후속변경예정. 현재55 runtime미적용입니다.
- 독립검토: 철수때ground/선택잔류1건재현→공통expireChests로교정/관련33green. sim/기록최종34green·tsc0,뷰10green,rootfeedback2green+변이검사1fail,viewfan변이1fail. 기존trial/vanguard65초SHA유지.

### 전후40판과 수치보정 종료
정본 Coutputs/codex53B-prep/{before-encounters,after-encounters-v1,after-encounters-v2,after-encounters-v3-final}.json. 모두40판분모·complete/sourceStable. 5stage×4kit(axe/bow/spear/sword)×seed7,11/SHOP0/storm/REACT.5/dt1/60. observer SHA c9676a73bb946ed3f7234b958ba4ea7ef94f4c7311720eb4809254216c5c199b / legacybot6effa80630f6b7fe158b1d826d7679a5dd2b1e5c9b1cc68d86577cf41adffe16 불변. 새패턴을모르는옛봇이므로인간승률/몰라서맞음0을이표로주장하지않습니다. 게임시계기준·실wall/실폰FPS아님. 미도달/검열을0초로바꾸지않음.
- 승리 전→최종: 숲7/8→8/8,여울3/8→1/8(회귀공개),목책/설원/산성0/8그대로. 전체10/40→9/40.
- 정예 중앙초 전→후: 숲7.99→12.97,여울11.66→10.02,목책15.54→16.67,설원14.85→10.82,산성미도달. 개별전투전부10~20충족아님.
- 두목 중앙초: 숲7.03→44.13(8처치,목표45보다0.83~0.87초미달),여울13.92→53.67(1처치/5검열,일반화불가),다른3미도달. 허용수치보정2회종료/더튜닝없음.
- R1 첫2정예보존/300→600초선형으로후반HP배수숲·여울2.4/설원1.8. R2 숲bossHP10→11.5만. source/봇/seed맞춤0.

### 실제 플레이 화면
- Coutputs/codex53B-qa/run-01: 실제owned기본해비 출전→정예→ground사진→접근→동일상자선택폰360/375/390/412+844가로→선택끝→재개 **PASS**,182.611초/JS0/sourceStable. 강제HP·seed·시간·offer·ownership주입0.
- run-02(R1): UI/선택/폰트/코인/재개26개검사통과·JS0/sourceStable,폰5뷰카드15개hit·overflow0·실웹폰트loaded33. 실제금화6개animation running+opacity/transform이real100ms사이변하고게임시간은정지. 그러나ground생성과pickup이동일tick이라그바닥사진미확보1건으로 **도구overall ERROR** 보존(앱오류아님/거짓전체PASS금지). ground는run01별도증거. 최초2정예/상자조건은R1/R2에서불변. root가360/가로·실정예사진직접봤고opened아이콘가독/이름판footer수정확인.

### 현재 실행 중 · 다음 순서
- 첫전체 full-final-01.log:1720tests/1711pass/7fail/기존skip2. 옛20분·무료상자미포함점수상한·옛정예caption·수동옛windfixture기준이7실패. 6테스트파일을새규칙과정합교정하고정지양성대조·실고름계수등유지/skip추가0. 관련54중52pass/skip2,tsc0. 사유 compat-change-summary.json·실diff보존.
- root전체2회째 full-final-02.log 완료:1720tests/1718pass/0fail/기존skip2,211.299초. build-final.log 완료:raw4988.1KB/gzip1545.0KB/여유11.9KB. B-local-bundle.json 실HTML/JS·CSS6개/상자·주몽HDPNG200+SHA일치. 로컬version은timestamp/CI는GITHUB_SHA.
- 검사·빌드·local검증완료→53B화이트리스트만stage/commit즉시push→CI와운영version/JS/CSS/chest-open PNG검증. dist는현재B빌드중이며A before3사진은모두보존완료. root만dist/build/commit/push. 다음56-A/B코드GO는Bcommit뒤/55코드는그뒤,다음빌드는B운영검증뒤.
- 53B docs/realm/production/CODEX53B-RESULTS.md·docs/BALANCE.md 최종전후표/미달/회귀작성완료. BALANCE최종heading1회확인. 테스트/게임변경없는최종숫자는root가마감.

## 이미지 누적 · 이번 재개 작업
**14회/14RAW(native13+초기browser1), 전체·각부품재생성추가0.** 기존8에 opened상자1 +55pilot1+upperhead1+neck1+jaw1+tail1 추가. RAW영수증/refs실첨부SHA보존.
- openedchest: 실제원본56×56(SHA53eacfeb…), RAW1254×1254/64파생SHA0cc1d7be6a89b89abc5ea7ab843624626a0cdeaa7318cf7826e6b4ddaed46087. 독립smallcoreHOLD기록유지→root실제품CSS80/96/폰64에서가독확인·채택. public/realm/raid/chest-open.png 설치/아직미커밋. 원본무편집.
- 55 D창고55-imugi-{pilot-01,head-upper-01,neck-segment-01,jaw-lower-01,tail-tip-01}-native.png와json. Coutputs/codex55-art/각object/{native-raw.png,QA.md,PROMPT.txt,metadataJSON,QA-white/gray/black.png}.
- pilot1024×1536: 패딩부족·목분할불명확 runtimeHOLD, root RAW/white직뷰로canonical디자인reference승인. 전체pilot재생성0.
- upperhead1536×1024: 턱없는단일skull구조/본체안전여백PASS,root직뷰정체성승인. jaw1774×887단일하악/구조PASS,root직뷰+정확힌지정합은대기.
- neck1145×1374: 짧은마디보다긴7배판기둥이라최초목표HOLD유지. root직뷰로bodySkin/overlaprig시험후보에조건채택(무잘림/소켓폭거의같음/색일치). tail1536×1024: 실제잘림0이나패딩5.8~6.4%로원HOLD/연결시험후보. formal패딩과실잘림구분,RAW/알파/색수정0.
- 현재 raid51_sprite_prep이 **Coutputs/codex55-rig-qa**에 sourceRect+등방scale+회전·overlap만으로닫힌입/열림0·25·45도+13bone기계preview/피벗metadata준비중. 새imagegen0/제품0/RAW0변경,최대2기계배치교정. 이건assetfixture이며실게임/공격/HPbar/물리PASS아님. 임의creative편집·비등방늘임금지. 다음발주중복0/현재새생성동결.

## 55 준비 완료·미구현
- docs/realm/BOSS.md 신규완료(5보스×6수/각8열/1757어절). 연구 reports/거대 보스 전투 구조.md, research_notes/거대 보스 전투 구조/{dnf,arcade,myth}.md. 공식사실과창작수치/전승차이구분. **원작영상프레임미관찰**,내부ms아는것처럼주장0. 승률/시간목표는미검증제안.
- Coutputs/codex55-prep/ENGINE-CARDS.md·contracts.ts·multipart-core.mjs/test: 실제Mob1개+13 analyticpartcolliders/sharedpose 권장(가상부품Mob로XP/피해13배중복방지). core6green/중복피해guard mutant1fail,제품연결0. hit/nearest/모든AOE/자동무기/고속연속투사체를전수adapter화해야함. 6수/70·35phase/parts breakseal/actualcamera/하단HP/SHOP표/폰검수전부미검증. 이무기팔/날개0, BOSS문서앞발제안은첫이무기제외.
- 순서이무기완결/여울실플레이→흑룡→구미호→불의무녀장군→불가사리. 다른stage는자기giant준비전기존최종유지gating/새UI스위치0. 최종1140/enrage180/fightbudget240→총1380초는초기제안이라별도55전후표필수.

## 뒤 작업·보류·영상
- 54 다나승리RAW1(10초)·첫4초무음파생1,96/96프레임 QA완료. D창고victory_w-102-garak-dana.mp4 SHA0084047c312cc29442695b46514d1469a703c74eb4e705416e71d8921249f112. 패배기술오류2(최초+1retry)/반환0 held/자동재발주금지. 다른장수승패확장사용자판정뒤.
- Coutputs/codex54/integration-draft/ ending-video.ts/css/test+mainseam 준비: fakeRED11fail→GREEN12/12/heldguard변이1fail/strict타입0. 같은run영상유지/hidden재개·endedhold·오류fallback·latepromise차단. 제품연결·실autoplay·폰배치아직0. 원래49 ending3.8s/skip300ms유지/새버튼0. 55main통합과충돌하지않게root단독main작업.
- Flow시내는native열기창자동입력cache오류. 사용자수동경로열기만요청/회신없음. claim0/제출0/반환0, 마지막잔액관측50(현재미확인). 원장기존시내172held 그대로. **waitForEvent(filechooser/download) 전면금지**(과거6310/15880초hang). 로그인·비번·CAPTCHA·약관·결제제어0. Coutputs/codex54/FLOW-SINAE-RESUME54-BLOCKER.json. 코드와분리/재시도0.
- 카드3: D창고51-card-frames-candidates-20261121에RAW/WebP/meta. fixture10장조건부PASS/제품폰트없음예전404보존. slices84/96/112·tempo상단32,게임설치전/실폰5뷰후속. PirateC/D2 HOLD. Forest3회HOLD/같은실패추가재생성0,다른정예4/일반적15미생성. 47기수신협보·너울2재QA HOLD/기수신23그대로,신규수신수에더하지않음. HERO-AUDIT217명/HIT420실파일존재,각성173자기basefallback이며가짜missingHIT재발주금지.

## 경로·도구
Ctask=C:/Users/my/Documents/Codex/2026-11-17/detail-bad-request, Coutputs=Ctask/outputs. 프로젝트D:/flutter/arrow_game_one,창고D:/에셋창고. Git master/현재부모1f296907(Claude55·56docs/CI성공),53Bcommit준비. git -c safe.directory=D:/flutter/arrow_game_one, gh --repo retyper/hanbal. D쓰기/빌드·git/gh는사용자기허가범위 require_escalated로정식도구사용. Node22.19.0/npm10.9.3/PUBLIC_BASE=/hanbal/. DEV5174/preview5184/카드QA5176존재. 실Chrome프로브는동시에1개만/전용lock/C프로필만정리. getstate원문/자격증명기록금지.

주의: Coutputs/codex53/save-current.py는인코딩오류가발생해폐기한옛helper입니다. 실행하지말고본MD와실파일을정본으로사용합니다. 기존RAW·이전실패로그·PAUSED기록·사용자untracked삭제0. 할일다한뒤기다림/자동감시없이종료하라는사용자지시유지.
## 최신56 수신·미구현
영구각성힘(목책본인클리어/옛시련각성보존)·토글은모습만/기본켬·모든판내버튼투지로통일. 본편옛시련칸은진입스위치off로보존하고목책진행안내. localStorage clear금지/저장3경로시험. 그다음각성비기1.6~2초/2회차반/짧게설정/각성전신또는초상·보이스·7묶음FX·비교0.2초사진. 55그다음,56-C물리목책과여울호박+청록/목책황토sunset배경,불가사리는C뒤. 코드아직0/다음정식GO는53Bcommit후.

## 최신 배포 확정 · 53-B / 56-A 진행
- 53-B commit dbe8ad3091e67b62c2ce666c6d6839b6536c3b7e 즉시 push 완료. CI44865600981 success. 운영 version dbe8ad3091 / HTML200 / 실JS·CSS6개와 chest-open·주몽HD 2PNG 모두 HTTP200 및 로컬dist SHA 일치. Coutputs/codex53B-prep/B-production-bundle.json ok:true.
- 56-A sim61/61·본편/저장79/79(+저장최종10/10)·manifest동등성18/18 완료. root가 열전main/view/sound 연결중이며 아직 56-A 미커밋·미배포. 실제UI/전체검사/번들 검수 뒤 단계커밋. manifest 실제 빌드절감량 미측정. 기존사용자저장 clear0.


## 56-A 통합 검수 · 56-B 그림 수신
- 56-A 최종 전체1744/통과1742/실패0/기존skip2,108.937초. 실제tutorial회귀1건은region+id로빌린체험만보존/전역grant0으로고쳤고기존test유지. cast·shake tier누락도독립리뷰후RED→GREEN.
- build raw4959.5/gzip1547.6KB, 예산여유40.5/52.4KB. 로컬실HTML2개200·실JS/CSS6+이미지2 HTTP200/SHA일치. 단계커밋전실UI3사례진행중; 도구가알림레이어race로멈춘원로그를보존하고실입력경로교정중. 일반소유권/실clear/실폰FPS주장0.
- native56B 입자7개(칼/도끼/활/창/단검/술법/투석) 각각1회병렬발주·RAW7/7·재생성0. 누적21회/21RAW(native20/browser1). D창고56B-{kit}-particle-01-native.png+json각7전달. 실제referenceSHA/실첨부/원본불변·검수Coutputs/codex56B-art/. 7개core실잘림·구워진배경미발견/후보승인,패딩형식5미달별도공개/제품설치0. 후처리재그림0. root도7종gray합성실뷰.
- 56B sim정책 C준비5tests green/아직제품0. 새version으로56A로그보존,첫1.8초·후속0.9초/0.1slow,manualrelease에서만0.3daze/49cue. 기존일반actual1.1초/투지1.3초는MD≈.4와차이있어최종시전정책결정필요.
